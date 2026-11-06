/**
 * Redirects from config `redirects` and frontmatter `redirectFrom`. The build
 * writes them to `_redirects` for hosts that read it and as small HTML pages
 * that forward the browser, so hosts without redirect rules work too.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { withBase } from '../shared.ts'
import type { PageMeta, ResolvedConfig } from '../types.ts'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const isExternal = (to: string) => /^[a-z][a-z0-9+.-]*:/i.test(to)

/** Old route → new route or URL. Frontmatter `redirectFrom` adds to config `redirects`. */
export function collectRedirects(config: ResolvedConfig, pages: PageMeta[]): Record<string, string> {
  const out: Record<string, string> = { ...config.redirects }
  for (const p of pages) for (const from of p.redirectFrom ?? []) out[from] ??= p.route
  return out
}

/** Where a redirect sends the browser: a URL as is, a route under the base. */
export function redirectTarget(config: ResolvedConfig, to: string): string {
  return isExternal(to) ? to : withBase(config.base, to)
}

/** A page that forwards to `to`, keeping the hash. */
export function redirectPage(config: ResolvedConfig, to: string): string {
  const target = redirectTarget(config, to)
  const canonical = !isExternal(to) && config.url ? new URL(target, config.url).href : target
  const script = JSON.stringify(target).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="${esc(config.lang)}">
<head>
<meta charset="utf-8">
<title>${esc(config.title)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(canonical)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<script>location.replace(${script} + location.search + location.hash)</script>
</head>
<body><a href="${esc(target)}">${esc(target)}</a></body>
</html>
`
}

/** `_redirects` lines: `from to 301`, paths under the base. */
export function redirectRules(config: ResolvedConfig, redirects: Record<string, string>): string {
  return Object.entries(redirects)
    .map(([from, to]) => `${withBase(config.base, from)} ${redirectTarget(config, to)} 301`)
    .join('\n')
}

/** Exact-path rules from a `_redirects` file; splats and placeholders are left to the host. */
export async function readRedirectRules(dist: string): Promise<Map<string, { to: string; status: number }>> {
  const rules = new Map<string, { to: string; status: number }>()
  const file = join(dist, '_redirects')
  if (!existsSync(file)) return rules
  for (const raw of (await readFile(file, 'utf8')).split('\n')) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const [from, to, status] = line.split(/\s+/)
    if (!from || !to || from.includes('*') || from.includes(':')) continue
    const code = Number.parseInt(status ?? '301', 10)
    rules.set(from.replace(/\/+$/, '') || '/', { to, status: code >= 300 && code < 400 ? code : 301 })
  }
  return rules
}
