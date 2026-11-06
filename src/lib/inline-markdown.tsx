import * as React from "react"

/*
 * Inline Markdown for short strings (schema descriptions, consent text): code spans, emphasis,
 * strong and links only. The result is React text and elements, so HTML in a
 * description stays text; links keep only http(s), relative and `#` targets, anything else shows its label. */

type InlineNode =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "em" | "strong"; c: InlineNode[] }
  | { t: "link"; href: string; c: InlineNode[] }

const PUNCT = /[!-/:-@[-`{-~]/
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c)
const isWord = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c)

/** Absolute http(s) URLs, `#fragments` and relative paths only. */
function safeHref(raw: string): string | null {
  const href = raw.trim()
  if (!href || /[\s<>"\\]/.test(href)) return null
  if (/^https?:\/\//i.test(href)) return href
  // A scheme is letters before the first `:` that come before any `/`, `?` or `#`; relative links have none.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null
  if (href.startsWith("//")) return null
  return href
}

/** Finds the closing delimiter for emphasis that opened at `from`. */
function findClose(s: string, from: number, delim: string): number {
  for (let i = from; i < s.length; i++) {
    const ch = s[i]
    if (ch === "\\") {
      i++
      continue
    }
    if (ch === "`") {
      const run = /^`+/.exec(s.slice(i))![0]
      const end = s.indexOf(run, i + run.length)
      if (end !== -1) i = end + run.length - 1
      continue
    }
    if (s.startsWith(delim, i) && !isSpace(s[i - 1]) && i > from) {
      // `*` closing `*` must not be half of `**`.
      if (delim.length === 1 && (s[i + 1] === delim || s[i - 1] === delim)) continue
      if (delim[0] === "_" && isWord(s[i + delim.length])) continue
      return i
    }
  }
  return -1
}

function parseInline(s: string, depth = 0, inLink = false): InlineNode[] {
  const out: InlineNode[] = []
  let text = ""
  const flush = () => {
    if (text) out.push({ t: "text", v: text })
    text = ""
  }
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === "\\" && i + 1 < s.length && PUNCT.test(s[i + 1])) {
      text += s[i + 1]
      i += 2
      continue
    }
    if (ch === "`") {
      const run = /^`+/.exec(s.slice(i))![0]
      const end = s.indexOf(run, i + run.length)
      // A closing run must be exactly as long.
      if (end !== -1 && s[end + run.length] !== "`") {
        let code = s.slice(i + run.length, end).replace(/\n/g, " ")
        if (code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim()) code = code.slice(1, -1)
        flush()
        out.push({ t: "code", v: code })
        i = end + run.length
        continue
      }
      text += run
      i += run.length
      continue
    }
    if (ch === "[" && !inLink && depth < 8) {
      const close = matchBracket(s, i)
      if (close !== -1 && s[close + 1] === "(") {
        const paren = matchParen(s, close + 1)
        if (paren !== -1) {
          // Drop an optional `"title"` after the URL.
          const dest = s.slice(close + 2, paren).trim().replace(/\s+"[^"]*"$/, "").replace(/^<(.*)>$/, "$1")
          const href = safeHref(dest)
          const label = parseInline(s.slice(i + 1, close), depth + 1, true)
          flush()
          if (href) out.push({ t: "link", href, c: label })
          else out.push(...label)
          i = paren + 1
          continue
        }
      }
    }
    if ((ch === "*" || ch === "_") && depth < 8) {
      const strong = s[i + 1] === ch
      const delim = strong ? ch + ch : ch
      const after = s[i + delim.length]
      const leftOk = !isSpace(after) && !(ch === "_" && isWord(s[i - 1]))
      if (leftOk) {
        const end = findClose(s, i + delim.length, delim)
        if (end !== -1) {
          flush()
          out.push({ t: strong ? "strong" : "em", c: parseInline(s.slice(i + delim.length, end), depth + 1, inLink) })
          i = end + delim.length
          continue
        }
      }
      text += delim
      i += delim.length
      continue
    }
    text += ch
    i++
  }
  flush()
  return out
}

/** The `)` that closes the `(` at `open`, allowing balanced parentheses inside the URL. */
function matchParen(s: string, open: number): number {
  let level = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") i++
    else if (s[i] === "(") level++
    else if (s[i] === ")" && --level === 0) return i
  }
  return -1
}

function matchBracket(s: string, open: number): number {
  let level = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") {
      i++
      continue
    }
    if (s[i] === "`") {
      const run = /^`+/.exec(s.slice(i))![0]
      const end = s.indexOf(run, i + run.length)
      if (end !== -1) i = end + run.length - 1
      continue
    }
    if (s[i] === "[") level++
    else if (s[i] === "]" && --level === 0) return i
  }
  return -1
}

const mdLink =
  "font-medium text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:rounded-2xs focus-visible:ring-2 focus-visible:ring-ring"

function renderInline(nodes: InlineNode[], linkClassName = mdLink): React.ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return n.v
      case "code":
        return <code key={i}>{n.v}</code>
      case "em":
        return <em key={i}>{renderInline(n.c, linkClassName)}</em>
      case "strong":
        return (
          <strong key={i} className="font-medium text-foreground">
            {renderInline(n.c, linkClassName)}
          </strong>
        )
      case "link":
        return (
          <a key={i} href={n.href} className={linkClassName}>
            {renderInline(n.c, linkClassName)}
          </a>
        )
    }
  })
}

/** Inline Markdown in a string as React nodes. `linkClassName` replaces the default link style. */
function InlineMarkdown({ text, linkClassName }: { text: string; linkClassName?: string }) {
  const nodes = React.useMemo(() => parseInline(text), [text])
  return <>{renderInline(nodes, linkClassName)}</>
}

/** Parses inline Markdown into a small node tree, for renderers of your own. */
function parseInlineMarkdown(text: string): InlineNode[] {
  return parseInline(text)
}

export { InlineMarkdown, parseInlineMarkdown, safeHref, type InlineNode }
