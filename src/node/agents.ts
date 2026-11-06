/**
 * Files for coding agents and AI tools, from config `agents`:
 *
 * - a static JSON API: `/api/pages.json`, `/api/pages/<route>.json`, `/api/navigation.json`, described by `/openapi.json`
 * - agent skills from a `skills/` folder at `/.well-known/agent-skills/`, with an index
 * - a generated skill describing the site at `/skill.md` (needs `url`)
 * - a discovery manifest at `/.well-known/ard.json` and `ai-catalog.json`, and an API catalog at `/.well-known/api-catalog` (need `url`)
 * - `<link>` tags pointing at them, and `_headers` rules for hosts that read them
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import matter from 'gray-matter'
import { docsNav, flatten } from '../runtime/nav.ts'
import { postsOf, withBase } from '../shared.ts'
import type { HeadTag, NovonPlugin, PageMeta, ResolvedConfig, RoutesContext } from '../types.ts'
import { absolute, markdownPath, sectionOf } from './plugins.ts'

const SKILLS_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json'
const LINKSET = 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"'

const on = (config: ResolvedConfig, key: 'skill' | 'discovery' | 'api' | 'webmcp') => config.agents !== false && config.agents?.[key] !== false

/** `Acme Docs` → `acme-docs`, as a skill name allows. */
export function skillName(title: string): string {
  const slug = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '')
  return slug || 'docs'
}

/** The JSON form of a page: `api/pages/guide/writing.json`, `api/pages/index.json` for home. */
export function pageJsonPath(route: string): string {
  return `/api/pages${route === '/' ? '/index' : route}.json`
}

const listed = (pages: PageMeta[]) => pages.filter((p) => p.kind === 'page' && !p.hidden && p.file)

function pageEntry(config: ResolvedConfig, page: PageMeta, pages: PageMeta[]) {
  return {
    route: page.route,
    url: absolute(config, page.route),
    title: page.title,
    ...(page.description ? { description: page.description } : {}),
    ...(sectionOf(page, pages) ? { section: sectionOf(page, pages) } : {}),
    layout: page.layout,
    ...(page.date ? { date: page.date } : {}),
    ...(page.updated ? { updated: page.updated } : {}),
    ...(page.tags.length ? { tags: page.tags } : {}),
    markdownUrl: absolute(config, markdownPath(page.route)),
    jsonUrl: absolute(config, pageJsonPath(page.route)),
  }
}

/** The sidebar of each docs layer and the posts of each blog layer. */
export function navigationTree(config: ResolvedConfig, pages: PageMeta[], folders: RoutesContext['folders']) {
  const layers = new Map<string, PageMeta['layout']>([['/', config.layout]])
  for (const l of config.layers) layers.set(l.path, l.layout)
  return {
    nav: config.nav.map((n) => ({ label: n.label, href: /^[a-z]+:/i.test(n.href) ? n.href : absolute(config, n.href) })),
    layers: [...layers].map(([path, layout]) => {
      const title = config.layers.find((l) => l.path === path)?.title
      if (layout === 'blog') {
        return { path, layout, ...(title ? { title } : {}), posts: postsOf(pages, path).map((p) => ({ route: p.route, title: p.title, date: p.date })) }
      }
      const sections = docsNav(pages, path, folders).map((s) => ({
        ...(s.label ? { label: s.label } : {}),
        ...(s.route ? { route: s.route } : {}),
        items: s.items.map((i) => ({
          ...(i.external ? { href: i.external } : { route: i.page.route }),
          title: i.page.label,
          depth: i.depth,
          ...(i.group ? { group: i.group } : {}),
          ...(i.page.badge ? { badge: i.page.badge } : {}),
        })),
      }))
      return { path, layout, ...(title ? { title } : {}), sections }
    }),
  }
}

function openapi(config: ResolvedConfig, search: boolean) {
  const text = (description: string) => ({ description, content: { 'text/plain': { schema: { type: 'string' } } } })
  const json = (description: string, ref: string) => ({ description, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } })
  const page = {
    type: 'object',
    required: ['route', 'url', 'title', 'markdownUrl', 'jsonUrl'],
    properties: {
      route: { type: 'string' },
      url: { type: 'string', format: 'uri-reference' },
      title: { type: 'string' },
      description: { type: 'string' },
      section: { type: 'string' },
      layout: { type: 'string', enum: ['docs', 'blog'] },
      date: { type: 'string' },
      updated: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      markdownUrl: { type: 'string', format: 'uri-reference' },
      jsonUrl: { type: 'string', format: 'uri-reference' },
    },
  }
  const paths: Record<string, unknown> = {
    '/api/pages.json': { get: { operationId: 'listPages', summary: 'Every page of the site', responses: { 200: json('The page index', 'PageIndex') } } },
    '/api/pages/{route}.json': {
      get: {
        operationId: 'getPage',
        summary: 'One page with its headings and Markdown',
        parameters: [{ name: 'route', in: 'path', required: true, description: 'The page route without the leading slash; `index` for the home page', schema: { type: 'string' } }],
        responses: { 200: json('The page', 'Page'), 404: { description: 'No such page' } },
      },
    },
    '/api/navigation.json': { get: { operationId: 'getNavigation', summary: 'The top navigation and each sidebar', responses: { 200: { description: 'The navigation tree', content: { 'application/json': { schema: { type: 'object' } } } } } } },
    '/{route}.md': {
      get: {
        operationId: 'getPageMarkdown',
        summary: 'A page as plain Markdown',
        parameters: [{ name: 'route', in: 'path', required: true, description: 'The page route; `index` for the home page', schema: { type: 'string' } }],
        responses: { 200: { description: 'Markdown', content: { 'text/markdown': { schema: { type: 'string' } } } } },
      },
    },
  }
  const plugins = config.plugins ?? []
  if (plugins.includes('llms')) {
    paths['/llms.txt'] = { get: { operationId: 'getLlmsTxt', summary: 'Index of every page as Markdown', responses: { 200: text('llms.txt') } } }
    paths['/llms-full.txt'] = { get: { operationId: 'getLlmsFullTxt', summary: 'Every page in one Markdown file', responses: { 200: text('llms-full.txt') } } }
  }
  if (search) {
    paths['/search.json'] = { get: { operationId: 'getSearchIndex', summary: 'The search index: one entry per page and per heading section', responses: { 200: { description: 'Search entries', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } } } } }
  }
  return {
    openapi: '3.1.0',
    info: { title: `${config.title} docs API`, version: '1', ...(config.description ? { description: config.description } : {}) },
    servers: [{ url: absolute(config, '/').replace(/\/$/, '') || '/' }],
    paths,
    components: {
      schemas: {
        PageEntry: page,
        PageIndex: { type: 'object', required: ['pages'], properties: { title: { type: 'string' }, pages: { type: 'array', items: { $ref: '#/components/schemas/PageEntry' } } } },
        Page: {
          allOf: [
            { $ref: '#/components/schemas/PageEntry' },
            { type: 'object', properties: { headings: { type: 'array', items: { type: 'object', properties: { depth: { type: 'integer' }, id: { type: 'string' }, text: { type: 'string' } } } }, markdown: { type: 'string' } } },
          ],
        },
      },
    },
  }
}

/* ---------- Skills ---------- */

export interface PublishedSkill {
  name: string
  description: string
  type: 'skill-md' | 'archive'
  /** Path under the output directory. */
  path: string
  data: Uint8Array
}

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

async function filesOf(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.isSymbolicLink()) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await filesOf(full)))
    else if (e.isFile()) out.push(full)
  }
  return out.sort()
}

/** A ustar archive of files (deterministic: zero times and owners, sorted). */
export function tar(files: { name: string; data: Uint8Array; mode?: number }[]): Uint8Array {
  const blocks: Uint8Array[] = []
  const enc = new TextEncoder()
  for (const f of files) {
    const header = new Uint8Array(512)
    const put = (s: string, at: number, len: number) => header.set(enc.encode(s).slice(0, len), at)
    const octal = (n: number, len: number) => n.toString(8).padStart(len - 1, '0') + '\0'
    let name = f.name
    let prefix = ''
    if (enc.encode(name).length > 100) {
      const cut = name.lastIndexOf('/', name.length - 1 - 0)
      prefix = name.slice(0, cut)
      name = name.slice(cut + 1)
    }
    put(name, 0, 100)
    put(octal(f.mode ?? 0o644, 8), 100, 8)
    put(octal(0, 8), 108, 8)
    put(octal(0, 8), 116, 8)
    put(octal(f.data.length, 12), 124, 12)
    put(octal(0, 12), 136, 12)
    header.fill(32, 148, 156)
    put('0', 156, 1)
    put('ustar\0', 257, 6)
    put('00', 263, 2)
    put(prefix, 345, 155)
    const sum = header.reduce((a, b) => a + b, 0)
    put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8)
    blocks.push(header, f.data, new Uint8Array((512 - (f.data.length % 512)) % 512))
  }
  blocks.push(new Uint8Array(1024))
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0))
  let at = 0
  for (const b of blocks) {
    out.set(b, at)
    at += b.length
  }
  return out
}

/**
 * The skills in a folder: each sub-folder with a `SKILL.md` whose frontmatter
 * has a valid `name` (the folder's name) and `description`. A lone SKILL.md is
 * published as is; a skill with more files as a `.tar.gz`.
 */
export async function readSkills(dir: string): Promise<{ skills: PublishedSkill[]; warnings: string[] }> {
  const skills: PublishedSkill[] = []
  const warnings: string[] = []
  if (!existsSync(dir)) return { skills, warnings }
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue
    const folder = join(dir, e.name)
    const file = join(folder, 'SKILL.md')
    if (!existsSync(file)) continue
    const source = await readFile(file)
    const { data } = matter(source.toString('utf8'))
    const name = typeof data.name === 'string' ? data.name : ''
    const description = typeof data.description === 'string' ? data.description.trim() : ''
    if (!NAME.test(name) || name.length > 64 || name !== e.name) {
      warnings.push(`skills/${e.name}/SKILL.md: \`name\` must be "${e.name}" (lowercase letters, digits and hyphens); skipped`)
      continue
    }
    if (!description || description.length > 1024) {
      warnings.push(`skills/${e.name}/SKILL.md: \`description\` must be 1 to 1024 characters; skipped`)
      continue
    }
    const files = await filesOf(folder)
    if (files.length === 1) {
      skills.push({ name, description, type: 'skill-md', path: `.well-known/agent-skills/${name}/SKILL.md`, data: new Uint8Array(source) })
      continue
    }
    const entries = await Promise.all(
      files.map(async (f) => ({
        name: relative(folder, f).split(sep).join('/'),
        data: new Uint8Array(await readFile(f)),
        mode: (await stat(f)).mode & 0o111 ? 0o755 : 0o644,
      })),
    )
    skills.push({ name, description, type: 'archive', path: `.well-known/agent-skills/${name}.tar.gz`, data: Bun.gzipSync(tar(entries) as Uint8Array<ArrayBuffer>, { level: 9 }) })
  }
  return { skills, warnings }
}

/** A SKILL.md that tells a coding agent how to read this site. */
export async function siteSkill(config: ResolvedConfig, pages: PageMeta[], folders: RoutesContext['folders']): Promise<string> {
  const name = skillName(config.title)
  const about = config.description ? ` ${config.description.replace(/\s+/g, ' ').replace(/\.?$/, '.')}` : ''
  const description = `Read the ${config.title} documentation.${about} Use it when a task involves ${config.title}.`.slice(0, 1024)
  const lines = [
    '---',
    `name: ${name}`,
    `description: ${JSON.stringify(description)}`,
    '---',
    '',
    `# ${config.title}`,
    '',
    ...(config.description ? [config.description, ''] : []),
    '## Reading these docs',
    '',
    `- Every page is plain Markdown at its URL plus \`.md\`, e.g. ${absolute(config, '/index.md')}.`,
  ]
  const plugins = config.plugins ?? []
  if (plugins.includes('llms')) lines.push(`- ${absolute(config, '/llms.txt')} lists every page; ${absolute(config, '/llms-full.txt')} has them all in one file.`)
  if (on(config, 'api')) lines.push(`- ${absolute(config, '/api/pages.json')} indexes the pages as JSON; ${absolute(config, '/openapi.json')} describes every JSON file.`)
  if (plugins.includes('search')) lines.push(`- ${absolute(config, '/search.json')} has the full text of every section, to search offline.`)
  lines.push('', '## Pages', '')
  const docs: PageMeta[] = []
  const layers = new Map<string, PageMeta['layout']>([['/', config.layout]])
  for (const l of config.layers) layers.set(l.path, l.layout)
  for (const [path, layout] of layers) docs.push(...(layout === 'blog' ? postsOf(pages, path) : flatten(docsNav(pages, path, folders))))
  const seen = new Set<string>()
  const shown = docs.filter((p) => !p.noindex && !seen.has(p.route) && seen.add(p.route))
  for (const p of shown.slice(0, 200)) lines.push(`- [${p.title}](${absolute(config, markdownPath(p.route))})${p.description ? `: ${p.description}` : ''}`)
  if (shown.length > 200) lines.push('', `More pages are listed in ${absolute(config, '/llms.txt')}.`)
  return `${lines.join('\n')}\n`
}

function digest(data: string | Uint8Array): string {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`
}

function skillsFolder(config: ResolvedConfig): string | null {
  const a = config.agents === false ? undefined : config.agents
  if (a?.skills === false) return null
  return join(config.root, a?.skills ?? 'skills')
}

/** Every file the agents plugin serves, by path under the output directory. */
export async function agentFiles(ctx: RoutesContext): Promise<{ files: Record<string, string | Uint8Array>; warnings: string[] }> {
  const { config, pages, folders } = ctx
  const files: Record<string, string | Uint8Array> = {}
  const warnings: string[] = []
  const pretty = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`
  const plugins = config.plugins ?? []

  if (on(config, 'api')) {
    const list = listed(pages)
    files['api/pages.json'] = pretty({ title: config.title, pages: list.map((p) => pageEntry(config, p, pages)) })
    for (const p of list) {
      files[pageJsonPath(p.route).slice(1)] = pretty({ ...pageEntry(config, p, pages), headings: p.headings ?? [], markdown: await ctx.markdown(p) })
    }
    files['api/navigation.json'] = pretty(navigationTree(config, pages, folders))
    files['openapi.json'] = pretty(openapi(config, plugins.includes('search')))
  }

  const folder = skillsFolder(config)
  const published = folder ? await readSkills(folder) : { skills: [], warnings: [] }
  warnings.push(...published.warnings)
  const index: { name: string; type: string; description: string; url: string; digest: string }[] = []
  for (const s of published.skills) {
    files[s.path] = s.data
    index.push({ name: s.name, type: s.type, description: s.description, url: absolute(config, `/${s.path}`), digest: digest(s.data) })
  }
  if (config.url && on(config, 'skill')) {
    const skill = await siteSkill(config, pages, folders)
    const name = skillName(config.title)
    files['skill.md'] = skill
    if (!index.some((s) => s.name === name)) {
      const path = `.well-known/agent-skills/${name}/SKILL.md`
      files[path] = skill
      const description = String(matter(skill).data.description ?? '')
      index.push({ name, type: 'skill-md', description, url: absolute(config, `/${path}`), digest: digest(skill) })
    }
  }
  if (index.length) files['.well-known/agent-skills/index.json'] = pretty({ $schema: SKILLS_SCHEMA, skills: index })

  if (config.url && on(config, 'discovery')) {
    const home = new URL(withBase(config.base, '/'), config.url)
    const publisher = home.hostname.toLowerCase().replace(/[^a-z0-9.-]/g, '-')
    const mount = home.pathname.replace(/\/$/, '')
    const namespace = `docs${mount ? `-${mount.slice(1).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` : ''}`
    const entries: Record<string, unknown>[] = []
    const add = (key: string, displayName: string, type: string, url: string, queries: [string, string]) =>
      entries.push({ identifier: `urn:air:${publisher}:${namespace}:${key}`, displayName, type, url, representativeQueries: queries })
    if (plugins.includes('llms')) add('index', `${config.title} documentation index`, 'text/plain', absolute(config, '/llms.txt'), [`Find the ${config.title} documentation`, `List topics covered by ${config.title}`])
    if (pages.some((p) => p.route === '/' && p.file)) add('home', `${config.title} overview`, 'text/markdown', absolute(config, '/index.md'), [`Get started with ${config.title}`, `Read an overview of ${config.title}`])
    if (on(config, 'api')) add('api', `${config.title} docs API`, 'application/vnd.oai.openapi+json', absolute(config, '/openapi.json'), [`List the pages of the ${config.title} docs`, `Fetch a ${config.title} page as JSON`])
    if (index.length) add('skills', `${config.title} agent skills`, 'application/json', absolute(config, '/.well-known/agent-skills/index.json'), [`Find agent skills published by ${config.title}`, `Install a skill for working with ${config.title}`])
    const manifest = pretty({ specVersion: '1.0', host: { displayName: config.title, identifier: home.href, documentationUrl: home.href }, entries })
    files['.well-known/ard.json'] = manifest
    files['.well-known/ai-catalog.json'] = manifest
    if (on(config, 'api')) {
      files['.well-known/api-catalog'] = pretty({
        linkset: [
          {
            anchor: absolute(config, '/api/'),
            'service-desc': [{ href: absolute(config, '/openapi.json'), type: 'application/json' }],
            'service-doc': [{ href: home.href, type: 'text/html' }],
          },
        ],
      })
    }
  }
  return { files, warnings }
}

/** `_headers` rules: media types for extension-less files, open CORS for discovery files, the home page's Link header. */
export function headerRules(config: ResolvedConfig, files: string[]): string {
  const path = (p: string) => withBase(config.base, `/${p}`)
  const out: string[] = []
  const has = (p: string) => files.includes(p)
  const links: string[] = []
  if (has('.well-known/ard.json')) links.push(`<${path('.well-known/ard.json')}>; rel="ard"; type="application/json"`)
  if (has('.well-known/api-catalog')) links.push(`<${path('.well-known/api-catalog')}>; rel="api-catalog"`)
  if (has('openapi.json')) links.push(`<${path('openapi.json')}>; rel="service-desc"; type="application/json"`)
  if ((config.plugins ?? []).includes('llms')) links.push(`<${path('llms.txt')}>; rel="describedby"; type="text/plain"`)
  if (links.length) out.push(withBase(config.base, '/'), `  Link: ${links.join(', ')}`)
  if (has('.well-known/api-catalog')) out.push(path('.well-known/api-catalog'), `  Content-Type: ${LINKSET}`, '  Access-Control-Allow-Origin: *')
  for (const f of ['.well-known/ard.json', '.well-known/ai-catalog.json', '.well-known/agent-skills/index.json']) if (has(f)) out.push(path(f), '  Access-Control-Allow-Origin: *')
  if (has('skill.md')) out.push(path('skill.md'), '  Content-Type: text/markdown; charset=utf-8')
  return out.join('\n')
}

function linkTag(rel: string, href: string, type?: string): HeadTag {
  return { tag: 'link', attrs: { rel, href, ...(type ? { type } : {}) } }
}

export const agents: NovonPlugin = {
  name: 'agents',
  head(page, { config }) {
    const tags: HeadTag[] = []
    const href = (p: string) => withBase(config.base, p)
    if (page?.file && (config.plugins ?? []).includes('llms')) {
      tags.push(linkTag('alternate', href(markdownPath(page.route)), 'text/markdown'), linkTag('describedby', href('/llms.txt'), 'text/plain'))
    }
    if (config.url && on(config, 'discovery')) {
      tags.push(linkTag('ard', href('/.well-known/ard.json'), 'application/json'))
      if (on(config, 'api')) tags.push(linkTag('api-catalog', href('/.well-known/api-catalog')))
    }
    return tags
  },
  async routes(ctx) {
    return (await agentFiles(ctx)).files
  },
  async buildEnd({ outDir, config }) {
    const folder = skillsFolder(config)
    if (folder) for (const w of (await readSkills(folder)).warnings) console.warn(`\x1b[33mwarning\x1b[0m  ${w}`)
    const known = ['.well-known/ard.json', '.well-known/ai-catalog.json', '.well-known/api-catalog', '.well-known/agent-skills/index.json', 'openapi.json', 'skill.md']
    const rules = headerRules(config, known.filter((f) => existsSync(join(outDir, f))))
    if (!rules) return
    const file = join(outDir, '_headers')
    const existing = existsSync(file) ? `${(await readFile(file, 'utf8')).trimEnd()}\n` : ''
    await Bun.write(file, `${existing}${rules}\n`)
  },
}
