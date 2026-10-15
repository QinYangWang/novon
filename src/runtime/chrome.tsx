/** Parts both layouts share: brand, search, theme, footer, page actions, 404. */
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/menu'
import { ThemeToggle } from '@/ui/theme-toggle'
import { CommandPalette, type CommandPaletteItem } from '@/components/command-palette'
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  EditIcon,
  ExternalLinkIcon,
  FileIcon,
  GithubIcon,
  MailIcon,
  SearchIcon,
} from '@/components/icons'
import { withBase } from '../shared.ts'
import { Link } from './link.tsx'
import { resolveIcon } from './icons.tsx'
import { useOverride, useSite } from './site.tsx'

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
  return <ThemeToggle variant="ghost" aria-label="Toggle theme" />
}

export function SocialLinks() {
  const { site } = useSite()
  const social = site.theme.social ?? {}
  return (
    <>
      {social.github && (
        <Button variant="ghost" size="icon-sm" aria-label="GitHub" nativeButton={false} render={<a href={social.github} target="_blank" rel="noreferrer" />}>
          <GithubIcon />
        </Button>
      )}
      {social.email && (
        <Button variant="ghost" size="icon-sm" aria-label="Email" nativeButton={false} render={<a href={`mailto:${social.email}`} />}>
          <MailIcon />
        </Button>
      )}
    </>
  )
}

type SearchEntry = { route: string; title: string; description?: string; section?: string; headings?: string[]; text?: string; icon?: string }

/** The search button and the command palette it opens (⌘K). */
export function Search({ className, compact }: { className?: string; compact?: boolean }) {
  const { site, navigate } = useSite()
  const [open, setOpen] = React.useState(false)
  const [entries, setEntries] = React.useState<SearchEntry[] | null>(null)

  React.useEffect(() => {
    if (!open || entries) return
    fetch(withBase(site.base, '/search.json'))
      .then((r) => (r.ok ? r.json() : []))
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [open, entries, site.base])

  const items = React.useMemo<CommandPaletteItem[]>(() => {
    const source: SearchEntry[] =
      entries ?? site.pages.filter((p) => p.kind === 'page' && !p.hidden).map((p) => ({ route: p.route, title: p.title, description: p.description }))
    return source.map((e) => ({
      id: e.route,
      label: e.title,
      description: e.description,
      group: e.section,
      icon: resolveIcon(e.icon),
      keywords: [...(e.headings ?? []), ...(e.text ? [e.text] : [])],
      onSelect: () => navigate(e.route),
    }))
  }, [entries, site.pages, navigate])

  if (!site.search) return null
  return (
    <>
      {compact ? (
        <Button variant="ghost" size="icon-sm" aria-label="Search" onClick={() => setOpen(true)} className={className}>
          <SearchIcon />
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className={cn('justify-start text-muted-foreground', className)}>
          <SearchIcon data-icon="inline-start" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="font-sans text-ui-xs text-muted-foreground">⌘K</kbd>
        </Button>
      )}
      <CommandPalette items={items} open={open} onOpenChange={setOpen} placeholder="Search the site…" />
    </>
  )
}

/** Copy the page as Markdown, open it raw, or edit it. */
export function PageActions() {
  const { site, current } = useSite()
  const [copied, setCopied] = React.useState(false)
  const page = current.page
  if (!page?.file) return null
  const md = withBase(site.base, `${page.route === '/' ? '/index' : page.route}.md`)
  const copy = async () => {
    const text = await fetch(md).then((r) => r.text())
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center">
      <Button variant="ghost" size="sm" onClick={copy} className="rounded-r-none">
        {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {copied ? 'Copied' : 'Copy page'}
      </Button>
      <Menu>
        <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More page actions" className="rounded-l-none" />}>
          <ChevronDownIcon />
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem render={<a href={md} target="_blank" rel="noreferrer" />}>
            <FileIcon /> View as Markdown
          </MenuItem>
          {site.theme.editLink && (
            <MenuItem render={<a href={`${site.theme.editLink.replace(/\/?$/, '/')}${page.file}`} target="_blank" rel="noreferrer" />}>
              <EditIcon /> Edit this page
            </MenuItem>
          )}
          <MenuItem
            render={
              <a
                href={`https://chatgpt.com/?q=${encodeURIComponent(`Read ${site.url ? new URL(md, site.url).href : md} and answer questions about it.`)}`}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <ExternalLinkIcon /> Ask about this page
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  )
}

function DefaultFooter({ className }: { className?: string }) {
  const { site } = useSite()
  const footer = site.theme.footer
  return (
    <footer className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-ui-sm text-muted-foreground', className)}>
      <span>{footer?.text ?? `© ${new Date().getFullYear()} ${site.title}`}</span>
      {footer?.links?.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-foreground">
          {l.label}
        </Link>
      ))}
      <span className="ml-auto">
        Built with{' '}
        <a href="https://github.com/QinYangWang/novon" className="hover:text-foreground">
          novon
        </a>
      </span>
    </footer>
  )
}

export function Footer(props: { className?: string }) {
  const Component = useOverride('Footer', DefaultFooter)
  return <Component {...props} />
}

function DefaultNotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-24">
      <p className="font-mono text-ui-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">This page doesn't exist</h1>
      <p className="text-muted-foreground">It may have moved, or the link is mistyped.</p>
      <Button variant="secondary" nativeButton={false} render={<Link href="/" />}>
        Go home
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

