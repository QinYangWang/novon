/**
 * Where pages come from. `content/` is the main mount; frozen versions
 * (`content/_versions/<id>`), outside sources and generated API pages are
 * mounted beside it. A file's route comes from its mount: the mount's path,
 * the locale folder it sits in, then its version.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { buildRoute, normalizeRoute } from '../shared.ts'
import type { ResolvedConfig } from '../types.ts'

export interface Mount {
  /** Folder relative to the site root. */
  rel: string
  /** URL prefix of the mount's pages, before locale and version. */
  prefix: string
  version?: string
  /** The mount's first-level folders may be locales. */
  locales: boolean
  /** "Edit this page" base for files in this mount. */
  editLink?: string
  /** Generated or cached: not the site's own files. */
  external?: boolean
}

export const VERSIONS_DIR = 'content/_versions'
export const SOURCES_DIR = '.novon/sources'
export const GENERATED_DIR = '.novon/generated'

const PAGE_EXT = /\.(mdx|md)$/

/** A source's cache folder name. */
export function sourceName(s: { name?: string; path: string; type: string; repo?: string }): string {
  if (s.name) return s.name.replace(/[^\w.-]+/g, '-')
  const from = s.repo ? s.repo.replace(/^.*[/:]([^/:]+\/[^/]+?)(\.git)?$/, '$1') : s.path
  return `${s.type}-${from}`.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export function openapiName(spec: { path: string }): string {
  return `openapi${spec.path.replace(/[^\w.-]+/g, '-')}`.replace(/-+$/g, '')
}

export function mounts(config: ResolvedConfig): Mount[] {
  const out: Mount[] = [{ rel: 'content', prefix: '/', locales: true }]
  for (const v of config.versions?.list ?? []) {
    const rel = `${VERSIONS_DIR}/${v.id}`
    if (existsSync(join(config.root, rel))) out.push({ rel, prefix: '/', version: v.id, locales: true })
  }
  for (const s of config.sources ?? []) {
    const base = `${SOURCES_DIR}/${sourceName(s)}`
    const rel = s.type === 'git' && s.dir ? `${base}/${s.dir.replace(/^\/+|\/+$/g, '')}` : base
    out.push({ rel, prefix: normalizeRoute(s.path), locales: false, external: true, ...(s.type === 'git' && s.editLink ? { editLink: s.editLink } : {}) })
  }
  const specs = config.openapi ? (Array.isArray(config.openapi) ? config.openapi : [config.openapi]) : []
  for (const spec of specs) out.push({ rel: `${GENERATED_DIR}/${openapiName(spec)}`, prefix: normalizeRoute(spec.path), locales: false, external: true })
  return out
}

/** The mount a file (relative to the site root) belongs to: the deepest one holding it. */
export function mountOf(config: ResolvedConfig, file: string, list = mounts(config)): Mount | null {
  let best: Mount | null = null
  for (const m of list) if (file.startsWith(`${m.rel}/`) && (!best || m.rel.length > best.rel.length)) best = m
  return best
}

export interface Location {
  route: string
  key: string
  locale?: string
  version?: string
}

/** Route, key, locale and version of a page file, or of a folder given as `<dir>/index.mdx`. */
export function locate(config: ResolvedConfig, file: string, list = mounts(config)): Location | null {
  const mount = mountOf(config, file, list)
  if (!mount) return null
  const parts = file.slice(mount.rel.length + 1).replace(PAGE_EXT, '').split('/').filter(Boolean)
  if (parts.at(-1) === 'index') parts.pop()
  let locale = config.i18n?.defaultLocale
  if (mount.locales && config.i18n && parts.length && config.i18n.locales.some((l) => l.code === parts[0] && l.code !== config.i18n!.defaultLocale)) {
    locale = parts.shift()
  }
  const key = normalizeRoute(`${mount.prefix === '/' ? '' : mount.prefix}/${parts.join('/')}`)
  const route = buildRoute(config, key, locale, mount.version)
  return { route, key, ...(locale ? { locale } : {}), ...(mount.version ? { version: mount.version } : {}) }
}

/** Whether an absolute path is a page file of some mount. */
export function isMountedFile(config: ResolvedConfig, abs: string): boolean {
  if (!PAGE_EXT.test(abs) || !abs.startsWith(`${config.root}/`)) return false
  return !!mountOf(config, abs.slice(config.root.length + 1))
}
