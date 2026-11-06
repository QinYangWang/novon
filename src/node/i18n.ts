/** Locale and version helpers for the build: which pages go in which index, feed and sitemap. */
import { normalizeRoute } from '../shared.ts'
import type { PageMeta, ResolvedConfig, ResolvedLocale } from '../types.ts'

/** A page's locale settings; the default locale for pages of a single-language site. */
export function localeOf(config: ResolvedConfig, page: PageMeta | null | undefined): ResolvedLocale | undefined {
  if (!config.i18n) return undefined
  const code = page?.locale ?? config.i18n.defaultLocale
  return config.i18n.locales.find((l) => l.code === code)
}

/** `<html lang>` for a page. */
export function langOf(config: ResolvedConfig, page: PageMeta | null | undefined): string {
  return localeOf(config, page)?.lang ?? config.lang
}

/** The URL prefix of a locale: `''` for the default one, `/ja` for the rest. */
export function localePrefix(config: ResolvedConfig, code?: string): string {
  return !config.i18n || !code || code === config.i18n.defaultLocale ? '' : `/${code}`
}

/** Versions whose pages stay out of search, the sitemap and llms.txt. */
export function unlistedVersions(config: ResolvedConfig): Set<string> {
  return new Set((config.versions?.list ?? []).filter((v) => v.hidden || v.archived).map((v) => v.id))
}

/** Pages that are copies of another page's content: untranslated fallbacks and pages of hidden or archived versions. */
export function isListedCopy(config: ResolvedConfig, page: PageMeta): boolean {
  return !!page.fallback || (!!page.version && unlistedVersions(config).has(page.version))
}

/** One group per locale and listed version: its pages and the prefix its files go under (`/ja`, `/v1`, `/ja/v1`). */
export interface Slice {
  locale?: ResolvedLocale
  version?: string
  /** `''` for the default locale's current docs. */
  prefix: string
  pages: PageMeta[]
}

/**
 * Pages split by locale (and, with `versions`, by listed version for search).
 * The current version of the default locale is the slice with prefix `''`.
 */
export function slices(config: ResolvedConfig, pages: PageMeta[], opts: { versions?: boolean } = {}): Slice[] {
  const locales: (ResolvedLocale | undefined)[] = config.i18n ? config.i18n.locales : [undefined]
  const versions: (string | undefined)[] = [undefined, ...(opts.versions ? (config.versions?.list ?? []).filter((v) => !v.hidden && !v.archived).map((v) => v.id) : [])]
  const out: Slice[] = []
  for (const locale of locales) {
    for (const version of versions) {
      const own = pages.filter((p) => (!locale || p.locale === locale.code) && (opts.versions ? p.version === version : true))
      out.push({ ...(locale ? { locale } : {}), ...(version ? { version } : {}), prefix: `${localePrefix(config, locale?.code)}${version ? `/${version}` : ''}`, pages: own })
    }
  }
  return out
}

/** Translations of a page (itself included), not counting fallbacks. */
export function translations(pages: PageMeta[], page: PageMeta): PageMeta[] {
  if (!page.locale) return []
  const key = page.key ?? page.route
  return pages.filter((p) => !p.fallback && p.kind === page.kind && (p.key ?? p.route) === key && p.version === page.version && p.locale)
}

/** The route search engines should treat as the page's own: the original of a fallback, the current version of an old one. */
export function canonicalRoute(config: ResolvedConfig, page: PageMeta, pages: PageMeta[]): string {
  if (page.fallback) {
    const original = pages.find((p) => !p.fallback && (p.key ?? p.route) === page.key && p.locale === config.i18n?.defaultLocale && p.version === page.version)
    if (original) return original.route
  }
  if (page.version) {
    const latest = pages.find((p) => !p.fallback && !p.version && (p.key ?? p.route) === page.key && p.locale === page.locale)
    if (latest) return latest.route
  }
  return page.route
}

/** Search index path for a locale and version. */
export function searchPath(prefix: string): string {
  return normalizeRoute(`${prefix}/search.json`)
}
