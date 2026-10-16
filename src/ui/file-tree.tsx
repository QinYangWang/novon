"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import {
  BracesIcon,
  ChevronRightIcon,
  CodeIcon,
  FileIcon,
  ImageIcon,
  LockIcon,
  PaletteIcon,
  SettingsIcon,
  TerminalIcon,
  TypeIcon,
} from "@/components/icons"
import { cn } from "@/lib/utils"

/*
 * File / folder primitives. <FileTreeFolder> and <FileTreeFile> are
 * declarative: <FileTree> reads them into one flattened, keyboard-navigable
 * collection (WAI-ARIA tree pattern, roving tabindex, typeahead). Density and
 * geometry: 22px rows, 12px indent per level and one 16px leading slot per
 * row. A folder's slot holds its chevron, a file's slot holds its file-type
 * icon, so at the same level chevrons and file icons share one column. A thin
 * indent guide runs under each open folder's chevron. Rows spring in and out as folders open and the selection
 * is one fill that glides between rows.
 */

type FileTreeNode = {
  value: string
  name: string
  type: "file" | "folder"
  icon?: React.ReactNode
  /** Trailing content (status dot, size, badge). */
  meta?: React.ReactNode
  disabled?: boolean
  className?: string
  children?: FileTreeNode[]
}

/**
 * Input shape for `items` and the declarative parts: `value` is optional and defaults to the
 * path from the root (`parent/name`, or `name` at the top level).
 */
type FileTreeItem = Omit<FileTreeNode, "value" | "children"> & { value?: string; children?: FileTreeItem[] }

type FileTreeFolderProps = Omit<FileTreeItem, "type" | "children"> & { children?: React.ReactNode }
type FileTreeFileProps = Omit<FileTreeItem, "type" | "children">

/** Declarative folder; rendered by <FileTree>, renders nothing on its own. */
function FileTreeFolder(props: FileTreeFolderProps) {
  void props
  return null
}

/** Declarative file; rendered by <FileTree>, renders nothing on its own. */
function FileTreeFile(props: FileTreeFileProps) {
  void props
  return null
}

type Row = { node: FileTreeNode; depth: number; parent: string | null; pos: number; size: number }

function readNodes(children: React.ReactNode): FileTreeItem[] {
  const out: FileTreeItem[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === React.Fragment) {
      out.push(...readNodes((child.props as { children?: React.ReactNode }).children))
    } else if (child.type === FileTreeFolder) {
      const { children: kids, ...p } = child.props as FileTreeFolderProps
      out.push({ ...p, type: "folder", children: readNodes(kids) })
    } else if (child.type === FileTreeFile) {
      out.push({ ...(child.props as FileTreeFileProps), type: "file" })
    }
  })
  return out
}

// Typed here so apps without Node types compile; bundlers replace process.env.NODE_ENV at build time.
declare const process: { env: { NODE_ENV?: string } }

function isDev() {
  try {
    return process.env.NODE_ENV !== "production"
  } catch {
    return false
  }
}

/** Fill in missing values with the node's path and warn (in development) about duplicates. */
function resolveNodes(items: FileTreeItem[], parent: string | null = null, seen = new Set<string>()): FileTreeNode[] {
  return items.map((item) => {
    const value = item.value ?? (parent === null ? item.name : `${parent}/${item.name}`)
    if (seen.has(value) && isDev()) {
      console.warn(`FileTree: two nodes share the value "${value}". Give one of them a unique \`value\`.`)
    }
    seen.add(value)
    const { children, ...rest } = item
    return { ...rest, value, children: children ? resolveNodes(children, value, seen) : undefined }
  })
}

function flatten(nodes: FileTreeNode[], open: ReadonlySet<string>, depth = 0, parent: string | null = null): Row[] {
  return nodes.flatMap((node, i) => {
    const row: Row = { node, depth, parent, pos: i + 1, size: nodes.length }
    if (node.type !== "folder" || !open.has(node.value) || !node.children?.length) return [row]
    return [row, ...flatten(node.children, open, depth + 1, node.value)]
  })
}

function siblingsOf(nodes: FileTreeNode[], value: string): FileTreeNode[] | null {
  for (const n of nodes) {
    if (n.value === value) return nodes
    if (n.children) {
      const hit = siblingsOf(n.children, value)
      if (hit) return hit
    }
  }
  return null
}

const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.6 } as const
type FileKind = { icon: React.ReactNode; className: string }

const KINDS: Record<string, FileKind> = {
  ts: { icon: <CodeIcon />, className: "text-sky-600 dark:text-sky-400" },
  js: { icon: <CodeIcon />, className: "text-amber-600 dark:text-amber-400" },
  code: { icon: <CodeIcon />, className: "text-violet-600 dark:text-violet-400" },
  markup: { icon: <CodeIcon />, className: "text-orange-600 dark:text-orange-400" },
  style: { icon: <PaletteIcon />, className: "text-pink-600 dark:text-pink-400" },
  data: { icon: <BracesIcon />, className: "text-yellow-600 dark:text-yellow-400" },
  text: { icon: <TypeIcon />, className: "text-blue-600 dark:text-blue-400" },
  image: { icon: <ImageIcon />, className: "text-emerald-600 dark:text-emerald-400" },
  shell: { icon: <TerminalIcon />, className: "text-green-600 dark:text-green-400" },
  config: { icon: <SettingsIcon />, className: "text-muted-foreground" },
  lock: { icon: <LockIcon />, className: "text-muted-foreground" },
  file: { icon: <FileIcon />, className: "text-muted-foreground" },
}

const EXT: Record<string, keyof typeof KINDS> = {
  ts: "ts", tsx: "ts", mts: "ts", cts: "ts",
  js: "js", jsx: "js", mjs: "js", cjs: "js",
  py: "code", go: "code", rs: "code", rb: "code", java: "code", kt: "code", swift: "code", c: "code", h: "code",
  cpp: "code", cs: "code", php: "code", vue: "code", svelte: "code", astro: "code", sql: "code",
  html: "markup", htm: "markup", xml: "markup", mdx: "markup",
  css: "style", scss: "style", sass: "style", less: "style",
  json: "data", jsonc: "data", yaml: "data", yml: "data", toml: "data", csv: "data",
  md: "text", txt: "text", rst: "text",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", avif: "image", svg: "image", ico: "image",
  sh: "shell", bash: "shell", zsh: "shell", fish: "shell", ps1: "shell",
  env: "config", ini: "config", conf: "config", config: "config", gitignore: "config", npmrc: "config", editorconfig: "config",
  lock: "lock", pem: "lock", key: "lock",
}

/** The file-type icon and tint the tree shows for a file name (by extension). */
function getFileKind(name: string): FileKind {
  const lower = name.toLowerCase()
  if (lower.startsWith(".env")) return KINDS.config
  const dot = lower.lastIndexOf(".")
  const ext = dot === -1 ? "" : lower.slice(dot + 1)
  return KINDS[EXT[ext] ?? "file"]
}

const POP = { type: "spring", stiffness: 520, damping: 26, mass: 0.5 } as const
const EASE = [0.22, 1, 0.36, 1] as const
/** Left padding of a depth-0 row, px. */
const PAD = 4

type FileTreeProps = Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "onChange"> & {
  children?: React.ReactNode
  /** Data alternative to declarative children. */
  items?: FileTreeItem[]
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string, node: FileTreeNode) => void
  expanded?: string[]
  defaultExpanded?: string[]
  onExpandedChange?: (expanded: string[]) => void
  /** Called when a file (not a folder) is activated with Enter or a click. */
  onOpenFile?: (node: FileTreeNode) => void
  /** Indent per level, px. */
  indent?: number
  label?: string
}

function FileTree({
  children,
  items,
  value,
  defaultValue = null,
  onValueChange,
  expanded: expandedProp,
  defaultExpanded = [],
  onExpandedChange,
  onOpenFile,
  indent = 12,
  label = "Files",
  className,
  ...props
}: FileTreeProps) {
  const reduce = useReducedMotion() ?? false
  // Guides grow in only for rows that appear after mount (a folder opening); rows that are
  // there from the start draw their guides immediately, so a guide never stays at scale 0.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const pillId = `file-tree-pill-${React.useId()}`
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded)
  const selected = value === undefined ? internalValue : value
  const expandedList = expandedProp ?? internalExpanded
  const open = React.useMemo(() => new Set(expandedList), [expandedList])
  const nodes = React.useMemo(() => resolveNodes(items ?? readNodes(children)), [items, children])
  const rows = React.useMemo(() => flatten(nodes, open), [nodes, open])

  const [focused, setFocused] = React.useState<string | null>(selected)
  const refs = React.useRef(new Map<string, HTMLDivElement>())
  const typeahead = React.useRef({ text: "", timer: 0 })

  // Keep one real row tabbable, also after a collapse removed the focused one.
  const tabbable = focused !== null && rows.some((r) => r.node.value === focused) ? focused : (rows[0]?.node.value ?? null)

  const focusRow = React.useCallback((id: string) => {
    setFocused(id)
    const el = refs.current.get(id)
    if (el) el.focus()
    else requestAnimationFrame(() => refs.current.get(id)?.focus())
  }, [])

  const setExpanded = (next: string[]) => {
    if (expandedProp === undefined) setInternalExpanded(next)
    onExpandedChange?.(next)
  }
  const toggle = (id: string, force?: boolean) => {
    const next = new Set(expandedList)
    const willOpen = force ?? !next.has(id)
    if (willOpen) next.add(id)
    else next.delete(id)
    setExpanded(Array.from(next))
  }
  const select = (node: FileTreeNode) => {
    if (node.disabled) return
    if (value === undefined) setInternalValue(node.value)
    onValueChange?.(node.value, node)
  }
  const activate = (row: Row) => {
    if (row.node.disabled) return
    select(row.node)
    if (row.node.type === "folder") toggle(row.node.value)
    else onOpenFile?.(row.node)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, row: Row) => {
    const i = rows.findIndex((r) => r.node.value === row.node.value)
    const isFolder = row.node.type === "folder"
    const isOpen = open.has(row.node.value)
    const next = rows[i + 1]
    const go = (r: Row | undefined) => {
      if (!r) return
      e.preventDefault()
      focusRow(r.node.value)
    }
    switch (e.key) {
      case "ArrowDown":
        return go(next)
      case "ArrowUp":
        return go(rows[i - 1])
      case "Home":
        return go(rows[0])
      case "End":
        return go(rows[rows.length - 1])
      case "ArrowRight":
        e.preventDefault()
        if (!isFolder || row.node.disabled) return
        if (!isOpen) toggle(row.node.value, true)
        else if (next?.parent === row.node.value) focusRow(next.node.value)
        return
      case "ArrowLeft":
        e.preventDefault()
        if (isFolder && isOpen && !row.node.disabled) toggle(row.node.value, false)
        else if (row.parent) focusRow(row.parent)
        return
      case "Enter":
      case " ":
        e.preventDefault()
        return activate(row)
      case "*": {
        // expand every sibling folder (WAI-ARIA tree convention)
        e.preventDefault()
        const sibs = siblingsOf(nodes, row.node.value) ?? []
        const nextOpen = new Set(expandedList)
        sibs.forEach((s) => s.type === "folder" && !s.disabled && nextOpen.add(s.value))
        setExpanded(Array.from(nextOpen))
        return
      }
    }
    // typeahead: jump to the next visible row whose name starts with the typed text
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const t = typeahead.current
      window.clearTimeout(t.timer)
      t.text += e.key.toLowerCase()
      t.timer = window.setTimeout(() => (t.text = ""), 600)
      const order = [...rows.slice(i + (t.text.length === 1 ? 1 : 0)), ...rows.slice(0, i + 1)]
      const hit = order.find((r) => r.node.name.toLowerCase().startsWith(t.text))
      if (hit) {
        e.preventDefault()
        focusRow(hit.node.value)
      }
    }
  }

  return (
    <div
      role="tree"
      aria-label={label}
      data-slot="file-tree"
      className={cn("flex min-w-0 flex-col text-ui", className)}
      {...props}
    >
      <AnimatePresence initial={false}>
        {rows.map((row) => {
          const { node } = row
          const isFolder = node.type === "folder"
          const isOpen = isFolder && open.has(node.value)
          const isSelected = selected === node.value
          return (
            <motion.div
              key={node.value}
              ref={(el: HTMLDivElement | null) => {
                if (el) refs.current.set(node.value, el)
                else refs.current.delete(node.value)
              }}
              layout={reduce ? false : "position"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
              animate={{ opacity: node.disabled ? 0.45 : 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.12, ease: EASE } }}
              transition={reduce ? { duration: 0.12 } : { ...SPRING, opacity: { duration: 0.2, ease: EASE, delay: Math.min(row.pos * 0.02, 0.12) } }}
              role="treeitem"
              aria-level={row.depth + 1}
              aria-posinset={row.pos}
              aria-setsize={row.size}
              aria-selected={isSelected}
              aria-expanded={isFolder ? isOpen : undefined}
              aria-disabled={node.disabled || undefined}
              tabIndex={tabbable === node.value ? 0 : -1}
              data-slot="file-tree-item"
              data-type={node.type}
              data-selected={isSelected || undefined}
              onFocus={(e) => e.target === e.currentTarget && setFocused(node.value)}
              onKeyDown={(e) => e.target === e.currentTarget && onKeyDown(e, row)}
              onClick={() => {
                setFocused(node.value)
                activate(row)
              }}
              style={{ paddingLeft: PAD + row.depth * indent }}
              className={cn(
                "group/file-tree-item relative flex h-[22px] shrink-0 cursor-pointer items-center gap-1.5 rounded-inner-or-sm pr-2 text-muted-foreground outline-none select-none",
                "focus-visible:ring-inset",
                "transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                isSelected && "font-medium text-foreground",
                node.disabled && "cursor-not-allowed hover:text-muted-foreground",
                node.className
              )}
            >
              {isSelected && (
                <motion.span
                  layoutId={pillId}
                  aria-hidden
                  transition={reduce ? { duration: 0 } : SPRING}
                  className="absolute inset-0 rounded-inner-or-sm bg-secondary"
                />
              )}
              {!isSelected && (
                <span aria-hidden className="absolute inset-0 rounded-inner-or-sm transition-colors group-hover/file-tree-item:bg-muted/60" />
              )}

              {/* indent guides, one per ancestor level, under that ancestor's chevron */}
              {Array.from({ length: row.depth }, (_, d) => (
                <motion.span
                  key={d}
                  aria-hidden
                  initial={reduce || !mounted ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: reduce ? 0 : 0.28, ease: EASE }}
                  style={{ left: PAD + d * indent + 7 }}
                  className="absolute inset-y-0 z-10 w-px origin-top bg-foreground/15"
                />
              ))}

              {/* one leading slot: the chevron for a folder, the file-type icon for a file */}
              {isFolder ? (
                <motion.span
                  aria-hidden
                  data-slot="file-tree-chevron"
                  initial={false}
                  animate={{ rotate: isOpen ? 90 : 0 }}
                  transition={reduce ? { duration: 0 } : POP}
                  className={cn(
                    "relative z-10 grid size-4 shrink-0 place-items-center text-muted-foreground transition-colors [&_svg]:size-3",
                    isOpen && "text-foreground"
                  )}
                >
                  {node.icon ?? <ChevronRightIcon />}
                </motion.span>
              ) : (
                <span
                  aria-hidden
                  data-slot="file-tree-icon"
                  className={cn("relative z-10 grid size-4 shrink-0 place-items-center [&_svg]:size-4", !node.icon && getFileKind(node.name).className)}
                >
                  {node.icon ?? getFileKind(node.name).icon}
                </span>
              )}

              <span data-slot="file-tree-label" className="relative z-10 min-w-0 flex-1 truncate">
                {node.name}
              </span>
              {node.meta != null && <span className="relative z-10 shrink-0 text-ui-sm text-muted-foreground">{node.meta}</span>}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export { FileTree, FileTreeFolder, FileTreeFile, getFileKind }
export type { FileTreeProps, FileTreeNode, FileTreeItem, FileTreeFolderProps, FileTreeFileProps, FileKind }
