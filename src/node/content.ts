import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import matter from 'gray-matter'
import GithubSlugger from 'github-slugger'
import { humanize, layerFor, normalizeRoute, postsOf, tagRoute } from '../shared.ts'
import type { Frontmatter, HeadTag, Heading, PageMeta, ResolvedConfig } from '../types.ts'

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
  const source = await readFile(abs, 'utf8')
  const { data, content } = matter(source)
  const fm = data as Frontmatter
  if (fm.draft && process.env.NODE_ENV === 'production') return null
  const route = routeFromFile(file)
  const layer = layerFor(route, config.layers, config.layout)
  const fallbackTitle = route === '/' ? config.title : humanize(route.split('/').at(-1)!)
  const text = plainText(content)
  const title = fm.title ?? content.match(/^#\s+(.+)$/m)?.[1] ?? fallbackTitle
  const updated = await lastUpdated(root, file, abs, fm)
  const redirectFrom = asList(fm.redirectFrom).map(normalizeRoute)
  return {
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
    layer: layer.path,
    layout: layer.layout,
    kind: 'page',
    text,
    headings: headingsOf(content),
  }
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
      out.push(generated(layer, layerTitle ?? (layer === '/' ? config.title : humanize(layer.slice(1))), layer, 'posts'))
    }
    const tags = new Set(postsOf(pages, layer).flatMap((p) => p.tags))
    for (const tag of tags) {
      const page = generated(tagRoute(layer, tag, config.tags), `#${tag}`, layer, 'tag')
      page.tag = tag
      page.hidden = true
      out.push(page)
    }
  }
  return out
}

function generated(route: string, title: string, layer: string, kind: 'posts' | 'tag'): PageMeta {
  return { route, file: '', title, label: title, order: 0, tags: [], hidden: false, layer, layout: 'blog', kind }
}

export interface Duplicate {
  route: string
  files: string[]
}

/** Every page, plus routes more than one file maps to (the first file wins). */
export async function scanPages(config: ResolvedConfig): Promise<{ pages: PageMeta[]; duplicates: Duplicate[] }> {
  const files = (await walk(join(config.root, 'content'))).sort()
  const read = (await Promise.all(files.map((f) => readPage(config.root, f, config)))).filter((p): p is PageMeta => p !== null)
  const byRoute = new Map<string, PageMeta[]>()
  for (const p of read) byRoute.set(p.route, [...(byRoute.get(p.route) ?? []), p])
  const pages = [...byRoute.values()].map((list) => list[0])
  const duplicates = [...byRoute.values()].filter((l) => l.length > 1).map((l) => ({ route: l[0].route, files: l.map((p) => p.file) }))
  const all = [...pages, ...generatedPages(pages, config)]
  return { pages: all.sort((a, b) => a.route.localeCompare(b.route)), duplicates }
}

export async function scanContent(config: ResolvedConfig): Promise<PageMeta[]> {
  const { pages, duplicates } = await scanPages(config)
  const dup = duplicates[0]
  if (dup) throw new Error(`${dup.files[1]} and ${dup.files[0]} both map to ${dup.route}`)
  return pages
}
