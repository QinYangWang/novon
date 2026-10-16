import type * as React from "react"

import { cn } from "@/lib/utils"

/*
 * A plain HTML table on a raised surface, for reference content: prop tables, token lists,
 * comparisons. It scrolls sideways when the columns don't fit. For data people sort, select or
 * page through, use Table.
 *
 *   <SimpleTable>
 *     <SimpleTableHeader><SimpleTableRow><SimpleTableHead>Prop</SimpleTableHead>…</SimpleTableRow></SimpleTableHeader>
 *     <SimpleTableBody><SimpleTableRow><SimpleTableCell variant="code">size</SimpleTableCell>…</SimpleTableRow></SimpleTableBody>
 *   </SimpleTable>
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

function SimpleTableHead({ className, ...props }: React.ComponentProps<"th">) {
  return <th data-slot="simple-table-head" className={cn("px-4 py-2.5 text-start font-medium", className)} {...props} />
}

const cellVariants = {
  /** Body text. */
  default: "text-muted-foreground",
  /** Names: props, classes, tokens. */
  code: "font-mono text-xs whitespace-nowrap text-foreground",
  /** Secondary names: defaults, token names beside a class. */
  "code-muted": "font-mono text-xs whitespace-nowrap text-muted-foreground",
  /** Types and values that can be long. */
  type: "max-w-64 font-mono text-xs break-words text-primary",
  /** Values that line up: sizes, counts. */
  numeric: "whitespace-nowrap text-muted-foreground tabular-nums",
} as const

function SimpleTableCell({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"td"> & { variant?: keyof typeof cellVariants }) {
  return <td data-slot="simple-table-cell" data-variant={variant} className={cn("px-4 py-2.5", cellVariants[variant], className)} {...props} />
}

export { SimpleTable, SimpleTableHeader, SimpleTableBody, SimpleTableRow, SimpleTableHead, SimpleTableCell }
export type { SimpleTableProps }
