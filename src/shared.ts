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

export function tagSlug(tag: string, lowercase = true): string {
  return new GithubSlugger().slug(tag, !lowercase)
}

/** `/blog` + `Docker` → `/blog/tags/docker`; `{ path: '/tag', lowercase: false }` gives `/blog/tag/Docker`. */
export function tagRoute(layer: string, tag: string, options: { path?: string; lowercase?: boolean } = {}): string {
  const segment = (options.path ?? '/tags').replace(/^\/+|\/+$/g, '')
  return `${layer === '/' ? '' : layer}/${segment}/${tagSlug(tag, options.lowercase ?? true)}`
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

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export const packageManagers: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun']

export interface PackageCommandOptions {
  /** Space-separated packages to add. Without it (and without run, exec, create) the command installs dependencies. */
  packages?: string
  dev?: boolean
  global?: boolean
  /** A package.json script, e.g. `build` or `dev --port 3000`. */
  run?: string
  /** A package binary to run without installing, e.g. `novon new site`. */
  exec?: string
  /** A starter for `<manager> create`, e.g. `vite@latest my-app`. */
  create?: string
  /** Which managers to show, in order. Default npm, pnpm, yarn, bun. */
  managers?: string[]
}

/** The same command for each package manager. */
export function packageCommands(o: PackageCommandOptions): { manager: PackageManager; command: string }[] {
  const managers = (o.managers?.length ? o.managers : packageManagers).filter((m): m is PackageManager => (packageManagers as string[]).includes(m))
  return managers.map((manager) => ({ manager, command: packageCommand(manager, o) }))
}

function packageCommand(pm: PackageManager, o: PackageCommandOptions): string {
  if (o.run) {
    const [script, ...args] = o.run.trim().split(/\s+/)
    const rest = args.length ? ` ${args.join(' ')}` : ''
    if (pm === 'npm') return `npm run ${script}${rest ? ` --${rest}` : ''}`
    if (pm === 'bun') return `bun run ${script}${rest}`
    return `${pm} ${script}${rest}`
  }
  if (o.exec) return { npm: 'npx', pnpm: 'pnpm dlx', yarn: 'yarn dlx', bun: 'bunx' }[pm] + ` ${o.exec.trim()}`
  if (o.create) return `${pm} create ${o.create.trim()}`
  const pkgs = o.packages?.trim()
  if (!pkgs) return { npm: 'npm install', pnpm: 'pnpm install', yarn: 'yarn', bun: 'bun install' }[pm]
  if (o.global) return { npm: `npm install -g ${pkgs}`, pnpm: `pnpm add -g ${pkgs}`, yarn: `yarn global add ${pkgs}`, bun: `bun add -g ${pkgs}` }[pm]
  const dev = o.dev ? ' -D' : ''
  return pm === 'npm' ? `npm install${dev} ${pkgs}` : `${pm} add${dev} ${pkgs}`
}

/** What routing needs to know about locales, versions and layers. */
export interface RouteShape {
  layout: LayoutKind
  /** Layers as written, without the ones locales and versions add. */
  baseLayers: Layer[]
  i18n?: { defaultLocale: string; locales: { code: string }[] }
}

/**
 * A page's route from its key (`/docs/guide`), locale and version: the locale
 * prefixes the route and the version follows the docs layer it belongs to,
 * `/ja/docs/v1/guide`. The default locale has no prefix.
 */
export function buildRoute(shape: RouteShape, key: string, locale?: string, version?: string): string {
  let route = normalizeRoute(key)
  if (version) {
    const layer = layerFor(route, shape.baseLayers, shape.layout)
    const p = layer.layout === 'docs' ? layer.path : '/'
    const rest = route.slice(p === '/' ? 0 : p.length)
    route = normalizeRoute(`${p === '/' ? '' : p}/${version}${rest === '/' ? '' : rest}`)
  }
  if (locale && shape.i18n && locale !== shape.i18n.defaultLocale) route = normalizeRoute(`/${locale}${route === '/' ? '' : route}`)
  return route
}

/** The locale a route belongs to, from its first segment. */
export function routeLocale(shape: RouteShape, route: string): string | undefined {
  if (!shape.i18n) return undefined
  const first = route.split('/')[1]
  return shape.i18n.locales.some((l) => l.code === first && l.code !== shape.i18n!.defaultLocale) ? first : shape.i18n.defaultLocale
}

/** `/ja/guide` → `/guide` for a site with a `ja` locale. */
export function stripLocale(shape: RouteShape, route: string): string {
  const locale = routeLocale(shape, route)
  if (!locale || locale === shape.i18n?.defaultLocale) return route
  return normalizeRoute(route.slice(locale.length + 1))
}

/** Where the same page lives in another locale or version, else that locale's or version's home. */
export function counterpart(pages: PageMeta[], shape: RouteShape, page: { key?: string; route: string; locale?: string; version?: string }, to: { locale?: string; version?: string | null }): string {
  const key = page.key ?? page.route
  const locale = to.locale ?? page.locale
  const version = to.version === undefined ? page.version : (to.version ?? undefined)
  const found = pages.find((p) => (p.key ?? p.route) === key && p.locale === locale && p.version === version && p.kind !== 'tag')
  if (found) return found.route
  // The nearest ancestor that exists there, down to that locale's home.
  const parts = key.split('/').filter(Boolean)
  while (parts.length) {
    parts.pop()
    const k = `/${parts.join('/')}`
    const up = pages.find((p) => (p.key ?? p.route) === k && p.locale === locale && p.version === version)
    if (up) return up.route
  }
  return buildRoute(shape, '/', locale, version)
}

const RELEASE_DATE = /\s*(?:[-–—·|,]\s*)?\(?(\d{4}-\d{2}-\d{2})\)?\s*$/

/** A changelog heading split into its release name and date: `1.2.0 (2026-11-01)` → `{ title: '1.2.0', date: '2026-11-01' }`. */
export function splitReleaseHeading(text: string): { title: string; date?: string } {
  const m = text.match(RELEASE_DATE)
  if (!m) return { title: text.trim() }
  const title = text.slice(0, m.index).trim()
  return title ? { title, date: m[1] } : { title: m[1], date: m[1] }
}

/** The localStorage key that remembers a closed banner; a new id shows the banner again. */
export const bannerKey = (id: string) => `novon:banner:${id}`
