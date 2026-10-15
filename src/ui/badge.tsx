import type * as React from "react"

import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full font-medium whitespace-nowrap transition-[box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        chip: "bg-muted text-foreground shadow-chip [a]:hover:shadow-raised-hover",
        primary: "bg-primary/14 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_28%,transparent)]",
        success: "bg-success/12 text-success shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--success)_24%,transparent)]",
        warning: "bg-warning/14 text-warning shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--warning)_26%,transparent)]",
        destructive:
          "bg-destructive/12 text-destructive shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--destructive)_26%,transparent)]",
        outline: "text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)]",
      },
      size: {
        default: "h-6 px-2 text-ui-sm has-data-[slot=badge-avatar]:pl-1",
        sm: "h-5 px-1.5 text-ui-xs [&>svg]:size-3",
      },
    },
    defaultVariants: {
      variant: "chip",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "chip",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant, size }), className) }, props),
    render,
    state: { slot: "badge", variant, size },
  })
}

/** Small round mark at the start of a chip, e.g. a vendor initial. */
function BadgeAvatar({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge-avatar"
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-full bg-foreground text-ui-2xs font-semibold text-background",
        className
      )}
      {...props}
    />
  )
}

export { Badge, BadgeAvatar, badgeVariants }
