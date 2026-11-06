"use client";

import * as React from "react"
import {
  DotOrbit,
  type DotOrbitProps,
  GrainGradient,
  type GrainGradientProps,
  MeshGradient,
  type MeshGradientProps,
  Warp,
  type WarpProps,
  Waves,
  type WavesProps,
} from "@paper-design/shaders-react"
import { useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { seedPalette } from "@/lib/seed-palette"

type ShaderVariant = "mesh-gradient" | "grain-gradient" | "warp" | "waves" | "dot-orbit"

/* Token-based defaults, resolved at runtime so light and dark both read right. */
const tint = (amount: number) => `color-mix(in oklch, var(--primary), var(--background) ${amount}%)`
const defaults: Record<ShaderVariant, { colors: string[]; colorBack: string }> = {
  "mesh-gradient": { colors: ["var(--primary)", tint(55), "var(--background)", tint(25)], colorBack: "var(--background)" },
  "grain-gradient": { colors: ["var(--primary)", tint(40), tint(70)], colorBack: "var(--background)" },
  warp: { colors: ["var(--background)", "var(--primary)", tint(60), tint(30)], colorBack: "var(--background)" },
  waves: { colors: [tint(45)], colorBack: "var(--background)" },
  "dot-orbit": { colors: ["var(--primary)", tint(35), tint(65)], colorBack: "var(--background)" },
}

/** A harmonious palette of `count` hex colours for a seed; the same seed always gives the same colours. */
const shaderPalette = seedPalette

/** Seed when given; otherwise a fresh palette after mount, so server and client markup match. */
function usePalette(colors: string[] | "random" | undefined, seed: string | undefined) {
  const [fresh, setFresh] = React.useState<string[] | null>(null)
  const random = colors === "random" && seed === undefined
  React.useEffect(() => {
    if (random) setFresh(shaderPalette(Math.random().toString(36)))
  }, [random])
  if (colors !== "random") return colors
  return seed !== undefined ? shaderPalette(seed) : (fresh ?? undefined)
}

type CommonProps = Omit<React.ComponentProps<"div">, "color"> & {
  /**
   * Palette. Any CSS colour works, including tokens like `var(--primary)` and
   * `color-mix(...)`; they are re-read when the theme changes. `waves` uses the
   * first colour as its line colour. `"random"` picks a matching set, from `seed` when given.
   */
  colors?: string[] | "random"
  /** Makes `colors="random"` repeatable: the same seed always gives the same palette. */
  seed?: string
  /** Base colour behind the pattern (grain, waves, dot orbit). */
  colorBack?: string
  /** Animation speed. 0 freezes the current frame. */
  speed?: number
  /** Freeze the animation. It also freezes offscreen and under reduced motion. */
  paused?: boolean
  /** Class for the shader layer (e.g. opacity or blend mode). */
  shaderClassName?: string
}

type ShaderBackgroundProps = CommonProps &
  (
    | { variant?: "mesh-gradient"; shaderProps?: Partial<MeshGradientProps> }
    | { variant: "grain-gradient"; shaderProps?: Partial<GrainGradientProps> }
    | { variant: "warp"; shaderProps?: Partial<WarpProps> }
    | { variant: "waves"; shaderProps?: Partial<WavesProps> }
    | { variant: "dot-orbit"; shaderProps?: Partial<DotOrbitProps> }
  )

/** Turn any CSS colour into #rrggbbaa (the shader only parses hex/rgb/hsl). */
function useResolvedColors(scope: React.RefObject<HTMLElement | null>, input: string[]) {
  const key = input.join("|")
  const [resolved, setResolved] = React.useState<string[] | null>(null)

  React.useEffect(() => {
    const host = scope.current
    if (!host) return
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    const probe = document.createElement("span")
    probe.style.display = "none"
    host.appendChild(probe)

    const toHex = (value: string) => {
      if (/^#|^rgba?\(|^hsla?\(/i.test(value.trim()) && !value.includes("var(")) return value
      probe.style.color = ""
      probe.style.color = value
      const computed = getComputedStyle(probe).color
      if (!ctx) return computed
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = "#000"
      ctx.fillStyle = computed
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return `#${[r, g, b, a].map((n) => n.toString(16).padStart(2, "0")).join("")}`
    }
    const resolve = () => setResolved(key.split("|").map(toHex))
    resolve()

    // Re-read on theme switches (class / style / data-theme on <html>).
    const observer = new MutationObserver(resolve)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] })
    return () => {
      observer.disconnect()
      probe.remove()
    }
  }, [scope, key])

  return resolved
}

/** True while any part of the element is on screen. */
function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "64px" })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return visible
}

function ShaderBackground({
  variant = "mesh-gradient",
  colors,
  seed,
  colorBack,
  speed = 0.6,
  paused = false,
  shaderProps,
  className,
  shaderClassName,
  children,
  ...props
}: ShaderBackgroundProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion() ?? false
  const onScreen = useOnScreen(ref)
  const picked = usePalette(colors, seed)
  const pending = colors === "random" && !picked
  const palette = picked ?? defaults[variant].colors
  const resolved = useResolvedColors(ref, [colorBack ?? defaults[variant].colorBack, ...palette])
  const liveSpeed = paused || reduce || !onScreen ? 0 : speed

  let shader: React.ReactNode = null
  if (resolved && !pending) {
    const [back, ...list] = resolved
    const layer = cn("absolute inset-0 size-full", shaderClassName)
    switch (variant) {
      case "mesh-gradient":
        shader = (
          <MeshGradient
            className={layer}
            colors={list}
            distortion={0.8}
            swirl={0.15}
            grainOverlay={0.06}
            {...(shaderProps as Partial<MeshGradientProps>)}
            speed={liveSpeed}
          />
        )
        break
      case "grain-gradient":
        shader = (
          <GrainGradient
            className={layer}
            colorBack={back}
            colors={list}
            shape="wave"
            softness={0.7}
            intensity={0.35}
            noise={0.3}
            {...(shaderProps as Partial<GrainGradientProps>)}
            speed={liveSpeed}
          />
        )
        break
      case "warp":
        shader = (
          <Warp
            className={layer}
            colors={list}
            proportion={0.45}
            softness={1}
            distortion={0.2}
            swirl={0.7}
            swirlIterations={8}
            shapeScale={0.12}
            shape="checks"
            {...(shaderProps as Partial<WarpProps>)}
            speed={liveSpeed}
          />
        )
        break
      case "waves":
        // Waves is a static pattern; it has no speed.
        shader = (
          <Waves
            className={layer}
            colorFront={list[0]}
            colorBack={back}
            frequency={0.5}
            amplitude={0.45}
            spacing={1.1}
            proportion={0.12}
            softness={0.4}
            {...(shaderProps as Partial<WavesProps>)}
          />
        )
        break
      case "dot-orbit":
        shader = (
          <DotOrbit
            className={layer}
            colorBack={back}
            colors={list}
            size={0.8}
            sizeRange={0.3}
            spreading={0.9}
            stepsPerColor={3}
            {...(shaderProps as Partial<DotOrbitProps>)}
            speed={liveSpeed}
          />
        )
        break
    }
  }

  return (
    <div
      ref={ref}
      data-slot="shader-background"
      data-variant={variant}
      data-paused={liveSpeed === 0 ? "" : undefined}
      className={cn("relative isolate overflow-hidden bg-background", className)}
      {...props}
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        {shader}
      </div>
      {children}
    </div>
  )
}

export { ShaderBackground, shaderPalette, type ShaderBackgroundProps, type ShaderVariant }
