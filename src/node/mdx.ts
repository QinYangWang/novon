import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeShiki from '@shikijs/rehype'
import remarkDirective from 'remark-directive'
import {
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from '@shikijs/transformers'
import type { ShikiTransformer } from 'shiki'
import type { ResolvedConfig } from '../types.ts'
import { remarkCallouts, remarkPackageInstall } from './remark.ts'

/** Reads `title="…"` and bare flags like `lineNumbers` from a fence's meta string. */
export function parseMeta(meta: string): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  const rest = meta.replace(/(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g, (_m, k: string, a?: string, b?: string, c?: string) => {
    out[k] = a ?? b ?? c ?? ''
    return ' '
  })
  // Flags outside `{1,3}` line ranges and `/word/` patterns.
  for (const m of rest.replace(/\{[^}]*\}|\/(?:\\.|[^/])+\//g, ' ').matchAll(/(?:^|\s)([A-Za-z][\w-]*)(?=\s|$)/g)) out[m[1]] = true
  return out
}

const on = (v: string | true | undefined) => v === true || v === 'true'

/** Puts the language, the fence title and the line-number and wrap switches on <pre> for the code block. */
function fenceAttributes(lineNumbers: boolean): ShikiTransformer {
  return {
    name: 'novon:fence-attributes',
    pre(node) {
      const raw = (this.options.meta as { __raw?: string } | undefined)?.__raw ?? ''
      const meta = parseMeta(raw)
      node.properties['data-language'] = this.options.lang
      if (typeof meta.title === 'string' && meta.title) node.properties['data-title'] = meta.title
      const numbers = meta.lineNumbers ?? meta.showLineNumbers
      if (numbers === undefined ? lineNumbers : on(numbers)) node.properties['data-line-numbers'] = ''
      if (on(meta.wrap)) node.properties['data-wrap'] = ''
    },
  }
}

/** The code notations: `{1,3-5}` and `/word/` in the fence meta, `[!code ++|--|focus|highlight|word:x]` comments in the code. */
export function codeTransformers(lineNumbers = false): ShikiTransformer[] {
  return [
    transformerMetaHighlight(),
    transformerMetaWordHighlight(),
    transformerNotationDiff(),
    transformerNotationHighlight(),
    transformerNotationFocus(),
    transformerNotationWordHighlight(),
    fenceAttributes(lineNumbers),
  ]
}

/** novon's own Markdown syntax, before any site plugin. */
export const novonRemarkPlugins = [remarkDirective, remarkCallouts, remarkPackageInstall]

export function mdxOptions(config: ResolvedConfig) {
  const highlight = config.mdx?.highlight
  const rehypePlugins: any[] = [rehypeSlug]
  if (highlight !== false) {
    rehypePlugins.push([
      rehypeShiki,
      {
        themes: { light: highlight?.light ?? 'github-light', dark: highlight?.dark ?? 'github-dark' },
        defaultColor: false,
        lazy: true,
        fallbackLanguage: 'text',
        addLanguageClass: true,
        transformers: codeTransformers(config.mdx?.lineNumbers ?? false),
      },
    ])
  }
  return {
    providerImportSource: '@mdx-js/react',
    remarkPlugins: [remarkFrontmatter, [remarkMdxFrontmatter, { name: 'frontmatter' }], remarkGfm, ...novonRemarkPlugins, ...(config.mdx?.remarkPlugins ?? [])],
    rehypePlugins: [...rehypePlugins, ...(config.mdx?.rehypePlugins ?? [])],
  }
}
