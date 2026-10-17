import type { Config, ResolvedConfig } from './types.ts'

export type * from './types.ts'

/** Typed helper for `novon.config.ts`. Returns the config unchanged. */
export function defineConfig(config: Config): Config {
  return config
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

export function resolveConfig(config: Config, root: string): ResolvedConfig {
  if (!config || typeof config.title !== 'string') {
    throw new Error('novon.config.ts must export a config with a `title`.')
  }
  const layout = config.layout ?? 'docs'
  return {
    ...config,
    root,
    base: normalizeBase(config.base),
    lang: config.lang ?? 'en',
    layout,
    layers: (config.layers ?? []).map((l) => ({ ...l, path: normalizePrefix(l.path) })),
    nav: config.nav ?? [],
    plugins: config.plugins ?? ['search', 'sitemap', 'rss', 'llms'],
    rss: { path: normalizePrefix(config.rss?.path ?? '/rss.xml'), full: config.rss?.full ?? false },
    tags: { path: normalizePrefix(config.tags?.path ?? '/tags'), lowercase: config.tags?.lowercase ?? true },
    theme: { ...config.theme, accent: config.theme?.accent ?? 'blue', toc: config.theme?.toc ?? true },
  }
}
