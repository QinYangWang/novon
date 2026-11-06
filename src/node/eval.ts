/**
 * `novon eval`: questions a reader might ask, and phrases a good answer contains,
 * kept in `evals.json` next to the config.
 *
 * - Offline (or without an agent): each check passes when its expected phrases
 *   appear in the docs, all pages or the ones it names. This catches docs that
 *   lost an answer.
 * - With an agent: it answers each question from the docs as one Markdown file,
 *   and the answer must contain the expected phrases.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PageMeta, ResolvedConfig } from '../types.ts'
import { normalizeRoute } from '../shared.ts'
import { scanSite } from './content.ts'
import { llmsFull, pageMarkdown } from './plugins.ts'
import { type Agent, runAgent } from './agent.ts'

export interface EvalCheck {
  question: string
  /** Phrases the answer (or the docs, offline) must contain. Case and spacing do not matter. */
  expect: string[]
  /** Routes the answer should come from, e.g. `/guide/search`. Offline, only these pages are searched. */
  pages?: string[]
}

export interface EvalResult {
  check: EvalCheck
  ok: boolean
  /** Expected phrases that were not found. */
  missing: string[]
  /** The agent's answer, when one was asked. */
  answer?: string
  error?: string
}

export const EVALS_FILE = 'evals.json'

/** The checks in `evals.json`: an array, or `{ checks: [...] }`. */
export async function readEvals(root: string): Promise<EvalCheck[]> {
  const file = join(root, EVALS_FILE)
  if (!existsSync(file)) return []
  const data = JSON.parse(await readFile(file, 'utf8'))
  const list = Array.isArray(data) ? data : data?.checks
  if (!Array.isArray(list)) throw new Error(`${EVALS_FILE} should be an array of { question, expect } checks`)
  return list.map((c, i) => {
    const expect = typeof c?.expect === 'string' ? [c.expect] : c?.expect
    if (typeof c?.question !== 'string' || !Array.isArray(expect) || !expect.every((e: unknown) => typeof e === 'string')) throw new Error(`${EVALS_FILE}[${i}]: needs \`question\` (string) and \`expect\` (strings)`)
    return { question: c.question, expect, ...(Array.isArray(c.pages) ? { pages: c.pages.map(String) } : {}) }
  })
}

const norm = (s: string) => s.toLowerCase().replace(/[`*_]/g, '').replace(/\s+/g, ' ')

/** Expected phrases not in the text. */
export function missingPhrases(text: string, expect: string[]): string[] {
  const t = norm(text)
  return expect.filter((e) => !t.includes(norm(e).trim()))
}

export interface Corpus {
  /** Every page of the default locale's current docs in one Markdown file, as llms-full.txt has them. */
  full: string
  /** Each page's Markdown by route. */
  pages: Map<string, string>
}

/** The docs as Markdown, the way llms-full.txt and `<route>.md` have them. */
export async function corpus(config: ResolvedConfig): Promise<Corpus> {
  const { pages } = await scanSite(config)
  const markdown = new Map<string, string>()
  for (const p of pages) if (p.file && !p.fallback) markdown.set(p.route, await pageMarkdown(config, p, pages))
  const def = config.i18n?.defaultLocale
  const docs = pages.filter((p: PageMeta) => p.kind === 'page' && p.file && !p.fallback && !p.version && !p.noindex && !p.hidden && (!def || (p.locale ?? def) === def))
  return { full: llmsFull(config, docs, markdown), pages: markdown }
}

/** Checks each question against the docs themselves. */
export function evalOffline(checks: EvalCheck[], docs: Corpus): EvalResult[] {
  return checks.map((check) => {
    if (check.pages?.length) {
      const unknown = check.pages.filter((r) => !docs.pages.has(normalizeRoute(r)))
      if (unknown.length) return { check, ok: false, missing: check.expect, error: `no page ${unknown.join(', ')}` }
      const text = check.pages.map((r) => docs.pages.get(normalizeRoute(r))!).join('\n\n')
      const missing = missingPhrases(text, check.expect)
      return { check, ok: !missing.length, missing }
    }
    const missing = missingPhrases(docs.full, check.expect)
    return { check, ok: !missing.length, missing }
  })
}

/** The prompt for one question, answered from the docs file the agent is given. */
export function questionPrompt(config: ResolvedConfig, check: EvalCheck, docsFile: string): string {
  return [
    `You are answering a question about ${config.title} using only its documentation, which is in the file ${docsFile}.`,
    'Read that file, then answer in a few sentences. Quote exact names of commands, options and config keys. Do not edit any file.',
    ...(check.pages?.length ? [`The answer is on: ${check.pages.join(', ')}.`] : []),
    '',
    `Question: ${check.question}`,
    '',
  ].join('\n')
}

/** Where the docs go for the agent to read. */
export function docsFilePath(config: ResolvedConfig): string {
  return join(config.root, '.novon', 'eval', 'llms-full.txt')
}

/** Asks the agent each question and grades its answers. */
export async function evalWithAgent(config: ResolvedConfig, checks: EvalCheck[], docs: Corpus, agent: Agent, onCheck?: (r: EvalResult) => void): Promise<EvalResult[]> {
  const file = docsFilePath(config)
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, docs.full)
  const out: EvalResult[] = []
  try {
    for (const check of checks) {
      const r = await runAgent(agent, questionPrompt(config, check, file), { cwd: config.root })
      const answer = r.stdout.trim()
      const result: EvalResult = r.ok ? { check, answer, missing: missingPhrases(answer, check.expect), ok: false } : { check, answer, missing: check.expect, ok: false, error: r.stderr.trim().split('\n').at(-1) || `exit ${r.code}` }
      result.ok = r.ok && !result.missing.length
      out.push(result)
      onCheck?.(result)
    }
  } finally {
    await rm(file, { force: true })
  }
  return out
}

/** The prompt that asks the agent to draft new checks. */
export function generatePrompt(config: ResolvedConfig, n: number, docsFile: string, existing: EvalCheck[]): string {
  return [
    `Write ${n} evaluation checks for the ${config.title} documentation, which is in the file ${docsFile}.`,
    'Each check is a question a new user would ask, and 1 to 3 short phrases that appear word for word in the documentation and that a correct answer must contain (command names, option names, config keys, values).',
    'Prefer questions whose answer is on one page, and give that page route.',
    ...(existing.length ? [`Do not repeat these questions: ${existing.map((c) => JSON.stringify(c.question)).join('; ')}.`] : []),
    '',
    'Reply with a JSON array only, no explanation:',
    '[{ "question": "…", "expect": ["…"], "pages": ["/route"] }]',
    '',
  ].join('\n')
}

/** The first JSON array in an answer, as checks. */
export function parseChecks(text: string): EvalCheck[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end < start) throw new Error('the agent did not reply with a JSON array')
  const data = JSON.parse(text.slice(start, end + 1))
  if (!Array.isArray(data)) throw new Error('the agent did not reply with a JSON array')
  return data
    .filter((c) => typeof c?.question === 'string' && (Array.isArray(c.expect) || typeof c.expect === 'string'))
    .map((c) => ({ question: c.question, expect: (Array.isArray(c.expect) ? c.expect : [c.expect]).map(String), ...(Array.isArray(c.pages) && c.pages.length ? { pages: c.pages.map(String) } : {}) }))
}

/** Asks the agent for `n` checks; keeps those whose phrases are really in the docs and appends them to evals.json. */
export async function generateEvals(config: ResolvedConfig, n: number, docs: Corpus, agent: Agent): Promise<{ added: EvalCheck[]; dropped: EvalCheck[] }> {
  const existing = await readEvals(config.root)
  const file = docsFilePath(config)
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, docs.full)
  let text: string
  try {
    const r = await runAgent(agent, generatePrompt(config, n, file, existing), { cwd: config.root })
    if (!r.ok) throw new Error(`the agent failed: ${r.stderr.trim().split('\n').at(-1) || `exit ${r.code}`}`)
    text = r.stdout
  } finally {
    await rm(file, { force: true })
  }
  const drafted = parseChecks(text)
  const results = evalOffline(drafted, docs)
  const added = results.filter((r) => r.ok).map((r) => r.check)
  const dropped = results.filter((r) => !r.ok).map((r) => r.check)
  if (added.length) await writeFile(join(config.root, EVALS_FILE), `${JSON.stringify([...existing, ...added], null, 2)}\n`)
  return { added, dropped }
}
