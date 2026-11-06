/**
 * Markdown syntax novon adds on top of MDX, as remark plugins shared by the
 * page compiler and the `.md` writer:
 *
 * - `:::note[Title]` … `:::` and GitHub `> [!NOTE]` alerts become `<Callout>`.
 * - `<PackageInstall packages="x" />` becomes a `<CodeGroup>` of fences, one per
 *   package manager, so they are highlighted at build time like any fence.
 * - Text and leaf directives novon does not know go back to plain text, so
 *   `a:b` in prose stays as written.
 */
import type { Root, RootContent, Paragraph, Text, Code, Blockquote } from 'mdast'
import { toString } from 'mdast-util-to-string'
import { visit, SKIP } from 'unist-util-visit'
import { packageCommands, type PackageCommandOptions } from '../shared.ts'

const CALLOUT_TYPES = new Set(['note', 'tip', 'info', 'warning', 'caution', 'danger'])
const CALLOUT_ALIASES: Record<string, string> = { important: 'info', error: 'danger', success: 'tip', check: 'tip' }

/** GitHub alert kinds and the Callout type each one maps to. */
const ALERTS: Record<string, string> = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'info', WARNING: 'warning', CAUTION: 'danger' }

export const PACKAGE_MANAGER_KEY = 'novon:package-manager'

type Attribute = { type: 'mdxJsxAttribute'; name: string; value: string | null | { type: string; value: string } }
type JsxElement = {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement'
  name: string | null
  attributes: Attribute[]
  children: RootContent[]
  position?: Root['position']
}

export function calloutType(name: string): string | undefined {
  const n = name.toLowerCase()
  if (CALLOUT_TYPES.has(n)) return n
  return CALLOUT_ALIASES[n]
}

function jsx(name: string, attrs: Record<string, string | undefined>, children: RootContent[], position?: Root['position']): RootContent {
  const attributes = Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ({ type: 'mdxJsxAttribute', name: k, value: v }))
  return { type: 'mdxJsxFlowElement', name, attributes, children, position } as unknown as RootContent
}

type DirectiveNode = {
  type: 'containerDirective' | 'leafDirective' | 'textDirective'
  name: string
  attributes?: Record<string, string | null | undefined> | null
  children: RootContent[]
  position?: Root['position']
}

/** `:::note[Title]` and `> [!NOTE]` → `<Callout type="note" title="Title">`. */
export function remarkCallouts() {
  return (tree: Root, file: { value?: unknown }) => {
    const source = typeof file?.value === 'string' ? file.value : String(file?.value ?? '')
    visit(tree, (node, index, parent) => {
      if (!parent || index === undefined) return
      const n = node as unknown as DirectiveNode
      if (n.type === 'containerDirective') {
        const type = calloutType(n.name)
        if (!type) {
          ;(parent.children as RootContent[]).splice(index, 1, ...n.children)
          return [SKIP, index]
        }
        let title: string | undefined = n.attributes?.title ?? undefined
        const label = n.children.findIndex((c) => c.type === 'paragraph' && (c.data as { directiveLabel?: boolean } | undefined)?.directiveLabel)
        if (label >= 0) title = toString(n.children.splice(label, 1)[0])
        // The same children array, so directives nested inside are still visited.
        ;(parent.children as RootContent[])[index] = jsx('Callout', { type, title }, n.children, n.position)
        return
      }
      if (n.type === 'leafDirective' || n.type === 'textDirective') {
        // Unknown directive syntax: put the original characters back.
        const start = n.position?.start.offset
        const end = n.position?.end.offset
        const raw = start !== undefined && end !== undefined && source ? source.slice(start, end) : `${n.type === 'leafDirective' ? '::' : ':'}${n.name}${toString(n as never)}`
        const text: Text = { type: 'text', value: raw }
        ;(parent.children as RootContent[])[index] = (n.type === 'leafDirective' ? { type: 'paragraph', children: [text] } : text) as RootContent
        return SKIP
      }
      if (node.type === 'blockquote') {
        const callout = githubAlert(node)
        if (callout) (parent.children as RootContent[])[index] = callout
      }
    })
  }
}

/** A blockquote opening with `[!NOTE]` (or TIP, IMPORTANT, WARNING, CAUTION); text after the marker is the title. */
function githubAlert(node: Blockquote): RootContent | undefined {
  const first = node.children[0]
  if (first?.type !== 'paragraph') return
  const head = first.children[0]
  if (head?.type !== 'text') return
  const m = head.value.match(/^\[!([A-Za-z]+)\][ \t]*([^\n]*)(?:\n|$)/)
  if (!m) return
  const type = ALERTS[m[1].toUpperCase()]
  if (!type) return
  const title = m[2].trim() || undefined
  const rest = head.value.slice(m[0].length)
  const paragraph: Paragraph = { ...first, children: [...first.children] }
  if (rest) paragraph.children[0] = { ...head, value: rest }
  else paragraph.children.shift()
  // A soft break right after the marker line would open the body with an empty line.
  if (paragraph.children[0]?.type === 'break') paragraph.children.shift()
  const children = [...(paragraph.children.length ? [paragraph] : []), ...node.children.slice(1)]
  return jsx('Callout', { type, title }, children, node.position)
}

/** Literal attributes of a JSX element; null when one is an expression. */
function literalAttributes(el: JsxElement): Record<string, string | true> | null {
  const out: Record<string, string | true> = {}
  for (const a of el.attributes) {
    if (a.type !== 'mdxJsxAttribute') return null
    if (a.value === null) out[a.name] = true
    else if (typeof a.value === 'string') out[a.name] = a.value
    else {
      const v = a.value.value.trim()
      if (v === 'true' || v === 'false') out[a.name] = v === 'true' ? true : 'false'
      else if (/^(['"`]).*\1$/.test(v)) out[a.name] = v.slice(1, -1)
      else return null
    }
  }
  return out
}

/** Props of `<PackageInstall>` written as literals. */
export function packageOptions(attrs: Record<string, string | true>): PackageCommandOptions {
  const str = (v: string | true | undefined) => (typeof v === 'string' ? v : undefined)
  const bool = (v: string | true | undefined) => v === true || v === 'true'
  return {
    packages: str(attrs.packages) ?? str(attrs.package),
    dev: bool(attrs.dev),
    global: bool(attrs.global),
    run: str(attrs.run),
    exec: str(attrs.exec),
    create: str(attrs.create),
    managers: str(attrs.managers)?.split(/[\s,]+/).filter(Boolean),
  }
}

/** `<PackageInstall packages="novon" dev />` → a CodeGroup with one `sh` fence per package manager. */
export function remarkPackageInstall() {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      const el = node as unknown as JsxElement
      if (!parent || index === undefined || el.type !== 'mdxJsxFlowElement' || el.name !== 'PackageInstall') return
      const attrs = literalAttributes(el)
      if (!attrs) return
      const fences: Code[] = packageCommands(packageOptions(attrs)).map(({ manager, command }) => ({
        type: 'code',
        lang: 'sh',
        meta: `title="${manager}"`,
        value: command,
      }))
      ;(parent.children as RootContent[])[index] = jsx('CodeGroup', { storageKey: PACKAGE_MANAGER_KEY }, fences, el.position)
      return SKIP
    })
  }
}

/** ` ```mermaid ` fences → `<Mermaid chart="…" />`, drawn in the browser. */
export function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      if (!parent || index === undefined || node.lang !== 'mermaid') return
      ;(parent.children as RootContent[])[index] = jsx('Mermaid', { chart: node.value }, [], node.position)
      return SKIP
    })
  }
}

/** Strips the indentation every non-empty line shares. */
function dedent(text: string): string {
  const lines = text.replace(/^\n+|\s+$/g, '').split('\n')
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)![0].length))
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join('\n')
}

function setAttribute(el: JsxElement, name: string, value: string) {
  el.attributes = [...el.attributes.filter((a) => a.name !== name), { type: 'mdxJsxAttribute', name, value }]
}

/**
 * `<Prompt>` gets its children's source as `text`, the words that are copied;
 * `<Diff>` takes the diff from a fence inside it.
 */
export function remarkComponentSource() {
  return (tree: Root, file: { value?: unknown }) => {
    const source = typeof file?.value === 'string' ? file.value : ''
    visit(tree, (node) => {
      const el = node as unknown as JsxElement
      if (el.type !== 'mdxJsxFlowElement' && el.type !== 'mdxJsxTextElement') return
      if (el.name === 'Prompt' && !el.attributes.some((a) => a.name === 'text') && el.children.length && source) {
        const start = el.children[0].position?.start.offset
        const end = el.children.at(-1)!.position?.end.offset
        if (start !== undefined && end !== undefined) setAttribute(el, 'text', dedent(source.slice(start, end)))
      }
      if (el.name === 'Diff' && !el.attributes.some((a) => a.name === 'diff' || a.name === 'before' || a.name === 'after')) {
        const code = el.children.find((c): c is Code => c.type === 'code')
        if (code) {
          setAttribute(el, 'diff', code.value)
          if (code.lang && code.lang !== 'diff' && !el.attributes.some((a) => a.name === 'language')) setAttribute(el, 'language', code.lang)
          el.children = []
        }
      }
    })
  }
}
