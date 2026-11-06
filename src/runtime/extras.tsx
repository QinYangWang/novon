/**
 * More writing components: TypeTable, Diff, Prompt, ImageZoom, diagrams
 * from `mermaid` fences, and the site banner. Available in MDX without an import.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { Banner as PaneBanner } from '@/ui/banner'
import { CommandCopy, PromptCopy } from '@/ui/command-copy'
import { Diagram, type DiagramTheme } from '@/ui/diagram'
import { ImageZoom as PaneImageZoom } from '@/ui/image-zoom'
import { FileDiff } from '@/ui/file-diff'
import { SimpleTable, SimpleTableBody, SimpleTableCell, SimpleTableHead, SimpleTableHeader, SimpleTableRow } from '@/ui/simple-table'
import { bannerKey, withBase } from '../shared.ts'
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
  return <PromptCopy text={value} title={title ?? t.prompt} label={t.copyPrompt} className="not-typeset my-6" data-novon="prompt" />
}

/* ---------- Images ---------- */

export interface ImageZoomProps extends Omit<React.ComponentProps<'img'>, 'children'> {
  /** A larger file to show when zoomed. Default `src`. */
  zoomSrc?: string
  caption?: React.ReactNode
  maxZoom?: number
  children?: React.ReactNode
}

/** An image that opens full size on click, then zooms and pans. */
export function ImageZoom({ src, zoomSrc, alt = '', className, ...props }: ImageZoomProps) {
  const { site } = useSite()
  const resolve = (s?: string) => (s && s.startsWith('/') && !s.startsWith('//') ? withBase(site.base, s) : s)
  return <PaneImageZoom data-novon="image-zoom" src={resolve(src)} zoomSrc={resolve(zoomSrc)} alt={alt} loading="lazy" decoding="async" className={cn('my-0', className)} {...props} />
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

let mermaidQueue: Promise<unknown> = Promise.resolve()

let mermaidId = 0

/** Draws `mermaid` diagram text as SVG in the theme's colours (hex, from the diagram frame). */
async function drawMermaid(chart: string, theme: DiagramTheme): Promise<string> {
  const c = (name: string) => theme.colors[name]
  const id = `novon-mermaid-${++mermaidId}`
  const dark = theme.dark
  const { default: mermaid } = await import('mermaid')
  const font = theme.fontFamily
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: font,
    themeVariables: {
      darkMode: dark,
      fontFamily: font,
      fontSize: '14px',
      background: c('background'),
      primaryColor: c('card'),
      primaryTextColor: c('foreground'),
      primaryBorderColor: c('border'),
      secondaryColor: c('muted'),
      tertiaryColor: c('secondary'),
      lineColor: c('muted-foreground'),
      textColor: c('foreground'),
      mainBkg: c('card'),
      nodeBorder: c('border'),
      clusterBkg: c('muted'),
      clusterBorder: c('border'),
      noteBkgColor: c('secondary'),
      noteTextColor: c('foreground'),
      noteBorderColor: c('border'),
      edgeLabelBackground: c('background'),
      actorBkg: c('card'),
      actorBorder: c('border'),
      actorTextColor: c('foreground'),
      signalColor: c('muted-foreground'),
      signalTextColor: c('foreground'),
      labelBoxBkgColor: c('card'),
      labelTextColor: c('foreground'),
    },
  })
  // One diagram at a time: the renderer keeps global state.
  const run = mermaidQueue.then(() => mermaid.render(id, chart))
  mermaidQueue = run.catch(() => undefined)
  return (await run).svg
}

/** A diagram from `mermaid` diagram text, drawn in the browser in the page's colours; a ```` ```mermaid ```` fence becomes one. */
export function Mermaid({ chart, caption }: { chart: string; caption?: React.ReactNode }) {
  return <Diagram data-novon="mermaid" source={chart} render={drawMermaid} caption={caption} className="not-typeset my-6" />
}

/* ---------- Banner ---------- */

/** The site banner from config `banner`, above the header. A closed banner stays closed until its text or id changes. */
export function Banner() {
  const { site } = useSite()
  const banner = site.banner
  if (!banner) return null
  const text = <span dangerouslySetInnerHTML={{ __html: banner.html }} />
  const href = banner.href && (/^[a-z][a-z0-9+.-]*:/i.test(banner.href) ? banner.href : withBase(site.base, banner.href))
  return (
    <PaneBanner
      data-novon-banner=""
      data-novon-chrome=""
      href={href || undefined}
      storageKey={banner.dismissible ? bannerKey(banner.id) : undefined}
      dismissible={banner.dismissible}
    >
      {text}
    </PaneBanner>
  )
}
