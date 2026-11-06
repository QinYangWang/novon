/**
 * A page's source before anything reads it: partials are inlined, `{{name}}`
 * variables filled in, then every plugin's `transformContent` runs. The
 * compiler, the page index, `novon check` and the `.md` writer all read pages
 * through `pageSource`, so they agree on what a page says.
 *
 *   <Partial file="install" version="2" />   content/_partials/install.mdx, with {{version}} = 2
 */
import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { ResolvedConfig } from '../types.ts'

export interface SourceProblem {
  message: string
  /** 1-based line in the page's own file. */
  line: number
}

export interface Expanded {
  code: string
  problems: SourceProblem[]
  /** Partial files this page includes, relative to the site root. */
  partials: string[]
}

const PARTIAL = /^([ \t]*)<Partial\s+([^>]*?)\/>[ \t]*$/gm
const ATTR = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|(-?\d+(?:\.\d+)?|true|false))\s*\})/g
const VARIABLE = /(\\?)\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g
const FENCE = /^ {0,3}(`{3,}|~{3,})/

export const PARTIALS_DIR = 'content/_partials'

function attributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of raw.matchAll(ATTR)) out[m[1]] = m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? ''
  return out
}

const lineAt = (source: string, offset: number) => source.slice(0, offset).split('\n').length

/** `install` → content/_partials/install.mdx; `./x.md` is relative to the including file. */
export function partialPath(root: string, from: string, name: string): string | null {
  const candidates = name.startsWith('.') ? [resolve(root, dirname(from), name)] : [join(root, PARTIALS_DIR, name)]
  for (const base of candidates) {
    for (const file of [base, `${base}.mdx`, `${base}.md`]) if (existsSync(file) && /\.mdx?$/.test(file)) return file
  }
  return null
}

const stripFrontmatter = (s: string) => s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')

/** Lines inside fenced code blocks, which partial tags in them do not expand. */
function fencedRanges(source: string): [number, number][] {
  const ranges: [number, number][] = []
  let open: { marker: string; start: number } | null = null
  let offset = 0
  for (const line of source.split('\n')) {
    const m = line.match(FENCE)
    if (m) {
      if (!open) open = { marker: m[1], start: offset }
      else if (m[1][0] === open.marker[0] && m[1].length >= open.marker.length && line.trim() === m[1]) {
        ranges.push([open.start, offset + line.length])
        open = null
      }
    }
    offset += line.length + 1
  }
  if (open) ranges.push([open.start, source.length])
  return ranges
}

function expandPartials(source: string, root: string, file: string, depth: number, seen: string[], out: Expanded, line?: number): string {
  const fenced = fencedRanges(source)
  return source.replace(PARTIAL, (match, indent: string, raw: string, offset: number) => {
    if (fenced.some(([a, b]) => offset >= a && offset <= b)) return match
    const at = line ?? lineAt(source, offset)
    const props = attributes(raw)
    const name = props.file ?? props.src
    if (!name) {
      out.problems.push({ message: '<Partial> needs a `file`', line: at })
      return match
    }
    const path = partialPath(root, file, name)
    if (!path) {
      out.problems.push({ message: `No partial "${name}" (looked in ${name.startsWith('.') ? dirname(file) : PARTIALS_DIR})`, line: at })
      return ''
    }
    const rel = relative(root, path).split(sep).join('/')
    if (seen.includes(rel) || depth > 8) {
      out.problems.push({ message: `Partial ${rel} includes itself`, line: at })
      return ''
    }
    if (!out.partials.includes(rel)) out.partials.push(rel)
    let body = stripFrontmatter(readFileSync(path, 'utf8')).replace(/\s+$/, '')
    // The tag's own attributes fill the partial's {{variables}} first.
    body = body.replace(VARIABLE, (m, escape: string, key: string) => (!escape && key in props && key !== 'file' ? props[key] : m))
    body = expandPartials(body, root, rel, depth + 1, [...seen, rel], out, at)
    return body
      .split('\n')
      .map((l) => (l ? indent + l : l))
      .join('\n')
  })
}

/** Whether `offset` is inside an inline code span on its line. */
function inInlineCode(source: string, offset: number): boolean {
  const start = source.lastIndexOf('\n', offset - 1) + 1
  return ((source.slice(start, offset).match(/`+/g) ?? []).length) % 2 === 1
}

function fillVariables(source: string, variables: Record<string, unknown>, out: Expanded): string {
  const fenced = fencedRanges(source)
  return source.replace(VARIABLE, (m, escape: string, key: string, offset: number) => {
    const code = fenced.some(([a, b]) => offset >= a && offset <= b) || inInlineCode(source, offset)
    // `\{{name}}` keeps the braces: as is in code, escaped for MDX in prose.
    if (escape) return code ? m.slice(1) : '\\{\\{' + m.slice(3)
    if (key in variables) return String(variables[key])
    // Unknown names in code are left alone (templates in examples); in prose they would not compile.
    if (!code) out.problems.push({ message: `Unknown variable {{${key}}}; set it in \`variables\``, line: lineAt(source, offset) })
    return m
  })
}

/** Partials and variables, without plugins. */
export function expandSource(source: string, config: Pick<ResolvedConfig, 'root' | 'variables'>, file: string): Expanded {
  const out: Expanded = { code: source, problems: [], partials: [] }
  let code = source.includes('<Partial') ? expandPartials(source, config.root, file, 0, [file], out) : source
  if (code.includes('{{')) code = fillVariables(code, config.variables ?? {}, out)
  out.code = code
  return out
}

/** A page's source as every reader sees it: partials, variables, then plugins. */
export async function transformSource(config: ResolvedConfig, file: string, source: string): Promise<Expanded> {
  const expanded = expandSource(source, config, file)
  const { activePlugins } = await import('./plugins.ts')
  for (const plugin of activePlugins(config)) {
    if (!plugin.transformContent) continue
    const next = await plugin.transformContent(expanded.code, { config, file })
    if (typeof next === 'string') expanded.code = next
  }
  return expanded
}

/** Reads a page file (relative to the site root) and transforms it. */
export async function pageSource(config: ResolvedConfig, file: string): Promise<Expanded> {
  return transformSource(config, file, await readFile(join(config.root, file), 'utf8'))
}
