"use client";

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { cva, type VariantProps } from "class-variance-authority"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import { ChevronRightIcon, SearchIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Kbd } from "@/ui/kbd"
import { useLocale } from "@/ui/locale-provider"

/*
 * Compact text navigation for docs and settings sidebars: a search field, collapsible sections,
 * folder-like groups and page rows. The current row is a fill plus a 2px bar in the gutter.
 *
 * Groups (`level="group"`) read as folders: a leading chevron, foreground label, and their rows
 * indented behind a guide line that runs down from the chevron, so it is clear which pages belong
 * to which group. Pages read as files: muted rows with no chevron.
 *
 * Icons: when a list (or a section's rows) holds a row or group label with an `icon`, the rows
 * and labels beside it that have none move in by the icon's width, so every text starts on one
 * edge. That happens on its own; set `--sidebar-nav-inset` on a wrapper to force or cancel it.
 *
 *   <SidebarNav>
 *     <SidebarNavSearch shortcut="⌘K" onClick={openSearch} />
 *     <SidebarNavContent aria-label="Docs">
 *       <SidebarNavSection label="Guides" count={3}>
 *         <SidebarNavList>
 *           <SidebarNavLink href="/docs" active>Introduction</SidebarNavLink>
 *         </SidebarNavList>
 *         <SidebarNavSection level="group" label="Forms" href="/docs/forms">…</SidebarNavSection>
 *       </SidebarNavSection>
 *     </SidebarNavContent>
 *     <SidebarNavFooter>…</SidebarNavFooter>
 *   </SidebarNav>
 */

/*
 * The icon-aligned inset. A container whose direct rows or group labels carry an icon sets
 * `--sidebar-nav-inset` to the icon slot plus its gap (16px + 8px); rows and labels without an
 * icon add it to their start padding. Nested groups inherit it, so their rows line up too.
 */
const iconInsetScope =
  "[&:has(>[data-slot=sidebar-nav-list]>[data-slot=sidebar-nav-item]>*>[data-slot=sidebar-nav-link-icon])]:[--sidebar-nav-inset:1.5rem] [&:has(>[data-slot=sidebar-nav-section]>[data-slot=sidebar-nav-section-label]_[data-slot=sidebar-nav-section-icon])]:[--sidebar-nav-inset:1.5rem]"
const insetStart = "ps-[calc(0.5rem+var(--sidebar-nav-inset,0px))] pe-2"
// A trailing badge sits 6px inside its row: concentric with it at large radii, its own token below that.
// A style that sets --control-radius-sm (pill badges) keeps its value.
const badgeRadius =
  "[&>[data-slot=badge]]:rounded-[var(--control-radius-sm,min(var(--radius-control-sm),max(calc(var(--radius-md)-0.375rem),0.25rem)))]"

/** A trailing badge pushed to the row's end edge. */
function trailingBadge(badge: React.ReactNode) {
  if (badge === undefined || badge === null || badge === false) return null
  return (
    <>
      <span aria-hidden className="ms-auto" />
      {badge}
    </>
  )
}

const sidebarNavVariants = cva("group/sidebar-nav flex min-h-0 flex-1 flex-col", {
  variants: { variant: { default: "", fill: "bg-shell" } },
  defaultVariants: { variant: "default" },
})

type SidebarNavProps = React.ComponentProps<"div"> &
  VariantProps<typeof sidebarNavVariants> & {
    /**
     * How the current row shows. `bar` (default): a fill plus a 2px bar in the gutter.
     * `fill`: a stronger fill only, with 32px rows, for a calm docs sidebar on a `fill` band.
     */
    indicator?: "bar" | "fill"
  }

function SidebarNav({ className, variant, indicator = "bar", ...props }: SidebarNavProps) {
  return (
    <div
      data-slot="sidebar-nav"
      data-variant={variant ?? "default"}
      data-indicator={indicator}
      className={cn(sidebarNavVariants({ variant }), className)}
      {...props}
    />
  )
}

/** A field-shaped button that opens your search (a command palette). Its text defaults to the locale's "Search". */
function SidebarNavSearch({
  shortcut,
  children,
  className,
  ...props
}: React.ComponentProps<"button"> & { shortcut?: React.ReactNode }) {
  const { labels } = useLocale()
  return (
    <div data-slot="sidebar-nav-search" className="shrink-0 px-3 pt-3 pb-2">
      <button
        type="button"
        // the key cap sits 8px into the field: concentric with it at large radii
        className={cn(
          "flex h-8 w-full cursor-pointer items-center gap-2 frame-lg frame-inset-2 bg-background px-2.5 text-ui text-muted-foreground shadow-well outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/32 [&>[data-slot=kbd]]:rounded-inner-or-2xs",
          className
        )}
        {...props}
      >
        <SearchIcon className="size-3.5 shrink-0" />
        <span className="flex-1 text-start">{children ?? labels.searchPlaceholder}</span>
        {shortcut && <Kbd size="sm">{shortcut}</Kbd>}
      </button>
    </div>
  )
}

/**
 * The scrolling list of sections. On mount it scrolls the current row (`aria-current="page"`)
 * into view when it would start below the fold.
 */
function SidebarNavContent({ className, children, ...props }: React.ComponentProps<"nav">) {
  const ref = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    const box = ref.current
    const el = box?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!box || !el) return
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    if (top > box.clientHeight - 80) box.scrollTop = Math.max(0, top - box.clientHeight / 2 + el.offsetHeight / 2)
  }, [])
  return (
    <nav
      ref={ref}
      data-slot="sidebar-nav-content"
      className={cn("scrollbar-hover scroll-fade-y min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4", className)}
      {...props}
    >
      <div className={cn("flex flex-col gap-4", iconInsetScope)}>{children}</div>
    </nav>
  )
}

type SidebarNavSectionProps = Omit<CollapsiblePrimitive.Root.Props, "children"> & {
  label: React.ReactNode
  /** Muted count after the label. */
  count?: number
  /** Trailing content on the label row, such as a "New" badge. */
  badge?: React.ReactNode
  /**
   * `section`: a top-level heading; `group`: a folder-like heading inside a section;
   * `label`: a small muted caption over flat rows (never folds).
   */
  level?: "section" | "group" | "label"
  /** A section with no toggle (always open). */
  collapsible?: boolean
  /** Makes the label a link to the section's own page; the chevron still folds it. */
  href?: string
  /** Renders the label link with your router's link, such as `<Link href="…" />`. Implies a link label. */
  labelRender?: useRender.ComponentProps<"a">["render"]
  /** The label's page is current: the label row gets the active fill and `aria-current="page"`. */
  active?: boolean
  /** Leading 16px icon, muted until the label is hovered or current (same slot as `SidebarNavLink`). */
  icon?: React.ReactNode
  /** Name of the fold toggle on a link label. Defaults to the locale's "Toggle {label}" ("Toggle section" for a non-text label). */
  toggleLabel?: string
  children?: React.ReactNode
}

/** A labelled, collapsible block of rows. Open by default; control it with `open` / `onOpenChange` to persist it. */
function SidebarNavSection(props: SidebarNavSectionProps) {
  if (props.level !== "label") return <SidebarNavFoldSection {...props} />
  const { label, count, badge, className, children } = props
  return (
    // between rows a caption opens a new group, so it takes 8px more above it (none between sections)
    <div
      data-slot="sidebar-nav-section"
      data-level="label"
      className={cn("flex flex-col gap-px not-first:mt-[var(--sidebar-nav-caption-space,0px)]", className)}
    >
      <div
        data-slot="sidebar-nav-section-label"
        className={cn("flex h-7 items-center gap-1.5 text-ui-sm font-medium text-muted-foreground", insetStart, badgeRadius)}
      >
        <span className="truncate">{label}</span>
        {count !== undefined && <span className="text-ui-xs font-normal text-muted-foreground/80 tabular-nums">{count}</span>}
        {trailingBadge(badge)}
      </div>
      <div className={cn("flex flex-col gap-px [--sidebar-nav-caption-space:0.5rem]", iconInsetScope)}>{children}</div>
    </div>
  )
}

function SidebarNavFoldSection({
  label,
  count,
  badge,
  level = "section",
  collapsible = true,
  defaultOpen = true,
  href,
  labelRender,
  active = false,
  icon,
  toggleLabel,
  className,
  children,
  ...props
}: SidebarNavSectionProps) {
  const { labels } = useLocale()
  const isLink = href !== undefined || labelRender !== undefined
  const isGroup = level === "group"
  const labelClass = cn(
    isGroup ? "h-7 text-ui font-medium text-foreground" : "h-7 text-ui font-semibold text-foreground icon-bold",
    badgeRadius
  )
  const badgeEl = trailingBadge(badge)
  // a group starts with its chevron slot (16px), so the label sits where an icon row's text does
  const pad = isGroup ? "gap-1.5 ps-2 pe-2" : icon ? "gap-2 px-2" : cn("gap-1.5", insetStart)
  const iconEl = (hover: string) =>
    icon && (
      <span
        aria-hidden
        data-slot="sidebar-nav-section-icon"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 [&>svg]:size-4",
          hover
        )}
      >
        {icon}
      </span>
    )
  const countEl = count !== undefined && <span className="text-ui-xs font-normal text-muted-foreground/80 tabular-nums">{count}</span>
  const chevron = (
    <ChevronRightIcon
      aria-hidden
      className={cn(
        "shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-panel-open/trigger:rotate-90 motion-reduce:transition-none rtl:-scale-x-100 rtl:group-data-panel-open/trigger:-rotate-90",
        "size-3.5"
      )}
    />
  )
  /** The group's leading 16px slot: the chevron (or nothing for a group that cannot fold). */
  const chevronSlot = (inner: React.ReactNode) => (
    <span aria-hidden data-slot="sidebar-nav-section-chevron" className="flex size-4 shrink-0 items-center justify-center">
      {inner}
    </span>
  )
  const labelLink = useRender({
    defaultTagName: "a",
    render: labelRender,
    props: {
      href,
      "aria-current": active ? "page" : undefined,
      "data-slot": "sidebar-nav-section-link",
      className: cn(
        "group/nav relative flex min-w-0 flex-1 items-center rounded-md outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        "aria-[current=page]:bg-secondary aria-[current=page]:text-foreground",
        pad,
        // the fold toggle sits over the chevron slot at the start
        isGroup && collapsible && "ps-[calc(0.5rem+1rem+0.375rem)]",
        labelClass
      ),
      children: (
        <>
          <span
            aria-hidden
            className="absolute inset-y-1.5 start-[var(--sidebar-nav-bar,-0.5rem)] w-0.5 rounded-full bg-transparent group-aria-[current=page]/nav:bg-foreground"
          />
          {isGroup && !collapsible && chevronSlot(null)}
          {iconEl("group-hover/nav:text-foreground group-aria-[current=page]/nav:text-foreground")}
          <span className="truncate">{label}</span>
          {countEl}
          {badgeEl}
        </>
      ),
    },
  })
  let heading: React.ReactNode
  const toggleName = toggleLabel ?? (typeof label === "string" ? labels.toggleNamed(label) : labels.toggleSection)
  if (isLink && isGroup) {
    heading = (
      <div data-slot="sidebar-nav-section-label" className="relative flex items-center">
        {labelLink}
        {collapsible && (
          <CollapsiblePrimitive.Trigger
            aria-label={toggleName}
            className="group/trigger absolute start-1 top-0 z-10 grid h-7 w-6 cursor-pointer place-items-center rounded-md outline-none hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {chevron}
          </CollapsiblePrimitive.Trigger>
        )}
      </div>
    )
  } else if (isLink) {
    heading = (
      <div data-slot="sidebar-nav-section-label" className="flex items-center gap-px">
        {labelLink}
        {collapsible && (
          <CollapsiblePrimitive.Trigger
            aria-label={toggleName}
            className="group/trigger grid h-7 w-6 shrink-0 cursor-pointer place-items-center rounded-md outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {chevron}
          </CollapsiblePrimitive.Trigger>
        )}
      </div>
    )
  } else if (collapsible) {
    heading = (
      <CollapsiblePrimitive.Trigger
        className={cn(
          "group/trigger flex w-full cursor-pointer items-center rounded-md text-start outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          pad,
          labelClass
        )}
      >
        {isGroup && chevronSlot(chevron)}
        {iconEl("group-hover/trigger:text-foreground")}
        <span className="truncate">{label}</span>
        {countEl}
        {badgeEl}
        {!isGroup && <span className={cn("flex", !badgeEl && "ms-auto")}>{chevron}</span>}
      </CollapsiblePrimitive.Trigger>
    )
  } else {
    heading = (
      <div className={cn("flex items-center", pad, labelClass)}>
        {isGroup && chevronSlot(null)}
        {iconEl("")}
        <span className="truncate">{label}</span>
        {countEl}
        {badgeEl}
      </div>
    )
  }
  return (
    <CollapsiblePrimitive.Root
      data-slot="sidebar-nav-section"
      data-level={level}
      data-active={active ? "" : undefined}
      defaultOpen={collapsible ? defaultOpen : true}
      className={cn("flex flex-col gap-px", className)}
      {...props}
    >
      {heading}
      <CollapsiblePrimitive.Panel
        data-slot="sidebar-nav-section-panel"
        className={cn(
          // height folds; the panel reaches into the gutter so the current-row bar is not clipped
          "h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none",
          isGroup
            ? cn(
                "relative ms-4 ps-1.5 [--sidebar-nav-bar:-0.375rem]",
                // rows start where the group's own label text does (after its icon, when it has one)
                icon ? "[--sidebar-nav-inset:1.375rem]" : "[--sidebar-nav-inset:0px]"
              )
            : "-ms-2 ps-2"
        )}
      >
        {isGroup && (
          // the guide: runs down from the chevron's centre beside the group's own rows
          <span aria-hidden data-slot="sidebar-nav-guide" className="pointer-events-none absolute inset-y-0.5 start-0 w-px bg-border" />
        )}
        <div className={cn("flex flex-col gap-px [--sidebar-nav-caption-space:0.5rem]", iconInsetScope)}>{children}</div>
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  )
}

/**
 * Rows of a section or group; no indent, so every label and row shares one left edge. When one
 * row has an icon, the rows without one start at its text (see `--sidebar-nav-inset`).
 */
function SidebarNavList({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-nav-list" className={cn("flex flex-col gap-px", iconInsetScope, className)} {...props} />
}

type SidebarNavLinkProps = useRender.ComponentProps<"a"> & {
  /** The current page: a fill, a bar in the gutter and `aria-current="page"`. */
  active?: boolean
  /** Trailing content, such as a "New" badge. */
  badge?: React.ReactNode
  /** Leading 16px icon, muted until the row is current. */
  icon?: React.ReactNode
}

/** One row in a list item. Pass `render={<Link href="…" />}` for a router link. */
function SidebarNavLink({ active = false, badge, icon, className, children, render, ...props }: SidebarNavLinkProps) {
  const link = useRender({
    defaultTagName: "a",
    render,
    props: mergeProps<"a">(
      {
        "aria-current": active ? "page" : undefined,
        className: cn(
          "group/nav relative flex h-7 min-w-0 items-center gap-2 rounded-md text-ui text-muted-foreground outline-none transition-colors duration-150",
          icon ? "px-2" : insetStart,
          "hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          "aria-[current=page]:bg-secondary aria-[current=page]:font-medium aria-[current=page]:text-foreground",
          // fill indicator: taller rows, a stronger fill on the band, no gutter bar
          "group-data-[indicator=fill]/sidebar-nav:h-8 group-data-[indicator=fill]/sidebar-nav:hover:bg-foreground/5 group-data-[indicator=fill]/sidebar-nav:aria-[current=page]:bg-foreground/7",
          badgeRadius,
          className
        ),
        children: (
          <>
            <span
              aria-hidden
              className="absolute inset-y-1.5 start-[var(--sidebar-nav-bar,-0.5rem)] w-0.5 rounded-full bg-transparent group-aria-[current=page]/nav:bg-foreground group-data-[indicator=fill]/sidebar-nav:hidden"
            />
            {icon && (
              <span
                aria-hidden
                data-slot="sidebar-nav-link-icon"
                className="flex size-4 shrink-0 items-center justify-center text-muted-foreground group-hover/nav:text-foreground group-aria-[current=page]/nav:text-foreground [&>svg]:size-4"
              >
                {icon}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{children}</span>
            {badge}
          </>
        ),
      },
      props
    ),
    state: { slot: "sidebar-nav-link", active },
  })
  return <li data-slot="sidebar-nav-item">{link}</li>
}

/** Pinned under the list: a changelog link, a version switcher. */
function SidebarNavFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-nav-footer" className={cn("shrink-0 border-t border-border p-2", className)} {...props} />
}

export { SidebarNav, SidebarNavSearch, SidebarNavContent, SidebarNavSection, SidebarNavList, SidebarNavLink, SidebarNavFooter }
export type { SidebarNavProps, SidebarNavSectionProps, SidebarNavLinkProps }
