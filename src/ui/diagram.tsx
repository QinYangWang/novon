"use client";

import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { MaximizeIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { ZoomPan, ZoomToolbar, useZoomPan } from "@/ui/image-zoom"
import { useLocale } from "@/ui/locale-provider"

/*
 * A frame for SVG diagrams drawn in the browser. It is renderer-agnostic: pass `source` and an
 * async `render(source, theme)` that returns SVG markup, or pass an already drawn diagram as
 * children. It shows a skeleton while the renderer runs, the source with the error when it
 * throws, and opens full screen with pan and zoom on click. It re-renders when the theme on
 * <html> changes (dark class, accent, style), handing the renderer the theme as hex colours,
 * since renderers can't read oklch or translucent tokens.
 */

/* ───────────────────────── Theme colours ───────────────────────── */

type ResolveThemeColorsOptions = {
  /** Where to read the tokens, for themes scoped below <html>. Defaults to <body>. */
  element?: Element
  /** The token translucent colours are flattened over. Defaults to `background`. */
  background?: string
}

/** `primary` → `var(--primary)`, `--primary` → `var(--primary)`, anything else is used as written. */
function tokenValue(name: string) {
  if (name.startsWith("--")) return `var(${name})`
  if (/^[a-z][a-z0-9-]*$/i.test(name) && !CSS_KEYWORDS.has(name.toLowerCase())) return `var(--${name})`
  return name
}

const CSS_KEYWORDS = new Set(["transparent", "currentcolor", "black", "white", "inherit", "canvas", "canvastext"])

let paintCanvas: HTMLCanvasElement | null = null

/**
 * Theme tokens as `#rrggbb`. Each token is read through the cascade, so oklch, color-mix and
 * accent presets all resolve, then painted over the background so alpha is flattened. Returns an
 * empty record during server rendering.
 */
function resolveThemeColors<T extends string>(names: readonly T[], options: ResolveThemeColorsOptions = {}): Record<T, string> {
  const out = {} as Record<T, string>
  if (typeof document === "undefined") return out
  const host = options.element ?? document.body
  const probe = document.createElement("span")
  probe.style.display = "none"
  host.append(probe)
  const read = (name: string) => {
    probe.style.color = ""
    probe.style.color = tokenValue(name)
    return getComputedStyle(probe).color
  }
  paintCanvas ??= document.createElement("canvas")
  paintCanvas.width = paintCanvas.height = 1
  const ctx = paintCanvas.getContext("2d", { willReadFrequently: true })
  try {
    const background = read(options.background ?? "background")
    for (const name of names) {
      const value = read(name)
      if (!ctx) {
        out[name] = value
        continue
      }
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, 1, 1)
      ctx.fillStyle = background
      ctx.fillRect(0, 0, 1, 1)
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      out[name] = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`
    }
  } finally {
    probe.remove()
  }
  return out
}

/** The tokens `Diagram` resolves for its renderer unless `colors` says otherwise. */
const DIAGRAM_COLORS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "muted",
  "muted-foreground",
  "border",
  "primary",
  "primary-foreground",
  "primary-subtle",
  "secondary",
  "accent",
  "destructive",
  "success",
  "warning",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
] as const

/* ───────────────────────── Theme changes ───────────────────────── */

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-accent", "data-style"] })
  return () => observer.disconnect()
}

function themeSnapshot() {
  const root = document.documentElement
  return [root.className, root.getAttribute("style"), root.getAttribute("data-accent"), root.getAttribute("data-style")].join("|")
}

/* ───────────────────────── Diagram ───────────────────────── */

type DiagramTheme = {
  dark: boolean
  /** The resolved tokens, keyed by the names asked for. */
  colors: Record<string, string>
  /** The body font stack of the frame. */
  fontFamily: string
}

type DiagramRenderer = (source: string, theme: DiagramTheme) => Promise<string> | string

type DiagramProps = Omit<React.ComponentProps<"figure">, "children"> & {
  /** Diagram text handed to `render`. Also shown when rendering fails. */
  source?: string
  /** Turns `source` into SVG markup. Read when the source or the theme changes. */
  render?: DiagramRenderer
  /** An already drawn diagram, used instead of `source` and `render`. */
  children?: React.ReactNode
  caption?: React.ReactNode
  /** Tokens resolved to hex for the renderer. */
  colors?: readonly string[]
  /** Opens full screen with pan and zoom on click. */
  expandable?: boolean
  /** Accessible name of the figure and the full-screen view. */
  label?: string
  /** Largest zoom in the full-screen view. */
  maxZoom?: number
}

type DiagramState = { status: "loading" } | { status: "ready"; svg: string } | { status: "error"; message: string }

/** A frame for client-rendered SVG diagrams, with full-screen pan and zoom. */
function Diagram({
  source = "",
  render,
  children,
  caption,
  colors = DIAGRAM_COLORS,
  expandable = true,
  label,
  maxZoom = 6,
  className,
  ...props
}: DiagramProps) {
  const { labels } = useLocale()
  const name = label ?? labels.diagram
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  const figureRef = React.useRef<HTMLElement>(null)
  const renderRef = React.useRef(render)
  const colorsRef = React.useRef(colors)
  React.useLayoutEffect(() => {
    renderRef.current = render
    colorsRef.current = colors
  })
  const theme = React.useSyncExternalStore(subscribeTheme, themeSnapshot, () => "")
  const [state, setState] = React.useState<DiagramState>({ status: "loading" })
  const drawn = children != null
  const zoom = useZoomPan({ maxZoom })

  React.useEffect(() => {
    const draw = renderRef.current
    if (drawn || !draw || !theme) return
    let alive = true
    setState({ status: "loading" })
    const el = figureRef.current ?? document.body
    const t: DiagramTheme = {
      dark: document.documentElement.classList.contains("dark"),
      colors: resolveThemeColors(colorsRef.current, { element: el }),
      fontFamily: getComputedStyle(el).fontFamily,
    }
    Promise.resolve()
      .then(() => draw(source, t))
      .then(
        (svg) => alive && setState({ status: "ready", svg }),
        (error: unknown) => alive && setState({ status: "error", message: error instanceof Error ? error.message : String(error) })
      )
    return () => {
      alive = false
    }
  }, [source, theme, drawn])

  const status = drawn ? "ready" : !render ? "error" : state.status
  const art = drawn ? children : state.status === "ready" ? <div className="contents" dangerouslySetInnerHTML={{ __html: state.svg }} /> : null
  const canExpand = expandable && status === "ready"

  const body =
    status === "loading" ? (
      <div data-slot="diagram-skeleton" aria-hidden className="min-h-40 animate-pulse rounded-inner bg-foreground/6 motion-reduce:animate-none" />
    ) : status === "error" ? (
      <div data-slot="diagram-error" className="flex flex-col gap-2 rounded-inner p-3 text-start">
        <p className="m-0 text-ui text-destructive-text">{labels.diagramError}</p>
        {state.status === "error" && state.message && <p className="m-0 text-ui-sm text-muted-foreground">{state.message}</p>}
        {source && (
          <pre className="m-0 max-h-60 overflow-auto font-mono text-ui-xs whitespace-pre text-muted-foreground">
            <code>{source}</code>
          </pre>
        )}
      </div>
    ) : canExpand ? (
      <DialogPrimitive.Trigger
        data-slot="diagram-trigger"
        aria-label={labels.openDiagram}
        className="group/diagram relative flex w-full cursor-zoom-in items-center justify-center rounded-inner p-4 outline-none transition-colors duration-150 hover:bg-foreground/3 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-auto [&_svg]:max-w-full"
      >
        {art}
        <span
          aria-hidden
          className="absolute end-2 top-2 inline-flex size-6 items-center justify-center rounded-control-sm bg-card/80 text-muted-foreground opacity-0 shadow-chip backdrop-blur-sm transition-opacity duration-150 group-hover/diagram:opacity-100 group-focus-visible/diagram:opacity-100 pointer-coarse:opacity-100"
        >
          <MaximizeIcon size={14} />
        </span>
      </DialogPrimitive.Trigger>
    ) : (
      <div data-slot="diagram-body" className="flex items-center justify-center p-4 [&_svg]:h-auto [&_svg]:max-w-full">
        {art}
      </div>
    )

  const figure = (
    <figure
      ref={figureRef}
      data-slot="diagram"
      data-status={status}
      aria-label={name}
      aria-busy={status === "loading" || undefined}
      className={cn("frame-2xl frame-p-1.5 m-0 flex flex-col bg-card text-card-foreground shadow-raised", className)}
      {...props}
    >
      {body}
      {caption != null && (
        <figcaption data-slot="diagram-caption" className="px-3 pt-1.5 pb-2 text-center text-ui-sm text-pretty text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  )

  if (!canExpand) return figure

  return (
    <DialogPrimitive.Root onOpenChange={(open) => !open && zoom.reset()}>
      {figure}
      <DialogPrimitive.Portal dir={dir}>
        <DialogPrimitive.Backdrop
          data-slot="diagram-backdrop"
          className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0"
        />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Popup
            data-slot="diagram-popup"
            initialFocus={zoom.surfaceRef}
            className="frame-3xl frame-p-1.5 relative flex size-full flex-col bg-popover text-popover-foreground shadow-xl transition-[opacity,scale] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-98 data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100"
          >
            <DialogPrimitive.Title className="sr-only">{name}</DialogPrimitive.Title>
            <ZoomPan
              zoom={zoom}
              aria-label={name}
              className="min-h-0 flex-1 overflow-hidden rounded-inner"
              contentClassName="flex items-center justify-center p-8 [&_svg]:size-full [&_svg]:max-w-none"
            >
              {art}
            </ZoomPan>
            {caption != null && (
              <p className="m-0 px-3 pt-1.5 pb-2 text-center text-ui-sm text-pretty text-muted-foreground">{caption}</p>
            )}
            <ZoomToolbar zoom={zoom} className="absolute end-3 top-3" />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export {
  Diagram,
  resolveThemeColors,
  DIAGRAM_COLORS,
  type DiagramProps,
  type DiagramRenderer,
  type DiagramTheme,
  type ResolveThemeColorsOptions,
}
