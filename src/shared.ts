/** Helpers shared by the build and the browser runtime. No Node imports here. */
import GithubSlugger from 'github-slugger'
import type { Layer, LayoutKind, PageMeta } from './types.ts'

export function humanize(segment: string): string {
  const s = segment.replace(/^\d+[-_.]/, '').replace(/[-_]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** The layer owning a route: the longest segment prefix wins. */
export function layerFor(route: string, layers: Layer[], fallback: LayoutKind): { path: string; layout: LayoutKind } {
  let best: { path: string; layout: LayoutKind } = { path: '/', layout: fallback }
  for (const layer of layers) {
    const p = layer.path
    const owns = p === '/' || route === p || route.startsWith(`${p}/`)
    if (owns && p.length >= best.path.length) best = { path: p, layout: layer.layout }
  }
  return best
}

/** Posts of a blog layer: its dated pages, newest first. */
export function postsOf(pages: PageMeta[], layer: string): PageMeta[] {
  return pages
    .filter((p) => p.kind === 'page' && p.layer === layer && p.route !== layer && !p.hidden && !!p.date)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title))
}

export function tagSlug(tag: string): string {
  return new GithubSlugger().slug(tag)
}

export function tagRoute(layer: string, tag: string): string {
  return `${layer === '/' ? '' : layer}/tags/${tagSlug(tag)}`
}

/** `/guide` + base `/docs/` → `/docs/guide`. */
export function withBase(base: string, route: string): string {
  if (/^[a-z]+:|^#/i.test(route)) return route
  if (base === '/') return route
  return `${base.replace(/\/$/, '')}${route === '/' ? '/' : route}`
}

/** Inverse of withBase; returns null when the path is outside the site. */
export function stripBase(base: string, path: string): string | null {
  const clean = path.replace(/\/index\.html$/, '/').replace(/\.html$/, '')
  if (base === '/') return normalizeRoute(clean)
  const b = base.replace(/\/$/, '')
  if (clean !== b && !clean.startsWith(`${b}/`)) return null
  return normalizeRoute(clean.slice(b.length) || '/')
}

export function normalizeRoute(path: string): string {
  const p = `/${path.replace(/^\/+|\/+$/g, '')}`
  return p
}

export function formatDate(value: string | undefined, lang = 'en'): string {
  if (!value) return ''
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' })
}
