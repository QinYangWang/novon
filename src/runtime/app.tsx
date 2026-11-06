import * as React from 'react'
import { MDXProvider } from '@mdx-js/react'
import { TooltipProvider } from '@/ui/tooltip'
import { LocaleProvider } from '@/ui/locale-provider'
import { labelsFor } from '../labels.ts'
import { normalizeRoute, stripBase, withBase } from '../shared.ts'
import type { SiteData } from '../types.ts'
import { mdxComponents } from './mdx.tsx'
import { SiteContext, layoutOf, loadRoute, type Loaded, type Loaders, type SiteContextValue } from './site.tsx'
import { DocsLayout } from './layouts/docs.tsx'
import { BlogLayout } from './layouts/blog.tsx'
import { PageContent } from './chrome.tsx'
import { currentLocale, localizeSite } from './i18n.tsx'

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

export function pageTitle(original: SiteData, loaded: Loaded): string {
  const site = localizeSite(original, loaded.page, loaded.route)
  if (!loaded.page) return `${labelsFor(site.lang, site.theme.labels).notFound} · ${site.title}`
  return loaded.page.route === '/' ? site.title : `${loaded.page.title} · ${site.title}`
}

export function App({ site, loaders, overrides, components, initial, contentOnly }: AppProps) {
  const [current, setCurrent] = React.useState(initial)
  const pending = React.useRef(0)

  const show = React.useCallback(
    async (href: string, mode: 'push' | 'replace' | 'pop') => {
      // Old paths follow the site's redirects, like the host would.
      const [path, hash] = href.split('#')
      const to = site.redirects?.[normalizeRoute(path.split('?')[0])]
      if (to && /^[a-z][a-z0-9+.-]*:/i.test(to)) return void location.assign(to)
      if (to) href = `${to}${hash !== undefined && !to.includes('#') ? `#${hash}` : ''}`
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

  // Everything below reads the site in the current page's language.
  const view = React.useMemo(() => localizeSite(site, current.page, current.route), [site, current.page, current.route])

  const value = React.useMemo<SiteContextValue>(
    () => ({
      site: view,
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
    [site, view, loaders, overrides, components, current, show],
  )

  // The library localizes its own strings from `lang`; only a site's `theme.labels` overrides go in.
  // A language the library has no strings for (Japanese) takes novon's own for the ones novon knows.
  const localeLabels = React.useMemo(() => {
    const o = /^(en|zh)\b/i.test(view.lang) ? (view.theme.labels ?? {}) : labelsFor(view.lang, view.theme.labels)
    return { onThisPage: o.onThisPage, backToTop: o.backToTop }
  }, [view.lang, view.theme.labels])
  React.useEffect(() => {
    // In-place navigation between locales keeps <html lang> and dir in step.
    document.documentElement.lang = view.lang
    const dir = currentLocale(site, current.page, current.route)?.dir
    if (dir === 'rtl') document.documentElement.dir = 'rtl'
    else document.documentElement.removeAttribute('dir')
  }, [view.lang, site, current.page, current.route])

  const layout = current.page?.layout ?? layoutOf(site, current.route).layout
  const Layout = layout === 'blog' ? BlogLayout : DocsLayout

  return (
    <SiteContext.Provider value={value}>
      <MDXProvider components={{ ...mdxComponents, ...components }}>
        <LocaleProvider locale={view.lang} labels={localeLabels}>
          <TooltipProvider>
            {contentOnly ? <PageContent /> : <Layout />}
          </TooltipProvider>
        </LocaleProvider>
      </MDXProvider>
    </SiteContext.Provider>
  )
}
