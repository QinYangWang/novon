"use client";

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { ArrowRightIcon, XIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { useLocale } from "@/ui/locale-provider"

/*
 * A site-wide announcement bar above the app header. With `storageKey` the dismiss button writes
 * the key to localStorage, and the bar stays hidden on every later visit until the key changes.
 *
 * No flash on server-rendered pages: `bannerScript(key)` (or `<BannerScript>`) runs in <head>
 * before paint and adds the key to `data-banner-dismissed` on <html>; each bar ships the one CSS
 * rule that hides it while its key is in that list. Without the script the bar hides right after
 * hydration instead.
 */

/** The attribute on <html> that lists dismissed banner keys, space separated. */
const BANNER_DISMISSED_ATTRIBUTE = "data-banner-dismissed"

const bannerVariants = cva(
  "relative flex min-h-10 items-center justify-center gap-2 py-2 text-center text-ui text-pretty [&_a:not([data-slot=banner-link])]:font-medium [&_a:not([data-slot=banner-link])]:underline [&_a:not([data-slot=banner-link])]:decoration-current/50 [&_a:not([data-slot=banner-link])]:underline-offset-2 [&_a:not([data-slot=banner-link])]:hover:decoration-current [&_code]:rounded-sm [&_code]:bg-current/12 [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-ui-sm",
  {
    variants: {
      tone: {
        primary: "bg-primary text-primary-foreground",
        neutral: "border-b border-shell-border bg-shell text-foreground",
        warning: "bg-warning text-warning-foreground",
      },
    },
    defaultVariants: { tone: "primary" },
  }
)

const dismissVariants = cva(
  "absolute end-2 top-1/2 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-control-sm transition-colors duration-150 outline-none after:absolute after:-inset-1 focus-visible:ring-2 pointer-coarse:after:-inset-2.5",
  {
    variants: {
      tone: {
        primary: "text-primary-foreground/80 hover:bg-primary-foreground/12 hover:text-primary-foreground focus-visible:ring-primary-foreground/70",
        neutral: "text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-ring",
        warning: "text-warning-foreground/80 hover:bg-warning-foreground/12 hover:text-warning-foreground focus-visible:ring-warning-foreground/70",
      },
    },
    defaultVariants: { tone: "primary" },
  }
)

/** A key quoted for a CSS attribute selector. */
function cssString(key: string) {
  return `"${key.replace(/["\\]/g, "\\$&").replace(/\n/g, "\\a ")}"`
}

/**
 * The inline script for <head> that hides dismissed bars before the first paint. Pass every key
 * the page's banners use.
 */
function bannerScript(storageKey: string | string[]) {
  const keys = JSON.stringify(Array.isArray(storageKey) ? storageKey : [storageKey])
  return `(function(){try{var h=document.documentElement,a=${JSON.stringify(BANNER_DISMISSED_ATTRIBUTE)},k=${keys}.filter(function(k){return localStorage.getItem(k)!==null});if(k.length)h.setAttribute(a,((h.getAttribute(a)||"")+" "+k.join(" ")).trim())}catch(e){}})()`
}

/** `bannerScript` as a <script> element, for the document head of a server-rendered page. */
function BannerScript({ storageKey, nonce }: { storageKey: string | string[]; nonce?: string }) {
  return <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: bannerScript(storageKey) }} />
}

/** Whether a banner key was dismissed in this browser. */
function isBannerDismissed(storageKey: string) {
  if (typeof window === "undefined") return false
  try {
    if (window.localStorage.getItem(storageKey) !== null) return true
  } catch {
    // Storage blocked: fall back to the attribute set this session.
  }
  const list = document.documentElement.getAttribute(BANNER_DISMISSED_ATTRIBUTE) ?? ""
  return list.split(/\s+/).includes(storageKey)
}

function markDismissed(storageKey: string) {
  try {
    window.localStorage.setItem(storageKey, "dismissed")
  } catch {
    // Private mode or storage blocked: the bar still closes for this page view.
  }
  const root = document.documentElement
  const list = (root.getAttribute(BANNER_DISMISSED_ATTRIBUTE) ?? "").split(/\s+/).filter(Boolean)
  if (!list.includes(storageKey)) root.setAttribute(BANNER_DISMISSED_ATTRIBUTE, [...list, storageKey].join(" "))
}

/** Forgets a dismissal, so the bar with this key shows again on its next render. */
function clearBannerDismissal(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    // Storage blocked: only the attribute needs clearing.
  }
  const root = document.documentElement
  const list = (root.getAttribute(BANNER_DISMISSED_ATTRIBUTE) ?? "").split(/\s+/).filter((k) => k && k !== storageKey)
  if (list.length) root.setAttribute(BANNER_DISMISSED_ATTRIBUTE, list.join(" "))
  else root.removeAttribute(BANNER_DISMISSED_ATTRIBUTE)
}

type BannerProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof bannerVariants> & {
    /** The message. Inline links and code are styled; leave links out when `href` is set. */
    children?: React.ReactNode
    /** Makes the whole bar a link. */
    href?: string
    /** Props for the whole-bar link, such as `target` or `rel`. */
    linkProps?: Omit<React.ComponentProps<"a">, "href" | "children">
    /**
     * localStorage key that remembers a dismissal. Change it (add a version) to show a new
     * message to people who closed the last one.
     */
    storageKey?: string
    /** Shows the dismiss button. Defaults to on when `storageKey` is set. */
    dismissible?: boolean
    onDismiss?: () => void
  }

/** An announcement bar for the top of a site, above the app header. */
function Banner({
  tone = "primary",
  href,
  linkProps,
  storageKey,
  dismissible = storageKey != null,
  onDismiss,
  children,
  className,
  ...props
}: BannerProps) {
  const { labels } = useLocale()
  const [state, setState] = React.useState<"shown" | "leaving" | "gone">("shown")

  // Read the stored dismissal before paint on client renders; server HTML is hidden by the script.
  React.useLayoutEffect(() => {
    if (storageKey && isBannerDismissed(storageKey)) setState("gone")
  }, [storageKey])

  // Fallback for when no transition runs (transitions off in the browser).
  React.useEffect(() => {
    if (state !== "leaving") return
    const id = window.setTimeout(() => setState("gone"), 400)
    return () => window.clearTimeout(id)
  }, [state])

  if (state === "gone") return null

  const dismiss = () => {
    if (storageKey) markDismissed(storageKey)
    onDismiss?.()
    setState("leaving")
  }

  const text = href ? (
    <a
      data-slot="banner-link"
      href={href}
      {...linkProps}
      className={cn(
        "inline-flex items-center gap-1.5 underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-2 focus-visible:after:ring-current/60 focus-visible:after:ring-inset",
        linkProps?.className
      )}
    >
      <span>{children}</span>
      <ArrowRightIcon size={14} aria-hidden className="shrink-0 rtl:-scale-x-100" />
    </a>
  ) : (
    <p className="m-0">{children}</p>
  )

  return (
    <>
      {storageKey && (
        <style>{`html[${BANNER_DISMISSED_ATTRIBUTE}~=${cssString(storageKey)}] [data-banner-key=${cssString(storageKey)}]{display:none}`}</style>
      )}
      <div
        role="region"
        aria-label={labels.announcement}
        data-slot="banner"
        data-tone={tone}
        data-banner-key={storageKey}
        data-leaving={state === "leaving" ? "" : undefined}
        className={cn(
          "grid grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-leaving:grid-rows-[0fr] data-leaving:opacity-0 motion-reduce:data-leaving:grid-rows-[1fr] print:hidden",
          className
        )}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === "opacity" && state === "leaving") setState("gone")
        }}
        {...props}
      >
        <div className="min-h-0 overflow-hidden">
          <div data-slot="banner-bar" className={cn(bannerVariants({ tone }), dismissible ? "px-10" : "px-4")}>
            {text}
            {dismissible && (
              <button
                type="button"
                data-slot="banner-dismiss"
                aria-label={labels.dismissAnnouncement}
                className={dismissVariants({ tone })}
                onClick={dismiss}
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export {
  Banner,
  BannerScript,
  bannerScript,
  bannerVariants,
  isBannerDismissed,
  clearBannerDismissal,
  BANNER_DISMISSED_ATTRIBUTE,
  type BannerProps,
}
