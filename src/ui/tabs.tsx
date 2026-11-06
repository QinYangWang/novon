"use client";

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-3 data-[orientation=vertical]:flex-row", className)} {...props} />
}

// `default`: a flat grey track with one raised chip that slides to the active tab and resizes;
// outer heights match Button (xs 24, sm 28, default 32, lg 36). The track is a frame on the control
// radius with a 4px inset (2px at xs), so the chip stays concentric with it at every radius preset.
// `underline`: tabs on a hairline with a sliding 2px bar; tabs take the full height.
// `ghost`: no well and no line; the active tab gets a soft fill. For tab rows inside another
// frame (a card header), where the parent supplies the edge.
// A horizontal row that runs out of room scrolls sideways, its edges fading on the side with more.
// A tab whose only child is an icon is square (give it an `aria-label`).
const tabsListVariants = cva(
  "relative z-0 inline-flex w-fit max-w-full shrink-0 items-center data-[orientation=horizontal]:overflow-x-auto data-[orientation=horizontal]:overscroll-x-contain data-[orientation=horizontal]:scrollbar-none data-[orientation=horizontal]:scroll-fade-x data-[orientation=vertical]:h-fit data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
  {
    variants: {
      variant: {
        default: "gap-0.5 bg-muted",
        underline:
          "gap-1 shadow-[inset_0_-1px_0_var(--border)] data-[orientation=vertical]:gap-0.5 data-[orientation=vertical]:shadow-[inset_1px_0_0_var(--border)]",
        ghost: "gap-0.5",
      },
      size: { xs: "", sm: "", default: "", lg: "" },
    },
    compoundVariants: [
      { variant: "default", size: "xs", className: "frame-control-sm frame-p-0.5" },
      { variant: "default", size: ["sm", "default", "lg"], className: "frame-control frame-p-1" },
    ],
    defaultVariants: { variant: "default", size: "default" },
  }
)

const tabsTabVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center data-[orientation=vertical]:justify-start gap-1.5 font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-active:text-foreground data-disabled:pointer-events-none data-disabled:opacity-64 data-icon-only:aspect-square data-icon-only:px-0 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: { default: "", underline: "rounded-md focus-visible:ring-inset", ghost: "rounded-inner focus-visible:ring-inset" },
      size: {
        xs: "px-2 text-ui-xs [&_svg]:size-3",
        sm: "px-2.5 text-ui-sm",
        default: "px-3 text-ui",
        lg: "px-3.5 text-ui-lg [&_svg]:size-4",
      },
    },
    compoundVariants: [
      { variant: "default", size: "xs", className: "h-5 rounded-inner" },
      { variant: "default", size: "sm", className: "h-5 rounded-inner" },
      { variant: "default", size: "default", className: "h-6 rounded-inner" },
      { variant: "default", size: "lg", className: "h-7 rounded-inner" },
      { variant: "underline", size: "xs", className: "h-6 px-1.5" },
      { variant: "underline", size: "sm", className: "h-7 px-2" },
      { variant: "underline", size: "default", className: "h-8 px-2.5" },
      { variant: "underline", size: "lg", className: "h-9 px-3" },
      { variant: "ghost", size: "xs", className: "h-6 px-2" },
      { variant: "ghost", size: "sm", className: "h-7 px-2.5" },
      { variant: "ghost", size: "default", className: "h-8 px-3" },
      { variant: "ghost", size: "lg", className: "h-9 px-3.5" },
    ],
    defaultVariants: { variant: "default", size: "default" },
  }
)

type TabsListVariantProps = VariantProps<typeof tabsListVariants>
type TabsSize = NonNullable<TabsListVariantProps["size"]>
type TabsVariant = NonNullable<TabsListVariantProps["variant"]>

const TabsListContext = React.createContext<{ size: TabsSize; variant: TabsVariant }>({ size: "default", variant: "default" })

const indicatorClass: Record<TabsVariant, string> = {
  ghost: "h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) bg-secondary",
  default:
    "h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) bg-background shadow-raised dark:bg-fill-active",
  underline:
    "h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-[calc(var(--active-tab-top)+var(--active-tab-height)-2px)] rounded-full bg-foreground data-[orientation=vertical]:h-(--active-tab-height) data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:translate-x-0 data-[orientation=vertical]:translate-y-(--active-tab-top)",
}

/**
 * Tab row. Follows the root `orientation` (x for horizontal, y for vertical). `size` and
 * `variant` apply to every tab inside.
 */
function TabsList({ className, children, size = "default", variant = "default", ...props }: TabsPrimitive.List.Props & TabsListVariantProps) {
  const s = size ?? "default"
  const v = variant ?? "default"
  const ctx = React.useMemo(() => ({ size: s, variant: v }), [s, v])
  return (
    <TabsListContext.Provider value={ctx}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-size={s}
        data-variant={v}
        className={cn(tabsListVariants({ size: s, variant: v }), className)}
        {...props}
      >
        {children}
        <TabsPrimitive.Indicator
          data-slot="tabs-indicator"
          className={cn(
            "absolute top-0 left-0 -z-10 transition-[translate,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            v !== "underline" && "rounded-inner",
            indicatorClass[v]
          )}
        />
      </TabsPrimitive.List>
    </TabsListContext.Provider>
  )
}

// CSS can't see text nodes (`>svg:only-child` also matched icon + label tabs and stripped their
// padding), so icon-only requires an accessible label and a single glyph child.
// An arbitrary component without children can also render text (for example a localized label).
function isIconOnly(children: React.ReactNode) {
  const nodes = React.Children.toArray(children)
  return nodes.length === 1 && React.isValidElement(nodes[0])
    && (nodes[0].type === "svg" || typeof nodes[0].type === "function" || typeof nodes[0].type === "object")
    && !(nodes[0].props as { children?: unknown }).children
}

function TabsTab({ className, children, ...props }: TabsPrimitive.Tab.Props) {
  const { size, variant } = React.useContext(TabsListContext)
  const iconOnly = !!(props["aria-label"] || props["aria-labelledby"]) && typeof children !== "function" && isIconOnly(children as React.ReactNode)
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      data-size={size}
      data-icon-only={iconOnly ? "" : undefined}
      className={cn(tabsTabVariants({ size, variant }), className)}
      {...props}
    >
      {children}
    </TabsPrimitive.Tab>
  )
}

type TabsPanelProps = TabsPrimitive.Panel.Props & {
  /** Turns prose styles back on for this panel's content inside a `typeset` container (or names a preset when used on its own). */
  typeset?: boolean | "docs" | "reading" | "chat"
}

function TabsPanel({ className, typeset, ...props }: TabsPanelProps) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      data-typeset={typeset === true ? "" : typeset || undefined}
      className={cn("outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTab, TabsPanel, tabsListVariants, tabsTabVariants }
export type { TabsPanelProps }
export type { TabsSize, TabsVariant }
