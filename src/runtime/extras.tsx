/**
 * More writing components: TypeTable, Diff, Prompt, ImageZoom, diagrams
 * from `mermaid` fences, and the site banner. Available in MDX without an import.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { CodeCopyButton } from '@/ui/code-block'
import { CommandCopy } from '@/ui/command-copy'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/ui/dialog'
import { FileDiff } from '@/ui/file-diff'
import { SimpleTable, SimpleTableBody, SimpleTableCell, SimpleTableHead, SimpleTableHeader, SimpleTableRow } from '@/ui/simple-table'
import { XIcon } from '@/components/icons'
import { withBase } from '../shared.ts'
import { useLabels, useSite } from './site.tsx'

/* ---------- TypeTable ---------- */

export interface TypeTableEntry {
  type?: string
  description?: React.ReactNode
  default?: string
  required?: boolean
  deprecated?: boolean
}

export interface FieldProps extends TypeTableEntry {
  name: string
  children?: React.ReactNode
}

/** One row of a TypeTable, written as an element: `<Field name="title" type="string" required>…</Field>`. */
export function Field(_props: FieldProps): React.ReactNode {
  return null
}

function fieldRows(children: React.ReactNode): FieldProps[] {
  return React.Children.toArray(children).flatMap((c) => {
    if (!React.isValidElement<FieldProps & { children?: React.ReactNode }>(c)) return []
    if (c.type === React.Fragment) return fieldRows(c.props.children)
    if (c.type === Field || typeof c.props.name === 'string') return [{ ...c.props, description: c.props.description ?? c.props.children }]
    return []
  })
}

/**
 * Props, options or fields as a table of name, type, default and description.
 * Pass `type={{ name: { type, description, default, required } }}` or `<Field>` children.
 */
export function TypeTable({ type, children }: { type?: Record<string, TypeTableEntry>; children?: React.ReactNode }) {
  const t = useLabels()
  const rows: FieldProps[] = [...Object.entries(type ?? {}).map(([name, e]) => ({ name, ...e })), ...fieldRows(children)]
  const hasDefault = rows.some((r) => r.default !== undefined && r.default !== '')
  return (
    <SimpleTable containerClassName="not-typeset my-6" data-novon="type-table">
      <SimpleTableHeader>
        <SimpleTableRow>
          <SimpleTableHead>{t.property}</SimpleTableHead>
          <SimpleTableHead>{t.type}</SimpleTableHead>
          {hasDefault && <SimpleTableHead>{t.default}</SimpleTableHead>}
          <SimpleTableHead>{t.description}</SimpleTableHead>
        </SimpleTableRow>
      </SimpleTableHeader>
      <SimpleTableBody>
        {rows.map((r) => (
          <SimpleTableRow key={r.name}>
            <SimpleTableCell variant="code">
              <span className={cn(r.deprecated && 'line-through')}>{r.name}</span>
              {r.required && (
                <Badge variant="primary" size="sm" className="ms-2 align-middle font-sans">
                  {t.required}
                </Badge>
              )}
            </SimpleTableCell>
            <SimpleTableCell variant="type">{r.type}</SimpleTableCell>
            {hasDefault && <SimpleTableCell variant="code-muted">{r.default}</SimpleTableCell>}
            <SimpleTableCell className="[&_p]:my-0 [&_p+p]:mt-2">{r.description}</SimpleTableCell>
          </SimpleTableRow>
        ))}
      </SimpleTableBody>
    </SimpleTable>
  )
}

/* ---------- Diff ---------- */

/** Lines with `+`, `-` or ` ` and no hunk header become one hunk, so a hand-written diff works. */
export function toUnifiedDiff(diff: string): string {
  const text = diff.replace(/\r\n/g, '\n').replace(/\n$/, '')
  if (/^@@ /m.test(text)) return `${text}\n`
  const lines = text.split('\n').map((l) => (/^[+\- ]/.test(l) ? l : ` ${l}`))
  return `@@ -1 +1 @@\n${lines.join('\n')}\n`
}

export interface DiffProps {
  /** The changes as a unified diff, or lines starting with `+`, `-` or a space. In MDX, a ```` ```diff ```` fence inside works too. */
  diff?: string
  /** Old and new file contents, instead of `diff`. */
  before?: string
  after?: string
  /** File name in the header; its extension picks the highlighting. */
  file?: string
  language?: string
  /** Side by side instead of one column. */
  split?: boolean
  /** Rows shown before it scrolls, in px. */
  maxHeight?: number
}

/** A file's changes, highlighted, with added and removed lines marked. */
export function Diff({ diff, before, after, file = 'file', language, split, maxHeight = 480 }: DiffProps) {
  const twoFile = before !== undefined || after !== undefined
  return (
    <div className="not-typeset my-6" data-novon="diff">
      <FileDiff
        filename={file}
        {...(twoFile ? { oldFile: before ?? '', newFile: after ?? '' } : { diff: toUnifiedDiff(diff ?? '') })}
        language={language}
        defaultDiffStyle={split ? 'split' : 'unified'}
        maxHeight={maxHeight}
        indicators="classic"
      />
    </div>
  )
}

/* ---------- Prompt ---------- */

export interface PromptProps {
  /** The text that is copied. Written in MDX, the children's source is used. */
  text?: string
  title?: React.ReactNode
  children?: React.ReactNode
}

/** A prompt for an AI assistant, with a button that copies it. One short line shows as a command bar. */
export function Prompt({ text, title, children }: PromptProps) {
  const t = useLabels()
  const value = (text ?? '').trim()
  if (value && !value.includes('\n') && value.length <= 120 && !title) {
    return <CommandCopy command={value} prompt={null} label={t.copyPrompt} className="not-typeset my-6" data-novon="prompt" />
  }
  return (
    <div data-novon="prompt" className="not-typeset my-6 overflow-hidden rounded-xl bg-code shadow-raised">
      <div className="flex h-10 items-center gap-2 border-b border-border ps-4 pe-1.5">
        <span className="min-w-0 flex-1 truncate text-ui-sm font-medium text-muted-foreground">{title ?? t.prompt}</span>
        <CodeCopyButton value={value} label={t.copyPrompt} />
      </div>
      <div className="typeset px-4 py-3 text-ui [&>:first-child]:mt-0 [&>:last-child]:mb-0">{children ?? <p className="whitespace-pre-wrap">{value}</p>}</div>
    </div>
  )
}

/* ---------- Images ---------- */

export interface ImageZoomProps extends React.ComponentProps<'img'> {
  /** A larger file to show when zoomed. Default `src`. */
  zoomSrc?: string
}

/** An image that opens full size on click. */
export function ImageZoom({ src, zoomSrc, alt = '', className, ...props }: ImageZoomProps) {
  const t = useLabels()
  const { site } = useSite()
  const resolve = (s?: string) => (s && s.startsWith('/') && !s.startsWith('//') ? withBase(site.base, s) : s)
  return (
    <Dialog>
      <DialogTrigger
        data-novon="image-zoom"
        aria-label={alt ? `${t.zoomImage}: ${alt}` : t.zoomImage}
        className="inline cursor-zoom-in rounded-lg border-0 bg-transparent p-0 align-top outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <img src={resolve(src)} alt={alt} loading="lazy" decoding="async" className={cn('my-0', className)} {...props} />
      </DialogTrigger>
      <DialogContent showClose={false} className="w-auto max-w-[min(96vw,100rem)] items-center gap-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">{alt || t.zoomImage}</DialogTitle>
        <img src={resolve(zoomSrc ?? src)} alt={alt} className="max-h-[90dvh] w-auto max-w-full rounded-xl object-contain shadow-xl" />
      </DialogContent>
    </Dialog>
  )
}

/** Markdown images: zoomable unless `theme.imageZoom` is false. */
export function Img(props: React.ComponentProps<'img'>) {
  const { site } = useSite()
  if (site.theme.imageZoom === false) {
    const src = typeof props.src === 'string' && props.src.startsWith('/') && !props.src.startsWith('//') ? withBase(site.base, props.src) : props.src
    return <img {...props} src={src} />
  }
  return <ImageZoom {...(props as ImageZoomProps)} />
}

/* ---------- Diagrams ---------- */

function useDark(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => observer.disconnect()
    },
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )
}

function computed(name: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${name})`
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

/**
 * A theme token as `#rrggbb`, which the diagram renderer can read: tokens may be
 * in any CSS colour space and translucent, so it is painted over the page colour.
 */
function tokenColor(name: string): string {
  const value = computed(name)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return value
  ctx.fillStyle = computed('--background')
  ctx.fillRect(0, 0, 1, 1)
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

let mermaidQueue: Promise<unknown> = Promise.resolve()

async function drawMermaid(id: string, chart: string, dark: boolean): Promise<string> {
  const { default: mermaid } = await import('mermaid')
  const font = getComputedStyle(document.body).fontFamily
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: font,
    themeVariables: {
      darkMode: dark,
      fontFamily: font,
      fontSize: '14px',
      background: tokenColor('--background'),
      primaryColor: tokenColor('--card'),
      primaryTextColor: tokenColor('--foreground'),
      primaryBorderColor: tokenColor('--border'),
      secondaryColor: tokenColor('--muted'),
      tertiaryColor: tokenColor('--secondary'),
      lineColor: tokenColor('--muted-foreground'),
      textColor: tokenColor('--foreground'),
      mainBkg: tokenColor('--card'),
      nodeBorder: tokenColor('--border'),
      clusterBkg: tokenColor('--muted'),
      clusterBorder: tokenColor('--border'),
      noteBkgColor: tokenColor('--secondary'),
      noteTextColor: tokenColor('--foreground'),
      noteBorderColor: tokenColor('--border'),
      edgeLabelBackground: tokenColor('--background'),
      actorBkg: tokenColor('--card'),
      actorBorder: tokenColor('--border'),
      actorTextColor: tokenColor('--foreground'),
      signalColor: tokenColor('--muted-foreground'),
      signalTextColor: tokenColor('--foreground'),
      labelBoxBkgColor: tokenColor('--card'),
      labelTextColor: tokenColor('--foreground'),
    },
  })
  // One diagram at a time: the renderer keeps global state.
  const run = mermaidQueue.then(() => mermaid.render(id, chart))
  mermaidQueue = run.catch(() => undefined)
  return (await run).svg
}

/** A diagram from `mermaid` diagram text, drawn in the browser in the page's colours; a ```` ```mermaid ```` fence becomes one. */
export function Mermaid({ chart, caption }: { chart: string; caption?: React.ReactNode }) {
  const t = useLabels()
  const dark = useDark()
  const id = `novon-mermaid-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [state, setState] = React.useState<{ svg?: string; error?: string }>({})
  React.useEffect(() => {
    if (import.meta.env.SSR) return
    let alive = true
    drawMermaid(id, chart, dark).then(
      (svg) => alive && setState({ svg }),
      (error: unknown) => alive && setState({ error: error instanceof Error ? error.message : String(error) }),
    )
    return () => {
      alive = false
    }
  }, [id, chart, dark])
  const body = state.svg ? (
    <div className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: state.svg }} />
  ) : state.error ? (
    <div className="flex flex-col gap-2">
      <p className="my-0 text-ui-sm text-destructive-text">{t.diagramError}</p>
      <pre className="my-0 overflow-x-auto font-mono text-ui-xs text-muted-foreground">{chart}</pre>
    </div>
  ) : (
    <div aria-busy className="h-40 animate-pulse rounded-lg bg-muted" />
  )
  const figure = (
    <figure data-novon="mermaid" aria-label={t.diagram} className="not-typeset my-6 overflow-x-auto rounded-xl bg-card p-4 shadow-raised">
      {body}
      {caption && <figcaption className="mt-3 text-center text-ui-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
  if (!state.svg) return figure
  return (
    <Dialog>
      <DialogTrigger render={<div role="button" tabIndex={0} aria-label={t.zoomImage} className="cursor-zoom-in rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />}>
        {figure}
      </DialogTrigger>
      <DialogContent className="h-[90dvh] w-[96vw] max-w-none overflow-auto p-6">
        <DialogTitle className="sr-only">{t.diagram}</DialogTitle>
        <div className="flex min-h-full items-center justify-center [&_svg]:h-auto [&_svg]:max-h-[80dvh] [&_svg]:w-full [&_svg]:max-w-none" dangerouslySetInnerHTML={{ __html: state.svg }} />
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Banner ---------- */

/** The site banner from config `banner`, above the header. A closed banner stays closed until its text or id changes. */
export function Banner() {
  const { site } = useSite()
  const t = useLabels()
  const banner = site.banner
  const [closed, setClosed] = React.useState(false)
  if (!banner || closed) return null
  const close = () => {
    try {
      localStorage.setItem('novon:banner', banner.id)
    } catch {}
    document.documentElement.setAttribute('data-banner-closed', '')
    setClosed(true)
  }
  const text = <span className="[&_a]:underline [&_a]:underline-offset-2 [&_code]:font-mono" dangerouslySetInnerHTML={{ __html: banner.html }} />
  return (
    <div data-novon-banner="" className="relative flex min-h-10 items-center justify-center gap-2 bg-primary px-10 py-2 text-center text-ui-sm text-primary-foreground print:hidden">
      {banner.href ? (
        <a href={/^[a-z][a-z0-9+.-]*:/i.test(banner.href) ? banner.href : withBase(site.base, banner.href)} className="outline-none hover:underline focus-visible:underline">
          {text}
        </a>
      ) : (
        text
      )}
      {banner.dismissible && (
        <button
          type="button"
          onClick={close}
          aria-label={t.dismissBanner}
          className="absolute end-2 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-control text-primary-foreground/80 outline-none hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  )
}
