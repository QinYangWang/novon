import type * as React from "react"

import { cn } from "@/lib/utils"

/*
 * A plain HTML table on a raised surface, for reference content: prop tables, token lists,
 * comparisons. The header sits on a tinted band and the body is a sheet laid over it, its top
 * corners following the surface; columns are divided by hairlines (`variant="plain"` drops the band
 * and the column lines). It scrolls sideways when the columns don't fit (inline code never breaks, and on
 * small screens body text keeps a minimum width). For data people sort, select or page through,
 * use Table.
 *
 *   <SimpleTable>
 *     <SimpleTableHeader><SimpleTableRow><SimpleTableHead>Prop</SimpleTableHead>…</SimpleTableRow></SimpleTableHeader>
 *     <SimpleTableBody><SimpleTableRow><SimpleTableCell variant="code">size</SimpleTableCell>…</SimpleTableRow></SimpleTableBody>
 *   </SimpleTable>
 *
 * Cells honour the `align` attribute Markdown tables emit, and bare `<code>` in body text gets the
 * inline-code chip, so `components={{ table: SimpleTable, td: SimpleTableCell, … }}` renders MDX as is.
 */

/*
 * The floor for body-text cells, set on the surface as --simple-table-cell-min so cells need no
 * client code to read it. `auto` floors them only below 40rem of viewport: short tables fit a
 * reading column on desktop, and a phone scrolls a table sideways instead of squeezing its prose.
 */
const cellMinWidths = {
  auto: "[--simple-table-cell-min:0px] max-sm:[--simple-table-cell-min:8rem]",
  always: "[--simple-table-cell-min:8rem]",
  none: "[--simple-table-cell-min:0px]",
} as const

/*
 * `sheet`: the band is a light muted fill over the page colour; body cells take the page colour (white
 * in light mode in every style), so only the band shows around the sheet's rounded top. Cell borders draw the grid (the table is
 * `border-separate`, so corner radii apply to cells). The sheet's top edge thins out along its
 * corner curves and meets the surface's own ring at the sides.
 */
const tableVariants = {
  sheet: cn(
    "border-separate border-spacing-0 bg-muted/50 dark:bg-muted",
    "[&_th]:border-e [&_th]:border-border [&_th:last-child]:border-e-0",
    "[&>tbody>tr>td]:bg-background [&>tbody>tr>td]:border-e [&>tbody>tr>td]:border-border [&>tbody>tr>td:last-child]:border-e-0",
    "[&>tbody>tr:not(:last-child)>td]:border-b",
    "[&>thead+tbody>tr:first-child>td]:border-t",
    "[&>thead+tbody>tr:first-child>td:first-child]:rounded-ss-xl [&>thead+tbody>tr:first-child>td:last-child]:rounded-se-xl"
  ),
  plain: "border-collapse [&>thead]:text-muted-foreground [&>thead_tr]:border-b [&>tbody>tr]:border-b [&>tbody>tr]:border-border [&>tbody>tr:last-child]:border-b-0",
} as const

type SimpleTableProps = React.ComponentProps<"table"> & {
  /** Class for the scrolling surface around the table. */
  containerClassName?: string
  /** Minimum width of body-text cells: `auto` 8rem on small screens only, `always` 8rem, `none` no floor. */
  cellMinWidth?: keyof typeof cellMinWidths
  /** `sheet`: a header band with the body laid over it and column lines. `plain`: row lines only. */
  variant?: keyof typeof tableVariants
}

function SimpleTable({ className, containerClassName, cellMinWidth = "auto", variant = "sheet", ...props }: SimpleTableProps) {
  return (
    <div
      data-slot="simple-table-container"
      data-cell-min-width={cellMinWidth}
      className={cn("overflow-x-auto rounded-xl shadow-raised", variant === "sheet" ? "bg-background" : "bg-card", cellMinWidths[cellMinWidth], containerClassName)}
    >
      <table
        data-slot="simple-table"
        data-variant={variant}
        className={cn("w-full text-start text-sm", tableVariants[variant], className)}
        {...props}
      />
    </div>
  )
}

function SimpleTableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="simple-table-header" className={cn("text-foreground", className)} {...props} />
}

function SimpleTableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="simple-table-body" className={className} {...props} />
}

function SimpleTableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="simple-table-row" className={cn("align-top", className)} {...props} />
}

type SimpleTableAlign = "start" | "end" | "left" | "center" | "right" | "justify" | "char"

/**
 * `align` is logical: `start` and `end` follow the writing direction. The Markdown / HTML values
 * work too: `left` (`:--`), `center` (`:-:`) and `right` (`--:`) map to start, center and end, so
 * they flip under RTL as well. `justify` justifies; `char` is accepted and falls back to start.
 * A flex child (a row of buttons) is justified to the same edge.
 */
const alignClass = (align: string | undefined) =>
  align === "center"
    ? "text-center [&>.flex]:justify-center"
    : align === "right" || align === "end"
      ? "text-end [&>.flex]:justify-end"
      : align === "justify"
        ? "text-justify"
        : "text-start [&>.flex]:justify-start"

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
      className={cn("px-4 py-2 font-medium", alignClass(align), inlineCode, className)}
      {...props}
    />
  )
}

const cellVariants = {
  /** Body text. Wraps between words; the table's `cellMinWidth` sets its floor, and empty cells have none. */
  default: cn("min-w-(--simple-table-cell-min,0px) text-muted-foreground empty:min-w-0", inlineCode),
  /** Names: props, classes, tokens. */
  code: "font-mono text-xs whitespace-nowrap text-foreground",
  /** Secondary names: defaults, token names beside a class. */
  "code-muted": "font-mono text-xs whitespace-nowrap text-muted-foreground",
  /** Types and values that can be long. */
  type: "max-w-64 font-mono text-xs break-words text-foreground",
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
