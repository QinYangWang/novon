import * as React from "react"

import { cn } from "@/lib/utils"
import { LocaleText } from "@/ui/locale-provider"
import type { ShaderVariant } from "@/ui/shader-background"
import { meshGradient, seedPalette } from "@/lib/seed-palette"

/* The shader runtime loads only when a cover actually draws one, so css and image covers ship none of it. */
const ShaderBackground = React.lazy(() =>
  import("@/ui/shader-background").then((m) => ({ default: m.ShaderBackground })),
)

/*
 * Cover artwork: an image URL, or a shader in a custom or random palette. A seed (a post slug)
 * keeps the random palette stable, so the same post always gets the same colours and
 * neighbouring posts look different.
 *
 *   <CoverArt image="/covers/launch.jpg" className="aspect-video" />
 *   <CoverArt seed="post-slug" className="aspect-video rounded-xl" />
 *   <CoverArt palette={["#ff8a3d", "#ffd36e", "#8fd3ff"]} shader="grain-gradient" className="aspect-video" />
 *   <CoverArt seed="file-name" renderer="css" className="aspect-square" />   // galleries of many tiles
 *
 * `renderer="css"` draws a still frame of the mesh gradient with CSS radial gradients in the same
 * seeded palette: no WebGL context, no client code, so a grid of dozens of tiles stays cheap.
 * The shader code is loaded on demand; until it arrives the cover shows the same still frame
 * (or the muted surface when no palette or seed is set), in the same box.
 */

const tint = (amount: number) => `color-mix(in oklch, var(--primary), var(--background) ${amount}%)`
/* The theme colours for the CSS still when no palette or seed is given. */
const THEME_PALETTE = ["var(--background)", "var(--primary)", tint(55), tint(25)]

type CoverArtProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** An image URL drawn edge to edge. Wins over the shader. */
  image?: string
  /** Shader colours, or `"random"`. Defaults to random when `seed` is set, else the theme colours. */
  palette?: string[] | "random"
  /** Which shader to draw. Defaults to `"mesh-gradient"`. */
  shader?: ShaderVariant
  /** Keeps a random palette stable across renders, pages and `OgCoverArt`. */
  seed?: string
  /** `shader` animates with WebGL; `css` draws a still mesh gradient in the same palette, for galleries. */
  renderer?: "shader" | "css"
}

function CoverArt({ seed, image, palette, shader = "mesh-gradient", renderer = "shader", className, ...props }: CoverArtProps) {
  const v = image !== undefined ? "image" : renderer === "css" ? "gradient" : "shader"
  // The built-in name comes from the locale through a hidden element, so the art itself needs no client code.
  const labelId = React.useId()
  const layout = seed ?? labelId
  const named = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined || props["aria-hidden"] !== undefined
  return (
    <div
      role="img"
      data-slot="cover-art"
      data-variant={v}
      className={cn("@container relative isolate overflow-hidden bg-muted", className)}
      {...props}
      aria-labelledby={props["aria-labelledby"] ?? (named ? undefined : labelId)}
    >
      {!named && (
        <span id={labelId} hidden>
          <LocaleText label="coverArt" />
        </span>
      )}
      {v === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- any URL, sized by the container
        <img src={image} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : v === "gradient" ? (
        <CoverGradient colors={Array.isArray(palette) && palette.length > 0 ? palette : palette === "random" || seed !== undefined ? seedPalette(layout) : THEME_PALETTE} seed={layout} />
      ) : (
        <React.Suspense
          fallback={Array.isArray(palette) && palette.length > 0 ? <CoverGradient colors={palette} seed={layout} />
            : seed !== undefined ? <CoverGradient colors={seedPalette(layout)} seed={layout} />
            : null}
        >
          <ShaderBackground
            aria-hidden
            variant={shader}
            colors={palette ?? (seed !== undefined ? "random" : undefined)}
            seed={seed}
            className="absolute inset-0"
          />
        </React.Suspense>
      )}
    </div>
  )
}

function CoverGradient({ colors, seed }: { colors: string[]; seed: string }) {
  return (
    <span
      aria-hidden
      data-slot="cover-art-gradient"
      className="absolute inset-0"
      style={{ backgroundColor: colors[0], backgroundImage: meshGradient(colors, seed) }}
    />
  )
}

export { CoverArt }
export type { CoverArtProps }
