/**
 * Plain Markdown from a page's MDX, for `<route>.md`, llms-full.txt and
 * "Copy page". Built-in components become the Markdown a reader expects:
 * callouts are blockquotes, tabs are headed sections, steps a numbered list,
 * cards a link list and code groups titled fences. Imports, exports and
 * expressions are dropped; unknown components keep their children.
 */
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkDirective from 'remark-directive'
import remarkStringify from 'remark-stringify'
import { toString } from 'mdast-util-to-string'
import type { Code, Heading, List, ListItem, Paragraph, PhrasingContent, Root, RootContent } from 'mdast'
import { remarkCallouts, remarkPackageInstall } from './remark.ts'
import { postsOf } from '../shared.ts'
import type { PageMeta } from '../types.ts'

export interface MarkdownContext {
  /** The page being written, for components that list its layer's posts. */
  page?: PageMeta
  pages?: PageMeta[]
  /** A route's Markdown URL, for links to other pages. Default `<route>.md`. */
  link?: (route: string) => string
  /** `.md` sources have no JSX. Default true. */
  mdx?: boolean
}

type Node = RootContent & { children?: Node[] }
type Attribute = { type: string; name: string; value: string | null | { type: string; value: string } }
type Jsx = { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement'; name: string | null; attributes: Attribute[]; children: Node[] }

const CALLOUTS: Record<string, string> = { Callout: 'note', Note: 'note', Tip: 'tip', Info: 'info', Warning: 'warning', Caution: 'caution', Danger: 'danger' }
const PHRASING = new Set(['text', 'emphasis', 'strong', 'delete', 'inlineCode', 'break', 'link', 'linkReference', 'image', 'imageReference', 'footnoteReference', 'html'])

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const text = (value: string): PhrasingContent => ({ type: 'text', value })
const strong = (value: string): PhrasingContent => ({ type: 'strong', children: [text(value)] })
const paragraph = (children: PhrasingContent[]): Paragraph => ({ type: 'paragraph', children })

/** A literal attribute value: strings, `{'x'}`, `{2}`, `{true}`; bare attributes are `true`. */
function attr(el: Jsx, name: string): string | true | undefined {
  const a = el.attributes.find((x) => x.type === 'mdxJsxAttribute' && x.name === name)
  if (!a) return undefined
  if (a.value === null) return true
  if (typeof a.value === 'string') return a.value
  const v = a.value.value.trim()
  if (/^(['"`])[\s\S]*\1$/.test(v)) return v.slice(1, -1)
  if (/^-?\d+(\.\d+)?$/.test(v) || v === 'true' || v === 'false') return v
  return undefined
}
const str = (el: Jsx, name: string) => {
  const v = attr(el, name)
  return typeof v === 'string' ? v : undefined
}

/** Strips `// [!code …]` notation comments from code. */
export function stripNotations(code: string): string {
  return code
    .split('\n')
    .map((line) => line.replace(/\s*(?:\/\/|#|--|;|<!--|\/\*|\{\/\*)\s*\[!code [^\]]+\]\s*(?:-->|\*\/\}?|\*\/)?\s*$/, ''))
    .join('\n')
}

/** Wraps runs of inline nodes in paragraphs so a block position stays valid Markdown. */
function blocks(nodes: Node[]): Node[] {
  const out: Node[] = []
  let run: PhrasingContent[] = []
  const flush = () => {
    if (run.some((n) => n.type !== 'text' || n.value.trim())) out.push(paragraph(run) as Node)
    run = []
  }
  for (const n of nodes) {
    if (PHRASING.has(n.type)) run.push(n as PhrasingContent)
    else {
      flush()
      out.push(n)
    }
  }
  flush()
  return out
}

const isJsx = (n: Node) => n.type === 'mdxJsxFlowElement' || n.type === 'mdxJsxTextElement'

/** Child elements, looking through the paragraphs MDX wraps one-line elements in. */
function elements(nodes: Node[]): Node[] {
  return nodes.flatMap((n) => {
    if (n.type === 'paragraph' && n.children?.some(isJsx) && n.children.every((c) => isJsx(c) || (c.type === 'text' && !(c as { value: string }).value.trim()))) {
      return n.children.filter(isJsx)
    }
    return [n]
  })
}

class Converter {
  depth = 1
  constructor(private ctx: MarkdownContext) {}

  children(nodes: Node[] | undefined, block: boolean): Node[] {
    const out = (nodes ?? []).flatMap((n) => this.node(n, block))
    return block ? blocks(out) : out
  }

  node(n: Node, block: boolean): Node[] {
    switch (n.type as string) {
      case 'mdxjsEsm':
      case 'mdxFlowExpression':
      case 'yaml':
      case 'toml':
        return []
      case 'mdxTextExpression': {
        const v = String((n as { value?: string }).value ?? '').trim()
        return /^(['"`])[\s\S]*\1$/.test(v) ? [text(v.slice(1, -1)) as Node] : []
      }
      case 'heading':
        this.depth = (n as Heading).depth
        return [{ ...n, children: this.children(n.children, false) } as Node]
      case 'code':
        return [{ ...n, value: stripNotations((n as Code).value) } as Node]
      case 'mdxJsxFlowElement':
      case 'mdxJsxTextElement':
        return this.jsx(n as unknown as Jsx, block || n.type === 'mdxJsxFlowElement')
    }
    if (n.type === 'paragraph') {
      // Inline components that become blocks (a callout, a card) split the paragraph around them.
      const kids = this.children(n.children, false)
      return kids.every((k) => PHRASING.has(k.type)) ? [{ ...n, children: kids } as Node] : blocks(kids)
    }
    if (n.children) return [{ ...n, children: this.convertKids(n) } as Node]
    return [n]
  }

  /** Children of a Markdown node, in the same position they had. */
  private convertKids(n: Node): Node[] {
    const flowParents = new Set(['root', 'blockquote', 'listItem', 'footnoteDefinition'])
    return this.children(n.children, flowParents.has(n.type))
  }

  jsx(el: Jsx, block: boolean): Node[] {
    const name = el.name ?? ''
    const kids = () => this.children(el.children, block)

    if (name in CALLOUTS) {
      const type = str(el, 'type') ?? CALLOUTS[name]
      const title = str(el, 'title')
      const label = `${capitalize(type)}${title ? `: ${title}` : ''}`
      return [{ type: 'blockquote', children: [paragraph([strong(label)]), ...this.children(el.children, true)] } as Node]
    }
    switch (name) {
      case 'Tabs': {
        const depth = Math.min(this.depth + 1, 6) as Heading['depth']
        return elements(el.children).flatMap((c) => {
              const tab = c as unknown as Jsx
              if ((tab.type === 'mdxJsxFlowElement' || tab.type === 'mdxJsxTextElement') && tab.name === 'Tab') {
                const title = str(tab, 'title') ?? 'Tab'
                const saved = this.depth
                this.depth = depth
                const body = this.children(tab.children, true)
                this.depth = saved
                return [{ type: 'heading', depth, children: [text(title)] } as Node, ...body]
              }
              return this.node(c, true)
            })
      }
      case 'Tab':
        return kids()
      case 'Steps': {
        const items: ListItem[] = elements(el.children).flatMap((c) => {
          const step = c as unknown as Jsx
          if (!isJsx(c) || step.name !== 'Step') return []
          const title = str(step, 'title')
          const body = this.children(step.children, true) as ListItem['children']
          return [{ type: 'listItem', spread: true, children: [...(title ? [paragraph([strong(title)])] : []), ...body] } as ListItem]
        })
        return items.length ? [{ type: 'list', ordered: true, start: 1, spread: true, children: items } as Node] : []
      }
      case 'Step':
        return kids()
      case 'CardGroup':
      case 'Columns':
      case 'AccordionGroup': {
        const children = elements(el.children)
        const cards = children.filter((c) => isJsx(c) && (c as unknown as Jsx).name === 'Card')
        if (cards.length && cards.length === children.length) {
          return [{ type: 'list', ordered: false, spread: false, children: cards.map((c) => this.cardItem(c as unknown as Jsx)) } as Node]
        }
        return kids()
      }
      case 'Card':
      case 'LinkCard':
        return [{ type: 'list', ordered: false, spread: false, children: [this.cardItem(el)] } as Node]
      case 'Accordion': {
        const title = str(el, 'title')
        return [...(title ? [paragraph([strong(title)]) as Node] : []), ...this.children(el.children, true)]
      }
      case 'CodeGroup':
        return this.children(el.children, true)
      case 'Frame': {
        const caption = str(el, 'caption')
        return [...kids(), ...(caption ? [paragraph([{ type: 'emphasis', children: [text(caption)] }]) as Node] : [])]
      }
      case 'YouTube': {
        const id = str(el, 'id')
        if (!id) return []
        const link = { type: 'link', url: `https://www.youtube.com/watch?v=${id}`, children: [text(str(el, 'title') ?? 'Video')] } as PhrasingContent
        return block ? [paragraph([link]) as Node] : [link as Node]
      }
      case 'FileTree':
        return [this.fileList(elements(el.children)) as Node]
      case 'Folder':
      case 'File':
        return [this.fileList([el as unknown as Node]) as Node]
      case 'PostList':
        return this.postList(el)
      case 'Term': {
        const tip = str(el, 'tip')
        return [...this.children(el.children, false), ...(tip ? [text(` (${tip})`) as Node] : [])]
      }
      case 'TagList':
      case 'Icon':
      case 'PackageInstall':
        return []
      case 'br':
        return block ? [] : [{ type: 'break' } as Node]
      case 'a': {
        const href = str(el, 'href')
        const children = this.children(el.children, false) as PhrasingContent[]
        if (!href) return children as Node[]
        const link = { type: 'link', url: href, children } as PhrasingContent
        return block ? [paragraph([link]) as Node] : [link as Node]
      }
      case 'img': {
        const src = str(el, 'src')
        if (!src) return []
        const image = { type: 'image', url: src, alt: str(el, 'alt') ?? '' } as PhrasingContent
        return block ? [paragraph([image]) as Node] : [image as Node]
      }
      case 'code':
        return [{ type: 'inlineCode', value: toString(el as never) } as Node]
      case 'strong':
      case 'b':
        return [{ type: 'strong', children: this.children(el.children, false) } as Node]
      case 'em':
      case 'i':
        return [{ type: 'emphasis', children: this.children(el.children, false) } as Node]
    }
    return kids()
  }

  private cardItem(card: Jsx): ListItem {
    const title = str(card, 'title') ?? ''
    const href = str(card, 'href')
    const label: PhrasingContent = href ? { type: 'link', url: href, children: [text(title)] } : text(title)
    const description = toString({ type: 'root', children: this.children(card.children, true) } as Root).replace(/\s+/g, ' ').trim()
    return { type: 'listItem', spread: false, children: [paragraph(description ? [label, text(`: ${description}`)] : [label])] }
  }

  private fileList(nodes: Node[]): List {
    const items: ListItem[] = []
    for (const n of nodes) {
      const el = n as unknown as Jsx
      if (el.name !== 'Folder' && el.name !== 'File') continue
      const name = str(el, 'name') ?? ''
      const folder = el.name === 'Folder'
      const sub = folder ? this.fileList(elements(el.children)) : null
      items.push({
        type: 'listItem',
        spread: false,
        children: [paragraph([{ type: 'inlineCode', value: folder ? `${name}/` : name }]), ...(sub && sub.children.length ? [sub] : [])],
      })
    }
    return { type: 'list', ordered: false, spread: false, children: items }
  }

  private postList(el: Jsx): Node[] {
    const { pages, page } = this.ctx
    if (!pages) return []
    const layer = str(el, 'layer') ?? page?.layer ?? '/'
    let posts = postsOf(pages, layer)
    const tag = str(el, 'tag')
    if (tag) posts = posts.filter((p) => p.tags.includes(tag))
    const skip = Number(str(el, 'skip') ?? 0)
    const limit = str(el, 'limit')
    posts = posts.slice(skip, limit ? skip + Number(limit) : undefined)
    if (!posts.length) return []
    const link = this.ctx.link ?? ((r: string) => `${r === '/' ? '/index' : r}.md`)
    const items: ListItem[] = posts.map((p) => ({
      type: 'listItem',
      spread: false,
      children: [paragraph([{ type: 'link', url: link(p.route), children: [text(p.title)] }, ...(p.date ? [text(` (${p.date})`)] : []), ...(p.description ? [text(`: ${p.description}`)] : [])])],
    }))
    return [{ type: 'list', ordered: false, spread: false, children: items } as Node]
  }
}

function remarkPlainMarkdown(ctx: MarkdownContext) {
  return (tree: Root) => {
    const converter = new Converter(ctx)
    tree.children = converter.children(tree.children as Node[], true) as Root['children']
  }
}

/** Plain Markdown for an MDX (or Markdown) body. */
export function mdxToMarkdown(source: string, ctx: MarkdownContext = {}): string {
  const parser = unified().use(remarkParse)
  if (ctx.mdx !== false) parser.use(remarkMdx)
  parser.use(remarkFrontmatter).use(remarkGfm).use(remarkDirective).use(remarkCallouts).use(remarkPackageInstall).use(remarkPlainMarkdown, ctx)
  const tree = parser.runSync(parser.parse(source), source) as Root
  // A separate writer: the directive syntax is gone by now and would only escape every colon.
  const writer = unified()
    .use(remarkStringify, { bullet: '-', fences: true, rule: '-', listItemIndent: 'one', emphasis: '_', resourceLink: true })
    .use(remarkGfm)
  return writer.stringify(tree).trim()
}
