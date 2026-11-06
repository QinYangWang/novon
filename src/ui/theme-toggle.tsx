"use client";

import * as React from "react"
import { flushSync } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { useLocale } from "@/ui/locale-provider"

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
const MUTE_ATTR = "data-theme-switching"
/** Mutes CSS transitions while the theme flips. Lives in a static sheet keyed on an attribute, so muting rides the same style recalc as the class change instead of adding two of its own. */
const MUTE_CSS = `:root[${MUTE_ATTR}],:root[${MUTE_ATTR}] *,:root[${MUTE_ATTR}] *::before,:root[${MUTE_ATTR}] *::after{transition:none!important}`

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
  style.textContent = VT_CSS + MUTE_CSS
  document.head.appendChild(style)
}

let unmuteTimer = 0

/** Lift the transition mute once the page is idle, so the extra recalc never lands on the click or inside the reveal. */
function scheduleUnmute(root: HTMLElement, after?: Promise<unknown>) {
  const unmute = () => {
    window.clearTimeout(unmuteTimer)
    unmuteTimer = window.setTimeout(() => root.removeAttribute(MUTE_ATTR), 0)
  }
  if (after) after.then(unmute, unmute)
  else requestAnimationFrame(() => requestAnimationFrame(unmute))
}

/**
 * Flip the `.dark` class with CSS transitions muted so every surface swaps together. Mute and flip
 * share one style recalc, and nothing here forces layout, so the browser does the work once.
 */
function applyTheme(theme: Theme, storageKey: string, mode: ThemeMode | null = theme, settled?: Promise<unknown>) {
  const root = document.documentElement
  ensureStyle()
  window.clearTimeout(unmuteTimer)
  root.setAttribute(MUTE_ATTR, "")
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
  scheduleUnmute(root, settled)
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
  /** Reveal duration in ms. Default 420. */
  duration?: number
  onThemeChange?: (theme: Theme) => void
}

/** Runs `commit` inside a view transition that reveals the new page as a circle from `origin`. */
function useReveal(duration: number) {
  const reduceMotion = useReducedMotion()
  const busy = React.useRef(false)
  return React.useCallback(
    (commit: (settled?: Promise<unknown>) => void, origin?: { x: number; y: number }) => {
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
      let settle: () => void = () => {}
      const settled = new Promise<void>((resolve) => (settle = resolve))
      const transition = doc.startViewTransition.call(document, () => commit(settled))
      transition.finished.then(settle, settle)
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
function useThemeToggle({ storageKey = "theme", duration = 420, onThemeChange }: UseThemeToggleOptions = {}) {
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
      reveal((settled) => {
        flushSync(() => setThemeState(next))
        applyTheme(next, storageKey, next, settled)
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
function useTheme({ storageKey = "theme", duration = 420, onThemeChange }: UseThemeOptions = {}) {
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
      const commit = (settled?: Promise<unknown>) => {
        flushSync(() => {
          setMode(mode)
          setResolved(next)
        })
        applyTheme(next, storageKey, mode, settled)
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
  const { labels } = useLocale()
  const modeLabel: Record<ThemeMode, string> = { light: labels.themeLight, dark: labels.themeDark, system: labels.themeSystem }
  const tri = modes === "tri"
  const dark = theme === "dark"
  const shown = tri ? mode : theme
  const Icon = shown === "system" ? MonitorIcon : shown === "dark" ? MoonIcon : SunIcon
  const next: ThemeMode = tri && mode ? NEXT_MODE[mode] : dark ? "light" : "dark"
  const toggle = (options: SetThemeOptions) => setTheme(next, options)
  const label =
    shown === null
      ? labels.toggleTheme
      : tri && mode
        ? labels.themeCycle(modeLabel[mode], modeLabel[next])
        : dark
          ? labels.switchToLightTheme
          : labels.switchToDarkTheme

  return (
    <button
      type="button"
      data-slot="theme-toggle"
      data-mode={tri ? (mode ?? undefined) : undefined}
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
        "relative inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden transition-[box-shadow,background-color,scale] duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variant === "ghost"
          ? "size-7 rounded-lg text-foreground hover:bg-secondary [&_svg]:opacity-80"
          : "size-8 rounded-control bg-card text-secondary-foreground shadow-raised hover:bg-accent hover:shadow-raised-hover",
        className
      )}
      {...props}
      aria-label={props["aria-label"] ?? label}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={shown ?? "pending"}
          className="flex items-center justify-center"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.25, filter: "blur(4px)" }}
          animate={{ opacity: shown === null ? 0 : 1, rotate: 0, scale: 1, filter: "blur(0px)" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.25, filter: "blur(4px)" }}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        >
          <Icon size={iconSize} />
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

type ThemeSwitchProps = Omit<React.ComponentProps<"div">, "children" | "onChange"> &
  UseThemeToggleOptions & {
    /** "binary" (default) shows light and dark; "tri" adds system. */
    modes?: "binary" | "tri"
  }

/**
 * Segmented light/dark (or light/dark/system) switch: one pill with a thumb that slides to the
 * current mode. Same storage, events and reveal as ThemeToggle, so the two stay in sync.
 */
function ThemeSwitch({ className, storageKey, duration, onThemeChange, modes = "binary", ...props }: ThemeSwitchProps) {
  const { theme: mode, resolvedTheme, setTheme } = useTheme({ storageKey, duration, onThemeChange })
  const reduceMotion = useReducedMotion()
  const { labels } = useLocale()
  const thumbId = React.useId()
  const options: { value: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
    { value: "light", label: labels.themeLight, Icon: SunIcon },
    { value: "dark", label: labels.themeDark, Icon: MoonIcon },
    ...(modes === "tri" ? [{ value: "system" as const, label: labels.themeSystem, Icon: MonitorIcon }] : []),
  ]
  const current = modes === "tri" ? mode : resolvedTheme
  return (
    <div
      role="radiogroup"
      aria-label={props["aria-label"] ?? labels.toggleTheme}
      data-slot="theme-switch"
      className={cn("inline-flex h-7 shrink-0 items-center gap-px rounded-control bg-secondary p-0.5", className)}
      {...props}
    >
      {options.map(({ value, label, Icon }) => {
        const checked = current === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={label}
            onClick={(event) => {
              if (checked) return
              const rect = event.currentTarget.getBoundingClientRect()
              const origin = event.detail === 0 ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: event.clientX, y: event.clientY }
              setTheme(value, { origin })
            }}
            className={cn(
              "relative grid h-full w-7 cursor-pointer place-items-center rounded-[max(calc(var(--radius-control)-var(--spacing)*0.5),1px)] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              checked && "text-foreground"
            )}
          >
            {checked && (
              <motion.span
                layoutId={thumbId}
                aria-hidden
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 50, mass: 0.5 }}
                className="absolute inset-0 rounded-[max(calc(var(--radius-control)-var(--spacing)*0.5),1px)] bg-background shadow-raised"
              />
            )}
            <Icon size={14} className="relative" />
          </button>
        )
      })}
    </div>
  )
}

export { THEME_CHANGE_EVENT, ThemeSwitch, ThemeToggle, getThemeScript, useTheme, useThemeToggle }
export type { Theme, ThemeChangeDetail, ThemeMode, ThemeSwitchProps, ThemeToggleProps, UseThemeOptions }
