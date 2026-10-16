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
    for (const f of ['index.html', 'about/index.html', 'posts/plain-text/index.html', 'tags/writing/index.html', 'rss.xml', 'covers/plain-text.svg'])
      expect(existsSync(join(dist, f))).toBe(true)
  })
  test('home features the newest post and lists the rest', async () => {
    const html = await read('index.html')
    expect(html).toContain('Mira Chen')
    expect(html).toContain('/demo/blog/covers/plain-text.svg')
    expect(html.indexOf('Writing in plain text')).toBeLessThan(html.indexOf('A week without notifications'))
    expect(html).toContain('min read')
  })
  test('a post has its author card, outline and related posts', async () => {
    const html = await read('posts/plain-text/index.html')
    expect(html).toContain('About the author')
    expect(html).toContain('Lives in Lisbon')
    expect(html).toContain('On this page')
    expect(html).toContain('Keep reading')
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
    expect(html).toContain('data-slot="sidebar"')
    expect(html).toContain('href="/demo/docs/guide/configuration"')
    expect(html).toContain('Next')
  })
})

test('reading time counts words and CJK characters', () => {
  expect(readingTime('word '.repeat(460))).toBe(2)
  expect(readingTime('字'.repeat(900))).toBe(2)
  expect(readingTime('')).toBe(1)
})
