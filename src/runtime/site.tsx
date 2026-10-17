import * as React from 'react'
import type { ComponentType } from 'react'
import { layerFor, stripBase, withBase } from '../shared.ts'
import { labelsFor, type Labels } from '../labels.ts'
import type { OverrideSlot, PageMeta, SiteData } from '../types.ts'

export type PageModule = { default: ComponentType<any>; frontmatter?: Record<string, unknown> }
export type Loaders = Record<string, () => Promise<PageModule>>

export interface Loaded {
  route: string
  hash: string
  page: PageMeta | null
  module: PageModule | null
}

export interface SiteContextValue {
  site: SiteData
  loaders: Loaders
  overrides: Partial<Record<OverrideSlot, ComponentType<any>>>
  components: Record<string, ComponentType<any>>
  current: Loaded
  navigate: (href: string, opts?: { replace?: boolean }) => void
  prefetch: (href: string) => void
}

export const SiteContext = React.createContext<SiteContextValue | null>(null)

export function useSite(): SiteContextValue {
  const ctx = React.useContext(SiteContext)
  if (!ctx) throw new Error('useSite must be used inside a novon page')
  return ctx
}

/** The page being shown. */
export function usePage(): PageMeta | null {
  return useSite().current.page
}

/** Built-in strings in the site's language, with `theme.labels` applied. */
export function useLabels(): Labels {
  const { site } = useSite()
  return React.useMemo(() => labelsFor(site.lang, site.theme.labels), [site.lang, site.theme.labels])
}

export function useBase(): (route: string) => string {
  const { site } = useSite()
  return React.useCallback((route: string) => withBase(site.base, route), [site.base])
}

export function useOverride<P>(slot: OverrideSlot, fallback: ComponentType<P>): ComponentType<P> {
  return (useSite().overrides[slot] as ComponentType<P> | undefined) ?? fallback
}

export function findPage(site: SiteData, route: string): PageMeta | null {
  return site.pages.find((p) => p.route === route) ?? null
}

export async function loadRoute(site: SiteData, loaders: Loaders, url: string): Promise<Loaded> {
  const u = new URL(url, 'http://novon.local')
  const route = stripBase(site.base, decodeURIComponent(u.pathname)) ?? '/'
  const page = findPage(site, route)
  const load = page ? loaders[page.route] : undefined
  const module = load ? await load() : null
  return { route, hash: u.hash, page, module }
}

/** The layout a route renders in, including routes with no page (404). */
export function layoutOf(site: SiteData, route: string) {
  return layerFor(route, site.layers, site.defaultLayout)
}
