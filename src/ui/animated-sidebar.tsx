"use client";

import * as React from "react"
import { useLocale } from "@/ui/locale-provider"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { motion, useReducedMotion, type Variants } from "motion/react"

import { ChevronRightIcon, SidebarIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipKbd, TooltipTrigger } from "@/ui/tooltip"

/*
 * Composable app sidebar.
 *
 *   <SidebarProvider>
 *     <Sidebar>
 *       <SidebarHeader />
 *       <SidebarContent>
 *         <SidebarGroup><SidebarGroupLabel /><SidebarMenu>
 *           <SidebarItem icon label isActive />
 *           <SidebarItem icon label defaultOpen>      ← disclosure
 *             <SidebarSub><SidebarSubItem isActive /></SidebarSub>
 *           </SidebarItem>
 *         </SidebarMenu></SidebarGroup>
 *       </SidebarContent>
 *       <SidebarFooter />
 *     </Sidebar>
 *     <SidebarInset><SidebarTrigger /></SidebarInset>
 *   </SidebarProvider>
 *
 * The active marker is one raised pill (shared layout) that glides between
 * items and into nested sub-items; when a submenu folds, or the whole sidebar
 * folds into its icon rail, the pill morphs back onto the parent row. The
 * panel width springs between full and rail width, labels fade, and rail
 * items get tooltips. ⌘/Ctrl+B toggles the most recently mounted or focused
 * sidebar on the page (one shared listener, not one per instance).
 */

// ζ ≈ 1.09: a slightly overdamped settle with no bounce.
const WIDTH_SPRING = { type: "spring", stiffness: 380, damping: 36, mass: 0.7 } as const
const PILL_SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.7 } as const
const EASE = [0.22, 1, 0.36, 1] as const

/* ───────────────────────── Shortcut registry ───────────────────────── */

// One window listener for every SidebarProvider on the page. Instances stack in
// mount order; focusing or pressing inside one moves it to the top, and only the
// topmost instance with a matching key handles ⌘/Ctrl+key.
type HotkeyEntry = { key: string; run: () => void }
const hotkeyStack: HotkeyEntry[] = []

function onHotkey(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey) || e.defaultPrevented) return
  const key = e.key.toLowerCase()
  for (let i = hotkeyStack.length - 1; i >= 0; i--) {
    if (hotkeyStack[i].key !== key) continue
    e.preventDefault()
    hotkeyStack[i].run()
    return
  }
}

function useSidebarHotkey(key: string | null | undefined, run: () => void) {
  const runRef = React.useRef(run)
  React.useLayoutEffect(() => {
    runRef.current = run
  })
  const entryRef = React.useRef<HotkeyEntry | null>(null)

  React.useEffect(() => {
    if (!key) return
    const entry: HotkeyEntry = { key: key.toLowerCase(), run: () => runRef.current() }
    entryRef.current = entry
    hotkeyStack.push(entry)
    if (hotkeyStack.length === 1) window.addEventListener("keydown", onHotkey)
    return () => {
      const at = hotkeyStack.indexOf(entry)
      if (at >= 0) hotkeyStack.splice(at, 1)
      if (hotkeyStack.length === 0) window.removeEventListener("keydown", onHotkey)
      if (entryRef.current === entry) entryRef.current = null
    }
  }, [key])

  // Make this instance the one the shortcut drives.
  return React.useCallback(() => {
    const entry = entryRef.current
    const at = entry ? hotkeyStack.indexOf(entry) : -1
    if (entry && at >= 0 && at !== hotkeyStack.length - 1) {
      hotkeyStack.splice(at, 1)
      hotkeyStack.push(entry)
    }
  }, [])
}

/* ───────────────────────── Provider ───────────────────────── */

type SidebarContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  state: "expanded" | "collapsed"
  reduce: boolean
  pillId: string
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within <SidebarProvider>")
  return ctx
}

type SidebarProviderProps = React.ComponentProps<"div"> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Key that toggles with ⌘/Ctrl. With several sidebars on a page only the most
   * recently mounted, focused or clicked one responds. `null` disables it.
   */
  shortcut?: string | null
}

function SidebarProvider({
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  shortcut = "b",
  className,
  style,
  onFocusCapture,
  onPointerDownCapture,
  ...props
}: SidebarProviderProps) {
  const [internal, setInternal] = React.useState(defaultOpen)
  const open = openProp ?? internal
  const reduce = useReducedMotion() ?? false
  const pillId = `sidebar-pill-${React.useId()}`

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternal(next)
      onOpenChange?.(next)
    },
    [onOpenChange, openProp]
  )
  const toggle = React.useCallback(() => setOpen(!open), [open, setOpen])

  const claimShortcut = useSidebarHotkey(shortcut, toggle)

  const ctx = React.useMemo<SidebarContextValue>(
    () => ({ open, setOpen, toggle, state: open ? "expanded" : "collapsed", reduce, pillId }),
    [open, setOpen, toggle, reduce, pillId]
  )

  return (
    <SidebarContext.Provider value={ctx}>
      <div
        data-slot="sidebar-wrapper"
        data-state={ctx.state}
        style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "3.75rem", "--sidebar-rail-width": "3rem", ...style } as React.CSSProperties}
        className={cn("group/sidebar-wrapper flex w-full min-w-0", className)}
        onFocusCapture={(e) => {
          claimShortcut()
          onFocusCapture?.(e)
        }}
        onPointerDownCapture={(e) => {
          claimShortcut()
          onPointerDownCapture?.(e)
        }}
        {...props}
      />
    </SidebarContext.Provider>
  )
}

/* ───────────────────────── Rail (three-column layout) ───────────────────────── */

type RailOrientation = "vertical" | "horizontal"
type RailSide = "right" | "left" | "top" | "bottom"

type SidebarRailProps = React.ComponentProps<"nav"> & {
  /** `vertical`: a 48px column (desktop). `horizontal`: a 48px row, e.g. at the bottom of a mobile drawer. */
  orientation?: RailOrientation
  /** Which side the tooltips open on. Defaults to `right` (vertical) or `top` (horizontal). */
  tooltipSide?: RailSide
}

const RailContext = React.createContext<{ side: RailSide; orientation: RailOrientation }>({ side: "right", orientation: "vertical" })

/**
 * Narrow app rail: a column (or, with `orientation="horizontal"`, a row) of
 * 32px icon buttons with tooltips. Put `SidebarRailSpacer` between the leading
 * and trailing groups. Icons follow the nav rules: outline glyphs, 16px, muted;
 * the active item is a row fill and foreground, so it keeps the outline glyph. A horizontal rail scrolls sideways when it runs out of room.
 */
function SidebarRail({ orientation = "vertical", tooltipSide, className, ...props }: SidebarRailProps) {
  const side = tooltipSide ?? (orientation === "horizontal" ? "top" : "right")
  const ctx = React.useMemo(() => ({ side, orientation }), [side, orientation])
  return (
    <RailContext.Provider value={ctx}>
      <nav
        data-slot="sidebar-rail"
        data-orientation={orientation}
        className={cn(
          "flex shrink-0 items-center gap-1",
          orientation === "horizontal"
            ? "h-12 w-full min-w-0 flex-row overflow-x-auto overscroll-x-contain px-2 scrollbar-none"
            : "h-full w-12 flex-col py-2",
          className
        )}
        {...props}
      />
    </RailContext.Provider>
  )
}

type SidebarRailItemProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** Accessible name, also shown in the tooltip. */
  label: string
  icon: React.ReactNode
  /** Keyboard shortcut shown in the tooltip, e.g. `⌘1`. */
  shortcut?: string
  active?: boolean
  /** A count badge (number) or an attention dot (`true`). */
  badge?: number | boolean
  /** Render as another element (a link), keeping the rail styles. */
  render?: React.ReactElement<Record<string, unknown>>
}

function SidebarRailItem({ label, icon, shortcut, active = false, badge, render, className, ...props }: SidebarRailItemProps) {
  const { labels } = useLocale()
  const { side } = React.useContext(RailContext)
  const classes = cn(
    "relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-inner text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-active:bg-foreground/6 data-active:text-foreground [&_svg]:size-4.5 [&_svg]:shrink-0",
    className
  )
  const content = (
    <>
      {icon}
      {badge !== undefined && badge !== false && (
        <span
          data-slot="sidebar-rail-badge"
          className={cn(
            "absolute top-0.5 right-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-shell",
            badge === true ? "size-2" : "h-3.5 min-w-3.5 px-1 text-ui-2xs font-semibold tabular-nums"
          )}
        >
          {badge === true ? <span className="sr-only">{labels.newActivity}</span> : badge > 99 ? "99+" : badge}
        </span>
      )}
    </>
  )
  const element = render ? (
    React.cloneElement(render, {
      "data-slot": "sidebar-rail-item",
      "data-active": active || undefined,
      "aria-current": active ? "page" : undefined,
      "aria-label": label,
      className: cn(classes, render.props.className as string | undefined),
      children: content,
    })
  ) : (
    <button
      type="button"
      data-slot="sidebar-rail-item"
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      className={classes}
      {...props}
      aria-label={props["aria-label"] ?? label}
    >
      {content}
    </button>
  )
  return (
    <Tooltip>
      <TooltipTrigger render={element} />
      <TooltipContent side={side} sideOffset={6}>
        {label}
        {shortcut && <TooltipKbd>{shortcut}</TooltipKbd>}
      </TooltipContent>
    </Tooltip>
  )
}

type SidebarRailAvatarProps = Omit<React.ComponentProps<"button">, "children"> & {
  label: string
  /** Avatar content: a provider glyph, initials or an <img>. */
  children: React.ReactNode
  /** Status ring: connected, working, failed. */
  status?: "online" | "busy" | "error" | "offline"
  /** Extra tooltip text after the label. */
  hint?: string
}

/** Round avatar button for the bottom of the rail (accounts, agent providers) with a status ring. */
function SidebarRailAvatar({ label, status = "offline", hint, className, children, ...props }: SidebarRailAvatarProps) {
  const { side } = React.useContext(RailContext)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-slot="sidebar-rail-avatar"
            data-status={status}
            className={cn(
              "flex size-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-card shadow-raised outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-ring data-[status=busy]:ring-2 data-[status=busy]:ring-warning/70 data-[status=error]:ring-2 data-[status=error]:ring-destructive/60 data-[status=online]:ring-2 data-[status=online]:ring-success/70 [&_svg]:size-3.5",
              className
            )}
            {...props}
            aria-label={props["aria-label"] ?? (hint ? `${label}, ${hint}` : label)}
          >
            {children}
          </button>
        }
      />
      <TooltipContent side={side} sideOffset={6}>
        {label}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

function SidebarRailGroup({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation } = React.useContext(RailContext)
  return (
    <div
      data-slot="sidebar-rail-group"
      role="group"
      className={cn("flex shrink-0 items-center gap-1", orientation === "horizontal" ? "flex-row" : "flex-col", className)}
      {...props}
    />
  )
}

function SidebarRailSeparator({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation } = React.useContext(RailContext)
  return (
    <div
      data-slot="sidebar-rail-separator"
      role="separator"
      aria-orientation={orientation === "horizontal" ? "vertical" : "horizontal"}
      className={cn("shrink-0 bg-border", orientation === "horizontal" ? "mx-1 h-5 w-px" : "my-1 h-px w-5", className)}
      {...props}
    />
  )
}

/** Pushes the following items to the bottom of the rail. */
function SidebarRailSpacer({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-rail-spacer" aria-hidden className={cn("min-w-2 flex-1", className)} {...props} />
}


/* ───────────────────────── Panel ───────────────────────── */

const PanelContext = React.createContext<{ collapsed: boolean; side: "left" | "right" }>({
  collapsed: false,
  side: "left",
})

type SidebarProps = Omit<React.ComponentProps<typeof motion.aside>, "children"> & {
  children?: React.ReactNode
  side?: "left" | "right"
  /** `floating`: raised rounded card; `sidebar`: flush with a hairline edge. */
  variant?: "floating" | "sidebar"
  /** `icon` folds into an icon rail; `none` never collapses. */
  collapsible?: "icon" | "none"
  panelClassName?: string
  /**
   * Three-column layout: an always-visible `<SidebarRail>` for app sections beside this sidebar's own
   * content (the second level), then the main area. Collapsing hides the second level and keeps the rail.
   */
  rail?: React.ReactNode
}

function Sidebar({
  side = "left",
  variant = "floating",
  collapsible = "icon",
  className,
  panelClassName,
  rail,
  children,
  "aria-label": ariaLabel,
  ...props
}: SidebarProps) {
  const l10n = useLocale().labels
  if (ariaLabel === undefined) ariaLabel = l10n.sidebar

  const { open, reduce } = useSidebar()
  const collapsed = collapsible === "icon" && !open
  const hasRail = rail != null
  const width = hasRail
    ? collapsed
      ? "var(--sidebar-rail-width)"
      : "calc(var(--sidebar-rail-width) + var(--sidebar-width))"
    : collapsed
      ? "var(--sidebar-width-icon)"
      : "var(--sidebar-width)"
  return (
    <motion.aside
      data-slot="sidebar"
      data-state={collapsed ? "collapsed" : "expanded"}
      data-variant={variant}
      data-side={side}
      data-rail={hasRail || undefined}
      aria-label={ariaLabel}
      initial={false}
      animate={{ width }}
      transition={reduce ? { duration: 0 } : WIDTH_SPRING}
      className={cn("group/sidebar peer relative shrink-0 self-stretch", side === "right" && "order-last", className)}
      {...props}
    >
      <div
        data-slot="sidebar-panel"
        className={cn(
          "flex h-full w-full overflow-hidden text-foreground",
          hasRail ? (side === "right" ? "flex-row-reverse" : "flex-row") : "flex-col",
          // Rows sit 8px in from the panel edge: the floating card is their frame; a flush panel has square
          // corners, so its rows keep rounded-lg unless a rounded host (the app-shell window) sets --sidebar-item-radius.
          variant === "floating"
            ? "frame-3xl frame-inset-2 bg-card shadow-well"
            : cn(
                "bg-shell [--frame-inner-1:var(--sidebar-item-radius,var(--radius-lg))] [--frame-inner-2:initial]",
                side === "left" ? "border-e border-border" : "border-s border-border"
              ),
          panelClassName
        )}
      >
        {hasRail ? (
          <>
            <div data-slot="sidebar-rail-column" className="flex h-full w-(--sidebar-rail-width) shrink-0 flex-col">
              {rail}
            </div>
            <div
              data-slot="sidebar-secondary"
              inert={collapsed || undefined}
              className={cn(
                "flex h-full w-(--sidebar-width) shrink-0 flex-col transition-opacity duration-200",
                side === "left" ? "border-s border-border/70" : "border-e border-border/70",
                collapsed && "opacity-0"
              )}
            >
              <PanelContext.Provider value={{ collapsed: false, side }}>{children}</PanelContext.Provider>
            </div>
          </>
        ) : (
          <PanelContext.Provider value={{ collapsed, side }}>{children}</PanelContext.Provider>
        )}
      </div>
    </motion.aside>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("flex shrink-0 flex-col gap-2 p-2", className)} {...props} />
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-1", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("flex shrink-0 flex-col gap-1 border-t border-border/70 p-2", className)}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group" role="group" className={cn("flex min-w-0 flex-col py-1", className)} {...props} />
}

/** Small caps heading; folds into a short rule in the icon rail. */
function SidebarGroupLabel({ className, children, ...props }: React.ComponentProps<"div">) {
  const { collapsed } = React.useContext(PanelContext)
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn("relative flex h-7 items-center px-3 text-ui-sm text-muted-foreground", className)}
      {...props}
    >
      <span
        className={cn(
          "truncate whitespace-nowrap transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed && "-translate-x-1 opacity-0 rtl:translate-x-1"
        )}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-1/2 h-px w-4 -translate-x-1/2 rounded-full bg-border transition-opacity duration-200",
          collapsed ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("flex min-w-0 list-none flex-col gap-0.5", className)} {...props} />
}

/* ───────────────────────── Items ───────────────────────── */

type ItemContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  subId: string
  reportActive: (id: string, active: boolean) => void
}
const ItemContext = React.createContext<ItemContextValue | null>(null)

function ActivePill({ reduce, pillId }: { reduce: boolean; pillId: string }) {
  return (
    <motion.span
      aria-hidden
      layoutId={pillId}
      transition={reduce ? { duration: 0 } : PILL_SPRING}
      className="absolute inset-0 rounded-[inherit] bg-foreground/6"
    />
  )
}

function Label({ collapsed, reduce, children }: { collapsed: boolean; reduce: boolean; children: React.ReactNode }) {
  return (
    <motion.span
      data-slot="sidebar-item-label"
      initial={false}
      animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -4 : 0 }}
      transition={{ duration: reduce ? 0 : collapsed ? 0.12 : 0.2, delay: collapsed || reduce ? 0 : 0.06, ease: EASE }}
      className="relative min-w-0 flex-1 truncate text-start whitespace-nowrap"
    >
      {children}
    </motion.span>
  )
}

type SidebarItemProps = Omit<useRender.ComponentProps<"button">, "children"> & {
  icon?: React.ReactNode
  label: React.ReactNode
  /** Tooltip text in the icon rail (defaults to `label` when it is a string). */
  tooltip?: string
  badge?: React.ReactNode
  isActive?: boolean
  href?: string
  disabled?: boolean
  /** For disclosure items (those with a <SidebarSub> child). */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** A <SidebarSub> makes this item a disclosure. */
  children?: React.ReactNode
  itemClassName?: string
}

function SidebarItem({
  icon,
  label,
  tooltip,
  badge,
  isActive = false,
  href,
  disabled,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
  render,
  className,
  itemClassName,
  onClick,
  ...props
}: SidebarItemProps) {
  const sidebar = useSidebar()
  const { collapsed, side } = React.useContext(PanelContext)
  const isDisclosure = children != null
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const open = openProp ?? internalOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange, openProp]
  )
  const subId = React.useId()
  const [activeKids, setActiveKids] = React.useState<ReadonlySet<string>>(() => new Set())
  const reportActive = React.useCallback((id: string, active: boolean) => {
    setActiveKids((prev) => {
      if (prev.has(id) === active) return prev
      const next = new Set(prev)
      if (active) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  // The pill rides on this row when it is active itself, or when an active
  // sub-item is hidden (submenu folded, or the sidebar is an icon rail).
  const childActive = activeKids.size > 0
  const showPill = isActive || (childActive && (!open || collapsed))
  const tip = tooltip ?? (typeof label === "string" ? label : undefined)

  const element = useRender({
    defaultTagName: "button",
    render: render ?? (href ? <a href={href} /> : undefined),
    props: mergeProps<"button">(
      {
        ...(render || href ? {} : { type: "button" as const, disabled }),
        "aria-current": isActive ? "page" : undefined,
        "aria-expanded": isDisclosure ? open && !collapsed : undefined,
        "aria-controls": isDisclosure ? subId : undefined,
        "aria-disabled": disabled || undefined,
        ...{ "data-active": showPill || undefined },
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          if (disabled) return e.preventDefault()
          if (!isDisclosure) return
          if (collapsed) {
            // a submenu can't live in the rail: unfold the panel that will hold it
            sidebar.setOpen(true)
            setOpen(true)
          } else setOpen(!open)
        },
        className: cn(
          "group/sidebar-item relative flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-inner px-[13px] text-ui outline-none select-none",
          "text-foreground transition-[color,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "focus-visible:ring-2 focus-visible:ring-ring",
          !showPill && "hover:bg-secondary",
          showPill && "text-foreground",
          disabled && "pointer-events-none opacity-45",
          "[&_svg]:shrink-0",
          className
        ),
      },
      { onClick } as React.ComponentProps<"button">,
      props as React.ComponentProps<"button">,
      {
        // after props, so an explicit undefined keeps the rail label
        "aria-label": props["aria-label"] ?? (collapsed && typeof label === "string" ? label : undefined),
        children: (
          <>
            {showPill && <ActivePill reduce={sidebar.reduce} pillId={sidebar.pillId} />}
            {icon && (
              <span aria-hidden className="relative grid size-[18px] shrink-0 place-items-center text-muted-foreground group-data-active/sidebar-item:text-foreground [&_svg]:size-4">
                {icon}
                {childActive && collapsed && !isActive && (
                  <span className="absolute -top-0.5 -end-0.5 size-1.5 rounded-full bg-primary" />
                )}
              </span>
            )}
            <Label collapsed={collapsed} reduce={sidebar.reduce}>
              {label}
            </Label>
            {badge != null && (
              <motion.span
                initial={false}
                animate={{ opacity: collapsed ? 0 : 1 }}
                transition={{ duration: sidebar.reduce ? 0 : 0.15 }}
                className="relative shrink-0 rounded-full px-1.5 text-ui-xs leading-5 text-muted-foreground/70 tabular-nums"
              >
                {badge}
              </motion.span>
            )}
            {isDisclosure && (
              <motion.span
                aria-hidden
                initial={false}
                animate={{ rotate: open && !collapsed ? 90 : 0, opacity: collapsed ? 0 : 1 }}
                transition={sidebar.reduce ? { duration: 0 } : PILL_SPRING}
                className="relative grid size-4 shrink-0 place-items-center text-muted-foreground rtl:-scale-x-100 [&_svg]:size-3.5"
              >
                <ChevronRightIcon />
              </motion.span>
            )}
          </>
        ),
      }
    ),
  })

  const ctx = React.useMemo(() => ({ open, setOpen, subId, reportActive }), [open, setOpen, subId, reportActive])

  return (
    <li data-slot="sidebar-item" className={cn("relative min-w-0", itemClassName)}>
      <Tooltip disabled={!collapsed || !tip}>
        <TooltipTrigger render={element} />
        {tip && <TooltipContent side={side === "left" ? "inline-end" : "inline-start"}>{tip}</TooltipContent>}
      </Tooltip>
      {isDisclosure && <ItemContext.Provider value={ctx}>{children}</ItemContext.Provider>}
    </li>
  )
}

const SUB_VARIANTS: Variants = {
  open: { height: "auto", opacity: 1, transition: { height: WIDTH_SPRING, opacity: { duration: 0.18 }, staggerChildren: 0.035, delayChildren: 0.03 } },
  closed: { height: 0, opacity: 0, transition: { height: { duration: 0.22, ease: EASE }, opacity: { duration: 0.14 }, staggerChildren: 0.02, staggerDirection: -1 } },
}
const SUB_ITEM_VARIANTS: Variants = {
  open: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.2, ease: EASE } },
  closed: { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.12, ease: EASE } },
}

/** Nested list of a disclosure <SidebarItem>; folds away in the icon rail. */
function SidebarSub({ className, children, ...props }: Omit<React.ComponentProps<typeof motion.ul>, "children"> & { children?: React.ReactNode }) {
  const item = React.useContext(ItemContext)
  const { reduce } = useSidebar()
  const { collapsed } = React.useContext(PanelContext)
  if (!item) throw new Error("<SidebarSub> must be a child of <SidebarItem>")
  const shown = item.open && !collapsed
  return (
    <motion.ul
      id={item.subId}
      data-slot="sidebar-sub"
      data-state={shown ? "open" : "closed"}
      // stays mounted so hidden sub-items can still hand the pill to their parent
      inert={!shown}
      aria-hidden={!shown}
      initial={false}
      animate={shown ? "open" : "closed"}
      variants={reduce ? undefined : SUB_VARIANTS}
      style={reduce ? { height: shown ? "auto" : 0, opacity: shown ? 1 : 0 } : undefined}
      // overflow-hidden is needed for the height fold, but it would clip the
      // pill's ring + shadow flush at the row edge. -me-2/pe-2 pushes the clip
      // edge out into SidebarContent's px-2 gutter so rows keep the same right
      // edge as top-level items while their shadow stays fully visible.
      className={cn("relative -me-2 ms-[21px] flex min-w-0 list-none flex-col gap-0.5 overflow-hidden border-s border-border pe-2 ps-2", className)}
      {...props}
    >
      {/* spacer keeps the first row clear of the parent */}
      <li aria-hidden className="h-0.5 shrink-0" />
      {children}
      <li aria-hidden className="h-1 shrink-0" />
    </motion.ul>
  )
}

type SidebarSubItemProps = useRender.ComponentProps<"button"> & {
  isActive?: boolean
  href?: string
  disabled?: boolean
  icon?: React.ReactNode
}

function SidebarSubItem({ isActive = false, href, disabled, icon, render, className, children, ...props }: SidebarSubItemProps) {
  const sidebar = useSidebar()
  const item = React.useContext(ItemContext)
  const { collapsed } = React.useContext(PanelContext)
  const id = React.useId()
  const report = item?.reportActive
  React.useLayoutEffect(() => {
    report?.(id, isActive)
    return () => report?.(id, false)
  }, [report, id, isActive])
  const visible = (item?.open ?? true) && !collapsed

  const element = useRender({
    defaultTagName: "button",
    render: render ?? (href ? <a href={href} /> : undefined),
    props: mergeProps<"button">(
      {
        ...(render || href ? {} : { type: "button" as const, disabled }),
        "aria-current": isActive ? "page" : undefined,
        "aria-disabled": disabled || undefined,
        ...{ "data-active": isActive || undefined },
        onClick: (e: React.MouseEvent) => disabled && e.preventDefault(),
        className: cn(
          "relative flex h-7 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-ui outline-none select-none",
          "text-foreground/85 transition-[color,background-color] duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          isActive ? "text-foreground" : "hover:bg-secondary",
          disabled && "pointer-events-none opacity-45",
          "[&_svg]:size-4 [&_svg]:shrink-0",
          className
        ),
      },
      props as React.ComponentProps<"button">,
      {
        children: (
          <>
            {isActive && visible && <ActivePill reduce={sidebar.reduce} pillId={sidebar.pillId} />}
            {icon && (
              <span aria-hidden className="relative grid shrink-0 place-items-center">
                {icon}
              </span>
            )}
            <span className="relative min-w-0 flex-1 truncate text-start whitespace-nowrap">{children}</span>
          </>
        ),
      }
    ),
  })

  return (
    <motion.li data-slot="sidebar-sub-item" variants={sidebar.reduce ? undefined : SUB_ITEM_VARIANTS} className="relative min-w-0">
      {element}
    </motion.li>
  )
}

/* ───────────────────────── Chrome ───────────────────────── */

function SidebarTrigger({ className, onClick, children, ...props }: React.ComponentProps<"button">) {
  const l10n = useLocale().labels

  const { open, toggle } = useSidebar()
  return (
    <button
      type="button"
      data-slot="sidebar-trigger"
      data-state={open ? "expanded" : "collapsed"}
      aria-expanded={open}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) toggle()
      }}
      className={cn(
        "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4",
        className
      )}
      {...props}
      aria-label={props["aria-label"] ?? (open ? l10n.collapseSidebar : l10n.expandSidebar)}
    >
      {children ?? <SidebarIcon />}
    </button>
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return <main data-slot="sidebar-inset" className={cn("relative flex min-w-0 flex-1 flex-col", className)} {...props} />
}

/** Wrapper for header/footer content that should hide in the icon rail. */
function SidebarHideCollapsed({ className, ...props }: React.ComponentProps<"div">) {
  const { collapsed } = React.useContext(PanelContext)
  return (
    <div
      data-slot="sidebar-hide-collapsed"
      aria-hidden={collapsed || undefined}
      className={cn(
        "min-w-0 transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed && "pointer-events-none -translate-x-1 opacity-0 rtl:translate-x-1",
        className
      )}
      {...props}
    />
  )
}

export {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarItem,
  SidebarSub,
  SidebarSubItem,
  SidebarTrigger,
  SidebarInset,
  SidebarHideCollapsed,
  SidebarRail,
  SidebarRailItem,
  SidebarRailAvatar,
  SidebarRailGroup,
  SidebarRailSeparator,
  SidebarRailSpacer,
  useSidebar,
}
export type { SidebarProps, SidebarProviderProps, SidebarItemProps, SidebarSubItemProps, SidebarRailProps, SidebarRailItemProps, SidebarRailAvatarProps }
export type { RailOrientation as SidebarRailOrientation }
