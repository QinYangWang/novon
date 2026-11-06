"use client";

import * as React from "react"
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"

import { ArrowUpIcon, ChevronDownIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import { useLocale } from "@/ui/locale-provider"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { ScrollArea } from "@/ui/scroll-area"

/*
 * The page outline: links to the page's headings, with a track that steps in for
 * nested headings and lights up beside the section being read.
 *
 *   <Outline items={[{ id: "usage", title: "Usage", depth: 2 }, …]} />      sticky rail beside the article
 *   <OutlinePopover items={items} />                                         one button on narrow screens
 *   const active = useActiveHeading(["usage", "api"], { line: 112 })
 *
 * Ids are the headings' `id`s (what rehype-slug writes). The list renders on the server; the
 * track and the current section are measured after hydration.
 */

type OutlineItem = { id: string; title: React.ReactNode; depth: 2 | 3 }

type OutlineLinkProps = React.ComponentPropsWithRef<"a"> & { "data-outline-id": string; "data-depth": 2 | 3 }

/** Swap the `<a>` (a router link, a button that scrolls a container): spread `props` onto your element. */
type OutlineRenderLink = (props: OutlineLinkProps, item: OutlineItem) => React.ReactElement

/** Track x per depth (px from the list's start edge) and the length of the step between depths. */
const TRACK_X = { 2: 1, 3: 13 } as const
const STEP = 8
const DEFAULT_LINE = 112

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Px a heading has to travel past the line before the current section changes back. */
const HYSTERESIS = 8
/** Quiet time after a click before scrolling picks the section again. */
const SETTLE_MS = 150

function useActiveHeadingState(ids: readonly string[], line = DEFAULT_LINE, trackPosition = false) {
  const [active, setActiveState] = React.useState<string | undefined>(ids[0])
  const activeRef = React.useRef(active)
  // The last heading still on screen: the `range` variant lights everything the page is showing.
  const [lastVisible, setLastVisible] = React.useState<string | undefined>(ids[0])
  const lastVisibleRef = React.useRef(lastVisible)
  // How far down the page the reader is, as a fraction of the whole scroll range (0 at the top,
  // 1 at the bottom). Only the `progress` variant uses it.
  const [position, setPosition] = React.useState(0)
  const positionRef = React.useRef(position)
  // A clicked entry holds while its jump or smooth scroll runs, so the track doesn't march
  // through every section in between (or land on a neighbour the page can't scroll past).
  const locked = React.useRef(false)
  const settle = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  // Runs once the click's scroll has settled: the clicked heading stays current while it is on
  // screen, otherwise (the reader kept scrolling) the line picks again.
  const onSettled = React.useRef<() => void>(() => {})
  const unlockSoon = React.useCallback(() => {
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      locked.current = false
      onSettled.current()
    }, SETTLE_MS)
  }, [])
  const select = React.useCallback(
    (id: string | undefined) => {
      activeRef.current = id
      setActiveState(id)
      locked.current = true
      unlockSoon()
    },
    [unlockSoon]
  )
  const key = ids.join("\u0000")
  React.useEffect(() => {
    const els = key
      .split("\u0000")
      .map((id) => (id ? document.getElementById(id) : null))
      .filter((e): e is HTMLElement => !!e)
    let frame = 0
    const update = () => {
      frame = 0
      if (!els.length) return
      const root = document.documentElement
      // clientHeight stays put while a phone's toolbar slides; the clamp ignores rubber-band overscroll.
      const view = root.clientHeight
      const maxScroll = Math.max(0, root.scrollHeight - view)
      const remaining = maxScroll - Math.min(Math.max(window.scrollY, 0), maxScroll)
      // Over the last screen of scroll the line slides down to the bottom edge, so the short
      // sections at the end take their turn in order instead of the last one jumping in.
      const range = Math.min(view, maxScroll)
      const progress = range > 0 && remaining < range ? 1 - remaining / range : 0
      const at = line + Math.max(0, view - line) * progress
      const tops = els.map((el) => el.getBoundingClientRect().top)
      const indexAt = (y: number) => tops.reduce((found, top, i) => (top < y ? i : found), 0)
      let next = indexAt(at)
      // Keep the current section until a heading is clearly past the line, so a heading
      // resting on it (or a toolbar nudging the page) can't flip the track back and forth.
      const current = els.findIndex((el) => el.id === activeRef.current)
      if (current >= 0 && next !== current && indexAt(at - HYSTERESIS) <= current && current <= indexAt(at + HYSTERESIS)) next = current
      const id = els[next].id
      if (id !== activeRef.current) {
        activeRef.current = id
        setActiveState(id)
      }
      let shown = next
      for (let i = 0; i < tops.length; i++) if (tops[i] < view) shown = i
      const lastId = els[Math.max(shown, next)].id
      if (lastId !== lastVisibleRef.current) {
        lastVisibleRef.current = lastId
        setLastVisible(lastId)
      }
      if (trackPosition) {
        // The page's own scroll range, so a long section moves the track further than a short one.
        const fraction = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0
        const rounded = Math.round(fraction * 1000) / 1000
        if (rounded !== positionRef.current) {
          positionRef.current = rounded
          setPosition(rounded)
        }
      }
    }
    onSettled.current = () => {
      const top = activeRef.current ? document.getElementById(activeRef.current)?.getBoundingClientRect().top : undefined
      if (top === undefined || top < 0 || top > document.documentElement.clientHeight) update()
    }
    const onScroll = () => {
      if (locked.current) return unlockSoon()
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [key, line, unlockSoon, trackPosition])
  React.useEffect(() => () => clearTimeout(settle.current), [])
  return [active, select, lastVisible, position] as const
}

/**
 * The id of the section being read: the last heading whose top is above `line` (px from the top
 * of the viewport). Over the last screen of scroll the line moves down to the bottom edge, so the
 * sections at the end of the page each become current in turn.
 */
function useActiveHeading(ids: readonly string[], { line = DEFAULT_LINE }: { line?: number } = {}) {
  return useActiveHeadingState(ids, line)[0]
}

function useScrolledPast(threshold: number) {
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [threshold])
  return scrolled
}

type OutlineVariant = "section" | "range" | "progress"

/** What the track shows: the current entry, the whole stretch on screen, or how far the page is read. */
type TrackMode = OutlineVariant

type Track = {
  d: string
  height: number
  width: number
  /** The part of the track the variant lights. */
  active?: { top: number; bottom: number }
}

/** One path down the list's start edge, built from the links' offsets; a depth change is a short diagonal. */
function buildTrack(
  list: HTMLElement,
  mode: TrackMode,
  activeId: string | undefined,
  lastVisibleId: string | undefined,
  position: number
): Track | null {
  const links = [...list.querySelectorAll<HTMLElement>("[data-outline-id]")]
  if (links.length === 0) return null
  let d = ""
  let prevX: number | undefined
  let current: { top: number; bottom: number } | undefined
  let last: { top: number; bottom: number } | undefined
  // The first entry's top and the last one's bottom: the range a progress position travels over.
  let firstTop: number | undefined
  let lastBottom = 0
  links.forEach((link, i) => {
    const x = TRACK_X[link.dataset.depth === "3" ? 3 : 2]
    const top = link.offsetTop
    const bottom = top + link.offsetHeight
    const stepped = i > 0 && x !== prevX
    if (i === 0) d += `M${x} ${top}`
    else if (stepped) d += `L${x} ${top + STEP}`
    d += `L${x} ${bottom}`
    prevX = x
    const linkTop = stepped ? top + STEP : top
    if (firstTop === undefined) firstTop = linkTop
    lastBottom = bottom
    const range = { top: linkTop, bottom }
    if (link.dataset.outlineId === activeId) current = range
    if (link.dataset.outlineId === lastVisibleId) last = range
  })
  const base = { d, height: list.scrollHeight, width: TRACK_X[3] + 2 }
  if (mode === "progress") {
    // The reader's place in the page's scroll range, drawn straight down the track: a long section
    // moves it further than a short one. The part above the edge is read, the part below still to come.
    const from = firstTop ?? 0
    const span = lastBottom - from
    const at = from + span * Math.max(0, Math.min(1, position))
    return { ...base, active: at > from ? { top: from, bottom: at } : undefined }
  }
  // `section` lights the current entry; `range` closes on the last entry the page is showing.
  const start = current ?? last
  const active =
    start &&
    (mode === "range"
      ? { top: start.top, bottom: Math.max(start.top, last ? last.bottom : start.bottom) }
      : { top: start.top, bottom: start.bottom })
  return { ...base, active }
}

function OutlineList({
  items,
  mode,
  active,
  lastVisible,
  position,
  onSelect,
  listRef,
  renderLink,
}: {
  items: readonly OutlineItem[]
  mode: TrackMode
  active: string | undefined
  lastVisible: string | undefined
  position: number
  onSelect: (id: string) => void
  listRef: React.RefObject<HTMLUListElement | null>
  renderLink?: OutlineRenderLink
}) {
  const [track, setTrack] = React.useState<Track | null>(null)
  const reduce = useReducedMotion()
  // The indicator's edges follow springs instead of a CSS transition: a transition restarts on
  // every section change, so a steady scroll kept interrupting it and squeezed the block to nothing.
  // `progress` chases the scroll position, so it needs a softer spring than the steps do.
  const spring = mode === "progress" ? { stiffness: 160, damping: 30, mass: 0.5 } : { stiffness: 380, damping: 38, mass: 0.6 }
  const top = useSpring(0, spring)
  const bottom = useSpring(0, spring)
  const height = useMotionValue(0)
  const bottomInset = useTransform(() => Math.max(0, height.get() - bottom.get()))
  const clipPath = useMotionTemplate`inset(${top}px -2px ${bottomInset}px -2px)`
  const placed = React.useRef(false)

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const place = () => setTrack(buildTrack(list, mode, active, lastVisible, position))
    place()
    const ro = new ResizeObserver(place)
    ro.observe(list)
    return () => ro.disconnect()
  }, [mode, active, lastVisible, position, items, listRef])

  React.useLayoutEffect(() => {
    if (!track) return
    height.set(track.height)
    if (!track.active) return
    if (!placed.current || reduce) {
      top.jump(track.active.top)
      bottom.jump(track.active.bottom)
      placed.current = true
    } else {
      top.set(track.active.top)
      bottom.set(track.active.bottom)
    }
  }, [track, reduce, top, bottom, height])

  return (
    <ul ref={listRef} data-slot="outline-list" className="relative flex flex-col py-0.5">
      {track && (
        <li aria-hidden className="pointer-events-none absolute start-0 top-0 rtl:-scale-x-100">
          <svg width={track.width} height={track.height} viewBox={`0 0 ${track.width} ${track.height}`} fill="none" className="overflow-visible">
            <path d={track.d} className="stroke-border" strokeWidth={1} strokeLinejoin="round" />
            <motion.path
              d={track.d}
              data-slot="outline-indicator"
              className="stroke-foreground transition-opacity duration-200 motion-reduce:transition-none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ clipPath, opacity: track.active ? 1 : 0 }}
            />
          </svg>
        </li>
      )}
      {items.map((item) => {
        const props: OutlineLinkProps = {
          href: `#${item.id}`,
          "data-outline-id": item.id,
          "data-depth": item.depth,
          "aria-current": active === item.id ? "location" : undefined,
          onClick: () => onSelect(item.id),
          className: cn(
            "block rounded-sm py-1 ps-3.5 text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=location]:text-foreground",
            item.depth === 3 && "ps-6.5 text-ui-sm"
          ),
          children: <span className="block break-words">{item.title}</span>,
        }
        return <li key={item.id}>{renderLink ? renderLink(props, item) : <a {...props} />}</li>
      })}
    </ul>
  )
}

/**
 * Keeps the current entry inside the scroll viewport. It moves the list only as far as the entry
 * needs and without animation: a smooth scroll restarted on every section change while the page
 * is still scrolling makes the list lurch.
 */
function useKeepInView(
  viewportRef: React.RefObject<HTMLDivElement | null>,
  listRef: React.RefObject<HTMLUListElement | null>,
  active: string | undefined,
  enabled = true
) {
  React.useLayoutEffect(() => {
    const vp = viewportRef.current
    const link = listRef.current?.querySelector<HTMLElement>(`[data-outline-id="${CSS.escape(active ?? "")}"]`)
    if (!enabled || !vp || !link) return
    const pad = 24
    const top = link.offsetTop
    const bottom = top + link.offsetHeight
    if (top - pad < vp.scrollTop) vp.scrollTop = Math.max(0, top - pad)
    else if (bottom + pad > vp.scrollTop + vp.clientHeight) vp.scrollTop = bottom + pad - vp.clientHeight
  }, [active, enabled, listRef, viewportRef])
}

function scrollToTop(e: React.MouseEvent) {
  e.preventDefault()
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" })
}

function BackToTop({ visible, onClick, className }: { visible: boolean; onClick: (e: React.MouseEvent) => void; className?: string }) {
  const { labels } = useLocale()
  return (
    <a
      href="#top"
      data-slot="outline-back-to-top"
      inert={!visible}
      aria-hidden={!visible}
      onClick={onClick}
      className={cn(
        "flex w-fit items-center gap-1 rounded-sm text-ui-sm text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {labels.backToTop}
      <ArrowUpIcon className="size-3" />
    </a>
  )
}

type OutlineProps = Omit<React.ComponentProps<"nav">, "title" | "children"> & {
  items: readonly OutlineItem[]
  /** Heading above the list. Defaults to the locale's "On this page"; `null` leaves it out (the nav keeps that as its name). */
  title?: React.ReactNode
  /** A heading is current once its top passes this many px from the top of the viewport. */
  activeLine?: number
  /** Show the locale's "Back to top" link under the list once the page has scrolled 320px. */
  backToTop?: boolean
  /** Cap for the whole outline; the list scrolls inside it. Defaults to the viewport minus a sticky offset. */
  maxHeight?: string
  /**
   * What the track lights. `section` marks the entry being read, `range` the entries on screen,
   * `progress` how far the page is read.
   */
  variant?: OutlineVariant
  renderLink?: OutlineRenderLink
}

/**
 * Sticky-rail outline. It never grows past `maxHeight`: the list scrolls in its own thin area with
 * fades at the cut edges and keeps the current entry in view. Long titles wrap so every heading remains readable.
 */
function Outline({
  items,
  title: titleProp,
  activeLine = DEFAULT_LINE,
  backToTop = true,
  maxHeight = "calc(100svh - 6.5rem)",
  variant = "section",
  renderLink,
  className,
  style,
  ...props
}: OutlineProps) {
  const { labels } = useLocale()
  const title = titleProp === undefined ? labels.onThisPage : titleProp
  const ids = React.useMemo(() => items.map((i) => i.id), [items])
  const [active, setActive, lastVisible, position] = useActiveHeadingState(ids, activeLine, variant === "progress")
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const scrolled = useScrolledPast(320)
  useKeepInView(viewportRef, listRef, active)

  return (
    <nav
      data-slot="outline"
      data-variant={variant}
      style={{ maxHeight, ...style }}
      className={cn("flex min-h-0 flex-col gap-3 text-ui", className)}
      {...props}
      aria-label={props["aria-label"] ?? (typeof title === "string" ? title : labels.onThisPage)}
    >
      {title !== null && <p className="shrink-0 font-medium text-foreground">{title}</p>}
      <ScrollArea fade viewportRef={viewportRef} className="-ms-1 flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1 ps-1 pe-3">
        <OutlineList
          items={items}
          mode={variant}
          active={active}
          lastVisible={lastVisible}
          position={position}
          onSelect={setActive}
          listRef={listRef}
          renderLink={renderLink}
        />
      </ScrollArea>
      {backToTop && (
        // the divider belongs to the link: both fade in together, and the row keeps its space
        <div
          data-slot="outline-footer"
          data-visible={scrolled ? "" : undefined}
          className={cn(
            "shrink-0 border-t border-border pt-3 transition-opacity duration-200 motion-reduce:transition-none",
            !scrolled && "opacity-0"
          )}
        >
          <BackToTop visible={scrolled} onClick={scrollToTop} />
        </div>
      )}
    </nav>
  )
}

/** The trigger fills the nav, so size it with `className`. */
type OutlinePopoverProps = Omit<OutlineProps, "maxHeight" | "style">

/**
 * The outline folded into one button for narrow screens: the title plus the current section once
 * the page has scrolled, opening the same list in a popover as wide as the button.
 */
function OutlinePopover({
  items,
  title: titleProp,
  activeLine = DEFAULT_LINE,
  backToTop = true,
  variant = "section",
  renderLink,
  className,
  ...props
}: OutlinePopoverProps) {
  const { labels } = useLocale()
  const title = titleProp === undefined ? labels.onThisPage : titleProp
  const ids = React.useMemo(() => items.map((i) => i.id), [items])
  const [active, setActive, lastVisible, position] = useActiveHeadingState(ids, activeLine, variant === "progress")
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const scrolled = useScrolledPast(320)
  React.useEffect(() => setMounted(open), [open])
  useKeepInView(viewportRef, listRef, active, mounted)
  const current = items.find((i) => i.id === active)

  return (
    <nav data-slot="outline-popover" className={className} {...props} aria-label={props["aria-label"] ?? (typeof title === "string" ? title : labels.onThisPage)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="secondary" className="w-full" />}>
          <span className="flex min-w-0 flex-1 items-center gap-2 text-start">
            <span className="shrink-0 text-foreground">{title ?? labels.onThisPage}</span>
            {scrolled && current && (
              <>
                <span aria-hidden className="shrink-0 text-muted-foreground">
                  ·
                </span>
                <span className="min-w-0 truncate font-normal text-muted-foreground">{current.title}</span>
              </>
            )}
          </span>
          <ChevronDownIcon data-icon="inline-end" className="size-3.5 text-muted-foreground transition-transform duration-200 group-aria-expanded/button:rotate-180 motion-reduce:transition-none" />
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-(--anchor-width) gap-2 p-2">
          <ScrollArea
            fade
            viewportRef={viewportRef}
            className="flex min-h-0 flex-col"
            viewportClassName="ps-1 pe-3 text-ui"
            viewportProps={{ style: { maxHeight: "min(24rem, 60svh)" } }}
          >
            <OutlineList
              items={items}
              mode={variant}
              active={active}
              lastVisible={lastVisible}
              position={position}
              listRef={listRef}
              renderLink={renderLink}
              onSelect={(id) => {
                setActive(id)
                setOpen(false)
              }}
            />
          </ScrollArea>
          {backToTop && scrolled && (
            <div className="border-t border-border px-1 pt-2">
              <BackToTop
                visible
                onClick={(e) => {
                  setOpen(false)
                  scrollToTop(e)
                }}
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
    </nav>
  )
}

export { Outline, OutlinePopover, useActiveHeading }
export type { OutlineItem, OutlineProps, OutlinePopoverProps, OutlineRenderLink, OutlineLinkProps, OutlineVariant }
