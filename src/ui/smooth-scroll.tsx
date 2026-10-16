import * as React from "react"
import Lenis from "lenis"
import { type MotionValue, useMotionValue, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/ui/scroll-area"

/* Exponential ease-out: quick to respond, long soft tail. */
const easeScroll = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t))

type ScrollTarget = number | string | HTMLElement

type SmoothScrollToOptions = {
  /** Extra px added to the resolved position (negative to clear a sticky header). */
  offset?: number
  /** Ease duration in seconds (smooth path only). */
  duration?: number
  /** Jump without animating. */
  immediate?: boolean
}

type SmoothScrollApi = {
  /** The smooth-scroll instance, or null on the native / reduced-motion path. */
  lenis: Lenis | null
  /** Whether scrolling is currently eased. */
  smooth: boolean
  /** The scroll container, or null when the provider drives the window. */
  container: React.RefObject<HTMLElement | null> | null
  /** Current scroll offset in px. */
  offset: MotionValue<number>
  /** Scroll position from 0 (start) to 1 (end). */
  progress: MotionValue<number>
  /** Signed scroll velocity in px per frame. */
  velocity: MotionValue<number>
  /** Scroll to a px offset, a selector or an element. Jumps under reduced motion. */
  scrollTo: (target: ScrollTarget, options?: SmoothScrollToOptions) => void
}

const SmoothScrollContext = React.createContext<SmoothScrollApi | null>(null)

type Orientation = "vertical" | "horizontal"
type Source = Window | HTMLElement

function readScroll(source: Source, orientation: Orientation) {
  const horizontal = orientation === "horizontal"
  if (source instanceof Window) {
    const doc = document.documentElement
    const pos = horizontal ? window.scrollX : window.scrollY
    const max = horizontal ? doc.scrollWidth - window.innerWidth : doc.scrollHeight - window.innerHeight
    return { pos, max: Math.max(0, max) }
  }
  const pos = horizontal ? source.scrollLeft : source.scrollTop
  const max = horizontal ? source.scrollWidth - source.clientWidth : source.scrollHeight - source.clientHeight
  return { pos, max: Math.max(0, max) }
}

function resolvePosition(target: ScrollTarget, source: Source, orientation: Orientation, offset = 0) {
  const horizontal = orientation === "horizontal"
  const current = readScroll(source, orientation).pos
  if (typeof target === "number") return target + offset
  const root: ParentNode = source instanceof Window ? document : source
  const el = typeof target === "string" ? root.querySelector(target) : target
  if (!(el instanceof Element)) return current
  const rect = el.getBoundingClientRect()
  if (source instanceof Window) {
    return (horizontal ? rect.left : rect.top) + current + offset
  }
  const box = source.getBoundingClientRect()
  return (horizontal ? rect.left - box.left : rect.top - box.top) + current + offset
}

function nativeScrollTo(source: Source, orientation: Orientation, position: number, immediate: boolean) {
  const behavior: ScrollBehavior = immediate ? "auto" : "smooth"
  if (orientation === "horizontal") source.scrollTo({ left: position, behavior })
  else source.scrollTo({ top: position, behavior })
}

/** Mirrors native scroll events into motion values (fallback and reduced-motion path). */
function useNativeScrollValues(
  enabled: boolean,
  getSource: () => Source | null,
  orientation: Orientation,
  offset: MotionValue<number>,
  progress: MotionValue<number>,
  velocity: MotionValue<number>
) {
  React.useEffect(() => {
    if (!enabled) return
    const source = getSource()
    if (!source) return
    let last = readScroll(source, orientation).pos
    let lastTime = performance.now()
    const update = () => {
      const { pos, max } = readScroll(source, orientation)
      const now = performance.now()
      offset.set(pos)
      progress.set(max > 0 ? Math.min(1, Math.max(0, pos / max)) : 0)
      velocity.set(((pos - last) / Math.max(1, now - lastTime)) * 16.67)
      last = pos
      lastTime = now
    }
    update()
    source.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      source.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [enabled, getSource, orientation, offset, progress, velocity])
}

type SmoothScrollProps = Omit<React.ComponentProps<"div">, "ref"> & {
  /**
   * `true` eases the whole page (window). `false` (default) renders its own
   * scroll container — give it a height via className.
   */
  root?: boolean
  /** Smoothing per frame, 0–1. Lower is heavier. Ignored when `duration` is set. */
  lerp?: number
  /** Fixed ease duration in seconds for wheel and programmatic scrolls. */
  duration?: number
  orientation?: Orientation
  wheelMultiplier?: number
  /** Ease touch scrolling too. Off by default: native momentum feels right on phones. */
  touch?: boolean
  /** Class for the inner content element (contained mode only). */
  contentClassName?: string
}

function SmoothScroll({
  root = false,
  lerp = 0.1,
  duration,
  orientation = "vertical",
  wheelMultiplier = 1,
  touch = false,
  className,
  contentClassName,
  children,
  ...props
}: SmoothScrollProps) {
  const reduce = useReducedMotion() ?? false
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [lenis, setLenis] = React.useState<Lenis | null>(null)
  const offset = useMotionValue(0)
  const progress = useMotionValue(0)
  const velocity = useMotionValue(0)

  const getSource = React.useCallback((): Source | null => (root ? window : wrapperRef.current), [root])

  React.useEffect(() => {
    if (reduce) return
    const wrapper = wrapperRef.current
    const content = contentRef.current
    if (!root && (!wrapper || !content)) return
    const horizontal = orientation === "horizontal"
    const instance: Lenis = new Lenis({
      ...(root ? {} : { wrapper: wrapper!, content: content!, eventsTarget: wrapper! }),
      // A contained instance would otherwise swallow every wheel event over it,
      // even at its ends, so the page stops scrolling under the pointer. At an
      // end, pushing outward, hand the event back to the browser so it chains
      // to the page like a native scroller does.
      virtualScroll: root
        ? undefined
        : ({ deltaX, deltaY }) => {
            const delta = horizontal ? deltaX || deltaY : deltaY
            const { limit, animatedScroll } = instance
            if (limit <= 0) return false
            if (delta < 0 && animatedScroll <= 0.5) return false
            if (delta > 0 && animatedScroll >= limit - 0.5) return false
            return true
          },
      autoRaf: true,
      lerp: duration === undefined ? lerp : 0,
      duration,
      easing: duration === undefined ? undefined : easeScroll,
      orientation,
      gestureOrientation: orientation === "horizontal" ? "both" : "vertical",
      wheelMultiplier,
      smoothWheel: true,
      syncTouch: touch,
    })
    const onScroll = (l: Lenis) => {
      offset.set(l.scroll)
      progress.set(Math.min(1, Math.max(0, l.progress || 0)))
      velocity.set(l.velocity)
    }
    instance.on("scroll", onScroll)
    onScroll(instance)
    setLenis(instance)
    return () => {
      instance.destroy()
      setLenis(null)
    }
  }, [reduce, root, lerp, duration, orientation, wheelMultiplier, touch, offset, progress, velocity])

  useNativeScrollValues(reduce, getSource, orientation, offset, progress, velocity)

  const scrollTo = React.useCallback(
    (target: ScrollTarget, options: SmoothScrollToOptions = {}) => {
      if (lenis && !reduce) {
        lenis.scrollTo(target, {
          offset: options.offset,
          duration: options.duration,
          lerp: options.duration !== undefined ? 0 : undefined,
          immediate: options.immediate,
          easing: options.duration !== undefined ? easeScroll : undefined,
        })
        return
      }
      const source = getSource()
      if (!source) return
      const position = resolvePosition(target, source, orientation, options.offset)
      nativeScrollTo(source, orientation, position, reduce || !!options.immediate)
    },
    [lenis, reduce, getSource, orientation]
  )

  const api = React.useMemo<SmoothScrollApi>(
    () => ({
      lenis,
      smooth: !!lenis && !reduce,
      container: root ? null : wrapperRef,
      offset,
      progress,
      velocity,
      scrollTo,
    }),
    [lenis, reduce, root, offset, progress, velocity, scrollTo]
  )

  if (root) {
    return <SmoothScrollContext.Provider value={api}>{children}</SmoothScrollContext.Provider>
  }

  return (
    <SmoothScrollContext.Provider value={api}>
      <ScrollArea
        data-slot="smooth-scroll"
        data-smooth={api.smooth ? "" : undefined}
        orientation={orientation}
        viewportRef={wrapperRef}
        // no overscroll containment: at its ends the wheel/touch chains to the page
        viewportClassName="overscroll-auto [scroll-behavior:auto]"
        className={className}
        {...props}
      >
        <div
          ref={contentRef}
          data-slot="smooth-scroll-content"
          className={cn(orientation === "horizontal" && "flex w-max", contentClassName)}
        >
          {children}
        </div>
      </ScrollArea>
    </SmoothScrollContext.Provider>
  )
}

/**
 * Scroll state for the nearest <SmoothScroll>. Outside a provider it falls back
 * to the window's native scroll, so scroll-driven components still work.
 */
function useSmoothScroll(): SmoothScrollApi {
  const context = React.useContext(SmoothScrollContext)
  const offset = useMotionValue(0)
  const progress = useMotionValue(0)
  const velocity = useMotionValue(0)
  const getWindow = React.useCallback((): Source => window, [])

  useNativeScrollValues(context === null, getWindow, "vertical", offset, progress, velocity)

  const scrollTo = React.useCallback((target: ScrollTarget, options: SmoothScrollToOptions = {}) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const position = resolvePosition(target, window, "vertical", options.offset)
    nativeScrollTo(window, "vertical", position, reduce || !!options.immediate)
  }, [])

  const fallback = React.useMemo<SmoothScrollApi>(
    () => ({ lenis: null, smooth: false, container: null, offset, progress, velocity, scrollTo }),
    [offset, progress, velocity, scrollTo]
  )

  return context ?? fallback
}

/** The nearest SmoothScroll's container ref, or null (window / no provider). */
function useSmoothScrollContainer() {
  return React.useContext(SmoothScrollContext)?.container ?? null
}

export {
  SmoothScroll,
  useSmoothScroll,
  useSmoothScrollContainer,
  type SmoothScrollProps,
  type SmoothScrollApi,
  type SmoothScrollToOptions,
  type ScrollTarget,
}
