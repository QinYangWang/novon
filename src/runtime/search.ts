/**
 * Site search over search.json, shared by the search palette and the WebMCP
 * tools. Every entry is a page or one of its heading sections. Latin words
 * match by prefix; Chinese, Japanese and Korean text, which has no spaces,
 * matches by overlapping pairs of characters, so 配置文件 finds 配置 and 文件.
 * No Node or React imports here.
 */
import { withBase } from '../shared.ts'

export interface SearchEntry {
  route: string
  /** Page title. */
  title: string
  /** The sidebar section or `Posts`. */
  section?: string
  description?: string
  icon?: string
  /** Set on a section entry: its heading and the heading's id. */
  heading?: string
  anchor?: string
  /** Headings of the page, on its page entry. */
  headings?: string[]
  /** Plain text: the page's opening, or the section's body. */
  text?: string
}

export interface SearchResult {
  entry: SearchEntry
  /** Route plus `#anchor` for a section. */
  href: string
  score: number
  /** A short piece of text around the first match. */
  excerpt: string
}

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/
const CJK_RUN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]+/g
const WORD = /[\p{L}\p{N}_]+/gu

export const normalize = (s: string) => s.normalize('NFKC').toLowerCase()

/** Query terms: Latin words, and CJK runs as pairs of characters (single characters stay). */
export function tokenize(text: string): string[] {
  const s = normalize(text)
  const out: string[] = []
  for (const run of s.match(CJK_RUN) ?? []) {
    if (run.length === 1) out.push(run)
    for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2))
  }
  for (const w of s.replace(CJK_RUN, ' ').match(WORD) ?? []) out.push(w)
  return [...new Set(out)]
}

interface Prepared {
  entry: SearchEntry
  title: string
  heading: string
  description: string
  text: string
}

const prepared = new WeakMap<SearchEntry[], Prepared[]>()

function prepare(entries: SearchEntry[]): Prepared[] {
  let list = prepared.get(entries)
  if (!list) {
    list = entries.map((entry) => ({
      entry,
      title: normalize(entry.title),
      heading: normalize(entry.heading ?? ''),
      description: normalize(entry.description ?? ''),
      text: normalize(entry.text ?? ''),
    }))
    prepared.set(entries, list)
  }
  return list
}

/** Where `term` occurs in `field`: 2 at a word start or anywhere for CJK, 1 inside a word, 0 not at all. */
function hit(field: string, term: string): number {
  let i = field.indexOf(term)
  if (i < 0) return 0
  if (CJK.test(term)) return 2
  while (i >= 0) {
    if (i === 0 || !/[\p{L}\p{N}]/u.test(field[i - 1])) return 2
    i = field.indexOf(term, i + 1)
  }
  return 1
}

/** A piece of `text` around the first term found, at most `size` characters. */
export function excerpt(text: string, terms: string[], size = 160): string {
  const lower = normalize(text)
  const at = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, at - Math.floor(size / 3))
  const piece = text.slice(start, start + size).trim()
  return `${start > 0 ? '…' : ''}${piece}${start + size < text.length ? '…' : ''}`
}

/**
 * Entries matching every term of the query, best first: a term in the heading
 * or title counts most, then the description, then the text. The whole query
 * as one phrase adds to the score.
 */
export function search(entries: SearchEntry[], query: string, limit = 20): SearchResult[] {
  const terms = tokenize(query)
  if (!terms.length) return []
  const phrase = normalize(query).trim()
  const results: SearchResult[] = []
  for (const p of prepare(entries)) {
    let score = 0
    let all = true
    for (const term of terms) {
      const h = hit(p.heading, term)
      const t = hit(p.title, term)
      const d = hit(p.description, term)
      const x = hit(p.text, term)
      if (!h && !t && !d && !x) {
        all = false
        break
      }
      score += h * 6 + t * (p.entry.heading ? 2 : 5) + d * 2 + x
    }
    if (!all) continue
    if (phrase.length > 1) {
      if (p.heading.includes(phrase) || (!p.entry.heading && p.title.includes(phrase))) score += 10
      else if (p.text.includes(phrase)) score += 3
    }
    // A page entry outranks its own sections when the page title is what matched.
    if (!p.entry.heading) score += 0.5
    const href = p.entry.anchor ? `${p.entry.route}#${p.entry.anchor}` : p.entry.route
    results.push({ entry: p.entry, href, score, excerpt: excerpt(p.entry.text || p.entry.description || '', terms) })
  }
  return results.sort((a, b) => b.score - a.score || a.href.localeCompare(b.href)).slice(0, limit)
}

let cache: { base: string; promise: Promise<SearchEntry[]> } | null = null

/** search.json (or a locale's or version's index, e.g. `/ja/search.json`), fetched once per page load. */
export function loadSearchIndex(base: string, path = '/search.json'): Promise<SearchEntry[]> {
  const key = `${base}|${path}`
  if (!cache || cache.base !== key) {
    const promise = fetch(withBase(base, path))
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => (Array.isArray(data) ? (data as SearchEntry[]) : []))
      .catch(() => [] as SearchEntry[])
    cache = { base: key, promise }
    promise.then((list) => {
      if (!list.length && cache?.promise === promise) cache = null
    })
  }
  return cache.promise
}
