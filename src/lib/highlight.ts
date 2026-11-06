import type { Theme, ThemedToken } from "@pierre/highlights"

export type CodeToken = { content: string; light?: string; dark?: string }
export type CodeTokenLines = CodeToken[][]

const theme: Theme = { name: "tokens", appearance: "light", cssVariables: true, style: {} }
const colors: Record<string, string> = {
  comment: "muted-foreground", string: "success", keyword: "chart-5",
  function: "chart-3", type: "chart-3", constructor: "chart-3",
  number: "chart-1", boolean: "chart-1", constant: "chart-1",
  attribute: "chart-1", property: "chart-1", tag: "success", selector: "chart-3",
}
const load = () => import("@pierre/highlights")
const tone = (role: string) => role === "foreground" || role === "muted-foreground"
  ? `var(--${role})`
  : `color-mix(in oklab, var(--${role}) 65%, var(--foreground))`
function convert(lines: ThemedToken[][]): CodeTokenLines {
  return lines.map((line) => line.map(({ content, color }) => {
    const scope = color?.replace(/^var\(--hls-/, "").replace(/\)$/, "") ?? ""
    const role = scope === "diff-minus" ? "destructive" : scope === "diff-plus" ? "success" : colors[scope.split("-")[0]] ?? "foreground"
    return { content, light: tone(role), dark: tone(role) }
  }))
}

let fallback: Promise<import("shiki").Highlighter> | undefined
async function fallbackTokens(code: string, language: string): Promise<CodeTokenLines> {
  const api = await import("shiki")
  if (!(language in api.bundledLanguages || language in api.bundledLanguagesAlias)) return plainTokens(code)
  fallback ??= import("shiki/engine/javascript").then(({ createJavaScriptRegexEngine }) => api.createHighlighter({
    themes: [{ name: "tokens", colors: { "editor.foreground": "var(--foreground)" }, tokenColors: [
      ...Object.entries(colors).map(([scope, role]) => ({ scope, settings: { foreground: tone(role) } })),
    ] }], langs: [], engine: createJavaScriptRegexEngine({ forgiving: true }),
  }))
  const highlighter = await fallback
  const lang = language as Parameters<typeof highlighter.loadLanguage>[0]
  await highlighter.loadLanguage(lang)
  return highlighter.codeToTokens(code, { lang: language as import("shiki").BundledLanguage, theme: "tokens" }).tokens.map((line) =>
    line.map(({ content, color }) => ({ content, light: color, dark: color })))
}
const plainTokens = (code: string): CodeTokenLines => code.split("\n").map((content) => [{ content }])

/** Token colours resolve against the current theme, including styles and accents. */
export async function highlightTokens(code: string, language = "text"): Promise<CodeTokenLines> {
  try {
    const api = await load()
    if (api.isSupportedLanguage(language)) return convert(api.codeToTokens(code, { lang: language, theme }).tokens)
  } catch { /* The fallback also works where compilation of binary modules is unavailable. */ }
  return fallbackTokens(code, language).catch(() => plainTokens(code))
}

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
export function tokensToHtml(lines: CodeTokenLines) {
  return `<pre class="code-syntax"><code>${lines.map((line) => {
    const runs: CodeToken[] = []
    for (const token of line) {
      const previous = runs[runs.length - 1]
      if (previous && previous.light === token.light) previous.content += token.content
      else runs.push({ ...token })
    }
    return `<span class="line">${runs.map((token) => token.light && token.light !== "var(--foreground)"
      ? `<span style="color:${escape(token.light)}">${escape(token.content)}</span>`
      : escape(token.content)).join("")}</span>`
  }).join("\n")}</code></pre>`
}
export const plainHighlight = (code: string) => tokensToHtml(plainTokens(code))

/** Trusted, escaped markup for static code surfaces. */
export async function highlight(code: string, language = "text") {
  return tokensToHtml(await highlightTokens(code, language))
}

/** One append-only stream per surface; edits and language changes start a new stream. */
export async function createCodeStream(language: string) {
  const api = await load().catch(() => null)
  let source = ""
  let lines: CodeTokenLines = []
  let ended = false
  const supported = api?.isSupportedLanguage(language)
  const stream = supported && api ? new api.StreamTokenizer({ lang: language as import("@pierre/highlights").Lang, theme }) : null
  return {
    async update(code: string, complete = false) {
      if (ended || !code.startsWith(source)) throw new Error("Start a new code stream after an edit or completion")
      const chunk = code.slice(source.length)
      source = code
      if (!stream) return highlightTokens(code, language)
      lines = [...lines, ...convert(stream.pushCode(chunk))]
      if (complete) {
        lines = [...lines, ...convert(stream.end())]
        ended = true
      }
      return lines
    },
    dispose() { stream?.dispose() },
  }
}
