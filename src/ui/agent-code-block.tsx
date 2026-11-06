"use client";

import * as React from "react"
import { useLocale } from "@/ui/locale-provider"
import { useReducedMotion } from "motion/react"
import type { CodeToken, CodeTokenLines } from "@/lib/highlight"
import { useCodeTokens } from "@/lib/use-code-tokens"

import { cn } from "@/lib/utils"
import { CodeCopyButton, useCopy } from "@/ui/code-block"
import { ScrollArea } from "@/ui/scroll-area"

/* -------------------------------------------------------------------------- */
/*  Highlighting (shared with file-diff)                                       */
/* -------------------------------------------------------------------------- */

const EXTENSION_LANGS: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript",
  json: "json", md: "markdown", mdx: "mdx", css: "css", scss: "scss", html: "html", py: "python",
  rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift", sh: "bash",
  bash: "bash", zsh: "bash", yml: "yaml", yaml: "yaml", toml: "toml", sql: "sql", php: "php",
  c: "c", h: "c", cpp: "cpp", cs: "csharp", vue: "vue", svelte: "svelte", diff: "diff",
}

/** Guess a syntax language id from a filename like `app/page.tsx`. */
function languageFromFilename(filename?: string, fallback = "text") {
  const ext = filename?.split(".").pop()?.toLowerCase()
  return (ext && EXTENSION_LANGS[ext]) || fallback
}

/**
 * Render one source line from (possibly stale) tokens. Tokens are used only
 * while they still describe a prefix of the line; anything past that renders
 * as plain text until the next pass catches up.
 */
function CodeLine({ text, tokens }: { text: string; tokens?: CodeToken[] }) {
  if (!tokens || tokens.length === 0) return <>{text}</>
  const parts: React.ReactNode[] = []
  let used = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (text.slice(used, used + t.content.length) !== t.content) break
    parts.push(
      <span
        key={i}
        style={{ "--code-light": t.light ?? "inherit", "--code-dark": t.dark ?? t.light ?? "inherit" } as React.CSSProperties}
        className="text-(--code-light) dark:text-(--code-dark)"
      >
        {t.content}
      </span>
    )
    used += t.content.length
  }
  if (used < text.length) parts.push(<React.Fragment key="rest">{text.slice(used)}</React.Fragment>)
  return <>{parts}</>
}

/* -------------------------------------------------------------------------- */
/*  AgentCodeBlock                                                             */
/* -------------------------------------------------------------------------- */

type LineSelector = number | [start: number, end: number]

function toLineSet(lines?: LineSelector[]) {
  const set = new Set<number>()
  for (const l of lines ?? []) {
    if (typeof l === "number") set.add(l)
    else for (let i = Math.min(l[0], l[1]); i <= Math.max(l[0], l[1]); i++) set.add(i)
  }
  return set
}

type AgentCodeBlockProps = Omit<React.ComponentProps<"div">, "children"> & {
  code: string
  /** Syntax language id. Inferred from `filename` when omitted. */
  language?: string
  /** Shown in the header with the copy button. Without it the copy button floats. */
  filename?: React.ReactNode
  showLineNumbers?: boolean
  /** First line number (for excerpts). */
  startLine?: number
  /** Line numbers (as displayed) to emphasise: `[3, [7, 9]]`. */
  highlightLines?: LineSelector[]
  /** While true, shows a live caret and follows the newest line. */
  streaming?: boolean
  /** Max height of the scrolling code area in px. */
  maxHeight?: number
  copyable?: boolean
  /** Wrap long lines instead of scrolling horizontally. */
  wrap?: boolean
}

/**
 * Syntax-highlighted code surface for agent output: streams without
 * flicker, numbers and emphasises lines, follows the newest line while
 * streaming and copies with feedback.
 */
function AgentCodeBlock({
  code,
  language,
  filename,
  showLineNumbers = true,
  startLine = 1,
  highlightLines,
  streaming = false,
  maxHeight = 360,
  copyable = true,
  wrap = false,
  className,
  ...props
}: AgentCodeBlockProps) {
  const l10n = useLocale().labels

  const lang = language ?? languageFromFilename(typeof filename === "string" ? filename : undefined)
  const tokens = useCodeTokens(code, lang, streaming)
  const reduce = useReducedMotion() ?? false
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const pinned = React.useRef(true)
  const marked = React.useMemo(() => toLineSet(highlightLines), [highlightLines])
  const lines = React.useMemo(() => {
    const out = code.split("\n")
    // A trailing newline should not render an empty numbered line once finished.
    if (!streaming && out.length > 1 && out[out.length - 1] === "") out.pop()
    return out
  }, [code, streaming])
  const gutter = String(startLine + lines.length - 1).length

  // Follow the live edge while streaming, unless the reader scrolled away.
  React.useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el || !streaming || !pinned.current) return
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" })
  }, [code, streaming, reduce])

  const copyButton = copyable ? <CodeCopyButton value={() => code} /> : null

  return (
    <div
      data-slot="agent-code-block"
      data-streaming={streaming || undefined}
      aria-busy={streaming || undefined}
      className={cn(
        "group/code relative overflow-hidden rounded-xl bg-code text-ui text-foreground shadow-raised",
        className
      )}
      {...props}
    >
      {filename !== undefined && (
        <div
          data-slot="agent-code-block-header"
          className="flex h-10 items-center gap-2 border-b border-border pr-1.5 pl-4"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-ui-sm text-muted-foreground">{filename}</span>
          {streaming && (
            <span className="inline-flex items-center gap-1.5 text-ui-xs font-medium text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              {l10n.writing}
            </span>
          )}
          {lang !== "text" && (
            <span className="rounded-control-sm bg-muted px-2 py-0.5 font-mono text-ui-2xs text-muted-foreground shadow-chip">
              {lang}
            </span>
          )}
          {copyButton}
        </div>
      )}
      {filename === undefined && copyButton && (
        <div className="absolute top-2 right-2 z-10 rounded-control bg-code/80 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover/code:opacity-100 group-focus-within/code:opacity-100 pointer-coarse:opacity-100">
          {copyButton}
        </div>
      )}
      <ScrollArea
        orientation={wrap ? "vertical" : "both"}
        viewportRef={viewportRef}
        viewportProps={{
          "data-slot": "agent-code-block-viewport",
          style: { maxHeight },
          onScroll: (e) => {
            const el = e.currentTarget
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
          },
        }}
        className={filename !== undefined ? "rounded-b-[inherit]" : "rounded-[inherit]"}
      >
        {/* Wrapping needs a pre as wide as the viewport; w-max would grow it to the longest line. */}
        <pre data-wrap={wrap || undefined} className={cn("m-0 py-3 font-mono leading-[1.65]", wrap ? "w-full" : "w-max min-w-full")}>
          <code className="block">
            {lines.map((line, i) => {
              const n = startLine + i
              const isMarked = marked.has(n)
              const last = i === lines.length - 1
              return (
                <span
                  key={i}
                  data-line={n}
                  data-highlighted={isMarked || undefined}
                  className={cn(
                    "relative flex pr-4",
                    !showLineNumbers && "pl-4",
                    isMarked &&
                      "bg-primary/8 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary"
                  )}
                >
                  {showLineNumbers && (
                    <span
                      aria-hidden
                      style={{ width: `${gutter + 2.5}ch` }}
                      className={cn(
                        // design-check-ignore text-align-logical -- line numbers sit against code, which reads left to right
                        "sticky left-0 shrink-0 bg-code pr-3 pl-3 text-right text-muted-foreground/60 tabular-nums select-none",
                        isMarked && "bg-[color-mix(in_oklch,var(--code),var(--primary)_8%)] text-primary-text"
                      )}
                    >
                      {n}
                    </span>
                  )}
                  <span className={cn("min-w-0 flex-1", wrap ? "whitespace-pre-wrap wrap-anywhere" : "whitespace-pre")}>
                    <CodeLine text={line} tokens={tokens?.[i]} />
                    {streaming && last && (
                      <span
                        aria-hidden
                        className="ml-px inline-block h-[1.1em] w-[0.5ch] translate-y-[0.2em] animate-pulse rounded-[1px] bg-primary/80"
                      />
                    )}
                    {line === "" && !(streaming && last) && "\u200b"}
                  </span>
                </span>
              )
            })}
          </code>
        </pre>
      </ScrollArea>
    </div>
  )
}

export {
  AgentCodeBlock,
  CodeCopyButton,
  CodeLine,
  useCodeTokens,
  useCopy,
  languageFromFilename,
  type AgentCodeBlockProps,
  type CodeToken,
  type CodeTokenLines,
  type LineSelector,
}
