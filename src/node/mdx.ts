import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeShiki from '@shikijs/rehype'
import type { ShikiTransformer } from 'shiki'
import type { ResolvedConfig } from '../types.ts'

/** Reads `title="…"` from a fence's meta string. */
function parseMeta(meta: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of meta.matchAll(/(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g)) out[m[1]] = m[2] ?? m[3] ?? m[4]
  return out
}

/** Puts the language and the fence title on <pre> so the code block can show them. */
const fenceAttributes: ShikiTransformer = {
  name: 'novon:fence-attributes',
  pre(node) {
    const raw = (this.options.meta as { __raw?: string } | undefined)?.__raw ?? ''
    const meta = parseMeta(raw)
    node.properties['data-language'] = this.options.lang
    if (meta.title) node.properties['data-title'] = meta.title
  },
}

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
        transformers: [fenceAttributes],
      },
    ])
  }
  return {
    providerImportSource: '@mdx-js/react',
    remarkPlugins: [remarkFrontmatter, [remarkMdxFrontmatter, { name: 'frontmatter' }], remarkGfm, ...(config.mdx?.remarkPlugins ?? [])],
    rehypePlugins: [...rehypePlugins, ...(config.mdx?.rehypePlugins ?? [])],
  }
}
