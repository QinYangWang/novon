import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../src/node/load-config.ts'
import { build } from '../src/node/build.ts'
import { check } from '../src/node/check.ts'
import { mdxToMarkdown } from '../src/node/markdown.ts'
import { expandSource } from '../src/node/source.ts'
import { applyMetas } from '../src/node/meta.ts'
import { pageSections } from '../src/node/search-index.ts'
import { checkBudget, parseSize } from '../src/node/budget.ts'
import { analyticsTags } from '../src/node/analytics.ts'
import { inlineMarkdown } from '../src/node/banner.ts'
import { readSkills, skillName, tar } from '../src/node/agents.ts'
import { agentsMd, scaffold } from '../src/node/new.ts'
import { docsNav, flatten } from '../src/runtime/nav.ts'
import { excerpt, search, tokenize, type SearchEntry } from '../src/runtime/search.ts'
import { toUnifiedDiff } from '../src/runtime/extras.tsx'
import { siteTools } from '../src/runtime/webmcp.ts'
import { labelsFor } from '../src/labels.ts'
import type { PageMeta, SiteData } from '../src/types.ts'

const page = (route: string, extra: Partial<PageMeta> = {}): PageMeta => ({
  route,
  file: `content${route === '/' ? '/index' : route}.mdx`,
  title: route.split('/').at(-1) || 'Home',
  label: route.split('/').at(-1) || 'Home',
  order: Infinity,
  tags: [],
  hidden: false,
  layer: '/',
  layout: 'docs',
  kind: 'page',
  ...extra,
})

describe('partials and variables', async () => {
  const root = await mkdtemp(join(tmpdir(), 'novon-src-'))
  await mkdir(join(root, 'content/_partials'), { recursive: true })
  await writeFile(join(root, 'content/_partials/install.mdx'), '---\ntitle: x\n---\n\n```sh\nnpm i {{pkg}}@{{version}}\n```\n')
  await writeFile(join(root, 'content/_partials/loop.mdx'), '<Partial file="loop" />\n')
  const config = { root, variables: { version: '2.1', name: 'Acme' } }

  test('a partial is inlined with its attributes and the config variables', () => {
    const out = expandSource('# Hi\n\n  <Partial file="install" pkg="novon" />\n', config, 'content/a.mdx')
    expect(out.code).toContain('  ```sh\n  npm i novon@2.1\n  ```')
    expect(out.code).not.toContain('title: x')
    expect(out.partials).toEqual(['content/_partials/install.mdx'])
    expect(out.problems).toEqual([])
  })
  test('missing partials, loops and unknown variables are problems', () => {
    const out = expandSource('<Partial file="nope" />\n\n<Partial file="loop" />\n\nHi {{who}}\n', config, 'content/a.mdx')
    expect(out.problems.map((p) => p.message)).toEqual([expect.stringContaining('No partial "nope"'), expect.stringContaining('includes itself'), expect.stringContaining('Unknown variable {{who}}')])
    expect(out.problems[0].line).toBe(1)
  })
  test('escapes and code', () => {
    const out = expandSource('{{name}} \\{{name}} `\\{{name}}` `{{other}}`\n\n```\n{{other}} \\{{name}}\n<Partial file="install" />\n```\n', config, 'content/a.mdx')
    expect(out.code).toBe('Acme \\{\\{name}} `{{name}}` `{{other}}`\n\n```\n{{other}} {{name}}\n<Partial file="install" />\n```\n')
    expect(out.problems).toEqual([])
  })
})

describe('_meta', () => {
  const pages = [
    page('/'),
    page('/guide', { title: 'Guide', label: 'Guide' }),
    page('/guide/a', { order: 1 }),
    page('/guide/b', { order: 2 }),
    page('/guide/c'),
    page('/guide/secret'),
    page('/ref', { title: 'Ref', label: 'Ref', order: 0 }),
    page('/ref/x'),
  ]
  const folders = applyMetas(pages, [
    { dir: '', file: 'content/_meta.ts', meta: { pages: ['guide', 'ref'] } },
    {
      dir: 'guide',
      file: 'content/guide/_meta.ts',
      meta: {
        title: 'Handbook',
        badge: 'Beta',
        collapsed: true,
        pages: ['c', { group: 'Basics', pages: ['b', 'a'] }, { title: 'Repo', href: 'https://example.com' }],
        items: { c: { title: 'See', badge: 'New' }, secret: { hidden: true } },
      },
    },
  ])

  test('order, titles, badges, groups, links, hidden', () => {
    const nav = docsNav(pages, '/', folders)
    expect(nav.map((s) => s.label)).toEqual(['', 'Handbook', 'Ref'])
    const guide = nav[1]
    expect(guide).toMatchObject({ badge: 'Beta', collapsed: true })
    expect(guide.items.map((i) => i.page.label)).toEqual(['Guide', 'See', 'b', 'a', 'Repo'])
    expect(guide.items.map((i) => i.group)).toEqual([undefined, undefined, 'Basics', 'Basics', undefined])
    expect(guide.items.at(-1)!.external).toBe('https://example.com')
    expect(guide.items[1].page.badge).toBe('New')
    expect(pages.find((p) => p.route === '/guide/secret')!.hidden).toBe(true)
    // Previous/next skip external links.
    expect(flatten(nav).map((p) => p.route)).not.toContain('https://example.com')
  })
  test("'...' keeps the rest in place", () => {
    const list = [page('/a', { order: 2 }), page('/b', { order: 1 }), page('/c'), page('/z')]
    applyMetas(list, [{ dir: '', file: 'content/_meta.ts', meta: { pages: ['z', '...', 'a'] } }])
    expect(docsNav(list, '/')[0].items.map((i) => i.page.route)).toEqual(['/z', '/b', '/c', '/a'])
  })
})

describe('search', () => {
  const entries: SearchEntry[] = [
    { route: '/guide', title: 'Guide', section: 'Guide', text: 'Welcome to the guide.' },
    { route: '/guide/config', title: 'Configuration', text: 'Every option.', headings: ['Banner'] },
    { route: '/guide/config', title: 'Configuration', heading: 'Banner', anchor: 'banner', text: 'A line above the header for announcements.' },
    { route: '/zh', title: '配置', heading: '配置文件', anchor: '配置文件', text: '如何编写配置文件和主题。' },
  ]
  test('CJK runs become pairs, Latin words stay whole', () => {
    expect(tokenize('配置文件 Setup')).toEqual(['配置', '置文', '文件', 'setup'])
    expect(tokenize('a')).toEqual(['a'])
  })
  test('every term must match; headings rank first; results deep-link', () => {
    expect(search(entries, 'banner')[0].href).toBe('/guide/config#banner')
    expect(search(entries, 'conf').map((r) => r.href)).toEqual(['/guide/config', '/guide/config#banner'])
    expect(search(entries, 'announce header').map((r) => r.href)).toEqual(['/guide/config#banner'])
    expect(search(entries, 'banner zzz')).toEqual([])
    expect(search(entries, '编写配置')[0].href).toBe('/zh#配置文件')
  })
  test('excerpts centre on the match', () => {
    expect(excerpt('a '.repeat(200) + 'needle here', ['needle'], 40)).toStartWith('…')
  })
  test('sections are split at ## and ### with rendered ids', () => {
    const { intro, sections } = pageSections('Intro **text**.\n\n## Install\n\nRun it.\n\n### Again\n\n#### Deep\n\nMore.\n\n## Install\n\nTwice.\n')
    expect(intro).toBe('Intro text.')
    expect(sections.map((s) => s.anchor)).toEqual(['install', 'again', 'install-1'])
    expect(sections[1].text).toBe('Deep More.')
  })
})

describe('small parts', () => {
  test('sizes and budgets', () => {
    expect(parseSize('200 kB')).toBe(200_000)
    expect(parseSize('1.5MiB')).toBe(1572864)
    expect(parseSize(10)).toBe(10)
    expect(() => parseSize('big')).toThrow()
    expect(checkBudget({ js: 300_000, css: 10_000, rawJs: 0, rawCss: 0 }, { js: '250 kB', css: '20kB' })).toEqual([expect.stringContaining('JS is 300.0 kB')])
  })
  test('analytics', () => {
    const tags = analyticsTags({ plausible: { domain: 'a.dev' }, ga4: 'G-1', cloudflare: 'tok', umami: { websiteId: 'w' }, custom: 'https://s.dev/x.js' })
    expect(tags.map((t) => t.attrs?.src ?? 'inline')).toEqual([
      'https://plausible.io/js/script.js',
      'https://cloud.umami.is/script.js',
      'https://www.googletagmanager.com/gtag/js?id=G-1',
      'inline',
      'https://static.cloudflareinsights.com/beacon.min.js',
      'https://s.dev/x.js',
    ])
    expect(tags[4].attrs?.['data-cf-beacon']).toBe('{"token":"tok","spa":true}')
  })
  test('banner Markdown', () => {
    expect(inlineMarkdown('**New**: `x` <b> [docs](/guide)', '/d/')).toBe('<strong>New</strong>: <code>x</code> &lt;b&gt; <a href="/d/guide">docs</a>')
  })
  test('hand-written diffs get a hunk', () => {
    expect(toUnifiedDiff('-a\n+b\nc')).toBe('@@ -1 +1 @@\n-a\n+b\n c\n')
    expect(toUnifiedDiff('@@ -1 +1 @@\n-a\n')).toBe('@@ -1 +1 @@\n-a\n')
  })
  test('labels for new UI strings in both languages', () => {
    for (const lang of ['en', 'zh-CN']) for (const k of ['downloadPdf', 'dismissBanner', 'copyPrompt', 'diagram', 'required', 'zoomImage'] as const) expect(labelsFor(lang)[k]).toBeTruthy()
    expect(labelsFor('zh').downloadPdf).toBe('下载 PDF')
  })
  test('skills: names, tar, publishing', async () => {
    expect(skillName('Acme Docs!')).toBe('acme-docs')
    expect(skillName('文档')).toBe('docs')
    const archive = tar([{ name: 'SKILL.md', data: new TextEncoder().encode('hi') }])
    expect(archive.length).toBe(2048)
    expect(new TextDecoder().decode(archive.slice(257, 262))).toBe('ustar')
    const dir = await mkdtemp(join(tmpdir(), 'novon-skills-'))
    await mkdir(join(dir, 'solo'), { recursive: true })
    await mkdir(join(dir, 'kit/scripts'), { recursive: true })
    await mkdir(join(dir, 'bad'), { recursive: true })
    await writeFile(join(dir, 'solo/SKILL.md'), '---\nname: solo\ndescription: One file.\n---\nHi\n')
    await writeFile(join(dir, 'kit/SKILL.md'), '---\nname: kit\ndescription: With a script.\n---\nRun scripts/x.sh\n')
    await writeFile(join(dir, 'kit/scripts/x.sh'), 'echo hi\n', { mode: 0o755 })
    await writeFile(join(dir, 'bad/SKILL.md'), '---\nname: Bad Name\ndescription: x\n---\n')
    const { skills, warnings } = await readSkills(dir)
    expect(skills.map((s) => [s.name, s.type, s.path])).toEqual([
      ['kit', 'archive', '.well-known/agent-skills/kit.tar.gz'],
      ['solo', 'skill-md', '.well-known/agent-skills/solo/SKILL.md'],
    ])
    expect(warnings).toEqual([expect.stringContaining('skills/bad/SKILL.md')])
    const listing = Bun.spawnSync(['tar', '-tzvf', '-'], { stdin: skills[0].data }).stdout.toString()
    expect(listing).toContain('SKILL.md')
    expect(listing).toMatch(/-rwxr-xr-x .*scripts\/x\.sh/)
  })
  test('WebMCP tools', async () => {
    const site = { title: 'Acme', base: '/', search: true, pages: [page('/'), page('/a', { description: 'A page' }), page('/h', { hidden: true })] } as unknown as SiteData
    ;(globalThis as { location?: unknown }).location ??= new URL('https://acme.dev/')
    const tools = siteTools(site)
    expect(tools.map((t) => t.name)).toEqual(['search_documentation', 'get_page', 'list_pages'])
    const list = JSON.parse((await tools[2].execute({})).content[0].text)
    expect(list.map((p: { route: string }) => p.route)).toEqual(['/', '/a'])
    expect((await tools[0].execute({ query: '' })).isError).toBe(true)
    expect((await tools[1].execute({ route: 'https://other.dev/x' })).isError).toBe(true)
  })
})

describe('novon new', () => {
  test('in a folder with files, adds the template beside them and writes AGENTS.md', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'novon-new-'))
    await writeFile(join(dir, 'README.md'), 'mine\n')
    await writeFile(join(dir, '.gitignore'), 'node_modules\n')
    await scaffold(dir, 'docs', { title: 'Acme' })
    expect(await readFile(join(dir, 'README.md'), 'utf8')).toBe('mine\n')
    expect(existsSync(join(dir, 'content/index.mdx'))).toBe(true)
    expect(await readFile(join(dir, 'novon.config.ts'), 'utf8')).toContain("title: 'Acme'")
    expect(await readFile(join(dir, '.gitignore'), 'utf8')).toBe('node_modules\ndist\n.novon\n')
    expect(await readFile(join(dir, 'AGENTS.md'), 'utf8')).toContain('novon check --strict')
    await expect(scaffold(dir, 'docs')).rejects.toThrow('already has a novon site')
    expect(agentsMd('Blog', 'blog')).toContain('`date`, `tags`')
  })
})

describe('plain Markdown for new components', () => {
  test('type tables, diffs, prompts, diagrams and math', () => {
    const md = mdxToMarkdown(`Area $\\pi r^2$.

<TypeTable type={{ a: { type: 'string', description: 'A.' } }}>
  <Field name="b" type="number" default="1" required>The b.</Field>
</TypeTable>

<Diff file="x.ts">
\`\`\`diff
-a
+b
\`\`\`
</Diff>

<Prompt>
Read it.
</Prompt>

\`\`\`mermaid
graph LR; A-->B
\`\`\`
`)
    expect(md).toContain('Area $\\pi r^2$.')
    expect(md).toContain('| `b` (required) | `number` | `1`     | The b.      |')
    expect(md).toContain('```diff title="x.ts"\n-a\n+b\n```')
    expect(md).toContain('```text title="Prompt"\nRead it.\n```')
    expect(md).toContain('```mermaid\ngraph LR; A-->B\n```')
  })
})

describe('a P1 site', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'novon-p1-'))
  await mkdir(join(dir, 'content/guide'), { recursive: true })
  await mkdir(join(dir, 'content/_partials'), { recursive: true })
  await mkdir(join(dir, 'skills/hello'), { recursive: true })
  await writeFile(
    join(dir, 'novon.config.ts'),
    `import { defineConfig, definePlugin } from 'novon/config'
const extra = definePlugin({
  name: 'extra',
  transformContent: (s) => s.replaceAll('ACME', 'Acme Inc'),
  pageData: (page) => (page.route === '/guide/b' ? { ...page, badge: 'Hot' } : page),
  head: (page) => (page ? [{ tag: 'meta', attrs: { name: 'route', content: page.route } }] : []),
  routes: ({ pages }) => ({ 'count.txt': String(pages.length) }),
})
export default defineConfig({
  title: 'P1 Docs',
  url: 'https://example.com',
  variables: { version: '3.0' },
  banner: { text: 'Hello **there**', id: 'b1' },
  analytics: { plausible: { domain: 'example.com' } },
  plugins: ['search', 'sitemap', 'rss', 'llms', extra],
})
`,
  )
  await writeFile(join(dir, 'content/index.mdx'), '---\ntitle: Home\n---\n\nWelcome to ACME, version {{version}}.\n')
  await writeFile(join(dir, 'content/guide/index.mdx'), '---\ntitle: Guide\n---\n\nThe guide.\n')
  await writeFile(join(dir, 'content/guide/_meta.ts'), `import { defineMeta } from 'novon/config'\nexport default defineMeta({ pages: ['b', 'a'], items: { a: { badge: 'New' } } })\n`)
  await writeFile(join(dir, 'content/_partials/note.mdx'), 'A shared note about {{thing}}.\n')
  await writeFile(
    join(dir, 'content/guide/a.mdx'),
    `---
title: Alpha
description: The first page.
---

## Math

$E = mc^2$ and

$$
a^2 + b^2 = c^2
$$

## Diagram

\`\`\`mermaid
graph LR; A-->B
\`\`\`

## Types

<TypeTable>
  <Field name="title" type="string" required>The title.</Field>
</TypeTable>

<Partial file="note" thing="partials" />

\`\`\`ts
const x = 1
\`\`\`
`,
  )
  await writeFile(join(dir, 'content/guide/b.mdx'), '---\ntitle: Beta\n---\n\n## 配置文件\n\n中文内容。\n')
  await writeFile(join(dir, 'skills/hello/SKILL.md'), '---\nname: hello\ndescription: Say hello.\n---\nHello.\n')
  const config = await loadConfig(dir)
  const issues = await check(config)
  await build(config, { quiet: true })
  const read = (f: string) => readFile(join(dir, 'dist', f), 'utf8')

  test('check passes', () => {
    expect(issues).toEqual([])
  })
  test('variables, partials and plugin transforms', async () => {
    expect(await read('index.html')).toContain('Welcome to Acme Inc, version 3.0.')
    expect(await read('guide/a/index.html')).toContain('A shared note about partials.')
  })
  test('math is rendered at build time; mermaid and type tables render', async () => {
    const html = await read('guide/a/index.html')
    expect(html).toContain('class="katex"')
    expect(html).toContain('data-novon="mermaid"')
    expect(html).toContain('data-novon="type-table"')
    // A fence without a title has no title bar.
    expect(html).not.toContain('data-slot="code-block-header"')
  })
  test('sidebar order and badges from _meta and pageData', async () => {
    const nav = JSON.parse(await read('api/navigation.json'))
    const guide = nav.layers[0].sections.find((s: { label?: string }) => s.label === 'Guide')
    expect(guide.items.map((i: { title: string; badge?: string }) => [i.title, i.badge ?? ''])).toEqual([
      ['Guide', ''],
      ['Beta', 'Hot'],
      ['Alpha', 'New'],
    ])
  })
  test('search.json has sections with anchors and full text', async () => {
    const index = JSON.parse(await read('search.json')) as SearchEntry[]
    expect(index.find((e) => e.anchor === 'math')?.text).toContain('E = mc^2')
    expect(search(index, '中文')[0].href).toBe('/guide/b#配置文件')
  })
  test('JSON API, skills, discovery files and headers', async () => {
    const pages = JSON.parse(await read('api/pages.json'))
    expect(pages.pages.map((p: { route: string }) => p.route)).toEqual(['/', '/guide', '/guide/a', '/guide/b'])
    const a = JSON.parse(await read('api/pages/guide/a.json'))
    expect(a.markdown).toContain('A shared note about partials.')
    expect(a.headings.map((h: { id: string }) => h.id)).toEqual(['math', 'diagram', 'types'])
    expect(JSON.parse(await read('openapi.json')).paths['/api/pages/{route}.json'].get.operationId).toBe('getPage')
    const skills = JSON.parse(await read('.well-known/agent-skills/index.json'))
    expect(skills.skills.map((s: { name: string }) => s.name)).toEqual(['hello', 'p1-docs'])
    expect(skills.skills[0].digest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(await read('skill.md')).toContain('name: p1-docs')
    expect(await read('skill.md')).toContain('[Alpha](https://example.com/guide/a.md): The first page.')
    const ard = JSON.parse(await read('.well-known/ard.json'))
    expect(ard.entries.map((e: { identifier: string }) => e.identifier)).toContain('urn:air:example.com:docs:skills')
    expect(JSON.parse(await read('.well-known/api-catalog')).linkset[0].anchor).toBe('https://example.com/api/')
    expect(await read('_headers')).toContain('rel="api-catalog"')
    expect(await read('llms.txt')).toContain('[Agent skill](https://example.com/skill.md)')
  })
  test('head links, banner, analytics and plugin head and routes', async () => {
    const html = await read('guide/a/index.html')
    expect(html).toContain('<link rel="alternate" href="/guide/a.md" type="text/markdown">')
    expect(html).toContain('<link rel="ard" href="/.well-known/ard.json" type="application/json">')
    expect(html).toContain('<meta name="route" content="/guide/a">')
    expect(html).toContain('data-domain="example.com"')
    expect(html).toContain('data-novon-banner')
    expect(html).toContain('Hello <strong>there</strong>')
    expect(html).toContain(`localStorage.getItem('novon:banner')==="b1"`)
    expect(await read('count.txt')).toBe('4')
  })
  test('budgets stop the build', async () => {
    await expect(build(config, { quiet: true, budget: { js: '1 kB' } })).rejects.toThrow('over budget')
  }, 200_000)
})
