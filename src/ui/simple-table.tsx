import type * as React from "react"

import { cn } from "@/lib/utils"

/*
 * A plain HTML table on a raised surface, for reference content: prop tables, token lists,
 * comparisons. It scrolls sideways when the columns don't fit (inline code never breaks and body
 * text keeps a minimum width). For data people sort, select or
 * page through, use Table.
 *
 *   <SimpleTable>
 *     <SimpleTableHeader><SimpleTableRow><SimpleTableHead>Prop</SimpleTableHead>…</SimpleTableRow></SimpleTableHeader>
 *     <SimpleTableBody><SimpleTableRow><SimpleTableCell variant="code">size</SimpleTableCell>…</SimpleTableRow></SimpleTableBody>
 *   </SimpleTable>
 *
 * Cells honour the `align` attribute Markdown tables emit, and bare `<code>` in body text gets the
 * inline-code chip, so `components={{ table: SimpleTable, td: SimpleTableCell, … }}` renders MDX as is.
 */

type SimpleTableProps = React.ComponentProps<"table"> & {
  /** Class for the scrolling surface around the table. */
  containerClassName?: string
}

function SimpleTable({ className, containerClassName, ...props }: SimpleTableProps) {
  return (
    <div data-slot="simple-table-container" className={cn("overflow-x-auto rounded-xl bg-card shadow-raised", containerClassName)}>
      <table data-slot="simple-table" className={cn("w-full border-collapse text-start text-sm", className)} {...props} />
    </div>
  )
}

function SimpleTableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="simple-table-header" className={cn("text-muted-foreground [&_tr]:border-b", className)} {...props} />
}

function SimpleTableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="simple-table-body" className={cn("[&_tr:last-child]:border-b-0", className)} {...props} />
}

function SimpleTableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="simple-table-row" className={cn("border-b border-border align-top", className)} {...props} />
}

type SimpleTableAlign = "left" | "center" | "right" | "justify" | "char"

/**
 * `align` takes the Markdown / HTML values: `left` (`:--`), `center` (`:-:`) and `right` (`--:`)
 * map to logical start, center and end, so they flip under RTL. `justify` justifies; `char` is
 * accepted and falls back to start.
 */
const alignClass = (align: string | undefined) =>
  align === "center" ? "text-center" : align === "right" ? "text-end" : align === "justify" ? "text-justify" : "text-start"

/*
 * Bare `<code>` (what Markdown writes) gets the library's inline-code chip. `:where()` keeps it at
 * element weight, and `:not([class])` leaves code you style yourself alone. The chip never breaks
 * inside a word, so a column of identifiers keeps its min-content width.
 */
const inlineCode =
  "[:where(&)_code:not([class])]:rounded-md [:where(&)_code:not([class])]:bg-muted [:where(&)_code:not([class])]:px-1.5 [:where(&)_code:not([class])]:py-0.5 [:where(&)_code:not([class])]:font-mono [:where(&)_code:not([class])]:text-ui-sm [:where(&)_code:not([class])]:text-foreground [:where(&)_code:not([class])]:whitespace-nowrap [:where(&)_code:not([class])]:break-normal"

type SimpleTableHeadProps = Omit<React.ComponentProps<"th">, "align"> & { align?: SimpleTableAlign }

function SimpleTableHead({ className, align, ...props }: SimpleTableHeadProps) {
  return (
    <th
      data-slot="simple-table-head"
      data-align={align}
      className={cn("px-4 py-2.5 font-medium", alignClass(align), inlineCode, className)}
      {...props}
    />
  )
}

const cellVariants = {
  /** Body text. Wraps between words but keeps an 8rem floor, so a narrow table scrolls instead of squeezing it. */
  default: cn("min-w-32 text-muted-foreground", inlineCode),
  /** Names: props, classes, tokens. */
  code: "font-mono text-xs whitespace-nowrap text-foreground",
  /** Secondary names: defaults, token names beside a class. */
  "code-muted": "font-mono text-xs whitespace-nowrap text-muted-foreground",
  /** Types and values that can be long. */
  type: "max-w-64 font-mono text-xs break-words text-primary",
  /** Values that line up: sizes, counts. */
  numeric: cn("whitespace-nowrap text-muted-foreground tabular-nums", inlineCode),
} as const

type SimpleTableCellProps = Omit<React.ComponentProps<"td">, "align"> & {
  variant?: keyof typeof cellVariants
  align?: SimpleTableAlign
}

function SimpleTableCell({ className, variant = "default", align, ...props }: SimpleTableCellProps) {
  return (
    <td
      data-slot="simple-table-cell"
      data-variant={variant}
      data-align={align}
      className={cn("px-4 py-2.5", align && alignClass(align), cellVariants[variant], className)}
      {...props}
    />
  )
}

export { SimpleTable, SimpleTableHeader, SimpleTableBody, SimpleTableRow, SimpleTableHead, SimpleTableCell }
export type { SimpleTableProps, SimpleTableHeadProps, SimpleTableCellProps, SimpleTableAlign }
