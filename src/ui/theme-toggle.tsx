"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { MoonIcon, SunIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

type Theme = "light" | "dark"

const EASE = "cubic-bezier(0.22,1,0.36,1)"
const VT_ATTR = "data-theme-transition"
const STYLE_ID = "theme-toggle-vt"

/**
 * While our transition runs, turn off the default cross-fade so the new snapshot can be
 * revealed with a clip-path. Scoped to an attribute on <html> so other view transitions
 * on the page keep their own animations.
 */
const VT_CSS = `:root[${VT_ATTR}]::view-transition-old(root),:root[${VT_ATTR}]::view-transition-new(root){animation:none;mix-blend-mode:normal}:root[${VT_ATTR}]::view-transition-old(root){z-index:0}:root[${VT_ATTR}]::view-transition-new(root){z-index:1}`
const NO_TRANSITIONS_CSS = "*,*::before,*::after{transition:none!important}"

/** Window event fired after the theme changes, so other toggles (or your own code) can stay in sync. */
const THEME_CHANGE_EVENT = "theme-change"

type ThemeChangeDetail = { theme: Theme; storageKey: string }

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = VT_CSS
  document.head.appendChild(style)
}

/** Flip the `.dark` class in one frame, with CSS transitions muted so every surface swaps together. */
function applyTheme(theme: Theme, storageKey: string) {
  const root = document.documentElement
  const mute = document.createElement("style")
  mute.textContent = NO_TRANSITIONS_CSS
  document.head.appendChild(mute)
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
  try {
    localStorage.setItem(storageKey, theme)
  } catch {
    // storage can be unavailable (private mode, sandboxed iframes)
  }
  // Force a style recalc before re-enabling transitions.
  void window.getComputedStyle(root).opacity
  requestAnimationFrame(() => requestAnimationFrame(() => mute.remove()))
  window.dispatchEvent(
    new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, { detail: { theme, storageKey } })
  )
}

const readTheme = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light")

type SetThemeOptions = {
  /** Viewport point the circle grows from. Defaults to the centre of the screen. */
  origin?: { x: number; y: number }
}

type UseThemeToggleOptions = {
  /** localStorage key, shared with the pre-paint theme script. Default "theme". */
  storageKey?: string
  /** Reveal duration in ms. Default 560. */
  duration?: number
  onThemeChange?: (theme: Theme) => void
}

/**
 * Reads and writes the `.dark` class on <html>. Stays in sync when something else
 * (another toggle, a pre-paint script) changes the class.
 */
function useThemeToggle({ storageKey = "theme", duration = 560, onThemeChange }: UseThemeToggleOptions = {}) {
  const [theme, setThemeState] = React.useState<Theme | null>(null)
  const reduceMotion = useReducedMotion()
  const busy = React.useRef(false)

  React.useEffect(() => {
    setThemeState(readTheme())
    const observer = new MutationObserver(() => setThemeState(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  const setTheme = React.useCallback(
    (next: Theme, { origin }: SetThemeOptions = {}) => {
      if (busy.current || next === readTheme()) return
      const commit = () => {
        flushSync(() => setThemeState(next))
        applyTheme(next, storageKey)
        onThemeChange?.(next)
      }

      const doc = document as Document & { startViewTransition?: Document["startViewTransition"] }
      if (!doc.startViewTransition || reduceMotion) {
        commit()
        return
      }

      ensureStyle()
      const root = document.documentElement
      const x = origin?.x ?? window.innerWidth / 2
      const y = origin?.y ?? window.innerHeight / 2
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

      busy.current = true
      root.setAttribute(VT_ATTR, "")
      const transition = doc.startViewTransition.call(document, commit)
      const done = () => {
        root.removeAttribute(VT_ATTR)
        busy.current = false
      }
      transition.ready
        .then(() => {
          root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration, easing: EASE, pseudoElement: "::view-transition-new(root)" }
          )
        })
        .catch(() => {})
      transition.finished.then(done, done)
    },
    [duration, onThemeChange, reduceMotion, storageKey]
  )

  const toggle = React.useCallback(
    (options?: SetThemeOptions) => setTheme(readTheme() === "dark" ? "light" : "dark", options),
    [setTheme]
  )

  return { theme, setTheme, toggle }
}

type ThemeToggleProps = Omit<React.ComponentProps<"button">, "children" | "onClick"> &
  UseThemeToggleOptions & {
    /** Icon size in px. Default 16. */
    iconSize?: number
    /** "raised" (default): round card button. "ghost": 28px toolbar button that sits with icon-sm ghost Buttons. */
    variant?: "raised" | "ghost"
  }

/**
 * Light/dark button that repaints the page through the View Transition API with a
 * circular reveal from the click point. Falls back to an instant swap when the API is
 * missing or the user prefers reduced motion.
 */
function ThemeToggle({ className, storageKey, duration, onThemeChange, iconSize = 16, variant = "raised", ...props }: ThemeToggleProps) {
  const { theme, toggle } = useThemeToggle({ storageKey, duration, onThemeChange })
  const reduceMotion = useReducedMotion()
  const dark = theme === "dark"
  const Icon = dark ? MoonIcon : SunIcon

  return (
    <button
      type="button"
      data-slot="theme-toggle"
      aria-label={theme === null ? "Toggle theme" : dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={(event) => {
        // Keyboard activation reports detail 0 and no pointer position: grow from the button.
        if (event.detail === 0) {
          const rect = event.currentTarget.getBoundingClientRect()
          toggle({ origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } })
        } else {
          toggle({ origin: { x: event.clientX, y: event.clientY } })
        }
      }}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden transition-[box-shadow,background-color,scale] duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        variant === "ghost"
          ? "size-7 rounded-lg text-foreground hover:bg-secondary [&_svg]:opacity-80"
          : "size-8 rounded-full bg-card text-secondary-foreground shadow-raised hover:bg-accent hover:shadow-raised-hover",
        className
      )}
      {...props}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={theme ?? "pending"}
          className="flex items-center justify-center"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: theme === null ? 0 : 1, rotate: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ type: "spring", duration: 0.45, bounce: 0.3 }}
        >
          <Icon size={iconSize} />
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

export { THEME_CHANGE_EVENT, ThemeToggle, useThemeToggle }
export type { Theme, ThemeChangeDetail, ThemeToggleProps }
