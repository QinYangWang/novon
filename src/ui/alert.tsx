"use client";

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from "motion/react"

import { AlertCircleIcon, CheckCircleIcon, InfoIcon, WarningIcon, XIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { useLocale } from "@/ui/locale-provider"

// A quiet bordered card: the tone lives on the icon (and on the text for destructive), never on a
// filled wash, so a page with several alerts stays calm. Title and description share one column
// beside a 16px icon; actions and the close button sit at the end of the first line.
const alertVariants = cva(
  "relative flex w-full items-start border bg-card text-card-foreground [&>[data-slot=alert-icon]]:mt-0.5",
  {
    variants: {
      variant: {
        default: "border-border [&>[data-slot=alert-icon]]:text-foreground",
        info: "border-border [&>[data-slot=alert-icon]]:text-primary-text",
        success: "border-border [&>[data-slot=alert-icon]]:text-success-text",
        warning: "border-border [&>[data-slot=alert-icon]]:text-warning-text",
        destructive:
          "border-border text-destructive-text [&>[data-slot=alert-icon]]:text-destructive-text [&_[data-slot=alert-description]]:text-destructive-text/80",
      },
      size: {
        sm: "gap-2.5 rounded-lg px-3 py-2.5 text-ui",
        default: "gap-3 rounded-xl px-4 py-3 text-ui",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>
type AlertSize = NonNullable<VariantProps<typeof alertVariants>["size"]>

type AlertContextValue = {
  open: boolean
  variant: AlertVariant
  size: AlertSize
  setOpen: (open: boolean) => void
  dismiss: () => void
}

const AlertContext = React.createContext<AlertContextValue | null>(null)

function useAlert() {
  const ctx = React.useContext(AlertContext)
  if (!ctx) throw new Error("useAlert must be used within <Alert>")
  return ctx
}

const defaultIcon: Record<AlertVariant, React.ComponentType<{ className?: string }>> = {
  default: InfoIcon,
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningIcon,
  destructive: AlertCircleIcon,
}

const EASE = [0.22, 1, 0.36, 1] as const

type AlertProps = Omit<
  HTMLMotionProps<"div">,
  "initial" | "animate" | "exit" | "transition" | "role" | "children"
> & {
  variant?: AlertVariant
  /** `sm` tightens the padding, for alerts inside cards and forms. */
  size?: AlertSize
  /** Controlled visibility. Hiding animates the alert out (height collapses, surface fades). */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Defaults to "alert" for warning/destructive and "status" otherwise. */
  role?: "alert" | "status"
  /** Classes for the inner surface row (the outer element only animates height). */
  contentClassName?: string
  children?: React.ReactNode
}

/**
 * Inline callout. Compose with AlertIcon, AlertContent (AlertTitle + AlertDescription),
 * AlertAction and AlertClose. Appears and dismisses with a soft height + scale animation.
 */
function Alert({
  variant = "default",
  size = "default",
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  role,
  className,
  contentClassName,
  children,
  ...props
}: AlertProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : uncontrolled
  const reduce = useReducedMotion() ?? false

  const onOpenChangeRef = React.useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolled(next)
      onOpenChangeRef.current?.(next)
    },
    [controlled]
  )
  const dismiss = React.useCallback(() => setOpen(false), [setOpen])
  const ctx = React.useMemo(() => ({ open, variant, size, setOpen, dismiss }), [open, variant, size, setOpen, dismiss])

  const resolvedRole = role ?? (variant === "warning" || variant === "destructive" ? "alert" : "status")

  return (
    <AlertContext.Provider value={ctx}>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            data-slot="alert"
            data-variant={variant}
            data-size={size}
            role={resolvedRole}
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.96, filter: "blur(2px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto", scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.96, filter: "blur(2px)" }}
            transition={
              reduce
                ? { duration: 0.12 }
                : {
                    height: { type: "spring", stiffness: 420, damping: 38, mass: 0.6 },
                    scale: { type: "spring", stiffness: 480, damping: 30, mass: 0.6 },
                    opacity: { duration: 0.18, ease: EASE },
                    filter: { duration: 0.2, ease: EASE },
                  }
            }
            className={cn("-mx-1 origin-top overflow-hidden", className)}
            {...props}
          >
            {/* padding lives inside (room for the raised shadow) so height collapses to a true 0 */}
            <div className="px-1 pt-px pb-1">
              <div
                data-slot="alert-surface"
                className={cn(alertVariants({ variant, size }), contentClassName)}
              >
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AlertContext.Provider>
  )
}

/** The variant's icon, tinted by the variant, unless children are given. */
function AlertIcon({ className, children, ...props }: React.ComponentProps<"span">) {
  const { variant } = useAlert()
  const Icon = defaultIcon[variant]
  return (
    <span data-slot="alert-icon" aria-hidden className={cn("flex size-4 shrink-0 items-center justify-center [&_svg]:size-4", className)} {...props}>
      {children ?? <Icon />}
    </span>
  )
}

/** Wraps title + description so they stack beside the icon. */
function AlertContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("leading-5 font-medium", className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-ui-sm leading-5 text-muted-foreground [&_a]:underline [&_a]:underline-offset-3", className)}
      {...props}
    />
  )
}

/** Right-aligned slot for buttons (e.g. "Undo", "Review"). */
function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="alert-action" className={cn("-my-0.5 ml-auto flex shrink-0 items-center gap-1.5 self-start", className)} {...props} />
  )
}

/** Dismiss button; closes the parent Alert with its exit animation. */
function AlertClose({ className, onClick, children, ...props }: React.ComponentProps<"button">) {
  const { labels } = useLocale()
  const { dismiss, size } = useAlert()
  return (
    <button
      type="button"
      data-slot="alert-close"
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) dismiss()
      }}
      className={cn(
        size === "sm" ? "-my-0.5 -mr-1 size-6" : "-my-1 -mr-1.5 size-7",
        "flex shrink-0 cursor-pointer items-center justify-center self-start rounded-control text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5",
        className
      )}
      {...props}
      aria-label={props["aria-label"] ?? labels.dismiss}
    >
      {children ?? <XIcon />}
    </button>
  )
}

export { Alert, AlertIcon, AlertContent, AlertTitle, AlertDescription, AlertAction, AlertClose, useAlert, alertVariants }
export type { AlertVariant, AlertSize, AlertProps }
