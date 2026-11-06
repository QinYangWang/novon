/**
 * Sources that return pages instead of files: `notion`, `http` (any JSON) and
 * `custom` (`defineSource`). Each sync writes the pages as Markdown into the
 * source's cache folder, where they are mounted like any other source.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import matter from 'gray-matter'
import type { CustomSource, HttpSource, NotionSource, ResolvedConfig, SourceContext, SourcePage } from '../types.ts'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function sourceContext(config: ResolvedConfig): SourceContext {
  const f = ((input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, headers: { 'user-agent': 'novon', ...(init?.headers as Record<string, string> | undefined) } })) as typeof fetch
  return { config, fetch: f, env: process.env }
}

/** A page path made safe for a file name: lowercase segments, no `..`. */
export function cleanPagePath(path: string): string {
  const parts = path
    .split('/')
    .map((p) => p.trim().toLowerCase().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^[-.]+|-+$/g, ''))
    .filter((p) => p && p !== '..')
  return parts.join('/') || 'index'
}

/** Writes pages into `dir`, replacing what was there. Two pages with one path are an error. */
export async function writePages(dir: string, pages: SourcePage[]): Promise<number> {
  const files = new Map<string, string>()
  for (const p of pages) {
    if (!p || typeof p.content !== 'string' || typeof p.path !== 'string') throw new Error('a page needs `path` and `content`')
    const file = `${cleanPagePath(p.path)}.${p.format === 'mdx' ? 'mdx' : 'md'}`
    if (files.has(file)) throw new Error(`two pages at ${file}`)
    const data = { ...(p.title ? { title: p.title } : {}), ...(p.description ? { description: p.description } : {}), ...p.frontmatter }
    files.set(file, Object.keys(data).length ? matter.stringify(`${p.content.trim()}\n`, data) : `${p.content.trim()}\n`)
  }
  const tmp = `${dir}.tmp-${process.pid}`
  await rm(tmp, { recursive: true, force: true })
  for (const [file, text] of files) {
    await mkdir(join(tmp, file, '..'), { recursive: true })
    await writeFile(join(tmp, file), text)
  }
  await mkdir(tmp, { recursive: true })
  await rm(dir, { recursive: true, force: true })
  await mkdir(join(dir, '..'), { recursive: true })
  const { rename } = await import('node:fs/promises')
  await rename(tmp, dir)
  return files.size
}

/* ---------- custom ---------- */

export async function syncCustom(config: ResolvedConfig, s: CustomSource, dir: string): Promise<string> {
  if (typeof s.load !== 'function') throw new Error(`source ${s.kind} has no load function`)
  const pages = await s.load(sourceContext(config))
  if (!Array.isArray(pages)) throw new Error(`${s.kind}: load must return an array of pages`)
  return `${plural(await writePages(dir, pages), 'page')} from ${s.kind}`
}

/* ---------- http ---------- */

/** Reads `a.b.0.c` from a value. */
export function pick(value: unknown, path: string | undefined): unknown {
  if (!path) return value
  let v: any = value
  for (const key of path.split('.')) {
    if (v == null) return undefined
    v = v[key]
  }
  return v
}

export function mapItems(items: unknown[], map: HttpSource['map']): SourcePage[] {
  const fields = typeof map === 'function' ? null : (map ?? { path: 'slug', title: 'title', content: 'content' })
  const out: SourcePage[] = []
  items.forEach((item, i) => {
    if (typeof map === 'function') {
      const page = map(item, i)
      if (page) out.push(page)
      return
    }
    const path = pick(item, fields!.path)
    const content = pick(item, fields!.content)
    if (path == null || content == null) return
    const str = (k?: string) => {
      const v = k ? pick(item, k) : undefined
      return v == null ? undefined : String(v)
    }
    const date = str(fields!.date)
    out.push({ path: String(path), content: String(content), title: str(fields!.title), description: str(fields!.description), ...(date ? { frontmatter: { date: date.slice(0, 10) } } : {}) })
  })
  return out
}

export async function syncHttp(config: ResolvedConfig, s: HttpSource, dir: string): Promise<string> {
  const token = s.tokenEnv ? process.env[s.tokenEnv] : undefined
  const res = await sourceContext(config).fetch(s.url, { headers: { accept: 'application/json', ...s.headers, ...(token ? { authorization: `Bearer ${token}` } : {}) } })
  if (!res.ok) throw new Error(`${s.url} returned ${res.status}`)
  const items = pick(await res.json(), s.items)
  if (!Array.isArray(items)) throw new Error(`${s.url}: no array at ${s.items ? `"${s.items}"` : 'the top level'} (set \`items\`)`)
  return plural(await writePages(dir, mapItems(items, s.map)), 'page')
}

/* ---------- notion ---------- */

interface RichText {
  plain_text: string
  href?: string | null
  annotations?: { bold?: boolean; italic?: boolean; strikethrough?: boolean; code?: boolean }
}

interface Block {
  id: string
  type: string
  has_children?: boolean
  children?: Block[]
  [key: string]: any
}

/** Notion IDs from a page or database URL or a bare ID, as the API wants them. */
export function notionId(input: string): string {
  const hex = input.replace(/-/g, '').match(/[0-9a-f]{32}(?=[^0-9a-f]*$|\?|#)/i)?.[0] ?? input.replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`not a Notion ID: ${input}`)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function richText(list: RichText[] = []): string {
  return list
    .map((t) => {
      let s = t.plain_text
      if (!s) return ''
      const a = t.annotations ?? {}
      if (a.code) s = `\`${s}\``
      else s = s.replace(/([*_`[\]\\])/g, '\\$1')
      if (a.bold) s = `**${s}**`
      if (a.italic) s = `*${s}*`
      if (a.strikethrough) s = `~~${s}~~`
      if (t.href) s = `[${s}](${t.href})`
      return s
    })
    .join('')
}

const fileUrl = (f: any): string => f?.external?.url ?? f?.file?.url ?? ''

/** Notion blocks as Markdown. Unsupported blocks are skipped. */
export function blocksToMarkdown(blocks: Block[], depth = 0): string {
  const out: string[] = []
  const pad = '  '.repeat(depth)
  let n = 0
  for (const b of blocks) {
    const v = b[b.type] ?? {}
    const text = richText(v.rich_text)
    const kids = b.children?.length ? blocksToMarkdown(b.children, depth + 1) : ''
    n = b.type === 'numbered_list_item' ? n + 1 : 0
    const item = (marker: string) => `${pad}${marker} ${text}${kids ? `\n${kids}` : ''}`
    switch (b.type) {
      case 'paragraph':
        out.push(`${pad}${text}`)
        break
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        out.push(`${'#'.repeat(Number(b.type.at(-1)) + 1)} ${text}`)
        break
      case 'bulleted_list_item':
        out.push(item('-'))
        break
      case 'numbered_list_item':
        out.push(item(`${n}.`))
        break
      case 'to_do':
        out.push(item(`- [${v.checked ? 'x' : ' '}]`))
        break
      case 'toggle':
        out.push(`${pad}**${text}**${kids ? `\n\n${kids}` : ''}`)
        break
      case 'quote':
        out.push(`${pad}> ${text}`)
        break
      case 'callout':
        out.push(`${pad}> ${v.icon?.emoji ? `${v.icon.emoji} ` : ''}${text}`)
        break
      case 'code':
        out.push(`\`\`\`${(v.language ?? '').replace(/ /g, '')}\n${(v.rich_text ?? []).map((t: RichText) => t.plain_text).join('')}\n\`\`\``)
        break
      case 'divider':
        out.push('---')
        break
      case 'image': {
        const url = fileUrl(v)
        if (url) out.push(`${pad}![${richText(v.caption).replace(/[[\]]/g, '')}](${url})`)
        break
      }
      case 'bookmark':
      case 'embed':
      case 'link_preview':
        if (v.url) out.push(`${pad}[${richText(v.caption) || v.url}](${v.url})`)
        break
      case 'equation':
        out.push(`$$\n${v.expression}\n$$`)
        break
      case 'table': {
        const rows = (b.children ?? []).map((r) => (r.table_row?.cells ?? []).map((c: RichText[]) => richText(c).replace(/\|/g, '\\|')))
        if (rows.length) out.push([`| ${rows[0].join(' | ')} |`, `| ${rows[0].map(() => '---').join(' | ')} |`, ...rows.slice(1).map((r: string[]) => `| ${r.join(' | ')} |`)].join('\n'))
        break
      }
      default:
        if (kids) out.push(kids)
    }
  }
  // List items stay together; everything else is its own paragraph.
  return out.reduce((acc, cur, i) => {
    if (!i) return cur
    const list = (s: string) => /^\s*(-|\d+\.) /.test(s)
    return `${acc}${list(out[i - 1]) && list(cur) ? '\n' : '\n\n'}${cur}`
  }, '')
}

class Notion {
  constructor(
    private token: string,
    private f: typeof fetch,
  ) {}
  async call(path: string, body?: unknown): Promise<any> {
    const res = await this.f(`https://api.notion.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${this.token}`, 'notion-version': '2022-06-28', 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}) as { message?: string })
      throw new Error(`Notion returned ${res.status}${detail?.message ? `: ${detail.message}` : ''}`)
    }
    return res.json()
  }
  async children(id: string, depth = 0): Promise<Block[]> {
    const out: Block[] = []
    let cursor: string | undefined
    do {
      const r = await this.call(`blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`)
      out.push(...r.results)
      cursor = r.has_more ? r.next_cursor : undefined
    } while (cursor)
    for (const b of out) if (b.has_children && b.type !== 'child_page' && depth < 4) b.children = await this.children(b.id, depth + 1)
    return out
  }
  async query(id: string): Promise<any[]> {
    const out: any[] = []
    let cursor: string | undefined
    do {
      const r = await this.call(`databases/${id}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
      out.push(...r.results)
      cursor = r.has_more ? r.next_cursor : undefined
    } while (cursor)
    return out
  }
}

/** A Notion page's title, its other simple properties as frontmatter, and an optional `slug`. */
export function notionProperties(page: any): { title: string; slug?: string; frontmatter: Record<string, unknown> } {
  let title = ''
  let slug: string | undefined
  const frontmatter: Record<string, unknown> = {}
  for (const [name, prop] of Object.entries<any>(page.properties ?? {})) {
    const key = name.toLowerCase()
    if (prop.type === 'title') title = (prop.title ?? []).map((t: RichText) => t.plain_text).join('')
    else if (key === 'slug' && prop.type === 'rich_text') slug = (prop.rich_text ?? []).map((t: RichText) => t.plain_text).join('') || undefined
    else if (prop.type === 'rich_text' && ['description', 'summary'].includes(key)) frontmatter.description = (prop.rich_text ?? []).map((t: RichText) => t.plain_text).join('')
    else if (prop.type === 'date' && prop.date?.start) frontmatter[key === 'date' || key === 'published' ? 'date' : key] = String(prop.date.start).slice(0, 10)
    else if (prop.type === 'multi_select' && key === 'tags') frontmatter.tags = prop.multi_select.map((t: { name: string }) => t.name)
    else if (prop.type === 'number' && key === 'order' && prop.number != null) frontmatter.order = prop.number
  }
  return { title: title || 'Untitled', slug, frontmatter }
}

export async function syncNotion(config: ResolvedConfig, s: NotionSource, dir: string): Promise<string> {
  const env = s.tokenEnv ?? 'NOTION_TOKEN'
  const token = process.env[env]
  if (!token) throw new Error(`set ${env} to a Notion integration token`)
  if (!s.pages?.length && !s.database) throw new Error('a notion source needs `pages` or `database`')
  const api = new Notion(token, sourceContext(config).fetch)
  const pages: SourcePage[] = []
  for (const [i, ref] of (s.pages ?? []).entries()) {
    const id = notionId(ref)
    const meta = notionProperties(await api.call(`pages/${id}`))
    pages.push({ path: i === 0 ? 'index' : (meta.slug ?? meta.title), title: meta.title, content: blocksToMarkdown(await api.children(id)), frontmatter: meta.frontmatter })
  }
  if (s.database) {
    for (const row of await api.query(notionId(s.database))) {
      if (row.archived || row.in_trash) continue
      const meta = notionProperties(row)
      pages.push({ path: meta.slug ?? meta.title, title: meta.title, content: blocksToMarkdown(await api.children(row.id)), frontmatter: meta.frontmatter })
    }
  }
  return `${plural(await writePages(dir, pages), 'page')} from Notion`
}
