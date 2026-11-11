import * as React from 'react'
import { siGithub, siX } from 'simple-icons'
import { FallbackNotice, LanguageSwitcher } from '../i18n.tsx'
import { PageFeedback } from '../feedback.tsx'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { BrandIcon } from '@/ui/brand-icon'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/menu'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  HomeIcon,
  MailIcon,
  RssIcon,
} from '@/components/icons'
import { formatDate, postsOf, tagRoute, withBase } from '../../shared.ts'
import type { PageMeta } from '../../types.ts'
import { NotFound, PageContent, Search, ThemeButton } from '../chrome.tsx'
import { Banner } from '../extras.tsx'
import { Link } from '../link.tsx'
import { useLabels, useOverride, useSite } from '../site.tsx'
import { fill } from '../../labels.ts'

/**
 * The blog is one column of text: a quiet top bar, base-size titles, dates in mono, and every post
 * as a row under its year. This is the PaneUI "Personal Blog" template shape, with novon's search,
 * tags, language switcher and theme toggle kept as quiet extras.
 */

const crumbLink =
  'shrink-0 rounded-xs transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'

const rowLink =
  'flex items-baseline gap-4 rounded-md px-2 py-1.5 leading-6 transition-colors duration-150 outline-none hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring'

const pagerLink =
  'flex min-w-0 flex-col gap-1 rounded-md px-2 py-2 transition-colors duration-150 outline-none hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring'

/** The single column the blog lives in: one measure, centred, with room above the title. */
function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-reading px-5 pt-12 pb-20', className)}>{children}</div>
}

type SocialKind = 'github' | 'x' | 'email' | 'rss'

type Social = { kind: SocialKind; label: string; href: string }

/** Logos only: the label is the accessible name, not something drawn on the page. */
function SocialIcon({ kind }: { kind: SocialKind }) {
  if (kind === 'github') return <BrandIcon icon={siGithub} size={16} />
  if (kind === 'x') return <BrandIcon icon={siX} size={16} />
  if (kind === 'rss') return <RssIcon size={16} />
  return <MailIcon size={16} />
}

function SocialLink({ social }: { social: Social }) {
  return (
    <a
      href={social.href}
      rel="noreferrer"
      aria-label={social.label}
      title={social.label}
      className="inline-flex size-7 items-center justify-center rounded-control-sm text-muted-foreground transition-colors duration-150 outline-none hover:bg-foreground/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SocialIcon kind={social.kind} />
    </a>
  )
}

/** The site's pages behind one chevron, so the top bar stays a single quiet line. */
function SiteMenu() {
  const { site } = useSite()
  const t = useLabels()
  const items = [...site.nav, ...(site.rss ? [{ label: 'RSS', href: site.rssPath }] : [])]
  if (!items.length) return null
  return (
    <Menu>
      <MenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={t.mainNav} />}>
        <ChevronDownIcon />
      </MenuTrigger>
      <MenuContent>
        {items.map((item) => (
          <MenuItem key={item.href} render={<Link href={item.href} />}>
            {item.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}

/** Home, the site menu, then search, language and the theme toggle. No trail: at narrow widths it
 *  cut the page title short, and every page says what it is in its own heading. */
function DefaultTopBar() {
  const { site } = useSite()
  const t = useLabels()
  return (
    <header className="mb-10 flex min-h-7 items-center gap-2 text-sm text-muted-foreground">
      <nav aria-label={t.mainNav} className="flex min-w-0 items-center gap-2">
        <Link href="/" className={cn('inline-flex min-w-0 items-center gap-1.5', crumbLink)}>
          <HomeIcon size={14} />
          <span className="truncate">{site.title}</span>
        </Link>
        <SiteMenu />
      </nav>
      <div className="ms-auto flex shrink-0 items-center gap-0.5">
        <Search compact />
        <LanguageSwitcher size="responsive" fallbackClassName="text-ui-sm" />
        <ThemeButton />
      </div>
    </header>
  )
}

function TopBar() {
  const Header = useOverride('Header', DefaultTopBar)
  return <Header />
}

/** `08/19`, the short form in a year group. */
function shortDate(date?: string): string {
  return date ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : ''
}

function PostRows({ posts }: { posts: PageMeta[] }) {
  return (
    <ul className="-mx-2 flex flex-col">
      {posts.map((post) => (
        <li key={post.route}>
          <Link href={post.route} className={rowLink}>
            <span className="min-w-0 wrap-anywhere">{post.title}</span>
            <time dateTime={post.date} className="ms-auto shrink-0 font-mono text-muted-foreground tabular-nums">
              {shortDate(post.date)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Posts newest first, grouped under the year in their date. */
function PostGroups({ posts }: { posts: PageMeta[] }) {
  const groups = new Map<string, PageMeta[]>()
  for (const post of posts) {
    const year = (post.date ?? '').slice(0, 4) || '—'
    const group = groups.get(year)
    if (group) group.push(post)
    else groups.set(year, [post])
  }
  return (
    <div className="flex flex-col gap-8">
      {[...groups].map(([year, group]) => (
        <section
          key={year}
          aria-labelledby={`year-${year}`}
          className="grid grid-cols-1 gap-2 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-4"
        >
          <h2 id={`year-${year}`} className="font-mono text-base font-normal text-balance text-muted-foreground sm:py-1.5">
            {year}
          </h2>
          <PostRows posts={group} />
        </section>
      ))}
    </div>
  )
}

/** The row of logos under the intro. */
function Elsewhere() {
  const { site } = useSite()
  const social = site.theme.social ?? {}
  const socials: Social[] = []
  if (social.github) socials.push({ kind: 'github', label: 'GitHub', href: social.github })
  if (social.x) socials.push({ kind: 'x', label: 'X', href: social.x })
  if (social.email) socials.push({ kind: 'email', label: 'Email', href: `mailto:${social.email}` })
  if (social.rss && site.rss) socials.push({ kind: 'rss', label: 'RSS', href: withBase(site.base, site.rssPath) })
  if (!socials.length) return null
  return (
    <div className="-ms-1.5 mb-10 flex items-center gap-0.5">
      {socials.map((social) => (
        <SocialLink key={social.kind} social={social} />
      ))}
    </div>
  )
}

function FooterLine() {
  const { site } = useSite()
  const text = site.theme.footer?.text
  if (!text) return null
  return <p className="mt-16 border-t border-border pt-6 text-sm text-pretty text-muted-foreground">{text}</p>
}

/** Title, date, tags and the generated header image. */
function DefaultPostHeader({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const t = useLabels()
  const updated = site.theme.lastUpdated !== false && page.updated && page.date && page.updated > page.date ? page.updated : undefined
  const tags = page.tags.filter(Boolean)
  return (
    <header className="mb-8 flex flex-col gap-3">
      <h1 className="text-base font-medium text-balance wrap-anywhere">{page.title}</h1>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-sm text-muted-foreground tabular-nums">
        {page.date && <time dateTime={page.date}>{formatDate(page.date, site.lang)}</time>}
        {updated && <time dateTime={updated}>{fill(t.updated, { date: formatDate(updated, site.lang) })}</time>}
      </div>
      {tags.length > 0 && (
        <p className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {tags.map((tag) => (
            <Link key={tag} href={tagRoute(page.layer, tag, site.tags)} className={crumbLink}>
              #{tag}
            </Link>
          ))}
        </p>
      )}
    </header>
  )
}

function Post({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const t = useLabels()
  const PostHeader = useOverride('PostHeader', DefaultPostHeader)
  const posts = postsOf(site.pages, page.layer)
  const next = posts[posts.findIndex((post) => post.route === page.route) + 1]
  const count = fill(posts.length === 1 ? t.postCountOne : t.postCount, { n: posts.length })
  return (
    <Container>
      <TopBar />
      <main>
        <FallbackNotice page={page} />
        <article>
          <PostHeader page={page} />
          <div className="typeset typeset-reading">
            <PageContent />
          </div>
          <PageFeedback page={page} />
        </article>
        <nav aria-label={t.allPosts} className="-mx-2 mt-16 grid grid-cols-2 gap-4">
          <Link href={page.layer} className={pagerLink}>
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <ArrowLeftIcon size={14} className="rtl:-scale-x-100" />
              {t.allPosts}
            </span>
            <span className="truncate tabular-nums">{count}</span>
          </Link>
          {next && (
            <Link href={next.route} className={cn(pagerLink, 'items-end text-end')}>
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                {t.next}
                <ArrowRightIcon size={14} className="rtl:-scale-x-100" />
              </span>
              <span className="max-w-full truncate">{next.title}</span>
            </Link>
          )}
        </nav>
      </main>
      <FooterLine />
    </Container>
  )
}

function PostsIndex({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const t = useLabels()
  const posts = postsOf(site.pages, page.layer)
  const description = page.description ?? site.description
  return (
    <Container>
      <TopBar />
      <main>
        {/* The top bar already spells the site name, so the heading stays for assistive tech only. */}
        <h1 className="sr-only">{site.title}</h1>
        {description && <p className="mb-4 text-pretty text-muted-foreground first-letter:uppercase">{description}</p>}
        <Elsewhere />
        <PostGroups posts={posts} />
        {!posts.length && <p className="text-muted-foreground">{t.noPosts}</p>}
      </main>
      <FooterLine />
    </Container>
  )
}

function TagIndex({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const t = useLabels()
  const posts = postsOf(site.pages, page.layer).filter((post) => post.tags.includes(page.tag!))
  const count = fill(posts.length === 1 ? t.postCountOne : t.postCount, { n: posts.length })
  return (
    <Container>
      <TopBar />
      <main>
        <header className="mb-8 flex flex-col gap-2">
          <h1 className="text-base font-medium text-balance wrap-anywhere">#{page.tag}</h1>
          <p className="font-mono text-sm text-muted-foreground tabular-nums">{count}</p>
        </header>
        <PostGroups posts={posts} />
        {!posts.length && <p className="text-muted-foreground">{t.noPosts}</p>}
      </main>
      <FooterLine />
    </Container>
  )
}

function Page({ page }: { page: PageMeta }) {
  return (
    <Container>
      <TopBar />
      <main>
        <FallbackNotice page={page} />
        <header className="mb-8 flex flex-col gap-3">
          <h1 className="text-base font-medium text-balance wrap-anywhere">{page.title}</h1>
          {page.description && <p className="text-pretty text-muted-foreground">{page.description}</p>}
        </header>
        <div className="typeset typeset-reading">
          <PageContent />
        </div>
        <PageFeedback page={page} />
      </main>
      <FooterLine />
    </Container>
  )
}

function BlogBody() {
  const { current } = useSite()
  const page = current.page
  if (!page) {
    return (
      <Container>
        <TopBar />
        <NotFound />
      </Container>
    )
  }
  if (page.kind === 'posts') return <PostsIndex page={page} />
  if (page.kind === 'tag') return <TagIndex page={page} />
  // Undated pages (an about page, the layer's own index) are pages, not posts.
  if (page.route === page.layer || !page.date) return <Page page={page} />
  return <Post page={page} />
}

export function BlogLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Banner />
      <div className="flex-1">
        <BlogBody />
      </div>
    </div>
  )
}
