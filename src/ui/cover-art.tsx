import type * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Generated cover artwork in CSS, so posts and cards need no image files. Every colour is a theme
 * token, so the art follows the accent, light and dark. Four compositions; `seed` picks one from a
 * stable hash of a string (a post slug), so the same post always gets the same cover.
 *
 *   <CoverArt variant={2} className="aspect-video" />
 *   <CoverArt seed="post-slug" className="aspect-video rounded-xl" />
 */

type CoverArtVariant = 0 | 1 | 2 | 3

/** FNV-1a: the same string gives the same number on the server and in every browser. */
function hashSeed(seed: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function coverArtVariant(seed: string): CoverArtVariant {
  return (hashSeed(seed) % 4) as CoverArtVariant
}

type CoverArtProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Which composition to draw. Wins over `seed`. */
  variant?: CoverArtVariant
  /** Picks a composition from this string when `variant` is not set. */
  seed?: string
}

function CoverArt({ variant, seed, className, ...props }: CoverArtProps) {
  const v = variant ?? (seed !== undefined ? coverArtVariant(seed) : 0)
  return (
    <div
      role="img"
      aria-label="Abstract cover illustration"
      data-slot="cover-art"
      data-variant={v}
      className={cn(
        "relative isolate overflow-hidden bg-linear-to-br from-primary/18 via-muted to-background dark:from-primary/25",
        className
      )}
      {...props}
    >
      {v === 0 && (
        // Nested rounded squares, drawn concentric: 32 = 16 + 16, 16 = 10 + 6.
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid size-3/5 max-w-72 place-items-center rounded-3xl bg-card/70 p-4 shadow-surface">
            <div className="grid size-full place-items-center rounded-xl bg-primary-subtle p-1.5 shadow-well">
              <div className="size-full rounded-md bg-primary shadow-primary" />
            </div>
          </div>
        </div>
      )}
      {v === 1 && (
        // Staggered pills easing in.
        <div className="absolute inset-0 flex flex-col justify-center gap-3 px-12">
          {[90, 72, 56, 40].map((w, i) => (
            <div
              key={w}
              className={cn(
                "h-6 rounded-full shadow-raised",
                i === 0 ? "w-11/12 bg-primary" : i === 1 ? "w-9/12 bg-primary/60" : i === 2 ? "w-7/12 bg-primary/35" : "w-5/12 bg-card"
              )}
            />
          ))}
        </div>
      )}
      {v === 2 && (
        // A lightness ramp of one hue.
        <div className="absolute inset-0 flex items-end gap-2 px-10 pb-10">
          {["h-1/5 bg-primary/10", "h-2/5 bg-primary/25", "h-3/5 bg-primary/45", "h-4/5 bg-primary/70", "h-11/12 bg-primary", "h-3/4 bg-foreground/80"].map((c) => (
            <div key={c} className={cn("flex-1 rounded-xl shadow-raised", c)} />
          ))}
        </div>
      )}
      {v === 3 && (
        // Fixed-width digits.
        <div className="absolute inset-0 grid place-items-center">
          <div dir="ltr" className="flex gap-2 font-mono text-5xl font-semibold text-primary tabular-nums sm:text-6xl">
            {["1", "0", "4", "8"].map((d, i) => (
              <span key={i} className="grid h-20 w-14 place-items-center rounded-2xl bg-card/80 shadow-raised sm:h-24 sm:w-16">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { CoverArt, coverArtVariant }
export type { CoverArtProps, CoverArtVariant }
