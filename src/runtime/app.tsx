import * as React from 'react'
import { MDXProvider } from '@mdx-js/react'
import { TooltipProvider } from '@/ui/tooltip'
import { LocaleProvider } from '@/ui/locale-provider'
import { labelsFor } from '../labels.ts'
import { stripBase, withBase } from '../shared.ts'
import type { SiteData } from '../types.ts'
import { mdxComponents } from './mdx.tsx'
import { SiteContext, layoutOf, loadRoute, type Loaded, type Loaders, type SiteContextValue } from './site.tsx'
import { DocsLayout } from './layouts/docs.tsx'
import { BlogLayout } from './layouts/blog.tsx'
import { PageContent } from './chrome.tsx'

export interface AppProps {
  site: SiteData
  loaders: Loaders
  overrides: SiteContextValue['overrides']
  components: SiteContextValue['components']
  initial: Loaded
  /** Render the page body without the layout (feeds). */
  contentOnly?: boolean
}

function scrollAfterNavigation(hash: string) {
  if (hash) {
    const el = document.getElementById(decodeURIComponent(hash.slice(1)))
    if (el) return el.scrollIntoView()
  }
  window.scrollTo(0, 0)
}

export function pageTitle(site: SiteData, loaded: Loaded): string {
  if (!loaded.page) return `${labelsFor(site.lang, site.theme.labels).notFound} · ${site.title}`
  return loaded.page.route === '/' ? site.title : `${loaded.page.title} · ${site.title}`
}

export function App({ site, loaders, overrides, components, initial, contentOnly }: AppProps) {
  const [current, setCurrent] = React.useState(initial)
  const pending = React.useRef(0)

  const show = React.useCallback(
    async (href: string, mode: 'push' | 'replace' | 'pop') => {
      const ticket = ++pending.current
      const url = withBase(site.base, href)
      const next = await loadRoute(site, loaders, url)
      if (ticket !== pending.current) return
      if (mode === 'push') history.pushState(null, '', url)
      if (mode === 'replace') history.replaceState(null, '', url)
      React.startTransition(() => setCurrent(next))
      document.title = pageTitle(site, next)
      if (mode !== 'pop') requestAnimationFrame(() => scrollAfterNavigation(next.hash))
    },
    [site, loaders],
  )

  React.useEffect(() => {
    const onPop = () => void show((stripBase(site.base, location.pathname) ?? '/') + location.hash, 'pop')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [show, site.base])

  const value = React.useMemo<SiteContextValue>(
    () => ({
      site,
      loaders,
      overrides,
      components,
      current,
      navigate: (href, opts) => {
        const [path, hash = ''] = href.split('#')
        if (path === '' || path === current.route) {
          history.pushState(null, '', hash ? `#${hash}` : location.pathname)
          return scrollAfterNavigation(hash ? `#${hash}` : '')
        }
        void show(href, opts?.replace ? 'replace' : 'push')
      },
      prefetch: (href) => {
        const page = site.pages.find((p) => p.route === href.split('#')[0])
        if (page) void loaders[page.route]?.()
      },
    }),
    [site, loaders, overrides, components, current, show],
  )

  // The library localizes its own strings from `lang`; only a site's `theme.labels` overrides go in.
  const localeLabels = React.useMemo(() => {
    const o = site.theme.labels ?? {}
    return { onThisPage: o.onThisPage, backToTop: o.backToTop }
  }, [site.theme.labels])

  const layout = current.page?.layout ?? layoutOf(site, current.route).layout
  const Layout = layout === 'blog' ? BlogLayout : DocsLayout

  return (
    <SiteContext.Provider value={value}>
      <MDXProvider components={{ ...mdxComponents, ...components }}>
        <LocaleProvider locale={site.lang} labels={localeLabels}>
          <TooltipProvider>
            {contentOnly ? <PageContent /> : <Layout />}
          </TooltipProvider>
        </LocaleProvider>
      </MDXProvider>
    </SiteContext.Provider>
  )
}
