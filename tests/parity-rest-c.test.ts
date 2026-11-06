import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadConfig } from '../src/node/load-config.ts'
import { check } from '../src/node/check.ts'
import { scanSite } from '../src/node/content.ts'
import { markdownCache } from '../src/node/plugins.ts'
import { agentFiles } from '../src/node/agents.ts'
import { commandLine, resolveAgent, runAgent, splitCommand, unfence, type Agent } from '../src/node/agent.ts'
import { sourceHash, translatedFrom, translatePages, translationStatus, withTranslatedFrom } from '../src/node/translate.ts'
import { detectSource, migrate, sidebarToMetas, convertBody, toTs } from '../src/node/migrate.ts'
import { corpus, evalOffline, evalWithAgent, generateEvals, missingPhrases, readEvals } from '../src/node/eval.ts'
import { codeBlocks, commandsIn, skillOutline, writeSkill } from '../src/node/skill.ts'

// Tests that start the CLI take a few seconds each on a busy machine.
setDefaultTimeout(60_000)

const NOVON = resolve(import.meta.dir, '../bin/novon.ts')
const FIXTURES = resolve(import.meta.dir, 'fixtures/migrate')
const tmp: string[] = []
afterAll(async () => {
  for (const d of tmp) await rm(d, { recursive: true, force: true })
})
async function temp(prefix: string): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), prefix))
  tmp.push(d)
  return d
}

/**
 * A fake coding agent: prints deterministic answers chosen by the prompt, and
 * logs every prompt to agent.log in its working folder.
 */
const FAKE = `
const args = process.argv.slice(2).filter((a) => a !== 'exec' && a !== '-p')
let prompt = args.at(-1) ?? ''
if (!prompt) prompt = await new Response(Bun.stdin.stream()).text()
const fs = require('node:fs')
fs.appendFileSync('agent.log', prompt + '\\n<<END>>\\n')
if (prompt.startsWith('Translate this page')) {
  const source = prompt.split(/\\nSource \\(content\\/[^)]+\\):\\n\\n/)[1].split('\\n\\nEarlier translation')[0]
  console.log('\`\`\`mdx\\n' + source.replace(/^title: (.*)$/m, 'title: JA $1').replace(/^# (.*)$/m, '# JA $1') + '\\n\`\`\`')
} else if (prompt.startsWith('You are answering')) {
  console.log('Run \`novon version v1\` to freeze the docs.')
} else if (prompt.startsWith('Write ')) {
  console.log('Here you go:\\n[{"question":"How do I freeze docs?","expect":["novon version"],"pages":["/versions"]},{"question":"Made up?","expect":["no such phrase anywhere"]}]')
} else if (prompt.startsWith('Improve this agent skill')) {
  console.log(prompt.split('Current SKILL.md:\\n\\n')[1].trimEnd() + '\\n\\n## Refined\\n\\nBy the agent.')
} else if (prompt.includes('MIGRATION.md')) {
  fs.appendFileSync('MIGRATION.md', '\\n- agent ran\\n')
  console.log('done')
} else {
  console.error('unknown prompt')
  process.exit(3)
}
`

let bin: string
let agent: Agent
beforeAll(async () => {
  bin = await temp('novon-agent-bin-')
  await writeFile(join(bin, 'fake-agent.ts'), FAKE)
  // On PATH as `codex`, the way a real agent CLI would be.
  await writeFile(join(bin, 'codex'), `#!/bin/sh\nexec "${process.execPath}" "${join(bin, 'fake-agent.ts')}" "$@"\n`)
  await chmod(join(bin, 'codex'), 0o755)
  agent = resolveAgent(undefined, { PATH: bin })!
})

function cli(args: string[], cwd: string, env: Record<string, string> = {}) {
  const r = Bun.spawnSync([process.execPath, NOVON, ...args], { cwd, env: { ...process.env, NOVON_AGENT: '', ...env }, stdout: 'pipe', stderr: 'pipe' })
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() }
}

describe('agent resolution', () => {
  test('splitCommand keeps quoted words', () => {
    expect(splitCommand(`my-agent -p "two words" 'x y' {prompt}`)).toEqual(['my-agent', '-p', 'two words', 'x y', '{prompt}'])
  })

  test('NOVON_AGENT, then config, then PATH', () => {
    expect(resolveAgent('claude -p', { NOVON_AGENT: 'gemini', PATH: bin })).toMatchObject({ name: 'gemini', args: ['-p'], input: 'arg', from: 'env' })
    expect(resolveAgent({ command: 'mine', args: ['--x', '{prompt}'] }, { PATH: bin })).toMatchObject({ name: 'mine', args: ['--x', '{prompt}'], input: 'arg', from: 'config' })
    expect(resolveAgent('mine --quiet', { PATH: bin })).toMatchObject({ input: 'stdin' })
    expect(agent).toMatchObject({ name: 'codex', args: ['exec'], from: 'path' })
    expect(resolveAgent(undefined, { PATH: join(bin, 'nothing') })).toBeNull()
    expect(commandLine(agent, { edit: true })).toEndWith('codex exec --full-auto <prompt>')
  })

  test('runAgent passes the prompt as an argument or on stdin', async () => {
    const dir = await temp('novon-run-')
    const viaArg = await runAgent({ ...agent, args: ['{prompt}'] }, 'Write 2 checks', { cwd: dir })
    expect(viaArg.ok).toBe(true)
    expect(viaArg.stdout).toContain('novon version')
    const viaStdin = await runAgent({ ...agent, args: [], input: 'stdin' }, 'You are answering x', { cwd: dir })
    expect(viaStdin.stdout).toContain('novon version v1')
    expect(unfence('```md\n# Hi\n```')).toBe('# Hi')
  })
})

describe('novon translate', () => {
  let root: string
  beforeAll(async () => {
    root = await temp('novon-translate-')
    await writeFile(join(root, 'novon.config.ts'), `export default { title: 'T', i18n: { defaultLocale: 'en', locales: { en: 'English', ja: '日本語' } } }\n`)
    await mkdir(join(root, 'content/guide'), { recursive: true })
    await mkdir(join(root, 'content/ja'), { recursive: true })
    await writeFile(join(root, 'content/index.mdx'), '---\ntitle: Home\n---\n\n# Home\n\nHello.\n')
    await writeFile(join(root, 'content/guide/setup.mdx'), '---\ntitle: Setup\n---\n\n<Note>Read first.</Note>\n\n```bash\nnovon dev\n```\n\nSee [the home page](/).\n')
    const home = await readFile(join(root, 'content/index.mdx'), 'utf8')
    await writeFile(join(root, 'content/ja/index.mdx'), withTranslatedFrom('---\ntitle: ホーム\n---\n\nこんにちは。\n', sourceHash(home)))
  })

  test('frontmatter hash helpers', () => {
    expect(withTranslatedFrom('---\ntitle: A\n---\nx', 'abc')).toBe('---\ntitle: A\ntranslatedFrom: abc\n---\nx')
    expect(withTranslatedFrom('---\ntitle: A\ntranslatedFrom: old\n---\nx', 'new')).toBe('---\ntitle: A\ntranslatedFrom: new\n---\nx')
    expect(translatedFrom('---\ntranslatedFrom: "abc123"\n---')).toBe('abc123')
    expect(withTranslatedFrom('# No frontmatter', 'h')).toStartWith('---\ntranslatedFrom: h\n---')
  })

  test('status: missing, current, then stale when the source changes', async () => {
    const config = await loadConfig(root)
    const items = await translationStatus(config, 'ja')
    expect(items.map((i) => [i.file, i.status])).toEqual([
      ['guide/setup.mdx', 'missing'],
      ['index.mdx', 'current'],
    ])
    expect((await translationStatus(config, 'ja', { only: 'guide/**' })).map((i) => i.file)).toEqual(['guide/setup.mdx'])
    await writeFile(join(root, 'content/index.mdx'), '---\ntitle: Home\n---\n\n# Home\n\nHello again.\n')
    expect((await translationStatus(config, 'ja')).find((i) => i.file === 'index.mdx')?.status).toBe('stale')
    await expect(translationStatus(config, 'en')).rejects.toThrow('default locale')
    await expect(translationStatus(config, 'fr')).rejects.toThrow('no locale "fr"')
  })

  test('--check lists, --strict fails, --dry-run prints prompts', () => {
    const list = cli(['translate', 'ja', '--check'], root)
    expect(list.code).toBe(0)
    expect(list.out).toContain('guide/setup.mdx')
    expect(list.out).toContain('2 of 2 pages need translating into ja')
    expect(cli(['translate', 'ja', '--check', '--strict'], root).code).toBe(1)
    const dry = cli(['translate', 'ja', '--dry-run'], root, { NOVON_AGENT: `${join(bin, 'codex')}` })
    expect(dry.code).toBe(0)
    expect(dry.out).toContain('Translate this page')
    expect(dry.out).toContain('Keep MDX components')
    expect(dry.out).toContain('Earlier translation (content/ja/index.mdx)')
    expect(existsSync(join(root, 'content/ja/guide/setup.mdx'))).toBe(false)
  })

  test('without an agent it says how to get one', () => {
    const r = cli(['translate', 'ja'], root, { PATH: join(bin, 'nothing') })
    expect(r.code).toBe(1)
    expect(r.err).toContain('No coding agent found')
  })

  test('the agent translates; frontmatter, components and code survive', async () => {
    const config = await loadConfig(root)
    const todo = (await translationStatus(config, 'ja')).filter((i) => i.status !== 'current')
    const r = await translatePages(config, 'ja', todo, agent)
    expect(r.failed).toEqual([])
    const setup = await readFile(join(root, 'content/ja/guide/setup.mdx'), 'utf8')
    expect(setup).toContain('title: JA Setup')
    expect(setup).toContain('<Note>Read first.</Note>')
    expect(setup).toContain('```bash\nnovon dev\n```')
    expect(translatedFrom(setup)).toBe(sourceHash(await readFile(join(root, 'content/guide/setup.mdx'), 'utf8')))
    expect((await translationStatus(config, 'ja')).every((i) => i.status === 'current')).toBe(true)
    expect(cli(['translate', 'ja', '--check', '--strict'], root).code).toBe(0)
  })
})

describe('novon migrate', () => {
  let out: string
  beforeAll(async () => {
    out = await temp('novon-migrate-')
  })
  const read = (site: string, f: string) => readFile(join(out, site, f), 'utf8')

  test('detects each framework', () => {
    for (const s of ['docusaurus', 'mintlify', 'nextra', 'vitepress', 'starlight']) expect(detectSource(join(FIXTURES, s))).toBe(s as any)
    expect(detectSource(out)).toBeNull()
  })

  test('docusaurus: sidebars, ids without number prefixes, admonitions, tabs, static files', async () => {
    const r = await migrate('docusaurus', join(FIXTURES, 'docusaurus'), join(out, 'docusaurus'))
    expect(r.pages).toBe(3)
    expect(await read('docusaurus', 'content/_meta.ts')).toContain(`pages: ['intro', 'guides', { title: 'Status', href: 'https://status.acme.dev' }]`)
    const guides = await read('docusaurus', 'content/guides/_meta.ts')
    expect(guides).toContain(`title: 'Guides'`)
    expect(guides).toContain('collapsed: true')
    expect(guides).toContain(`launch: { title: 'Launch day' }`)
    const intro = await read('docusaurus', 'content/intro.md')
    expect(intro).toContain('label: Start here')
    expect(intro).toContain('order: 1')
    expect(intro).not.toContain('slug')
    expect(intro).toContain(':::tip[Fast start]')
    const install = await read('docusaurus', 'content/guides/install.mdx')
    expect(install).toContain('<Tab title="npm">')
    expect(install).toContain('<Tab title="bun">')
    expect(install).not.toContain('@theme/')
    expect(await read('docusaurus', 'content/guides/launch.mdx')).toContain('<Accordion title="Abort">')
    expect(existsSync(join(out, 'docusaurus/public/img/logo.svg'))).toBe(true)
    const cfg = await read('docusaurus', 'novon.config.ts')
    expect(cfg).toContain(`title: 'Acme Docs'`)
    expect(cfg).toContain(`url: 'https://docs.acme.dev'`)
    expect(cfg).toContain(`{ label: 'Install', href: '/guides/install' }`)
    const doc = await read('docusaurus', 'MIGRATION.md')
    expect(doc).toContain('<Rocket> is not a novon component')
    expect(doc).toContain('@site/src/components/Rocket')
    expect(doc).toContain('slug: /')
  })

  test('mintlify: docs.json groups, tabs, anchors, Check → Tip, images to public', async () => {
    await migrate('auto', join(FIXTURES, 'mintlify'), join(out, 'mintlify'))
    expect(await read('mintlify', 'content/_meta.ts')).toContain(`{ group: 'Get started', pages: ['quickstart'] }, 'essentials'`)
    expect(await read('mintlify', 'content/essentials/_meta.ts')).toContain(`title: 'Essentials'`)
    const qs = await read('mintlify', 'content/quickstart.mdx')
    expect(qs).toContain('label: Quick start')
    expect(qs).toContain('<Tip>You are done.</Tip>')
    expect(existsSync(join(out, 'mintlify/public/images/screen.svg'))).toBe(true)
    const cfg = await read('mintlify', 'novon.config.ts')
    expect(cfg).toContain(`{ label: 'Guides', href: '/' }`)
    expect(cfg).toContain(`{ label: 'Blog', href: 'https://pulse.dev/blog' }`)
    expect(await read('mintlify', 'MIGRATION.md')).toContain('<ParamField>')
  })

  test('nextra: _meta files, separators, hidden pages, Callout, Tabs items, Steps headings', async () => {
    const r = await migrate('nextra', join(FIXTURES, 'nextra'), join(out, 'nextra'))
    expect(r.leftovers).toEqual([])
    const root = await read('nextra', 'content/_meta.ts')
    expect(root).toContain(`{ group: 'More', pages: ['faq'] }`)
    expect(root).toContain(`{ title: 'GitHub', href: 'https://github.com/orbit/orbit' }`)
    expect(await read('nextra', 'content/guide/_meta.ts')).toContain(`deploy: { title: 'Deploying', hidden: true }`)
    const index = await read('nextra', 'content/index.mdx')
    expect(index).not.toContain('nextra/components')
    expect(index).toContain('<Callout type="warning">')
    expect(index).toContain('<Step title="Install">')
    expect(await read('nextra', 'content/faq.mdx')).toContain('<Callout type="danger">')
    const setup = await read('nextra', 'content/guide/setup.mdx')
    expect(setup).toContain('<Tab title="pnpm">`pnpm add orbit`</Tab>')
    expect(setup).not.toContain('Tabs.Tab')
    expect(await read('nextra', 'novon.config.ts')).toContain(`title: 'Orbit'`)
  })

  test('vitepress: sidebar groups, containers, code groups, base and nav', async () => {
    await migrate('vitepress', join(FIXTURES, 'vitepress'), join(out, 'vitepress'))
    const meta = await read('vitepress', 'content/guide/_meta.ts')
    expect(meta).toContain(`{ group: 'Introduction', pages: ['getting-started'] }, { group: 'Advanced', pages: ['config'] }`)
    const index = await read('vitepress', 'content/guide/index.mdx')
    expect(index).toContain(':::tip[Quick]')
    expect(index).toContain('<Accordion title="Why?">')
    const gs = await read('vitepress', 'content/guide/getting-started.mdx')
    expect(gs).toContain('<CodeGroup>\n\n```sh title="npm"')
    expect(gs).not.toContain('[[toc]]')
    const cfg = await read('vitepress', 'novon.config.ts')
    expect(cfg).toContain(`base: '/comet/'`)
    expect(cfg).toContain(`{ label: 'Guide', href: '/guide' }`)
    const doc = await read('vitepress', 'MIGRATION.md')
    expect(doc).toContain('{{ }}')
    expect(doc).toContain('home page')
  })

  test('starlight: sidebar with slugs and autogenerate, frontmatter sidebar, asides, cards, steps', async () => {
    const r = await migrate('starlight', join(FIXTURES, 'starlight'), join(out, 'starlight'))
    expect(r.leftovers).toEqual([])
    expect(await read('starlight', 'content/guides/_meta.ts')).toContain(`pages: ['example', 'advanced'], items: { example: { title: 'First steps' } }`)
    expect(await read('starlight', 'content/reference/_meta.ts')).toContain(`title: 'Reference'`)
    const ex = await read('starlight', 'content/guides/example.mdx')
    expect(ex).toContain('order: 1')
    expect(ex).toContain('badge: New')
    expect(ex).toContain('<Callout type="tip">Use the CLI.</Callout>')
    expect(ex).toContain('<Step title="Install Nebula">')
    expect(ex).toContain('<Tab title="macOS">')
    const index = await read('starlight', 'content/index.mdx')
    expect(index).toContain('<CardGroup>')
    expect(index).toContain('<Card title="Guides" href="/guides/example/">Read the guides.</Card>')
    expect(await read('starlight', 'novon.config.ts')).toContain(`url: 'https://nebula.dev'`)
  })

  test('migrated sites pass novon check', async () => {
    for (const s of ['docusaurus', 'mintlify', 'nextra', 'starlight']) {
      const config = await loadConfig(join(out, s))
      const errors = (await check(config)).filter((i) => i.severity === 'error')
      expect([s, errors]).toEqual([s, []])
    }
  })

  test('refuses a non-empty content folder; --dry-run writes nothing', async () => {
    await expect(migrate('nextra', join(FIXTURES, 'nextra'), join(out, 'nextra'))).rejects.toThrow('--overwrite')
    const dry = await migrate('nextra', join(FIXTURES, 'nextra'), join(out, 'dry'), { dryRun: true })
    expect(Object.keys(dry.files)).toContain('content/index.mdx')
    expect(existsSync(join(out, 'dry'))).toBe(false)
  })

  test('--agent hands MIGRATION.md to the agent in the new site', async () => {
    const r = cli(['migrate', 'docusaurus', join(FIXTURES, 'docusaurus'), '--dir', join(out, 'agent'), '--agent'], out, { NOVON_AGENT: join(bin, 'codex') })
    expect(r.err).toBe('')
    expect(r.out).toContain('Handing MIGRATION.md to codex')
    expect(await read('agent', 'MIGRATION.md')).toContain('- agent ran')
    expect(await read('agent', 'agent.log')).toContain('Work through every unchecked item')
  })

  test('sidebar mapping and body helpers', () => {
    expect(sidebarToMetas([{ type: 'category', label: 'A', items: [{ type: 'doc', path: 'a/b/c' }] }])).toEqual({
      '': { pages: ['a'], items: {} },
      a: { pages: ['b'], items: {} },
      'a/b': { title: 'A', pages: ['c'], items: {} },
    })
    expect(convertBody('docusaurus', '```md\n:::tip Not me\n```\n\n:::note Me\nx\n:::\n')).toBe('```md\n:::tip Not me\n```\n\n:::note[Me]\nx\n:::\n')
    expect(toTs({ a: 'it\'s', 'b-c': [1] })).toBe(`{ a: 'it\\'s', 'b-c': [1] }`)
  })
})

describe('novon eval', () => {
  let root: string
  beforeAll(async () => {
    root = await temp('novon-eval-')
    await writeFile(join(root, 'novon.config.ts'), `export default { title: 'E', plugins: ['llms'] }\n`)
    await mkdir(join(root, 'content'), { recursive: true })
    await writeFile(join(root, 'content/index.mdx'), '---\ntitle: Home\n---\n\nRun `novon new` to start.\n')
    await writeFile(join(root, 'content/versions.mdx'), '---\ntitle: Versions\n---\n\nRun **novon version** v1 to freeze the docs.\n')
    await writeFile(
      join(root, 'evals.json'),
      JSON.stringify([
        { question: 'How do I start?', expect: ['novon new'] },
        { question: 'How do I freeze docs?', expect: ['novon version'], pages: ['/versions'] },
      ]),
    )
  })

  test('phrases match regardless of case, spacing and emphasis', () => {
    expect(missingPhrases('Run **Novon   Version** now', ['novon version', 'now', 'later'])).toEqual(['later'])
  })

  test('offline checks the docs and the named pages', async () => {
    const config = await loadConfig(root)
    const docs = await corpus(config)
    expect(docs.full).toContain('Source: /versions')
    const checks = await readEvals(root)
    expect(evalOffline(checks, docs).map((r) => r.ok)).toEqual([true, true])
    const wrong = evalOffline([{ question: 'q', expect: ['novon new'], pages: ['/versions'] }, { question: 'q', expect: ['x'], pages: ['/nope'] }], docs)
    expect(wrong.map((r) => r.ok)).toEqual([false, false])
    expect(wrong[1].error).toContain('/nope')
    const r = cli(['eval', '--offline'], root)
    expect(r.code).toBe(0)
    expect(r.out).toContain('2 of 2 passed')
  })

  test('with an agent: answers are graded by the expected phrases', async () => {
    const config = await loadConfig(root)
    const results = await evalWithAgent(config, await readEvals(root), await corpus(config), agent)
    expect(results.map((r) => r.ok)).toEqual([false, true])
    expect(results[0].missing).toEqual(['novon new'])
    expect(existsSync(join(root, '.novon/eval/llms-full.txt'))).toBe(false)
    expect(await readFile(join(root, 'agent.log'), 'utf8')).toContain('.novon/eval/llms-full.txt')
    const r = cli(['eval'], root, { NOVON_AGENT: join(bin, 'codex') })
    expect(r.code).toBe(1)
    expect(r.out).toContain('1 of 2 passed')
  })

  test('--generate keeps drafted checks whose phrases are in the docs', async () => {
    const config = await loadConfig(root)
    const r = await generateEvals(config, 2, await corpus(config), agent)
    expect(r.added.map((c) => c.question)).toEqual(['How do I freeze docs?'])
    expect(r.dropped.map((c) => c.question)).toEqual(['Made up?'])
    expect((await readEvals(root)).length).toBe(3)
  })

  test('bad evals.json is reported', async () => {
    const dir = await temp('novon-eval-bad-')
    await writeFile(join(dir, 'evals.json'), '[{ "question": 1 }]')
    await expect(readEvals(dir)).rejects.toThrow('needs `question`')
    expect(await readEvals(join(dir, 'none'))).toEqual([])
  })
})

describe('novon skill', () => {
  let root: string
  beforeAll(async () => {
    root = await temp('novon-skill-')
    await writeFile(join(root, 'novon.config.ts'), `export default { title: 'Acme Docs', description: 'Rockets.', url: 'https://acme.dev', plugins: ['llms'] }\n`)
    await mkdir(join(root, 'content/guide'), { recursive: true })
    await writeFile(join(root, 'content/index.mdx'), '---\ntitle: Acme\ndescription: Start here.\n---\n\n```bash\n$ acme init\n$ acme launch --fast # go\noutput line\n```\n')
    await writeFile(join(root, 'content/guide/config.mdx'), "---\ntitle: Config\n---\n\n```ts title=\"acme.config.ts\"\nexport default {\n  engine: 'v2',\n  fuel: 3,\n}\n```\n\n```sh\nacme check \\\n  --strict\n```\n")
  })

  test('code blocks and commands', () => {
    const blocks = codeBlocks('```bash title="x"\nnpm i\n```\n\n````md\n```js\nnot a block\n```\n````\n', '/')
    expect(blocks.map((b) => [b.lang, b.title])).toEqual([
      ['bash', 'x'],
      ['md', undefined],
    ])
    expect(commandsIn([{ lang: 'sh', code: '# comment\nnpm i\nnpm i\nfoo \\\n  --bar', route: '/' }]).map((c) => c.command)).toEqual(['npm i'])
  })

  test('outline: purpose, key pages, commands, config', async () => {
    const config = await loadConfig(root)
    const { name, markdown } = await skillOutline(config)
    expect(name).toBe('acme-docs')
    expect(markdown).toStartWith('---\nname: acme-docs\ndescription: "Work with Acme Docs. Rockets.')
    expect(markdown).toContain('- [Acme](https://acme.dev/index.md): Start here.')
    expect(markdown).toContain('- `acme init`')
    expect(markdown).toContain('- `acme launch --fast`')
    expect(markdown).not.toContain('output line')
    expect(markdown).toContain('`acme.config.ts`')
    expect(markdown).toContain('`engine`, `fuel`')
  })

  test('writes skills/<name>/SKILL.md, which the build publishes as the site skill', async () => {
    const config = await loadConfig(root)
    const r = await writeSkill(config)
    expect(r.file).toBe(join(root, 'skills/acme-docs/SKILL.md'))
    const { pages, folders } = await scanSite(config)
    const { files } = await agentFiles({ config, pages, folders, markdown: markdownCache(config, pages) } as any)
    expect(files['skill.md']).toBe(r.markdown)
    expect(new TextDecoder().decode(files['.well-known/agent-skills/acme-docs/SKILL.md'] as Uint8Array)).toBe(r.markdown)
  })

  test('--agent refines it; --dry-run prints without writing', async () => {
    const config = await loadConfig(root)
    const r = await writeSkill(config, { agent })
    expect(r.refined).toBe(true)
    expect(await readFile(r.file, 'utf8')).toContain('## Refined')
    await rm(join(root, 'skills'), { recursive: true })
    const dry = cli(['skill', '--dry-run'], root)
    expect(dry.code).toBe(0)
    expect(dry.out).toContain('name: acme-docs')
    expect(existsSync(join(root, 'skills'))).toBe(false)
    const dryAgent = cli(['skill', '--agent', '--dry-run'], root, { NOVON_AGENT: join(bin, 'codex') })
    expect(dryAgent.out).toContain('Improve this agent skill')
  })
})

describe('config', () => {
  test('`agent` is a known config key', async () => {
    const root = await temp('novon-agent-cfg-')
    await writeFile(join(root, 'novon.config.ts'), `export default { title: 'A', agent: { command: 'claude', args: ['-p'] } }\n`)
    await mkdir(join(root, 'content'))
    await writeFile(join(root, 'content/index.mdx'), '# A\n')
    const config = await loadConfig(root)
    expect((await check(config)).filter((i) => i.message.includes('`agent'))).toEqual([])
    expect(resolveAgent(config.agent, { PATH: '' })).toMatchObject({ command: 'claude', args: ['-p'], from: 'config' })
  })
})


