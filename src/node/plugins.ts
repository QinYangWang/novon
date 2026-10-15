import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import matter from 'gray-matter'
import { postsOf, withBase } from '../shared.ts'
import type { BuildContext, NovonPlugin, PageMeta, ResolvedConfig } from '../types.ts'

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const listed = (pages: PageMeta[]) => pages.filter((p) => !p.hidden && p.kind !== 'tag')

function absolute(config: ResolvedConfig, route: string): string {
  const path = withBase(config.base, route)
  return config.url ? new URL(path, config.url).href : path
}

function sectionOf(page: PageMeta, pages: PageMeta[]): string | undefined {
  const prefix = page.layer === '/' ? '' : page.layer
  const parts = page.route.slice(prefix.length).split('/').filter(Boolean)
  const first = parts[0]
  if (!first) return undefined
  if (parts.length === 1 && !pages.some((p) => p.route.startsWith(`${page.route}/`))) return undefined
  return pages.find((p) => p.route === `${prefix}/${first}`)?.label
}

/** search.json: what the search palette matches against. */
export function searchIndex(pages: PageMeta[]) {
  return listed(pages)
    .filter((p) => p.kind === 'page')
    .map((p) => ({
      route: p.route,
      title: p.title,
      description: p.description,
      section: p.layout === 'blog' ? 'Posts' : sectionOf(p, pages),
      icon: p.icon,
      headings: p.headings?.map((h) => h.text),
      text: p.text?.slice(0, 600),
    }))
}

const search: NovonPlugin = {
  name: 'search',
  async buildEnd({ emit, pages }) {
    await emit('search.json', JSON.stringify(searchIndex(pages)))
  },
}

const sitemap: NovonPlugin = {
  name: 'sitemap',
  async buildEnd({ emit, pages, config }) {
    const urls = listed(pages)
      .map((p) => `  <url><loc>${xml(absolute(config, p.route))}</loc>${p.updated ? `<lastmod>${p.updated}</lastmod>` : ''}</url>`)
      .join('\n')
    await emit('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
    if (config.url) await emit('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${absolute(config, '/sitemap.xml')}\n`)
  },
}

const rss: NovonPlugin = {
  name: 'rss',
  async buildEnd({ emit, pages, config }) {
    const layers = new Set(pages.filter((p) => p.layout === 'blog').map((p) => p.layer))
    const posts = [...layers].flatMap((l) => postsOf(pages, l)).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    if (!posts.length) return
    const items = posts
      .slice(0, 50)
      .map(
        (p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${xml(absolute(config, p.route))}</link>
      <guid>${xml(absolute(config, p.route))}</guid>${p.date ? `\n      <pubDate>${new Date(p.date).toUTCString()}</pubDate>` : ''}${p.description ? `\n      <description>${xml(p.description)}</description>` : ''}
    </item>`,
      )
      .join('\n')
    await emit(
      'rss.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xml(config.title)}</title>
    <link>${xml(absolute(config, '/'))}</link>
    <description>${xml(config.description ?? config.title)}</description>
${items}
  </channel>
</rss>
`,
    )
  },
}

/** llms.txt plus a raw Markdown copy of every page at `<route>.md`. */
const llms: NovonPlugin = {
  name: 'llms',
  async buildEnd(ctx) {
    await emitMarkdown(ctx)
    const { emit, pages, config } = ctx
    const lines = [`# ${config.title}`, '', config.description ? `> ${config.description}\n` : '']
    for (const p of listed(pages).filter((p) => p.kind === 'page')) {
      lines.push(`- [${p.title}](${absolute(config, markdownPath(p.route))})${p.description ? `: ${p.description}` : ''}`)
    }
    await emit('llms.txt', `${lines.join('\n')}\n`)
  },
}

export function markdownPath(route: string): string {
  return `${route === '/' ? '/index' : route}.md`
}

export async function pageMarkdown(config: ResolvedConfig, page: PageMeta): Promise<string> {
  const { content } = matter(await readFile(join(config.root, page.file), 'utf8'))
  const body = content.replace(/^(import|export)\s.*$\n?/gm, '').trim()
  return `# ${page.title}\n\n${page.description ? `${page.description}\n\n` : ''}${body}\n`
}

async function emitMarkdown({ emit, pages, config }: BuildContext) {
  for (const p of pages) if (p.file) await emit(markdownPath(p.route).slice(1), await pageMarkdown(config, p))
}

export const builtinPlugins: Record<string, NovonPlugin> = { search, sitemap, rss, llms }

export function activePlugins(config: ResolvedConfig): NovonPlugin[] {
  return (config.plugins ?? []).map((p) => {
    if (typeof p !== 'string') return p
    const found = builtinPlugins[p]
    if (!found) throw new Error(`Unknown plugin "${p}". Built-in plugins: ${Object.keys(builtinPlugins).join(', ')}`)
    return found
  })
}
