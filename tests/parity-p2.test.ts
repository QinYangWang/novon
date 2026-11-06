import { afterAll, describe, expect, test } from 'bun:test'
// Local test servers are reached directly, never through a proxy.
process.env.NO_PROXY = '127.0.0.1,localhost'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../src/node/load-config.ts'
import { build } from '../src/node/build.ts'
import { check } from '../src/node/check.ts'
import { scanSite } from '../src/node/content.ts'
import { freezeVersion, addVersionToConfig, rewriteImports } from '../src/node/version.ts'
import { releasesPage, syncAll } from '../src/node/sources.ts'
import { exampleOf, operations, parseSpec, schemaRows, typeName } from '../src/node/openapi.ts'
import { addComponentsToConfig, addItems, exportedComponents, placement } from '../src/node/add.ts'
import { audit } from '../src/node/audit.ts'
import { changelogEntries } from '../src/node/changelog.ts'
import { resolveConfig } from '../src/config.ts'
import { sourceName } from '../src/node/mounts.ts'
import { buildRoute, counterpart, splitReleaseHeading } from '../src/shared.ts'
import { localizeHref, localizeSite, searchIndexPath } from '../src/runtime/i18n.tsx'
import { feedbackHref, showsFeedback } from '../src/runtime/feedback.tsx'
import { siteData } from '../src/node/vite.ts'
import { labelsFor } from '../src/labels.ts'

const SPEC = `openapi: 3.1.0
info: { title: Pets, version: 1.0.0 }
servers: [{ url: https://api.pets.dev }]
security: [{ token: [] }]
tags: [{ name: Pets }]
paths:
  /pets/{id}:
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, example: p1 } }
    get:
      operationId: getPet
      summary: Get a pet
      tags: [Pets]
      responses:
        '200':
          description: The pet.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Pet' }
  /pets:
    post:
      operationId: createPet
      summary: Create a pet
      tags: [Pets]
      requestBody:
        content:
          application/json:
            schema: { $ref: '#/components/schemas/Pet' }
      responses: { '201': { description: Created } }
components:
  securitySchemes: { token: { type: http, scheme: bearer } }
  schemas:
    Pet:
      type: object
      required: [name]
      properties:
        name: { type: string, description: 'The name, e.g. \`Rex\` or {braces}.' }
        kind: { type: string, enum: [cat, dog] }
        owner: { type: object, properties: { email: { type: string, format: email } } }
`

const git = (cwd: string, ...args: string[]) => Bun.spawnSync(['git', '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd })

describe('a P2 site: locales, versions, sources, API reference, changelog', async () => {
  const root = await mkdtemp(join(tmpdir(), 'novon-p2-'))
  const repo = await mkdtemp(join(tmpdir(), 'novon-p2-repo-'))
  await mkdir(join(repo, 'docs'), { recursive: true })
  await writeFile(join(repo, 'docs/index.md'), '---\ntitle: SDK\n---\n\n## Install\n\nnpm i sdk\n')
  await writeFile(join(repo, 'other.md'), '# not mounted\n')
  git(repo, 'init', '-q')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-qm', 'init')
  const server = Bun.serve({ port: 0, fetch: (req) => (new URL(req.url).pathname === '/remote.mdx' ? new Response('---\ntitle: Remote page\n---\n\nFrom far away.\n') : new Response('no', { status: 404 })) })
  afterAll(() => server.stop(true))
  const files: Record<string, string> = {
    'novon.config.ts': `export default {
  title: 'Demo',
  url: 'https://demo.dev',
  og: false,
  layers: [{ path: '/blog', layout: 'blog' }],
  nav: [{ label: 'Guide', href: '/guide' }],
  i18n: { locales: { en: 'English', ja: { label: '日本語', title: 'デモ', description: 'デモのサイト' } } },
  openapi: { spec: 'api.yaml', path: '/api' },
  sources: [
    { type: 'git', repo: ${JSON.stringify(repo)}, dir: 'docs', path: '/sdk' },
    { type: 'files', path: '/remote', files: { index: 'http://127.0.0.1:${server.port}/remote.mdx' } },
  ],
  feedback: { href: 'https://github.com/a/b/issues/new?title={title}&body={message}' },
}
`,
    'api.yaml': SPEC,
    'content/_partials/ver.mdx': 'Version {{v}}.',
    'content/index.mdx': '---\ntitle: Home\ndescription: The demo home page, in English, for every reader.\n---\n\nSee the [guide](/guide).\n',
    'content/guide/index.mdx': '---\ntitle: Guide\ndescription: How to use the demo.\n---\n\n## Install\n\n<Partial file="ver" v="1" />\n',
    'content/guide/writing.mdx': '---\ntitle: Writing\n---\n\n## Write\n\nText.\n',
    'content/ja/index.mdx': '---\ntitle: ホーム\n---\n\n[ガイド](/guide)\n',
    'content/ja/guide/index.mdx': '---\ntitle: ガイド\n---\n\n## インストール\n\n本文。\n',
    'content/blog/hello.mdx': '---\ntitle: Hello\ndate: 2026-01-02\n---\n\nA post.\n',
    'content/changelog.mdx': '---\ntitle: Changelog\nlayout: changelog\n---\n\n## 1.1.0 (2026-11-01)\n\n- New things.\n\n## 1.0.0 (2026-10-01)\n\nFirst.\n',
  }
  for (const [file, text] of Object.entries(files)) {
    await mkdir(join(root, file, '..'), { recursive: true })
    await writeFile(join(root, file), text)
  }
  // Freeze the docs as v1, then change the current docs.
  const frozen = await freezeVersion(await loadConfig(root), 'v1')
  await writeFile(join(root, 'content/guide/index.mdx'), '---\ntitle: Guide\ndescription: How to use the demo.\n---\n\n## Install\n\n<Partial file="ver" v="2" />\n')
  // The config module is cached in this process: load the edited file fresh.
  const edited = (await import(`${join(root, 'novon.config.ts')}?after-version`)) as { default: Parameters<typeof resolveConfig>[0] }
  const config = resolveConfig(edited.default, root)
  const result = await build(config, { quiet: true })
  const dist = join(root, 'dist')
  const read = (p: string) => readFile(join(dist, p), 'utf8')
  const { pages } = await scanSite(config)

  test('novon version froze the docs, wrote out partials and registered the version', async () => {
    expect(frozen.dir).toBe('content/_versions/v1')
    expect(frozen.configUpdated).toBe(true)
    expect(await readFile(join(root, 'novon.config.ts'), 'utf8')).toContain("versions: { list: ['v1'] }")
    expect(await readFile(join(root, 'content/_versions/v1/guide/index.mdx'), 'utf8')).toContain('Version 1.')
    // The blog is not a docs layer: not versioned.
    expect(existsSync(join(root, 'content/_versions/v1/blog'))).toBe(false)
    expect(await read('v1/guide/index.html')).toContain('Version 1.')
    expect(await read('guide/index.html')).toContain('Version 2.')
  })

  test('locale routes, translated pages and flagged fallbacks', async () => {
    expect(await read('ja/guide/index.html')).toContain('<html lang="ja"')
    const fallback = pages.find((p) => p.route === '/ja/guide/writing')!
    expect(fallback.fallback).toBe(true)
    expect(fallback.file).toBe('content/guide/writing.mdx')
    const html = await read('ja/guide/writing/index.html')
    expect(html).toContain('<link rel="canonical" href="https://demo.dev/guide/writing">')
    expect(html).toContain('data-novon-fallback')
    expect(existsSync(join(dist, 'ja/blog/index.html'))).toBe(true)
    expect(existsSync(join(dist, 'ja/v1/guide/index.html'))).toBe(true)
  })

  test('hreflang, per-locale sitemap, search, llms and feeds', async () => {
    const html = await read('ja/guide/index.html')
    expect(html).toContain('<link rel="alternate" hreflang="en" href="https://demo.dev/guide">')
    expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://demo.dev/guide">')
    expect(await read('sitemap.xml')).toContain('<sitemapindex')
    const ja = await read('sitemap-ja.xml')
    expect(ja).toContain('https://demo.dev/ja/guide<')
    expect(ja).not.toContain('/ja/guide/writing<')
    expect(ja).not.toContain('/v1/')
    const search = JSON.parse(await read('ja/search.json')) as { route: string }[]
    expect(search.every((e) => e.route.startsWith('/ja'))).toBe(true)
    expect(search.some((e) => e.route === '/ja/guide/writing')).toBe(false)
    expect((JSON.parse(await read('v1/search.json')) as { route: string }[]).every((e) => e.route.startsWith('/v1'))).toBe(true)
    expect((JSON.parse(await read('search.json')) as { route: string }[]).some((e) => e.route.startsWith('/v1') || e.route.startsWith('/ja'))).toBe(false)
    const llms = await read('ja/llms.txt')
    expect(llms).toStartWith('# デモ')
    expect(llms).toContain('/ja/guide.md')
    expect(await read('llms.txt')).toContain('Other languages: 日本語')
    expect(await read('rss.xml')).toContain('/blog/hello')
  })

  test('older versions point canonical at the current page', async () => {
    expect(await read('v1/guide/index.html')).toContain('<link rel="canonical" href="https://demo.dev/guide">')
  })

  test('git and file sources are mounted, cached and checked for syntax only', async () => {
    expect(await read('sdk/index.html')).toContain('npm i sdk')
    expect(existsSync(join(dist, 'sdk/other/index.html'))).toBe(false)
    expect(await read('remote/index.html')).toContain('From far away.')
    expect(existsSync(join(root, '.novon/sources', sourceName(config.sources![0]), '.novon-source.json'))).toBe(true)
    const results = await syncAll(config)
    expect(results.every((r) => r.ok)).toBe(true)
    expect(await check(config)).toEqual([])
  })

  test('OpenAPI pages: one per operation, grouped by tag, in .md and search', async () => {
    const html = await read('api/get-pet/index.html')
    expect(html).toContain('data-novon="api-endpoint"')
    expect(html).toContain('/pets/{id}')
    const md = await read('api/create-pet.md')
    expect(md).toContain('`POST /pets` · `https://api.pets.dev`')
    expect(md).toContain('| `name` (required) | `string`')
    expect(md).toContain('`owner.email`')
    expect(md).toContain('```sh title="curl"')
    expect(md).toContain('Authorization: Bearer $TOKEN')
    expect(await read('api.md')).toContain('Get a pet')
    const search = JSON.parse(await read('search.json')) as { route: string }[]
    expect(search.some((e) => e.route === '/api/create-pet')).toBe(true)
    const nav = pages.find((p) => p.route === '/api/get-pet')!
    expect(nav.badge).toBe('GET')
  })

  test('changelog pages render a timeline and get a feed', async () => {
    const html = await read('changelog/index.html')
    expect(html).toContain('data-slot="timeline"')
    expect(html).toContain('id="110-2026-11-01"')
    const feed = await read('changelog/rss.xml')
    expect(feed).toContain('<title>1.1.0</title>')
    expect(feed).toContain('https://demo.dev/changelog#110-2026-11-01')
  })

  test('feedback widget shows on docs pages', async () => {
    expect(await read('guide/index.html')).toContain('data-novon-feedback')
    expect(await read('blog/hello/index.html')).not.toContain('data-novon-feedback')
  })

  test('audit reports problems in the built site', async () => {
    await writeFile(join(dist, 'bad.html'), '<html><head><title>Guide · Demo</title></head><body><h2>x</h2><h4>y</h4><img src="/a.png"><a href="/missing">m</a></body></html>')
    const issues = await audit(config, { pages })
    const rules = (route: string) => issues.filter((i) => i.page === route).map((i) => i.rule)
    expect(rules('/bad')).toEqual(expect.arrayContaining(['description', 'lang', 'headings', 'alt', 'link', 'sitemap', 'canonical']))
    expect(issues.some((i) => i.page === '/guide' && i.rule === 'duplicate-title')).toBe(true)
    expect(issues.some((i) => i.page === '/ja/guide/writing')).toBe(false)
    expect(result.pages).toBeGreaterThan(15)
  })
})

describe('routing helpers', () => {
  const config = resolveConfig({ title: 'T', layers: [{ path: '/docs', layout: 'docs' }, { path: '/blog', layout: 'blog' }], layout: 'blog', i18n: { locales: { en: 'English', ja: '日本語' } }, versions: { list: ['v1'] } }, '/x')

  test('locales prefix routes; versions follow the docs layer', () => {
    expect(buildRoute(config, '/docs/guide', 'ja', 'v1')).toBe('/ja/docs/v1/guide')
    expect(buildRoute(config, '/docs', undefined, 'v1')).toBe('/docs/v1')
    expect(buildRoute(config, '/blog/x', 'en')).toBe('/blog/x')
    expect(config.layers.map((l) => l.path)).toEqual(expect.arrayContaining(['/ja', '/ja/blog', '/ja/docs', '/docs/v1', '/ja/docs/v1']))
  })

  test('counterpart finds the same page or the nearest ancestor', () => {
    const p = (route: string, key: string, locale: string, version?: string) => ({ route, key, locale, version, file: 'x', title: '', label: '', order: 0, tags: [], hidden: false, layer: '/', layout: 'docs' as const, kind: 'page' as const })
    const pages = [p('/docs/a', '/docs/a', 'en'), p('/ja/docs/a', '/docs/a', 'ja'), p('/docs', '/docs', 'en'), p('/ja/docs', '/docs', 'ja'), p('/docs/b', '/docs/b', 'en')]
    expect(counterpart(pages, config, pages[0], { locale: 'ja' })).toBe('/ja/docs/a')
    expect(counterpart(pages, config, pages[4], { locale: 'ja' })).toBe('/ja/docs')
  })

  test('the runtime localizes the site and links', () => {
    const page = (route: string, extra = {}) => ({ route, key: route.replace(/^\/ja/, '') || '/', locale: route.startsWith('/ja') ? 'ja' : 'en', file: 'x', title: '', label: '', order: 0, tags: [], hidden: false, layer: '/', layout: 'docs' as const, kind: 'page' as const, ...extra })
    const pages = [page('/'), page('/ja'), page('/docs/a'), page('/ja/docs/a'), page('/docs/b')]
    const site = siteData({ ...config, nav: [{ label: 'A', href: '/docs/a' }] }, pages)
    const ja = localizeSite(site, pages[1], '/ja')
    expect(ja.lang).toBe('ja')
    expect(ja.nav[0].href).toBe('/ja/docs/a')
    expect(localizeHref(site, { locale: 'ja' }, '/docs/b')).toBe('/docs/b')
    expect(localizeHref(site, { locale: 'ja' }, '/docs/a#x')).toBe('/ja/docs/a#x')
    expect(searchIndexPath(site, pages[3], '/ja/docs/a')).toBe('/ja/search.json')
  })

  test('a single-language site is unchanged', () => {
    const plain = resolveConfig({ title: 'T', lang: 'zh-CN' }, '/x')
    expect(plain.i18n).toBeUndefined()
    expect(plain.lang).toBe('zh-CN')
    expect(plain.layers).toEqual([])
  })
})

describe('P2 units', () => {
  test('version config edits and import rewriting', () => {
    expect(addVersionToConfig("export default defineConfig({\n  title: 'x',\n})", 'v2')).toContain("versions: { list: ['v2'] },")
    expect(addVersionToConfig("export default { versions: { latest: '3', list: ['v1'] } }", 'v2')).toContain("list: ['v2', 'v1']")
    expect(rewriteImports("import X from '../components/x.tsx'", '/s/content/guide', '/s/content/_versions/v1/guide')).toBe("import X from '../../../components/x.tsx'")
  })

  test('release headings and the releases page', () => {
    expect(splitReleaseHeading('1.2.0 (2026-11-01)')).toEqual({ title: '1.2.0', date: '2026-11-01' })
    expect(splitReleaseHeading('v2 · 2026-01-05')).toEqual({ title: 'v2', date: '2026-01-05' })
    expect(splitReleaseHeading('Next')).toEqual({ title: 'Next' })
    const md = releasesPage({ repo: 'a/b' }, [{ tag_name: 'v1.0.0', name: 'One', body: '# Notes\n\n- x', html_url: 'https://github.com/a/b/releases/v1.0.0', published_at: '2026-02-03T00:00:00Z', created_at: '', prerelease: false, draft: false }])
    expect(md).toContain('layout: changelog')
    expect(md).toContain('## One (2026-02-03)')
    expect(md).toContain('### Notes')
    expect(changelogEntries(md, false)[0]).toMatchObject({ title: 'One', date: '2026-02-03' })
  })

  test('OpenAPI schemas: types, rows, examples', () => {
    const doc = parseSpec(SPEC)
    const pet = doc.components.schemas.Pet
    expect(typeName(doc, { $ref: '#/components/schemas/Pet' })).toBe('Pet')
    expect(typeName(doc, { type: 'array', items: { $ref: '#/components/schemas/Pet' } })).toBe('Pet[]')
    expect(typeName(doc, { type: ['string', 'null'], format: 'date' })).toBe('string<date> | null')
    expect(schemaRows(doc, pet).map((r) => r.name)).toEqual(['name', 'kind', 'owner', 'owner.email'])
    expect(exampleOf(doc, pet)).toEqual({ name: 'string', kind: 'cat', owner: { email: 'user@example.com' } })
    expect(operations(doc, 'Endpoints').map((o) => o.slug)).toEqual(['get-pet', 'create-pet'])
  })

  test('add: placement, exports and config registration', () => {
    expect(placement({ path: 'registry/web/ui/timeline.tsx', type: 'registry:ui' })).toMatchObject({ alias: '@/ui/timeline', site: 'components/ui/timeline.tsx' })
    expect(placement({ path: 'x/blocks/f/feedback-widget.tsx', type: 'registry:block' }).site).toBe('components/feedback-widget.tsx')
    expect(exportedComponents('export function Foo() {}\nexport { Bar, Baz as Qux, type T, helper }')).toEqual(['Foo', 'Bar', 'Qux'])
    expect(addComponentsToConfig("export default { title: 'x' }", { Foo: './components/ui/foo.tsx#Foo' })).toContain("components: {\n    Foo: './components/ui/foo.tsx#Foo',")
    expect(addComponentsToConfig("export default { components: { A: './a.tsx' } }", { Foo: './f.tsx#Foo' })).toContain("Foo: './f.tsx#Foo',")
  })

  test('add installs from a registry and registers named exports', async () => {
    const root = await mkdtemp(join(tmpdir(), 'novon-add-'))
    await writeFile(join(root, 'novon.config.ts'), "export default {\n  title: 'x',\n}\n")
    await mkdir(join(root, 'content'))
    const items: Record<string, unknown> = {
      fancy: { name: 'fancy', type: 'registry:ui', registryDependencies: ['helper', 'button', 'theme'], files: [{ path: 'r/ui/fancy.tsx', type: 'registry:ui', content: 'import { help } from "@/lib/fancy-help"\nimport { Button } from "@/ui/button"\nexport function Fancy() { return null }\n' }] },
      helper: { name: 'helper', type: 'registry:lib', files: [{ path: 'r/lib/fancy-help.ts', type: 'registry:lib', content: 'export const help = 1\n' }] },
      button: { name: 'button', type: 'registry:ui', files: [{ path: 'r/ui/button.tsx', type: 'registry:ui', content: 'export function Button() {}' }] },
      theme: { name: 'theme', type: 'registry:theme', files: [] },
    }
    const server = Bun.serve({ port: 0, fetch: (req) => Response.json(items[new URL(req.url).pathname.slice(1).replace('.json', '')]) })
    process.env.NOVON_REGISTRY = `http://127.0.0.1:${server.port}/{name}.json`
    try {
      const r = await addItems(await loadConfig(root), ['@paneui/fancy'])
      expect(r.installed.sort()).toEqual(['components/lib/fancy-help.ts', 'components/ui/fancy.tsx'])
      expect(r.shared).toContain('@/ui/button')
      expect(await readFile(join(root, 'components/ui/fancy.tsx'), 'utf8')).toContain('from "../lib/fancy-help"')
      expect(await readFile(join(root, 'novon.config.ts'), 'utf8')).toContain("Fancy: './components/ui/fancy.tsx#Fancy',")
    } finally {
      delete process.env.NOVON_REGISTRY
      server.stop(true)
    }
  })

  test('feedback links and where the widget shows', () => {
    expect(feedbackHref('https://x/new?title={title}&body={message}', { title: 'A & B', message: 'hi there' })).toBe('https://x/new?title=A%20%26%20B&body=hi%20there')
    const page = { route: '/a', file: 'x', title: '', label: '', order: 0, tags: [], hidden: false, layer: '/', layout: 'docs' as const, kind: 'page' as const }
    expect(showsFeedback({}, page)).toBe(true)
    expect(showsFeedback({ on: 'blog' }, page)).toBe(false)
    expect(showsFeedback({}, { ...page, feedback: false })).toBe(false)
  })

  test('ja labels are complete', () => {
    const ja = labelsFor('ja-JP')
    expect(ja.language).toBe('言語')
    expect(Object.keys(ja).sort()).toEqual(Object.keys(labelsFor('en')).sort())
  })
})
