/**
 * Analytics from config `analytics`, as a plugin that adds scripts to every
 * page's head. Each provider's script follows in-site navigation itself
 * (history changes), so client-side page views are counted too.
 */
import type { AnalyticsOptions, HeadTag, NovonPlugin } from '../types.ts'

/** Head elements for the configured providers, in a stable order. */
export function analyticsTags(a: AnalyticsOptions | undefined): HeadTag[] {
  if (!a) return []
  const tags: HeadTag[] = []
  if (a.plausible?.domain) {
    tags.push({ tag: 'script', attrs: { defer: true, 'data-domain': a.plausible.domain, src: a.plausible.src ?? 'https://plausible.io/js/script.js' } })
  }
  if (a.umami?.websiteId) {
    tags.push({ tag: 'script', attrs: { defer: true, 'data-website-id': a.umami.websiteId, src: a.umami.src ?? 'https://cloud.umami.is/script.js' } })
  }
  const ga = typeof a.ga4 === 'string' ? a.ga4 : a.ga4?.id
  if (ga) {
    const id = JSON.stringify(ga)
    tags.push({ tag: 'script', attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}` } })
    tags.push({ tag: 'script', content: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${id});` })
  }
  const cf = typeof a.cloudflare === 'string' ? a.cloudflare : a.cloudflare?.token
  if (cf) {
    tags.push({ tag: 'script', attrs: { defer: true, src: 'https://static.cloudflareinsights.com/beacon.min.js', 'data-cf-beacon': JSON.stringify({ token: cf, spa: true }) } })
  }
  if (typeof a.custom === 'string') tags.push({ tag: 'script', attrs: { defer: true, src: a.custom } })
  else if (Array.isArray(a.custom)) tags.push(...a.custom)
  return tags
}

export const analytics: NovonPlugin = {
  name: 'analytics',
  head: (_page, { config }) => analyticsTags(config.analytics),
}
