/**
 * Locales and versions in the browser: the site as seen from the current
 * page's locale, links that stay in that locale and version, the language and
 * version switchers, and the notices on untranslated and older pages.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Menu, MenuContent, MenuGroup, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/ui/menu'
import { Alert, AlertContent, AlertDescription, AlertIcon } from '@/ui/alert'
import { ChevronsUpDownIcon, GlobeIcon, InfoIcon } from '@/components/icons'
import { buildRoute, counterpart, normalizeRoute, routeLocale } from '../shared.ts'
import { fill } from '../labels.ts'
import type { PageMeta, ResolvedLocale, SiteData } from '../types.ts'
import { useLabels, useSite } from './site.tsx'
import { Link } from './link.tsx'

/** Routing facts of a site, in the shape the shared helpers take. */
export function shapeOf(site: SiteData) {
  return { layout: site.defaultLayout, baseLayers: site.baseLayers ?? site.layers, i18n: site.i18n }
}

/** The locale a page (or, without one, a route) is in. */
export function currentLocale(site: SiteData, page: PageMeta | null, route: string): ResolvedLocale | undefined {
  if (!site.i18n) return undefined
  const code = page?.locale ?? routeLocale(shapeOf(site), route)
  return site.i18n.locales.find((l) => l.code === code)
}

/**
 * The site in the current page's language: `lang`, title, description, top
 * navigation, banner and string overrides of that locale. Without `i18n` the
 * site is returned as is.
 */
export function localizeSite(site: SiteData, page: PageMeta | null, route: string): SiteData {
  const locale = currentLocale(site, page, route)
  if (!locale || !site.i18n) return site
  const isDefault = locale.code === site.i18n.defaultLocale
  const nav = locale.nav ?? (isDefault ? site.nav : site.nav.map((l) => ({ ...l, href: localizeHref(site, { locale: locale.code }, l.href) })))
  return {
    ...site,
    lang: locale.lang,
    title: locale.title ?? site.title,
    description: locale.description ?? site.description,
    nav,
    theme: locale.labels ? { ...site.theme, labels: { ...site.theme.labels, ...locale.labels } } : site.theme,
    ...(locale.banner && site.banner ? { banner: { ...site.banner, html: locale.banner } } : {}),
  }
}

/**
 * A site route written for the default locale and current docs, pointed at
 * the same page in `to`'s locale and version when it exists there.
 */
export function localizeHref(site: SiteData, to: { locale?: string; version?: string }, href: string): string {
  if ((!site.i18n && !site.versions) || !href.startsWith('/') || href.startsWith('//')) return href
  const [path, rest = ''] = href.split(/(?=[?#])/)
  const route = normalizeRoute(path)
  const defaultLocale = site.i18n?.defaultLocale
  const target = site.pages.find((p) => p.route === route)
  // Only links to the default locale's current pages move; anything already specific stays.
  if (!target || target.version || (defaultLocale && target.locale !== defaultLocale)) return href
  const locale = to.locale ?? defaultLocale
  if (locale === defaultLocale && !to.version) return href
  const key = target.key ?? target.route
  const found = site.pages.find((p) => (p.key ?? p.route) === key && p.locale === (site.i18n ? locale : undefined) && p.version === to.version)
  return found ? `${found.route}${rest}` : href
}

/** The search index for the current locale and version, when the build wrote one. */
export function searchIndexPath(site: SiteData, page: PageMeta | null, route: string): string {
  const locale = currentLocale(site, page, route)
  const version = page?.version && site.versions?.list.some((v) => v.id === page.version && !v.hidden && !v.archived) ? page.version : undefined
  const prefix = `${locale && locale.code !== site.i18n?.defaultLocale ? `/${locale.code}` : ''}${version ? `/${version}` : ''}`
  return `${prefix}/search.json`
}

/** The language switcher: the same page in each locale, or that locale's home. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { site, current, navigate } = useSite()
  const t = useLabels()
  if (!site.i18n || site.i18n.locales.length < 2) return null
  const shape = shapeOf(site)
  const locale = currentLocale(site, current.page, current.route)!
  const hrefFor = (code: string) =>
    current.page ? counterpart(site.pages, shape, current.page, { locale: code }) : buildRoute(shape, '/', code)
  return (
    <Menu>
      <MenuTrigger
        render={<Button variant="ghost" size="sm" aria-label={t.language} className={cn('gap-1.5 px-2 text-muted-foreground', className)} />}
      >
        <GlobeIcon />
        <span className="max-sm:hidden">{locale.label}</span>
      </MenuTrigger>
      <MenuContent align="end" className="min-w-40">
        <MenuGroup>
          <MenuLabel>{t.language}</MenuLabel>
          <MenuRadioGroup value={locale.code} onValueChange={(code) => navigate(hrefFor(String(code)))}>
            {site.i18n.locales.map((l) => (
              <MenuRadioItem key={l.code} value={l.code} lang={l.lang}>
                {l.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuContent>
    </Menu>
  )
}

/** The docs version switcher; hidden versions are left out. */
export function VersionSwitcher({ className }: { className?: string }) {
  const { site, current, navigate } = useSite()
  const t = useLabels()
  const versions = site.versions
  if (!versions?.list.length) return null
  const page = current.page
  if (page && page.layout !== 'docs') return null
  const shape = shapeOf(site)
  const active = page?.version ?? ''
  const label = active ? (versions.list.find((v) => v.id === active)?.label ?? active) : versions.latest
  // Hidden versions and versions with no pages built are left out.
  const listed = versions.list.filter((v) => (!v.hidden || v.id === active) && site.pages.some((p) => p.version === v.id))
  if (!listed.length && !active) return null
  const go = (id: string) => {
    const to = { version: id || null }
    navigate(page ? counterpart(site.pages, shape, page, to) : buildRoute(shape, '/', currentLocale(site, null, current.route)?.code, id || undefined))
  }
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button variant="secondary" size="sm" aria-label={`${t.version}: ${label}`} className={cn('w-full justify-between px-3 font-normal', className)} />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">{t.version}</span>
          <span className="truncate font-medium">{label}</span>
        </span>
        <ChevronsUpDownIcon className="text-muted-foreground" />
      </MenuTrigger>
      <MenuContent align="start" className="min-w-(--anchor-width)">
        <MenuRadioGroup value={active} onValueChange={(id) => go(String(id))}>
          <MenuRadioItem value="">{versions.latest}</MenuRadioItem>
          {listed.map((v) => (
            <MenuRadioItem key={v.id} value={v.id}>
              {v.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}

/** "You are reading the docs for v1" above an older version's page, with a link to the current one. */
export function VersionNotice({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const t = useLabels()
  if (!page.version || !site.versions) return null
  const version = site.versions.list.find((v) => v.id === page.version)
  const label = version?.label ?? page.version
  const latest = counterpart(site.pages, shapeOf(site), page, { version: null })
  return (
    <Alert variant="warning" data-novon-chrome="" data-novon-version-notice="">
      <AlertIcon>
        <InfoIcon />
      </AlertIcon>
      <AlertContent>
        <AlertDescription>
          {fill(version?.archived ? t.archivedVersion : t.outdatedVersion, { version: label })}{' '}
          <Link href={latest} exact className="font-medium text-foreground underline underline-offset-2">
            {t.viewLatest}
          </Link>
        </AlertDescription>
      </AlertContent>
    </Alert>
  )
}

/** The note on a page shown in the default language because it has no translation yet. */
export function FallbackNotice({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const t = useLabels()
  if (!page.fallback || !site.i18n) return null
  const locale = site.i18n.locales.find((l) => l.code === page.locale)
  const original = site.i18n.locales.find((l) => l.code === site.i18n!.defaultLocale)
  return (
    <Alert data-novon-chrome="" data-novon-fallback="">
      <AlertIcon>
        <GlobeIcon />
      </AlertIcon>
      <AlertContent>
        <AlertDescription>{fill(t.untranslated, { language: locale?.label ?? page.locale ?? '', original: original?.label ?? '' })}</AlertDescription>
      </AlertContent>
    </Alert>
  )
}
