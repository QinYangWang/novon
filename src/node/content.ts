import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import matter from 'gray-matter'
import GithubSlugger from 'github-slugger'
import { humanize, layerFor, postsOf, tagRoute } from '../shared.ts'
import type { Frontmatter, Heading, PageMeta, ResolvedConfig } from '../types.ts'

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
  let updated = asDate(fm.updated)
  if (!updated) updated = (await stat(abs)).mtime.toISOString().slice(0, 10)
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
    cover: fm.cover,
    readingTime: readingTime(text),
    hidden: Boolean(fm.hidden),
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
      const page = generated(tagRoute(layer, tag), `#${tag}`, layer, 'tag')
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

export async function scanContent(config: ResolvedConfig): Promise<PageMeta[]> {
  const files = await walk(join(config.root, 'content'))
  const pages = (await Promise.all(files.map((f) => readPage(config.root, f, config)))).filter(
    (p): p is PageMeta => p !== null,
  )
  const seen = new Map<string, string>()
  for (const p of pages) {
    const prev = seen.get(p.route)
    if (prev) throw new Error(`${p.file} and ${prev} both map to ${p.route}`)
    seen.set(p.route, p.file)
  }
  const all = [...pages, ...generatedPages(pages, config)]
  return all.sort((a, b) => a.route.localeCompare(b.route))
}
