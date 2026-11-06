import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import matter from 'gray-matter'
import GithubSlugger from 'github-slugger'
import { buildRoute, humanize, layerFor, normalizeRoute, postsOf, routeLocale, stripLocale, tagRoute } from '../shared.ts'
import type { FolderMeta, Frontmatter, HeadTag, Heading, PageMeta, ResolvedConfig } from '../types.ts'
import { transformSource } from './source.ts'
import { applyMetas, loadMetas } from './meta.ts'
import { locate, mountOf, mounts } from './mounts.ts'
import { prepareGenerated } from './generated.ts'

const PAGE_EXT = /\.(mdx|md)$/

/** `content/guide/index.mdx` → `/guide`, `content/a/b.md` → `/a/b`. */
export function routeFromFile(file: string): string {
  const rel = file.replace(/^content\//, '').replace(PAGE_EXT, '')
  const parts = rel.split('/').filter(Boolean)
  if (parts.at(-1) === 'index') parts.pop()
  return `/${parts.join('/')}`
}

async function walk(dir: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out: string[] = []
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(full)))
    else if (PAGE_EXT.test(e.name)) out.push(full)
  }
  return out
}

/** Plain text of a Markdown/MDX body: good enough for search and summaries. */
export function plainText(body: string): string {
  return body
    .replace(/^(import|export)\s.*$/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[`*_>#|~]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function headingsOf(body: string): Heading[] {
  const slugger = new GithubSlugger()
  const out: Heading[] = []
  const stripped = body.replace(/```[\s\S]*?```/g, '')
  for (const m of stripped.matchAll(/^(#{2,3})\s+(.+?)\s*#*\s*$/gm)) {
    const text = m[2].replace(/[`*_]/g, '').replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    out.push({ depth: m[1].length, text, id: slugger.slug(text) })
  }
  return out
}

/** Minutes to read: about 230 words or 450 CJK characters a minute. */
export function readingTime(text: string): number {
  const cjk = text.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g)?.length ?? 0
  const words = text.replace(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 230 + cjk / 450))
}

function asDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string' && value) return value
  return undefined
}

type GitDates = { at: number; dates: Map<string, string>; dirty: Set<string> }
const gitCache = new Map<string, GitDates>()

function git(root: string, args: string[]): string | null {
  try {
    const r = Bun.spawnSync(['git', '-C', root, ...args], { stdout: 'pipe', stderr: 'ignore' })
    return r.exitCode === 0 ? r.stdout.toString() : null
  } catch {
    return null
  }
}

/**
 * Last commit date of every file under `content/`, relative to the site root,
 * and the files with uncommitted changes. One `git log` per site, cached briefly.
 */
export function gitDates(root: string): GitDates {
  const cached = gitCache.get(root)
  if (cached && performance.now() - cached.at < 5000) return cached
  const dates = new Map<string, string>()
  const dirty = new Set<string>()
  const log = git(root, ['log', '--format=%x00%cI', '--name-only', '--relative', '--', 'content'])
  if (log) {
    let date = ''
    for (const line of log.split('\n')) {
      if (line.startsWith('\0')) date = line.slice(1).slice(0, 10)
      else if (line && date && !dates.has(line)) dates.set(line, date)
    }
    const prefix = (git(root, ['rev-parse', '--show-prefix']) ?? '').trim()
    for (const line of (git(root, ['status', '--porcelain', '--untracked-files=all', '--', 'content']) ?? '').split('\n')) {
      const path = line.slice(3).split(' -> ').at(-1)?.replace(/^"|"$/g, '')
      if (path) dirty.add(prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path)
    }
  }
  const result = { at: performance.now(), dates, dirty }
  gitCache.set(root, result)
  return result
}

/** Frontmatter `updated`, else the last commit touching the file, else its modification time. */
async function lastUpdated(root: string, file: string, abs: string, fm: Frontmatter): Promise<string> {
  const given = asDate(fm.updated)
  if (given) return given
  const { dates, dirty } = gitDates(root)
  const committed = dates.get(file)
  if (committed && !dirty.has(file)) return committed
  return (await stat(abs)).mtime.toISOString().slice(0, 10)
}

const asList = (v: unknown): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function headTags(v: unknown): HeadTag[] | undefined {
  if (!Array.isArray(v)) return undefined
  const tags = v.filter((t): t is HeadTag => !!t && typeof t === 'object' && typeof (t as HeadTag).tag === 'string')
  return tags.length ? tags : undefined
}

export async function readPage(root: string, abs: string, config: ResolvedConfig): Promise<PageMeta | null> {
  const file = relative(root, abs).split(sep).join('/')
  const source = (await transformSource(config, file, await readFile(abs, 'utf8'))).code
  const { data, content } = matter(source)
  const fm = data as Frontmatter
  if (fm.draft && process.env.NODE_ENV === 'production') return null
  const where = locate(config, file) ?? { route: routeFromFile(file), key: routeFromFile(file) }
  const route = where.route
  const mount = mountOf(config, file)
  const layer = layerFor(route, config.layers, config.layout)
  const fallbackTitle = where.key === '/' ? config.title : humanize(route.split('/').at(-1)!)
  const text = plainText(content)
  const title = fm.title ?? content.match(/^#\s+(.+)$/m)?.[1] ?? fallbackTitle
  const updated = await lastUpdated(root, file, abs, fm)
  const redirectFrom = asList(fm.redirectFrom).map(normalizeRoute)
  let page: PageMeta = {
    route,
    file,
    title,
    description: fm.description,
    label: fm.label ?? title,
    order: typeof fm.order === 'number' ? fm.order : Number.POSITIVE_INFINITY,
    icon: fm.icon,
    date: asDate(fm.date),
    updated,
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    author: fm.author,
    cover: fm.cover === false ? false : typeof fm.cover === 'string' && fm.cover ? fm.cover : undefined,
    image: typeof fm.image === 'string' && fm.image ? fm.image : undefined,
    og: fm.og === false || fm.image === false ? false : undefined,
    readingTime: readingTime(text),
    hidden: Boolean(fm.hidden),
    ...(fm.noindex === true ? { noindex: true } : {}),
    ...(redirectFrom.length ? { redirectFrom } : {}),
    ...(headTags(fm.head) ? { head: headTags(fm.head) } : {}),
    ...(typeof fm.badge === 'string' && fm.badge ? { badge: fm.badge } : {}),
    layer: layer.path,
    layout: layer.layout,
    kind: 'page',
    text,
    headings: headingsOf(content),
    ...(config.i18n || where.version ? { key: where.key } : {}),
    ...(where.locale ? { locale: where.locale } : {}),
    ...(where.version ? { version: where.version } : {}),
    ...(mount?.editLink ? { editUrl: `${mount.editLink.replace(/\/?$/, '/')}${file.slice(mount.rel.length + 1)}` } : mount?.external ? { editUrl: '' } : {}),
    ...(fm.layout === 'changelog' || fm.changelog === true ? { changelog: true } : {}),
    ...(fm.feedback === false ? { feedback: false as const } : {}),
  }
  const { activePlugins } = await import('./plugins.ts')
  for (const plugin of activePlugins(config)) {
    if (plugin.pageData) page = (await plugin.pageData(page, { config, file, frontmatter: fm })) ?? page
  }
  return page
}

/** The site title in the locale a route belongs to. */
function localeTitle(config: ResolvedConfig, route: string): string {
  const code = routeLocale(config, route)
  return config.i18n?.locales.find((l) => l.code === code)?.title ?? config.title
}

/** Adds the pages a blog layer generates: its post list (when no index file exists) and tag pages. */
function generatedPages(pages: PageMeta[], config: ResolvedConfig): PageMeta[] {
  const blogLayers = new Set<string>()
  if (config.layout === 'blog') blogLayers.add('/')
  for (const l of config.layers) if (l.layout === 'blog') blogLayers.add(l.path)
  const out: PageMeta[] = []
  for (const layer of blogLayers) {
    const layerTitle = config.layers.find((l) => l.path === layer)?.title
    if (!pages.some((p) => p.route === layer)) {
      out.push(generated(layer, layerTitle ?? (layer === '/' || config.i18n?.locales.some((l) => `/${l.code}` === layer) ? localeTitle(config, layer) : humanize(layer.split('/').at(-1)!)), layer, 'posts', config))
    }
    const tags = new Set(postsOf(pages, layer).flatMap((p) => p.tags))
    for (const tag of tags) {
      const page = generated(tagRoute(layer, tag, config.tags), `#${tag}`, layer, 'tag', config)
      page.tag = tag
      page.hidden = true
      out.push(page)
    }
  }
  return out
}

function generated(route: string, title: string, layer: string, kind: 'posts' | 'tag', config?: ResolvedConfig): PageMeta {
  const page: PageMeta = { route, file: '', title, label: title, order: 0, tags: [], hidden: false, layer, layout: 'blog', kind }
  if (config?.i18n) {
    const locale = routeLocale(config, route)
    page.locale = locale
    page.key = stripLocale(config, route)
  }
  return page
}

/** Pages of the default locale served at another locale's route where that locale has no translation. */
function fallbackPages(pages: PageMeta[], config: ResolvedConfig): PageMeta[] {
  const i18n = config.i18n
  if (!i18n?.fallback) return []
  const have = new Set(pages.map((p) => `${p.locale}|${p.version ?? ''}|${p.key ?? p.route}`))
  const out: PageMeta[] = []
  for (const locale of i18n.locales) {
    if (locale.code === i18n.defaultLocale) continue
    for (const p of pages) {
      if (p.kind !== 'page' || p.locale !== i18n.defaultLocale || have.has(`${locale.code}|${p.version ?? ''}|${p.key ?? p.route}`)) continue
      const route = buildRoute(config, p.key ?? p.route, locale.code, p.version)
      const layer = layerFor(route, config.layers, config.layout)
      out.push({ ...p, route, locale: locale.code, fallback: true, layer: layer.path, layout: layer.layout, redirectFrom: undefined })
    }
  }
  return out
}

export interface Duplicate {
  route: string
  files: string[]
}

/** Every page, plus routes more than one file maps to (the first file wins), and folder settings from `_meta` files. */
export async function scanPages(config: ResolvedConfig): Promise<{ pages: PageMeta[]; duplicates: Duplicate[]; folders: Record<string, FolderMeta> }> {
  await prepareGenerated(config)
  const files: string[] = []
  for (const m of mounts(config)) files.push(...(await walk(join(config.root, m.rel))).filter((f) => mountOf(config, relative(config.root, f).split(sep).join('/'))?.rel === m.rel))
  files.sort()
  const read = (await Promise.all(files.map((f) => readPage(config.root, f, config)))).filter((p): p is PageMeta => p !== null)
  const byRoute = new Map<string, PageMeta[]>()
  for (const p of read) byRoute.set(p.route, [...(byRoute.get(p.route) ?? []), p])
  const pages = [...byRoute.values()].map((list) => list[0])
  pages.push(...fallbackPages(pages, config))
  const duplicates = [...byRoute.values()].filter((l) => l.length > 1).map((l) => ({ route: l[0].route, files: l.map((p) => p.file) }))
  const folders = applyMetas(pages, await loadMetas(config))
  const all = [...pages, ...generatedPages(pages, config)]
  return { pages: all.sort((a, b) => a.route.localeCompare(b.route)), duplicates, folders }
}

/** Every page and the folder settings; throws when two files map to one route. */
export async function scanSite(config: ResolvedConfig): Promise<{ pages: PageMeta[]; folders: Record<string, FolderMeta> }> {
  const { pages, duplicates, folders } = await scanPages(config)
  const dup = duplicates[0]
  if (dup) throw new Error(`${dup.files[1]} and ${dup.files[0]} both map to ${dup.route}`)
  return { pages, folders }
}

export async function scanContent(config: ResolvedConfig): Promise<PageMeta[]> {
  return (await scanSite(config)).pages
}
