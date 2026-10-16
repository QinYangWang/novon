import * as React from "react"
import { useRender } from "@base-ui/react/use-render"
import { cva } from "class-variance-authority"

import { ChevronRightIcon, MoreHorizontalIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/ui/menu"

function Breadcrumb({ "aria-label": ariaLabel = "Breadcrumb", ...props }: React.ComponentProps<"nav">) {
  return <nav data-slot="breadcrumb" aria-label={ariaLabel} {...props} />
}

type BreadcrumbSize = "sm" | "default" | "lg"

const BreadcrumbSizeContext = React.createContext<BreadcrumbSize>("default")

// Crumb heights step with Button: sm 24px, default 28px (the toolbar size), lg 32px.
const breadcrumbCrumbVariants = cva(
  "inline-flex items-center gap-1.5 transition-[background-color,color,box-shadow] duration-150 outline-none [&_svg]:shrink-0",
  {
    variants: {
      size: {
        sm: "h-6 rounded-sm px-1.5 text-ui-sm [&_svg]:size-3",
        default: "h-7 rounded-md px-2 [&_svg]:size-3.5",
        lg: "h-8 rounded-lg px-2.5 text-ui-lg [&_svg]:size-4",
      },
    },
    defaultVariants: { size: "default" },
  }
)

/** `size` applies to every crumb, separator and ellipsis inside. */
function BreadcrumbList({ className, size = "default", ...props }: React.ComponentProps<"ol"> & { size?: BreadcrumbSize }) {
  return (
    <BreadcrumbSizeContext.Provider value={size}>
      <ol
        data-slot="breadcrumb-list"
        data-size={size}
        className={cn(
          "flex flex-wrap items-center gap-0.5 break-words text-muted-foreground",
          size === "sm" ? "text-ui-sm" : size === "lg" ? "text-ui-lg" : "text-ui",
          className
        )}
        {...props}
      />
    </BreadcrumbSizeContext.Provider>
  )
}

/** Each crumb fades/slides in softly when it mounts (e.g. navigating deeper). */
function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn(
        "inline-flex items-center gap-0.5 transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] starting:-translate-x-1 rtl:starting:translate-x-1 starting:opacity-0 motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

/** Link crumb. Renders an <a> by default; use `render` for a router Link. */
function BreadcrumbLink({ className, render, ...props }: useRender.ComponentProps<"a">) {
  const size = React.useContext(BreadcrumbSizeContext)
  return useRender({
    defaultTagName: "a",
    render,
    props: {
      "data-slot": "breadcrumb-link",
      ...props,
      className: cn(
        breadcrumbCrumbVariants({ size }),
        "cursor-pointer hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      ),
    },
  })
}

/** The current page: plain foreground text (no chip), marked aria-current. */
function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  const size = React.useContext(BreadcrumbSizeContext)
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn(breadcrumbCrumbVariants({ size }), "font-medium text-foreground", className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({ className, children, ...props }: React.ComponentProps<"li">) {
  const size = React.useContext(BreadcrumbSizeContext)
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("flex items-center text-muted-foreground/60", size === "sm" ? "[&>svg]:size-3" : size === "lg" ? "[&>svg]:size-4" : "[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRightIcon className="rtl:rotate-180" />}
    </li>
  )
}

type BreadcrumbHiddenItem = {
  label: React.ReactNode
  href?: string
  icon?: React.ReactNode
  onClick?: () => void
}

/**
 * "…" crumb. With `items`, it becomes a button that opens a menu of the hidden crumbs;
 * without, it is a plain visual marker.
 */
function BreadcrumbEllipsis({
  className,
  items,
  label = "Show hidden breadcrumbs",
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { items?: BreadcrumbHiddenItem[]; label?: string }) {
  const size = React.useContext(BreadcrumbSizeContext)
  const iconBox = cn(
    "inline-flex items-center justify-center",
    size === "sm" ? "size-6 rounded-sm [&_svg]:size-3.5" : size === "lg" ? "size-8 rounded-lg [&_svg]:size-4" : "size-7 rounded-md [&_svg]:size-4",
    className
  )

  if (!items?.length) {
    return (
      <span data-slot="breadcrumb-ellipsis" role="presentation" aria-hidden="true" className={iconBox} {...props}>
        <MoreHorizontalIcon />
      </span>
    )
  }

  return (
    <Menu>
      <MenuTrigger
        data-slot="breadcrumb-ellipsis"
        aria-label={label}
        className={cn(
          iconBox,
          "cursor-pointer transition-[background-color,color,box-shadow] duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-secondary data-popup-open:text-foreground"
        )}
      >
        <MoreHorizontalIcon />
      </MenuTrigger>
      <MenuContent align="start" className="min-w-44">
        {items.map((item, i) => (
          <MenuItem
            key={i}
            onClick={item.onClick}
            render={item.href ? <a href={item.href} /> : undefined}
          >
            {item.icon}
            {item.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}

type BreadcrumbTrailItem = BreadcrumbHiddenItem

/**
 * Convenience trail: renders `items` (last one = current page) and folds the
 * middle into an ellipsis menu once there are more than `maxItems`.
 */
function BreadcrumbTrail({
  items,
  maxItems = 4,
  itemsBeforeCollapse = 1,
  itemsAfterCollapse = 2,
  separator,
  size = "default",
  className,
  ...props
}: Omit<React.ComponentProps<"nav">, "children"> & {
  items: BreadcrumbTrailItem[]
  size?: BreadcrumbSize
  maxItems?: number
  itemsBeforeCollapse?: number
  itemsAfterCollapse?: number
  separator?: React.ReactNode
}) {
  const collapse = items.length > maxItems && itemsBeforeCollapse + itemsAfterCollapse < items.length
  const head = collapse ? items.slice(0, itemsBeforeCollapse) : items
  const hidden = collapse ? items.slice(itemsBeforeCollapse, items.length - itemsAfterCollapse) : []
  const tail = collapse ? items.slice(items.length - itemsAfterCollapse) : []
  const last = items.length - 1

  const crumb = (item: BreadcrumbTrailItem, index: number) => (
    <BreadcrumbItem key={`c-${index}`}>
      {index === last ? (
        <BreadcrumbPage>
          {item.icon}
          {item.label}
        </BreadcrumbPage>
      ) : (
        <BreadcrumbLink href={item.href} onClick={item.onClick}>
          {item.icon}
          {item.label}
        </BreadcrumbLink>
      )}
    </BreadcrumbItem>
  )

  const nodes: React.ReactNode[] = []
  head.forEach((item, i) => nodes.push(crumb(item, i)))
  if (collapse) {
    nodes.push(
      <BreadcrumbItem key="ellipsis">
        <BreadcrumbEllipsis items={hidden} />
      </BreadcrumbItem>
    )
    tail.forEach((item, i) => nodes.push(crumb(item, items.length - itemsAfterCollapse + i)))
  }

  return (
    <Breadcrumb className={className} {...props}>
      <BreadcrumbList size={size}>
        {nodes.flatMap((node, i) =>
          i === 0 ? [node] : [<BreadcrumbSeparator key={`s-${i}`}>{separator}</BreadcrumbSeparator>, node]
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  BreadcrumbTrail,
  breadcrumbCrumbVariants,
}
export type { BreadcrumbHiddenItem, BreadcrumbTrailItem, BreadcrumbSize }
