"use client";

import * as React from "react"
import { cva } from "class-variance-authority"
import { useLocale } from "@/ui/locale-provider"

import {
  AlignLeftIcon,
  BoltIcon,
  BracesIcon,
  ChevronDownIcon,
  CodeIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  ImageIcon,
  InfoIcon,
  LockIcon,
  PaletteIcon,
  SettingsIcon,
  TerminalIcon,
  TypeIcon,
} from "@/components/icons"
import { cn } from "@/lib/utils"

/*
 * File / folder primitives, laid out like a file explorer. <FileTreeFolder> and <FileTreeFile> are
 * declarative: <FileTree> reads them into one flattened, keyboard-navigable collection (WAI-ARIA
 * tree pattern, roving tabindex, typeahead). Geometry: rounded 32px rows 2px apart (`size="sm"`:
 * 24px rows that touch), 20px indent per level. A folder row is chevron + folder icon (open or
 * closed) + name; a file row skips the chevron's column, so its type icon lines up under the
 * folder icons at the same level. Nothing animates: rows appear and the chevron turns on the click.
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

type FileKind = { icon: React.ReactNode; className: string }

const KINDS: Record<string, FileKind> = {
  ts: { icon: <CodeIcon />, className: "text-chart-7" },
  js: { icon: <CodeIcon />, className: "text-chart-6" },
  code: { icon: <CodeIcon />, className: "text-chart-3" },
  markup: { icon: <CodeIcon />, className: "text-chart-2" },
  style: { icon: <PaletteIcon />, className: "text-chart-5" },
  data: { icon: <BracesIcon />, className: "text-chart-6" },
  text: { icon: <TypeIcon />, className: "text-chart-1" },
  image: { icon: <ImageIcon />, className: "text-chart-4" },
  shell: { icon: <TerminalIcon />, className: "text-chart-4" },
  config: { icon: <SettingsIcon />, className: "text-muted-foreground" },
  readme: { icon: <InfoIcon />, className: "text-chart-1" },
  log: { icon: <AlignLeftIcon />, className: "text-muted-foreground" },
  tool: { icon: <BoltIcon />, className: "text-chart-6" },
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
  log: "log", bat: "shell", cmd: "shell",
  sh: "shell", bash: "shell", zsh: "shell", fish: "shell", ps1: "shell",
  env: "config", ini: "config", conf: "config", config: "config", gitignore: "config", npmrc: "config", editorconfig: "config",
  lock: "lock", pem: "lock", key: "lock",
}

/** The file-type icon and tint the tree shows for a file name (by extension). */
function getFileKind(name: string): FileKind {
  const lower = name.toLowerCase()
  if (lower.startsWith(".env")) return KINDS.config
  if (lower.startsWith("readme")) return KINDS.readme
  // Build-tool configs (vite.config.ts, next.config.mjs…) get the tool mark, like an editor's explorer.
  if (/^[a-z0-9-]+\.config\.[cm]?[jt]s$/.test(lower)) return KINDS.tool
  if (lower === "dockerfile" || lower.startsWith(".docker") || lower.startsWith("docker-compose")) return KINDS.shell
  const dot = lower.lastIndexOf(".")
  const ext = dot === -1 ? "" : lower.slice(dot + 1)
  return KINDS[EXT[ext] ?? "file"]
}

/** Left padding of a depth-0 row, px. */
const PAD = { default: 8, sm: 6 } as const
/** Chevron (16px) + gap (4px): how far a file's icon sits in, so it lines up with folder icons. */
const CHEVRON = 20

/**
 * `default` takes the surface it sits on (the page, a sidebar, a panel), like an editor's
 * explorer; `card` puts it on its own raised card. `ghost` is the same as `default`.
 */
const fileTreeVariants = cva("group/file-tree relative flex min-w-0 flex-col text-foreground", {
  variants: {
    variant: {
      default: "",
      ghost: "",
      card: "frame-xl frame-p-2 bg-card shadow-raised",
    },
    size: {
      default: "gap-0.5 text-ui-lg",
      sm: "text-ui",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
})

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
  /** Indent per level, px (20, or 12 at `size="sm"`). */
  indent?: number
  /** Surface: `default` (and `ghost`) take the parent's background, `card` raises its own. */
  variant?: "default" | "ghost" | "card"
  /** Row size: `default` 32px rounded rows, `sm` 24px editor-density rows. */
  size?: "default" | "sm"
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
  indent: indentProp,
  label,
  variant = "default",
  size = "default",
  className,
  ...props
}: FileTreeProps) {
  const l10n = useLocale().labels
  const indent = indentProp ?? (size === "sm" ? 12 : 20)
  if (label === undefined) label = l10n.files

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
      data-slot="file-tree"
      data-variant={variant}
      data-size={size}
      className={cn(fileTreeVariants({ variant, size }), className)}
      {...props}
      aria-label={props["aria-label"] ?? label}
    >
      {rows.map((row) => {
        const { node } = row
        const isFolder = node.type === "folder"
        const isOpen = isFolder && open.has(node.value)
        const isSelected = selected === node.value
        return (
          <div
            key={node.value}
            ref={(el: HTMLDivElement | null) => {
              if (el) refs.current.set(node.value, el)
              else refs.current.delete(node.value)
            }}
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
            style={{ paddingLeft: PAD[size] + row.depth * indent + (isFolder ? 0 : CHEVRON) }}
            className={cn(
              "relative flex shrink-0 cursor-pointer items-center gap-2 pr-2 outline-none select-none",
              size === "sm" ? "h-6" : "h-8 rounded-md",
              "group-data-[variant=card]/file-tree:rounded-inner-or-sm",
              // Hover and selection fills are the theme's own tokens, so the tree reads on any surface.
              "hover:bg-accent",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              isSelected && "bg-accent text-accent-foreground",
              node.disabled && "cursor-not-allowed opacity-45 hover:bg-transparent",
              node.className
            )}
          >
            {isFolder && (
              <span
                aria-hidden
                data-slot="file-tree-chevron"
                className={cn(
                  "-me-1 grid size-4 shrink-0 place-items-center text-muted-foreground [&_svg]:size-4",
                  !isOpen && "-rotate-90 rtl:rotate-90"
                )}
              >
                <ChevronDownIcon />
              </span>
            )}
            <span
              aria-hidden
              data-slot="file-tree-icon"
              className={cn(
                "grid size-4 shrink-0 place-items-center [&_svg]:size-4",
                !node.icon && (isFolder ? "text-chart-6" : getFileKind(node.name).className)
              )}
            >
              {node.icon ?? (isFolder ? isOpen ? <FolderOpenIcon /> : <FolderIcon /> : getFileKind(node.name).icon)}
            </span>

            <span data-slot="file-tree-label" className="min-w-0 flex-1 truncate">
              {node.name}
            </span>
            {node.meta != null && <span className="shrink-0 text-ui-sm text-muted-foreground">{node.meta}</span>}
          </div>
        )
      })}
    </div>
  )
}

export { FileTree, FileTreeFolder, FileTreeFile, getFileKind, fileTreeVariants }
export type { FileTreeProps, FileTreeNode, FileTreeItem, FileTreeFolderProps, FileTreeFileProps, FileKind }
