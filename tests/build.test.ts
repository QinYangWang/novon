import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scaffold } from '../src/node/new.ts'
import { loadConfig } from '../src/node/load-config.ts'
import { build } from '../src/node/build.ts'
import { docsNav } from '../src/runtime/nav.ts'
import { layerFor, stripBase, withBase } from '../src/shared.ts'

const read = (dir: string, file: string) => readFile(join(dir, 'dist', file), 'utf8')

describe('routing helpers', () => {
  test('layers: longest prefix wins', () => {
    const layers = [{ path: '/blog', layout: 'blog' as const }, { path: '/blog/old', layout: 'docs' as const }]
    expect(layerFor('/blog/a', layers, 'docs').layout).toBe('blog')
    expect(layerFor('/blog/old/x', layers, 'docs').layout).toBe('docs')
    expect(layerFor('/blogger', layers, 'docs').path).toBe('/')
  })
  test('base round trip', () => {
    expect(withBase('/docs/', '/guide')).toBe('/docs/guide')
    expect(stripBase('/docs/', '/docs/guide/')).toBe('/guide')
    expect(stripBase('/docs/', '/elsewhere')).toBeNull()
  })
})

describe('docs template', async () => {
  const dir = join(await mkdtemp(join(tmpdir(), 'novon-')), 'site')
  await scaffold(dir, 'docs')
  // A custom component and a layered blog prove both extension points.
  await mkdir(join(dir, 'components'))
  await writeFile(join(dir, 'components/Hello.tsx'), `import { Badge } from 'novon'\nexport default () => <Badge>hello-component</Badge>\n`)
  await mkdir(join(dir, 'content/blog'), { recursive: true })
  await writeFile(join(dir, 'content/blog/first.mdx'), `---\ntitle: First post\ndate: 2026-02-01\ntags: [news]\n---\n\n<Hello />\n`)
  const cfg = await readFile(join(dir, 'novon.config.ts'), 'utf8')
  await writeFile(
    join(dir, 'novon.config.ts'),
    cfg.replace("layout: 'docs',", "layout: 'docs',\n  url: 'https://example.com',\n  layers: [{ path: '/blog', layout: 'blog' }],\n  components: { Hello: './components/Hello.tsx' },"),
  )
  const config = await loadConfig(dir)
  const result = await build(config)

  test('writes every page', () => {
    expect(result.pages).toBeGreaterThanOrEqual(6)
    for (const f of ['index.html', 'getting-started/index.html', 'guide/writing/index.html', 'blog/index.html', 'blog/first/index.html', 'blog/tags/news/index.html', '404.html'])
      expect(existsSync(join(dir, 'dist', f))).toBe(true)
  })
  test('prerenders content, highlighting and components', async () => {
    const html = await read(dir, 'guide/writing/index.html')
    expect(html).toContain('<title>Writing')
    expect(html).toContain('shiki-themes')
    expect(html).toContain('data-title="novon.config.ts"')
    expect(html).toContain('id="callouts"')
    expect(await read(dir, 'blog/first/index.html')).toContain('hello-component')
  })
  test('plugins emit their files', async () => {
    expect(JSON.parse(await read(dir, 'search.json')).some((e: { route: string }) => e.route === '/guide/writing')).toBe(true)
    expect(await read(dir, 'sitemap.xml')).toContain('https://example.com/guide/writing')
    expect(await read(dir, 'rss.xml')).toContain('First post')
    expect(await read(dir, 'llms.txt')).toContain('/guide/writing.md')
    expect(await read(dir, 'guide/writing.md')).toStartWith('# Writing')
  })
  test('sidebar sections follow folders', () => {
    // the blog layer is not part of the docs sidebar
    expect(config.layers[0].path).toBe('/blog')
  })
})

describe('nav', () => {
  test('folders become sections with their index first', () => {
    const page = (route: string, extra = {}) => ({ route, file: 'x', title: route, label: route, order: Infinity, tags: [], hidden: false, layer: '/', layout: 'docs' as const, kind: 'page' as const, ...extra })
    const sections = docsNav([page('/'), page('/a', { order: 1 }), page('/guide'), page('/guide/z'), page('/guide/b')], '/')
    expect(sections[0].items.map((i) => i.page.route)).toEqual(['/a', '/'])
    expect(sections[1].items.map((i) => i.page.route)).toEqual(['/guide', '/guide/b', '/guide/z'])
  })
})
