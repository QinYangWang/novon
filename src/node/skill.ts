/**
 * `novon skill`: a `skills/<name>/SKILL.md` for the site, written from its docs.
 * The outline is deterministic (purpose, key pages, the commands and config
 * the docs show in code blocks); `--agent` lets the local agent refine it.
 * The agents plugin publishes it with the rest of `skills/`.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import matter from 'gray-matter'
import type { PageMeta, ResolvedConfig } from '../types.ts'
import { docsNav, flatten } from '../runtime/nav.ts'
import { postsOf } from '../shared.ts'
import { scanSite } from './content.ts'
import { pageSource } from './source.ts'
import { absolute, markdownPath } from './plugins.ts'
import { skillName } from './agents.ts'
import { type Agent, runAgent, unfence } from './agent.ts'
import { corpus, docsFilePath } from './eval.ts'

export interface CodeBlock {
  lang: string
  title?: string
  code: string
  route: string
}

const SHELL = new Set(['bash', 'sh', 'shell', 'console', 'zsh', 'terminal', 'powershell', 'ps', 'cmd', 'fish'])

/** Fenced code blocks of a Markdown/MDX body. */
export function codeBlocks(body: string, route: string): CodeBlock[] {
  const out: CodeBlock[] = []
  const lines = body.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^\s*(`{3,}|~{3,})(.*)$/)
    if (!open) continue
    const fence = open[1]
    const info = open[2].trim()
    const code: string[] = []
    let j = i + 1
    while (j < lines.length && !new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(lines[j])) code.push(lines[j++])
    const lang = info.split(/[\s{]/)[0] ?? ''
    const title = info.match(/title=(?:"([^"]+)"|'([^']+)'|(\S+))/)
    out.push({ lang: lang.toLowerCase(), ...(title ? { title: title[1] ?? title[2] ?? title[3] } : {}), code: code.join('\n'), route })
    i = j
  }
  return out
}

/** Command lines in shell code blocks, prompts stripped, comments and output skipped. */
export function commandsIn(blocks: CodeBlock[]): { command: string; route: string }[] {
  const seen = new Set<string>()
  const out: { command: string; route: string }[] = []
  for (const b of blocks) {
    if (!SHELL.has(b.lang)) continue
    const prompted = /^\s*[$>] /m.test(b.code)
    let continued = false
    for (const raw of b.code.split('\n')) {
      let line = raw.trim()
      const wasContinued = continued
      continued = line.endsWith('\\')
      if (wasContinued) continue
      if (prompted) {
        if (!/^[$>] /.test(line)) continue
        line = line.slice(2).trim()
      }
      line = line.replace(/\s+#\s.*$/, '').replace(/\s*\/\/ \[!code[^\]]*\]$/, '').trim()
      if (!line || line.startsWith('#') || line.startsWith('-') || line.endsWith('\\') || seen.has(line)) continue
      seen.add(line)
      out.push({ command: line, route: b.route })
    }
  }
  return out
}

/** File names code blocks are captioned with, and the config keys their blocks set at the top level. */
export function configIn(blocks: CodeBlock[]): { files: { name: string; routes: string[] }[]; keys: string[] } {
  const files = new Map<string, Set<string>>()
  const keys = new Set<string>()
  for (const b of blocks) {
    if (!b.title || /\s/.test(b.title) || !/\.[a-z]+$/i.test(b.title) || SHELL.has(b.lang)) continue
    if (!files.has(b.title)) files.set(b.title, new Set())
    files.get(b.title)!.add(b.route)
    if (!/config|settings/i.test(b.title)) continue
    // Keys one level inside the outermost object, or at the top of a YAML/TOML file.
    const indent = /\.(ya?ml|toml)$/i.test(b.title) ? '' : '\\s{2}'
    for (const m of b.code.matchAll(new RegExp(`^${indent}["']?([A-Za-z_$][\\w$-]*)["']?\\s*[:=]`, 'gm'))) keys.add(m[1])
  }
  return { files: [...files].map(([name, routes]) => ({ name, routes: [...routes] })), keys: [...keys] }
}

/** The docs pages of the default locale's current version, in sidebar order. */
function docsPages(config: ResolvedConfig, pages: PageMeta[], folders: Parameters<typeof docsNav>[2]): PageMeta[] {
  const layers = new Map<string, PageMeta['layout']>([['/', config.layout]])
  for (const l of config.layers) layers.set(l.path, l.layout)
  const out: PageMeta[] = []
  for (const [path, layout] of layers) out.push(...(layout === 'blog' ? postsOf(pages, path) : flatten(docsNav(pages, path, folders))))
  const def = config.i18n?.defaultLocale
  const seen = new Set<string>()
  return out.filter((p) => p.file && !p.noindex && !p.fallback && !p.version && (!def || (p.locale ?? def) === def) && !seen.has(p.route) && seen.add(p.route))
}

/** The deterministic SKILL.md for the site. */
export async function skillOutline(config: ResolvedConfig): Promise<{ name: string; markdown: string }> {
  const { pages, folders } = await scanSite(config)
  const docs = docsPages(config, pages, folders)
  const blocks: CodeBlock[] = []
  const generated = (p: PageMeta) => p.file.startsWith('.novon/generated/')
  for (const p of docs.filter((p) => !generated(p))) blocks.push(...codeBlocks(matter((await pageSource(config, p.file)).code).content, p.route))
  const name = skillName(config.title)
  const about = config.description ? ` ${config.description.replace(/\s+/g, ' ').replace(/\.?$/, '.')}` : ''
  const description = `Work with ${config.title}.${about} Use it when a task involves ${config.title}: its setup, commands, configuration or API.`.slice(0, 1024)
  const link = (p: PageMeta) => `[${p.title}](${absolute(config, markdownPath(p.route))})`
  const lines = ['---', `name: ${name}`, `description: ${JSON.stringify(description)}`, '---', '', `# ${config.title}`, '', '## Purpose', '']
  lines.push(`${config.description ? `${config.description.replace(/\.?$/, '.')} ` : ''}Use this skill to answer questions about ${config.title} and to make changes that follow its documentation.`)

  lines.push('', '## Key pages', '')
  // Written pages, and only the overview of generated API references.
  const top = docs.filter((p) => !generated(p) || p.file.endsWith('/index.mdx')).slice(0, 40)
  for (const p of top) lines.push(`- ${link(p)}${p.description ? `: ${p.description}` : ''}`)

  const commands = commandsIn(blocks).slice(0, 30)
  if (commands.length) {
    lines.push('', '## Commands', '', 'From the docs, with the page that explains each:', '')
    const byRoute = new Map(docs.map((p) => [p.route, p]))
    for (const c of commands) lines.push(`- \`${c.command.replace(/`/g, "'")}\` (${link(byRoute.get(c.route)!)})`)
  }

  const cfg = configIn(blocks)
  if (cfg.files.length || cfg.keys.length) {
    lines.push('', '## Configuration', '')
    if (cfg.files.length) lines.push(`Files the docs show: ${cfg.files.slice(0, 20).map((f) => `\`${f.name}\``).join(', ')}.`)
    if (cfg.keys.length) lines.push(`${cfg.files.length ? '\n' : ''}Keys set in config examples: ${cfg.keys.slice(0, 60).map((k) => `\`${k}\``).join(', ')}.`)
  }

  lines.push('', '## Reading the docs', '')
  lines.push(`- Every page is plain Markdown at its URL plus \`.md\`, e.g. ${absolute(config, '/index.md')}.`)
  if ((config.plugins ?? []).includes('llms')) lines.push(`- ${absolute(config, '/llms-full.txt')} has every page in one file.`)
  return { name, markdown: `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n` }
}

/** The prompt asking the agent to improve the outline. */
export function refinePrompt(config: ResolvedConfig, outline: string, docsFile: string): string {
  return [
    `Improve this agent skill (SKILL.md) for ${config.title}. The full documentation is in the file ${docsFile}.`,
    '',
    'Rules:',
    '- Reply with the whole SKILL.md only: no explanation, no surrounding code fence.',
    '- Keep the frontmatter `name` exactly; you may rewrite `description` (at most 1024 characters, saying when to use the skill).',
    '- Keep it short: the tasks people do with this project, the commands and config they need, pitfalls the docs warn about, and links to the pages to read.',
    '- Use only facts from the documentation; keep the links as they are.',
    '',
    'Current SKILL.md:',
    '',
    outline,
  ].join('\n')
}

export interface SkillResult {
  name: string
  file: string
  markdown: string
  refined: boolean
  warning?: string
}

/** Writes `skills/<name>/SKILL.md`, refined by the agent when one is given. */
export async function writeSkill(config: ResolvedConfig, opts: { agent?: Agent | null; dryRun?: boolean } = {}): Promise<SkillResult> {
  const { name, markdown } = await skillOutline(config)
  const folder = config.agents !== false && typeof config.agents?.skills === 'string' ? config.agents.skills : 'skills'
  const file = join(config.root, folder, name, 'SKILL.md')
  let out = markdown
  let refined = false
  let warning: string | undefined
  if (opts.agent && !opts.dryRun) {
    const docs = docsFilePath(config)
    await mkdir(join(docs, '..'), { recursive: true })
    await writeFile(docs, (await corpus(config)).full)
    try {
      const r = await runAgent(opts.agent, refinePrompt(config, markdown, docs), { cwd: config.root })
      const text = unfence(r.stdout)
      let ok = false
      try {
        ok = r.ok && matter(text).data.name === name && String(matter(text).data.description ?? '').length > 0
      } catch {}
      if (ok) {
        out = `${text.trimEnd()}\n`
        refined = true
      } else warning = r.ok ? `the agent's SKILL.md did not keep \`name: ${name}\` and a description; wrote the outline` : `the agent failed (${r.stderr.trim().split('\n').at(-1) || `exit ${r.code}`}); wrote the outline`
    } finally {
      await rm(docs, { force: true })
    }
  }
  if (!opts.dryRun) {
    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, out)
  }
  return { name, file, markdown: out, refined, ...(warning ? { warning } : {}) }
}
