"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { LayoutGroup, motion, useReducedMotion } from "motion/react"

import { SearchIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

type CommandPaletteItem = {
  id: string
  label: string
  /** Heading the item is listed under. Items without one go under "Results". */
  group?: string
  /** Secondary line shown after the label. */
  description?: string
  /** Extra words that should match, e.g. synonyms. */
  keywords?: string[]
  /** Keys shown as hint chips, e.g. ["⌘", "N"]. */
  shortcut?: string[]
  icon?: React.ComponentType<{ className?: string }>
  disabled?: boolean
  onSelect?: () => void
}

type Match = { item: CommandPaletteItem; score: number; indices: number[] }

const isBoundary = (t: string, i: number) => i === 0 || /[\s\-_/.:]/.test(t[i - 1])

function scan(q: string, t: string, preferWordStarts: boolean, from = 0) {
  const indices: number[] = []
  let ti = from
  for (const ch of q) {
    let found = -1
    if (indices.length && t[ti] === ch) {
      found = ti // keep a consecutive run going
    } else {
      for (let i = ti; i < t.length; i++) {
        if (t[i] !== ch) continue
        if (found === -1) found = i
        if (!preferWordStarts || isBoundary(t, i)) {
          found = i
          break
        }
      }
    }
    if (found === -1) return null
    indices.push(found)
    ti = found + 1
  }
  return indices
}

/**
 * Subsequence fuzzy match. Rewards consecutive runs, word starts and an early first
 * hit; returns null when `query` is not a subsequence of `text`.
 */
function fuzzyMatch(query: string, text: string): { score: number; indices: number[] } | null {
  const q = query.toLowerCase().replace(/\s+/g, "")
  if (!q) return { score: 0, indices: [] }
  const t = text.toLowerCase()
  // Try anchoring the first character at each word start, keep the best alignment.
  let best: { score: number; indices: number[] } | null = null
  const starts = [0]
  for (let i = 1; i < t.length; i++) if (t[i] === q[0] && isBoundary(t, i)) starts.push(i)
  for (const from of starts) {
    const indices = scan(q, t, true, from) ?? scan(q, t, false, from)
    if (!indices) continue
    const score = scoreIndices(q, t, indices)
    if (!best || score > best.score) best = { score, indices }
  }
  return best
}

function scoreIndices(q: string, t: string, indices: number[]) {
  let score = 0
  let run = 0
  indices.forEach((idx, n) => {
    run = n > 0 && idx === indices[n - 1] + 1 ? run + 1 : 0
    // Gaps between matched characters cost more than where the match begins.
    const gap = n > 0 ? Math.min(idx - indices[n - 1] - 1, 6) * 0.5 : Math.min(idx, 10) * 0.1
    score += 1 + run * 3 + (isBoundary(t, idx) ? 4 : 0) - gap
  })
  if (indices[0] === 0) score += 3
  if (t.includes(q)) score += 6
  return score - t.length * 0.02
}

function matchItem(query: string, item: CommandPaletteItem): Match | null {
  const label = fuzzyMatch(query, item.label)
  if (label) return { item, score: label.score + 2, indices: label.indices }
  const extra = [item.description, item.group, ...(item.keywords ?? [])]
    .filter(Boolean)
    .map((s) => fuzzyMatch(query, s!))
    .filter((m) => m !== null)
  if (!extra.length) return null
  return { item, score: Math.max(...extra.map((m) => m.score)) * 0.6, indices: [] }
}

type CommandPaletteProps = {
  items: CommandPaletteItem[]
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Called after an item's own onSelect, before the palette closes. */
  onSelect?: (item: CommandPaletteItem) => void
  /** Key that toggles the palette with ⌘/Ctrl. Pass false to disable. */
  hotkey?: string | false
  placeholder?: string
  emptyMessage?: React.ReactNode
  /** Show the keyboard legend under the results. */
  showFooter?: boolean
  className?: string
}

function CommandPalette({
  items,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onSelect,
  hotkey = "k",
  placeholder = "Search or jump to…",
  emptyMessage = "Nothing matches that.",
  showFooter = true,
  className,
}: CommandPaletteProps) {
  const [openState, setOpenState] = React.useState(defaultOpen)
  const open = openProp ?? openState
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOpenState(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )

  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const uid = React.useId()
  const reduce = useReducedMotion()

  React.useEffect(() => {
    if (!hotkey) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === hotkey.toLowerCase()) {
        e.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [hotkey, open, setOpen])

  // Fresh search on every open.
  React.useEffect(() => {
    if (open) {
      setQuery("")
      setActive(0)
    }
  }, [open])

  const groups = React.useMemo(() => {
    const q = query.trim()
    const matches = items
      .map((item, order) => ({ m: matchItem(q, item), order }))
      .filter((x): x is { m: Match; order: number } => x.m !== null)
    if (q) matches.sort((a, b) => b.m.score - a.m.score || a.order - b.order)
    const map = new Map<string, Match[]>()
    for (const { m } of matches) {
      const key = m.item.group ?? "Results"
      map.set(key, [...(map.get(key) ?? []), m])
    }
    // With a query, groups follow their best hit; without one, their first appearance.
    return Array.from(map, ([heading, list]) => ({ heading, list }))
  }, [items, query])

  const rows = React.useMemo(() => groups.flatMap((g) => g.list), [groups])
  const enabledIndexes = React.useMemo(
    () => rows.flatMap((r, i) => (r.item.disabled ? [] : [i])),
    [rows]
  )

  React.useEffect(() => {
    setActive(enabledIndexes[0] ?? -1)
  }, [query, enabledIndexes])

  React.useEffect(() => {
    if (!open || active < 0) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [active, open])

  const choose = (match: Match | undefined) => {
    if (!match || match.item.disabled) return
    match.item.onSelect?.()
    onSelect?.(match.item)
    setOpen(false)
  }

  const move = (delta: number) => {
    if (!enabledIndexes.length) return
    const pos = enabledIndexes.indexOf(active)
    const next = pos === -1 ? 0 : (pos + delta + enabledIndexes.length) % enabledIndexes.length
    setActive(enabledIndexes[next])
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
      e.preventDefault()
      move(1)
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
      e.preventDefault()
      move(-1)
    } else if (e.key === "Home" && e.ctrlKey) {
      e.preventDefault()
      setActive(enabledIndexes[0] ?? -1)
    } else if (e.key === "End" && e.ctrlKey) {
      e.preventDefault()
      setActive(enabledIndexes[enabledIndexes.length - 1] ?? -1)
    } else if (e.key === "Enter") {
      e.preventDefault()
      choose(rows[active])
    }
  }

  const listId = `${uid}-list`
  const optionId = (i: number) => `${uid}-opt-${i}`
  let index = -1

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => setOpen(next)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="command-palette-backdrop"
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[3px] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
        />
        <DialogPrimitive.Popup
          data-slot="command-palette"
          initialFocus={inputRef}
          className={cn(
            "fixed top-[12vh] left-1/2 z-50 flex max-h-[min(30rem,76vh)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-3xl bg-popover text-popover-foreground shadow-surface outline-none",
            "transition-[opacity,scale,translate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:duration-120",
            "data-starting-style:-translate-y-2 data-starting-style:scale-97 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0",
            "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
            className
          )}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="p-2 pb-0">
            <label className="flex h-11 items-center gap-2.5 rounded-2xl bg-background dark:bg-input/32 px-3.5 shadow-well transition-[background-color]">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? optionId(active) : undefined}
                aria-label="Search commands"
                autoComplete="off"
                spellCheck={false}
                className="h-full min-w-0 flex-1 bg-transparent text-ui-lg outline-none placeholder:text-muted-foreground"
              />
              {hotkey && (
                <kbd className="hidden rounded-md bg-background px-1.5 py-0.5 font-mono text-ui-2xs text-muted-foreground shadow-chip sm:inline">
                  esc
                </kbd>
              )}
            </label>
          </div>

          <LayoutGroup id={uid}>
            <motion.div
              ref={listRef}
              layoutScroll
              id={listId}
              role="listbox"
              aria-label="Commands"
              className="min-h-0 flex-1 scroll-py-2 overflow-y-auto overscroll-contain p-2"
            >
              {rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-ui text-muted-foreground">
                  <SearchIcon className="size-5 opacity-60" />
                  {emptyMessage}
                </div>
              ) : (
                groups.map((group, g) => {
                  const headingId = `${uid}-group-${g}`
                  return (
                    <div key={group.heading} role="group" aria-labelledby={headingId} className="not-first:mt-1.5">
                      <div id={headingId} className="px-3 pt-1.5 pb-1 text-ui-sm font-medium text-muted-foreground">
                        {group.heading}
                      </div>
                      {group.list.map((match) => {
                        index += 1
                        const i = index
                        const { item } = match
                        const isActive = i === active
                        const Icon = item.icon
                        return (
                          <div
                            key={item.id}
                            id={optionId(i)}
                            data-index={i}
                            role="option"
                            aria-selected={isActive}
                            aria-disabled={item.disabled || undefined}
                            data-active={isActive || undefined}
                            onPointerMove={() => !item.disabled && active !== i && setActive(i)}
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => choose(match)}
                            className="relative flex h-8 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-ui select-none aria-disabled:opacity-45"
                          >
                            {isActive && (
                              <motion.span
                                layoutId="command-palette-active"
                                aria-hidden
                                className="absolute inset-0 rounded-lg bg-secondary"
                                transition={
                                  reduce ? { duration: 0 } : { type: "spring", stiffness: 600, damping: 42, mass: 0.6 }
                                }
                              />
                            )}
                            {Icon && (
                              <Icon
                                className={cn(
                                  "relative size-4 shrink-0 transition-colors",
                                  isActive ? "text-foreground" : "text-muted-foreground"
                                )}
                              />
                            )}
                            <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
                              <span className="truncate">
                                <Highlight text={item.label} indices={match.indices} />
                              </span>
                              {item.description && (
                                <span className="truncate text-ui-sm text-muted-foreground">{item.description}</span>
                              )}
                            </span>
                            {item.shortcut && (
                              <span className="relative flex shrink-0 items-center gap-1">
                                {item.shortcut.map((key) => (
                                  <kbd
                                    key={key}
                                    className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-muted px-1 font-mono text-ui-2xs text-muted-foreground shadow-chip"
                                  >
                                    {key}
                                  </kbd>
                                ))}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </motion.div>
          </LayoutGroup>

          {showFooter && (
            <div
              data-slot="command-palette-footer"
              aria-hidden
              className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-ui-xs text-muted-foreground"
            >
              <FooterHint keys={["↑", "↓"]}>Navigate</FooterHint>
              <FooterHint keys={["↵"]}>Open</FooterHint>
              <FooterHint keys={["esc"]}>Close</FooterHint>
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Highlight({ text, indices }: { text: string; indices: number[] }) {
  if (!indices.length) return <>{text}</>
  const set = new Set(indices)
  return (
    <>
      {Array.from(text).map((ch, i) =>
        set.has(i) ? (
          <mark key={i} className="bg-transparent font-semibold text-primary">
            {ch}
          </mark>
        ) : (
          <React.Fragment key={i}>{ch}</React.Fragment>
        )
      )}
    </>
  )
}

function FooterHint({ keys, children }: { keys: string[]; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys.map((k) => (
        <kbd
          key={k}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-muted px-1 font-mono text-ui-2xs shadow-chip"
        >
          {k}
        </kbd>
      ))}
      {children}
    </span>
  )
}

export { CommandPalette, fuzzyMatch }
export type { CommandPaletteItem, CommandPaletteProps }
