/**
 * `novon migrate <source>`: a novon site from another docs framework's project.
 *
 * Deterministic: pages and their frontmatter, the sidebar as `_meta.ts` files,
 * title and nav as `novon.config.ts`, static files as `public/`, and the
 * framework's callouts, tabs, cards and steps rewritten as novon syntax.
 * Whatever is left (custom components, imports, templating) is listed in
 * `MIGRATION.md`, which `--agent` hands to the local coding agent.
 */
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import matter from 'gray-matter'
import { humanize } from '../shared.ts'

export const MIGRATE_SOURCES = ['docusaurus', 'mintlify', 'nextra', 'vitepress', 'starlight'] as const
export type MigrateSource = (typeof MIGRATE_SOURCES)[number]

/** Components every novon page has without an import. */
export const NOVON_COMPONENTS = new Set([
  'Callout', 'Note', 'Tip', 'Info', 'Warning', 'Caution', 'Danger', 'Card', 'CardGroup', 'Columns', 'Steps', 'Step', 'Tabs', 'Tab',
  'Accordion', 'AccordionGroup', 'CodeGroup', 'PackageInstall', 'Term', 'Frame', 'YouTube', 'Badge', 'Kbd', 'Icon', 'FileTree', 'Folder',
  'File', 'PostList', 'TagList', 'TypeTable', 'Field', 'Diff', 'Prompt', 'ImageZoom', 'Mermaid', 'ApiEndpoint', 'ApiSchema', 'ApiMethod',
  'Changelog', 'ChangelogEntry',
])

/* ---------- Sidebar model ---------- */

export type SidebarItem =
  | { type: 'doc'; path: string; label?: string }
  | { type: 'category'; label: string; items: SidebarItem[]; collapsed?: boolean; path?: string }
  | { type: 'link'; label: string; href: string }

export interface MetaOut {
  title?: string
  order?: number
  collapsed?: boolean
  pages: (string | { group: string; pages: string[] } | { title: string; href: string })[]
  items: Record<string, { title?: string; hidden?: boolean }>
}

export interface Leftover {
  file: string
  line?: number
  message: string
}

export interface Project {
  source: MigrateSource
  /** Project root. */
  root: string
  /** Folder of pages. */
  docsDir: string
  /** Static files to copy into `public/`. */
  publicDirs: string[]
  title: string
  description?: string
  url?: string
  base?: string
  nav: { label: string; href: string }[]
  /** Sidebar from the framework's config; null to keep folder order. */
  sidebar: SidebarItem[] | null
  /** Folder metadata the framework keeps beside pages (Nextra `_meta`, Docusaurus `_category_.json`), by folder. */
  metas: Record<string, MetaOut>
  /** Page paths (relative, no extension) the framework renders somewhere else (`page` items); their URL may differ. */
  leftovers: Leftover[]
  /** Folders under docsDir that are not pages. */
  skip: string[]
}

/* ---------- Reading JavaScript configs ---------- */

const STUB = `const __novonStub = new Proxy(function () {}, { get: (_, k) => (k === 'then' || k === Symbol.toPrimitive || k === 'toJSON' ? undefined : __novonStub), apply: (_, __, a) => (a.length ? a[0] : __novonStub) });\n`

/**
 * Imports a framework config with every package import replaced by a stub that
 * returns its first argument, so `defineConfig(x)` and `starlight(x)` are `x`.
 */
export async function loadModule(file: string): Promise<unknown> {
  const dir = dirname(file)
  const abs = (spec: string) => JSON.stringify(spec.startsWith('.') ? resolve(dir, spec) : spec)
  let code = await readFile(file, 'utf8')
  code = code.replace(/^\s*import\s+type\s[^;\n]*from\s*['"][^'"]+['"];?/gm, '')
  code = code.replace(/^\s*import\s+([\w$*{][^;]*?)\s+from\s*['"]([^'"]+)['"];?/gm, (m, what: string, spec: string) => {
    if (spec.startsWith('.')) return m.replace(/(['"])([^'"]+)\1/, (_q, _x, s) => abs(s))
    const names: string[] = []
    const ns = what.match(/\*\s+as\s+([\w$]+)/)
    if (ns) names.push(ns[1])
    const def = what.match(/^([\w$]+)/)
    if (def) names.push(def[1])
    const named = what.match(/\{([^}]*)\}/)
    if (named) for (const part of named[1].split(',')) {
      const n = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).at(-1)?.trim()
      if (n) names.push(n)
    }
    return names.length ? `const ${names.map((n) => `${n} = __novonStub`).join(', ')};` : ''
  })
  code = code.replace(/^\s*import\s+['"][^'"]+['"];?/gm, '')
  code = code.replace(/require\.resolve\(\s*['"]([^'"]+)['"]\s*\)/g, (_m, spec: string) => abs(spec))
  code = code.replace(/require\(\s*['"]([^'"]+)['"]\s*\)/g, (_m, spec: string) => (spec.startsWith('.') ? `require(${abs(spec)})` : '__novonStub'))
  const tmp = join(tmpdir(), `novon-migrate-${process.pid}-${Math.random().toString(36).slice(2)}${extname(file) || '.js'}`)
  await writeFile(tmp, `${STUB}${code}`)
  try {
    const mod = await import(tmp)
    let value = mod.default ?? mod
    if (value && typeof value === 'object' && 'default' in value && Object.keys(value).length === 1) value = value.default
    if (typeof value === 'function') value = await value()
    return value
  } finally {
    await rm(tmp, { force: true })
  }
}

async function tryLoad(file: string, leftovers: Leftover[], root: string): Promise<Record<string, any> | null> {
  try {
    const v = await loadModule(file)
    return v && typeof v === 'object' ? (v as Record<string, any>) : null
  } catch (e) {
    leftovers.push({ file: relative(root, file), message: `could not read it (${e instanceof Error ? e.message.split('\n')[0] : e}); the sidebar falls back to folder order` })
    return null
  }
}

function firstExisting(root: string, names: string[]): string | null {
  for (const n of names) if (existsSync(join(root, n))) return join(root, n)
  return null
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)

/* ---------- Detecting ---------- */

/** Which framework a project uses, from its config files. */
export function detectSource(root: string): MigrateSource | null {
  if (firstExisting(root, ['docusaurus.config.js', 'docusaurus.config.ts', 'docusaurus.config.mjs'])) return 'docusaurus'
  if (firstExisting(root, ['docs.json', 'mint.json'])) return 'mintlify'
  const astro = firstExisting(root, ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'])
  if (astro && existsSync(join(root, 'src/content/docs'))) return 'starlight'
  if (existsSync(join(root, '.vitepress')) || existsSync(join(root, 'docs/.vitepress'))) return 'vitepress'
  for (const d of ['pages', 'content', 'src/pages', 'src/content']) for (const f of ['_meta.json', '_meta.js', '_meta.ts', '_meta.tsx']) if (existsSync(join(root, d, f))) return 'nextra'
  if (firstExisting(root, ['theme.config.tsx', 'theme.config.jsx'])) return 'nextra'
  return null
}

/* ---------- Files ---------- */

async function walk(dir: string, base = dir, skip: string[] = []): Promise<string[]> {
  const out: string[] = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const full = join(dir, e.name)
    const rel = relative(base, full)
    if (skip.includes(rel)) continue
    if (e.isDirectory()) out.push(...(await walk(full, base, skip)))
    else out.push(rel)
  }
  return out.sort()
}

const PAGE = /\.mdx?$/
const noExt = (p: string) => p.replace(/\.(mdx?|html)$/, '')
/** Docusaurus drops `01-` style number prefixes from ids and URLs. */
const unprefix = (p: string) => p.split('/').map((s) => s.replace(/^\d+[-_.]/, '')).join('/')

/* ---------- Per framework ---------- */

async function docusaurus(root: string): Promise<Project> {
  const leftovers: Leftover[] = []
  const cfgFile = firstExisting(root, ['docusaurus.config.ts', 'docusaurus.config.js', 'docusaurus.config.mjs'])
  const cfg = cfgFile ? await tryLoad(cfgFile, leftovers, root) : null
  const classic = (cfg?.presets ?? []).map((p: any) => (Array.isArray(p) ? p[1] : null)).find((o: any) => o && typeof o === 'object')
  const docsOpts = classic?.docs ?? {}
  const docsDir = join(root, str(docsOpts.path) ?? 'docs')
  const nav: Project['nav'] = []
  for (const item of cfg?.themeConfig?.navbar?.items ?? []) {
    const href = str(item?.to) ?? str(item?.href)
    if (str(item?.label) && href) nav.push({ label: item.label, href: href.startsWith('http') ? href : `/${href.replace(/^\/(docs\/)?/, '')}`.replace(/\/$/, '') || '/' })
  }
  const sidebarFile = (typeof docsOpts.sidebarPath === 'string' ? docsOpts.sidebarPath : null) ?? firstExisting(root, ['sidebars.js', 'sidebars.ts', 'sidebars.mjs', 'sidebars.cjs'])
  const files = (await walk(docsDir)).filter((f) => PAGE.test(f))
  // Doc ids: folder + frontmatter `id`, else the file name without number prefix.
  const ids = new Map<string, string>()
  const positions = new Map<string, number>()
  for (const f of files) {
    const fm = matter(await readFile(join(docsDir, f), 'utf8')).data
    const dir = dirname(f) === '.' ? '' : `${unprefix(dirname(f))}/`
    ids.set(`${dir}${str(fm.id) ?? unprefix(basename(noExt(f)))}`, noExt(f))
    ids.set(unprefix(noExt(f)), noExt(f))
    if (typeof fm.sidebar_position === 'number') positions.set(noExt(f), fm.sidebar_position)
  }
  const categoryMeta = new Map<string, { label?: string; position?: number; collapsed?: boolean }>()
  for (const f of await walk(docsDir)) {
    if (basename(f) !== '_category_.json' && basename(f) !== '_category_.yml') continue
    try {
      const data = basename(f).endsWith('.json') ? JSON.parse(await readFile(join(docsDir, f), 'utf8')) : matter(`---\n${await readFile(join(docsDir, f), 'utf8')}\n---`).data
      categoryMeta.set(dirname(f) === '.' ? '' : dirname(f), { label: str(data.label), position: typeof data.position === 'number' ? data.position : undefined, collapsed: data.collapsed })
    } catch {}
  }
  const docPath = (id: string): string | null => ids.get(id) ?? ids.get(unprefix(id)) ?? null
  const autogen = (dir: string): SidebarItem[] => {
    const prefix = dir ? `${dir.replace(/\/$/, '')}/` : ''
    const direct = files.map(noExt).filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    const subdirs = [...new Set(files.map(noExt).filter((p) => p.startsWith(prefix) && p.slice(prefix.length).includes('/')).map((p) => prefix + p.slice(prefix.length).split('/')[0]))]
    const entries: { pos: number; name: string; item: SidebarItem }[] = []
    for (const p of direct) entries.push({ pos: positions.get(p) ?? Number.POSITIVE_INFINITY, name: p, item: { type: 'doc', path: p } })
    for (const d of subdirs) {
      const meta = categoryMeta.get(d)
      entries.push({ pos: meta?.position ?? Number.POSITIVE_INFINITY, name: d, item: { type: 'category', label: meta?.label ?? humanize(unprefix(basename(d))), items: autogen(d), ...(meta?.collapsed !== undefined ? { collapsed: meta.collapsed } : {}) } })
    }
    return entries.sort((a, b) => a.pos - b.pos || a.name.localeCompare(b.name)).map((e) => e.item)
  }
  const convert = (items: unknown[]): SidebarItem[] => {
    const out: SidebarItem[] = []
    for (const it of items) {
      if (typeof it === 'string') {
        const p = docPath(it)
        if (p) out.push({ type: 'doc', path: p })
        else leftovers.push({ file: 'sidebars', message: `no doc with id "${it}"` })
      } else if (it && typeof it === 'object') {
        const o = it as Record<string, any>
        if (o.type === 'doc' || o.type === 'ref') {
          const p = docPath(o.id)
          if (p) out.push({ type: 'doc', path: p, ...(str(o.label) ? { label: o.label } : {}) })
        } else if (o.type === 'link') out.push({ type: 'link', label: o.label, href: o.href })
        else if (o.type === 'autogenerated') out.push(...autogen(o.dirName === '.' ? '' : (o.dirName ?? '')))
        else if (o.type === 'category') {
          const index = o.link?.type === 'doc' ? docPath(o.link.id) : null
          out.push({ type: 'category', label: o.label, items: convert(o.items ?? []), ...(o.collapsed !== undefined ? { collapsed: o.collapsed } : {}), ...(index ? { path: index } : {}) })
          if (o.link?.type === 'generated-index') leftovers.push({ file: 'sidebars', message: `category "${o.label}" has a generated index page; add an index.mdx to its folder` })
        } else if (o.type === 'html') leftovers.push({ file: 'sidebars', message: 'an html sidebar item was dropped' })
        else for (const [label, sub] of Object.entries(o)) if (Array.isArray(sub)) out.push({ type: 'category', label, items: convert(sub) })
      }
    }
    return out
  }
  let sidebar: SidebarItem[] | null = null
  if (sidebarFile && existsSync(resolve(root, sidebarFile))) {
    const sb = await tryLoad(resolve(root, sidebarFile), leftovers, root)
    if (sb) {
      sidebar = []
      for (const v of Object.values(sb)) sidebar.push(...convert(Array.isArray(v) ? v : [v]))
    }
  } else sidebar = autogen('')
  if (existsSync(join(root, 'blog'))) leftovers.push({ file: 'blog/', message: 'blog posts were not migrated; copy them into content/blog and add a blog layer: layers: [{ path: "/blog", layout: "blog" }]' })
  if (existsSync(join(root, 'src/pages'))) leftovers.push({ file: 'src/pages/', message: 'React pages were not migrated; rewrite them as MDX pages' })
  if (cfg?.i18n?.locales?.length > 1) leftovers.push({ file: relative(root, cfgFile!), message: `i18n locales ${cfg!.i18n.locales.join(', ')}: translations under i18n/ were not migrated; see the i18n option` })
  return {
    source: 'docusaurus',
    root,
    docsDir,
    publicDirs: [join(root, 'static')],
    title: str(cfg?.title) ?? humanize(basename(root)),
    description: str(cfg?.tagline),
    url: str(cfg?.url),
    base: str(cfg?.baseUrl),
    nav,
    sidebar,
    metas: {},
    leftovers,
    skip: [],
  }
}

async function mintlify(root: string): Promise<Project> {
  const leftovers: Leftover[] = []
  const file = firstExisting(root, ['docs.json', 'mint.json'])!
  const cfg = JSON.parse(await readFile(file, 'utf8'))
  const nav: Project['nav'] = []
  const groups = (list: any[]): SidebarItem[] =>
    list.flatMap((g: any): SidebarItem[] => {
      if (typeof g === 'string') return [{ type: 'doc', path: g.replace(/^\//, '') }]
      if (g && typeof g === 'object' && Array.isArray(g.pages)) return [{ type: 'category', label: str(g.group) ?? '', items: groups(g.pages) }]
      if (g && typeof g === 'object' && Array.isArray(g.groups)) return groups(g.groups)
      return []
    })
  let sidebar: SidebarItem[] = []
  const n = cfg.navigation
  if (Array.isArray(n)) sidebar = groups(n)
  else if (n && typeof n === 'object') {
    for (const key of ['tabs', 'anchors', 'dropdowns', 'versions', 'languages'] as const) {
      for (const t of n[key] ?? []) {
        const label = str(t.tab) ?? str(t.anchor) ?? str(t.dropdown)
        if (str(t.href)) nav.push({ label: label ?? t.href, href: t.href })
        const items = groups([...(t.groups ?? []), ...(t.pages ?? [])])
        sidebar.push(...items)
        const first = items.map(function firstDoc(i: SidebarItem): string | undefined { return i.type === 'doc' ? i.path : i.type === 'category' ? i.items.map(firstDoc).find(Boolean) : undefined }).find(Boolean)
        if (label && first && key === 'tabs') nav.push({ label, href: `/${first.replace(/(^|\/)index$/, '')}` })
      }
    }
    sidebar.push(...groups([...(n.groups ?? []), ...(n.pages ?? [])]))
    for (const a of n.global?.anchors ?? []) if (str(a.anchor) && str(a.href)) nav.push({ label: a.anchor, href: a.href })
    if (n.versions || n.languages) leftovers.push({ file: basename(file), message: 'versions and languages were flattened into one sidebar; see the versions and i18n options' })
  }
  for (const t of cfg.tabs ?? []) if (str(t.name) && str(t.url)) nav.push({ label: t.name, href: t.url.startsWith('http') ? t.url : `/${t.url}` })
  for (const a of cfg.anchors ?? []) if (str(a.name) && str(a.url)) nav.push({ label: a.name, href: a.url.startsWith('http') ? a.url : `/${a.url}` })
  for (const l of cfg.topbarLinks ?? []) if (str(l.name) && str(l.url)) nav.push({ label: l.name, href: l.url })
  if (cfg.openapi || cfg.api) leftovers.push({ file: basename(file), message: 'API pages from an OpenAPI file: set `openapi: { spec, path }` in novon.config.ts' })
  return {
    source: 'mintlify',
    root,
    docsDir: root,
    publicDirs: [],
    title: str(cfg.name) ?? humanize(basename(root)),
    description: str(cfg.description),
    nav,
    sidebar,
    metas: {},
    leftovers,
    skip: ['snippets', 'node_modules', 'public'],
  }
}

async function nextra(root: string): Promise<Project> {
  const leftovers: Leftover[] = []
  const docsDir = [join(root, 'content'), join(root, 'pages'), join(root, 'src/content'), join(root, 'src/pages')].find((d) => existsSync(d)) ?? join(root, 'pages')
  const metas: Record<string, MetaOut> = {}
  const nav: Project['nav'] = []
  const all = await walk(docsDir)
  for (const f of all) {
    if (!/^_meta\.(json|js|jsx|ts|tsx|mjs)$/.test(basename(f))) continue
    const folder = dirname(f) === '.' ? '' : dirname(f)
    const data = f.endsWith('.json') ? JSON.parse(await readFile(join(docsDir, f), 'utf8')) : await tryLoad(join(docsDir, f), leftovers, root)
    if (!data) continue
    const meta: MetaOut = { pages: [], items: {} }
    let group: { group: string; pages: string[] } | null = null
    for (const [key, v] of Object.entries(data as Record<string, any>)) {
      if (key === '*') continue
      const o = typeof v === 'string' ? { title: v } : v && typeof v === 'object' ? v : {}
      const title = typeof o.title === 'string' ? o.title : undefined
      if (o.type === 'separator') {
        group = title ? { group: title, pages: [] } : null
        if (group) meta.pages.push(group)
        continue
      }
      if (str(o.href)) {
        meta.pages.push({ title: title ?? key, href: o.href })
        continue
      }
      if (o.type === 'page' && !folder) nav.push({ label: title ?? humanize(key), href: key === 'index' ? '/' : `/${key}` })
      if (key === 'index') continue
      ;(group ? group.pages : meta.pages).push(key)
      if (title || o.display === 'hidden') meta.items[key] = { ...(title ? { title } : {}), ...(o.display === 'hidden' ? { hidden: true } : {}) }
    }
    metas[folder] = meta
  }
  let title: string | undefined
  const theme = firstExisting(root, ['theme.config.tsx', 'theme.config.jsx', 'theme.config.ts', 'theme.config.js'])
  if (theme) {
    const text = await readFile(theme, 'utf8')
    title = text.match(/logo:\s*<[^>]*>([^<{]+)</)?.[1]?.trim() ?? text.match(/(?:titleTemplate|title):\s*['"`]([^'"`%]+)/)?.[1]?.trim()
  }
  try {
    title ??= str(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).name)
  } catch {}
  if (existsSync(join(root, 'app'))) leftovers.push({ file: 'app/', message: 'the app folder (layouts, theme) was not migrated; novon has its own layout' })
  return { source: 'nextra', root, docsDir, publicDirs: [join(root, 'public')], title: title ?? humanize(basename(root)), nav, sidebar: null, metas, leftovers, skip: [] }
}

async function vitepress(root: string): Promise<Project> {
  const leftovers: Leftover[] = []
  const docsDir = existsSync(join(root, '.vitepress')) ? root : join(root, 'docs')
  const cfgFile = firstExisting(join(docsDir, '.vitepress'), ['config.mts', 'config.ts', 'config.mjs', 'config.js'])
  const cfg = cfgFile ? await tryLoad(cfgFile, leftovers, root) : null
  const theme = cfg?.themeConfig ?? {}
  const link = (l: string) => {
    let p = l.replace(/^\//, '').replace(/[#?].*$/, '')
    if (!p || p.endsWith('/')) p += 'index'
    return noExt(p)
  }
  const nav: Project['nav'] = []
  for (const item of theme.nav ?? []) {
    const href = str(item?.link) ?? str(item?.items?.[0]?.link)
    if (str(item?.text) && href) nav.push({ label: item.text, href: href.startsWith('http') ? href : `/${link(href).replace(/(^|\/)index$/, '')}`.replace(/\/$/, '') || '/' })
  }
  const convert = (items: any[], baseLink = ''): SidebarItem[] =>
    items.flatMap((it: any): SidebarItem[] => {
      if (!it || typeof it !== 'object') return []
      const base = (it.base as string | undefined) ?? baseLink
      const l = str(it.link)
      const full = l ? (l.startsWith('/') || l.startsWith('http') ? l : `${base}${l}`) : undefined
      if (Array.isArray(it.items)) return [{ type: 'category', label: str(it.text) ?? '', items: convert(it.items, base), ...(it.collapsed !== undefined ? { collapsed: !!it.collapsed } : {}), ...(full && !full.startsWith('http') ? { path: link(full) } : {}) }]
      if (full?.startsWith('http')) return [{ type: 'link', label: str(it.text) ?? full, href: full }]
      if (full) return [{ type: 'doc', path: link(full), ...(str(it.text) ? { label: it.text } : {}) }]
      return []
    })
  let sidebar: SidebarItem[] | null = null
  if (Array.isArray(theme.sidebar)) sidebar = convert(theme.sidebar)
  else if (theme.sidebar && typeof theme.sidebar === 'object') {
    sidebar = []
    for (const v of Object.values(theme.sidebar as Record<string, any>)) sidebar.push(...convert(Array.isArray(v) ? v : (v?.items ?? []), v?.base ?? ''))
  }
  if (cfg?.locales && Object.keys(cfg.locales).length > 1) leftovers.push({ file: relative(root, cfgFile!), message: 'locales were not migrated; see the i18n option' })
  return {
    source: 'vitepress',
    root,
    docsDir,
    publicDirs: [join(docsDir, 'public')],
    title: str(cfg?.title) ?? humanize(basename(root)),
    description: str(cfg?.description),
    base: str(cfg?.base),
    nav,
    sidebar,
    metas: {},
    leftovers,
    skip: ['public'],
  }
}

/** The Starlight options object inside an Astro config. */
function findStarlight(v: unknown, depth = 0): Record<string, any> | null {
  if (!v || typeof v !== 'object' || depth > 6) return null
  const o = v as Record<string, any>
  if ('sidebar' in o || ('title' in o && ('social' in o || 'logo' in o || 'editLink' in o || 'locales' in o || depth > 1))) return o
  for (const x of Array.isArray(o) ? o : Object.values(o)) {
    const found = findStarlight(x, depth + 1)
    if (found) return found
  }
  return null
}

async function starlight(root: string): Promise<Project> {
  const leftovers: Leftover[] = []
  const docsDir = join(root, 'src/content/docs')
  const cfgFile = firstExisting(root, ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'])
  const astro = cfgFile ? await tryLoad(cfgFile, leftovers, root) : null
  const sl = findStarlight(astro?.integrations ?? astro)
  const files = (await walk(docsDir)).filter((f) => PAGE.test(f)).map(noExt)
  const slug = (s: string) => {
    const p = s.replace(/^\//, '').replace(/\/$/, '')
    return files.includes(p) ? p : files.includes(`${p}/index`) ? `${p}/index` : p || 'index'
  }
  const convert = (items: any[]): SidebarItem[] =>
    items.flatMap((it: any): SidebarItem[] => {
      if (typeof it === 'string') return [{ type: 'doc', path: slug(it) }]
      if (!it || typeof it !== 'object') return []
      const label = typeof it.label === 'string' ? it.label : (Object.values(it.label ?? {})[0] as string | undefined)
      if (Array.isArray(it.items)) return [{ type: 'category', label: label ?? '', items: convert(it.items), ...(it.collapsed !== undefined ? { collapsed: !!it.collapsed } : {}) }]
      if (it.autogenerate?.directory) {
        const dir = String(it.autogenerate.directory).replace(/^\/|\/$/g, '')
        return [{ type: 'category', label: label ?? humanize(basename(dir)), items: files.filter((f) => f.startsWith(`${dir}/`)).map((f) => ({ type: 'doc' as const, path: f })), ...(it.collapsed !== undefined ? { collapsed: !!it.collapsed } : {}) }]
      }
      if (str(it.slug)) return [{ type: 'doc', path: slug(it.slug), ...(label ? { label } : {}) }]
      if (str(it.link)) return it.link.startsWith('http') ? [{ type: 'link', label: label ?? it.link, href: it.link }] : [{ type: 'doc', path: slug(it.link), ...(label ? { label } : {}) }]
      return []
    })
  const title = typeof sl?.title === 'string' ? sl.title : (Object.values(sl?.title ?? {})[0] as string | undefined)
  if (sl?.locales && Object.keys(sl.locales).length > 1) leftovers.push({ file: relative(root, cfgFile!), message: 'locales were not migrated; see the i18n option' })
  return {
    source: 'starlight',
    root,
    docsDir,
    publicDirs: [join(root, 'public')],
    title: title ?? humanize(basename(root)),
    description: str(sl?.description),
    url: str(astro?.site),
    base: str(astro?.base),
    nav: [],
    sidebar: Array.isArray(sl?.sidebar) ? convert(sl.sidebar) : null,
    metas: {},
    leftovers,
    skip: [],
  }
}

/** Reads a project of the given framework. */
export async function readProject(source: MigrateSource, root: string): Promise<Project> {
  switch (source) {
    case 'docusaurus':
      return docusaurus(root)
    case 'mintlify':
      return mintlify(root)
    case 'nextra':
      return nextra(root)
    case 'vitepress':
      return vitepress(root)
    case 'starlight':
      return starlight(root)
  }
}

/* ---------- Sidebar → _meta.ts ---------- */

const dirOf = (p: string) => (dirname(p) === '.' ? '' : dirname(p))
function docsIn(items: SidebarItem[]): string[] {
  return items.flatMap((i) => (i.type === 'doc' ? [i.path] : i.type === 'category' ? [...(i.path ? [i.path] : []), ...docsIn(i.items)] : []))
}
function commonDir(paths: string[]): string {
  if (!paths.length) return ''
  const parts = paths.map((p) => dirOf(p).split('/').filter(Boolean))
  const out: string[] = []
  for (let i = 0; ; i++) {
    const seg = parts[0][i]
    if (seg === undefined || parts.some((p) => p[i] !== seg)) break
    out.push(seg)
  }
  return out.join('/')
}

/** Per folder `_meta` from a sidebar tree, with the titles of pages as the sidebar labels them. */
export function sidebarToMetas(sidebar: SidebarItem[]): Record<string, MetaOut> {
  const metas: Record<string, MetaOut> = {}
  const meta = (f: string) => (metas[f] ??= { pages: [], items: {} })
  const addName = (list: MetaOut['pages'], name: string) => {
    if (!list.some((x) => x === name || (typeof x === 'object' && 'group' in x && x.group !== undefined && x.pages.includes(name)))) list.push(name)
  }
  /** Puts a page (or the chain of folders leading to it) under `folder`. */
  const placeDoc = (path: string, folder: string, label?: string, into?: string[]) => {
    const d = dirOf(path)
    const name = basename(path)
    if (d === folder) {
      if (name !== 'index') into ? into.includes(name) || into.push(name) : addName(meta(folder).pages, name)
      if (label && name !== 'index') meta(folder).items[name] = { ...meta(folder).items[name], title: label }
      return
    }
    if (folder && !d.startsWith(`${folder}/`)) return placeDoc(path, d, label)
    const rest = (folder ? d.slice(folder.length + 1) : d).split('/')
    const child = rest[0]
    into ? into.includes(child) || into.push(child) : addName(meta(folder).pages, child)
    let cur = folder ? `${folder}/${child}` : child
    for (const seg of rest.slice(1)) {
      addName(meta(cur).pages, seg)
      cur = `${cur}/${seg}`
    }
    if (name !== 'index') addName(meta(cur).pages, name)
    if (label && name !== 'index') meta(d).items[name] = { ...meta(d).items[name], title: label }
  }
  const target = (it: SidebarItem, folder: string): string | null => {
    if (it.type !== 'category') return null
    const docs = docsIn([it])
    const c = commonDir(docs)
    return docs.length && c !== folder && (folder === '' || c.startsWith(`${folder}/`)) && !docs.some((p) => dirOf(p) === folder) ? c : null
  }
  const place = (items: SidebarItem[], folder: string, into?: string[]) => {
    const shared = new Map<string, number>()
    for (const it of items) {
      const c = target(it, folder)
      if (c) shared.set(c, (shared.get(c) ?? 0) + 1)
    }
    for (const it of items) {
      const sc = target(it, folder)
      if (it.type === 'category' && sc && (shared.get(sc) ?? 0) > 1) {
        // Several categories share one folder: each is a group inside it.
        const child = sc.slice(folder ? folder.length + 1 : 0).split('/')[0]
        into ? into.includes(child) || into.push(child) : addName(meta(folder).pages, child)
        let cur = folder ? `${folder}/${child}` : child
        for (const seg of sc.slice(cur.length + 1).split('/').filter(Boolean)) {
          addName(meta(cur).pages, seg)
          cur = `${cur}/${seg}`
        }
        const group = { group: it.label, pages: [] as string[] }
        meta(sc).pages.push(group)
        if (it.path) placeDoc(it.path, sc, undefined, group.pages)
        place(it.items, sc, group.pages)
        if (!group.pages.length) meta(sc).pages.splice(meta(sc).pages.indexOf(group), 1)
        continue
      }
      if (it.type === 'doc') placeDoc(it.path, folder, it.label, into)
      else if (it.type === 'link') meta(folder).pages.push({ title: it.label, href: it.href })
      else {
        const docs = docsIn([it])
        const c = commonDir(docs)
        if (docs.length && c !== folder && (folder === '' || c.startsWith(`${folder}/`)) && !docs.some((p) => dirOf(p) === folder)) {
          // A category whose pages live in one sub-folder: that folder, titled by the category.
          const child = c.slice(folder ? folder.length + 1 : 0).split('/')[0]
          const target = folder ? `${folder}/${child}` : child
          into ? into.includes(child) || into.push(child) : addName(meta(folder).pages, child)
          if (it.label) meta(c).title = it.label
          if (it.collapsed) meta(c).collapsed = true
          place(it.items, target)
        } else if (into) place(it.items, folder, into)
        else {
          const group = { group: it.label, pages: [] as string[] }
          meta(folder).pages.push(group)
          if (it.path) placeDoc(it.path, folder, undefined, group.pages)
          place(it.items, folder, group.pages)
          if (!group.pages.length) meta(folder).pages.splice(meta(folder).pages.indexOf(group), 1)
        }
      }
    }
  }
  place(sidebar, '')
  return metas
}

/** `{ a: 1 }` as TypeScript source with unquoted keys where it can. */
export function toTs(value: unknown, indent = ''): string {
  const next = `${indent}  `
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    const flat = value.map((v) => toTs(v, next))
    const one = `[${flat.join(', ')}]`
    return one.length + indent.length < 100 && !one.includes('\n') ? one : `[\n${flat.map((v) => `${next}${v},`).join('\n')}\n${indent}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined)
    if (!entries.length) return '{}'
    const parts = entries.map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k.replace(/'/g, "\\'")}'`}: ${toTs(v, next)}`)
    const one = `{ ${parts.join(', ')} }`
    return one.length + indent.length < 100 && !one.includes('\n') ? one : `{\n${parts.map((p) => `${next}${p},`).join('\n')}\n${indent}}`
  }
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  return JSON.stringify(value)
}

function metaFile(m: MetaOut): string {
  const out: Record<string, unknown> = {}
  if (m.title) out.title = m.title
  if (m.order !== undefined) out.order = m.order
  if (m.collapsed) out.collapsed = true
  if (m.pages.length) out.pages = m.pages
  if (Object.keys(m.items).length) out.items = m.items
  return `import { defineMeta } from 'novon/config'\n\nexport default defineMeta(${toTs(out)})\n`
}

/* ---------- Page bodies ---------- */

const CALLOUT_NAMES: Record<string, string> = { note: 'note', tip: 'tip', info: 'info', warning: 'warning', caution: 'caution', danger: 'danger', important: 'info', success: 'tip', check: 'tip', error: 'danger', secondary: 'note', default: 'note' }

/** Splits a body into prose and fenced code, so rewrites never touch code. */
function splitFences(body: string): { code: boolean; text: string }[] {
  const out: { code: boolean; text: string }[] = []
  const lines = body.split('\n')
  let buf: string[] = []
  let fence: string | null = null
  const flush = (code: boolean) => {
    if (buf.length) out.push({ code, text: buf.join('\n') })
    buf = []
  }
  for (const line of lines) {
    const m = line.match(/^\s*(`{3,}|~{3,})/)
    if (!fence && m) {
      flush(false)
      fence = m[1]
      buf.push(line)
    } else if (fence && new RegExp(`^\\s*${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`).test(line)) {
      buf.push(line)
      flush(true)
      fence = null
    } else buf.push(line)
  }
  flush(!!fence)
  return out
}

function onProse(body: string, fn: (s: string) => string): string {
  const parts = splitFences(body)
  // Join with the newline that split them; each part keeps its own lines.
  return parts.map((p) => (p.code ? p.text : fn(p.text))).join('\n')
}

const attr = (tag: string, name: string): string | undefined => {
  const m = tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)'|\\{["'\`]([^"'\`]*)["'\`]\\})`))
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined
}
const q = (s: string) => `"${s.replace(/"/g, '&quot;')}"`

/** `:::tip Title`, `::: tip Title` and `:::tip[Title]` → `:::tip[Title]`; `::: details` → Accordion; `::: code-group` → CodeGroup. */
function containers(body: string): string {
  const lines = body.split('\n')
  const out: string[] = []
  const stack: string[] = []
  let inFence: string | null = null
  for (const line of lines) {
    const fm = line.match(/^\s*(`{3,}|~{3,})(.*)$/)
    if (fm) {
      if (!inFence) {
        inFence = fm[1]
        // VitePress code-group labels: ```js [config.js] → title="config.js"
        out.push(stack.at(-1) === 'code-group' ? line.replace(/^(\s*`{3,}[\w-]*)\s*\[([^\]]+)\](.*)$/, '$1 title="$2"$3') : line)
        continue
      }
      if (fm[1][0] === inFence[0] && fm[1].length >= inFence.length && !fm[2].trim()) inFence = null
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }
    const open = line.match(/^(\s*)(:{3,})\s*([A-Za-z][\w-]*)(?:\[([^\]]*)\])?\s*(.*?)\s*$/)
    if (open) {
      const [, ind, , name, bracket, rest] = open
      const type = CALLOUT_NAMES[name.toLowerCase()]
      const title = bracket ?? (rest.replace(/^\{.*\}$/, '').trim() || undefined)
      if (type) {
        stack.push('callout')
        out.push(`${ind}:::${type}${title ? `[${title}]` : ''}`)
        continue
      }
      if (name === 'details') {
        stack.push('details')
        out.push(`${ind}<Accordion title=${q(title ?? 'Details')}>`, '')
        continue
      }
      if (name === 'code-group') {
        stack.push('code-group')
        out.push(`${ind}<CodeGroup>`, '')
        continue
      }
      stack.push('other')
      out.push(line)
      continue
    }
    const close = line.match(/^(\s*):{3,}\s*$/)
    if (close && stack.length) {
      const kind = stack.pop()
      if (kind === 'details' || kind === 'code-group') out.push('', `${close[1]}</${kind === 'details' ? 'Accordion' : 'CodeGroup'}>`)
      else out.push(`${close[1]}:::`)
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

/** Inside `<Steps>`: `### Title` headings (Nextra) or a top-level ordered list (Starlight) become `<Step title>`. */
function stepsFromHeadings(body: string): string {
  return body.replace(/(<Steps>)([\s\S]*?)(<\/Steps>)/g, (m, open: string, inner: string, close: string) => {
    if (/<Step[\s>]/.test(inner)) return m
    const lines = inner.split('\n')
    const isHeading = lines.some((l) => /^#{2,4} /.test(l))
    const out: string[] = []
    let openStep = false
    for (const l of lines) {
      const h = isHeading ? l.match(/^#{2,4} (.+)$/) : l.match(/^\d+\.\s+(.+)$/)
      if (h) {
        if (openStep) out.push('</Step>', '')
        out.push(`<Step title=${q(h[1].replace(/\*\*/g, '').trim())}>`, '')
        openStep = true
      } else out.push(isHeading ? l : l.replace(/^ {2,4}/, ''))
    }
    if (openStep) out.push('', '</Step>')
    return `${open}\n${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n${close}`
  })
}

/** Nextra `<Tabs items={['a', 'b']}>` + `<Tabs.Tab>` → `<Tabs>` + `<Tab title="a">`. */
function nextraTabs(body: string): string {
  return body.replace(/<Tabs\b([^>]*)>([\s\S]*?)<\/Tabs>/g, (m, attrs: string, inner: string) => {
    const items = attrs.match(/items=\{\[([\s\S]*?)\]\}/)
    if (!items) return m
    const labels = [...items[1].matchAll(/["'`]([^"'`]*)["'`]/g)].map((x) => x[1])
    let i = 0
    const body2 = inner.replace(/<Tabs\.Tab\b[^>]*>/g, () => `<Tab title=${q(labels[i++] ?? `Tab ${i}`)}>`).replace(/<\/Tabs\.Tab>/g, '</Tab>')
    return `<Tabs>${body2}</Tabs>`
  })
}

/** Rewrites one page's body for novon. */
export function convertBody(source: MigrateSource, body: string): string {
  let out = body
  // Imports of the framework's own components: novon has them built in.
  const ownImport = /^import\s+[^\n]*?from\s+['"](@theme\/[^'"]+|@docusaurus\/[^'"]+|nextra[^'"]*|nextra-theme-docs|@astrojs\/starlight\/components|vitepress[^'"]*)['"];?[ \t]*\n?/gm
  out = out.replace(ownImport, '')
  out = nextraTabs(out)
  out = containers(out)
  out = onProse(out, (s) => {
    let t = s
    // Tabs
    t = t.replace(/<TabItem\b([^>]*)>/g, (_m, a: string) => `<Tab title=${q(attr(a, 'label') ?? attr(a, 'value') ?? 'Tab')}>`).replace(/<\/TabItem>/g, '</Tab>')
    t = t.replace(/<Tabs(?=[\s>])(?![^>]*items=)[^>]*>/g, '<Tabs>')
    // Callout components
    t = t.replace(/<Check(\s|>)/g, '<Tip$1').replace(/<\/Check>/g, '</Tip>')
    t = t.replace(/<(Callout|Aside)\b([^>]*)>/g, (_m, _n: string, a: string) => {
      const type = CALLOUT_NAMES[(attr(a, 'type') ?? 'note').toLowerCase()] ?? 'note'
      const title = attr(a, 'title')
      return `<Callout type="${type}"${title ? ` title=${q(title)}` : ''}>`
    })
    t = t.replace(/<\/Aside>/g, '</Callout>')
    // Cards
    t = t.replace(/<(?:Cards|CardGrid)\b([^>]*)>/g, (_m, a: string) => `<CardGroup${attr(a, 'num') || attr(a, 'cols') ? ` cols={${attr(a, 'num') ?? attr(a, 'cols')}}` : ''}>`).replace(/<\/(?:Cards|CardGrid)>/g, '</CardGroup>')
    t = t.replace(/<Cards\.Card\b/g, '<Card').replace(/<\/Cards\.Card>/g, '</Card>')
    t = t.replace(/<LinkCard\b([^>]*?)\/>/g, (_m, a: string) => {
      const desc = attr(a, 'description')
      return `<Card title=${q(attr(a, 'title') ?? '')} href=${q(attr(a, 'href') ?? '')}>${desc ? desc : ''}</Card>`
    })
    // File trees
    t = t.replace(/<FileTree\.(Folder|File)\b/g, '<$1').replace(/<\/FileTree\.(Folder|File)>/g, '</$1>')
    // <details><summary>X</summary> … </details>
    t = t.replace(/<details>\s*<summary>([\s\S]*?)<\/summary>/g, (_m, s2: string) => `<Accordion title=${q(s2.replace(/<[^>]+>/g, '').trim())}>`).replace(/<\/details>/g, '</Accordion>')
    // Comments that MDX does not take
    if (source !== 'mintlify') t = t.replace(/<!--\s*truncate\s*-->\n?/g, '')
    // VitePress [[toc]]
    t = t.replace(/^\[\[toc\]\]\s*$/gm, '')
    return t
  })
  out = nextraTabs(out)
  out = stepsFromHeadings(out)
  out = onProse(out, (s) => s.replace(/\n{3,}/g, '\n\n').replace(/\n\n$/, '\n').replace(/^\n\n/, '\n'))
  return out.replace(/^\n+/, '')
}

/** Frontmatter keys renamed for novon. */
export function convertFrontmatter(source: MigrateSource, data: Record<string, any>): { data: Record<string, any>; notes: string[] } {
  const out: Record<string, any> = { ...data }
  const notes: string[] = []
  const move = (from: string, to: string) => {
    if (from in out) {
      if (!(to in out)) out[to] = out[from]
      delete out[from]
    }
  }
  if (source === 'docusaurus') {
    move('sidebar_label', 'label')
    move('sidebar_position', 'order')
    delete out.id
    if ('slug' in out) {
      notes.push(`frontmatter \`slug: ${out.slug}\` was dropped: novon takes the URL from the file path; add \`redirectFrom\` if the old URL must keep working`)
      delete out.slug
    }
    if (out.sidebar_class_name) delete out.sidebar_class_name
    if (out.hide_table_of_contents) delete out.hide_table_of_contents
    if (out.draft === true) out.draft = true
    if (out.unlisted) {
      out.hidden = true
      delete out.unlisted
    }
  }
  if (source === 'mintlify') {
    move('sidebarTitle', 'label')
    if (out.openapi || out.api) notes.push('an API page from an OpenAPI operation: use novon `openapi` pages')
    if (out.mode) delete out.mode
  }
  if (source === 'starlight' && out.sidebar && typeof out.sidebar === 'object') {
    const s = out.sidebar
    if (typeof s.order === 'number') out.order = s.order
    if (typeof s.label === 'string') out.label = s.label
    if (s.hidden) out.hidden = true
    if (s.badge) out.badge = typeof s.badge === 'string' ? s.badge : s.badge.text
    delete out.sidebar
  }
  if (source === 'starlight') {
    if (out.hero) notes.push('a splash/hero page: rebuild its hero with cards or a custom component')
    delete out.template
  }
  if (source === 'vitepress') {
    if (out.layout === 'home' || out.hero) notes.push('a VitePress home page (hero, features): rewrite it as MDX, e.g. with <CardGroup>')
    if (out.layout) delete out.layout
  }
  if (source === 'nextra' && out.sidebarTitle) move('sidebarTitle', 'label')
  return { data: out, notes }
}

/** Things in a converted page novon cannot render as is. */
export function findLeftovers(file: string, body: string, offset = 0): Leftover[] {
  const out: Leftover[] = []
  const local = new Set<string>()
  for (const m of body.matchAll(/^export\s+(?:const|function)\s+([A-Z][\w]*)/gm)) local.add(m[1])
  const parts = splitFences(body)
  let line = offset + 1
  for (const p of parts) {
    if (!p.code) {
      p.text.split('\n').forEach((l, i) => {
        const at = line + i
        const imp = l.match(/^import\s.*from\s+['"]([^'"]+)['"]/)
        if (imp) out.push({ file, line: at, message: `import from "${imp[1]}": move what it provides into a component and register it in \`components\`` })
        for (const m of l.matchAll(/<([A-Z][\w.]*)/g)) if (!NOVON_COMPONENTS.has(m[1]) && !local.has(m[1])) out.push({ file, line: at, message: `<${m[1]}> is not a novon component` })
        if (/\{\{.*\}\}/.test(l)) out.push({ file, line: at, message: 'template interpolation {{ }} is not MDX' })
        if (/^<script\b|^<style\b/.test(l)) out.push({ file, line: at, message: `${l.trim().split(/[\s>]/)[0]}> block: MDX has no Vue or Astro script blocks` })
        const c = l.match(/^\s*:{3,}\s*([A-Za-z][\w-]*)/)
        if (c && !CALLOUT_NAMES[c[1].toLowerCase()]) out.push({ file, line: at, message: `:::${c[1]} container has no novon equivalent` })
      })
    }
    line += p.text.split('\n').length
  }
  // One line per component per file is enough.
  const seen = new Set<string>()
  return out.filter((l) => !seen.has(l.message) && seen.add(l.message))
}

/* ---------- Writing ---------- */

export interface MigrateResult {
  source: MigrateSource
  dir: string
  pages: number
  metas: number
  assets: number
  leftovers: Leftover[]
}

function configFile(p: Project): string {
  const cfg: Record<string, unknown> = { title: p.title }
  if (p.description) cfg.description = p.description
  if (p.url) cfg.url = p.url.replace(/\/$/, '')
  if (p.base && p.base !== '/') cfg.base = p.base
  cfg.layout = 'docs'
  if (p.nav.length) cfg.nav = p.nav
  cfg.plugins = ['search', 'sitemap', 'rss', 'llms']
  return `import { defineConfig } from 'novon/config'\n\n// Migrated from ${p.source} by \`novon migrate\`.\nexport default defineConfig(${toTs(cfg)})\n`
}

function migrationDoc(p: Project, leftovers: Leftover[]): string {
  const lines = [`# Migrating from ${p.source}`, '', `\`novon migrate ${p.source}\` converted pages, frontmatter, the sidebar and the framework's callouts, tabs, cards and steps.`, '']
  if (!leftovers.length) lines.push('Nothing was left over. Run `novon check` and `novon dev` to review the site.')
  else {
    lines.push('These need a hand. Fix them, or run `novon migrate --agent` to give the list to your coding agent.', '')
    const byFile = new Map<string, Leftover[]>()
    for (const l of leftovers) byFile.set(l.file, [...(byFile.get(l.file) ?? []), l])
    for (const [file, items] of byFile) {
      lines.push(`## ${file}`, '')
      for (const l of items) lines.push(`- [ ] ${l.line ? `line ${l.line}: ` : ''}${l.message}`)
      lines.push('')
    }
  }
  return `${lines.join('\n').trimEnd()}\n`
}

/** Converts the project at `src` into a novon site at `dir`. */
export async function migrate(source: MigrateSource | 'auto', src: string, dir: string, opts: { overwrite?: boolean; dryRun?: boolean } = {}): Promise<MigrateResult & { project: Project; files: Record<string, string> }> {
  const root = resolve(src)
  if (!existsSync(root)) throw new Error(`no folder ${src}`)
  const kind = source === 'auto' ? detectSource(root) : source
  if (!kind) throw new Error(`could not tell which framework ${src} uses; name it: novon migrate <${MIGRATE_SOURCES.join('|')}>`)
  if (!MIGRATE_SOURCES.includes(kind)) throw new Error(`unknown source "${kind}"; use ${MIGRATE_SOURCES.join(', ')} or auto`)
  const out = resolve(dir)
  if (!opts.dryRun && !opts.overwrite && existsSync(join(out, 'content')) && (await readdir(join(out, 'content'))).length) throw new Error(`${dir}/content is not empty; pass --overwrite or choose another --dir`)
  const project = await readProject(kind, root)
  if (!existsSync(project.docsDir)) throw new Error(`no pages folder at ${relative(process.cwd(), project.docsDir) || '.'}`)
  const leftovers = [...project.leftovers]
  const files: Record<string, string> = {}
  const assets: [string, string][] = []
  const skip = [...project.skip, ...(project.docsDir === root ? [relative(root, out)].filter((r) => r && !r.startsWith('..')) : [])]
  const all = await walk(project.docsDir, project.docsDir, skip)
  let pages = 0
  for (const f of all) {
    const abs = join(project.docsDir, f)
    if (PAGE.test(f)) {
      if (basename(f).startsWith('_')) {
        leftovers.push({ file: f, message: 'a partial (file starting with _) was not migrated; novon partials live in content/_partials' })
        continue
      }
      const raw = await readFile(abs, 'utf8')
      const parsed = matter(raw)
      const fm = convertFrontmatter(kind, parsed.data)
      const body = convertBody(kind, parsed.content)
      const jsx = /<[A-Z]/.test(splitFences(body).filter((p) => !p.code).map((p) => p.text).join('\n'))
      const target = kind === 'docusaurus' ? unprefixFile(f) : f
      const ext = f.endsWith('.md') && jsx ? '.mdx' : extname(f)
      const rel = `content/${noExt(target)}${ext}`
      for (const n of fm.notes) leftovers.push({ file: rel, message: n })
      const head = Object.keys(fm.data).length ? `---\n${matter.stringify('', fm.data).replace(/^---\n/, '').replace(/\n---\s*$/, '').trim()}\n---\n\n` : ''
      files[rel] = `${head}${body.trimEnd()}\n`
      const fmLines = head ? head.split('\n').length - 1 : 0
      leftovers.push(...findLeftovers(rel, body, fmLines))
      pages++
    } else if (/^_meta\.|^_category_\.|^(docs|mint)\.json$/.test(basename(f))) continue
    else if (kind === 'mintlify') {
      if (/\.(json|ya?ml|lock|md|txt)$/.test(f) || f === 'package.json') continue
      assets.push([abs, join(out, 'public', f)])
    } else assets.push([abs, join(out, 'content', kind === 'docusaurus' ? unprefixFile(f) : f)])
  }
  // Sidebar: the framework's folder metadata first, then the sidebar config on top.
  const metas: Record<string, MetaOut> = { ...project.metas }
  if (project.sidebar) {
    const mapped = sidebarToMetas(kind === 'docusaurus' ? mapPaths(project.sidebar, unprefix) : project.sidebar)
    for (const [k, m] of Object.entries(mapped)) metas[k] = { ...metas[k], ...m, items: { ...metas[k]?.items, ...m.items } }
  }
  const pagesSet = new Set(Object.keys(files).map((f) => noExt(f.slice('content/'.length))))
  for (const [folder, m] of Object.entries(metas)) {
    const missing = m.pages.flatMap((x) => (typeof x === 'string' ? [x] : 'group' in x ? x.pages : [])).filter((n) => !pagesSet.has(folder ? `${folder}/${n}` : n) && !pagesSet.has(folder ? `${folder}/${n}/index` : `${n}/index`) && ![...pagesSet].some((p) => p.startsWith(folder ? `${folder}/${n}/` : `${n}/`)))
    for (const n of missing) leftovers.push({ file: `content/${folder ? `${folder}/` : ''}_meta.ts`, message: `the sidebar names "${n}", which is not a page here` })
    if (!m.pages.length && !m.title && !Object.keys(m.items).length && !m.collapsed) continue
    files[`content/${folder ? `${folder}/` : ''}_meta.ts`] = metaFile(m)
  }
  for (const d of project.publicDirs) {
    if (!existsSync(d)) continue
    for (const f of await walk(d)) assets.push([join(d, f), join(out, 'public', f)])
  }
  files['novon.config.ts'] = configFile(project)
  files['MIGRATION.md'] = migrationDoc(project, leftovers)
  if (!opts.dryRun) {
    for (const [rel, text] of Object.entries(files)) {
      await mkdir(dirname(join(out, rel)), { recursive: true })
      await writeFile(join(out, rel), text)
    }
    for (const [from, to] of assets) {
      if ((await stat(from)).isDirectory()) continue
      await mkdir(dirname(to), { recursive: true })
      await cp(from, to)
    }
  }
  return { source: kind, dir: out, pages, metas: Object.keys(files).filter((f) => f.endsWith('_meta.ts')).length, assets: assets.length, leftovers, project, files }
}

const unprefixFile = (f: string) => {
  const ext = extname(f)
  return `${unprefix(f.slice(0, f.length - ext.length))}${ext}`
}

function mapPaths(items: SidebarItem[], fn: (p: string) => string): SidebarItem[] {
  return items.map((i) => (i.type === 'doc' ? { ...i, path: fn(i.path) } : i.type === 'category' ? { ...i, items: mapPaths(i.items, fn), ...(i.path ? { path: fn(i.path) } : {}) } : i))
}

/** The prompt that hands the leftovers to the agent, run inside the new site. */
export function migrationPrompt(r: MigrateResult): string {
  return [
    `This folder is a novon docs site just converted from ${r.source} by \`novon migrate\`. MIGRATION.md lists what the conversion could not do.`,
    '',
    'Work through every unchecked item in MIGRATION.md:',
    '- Rewrite framework-specific syntax with novon\'s built-in MDX components (Callout, Note, Tip, Warning, Tabs/Tab, Steps/Step, CardGroup/Card, Accordion, CodeGroup, FileTree) or plain Markdown.',
    '- A custom component the pages need goes in components/<Name>.tsx and is registered in `components` in novon.config.ts; remove imports novon cannot resolve.',
    '- Keep page content and meaning; do not invent text.',
    '- Tick each item in MIGRATION.md as you fix it.',
    '- When done, run `novon check` and fix what it reports.',
    '',
  ].join('\n')
}
