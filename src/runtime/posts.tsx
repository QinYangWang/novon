import * as React from 'react'
import { Badge } from '@/ui/badge'
import { formatDate, postsOf, tagRoute } from '../shared.ts'
import type { PageMeta } from '../types.ts'
import { Link } from './link.tsx'
import { useSite } from './site.tsx'

function useLayer(layer?: string): string {
  const { current } = useSite()
  return layer ?? current.page?.layer ?? '/'
}

export function PostItem({ post }: { post: PageMeta }) {
  const { site } = useSite()
  return (
    <li className="group relative grid gap-1 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
      <time dateTime={post.date} className="text-ui-sm tabular-nums text-muted-foreground sm:pt-0.5">
        {formatDate(post.date, site.lang)}
      </time>
      <div className="min-w-0">
        <Link href={post.route} className="font-medium text-foreground after:absolute after:inset-0 group-hover:text-primary">
          {post.title}
        </Link>
        {post.description && <p className="mt-0.5 text-ui text-muted-foreground">{post.description}</p>}
      </div>
    </li>
  )
}

/** Posts of the current blog layer, newest first. */
export function PostList({ layer, limit, tag }: { layer?: string; limit?: number; tag?: string }) {
  const { site } = useSite()
  const owner = useLayer(layer)
  let posts = postsOf(site.pages, owner)
  if (tag) posts = posts.filter((p) => p.tags.includes(tag))
  if (limit) posts = posts.slice(0, limit)
  if (!posts.length) return <p className="text-ui text-muted-foreground">No posts yet.</p>
  return (
    <ul className="not-typeset -my-3 list-none divide-y divide-border p-0">
      {posts.map((p) => (
        <PostItem key={p.route} post={p} />
      ))}
    </ul>
  )
}

export function TagLink({ tag, layer }: { tag: string; layer: string }) {
  return (
    <Badge variant="chip" render={<Link href={tagRoute(layer, tag)} />}>
      #{tag}
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
      {[...counts].sort((a, b) => b[1] - a[1]).map(([tag, n]) => (
        <Badge key={tag} variant="chip" render={<Link href={tagRoute(owner, tag)} />}>
          #{tag} <span className="text-muted-foreground">{n}</span>
        </Badge>
      ))}
    </div>
  )
}
