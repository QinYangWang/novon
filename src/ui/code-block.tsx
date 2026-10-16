import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { CheckIcon, CopyIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import { getFileKind } from "@/ui/file-tree"
import { ScrollArea } from "@/ui/scroll-area"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/ui/tabs"

/*
 * Static code surfaces for markup that was highlighted at build time. Nothing is
 * tokenized in the browser: CodeBlock styles whatever <pre> it receives. Dual-theme
 * output (light and dark colour custom properties on the <pre> and its spans)
 * follows the `.dark` class; `.line` spans get numbers, highlight and diff fills.
 * CodeGroup puts several blocks behind tabs in one frame.
 */

/* -------------------------------------------------------------------------- */
/*  Copy                                                                       */
/* -------------------------------------------------------------------------- */

function useCopy(timeout = 1600) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = React.useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard?.writeText(text)
      } catch {
        return
      }
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), timeout)
    },
    [timeout]
  )
  return { copied, copy }
}

/** Small icon button that swaps to a check after copying. */
function CodeCopyButton({
  value,
  className,
  label = "Copy code",
}: {
  value: string | (() => string)
  className?: string
  label?: string
}) {
  const { copied, copy } = useCopy()
  const reduce = useReducedMotion() ?? false
  return (
    <button
      type="button"
      data-slot="code-copy-button"
      aria-label={copied ? "Copied" : label}
      onClick={(e) => {
        e.stopPropagation()
        copy(typeof value === "function" ? value() : value)
      }}
      className={cn(
        "relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-copied:text-success",
        className
      )}
      data-copied={copied || undefined}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={copied ? "check" : "copy"}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
          transition={{ type: "spring", stiffness: 600, damping: 32 }}
          className="grid place-items-center"
        >
          {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        </motion.span>
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  )
}

/** Text of the code inside `el` (line numbers are CSS, so they never end up in the copy). */
function codeText(el: Element | null | undefined) {
  const code = el?.querySelector("pre") ?? el
  return (code?.textContent ?? "").replace(/\n$/, "")
}

/* -------------------------------------------------------------------------- */
/*  Title bar icon                                                             */
/* -------------------------------------------------------------------------- */

const PLAIN_FILE = getFileKind("")

/** File-type icon for a title like `app/page.tsx`, else for the language; null when neither is known. */
function titleIcon(title: React.ReactNode, language?: string) {
  const name = typeof title === "string" && /\.[\w-]+$/.test(title) ? title : language ? `file.${language}` : ""
  if (!name) return null
  const kind = getFileKind(name.split("/").pop() ?? name)
  if (kind === PLAIN_FILE && typeof title !== "string") return null
  return (
    <span aria-hidden className={cn("grid size-4 shrink-0 place-items-center [&_svg]:size-3.5", kind.className)}>
      {kind.icon}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  CodeBlock                                                                  */
/* -------------------------------------------------------------------------- */

/** Styles for the highlighted <pre> inside a block: lines, numbers, marks and the two token colour sets. */
const contentClass = cn(
  "font-mono text-ui leading-[1.65] text-foreground",
  "[&_pre]:m-0 [&_pre]:w-max [&_pre]:min-w-full [&_pre]:bg-transparent! [&_pre]:py-3 [&_pre]:font-[inherit] [&_pre]:[tab-size:2]",
  "[&_pre:not(:has(.line))]:px-4 [&_code]:block [&_code]:font-[inherit]",
  "[&_.line]:inline-block [&_.line]:min-h-[1lh] [&_.line]:min-w-full [&_.line]:px-4",
  // Token colours: light by default, dark under .dark (important beats the inline light colour some output carries).
  "[&_.shiki]:text-(--shiki-light) [&_.shiki_span]:text-(--shiki-light)",
  "dark:[&_.shiki]:text-(--shiki-dark)! dark:[&_.shiki_span]:text-(--shiki-dark)!",
  // Marked lines and words.
  "[&_.line.highlighted]:bg-primary/8 [&_.line.highlighted]:shadow-[inset_2px_0_0_var(--primary)]",
  "[&_.line.diff.add]:bg-success/10 [&_.line.diff.add]:shadow-[inset_2px_0_0_var(--success)]",
  "[&_.line.diff.remove]:bg-destructive/10 [&_.line.diff.remove]:shadow-[inset_2px_0_0_var(--destructive)]",
  "[&_.has-focused_.line:not(.focused)]:opacity-50",
  "[&_.highlighted-word]:rounded-2xs [&_.highlighted-word]:bg-primary/12 [&_.highlighted-word]:shadow-[0_0_0_2px_color-mix(in_oklab,var(--primary)_12%,transparent)]",
  // Line numbers (CSS counters, so copying skips them).
  "data-line-numbers:[&_code]:[counter-reset:line] data-line-numbers:[&_pre:not(:has(code))]:[counter-reset:line]",
  "data-line-numbers:[&_.line]:before:mr-4 data-line-numbers:[&_.line]:before:inline-block data-line-numbers:[&_.line]:before:w-(--code-gutter) data-line-numbers:[&_.line]:before:text-right data-line-numbers:[&_.line]:before:text-muted-foreground/60 data-line-numbers:[&_.line]:before:tabular-nums data-line-numbers:[&_.line]:before:content-[counter(line)] data-line-numbers:[&_.line]:before:select-none data-line-numbers:[&_.line]:before:[counter-increment:line]",
  "data-line-numbers:[&_.line.highlighted]:before:text-primary",
  // Wrap long lines instead of scrolling.
  "data-wrap:[&_pre]:w-auto data-wrap:[&_pre]:whitespace-pre-wrap data-wrap:[&_pre]:break-words"
)

const CodeGroupContext = React.createContext(false)

type CodeBlockProps = Omit<React.ComponentProps<"div">, "title" | "children"> & {
  /** Title bar text, usually a file name. Also the tab label inside a CodeGroup. */
  title?: React.ReactNode
  /** Language label shown in the title bar. */
  language?: string
  /** Title bar icon. Defaults to the file-type icon for `title` (or `language`); `false` hides it. */
  icon?: React.ReactNode | false
  /** Pre-highlighted markup as a string (a whole `<pre>`). Rendered as is, so only pass trusted build output. */
  html?: string
  /** Pre-highlighted elements (a `<pre>`), used when `html` is not set. */
  children?: React.ReactNode
  /** Number `.line` rows. */
  lineNumbers?: boolean
  /** Wrap long lines instead of scrolling horizontally. */
  wrap?: boolean
  copyable?: boolean
  /** Max height of the code area before it scrolls (px or any CSS length). */
  maxHeight?: number | string
}

/** The scrolling code area shared by CodeBlock and CodeGroup. */
function CodeBlockContent({
  html,
  children,
  lineNumbers,
  wrap,
  maxHeight,
  contentRef,
  className,
}: Pick<CodeBlockProps, "html" | "children" | "lineNumbers" | "wrap" | "maxHeight" | "className"> & {
  contentRef?: React.Ref<HTMLDivElement>
}) {
  const innerRef = React.useRef<HTMLDivElement>(null)
  const [gutter, setGutter] = React.useState(2)
  React.useImperativeHandle(contentRef, () => innerRef.current as HTMLDivElement)

  // Gutter width follows the largest line number.
  React.useLayoutEffect(() => {
    if (!lineNumbers) return
    const count = innerRef.current?.querySelectorAll(".line").length ?? 0
    setGutter(Math.max(2, String(count).length))
  }, [html, children, lineNumbers])

  return (
    <ScrollArea
      orientation={wrap ? "vertical" : "both"}
      viewportProps={{ style: maxHeight !== undefined ? { maxHeight } : undefined }}
      className={cn("rounded-[inherit]", className)}
    >
      <div
        ref={innerRef}
        data-slot="code-block-content"
        data-line-numbers={lineNumbers || undefined}
        data-wrap={wrap || undefined}
        style={{ "--code-gutter": `${gutter}ch` } as React.CSSProperties}
        className={contentClass}
        {...(html !== undefined ? { dangerouslySetInnerHTML: { __html: html } } : { children })}
      />
    </ScrollArea>
  )
}

function CodeBlockLanguage({ language }: { language: string }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-ui-2xs text-muted-foreground shadow-chip">
      {language}
    </span>
  )
}

/**
 * Frame for pre-highlighted code: optional title bar with file icon, language label and
 * copy button; without a title or language the copy button floats on hover.
 */
function CodeBlock({
  title,
  language,
  icon,
  html,
  children,
  lineNumbers = false,
  wrap = false,
  copyable = true,
  maxHeight,
  className,
  ...props
}: CodeBlockProps) {
  const grouped = React.useContext(CodeGroupContext)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const header = title !== undefined || language !== undefined
  const content = (
    <CodeBlockContent
      html={html}
      lineNumbers={lineNumbers}
      wrap={wrap}
      maxHeight={maxHeight}
      contentRef={contentRef}
      className={grouped || header ? "rounded-b-[inherit]" : undefined}
    >
      {children}
    </CodeBlockContent>
  )
  // Inside a CodeGroup the group owns the frame, tabs and copy button.
  if (grouped) return content

  const shownIcon = icon === false ? null : (icon ?? titleIcon(title, language))
  const copyButton = copyable ? <CodeCopyButton value={() => codeText(contentRef.current)} /> : null

  return (
    <div
      data-slot="code-block"
      className={cn("group/code relative overflow-hidden rounded-xl bg-code text-ui text-foreground shadow-raised", className)}
      {...props}
    >
      {header && (
        <div data-slot="code-block-header" className="flex h-10 items-center gap-2 border-b border-border pr-1.5 pl-4">
          {shownIcon}
          <span className="min-w-0 flex-1 truncate font-mono text-ui-sm text-muted-foreground">{title}</span>
          {language !== undefined && title !== undefined && <CodeBlockLanguage language={language} />}
          {copyButton}
        </div>
      )}
      {!header && copyButton && (
        <div className="absolute top-2 right-2 z-10 rounded-full bg-code/80 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover/code:opacity-100 group-focus-within/code:opacity-100 pointer-coarse:opacity-100">
          {copyButton}
        </div>
      )}
      {content}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  CodeGroup                                                                  */
/* -------------------------------------------------------------------------- */

/** Same-tab broadcast so every CodeGroup with one storageKey switches together. */
const CODE_GROUP_EVENT = "code-group-change"
type CodeGroupChangeDetail = { storageKey: string; value: string }

type CodeGroupProps = Omit<React.ComponentProps<"div">, "children" | "defaultValue"> & {
  /** CodeBlock elements; each one's `title` labels its tab. */
  children?: React.ReactNode
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Remember the picked tab in localStorage under this key and keep groups with the same key in sync. */
  storageKey?: string
  copyable?: boolean
}

type CodeBlockElement = React.ReactElement<CodeBlockProps>

/** Several CodeBlocks behind tabs in one frame; the tab value is the block's title. */
function CodeGroup({
  children,
  value: valueProp,
  defaultValue,
  onValueChange,
  storageKey,
  copyable = true,
  className,
  ...props
}: CodeGroupProps) {
  const blocks = React.Children.toArray(children).filter(React.isValidElement) as CodeBlockElement[]
  const tabs = blocks.map((block, i) => {
    const { title, language } = block.props
    const value = typeof title === "string" ? title : language ?? `Code ${i + 1}`
    return { block, value, label: title ?? language ?? `Code ${i + 1}` }
  })
  const values = tabs.map((t) => t.value)
  const valuesKey = values.join("\u0000")
  const [internal, setInternal] = React.useState(defaultValue ?? values[0])
  const current = valueProp ?? (values.includes(internal ?? "") ? internal : values[0])
  const rootRef = React.useRef<HTMLDivElement>(null)

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
      window.dispatchEvent(
        new CustomEvent<CodeGroupChangeDetail>(CODE_GROUP_EVENT, { detail: { storageKey, value: next } })
      )
    },
    [onValueChange, storageKey]
  )

  // Restore the remembered tab and follow other groups (this tab and others) that share the key.
  React.useEffect(() => {
    if (!storageKey) return
    const known = valuesKey.split("\u0000")
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored && known.includes(stored)) setInternal(stored)
    } catch {
      // storage can be unavailable
    }
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<CodeGroupChangeDetail>).detail
      if (detail?.storageKey === storageKey && known.includes(detail.value)) setInternal(detail.value)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue && known.includes(e.newValue)) setInternal(e.newValue)
    }
    window.addEventListener(CODE_GROUP_EVENT, onChange)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(CODE_GROUP_EVENT, onChange)
      window.removeEventListener("storage", onStorage)
    }
  }, [storageKey, valuesKey])

  if (!tabs.length) return null
  const active = tabs.find((t) => t.value === current) ?? tabs[0]

  return (
    <div
      ref={rootRef}
      data-slot="code-group"
      className={cn("group/code relative overflow-hidden rounded-xl bg-code text-ui text-foreground shadow-raised", className)}
      {...props}
    >
      <Tabs value={active.value} onValueChange={(v) => select(String(v))} className="gap-0">
        <div
          data-slot="code-group-header"
          className="flex h-10 items-stretch gap-2 pr-1.5 pl-2 shadow-[inset_0_-1px_0_var(--border)]"
        >
          <TabsList variant="underline" size="sm" className="min-w-0 items-stretch overflow-x-auto shadow-none [scrollbar-width:none]">
            {tabs.map((t) => {
              const shownIcon = t.block.props.icon === false ? null : (t.block.props.icon ?? titleIcon(t.block.props.title, t.block.props.language))
              return (
                <TabsTab key={t.value} value={t.value} className="h-full font-mono font-normal">
                  {shownIcon}
                  {t.label}
                </TabsTab>
              )
            })}
          </TabsList>
          <span className="flex-1" />
          {copyable && (
            <span className="flex items-center">
              <CodeCopyButton
                value={() => codeText(rootRef.current?.querySelector('[data-slot="tabs-panel"]:not([hidden]) [data-slot="code-block-content"]'))}
              />
            </span>
          )}
        </div>
        <CodeGroupContext.Provider value>
          {tabs.map((t) => (
            <TabsPanel key={t.value} value={t.value} className="focus-visible:ring-inset">
              {t.block}
            </TabsPanel>
          ))}
        </CodeGroupContext.Provider>
      </Tabs>
    </div>
  )
}

export {
  CODE_GROUP_EVENT,
  CodeBlock,
  CodeCopyButton,
  CodeGroup,
  useCopy,
  type CodeBlockProps,
  type CodeGroupChangeDetail,
  type CodeGroupProps,
}
