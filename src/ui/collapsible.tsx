import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

import { ChevronDownIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

/*
 * The panel publishes its measured size on itself as --collapsible-panel-height and -width.
 * Registered as non-inherited, each size change restyles the panel alone instead of every
 * element inside it, which is what made long panels slow to open.
 */
if (typeof CSS !== "undefined" && "registerProperty" in CSS) {
  for (const name of ["--collapsible-panel-height", "--collapsible-panel-width"]) {
    try {
      CSS.registerProperty({ name, syntax: "*", inherits: false })
    } catch {
      // already registered
    }
  }
}

function Collapsible({ className, ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" className={cn("flex flex-col", className)} {...props} />
}

/**
 * Trigger row. Shows a chevron that rotates when open; pass `chevron={false}`
 * (or use `render`) for a custom trigger.
 */
function CollapsibleTrigger({
  className,
  children,
  chevron = true,
  ...props
}: CollapsiblePrimitive.Trigger.Props & { chevron?: boolean }) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(
        "group/collapsible-trigger inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-ui font-medium text-foreground transition-[background-color,scale] duration-150 ease-out outline-none select-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-disabled:opacity-50 data-panel-open:bg-muted/60 [&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      {chevron && (
        <ChevronDownIcon
          data-slot="collapsible-chevron"
          className="ml-auto text-muted-foreground transition-transform duration-150 ease-out group-data-panel-open/collapsible-trigger:rotate-180 motion-reduce:transition-none"
        />
      )}
    </CollapsiblePrimitive.Trigger>
  )
}

/**
 * Panel that reveals with a short height transition and a soft content fade.
 * With `keepMounted` the closed panel stays laid out at zero size and invisible
 * instead of `hidden`, so its content is styled with the page and opening a long
 * panel only animates its height instead of styling all of that content on the click.
 */
type CollapsiblePanelProps = CollapsiblePrimitive.Panel.Props & {
  /** Turns prose styles back on for this panel's content inside a `typeset` container (or names a preset when used on its own). */
  typeset?: boolean | "docs" | "reading" | "chat"
}

/** True once a panel has finished closing (not while its close transition runs). */
function isPanelCollapsed(state: CollapsiblePrimitive.Panel.State) {
  return !state.open && state.transitionStatus === undefined
}

function CollapsiblePanel({ className, children, typeset, keepMounted, hiddenUntilFound, ...props }: CollapsiblePanelProps) {
  // Find-in-page needs the browser's own hidden="until-found", so only plain keepMounted stays laid out.
  const laidOut = Boolean(keepMounted) && !hiddenUntilFound
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-panel"
      keepMounted={keepMounted}
      hiddenUntilFound={hiddenUntilFound}
      {...(laidOut ? { hidden: false } : null)}
      className={(state) =>
        cn(
          "group/collapsible-panel h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none",
          typeof className === "function" ? className(state) : className,
          // Closed, it takes no room at all (margins included), like a panel that is not rendered.
          laidOut && isPanelCollapsed(state) && "invisible m-0 h-0"
        )
      }
      {...props}
    >
      <div
        data-slot="collapsible-content"
        data-typeset={typeset === true ? "" : typeset || undefined}
        className="transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-ending-style/collapsible-panel:-translate-y-1 group-data-ending-style/collapsible-panel:opacity-0 group-data-starting-style/collapsible-panel:-translate-y-1 group-data-starting-style/collapsible-panel:opacity-0 motion-reduce:transition-none"
      >
        {children}
      </div>
    </CollapsiblePrimitive.Panel>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsiblePanel, isPanelCollapsed }
export type { CollapsiblePanelProps }
