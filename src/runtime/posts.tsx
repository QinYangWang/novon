import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { CoverArt } from '@/ui/cover-art'
import { formatDate, postsOf, tagRoute, withBase } from '../shared.ts'
import type { PageMeta } from '../types.ts'
import { Link } from './link.tsx'
import { useSite } from './site.tsx'

function useLayer(layer?: string): string {
  const { current } = useSite()
  return layer ?? current.page?.layer ?? '/'
}

/** Date and reading time, e.g. "Mar 4, 2026 · 5 min read". */
export function PostMeta({ post, className }: { post: PageMeta; className?: string }) {
  const { site } = useSite()
  return (
    <p className={cn('flex items-center gap-2 text-ui-sm text-muted-foreground tabular-nums', className)}>
      {post.date && <time dateTime={post.date}>{formatDate(post.date, site.lang)}</time>}
      {post.date && post.readingTime && <span aria-hidden>·</span>}
      {post.readingTime && <span>{post.readingTime} min read</span>}
    </p>
  )
}

/** A post's tags as chips; each links to its tag page. */
export function PostTags({ post, link = true }: { post: PageMeta; link?: boolean }) {
  if (!post.tags.length) return null
  return (
    <span className="flex flex-wrap gap-1.5">
      {post.tags.map((t) =>
        link ? (
          <TagLink key={t} tag={t} layer={post.layer} />
        ) : (
          <Badge key={t} size="sm" variant="chip">
            {t}
          </Badge>
        ),
      )}
    </span>
  )
}

/** The post's `cover` image, or generated cover art seeded by its route. Nothing for `cover: false`. */
export function PostCover({ post, className }: { post: PageMeta; className?: string }) {
  const { site } = useSite()
  if (post.cover === false) return null
  if (!post.cover) return <CoverArt seed={post.route.split('/').filter(Boolean).at(-1) ?? post.route} aria-hidden className={cn('w-full', className)} />
  return <img src={withBase(site.base, post.cover)} alt="" loading="lazy" className={cn('w-full object-cover', className)} />
}

export function PostItem({ post }: { post: PageMeta }) {
  const { site } = useSite()
  return (
    <li className="border-t border-border first:border-t-0">
      <Link
        href={post.route}
        className="group -mx-4 grid grid-cols-1 gap-2 rounded-2xl px-4 py-5 transition-colors duration-150 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6"
      >
        <time dateTime={post.date} className="text-ui-sm text-muted-foreground tabular-nums sm:pt-0.5">
          {formatDate(post.date, site.lang)}
        </time>
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-lg leading-snug font-medium text-balance text-foreground">{post.title}</h3>
          {post.description && <p className="text-pretty text-muted-foreground">{post.description}</p>}
          {(post.tags.length > 0 || post.readingTime) && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <PostTags post={post} link={false} />
              {post.readingTime && <span className="text-ui-xs text-muted-foreground tabular-nums">{post.readingTime} min read</span>}
            </div>
          )}
        </div>
      </Link>
    </li>
  )
}

/** Posts of the current blog layer, newest first. */
export function PostList({ layer, limit, tag, skip = 0 }: { layer?: string; limit?: number; tag?: string; skip?: number }) {
  const { site } = useSite()
  const owner = useLayer(layer)
  let posts = postsOf(site.pages, owner)
  if (tag) posts = posts.filter((p) => p.tags.includes(tag))
  posts = posts.slice(skip)
  if (limit) posts = posts.slice(0, limit)
  if (!posts.length) return <p className="text-ui text-muted-foreground">No posts yet.</p>
  return (
    <ul className="not-typeset m-0 flex list-none flex-col p-0">
      {posts.map((p) => (
        <PostItem key={p.route} post={p} />
      ))}
    </ul>
  )
}

/** A post as a raised card with its cover, for featured and related posts. */
export function PostCard({ post, featured, className }: { post: PageMeta; featured?: boolean; className?: string }) {
  return (
    <Link
      href={post.route}
      className={cn(
        'not-typeset group grid grid-cols-1 overflow-hidden rounded-2xl bg-card shadow-raised transition-shadow duration-150 outline-none hover:shadow-raised-hover focus-visible:ring-2 focus-visible:ring-ring/50',
        featured && post.cover !== false && 'md:grid-cols-2',
        className,
      )}
    >
      <PostCover post={post} className={cn('aspect-video', featured && 'md:aspect-auto md:h-full md:min-h-72')} />
      <div className={cn('flex flex-col gap-2 p-5', featured && 'justify-between gap-6 p-6 sm:p-8')}>
        <div className="flex flex-col gap-2">
          <PostMeta post={post} />
          <h3 className={cn('leading-snug font-medium text-balance text-foreground', featured && 'text-2xl leading-tight font-semibold tracking-tight')}>
            {post.title}
          </h3>
          {(featured || post.cover === false) && post.description && <p className="leading-relaxed text-pretty text-muted-foreground">{post.description}</p>}
        </div>
        {featured && <PostTags post={post} link={false} />}
      </div>
    </Link>
  )
}

export function TagLink({ tag, layer }: { tag: string; layer: string }) {
  return (
    <Badge size="sm" variant="chip" render={<Link href={tagRoute(layer, tag)} />}>
      {tag}
    </Badge>
  )
}

/** Every tag used in the current blog layer, with counts. */
export function TagList({ layer }: { layer?: string }) {
  const { site } = useSite()
  const owner = useLayer(layer)
  const counts = new Map<string, number>()
  for (const p of postsOf(site.pages, owner)) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  if (!counts.size) return null
  return (
    <div className="not-typeset flex flex-wrap gap-1.5">
      {[...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, n]) => (
        <Badge key={tag} variant="chip" render={<Link href={tagRoute(owner, tag)} />}>
          {tag} <span className="text-muted-foreground tabular-nums">{n}</span>
        </Badge>
      ))}
    </div>
  )
}
