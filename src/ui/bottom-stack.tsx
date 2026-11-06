"use client";

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

/*
 * One fixed column at the bottom of the viewport, so bars and cards pinned there (a consent card, a
 * media bar, your own) stack instead of covering each other. Items portal into it; a higher `order`
 * sits closer to the bottom edge. The column keeps clear of the home indicator (safe-area inset).
 *
 * The column publishes the height it covers as `--bottom-overlay-offset` on <html> (0 when empty).
 * Overlays that stay outside it, such as toasts or a floating button, lift above it with
 * `bottom: calc(var(--bottom-overlay-offset, 0px) + 1rem)`.
 *
 * Without a <BottomStack> the first item creates the column on <body> and removes it when the last
 * one leaves. Mount <BottomStack /> once to place it yourself, for example above a tab bar. Items
 * rendered inside a <BottomStack> always join that one; give it `className="absolute"` to keep a
 * stack inside a positioned container (a preview), which then gets the offset property instead.
 */

/** The custom property on <html> that holds the stack's height. */
const BOTTOM_OVERLAY_OFFSET = "--bottom-overlay-offset"

const bottomStackClass =
  "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-3 pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] empty:hidden *:pointer-events-auto sm:px-4 sm:pt-4 sm:pb-[max(--spacing(4),env(safe-area-inset-bottom))] print:hidden"

/* Which element items outside any <BottomStack> portal into: the last fixed one mounted, else one created on demand. */
const placedHosts: HTMLElement[] = []
let autoHost: HTMLElement | null = null
let stopAutoTracking: (() => void) | null = null
let itemCount = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getHost() {
  return placedHosts[placedHosts.length - 1] ?? autoHost
}

function sync() {
  const wantAuto = itemCount > 0 && placedHosts.length === 0
  if (wantAuto && !autoHost) {
    autoHost = document.createElement("div")
    autoHost.setAttribute("data-slot", "bottom-stack")
    autoHost.className = bottomStackClass
    document.body.appendChild(autoHost)
    stopAutoTracking = trackOffset(autoHost)
  } else if (!wantAuto && autoHost) {
    stopAutoTracking?.()
    autoHost.remove()
    autoHost = null
  }
  listeners.forEach((l) => l())
}

/**
 * Writes the height the stack covers (from the bottom edge to its top item) to <html>, or to the
 * container of a stack that is not fixed to the viewport.
 */
function trackOffset(host: HTMLElement) {
  const root = getComputedStyle(host).position === "fixed" ? document.documentElement : host.parentElement
  if (!root) return () => {}
  const write = () => {
    const covered = host.childElementCount ? host.getBoundingClientRect().height - parseFloat(getComputedStyle(host).paddingTop) : 0
    if (covered > 0) root.style.setProperty(BOTTOM_OVERLAY_OFFSET, `${Math.round(covered)}px`)
    else root.style.removeProperty(BOTTOM_OVERLAY_OFFSET)
  }
  write()
  const resize = new ResizeObserver(write)
  resize.observe(host)
  // Items coming and going change the child count before any size change is reported.
  const mutations = new MutationObserver(write)
  mutations.observe(host, { childList: true })
  return () => {
    resize.disconnect()
    mutations.disconnect()
    root.style.removeProperty(BOTTOM_OVERLAY_OFFSET)
  }
}

// The enclosing <BottomStack>'s element: undefined outside one, null until it has mounted.
const BottomStackContext = React.createContext<HTMLElement | null | undefined>(undefined)

/** The column, placed by you. Optional: items create one on <body> when none is mounted. */
function BottomStack({ className, children, ...props }: React.ComponentProps<"div">) {
  const [host, setHost] = React.useState<HTMLDivElement | null>(null)

  React.useLayoutEffect(() => {
    if (!host) return
    const global = getComputedStyle(host).position === "fixed"
    if (global) {
      placedHosts.push(host)
      sync()
    }
    const stop = trackOffset(host)
    return () => {
      stop()
      if (global) {
        placedHosts.splice(placedHosts.indexOf(host), 1)
        sync()
      }
    }
  }, [host])

  return (
    <div ref={setHost} data-slot="bottom-stack" className={cn(bottomStackClass, className)} {...props}>
      <BottomStackContext.Provider value={host}>{children}</BottomStackContext.Provider>
    </div>
  )
}

type BottomStackItemProps = React.ComponentProps<"div"> & {
  /** Position in the stack; higher sits closer to the bottom edge. */
  order?: number
}

/** Puts its children in the bottom stack. Renders nothing on the server. */
function BottomStackItem({ order = 0, className, style, ...props }: BottomStackItemProps) {
  const scoped = React.useContext(BottomStackContext)
  const inside = scoped !== undefined
  const shared = React.useSyncExternalStore(subscribe, getHost, () => null)
  const host = inside ? scoped : shared

  // Only items outside a <BottomStack> need the shared column.
  React.useEffect(() => {
    if (inside) return
    itemCount++
    sync()
    return () => {
      itemCount--
      sync()
    }
  }, [inside])

  if (!host) return null
  return createPortal(
    <div data-slot="bottom-stack-item" style={{ order, ...style }} className={cn("flex max-w-full justify-center", className)} {...props} />,
    host
  )
}

export { BottomStack, BottomStackItem, BOTTOM_OVERLAY_OFFSET, type BottomStackItemProps }
