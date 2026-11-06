/** Parts both layouts share: brand, search, theme, footer, page actions, 404. */
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/ui/menu'
import { ThemeToggle } from '@/ui/theme-toggle'
import { Kbd } from '@/ui/kbd'
import { CommandPalette, type CommandPaletteItem } from '@/components/command-palette'
import { siClaude, siPerplexity } from 'simple-icons'
import { BrandIcon, type BrandIconData } from '@/ui/brand-icon'
import { markOpenai } from '@/lib/brand-marks'
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  CornerDownRightIcon,
  DownloadIcon,
  EditIcon,
  ExternalLinkIcon,
  FileIcon,
  GithubIcon,
  MailIcon,
  MoreHorizontalIcon,
  PlayIcon,
  RssIcon,
  SearchIcon,
} from '@/components/icons'
import { withBase } from '../shared.ts'
import { startReading, useSpeechSupported } from './listen.tsx'
import { Link } from './link.tsx'
import { resolveIcon } from './icons.tsx'
import { useLabels, useOverride, useSite } from './site.tsx'
import { fill } from '../labels.ts'
import { loadSearchIndex, search, type SearchEntry } from './search.ts'
import type { PageAction, PageMeta, SiteData } from '../types.ts'
import { currentLocale, searchIndexPath } from './i18n.tsx'

export function Brand({ className }: { className?: string }) {
  const { site } = useSite()
  const { logo, logoDark } = site.theme
  return (
    <Link href="/" className={cn('flex items-center gap-2 font-semibold text-foreground', className)}>
      {logo ? (
        <>
          <img src={withBase(site.base, logo)} alt={site.title} className={cn('h-6 w-auto', logoDark && 'dark:hidden')} />
          {logoDark && <img src={withBase(site.base, logoDark)} alt={site.title} className="hidden h-6 w-auto dark:block" />}
        </>
      ) : (
        <span className="truncate">{site.title}</span>
      )}
    </Link>
  )
}

export function ThemeButton() {
  // The toggle names itself in the site's language; `theme.labels.theme` replaces that name.
  return <ThemeToggle modes="tri" variant="ghost" aria-label={useSite().site.theme.labels?.theme} />
}

export function SocialLinks() {
  const { site, current } = useSite()
  const social = site.theme.social ?? {}
  const t = useLabels()
  const locale = currentLocale(site, current.page, current.route)
  const feed = `${locale && locale.code !== site.i18n?.defaultLocale ? `/${locale.code}` : ''}${site.rssPath}`
  return (
    <>
      {social.github && (
        <Button variant="ghost" size="icon-sm" aria-label="GitHub" nativeButton={false} render={<a href={social.github} target="_blank" rel="noreferrer" />}>
          <GithubIcon />
        </Button>
      )}
      {social.email && (
        <Button variant="ghost" size="icon-sm" aria-label={t.email} nativeButton={false} render={<a href={`mailto:${social.email}`} />}>
          <MailIcon />
        </Button>
      )}
      {social.rss && site.rss && (
        <Button variant="ghost" size="icon-sm" aria-label={t.rssFeed} nativeButton={false} render={<a href={withBase(site.base, feed)} type="application/rss+xml" />}>
          <RssIcon />
        </Button>
      )}
    </>
  )
}

/** The search button and the command palette it opens (⌘K): pages and their heading sections, full text. */
export function Search({ className, compact }: { className?: string; compact?: boolean }) {
  const { site, navigate, current } = useSite()
  const [open, setOpen] = React.useState(false)
  const [entries, setEntries] = React.useState<SearchEntry[] | null>(null)
  const [query, setQuery] = React.useState('')
  const t = useLabels()
  const indexPath = searchIndexPath(site, current.page, current.route)

  React.useEffect(() => setEntries(null), [indexPath])
  React.useEffect(() => {
    if (!open) return setQuery('')
    if (!entries) void loadSearchIndex(site.base, indexPath).then(setEntries)
  }, [open, entries, site.base, indexPath])

  const items = React.useMemo<CommandPaletteItem[]>(() => {
    const q = query.trim()
    if (q && entries) {
      // Ranked here: the palette shows the results in this order, unfiltered.
      return search(entries, q, 30).map((r) => ({
        id: r.href,
        label: r.entry.heading ?? r.entry.title,
        description: r.entry.heading ? r.entry.title : undefined,
        ...(r.excerpt ? { excerpt: r.excerpt, highlight: r.highlight } : {}),
        group: r.entry.section,
        icon: r.entry.heading ? CornerDownRightIcon : resolveIcon(r.entry.icon),
        onSelect: () => navigate(r.href),
      }))
    }
    const pages = entries ? entries.filter((e) => !e.heading) : site.pages.filter((p) => p.kind === 'page' && !p.hidden && !p.fallback && p.locale === current.page?.locale && p.version === current.page?.version).map((p) => ({ route: p.route, title: p.title, description: p.description, icon: p.icon, section: undefined as string | undefined }))
    return pages.map((e) => ({
      id: e.route,
      label: e.title,
      description: e.description,
      group: e.section,
      icon: resolveIcon(e.icon),
      onSelect: () => navigate(e.route),
    }))
  }, [entries, query, site.pages, navigate, current.page])

  if (!site.search) return null
  return (
    <>
      {compact ? (
        <Button variant="ghost" size="icon-sm" aria-label={t.search} onClick={() => setOpen(true)} className={className}>
          <SearchIcon />
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          aria-label={t.search}
          aria-keyshortcuts="Meta+K"
          onClick={() => setOpen(true)}
          className={cn('w-8 px-0 text-muted-foreground sm:w-56 sm:justify-start sm:px-3', className)}
        >
          <SearchIcon />
          <span className="hidden sm:inline">{t.searchButton}</span>
          <Kbd className="ms-auto max-sm:hidden">⌘K</Kbd>
        </Button>
      )}
      <CommandPalette
        items={items}
        query={query}
        onQueryChange={setQuery}
        filter={query.trim() && entries ? false : undefined}
        open={open}
        onOpenChange={setOpen}
        placeholder={t.searchPlaceholder}
      />
    </>
  )
}

/** "Edit this page": a source's own edit link, else `theme.editLink` + the file; none for generated pages. */
export function editUrl(site: SiteData, page: PageMeta): string | undefined {
  if (page.editUrl !== undefined) return page.editUrl || undefined
  return site.theme.editLink && page.file ? `${site.theme.editLink.replace(/\/?$/, '/')}${page.file}` : undefined
}

const DEFAULT_ACTIONS: PageAction[] = ['copy', 'markdown', 'pdf', 'listen', 'edit', 'chatgpt', 'claude', 'perplexity']

/** Chat apps that take a prompt in the URL. */
const CHATS: Record<'chatgpt' | 'claude' | 'perplexity', { name: string; href: string; icon: BrandIconData }> = {
  chatgpt: { name: 'ChatGPT', href: 'https://chatgpt.com/?q={prompt}', icon: markOpenai },
  claude: { name: 'Claude', href: 'https://claude.ai/new?q={prompt}', icon: siClaude },
  perplexity: { name: 'Perplexity', href: 'https://www.perplexity.ai/search?q={prompt}', icon: siPerplexity },
}

/** Fills `{markdown}`, `{url}` and `{prompt}` in an action's link. */
export function actionHref(template: string, values: { markdown: string; url: string; prompt: string }): string {
  return template
    .replace(/\{markdown\}/g, encodeURIComponent(values.markdown))
    .replace(/\{url\}/g, encodeURIComponent(values.url))
    .replace(/\{prompt\}/g, encodeURIComponent(values.prompt))
}

/** Copy the page as Markdown, open it raw, edit it, or open it in a chat app; the list follows `theme.pageActions`. */
export function PageActions() {
  const { site, current } = useSite()
  const [copied, setCopied] = React.useState(false)
  const t = useLabels()
  const speech = useSpeechSupported()
  const page = current.page
  const actions = site.theme.pageActions === false ? [] : (site.theme.pageActions ?? DEFAULT_ACTIONS)
  if (!page?.file || !actions.length) return null
  // A fallback page has no Markdown copy of its own; the original's is the same text.
  const mdRoute = page.fallback ? (site.pages.find((p) => p.file === page.file && !p.fallback)?.route ?? page.route) : page.route
  const md = withBase(site.base, `${mdRoute === '/' ? '/index' : mdRoute}.md`)
  const abs = (path: string) => (site.url ? new URL(path, site.url).href : path)
  const values = { markdown: abs(md), url: abs(withBase(site.base, page.route)), prompt: fill(t.openInPrompt, { url: abs(md) }) }
  const copy = async () => {
    const text = await fetch(md).then((r) => r.text())
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const external = (href: string) => <a href={href} target="_blank" rel="noreferrer" />
  const items: React.ReactNode[] = []
  let chats = false
  for (const [i, action] of actions.entries()) {
    if (action === 'copy') continue
    if (action === 'markdown') {
      items.push(
        <MenuItem key={i} render={external(md)}>
          <FileIcon /> {t.viewMarkdown}
        </MenuItem>,
      )
    } else if (action === 'pdf') {
      items.push(
        <MenuItem key={i} onClick={() => window.print()}>
          <DownloadIcon /> {t.downloadPdf}
        </MenuItem>,
      )
    } else if (action === 'listen') {
      if (!speech) continue
      items.push(
        <MenuItem key={i} onClick={() => startReading()}>
          <PlayIcon /> {t.listen}
        </MenuItem>,
      )
    } else if (action === 'edit') {
      const edit = editUrl(site, page)
      if (!edit) continue
      items.push(
        <MenuItem key={i} render={external(edit)}>
          <EditIcon /> {t.editPage}
        </MenuItem>,
      )
    } else {
      const chat = typeof action === 'string' ? CHATS[action] : { name: action.label, href: action.href, icon: undefined }
      if (!chat) continue
      // One line between the page's own actions and the apps it opens in.
      if (!chats && items.length) items.push(<MenuSeparator key={`sep-${i}`} />)
      chats = true
      items.push(
        <MenuItem key={i} render={external(actionHref(chat.href, values))}>
          {chat.icon ? <BrandIcon icon={chat.icon} /> : <ExternalLinkIcon />} {typeof action === 'string' ? fill(t.openIn, { name: chat.name }) : chat.name}
        </MenuItem>,
      )
    }
  }
  const hasCopy = actions.includes('copy')
  return (
    <div className="flex items-center">
      {hasCopy && (
        <Button variant="ghost" size="sm" onClick={copy} className={cn(items.length && 'rounded-r-none')}>
          {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
          {copied ? t.copied : t.copyPage}
        </Button>
      )}
      {items.length > 0 && (
        <Menu>
          <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t.morePageActions} className={cn(hasCopy && 'rounded-l-none')} />}>
            {hasCopy ? <ChevronDownIcon /> : <MoreHorizontalIcon />}
          </MenuTrigger>
          <MenuContent align="end">{items}</MenuContent>
        </Menu>
      )}
    </div>
  )
}

function DefaultFooter({ className }: { className?: string }) {
  const { site } = useSite()
  const footer = site.theme.footer
  const [before, after = ''] = useLabels().builtWith.split('{novon}')
  return (
    <footer data-novon-chrome="" className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-ui-sm text-muted-foreground', className)}>
      <span>{footer?.text ?? `© ${new Date().getFullYear()} ${site.title}`}</span>
      {footer?.links?.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-foreground">
          {l.label}
        </Link>
      ))}
      <span className="ml-auto">
        {before}
        <a href="https://github.com/QinYangWang/novon" className="hover:text-foreground">
          novon
        </a>
        {after}
      </span>
    </footer>
  )
}

export function Footer(props: { className?: string }) {
  const Component = useOverride('Footer', DefaultFooter)
  return <Component {...props} />
}

function DefaultNotFound() {
  const t = useLabels()
  return (
    <div className="flex flex-col items-start gap-3 py-24">
      <p className="font-mono text-ui-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">{t.notFoundTitle}</h1>
      <p className="text-muted-foreground">{t.notFoundText}</p>
      <Button variant="secondary" nativeButton={false} render={<Link href="/" />}>
        {t.goHome}
      </Button>
    </div>
  )
}

export function NotFound() {
  const Component = useOverride('NotFound', DefaultNotFound)
  return <Component />
}

/** The current page's MDX body. */
export function PageContent() {
  const { current } = useSite()
  const Content = current.module?.default
  return Content ? <Content /> : null
}

