/**
 * "On this page" for docs pages and posts, built on the library's outline. Pass a page's
 * `headings` (or the library's `items`); the full list renders on the server.
 */
import * as React from 'react'
import {
  Outline as OutlineRail,
  OutlinePopover as OutlineButton,
  useActiveHeading as useLibraryActiveHeading,
  type OutlineItem,
  type OutlinePopoverProps as LibraryPopoverProps,
  type OutlineProps as LibraryOutlineProps,
} from '@/ui/outline'
import type { Heading } from '../types.ts'

/** Page headings as outline items; deeper headings than h3 sit at the h3 step. */
export function outlineItems(headings: Heading[]): OutlineItem[] {
  return headings.map((h) => ({ id: h.id, title: h.text, depth: h.depth >= 3 ? 3 : 2 }))
}

type WithHeadings<P> = Omit<P, 'items'> & { headings?: Heading[]; items?: readonly OutlineItem[] }
export type OutlineProps = WithHeadings<LibraryOutlineProps>
export type OutlinePopoverProps = WithHeadings<LibraryPopoverProps>

function useItems(headings?: Heading[], items?: readonly OutlineItem[]): readonly OutlineItem[] {
  return React.useMemo(() => items ?? outlineItems(headings ?? []), [headings, items])
}

/** Sticky-rail outline. Renders nothing for fewer than two headings. */
export function Outline({ headings, items, ...props }: OutlineProps) {
  const list = useItems(headings, items)
  if (list.length < 2) return null
  return <OutlineRail items={list} {...props} />
}

/** The outline as one button, for screens too narrow for the rail. */
export function OutlinePopover({ headings, items, ...props }: OutlinePopoverProps) {
  const list = useItems(headings, items)
  if (list.length < 2) return null
  return <OutlineButton items={list} {...props} />
}

/**
 * The id of the heading being read. `line` is px from the top of the viewport (default 112);
 * a bare number is still accepted.
 */
export function useActiveHeading(ids: readonly string[], options: number | { line?: number } = {}): string | undefined {
  return useLibraryActiveHeading(ids, typeof options === 'number' ? { line: options } : options)
}

export type { OutlineItem }
