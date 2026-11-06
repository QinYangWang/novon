"use client";

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { Badge } from "@/ui/badge"
import { CodeCopyButton } from "@/ui/code-block"
import { useLocale } from "@/ui/locale-provider"
import { cn } from "@/lib/utils"

/*
 * An HTTP method (or an event / query operation kind) as a coloured badge, and the
 * method + path bar an API page documents.
 *
 *   <MethodBadge method="post" />
 *   <MethodBadge method="subscribe" size="sm" />
 *   <Endpoint method="get" path="/projects/{projectId}/members" server="https://api.example.com/v1" />
 */

type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options"
/** Event and query operation kinds. Their colours stay apart from the HTTP ones. */
type OperationKind = "send" | "receive" | "publish" | "subscribe" | "query" | "mutation" | "subscription"

const methodBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center rounded-control-sm font-mono font-medium whitespace-nowrap uppercase icon-bold",
  {
    variants: {
      method: {
        get: "bg-success-subtle text-success-text inset-ring inset-ring-success-border",
        post: "bg-info-subtle text-info-text inset-ring inset-ring-info-border",
        put: "bg-warning-subtle text-warning-text inset-ring inset-ring-warning-border",
        patch: "bg-tag-purple-fill text-tag-purple-text",
        delete: "bg-destructive-subtle text-destructive-text inset-ring inset-ring-destructive-border",
        head: "bg-tag-gray-fill text-tag-gray-text",
        options: "bg-tag-gray-fill text-tag-gray-text",
        // Operations: outgoing and writes in orange, incoming streams in pink, reads in brown.
        send: "bg-tag-orange-fill text-tag-orange-text",
        publish: "bg-tag-orange-fill text-tag-orange-text",
        mutation: "bg-tag-orange-fill text-tag-orange-text",
        receive: "bg-tag-pink-fill text-tag-pink-text",
        subscribe: "bg-tag-pink-fill text-tag-pink-text",
        subscription: "bg-tag-pink-fill text-tag-pink-text",
        query: "bg-tag-brown-fill text-tag-brown-text",
      },
      size: {
        default: "h-6 min-w-11 px-1.5 text-ui-xs",
        // Sidebar rows: short names, one width, so the labels after them line up.
        sm: "h-4.5 w-10 px-1 text-ui-2xs",
      },
    },
    defaultVariants: { method: "get", size: "default" },
  }
)

const METHODS: readonly string[] = [
  "get", "post", "put", "patch", "delete", "head", "options",
  "send", "receive", "publish", "subscribe", "query", "mutation", "subscription",
]
/** Short forms for the small size, so every badge fits one width. The full name stays for screen readers. */
const SHORT: Partial<Record<string, string>> = {
  delete: "del",
  options: "opt",
  receive: "recv",
  publish: "pub",
  subscribe: "sub",
  subscription: "sub",
  mutation: "mut",
}

type MethodBadgeProps = Omit<React.ComponentProps<"span">, "children"> &
  Omit<VariantProps<typeof methodBadgeVariants>, "method"> & {
    /** Case-insensitive. Unknown methods show their name in the neutral colour. */
    method: HttpMethod | OperationKind | (string & {})
  }

function MethodBadge({ method, size = "default", className, ...props }: MethodBadgeProps) {
  const name = method.toLowerCase()
  const known = METHODS.includes(name)
  const short = size === "sm" ? SHORT[name] : undefined
  return (
    <span
      data-slot="method-badge"
      data-method={name}
      className={cn(methodBadgeVariants({ method: known ? (name as HttpMethod | OperationKind) : "head", size }), className)}
      {...props}
    >
      {short ? (
        <>
          <span aria-hidden>{short}</span>
          <span className="sr-only">{name}</span>
        </>
      ) : (
        name
      )}
    </span>
  )
}

/** `{id}` and `:id` segments of a path, set apart from the rest. */
function EndpointPath({ path, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & { path: string }) {
  return (
    <span data-slot="endpoint-path" dir="ltr" className={className} {...props}>
      {path.split(/(\{[^}]+\}|:[A-Za-z_]\w*)/g).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} data-slot="endpoint-param" className="font-medium text-primary-text">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </span>
  )
}

type EndpointProps = Omit<React.ComponentProps<"div">, "children"> & {
  method: HttpMethod | OperationKind | (string & {})
  /** The path, or any address or signature. One that doesn't start with `/` is joined to `server` with one. */
  path: string
  /** Base URL shown before the path (hidden when the bar is narrow); the copy button copies both. */
  server?: string
  /** What the copy button copies. Defaults to `server` + `path`. */
  copyValue?: string
  /** Strikes the path through and adds a "Deprecated" badge. */
  deprecated?: boolean
  /** Hides the copy button. */
  copyable?: boolean
}

/** `server` and `path` with exactly one `/` between them. */
function joinEndpoint(server: string | undefined, path: string) {
  if (!server) return path
  const base = server.replace(/\/+$/, "")
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`
}

function Endpoint({ method, path, server, copyValue, deprecated, copyable = true, className, ...props }: EndpointProps) {
  const { labels } = useLocale()
  const url = joinEndpoint(server, path)
  const base = server?.replace(/\/+$/, "")
  const separator = server && !path.startsWith("/") ? "/" : ""
  return (
    <div
      data-slot="endpoint"
      data-deprecated={deprecated || undefined}
      className={cn("@container/endpoint frame-xl frame-p-1.5 flex min-w-0 items-center gap-2.5 bg-card text-card-foreground shadow-raised", className)}
      {...props}
    >
      <MethodBadge method={method} />
      <code
        dir="ltr"
        title={url}
        className="flex min-w-0 flex-1 font-mono text-ui-sm leading-6 whitespace-nowrap rtl:justify-end"
      >
        {server && (
          <span data-slot="endpoint-server" className="min-w-0 shrink-100 truncate text-muted-foreground @max-md/endpoint:hidden">
            {base}
            {separator}
          </span>
        )}
        <EndpointPath path={path} className={cn("min-w-0 truncate", deprecated && "line-through decoration-muted-foreground")} />
      </code>
      {deprecated && (
        <Badge size="sm" variant="warning">
          {labels.deprecated}
        </Badge>
      )}
      {copyable && <CodeCopyButton value={copyValue ?? url} label={labels.copyUrl} className="-my-0.5 rounded-inner" />}
    </div>
  )
}

export { MethodBadge, methodBadgeVariants, EndpointPath, Endpoint }
export type { HttpMethod, OperationKind, MethodBadgeProps, EndpointProps }
