import type { Config, Layer, Meta, NovonPlugin, ResolvedConfig, ResolvedI18n, ResolvedVersions } from './types.ts'

export type * from './types.ts'

/** Typed helper for `novon.config.ts`. Returns the config unchanged. */
export function defineConfig(config: Config): Config {
  return config
}

/** Typed helper for a folder's `_meta.ts`. Returns the meta unchanged. */
export function defineMeta(meta: Meta): Meta {
  return meta
}

/** Typed helper for a plugin. Returns the plugin unchanged. */
export function definePlugin(plugin: NovonPlugin): NovonPlugin {
  return plugin
}

function normalizeBase(base = '/'): string {
  let b = base.trim() || '/'
  if (!b.startsWith('/')) b = `/${b}`
  if (!b.endsWith('/')) b = `${b}/`
  return b
}

function normalizePrefix(path: string): string {
  const p = `/${path.replace(/^\/+|\/+$/g, '')}`
  return p === '/' ? '/' : p
}

export function resolveI18n(config: Config): ResolvedI18n | undefined {
  const i18n = config.i18n
  if (!i18n || !i18n.locales || typeof i18n.locales !== 'object') return undefined
  const defaultLocale = i18n.defaultLocale ?? config.lang ?? Object.keys(i18n.locales)[0] ?? 'en'
  const entries = Object.entries(i18n.locales)
  if (!entries.some(([code]) => code === defaultLocale)) entries.unshift([defaultLocale, defaultLocale])
  const locales = entries.map(([code, v]) => {
    const o = typeof v === 'string' ? { label: v } : v
    return { ...o, code, label: o.label ?? code, lang: o.lang ?? (code === defaultLocale && config.lang ? config.lang : code), dir: o.dir ?? 'ltr' }
  })
  return { defaultLocale, locales, fallback: i18n.fallback ?? true }
}

export function resolveVersions(config: Config): ResolvedVersions | undefined {
  const v = config.versions
  if (!v || !Array.isArray(v.list)) return undefined
  const list = v.list
    .map((e) => (typeof e === 'string' ? { id: e } : e))
    .filter((e) => e && typeof e.id === 'string' && e.id)
    .map((e) => ({ ...e, id: e.id.replace(/^\/+|\/+$/g, ''), label: e.label ?? e.id }))
  return { latest: v.latest ?? 'Latest', list }
}

/** Docs layer paths, `/` included when the default layout is docs. */
export function docsLayerPaths(layout: string, layers: Layer[]): string[] {
  const out = layout === 'docs' ? ['/'] : []
  for (const l of layers) if (l.layout === 'docs' && !out.includes(l.path)) out.push(l.path)
  return out
}

/** The layers as written, plus one per locale and version: `/ja`, `/ja/blog`, `/v1`, `/ja/docs/v1`. */
function expandLayers(layout: Config['layout'] & string, layers: Layer[], i18n?: ResolvedI18n, versions?: ResolvedVersions): Layer[] {
  const out = [...layers]
  const join = (a: string, b: string) => (a === '/' ? b : b === '/' ? a : `${a}${b}`)
  const prefixes = ['/', ...(i18n?.locales.filter((l) => l.code !== i18n.defaultLocale).map((l) => `/${l.code}`) ?? [])]
  for (const prefix of prefixes) {
    if (prefix !== '/') {
      if (!out.some((l) => l.path === prefix)) out.push({ path: prefix, layout })
      for (const l of layers) if (l.path !== '/') out.push({ ...l, path: join(prefix, l.path) })
    }
    for (const v of versions?.list ?? []) {
      for (const p of docsLayerPaths(layout, layers)) {
        const title = layers.find((l) => l.path === p)?.title
        out.push({ path: join(prefix, join(p, `/${v.id}`)), layout: 'docs', ...(title ? { title } : {}) })
      }
    }
  }
  return out
}

export function resolveConfig(config: Config, root: string): ResolvedConfig {
  if (!config || typeof config.title !== 'string') {
    throw new Error('novon.config.ts must export a config with a `title`.')
  }
  const layout = config.layout ?? 'docs'
  const baseLayers = (config.layers ?? []).map((l) => ({ ...l, path: normalizePrefix(l.path) }))
  const i18n = resolveI18n(config)
  const versions = resolveVersions(config)
  const lang = i18n ? (i18n.locales.find((l) => l.code === i18n.defaultLocale)?.lang ?? config.lang ?? 'en') : (config.lang ?? 'en')
  const { i18n: _i18n, versions: _versions, ...rest } = config
  const resolved: ResolvedConfig = {
    ...rest,
    root,
    base: normalizeBase(config.base),
    lang,
    layout,
    baseLayers,
    layers: expandLayers(layout, baseLayers, i18n, versions),
    ...(i18n ? { i18n } : {}),
    ...(versions ? { versions } : {}),
    nav: config.nav ?? [],
    plugins: config.plugins ?? ['search', 'sitemap', 'rss', 'llms'],
    rss: { path: normalizePrefix(config.rss?.path ?? '/rss.xml'), full: config.rss?.full ?? false },
    tags: { path: normalizePrefix(config.tags?.path ?? '/tags'), lowercase: config.tags?.lowercase ?? true },
    redirects: Object.fromEntries(
      Object.entries(config.redirects ?? {}).filter(([, to]) => typeof to === 'string').map(([from, to]) => [normalizePrefix(from), /^[a-z]+:\/\//i.test(to) ? to : normalizePrefix(to)]),
    ),
    variables: config.variables ?? {},
    theme: { ...config.theme, accent: config.theme?.accent ?? 'blue', toc: config.theme?.toc ?? true },
  }
  // The config as written, for `novon check`.
  Object.defineProperty(resolved, 'source', { value: config, enumerable: false })
  return resolved
}
