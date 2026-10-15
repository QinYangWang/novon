import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from '@/ui/drawer'
import { ScrollArea } from '@/ui/scroll-area'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/ui/breadcrumb'
import { ArrowLeftIcon, ArrowRightIcon, SidebarIcon } from '@/components/icons'
import { formatDate } from '../../shared.ts'
import type { Heading, PageMeta } from '../../types.ts'
import { Brand, Footer, NotFound, PageActions, PageContent, Search, SocialLinks, ThemeButton } from '../chrome.tsx'
import { Icon } from '../icons.tsx'
import { Link } from '../link.tsx'
import { docsNav, flatten, type NavSection } from '../nav.ts'
import { layoutOf, useOverride, useSite } from '../site.tsx'

function useSections(): NavSection[] {
  const { site, current } = useSite()
  const layer = current.page?.layer ?? layoutOf(site, current.route).path
  return React.useMemo(() => docsNav(site.pages, layer), [site.pages, layer])
}

function NavLink({ page, label, depth, onNavigate }: { page: PageMeta; label: string; depth: number; onNavigate?: () => void }) {
  const { current } = useSite()
  const active = current.route === page.route
  return (
    <Link
      href={page.route}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      style={depth ? { paddingLeft: `${8 + depth * 12}px` } : undefined}
      className={cn(
        'flex h-7 items-center gap-2 rounded-md px-2 text-ui text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        active && 'bg-secondary font-medium text-foreground',
      )}
    >
      {page.icon && <Icon name={page.icon} className="size-4 shrink-0" />}
      <span className="truncate">{label}</span>
    </Link>
  )
}

function DefaultSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const sections = useSections()
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-5 px-3 pb-6">
      {sections.map((s, i) => (
        <div key={s.label || i} className="flex flex-col gap-px">
          {s.label && <p className="mb-1 px-2 text-ui-xs font-medium text-muted-foreground/80">{s.label}</p>}
          {s.items.map(({ page, depth }) => (
            <NavLink
              key={page.route}
              page={page}
              depth={depth}
              label={page.route === s.route ? 'Overview' : page.label}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  )
}

function Sidebar(props: { onNavigate?: () => void }) {
  const Component = useOverride('Sidebar', DefaultSidebar)
  return <Component {...props} />
}

function TopNav() {
  const { site } = useSite()
  if (!site.nav.length) return null
  return (
    <nav className="hidden items-center md:flex">
      {site.nav.map((l) => (
        <Button key={l.href} variant="ghost" size="sm" nativeButton={false} render={<Link href={l.href} />}>
          {l.label}
        </Button>
      ))}
    </nav>
  )
}

function Trail() {
  const sections = useSections()
  const { current } = useSite()
  const page = current.page
  if (!page) return null
  const section = sections.find((s) => s.label && s.items.some((i) => i.page.route === page.route))
  return (
    <Breadcrumb className="hidden min-w-0 lg:block">
      <BreadcrumbList size="sm">
        {section && (
          <>
            <BreadcrumbItem>
              {section.route ? <BreadcrumbLink render={<Link href={section.route} />}>{section.label}</BreadcrumbLink> : section.label}
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        <BreadcrumbItem>
          <BreadcrumbPage>{page.label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function DefaultHeader({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md lg:px-6">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation" onClick={onOpenNav}>
        <SidebarIcon />
      </Button>
      <Brand className="lg:hidden" />
      <Trail />
      <div className="flex-1" />
      <TopNav />
      <Search compact className="lg:hidden" />
      <PageActions />
    </header>
  )
}

function Toc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = React.useState<string | null>(null)
  React.useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e)
    if (!els.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-64px 0px -66% 0px' },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [headings])
  if (headings.length < 2) return null
  return (
    <nav aria-label="On this page" className="flex flex-col gap-1 text-ui-sm">
      <p className="mb-1 font-medium text-foreground">On this page</p>
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          className={cn(
            'truncate py-0.5 text-muted-foreground transition-colors hover:text-foreground',
            h.depth === 3 && 'pl-3',
            active === h.id && 'text-primary',
          )}
        >
          {h.text}
        </a>
      ))}
    </nav>
  )
}

function PrevNext({ page }: { page: PageMeta }) {
  const order = flatten(useSections())
  const i = order.findIndex((p) => p.route === page.route)
  if (i < 0) return null
  const prev = order[i - 1]
  const next = order[i + 1]
  const card = (p: PageMeta, dir: 'prev' | 'next') => (
    <Link
      href={p.route}
      className={cn(
        'group flex flex-col gap-0.5 rounded-xl bg-card p-3 shadow-raised transition-shadow hover:shadow-raised-hover',
        dir === 'next' && 'items-end text-right sm:col-start-2',
      )}
    >
      <span className="flex items-center gap-1 text-ui-xs text-muted-foreground">
        {dir === 'prev' ? <ArrowLeftIcon className="size-3.5" /> : null}
        {dir === 'prev' ? 'Previous' : 'Next'}
        {dir === 'next' ? <ArrowRightIcon className="size-3.5" /> : null}
      </span>
      <span className="text-ui font-medium text-foreground group-hover:text-primary">{p.label}</span>
    </Link>
  )
  if (!prev && !next) return null
  return (
    <div className="mt-12 grid gap-3 sm:grid-cols-2">
      {prev && card(prev, 'prev')}
      {next && card(next, 'next')}
    </div>
  )
}

export function DocsPage() {
  const { site, current } = useSite()
  const page = current.page
  if (!page) return <NotFound />
  const toc = site.theme.toc && (page.headings?.length ?? 0) > 1
  return (
    <div className="mx-auto flex w-full max-w-[72rem] gap-12 px-5 py-10 lg:px-10">
      <main className="min-w-0 flex-1">
        <article className="typeset typeset-docs">
          <h1>{page.title}</h1>
          {page.description && <p className="!mt-2 text-lg text-muted-foreground">{page.description}</p>}
          <PageContent />
        </article>
        <PrevNext page={page} />
        {page.updated && (
          <p className="mt-8 text-ui-xs text-muted-foreground">Last updated {formatDate(page.updated, site.lang)}</p>
        )}
      </main>
      {toc && (
        <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] w-52 shrink-0 self-start overflow-y-auto xl:block">
          <Toc headings={page.headings!} />
        </aside>
      )}
    </div>
  )
}

export function DocsLayout() {
  const [navOpen, setNavOpen] = React.useState(false)
  const { site, current } = useSite()
  const Header = useOverride('Header', DefaultHeader)
  React.useEffect(() => setNavOpen(false), [current.route])
  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-shell-border bg-shell lg:flex">
        <div className="flex h-12 items-center px-5">
          <Brand />
        </div>
        <div className="px-3 pb-3">
          <Search className="w-full" />
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <Sidebar />
        </ScrollArea>
        <div className="flex items-center gap-1 border-t border-shell-border px-3 py-2">
          <ThemeButton />
          <SocialLinks />
        </div>
      </aside>
      <Drawer open={navOpen} onOpenChange={setNavOpen} side="left">
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{site.title}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <Sidebar onNavigate={() => setNavOpen(false)} />
            <div className="flex items-center gap-1 px-3">
              <ThemeButton />
              <SocialLinks />
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <div className="lg:pl-64">
        <Header onOpenNav={() => setNavOpen(true)} />
        <DocsPage />
        <Footer className="mx-auto max-w-[72rem] border-t border-border px-5 py-6 lg:px-10" />
      </div>
    </div>
  )
}
