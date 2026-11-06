"use client";

import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import { useLocale } from "@/ui/locale-provider"
import { LinkIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * A vertical schedule: a time column, a dot on a hairline, the content and an optional trailing
 * action per entry.
 *
 *   <Timeline>
 *     <TimelineItem time="09:00" action={<Button size="xs" variant="ghost">Delete</Button>}>
 *       <TimelineTitle>Daily digest</TimelineTitle>
 *       <TimelineDescription>Every weekday</TimelineDescription>
 *     </TimelineItem>
 *   </Timeline>
 *
 * A changelog adds a header action and anchored titles:
 *
 *   <Timeline actions={<Button variant="ghost" size="sm" nativeButton={false} render={<a href="/feed.xml" />}>Subscribe</Button>}>
 *     <TimelineItem time="Nov 6">
 *       <TimelineTitle anchor render={<h2 />}>Version 2.0</TimelineTitle>
 *     </TimelineItem>
 *   </Timeline>
 */
type TimelineProps = React.ComponentProps<"ol"> & {
  /** Header controls above the entries, aligned to the end, such as a Subscribe or feed link. */
  actions?: React.ReactNode
}

function Timeline({ actions, className, ...props }: TimelineProps) {
  if (actions == null || actions === false) {
    return <ol data-slot="timeline" className={cn("flex min-w-0 flex-col", className)} {...props} />
  }
  return (
    <div data-slot="timeline-root" className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div data-slot="timeline-header" className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {actions}
      </div>
      <ol data-slot="timeline" className="flex min-w-0 flex-col" {...props} />
    </div>
  )
}

type TimelineTone = "default" | "primary" | "success" | "warning" | "destructive"

const DOT_TONE: Record<TimelineTone, string> = {
  default: "bg-muted-foreground/48",
  primary: "bg-primary ring-4 ring-primary/16",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
}

type TimelineItemProps = Omit<React.ComponentProps<"li">, "title"> & {
  /** Text in the time column ("09:00", "Mon"). Leave it out on every item to drop the column. */
  time?: React.ReactNode
  /** A quieter second line under the time, such as a date. */
  timeDetail?: React.ReactNode
  /** Dot colour; `primary` marks the current or next entry. */
  tone?: TimelineTone
  /** Trailing control (a menu, a delete button), aligned with the first line. */
  action?: React.ReactNode
}

/** One entry. Children are its content: a title and description, or a card. */
function TimelineItem({ time, timeDetail, tone = "default", action, className, children, ...props }: TimelineItemProps) {
  const hasTime = time != null && time !== false
  const hasAction = action != null && action !== false
  return (
    <li
      data-slot="timeline-item"
      data-tone={tone}
      className={cn(
        "group/timeline-item grid min-w-0 gap-x-3",
        hasTime
          ? hasAction
            ? "grid-cols-[var(--timeline-time,3.5rem)_0.5rem_minmax(0,1fr)_auto]"
            : "grid-cols-[var(--timeline-time,3.5rem)_0.5rem_minmax(0,1fr)]"
          : hasAction
            ? "grid-cols-[0.5rem_minmax(0,1fr)_auto]"
            : "grid-cols-[0.5rem_minmax(0,1fr)]",
        className
      )}
      {...props}
    >
      {hasTime && (
        <div data-slot="timeline-time" className="flex min-w-0 flex-col items-end pt-px text-end">
          <span className="text-ui-sm leading-5 text-muted-foreground tabular-nums">{time}</span>
          {timeDetail != null && timeDetail !== false && <span className="text-ui-xs text-muted-foreground/72 tabular-nums">{timeDetail}</span>}
        </div>
      )}
      {/* The hairline runs from this dot to the next one; it starts at the first dot and stops at the last. */}
      <div aria-hidden data-slot="timeline-rail" className="relative flex justify-center">
        <span className="absolute top-0 bottom-0 w-px bg-border group-first/timeline-item:top-2.5 group-last/timeline-item:bottom-auto group-last/timeline-item:h-2.5 group-only/timeline-item:hidden" />
        <span data-slot="timeline-dot" className={cn("relative mt-1.75 size-2 shrink-0 rounded-full", DOT_TONE[tone])} />
      </div>
      <div data-slot="timeline-content" className="flex min-w-0 flex-col gap-0.5 pb-5 group-last/timeline-item:pb-0">
        {children}
      </div>
      {hasAction && (
        <div data-slot="timeline-action" className="flex h-5 items-center">
          {action}
        </div>
      )}
    </li>
  )
}

type TimelineTitleProps = useRender.ComponentProps<"div"> & {
  /**
   * Gives the title an id and a link to it that shows on hover and focus. `true` derives the id from the
   * title's text; a string is the id. An `id` prop wins over both.
   */
  anchor?: boolean | string
}

/** The entry's title. Pass `render={<h2 />}` (or another level) when entries are sections of the page. */
function TimelineTitle({ anchor, id, className, children, render, ...props }: TimelineTitleProps) {
  const l10n = useLocale().labels
  const text = textOf(children)
  const anchorId = anchor ? id ?? (typeof anchor === "string" ? anchor : slugify(text)) : id
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        id: anchorId || undefined,
        "data-anchor": anchor ? "" : undefined,
        className: cn("group/timeline-title text-ui leading-5 font-medium", className),
        children: anchor && anchorId ? (
          <>
            {children}
            <a
              href={`#${anchorId}`}
              aria-label={l10n.linkTo(text || anchorId)}
              data-slot="timeline-anchor"
              className="ms-1 inline-flex size-6 items-center justify-center rounded-md align-middle text-muted-foreground opacity-0 outline-none transition-[opacity,color,background-color] duration-150 group-hover/timeline-title:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:opacity-48 [&_svg]:size-4"
            >
              <LinkIcon aria-hidden />
            </a>
          </>
        ) : children,
      } as React.ComponentProps<"div">,
      props
    ),
    state: { slot: "timeline-title" },
  })
}

/** Plain text of a title, for its id and the link's name. */
function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children)
  return ""
}

/** Lowercase, letters and digits of any script, joined by hyphens. */
function slugify(text: string) {
  return text.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "")
}

function TimelineDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="timeline-description" className={cn("text-ui-sm text-pretty text-muted-foreground", className)} {...props} />
}

export { Timeline, TimelineItem, TimelineTitle, TimelineDescription, type TimelineProps, type TimelineItemProps, type TimelineTitleProps, type TimelineTone }
