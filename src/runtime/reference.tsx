/**
 * Reference components: the endpoint header and method badge of generated API
 * pages, and the timeline a `layout: changelog` page renders as.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { CodeCopyButton } from '@/ui/code-block'
import { Timeline, TimelineItem } from '@/ui/timeline'
import { BellIcon } from '@/components/icons'
import { withBase } from '../shared.ts'
import { useLabels, useSite } from './site.tsx'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace'

const METHOD_VARIANT: Record<string, 'success' | 'primary' | 'warning' | 'destructive' | 'chip'> = {
  get: 'success',
  post: 'primary',
  put: 'warning',
  patch: 'warning',
  delete: 'destructive',
}

/** An HTTP method as a coloured badge. */
export function ApiMethod({ method, className }: { method: Method | string; className?: string }) {
  const m = method.toLowerCase()
  return (
    <Badge size="sm" variant={METHOD_VARIANT[m] ?? 'chip'} className={cn('font-mono tracking-wide uppercase', className)}>
      {m === 'delete' ? 'del' : m}
    </Badge>
  )
}

/** `{id}` segments of a path, set apart from the rest. */
function PathText({ path }: { path: string }) {
  return (
    <>
      {path.split(/(\{[^}]+\})/g).map((part, i) =>
        part.startsWith('{') ? (
          <span key={i} className="text-primary-text">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  )
}

export interface ApiEndpointProps {
  method: Method | string
  path: string
  /** Base URL; the copy button copies it with the path. */
  server?: string
  deprecated?: boolean
}

/** The method and path an API page documents, with its full URL to copy. */
export function ApiEndpoint({ method, path, server, deprecated }: ApiEndpointProps) {
  const t = useLabels()
  return (
    <div data-novon="api-endpoint" className="not-typeset my-6 flex min-w-0 items-center gap-3 rounded-2xl bg-card py-2 ps-3 pe-2 shadow-raised">
      <ApiMethod method={method} />
      <code className={cn('min-w-0 flex-1 truncate font-mono text-ui-sm', deprecated && 'line-through')} title={`${server ?? ''}${path}`}>
        <PathText path={path} />
      </code>
      {deprecated && (
        <Badge size="sm" variant="warning">
          {t.apiDeprecated}
        </Badge>
      )}
      <CodeCopyButton value={`${server ?? ''}${path}`} />
    </div>
  )
}

/* ---------- Changelog ---------- */

const LatestContext = React.createContext(false)

/** A changelog page's releases on a timeline, with a link to its feed. Written by novon for `layout: changelog` pages. */
export function Changelog({ children }: { children?: React.ReactNode }) {
  const { site, current } = useSite()
  const t = useLabels()
  const page = current.page
  const items = React.Children.toArray(children)
  return (
    <div data-novon="changelog" className="not-typeset my-8 flex flex-col gap-6">
      {site.rss && page && !page.fallback && (
        <div className="flex justify-end" data-novon-chrome="">
          <Button variant="ghost" size="sm" nativeButton={false} className="text-muted-foreground" render={<a href={withBase(site.base, `${page.route === '/' ? '' : page.route}/rss.xml`)} />}>
            <BellIcon data-icon="inline-start" />
            {t.subscribe}
          </Button>
        </div>
      )}
      <Timeline aria-label={t.releases} className="[--timeline-time:4rem] sm:[--timeline-time:6.5rem]">
        {items.map((child, i) => (
          <LatestContext.Provider key={i} value={i === 0}>
            {child}
          </LatestContext.Provider>
        ))}
      </Timeline>
    </div>
  )
}

/** One release: its date in the time column, its heading and notes beside it. */
export function ChangelogEntry({ version, date, children }: { version?: string; date?: string; children?: React.ReactNode }) {
  const { site } = useSite()
  const latest = React.useContext(LatestContext)
  const d = date ? new Date(`${date}T00:00:00`) : null
  const valid = d && !Number.isNaN(d.getTime())
  return (
    <TimelineItem
      data-version={version}
      tone={latest ? 'primary' : 'default'}
      time={valid ? <time dateTime={date}>{d!.toLocaleDateString(site.lang, { month: 'short', day: 'numeric' })}</time> : undefined}
      timeDetail={valid ? d!.getFullYear() : undefined}
    >
      <div className="typeset typeset-docs min-w-0 pb-6 [&>h2:first-child]:mt-0 [&>h2:first-child]:text-xl">{children}</div>
    </TimelineItem>
  )
}
