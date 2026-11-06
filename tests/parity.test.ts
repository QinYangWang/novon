import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../src/node/load-config.ts'
import { build } from '../src/node/build.ts'
import { check, checkFrontmatter, suggest } from '../src/node/check.ts'
import { mdxToMarkdown, stripNotations } from '../src/node/markdown.ts'
import { parseMeta } from '../src/node/mdx.ts'
import { preview } from '../src/node/preview.ts'
import { readRedirectRules } from '../src/node/redirects.ts'
import { gitDates } from '../src/node/content.ts'
import { packageCommands } from '../src/shared.ts'

describe('package commands', () => {
  test('add, dev, global, run, exec, create', () => {
    const add = Object.fromEntries(packageCommands({ packages: 'novon', dev: true }).map((c) => [c.manager, c.command]))
    expect(add).toEqual({ npm: 'npm install -D novon', pnpm: 'pnpm add -D novon', yarn: 'yarn add -D novon', bun: 'bun add -D novon' })
    expect(packageCommands({ packages: 'novon', global: true })[2].command).toBe('yarn global add novon')
    expect(packageCommands({ run: 'dev --port 3000' }).map((c) => c.command)).toEqual(['npm run dev -- --port 3000', 'pnpm dev --port 3000', 'yarn dev --port 3000', 'bun run dev --port 3000'])
    expect(packageCommands({ exec: 'novon new site' }).map((c) => c.command)).toEqual(['npx novon new site', 'pnpm dlx novon new site', 'yarn dlx novon new site', 'bunx novon new site'])
    expect(packageCommands({ create: 'vite' })[3].command).toBe('bun create vite')
    expect(packageCommands({})[2].command).toBe('yarn')
    expect(packageCommands({ packages: 'x', managers: ['bun', 'nope', 'npm'] }).map((c) => c.manager)).toEqual(['bun', 'npm'])
  })
})

describe('fence meta', () => {
  test('title, flags, ranges and words', () => {
    expect(parseMeta('title="a b.ts" {1,3-4} /foo/ lineNumbers wrap')).toEqual({ title: 'a b.ts', lineNumbers: true, wrap: true })
    expect(parseMeta('lineNumbers=false')).toEqual({ lineNumbers: 'false' })
  })
  test('notation comments are stripped for Markdown', () => {
    expect(stripNotations('a // [!code ++]\nb # [!code focus]\n<p/> <!-- [!code --] -->\nc')).toBe('a\nb\n<p/>\nc')
  })
})

describe('plain Markdown', () => {
  test('components become Markdown', () => {
    const md = mdxToMarkdown(`import X from './x'

## Setup

:::tip[Fast]
Use **bun**.
:::

> [!CAUTION]
> Careful.

<PackageInstall packages="novon" managers="npm bun" />

<Tabs>
  <Tab title="macOS">Run brew.</Tab>
  <Tab title="Linux">Run apt.</Tab>
</Tabs>

<Steps>
  <Step title="Create">Make it.</Step>
</Steps>

<CardGroup>
  <Card title="Guide" href="/guide">Basics.</Card>
</CardGroup>

<CodeGroup>
\`\`\`ts title="a.ts"
const a = 1 // [!code ++]
\`\`\`
</CodeGroup>

Time 10:30, key:value and <Term tip="a word">term</Term>.
`)
    expect(md).not.toContain('import')
    expect(md).toContain('> **Tip: Fast**')
    expect(md).toContain('> **Danger**\n>\n> Careful.')
    expect(md).toContain('```sh title="npm"\nnpm install novon\n```')
    expect(md).toContain('```sh title="bun"\nbun add novon\n```')
    expect(md).toContain('### macOS\n\nRun brew.\n\n### Linux')
    expect(md).toContain('1. **Create**')
    expect(md).toContain('- [Guide](/guide): Basics.')
    expect(md).toContain('```ts title="a.ts"\nconst a = 1\n```')
    expect(md).toContain('Time 10:30, key:value and term (a word).')
    expect(md).not.toMatch(/<[A-Z]/)
  })
})

describe('last updated', () => {
  test('commit dates for files under content/', () => {
    const { dates } = gitDates(join(import.meta.dir, '../docs'))
    expect(dates.get('content/index.mdx')).toMatch(/^\d{4}-\d\d-\d\d$/)
  }, 30_000)
})

describe('schemas', () => {
  test('frontmatter types and typos', () => {
    const issues = checkFrontmatter('content/a.mdx', '---\ntitel: x\norder: one\ndate: soon\n---\n', { titel: 'x', order: 'one', date: 'soon', custom: 1 })
    expect(issues.map((i) => [i.severity, i.line])).toEqual([
      ['error', 3],
      ['error', 4],
      ['warning', 2],
    ])
    expect(issues[2].message).toContain('did you mean `title`')
  })
  test('suggest', () => {
    expect(suggest('acent', ['accent', 'radius'])).toBe('accent')
    expect(suggest('zzz', ['accent'])).toBeUndefined()
  })
})

describe('a site with every P0 feature', async () => {
  const dir = join(await mkdtemp(join(tmpdir(), 'novon-p0-')), 'site')
  await mkdir(join(dir, 'content/blog'), { recursive: true })
  await mkdir(join(dir, 'public'), { recursive: true })
  await writeFile(join(dir, 'public/logo.png'), 'x')
  await writeFile(
    join(dir, 'novon.config.ts'),
    `export default {
  title: 'P0', url: 'https://example.com', base: '/docs/',
  layers: [{ path: '/blog', layout: 'blog' }],
  redirects: { '/old': '/guide', '/away': 'https://example.org/x' },
  head: [{ tag: 'meta', attrs: { name: 'site-wide', content: 'yes' } }],
  theme: { pageActions: ['copy', 'markdown', 'claude', { label: 'Ask Bot', href: 'https://bot.example/?u={markdown}' }], acent: 'x' },
}\n`,
  )
  await writeFile(join(dir, 'content/index.mdx'), '---\ntitle: Home\n---\n\nWelcome. [Guide](/guide#install) [Gone](/nope) [Bad anchor](/guide#missing) ![logo](/logo.png) ![none](/none.png) [Old](/old)\n')
  await writeFile(
    join(dir, 'content/guide.mdx'),
    `---
title: Guide
redirectFrom: [/start, /begin]
head:
  - tag: link
    attrs: { rel: preconnect, href: 'https://cdn.example' }
---

## Install

<PackageInstall packages="novon" dev />

:::warning[Heads up]
Read **this**.
:::

> [!NOTE]
> GitHub style.

\`\`\`ts title="a.ts" {1} lineNumbers
const a = 1
const b = 2 // [!code ++]
const c = 3 // [!code focus]
\`\`\`
`,
  )
  await writeFile(join(dir, 'content/secret.mdx'), '---\ntitle: Secret\nnoindex: true\n---\n\nShh.\n')
  await writeFile(join(dir, 'content/blog/post.mdx'), '---\ntitle: A post\ndate: 2026-01-02\nauthor: Ann\n---\n\nHello.\n')
  const config = await loadConfig(dir)
  const issues = await check(config)
  const result = await build(config, { quiet: true })
  const read = (f: string) => readFile(join(dir, 'dist', f), 'utf8')

  test('check finds broken links, anchors, assets, redirects and config typos', () => {
    const msg = issues.map((i) => `${i.severity} ${i.rule} ${i.message}`)
    expect(msg).toContainEqual(expect.stringContaining('error link Broken link /nope'))
    expect(msg).toContainEqual(expect.stringContaining('error anchor No heading #missing on /guide'))
    expect(msg).toContainEqual(expect.stringContaining('error asset Missing file /none.png'))
    expect(msg).toContainEqual(expect.stringContaining('warning link /old redirects to /guide'))
    expect(msg).toContainEqual(expect.stringContaining('`theme.acent`; did you mean `theme.accent`'))
    expect(msg.some((m) => m.includes('#install') || m.includes('logo.png'))).toBe(false)
    expect(result.issues.length).toBe(issues.length)
  })
  test('strict builds stop on issues', async () => {
    await expect(build(config, { quiet: true, strict: true })).rejects.toThrow('--strict')
    await build(config, { quiet: true })
  }, 120_000)

  test('code notations reach the code block', async () => {
    const html = await read('guide/index.html')
    expect(html).toContain('data-line-numbers')
    expect(html).toMatch(/class="line highlighted"/)
    expect(html).toMatch(/class="line diff add"/)
    expect(html).toContain('has-focused')
    expect(html).not.toContain('[!code')
  })
  test('callout directives, alerts and install tabs', async () => {
    const html = await read('guide/index.html')
    expect(html).toContain('Heads up')
    expect(html).toContain('GitHub style.')
    expect(html).not.toContain(':::warning')
    expect(html).not.toContain('[!NOTE]')
    expect(html).toContain('data-slot="code-group"')
    for (const pm of ['npm', 'pnpm', 'yarn', 'bun']) expect(html).toContain(`>${pm}</`)
  })
  test('redirects: _redirects and forwarding pages', async () => {
    const rules = await read('_redirects')
    expect(rules).toContain('/docs/old /docs/guide 301')
    expect(rules).toContain('/docs/start /docs/guide 301')
    expect(rules).toContain('/docs/away https://example.org/x 301')
    const page = await read('begin/index.html')
    expect(page).toContain('http-equiv="refresh" content="0; url=/docs/guide"')
    expect(page).toContain('location.replace("/docs/guide"')
    expect((await readRedirectRules(join(dir, 'dist'))).get('/docs/old')).toEqual({ to: '/docs/guide', status: 301 })
  })
  test('preview follows _redirects', async () => {
    const server = await preview(config, 0)
    try {
      // Straight to the handler: no network or proxy in the way.
      const res = await server.fetch(new Request(new URL('/docs/start', server.url)))
      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe('/docs/guide')
    } finally {
      server.stop(true)
    }
  })
  test('SEO: JSON-LD, noindex, head, sitemap', async () => {
    const guide = await read('guide/index.html')
    expect(guide).toContain('"@type":"TechArticle"')
    expect(guide).toContain('"@type":"BreadcrumbList"')
    expect(guide).toContain('<link rel="preconnect" href="https://cdn.example">')
    expect(guide).toContain('<meta name="site-wide" content="yes">')
    const post = await read('blog/post/index.html')
    expect(post).toContain('"@type":"BlogPosting"')
    expect(post).toContain('"datePublished":"2026-01-02"')
    expect(post).toContain('"author":{"@type":"Person","name":"Ann"}')
    expect(await read('secret/index.html')).toContain('<meta name="robots" content="noindex">')
    const sitemap = await read('sitemap.xml')
    expect(sitemap).not.toContain('/secret')
    expect(sitemap).toMatch(/<loc>https:\/\/example.com\/docs\/guide<\/loc><lastmod>\d{4}-\d\d-\d\d<\/lastmod>/)
  })
  test('page actions follow theme.pageActions', async () => {
    const html = await read('guide/index.html')
    expect(html).toContain('Copy page')
    // The menu renders on open; its list reaches the client bundle with the site data.
    const assets = await readdir(join(dir, 'dist/assets'))
    const js = await Promise.all(assets.filter((f) => f.endsWith('.js')).map((f) => read(`assets/${f}`)))
    expect(js.some((s) => s.includes('https://bot.example/?u={markdown}'))).toBe(true)
  })
  test('llms-full.txt and .md use plain Markdown', async () => {
    const full = await read('llms-full.txt')
    expect(full).toStartWith('# P0')
    expect(full).toContain('Source: https://example.com/docs/guide')
    expect(full).toContain('> **Warning: Heads up**')
    expect(full).toContain('```sh title="pnpm"\npnpm add -D novon\n```')
    expect(full).not.toContain('Shh.')
    expect(await read('llms.txt')).not.toContain('secret')
    const md = await read('guide.md')
    expect(md).toContain('> **Note**\n>\n> GitHub style.')
    expect(md).not.toContain('<PackageInstall')
    expect(existsSync(join(dir, 'dist/secret.md'))).toBe(true)
  })
})
