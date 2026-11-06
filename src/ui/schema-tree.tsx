"use client";

import * as React from "react"

import { Badge } from "@/ui/badge"
import { useLocale } from "@/ui/locale-provider"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/ui/tabs"
import { ChevronDownIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

/*
 * The properties of a JSON Schema as a table that nests: object and array rows expand to their
 * fields, `oneOf` / `anyOf` show their options as tabs, and each row carries its type, markers
 * (required, read-only, deprecated), description, allowed values and default.
 *
 *   <SchemaTree schema={{ type: "object", required: ["name"], properties: { name: { type: "string" } } }} />
 *
 * Wide containers get three columns (property, type, description) on a header band, in the same
 * surface as SimpleTable; under 32rem of its own width (a phone, a narrow column) each row stacks
 * its name and type over its description. Rows are read lazily, so a schema can be large.
 */

type SchemaPrimitive = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null"

/** The JSON Schema subset the tree reads. Anything else on the object is ignored. */
interface SchemaNode {
  type?: SchemaPrimitive | (string & {}) | readonly (SchemaPrimitive | (string & {}))[]
  /** Names the schema in types (`Pet[]`) and in option tabs. */
  title?: string
  /** Text or rich content. */
  description?: React.ReactNode
  properties?: Record<string, SchemaNode>
  /** Required property names (on the parent), or `true` on the property itself. */
  required?: readonly string[] | boolean
  items?: SchemaNode
  enum?: readonly unknown[]
  const?: unknown
  default?: unknown
  format?: string
  readOnly?: boolean
  deprecated?: boolean
  /** Adds `| null` to the type. */
  nullable?: boolean
  oneOf?: readonly SchemaNode[]
  anyOf?: readonly SchemaNode[]
}

/** What a render override knows about the row it draws. */
type SchemaRowContext = {
  /** Property name; empty for an option without properties. */
  name: string
  /** Names from the root, array levels marked with `[]`: `data[].name`. */
  path: string
  depth: number
  required: boolean
  schema: SchemaNode
}

type SchemaTreeProps = Omit<React.ComponentProps<"div">, "children"> & {
  schema: SchemaNode
  /** Rows above this depth start open: `0` collapses everything, `Infinity` opens everything. */
  defaultExpandDepth?: number
  /** `auto`: columns from 32rem of the tree's own width, stacked below. `stacked`: always stacked. */
  layout?: "auto" | "stacked"
  /** Replaces the property name. */
  renderName?: (ctx: SchemaRowContext) => React.ReactNode
  /** Replaces the type label. */
  renderType?: (ctx: SchemaRowContext) => React.ReactNode
  /** Replaces the description, for example with your own Markdown renderer. */
  renderDescription?: (ctx: SchemaRowContext) => React.ReactNode
  /**
   * `markdown` renders inline Markdown in string descriptions: code, emphasis, strong and links
   * (http(s), relative and `#` only). HTML stays text. Default `text`.
   */
  descriptionFormat?: "text" | "markdown"
}

/* Type labels */

const typesOf = (s: SchemaNode): string[] => {
  if (Array.isArray(s.type)) return [...s.type]
  if (typeof s.type === "string") return [s.type]
  if (s.properties) return ["object"]
  if (s.items) return ["array"]
  const sample = s.enum?.find((v) => v !== null) ?? s.const
  if (sample !== undefined) return [Array.isArray(sample) ? "array" : typeof sample === "number" ? "number" : typeof sample]
  return []
}

const wrap = (label: string) => (label.includes(" | ") ? `(${label})` : label)

/** The short type a row shows: `string<date-time>`, `Pet[]`, `string | null`, `Card | BankAccount`. */
function schemaTypeLabel(s: SchemaNode): string {
  const variants = s.oneOf ?? s.anyOf
  let label: string
  const types = typesOf(s)
  if (!types.length && variants?.length) {
    label = variants.map((v) => v.title ?? schemaTypeLabel(v)).join(" | ")
  } else if (!types.length) {
    label = "any"
  } else {
    label = types
      .map((t) => {
        if (t === "array") return `${s.items ? wrap(s.items.title ?? schemaTypeLabel(s.items)) : "any"}[]`
        if (t === "object" && s.title) return s.title
        return s.format && t !== "null" ? `${t}<${s.format}>` : t
      })
      .join(" | ")
  }
  return s.nullable && !types.includes("null") ? `${label} | null` : label
}

/* Structure */

/** The level an array row opens to: its items, through any nested arrays. */
const unwrap = (s: SchemaNode) => {
  let node = s
  let path = ""
  for (let i = 0; node.items && typesOf(node).includes("array") && i < 16; i++) {
    node = node.items
    path += "[]"
  }
  return { node, path }
}

const optionsOf = (s: SchemaNode) =>
  s.oneOf?.length ? { kind: "oneOf" as const, options: s.oneOf } : s.anyOf?.length ? { kind: "anyOf" as const, options: s.anyOf } : null

const hasChildren = (s: SchemaNode) => {
  const { node } = unwrap(s)
  return !!(node.properties && Object.keys(node.properties).length) || !!optionsOf(node)
}

/** Whether any row in the tree expands, so leaf names keep the chevron's column only when needed. */
function anyExpandable(s: SchemaNode, seen = new WeakSet<object>()): boolean {
  if (seen.has(s)) return false
  seen.add(s)
  const { node } = unwrap(s)
  const opts = optionsOf(node)
  if (opts?.options.some((o) => (o.properties && Object.keys(o.properties).length) || anyExpandable(o, seen))) return true
  return Object.values(node.properties ?? {}).some((p) => hasChildren(p) || anyExpandable(p, seen))
}

const isRequired = (parent: SchemaNode, name: string, child: SchemaNode) =>
  child.required === true || (Array.isArray(parent.required) && parent.required.includes(name))

const json = (v: unknown) => {
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}

/* Inline Markdown for descriptions (`descriptionFormat="markdown"`)
 *
 * Code spans, emphasis, strong and links only. The result is React text and elements, so HTML in a
 * description stays text; links keep only http(s), relative and `#` targets, anything else shows its label. */

type InlineNode =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "em" | "strong"; c: InlineNode[] }
  | { t: "link"; href: string; c: InlineNode[] }

const PUNCT = /[!-/:-@[-`{-~]/
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c)
const isWord = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c)

/** Absolute http(s) URLs, `#fragments` and relative paths only. */
function safeHref(raw: string): string | null {
  const href = raw.trim()
  if (!href || /[\s<>"\\]/.test(href)) return null
  if (/^https?:\/\//i.test(href)) return href
  // A scheme is letters before the first `:` that come before any `/`, `?` or `#`; relative links have none.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null
  if (href.startsWith("//")) return null
  return href
}

/** Finds the closing delimiter for emphasis that opened at `from`. */
function findClose(s: string, from: number, delim: string): number {
  for (let i = from; i < s.length; i++) {
    const ch = s[i]
    if (ch === "\\") {
      i++
      continue
    }
    if (ch === "`") {
      const run = /^`+/.exec(s.slice(i))![0]
      const end = s.indexOf(run, i + run.length)
      if (end !== -1) i = end + run.length - 1
      continue
    }
    if (s.startsWith(delim, i) && !isSpace(s[i - 1]) && i > from) {
      // `*` closing `*` must not be half of `**`.
      if (delim.length === 1 && (s[i + 1] === delim || s[i - 1] === delim)) continue
      if (delim[0] === "_" && isWord(s[i + delim.length])) continue
      return i
    }
  }
  return -1
}

function parseInline(s: string, depth = 0, inLink = false): InlineNode[] {
  const out: InlineNode[] = []
  let text = ""
  const flush = () => {
    if (text) out.push({ t: "text", v: text })
    text = ""
  }
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === "\\" && i + 1 < s.length && PUNCT.test(s[i + 1])) {
      text += s[i + 1]
      i += 2
      continue
    }
    if (ch === "`") {
      const run = /^`+/.exec(s.slice(i))![0]
      const end = s.indexOf(run, i + run.length)
      // A closing run must be exactly as long.
      if (end !== -1 && s[end + run.length] !== "`") {
        let code = s.slice(i + run.length, end).replace(/\n/g, " ")
        if (code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim()) code = code.slice(1, -1)
        flush()
        out.push({ t: "code", v: code })
        i = end + run.length
        continue
      }
      text += run
      i += run.length
      continue
    }
    if (ch === "[" && !inLink && depth < 8) {
      const close = matchBracket(s, i)
      if (close !== -1 && s[close + 1] === "(") {
        const paren = matchParen(s, close + 1)
        if (paren !== -1) {
          // Drop an optional `"title"` after the URL.
          const dest = s.slice(close + 2, paren).trim().replace(/\s+"[^"]*"$/, "").replace(/^<(.*)>$/, "$1")
          const href = safeHref(dest)
          const label = parseInline(s.slice(i + 1, close), depth + 1, true)
          flush()
          if (href) out.push({ t: "link", href, c: label })
          else out.push(...label)
          i = paren + 1
          continue
        }
      }
    }
    if ((ch === "*" || ch === "_") && depth < 8) {
      const strong = s[i + 1] === ch
      const delim = strong ? ch + ch : ch
      const after = s[i + delim.length]
      const leftOk = !isSpace(after) && !(ch === "_" && isWord(s[i - 1]))
      if (leftOk) {
        const end = findClose(s, i + delim.length, delim)
        if (end !== -1) {
          flush()
          out.push({ t: strong ? "strong" : "em", c: parseInline(s.slice(i + delim.length, end), depth + 1, inLink) })
          i = end + delim.length
          continue
        }
      }
      text += delim
      i += delim.length
      continue
    }
    text += ch
    i++
  }
  flush()
  return out
}

/** The `)` that closes the `(` at `open`, allowing balanced parentheses inside the URL. */
function matchParen(s: string, open: number): number {
  let level = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") i++
    else if (s[i] === "(") level++
    else if (s[i] === ")" && --level === 0) return i
  }
  return -1
}

function matchBracket(s: string, open: number): number {
  let level = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") {
      i++
      continue
    }
    if (s[i] === "`") {
      const run = /^`+/.exec(s.slice(i))![0]
      const end = s.indexOf(run, i + run.length)
      if (end !== -1) i = end + run.length - 1
      continue
    }
    if (s[i] === "[") level++
    else if (s[i] === "]" && --level === 0) return i
  }
  return -1
}

const mdLink =
  "font-medium text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:rounded-2xs focus-visible:ring-2 focus-visible:ring-ring"

function renderInline(nodes: InlineNode[]): React.ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return n.v
      case "code":
        return <code key={i}>{n.v}</code>
      case "em":
        return <em key={i}>{renderInline(n.c)}</em>
      case "strong":
        return (
          <strong key={i} className="font-medium text-foreground">
            {renderInline(n.c)}
          </strong>
        )
      case "link":
        return (
          <a key={i} href={n.href} className={mdLink}>
            {renderInline(n.c)}
          </a>
        )
    }
  })
}

/** Inline Markdown in a string description as React nodes. */
function InlineMarkdown({ text }: { text: string }) {
  const nodes = React.useMemo(() => parseInline(text), [text])
  return <>{renderInline(nodes)}</>
}

/* Rendering */

type TreeContext = Pick<SchemaTreeProps, "renderName" | "renderType" | "renderDescription" | "descriptionFormat"> & {
  defaultExpandDepth: number
  chevronColumn: boolean
}

const TreeContext = React.createContext<TreeContext>({ defaultExpandDepth: 1, chevronColumn: false })

// Every class that applies only with columns carries the container variant; without it the row stacks.
const rowClass = cn(
  "flex flex-col gap-1.5 border-t border-border py-2.5 ps-[calc(1rem+var(--schema-depth,0)*1rem)] pe-4",
  "@lg/schema-tree:col-span-full @lg/schema-tree:grid @lg/schema-tree:grid-cols-subgrid @lg/schema-tree:gap-0 @lg/schema-tree:p-0"
)
const cellClass = "min-w-0 @lg/schema-tree:border-e @lg/schema-tree:border-border @lg/schema-tree:px-4 @lg/schema-tree:py-2.5 @lg/schema-tree:last:border-e-0"
const nameCellClass = "@lg/schema-tree:ps-[calc(1rem+var(--schema-depth,0)*1.25rem)]"
// With an expandable row anywhere in the tree, names start after the chevron's gutter so every level lines up.
const gutterClass = "ps-5 @lg/schema-tree:ps-[calc(2.25rem+var(--schema-depth,0)*1.25rem)]"
const codeChip = "rounded-md bg-muted px-1.5 py-0.5 font-mono text-ui-sm text-foreground"
// Bare `<code>` in a description (what Markdown writes) gets the same chip; code you style yourself is left alone.
const descriptionCode =
  "[&_code:not([class])]:rounded-md [&_code:not([class])]:bg-muted [&_code:not([class])]:px-1.5 [&_code:not([class])]:py-0.5 [&_code:not([class])]:font-mono [&_code:not([class])]:text-ui-sm [&_code:not([class])]:text-foreground"
const depthStyle = (depth: number) => ({ "--schema-depth": depth }) as React.CSSProperties

function SchemaTree({
  schema,
  defaultExpandDepth = 1,
  layout = "auto",
  renderName,
  renderType,
  renderDescription,
  descriptionFormat = "text",
  className,
  ...props
}: SchemaTreeProps) {
  const { labels } = useLocale()
  const chevronColumn = React.useMemo(() => anyExpandable(schema), [schema])
  const ctx = React.useMemo(
    () => ({ defaultExpandDepth, chevronColumn, renderName, renderType, renderDescription, descriptionFormat }),
    [defaultExpandDepth, chevronColumn, renderName, renderType, renderDescription, descriptionFormat]
  )
  const { node, path } = unwrap(schema)

  return (
    <TreeContext.Provider value={ctx}>
      <div
        data-slot="schema-tree"
        data-layout={layout}
        className={cn(layout === "auto" && "@container/schema-tree", "w-full min-w-0", className)}
        {...props}
      >
        <div
          role="table"
          data-slot="schema-tree-table"
          className={cn(
            "overflow-x-auto rounded-xl bg-background text-sm shadow-raised",
            "@lg/schema-tree:grid @lg/schema-tree:grid-cols-[minmax(9rem,max-content)_minmax(5rem,max-content)_minmax(12rem,1fr)] @lg/schema-tree:bg-muted/50 @lg/schema-tree:dark:bg-muted"
          )}
        >
          <div
            role="row"
            data-slot="schema-tree-header"
            className="sr-only @lg/schema-tree:not-sr-only @lg/schema-tree:col-span-full @lg/schema-tree:grid @lg/schema-tree:grid-cols-subgrid"
          >
            {[labels.schemaProperty, labels.schemaType, labels.description].map((label) => (
              <div
                key={label}
                role="columnheader"
                className="text-start font-medium text-foreground @lg/schema-tree:border-e @lg/schema-tree:border-border @lg/schema-tree:px-4 @lg/schema-tree:py-2 @lg/schema-tree:last:border-e-0"
              >
                {label}
              </div>
            ))}
          </div>
          <div
            role="rowgroup"
            data-slot="schema-tree-body"
            className="bg-background [&>[data-slot]:first-child]:border-t-0 @lg/schema-tree:col-span-full @lg/schema-tree:grid @lg/schema-tree:grid-cols-subgrid @lg/schema-tree:rounded-t-xl @lg/schema-tree:border-t @lg/schema-tree:border-border"
          >
            <SchemaLevel schema={node} depth={0} path={path} />
          </div>
        </div>
      </div>
    </TreeContext.Provider>
  )
}

/** The rows of one object level, or its options when it has `oneOf` / `anyOf`. */
function SchemaLevel({ schema, depth, path }: { schema: SchemaNode; depth: number; path: string }) {
  const opts = optionsOf(schema)
  return (
    <>
      {Object.entries(schema.properties ?? {}).map(([name, child]) => (
        <SchemaRow
          key={name}
          name={name}
          schema={child}
          depth={depth}
          path={path ? `${path}.${name}` : name}
          required={isRequired(schema, name, child)}
        />
      ))}
      {opts && <SchemaOptions kind={opts.kind} options={opts.options} depth={depth} path={path} />}
    </>
  )
}

function SchemaRow({ name, schema, depth, path, required }: { name: string; schema: SchemaNode; depth: number; path: string; required: boolean }) {
  const tree = React.useContext(TreeContext)
  const expandable = hasChildren(schema)
  const [open, setOpen] = React.useState(depth < tree.defaultExpandDepth)
  const groupId = React.useId()
  const row: SchemaRowContext = { name, path, depth, required, schema }
  const { node, path: itemsPath } = unwrap(schema)

  const nameNode = tree.renderName ? tree.renderName(row) : name
  const nameClass = cn("font-mono text-xs leading-5 break-words text-foreground", schema.deprecated && "text-muted-foreground line-through")

  return (
    <>
      <div
        role="row"
        data-slot="schema-tree-row"
        data-depth={depth}
        data-expandable={expandable || undefined}
        data-open={(expandable && open) || undefined}
        style={depthStyle(depth)}
        className={rowClass}
      >
        <div role="rowheader" data-slot="schema-tree-name" className={cn(cellClass, nameCellClass, tree.chevronColumn && gutterClass, "flex flex-wrap items-center gap-x-2 gap-y-1")}>
          {expandable ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={open ? groupId : undefined}
              onClick={() => setOpen((o) => !o)}
              className={cn(
                "relative -ms-5 inline-flex cursor-pointer items-center rounded-sm ps-5 pe-1 outline-none transition-colors duration-150",
                "after:absolute after:-inset-y-1 after:inset-x-0 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <ChevronDownIcon
                size={14}
                className={cn(
                  "absolute start-0.75 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none",
                  !open && "-rotate-90 rtl:rotate-90"
                )}
              />
              <span dir="ltr" className={nameClass}>{nameNode}</span>
            </button>
          ) : (
            <span dir="ltr" className={nameClass}>{nameNode}</span>
          )}
          <SchemaMarkers schema={schema} required={required} />
          <span data-slot="schema-tree-type-inline" dir="ltr" className="font-mono text-xs leading-5 break-words text-muted-foreground @lg/schema-tree:hidden">
            {tree.renderType ? tree.renderType(row) : schemaTypeLabel(schema)}
          </span>
        </div>
        <div role="cell" data-slot="schema-tree-type" className={cn(cellClass, "hidden font-mono text-xs leading-5 break-words text-muted-foreground @lg/schema-tree:block @lg/schema-tree:max-w-64")}>
          <span dir="ltr">{tree.renderType ? tree.renderType(row) : schemaTypeLabel(schema)}</span>
        </div>
        <div
          role="cell"
          data-slot="schema-tree-description"
          className={cn(cellClass, "flex flex-col gap-1.5 text-muted-foreground empty:hidden @lg/schema-tree:empty:flex", tree.chevronColumn && "ps-5 @lg/schema-tree:ps-4")}
        >
          <SchemaDetails row={row} />
        </div>
      </div>
      {expandable && open && (
        <div id={groupId} role="rowgroup" data-slot="schema-tree-group" className="contents">
          <SchemaLevel schema={node} depth={depth + 1} path={`${path}${itemsPath}`} />
        </div>
      )}
    </>
  )
}

function SchemaMarkers({ schema, required }: { schema: SchemaNode; required: boolean }) {
  const { labels } = useLocale()
  if (!required && !schema.readOnly && !schema.deprecated) return null
  return (
    <span data-slot="schema-tree-markers" className="inline-flex flex-wrap gap-1">
      {required && (
        <Badge size="sm" variant="primary">
          {labels.schemaRequired}
        </Badge>
      )}
      {schema.readOnly && (
        <Badge size="sm" variant="outline">
          {labels.schemaReadOnly}
        </Badge>
      )}
      {schema.deprecated && (
        <Badge size="sm" variant="warning">
          {labels.schemaDeprecated}
        </Badge>
      )}
    </span>
  )
}

/** Description, allowed values and default. Renders nothing when the schema has none. */
function SchemaDetails({ row }: { row: SchemaRowContext }) {
  const { labels } = useLocale()
  const tree = React.useContext(TreeContext)
  const { schema } = row
  const description = tree.renderDescription
    ? tree.renderDescription(row)
    : tree.descriptionFormat === "markdown" && typeof schema.description === "string"
      ? <InlineMarkdown text={schema.description} />
      : schema.description
  const empty = description == null || description === "" || (typeof schema.description === "string" && !schema.description && !tree.renderDescription)
  const values = schema.enum ?? (schema.const !== undefined ? [schema.const] : undefined)
  return (
    <>
      {!empty && <div className={cn("text-pretty", descriptionCode)}>{description}</div>}
      {values && values.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-1.5 text-ui-sm">
          <span>{labels.schemaAllowedValues}</span>
          {values.map((v, i) => (
            <code key={i} dir="ltr" className={codeChip}>
              {json(v)}
            </code>
          ))}
        </div>
      )}
      {schema.default !== undefined && (
        <div className="flex flex-wrap items-baseline gap-1.5 text-ui-sm">
          <span>{labels.default}</span>
          <code dir="ltr" className={codeChip}>{json(schema.default)}</code>
        </div>
      )}
    </>
  )
}

function SchemaOptions({ kind, options, depth, path }: { kind: "oneOf" | "anyOf"; options: readonly SchemaNode[]; depth: number; path: string }) {
  const { labels } = useLocale()
  const tree = React.useContext(TreeContext)
  const names = options.map((o, i) => {
    const label = o.title ?? schemaTypeLabel(o)
    return options.some((p, j) => j !== i && (p.title ?? schemaTypeLabel(p)) === label) ? labels.schemaOption(i + 1) : label
  })
  return (
    <Tabs
      defaultValue={0}
      data-slot="schema-tree-options"
      data-kind={kind}
      className="contents"
    >
      <div role="row" style={depthStyle(depth)} className={cn(rowClass, "@lg/schema-tree:block")}>
        <div
          role="cell"
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 @lg/schema-tree:py-1.5 @lg/schema-tree:pe-4",
            nameCellClass,
            tree.chevronColumn && gutterClass
          )}
        >
          <span className="text-ui-sm text-muted-foreground">{kind === "oneOf" ? labels.schemaOneOf : labels.schemaAnyOf}</span>
          <TabsList variant="underline" size="sm" aria-label={kind === "oneOf" ? labels.schemaOneOf : labels.schemaAnyOf}>
            {names.map((label, i) => (
              <TabsTab key={i} value={i} dir="ltr" className="font-mono">
                {label}
              </TabsTab>
            ))}
          </TabsList>
        </div>
      </div>
      {options.map((option, i) => (
        <TabsPanel
          key={i}
          value={i}
          data-slot="schema-tree-option"
          className="flex flex-col focus-visible:ring-inset @lg/schema-tree:col-span-full @lg/schema-tree:grid @lg/schema-tree:grid-cols-subgrid"
        >
          <SchemaOption option={option} depth={depth} path={path} />
        </TabsPanel>
      ))}
    </Tabs>
  )
}

/** One option: its properties as rows, or (for a scalar or array option) a single row with its type and details. */
function SchemaOption({ option, depth, path }: { option: SchemaNode; depth: number; path: string }) {
  const tree = React.useContext(TreeContext)
  const { node, path: itemsPath } = unwrap(option)
  if ((node.properties && Object.keys(node.properties).length) || optionsOf(node)) {
    return <SchemaLevel schema={node} depth={depth} path={`${path}${itemsPath}`} />
  }
  const row: SchemaRowContext = { name: "", path, depth, required: false, schema: option }
  return (
    <div role="row" data-slot="schema-tree-row" data-depth={depth} style={depthStyle(depth)} className={rowClass}>
      <div role="rowheader" className={cn(cellClass, nameCellClass, tree.chevronColumn && gutterClass, "flex flex-wrap items-center gap-2")}>
        <span dir="ltr" className="font-mono text-xs leading-5 text-foreground">
          {tree.renderType ? tree.renderType(row) : schemaTypeLabel(option)}
        </span>
        <SchemaMarkers schema={option} required={false} />
      </div>
      <div role="cell" className={cn(cellClass, "hidden @lg/schema-tree:block")} />
      <div role="cell" className={cn(cellClass, "flex flex-col gap-1.5 text-muted-foreground empty:hidden @lg/schema-tree:empty:flex", tree.chevronColumn && "ps-5 @lg/schema-tree:ps-4")}>
        <SchemaDetails row={row} />
      </div>
    </div>
  )
}

export { SchemaTree, schemaTypeLabel }
export type { SchemaTreeProps, SchemaNode, SchemaRowContext, SchemaPrimitive }
