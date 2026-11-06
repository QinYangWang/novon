/**
 * Reference components: the endpoint header and method badge of generated API
 * pages, and the timeline a `layout: changelog` page renders as.
 */
import * as React from 'react'
import { Button } from '@/ui/button'
import { Endpoint, MethodBadge } from '@/ui/endpoint'
import { SchemaTree, type SchemaNode } from '@/ui/schema-tree'
import { Timeline, TimelineItem, TimelineTitle } from '@/ui/timeline'
import { RssIcon } from '@/components/icons'
import { withBase } from '../shared.ts'
import { useLabels, useSite } from './site.tsx'

/** An HTTP method (or an event or GraphQL operation kind) as a coloured badge. */
export function ApiMethod({ method, size, className }: { method: string; size?: 'default' | 'sm'; className?: string }) {
  return <MethodBadge method={method} size={size} className={className} />
}

export interface ApiEndpointProps {
  method: string
  path: string
  /** Base URL; the copy button copies it with the path. */
  server?: string
  /** What the copy button copies instead of server + path. */
  copyValue?: string
  deprecated?: boolean
}

/** The method and path an API page documents, with its full URL to copy. */
export function ApiEndpoint({ method, path, server, copyValue, deprecated }: ApiEndpointProps) {
  return <Endpoint data-novon="api-endpoint" className="not-typeset my-6" method={method} path={path} server={server} copyValue={copyValue} deprecated={deprecated} />
}

/**
 * A request or response schema as an expandable tree. Generated pages also
 * pass a TypeTable as children: `.md` output and search read that instead.
 */
export function ApiSchema({ schema }: { schema: SchemaNode; children?: React.ReactNode }) {
  return <SchemaTree data-novon="api-schema" className="not-typeset my-6" schema={schema} defaultExpandDepth={1} descriptionFormat="markdown" />
}

/* ---------- Changelog ---------- */

const LatestContext = React.createContext(false)

/** A changelog page's releases on a timeline, with a link to its feed. Written by novon for `layout: changelog` pages. */
export function Changelog({ children }: { children?: React.ReactNode }) {
  const { site, current } = useSite()
  const t = useLabels()
  const page = current.page
  const items = React.Children.toArray(children)
  const feed =
    site.rss && page && !page.fallback ? (
      <Button data-novon-chrome="" variant="ghost" size="sm" nativeButton={false} className="text-muted-foreground" render={<a href={withBase(site.base, `${page.route === '/' ? '' : page.route}/rss.xml`)} />}>
        <RssIcon data-icon="inline-start" />
        {t.subscribe}
      </Button>
    ) : undefined
  return (
    <div data-novon="changelog" className="not-typeset my-8">
      <Timeline actions={feed} aria-label={t.releases} className="[--timeline-time:4rem] sm:[--timeline-time:6.5rem]">
        {items.map((child, i) => (
          <LatestContext.Provider key={i} value={i === 0}>
            {child}
          </LatestContext.Provider>
        ))}
      </Timeline>
    </div>
  )
}

/** One release: its date in the time column, its heading as the anchored title and its notes beside it. */
export function ChangelogEntry({ version, date, children }: { version?: string; date?: string; children?: React.ReactNode }) {
  const { site } = useSite()
  const latest = React.useContext(LatestContext)
  const d = date ? new Date(`${date}T00:00:00`) : null
  const valid = d && !Number.isNaN(d.getTime())
  const [head, ...rest] = React.Children.toArray(children)
  // The release heading (an `h2` with its anchor id) becomes the entry's title.
  const heading = React.isValidElement<{ id?: string; children?: React.ReactNode }>(head) && head.props.id ? head : null
  return (
    <TimelineItem
      data-version={version}
      tone={latest ? 'primary' : 'default'}
      time={valid ? <time dateTime={date}>{d!.toLocaleDateString(site.lang, { month: 'short', day: 'numeric' })}</time> : undefined}
      timeDetail={valid ? d!.getFullYear() : undefined}
    >
      {heading && (
        <TimelineTitle anchor={heading.props.id} render={<h2 />} className="scroll-mt-20 text-xl leading-7 font-semibold">
          {heading.props.children}
        </TimelineTitle>
      )}
      <div className="typeset typeset-docs min-w-0 pb-6 [&>h2:first-child]:mt-0 [&>h2:first-child]:text-xl [&>:first-child]:mt-3">{heading ? rest : children}</div>
    </TimelineItem>
  )
}
