"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-3 data-[orientation=vertical]:flex-row", className)} {...props} />
}

// `default`: segmented track with a sliding raised indicator; outer heights match Button
// (xs 24, sm 28, default 32, lg 36) with tabs 4px shorter inside the p-0.5 well; the well is a
// frame, so tabs and the indicator stay concentric with it at every radius.
// `underline`: tabs on a hairline with a sliding 2px bar; tabs take the full height.
// A tab whose only child is an icon is square (give it an `aria-label`).
const tabsListVariants = cva(
  "relative z-0 inline-flex w-fit items-center data-[orientation=vertical]:h-fit data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
  {
    variants: {
      variant: {
        default: "gap-0.5 bg-muted frame-p-0.5 shadow-well",
        underline:
          "gap-1 shadow-[inset_0_-1px_0_var(--border)] data-[orientation=vertical]:gap-0.5 data-[orientation=vertical]:shadow-[inset_1px_0_0_var(--border)]",
      },
      size: { xs: "", sm: "", default: "", lg: "" },
    },
    compoundVariants: [
      { variant: "default", size: "xs", className: "frame-sm" },
      { variant: "default", size: ["sm", "default", "lg"], className: "frame-lg" },
    ],
    defaultVariants: { variant: "default", size: "default" },
  }
)

const tabsTabVariants = cva(
  "inline-flex cursor-pointer items-center justify-center data-[orientation=vertical]:justify-start gap-1.5 font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-active:text-foreground data-disabled:pointer-events-none data-disabled:opacity-64 has-[>svg:only-child]:aspect-square has-[>svg:only-child]:px-0 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: { default: "", underline: "rounded-md" },
      size: {
        xs: "px-2 text-ui-xs [&_svg]:size-3",
        sm: "px-2.5 text-ui-sm",
        default: "px-3 text-ui",
        lg: "px-3.5 text-ui-lg [&_svg]:size-4",
      },
    },
    compoundVariants: [
      { variant: "default", size: "xs", className: "h-5 rounded-inner" },
      { variant: "default", size: "sm", className: "h-6 rounded-inner" },
      { variant: "default", size: "default", className: "h-7 rounded-inner" },
      { variant: "default", size: "lg", className: "h-8 rounded-inner" },
      { variant: "underline", size: "xs", className: "h-6 px-1.5" },
      { variant: "underline", size: "sm", className: "h-7 px-2" },
      { variant: "underline", size: "default", className: "h-8 px-2.5" },
      { variant: "underline", size: "lg", className: "h-9 px-3" },
    ],
    defaultVariants: { variant: "default", size: "default" },
  }
)

type TabsListVariantProps = VariantProps<typeof tabsListVariants>
type TabsSize = NonNullable<TabsListVariantProps["size"]>
type TabsVariant = NonNullable<TabsListVariantProps["variant"]>

const TabsListContext = React.createContext<{ size: TabsSize; variant: TabsVariant }>({ size: "default", variant: "default" })

const indicatorClass: Record<TabsVariant, string> = {
  default:
    "h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) bg-card shadow-raised",
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
            v === "default" && "rounded-inner",
            indicatorClass[v]
          )}
        />
      </TabsPrimitive.List>
    </TabsListContext.Provider>
  )
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  const { size, variant } = React.useContext(TabsListContext)
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      data-size={size}
      className={cn(tabsTabVariants({ size, variant }), className)}
      {...props}
    />
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
      className={cn("outline-none focus-visible:ring-2 focus-visible:ring-ring/50", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTab, TabsPanel, tabsListVariants, tabsTabVariants }
export type { TabsPanelProps }
export type { TabsSize, TabsVariant }
