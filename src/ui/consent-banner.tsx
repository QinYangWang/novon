"use client";

import * as React from "react"

import { BottomStackItem } from "@/ui/bottom-stack"
import { Button } from "@/ui/button"
import { useLocale } from "@/ui/locale-provider"
import { InlineMarkdown } from "@/lib/inline-markdown"
import { cn } from "@/lib/utils"

/*
 * Asks once whether the site may use analytics or other optional storage. With `storageKey` the
 * answer is kept in localStorage ("accepted" or "declined") and the card stays hidden until the
 * key is cleared or changed (put a version in it). Read the answer anywhere with `readConsent` or
 * `useConsent`; `clearConsent` asks again.
 *
 * The card sits in the bottom stack: full width on phones, a card at the bottom end from `sm`.
 * Hidden on the server and until mounted, because the answer lives in the reader's browser.
 */

type ConsentValue = "accepted" | "declined"

/** Fired on `window` when an answer is written or cleared; `detail` is `{ key, value }`. */
const CONSENT_CHANGE_EVENT = "paneui:consent"

// Answers for this page view when storage is blocked (private mode), so the card still closes.
const memory = new Map<string, ConsentValue>()

/** The stored answer for a key, or null when the reader has not answered. */
function readConsent(storageKey: string): ConsentValue | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(storageKey)
    if (value === "accepted" || value === "declined") return value
  } catch {
    // Storage blocked: fall back to this page view's answer.
  }
  return memory.get(storageKey) ?? null
}

function notify(key: string, value: ConsentValue | null) {
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: { key, value } }))
}

/** Stores an answer and tells every `useConsent` reader. */
function writeConsent(storageKey: string, value: ConsentValue) {
  memory.set(storageKey, value)
  try {
    window.localStorage.setItem(storageKey, value)
  } catch {
    // Private mode or storage blocked: the answer holds for this page view.
  }
  notify(storageKey, value)
}

/** Forgets the answer, so the banner with this key asks again. */
function clearConsent(storageKey: string) {
  memory.delete(storageKey)
  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    // Storage blocked: only the page view's answer needed clearing.
  }
  notify(storageKey, null)
}

function subscribeConsent(listener: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, listener)
    window.removeEventListener("storage", listener)
  }
}

/** The answer for a key, kept current across components and tabs. `undefined` on the server and before mount. */
function useConsent(storageKey: string): ConsentValue | null | undefined {
  return React.useSyncExternalStore(
    subscribeConsent,
    () => readConsent(storageKey),
    () => undefined
  )
}

const policyLink =
  "font-medium text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:rounded-2xs focus-visible:ring-2 focus-visible:ring-ring"

type ConsentBannerProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The message. Overrides `text`. */
  children?: React.ReactNode
  /** The message as inline Markdown (code, emphasis, links). Defaults to the locale's analytics question. */
  text?: string
  /** Link to the privacy policy, shown after the message. */
  policyHref?: string
  /**
   * localStorage key that keeps the answer. Without it the card shows on every page load until
   * answered, and `open` or your own storage decides when to render it.
   */
  storageKey?: string
  /** Shows or hides the card yourself, ignoring the stored answer. */
  open?: boolean
  onAccept?: () => void
  onDecline?: () => void
  /** Shows a Customize button, for a settings dialog of your own. */
  onCustomize?: () => void
  /** `stack` (default) pins it in the bottom stack; `inline` renders it in place. */
  placement?: "stack" | "inline"
  /** Position in the bottom stack; higher sits closer to the bottom edge. */
  order?: number
}

/** A consent card for the bottom of the page, with Decline and Allow. */
function ConsentBanner({
  children,
  text,
  policyHref,
  storageKey,
  open,
  onAccept,
  onDecline,
  onCustomize,
  placement = "stack",
  order = 10,
  className,
  ...props
}: ConsentBannerProps) {
  const { labels } = useLocale()
  const stored = useConsent(storageKey ?? "")
  const [mounted, setMounted] = React.useState(false)
  const [answered, setAnswered] = React.useState(false)
  const [leaving, setLeaving] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  // Fallback for when no transition runs (transitions off in the browser).
  React.useEffect(() => {
    if (!leaving) return
    const id = window.setTimeout(() => setLeaving(false), 300)
    return () => window.clearTimeout(id)
  }, [leaving])

  // A cleared key asks again.
  React.useEffect(() => {
    if (storageKey && stored === null) setAnswered(false)
  }, [storageKey, stored])

  const waiting = open ?? (storageKey ? stored === null && !answered : !answered)
  if (!mounted || (!waiting && !leaving)) return null

  const answer = (value: ConsentValue) => {
    if (storageKey) writeConsent(storageKey, value)
    setAnswered(true)
    setLeaving(true)
    if (value === "accepted") onAccept?.()
    else onDecline?.()
  }

  const card = (
    <div
      role="region"
      aria-label={labels.consentRegion}
      data-slot="consent-banner"
      data-leaving={leaving ? "" : undefined}
      className={cn(
        "flex w-full flex-col gap-3 rounded-2xl bg-popover p-4 text-popover-foreground shadow-surface sm:w-sm",
        "transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] starting:translate-y-2 starting:opacity-0 data-leaving:pointer-events-none data-leaving:-translate-y-2 data-leaving:opacity-0 data-leaving:duration-150 motion-reduce:translate-y-0",
        className
      )}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === "opacity" && leaving) setLeaving(false)
      }}
      {...props}
    >
      <p data-slot="consent-banner-text" className="m-0 text-ui text-pretty text-muted-foreground [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-ui-sm [&_code]:text-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        {children ?? <InlineMarkdown text={text ?? labels.consentText} linkClassName={policyLink} />}
        {policyHref && (
          <>
            {" "}
            <a data-slot="consent-banner-policy" href={policyHref} className={policyLink}>
              {labels.consentPolicy}
            </a>
          </>
        )}
      </p>
      <div data-slot="consent-banner-actions" className="flex flex-wrap items-center justify-end gap-2">
        {onCustomize && (
          <Button variant="ghost" size="sm" className="me-auto" onClick={onCustomize}>
            {labels.consentCustomize}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => answer("declined")}>
          {labels.consentDecline}
        </Button>
        <Button size="sm" onClick={() => answer("accepted")}>
          {labels.consentAccept}
        </Button>
      </div>
    </div>
  )

  if (placement === "inline") return card
  return (
    <BottomStackItem order={order} className="self-stretch sm:self-end">
      {card}
    </BottomStackItem>
  )
}

export {
  ConsentBanner,
  readConsent,
  writeConsent,
  clearConsent,
  useConsent,
  CONSENT_CHANGE_EVENT,
  type ConsentBannerProps,
  type ConsentValue,
}
