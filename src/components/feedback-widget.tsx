"use client";

import * as React from "react"
import { useLocale, localeLabels, type LocaleLabels } from "@/ui/locale-provider"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react"

import { ChatIcon, CheckIcon, XIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { StatefulButton } from "@/ui/button-stateful"

export type FeedbackMood = "bad" | "meh" | "good" | "love"

export type FeedbackData = { message: string; mood: FeedbackMood | null }

export type FeedbackWidgetProps = {
  /** Called on send. Return a promise to show the sending state; reject to show the retry state. */
  onSubmit?: (data: FeedbackData) => void | Promise<void>
  /**
   * `floating` (default) is a corner trigger that opens a form. `inline` sits in the flow, such as at the
   * end of an article: a question and the moods, opening the note field once a mood is picked.
   */
  placement?: "floating" | "inline"
  /** Floating only. */
  position?: "bottom-right" | "bottom-left"
  /** Floating only. `fixed` pins to the viewport corner; `absolute` (default) to the nearest positioned ancestor. */
  strategy?: "fixed" | "absolute"
  /** Floating only: the trigger's text. */
  label?: React.ReactNode
  /** Inline only. Draws a rule above the question; turn it off when the page already separates the section. Default `true`. */
  bordered?: boolean
  /** The form's heading; inline, the question beside the moods. */
  title?: React.ReactNode
  placeholder?: string
  successTitle?: React.ReactNode
  successDescription?: React.ReactNode
  className?: string
}

type Status = "closed" | "open" | "sending" | "sent" | "error"

function getMoods(l10n: LocaleLabels = localeLabels.en): { value: FeedbackMood; emoji: string; label: string }[] {
  return ([
  { value: "bad", emoji: "😣", label: l10n.bad },
  { value: "meh", emoji: "😕", label: l10n.meh },
  { value: "good", emoji: "🙂", label: l10n.good },
  { value: "love", emoji: "😍", label: l10n.loveIt },
])
}


// Overshoots a little on the way open, settles calmly on the way back.
const OPEN: Transition = { type: "spring", stiffness: 340, damping: 26, mass: 0.8 }
const CLOSE: Transition = { type: "spring", stiffness: 420, damping: 38, mass: 0.7 }
const SUCCESS_MS = 1800
const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2
  return { x: Math.cos(a) * 30, y: Math.sin(a) * 30, tone: i % 2 ? "bg-primary" : "bg-success" }
})

function useNaturalSize() {
  const ref = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null)
  React.useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const update = () =>
      setSize((prev) =>
        prev && prev.width === node.offsetWidth && prev.height === node.offsetHeight
          ? prev
          : { width: node.offsetWidth, height: node.offsetHeight }
      )
    update()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

type MoodGroupProps = {
  value: FeedbackMood | null
  onValueChange: (mood: FeedbackMood) => void
  disabled?: boolean
  labelledBy?: string
}

function MoodGroup({ value, onValueChange, disabled, labelledBy }: MoodGroupProps) {
  const l10n = useLocale().labels
  return (
    <RadioGroup
      aria-label={labelledBy ? undefined : l10n.howDoYouFeel}
      aria-labelledby={labelledBy}
      value={value}
      onValueChange={(next) => onValueChange(next as FeedbackMood)}
      disabled={disabled}
      className="flex gap-1"
    >
      {getMoods(l10n).map((m) => (
        <Radio.Root
          key={m.value}
          value={m.value}
          aria-label={m.label}
          title={m.label}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-base outline-none grayscale-[0.7] transition-[transform,filter,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 hover:grayscale-0 focus-visible:ring-2 focus-visible:ring-ring data-checked:scale-110 data-checked:bg-card data-checked:shadow-raised data-checked:grayscale-0 data-disabled:pointer-events-none"
        >
          <span aria-hidden>{m.emoji}</span>
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}

export function FeedbackWidget({ placement = "floating", ...props }: FeedbackWidgetProps) {
  return placement === "inline" ? <InlineFeedback {...props} /> : <FloatingFeedback {...props} />
}

type PlacementProps = Omit<FeedbackWidgetProps, "placement">

function FloatingFeedback({
  onSubmit,
  position = "bottom-right",
  strategy = "absolute",
  label,
  title,
  placeholder,
  successTitle,
  successDescription,
  className,
}: PlacementProps) {
  const l10n = useLocale().labels

  if (label === undefined) label = l10n.feedback
  if (title === undefined) title = l10n.helpUsImprove
  if (placeholder === undefined) placeholder = l10n.shareAnIdeaOrReportABug
  if (successTitle === undefined) successTitle = l10n.thanksForTheFeedback
  if (successDescription === undefined) successDescription = l10n.weReadEveryMessage

  const reduce = useReducedMotion()
  const titleId = React.useId()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [contentRef, size] = useNaturalSize()
  const [status, setStatus] = React.useState<Status>("closed")
  const [message, setMessage] = React.useState("")
  const [mood, setMood] = React.useState<FeedbackMood | null>(null)
  const restoreFocus = React.useRef(false)

  const isOpen = status !== "closed"
  const busy = status === "sending"
  const left = position === "bottom-left"
  const view = status === "closed" ? "trigger" : status === "sent" ? "sent" : "form"

  const close = React.useCallback((focusTrigger = true) => {
    restoreFocus.current = focusTrigger
    setStatus("closed")
    setMessage("")
    setMood(null)
  }, [])

  // Focus the field once the morph has mostly settled, and hand focus back to the trigger on close.
  React.useEffect(() => {
    if (status === "open") {
      const t = window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), reduce ? 0 : 260)
      return () => window.clearTimeout(t)
    }
    if (status === "sent") {
      const t = window.setTimeout(() => close(), SUCCESS_MS)
      return () => window.clearTimeout(t)
    }
    if (status === "closed" && restoreFocus.current) {
      restoreFocus.current = false
      requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
    }
  }, [status, reduce, close])

  // Outside press dismisses (never mid-send).
  React.useEffect(() => {
    if (!isOpen || busy) return
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false)
    }
    window.addEventListener("pointerdown", onPointer, true)
    return () => window.removeEventListener("pointerdown", onPointer, true)
  }, [isOpen, busy, close])

  const submit = async () => {
    if (!message.trim() || busy) return
    setStatus("sending")
    try {
      await onSubmit?.({ message: message.trim(), mood })
      setStatus("sent")
    } catch {
      setStatus("error")
    }
  }

  const spring = reduce ? { duration: 0.15 } : isOpen ? OPEN : CLOSE
  const anchor = left ? "left-0" : "right-0"

  return (
    <div
      ref={rootRef}
      data-slot="feedback-widget"
      data-placement="floating"
      data-state={status}
      className={cn(strategy === "fixed" ? "fixed" : "absolute", "bottom-4 z-40", left ? "left-4" : "right-4", className)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && isOpen && !busy) {
          e.stopPropagation()
          close()
        }
      }}
    >
      <motion.div
        initial={false}
        animate={size ?? { width: 120, height: 40 }}
        transition={spring}
        style={{ borderRadius: 20, transformOrigin: left ? "bottom left" : "bottom right" }}
        className={cn(
          "relative overflow-hidden bg-popover text-popover-foreground transition-shadow duration-200",
          isOpen ? "shadow-surface" : "shadow-raised hover:shadow-raised-hover"
        )}
      >
        <div ref={contentRef} className={cn("absolute bottom-0 w-max", anchor)}>
          <AnimatePresence mode="popLayout" initial={false} anchorX={left ? "left" : "right"} anchorY="bottom">
            <motion.div
              key={view}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97, filter: "blur(2px)", transition: { duration: 0.14 } }}
              transition={reduce ? { duration: 0.12 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: view === "trigger" ? 0.06 : 0.04 }}
              style={{ transformOrigin: left ? "bottom left" : "bottom right" }}
            >
              {view === "trigger" && (
                <button
                  ref={triggerRef}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={false}
                  onClick={() => setStatus("open")}
                  className="inline-flex h-10 items-center gap-2 rounded-3xl px-4 text-ui font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&_svg]:size-4"
                >
                  <ChatIcon />
                  {label}
                </button>
              )}

              {view === "form" && (
                <form
                  role="dialog"
                  aria-labelledby={titleId}
                  aria-busy={busy || undefined}
                  className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submit()
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span id={titleId} className="text-ui-lg font-semibold">
                      {title}
                    </span>
                    <button
                      type="button"
                      aria-label={l10n.closeFeedback}
                      disabled={busy}
                      onClick={() => close()}
                      className="-mr-1.5 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                  <textarea
                    ref={textareaRef}
                    aria-label={l10n.yourFeedback}
                    value={message}
                    disabled={busy}
                    placeholder={placeholder}
                    onChange={(e) => {
                      setMessage(e.target.value)
                      if (status === "error") setStatus("open")
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        void submit()
                      }
                    }}
                    rows={3}
                    className="min-h-24 w-full resize-none rounded-xl bg-background dark:bg-input/32 px-3 py-2.5 text-ui shadow-well outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <MoodGroup value={mood} onValueChange={setMood} disabled={busy} />
                    <StatefulButton
                      type="submit"
                      size="sm"
                      state={status === "sending" ? "loading" : status === "error" ? "error" : "idle"}
                      loadingText={l10n.sending}
                      errorText={l10n.retry}
                      disabled={!message.trim()}
                    >
                      {l10n.send}
                    </StatefulButton>
                  </div>
                  <AnimatePresence initial={false}>
                    {status === "error" && (
                      <motion.p
                        role="alert"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="-mt-1 overflow-hidden text-ui-sm text-destructive-text"
                      >
                        {l10n.feedbackSendFailed}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </form>
              )}

              {view === "sent" && (
                <div role="status" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col items-center gap-1 px-4 pt-6 pb-5 text-center">
                  <span className="relative mb-2 inline-flex size-11 items-center justify-center">
                    {!reduce &&
                      SPARKS.map((s, i) => (
                        <motion.span
                          key={i}
                          aria-hidden
                          className={cn("absolute size-1.5 rounded-full", s.tone)}
                          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
                          animate={{ x: s.x, y: s.y, opacity: 0, scale: 1 }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
                        />
                      ))}
                    <motion.span
                      initial={reduce ? false : { scale: 0.25, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 480, damping: 32 }}
                      className="inline-flex size-11 items-center justify-center rounded-full bg-success text-success-foreground"
                    >
                      <CheckIcon size={22} />
                    </motion.span>
                  </span>
                  <span className="text-ui font-semibold">{successTitle}</span>
                  <span className="text-ui-sm text-muted-foreground">{successDescription}</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

/** In the flow: the question and moods on one row; a picked mood opens the note and send in place. */
function InlineFeedback({
  onSubmit,
  title,
  placeholder,
  successTitle,
  successDescription,
  bordered = true,
  className,
}: PlacementProps) {
  const l10n = useLocale().labels
  if (title === undefined) title = l10n.wasThisPageHelpful
  if (placeholder === undefined) placeholder = l10n.shareAnIdeaOrReportABug
  if (successTitle === undefined) successTitle = l10n.thanksForTheFeedback
  if (successDescription === undefined) successDescription = l10n.weReadEveryMessage

  const reduce = useReducedMotion()
  const titleId = React.useId()
  const [status, setStatus] = React.useState<Exclude<Status, "closed">>("open")
  const [message, setMessage] = React.useState("")
  const [mood, setMood] = React.useState<FeedbackMood | null>(null)
  const busy = status === "sending"
  const expanded = mood !== null
  // A mood alone is an answer here; the note is optional.
  const ready = mood !== null || message.trim() !== ""

  const submit = async () => {
    if (!ready || busy) return
    setStatus("sending")
    try {
      await onSubmit?.({ message: message.trim(), mood })
      setStatus("sent")
    } catch {
      setStatus("error")
    }
  }

  const fade = reduce ? { duration: 0.12 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <div
      data-slot="feedback-widget"
      data-placement="inline"
      data-state={status}
      data-bordered={bordered || undefined}
      className={cn(bordered && "border-t border-border pt-5", className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        {status === "sent" ? (
          <motion.div
            key="sent"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={fade}
            className="flex min-h-8 items-center gap-2.5"
          >
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
              <CheckIcon size={14} />
            </span>
            <span className="text-ui font-medium">{successTitle}</span>
            <span className="text-ui-sm text-muted-foreground max-sm:hidden">{successDescription}</span>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            aria-labelledby={titleId}
            aria-busy={busy || undefined}
            exit={{ opacity: 0 }}
            transition={fade}
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span id={titleId} className="text-ui font-medium">
                {title}
              </span>
              <MoodGroup value={mood} onValueChange={setMood} disabled={busy} labelledBy={titleId} />
            </div>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  key="note"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={fade}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-3 px-0.5 pt-3 pb-0.5">
                    <textarea
                      aria-label={l10n.yourFeedback}
                      value={message}
                      disabled={busy}
                      placeholder={placeholder}
                      onChange={(e) => {
                        setMessage(e.target.value)
                        if (status === "error") setStatus("open")
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          void submit()
                        }
                      }}
                      rows={3}
                      className="min-h-20 w-full resize-none rounded-xl bg-background dark:bg-input/32 px-3 py-2.5 text-ui shadow-well outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    />
                    <div className="flex items-center justify-end gap-3">
                      {status === "error" && (
                        <p role="alert" className="me-auto text-ui-sm text-destructive-text">
                          {l10n.feedbackSendFailed}
                        </p>
                      )}
                      <StatefulButton
                        type="submit"
                        size="sm"
                        state={busy ? "loading" : status === "error" ? "error" : "idle"}
                        loadingText={l10n.sending}
                        errorText={l10n.retry}
                        disabled={!ready}
                      >
                        {l10n.send}
                      </StatefulButton>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
