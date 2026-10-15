"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"

import { ChevronDownIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

// Underdamped spring sampled into CSS linear(): ~8% overshoot, settles in ~600ms.
const SPRING =
  "ease-[linear(0,0.073,0.242,0.444,0.64,0.805,0.929,1.013,1.061,1.081,1.082,1.072,1.056,1.039,1.024,1.011,1.002,0.997,0.994,0.993,1)]"

type AccordionVariant = "default" | "ghost"

const AccordionVariantContext = React.createContext<AccordionVariant>("default")

/**
 * `default`: inset well holding raised rows.
 * `ghost`: borderless. No well or dividers; items are separated by spacing,
 * rows fill on hover and the open item keeps a soft fill.
 * Single-open by default; pass `multiple` to let several items stay open.
 */
function Accordion({
  className,
  variant = "default",
  ...props
}: AccordionPrimitive.Root.Props & { variant?: AccordionVariant }) {
  return (
    <AccordionVariantContext.Provider value={variant}>
      <AccordionPrimitive.Root
        data-slot="accordion"
        data-variant={variant}
        className={cn(
          "flex w-full flex-col gap-1",
          variant === "default" && "rounded-[1.25rem] bg-background p-1 shadow-well dark:bg-input/32",
          className
        )}
        {...props}
      />
    </AccordionVariantContext.Provider>
  )
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  const variant = React.useContext(AccordionVariantContext)
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(
        "group/accordion-item",
        variant === "default" &&
          "rounded-2xl transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-open:bg-card data-open:shadow-raised",
        // Ghost: the item is the frame; the flush trigger follows it via rounded-inner.
        variant === "ghost" &&
          "frame-xl transition-[background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-open:bg-secondary",
        className
      )}
      {...props}
    />
  )
}

/** Trigger row with an optional leading icon chip and a springy chevron. */
function AccordionTrigger({
  className,
  children,
  icon,
  ...props
}: AccordionPrimitive.Trigger.Props & { icon?: React.ReactNode }) {
  const variant = React.useContext(AccordionVariantContext)
  const ghost = variant === "ghost"
  return (
    <AccordionPrimitive.Header data-slot="accordion-header" className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger flex flex-1 cursor-pointer items-center text-left text-ui font-medium text-foreground transition-[background-color] duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 data-disabled:pointer-events-none",
          ghost
            ? "min-h-9 gap-2.5 rounded-inner px-3 py-1.5 hover:not-data-panel-open:bg-secondary data-disabled:opacity-64"
            : "min-h-11 gap-3 rounded-2xl px-3 py-2 hover:not-data-panel-open:bg-card/50 data-disabled:opacity-50",
          className
        )}
        {...props}
      >
        {icon && ghost && (
          <span
            data-slot="accordion-icon"
            aria-hidden
            className="flex shrink-0 text-muted-foreground transition-colors duration-200 group-data-panel-open/accordion-trigger:text-foreground [&_svg]:size-4"
          >
            {icon}
          </span>
        )}
        {icon && !ghost && (
          <span
            data-slot="accordion-icon"
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground shadow-raised transition-colors duration-200 group-data-panel-open/accordion-trigger:text-primary [&_svg]:size-4"
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-500 group-data-panel-open/accordion-trigger:rotate-180 group-data-panel-open/accordion-trigger:text-foreground motion-reduce:transition-none",
            SPRING
          )}
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

/** Panel with a springy height reveal (eases out without bounce on close). */
function AccordionPanel({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  const variant = React.useContext(AccordionVariantContext)
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      className={cn(
        "group/accordion-panel h-(--accordion-panel-height) overflow-hidden transition-[height] duration-600 data-ending-style:h-0 data-ending-style:duration-300 data-ending-style:ease-[cubic-bezier(0.22,1,0.36,1)] data-starting-style:h-0 motion-reduce:transition-none",
        SPRING
      )}
      {...props}
    >
      <div
        data-slot="accordion-content"
        className={cn(
          // Ghost rows with a leading icon indent the content to the label (px-3 + 16px icon + gap-2.5).
          "px-3 pb-3 text-ui-sm leading-5 text-muted-foreground transition-[opacity,translate] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-ending-style/accordion-panel:-translate-y-1.5 group-data-ending-style/accordion-panel:opacity-0 group-data-starting-style/accordion-panel:-translate-y-1.5 group-data-starting-style/accordion-panel:opacity-0 motion-reduce:transition-none",
          variant === "ghost" && "group-has-data-[slot=accordion-icon]/accordion-item:pl-9.5",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionPanel }
export type { AccordionVariant }
