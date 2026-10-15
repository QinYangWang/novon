import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { ScrollProgress } from '@/ui/scroll-progress'
import { ArrowLeftIcon } from '@/components/icons'
import { formatDate, postsOf, withBase } from '../../shared.ts'
import type { PageMeta } from '../../types.ts'
import { Brand, Footer, NotFound, PageContent, Search, SocialLinks, ThemeButton } from '../chrome.tsx'
import { Link } from '../link.tsx'
import { PostList, TagLink, TagList } from '../posts.tsx'
import { useOverride, useSite } from '../site.tsx'

function DefaultHeader() {
  const { site, current } = useSite()
  return (
    <header className="flex h-16 items-center gap-1">
      <Brand className="mr-3" />
      <nav className="flex items-center">
        {site.nav.map((l) => {
          const active = current.route === l.href || current.route.startsWith(`${l.href}/`)
          return (
            <Button key={l.href} variant="ghost" size="sm" className={cn(!active && 'text-muted-foreground')} nativeButton={false} render={<Link href={l.href} />}>
              {l.label}
            </Button>
          )
        })}
      </nav>
      <div className="flex-1" />
      <Search compact />
      <SocialLinks />
      <ThemeButton />
    </header>
  )
}

function DefaultPostHeader({ page }: { page: PageMeta }) {
  const { site } = useSite()
  return (
    <header className="mb-10">
      <Link href={page.layer} className="mb-6 inline-flex items-center gap-1 text-ui-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" /> All posts
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight text-balance">{page.title}</h1>
      {page.description && <p className="mt-2 text-lg text-muted-foreground">{page.description}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-ui-sm text-muted-foreground">
        {page.date && <time dateTime={page.date}>{formatDate(page.date, site.lang)}</time>}
        {page.author && <span>· {page.author}</span>}
        {page.tags.map((t) => (
          <TagLink key={t} tag={t} layer={page.layer} />
        ))}
      </div>
      {page.cover && (
        <img src={withBase(site.base, page.cover)} alt="" className="mt-8 aspect-[2/1] w-full rounded-xl object-cover shadow-raised" />
      )}
    </header>
  )
}

function Post({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const PostHeader = useOverride('PostHeader', DefaultPostHeader)
  const posts = postsOf(site.pages, page.layer)
  const i = posts.findIndex((p) => p.route === page.route)
  const newer = i > 0 ? posts[i - 1] : undefined
  const older = i >= 0 ? posts[i + 1] : undefined
  return (
    <>
      <ScrollProgress className="fixed inset-x-0 top-0 z-50" />
      <PostHeader page={page} />
      <article className="typeset typeset-reading">
        <PageContent />
      </article>
      {(newer || older) && (
        <nav className="mt-16 grid gap-3 border-t border-border pt-6 text-ui sm:grid-cols-2">
          {older && (
            <Link href={older.route} className="group flex flex-col">
              <span className="text-ui-xs text-muted-foreground">Older</span>
              <span className="font-medium group-hover:text-primary">{older.title}</span>
            </Link>
          )}
          {newer && (
            <Link href={newer.route} className="group flex flex-col sm:col-start-2 sm:text-right">
              <span className="text-ui-xs text-muted-foreground">Newer</span>
              <span className="font-medium group-hover:text-primary">{newer.title}</span>
            </Link>
          )}
        </nav>
      )}
    </>
  )
}

function PostsIndex({ page }: { page: PageMeta }) {
  const { site } = useSite()
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
      {(page.description ?? (page.layer === '/' ? site.description : undefined)) && (
        <p className="mt-2 text-muted-foreground">{page.description ?? site.description}</p>
      )}
      <div className="mt-10">
        <PostList layer={page.layer} />
      </div>
      <div className="mt-10">
        <TagList layer={page.layer} />
      </div>
    </>
  )
}

function TagIndex({ page }: { page: PageMeta }) {
  return (
    <>
      <Link href={page.layer} className="mb-6 inline-flex items-center gap-1 text-ui-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" /> All posts
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
      <div className="mt-8">
        <PostList layer={page.layer} tag={page.tag} />
      </div>
    </>
  )
}

function BlogBody() {
  const { current } = useSite()
  const page = current.page
  if (!page) return <NotFound />
  if (page.kind === 'posts') return <PostsIndex page={page} />
  if (page.kind === 'tag') return <TagIndex page={page} />
  // Undated pages (an about page, the layer's own index) are pages, not posts.
  if (page.route === page.layer || !page.date) {
    return (
      <article className="typeset typeset-reading">
        <h1>{page.title}</h1>
        <PageContent />
      </article>
    )
  }
  return <Post page={page} />
}

export function BlogLayout() {
  const Header = useOverride('Header', DefaultHeader)
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5">
        <Header />
        <main className="flex-1 py-10">
          <BlogBody />
        </main>
        <Footer className="border-t border-border py-6" />
      </div>
    </div>
  )
}

