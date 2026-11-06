import type { HeadTag, PageMeta, ResolvedConfig } from '../types.ts'
import { withBase } from '../shared.ts'
import { imageUrl, type OgImage } from './og.ts'
import { bannerData } from './banner.ts'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

import { getThemeScript } from '@/ui/theme-toggle'

/** Runs before first paint: light, dark or the system's choice, and follows the system while it is the choice. */
const themeScript = getThemeScript()

export interface DocumentParts {
  config: ResolvedConfig
  page: PageMeta | null
  title: string
  body: string
  head?: string
  scripts: string
  /** Share image for og:image and twitter:image. */
  image?: OgImage | null
  /** Every page, for breadcrumbs in structured data. */
  pages?: PageMeta[]
  /** Head elements from plugins' `head` hooks. */
  extraHead?: HeadTag[]
}

const VOID = new Set(['meta', 'link'])
const HEAD_TAGS = new Set(['meta', 'link', 'script', 'style', 'noscript'])

/** One `head` entry as HTML; unknown tags are skipped. */
export function headTag(t: HeadTag): string {
  if (!HEAD_TAGS.has(t.tag)) return ''
  const attrs = Object.entries(t.attrs ?? {})
    .filter(([k, v]) => /^[a-zA-Z_:][\w:.-]*$/.test(k) && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(String(v))}"`))
    .join('')
  if (VOID.has(t.tag)) return `<${t.tag}${attrs}>`
  const content = (t.content ?? '').replace(new RegExp(`</${t.tag}`, 'gi'), `<\\/${t.tag}`)
  return `<${t.tag}${attrs}>${content}</${t.tag}>`
}

/** Home, then each ancestor page, then the page. */
export function breadcrumbs(page: PageMeta, pages: PageMeta[]): PageMeta[] {
  const trail: PageMeta[] = []
  const home = pages.find((p) => p.route === '/')
  if (home && page.route !== '/') trail.push(home)
  const parts = page.route.split('/').filter(Boolean)
  for (let i = 1; i < parts.length; i++) {
    const found = pages.find((p) => p.route === `/${parts.slice(0, i).join('/')}`)
    if (found) trail.push(found)
  }
  trail.push(page)
  return trail
}

/** schema.org data: the site, the page as an article or post, and its breadcrumbs. */
export function structuredData(config: ResolvedConfig, page: PageMeta | null, pages: PageMeta[], image?: string): Record<string, unknown> | null {
  const abs = (route: string) => (config.url ? new URL(withBase(config.base, route), config.url).href : undefined)
  const siteUrl = abs('/')
  const website = {
    '@type': 'WebSite',
    ...(siteUrl ? { '@id': `${siteUrl}#website`, url: siteUrl } : {}),
    name: config.title,
    ...(config.description ? { description: config.description } : {}),
    inLanguage: config.lang,
  }
  const graph: Record<string, unknown>[] = [website]
  if (page && page.kind === 'page' && page.route !== '/') {
    const post = page.layout === 'blog' && !!page.date
    const type = post ? 'BlogPosting' : page.layout === 'docs' ? 'TechArticle' : 'WebPage'
    const author = page.author ? { '@type': 'Person', name: page.author, ...(config.theme.authors?.[page.author]?.url ? { url: config.theme.authors[page.author].url } : {}) } : undefined
    graph.push({
      '@type': type,
      ...(abs(page.route) ? { '@id': abs(page.route), url: abs(page.route), mainEntityOfPage: abs(page.route) } : {}),
      headline: page.title,
      ...(page.description ? { description: page.description } : {}),
      inLanguage: config.lang,
      ...(page.date ? { datePublished: page.date } : {}),
      ...(page.updated ? { dateModified: page.updated } : {}),
      ...(author ? { author } : {}),
      ...(image ? { image } : {}),
      ...(page.tags.length ? { keywords: page.tags.join(', ') } : {}),
      ...(siteUrl ? { isPartOf: { '@id': `${siteUrl}#website` } } : {}),
    })
  }
  if (page && config.url) {
    const trail = breadcrumbs(page, pages)
    if (trail.length > 1) {
      graph.push({
        '@type': 'BreadcrumbList',
        itemListElement: trail.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.route === '/' ? config.title : p.title, item: abs(p.route) })),
      })
    }
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}

/** Hides a banner the reader closed before it paints. */
export function bannerScript(config: ResolvedConfig): string {
  const banner = bannerData(config)
  if (!banner?.dismissible) return ''
  return `<script>try{if(localStorage.getItem('novon:banner')===${JSON.stringify(banner.id)})document.documentElement.setAttribute('data-banner-closed','')}catch(e){}</script>`
}

export function renderDocument({ config, page, title, body, head = '', scripts, image, pages = [], extraHead = [] }: DocumentParts): string {
  const description = page?.description ?? config.description ?? ''
  const canonical = config.url && page ? new URL(withBase(config.base, page.route), config.url).href : ''
  const favicon = config.theme.favicon ? withBase(config.base, config.theme.favicon) : ''
  const style = config.theme.radius ? ` style="--radius:${esc(config.theme.radius)}"` : ''
  const ogTitle = page?.title ?? config.title
  const img = image ? imageUrl(config, image) : ''
  const meta = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(title)}</title>`,
    description && `<meta name="description" content="${esc(description)}">`,
    `<meta property="og:title" content="${esc(page?.title ?? config.title)}">`,
    `<meta property="og:site_name" content="${esc(config.title)}">`,
    description && `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:type" content="${page?.layout === 'blog' && page.date ? 'article' : 'website'}">`,
    canonical && `<link rel="canonical" href="${canonical}">`,
    canonical && `<meta property="og:url" content="${canonical}">`,
    img && `<meta property="og:image" content="${esc(img)}">`,
    img && image?.width && `<meta property="og:image:width" content="${image.width}">`,
    img && image?.height && `<meta property="og:image:height" content="${image.height}">`,
    img && `<meta property="og:image:alt" content="${esc(ogTitle)}">`,
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(ogTitle)}">`,
    description && `<meta name="twitter:description" content="${esc(description)}">`,
    img && `<meta name="twitter:image" content="${esc(img)}">`,
    page?.noindex && `<meta name="robots" content="noindex">`,
    favicon && `<link rel="icon" href="${favicon}">`,
    (config.plugins ?? []).includes('rss') && (config.layout === 'blog' || config.layers.some((l) => l.layout === 'blog')) && `<link rel="alternate" type="application/rss+xml" title="${esc(config.title)}" href="${withBase(config.base, config.rss.path)}">`,
    `<script>${themeScript}</script>`,
    bannerScript(config),
    page && `<script type="application/ld+json">${JSON.stringify(structuredData(config, page, pages, img || undefined)).replace(/</g, '\\u003c')}</script>`,
    ...[...extraHead, ...(config.head ?? []), ...(page?.head ?? [])].map(headTag),
  ].filter(Boolean)
  return `<!doctype html>
<html lang="${esc(config.lang)}" data-accent="${config.theme.accent}"${style}>
<head>
${meta.join('\n')}
${head}
</head>
<body>
<div id="novon">${body}</div>
${scripts}
</body>
</html>
`
}
