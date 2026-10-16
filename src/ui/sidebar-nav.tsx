import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import { ChevronRightIcon, SearchIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Kbd } from "@/ui/kbd"

/*
 * Compact text navigation for docs and settings sidebars: a search field, collapsible sections
 * and groups, and rows that all start on one left edge. The current row is a fill plus a 2px bar
 * in the gutter.
 *
 *   <SidebarNav>
 *     <SidebarNavSearch shortcut="⌘K" onClick={openSearch} />
 *     <SidebarNavContent aria-label="Docs">
 *       <SidebarNavSection label="Guides" count={3}>
 *         <SidebarNavList>
 *           <SidebarNavLink href="/docs" active>Introduction</SidebarNavLink>
 *         </SidebarNavList>
 *         <SidebarNavSection level="group" label="Forms">…</SidebarNavSection>
 *       </SidebarNavSection>
 *     </SidebarNavContent>
 *     <SidebarNavFooter>…</SidebarNavFooter>
 *   </SidebarNav>
 */

function SidebarNav({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-nav" className={cn("flex min-h-0 flex-1 flex-col", className)} {...props} />
}

/** A field-shaped button that opens your search (a command palette). */
function SidebarNavSearch({
  shortcut,
  children = "Search",
  className,
  ...props
}: React.ComponentProps<"button"> & { shortcut?: React.ReactNode }) {
  return (
    <div data-slot="sidebar-nav-search" className="shrink-0 px-3 pt-3 pb-2">
      <button
        type="button"
        // the key cap sits 8px into the field: concentric with it at large radii
        className={cn(
          "flex h-8 w-full cursor-pointer items-center gap-2 frame-lg frame-inset-2 bg-background px-2.5 text-ui text-muted-foreground shadow-well outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/32 [&>[data-slot=kbd]]:rounded-inner-or-2xs",
          className
        )}
        {...props}
      >
        <SearchIcon className="size-3.5 shrink-0" />
        <span className="flex-1 text-start">{children}</span>
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
      className={cn("scrollbar-hover min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4", className)}
      {...props}
    >
      <div className="flex flex-col gap-4">{children}</div>
    </nav>
  )
}

type SidebarNavSectionProps = Omit<CollapsiblePrimitive.Root.Props, "children"> & {
  label: React.ReactNode
  /** Muted count after the label. */
  count?: number
  /** `section`: a top-level heading; `group`: a smaller muted heading inside a section. */
  level?: "section" | "group"
  /** A section with no toggle (always open). */
  collapsible?: boolean
  children?: React.ReactNode
}

/** A labelled, collapsible block of rows. Open by default; control it with `open` / `onOpenChange` to persist it. */
function SidebarNavSection({
  label,
  count,
  level = "section",
  collapsible = true,
  defaultOpen = true,
  className,
  children,
  ...props
}: SidebarNavSectionProps) {
  const labelClass =
    level === "section" ? "h-7 text-ui font-semibold text-foreground" : "h-6.5 text-ui-sm font-medium text-muted-foreground hover:text-foreground"
  const countEl = count !== undefined && <span className="text-ui-xs font-normal text-muted-foreground/80 tabular-nums">{count}</span>
  return (
    <CollapsiblePrimitive.Root
      data-slot="sidebar-nav-section"
      data-level={level}
      defaultOpen={collapsible ? defaultOpen : true}
      className={cn("flex flex-col gap-px", level === "group" && "mt-2", className)}
      {...props}
    >
      {collapsible ? (
        <CollapsiblePrimitive.Trigger
          className={cn(
            "group/trigger flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 text-start outline-none transition-colors duration-150 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50",
            labelClass
          )}
        >
          <span className="truncate">{label}</span>
          {countEl}
          <ChevronRightIcon
            aria-hidden
            className={cn(
              "ms-auto shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open/trigger:rotate-90 motion-reduce:transition-none rtl:-scale-x-100 rtl:group-data-panel-open/trigger:-rotate-90",
              level === "section" ? "size-3.5" : "size-3"
            )}
          />
        </CollapsiblePrimitive.Trigger>
      ) : (
        <div className={cn("flex items-center gap-1.5 px-2", labelClass)}>
          <span className="truncate">{label}</span>
          {countEl}
        </div>
      )}
      <CollapsiblePrimitive.Panel className="flex flex-col gap-px">{children}</CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  )
}

/** Rows of a section or group; no indent, so every label and row shares one left edge. */
function SidebarNavList({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-nav-list" className={cn("flex flex-col gap-px", className)} {...props} />
}

type SidebarNavLinkProps = useRender.ComponentProps<"a"> & {
  /** The current page: a fill, a bar in the gutter and `aria-current="page"`. */
  active?: boolean
  /** Trailing content, such as a "New" badge. */
  badge?: React.ReactNode
}

/** One row in a list item. Pass `render={<Link href="…" />}` for a router link. */
function SidebarNavLink({ active = false, badge, className, children, render, ...props }: SidebarNavLinkProps) {
  const link = useRender({
    defaultTagName: "a",
    render,
    props: mergeProps<"a">(
      {
        "aria-current": active ? "page" : undefined,
        className: cn(
          "group/nav relative flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-ui text-muted-foreground outline-none transition-colors duration-150",
          "hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          "aria-[current=page]:bg-secondary aria-[current=page]:font-medium aria-[current=page]:text-foreground",
          className
        ),
        children: (
          <>
            <span
              aria-hidden
              className="absolute inset-y-1.5 -start-2 w-0.5 rounded-full bg-transparent group-aria-[current=page]/nav:bg-foreground"
            />
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
export type { SidebarNavSectionProps, SidebarNavLinkProps }
