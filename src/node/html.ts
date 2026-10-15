import type { PageMeta, ResolvedConfig } from '../types.ts'
import { withBase } from '../shared.ts'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

import { getThemeScript } from '@/ui/theme-toggle'

/** Runs before first paint: light, dark or the system's choice, and follows the system while it is the choice. */
const themeScript = getThemeScript()

export interface DocumentParts {
  config: ResolvedConfig
  page: PageMeta | null
  title: string
  body: string
  head?: string
  scripts: string
}

export function renderDocument({ config, page, title, body, head = '', scripts }: DocumentParts): string {
  const description = page?.description ?? config.description ?? ''
  const canonical = config.url && page ? new URL(withBase(config.base, page.route), config.url).href : ''
  const favicon = config.theme.favicon ? withBase(config.base, config.theme.favicon) : ''
  const style = config.theme.radius ? ` style="--radius:${esc(config.theme.radius)}"` : ''
  const meta = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(title)}</title>`,
    description && `<meta name="description" content="${esc(description)}">`,
    `<meta property="og:title" content="${esc(page?.title ?? config.title)}">`,
    description && `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:type" content="${page?.layout === 'blog' && page.date ? 'article' : 'website'}">`,
    canonical && `<link rel="canonical" href="${canonical}">`,
    canonical && `<meta property="og:url" content="${canonical}">`,
    favicon && `<link rel="icon" href="${favicon}">`,
    (config.plugins ?? []).includes('rss') && (config.layout === 'blog' || config.layers.some((l) => l.layout === 'blog')) && `<link rel="alternate" type="application/rss+xml" title="${esc(config.title)}" href="${withBase(config.base, '/rss.xml')}">`,
    `<script>${themeScript}</script>`,
  ].filter(Boolean)
  return `<!doctype html>
<html lang="${esc(config.lang)}" data-accent="${config.theme.accent}"${style}>
<head>
${meta.join('\n')}
${head}
</head>
<body>
<div id="novon">${body}</div>
${scripts}
</body>
</html>
`
}
