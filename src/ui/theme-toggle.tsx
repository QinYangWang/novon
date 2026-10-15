"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

type Theme = "light" | "dark"
/** A stored choice. "system" means no stored value: the page follows the OS setting. */
type ThemeMode = Theme | "system"

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

type ThemeChangeDetail = {
  /** The theme now on the page. */
  theme: Theme
  storageKey: string
  /** The stored choice ("system" when the key was removed). */
  mode?: ThemeMode
}

const DARK_QUERY = "(prefers-color-scheme: dark)"
const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark"
const systemTheme = (): Theme => (window.matchMedia(DARK_QUERY).matches ? "dark" : "light")

/** The stored choice: "light" | "dark", anything else (no key, "system") is "system". */
function readMode(storageKey: string): ThemeMode {
  try {
    const v = localStorage.getItem(storageKey)
    return isTheme(v) ? v : "system"
  } catch {
    return "system"
  }
}

/**
 * Inline this in <head> before any content (a `<script>` tag) so the first paint already has
 * the right theme. Reads the same key as ThemeToggle; with no stored value it follows the OS
 * and keeps following it when the OS setting changes, even before scripts hydrate.
 */
function getThemeScript(storageKey = "theme") {
  const key = JSON.stringify(storageKey)
  return `(function(){var e=document.documentElement,q=matchMedia("${DARK_QUERY}");function v(){try{return localStorage.getItem(${key})}catch(_){return null}}function a(){var s=v(),d=s==="dark"||(s!=="light"&&q.matches);e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}a();q.addEventListener("change",function(){var s=v();if(s!=="light"&&s!=="dark")a()})})()`
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = VT_CSS
  document.head.appendChild(style)
}

/** Flip the `.dark` class in one frame, with CSS transitions muted so every surface swaps together. */
function applyTheme(theme: Theme, storageKey: string, mode: ThemeMode | null = theme) {
  const root = document.documentElement
  const mute = document.createElement("style")
  mute.textContent = NO_TRANSITIONS_CSS
  document.head.appendChild(mute)
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
  // mode null: an OS change while following the system, nothing to store.
  if (mode !== null) {
    try {
      if (mode === "system") localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, mode)
    } catch {
      // storage can be unavailable (private mode, sandboxed iframes)
    }
  }
  // Force a style recalc before re-enabling transitions.
  void window.getComputedStyle(root).opacity
  requestAnimationFrame(() => requestAnimationFrame(() => mute.remove()))
  window.dispatchEvent(
    new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, {
      detail: { theme, storageKey, mode: mode ?? readMode(storageKey) },
    })
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

/** Runs `commit` inside a view transition that reveals the new page as a circle from `origin`. */
function useReveal(duration: number) {
  const reduceMotion = useReducedMotion()
  const busy = React.useRef(false)
  return React.useCallback(
    (commit: () => void, origin?: { x: number; y: number }) => {
      if (busy.current) return
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
    [duration, reduceMotion]
  )
}

/**
 * Reads and writes the `.dark` class on <html>. Stays in sync when something else
 * (another toggle, a pre-paint script) changes the class.
 */
function useThemeToggle({ storageKey = "theme", duration = 560, onThemeChange }: UseThemeToggleOptions = {}) {
  const [theme, setThemeState] = React.useState<Theme | null>(null)
  const reveal = useReveal(duration)

  React.useEffect(() => {
    setThemeState(readTheme())
    const observer = new MutationObserver(() => setThemeState(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  const setTheme = React.useCallback(
    (next: Theme, { origin }: SetThemeOptions = {}) => {
      if (next === readTheme()) return
      reveal(() => {
        flushSync(() => setThemeState(next))
        applyTheme(next, storageKey)
        onThemeChange?.(next)
      }, origin)
    },
    [onThemeChange, reveal, storageKey]
  )

  const toggle = React.useCallback(
    (options?: SetThemeOptions) => setTheme(readTheme() === "dark" ? "light" : "dark", options),
    [setTheme]
  )

  return { theme, setTheme, toggle }
}

type UseThemeOptions = UseThemeToggleOptions

/**
 * Light, dark or system. `theme` is the stored choice ("system" when nothing is stored),
 * `resolvedTheme` the one on the page. While on "system" the page follows OS changes.
 * Both are `null` until mounted.
 */
function useTheme({ storageKey = "theme", duration = 560, onThemeChange }: UseThemeOptions = {}) {
  const [theme, setMode] = React.useState<ThemeMode | null>(null)
  const [resolvedTheme, setResolved] = React.useState<Theme | null>(null)
  const reveal = useReveal(duration)

  React.useEffect(() => {
    setMode(readMode(storageKey))
    setResolved(readTheme())
    const observer = new MutationObserver(() => setResolved(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ThemeChangeDetail>).detail
      if (detail?.storageKey === storageKey) setMode(detail.mode ?? readMode(storageKey))
    }
    // Another tab changed the choice: follow it without the reveal.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey && e.key !== null) return
      const mode = readMode(storageKey)
      setMode(mode)
      const next = mode === "system" ? systemTheme() : mode
      if (next !== readTheme()) applyTheme(next, storageKey, null)
    }
    window.addEventListener(THEME_CHANGE_EVENT, onChange)
    window.addEventListener("storage", onStorage)
    return () => {
      observer.disconnect()
      window.removeEventListener(THEME_CHANGE_EVENT, onChange)
      window.removeEventListener("storage", onStorage)
    }
  }, [storageKey])

  // Follow the OS while nothing is stored.
  React.useEffect(() => {
    if (theme !== "system") return
    const query = window.matchMedia(DARK_QUERY)
    const onChange = () => {
      if (readMode(storageKey) !== "system") return
      const next = systemTheme()
      if (next !== readTheme()) applyTheme(next, storageKey, null)
    }
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [storageKey, theme])

  const setTheme = React.useCallback(
    (mode: ThemeMode, { origin }: SetThemeOptions = {}) => {
      const next = mode === "system" ? systemTheme() : mode
      const commit = () => {
        flushSync(() => {
          setMode(mode)
          setResolved(next)
        })
        applyTheme(next, storageKey, mode)
        onThemeChange?.(next)
      }
      if (next === readTheme()) commit()
      else reveal(commit, origin)
    },
    [onThemeChange, reveal, storageKey]
  )

  return { theme, resolvedTheme, systemTheme: resolvedTheme === null ? null : systemTheme(), setTheme }
}

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { light: "dark", dark: "system", system: "light" }
const MODE_LABEL: Record<ThemeMode, string> = { light: "Light", dark: "Dark", system: "System" }

type ThemeToggleProps = Omit<React.ComponentProps<"button">, "children" | "onClick"> &
  UseThemeToggleOptions & {
    /** Icon size in px. Default 16. */
    iconSize?: number
    /** "raised" (default): round card button. "ghost": 28px toolbar button that sits with icon-sm ghost Buttons. */
    variant?: "raised" | "ghost"
    /** "binary" (default) flips light and dark. "tri" cycles light, dark and system. */
    modes?: "binary" | "tri"
  }

/**
 * Light/dark button that repaints the page through the View Transition API with a
 * circular reveal from the click point. Falls back to an instant swap when the API is
 * missing or the user prefers reduced motion.
 */
function ThemeToggle({
  className,
  storageKey,
  duration,
  onThemeChange,
  iconSize = 16,
  variant = "raised",
  modes = "binary",
  ...props
}: ThemeToggleProps) {
  const { theme: mode, resolvedTheme: theme, setTheme } = useTheme({ storageKey, duration, onThemeChange })
  const reduceMotion = useReducedMotion()
  const tri = modes === "tri"
  const dark = theme === "dark"
  const shown = tri ? mode : theme
  const Icon = shown === "system" ? MonitorIcon : shown === "dark" ? MoonIcon : SunIcon
  const next: ThemeMode = tri && mode ? NEXT_MODE[mode] : dark ? "light" : "dark"
  const toggle = (options: SetThemeOptions) => setTheme(next, options)
  const label =
    shown === null
      ? "Toggle theme"
      : tri && mode
        ? `Theme: ${MODE_LABEL[mode]}. Switch to ${MODE_LABEL[next].toLowerCase()}`
        : dark
          ? "Switch to light theme"
          : "Switch to dark theme"

  return (
    <button
      type="button"
      data-slot="theme-toggle"
      data-mode={tri ? (mode ?? undefined) : undefined}
      aria-label={label}
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
          key={shown ?? "pending"}
          className="flex items-center justify-center"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: shown === null ? 0 : 1, rotate: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ type: "spring", duration: 0.45, bounce: 0.3 }}
        >
          <Icon size={iconSize} />
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

export { THEME_CHANGE_EVENT, ThemeToggle, getThemeScript, useTheme, useThemeToggle }
export type { Theme, ThemeChangeDetail, ThemeMode, ThemeToggleProps, UseThemeOptions }
