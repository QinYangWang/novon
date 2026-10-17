import { describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../src/node/load-config.ts'
import { resolveConfig } from '../src/config.ts'
import { build } from '../src/node/build.ts'
import { scanContent } from '../src/node/content.ts'
import { cardProps, ogFile, ogRenderer } from '../src/node/og.ts'
import { OG_IMAGE_TOKENS } from '@/components/og-image'

/** Width and height from a PNG's IHDR chunk. */
function pngSize(png: Uint8Array): [number, number] {
  const v = new DataView(png.buffer, png.byteOffset)
  expect([...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG')
  return [v.getUint32(16), v.getUint32(20)]
}

describe('social cards', async () => {
  const dir = join(await mkdtemp(join(tmpdir(), 'novon-og-')), 'site')
  await mkdir(join(dir, 'content'), { recursive: true })
  await mkdir(join(dir, 'public'), { recursive: true })
  // A committed subset of Noto Sans SC keeps the test offline.
  await copyFile(join(import.meta.dir, 'fixtures/noto-sans-sc-subset.ttf'), join(dir, 'font.ttf'))
  await writeFile(
    join(dir, 'novon.config.ts'),
    `export default { title: '中文博客', url: 'https://example.com', layout: 'blog', lang: 'zh-CN', og: { font: './font.ttf' } }\n`,
  )
  const post = (name: string, fm: string) => writeFile(join(dir, 'content', `${name}.mdx`), `---\n${fm}\ndate: 2026-01-02\n---\n\nbody\n`)
  await post('hello', 'title: 你好世界\ndescription: 中文标题测试\ntags: [笔记]')
  await post('missing', 'title: 丂丂丂丂')
  await post('custom', 'title: Custom\nimage: /share.png')
  await post('remote', 'title: Remote\nimage: https://cdn.example.com/a.png')
  await post('off', 'title: Off\nog: false')
  const config = await loadConfig(dir)
  await build(config)
  const html = (route: string) => readFile(join(dir, 'dist', route, 'index.html'), 'utf8')

  test('every page gets a 1200×630 PNG', async () => {
    for (const route of ['/', '/hello', '/tags/笔记']) {
      const file = join(dir, 'dist', ogFile(route))
      expect(existsSync(file)).toBe(true)
      expect(pngSize(await readFile(file))).toEqual([1200, 630])
    }
  })
  test('meta tags point at the card with an absolute URL', async () => {
    const h = await html('hello')
    expect(h).toContain('<meta property="og:image" content="https://example.com/og/hello.png">')
    expect(h).toContain('<meta property="og:image:width" content="1200">')
    expect(h).toContain('<meta property="og:image:height" content="630">')
    expect(h).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(h).toContain('<meta name="twitter:title" content="你好世界">')
    expect(h).toContain('<meta name="twitter:description" content="中文标题测试">')
    expect(h).toContain('<meta name="twitter:image" content="https://example.com/og/hello.png">')
  })
  test('frontmatter image replaces the card; og: false removes it', async () => {
    expect(await html('custom')).toContain('<meta property="og:image" content="https://example.com/share.png">')
    expect(await html('remote')).toContain('<meta property="og:image" content="https://cdn.example.com/a.png">')
    expect(existsSync(join(dir, 'dist', ogFile('/custom')))).toBe(false)
    const off = await html('off')
    expect(off).not.toContain('og:image')
    expect(off).toContain('<meta name="twitter:card" content="summary">')
    expect(existsSync(join(dir, 'dist', ogFile('/off')))).toBe(false)
  })
  test('CJK titles render as glyphs, not tofu', async () => {
    const renderer = await ogRenderer(config)
    const pages = await scanContent(config)
    const svg = async (route: string) => renderer.svg(pages.find((p) => p.route === route)!)
    // Same card, same length: one title is in the font, the other is not.
    const [real, tofu] = [await svg('/hello'), await svg('/missing')]
    expect(real).not.toBe(tofu)
    expect(real.length).toBeGreaterThan(tofu.length + 1000)
  })
  test('og: false in the config turns cards off', async () => {
    await build(resolveConfig({ title: 'x', layout: 'blog', og: false }, dir))
    expect(existsSync(join(dir, 'dist/og'))).toBe(false)
    expect(await readFile(join(dir, 'dist/hello/index.html'), 'utf8')).not.toContain('og:image')
  })
  test('the card uses the theme accent and the og font', async () => {
    const pages = await scanContent(config)
    const props = cardProps(config, pages.find((p) => p.route === '/hello')!)
    expect(props).toMatchObject({ title: '你好世界', accent: 'blue', mode: 'light', fontFamily: 'og', tags: ['笔记'] })
    const svg = await (await ogRenderer(config)).svg(pages.find((p) => p.route === '/hello')!)
    expect(svg).toContain(OG_IMAGE_TOKENS.blue.light.primary)
  })
  test('long titles render (clamped)', async () => {
    const pages = await scanContent(config)
    const long = { ...pages.find((p) => p.route === '/hello')!, title: '你好世界'.repeat(40) }
    const [short, clamped] = [await (await ogRenderer(config)).svg(pages.find((p) => p.route === '/hello')!), await (await ogRenderer(config)).svg(long)]
    expect(clamped.length).toBeGreaterThan(short.length)
  })
})
