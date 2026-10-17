import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { ScrollProgress } from '@/ui/scroll-progress'
import { ArrowLeftIcon } from '@/components/icons'
import { postsOf, withBase } from '../../shared.ts'
import type { PageMeta } from '../../types.ts'
import { AuthorAvatar, useAuthor } from '../author.tsx'
import { Footer, NotFound, PageContent, Search, SocialLinks, ThemeButton } from '../chrome.tsx'
import { Link } from '../link.tsx'
import { Outline, OutlinePopover } from '../outline.tsx'
import { PostCard, PostCover, PostList, PostMeta, PostTags, TagList } from '../posts.tsx'
import { useLabels, useOverride, useSite } from '../site.tsx'
import { fill } from '../../labels.ts'

function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-5xl px-5 sm:px-8', className)}>{children}</div>
}

function Eyebrow({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-ui-xs font-medium tracking-wider text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

function BlogBrand() {
  const { site } = useSite()
  const { logo, logoDark } = site.theme
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-full font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
      {logo ? (
        <>
          <img src={withBase(site.base, logo)} alt="" className={cn('h-6 w-auto', logoDark && 'dark:hidden')} />
          {logoDark && <img src={withBase(site.base, logoDark)} alt="" className="hidden h-6 w-auto dark:block" />}
        </>
      ) : (
        <AuthorAvatar name={site.title} size="sm" />
      )}
      <span className="truncate">{site.title}</span>
    </Link>
  )
}

function DefaultHeader() {
  const { site, current } = useSite()
  const t = useLabels()
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/80 backdrop-blur">
      <Container className="flex h-full items-center gap-3">
        <BlogBrand />
        <nav aria-label={t.mainNav} className="ms-auto flex items-center gap-1">
          {site.nav.map((l) => {
            const active = l.href === '/' ? current.route === '/' : current.route === l.href || current.route.startsWith(`${l.href}/`)
            return (
              <Button key={l.href} variant="ghost" size="sm" className={cn(!active && 'text-muted-foreground')} nativeButton={false} render={<Link href={l.href} />}>
                {l.label}
              </Button>
            )
          })}
          <Search compact />
          <span className="flex items-center max-sm:hidden">
            <SocialLinks />
          </span>
          <ThemeButton />
        </nav>
      </Container>
    </header>
  )
}

function BackLink({ layer }: { layer: string }) {
  const t = useLabels()
  return (
    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={layer} />} className="-ms-3 text-muted-foreground">
      <ArrowLeftIcon data-icon="inline-start" />
      {t.allPosts}
    </Button>
  )
}

function DefaultPostHeader({ page }: { page: PageMeta }) {
  return (
    <header className="flex max-w-3xl flex-col items-start gap-5">
      <BackLink layer={page.layer} />
      <PostTags post={page} />
      <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">{page.title}</h1>
      {page.description && <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{page.description}</p>}
      <div className="flex items-center gap-3">
        {page.author && <AuthorAvatar name={page.author} />}
        <div className="flex flex-col leading-tight">
          {page.author && <span className="text-ui-sm font-medium">{page.author}</span>}
          <PostMeta post={page} />
        </div>
      </div>
    </header>
  )
}

function AuthorCard({ name }: { name: string }) {
  const author = useAuthor(name)
  const t = useLabels()
  if (!author?.bio) return null
  return (
    <section aria-label={t.aboutAuthor} className="flex max-w-reading flex-col gap-4 rounded-2xl bg-card p-6 shadow-raised sm:flex-row sm:items-center sm:gap-5">
      <AuthorAvatar name={name} size="xl" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{name}</p>
        <p className="text-ui leading-relaxed text-pretty text-muted-foreground">{author.bio}</p>
      </div>
      {author.url && (
        <Button variant="secondary" size="sm" className="shrink-0 sm:ms-auto" nativeButton={false} render={<a href={author.url} target="_blank" rel="noreferrer" />}>
          {t.follow}
        </Button>
      )}
    </section>
  )
}

/** Up to three other posts: shared tags first, then the most recent. */
function related(posts: PageMeta[], page: PageMeta): PageMeta[] {
  const others = posts.filter((p) => p.route !== page.route)
  const shared = (p: PageMeta) => p.tags.filter((t) => page.tags.includes(t)).length
  return [...others].sort((a, b) => shared(b) - shared(a)).slice(0, 3)
}

function Post({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const PostHeader = useOverride('PostHeader', DefaultPostHeader)
  const more = related(postsOf(site.pages, page.layer), page)
  const toc = site.theme.toc && (page.headings?.length ?? 0) > 1
  const t = useLabels()
  return (
    <>
      <ScrollProgress className="top-14" label={t.readingProgress} />
      <Container className="flex flex-col gap-10 pt-10 pb-24 sm:pt-14">
        <PostHeader page={page} />
        <PostCover post={page} className="aspect-video rounded-2xl outline -outline-offset-1 outline-image-outline sm:aspect-[21/9]" />
        <div className="flex justify-between gap-12">
          <div className="flex max-w-reading min-w-0 flex-1 flex-col gap-10">
            {toc && (
              <div className="sticky top-14 z-30 -my-4 bg-background py-2 lg:hidden">
                <OutlinePopover headings={page.headings} activeLine={136} title={t.onThisPage} className="max-w-sm" />
              </div>
            )}
              <article className="typeset typeset-reading">
              <PageContent />
            </article>
          </div>
          {toc && (
            <aside className="sticky top-24 w-56 shrink-0 self-start max-lg:hidden">
              <Outline headings={page.headings} activeLine={136} title={t.onThisPage} maxHeight="calc(100svh - 8rem)" />
            </aside>
          )}
        </div>
        {page.author && <AuthorCard name={page.author} />}
        {more.length > 0 && (
          <section aria-labelledby="more-title" className="flex flex-col gap-6 pt-6">
            <Eyebrow id="more-title">{t.keepReading}</Eyebrow>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {more.map((p) => (
                <PostCard key={p.route} post={p} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  )
}

function PostsIndex({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const posts = postsOf(site.pages, page.layer)
  const [latest] = posts
  const description = page.description ?? (page.layer === '/' ? site.description : undefined)
  const t = useLabels()
  return (
    <Container className="flex flex-col gap-20 py-16 sm:py-24">
      <header className="flex max-w-2xl flex-col items-start gap-6">
        {page.layer === '/' && !site.theme.logo && <AuthorAvatar name={site.title} size="xl" />}
        <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">{page.title}</h1>
        {description && <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{description}</p>}
      </header>
      {latest && (
        <section aria-labelledby="latest-title" className="flex flex-col gap-6">
          <Eyebrow id="latest-title">{t.latest}</Eyebrow>
          <PostCard post={latest} featured />
        </section>
      )}
      {posts.length > 1 && (
        <section aria-labelledby="all-title" className="flex flex-col gap-6">
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow id="all-title">{t.allWriting}</Eyebrow>
            <span className="text-ui-sm text-muted-foreground tabular-nums">{fill(posts.length === 1 ? t.postCountOne : t.postCount, { n: posts.length })}</span>
          </div>
          <PostList layer={page.layer} skip={1} />
        </section>
      )}
      <section aria-labelledby="topics-title" className="flex flex-col gap-4">
        <Eyebrow id="topics-title">{t.topics}</Eyebrow>
        <TagList layer={page.layer} />
      </section>
      {!posts.length && <p className="text-muted-foreground">{t.noPosts}</p>}
    </Container>
  )
}

function TagIndex({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const count = postsOf(site.pages, page.layer).filter((p) => p.tags.includes(page.tag!)).length
  const t = useLabels()
  return (
    <Container className="flex flex-col gap-10 py-10 sm:py-14">
      <header className="flex flex-col items-start gap-4">
        <BackLink layer={page.layer} />
        <h1 className="text-4xl leading-tight font-semibold tracking-tight">{page.tag}</h1>
        <p className="text-ui-sm text-muted-foreground tabular-nums">{fill(count === 1 ? t.postCountOne : t.postCount, { n: count })}</p>
      </header>
      <PostList layer={page.layer} tag={page.tag} />
    </Container>
  )
}

function Page({ page }: { page: PageMeta }) {
  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto flex max-w-reading flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance">{page.title}</h1>
          {page.description && <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{page.description}</p>}
        </header>
        <article className="typeset typeset-reading">
          <PageContent />
        </article>
      </div>
    </Container>
  )
}

function BlogBody() {
  const { current } = useSite()
  const page = current.page
  if (!page) {
    return (
      <Container>
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
  const Header = useOverride('Header', DefaultHeader)
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <main className="flex-1">
        <BlogBody />
      </main>
      <div className="border-t border-border py-10">
        <Container>
          <Footer />
        </Container>
      </div>
    </div>
  )
}
