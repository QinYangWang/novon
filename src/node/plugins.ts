import matter from 'gray-matter'
import { buildRoute, postsOf, withBase } from '../shared.ts'
import type { BuildContext, NovonPlugin, PageMeta, ResolvedConfig } from '../types.ts'
import { mdxToMarkdown } from './markdown.ts'
import { pageSource } from './source.ts'
import { pageEntries, type SearchEntry } from './search-index.ts'
import { agents } from './agents.ts'
import { changelogEntries, changelogFeedPath } from './changelog.ts'
import { canonicalRoute, isListedCopy, localeOf, localePrefix, searchPath, slices, translations } from './i18n.ts'
import { analytics } from './analytics.ts'

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const listed = (pages: PageMeta[], config?: ResolvedConfig) => pages.filter((p) => !p.hidden && p.kind !== 'tag' && !(config && isListedCopy(config, p)))
/** Pages for crawlers and agents: listed, not `noindex`, not a fallback copy or an archived version. */
const indexable = (pages: PageMeta[], config?: ResolvedConfig) => listed(pages, config).filter((p) => !p.noindex)

export function absolute(config: ResolvedConfig, route: string): string {
  const path = withBase(config.base, route)
  return config.url ? new URL(path, config.url).href : path
}

export function sectionOf(page: PageMeta, pages: PageMeta[]): string | undefined {
  const prefix = page.layer === '/' ? '' : page.layer
  const parts = page.route.slice(prefix.length).split('/').filter(Boolean)
  const first = parts[0]
  if (!first) return undefined
  if (parts.length === 1 && !pages.some((p) => p.route.startsWith(`${page.route}/`))) return undefined
  return pages.find((p) => p.route === `${prefix}/${first}`)?.label
}

/** search.json: a page entry and an entry per heading section of every listed page, with their full text. */
export async function searchIndex(config: ResolvedConfig, pages: PageMeta[]): Promise<SearchEntry[]> {
  const out: SearchEntry[] = []
  for (const p of listed(pages, config).filter((p) => p.kind === 'page' && p.file)) {
    const { code } = await pageSource(config, p.file)
    out.push(...pageEntries(p, code, p.layout === 'blog' ? 'Posts' : sectionOf(p, pages)))
  }
  return out
}

/** search.json per locale and listed version: `/search.json`, `/ja/search.json`, `/v1/search.json`. */
const search: NovonPlugin = {
  name: 'search',
  async buildEnd({ emit, pages, config }) {
    for (const slice of slices(config, pages, { versions: true })) {
      if (slice.prefix && !slice.pages.some((p) => p.kind === 'page' && !p.fallback)) continue
      await emit(searchPath(slice.prefix).slice(1), JSON.stringify(await searchIndex(config, slice.pages)))
    }
  },
}

function urlset(config: ResolvedConfig, list: PageMeta[], all: PageMeta[]): string {
  const multi = !!config.i18n
  const urls = list.map((p) => {
    const alternates = multi
      ? translations(all, p)
          .filter((t) => !t.noindex && !t.hidden)
          .map((t) => `<xhtml:link rel="alternate" hreflang="${xml(localeOf(config, t)?.lang ?? config.lang)}" href="${xml(absolute(config, t.route))}"/>`)
          .join('')
      : ''
    return `  <url><loc>${xml(absolute(config, p.route))}</loc>${p.updated ? `<lastmod>${p.updated}</lastmod>` : ''}${alternates}</url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${multi ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''}>\n${urls.join('\n')}\n</urlset>\n`
}

/** sitemap.xml; with locales, a sitemap index of one `sitemap-<locale>.xml` per locale. */
const sitemap: NovonPlugin = {
  name: 'sitemap',
  async buildEnd({ emit, pages, config }) {
    // Pages whose canonical is another page (an older version of a current one) stay out.
    const list = indexable(pages, config).filter((p) => canonicalRoute(config, p, pages) === p.route)
    if (config.i18n) {
      const files: string[] = []
      for (const slice of slices(config, list)) {
        const file = `sitemap-${slice.locale!.code}.xml`
        files.push(file)
        await emit(file, urlset(config, slice.pages, pages))
      }
      await emit('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map((f) => `  <sitemap><loc>${xml(absolute(config, `/${f}`))}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`)
    } else await emit('sitemap.xml', urlset(config, list, pages))
    if (config.url) await emit('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${absolute(config, '/sitemap.xml')}\n`)
  },
}

/** Root-relative `href` and `src` in feed HTML, made absolute so feed readers can follow them. */
export function absoluteUrls(html: string, config: ResolvedConfig): string {
  if (!config.url) return html
  return html.replace(/\b(href|src)="(\/(?!\/)[^"]*)"/g, (_m, attr: string, path: string) => {
    const withSite = path.startsWith(config.base) || config.base === '/' ? path : withBase(config.base, path)
    return `${attr}="${new URL(withSite, config.url).href}"`
  })
}

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`

/** The feed path of a locale: `/rss.xml`, `/ja/rss.xml`. */
export function feedPath(config: ResolvedConfig, locale?: string): string {
  return `${localePrefix(config, locale)}${config.rss.path}`
}

const rss: NovonPlugin = {
  name: 'rss',
  async buildEnd(ctx) {
    const { emit, pages, config } = ctx
    for (const slice of slices(config, pages)) {
      const locale = slice.locale
      await writeFeed(ctx, slice.pages.filter((p) => !p.fallback), feedPath(config, locale?.code), {
        title: locale?.title ?? config.title,
        description: locale?.description ?? config.description ?? config.title,
        lang: locale?.lang ?? config.lang,
        home: locale ? (slice.prefix || '/') : '/',
      })
    }
    // A feed of each changelog page's releases, beside the page.
    for (const page of pages.filter((p) => p.changelog && p.file && !p.fallback)) {
      const entries = changelogEntries((await pageSource(config, page.file)).code, !page.file.endsWith('.md'))
      if (!entries.length) continue
      const locale = localeOf(config, page)
      const items = entries.slice(0, 50).map((e) => {
        const link = absolute(config, `${page.route}#${e.anchor}`)
        return `    <item>
      <title>${xml(e.title)}</title>
      <link>${xml(link)}</link>
      <guid>${xml(link)}</guid>${e.date ? `\n      <pubDate>${new Date(e.date).toUTCString()}</pubDate>` : ''}${e.text ? `\n      <description>${xml(e.text.slice(0, 600))}</description>` : ''}
    </item>`
      })
      await emit(
        changelogFeedPath(page.route).slice(1),
        `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xml(`${page.title} · ${locale?.title ?? config.title}`)}</title>
    <link>${xml(absolute(config, page.route))}</link>
    <description>${xml(page.description ?? page.title)}</description>
    <language>${xml(locale?.lang ?? config.lang)}</language>
${items.join('\n')}
  </channel>
</rss>
`,
      )
    }
  },
}

async function writeFeed({ emit, config, renderContent }: BuildContext, pages: PageMeta[], path: string, channel: { title: string; description: string; lang: string; home: string }) {
    const layers = new Set(pages.filter((p) => p.layout === 'blog').map((p) => p.layer))
    const posts = [...layers].flatMap((l) => postsOf(pages, l)).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    if (!posts.length) return
    const full = config.rss.full && renderContent
    const items: string[] = []
    for (const p of posts.slice(0, 50)) {
      const body = full ? `\n      <content:encoded>${cdata(absoluteUrls(await renderContent(p), config))}</content:encoded>` : ''
      items.push(`    <item>
      <title>${xml(p.title)}</title>
      <link>${xml(absolute(config, p.route))}</link>
      <guid>${xml(absolute(config, p.route))}</guid>${p.date ? `\n      <pubDate>${new Date(p.date).toUTCString()}</pubDate>` : ''}${p.description ? `\n      <description>${xml(p.description)}</description>` : ''}${p.tags.map((t) => `\n      <category>${xml(t)}</category>`).join('')}${body}
    </item>`)
    }
    await emit(
      path.slice(1),
      `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"${full ? ' xmlns:content="http://purl.org/rss/1.0/modules/content/"' : ''}>
  <channel>
    <title>${xml(channel.title)}</title>
    <link>${xml(absolute(config, channel.home))}</link>
    <description>${xml(channel.description)}</description>
    <language>${xml(channel.lang)}</language>
${items.join('\n')}
  </channel>
</rss>
`,
    )
}

/** llms.txt, llms-full.txt and a plain Markdown copy of every page at `<route>.md`. */
const llms: NovonPlugin = {
  name: 'llms',
  async buildEnd(ctx) {
    const markdown = await emitMarkdown(ctx)
    const { emit, pages, config } = ctx
    for (const slice of slices(config, indexable(pages, config).filter((p) => p.kind === 'page'))) {
      const docs = slice.pages.filter((p) => !p.version)
      const dir = localePrefix(config, slice.locale?.code)
      const title = slice.locale?.title ?? config.title
      const description = slice.locale?.description ?? config.description
      const lines = [`# ${title}`, '', description ? `> ${description}\n` : '']
      for (const p of docs) {
        lines.push(`- [${p.title}](${absolute(config, markdownPath(p.route))})${p.description ? `: ${p.description}` : ''}`)
      }
      // The current version's docs come first; listed older versions follow as their own section.
      const versions = (config.versions?.list ?? []).filter((v) => !v.hidden && !v.archived)
      const extra = dir ? [] : agentLinks(config)
      if (extra.length) lines.push('', '## Optional', '', ...extra)
      if (versions.length) lines.push('', `Older versions: ${versions.map((v) => `${v.label} (${absolute(config, buildRoute(config, '/', slice.locale?.code, v.id))})`).join(', ')}`)
      const others = config.i18n && !dir ? config.i18n.locales.filter((l) => l.code !== config.i18n!.defaultLocale) : []
      if (others.length) lines.push('', `Other languages: ${others.map((l) => `${l.label} (${absolute(config, `/${l.code}/llms.txt`)})`).join(', ')}`)
      await emit(`${dir ? `${dir.slice(1)}/` : ''}llms.txt`, `${lines.join('\n')}\n`)
      await emit(`${dir ? `${dir.slice(1)}/` : ''}llms-full.txt`, llmsFull({ ...config, title, description }, docs, markdown))
    }
  },
}

/** Every indexable page's Markdown in one file, each headed by its URL. */
export function llmsFull(config: ResolvedConfig, pages: PageMeta[], markdown: Map<string, string>): string {
  const head = [`# ${config.title}`, config.description && `> ${config.description}`].filter(Boolean).join('\n\n')
  const parts = pages.filter((p) => markdown.has(p.route)).map((p) => `Source: ${absolute(config, p.route)}\n\n${markdown.get(p.route)!.trim()}`)
  return `${[head, ...parts].join('\n\n---\n\n')}\n`
}

/** The agent files a build writes, for the end of llms.txt. */
function agentLinks(config: ResolvedConfig): string[] {
  const a = config.agents
  if (a === false) return []
  const out: string[] = []
  if (config.url && a?.skill !== false) out.push(`- [Agent skill](${absolute(config, '/skill.md')}): how to read these docs, for coding agents`)
  if (a?.api !== false) {
    out.push(`- [Page index](${absolute(config, '/api/pages.json')}): every page as JSON, with its Markdown and JSON URLs`)
    out.push(`- [OpenAPI description](${absolute(config, '/openapi.json')}): the JSON files this site serves`)
  }
  return out
}

export function markdownPath(route: string): string {
  return `${route === '/' ? '/index' : route}.md`
}

/** A page as plain Markdown: title, description, then the body with components written out. */
export async function pageMarkdown(config: ResolvedConfig, page: PageMeta, pages?: PageMeta[]): Promise<string> {
  const { content } = matter((await pageSource(config, page.file)).code)
  let body = mdxToMarkdown(content, { page, pages, mdx: !page.file.endsWith('.md'), link: (r) => absolute(config, markdownPath(r)) })
  // The title is written above; a body that opens with the same heading would repeat it.
  const h1 = body.match(/^# (.+)\n*/)
  if (h1 && h1[1].trim() === page.title) body = body.slice(h1[0].length)
  return `# ${page.title}\n\n${page.description ? `${page.description}\n\n` : ''}${body}\n`
}

async function emitMarkdown({ emit, pages, config, markdown }: BuildContext): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const p of pages) {
    if (!p.file || p.fallback) continue
    const md = markdown ? await markdown(p) : await pageMarkdown(config, p, pages)
    out.set(p.route, md)
    await emit(markdownPath(p.route).slice(1), md)
  }
  return out
}

export const builtinPlugins: Record<string, NovonPlugin> = { search, sitemap, rss, llms }

/** A page's Markdown, computed once per build. */
export function markdownCache(config: ResolvedConfig, pages: PageMeta[]): (page: PageMeta) => Promise<string> {
  const cache = new Map<string, Promise<string>>()
  return (page) => {
    let md = cache.get(page.route)
    if (!md) cache.set(page.route, (md = pageMarkdown(config, page, pages)))
    return md
  }
}

/** The plugins that run: the built-in ones `plugins` names, the site's own, then agent files and analytics, which their own config keys switch. */
export function activePlugins(config: ResolvedConfig): NovonPlugin[] {
  const listed = (config.plugins ?? []).map((p) => {
    if (typeof p !== 'string') return p
    const found = builtinPlugins[p]
    if (!found) throw new Error(`Unknown plugin "${p}". Built-in plugins: ${Object.keys(builtinPlugins).join(', ')}`)
    return found
  })
  return [...listed, ...(config.agents === false ? [] : [agents]), ...(config.analytics ? [analytics] : [])]
}
