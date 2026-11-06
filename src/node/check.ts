/**
 * `novon check`: the config and frontmatter against their schemas, every
 * internal link, anchor and asset, duplicate routes and redirects, and
 * optionally external links. The build runs the same checks (without external
 * links) and prints what they find.
 */
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import GithubSlugger from 'github-slugger'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'
import { toString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'
import { scanPages } from './content.ts'
import { loadMetas, listedNames } from './meta.ts'
import { pageSource } from './source.ts'
import { collectRedirects, isExternal } from './redirects.ts'
import { markdownPath } from './plugins.ts'
import { en } from '../labels.ts'
import { normalizeRoute } from '../shared.ts'
import type { PageMeta, ResolvedConfig } from '../types.ts'

export type Severity = 'error' | 'warning'

export interface Issue {
  severity: Severity
  /** What was checked: `config`, `frontmatter`, `meta`, `content` (partials, variables), `syntax`, `link`, `anchor`, `asset`, `route`, `redirect`, `external`. */
  rule: string
  message: string
  /** Relative to the site root. */
  file?: string
  line?: number
  column?: number
}

export interface CheckOptions {
  /** Also request every external link. Default false. */
  external?: boolean
  /** Timeout per external request in ms. Default 10000. */
  timeout?: number
}

/* ---------- Schemas ---------- */

type Schema =
  | { type: 'string' | 'boolean' | 'number' | 'date' | 'url' | 'route' | 'any' | 'function'; required?: boolean }
  | { type: 'literal'; value: unknown; required?: boolean }
  | { type: 'enum'; values: readonly string[]; required?: boolean }
  | { type: 'array'; of: Schema; required?: boolean }
  | { type: 'record'; of: Schema; keys?: readonly string[]; required?: boolean }
  | { type: 'object'; props: Record<string, Schema>; open?: boolean; required?: boolean }
  | { type: 'union'; of: Schema[]; required?: boolean }

const S = {
  string: { type: 'string' } as Schema,
  boolean: { type: 'boolean' } as Schema,
  number: { type: 'number' } as Schema,
  date: { type: 'date' } as Schema,
  route: { type: 'route' } as Schema,
  any: { type: 'any' } as Schema,
  false: { type: 'literal', value: false } as Schema,
  enum: (...values: string[]): Schema => ({ type: 'enum', values }),
  array: (of: Schema): Schema => ({ type: 'array', of }),
  record: (of: Schema, keys?: readonly string[]): Schema => ({ type: 'record', of, keys }),
  object: (props: Record<string, Schema>, open = false): Schema => ({ type: 'object', props, open }),
  union: (...of: Schema[]): Schema => ({ type: 'union', of }),
  required: (s: Schema): Schema => ({ ...s, required: true }),
}

const ACCENTS = ['blue', 'neutral', 'green', 'orange', 'rose', 'violet']
const LAYOUTS = ['docs', 'blog']
const nav = S.object({ label: S.required(S.string), href: S.required(S.string) })
const headTag = S.object({
  tag: S.required(S.enum('meta', 'link', 'script', 'style', 'noscript')),
  attrs: S.record(S.union(S.string, S.boolean)),
  content: S.string,
})

export const configSchema: Schema = S.object({
  title: S.required(S.string),
  description: S.string,
  url: { type: 'url' },
  base: S.string,
  lang: S.string,
  layout: S.enum(...LAYOUTS),
  layers: S.array(S.object({ path: S.required(S.string), layout: S.required(S.enum(...LAYOUTS)), title: S.string })),
  nav: S.array(nav),
  theme: S.object({
    accent: S.enum(...ACCENTS),
    radius: S.string,
    toc: S.boolean,
    logo: S.string,
    logoDark: S.string,
    favicon: S.string,
    social: S.object({ github: S.string, x: S.string, email: S.string, rss: S.boolean }),
    editLink: S.string,
    footer: S.object({ text: S.string, links: S.array(nav) }),
    authors: S.record(S.object({ bio: S.string, avatar: S.string, url: S.string })),
    css: S.array(S.string),
    labels: S.record(S.string, Object.keys(en)),
    override: S.record(S.string, ['Header', 'Footer', 'Sidebar', 'NotFound', 'PostHeader']),
    pageActions: S.union(
      S.false,
      S.array(S.union(S.enum('copy', 'markdown', 'pdf', 'edit', 'chatgpt', 'claude', 'perplexity'), S.object({ label: S.required(S.string), href: S.required(S.string) }))),
    ),
    lastUpdated: S.boolean,
    imageZoom: S.boolean,
  }),
  components: S.record(S.string),
  plugins: S.array(S.union(S.enum('search', 'sitemap', 'rss', 'llms'), S.object({ name: S.required(S.string), buildEnd: { type: 'function' } }, true))),
  mdx: S.object({
    remarkPlugins: S.array(S.any),
    rehypePlugins: S.array(S.any),
    highlight: S.union(S.false, S.object({ light: S.string, dark: S.string })),
    lineNumbers: S.boolean,
    math: S.union(S.boolean, S.object({ singleDollar: S.boolean })),
    mermaid: S.boolean,
  }),
  og: S.union(
    S.boolean,
    S.object({ enabled: S.boolean, font: S.any, family: S.string, mode: S.enum('light', 'dark'), accent: S.enum(...ACCENTS) }),
  ),
  trailingSlash: S.boolean,
  rss: S.object({ path: S.string, full: S.boolean }),
  tags: S.object({ path: S.string, lowercase: S.boolean }),
  redirects: S.record(S.string),
  head: S.array(headTag),
  variables: S.record(S.union(S.string, S.number, S.boolean)),
  banner: S.union(S.false, S.string, S.object({ text: S.required(S.string), href: S.string, dismissible: S.boolean, id: S.string })),
  analytics: S.object({
    plausible: S.object({ domain: S.required(S.string), src: S.string }),
    umami: S.object({ websiteId: S.required(S.string), src: S.string }),
    ga4: S.union(S.string, S.object({ id: S.required(S.string) })),
    cloudflare: S.union(S.string, S.object({ token: S.required(S.string) })),
    custom: S.union(S.string, S.array(headTag)),
  }),
  agents: S.union(S.false, S.object({ skills: S.union(S.string, S.false), skill: S.boolean, discovery: S.boolean, api: S.boolean, webmcp: S.boolean })),
  budget: S.object({ js: S.union(S.number, S.string), css: S.union(S.number, S.string) }),
})

const metaItem = S.object({ title: S.string, badge: S.string, icon: S.string, hidden: S.boolean })

/** A folder's `_meta.ts`. */
export const metaSchema: Schema = S.object({
  title: S.string,
  order: S.number,
  icon: S.string,
  badge: S.string,
  collapsed: S.boolean,
  pages: S.array(S.union(S.string, S.object({ group: S.required(S.string), pages: S.required(S.array(S.string)) }), S.object({ title: S.required(S.string), href: S.required(S.string) }))),
  items: S.record(metaItem),
})

export const frontmatterSchema: Schema = S.object(
  {
    title: S.string,
    description: S.string,
    label: S.string,
    order: S.number,
    icon: S.string,
    date: S.date,
    updated: S.date,
    tags: S.array(S.union(S.string, S.number)),
    author: S.string,
    cover: S.union(S.string, S.false),
    draft: S.boolean,
    image: S.union(S.string, S.false),
    og: S.boolean,
    hidden: S.boolean,
    noindex: S.boolean,
    redirectFrom: S.union(S.route, S.array(S.route)),
    head: S.array(headTag),
    badge: S.string,
  },
  true,
)

const typeName = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : v instanceof Date ? 'date' : typeof v)

function describe(s: Schema): string {
  switch (s.type) {
    case 'literal':
      return JSON.stringify(s.value)
    case 'enum':
      return s.values.map((v) => `'${v}'`).join(' | ')
    case 'array':
      return `${describe(s.of)}[]`
    case 'record':
    case 'object':
      return 'an object'
    case 'union':
      return s.of.map(describe).join(' or ')
    case 'url':
      return 'an absolute http(s) URL'
    case 'route':
      return 'a path starting with /'
    default:
      return `a ${s.type}`
  }
}

/** Edit distance with swaps, for "did you mean". */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      // A swapped pair counts as one edit.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}

export function suggest(key: string, known: readonly string[]): string | undefined {
  let best: string | undefined
  let score = Infinity
  for (const k of known) {
    const s = distance(key.toLowerCase(), k.toLowerCase())
    if (s < score) [best, score] = [k, s]
  }
  return best !== undefined && score <= Math.max(1, Math.floor(key.length / 4)) ? best : undefined
}

type Problem = { path: string; message: string; severity: Severity }

function matches(value: unknown, s: Schema): boolean {
  const out: Problem[] = []
  validate(value, s, '', out)
  return !out.some((p) => p.severity === 'error')
}

/** Problems with `value` against `s`; `path` is the dotted key, e.g. `theme.accent`. */
export function validate(value: unknown, s: Schema, path: string, out: Problem[]): void {
  const where = path ? `\`${path}\`` : 'value'
  const wrong = (): void => void out.push({ path, severity: 'error', message: `${where} should be ${describe(s)}, got ${typeName(value)}${typeof value === 'string' ? ` "${value}"` : ''}` })
  if (value === undefined) {
    if (s.required) out.push({ path, severity: 'error', message: `${where} is required` })
    return
  }
  switch (s.type) {
    case 'any':
      return
    case 'function':
      if (typeof value !== 'function') wrong()
      return
    case 'string':
    case 'boolean':
    case 'number':
      if (typeof value !== s.type) wrong()
      return
    case 'literal':
      if (value !== s.value) wrong()
      return
    case 'enum':
      if (typeof value !== 'string' || !s.values.includes(value)) wrong()
      return
    case 'url':
      if (typeof value !== 'string' || !/^https?:\/\/[^/\s]+/.test(value)) wrong()
      return
    case 'route':
      if (typeof value !== 'string' || !value.startsWith('/')) wrong()
      return
    case 'date':
      if (value instanceof Date ? Number.isNaN(value.getTime()) : typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
        out.push({ path, severity: 'error', message: `${where} should be a date like 2026-03-04, got ${typeName(value)}${typeof value === 'string' ? ` "${value}"` : ''}` })
      }
      return
    case 'array':
      if (!Array.isArray(value)) return wrong()
      value.forEach((v, i) => validate(v, s.of, `${path}[${i}]`, out))
      return
    case 'record':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return wrong()
      for (const [k, v] of Object.entries(value)) {
        if (s.keys && !s.keys.includes(k)) {
          const hint = suggest(k, s.keys)
          out.push({ path: `${path}.${k}`, severity: 'warning', message: `Unknown key \`${path}.${k}\`${hint ? `; did you mean \`${path}.${hint}\`?` : ''}` })
          continue
        }
        validate(v, s.of, `${path}.${k}`, out)
      }
      return
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return wrong()
      const known = Object.keys(s.props)
      for (const k of known) validate((value as Record<string, unknown>)[k], s.props[k], path ? `${path}.${k}` : k, out)
      for (const k of Object.keys(value)) {
        if (k in s.props) continue
        const hint = suggest(k, known)
        // Open objects (frontmatter, plugins) take any key; only likely typos are reported.
        if (s.open && !hint) continue
        const full = path ? `${path}.${k}` : k
        out.push({ path: full, severity: 'warning', message: `Unknown key \`${full}\`${hint ? `; did you mean \`${path ? `${path}.` : ''}${hint}\`?` : ''}` })
      }
      return
    }
    case 'union':
      if (!s.of.some((o) => matches(value, o))) wrong()
      return
  }
}

/* ---------- Config and frontmatter ---------- */

const configFile = (root: string) =>
  ['novon.config.ts', 'novon.config.mts', 'novon.config.js', 'novon.config.mjs'].find((f) => existsSync(join(root, f))) ?? 'novon.config.ts'

/** Problems in the site config, as loaded. */
export function checkConfig(config: ResolvedConfig): Issue[] {
  const { root: _root, ...raw } = config
  const out: Problem[] = []
  validate(raw, configSchema, '', out)
  const file = configFile(config.root)
  return out.map((p) => ({ severity: p.severity, rule: 'config', message: p.message, file }))
}

/** 1-based line of `key:` inside the frontmatter block, else 1. */
function frontmatterLine(source: string, key: string): number {
  const top = key.split(/[.[]/)[0]
  const lines = source.split('\n')
  for (let i = 1; i < lines.length && lines[i].trim() !== '---'; i++) if (new RegExp(`^${top}\\s*:`).test(lines[i])) return i + 1
  return 1
}

export function checkFrontmatter(file: string, source: string, data: Record<string, unknown>): Issue[] {
  const out: Problem[] = []
  validate(data, frontmatterSchema, '', out)
  return out.map((p) => ({ severity: p.severity, rule: 'frontmatter', message: p.message, file, line: frontmatterLine(source, p.path) }))
}

/* ---------- Links ---------- */

interface LinkRef {
  url: string
  kind: 'link' | 'asset'
  line?: number
  column?: number
}

interface Parsed {
  links: LinkRef[]
  anchors: Set<string>
  issues: Issue[]
}

const LINK_ATTRS = new Set(['href'])
const ASSET_ATTRS = new Set(['src', 'poster'])

/** Links, assets and heading ids of one page. */
export function parsePage(file: string, source: string, math = true): Parsed {
  const processor = unified().use(remarkParse)
  if (!file.endsWith('.md')) processor.use(remarkMdx)
  processor.use(remarkFrontmatter).use(remarkGfm).use(remarkDirective)
  if (math) processor.use(remarkMath)
  let tree: Root
  try {
    tree = processor.parse(source) as Root
  } catch (error) {
    const e = error as { reason?: string; message?: string; line?: number; column?: number; place?: { line?: number; column?: number; start?: { line: number; column: number } } }
    const place = e.place && 'start' in e.place ? e.place.start : e.place
    return {
      links: [],
      anchors: new Set(),
      issues: [{ severity: 'error', rule: 'syntax', message: e.reason ?? e.message ?? String(error), file, line: e.line ?? place?.line, column: e.column ?? place?.column }],
    }
  }
  const links: LinkRef[] = []
  const anchors = new Set<string>()
  const slugger = new GithubSlugger()
  visit(tree, (node) => {
    const at = { line: node.position?.start.line, column: node.position?.start.column }
    if (node.type === 'heading') anchors.add(slugger.slug(toString(node)))
    else if (node.type === 'link' || node.type === 'definition') links.push({ url: node.url, kind: 'link', ...at })
    else if (node.type === 'image') links.push({ url: node.url, kind: 'asset', ...at })
    else if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      for (const a of (node as { attributes: { type: string; name: string; value: unknown }[] }).attributes) {
        if (a.type !== 'mdxJsxAttribute' || typeof a.value !== 'string') continue
        if (a.name === 'id') anchors.add(a.value)
        else if (LINK_ATTRS.has(a.name)) links.push({ url: a.value, kind: 'link', ...at })
        else if (ASSET_ATTRS.has(a.name)) links.push({ url: a.value, kind: 'asset', ...at })
      }
    }
  })
  return { links, anchors, issues: [] }
}

const SKIP_SCHEMES = /^(mailto|tel|javascript|data|blob|sms|ftp):/i

/** Files the build writes besides pages. */
function generatedFiles(config: ResolvedConfig): Set<string> {
  const files = ['/search.json', '/sitemap.xml', '/robots.txt', '/llms.txt', '/llms-full.txt', '/_redirects', '/_headers', '/404', '/404.html', config.rss.path, '/openapi.json', '/skill.md']
  return new Set(files)
}

function publicFile(config: ResolvedConfig, path: string): boolean {
  const file = join(config.root, 'public', path)
  return file.startsWith(join(config.root, 'public')) && existsSync(file) && statSync(file).isFile()
}

/* ---------- External links ---------- */

async function probe(url: string, timeout: number): Promise<string | null> {
  const attempt = async (method: string) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
      return await fetch(url, { method, redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'novon-check' } })
    } finally {
      clearTimeout(timer)
    }
  }
  try {
    let res = await attempt('HEAD')
    if (res.status === 405 || res.status === 403 || res.status === 501 || res.status === 404) res = await attempt('GET')
    return res.ok ? null : `returned ${res.status}`
  } catch (error) {
    return (error as Error).name === 'AbortError' ? 'timed out' : `failed (${(error as Error).message})`
  }
}

async function pool<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await run(items[next++])
  }))
}

/* ---------- Everything ---------- */

export async function check(config: ResolvedConfig, options: CheckOptions = {}): Promise<Issue[]> {
  const issues: Issue[] = [...checkConfig(config)]
  const { pages, duplicates } = await scanPages(config)
  for (const d of duplicates) {
    for (const file of d.files.slice(1)) issues.push({ severity: 'error', rule: 'route', file, message: `Maps to ${d.route}, like ${d.files[0]}` })
  }

  const byRoute = new Map(pages.map((p) => [p.route, p]))
  const parsed = new Map<string, Parsed>()
  for (const page of pages) {
    if (!page.file) continue
    const expanded = await pageSource(config, page.file)
    const source = expanded.code
    for (const p of expanded.problems) issues.push({ severity: 'error', rule: 'content', file: page.file, line: p.line, message: p.message })
    let data: Record<string, unknown> = {}
    try {
      data = matter(source).data
    } catch (error) {
      issues.push({ severity: 'error', rule: 'frontmatter', file: page.file, line: 1, message: `Frontmatter is not valid YAML: ${(error as Error).message.split('\n')[0]}` })
    }
    issues.push(...checkFrontmatter(page.file, source, data))
    const result = parsePage(page.file, source, config.mdx?.math !== false)
    issues.push(...result.issues)
    parsed.set(page.route, result)
  }

  // Folder meta files.
  try {
    for (const m of await loadMetas(config)) {
      const out: Problem[] = []
      validate(m.meta, metaSchema, '', out)
      for (const p of out) issues.push({ severity: p.severity, rule: 'meta', file: m.file, message: p.message })
      const prefix = m.dir ? `/${m.dir}/` : '/'
      const names = new Set(pages.filter((p) => p.route.startsWith(prefix) && p.route !== prefix.replace(/\/$/, '')).map((p) => p.route.slice(prefix.length).split('/')[0]))
      for (const name of [...listedNames(m.meta.pages), ...Object.keys(m.meta.items ?? {})]) {
        if (name !== '...' && !names.has(name)) issues.push({ severity: 'warning', rule: 'meta', file: m.file, message: `No page or folder "${name}" in ${m.dir || 'content'}` })
      }
    }
  } catch (error) {
    issues.push({ severity: 'error', rule: 'meta', message: (error as Error).message })
  }

  // Redirects.
  const redirects = collectRedirects(config, pages)
  const cfgFile = configFile(config.root)
  const sources = new Map<string, string[]>()
  for (const [from] of Object.entries(config.redirects)) sources.set(from, [cfgFile])
  for (const p of pages) for (const from of p.redirectFrom ?? []) sources.set(from, [...(sources.get(from) ?? []), p.file])
  for (const [from, files] of sources) {
    if (files.length > 1) issues.push({ severity: 'warning', rule: 'redirect', file: files[1], message: `Redirect from ${from} is also set in ${files[0]}; the first one wins` })
    if (byRoute.has(from)) issues.push({ severity: 'error', rule: 'redirect', file: files[0], message: `Redirect from ${from} would replace the page ${byRoute.get(from)!.file || from}` })
  }
  for (const [from, to] of Object.entries(redirects)) {
    if (isExternal(to)) continue
    const target = normalizeRoute(to.split(/[?#]/)[0])
    const file = sources.get(from)?.[0]
    if (redirects[target]) issues.push({ severity: 'warning', rule: 'redirect', file, message: `Redirect ${from} → ${target} leads to another redirect (→ ${redirects[target]})` })
    else if (!byRoute.has(target) && !publicFile(config, target)) issues.push({ severity: 'error', rule: 'redirect', file, message: `Redirect ${from} points to ${to}, which is not a page` })
  }

  // Internal links, anchors and assets.
  const generated = generatedFiles(config)
  const external = new Map<string, { file: string; line?: number; column?: number }[]>()
  const base = config.base.replace(/\/$/, '')
  for (const [route, result] of parsed) {
    const file = byRoute.get(route)!.file
    for (const link of result.links) {
      const url = link.url.trim()
      const at = { file, line: link.line, column: link.column }
      if (!url || SKIP_SCHEMES.test(url)) continue
      if (/^(https?:)?\/\//i.test(url)) {
        const abs = url.startsWith('//') ? `https:${url}` : url
        external.set(abs, [...(external.get(abs) ?? []), at])
        continue
      }
      if (isExternal(url)) continue
      let resolved: URL
      try {
        resolved = new URL(url, `http://novon.invalid${route === '/' ? '/' : route}`)
      } catch {
        issues.push({ severity: 'error', rule: link.kind === 'asset' ? 'asset' : 'link', ...at, message: `Malformed URL ${url}` })
        continue
      }
      let path = decodeURIComponent(resolved.pathname)
      const hash = decodeURIComponent(resolved.hash.slice(1))
      const target = normalizeRoute(path)
      const page = byRoute.get(target)
      if (page) {
        if (link.kind === 'asset') issues.push({ severity: 'error', rule: 'asset', ...at, message: `${url} is a page, not a file` })
        else if (hash && page.file && parsed.has(target) && !parsed.get(target)!.anchors.has(hash)) {
          issues.push({ severity: 'error', rule: 'anchor', ...at, message: `No heading #${hash} on ${target === route ? 'this page' : target}` })
        }
        continue
      }
      if (link.kind === 'link' && redirects[target]) {
        issues.push({ severity: 'warning', rule: 'link', ...at, message: `${url} redirects to ${redirects[target]}; link there directly` })
        continue
      }
      if (generated.has(path) || path.startsWith('/og/') || path.startsWith('/api/') || path.startsWith('/.well-known/')) continue
      if (path.endsWith('.md') && [...byRoute.values()].some((p) => p.file && markdownPath(p.route) === path)) continue
      if (publicFile(config, path)) continue
      if (base && (target === base || target.startsWith(`${base}/`))) {
        const without = normalizeRoute(target.slice(base.length))
        if (byRoute.has(without) || publicFile(config, without)) {
          issues.push({ severity: 'warning', rule: link.kind === 'asset' ? 'asset' : 'link', ...at, message: `${url} includes the base path; write ${without} and novon adds ${config.base}` })
          continue
        }
      }
      path = target
      issues.push({
        severity: 'error',
        rule: link.kind === 'asset' ? 'asset' : 'link',
        ...at,
        message: link.kind === 'asset' ? `Missing file ${url} (looked in public${path})` : `Broken link ${url}: no page at ${path}`,
      })
    }
  }

  if (options.external && external.size) {
    const skip = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|example\.(com|org|net))([:/]|$)/i
    await pool([...external.keys()].filter((u) => !skip.test(u)), 8, async (url) => {
      const problem = await probe(url, options.timeout ?? 10000)
      if (problem) for (const at of external.get(url)!) issues.push({ severity: 'warning', rule: 'external', ...at, message: `${url} ${problem}` })
    })
  }

  return issues.sort((a, b) => (a.file ?? '').localeCompare(b.file ?? '') || (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0))
}

const color = (code: number, s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s)

/** Human-readable report lines. */
export function formatIssues(issues: Issue[]): string {
  return issues
    .map((i) => {
      const where = i.file ? `${i.file}${i.line ? `:${i.line}${i.column ? `:${i.column}` : ''}` : ''}` : ''
      const sev = i.severity === 'error' ? color(31, 'error') : color(33, 'warning')
      return `${where ? `${where}  ` : ''}${sev}  ${i.message}  ${color(2, i.rule)}`
    })
    .join('\n')
}

export function summarize(issues: Issue[]): { errors: number; warnings: number } {
  return { errors: issues.filter((i) => i.severity === 'error').length, warnings: issues.filter((i) => i.severity === 'warning').length }
}

