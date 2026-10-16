import { humanize } from '../shared.ts'
import type { PageMeta } from '../types.ts'

export interface NavItem {
  page: PageMeta
  depth: number
}

export interface NavSection {
  /** Empty for the pages that sit directly under the layer. */
  label: string
  route?: string
  /** The folder index page's frontmatter icon. */
  icon?: string
  items: NavItem[]
}

const byOrder = (a: PageMeta, b: PageMeta) => a.order - b.order || a.label.localeCompare(b.label)

/** Sidebar sections of a docs layer: top-level directories become sections. */
export function docsNav(pages: PageMeta[], layer: string): NavSection[] {
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
  const out: NavSection[] = root.items.length ? [root] : []
  const ordered = [...sections.entries()].sort(([ka, a], [kb, b]) => {
    const oa = a.index?.order ?? Number.POSITIVE_INFINITY
    const ob = b.index?.order ?? Number.POSITIVE_INFINITY
    return oa - ob || ka.localeCompare(kb)
  })
  for (const [key, entry] of ordered) {
    const items: NavItem[] = []
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
    out.push({ label: entry.index?.label ?? humanize(key), route: entry.index?.route, icon: entry.index?.icon, items })
  }
  return out
}

/** Reading order of a docs layer, for previous/next links. */
export function flatten(sections: NavSection[]): PageMeta[] {
  return sections.flatMap((s) => s.items.map((i) => i.page))
}
