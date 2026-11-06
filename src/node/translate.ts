/**
 * `novon translate <locale>`: pages of the default locale that are missing or
 * stale in `content/<locale>/`, translated by the local agent.
 *
 * A translation records the source it came from in frontmatter
 * `translatedFrom` (a short content hash). Without it, a source committed or
 * modified after its translation counts as stale.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import type { ResolvedConfig } from '../types.ts'
import { type Agent, runAgent, unfence } from './agent.ts'

export type TranslationStatus = 'missing' | 'stale' | 'current'

export interface TranslationItem {
  /** Path under `content/`, e.g. `guide/index.mdx`. */
  file: string
  source: string
  target: string
  status: TranslationStatus
  /** Why it is stale. */
  reason?: string
  hash: string
}

/** First 12 hex digits of the SHA-256 of a source file. */
export function sourceHash(text: string): string {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex').slice(0, 12)
}

/** `translatedFrom` in a file's frontmatter. */
export function translatedFrom(text: string): string | undefined {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const line = fm?.[1].match(/^translatedFrom:\s*["']?([^"'\s]+)["']?\s*$/m)
  return line?.[1]
}

/** The text with `translatedFrom: <hash>` in its frontmatter, added or replaced. */
export function withTranslatedFrom(text: string, hash: string): string {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fm) return `---\ntranslatedFrom: ${hash}\n---\n\n${text}`
  const body = /^translatedFrom:.*$/m.test(fm[1]) ? fm[1].replace(/^translatedFrom:.*$/m, `translatedFrom: ${hash}`) : `${fm[1]}\ntranslatedFrom: ${hash}`
  return `---\n${body}\n---${text.slice(fm[0].length)}`
}

async function walk(dir: string, skip: Set<string>, base = dir): Promise<string[]> {
  const out: string[] = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (dir === base && skip.has(e.name)) continue
      out.push(...(await walk(full, skip, base)))
    } else if (/\.mdx?$/.test(e.name)) out.push(relative(base, full))
  }
  return out.sort()
}

function lastChange(root: string, file: string): number | null {
  const r = spawnSync('git', ['log', '-1', '--format=%ct', '--', file], { cwd: root, encoding: 'utf8' })
  const t = r.status === 0 ? Number(r.stdout.trim()) : Number.NaN
  if (!Number.isFinite(t) || !t) return null
  const dirty = spawnSync('git', ['status', '--porcelain', '--', file], { cwd: root, encoding: 'utf8' })
  return dirty.status === 0 && dirty.stdout.trim() ? null : t * 1000
}

async function modified(root: string, file: string): Promise<number> {
  return lastChange(root, file) ?? (await stat(file)).mtimeMs
}

function checkLocale(config: ResolvedConfig, locale: string): void {
  if (!config.i18n) throw new Error('novon translate needs `i18n` in the config, with the locale to translate into')
  if (locale === config.i18n.defaultLocale) throw new Error(`"${locale}" is the default locale; name the locale to translate into`)
  if (!config.i18n.locales.some((l) => l.code === locale)) throw new Error(`no locale "${locale}"; the site has ${config.i18n.locales.map((l) => l.code).join(', ')}`)
}

/** Every page of the default locale and the state of its translation. */
export async function translationStatus(config: ResolvedConfig, locale: string, opts: { only?: string } = {}): Promise<TranslationItem[]> {
  checkLocale(config, locale)
  const content = join(config.root, 'content')
  const others = new Set(config.i18n!.locales.map((l) => l.code).filter((c) => c !== config.i18n!.defaultLocale))
  const glob = opts.only ? new Bun.Glob(opts.only) : null
  const items: TranslationItem[] = []
  for (const file of await walk(content, others)) {
    if (glob && !glob.match(file)) continue
    const source = join(content, file)
    const target = join(content, locale, file)
    const text = await readFile(source, 'utf8')
    const hash = sourceHash(text)
    if (!existsSync(target)) {
      items.push({ file, source, target, status: 'missing', hash })
      continue
    }
    const recorded = translatedFrom(await readFile(target, 'utf8'))
    if (recorded) {
      items.push({ file, source, target, hash, status: recorded === hash ? 'current' : 'stale', ...(recorded === hash ? {} : { reason: 'source changed since it was translated' }) })
      continue
    }
    const newer = (await modified(config.root, source)) > (await modified(config.root, target))
    items.push({ file, source, target, hash, status: newer ? 'stale' : 'current', ...(newer ? { reason: 'source is newer' } : {}) })
  }
  return items
}

/** The prompt that asks the agent for one page's translation. */
export function translationPrompt(config: ResolvedConfig, locale: string, item: TranslationItem, source: string, existing?: string): string {
  const l = config.i18n!.locales.find((x) => x.code === locale)!
  const from = config.i18n!.locales.find((x) => x.code === config.i18n!.defaultLocale)!
  const lines = [
    `Translate this page of the ${config.title} documentation from ${from.label} (${from.lang}) into ${l.label} (${l.lang}).`,
    '',
    'Rules:',
    '- Reply with the translated file only: no explanation, no surrounding code fence.',
    '- Keep the frontmatter keys; translate the values of title, description and label only.',
    '- Keep MDX components, their names and their props unchanged; translate the text between tags and string props a reader sees (title, label).',
    '- Keep code blocks, inline code, URLs, link targets, heading anchors written as {#id}, and variables like {version} unchanged.',
    '- Keep the Markdown structure: the same headings, lists, tables and blank lines.',
    ...(existing ? ['- An earlier translation follows the source; reuse its wording where the source did not change.'] : []),
    '',
    `Source (content/${item.file}):`,
    '',
    source,
  ]
  if (existing) lines.push('', `Earlier translation (content/${locale}/${item.file}):`, '', existing)
  return `${lines.join('\n').trimEnd()}\n`
}

export interface TranslateResult {
  written: string[]
  failed: { file: string; message: string }[]
}

/** Translates the given pages one by one and writes each into `content/<locale>/`. */
export async function translatePages(config: ResolvedConfig, locale: string, items: TranslationItem[], agent: Agent, onPage?: (item: TranslationItem, ok: boolean) => void): Promise<TranslateResult> {
  const written: string[] = []
  const failed: TranslateResult['failed'] = []
  for (const item of items) {
    const source = await readFile(item.source, 'utf8')
    const existing = item.status === 'stale' ? await readFile(item.target, 'utf8') : undefined
    const r = await runAgent(agent, translationPrompt(config, locale, item, source, existing), { cwd: config.root })
    const out = unfence(r.stdout)
    if (!r.ok || !out.trim()) {
      failed.push({ file: item.file, message: r.ok ? 'the agent printed nothing' : (r.stderr.trim().split('\n').at(-1) ?? `exit ${r.code}`) })
      onPage?.(item, false)
      continue
    }
    await mkdir(dirname(item.target), { recursive: true })
    await writeFile(item.target, `${withTranslatedFrom(out, item.hash).trimEnd()}\n`)
    written.push(item.target)
    onPage?.(item, true)
  }
  return { written, failed }
}
