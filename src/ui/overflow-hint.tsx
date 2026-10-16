"use client"

import * as React from "react"
import { useDirection } from "@base-ui/react/direction-provider"
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"

import { cn } from "@/lib/utils"

type OverflowHintContextValue = {
  triggerRef: React.RefObject<HTMLElement | null>
  triggerId: string
  /** Set while the pointer pressed the trigger, until it leaves (a click or drag never reopens it). */
  suppressRef: React.RefObject<boolean>
  setOpen: (open: boolean) => void
}

const OverflowHintContext = React.createContext<OverflowHintContextValue | null>(null)

function useOverflowHint() {
  const ctx = React.useContext(OverflowHintContext)
  if (!ctx) throw new Error("OverflowHint parts must be used inside <OverflowHint>")
  return ctx
}

/** True when the element's text is cut off (single-line ellipsis or a line clamp). */
function isTruncated(el: HTMLElement | null) {
  if (!el) return false
  return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
}

type OverflowHintProps = Omit<PreviewCardPrimitive.Root.Props, "triggerId" | "defaultTriggerId" | "handle">

/**
 * Shows the full text of a truncated label on hover. Opens only while the
 * trigger is actually cut off; the pointer can move into the popup to select
 * and copy the text.
 */
function OverflowHint({ open: openProp, defaultOpen = false, onOpenChange, children, ...props }: OverflowHintProps) {
  const [openState, setOpenState] = React.useState(defaultOpen)
  const open = openProp ?? openState
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const suppressRef = React.useRef(false)
  const triggerId = React.useId()

  const handleOpenChange = React.useCallback<NonNullable<PreviewCardPrimitive.Root.Props["onOpenChange"]>>(
    (next, details) => {
      if (next && (suppressRef.current || !isTruncated(triggerRef.current))) return
      setOpenState(next)
      onOpenChange?.(next, details)
    },
    [onOpenChange]
  )
  const setOpen = React.useCallback((next: boolean) => setOpenState(next), [])
  const ctx = React.useMemo(() => ({ triggerRef, triggerId, suppressRef, setOpen }), [triggerId, setOpen])

  return (
    <OverflowHintContext.Provider value={ctx}>
      <PreviewCardPrimitive.Root open={open} onOpenChange={handleOpenChange} triggerId={triggerId} {...props}>
        {children}
      </PreviewCardPrimitive.Root>
    </OverflowHintContext.Provider>
  )
}

type OverflowHintTriggerProps = Omit<PreviewCardPrimitive.Trigger.Props, "className"> & {
  /** Lines before the text is cut off. */
  lines?: 1 | 2 | 3
  className?: string
}

/**
 * The text that truncates (ellipsis after `lines`); its own box is what gets
 * measured. Renders a `span`.
 */
function OverflowHintTrigger({
  lines = 1,
  className,
  delay = 300,
  closeDelay = 150,
  render = <span />,
  ref,
  onPointerDown,
  onPointerLeave,
  ...props
}: OverflowHintTriggerProps) {
  const ctx = useOverflowHint()
  const setRef = React.useCallback(
    (el: HTMLAnchorElement | null) => {
      ctx.triggerRef.current = el
      if (typeof ref === "function") ref(el)
      else if (ref) ref.current = el
    },
    [ctx.triggerRef, ref]
  )
  return (
    <PreviewCardPrimitive.Trigger
      data-slot="overflow-hint-trigger"
      data-lines={lines}
      id={ctx.triggerId}
      className={cn(
        "block min-w-0 truncate data-[lines=2]:line-clamp-2 data-[lines=2]:whitespace-normal data-[lines=3]:line-clamp-3 data-[lines=3]:whitespace-normal",
        className
      )}
      ref={setRef}
      delay={delay}
      closeDelay={closeDelay}
      render={render}
      onPointerDown={(e) => {
        // A press means select or drag: close and stay closed until the pointer leaves.
        ctx.suppressRef.current = true
        ctx.setOpen(false)
        onPointerDown?.(e)
      }}
      onPointerLeave={(e) => {
        ctx.suppressRef.current = false
        onPointerLeave?.(e)
      }}
      {...props}
    />
  )
}

type OverflowHintContentProps = PreviewCardPrimitive.Popup.Props &
  Pick<PreviewCardPrimitive.Positioner.Props, "side" | "sideOffset" | "align" | "alignOffset" | "collisionPadding">

/** Portal, positioner and popup in one. Wraps long text and scrolls past its max height. */
function OverflowHintContent({
  className,
  side = "top",
  sideOffset = 6,
  align = "center",
  alignOffset = 0,
  collisionPadding = 8,
  onPointerDown,
  onClick,
  onAuxClick,
  ...props
}: OverflowHintContentProps) {
  // Portaled popups leave the DOM subtree that sets `dir`; carry the provider direction over.
  const dir = useDirection() === "rtl" ? "rtl" : undefined
  return (
    <PreviewCardPrimitive.Portal dir={dir}>
      <PreviewCardPrimitive.Positioner
        className="z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
      >
        <PreviewCardPrimitive.Popup
          data-slot="overflow-hint-content"
          className={cn(
            "max-h-48 w-max max-w-[min(20rem,calc(100vw-1rem))] origin-(--transform-origin) cursor-text overflow-y-auto overscroll-contain rounded-lg bg-popover px-2 py-1 text-ui-sm leading-snug wrap-break-word whitespace-pre-line text-popover-foreground shadow-surface outline-none select-text",
            "transition-[opacity,scale,translate] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "data-starting-style:scale-98 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0",
            "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1",
            "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-0 motion-reduce:data-ending-style:scale-100",
            className
          )}
          {...props}
          // The popup is portaled, but its events still bubble through the React tree: keep
          // a press or click in it (selecting text) from reaching the trigger's row or tab.
          onPointerDown={(e) => {
            e.stopPropagation()
            onPointerDown?.(e)
          }}
          onClick={(e) => {
            e.stopPropagation()
            onClick?.(e)
          }}
          onAuxClick={(e) => {
            e.stopPropagation()
            onAuxClick?.(e)
          }}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  )
}

type OverflowHintTextProps = Omit<OverflowHintTriggerProps, "children"> &
  Pick<OverflowHintContentProps, "side" | "sideOffset" | "align" | "alignOffset"> & {
    children: React.ReactNode
    /** Popup content. Defaults to `children`. */
    hint?: React.ReactNode
  }

/** A truncating span with its hint. Use the parts to style the hint or show other content. */
function OverflowHintText({
  children,
  hint,
  side,
  sideOffset,
  align,
  alignOffset,
  ...props
}: OverflowHintTextProps) {
  return (
    <OverflowHint>
      <OverflowHintTrigger {...props}>{children}</OverflowHintTrigger>
      <OverflowHintContent side={side} sideOffset={sideOffset} align={align} alignOffset={alignOffset}>
        {hint ?? children}
      </OverflowHintContent>
    </OverflowHint>
  )
}

export {
  OverflowHint,
  OverflowHintTrigger,
  OverflowHintContent,
  OverflowHintText,
  type OverflowHintProps,
  type OverflowHintTriggerProps,
  type OverflowHintContentProps,
  type OverflowHintTextProps,
}
