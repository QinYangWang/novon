"use client";

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { CheckIcon, CopyIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { ActionSwapBlurIcon } from "@/ui/action-swap-blur"
import { Button } from "@/ui/button"
import { useLocale } from "@/ui/locale-provider"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/ui/tabs"

/*
 * One shell command on a bar with a copy button. The command scrolls sideways when it does not
 * fit; the prompt glyph is decoration and never ends up in the copy. `lg` is the round hero bar
 * with a solid round button; `default` is a quieter bar for docs and settings.
 */
const commandCopyVariants = cva("flex w-full min-w-0 items-center text-card-foreground", {
  variants: {
    variant: {
      default: "bg-code shadow-raised",
      floating: "bg-card/80 shadow-xl backdrop-blur-xl",
      /** Inside a `CommandGroup`: the group owns the frame, the row is just the command line. */
      plain: "bg-transparent",
    },
    size: {
      // The ghost button sits 6px from the bar's edge, so its corners follow the bar's.
      default: "frame-xl frame-inset-1.5 h-10 gap-2 ps-3 pe-1.5 text-ui",
      lg: "h-14 gap-3 rounded-control ps-4 pe-2 text-ui-sm sm:ps-6 sm:text-ui-lg",
    },
  },
  compoundVariants: [
    // The group owns the frame, so its row keeps the height but takes no radius of its own.
    { variant: "plain", size: "default", className: "h-10 gap-2 ps-3 pe-1.5 text-ui" },
  ],
  defaultVariants: { variant: "default", size: "default" },
})

function useCopied(timeout = 1600) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = React.useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard?.writeText(text)
      } catch {
        // Clipboard blocked: leave the button as it is.
        return false
      }
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), timeout)
      return true
    },
    [timeout]
  )
  return { copied, copy }
}

type CommandCopyProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof commandCopyVariants> & {
    /** The command, exactly as it is copied. */
    command: string
    /** Glyph before the command; `null` hides it. */
    prompt?: React.ReactNode
    /** Accessible name of the copy button. Defaults to the locale's "Copy command". */
    label?: string
    /** Called after the command reaches the clipboard. */
    onCopy?: (command: string) => void
  }

function CommandCopy({
  command,
  prompt = "$",
  label,
  onCopy,
  variant = "default",
  size = "default",
  className,
  ...props
}: CommandCopyProps) {
  const { labels } = useLocale()
  const { copied, copy } = useCopied()
  const lg = size === "lg"
  return (
    <div
      data-slot="command-copy"
      data-variant={variant}
      data-size={size}
      className={cn(commandCopyVariants({ variant, size }), className)}
      {...props}
    >
      <code
        data-slot="command-copy-command"
        className="min-w-0 flex-1 overflow-x-auto text-start font-mono whitespace-nowrap scrollbar-none"
      >
        {prompt != null ? (
          <span aria-hidden className="text-muted-foreground select-none">
            {prompt}{" "}
          </span>
        ) : null}
        {command}
      </code>
      <Button
        data-slot="command-copy-button"
        variant={lg ? "inverse" : "ghost"}
                size={lg ? "icon-lg" : "icon-sm"}
        aria-label={copied ? labels.copied : (label ?? labels.copyCommand)}
        onClick={async () => {
          if (await copy(command)) onCopy?.(command)
        }}
        className={cn(lg ? "size-10 rounded-[max(calc(var(--radius-control)-var(--spacing)*2),1px)]" : "rounded-inner text-muted-foreground hover:text-foreground")}
      >
        <ActionSwapBlurIcon value={copied ? "copied" : "copy"}>
          {/* Full strength: the glyph is the whole button. */}
          {copied ? <CheckIcon size={16} className="opacity-100" /> : <CopyIcon size={16} className="opacity-100" />}
        </ActionSwapBlurIcon>
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? labels.copied : ""}
      </span>
    </div>
  )
}

type CommandGroupItem = { value: string; command: string; label?: string }

type CommandGroupProps = Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> & {
  /** One entry per variant of the command, in tab order. */
  items: readonly CommandGroupItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Remember the picked tab in localStorage under this key and keep groups with the same key in sync. */
  storageKey?: string
  /** Glyph before the command; `null` hides it. */
  prompt?: React.ReactNode
}

const STORAGE_EVENT = "command-group-change"

/** Same-tab broadcast so every group with one storageKey switches together. */
function readStored(key: string, values: readonly string[]) {
  try {
    const stored = localStorage.getItem(key)
    return stored && values.includes(stored) ? stored : undefined
  } catch {
    return undefined
  }
}

/**
 * Tabs and command in one frame: the tab row is the bar's top line and the command sits under it.
 * Tabs use the ghost variant (soft fill, no underline) and sit 6px in, concentric with the frame,
 * so the two read as one control instead of a separate segmented track above a separate pill.
 */
function CommandGroup({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  storageKey,
  prompt = "$",
  className,
  ...props
}: CommandGroupProps) {
  const values = React.useMemo(() => items.map((i) => i.value), [items])
  const valuesKey = values.join("\u0000")
  const [internal, setInternal] = React.useState(defaultValue ?? values[0])
  const current = valueProp ?? (values.includes(internal ?? "") ? internal : values[0])
  const active = items.find((i) => i.value === current) ?? items[0]

  const select = React.useCallback(
    (next: string, broadcast = true) => {
      setInternal(next)
      onValueChange?.(next)
      if (!storageKey || !broadcast) return
      try {
        localStorage.setItem(storageKey, next)
      } catch {
        // storage can be unavailable (private mode, sandboxed iframes)
      }
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { storageKey, value: next } }))
    },
    [onValueChange, storageKey]
  )

  // Restore the remembered tab and follow other groups that share the key.
  React.useEffect(() => {
    if (!storageKey) return
    const known = valuesKey.split("\u0000")
    const stored = readStored(storageKey, known)
    if (stored) setInternal(stored)
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ storageKey: string; value: string }>).detail
      if (detail?.storageKey === storageKey && known.includes(detail.value)) setInternal(detail.value)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue && known.includes(e.newValue)) setInternal(e.newValue)
    }
    window.addEventListener(STORAGE_EVENT, onCustom)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(STORAGE_EVENT, onCustom)
      window.removeEventListener("storage", onStorage)
    }
  }, [storageKey, valuesKey])

  if (!active) return null

  return (
    <div
      data-slot="command-group"
      className={cn("frame-xl frame-inset-1.5 overflow-hidden bg-code text-ui text-card-foreground shadow-raised", className)}
      {...props}
    >
      <Tabs value={active.value} onValueChange={(v) => select(String(v))} className="gap-0">
        <div data-slot="command-group-header" className="flex h-10 items-center gap-2 border-b border-border/60 px-1.5">
          <TabsList variant="ghost" size="sm" className="min-w-0 shrink overflow-x-auto scrollbar-none">
            {items.map((item) => (
              <TabsTab key={item.value} value={item.value} className="font-mono font-normal">
                {item.label ?? item.value}
              </TabsTab>
            ))}
          </TabsList>
        </div>
        {items.map((item) => (
          <TabsPanel key={item.value} value={item.value}>
            <CommandCopy command={item.command} prompt={prompt} variant="plain" className="ps-3 pe-1.5" />
          </TabsPanel>
        ))}
      </Tabs>
    </div>
  )
}

export { CommandCopy, CommandGroup, commandCopyVariants, type CommandCopyProps, type CommandGroupItem, type CommandGroupProps }
