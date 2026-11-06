"use client";

import * as React from "react"
import { useLocale } from "@/ui/locale-provider"
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react"

import { CheckIcon, LoaderIcon, XIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"

type ButtonState = "idle" | "loading" | "success" | "error"

type StatefulButtonProps = Omit<React.ComponentProps<typeof Button>, "children"> & {
  /** Which face the button shows. Loading disables it (it stays focusable). */
  state?: ButtonState
  children: React.ReactNode
  loadingText?: React.ReactNode
  successText?: React.ReactNode
  errorText?: React.ReactNode
  /** Optional trailing icon shown only while idle. */
  icon?: React.ReactNode
  /** Tint the surface green / red on success / error (default variant only). */
  tint?: boolean
}

const SWAP: Transition = { type: "spring", stiffness: 460, damping: 32, mass: 0.6 }
const WIDTH: Transition = { type: "spring", stiffness: 380, damping: 34, mass: 0.7 }

/** Tracks the natural width of an element so a parent can spring between sizes. */
function useNaturalWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const [width, setWidth] = React.useState<number>()
  React.useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const update = () => setWidth(node.offsetWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function StatefulButton({
  state = "idle",
  children,
  loadingText,
  successText,
  errorText,
  icon,
  tint = true,
  variant = "default",
  disabled,
  className,
  ...props
}: StatefulButtonProps) {
  const l10n = useLocale().labels
  if (loadingText === undefined) loadingText = l10n.working
  if (successText === undefined) successText = l10n.toolDone
  if (errorText === undefined) errorText = l10n.tryAgain

  const reduce = useReducedMotion()
  const [innerRef, width] = useNaturalWidth<HTMLSpanElement>()
  const busy = state === "loading"

  const text =
    state === "loading"
      ? loadingText
      : state === "success"
        ? successText
        : state === "error"
          ? errorText
          : children
  const leading =
    state === "loading" ? (
      <LoaderIcon className="animate-spin motion-reduce:animate-none" />
    ) : state === "success" ? (
      <CheckIcon />
    ) : state === "error" ? (
      <XIcon />
    ) : null

  const swap = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: "70%", filter: "blur(6px)" },
        animate: { opacity: 1, y: "0%", filter: "blur(0px)" },
        exit: { opacity: 0, y: "-70%", filter: "blur(6px)" },
      }

  return (
    <Button
      data-slot="button-stateful"
      data-state={state}
      variant={variant}
      disabled={disabled || busy}
      focusableWhenDisabled={busy}
      aria-busy={busy || undefined}
      className={cn(
        "overflow-hidden data-[state=loading]:cursor-progress data-[state=loading]:disabled:pointer-events-auto data-[state=loading]:disabled:opacity-100",
        tint &&
          variant === "default" &&
          "data-[state=error]:bg-destructive data-[state=error]:shadow-[0_0_0_1px_color-mix(in_oklch,var(--destructive),black_10%)] data-[state=success]:bg-success data-[state=success]:shadow-[0_0_0_1px_color-mix(in_oklch,var(--success),black_10%)]",
        className
      )}
      {...props}
    >
      <motion.span
        aria-hidden
        initial={false}
        animate={{ width: width ?? "auto" }}
        transition={reduce ? { duration: 0 } : WIDTH}
        className="relative inline-flex h-full items-center overflow-hidden"
      >
        <span ref={innerRef} className="relative inline-flex w-max items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={state}
              {...swap}
              transition={reduce ? { duration: 0.15 } : SWAP}
              className="inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {leading}
              {text}
              {state === "idle" && icon}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.span>
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
    </Button>
  )
}

export { StatefulButton, type StatefulButtonProps, type ButtonState }
