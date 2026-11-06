/** The site banner from config `banner`, with its text as HTML. */
import { withBase } from '../shared.ts'
import type { ResolvedConfig, SiteData } from '../types.ts'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Inline Markdown for one line of UI text: `**bold**`, `*em*`, `` `code` `` and `[links](/x)`. */
export function inlineMarkdown(text: string, base = '/'): string {
  const codes: string[] = []
  let html = escapeHtml(text).replace(/`([^`]+)`/g, (_m, c: string) => `\u0000${codes.push(c) - 1}\u0000`)
  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
      const external = /^[a-z][a-z0-9+.-]*:/i.test(href)
      return `<a href="${external ? href : withBase(base, href)}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${label}</a>`
    })
  return html.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => `<code>${codes[Number(i)]}</code>`)
}

/** The banner as the runtime shows it, or undefined. */
export function bannerData(config: ResolvedConfig): SiteData['banner'] {
  const b = typeof config.banner === 'string' ? { text: config.banner } : config.banner
  if (!b || !b.text) return undefined
  const id = b.id ?? Bun.hash(b.text).toString(36)
  return { html: inlineMarkdown(b.text, config.base), ...(b.href ? { href: b.href } : {}), dismissible: b.dismissible !== false, id }
}

