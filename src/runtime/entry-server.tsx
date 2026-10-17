import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { components, loaders, overrides, site } from 'virtual:novon/site'
import { App, pageTitle } from './app.tsx'
import { loadRoute } from './site.tsx'

export { site }

/** Renders one URL to the HTML that goes inside #novon, plus its head values. */
export async function render(url: string) {
  const initial = await loadRoute(site, loaders, url)
  const html = renderToString(
    <App site={site} loaders={loaders} overrides={overrides} components={components} initial={initial} />,
  )
  return { html, title: pageTitle(site, initial), page: initial.page }
}

/** Just the page's MDX body, for feeds. */
export async function renderContent(url: string) {
  const initial = await loadRoute(site, loaders, url)
  const html = renderToStaticMarkup(
    <App site={site} loaders={loaders} overrides={overrides} components={components} initial={initial} contentOnly />,
  )
  // React hoists preloads and styles to the front; a feed has no head for them.
  return html.replace(/^(?:<link [^>]*\/>|<style[^>]*>[^<]*<\/style>)+/, '')
}
