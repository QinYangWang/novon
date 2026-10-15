/**
 * Writing components: available in every MDX file without an import, and
 * exported from `novon` for custom components.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle, type AlertVariant } from '@/ui/alert'
import { Accordion as AccordionRoot, AccordionItem, AccordionPanel, AccordionTrigger } from '@/ui/accordion'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { FileTree, FileTreeFile, FileTreeFolder } from '@/ui/file-tree'
import { IconChip } from '@/ui/icon-chip'
import { Tabs as TabsRoot, TabsList, TabsPanel, TabsTab } from '@/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { ArrowUpRightIcon, CheckIcon, CopyIcon } from '@/components/icons'
import { Icon } from './icons.tsx'
import { Link, isInternal } from './link.tsx'
import { PostList, TagList } from './posts.tsx'

/* ---------- Callouts ---------- */

export type CalloutType = 'note' | 'tip' | 'info' | 'warning' | 'caution' | 'danger'

const calloutVariant: Record<CalloutType, AlertVariant> = {
  note: 'default',
  tip: 'success',
  info: 'info',
  warning: 'warning',
  caution: 'warning',
  danger: 'destructive',
}

export interface CalloutProps {
  type?: CalloutType
  title?: React.ReactNode
  icon?: string
  children?: React.ReactNode
}

export function Callout({ type = 'note', title, icon, children }: CalloutProps) {
  return (
    <Alert variant={calloutVariant[type]} className="not-typeset my-4">
      <AlertIcon>{icon ? <Icon name={icon} /> : undefined}</AlertIcon>
      <AlertContent>
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription className="[&_p]:my-0 [&_p+p]:mt-2 [&_a]:underline [&_code]:font-mono">{children}</AlertDescription>
      </AlertContent>
    </Alert>
  )
}

const callout = (type: CalloutType) =>
  function TypedCallout(props: Omit<CalloutProps, 'type'>) {
    return <Callout type={type} {...props} />
  }
export const Note = callout('note')
export const Tip = callout('tip')
export const Info = callout('info')
export const Warning = callout('warning')
export const Caution = callout('caution')
export const Danger = callout('danger')

/* ---------- Cards ---------- */

export interface LinkCardProps {
  title: React.ReactNode
  icon?: string
  href?: string
  children?: React.ReactNode
}

/** A card with an optional icon and link, for landing pages and overviews. */
export function LinkCard({ title, icon, href, children }: LinkCardProps) {
  const body = (
    <Card className={cn('h-full', href && 'transition-shadow hover:shadow-raised-hover')}>
      <CardHeader>
        {icon && (
          <IconChip className="mb-2" tone="primary">
            <Icon name={icon} />
          </IconChip>
        )}
        <CardTitle className="flex items-center gap-1">
          {title}
          {href && !isInternal(href) && <ArrowUpRightIcon className="size-3.5 text-muted-foreground" />}
        </CardTitle>
        {children && <CardDescription className="[&_p]:my-0">{children}</CardDescription>}
      </CardHeader>
    </Card>
  )
  if (!href) return body
  return (
    <Link href={href} className="block no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-xl">
      {body}
    </Link>
  )
}

const columns = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' } as const

export function CardGroup({ cols = 2, children }: { cols?: 1 | 2 | 3; children?: React.ReactNode }) {
  return <div className={cn('not-typeset my-6 grid gap-3', columns[cols])}>{children}</div>
}

export function Columns({ cols = 2, children }: { cols?: 1 | 2 | 3; children?: React.ReactNode }) {
  return <div className={cn('my-6 grid gap-6', columns[cols])}>{children}</div>
}

/* ---------- Steps ---------- */

export function Steps({ children }: { children?: React.ReactNode }) {
  return <div className="my-6 [counter-reset:step] border-l border-border pl-6">{children}</div>
}

export function Step({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="relative pb-6 [counter-increment:step] last:pb-0 before:absolute before:-left-[37px] before:flex before:size-6 before:items-center before:justify-center before:rounded-full before:bg-card before:text-ui-xs before:font-medium before:text-muted-foreground before:shadow-raised before:content-[counter(step)]">
      {title && <p className="mt-0 mb-2 font-semibold text-foreground">{title}</p>}
      <div className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">{children}</div>
    </div>
  )
}

/* ---------- Tabs and accordions ---------- */

type TabElement = React.ReactElement<{ title?: string; children?: React.ReactNode }>

export function Tab({ children }: { title: string; children?: React.ReactNode }) {
  return <>{children}</>
}

export function Tabs({ children }: { children?: React.ReactNode }) {
  const tabs = React.Children.toArray(children).filter(React.isValidElement) as TabElement[]
  if (!tabs.length) return null
  return (
    <TabsRoot defaultValue="0" className="not-typeset my-6">
      <TabsList>
        {tabs.map((t, i) => (
          <TabsTab key={i} value={String(i)}>
            {t.props.title ?? `Tab ${i + 1}`}
          </TabsTab>
        ))}
      </TabsList>
      {tabs.map((t, i) => (
        <TabsPanel key={i} value={String(i)} className="typeset typeset-docs pt-3">
          {t.props.children}
        </TabsPanel>
      ))}
    </TabsRoot>
  )
}

export function Accordion({ title, children, defaultOpen }: { title: React.ReactNode; children?: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <AccordionRoot className="not-typeset my-6" defaultValue={defaultOpen ? ['item'] : []}>
      <AccordionItem value="item">
        <AccordionTrigger>{title}</AccordionTrigger>
        <AccordionPanel className="typeset typeset-docs">{children}</AccordionPanel>
      </AccordionItem>
    </AccordionRoot>
  )
}

/** Stacks several Accordion blocks with no gap between them. */
export function AccordionGroup({ children }: { children?: React.ReactNode }) {
  return <div className="my-6 [&>[data-slot]]:my-0 space-y-2">{children}</div>
}

/* ---------- Code ---------- */

function useCopy() {
  const [copied, setCopied] = React.useState(false)
  const copy = React.useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [])
  return { copied, copy }
}

type PreProps = React.ComponentProps<'pre'> & { 'data-title'?: string; 'data-language'?: string }

/** Highlighted code from a fence, with its title and a copy button. */
export function CodeBlock({ children, className, ...props }: PreProps) {
  const ref = React.useRef<HTMLPreElement>(null)
  const { copied, copy } = useCopy()
  const title = props['data-title']
  return (
    <figure data-code-block className="group/code relative">
      {title && (
        <figcaption className="!mt-0 mb-1.5 text-left font-mono text-ui-xs text-muted-foreground">{title}</figcaption>
      )}
      <div className="relative">
        <pre
          ref={ref}
          className={cn('overflow-x-auto rounded-(--radius) bg-muted px-4 py-3 font-mono text-[0.875em] leading-normal [tab-size:2]', className)}
          {...props}
        >
          {children}
        </pre>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/code:opacity-100 focus-visible:opacity-100"
          onClick={() => copy(ref.current?.textContent ?? '')}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
    </figure>
  )
}

/** Several fences shown as tabs, labelled by their titles or languages. */
export function CodeGroup({ children }: { children?: React.ReactNode }) {
  const blocks = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<any>[]
  const label = (el: React.ReactElement<any>, i: number) => {
    const pre = el.props?.['data-title'] !== undefined || el.props?.['data-language'] !== undefined ? el.props : el.props?.children?.props
    return pre?.['data-title'] ?? pre?.['data-language'] ?? `Code ${i + 1}`
  }
  return (
    <TabsRoot defaultValue="0" className="not-typeset my-6">
      <TabsList variant="underline">
        {blocks.map((b, i) => (
          <TabsTab key={i} value={String(i)}>
            {label(b, i)}
          </TabsTab>
        ))}
      </TabsList>
      {blocks.map((b, i) => (
        <TabsPanel key={i} value={String(i)} className="typeset typeset-docs pt-2 [&_figcaption]:hidden">
          {b}
        </TabsPanel>
      ))}
    </TabsRoot>
  )
}

/* ---------- Inline and media ---------- */

/** A word with a definition on hover. */
export function Term({ tip, children }: { tip: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-help underline decoration-dotted underline-offset-4" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}

export function Frame({ caption, children }: { caption?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <figure>
      <div className="overflow-hidden rounded-xl bg-muted p-1 shadow-raised [&_img]:m-0 [&_img]:rounded-lg">{children}</div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

export function YouTube({ id, title = 'Video' }: { id: string; title?: string }) {
  return (
    <div className="my-6 aspect-video overflow-hidden rounded-xl shadow-raised">
      <iframe
        className="size-full"
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

function Anchor({ href = '', ...props }: React.ComponentProps<'a'>) {
  if (isInternal(href)) return <Link href={href} {...props} />
  const external = /^https?:/.test(href)
  return <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} {...props} />
}

export const mdxComponents = {
  a: Anchor,
  pre: CodeBlock,
  Callout,
  Note,
  Tip,
  Info,
  Warning,
  Caution,
  Danger,
  Card: LinkCard,
  CardGroup,
  Columns,
  Steps,
  Step,
  Tabs,
  Tab,
  Accordion,
  AccordionGroup,
  CodeGroup,
  Term,
  Frame,
  YouTube,
  Badge,
  Icon,
  FileTree,
  Folder: FileTreeFolder,
  File: FileTreeFile,
  PostList,
  TagList,
}

export type MdxComponents = typeof mdxComponents
