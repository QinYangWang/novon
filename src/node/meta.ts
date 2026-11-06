/**
 * Folder `_meta.ts` files: sidebar order, titles, badges, groups, links and
 * hidden pages, applied to the scanned pages. A meta file is a module whose
 * default export is a `defineMeta({...})` object (or a `_meta.json`).
 */
import { readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { FolderMeta, Meta, MetaGroup, MetaLink, PageMeta, ResolvedConfig } from '../types.ts'

const META_FILES = ['_meta.ts', '_meta.mts', '_meta.js', '_meta.mjs', '_meta.json']

export interface MetaFile {
  /** Folder relative to `content/`, `''` for the root. */
  dir: string
  /** File relative to the site root. */
  file: string
  meta: Meta
}

async function folders(dir: string): Promise<string[]> {
  const out = [dir]
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  for (const e of entries) if (e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_')) out.push(...(await folders(join(dir, e.name))))
  return out
}

/** Every `_meta` file under `content/`. Imports are keyed by modification time, so edits show up in dev. */
export async function loadMetas(config: ResolvedConfig): Promise<MetaFile[]> {
  const content = join(config.root, 'content')
  const out: MetaFile[] = []
  for (const dir of await folders(content)) {
    const name = META_FILES.find((f) => existsSync(join(dir, f)))
    if (!name) continue
    const abs = join(dir, name)
    const file = relative(config.root, abs).split(sep).join('/')
    let meta: unknown
    if (name.endsWith('.json')) meta = await Bun.file(abs).json()
    else {
      const { mtimeMs } = await stat(abs)
      meta = ((await import(`${pathToFileURL(abs).href}?t=${Math.round(mtimeMs)}`)) as { default?: unknown }).default
    }
    if (!meta || typeof meta !== 'object') throw new Error(`${file} must \`export default defineMeta({ ... })\``)
    out.push({ dir: relative(content, dir).split(sep).join('/'), file, meta: meta as Meta })
  }
  return out
}

const isGroup = (e: unknown): e is MetaGroup => !!e && typeof e === 'object' && typeof (e as MetaGroup).group === 'string'
const isLink = (e: unknown): e is MetaLink => !!e && typeof e === 'object' && typeof (e as MetaLink).href === 'string'

/** The child names a `pages` list mentions, in order, groups flattened. */
export function listedNames(pages: Meta['pages']): string[] {
  return (pages ?? []).flatMap((e) => (typeof e === 'string' ? [e] : isGroup(e) ? e.pages : []))
}

/**
 * Applies meta files to the pages in place (labels, badges, icons, order,
 * hidden) and returns the folder settings the sidebar reads, by folder route.
 */
export function applyMetas(pages: PageMeta[], metas: MetaFile[]): Record<string, FolderMeta> {
  const folders: Record<string, FolderMeta> = {}
  const folder = (route: string) => (folders[route] ??= {})
  for (const { dir, meta } of metas) {
    const route = dir ? `/${dir}` : '/'
    const prefix = dir ? `/${dir}/` : '/'
    // Direct children: pages one segment below, and sub-folders by their index route.
    const children = new Map<string, PageMeta>()
    for (const p of pages) {
      if (p.kind !== 'page' || p.route === route || !p.route.startsWith(prefix)) continue
      const rest = p.route.slice(prefix.length)
      if (!rest.includes('/')) children.set(rest, p)
    }
    const subfolders = new Set(
      pages.filter((p) => p.route.startsWith(prefix) && p.route.slice(prefix.length).includes('/')).map((p) => p.route.slice(prefix.length).split('/')[0]),
    )

    const own = folder(route)
    for (const key of ['title', 'icon', 'badge', 'collapsed'] as const) if (meta[key] !== undefined) (own as Record<string, unknown>)[key] = meta[key]
    if (typeof meta.order === 'number') own.order = meta.order

    for (const [name, item] of Object.entries(meta.items ?? {})) {
      const page = children.get(name)
      if (page) {
        if (item.title) page.label = item.title
        if (item.badge) page.badge = item.badge
        if (item.icon) page.icon = item.icon
        if (item.hidden) page.hidden = true
      }
      if (subfolders.has(name)) {
        const sub = folder(`${prefix}${name}`)
        if (item.title) sub.title = item.title
        if (item.badge) sub.badge = item.badge
        if (item.icon) sub.icon = item.icon
      }
      if (item.hidden && subfolders.has(name)) for (const p of pages) if (p.route.startsWith(`${prefix}${name}/`)) p.hidden = true
    }

    if (!meta.pages?.length) continue
    const listed = listedNames(meta.pages)
    const rest = listed.indexOf('...')
    const names = listed.filter((n) => n !== '...')
    const known = [...new Set([...children.keys(), ...subfolders])]
    const unlisted = known.filter((n) => !names.includes(n))
    // Unlisted children keep their usual order among themselves, at the `...` or after everything.
    const usual = unlisted
      .map((n) => children.get(n))
      .sort((a, b) => (a?.order ?? Infinity) - (b?.order ?? Infinity) || (a?.label ?? '').localeCompare(b?.label ?? ''))
    const position = (name: string): number => {
      if (names.includes(name)) return listed.indexOf(name)
      const rank = usual.findIndex((p) => p?.route === `${prefix}${name}`)
      const fraction = (Math.max(0, rank) + 1) / (unlisted.length + 2)
      return rest >= 0 ? rest + fraction : listed.length + Math.max(0, rank)
    }
    for (const name of known) {
      const order = position(name)
      const page = children.get(name)
      if (page) page.order = order
      if (subfolders.has(name)) {
        const sub = folder(`${prefix}${name}`)
        sub.order ??= order
      }
    }
    const groups = meta.pages.filter(isGroup).map((g) => ({ label: g.group, routes: g.pages.map((n) => `${prefix}${n}`).filter((r) => pages.some((p) => p.route === r)) }))
    if (groups.length) own.groups = groups
    const links: FolderMeta['links'] = []
    let previous: string | undefined
    for (const e of meta.pages) {
      if (isLink(e)) links.push({ title: e.title, href: e.href, ...(previous ? { after: previous } : {}) })
      else if (typeof e === 'string' && e !== '...') previous = `${prefix}${e}`
      else if (isGroup(e) && e.pages.length) previous = `${prefix}${e.pages.at(-1)}`
    }
    if (links.length) own.links = links
  }
  return folders
}
