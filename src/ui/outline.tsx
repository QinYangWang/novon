"use client";

import * as React from "react"

import { ArrowUpIcon, ChevronDownIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import { OverflowHint, OverflowHintContent, OverflowHintTrigger } from "@/ui/overflow-hint"
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

function useActiveHeadingState(ids: readonly string[], line = DEFAULT_LINE) {
  const [active, setActive] = React.useState<string | undefined>(ids[0])
  const key = ids.join("\u0000")
  React.useEffect(() => {
    const els = key
      .split("\u0000")
      .map((id) => (id ? document.getElementById(id) : null))
      .filter((e): e is HTMLElement => !!e)
    let frame = 0
    const update = () => {
      frame = 0
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      let current = els[0]?.id
      if (atEnd && els.length) current = els[els.length - 1].id
      else for (const el of els) if (el.getBoundingClientRect().top < line) current = el.id
      setActive(current)
    }
    const onScroll = () => {
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
  }, [key, line])
  return [active, setActive] as const
}

/**
 * The id of the section being read: the last heading whose top is above `line` (px from the top
 * of the viewport), or the last heading once the page is scrolled to the end.
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

type Track = { d: string; height: number; width: number; active?: { top: number; bottom: number } }

/** One path down the list's start edge, built from the links' offsets; a depth change is a short diagonal. */
function buildTrack(list: HTMLElement, activeId: string | undefined): Track | null {
  const links = [...list.querySelectorAll<HTMLElement>("[data-outline-id]")]
  if (links.length === 0) return null
  let d = ""
  let prevX: number | undefined
  let active: Track["active"]
  links.forEach((link, i) => {
    const x = TRACK_X[link.dataset.depth === "3" ? 3 : 2]
    const top = link.offsetTop
    const bottom = top + link.offsetHeight
    const stepped = i > 0 && x !== prevX
    if (i === 0) d += `M${x} ${top}`
    else if (stepped) d += `L${x} ${top + STEP}`
    d += `L${x} ${bottom}`
    prevX = x
    if (link.dataset.outlineId === activeId) active = { top: stepped ? top + STEP : top, bottom }
  })
  return { d, height: list.scrollHeight, width: TRACK_X[3] + 2, active }
}

/** The text a title shows, for the hint and the popover button. */
function plainTitle(title: React.ReactNode): string {
  if (typeof title === "string" || typeof title === "number") return String(title)
  if (Array.isArray(title)) return title.map(plainTitle).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(title)) return plainTitle(title.props.children)
  return ""
}

function OutlineList({
  items,
  active,
  onSelect,
  hintSide,
  listRef,
  renderLink,
}: {
  items: readonly OutlineItem[]
  active: string | undefined
  onSelect: (id: string) => void
  hintSide: "left" | "right" | "bottom"
  listRef: React.RefObject<HTMLUListElement | null>
  renderLink?: OutlineRenderLink
}) {
  const [track, setTrack] = React.useState<Track | null>(null)

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const place = () => setTrack(buildTrack(list, active))
    place()
    const ro = new ResizeObserver(place)
    ro.observe(list)
    return () => ro.disconnect()
  }, [active, items, listRef])

  return (
    <ul ref={listRef} data-slot="outline-list" className="relative flex flex-col py-0.5">
      {track && (
        <li aria-hidden className="pointer-events-none absolute start-0 top-0 rtl:-scale-x-100">
          <svg width={track.width} height={track.height} viewBox={`0 0 ${track.width} ${track.height}`} fill="none" className="overflow-visible">
            <path d={track.d} className="stroke-border" strokeWidth={1} strokeLinejoin="round" />
            <path
              d={track.d}
              data-slot="outline-indicator"
              className="stroke-foreground transition-[clip-path,opacity] duration-300 ease-out motion-reduce:transition-none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                clipPath: track.active
                  ? `inset(${track.active.top}px -2px ${Math.max(0, track.height - track.active.bottom)}px -2px)`
                  : `inset(0 -2px ${track.height}px -2px)`,
                opacity: track.active ? 1 : 0,
              }}
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
            "block rounded-sm py-1 ps-3.5 text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset aria-[current=location]:text-foreground",
            item.depth === 3 && "ps-6.5 text-ui-sm"
          ),
          children: (
            <OverflowHint>
              <OverflowHintTrigger>{item.title}</OverflowHintTrigger>
              <OverflowHintContent side={hintSide} sideOffset={16}>
                {plainTitle(item.title) || item.title}
              </OverflowHintContent>
            </OverflowHint>
          ),
        }
        return <li key={item.id}>{renderLink ? renderLink(props, item) : <a {...props} />}</li>
      })}
    </ul>
  )
}

/** Keeps the current entry inside the scroll viewport, about a third of the way down. */
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
    if (top - pad < vp.scrollTop || bottom + pad > vp.scrollTop + vp.clientHeight) {
      vp.scrollTo({ top: Math.max(0, top - vp.clientHeight / 3), behavior: reducedMotion() ? "auto" : "smooth" })
    }
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
        "flex w-fit items-center gap-1 rounded-sm text-ui-sm text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
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
  renderLink?: OutlineRenderLink
}

/**
 * Sticky-rail outline. It never grows past `maxHeight`: the list scrolls in its own thin area with
 * fades at the cut edges and keeps the current entry in view. Long titles stay on one line and show
 * in full on hover.
 */
function Outline({
  items,
  title: titleProp,
  activeLine = DEFAULT_LINE,
  backToTop = true,
  maxHeight = "calc(100svh - 6.5rem)",
  renderLink,
  className,
  style,
  ...props
}: OutlineProps) {
  const { labels } = useLocale()
  const title = titleProp === undefined ? labels.onThisPage : titleProp
  const ids = React.useMemo(() => items.map((i) => i.id), [items])
  const [active, setActive] = useActiveHeadingState(ids, activeLine)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const scrolled = useScrolledPast(320)
  useKeepInView(viewportRef, listRef, active)

  return (
    <nav
      data-slot="outline"
      aria-label={typeof title === "string" ? title : labels.onThisPage}
      style={{ maxHeight, ...style }}
      className={cn("flex min-h-0 flex-col gap-3 text-ui", className)}
      {...props}
    >
      {title !== null && <p className="shrink-0 font-medium text-foreground">{title}</p>}
      <ScrollArea fade viewportRef={viewportRef} className="-ms-1 flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1 ps-1 pe-3">
        <OutlineList items={items} active={active} onSelect={setActive} hintSide="left" listRef={listRef} renderLink={renderLink} />
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
  renderLink,
  className,
  ...props
}: OutlinePopoverProps) {
  const { labels } = useLocale()
  const title = titleProp === undefined ? labels.onThisPage : titleProp
  const ids = React.useMemo(() => items.map((i) => i.id), [items])
  const [active, setActive] = useActiveHeadingState(ids, activeLine)
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const scrolled = useScrolledPast(320)
  React.useEffect(() => setMounted(open), [open])
  useKeepInView(viewportRef, listRef, active, mounted)
  const current = items.find((i) => i.id === active)

  return (
    <nav data-slot="outline-popover" aria-label={typeof title === "string" ? title : labels.onThisPage} className={className} {...props}>
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
          <ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform duration-200 group-aria-expanded/button:rotate-180 motion-reduce:transition-none" />
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
              active={active}
              hintSide="bottom"
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
export type { OutlineItem, OutlineProps, OutlinePopoverProps, OutlineRenderLink, OutlineLinkProps }
