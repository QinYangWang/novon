import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { ArrowRightIcon, ExternalLinkIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

// Native desktop density: 32px default, 13px label, flat fills,
// hover is a fill change only. No press scale: native controls do not shrink.
// An icon marked data-icon="inline-start" / "inline-end" takes 2px off that side's padding, so the
// label and glyph look centred (the glyph's side bearing already adds space).
// A key cap inside a button sits about 6px from its corner, so it follows the button's radius.
// Corners read --radius-control (rounded-lg by default), so a style can make every button a pill.
// shape="pill" makes one button round-ended; pills take a little more inline padding at lg and xl,
// since the round ends eat into the space beside the label. `inverse` and `glass` are for calls to
// action on pictures and tinted sections; `xl` is the hero size.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control text-ui font-medium whitespace-nowrap transition-[box-shadow,background-color,color,opacity] duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-64 aria-invalid:ring-2 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='opacity-'])]:opacity-80 [&_[data-slot=kbd]]:rounded-[max(calc(var(--radius-control)-var(--spacing)*1.5),min(var(--radius-2xs),var(--radius-sm)))]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-primary hover:bg-primary-hover active:bg-primary-active",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-foreground/6 aria-expanded:bg-foreground/6",
        outline:
          "bg-transparent text-foreground shadow-[inset_0_0_0_1px_var(--border)] hover:bg-secondary aria-expanded:bg-secondary",
        ghost: "text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive-hover",
        link: "rounded-md text-primary-text underline-offset-4 hover:underline",
        inverse: "bg-foreground text-background hover:bg-foreground/85",
        glass: "bg-card/70 text-foreground shadow-raised backdrop-blur-xl hover:bg-card aria-expanded:bg-card",
      },
      size: {
        default: "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pe-2.5 has-data-[icon=inline-start]:ps-2.5",
        xs: "h-6 gap-1 rounded-control-sm px-2 text-ui-xs has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-7 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-2 px-3.5 text-ui-lg has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3",
        xl: "h-11 gap-2 px-5 text-ui-lg has-data-[icon=inline-end]:pe-4.5 has-data-[icon=inline-start]:ps-4.5",
        icon: "size-8",
        "icon-xs": "size-6 rounded-control-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
      shape: {
        default: "",
        pill: "rounded-full",
      },
    },
    compoundVariants: [
      // A 36px pill keeps the 13px label: round ends already make it read larger.
      { shape: "pill", size: "lg", className: "px-4 text-ui has-data-[icon=inline-end]:pe-3.5 has-data-[icon=inline-start]:ps-3.5" },
      { shape: "pill", size: "xl", className: "sm:px-6 sm:has-data-[icon=inline-end]:pe-5.5 sm:has-data-[icon=inline-start]:ps-5.5" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  shape = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-shape={shape}
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  )
}

/**
 * The trailing arrow of a link button. It nudges toward the destination on hover;
 * `external` swaps it for the leave-the-site glyph, which stays still.
 */
function ButtonArrow({ external, className }: { external?: boolean; className?: string }) {
  const Icon = external ? ExternalLinkIcon : ArrowRightIcon
  return (
    <Icon
      data-slot="button-arrow"
      size={16}
      className={cn(
        "opacity-70 rtl:-scale-x-100",
        !external &&
          "transition-transform duration-200 ease-out group-hover/button:translate-x-0.5 motion-reduce:transition-none rtl:group-hover/button:-translate-x-0.5",
        className
      )}
    />
  )
}

export { Button, ButtonArrow, buttonVariants }
