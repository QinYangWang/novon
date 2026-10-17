import { describe, expect, test } from 'bun:test'
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../src/node/load-config.ts'
import { build } from '../src/node/build.ts'
import { preview } from '../src/node/preview.ts'
import { fill, labelsFor } from '../src/labels.ts'
import { tagRoute } from '../src/shared.ts'

describe('labels', () => {
  test('lang picks the set; Chinese variants fall back to zh-CN', () => {
    expect(labelsFor('en').onThisPage).toBe('On this page')
    for (const lang of ['zh-CN', 'zh', 'zh-Hans', 'zh-TW', 'ZH-cn']) expect(labelsFor(lang).onThisPage).toBe('本页目录')
    expect(labelsFor('fr').onThisPage).toBe('On this page')
  })
  test('theme.labels replaces single strings', () => {
    const t = labelsFor('zh-CN', { onThisPage: '目录' })
    expect(t.onThisPage).toBe('目录')
    expect(t.keepReading).toBe('继续阅读')
    expect(fill(t.minRead, { n: 3 })).toBe('3 分钟阅读')
  })
})

describe('tag routes', () => {
  test('default: /tags, lowercase', () => expect(tagRoute('/', 'Docker')).toBe('/tags/docker'))
  test('custom path, case kept', () => {
    expect(tagRoute('/', 'Docker', { path: '/tag', lowercase: false })).toBe('/tag/Docker')
    expect(tagRoute('/blog', 'Big Ideas', { path: 'topics' })).toBe('/blog/topics/big-ideas')
  })
})

describe('zh-CN blog with flat files, a custom feed and tag paths', async () => {
  const dir = join(await mkdtemp(join(tmpdir(), 'novon-opts-')), 'site')
  await mkdir(join(dir, 'content'), { recursive: true })
  await copyFile(join(import.meta.dir, 'fixtures/noto-sans-sc-subset.ttf'), join(dir, 'font.ttf'))
  await writeFile(
    join(dir, 'novon.config.ts'),
    `export default {
  title: '博客', url: 'https://example.com', layout: 'blog', lang: 'zh-CN',
  trailingSlash: false,
  rss: { path: '/feed', full: true },
  tags: { path: '/tag', lowercase: false },
  og: { font: './font.ttf' },
  theme: { labels: { keepReading: '再读一篇' } },
}\n`,
  )
  const post = (name: string, title: string, date: string) =>
    writeFile(join(dir, 'content', `${name}.mdx`), `---\ntitle: ${title}\ndate: ${date}\ntags: [Docker]\n---\n\n## 一\n\n正文 [链接](/about) ![图](/a.png)\n\n## 二\n\n更多\n`)
  await post('first', '你好', '2026-01-02')
  await post('second', '世界', '2026-01-03')
  await writeFile(join(dir, 'content/about.mdx'), '---\ntitle: 关于\n---\n\n关于本站\n')
  await build(await loadConfig(dir))
  const read = (f: string) => readFile(join(dir, 'dist', f), 'utf8')

  test('trailingSlash: false writes x.html', () => {
    for (const f of ['index.html', 'first.html', 'about.html', 'tag/Docker.html']) expect(existsSync(join(dir, 'dist', f))).toBe(true)
    expect(existsSync(join(dir, 'dist/first/index.html'))).toBe(false)
  })
  test('preview serves /x and /x/ from x.html', async () => {
    const server = preview(await loadConfig(dir), 0)
    try {
      for (const path of ['/first', '/first/', '/tag/Docker']) {
        // Straight to the handler: no network or proxy in the way.
        const res = await server.fetch(new Request(new URL(path, server.url)))
        expect(res.status).toBe(200)
        expect(await res.text()).toContain('<html')
      }
    } finally {
      server.stop(true)
    }
  })
  test('links, canonical and sitemap have no trailing slash', async () => {
    const html = await read('first.html')
    expect(html).toContain('<link rel="canonical" href="https://example.com/first">')
    expect(await read('sitemap.xml')).toContain('<loc>https://example.com/first</loc>')
    expect(html).toContain('href="/tag/Docker"')
  })
  test('the feed lives at rss.path with full content', async () => {
    expect(existsSync(join(dir, 'dist/rss.xml'))).toBe(false)
    const feed = await read('feed')
    expect(feed).toContain('xmlns:content=')
    expect(feed).toContain('<content:encoded><![CDATA[<h2 id="一">一</h2>')
    expect(feed).toContain('href="https://example.com/about"')
    expect(feed).toContain('src="https://example.com/a.png"')
    expect(feed).toContain('<language>zh-CN</language>')
    expect(await read('first.html')).toContain('<link rel="alternate" type="application/rss+xml" title="博客" href="/feed">')
  })
  test('built-in strings follow lang; theme.labels wins', async () => {
    const html = await read('first.html')
    expect(html).toContain('本页目录')
    expect(html).toContain('分钟阅读')
    expect(html).toContain('再读一篇')
    expect(html).not.toContain('Keep reading')
    expect(html).toContain('2026年1月2日')
    expect(await read('index.html')).toContain('全部文章')
  })
})
