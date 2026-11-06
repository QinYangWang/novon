"use client";

import * as React from "react"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cva, type VariantProps } from "class-variance-authority"
import { LayoutGroup, motion, useReducedMotion } from "motion/react"

import { useControlSize } from "@/lib/control-size"

import { cn } from "@/lib/utils"

/*
 * Pick one of a few options in place: billing cycle, chart type, light / dark,
 * date range. Looks like TabsList (raised thumb on a well) but is a radio group,
 * because it changes a value rather than switching panels. Arrow keys move the
 * selection.
 *
 *   <SegmentedControl value={cycle} onValueChange={setCycle} aria-label="Billing cycle">
 *     <SegmentedControlItem value="monthly">Monthly</SegmentedControlItem>
 *     <SegmentedControlItem value="yearly">Yearly</SegmentedControlItem>
 *   </SegmentedControl>
 */

// Same look as the default TabsList: a flat grey track and a raised chip. Outer heights match Button
// (xs 24, sm 28, default 32, lg 36): items sit inside a 4px inset (2px at xs), and the track is a frame on
// the control radius, so the chip stays concentric with it at every radius preset.
const segmentedControlVariants = cva("relative inline-flex w-fit items-center gap-0.5 bg-muted", {
  variants: {
    size: {
      xs: "frame-control-sm frame-p-0.5",
      sm: "frame-control frame-p-1",
      default: "frame-control frame-p-1",
      lg: "frame-control frame-p-1",
    },
  },
  defaultVariants: { size: "default" },
})

const segmentedControlItemVariants = cva(
  "relative inline-flex cursor-pointer items-center select-none justify-center gap-1.5 font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground active:bg-secondary focus-visible:ring-2 focus-visible:ring-ring data-checked:text-foreground data-disabled:pointer-events-none data-disabled:opacity-64 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      size: {
        xs: "after:absolute after:inset-x-0 after:-inset-y-0.5 h-5 rounded-inner px-2 text-ui-xs [&_svg]:size-3",
        sm: "after:absolute after:inset-x-0 after:-inset-y-1 h-5 rounded-inner px-2.5 text-ui-sm",
        default: "h-6 rounded-inner px-3 text-ui",
        lg: "h-7 rounded-inner px-3.5 text-ui-lg [&_svg]:size-4",
      },
    },
    defaultVariants: { size: "default" },
  }
)

type SegmentedControlSize = NonNullable<VariantProps<typeof segmentedControlVariants>["size"]>


const SegmentedContext = React.createContext<{ id: string; size: SegmentedControlSize; value: unknown; reduce: boolean } | null>(null)

type SegmentedControlProps = Omit<RadioGroupPrimitive.Props<string>, "onValueChange"> & {
  onValueChange?: (value: string) => void
  size?: SegmentedControlSize
}

function SegmentedControl({ className, size: sizeProp, value, defaultValue, onValueChange, ...props }: SegmentedControlProps) {
  const size = useControlSize(sizeProp)
  const id = React.useId()
  const reduce = useReducedMotion() ?? false
  const [inner, setInner] = React.useState<unknown>(defaultValue)
  const current = value !== undefined ? value : inner
  return (
    <SegmentedContext.Provider value={{ id, size, value: current, reduce }}>
      <LayoutGroup id={id}>
        <RadioGroupPrimitive
          data-slot="segmented-control"
          data-size={size}
          value={value}
          defaultValue={defaultValue}
          onValueChange={(v) => {
            setInner(v)
            onValueChange?.(String(v))
          }}
          className={cn(segmentedControlVariants({ size }), className)}
          {...props}
        />
      </LayoutGroup>
    </SegmentedContext.Provider>
  )
}

function SegmentedControlItem({ className, children, value, ...props }: RadioPrimitive.Root.Props<string>) {
  const ctx = React.useContext(SegmentedContext)
  const selected = ctx?.value === value
  const size = ctx?.size ?? "default"
  return (
    <RadioPrimitive.Root
      data-slot="segmented-control-item"
      data-size={size}
      value={value}
      className={cn(segmentedControlItemVariants({ size }), className)}
      {...props}
    >
      {selected && (
        <motion.span
          aria-hidden
          layoutId={ctx?.reduce ? undefined : `${ctx?.id}-thumb`}
          initial={ctx?.reduce ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={ctx?.reduce ? { duration: 0.15 } : { type: "spring", stiffness: 500, damping: 40, mass: 0.6 }}
          className="absolute inset-0 rounded-inner bg-background shadow-raised dark:bg-fill-active"
        />
      )}
      <span className="relative inline-flex items-center gap-1.5">{children}</span>
    </RadioPrimitive.Root>
  )
}

export { SegmentedControl, SegmentedControlItem, segmentedControlVariants, segmentedControlItemVariants }
export type { SegmentedControlProps, SegmentedControlSize }
