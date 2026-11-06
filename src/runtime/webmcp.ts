/**
 * WebMCP: tools an agent in the reader's browser can call, registered on the
 * page's model context when the browser has one. They read the site's own
 * static files (search.json and the `.md` pages) and never leave the site.
 */
import { normalizeRoute, stripBase, withBase } from '../shared.ts'
import type { SiteData } from '../types.ts'
import { loadSearchIndex, search } from './search.ts'

interface Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean }
  execute: (input: Record<string, unknown>) => Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }>
}

type ModelContext = {
  provideContext?: (context: { tools: Tool[] }) => void
  registerTool?: (tool: Tool) => void
}

const text = (value: unknown, isError = false) => ({ content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }], ...(isError ? { isError } : {}) })

/** The model context the browser offers, if any. */
export function modelContext(): ModelContext | null {
  const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { modelContext?: ModelContext }).modelContext : undefined
  const doc = typeof document !== 'undefined' ? (document as unknown as { modelContext?: ModelContext }).modelContext : undefined
  return nav ?? doc ?? null
}

/** The tools for a site: search, one page as Markdown, and the page list. */
export function siteTools(site: SiteData): Tool[] {
  const abs = (path: string) => new URL(withBase(site.base, path), location.origin).href
  const tools: Tool[] = []
  if (site.search) {
    tools.push({
      name: 'search_documentation',
      description: `Search ${site.title}. Returns matching pages and sections with a URL that opens at the heading and a short excerpt.`,
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Words to look for', maxLength: 500 },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
        },
        required: ['query'],
      },
      annotations: { readOnlyHint: true },
      async execute(input) {
        const query = typeof input.query === 'string' ? input.query.trim() : ''
        const limit = Math.min(20, Math.max(1, Number(input.limit ?? 5) || 5))
        if (!query || query.length > 500) return text({ error: 'invalid_input', message: 'query must be 1 to 500 characters' }, true)
        const entries = await loadSearchIndex(site.base)
        if (!entries.length) return text({ error: 'index_unavailable', message: 'search.json could not be loaded' }, true)
        return text(
          search(entries, query, limit).map((r) => ({
            title: r.entry.title,
            ...(r.entry.heading ? { heading: r.entry.heading } : {}),
            url: abs(r.href),
            markdown: abs(`${r.entry.route === '/' ? '/index' : r.entry.route}.md`),
            excerpt: r.excerpt.slice(0, 1000),
          })),
        )
      },
    })
  }
  tools.push({
    name: 'get_page',
    description: `Read one page of ${site.title} as Markdown, by its route (e.g. "/guide") or URL.`,
    inputSchema: { type: 'object', properties: { route: { type: 'string', description: 'Route or URL of the page' } }, required: ['route'] },
    annotations: { readOnlyHint: true },
    async execute(input) {
      const raw = typeof input.route === 'string' ? input.route : ''
      let path: string
      try {
        const url = new URL(raw, location.href)
        if (url.origin !== location.origin) return text({ error: 'invalid_input', message: 'only pages of this site' }, true)
        path = url.pathname
      } catch {
        return text({ error: 'invalid_input', message: 'route must be a path or URL' }, true)
      }
      // A bare route ("/guide") or a full URL under the base both work.
      const route = normalizeRoute((stripBase(site.base, path) ?? path).replace(/\.md$/, '').replace(/^\/index$/, '/'))
      const page = site.pages.find((p) => p.route === route && p.file)
      if (!page) return text({ error: 'not_found', message: `No page at ${route}` }, true)
      const res = await fetch(withBase(site.base, `${route === '/' ? '/index' : route}.md`))
      return res.ok ? text(await res.text()) : text({ error: 'not_found', message: `No Markdown for ${route}` }, true)
    },
  })
  tools.push({
    name: 'list_pages',
    description: `List the pages of ${site.title} with their titles, descriptions and URLs.`,
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    async execute() {
      return text(
        site.pages
          .filter((p) => p.kind === 'page' && p.file && !p.hidden)
          .map((p) => ({ route: p.route, title: p.title, ...(p.description ? { description: p.description } : {}), url: abs(p.route) })),
      )
    },
  })
  return tools
}

/** Registers the tools; does nothing in browsers without WebMCP. */
export function registerTools(site: SiteData): boolean {
  const mc = modelContext()
  if (!mc) return false
  const tools = siteTools(site)
  if (mc.provideContext) mc.provideContext({ tools })
  else if (mc.registerTool) for (const t of tools) mc.registerTool(t)
  else return false
  return true
}
