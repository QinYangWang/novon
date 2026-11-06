/**
 * `novon export epub|pdf`: the site's docs as one book. Builds the site, then
 * takes each page's rendered article from `dist/` in sidebar order.
 *
 * - EPUB 3: a chapter per page, a navigation document, local images included,
 *   links between pages pointing at chapters.
 * - PDF: one `.print.html` with the site's styles, printed by a Chromium on
 *   PATH (or `NOVON_CHROME`); without one, how to print it by hand.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { FolderMeta, PageMeta, ResolvedConfig } from '../types.ts'
import { docsNav, flatten } from '../runtime/nav.ts'
import { withBase } from '../shared.ts'
import { htmlPath } from './build.ts'
import { langOf } from './i18n.ts'
import { zip } from './zip.ts'

export type ExportFormat = 'epub' | 'pdf'

export interface Chapter {
  page: PageMeta
  /** The article's inner HTML as the build rendered it. */
  html: string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The pages of the book, in reading order: docs layers in sidebar order, else posts oldest first. */
export function bookPages(config: ResolvedConfig, pages: PageMeta[], folders: Record<string, FolderMeta>, locale?: string): PageMeta[] {
  const code = locale ?? config.i18n?.defaultLocale
  if (config.i18n && !config.i18n.locales.some((l) => l.code === code)) throw new Error(`no locale "${locale}"; the site has ${config.i18n.locales.map((l) => l.code).join(', ')}`)
  const inBook = (p: PageMeta) => p.kind === 'page' && !p.version && !p.fallback && !p.hidden && !p.noindex && (!config.i18n || (p.locale ?? config.i18n.defaultLocale) === code)
  const chosen = pages.filter(inBook)
  const docsLayers = [...new Set(chosen.filter((p) => p.layout === 'docs').map((p) => p.layer))]
  const order = (l: string) => {
    const i = config.layers.findIndex((x) => x.path === l)
    return i < 0 ? Number.POSITIVE_INFINITY : i
  }
  docsLayers.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : order(a) - order(b) || a.localeCompare(b)))
  const out: PageMeta[] = []
  for (const layer of docsLayers) for (const p of flatten(docsNav(chosen, layer, folders))) if (!out.includes(p)) out.push(p)
  if (out.length) return out
  return chosen.filter((p) => p.layout === 'blog' && p.date).sort((a, b) => (a.date! < b.date! ? -1 : 1))
}

/** The inner HTML of the page's first `<article>`, without buttons, scripts, decoration and site chrome. */
export async function articleOf(html: string): Promise<string> {
  let marked = false
  const cleaned = await new HTMLRewriter()
    .on('script, button:not([data-slot="image-zoom-trigger"]), noscript, template, style, [data-novon-chrome], [data-novon-feedback], [aria-hidden="true"], .sr-only', {
      element(el) {
        el.remove()
      },
    })
    // A zoomable image keeps its picture.
    .on('button[data-slot="image-zoom-trigger"]', {
      element(el) {
        el.removeAndKeepContent()
      },
    })
    .on('article', {
      element(el) {
        if (marked) return
        marked = true
        el.setAttribute('data-novon-book', '')
      },
    })
    .transform(new Response(html))
    .text()
  const start = cleaned.indexOf('data-novon-book')
  if (start < 0) return ''
  const open = cleaned.indexOf('>', start) + 1
  // The article's balanced end tag.
  let level = 1
  const re = /<(\/?)article\b[^>]*>/g
  re.lastIndex = open
  for (let m = re.exec(cleaned); m; m = re.exec(cleaned)) {
    level += m[1] ? -1 : 1
    if (level === 0) return cleaned.slice(open, m.index)
  }
  return cleaned.slice(open)
}

const VOID = 'area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr'
const NAMED: Record<string, string> = { nbsp: '#160', copy: '#169', reg: '#174', hellip: '#8230', mdash: '#8212', ndash: '#8211', lsquo: '#8216', rsquo: '#8217', ldquo: '#8220', rdquo: '#8221', middot: '#183', times: '#215', larr: '#8592', rarr: '#8594' }

const ATTR = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g

/**
 * HTML as XHTML for a book: void elements closed, every attribute quoted with
 * a value, named entities numeric. `drop` lists attributes to leave out.
 */
export function toXhtml(html: string, drop: string[] = []): string {
  const voids = new RegExp(`^(${VOID})$`, 'i')
  return html
    .replace(/<([a-zA-Z][\w:-]*)((?:\s+(?:[^\s"'=<>/]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*(\/?)>/g, (_m, tag: string, attrs: string, self: string) => {
      const out: string[] = []
      const seen = new Set<string>()
      for (const a of attrs.matchAll(ATTR)) {
        const name = a[1]
        if (drop.includes(name.toLowerCase()) || seen.has(name)) continue
        seen.add(name)
        const value = (a[2] ?? a[3] ?? a[4] ?? '').replace(/&(?![a-z]+;|#\d+;|#x[\da-f]+;)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
        out.push(` ${name}="${value}"`)
      }
      if (tag.toLowerCase() === 'svg' && !seen.has('xmlns')) out.push(' xmlns="http://www.w3.org/2000/svg"')
      const close = self || voids.test(tag) ? '/' : ''
      return `<${tag}${out.join('')}${close}>`
    })
    .replace(new RegExp(`<\\/(${VOID})>`, 'gi'), '')
    .replace(/&([a-z]+);/gi, (m, name: string) => (['amp', 'lt', 'gt', 'quot', 'apos'].includes(name) ? m : NAMED[name] ? `&${NAMED[name]};` : ''))
}

interface Rewritten {
  html: string
  images: Map<string, string>
}

/**
 * Points links at chapters (or the site) and local images at their copy in the
 * book. `images` maps a dist path to its name in the book.
 */
export function rewriteRefs(html: string, config: ResolvedConfig, chapterOf: Map<string, string>, images: Map<string, string> | null = new Map()): Rewritten {
  const base = config.base
  const strip = (href: string) => (href.startsWith(base) ? `/${href.slice(base.length)}` : href)
  const out = html
    .replace(/\shref="([^"]*)"/g, (m, href: string) => {
      if (/^([a-z][a-z0-9+.-]*:|#)/i.test(href)) return m
      if (!href.startsWith('/')) return m
      const [path, hash] = strip(href).split('#')
      const route = path.replace(/\/index\.html$|\.html$|\/$/g, '') || '/'
      const chapter = chapterOf.get(route)
      if (chapter) return ` href="${chapter}${hash ? `#${hash}` : ''}"`
      return config.url ? ` href="${esc(new URL(withBase(base, route), config.url).href)}${hash ? `#${hash}` : ''}"` : m
    })
    .replace(/\ssrc="([^"]*)"/g, (m, src: string) => {
      if (!images || !src.startsWith('/') || src.startsWith('//')) return m
      const path = strip(src).split(/[?#]/)[0]
      if (!images.has(path)) images.set(path, `images/${images.size + 1}${extname(path).toLowerCase() || '.png'}`)
      return ` src="${images.get(path)}"`
    })
    .replace(/\ssrcset="[^"]*"/g, '')
  return { html: out, images: images ?? new Map() }
}

const MEDIA: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif' }

/** A stable book ID from the site's URL or title. */
function bookId(config: ResolvedConfig): string {
  const h = Bun.hash(config.url ?? config.title).toString(16).padStart(16, '0')
  const h2 = Bun.hash(`${config.title}|novon`).toString(16).padStart(16, '0')
  const hex = (h + h2).slice(0, 32)
  return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const STYLE = `body { font-family: serif; line-height: 1.5; margin: 0 4%; }
h1, h2, h3, h4 { font-family: sans-serif; line-height: 1.25; page-break-after: avoid; }
pre { white-space: pre-wrap; word-wrap: break-word; font-size: 0.85em; padding: 0.75em; border: 1px solid; border-radius: 4px; }
code { font-family: monospace; font-size: 0.9em; }
img, svg { max-width: 100%; height: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.9em; }
th, td { border: 1px solid; padding: 0.3em 0.5em; text-align: start; }
blockquote { margin: 1em 0; padding-inline-start: 1em; border-inline-start: 3px solid; }
nav ol { list-style: none; padding-inline-start: 1em; }
`

export interface BookInput {
  config: ResolvedConfig
  chapters: Chapter[]
  /** Reads a file from the built site by its path without base, e.g. `/logo.png`. */
  readAsset: (path: string) => Promise<Uint8Array | null>
  locale?: string
}

/** The EPUB file. */
export async function epub({ config, chapters, readAsset, locale }: BookInput): Promise<Uint8Array> {
  const loc = config.i18n ? config.i18n.locales.find((l) => l.code === (locale ?? config.i18n!.defaultLocale)) : undefined
  const title = loc?.title ?? config.title
  const lang = chapters[0] ? langOf(config, chapters[0].page) : (loc?.lang ?? config.lang)
  const dir = loc?.dir === 'rtl' ? 'rtl' : 'ltr'
  const chapterOf = new Map(chapters.map((c, i) => [c.page.route, `chapter-${i + 1}.xhtml`]))
  const images = new Map<string, string>()
  const files: { name: string; data: string | Uint8Array }[] = []
  const manifest: string[] = []
  const spine: string[] = []
  for (const [i, c] of chapters.entries()) {
    const { html } = rewriteRefs(c.html, config, chapterOf, images)
    const body = toXhtml(html, ['class', 'data-slot', 'target'])
    const remote = /\ssrc="https?:/.test(body)
    const name = chapterOf.get(c.page.route)!
    files.push({
      name: `OEBPS/${name}`,
      data: `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${esc(lang)}" lang="${esc(lang)}" dir="${dir}">\n<head><meta charset="utf-8"/><title>${esc(c.page.title)}</title><link rel="stylesheet" href="style.css"/></head>\n<body><section epub:type="chapter">${/<h1[\s>]/.test(body) ? '' : `<h1>${esc(c.page.title)}</h1>`}${body}</section></body>\n</html>\n`,
    })
    manifest.push(`<item id="c${i + 1}" href="${name}" media-type="application/xhtml+xml"${/<svg[\s>]/.test(body) || remote ? ` properties="${[/<svg[\s>]/.test(body) && 'svg', remote && 'remote-resources'].filter(Boolean).join(' ')}"` : ''}/>`)
    spine.push(`<itemref idref="c${i + 1}"/>`)
  }
  let n = 0
  for (const [path, name] of images) {
    const data = await readAsset(path)
    const type = MEDIA[extname(path).toLowerCase()]
    if (!data || !type) continue
    files.push({ name: `OEBPS/${name}`, data })
    manifest.push(`<item id="i${++n}" href="${name}" media-type="${type}"/>`)
  }
  const navList = chapters.map((c) => `<li><a href="${chapterOf.get(c.page.route)}">${esc(c.page.title)}</a></li>`).join('\n')
  const nav = `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${esc(lang)}" lang="${esc(lang)}" dir="${dir}">\n<head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" href="style.css"/></head>\n<body><nav epub:type="toc" id="toc"><h1>${esc(title)}</h1><ol>\n${navList}\n</ol></nav></body>\n</html>\n`
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${esc(lang)}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">${bookId(config)}</dc:identifier>
<dc:title>${esc(title)}</dc:title>
<dc:language>${esc(lang)}</dc:language>
${config.description ? `<dc:description>${esc(loc?.description ?? config.description)}</dc:description>\n` : ''}${config.url ? `<dc:source>${esc(config.url)}</dc:source>\n` : ''}<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="style" href="style.css" media-type="text/css"/>
${manifest.join('\n')}
</manifest>
<spine${dir === 'rtl' ? ' page-progression-direction="rtl"' : ''}>
${spine.join('\n')}
</spine>
</package>
`
  return zip([
    { name: 'mimetype', data: 'application/epub+zip', store: true },
    { name: 'META-INF/container.xml', data: `<?xml version="1.0" encoding="utf-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n` },
    { name: 'OEBPS/content.opf', data: opf },
    { name: 'OEBPS/nav.xhtml', data: nav },
    { name: 'OEBPS/style.css', data: STYLE },
    ...files,
  ])
}

/** One HTML file holding every chapter with the site's styles inlined; local images point at `dist/`. */
export function printHtml({ config, chapters, css, distDir, locale, htmlAttrs }: { config: ResolvedConfig; chapters: Chapter[]; css: string; distDir: string; locale?: string; htmlAttrs: string }): string {
  const loc = config.i18n ? config.i18n.locales.find((l) => l.code === (locale ?? config.i18n!.defaultLocale)) : undefined
  const title = loc?.title ?? config.title
  const chapterOf = new Map(chapters.map((c, i) => [c.page.route, `#chapter-${i + 1}`]))
  const body = chapters
    .map((c, i) => {
      const { html } = rewriteRefs(c.html, config, chapterOf, null)
      return `<article id="chapter-${i + 1}" class="typeset typeset-docs"${i ? ' style="break-before: page"' : ''}>${/<h1[\s>]/.test(html) ? '' : `<h1>${esc(c.page.title)}</h1>`}${html}</article>`
    })
    .join('\n')
  // Local images: file URLs into the built site.
  const fixed = body.replace(/\ssrc="(\/[^"/][^"]*)"/g, (m, src: string) => {
    const path = src.startsWith(config.base) ? src.slice(config.base.length) : src.slice(1)
    const file = join(distDir, path.split(/[?#]/)[0])
    return existsSync(file) ? ` src="${pathToFileURL(file).href}"` : m
  })
  return `<!doctype html>\n<html${htmlAttrs}>\n<head>\n<meta charset="utf-8">\n<title>${esc(title)}</title>\n<style>${css.replace(/<\/style/gi, '<\\/style')}</style>\n</head>\n<body>\n<main class="mx-auto max-w-3xl">\n${fixed}\n</main>\n</body>\n</html>\n`
}

/** A Chromium to print with: `NOVON_CHROME`, else the first one on PATH. */
export function findChrome(): string | null {
  const env = process.env.NOVON_CHROME
  if (env) return existsSync(env) || Bun.which(env) ? env : null
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome', 'microsoft-edge']) {
    const found = Bun.which(name)
    if (found) return found
  }
  return null
}

export interface ExportResult {
  file: string
  chapters: number
  /** For PDF without a browser: the HTML to print by hand. */
  printFile?: string
  printed?: boolean
}

async function collect(config: ResolvedConfig, locale?: string, built = false): Promise<{ chapters: Chapter[]; distDir: string }> {
  const { build } = await import('./build.ts')
  const { scanSite } = await import('./content.ts')
  if (!built) await build(config, { quiet: true })
  const distDir = join(config.root, 'dist')
  const { pages, folders } = await scanSite(config)
  const chapters: Chapter[] = []
  for (const page of bookPages(config, pages, folders, locale)) {
    const file = join(distDir, htmlPath(page.route, config.trailingSlash))
    if (!existsSync(file)) continue
    const html = await articleOf(await readFile(file, 'utf8'))
    if (html.trim()) chapters.push({ page, html })
  }
  if (!chapters.length) throw new Error('nothing to export: no docs pages or posts')
  return { chapters, distDir }
}

export async function exportBook(config: ResolvedConfig, format: ExportFormat, options: { out?: string; locale?: string; /** `dist/` is already built from the current content. */ built?: boolean } = {}): Promise<ExportResult> {
  if (format !== 'epub' && format !== 'pdf') throw new Error(`novon export takes epub or pdf, not "${format}"`)
  const slug = (config.title || 'book').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'book'
  const out = resolve(config.root, options.out ?? `${slug}${options.locale ? `.${options.locale}` : ''}.${format}`)
  const { chapters, distDir } = await collect(config, options.locale, options.built)
  await mkdir(dirname(out), { recursive: true })
  if (format === 'epub') {
    const readAsset = async (path: string) => {
      const file = join(distDir, path)
      return existsSync(file) && file.startsWith(distDir) ? new Uint8Array(await readFile(file)) : null
    }
    await writeFile(out, await epub({ config, chapters, readAsset, locale: options.locale }))
    return { file: out, chapters: chapters.length }
  }
  // The site's stylesheets and <html> attributes, from the built home page (or any page).
  const first = join(distDir, htmlPath(chapters[0].page.route, config.trailingSlash))
  const page = await readFile(first, 'utf8')
  const htmlAttrs = page.match(/<html([^>]*)>/)?.[1] ?? ''
  let css = ''
  for (const m of page.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)) {
    const path = m[1].startsWith(config.base) ? m[1].slice(config.base.length) : m[1].replace(/^\//, '')
    const file = join(distDir, path)
    if (existsSync(file)) css += await readFile(file, 'utf8')
  }
  const printFile = out.replace(/\.pdf$/i, '') + '.print.html'
  await writeFile(printFile, printHtml({ config, chapters, css, distDir, locale: options.locale, htmlAttrs }))
  const chrome = findChrome()
  if (!chrome) return { file: out, chapters: chapters.length, printFile, printed: false }
  const r = Bun.spawnSync([chrome, '--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer', `--print-to-pdf=${out}`, pathToFileURL(printFile).href], { stdout: 'pipe', stderr: 'pipe' })
  if (r.exitCode !== 0 || !existsSync(out)) throw new Error(`${basename(chrome)} could not print: ${r.stderr.toString().trim().split('\n').at(-1) ?? r.exitCode}. Open ${relative(process.cwd(), printFile)} and print it to PDF.`)
  return { file: out, chapters: chapters.length, printFile, printed: true }
}

