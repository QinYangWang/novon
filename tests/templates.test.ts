import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { buildDemo } from '../scripts/build-templates.ts'
import { readingTime } from '../src/node/content.ts'

describe('blog template', async () => {
  const dist = await buildDemo('blog', '/demo/blog/', 'https://example.com')
  const read = (file: string) => readFile(join(dist, file), 'utf8')

  test('writes posts, tag pages, about and feed', () => {
    for (const f of ['index.html', 'about/index.html', 'posts/plain-text/index.html', 'tags/writing/index.html', 'rss.xml', 'covers/small-web.svg'])
      expect(existsSync(join(dist, f))).toBe(true)
  })
  test('home lists every post under its year', async () => {
    const html = await read('index.html')
    expect(html).toContain('Mira Chen')
    // One row per post, newest first, with the year in a gutter and the date in mono.
    expect(html).toContain('id="year-2026"')
    expect(html.indexOf('Writing in plain text')).toBeLessThan(html.indexOf('Reading list: summer'))
    expect(html).toContain('10/02')
    // The blog is text only: no cover art, cards or reading time.
    expect(html).not.toContain('data-slot="cover-art"')
    expect(html).not.toContain('min read')
  })
  test('a post ends with the pager instead of an author card, outline or related posts', async () => {
    const html = await read('posts/plain-text/index.html')
    expect(html).toContain('All posts')
    expect(html).toContain('5 posts')
    expect(html).toContain('Next')
    expect(html).not.toContain('About the author')
    expect(html).not.toContain('On this page')
    expect(html).not.toContain('Keep reading')
  })
  test('covers are frontmatter only, never rendered', async () => {
    // `cover:` still sets the share image and the feed, but the layout shows no picture.
    const html = await read('posts/small-websites/index.html')
    expect(html).not.toContain('data-slot="cover-art"')
    expect(html).not.toContain('covers/small-web.svg')
  })
  test('root-relative file links keep the base', async () => {
    expect(await read('about/index.html')).toContain('href="/demo/blog/rss.xml"')
  })
})

describe('docs template', async () => {
  const dist = await buildDemo('docs', '/demo/docs/')
  test('every guide and reference page is built under its base', async () => {
    for (const f of ['getting-started', 'guide/writing', 'guide/configuration', 'guide/deploying', 'reference/cli', 'reference/output'])
      expect(existsSync(join(dist, f, 'index.html'))).toBe(true)
    const html = await readFile(join(dist, 'guide/writing/index.html'), 'utf8')
    expect(html).toContain('data-slot="sidebar-nav"')
    expect(html).toContain('href="/demo/docs/guide/configuration"')
    expect(html).toContain('Next')
  })
})

test('reading time counts words and CJK characters', () => {
  expect(readingTime('word '.repeat(460))).toBe(2)
  expect(readingTime('字'.repeat(900))).toBe(2)
  expect(readingTime('')).toBe(1)
})
