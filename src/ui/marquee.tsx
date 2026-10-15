import * as React from "react"

import { cn } from "@/lib/utils"

type MarqueeProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Scroll direction. */
  direction?: "left" | "right" | "up" | "down"
  /** Seconds for one full loop of the content. */
  duration?: number
  /** Space between items (any CSS length). */
  gap?: string
  /** Pause while hovered or while something inside has focus. */
  pauseOnHover?: boolean
  /** Fade the leading and trailing edges with a mask. */
  fade?: boolean
  /** Copies of the content in the track. Raise it when items are narrower than the container. */
  repeat?: number
}

// Shipped with the component (React hoists and dedupes it by href).
const MARQUEE_CSS =
  "@keyframes qy-marquee-x{from{transform:translateX(0)}to{transform:translateX(calc(-100% - var(--marquee-gap)))}}" +
  "@keyframes qy-marquee-y{from{transform:translateY(0)}to{transform:translateY(calc(-100% - var(--marquee-gap)))}}" +
  "@media (prefers-reduced-motion: reduce){[data-slot=marquee-track]{animation-play-state:paused!important}}"

function Marquee({
  direction = "left",
  duration = 30,
  gap = "1rem",
  pauseOnHover = true,
  fade = true,
  repeat = 2,
  className,
  style,
  children,
  ...props
}: MarqueeProps) {
  const vertical = direction === "up" || direction === "down"
  const reverse = direction === "right" || direction === "down"
  const copies = Math.max(2, Math.floor(repeat))

  return (
    <>
      <style href="qy-marquee" precedence="default">
        {MARQUEE_CSS}
      </style>
      <div
        data-slot="marquee"
        data-orientation={vertical ? "vertical" : "horizontal"}
        // min-h-0 / min-w-0: with no overflow clip on the root, it must still shrink to the box its parent gives it.
        className={cn("group/marquee flex min-h-0 min-w-0", vertical ? "flex-col" : "flex-row", className)}
        style={{ "--marquee-gap": gap, ...style } as React.CSSProperties}
        {...props}
      >
        {/*
          The viewport clips and fades, not the root: a border, ring or shadow on
          the root (or on the items) stays visible. The cross-axis padding gives
          the items' hairline rings room so overflow-hidden does not shave them.
        */}
        <div
          data-slot="marquee-viewport"
          className={cn(
            "flex min-h-0 min-w-0 flex-1 overflow-hidden",
            vertical ? "flex-col px-1" : "flex-row py-1",
            fade &&
              (vertical
                ? "[mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
                : "[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]")
          )}
          style={{ gap }}
        >
          {Array.from({ length: copies }, (_, copy) => (
            <div
              key={copy}
              data-slot="marquee-track"
              aria-hidden={copy > 0 || undefined}
              inert={copy > 0 || undefined}
              className={cn(
                "flex shrink-0 items-center justify-around",
                vertical ? "flex-col" : "flex-row",
                pauseOnHover &&
                  "group-hover/marquee:[animation-play-state:paused] group-focus-within/marquee:[animation-play-state:paused]"
              )}
              style={{
                gap,
                // Longhands, so the hover class can still set animation-play-state.
                animationName: vertical ? "qy-marquee-y" : "qy-marquee-x",
                animationDuration: `${duration}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDirection: reverse ? "reverse" : "normal",
              }}
            >
              {children}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export { Marquee, type MarqueeProps }
