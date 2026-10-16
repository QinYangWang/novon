import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '@/ui/drawer'
import { SidebarNav, SidebarNavContent, SidebarNavLink, SidebarNavList, SidebarNavSection } from '@/ui/sidebar-nav'
import { PageHeader, PageHeaderContent, PageHeaderDescription, PageHeaderEyebrow, PageHeaderTitle } from '@/ui/page-header'
import { ArrowLeftIcon, ArrowRightIcon, EditIcon, MenuIcon } from '@/components/icons'
import { formatDate } from '../../shared.ts'
import type { PageMeta } from '../../types.ts'
import { Brand, Footer, NotFound, PageActions, PageContent, Search, SocialLinks, ThemeButton } from '../chrome.tsx'
import { Icon } from '../icons.tsx'
import { Link } from '../link.tsx'
import { docsNav, flatten, type NavItem, type NavSection } from '../nav.ts'
import { Outline, OutlinePopover } from '../outline.tsx'
import { layoutOf, useOverride, useSite } from '../site.tsx'

function useSections(): NavSection[] {
  const { site, current } = useSite()
  const layer = current.page?.layer ?? layoutOf(site, current.route).path
  return React.useMemo(() => docsNav(site.pages, layer), [site.pages, layer])
}

type Row = { item: NavItem; children: NavItem[] }

/** A top-level row and the deeper rows that follow it. */
function groupRows(items: NavItem[]): Row[] {
  const rows: Row[] = []
  for (const it of items) {
    const last = rows.at(-1)
    if (it.depth > 0 && last) last.children.push(it)
    else rows.push({ item: it, children: [] })
  }
  return rows
}

/** Runs of plain rows become one list; a row with children becomes a group headed by its own page. */
function runs(rows: Row[]): (Row[] | Row)[] {
  const out: (Row[] | Row)[] = []
  for (const row of rows) {
    const last = out.at(-1)
    if (row.children.length) out.push(row)
    else if (Array.isArray(last)) last.push(row)
    else out.push([row])
  }
  return out
}

function DefaultSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const sections = useSections()
  const { current } = useSite()
  const link = (route: string) => <Link href={route} onClick={onNavigate} />
  const isCurrent = (route?: string) => route !== undefined && current.route === route
  const rows = (items: NavItem[]) =>
    runs(groupRows(items)).map((run) => {
      if (Array.isArray(run)) {
        return (
          <SidebarNavList key={run[0]!.item.page.route}>
            {run.map(({ item: { page } }) => (
              <SidebarNavLink
                key={page.route}
                icon={page.icon ? <Icon name={page.icon} /> : undefined}
                active={isCurrent(page.route)}
                render={link(page.route)}
              >
                {page.label}
              </SidebarNavLink>
            ))}
          </SidebarNavList>
        )
      }
      const { page } = run.item
      const open = isCurrent(page.route) || run.children.some((c) => isCurrent(c.page.route))
      return (
        <SidebarNavSection
          key={page.route}
          level="group"
          label={page.label}
          labelRender={link(page.route)}
          active={isCurrent(page.route)}
          defaultOpen={open}
        >
          <SidebarNavList>
            {run.children.map(({ page: child }) => (
              <SidebarNavLink key={child.route} active={isCurrent(child.route)} render={link(child.route)}>
                {child.label}
              </SidebarNavLink>
            ))}
          </SidebarNavList>
        </SidebarNavSection>
      )
    })
  return (
    <SidebarNav>
      <SidebarNavContent aria-label="Documentation" className="pt-4">
        {sections.map((s, i) => {
          if (!s.label) return <React.Fragment key={i}>{rows(s.items)}</React.Fragment>
          const items = s.route ? s.items.filter((it) => it.page.route !== s.route) : s.items
          return (
            <SidebarNavSection
              key={s.label}
              label={s.label}
              labelRender={s.route ? link(s.route) : undefined}
              active={isCurrent(s.route)}
            >
              {rows(items)}
            </SidebarNavSection>
          )
        })}
      </SidebarNavContent>
    </SidebarNav>
  )
}

function Sidebar(props: { onNavigate?: () => void }) {
  const Component = useOverride('Sidebar', DefaultSidebar)
  return <Component {...props} />
}

function TopNav() {
  const { site, current } = useSite()
  if (!site.nav.length) return null
  return (
    <nav aria-label="Main" className="hidden items-center md:flex">
      {site.nav.map((l) => {
        const active = current.route === l.href || current.route.startsWith(`${l.href}/`)
        return (
          <Button key={l.href} variant="ghost" size="sm" className={cn(!active && 'text-muted-foreground')} nativeButton={false} render={<Link href={l.href} />}>
            {l.label}
          </Button>
        )
      })}
    </nav>
  )
}

function DefaultHeader({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <header className="sticky top-0 z-40 h-14 shrink-0 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex h-full items-center gap-3 px-3 sm:px-4">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation" onClick={onOpenNav}>
          <MenuIcon />
        </Button>
        <Brand className="lg:ps-2" />
        <div className="ms-auto flex items-center gap-1.5">
          <TopNav />
          <Search />
          <div className="flex items-center max-sm:hidden">
            <SocialLinks />
          </div>
          <ThemeButton />
        </div>
      </div>
    </header>
  )
}

function PagerCard({ page, dir, section }: { page: PageMeta; dir: 'prev' | 'next'; section?: string }) {
  const next = dir === 'next'
  return (
    <Link
      href={page.route}
      className={cn(
        'group flex flex-col gap-1 rounded-2xl bg-card px-4 py-3.5 shadow-raised transition-shadow duration-150 outline-none hover:shadow-raised-hover focus-visible:ring-2 focus-visible:ring-ring/50',
        next ? 'items-end text-end sm:col-start-2' : 'items-start',
      )}
    >
      <span className="flex items-center gap-1.5 text-ui-xs text-muted-foreground">
        {!next && <ArrowLeftIcon className="size-3.5" />}
        {next ? 'Next' : 'Previous'}
        {section && ` · ${section}`}
        {next && <ArrowRightIcon className="size-3.5" />}
      </span>
      <span className="font-medium text-foreground">{page.label}</span>
    </Link>
  )
}

function sectionOf(sections: NavSection[], route: string): NavSection | undefined {
  return sections.find((s) => s.label && s.items.some((i) => i.page.route === route))
}

function Pager({ page }: { page: PageMeta }) {
  const sections = useSections()
  const order = flatten(sections)
  const i = order.findIndex((p) => p.route === page.route)
  if (i < 0) return null
  const prev = order[i - 1]
  const next = order[i + 1]
  if (!prev && !next) return null
  return (
    <nav aria-label="Pagination" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {prev && <PagerCard page={prev} dir="prev" section={sectionOf(sections, prev.route)?.label} />}
      {next && <PagerCard page={next} dir="next" section={sectionOf(sections, next.route)?.label} />}
    </nav>
  )
}

function DocsHeader({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const section = sectionOf(useSections(), page.route)
  const edit = site.theme.editLink && page.file ? `${site.theme.editLink.replace(/\/?$/, '/')}${page.file}` : undefined
  return (
    <PageHeader className="flex-col items-stretch gap-y-4">
      <PageHeaderContent className="gap-2">
        {section && section.route !== page.route && (
          <PageHeaderEyebrow>
            {section.route ? (
              <Link href={section.route} className="hover:text-foreground">
                {section.label}
              </Link>
            ) : (
              section.label
            )}
          </PageHeaderEyebrow>
        )}
        <PageHeaderTitle className="text-3xl leading-tight sm:text-4xl">{page.title}</PageHeaderTitle>
        {page.description && <PageHeaderDescription className="text-lg leading-relaxed">{page.description}</PageHeaderDescription>}
      </PageHeaderContent>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-ui-sm text-muted-foreground">
        {page.updated && <span>Updated {formatDate(page.updated, site.lang)}</span>}
        {page.readingTime && <span>{page.readingTime} min read</span>}
        {edit && (
          <a href={edit} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground max-sm:hidden">
            <EditIcon className="size-3.5" />
            Edit this page
          </a>
        )}
        <div className="ms-auto -me-2">
          <PageActions />
        </div>
      </div>
    </PageHeader>
  )
}

export function DocsPage() {
  const { site, current } = useSite()
  const page = current.page
  if (!page) {
    return (
      <div className="mx-auto w-full max-w-reading px-5 sm:px-8">
        <NotFound />
      </div>
    )
  }
  const toc = site.theme.toc && (page.headings?.length ?? 0) > 1
  return (
    <div className="flex min-w-0 justify-center gap-12 px-5 py-10 sm:px-8 lg:px-12">
      <main className="flex w-full max-w-reading min-w-0 flex-col gap-10">
        <DocsHeader page={page} />
        {toc && (
          <div className="sticky top-14 z-30 -my-4 bg-background py-2 xl:hidden">
            <OutlinePopover headings={page.headings} activeLine={136} className="max-w-sm" />
          </div>
        )}
        <article className="typeset typeset-docs">
          <PageContent />
        </article>
        <footer className="border-t border-border pt-8">
          <Pager page={page} />
        </footer>
      </main>
      {toc && (
        <aside className="sticky top-24 w-56 shrink-0 self-start max-xl:hidden">
          <Outline headings={page.headings} activeLine={136} maxHeight="calc(100svh - 8rem)" />
        </aside>
      )}
    </div>
  )
}

export function DocsLayout() {
  const [navOpen, setNavOpen] = React.useState(false)
  const { current } = useSite()
  const Header = useOverride('Header', DefaultHeader)
  React.useEffect(() => setNavOpen(false), [current.route])
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header onOpenNav={() => setNavOpen(true)} />
      <div className="flex min-w-0 flex-1">
        <aside aria-label="Documentation" className="sticky top-14 flex h-[calc(100dvh-3.5rem)] w-64 shrink-0 flex-col self-start border-e border-border max-lg:hidden">
          <Sidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1">
            <DocsPage />
          </div>
          <Footer className="border-t border-border px-5 py-6 sm:px-8 lg:px-12" />
        </div>
      </div>
      <Drawer side="left" open={navOpen} onOpenChange={setNavOpen}>
        <DrawerContent className="w-72">
          <DrawerTitle className="sr-only">Navigation</DrawerTitle>
          <div className="flex min-h-0 flex-1 flex-col pt-8">
            <Sidebar onNavigate={() => setNavOpen(false)} />
            <div className="flex shrink-0 items-center gap-1 border-t border-border px-3 py-2">
              <ThemeButton />
              <SocialLinks />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
