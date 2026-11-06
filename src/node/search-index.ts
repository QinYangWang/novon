/**
 * search.json: one entry per page and one per heading section, with the full
 * plain text of each. Anchors are slugged the way rendered headings are, so a
 * result opens at its heading.
 */
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'
import GithubSlugger from 'github-slugger'
import matter from 'gray-matter'
import type { Root, RootContent } from 'mdast'
import { remarkCallouts, remarkPackageInstall } from './remark.ts'
import type { PageMeta } from '../types.ts'
import type { SearchEntry } from '../runtime/search.ts'

export type { SearchEntry }

/** Characters of text kept per section; longer sections are cut. */
const MAX_TEXT = 6000

const SKIP = new Set(['mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression', 'yaml', 'toml', 'html'])

/** Plain text of nodes: words of prose, code and component children; no expressions or imports. */
function plain(nodes: RootContent[]): string {
  const out: string[] = []
  const walk = (n: RootContent) => {
    if (SKIP.has(n.type)) return
    if ('value' in n && typeof n.value === 'string') out.push(n.value)
    if (n.type === 'image' && n.alt) out.push(n.alt)
    if ('children' in n) for (const c of n.children as RootContent[]) walk(c)
    if (n.type !== 'text' && n.type !== 'inlineCode' && n.type !== 'emphasis' && n.type !== 'strong' && n.type !== 'link' && n.type !== 'delete' && n.type !== 'inlineMath' && n.type !== 'mdxJsxTextElement') out.push(' ')
  }
  nodes.forEach(walk)
  return out.join('').replace(/\s+/g, ' ').trim()
}

const headingText = (n: RootContent) => plain([n]).replace(/\s+/g, ' ').trim()

/** Headings at depth 2 and 3 open a section; deeper ones stay in their parent's text. */
export function pageSections(source: string, mdx = true): { intro: string; sections: { heading: string; anchor: string; depth: number; text: string }[] } {
  const parser = unified().use(remarkParse)
  if (mdx) parser.use(remarkMdx)
  parser.use(remarkFrontmatter).use(remarkGfm).use(remarkMath).use(remarkDirective).use(remarkCallouts).use(remarkPackageInstall)
  let tree: Root
  try {
    tree = parser.runSync(parser.parse(source), source) as Root
  } catch {
    return { intro: '', sections: [] }
  }
  const slugger = new GithubSlugger()
  const sections: { heading: string; anchor: string; depth: number; nodes: RootContent[] }[] = []
  const intro: RootContent[] = []
  // Every heading takes a slug in document order, like the rendered page, even the ones that open no section.
  const visitHeadings = (n: RootContent, top: boolean) => {
    if (n.type === 'heading') {
      const text = headingText(n)
      const anchor = slugger.slug(text)
      if (top && n.depth >= 2 && n.depth <= 3) {
        sections.push({ heading: text, anchor, depth: n.depth, nodes: [] })
        return true
      }
    } else if ('children' in n) for (const c of n.children as RootContent[]) visitHeadings(c, false)
    return false
  }
  for (const n of tree.children) {
    if (visitHeadings(n, true)) continue
    ;(sections.at(-1)?.nodes ?? intro).push(n)
  }
  return {
    intro: plain(intro).slice(0, MAX_TEXT),
    sections: sections.map((s) => ({ heading: s.heading, anchor: s.anchor, depth: s.depth, text: plain(s.nodes).slice(0, MAX_TEXT) })),
  }
}

/** The search entries of one page from its transformed source. */
export function pageEntries(page: PageMeta, source: string, section?: string): SearchEntry[] {
  const { content } = matter(source)
  const { intro, sections } = pageSections(content, !page.file.endsWith('.md'))
  const shared = { route: page.route, title: page.title, ...(section ? { section } : {}), ...(page.icon ? { icon: page.icon } : {}) }
  return [
    { ...shared, ...(page.description ? { description: page.description } : {}), headings: sections.map((s) => s.heading), text: intro },
    ...sections.map((s) => ({ ...shared, heading: s.heading, anchor: s.anchor, text: s.text })),
  ]
}
