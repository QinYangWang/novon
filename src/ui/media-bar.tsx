"use client";

import * as React from "react"

import { BottomStackItem } from "@/ui/bottom-stack"
import { useLocale } from "@/ui/locale-provider"
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon, StopIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

/*
 * A small floating bar for playback you control elsewhere, such as reading a page aloud: a live
 * status, play/pause, stop, and optional skip buttons and "n of m" progress. It holds no player
 * itself; pass `playing` and the handlers.
 *
 * The bar sits in the bottom stack (centred), so it never hides under a consent card. Its corners
 * follow the control radius, and the buttons inside stay concentric with it.
 *
 * `markSpeaking(el)` marks the block being read with `data-speaking`, which the theme paints with
 * the accent fill and a soft ring, and scrolls it into view.
 */

const mediaButton =
  "relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-inner text-foreground outline-none transition-colors duration-150 hover:bg-secondary active:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-64 pointer-coarse:size-9 [&_svg]:size-4"

type MediaBarProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Playing or paused. */
  playing: boolean
  /** Called by the play/pause button with the state it asks for. */
  onPlayingChange?: (playing: boolean) => void
  /** Shows the stop button. */
  onStop?: () => void
  /** Shows the skip back button. */
  onSkipBack?: () => void
  /** Shows the skip forward button. */
  onSkipForward?: () => void
  /** What is playing: `reading` says "Reading aloud", `playing` says "Playing". */
  activity?: "reading" | "playing"
  /** Replaces the status text. Announced politely when it changes. */
  status?: React.ReactNode
  /** The current part, from 1. Shown with `total` as "2/8". */
  current?: number
  total?: number
  /** `stack` (default) pins it in the bottom stack; `inline` renders it in place. */
  placement?: "stack" | "inline"
  /** Position in the bottom stack; higher sits closer to the bottom edge. */
  order?: number
}

/** A floating playback bar with status, play/pause, skip and stop. */
function MediaBar({
  playing,
  onPlayingChange,
  onStop,
  onSkipBack,
  onSkipForward,
  activity = "reading",
  status,
  current,
  total,
  placement = "stack",
  order = 0,
  className,
  ...props
}: MediaBarProps) {
  const { labels } = useLocale()
  const text = status ?? (playing ? (activity === "reading" ? labels.mediaReading : labels.mediaPlaying) : labels.mediaPaused)
  const progress = current != null && total != null && total > 0

  const bar = (
    <div
      role="region"
      aria-label={labels.mediaControls}
      data-slot="media-bar"
      data-state={playing ? "playing" : "paused"}
      className={cn(
        "frame-control frame-p-1 inline-flex max-w-full items-center gap-0.5 bg-popover text-popover-foreground shadow-surface",
        "transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] starting:translate-y-2 starting:opacity-0 motion-reduce:translate-y-0",
        className
      )}
      {...props}
    >
      <span data-slot="media-bar-status" aria-live="polite" className="min-w-0 truncate ps-2.5 pe-1.5 text-ui-sm text-muted-foreground">
        {text}
      </span>
      {progress && (
        <span data-slot="media-bar-progress" className="pe-1.5 text-ui-sm text-muted-foreground tabular-nums">
          <span aria-hidden>
            {current}/{total}
          </span>
          <span className="sr-only">{labels.mediaProgress(current, total)}</span>
        </span>
      )}
      {onSkipBack && (
        <button type="button" data-slot="media-bar-skip-back" aria-label={labels.mediaSkipBack} className={mediaButton} onClick={onSkipBack}>
          <SkipBackIcon />
        </button>
      )}
      <button
        type="button"
        data-slot="media-bar-toggle"
        aria-label={playing ? labels.mediaPause : labels.mediaPlay}
        className={cn(mediaButton, "grid place-items-center *:col-start-1 *:row-start-1 *:transition-[opacity,scale,filter] *:duration-200")}
        onClick={() => onPlayingChange?.(!playing)}
      >
        <PauseIcon className={cn(!playing && "opacity-0 motion-safe:scale-25 motion-safe:blur-xs")} />
        <PlayIcon className={cn(playing && "opacity-0 motion-safe:scale-25 motion-safe:blur-xs")} />
      </button>
      {onSkipForward && (
        <button type="button" data-slot="media-bar-skip-forward" aria-label={labels.mediaSkipForward} className={mediaButton} onClick={onSkipForward}>
          <SkipForwardIcon />
        </button>
      )}
      {onStop && (
        <button type="button" data-slot="media-bar-stop" aria-label={labels.stop} className={mediaButton} onClick={onStop}>
          <StopIcon />
        </button>
      )}
    </div>
  )

  if (placement === "inline") return bar
  return <BottomStackItem order={order}>{bar}</BottomStackItem>
}

/** The attribute that marks the block being read; the theme styles `[data-speaking]`. */
const SPEAKING_ATTRIBUTE = "data-speaking"

// The block markSpeaking marked last, so the next call moves the mark without touching other markup.
let speakingEl: Element | null = null

/**
 * Marks `el` as the block being read and moves the mark off the block marked before; `null` clears
 * it. Scrolls the block into view unless `scroll` is false (instantly under reduced motion).
 */
function markSpeaking(el: Element | null, { scroll = true }: { scroll?: boolean } = {}) {
  if (typeof document === "undefined") return
  if (speakingEl && speakingEl !== el) speakingEl.removeAttribute(SPEAKING_ATTRIBUTE)
  speakingEl = el
  if (!el) return
  el.setAttribute(SPEAKING_ATTRIBUTE, "")
  if (scroll) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
  }
}

export { MediaBar, markSpeaking, SPEAKING_ATTRIBUTE, type MediaBarProps }
