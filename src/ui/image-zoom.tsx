"use client";

import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { motion, useReducedMotion } from "motion/react"

import { MinusIcon, PlusIcon, XIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import { useLocale } from "@/ui/locale-provider"

/*
 * An image that opens full size. The full image grows out of the thumbnail (a FLIP transform from
 * the thumbnail's box to the centred box) and shrinks back into it on close; under reduced motion
 * it fades. Inside, the wheel, a pinch or the +/- keys zoom around the pointer, a drag pans, and a
 * click toggles between fit and 2x. The dialog primitive provides the focus trap, Escape, outside
 * press and scroll lock. `useZoomPan` and `ZoomPan` are the pan and zoom surface on their own, for
 * other full-screen viewers (the diagram item uses them).
 */

const SPRING = { type: "spring", duration: 0.4, bounce: 0 } as const
const EXIT_SPRING = { type: "spring", duration: 0.3, bounce: 0 } as const
const FADE = { duration: 0.2, ease: [0.22, 1, 0.36, 1] } as const

/* ───────────────────────── Pan and zoom ───────────────────────── */

type ZoomView = { scale: number; x: number; y: number }

const IDENTITY: ZoomView = { scale: 1, x: 0, y: 0 }

type ZoomPanOptions = {
  /** Largest scale. */
  maxZoom?: number
  /**
   * What the content must keep covered while zoomed: the window (`viewport`, for a lightbox whose
   * content sits centred on the screen) or the surface's own box (`surface`, for a framed viewer).
   */
  bounds?: "viewport" | "surface"
}

type ZoomPanController = {
  surfaceRef: React.RefObject<HTMLDivElement | null>
  view: ZoomView
  /** True while a drag or pinch is under way (transitions are off then). */
  gesture: boolean
  maxZoom: number
  /** Multiply the scale by `factor` around a client point (default: the surface centre). */
  zoomBy: (factor: number, clientX?: number, clientY?: number) => void
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  /** Used by `ZoomPan`; not part of the public surface. */
  internals: ZoomInternals
}

type ZoomInternals = {
  setView: (v: ZoomView) => void
  scaled: (from: ZoomView, scale: number, p: { x: number; y: number }, q?: { x: number; y: number }) => ZoomView
  setGesture: (on: boolean) => void
  viewRef: React.RefObject<ZoomView>
}

/** Pan and zoom state for one surface. Pair it with `<ZoomPan zoom={…}>`. */
function useZoomPan({ maxZoom = 4, bounds = "surface" }: ZoomPanOptions = {}): ZoomPanController {
  const surfaceRef = React.useRef<HTMLDivElement | null>(null)
  const [view, setViewState] = React.useState<ZoomView>(IDENTITY)
  const viewRef = React.useRef(view)
  const [gesture, setGesture] = React.useState(false)

  const clamp = React.useCallback(
    (v: ZoomView): ZoomView => {
      const el = surfaceRef.current
      const scale = Math.min(maxZoom, Math.max(1, v.scale))
      if (!el || scale <= 1.001) return IDENTITY
      const r = el.getBoundingClientRect()
      const b =
        bounds === "viewport"
          ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
          : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      // Bigger than the bounds: its edges stay outside them. Smaller: it stays inside them.
      const axis = (t: number, lo: number, hi: number, center: number, size: number) => {
        const half = (size * scale) / 2
        const a = hi - center - half
        const c = lo - center + half
        return Math.min(Math.max(t, Math.min(a, c)), Math.max(a, c))
      }
      return {
        scale,
        x: axis(v.x, b.left, b.right, r.left + r.width / 2, r.width),
        y: axis(v.y, b.top, b.bottom, r.top + r.height / 2, r.height),
      }
    },
    [maxZoom, bounds]
  )

  const setView = React.useCallback(
    (v: ZoomView) => {
      const next = clamp(v)
      viewRef.current = next
      setViewState(next)
    },
    [clamp]
  )

  /** The view after scaling `from` by `factor` so the point under `p` stays under `q`. */
  const scaled = React.useCallback(
    (from: ZoomView, scale: number, p: { x: number; y: number }, q = p): ZoomView => {
      const el = surfaceRef.current
      if (!el) return from
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const s = Math.min(maxZoom, Math.max(1, scale))
      const k = s / from.scale
      return { scale: s, x: q.x - cx - k * (p.x - cx - from.x), y: q.y - cy - k * (p.y - cy - from.y) }
    },
    [maxZoom]
  )

  const zoomBy = React.useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const el = surfaceRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const p = { x: clientX ?? r.left + r.width / 2, y: clientY ?? r.top + r.height / 2 }
      const from = viewRef.current
      setView(scaled(from, from.scale * factor, p))
    },
    [scaled, setView]
  )

  // Wheel and trackpad pinch need a non-passive listener to keep the page from zooming.
  React.useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      // A trackpad pinch arrives as a wheel event with ctrlKey and small deltas.
      const rate = e.ctrlKey ? 0.01 : 0.0015
      zoomBy(Math.exp(-e.deltaY * unit * rate), e.clientX, e.clientY)
    }
    // Pinch on a trackpad in the browsers that send gesture events instead.
    let gestureStart = 1
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      gestureStart = viewRef.current.scale
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      const g = e as Event & { scale: number; clientX: number; clientY: number }
      const from = viewRef.current
      setView(scaled(from, gestureStart * g.scale, { x: g.clientX, y: g.clientY }))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    el.addEventListener("gesturestart", onGestureStart)
    el.addEventListener("gesturechange", onGestureChange)
    return () => {
      el.removeEventListener("wheel", onWheel)
      el.removeEventListener("gesturestart", onGestureStart)
      el.removeEventListener("gesturechange", onGestureChange)
    }
  })

  return {
    surfaceRef,
    view,
    gesture,
    maxZoom,
    zoomBy,
    zoomIn: () => zoomBy(1.5),
    zoomOut: () => zoomBy(1 / 1.5),
    reset: () => setView(IDENTITY),
    internals: { setView, scaled, setGesture, viewRef },
  }
}

type ZoomPanProps = Omit<React.ComponentProps<"div">, "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel"> & {
  /** The controller from `useZoomPan`. */
  zoom: ZoomPanController
  /** Class for the transformed layer that holds the content. */
  contentClassName?: string
}

/**
 * The surface that pans and zooms its children. Focusable: `+` and `-` zoom, `0` resets and the
 * arrow keys pan while zoomed in.
 */
function ZoomPan({ zoom, className, contentClassName, children, onKeyDown, ...props }: ZoomPanProps) {
  const z = { ...zoom.internals, reset: zoom.reset, zoomIn: zoom.zoomIn, zoomOut: zoom.zoomOut }
  const pointers = React.useRef(new Map<number, { x: number; y: number }>())
  const start = React.useRef<{ view: ZoomView; x: number; y: number; dist: number; moved: boolean } | null>(null)

  const snapshot = () => {
    const pts = [...pointers.current.values()]
    const mid = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 })
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
    return { mid, dist }
  }

  const begin = (moved: boolean) => {
    const { mid, dist } = snapshot()
    start.current = { view: z.viewRef.current, x: mid.x, y: mid.y, dist, moved }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // A second finger turns the gesture into a pinch; it never counts as a click.
    begin(pointers.current.size > 1)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !start.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const s = start.current
    const { mid, dist } = snapshot()
    if (!s.moved && Math.hypot(mid.x - s.x, mid.y - s.y) < 4 && pointers.current.size < 2) return
    if (!s.moved) {
      s.moved = true
      z.setGesture(true)
    }
    if (pointers.current.size > 1 && s.dist > 0) {
      z.setView(z.scaled(s.view, s.view.scale * (dist / s.dist), { x: s.x, y: s.y }, mid))
    } else if (s.view.scale > 1) {
      z.setView({ ...s.view, x: s.view.x + mid.x - s.x, y: s.view.y + mid.y - s.y })
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    const s = start.current
    if (pointers.current.size > 0) {
      // One finger of a pinch lifted: carry on panning from where the pinch left off.
      begin(true)
      return
    }
    start.current = null
    z.setGesture(false)
    if (!s || s.moved || e.type === "pointercancel") return
    // A click toggles between fit and 2x around the pointer.
    if (z.viewRef.current.scale > 1) z.reset()
    else z.setView(z.scaled(z.viewRef.current, 2, { x: e.clientX, y: e.clientY }))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e)
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
    const v = z.viewRef.current
    const step = 48
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    if (e.key === "+" || e.key === "=") z.zoomIn()
    else if (e.key === "-" || e.key === "_") z.zoomOut()
    else if (e.key === "0") z.reset()
    else if (pan[e.key] && v.scale > 1) z.setView({ ...v, x: v.x + pan[e.key][0], y: v.y + pan[e.key][1] })
    else return
    e.preventDefault()
  }

  const zoomed = zoom.view.scale > 1
  return (
    <div
      ref={zoom.surfaceRef}
      data-slot="zoom-pan"
      data-zoomed={zoomed ? "" : undefined}
      data-gesture={zoom.gesture ? "" : undefined}
      role="group"
      tabIndex={0}
      className={cn(
        "relative cursor-zoom-in touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-ring data-gesture:cursor-grabbing data-zoomed:cursor-grab",
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <div
        data-slot="zoom-pan-content"
        className={cn(
          "size-full origin-center",
          !zoom.gesture && "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          contentClassName
        )}
        style={{ transform: `translate3d(${zoom.view.x}px, ${zoom.view.y}px, 0) scale(${zoom.view.scale})` }}
      >
        {children}
      </div>
    </div>
  )
}

/** Zoom out, zoom in and close, for the top corner of a full-screen viewer. Render it inside a dialog popup. */
function ZoomToolbar({ zoom, className, ...props }: React.ComponentProps<"div"> & { zoom: ZoomPanController }) {
  const { labels } = useLocale()
  return (
    <div data-slot="zoom-toolbar" className={cn("flex items-center gap-1", className)} {...props}>
      <Button variant="glass" size="icon-sm" aria-label={labels.zoomOut} disabled={zoom.view.scale <= 1} onClick={zoom.zoomOut}>
        <MinusIcon />
      </Button>
      <Button variant="glass" size="icon-sm" aria-label={labels.zoomIn} disabled={zoom.view.scale >= zoom.maxZoom} onClick={zoom.zoomIn}>
        <PlusIcon />
      </Button>
      <DialogPrimitive.Close render={<Button variant="glass" size="icon-sm" aria-label={labels.close} />}>
        <XIcon />
      </DialogPrimitive.Close>
    </div>
  )
}

/* ───────────────────────── Image zoom ───────────────────────── */

type Box = { x: number; y: number; width: number; height: number }

/** Space kept around the full image, and below it for a caption. */
function fitBox(aspect: number, naturalWidth: number, caption: boolean): Box {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const pad = vw < 640 ? 12 : 48
  const below = caption ? 64 : 0
  const maxW = vw - pad * 2
  const maxH = vh - pad * 2 - below
  let width = Math.min(maxW, maxH * aspect, naturalWidth > 0 ? naturalWidth : Infinity)
  width = Math.max(width, 1)
  const height = width / aspect
  return { x: (vw - width) / 2, y: (vh - below - height) / 2, width, height }
}

/** The transform that draws a box laid out at `to` over the box `from`. */
function flip(from: Box, to: Box) {
  return {
    x: from.x + from.width / 2 - (to.x + to.width / 2),
    y: from.y + from.height / 2 - (to.y + to.height / 2),
    scaleX: from.width / to.width,
    scaleY: from.height / to.height,
    opacity: 1,
  }
}

const AT_REST = { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }

type ImageZoomProps = Omit<React.ComponentProps<"img">, "children"> & {
  /** A larger file to show when open. Defaults to the thumbnail's own source. */
  zoomSrc?: string
  /** Shown under the thumbnail and under the open image. */
  caption?: React.ReactNode
  /** Largest zoom inside the viewer. */
  maxZoom?: number
  /** An image element to use as the thumbnail instead of `src`. */
  children?: React.ReactNode
  /** Class for the root (the trigger, or the figure when there is a caption). */
  rootClassName?: string
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

type Phase = "closed" | "open" | "closing"

/** An image that opens full size, zooms and pans. */
function ImageZoom({
  src,
  zoomSrc,
  alt = "",
  caption,
  maxZoom = 4,
  children,
  className,
  rootClassName,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...imgProps
}: ImageZoomProps) {
  const { labels } = useLocale()
  const reduce = useReducedMotion()
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const actionsRef = React.useRef<DialogPrimitive.Root.Actions | null>(null)
  const zoom = useZoomPan({ maxZoom, bounds: "viewport" })
  const [phase, setPhase] = React.useState<Phase>(defaultOpen ? "open" : "closed")
  const [stage, setStage] = React.useState<{
    box: Box
    from: Box | null
    thumbSrc: string
    fullSrc: string
    outline: boolean
  } | null>(null)
  const [loaded, setLoaded] = React.useState(false)
  const captionId = React.useId()

  const open = openProp ?? phase === "open"

  const measure = React.useCallback(() => {
    const img = triggerRef.current?.querySelector("img") ?? null
    const rect = img?.getBoundingClientRect()
    const visible = rect && rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight
    const from = visible ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null
    const nw = img?.naturalWidth ?? 0
    const nh = img?.naturalHeight ?? 0
    const aspect = nw && nh ? nw / nh : rect && rect.height ? rect.width / rect.height : 4 / 3
    const thumbSrc = img?.currentSrc || img?.src || src || ""
    const fullSrc = zoomSrc ?? thumbSrc
    // Don't blow a small image up past its own pixels unless a larger file is coming.
    const box = fitBox(aspect, zoomSrc ? 0 : nw, caption != null)
    // The open image takes the hairline only when the thumbnail has one (transparent marks stay bare).
    const outline = !img || img.classList.contains("media-outline")
    return { box, from, thumbSrc, fullSrc, outline }
  }, [src, zoomSrc, caption])

  // Opened from outside (`open` or `defaultOpen`): measure before the first paint.
  React.useLayoutEffect(() => {
    if (open && !stage) setStage(measure())
  }, [open, stage, measure])

  React.useEffect(() => {
    if (!stage) return
    const onResize = () => setStage((s) => (s ? { ...s, box: measure().box } : s))
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [stage, measure])

  const handleOpenChange = (next: boolean, details: DialogPrimitive.Root.ChangeEventDetails) => {
    if (next) {
      setStage(measure())
      setLoaded(false)
      setPhase("open")
    } else {
      // Run the shrink back into the thumbnail before the popup leaves.
      details.preventUnmountOnClose()
      zoom.reset()
      const now = measure()
      setStage((s) => (s ? { ...s, from: now.from } : s))
      setPhase("closing")
    }
    onOpenChange?.(next)
  }

  const finish = () => {
    if (phase !== "closing") return
    actionsRef.current?.unmount()
    setPhase("closed")
    setStage(null)
  }

  const viewing = phase !== "closed" || open
  const fade = reduce || !stage?.from
  const enter = stage && !fade && stage.from ? flip(stage.from, stage.box) : { ...AT_REST, opacity: 0 }
  const target = phase === "closing" ? enter : AT_REST

  const trigger = (
    <DialogPrimitive.Trigger
      ref={triggerRef}
      data-slot="image-zoom-trigger"
      data-viewing={viewing && !fade ? "" : undefined}
      aria-label={labels.enlargeImage(alt || undefined)}
      className={cn(
        "group/image-zoom relative inline-block max-w-full cursor-zoom-in rounded-lg bg-transparent p-0 align-top outline-none focus-visible:ring-2 focus-visible:ring-ring data-viewing:[&_img]:opacity-0",
        !caption && rootClassName
      )}
    >
      {children ?? (
        // eslint-disable-next-line @next/next/no-img-element -- any URL; the viewer reads its decoded file and size
        <img
          data-slot="image-zoom-image"
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn("block h-auto max-w-full rounded-lg media-outline", className)}
          {...imgProps}
        />
      )}
    </DialogPrimitive.Trigger>
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} actionsRef={actionsRef}>
      {caption != null ? (
        <figure data-slot="image-zoom" className={cn("inline-flex max-w-full flex-col gap-2", rootClassName)}>
          {trigger}
          <figcaption data-slot="image-zoom-caption" className="text-center text-ui-sm text-pretty text-muted-foreground">
            {caption}
          </figcaption>
        </figure>
      ) : (
        trigger
      )}
      <DialogPrimitive.Portal dir={dir}>
        <DialogPrimitive.Backdrop
          data-slot="image-zoom-backdrop"
          data-closing={phase === "closing" ? "" : undefined}
          className="fixed inset-0 z-50 bg-black/80 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-closing:opacity-0 data-closing:duration-200 data-starting-style:opacity-0"
        />
        <DialogPrimitive.Viewport data-slot="image-zoom-viewport" className="fixed inset-0 z-50 overflow-hidden">
          {stage && (
            <DialogPrimitive.Popup
              data-slot="image-zoom-popup"
              initialFocus={zoom.surfaceRef}
              data-closing={phase === "closing" ? "" : undefined}
              aria-describedby={caption != null ? captionId : undefined}
              className="absolute outline-none"
              style={{ left: stage.box.x, top: stage.box.y, width: stage.box.width, height: stage.box.height }}
            >
              <DialogPrimitive.Title className="sr-only">{alt || labels.image}</DialogPrimitive.Title>
              <motion.div
                data-slot="image-zoom-frame"
                className="size-full"
                initial={enter}
                animate={target}
                transition={fade ? FADE : phase === "closing" ? EXIT_SPRING : SPRING}
                onAnimationComplete={finish}
              >
                <ZoomPan zoom={zoom} aria-label={alt || labels.image} className="size-full rounded-lg">
                  {/* The thumbnail's file is already decoded: it stands in until the larger one loads. */}
                  {stage.fullSrc !== stage.thumbSrc && !loaded && stage.thumbSrc && (
                    // eslint-disable-next-line @next/next/no-img-element -- the thumbnail's decoded file
                    <img src={stage.thumbSrc} alt="" aria-hidden className="absolute inset-0 size-full rounded-lg object-contain" draggable={false} />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element -- any URL at its full size */}
                  <img
                    src={stage.fullSrc}
                    alt={alt}
                    draggable={false}
                    onLoad={() => setLoaded(true)}
                    className={cn("relative size-full rounded-lg object-contain", stage.outline && "media-outline")}
                  />
                </ZoomPan>
              </motion.div>
              <ZoomToolbar zoom={zoom} className="fixed end-3 top-3 transition-opacity duration-200 in-data-closing:opacity-0" />
              {caption != null && (
                <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4">
                  <p
                    id={captionId}
                    className="pointer-events-auto max-w-xl rounded-lg bg-card/80 px-3 py-1.5 text-center text-ui text-pretty text-foreground shadow-surface backdrop-blur-xl"
                  >
                    {caption}
                  </p>
                </div>
              )}
            </DialogPrimitive.Popup>
          )}
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export {
  ImageZoom,
  ZoomPan,
  ZoomToolbar,
  useZoomPan,
  type ImageZoomProps,
  type ZoomPanProps,
  type ZoomPanController,
  type ZoomPanOptions,
  type ZoomView,
}
