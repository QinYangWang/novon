import type * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Generated cover artwork in CSS, so posts and cards need no image files. Every colour is a theme
 * token, so the art follows the accent, light and dark. Eight compositions; `seed` hashes a string
 * (a post slug) into a composition, a mirror, a tone offset and a pattern, so neighbouring posts
 * get covers that look different and the same post always gets the same one.
 *
 *   <CoverArt variant={2} className="aspect-video" />
 *   <CoverArt seed="post-slug" className="aspect-video rounded-xl" />
 */

type CoverArtVariant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
type CoverArtMirror = "none" | "x" | "y" | "xy"
type CoverArtRamp = 0 | 1 | 2

/** Everything a seed decides. `pattern` feeds the tile, dot and digit compositions. */
type CoverArtStyle = { variant: CoverArtVariant; mirror: CoverArtMirror; ramp: CoverArtRamp; pattern: number }

const VARIANTS = 8
const MIRRORS: readonly CoverArtMirror[] = ["none", "x", "y", "xy"]
/** The pattern drawn when no seed is given, so `variant` alone always looks the same. */
const DEFAULT_PATTERN = 0x5a3c

/** FNV-1a: the same string gives the same number on the server and in every browser. */
function hashSeed(seed: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Avalanche step, so slugs that differ by one letter land far apart in every bit. */
function mix(h: number) {
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** Composition, mirror, tone offset and pattern for a seed. */
function coverArtStyle(seed: string): CoverArtStyle {
  const h = mix(hashSeed(seed))
  return {
    variant: (h % VARIANTS) as CoverArtVariant,
    mirror: MIRRORS[(h >>> 3) & 3],
    ramp: ((h >>> 5) % 3) as CoverArtRamp,
    pattern: mix(h ^ 0x9e3779b9) & 0xffff,
  }
}

/** The composition a seed picks, for a matching thumbnail elsewhere. */
function coverArtVariant(seed: string): CoverArtVariant {
  return coverArtStyle(seed).variant
}

/* Tone ladder, strongest first; `ramp` shifts where each composition starts on it. */
const TONES = ["bg-primary", "bg-primary/70", "bg-primary/45", "bg-primary/25", "bg-primary/12", "bg-card"] as const
const tone = (ramp: CoverArtRamp, i: number) => TONES[(i + ramp * 2) % TONES.length]

const BACKDROPS: Record<CoverArtRamp, string> = {
  0: "from-primary/18 via-muted to-background dark:from-primary/25",
  1: "from-background via-muted to-primary/18 dark:to-primary/25",
  2: "from-primary/10 via-background to-primary/22 dark:from-primary/16 dark:to-primary/30",
}
const DIRECTIONS: Record<CoverArtMirror, string> = {
  none: "bg-linear-to-br",
  x: "bg-linear-to-bl",
  y: "bg-linear-to-tr",
  xy: "bg-linear-to-tl",
}
const FLIPS: Record<CoverArtMirror, string> = {
  none: "",
  x: "-scale-x-100",
  y: "-scale-y-100",
  xy: "rotate-180",
}

type CoverArtProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Which composition to draw (`0` to `7`). Wins over `seed`. */
  variant?: CoverArtVariant
  /** Picks composition, mirror, tones and pattern from this string when `variant` is not set. */
  seed?: string
  /** Flips the composition. Defaults to the seed's, or `"none"`. */
  mirror?: CoverArtMirror
  /** Shifts the tones along the accent ladder. Defaults to the seed's, or `0`. */
  ramp?: CoverArtRamp
}

function CoverArt({ variant, seed, mirror, ramp, className, ...props }: CoverArtProps) {
  const fromSeed = variant === undefined && seed !== undefined ? coverArtStyle(seed) : undefined
  const v = variant ?? fromSeed?.variant ?? 0
  const m = mirror ?? fromSeed?.mirror ?? "none"
  const r = ramp ?? fromSeed?.ramp ?? 0
  const pattern = fromSeed?.pattern ?? DEFAULT_PATTERN
  const bit = (i: number) => (pattern >>> i) & 1
  // digits are text: they never flip, the seed changes the numbers instead
  const flip = v === 3 ? "" : FLIPS[m]
  return (
    <div
      role="img"
      aria-label="Abstract cover illustration"
      data-slot="cover-art"
      data-variant={v}
      data-mirror={m}
      data-ramp={r}
      className={cn("@container relative isolate overflow-hidden", DIRECTIONS[m], BACKDROPS[r], className)}
      {...props}
    >
      {v === 0 && (
        // Nested rounded squares, drawn concentric: 32 = 16 + 16, 16 = 10 + 6.
        <div className={cn("absolute inset-0 grid place-items-center", flip)}>
          <div className="grid size-3/5 max-w-72 place-items-center rounded-3xl bg-card/70 p-4 shadow-surface">
            <div className="grid size-full place-items-center rounded-xl bg-primary-subtle p-1.5 shadow-well">
              <div className={cn("size-full rounded-md shadow-primary", r === 0 ? "bg-primary" : tone(r, 0))} />
            </div>
          </div>
        </div>
      )}
      {v === 1 && (
        // Staggered pills easing in.
        <div className={cn("absolute inset-0 flex flex-col justify-center gap-1.5 px-6 @xs:gap-3 @xs:px-12", flip)}>
          {["w-11/12", "w-9/12", "w-7/12", "w-5/12"].map((w, i) => (
            <div
              key={w}
              className={cn(
                "h-3 rounded-full shadow-raised @xs:h-6",
                w,
                r === 0 ? (i === 0 ? "bg-primary" : i === 1 ? "bg-primary/60" : i === 2 ? "bg-primary/35" : "bg-card") : tone(r, i)
              )}
            />
          ))}
        </div>
      )}
      {v === 2 && (
        // A lightness ramp of one hue.
        <div className={cn("absolute inset-0 flex items-end gap-1 px-5 pb-5 @xs:gap-2 @xs:px-10 @xs:pb-10", flip)}>
          {(r === 0
            ? ["bg-primary/10", "bg-primary/25", "bg-primary/45", "bg-primary/70", "bg-primary", "bg-foreground/80"]
            : [tone(r, 4), tone(r, 3), tone(r, 2), tone(r, 1), tone(r, 0), "bg-foreground/80"]
          ).map((c, i) => (
            <div key={i} className={cn("flex-1 rounded-md shadow-raised @xs:rounded-xl", ["h-1/5", "h-2/5", "h-3/5", "h-4/5", "h-11/12", "h-3/4"][i], c)} />
          ))}
        </div>
      )}
      {v === 3 && (
        // Fixed-width digits.
        <div className="absolute inset-0 grid place-items-center">
          <div
            dir="ltr"
            className={cn(
              "flex gap-1.5 font-mono text-3xl font-semibold tabular-nums @xs:gap-2 @xs:text-5xl @md:text-6xl",
              r === 2 ? "text-foreground" : "text-primary",
              (m === "y" || m === "xy") && "translate-y-2"
            )}
          >
            {(fromSeed ? [0, 1, 2, 3].map((i) => String(((pattern >>> (i * 4)) & 15) % 10)) : ["1", "0", "4", "8"]).map((d, i) => (
              <span
                key={i}
                className={cn(
                  "grid h-12 w-9 place-items-center rounded-xl shadow-raised @xs:h-20 @xs:w-14 @xs:rounded-2xl @md:h-24 @md:w-16",
                  r === 1 && i === (m === "x" || m === "xy" ? 0 : 3) ? "bg-primary-subtle" : "bg-card/80"
                )}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}
      {v === 4 && (
        // Rings spreading from a corner.
        <div className={cn("absolute inset-0", flip)}>
          {["w-full", "w-3/4", "w-1/2", "w-1/4"].map((s, i) => (
            <div
              key={s}
              className={cn(
                "absolute start-0 bottom-0 aspect-square -translate-x-1/3 translate-y-1/3 rounded-full shadow-raised rtl:translate-x-1/3",
                s,
                tone(r, 3 - i)
              )}
            />
          ))}
        </div>
      )}
      {v === 5 && (
        // A grid of tiles, some lit.
        <div className={cn("absolute inset-0 grid grid-cols-6 grid-rows-3 gap-1 p-4 @xs:gap-2 @xs:p-8", flip)}>
          {Array.from({ length: 18 }, (_, i) => (
            <div
              key={i}
              className={cn("rounded-lg shadow-raised", bit(i % 16) ? tone(r, (i % 3) as 0 | 1 | 2) : i % 2 ? "bg-card/80" : tone(r, 4))}
            />
          ))}
        </div>
      )}
      {v === 6 && (
        // A fanned stack of cards.
        <div className={cn("absolute inset-0", flip)}>
          <div className={cn("absolute inset-y-1/3 start-1/3 end-1/12 rounded-xl shadow-raised @xs:rounded-2xl", tone(r, 2))} />
          <div className={cn("absolute inset-y-1/4 start-1/5 end-1/6 rounded-xl shadow-raised @xs:rounded-2xl", tone(r, 1))} />
          <div className="absolute inset-y-1/6 start-1/8 end-1/4 flex flex-col justify-end gap-1.5 rounded-xl bg-card p-3 shadow-surface @xs:gap-2 @xs:rounded-2xl @xs:p-5">
            <div className={cn("h-2 w-3/5 rounded-full @xs:h-3", tone(r, 0))} />
            <div className="h-1.5 w-4/5 rounded-full bg-foreground/12 @xs:h-2" />
            <div className="h-1.5 w-2/5 rounded-full bg-foreground/12 @xs:h-2" />
          </div>
        </div>
      )}
      {v === 7 && (
        // A dot field fading along a diagonal.
        <div className={cn("absolute inset-0 grid grid-cols-12 grid-rows-6 place-items-center p-4 @xs:p-6", flip)}>
          {Array.from({ length: 72 }, (_, i) => {
            const x = i % 12
            const y = Math.floor(i / 12)
            const step = Math.min(4, Math.floor((x + y + bit(i % 16)) / 4))
            return <div key={i} className={cn("size-1.5 rounded-full @xs:size-2.5 @md:size-3", TONES[(step + r * 2) % 5])} />
          })}
        </div>
      )}
    </div>
  )
}

export { CoverArt, coverArtStyle, coverArtVariant }
export type { CoverArtProps, CoverArtVariant, CoverArtMirror, CoverArtRamp, CoverArtStyle }
