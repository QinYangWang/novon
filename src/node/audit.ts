/**
 * `novon audit`: reads the built site in `dist/` the way a crawler would and
 * reports what hurts search and sharing: missing or duplicate titles and
 * descriptions, missing `alt`, oversized images, broken share images, pages
 * missing from the sitemap, heading order, and links to pages that are not there.
 */
import { existsSync, statSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { stripBase } from '../shared.ts'
import type { PageMeta, ResolvedConfig } from '../types.ts'

export interface AuditIssue {
  severity: 'error' | 'warning'
  rule: string
  /** Route of the page, without base. */
  page?: string
  /** Source file of the page, when known. */
  file?: string
  message: string
}

export interface AuditOptions {
  /** Built site folder. Default `<root>/dist`. */
  dir?: string
  /** Images larger than this many bytes are reported. Default 500 kB. */
  maxImageBytes?: number
  /** Page sources, to name the file behind each page. */
  pages?: PageMeta[]
}

const TITLE_MAX = 60
const DESCRIPTION_MAX = 160
const DESCRIPTION_MIN = 50

async function htmlFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await htmlFiles(full)))
    else if (e.name.endsWith('.html')) out.push(full)
  }
  return out
}

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

function attrOf(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? '') : undefined
}

const meta = (head: string, key: string, value: string) => {
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) if (attrOf(tag, key) === value) return attrOf(tag, 'content')
  return undefined
}

export interface PageFacts {
  route: string
  title?: string
  description?: string
  canonical?: string
  robots?: string
  ogImage?: string
  lang?: string
  redirect: boolean
  h: number[]
  images: { src?: string; alt?: string }[]
  links: string[]
}

/** What the audit reads from one HTML file. */
export function readPage(html: string, route: string): PageFacts {
  const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html).replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<template\b[\s\S]*?<\/template>/gi, '')
  const title = head.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
  const canonicalTag = (head.match(/<link\b[^>]*>/gi) ?? []).find((t) => attrOf(t, 'rel') === 'canonical')
  return {
    route,
    title: title === undefined ? undefined : decode(title).trim(),
    description: meta(head, 'name', 'description'),
    canonical: canonicalTag ? attrOf(canonicalTag, 'href') : undefined,
    robots: meta(head, 'name', 'robots'),
    ogImage: meta(head, 'property', 'og:image'),
    lang: attrOf(html.match(/<html\b[^>]*>/i)?.[0] ?? '', 'lang'),
    redirect: /<meta\s+http-equiv="refresh"/i.test(head),
    h: [...body.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1])),
    images: (body.match(/<img\b[^>]*>/gi) ?? []).map((t) => ({ src: attrOf(t, 'src'), alt: attrOf(t, 'alt') })),
    links: (body.match(/<a\b[^>]*>/gi) ?? []).map((t) => attrOf(t, 'href')).filter((h): h is string => !!h),
  }
}

/** Routes listed in sitemap.xml, following a sitemap index. */
async function sitemapRoutes(dir: string, config: ResolvedConfig): Promise<Set<string> | null> {
  const read = async (file: string): Promise<string | null> => (existsSync(join(dir, file)) ? readFile(join(dir, file), 'utf8') : null)
  const root = await read('sitemap.xml')
  if (root === null) return null
  const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
  const urls: string[] = []
  if (/<sitemapindex/.test(root)) {
    for (const loc of locs(root)) {
      const path = new URL(loc, 'http://novon.local').pathname
      const child = await read(stripBase(config.base, path)?.slice(1) ?? path.slice(1))
      if (child) urls.push(...locs(child))
    }
  } else urls.push(...locs(root))
  return new Set(urls.map((u) => stripBase(config.base, decodeURIComponent(new URL(u, 'http://novon.local').pathname)) ?? u))
}

/** The file a site path is served from, if any. */
function served(dir: string, path: string): boolean {
  const clean = decodeURIComponent(path.split(/[?#]/)[0])
  const candidates = [clean, join(clean, 'index.html'), `${clean}.html`]
  return candidates.some((c) => {
    const f = join(dir, c)
    return f.startsWith(dir) && existsSync(f) && statSync(f).isFile()
  })
}

export async function audit(config: ResolvedConfig, options: AuditOptions = {}): Promise<AuditIssue[]> {
  const dir = options.dir ?? join(config.root, 'dist')
  if (!existsSync(join(dir, 'index.html')) && !existsSync(join(dir, '404.html'))) throw new Error(`No built site in ${relative(process.cwd(), dir) || dir}; run \`novon build\` first`)
  const maxImage = options.maxImageBytes ?? 500 * 1024
  const files = options.pages ? new Map(options.pages.filter((p) => p.file && !p.fallback).map((p) => [p.route, p.file])) : new Map<string, string>()
  const issues: AuditIssue[] = []
  const pages: PageFacts[] = []
  for (const file of await htmlFiles(dir)) {
    const rel = relative(dir, file).split(sep).join('/')
    if (rel === '404.html') continue
    const route = `/${rel.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '')}`.replace(/\/$/, '') || '/'
    pages.push(readPage(await readFile(file, 'utf8'), route))
  }
  const add = (severity: AuditIssue['severity'], rule: string, page: PageFacts | undefined, message: string) =>
    issues.push({ severity, rule, ...(page ? { page: page.route, ...(files.get(page.route) ? { file: files.get(page.route) } : {}) } : {}), message })

  const real = pages.filter((p) => !p.redirect)
  const indexed = real.filter((p) => !/noindex/i.test(p.robots ?? ''))
  // Pages pointing their canonical elsewhere (untranslated fallbacks, older versions) are copies, not duplicates.
  const own = (p: PageFacts) => !p.canonical || stripBase(config.base, decodeURIComponent(new URL(p.canonical, 'http://novon.local').pathname)) === p.route

  for (const p of real) {
    const copy = !own(p)
    if (!p.title) add('error', 'title', p, 'No <title>')
    else if (copy) {
      // A fallback or older-version copy: its text is the original's, checked there.
    }
    else if (p.title.length > TITLE_MAX) add('warning', 'title', p, `Title is ${p.title.length} characters; search results show about ${TITLE_MAX}`)
    if (copy) {
      // Checked on the original page.
    } else if (!p.description) add('warning', 'description', p, 'No meta description')
    else if (p.description.length > DESCRIPTION_MAX) add('warning', 'description', p, `Description is ${p.description.length} characters; keep it under ${DESCRIPTION_MAX}`)
    else if (p.description.length < DESCRIPTION_MIN && p.route !== '/') add('warning', 'description', p, `Description is ${p.description.length} characters; ${DESCRIPTION_MIN}–${DESCRIPTION_MAX} reads best in results`)
    if (!p.lang) add('warning', 'lang', p, 'No lang on <html>')
    if (config.url && !p.canonical) add('warning', 'canonical', p, 'No canonical link')
    const h1 = p.h.filter((h) => h === 1).length
    if (h1 === 0) add('warning', 'headings', p, 'No <h1>')
    else if (h1 > 1) add('warning', 'headings', p, `${h1} <h1> elements; use one`)
    for (let i = 1; i < p.h.length; i++) {
      if (p.h[i] > p.h[i - 1] + 1) {
        add('warning', 'headings', p, `Heading level jumps from h${p.h[i - 1]} to h${p.h[i]}`)
        break
      }
    }
    for (const img of p.images) {
      if (img.alt === undefined) add('warning', 'alt', p, `Image ${img.src ?? ''} has no alt text`)
      if (img.src && !/^(https?:|data:)/.test(img.src)) {
        const path = stripBase(config.base, img.src.split(/[?#]/)[0]) ?? img.src
        const f = join(dir, decodeURIComponent(path))
        if (existsSync(f) && statSync(f).isFile() && statSync(f).size > maxImage) add('warning', 'image-size', p, `${img.src} is ${Math.round(statSync(f).size / 1024)} kB`)
      }
    }
    if (p.ogImage) {
      const url = new URL(p.ogImage, config.url ?? 'http://novon.local')
      const local = !config.url || url.origin === new URL(config.url).origin || url.origin === 'http://novon.local'
      if (local) {
        const path = stripBase(config.base, decodeURIComponent(url.pathname))
        if (!path || !served(dir, path)) add('error', 'og-image', p, `Share image ${p.ogImage} is not in the build`)
      }
      if (!/^https?:\/\//.test(p.ogImage)) add('warning', 'og-image', p, 'Share image URL is relative; set `url` so social sites can load it')
    } else if (config.og !== false && !copy) add('warning', 'og-image', p, 'No share image (og:image)')
    for (const href of p.links) {
      if (!href.startsWith('/') || href.startsWith('//')) continue
      const path = stripBase(config.base, href.split(/[?#]/)[0])
      if (path === null) continue
      if (!served(dir, path === '/' ? '/index.html' : path)) add('error', 'link', p, `Link to ${href}, which is not in the build`)
    }
  }

  const byTitle = new Map<string, PageFacts[]>()
  for (const p of indexed.filter(own)) if (p.title) byTitle.set(p.title, [...(byTitle.get(p.title) ?? []), p])
  for (const [title, list] of byTitle) if (list.length > 1) for (const p of list) add('warning', 'duplicate-title', p, `Same title as ${list.filter((x) => x !== p).map((x) => x.route).join(', ')}: "${title}"`)
  const byDescription = new Map<string, PageFacts[]>()
  for (const p of indexed.filter(own)) if (p.description) byDescription.set(p.description, [...(byDescription.get(p.description) ?? []), p])
  for (const [, list] of byDescription) if (list.length > 1) for (const p of list) add('warning', 'duplicate-description', p, `Same description as ${list.filter((x) => x !== p).map((x) => x.route).join(', ')}`)

  const sitemap = await sitemapRoutes(dir, config)
  if (!sitemap) add('warning', 'sitemap', undefined, 'No sitemap.xml')
  else {
    for (const p of indexed.filter(own)) if (!sitemap.has(p.route)) add('warning', 'sitemap', p, 'Not in the sitemap')
    for (const route of sitemap) if (!served(dir, route === '/' ? '/index.html' : route)) add('error', 'sitemap', undefined, `Sitemap lists ${route}, which is not in the build`)
  }
  if (!existsSync(join(dir, 'robots.txt'))) add('warning', 'robots', undefined, 'No robots.txt (set `url` to get one)')

  return issues.sort((a, b) => (a.page ?? '').localeCompare(b.page ?? '') || a.rule.localeCompare(b.rule))
}

export function formatAudit(issues: AuditIssue[]): string {
  const color = (code: number, s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s)
  return issues
    .map((i) => {
      const where = [i.page, i.file && color(2, `(${i.file})`)].filter(Boolean).join(' ')
      const sev = i.severity === 'error' ? color(31, 'error') : color(33, 'warning')
      return `${where ? `${where}  ` : ''}${sev}  ${i.message}  ${color(2, i.rule)}`
    })
    .join('\n')
}
