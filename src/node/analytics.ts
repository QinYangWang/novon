/**
 * Analytics from config `analytics`, as a plugin that adds scripts to every
 * page's head. Each provider's script follows in-site navigation itself
 * (history changes), so client-side page views are counted too.
 */
import type { AnalyticsOptions, ConsentOptions, HeadTag, NovonPlugin, ResolvedConfig } from '../types.ts'

/** The consent settings in effect: only with analytics configured. */
export function consentOf(config: Pick<ResolvedConfig, 'analytics' | 'consent'>): (Omit<ConsentOptions, 'version'> & { version: string }) | null {
  if (!config.consent || !config.analytics || !analyticsTags(config.analytics).length) return null
  const c = config.consent === true ? {} : config.consent
  return { ...c, version: String(c.version ?? 1) }
}

/** The storage key of a consent version. */
export const consentKey = (version: string) => `novon:consent:${version}`

/**
 * Runs in the head after the inert analytics scripts: \`window.novonConsent\` and,
 * when the reader already allowed them, the scripts themselves.
 */
export function consentScript(version: string): string {
  const key = JSON.stringify(consentKey(version))
  return `(function(){var k=${key},d=document;function get(){try{return localStorage.getItem(k)}catch(e){return null}}function put(v){try{v?localStorage.setItem(k,v):localStorage.removeItem(k)}catch(e){}}function run(){d.querySelectorAll('script[data-novon-consent]').forEach(function(o){var s=d.createElement('script');for(var i=0;i<o.attributes.length;i++){var a=o.attributes[i];if(a.name!=='type'&&a.name!=='data-novon-consent')s.setAttribute(a.name,a.value)}s.text=o.text;o.replaceWith(s)})}function tell(v){dispatchEvent(new CustomEvent('novon:consent',{detail:v}))}window.novonConsent={version:${JSON.stringify(version)},get:function(){var v=get();return v==='granted'||v==='denied'?v:null},allow:function(){put('granted');run();tell('granted')},deny:function(){var was=get()==='granted';put('denied');tell('denied');if(was)location.reload()},reset:function(){put(null);tell(null)}};if(get()==='granted')run()})();`
}

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
  if (a.posthog?.key) {
    const host = (a.posthog.host ?? 'https://us.i.posthog.com').replace(/\/+$/, '')
    const assets = host.replace(/^(https:\/\/[a-z]+)\.i\.posthog\.com$/, '$1-assets.i.posthog.com')
    // The loader reads `_i` once it arrives; page views follow history changes.
    const init = JSON.stringify([a.posthog.key, { api_host: host, capture_pageview: 'history_change', person_profiles: 'identified_only' }, 'posthog'])
    tags.push({ tag: 'script', content: `window.posthog=window.posthog||{__SV:1,_i:[${init}]};` })
    tags.push({ tag: 'script', attrs: { async: true, src: `${assets}/static/array.js` } })
  }
  const fathom = typeof a.fathom === 'string' ? { site: a.fathom } : a.fathom
  if (fathom?.site) {
    tags.push({ tag: 'script', attrs: { defer: true, src: fathom.src ?? 'https://cdn.usefathom.com/script.js', 'data-site': fathom.site, 'data-spa': 'auto' } })
  }
  if (a.simpleAnalytics) {
    const sa = a.simpleAnalytics === true ? {} : a.simpleAnalytics
    tags.push({ tag: 'script', attrs: { async: true, src: sa.src ?? 'https://scripts.simpleanalyticscdn.com/latest.js', ...(sa.hostname ? { 'data-hostname': sa.hostname } : {}) } })
  }
  if (a.matomo?.url && a.matomo.siteId !== undefined) {
    const url = JSON.stringify(a.matomo.url.replace(/\/?$/, '/'))
    const id = JSON.stringify(String(a.matomo.siteId))
    // In-site navigation changes the URL with pushState; report each change as a page view.
    tags.push({
      tag: 'script',
      content: `var _paq=window._paq=window._paq||[];_paq.push(['trackPageView'],['enableLinkTracking']);(function(){var u=${url};_paq.push(['setTrackerUrl',u+'matomo.php'],['setSiteId',${id}]);var g=document.createElement('script');g.async=true;g.src=u+'matomo.js';document.head.appendChild(g);var last=location.href,p=history.pushState;function v(){setTimeout(function(){if(location.href===last)return;_paq.push(['setReferrerUrl',last],['setCustomUrl',location.href],['setDocumentTitle',document.title],['trackPageView']);last=location.href},50)}history.pushState=function(){p.apply(this,arguments);v()};addEventListener('popstate',v)})();`,
    })
  }
  if (typeof a.custom === 'string') tags.push({ tag: 'script', attrs: { defer: true, src: a.custom } })
  else if (Array.isArray(a.custom)) tags.push(...a.custom)
  return tags
}

/** Scripts that wait for consent: kept as text until the reader allows them. */
export function inert(tags: HeadTag[]): HeadTag[] {
  return tags.map((t) => (t.tag === 'script' ? { ...t, attrs: { ...t.attrs, type: 'text/plain', 'data-novon-consent': true } } : t))
}

export const analytics: NovonPlugin = {
  name: 'analytics',
  head: (_page, { config }) => {
    const tags = analyticsTags(config.analytics)
    const consent = consentOf(config)
    if (!consent) return tags
    return [...inert(tags), { tag: 'script', content: consentScript(consent.version) }]
  },
}
