import { humanize } from '../shared.ts'
import type { FolderMeta, PageMeta } from '../types.ts'

export interface NavItem {
  page: PageMeta
  depth: number
  /** The small label from a `_meta.ts` group this row sits under. */
  group?: string
  /** Set on an external link from a `_meta.ts` `pages` list; `page` then only carries its label. */
  external?: string
}

export interface NavSection {
  /** Empty for the pages that sit directly under the layer. */
  label: string
  route?: string
  /** The folder index page's frontmatter icon, or the folder's `_meta.ts` icon. */
  icon?: string
  badge?: string
  /** Starts folded, from `_meta.ts` `collapsed`. */
  collapsed?: boolean
  items: NavItem[]
}

const byOrder = (a: PageMeta, b: PageMeta) => a.order - b.order || a.label.localeCompare(b.label)

function linkItem(link: { title: string; href: string }, layer: string, depth: number): NavItem {
  const page: PageMeta = { route: link.href, file: '', title: link.title, label: link.title, order: 0, tags: [], hidden: false, layer, layout: 'docs', kind: 'page' }
  return { page, depth, external: link.href }
}

/** Marks group rows and inserts external links, from a folder's settings. */
function applyFolder(items: NavItem[], folder: FolderMeta | undefined, layer: string, depth: number): NavItem[] {
  if (!folder) return items
  for (const g of folder.groups ?? []) for (const it of items) if (g.routes.includes(it.page.route)) it.group = g.label
  const out = [...items]
  for (const link of folder.links ?? []) {
    const item = linkItem(link, layer, depth)
    if (!link.after) {
      out.unshift(item)
      continue
    }
    // After the row (and the rows nested under it).
    let at = out.findIndex((i) => i.page.route === link.after)
    if (at < 0) {
      out.push(item)
      continue
    }
    while (at + 1 < out.length && out[at + 1].page.route.startsWith(`${link.after}/`)) at++
    out.splice(at + 1, 0, item)
  }
  return out
}

/**
 * Sidebar sections of a docs layer: top-level directories become sections.
 * `folders` holds the `_meta.ts` settings by folder route.
 */
export function docsNav(pages: PageMeta[], layer: string, folders: Record<string, FolderMeta> = {}): NavSection[] {
  const prefix = layer === '/' ? '' : layer
  const own = pages.filter((p) => p.layer === layer && p.kind === 'page' && !p.hidden)
  const root: NavSection = { label: '', items: [] }
  const sections = new Map<string, { index?: PageMeta; pages: PageMeta[] }>()
  for (const page of own) {
    const rest = page.route.slice(prefix.length).split('/').filter(Boolean)
    if (rest.length === 0) {
      root.items.push({ page, depth: 0 })
      continue
    }
    const key = rest[0]
    const entry = sections.get(key) ?? { pages: [] }
    sections.set(key, entry)
    if (rest.length === 1) {
      const hasChildren = own.some((p) => p.route.startsWith(`${page.route}/`))
      if (hasChildren) entry.index = page
      else {
        sections.delete(key)
        root.items.push({ page, depth: 0 })
      }
    } else entry.pages.push(page)
  }
  root.items.sort((a, b) => byOrder(a.page, b.page))
  root.items = applyFolder(root.items, folders[layer], layer, 0)
  const out: NavSection[] = root.items.length ? [root] : []
  const folderOf = (key: string) => folders[`${prefix}/${key}`]
  const ordered = [...sections.entries()].sort(([ka, a], [kb, b]) => {
    const oa = a.index?.order ?? folderOf(ka)?.order ?? Number.POSITIVE_INFINITY
    const ob = b.index?.order ?? folderOf(kb)?.order ?? Number.POSITIVE_INFINITY
    return oa - ob || ka.localeCompare(kb)
  })
  for (const [key, entry] of ordered) {
    let items: NavItem[] = []
    if (entry.index) items.push({ page: entry.index, depth: 0 })
    const sorted = [...entry.pages].sort((a, b) => {
      // Keep a nested directory's pages right after its own index page.
      const pa = a.route.split('/'), pb = b.route.split('/')
      const shared = pa.slice(0, -1).join('/') === pb.slice(0, -1).join('/')
      return shared ? byOrder(a, b) : a.route.localeCompare(b.route)
    })
    for (const page of sorted) {
      const depth = page.route.slice(prefix.length).split('/').filter(Boolean).length - 2
      items.push({ page, depth: Math.max(0, depth) })
    }
    const folder = folderOf(key)
    items = applyFolder(items, folder, layer, 0)
    out.push({
      label: folder?.title ?? entry.index?.label ?? humanize(key),
      route: entry.index?.route,
      icon: folder?.icon ?? entry.index?.icon,
      ...(folder?.badge ?? entry.index?.badge ? { badge: folder?.badge ?? entry.index?.badge } : {}),
      ...(folder?.collapsed ? { collapsed: true } : {}),
      items,
    })
  }
  return out
}

/** Reading order of a docs layer, for previous/next links. External links are left out. */
export function flatten(sections: NavSection[]): PageMeta[] {
  return sections.flatMap((s) => s.items.filter((i) => !i.external).map((i) => i.page))
}
