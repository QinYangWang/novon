import { createServer, mergeConfig, type ViteDevServer } from 'vite'
import { scanContent, scanSite } from './content.ts'
import { renderDocument } from './html.ts'
import { ogFile, ogRenderer, pageImage } from './og.ts'
import { activePlugins, builtinPlugins, markdownCache, pageMarkdown, searchIndex } from './plugins.ts'
import { collectRedirects, redirectTarget } from './redirects.ts'
import { entryClient, viteConfig } from './vite.ts'
import { stripBase } from '../shared.ts'
import type { ResolvedConfig } from '../types.ts'

export async function dev(config: ResolvedConfig, port = 4321, host?: string): Promise<ViteDevServer> {
  const base = await viteConfig(config, 'development')
  const server = await createServer(
    mergeConfig(base, {
      server: { port, host, strictPort: false },
      plugins: [
        {
          name: 'novon:dev-pages',
          configureServer(s: ViteDevServer) {
            return () => {
              s.middlewares.use(async (req, res, next) => {
                if (req.method !== 'GET' || !req.url) return next()
                const url = new URL(req.url, 'http://localhost')
                const route = stripBase(config.base, url.pathname)
                if (route === null) return next()
                try {
                  if (route === '/search.json') {
                    res.setHeader('content-type', 'application/json')
                    return res.end(JSON.stringify(await searchIndex(config, await scanContent(config))))
                  }
                  // Files from plugins' `routes`: JSON API, skills, discovery files.
                  if (/\.(json|gz)$/.test(route) || route === '/skill.md' || route.startsWith('/.well-known/')) {
                    const { pages, folders } = await scanSite(config)
                    const markdown = markdownCache(config, pages)
                    for (const plugin of activePlugins(config)) {
                      const files = (await plugin.routes?.({ config, pages, folders, markdown })) ?? {}
                      const data = files[route.slice(1)]
                      if (data === undefined) continue
                      const type = route.endsWith('.json') ? 'application/json' : route.endsWith('.md') ? 'text/markdown; charset=utf-8' : route.endsWith('.gz') ? 'application/gzip' : 'application/json'
                      res.setHeader('content-type', type)
                      return res.end(data)
                    }
                  }
                  if (route === '/llms.txt' || route === '/llms-full.txt') {
                    const files = new Map<string, string>()
                    await builtinPlugins.llms.buildEnd!({ outDir: '', config, pages: await scanContent(config), emit: async (p, d) => void files.set(p, String(d)) })
                    res.setHeader('content-type', 'text/plain; charset=utf-8')
                    return res.end(files.get(route.slice(1)))
                  }
                  if (route.endsWith('.md')) {
                    const target = route === '/index.md' ? '/' : route.slice(0, -3)
                    const pages = await scanContent(config)
                    const page = pages.find((p) => p.route === target && p.file)
                    if (!page) return next()
                    res.setHeader('content-type', 'text/markdown; charset=utf-8')
                    return res.end(await pageMarkdown(config, page, pages))
                  }
                  if (route.startsWith('/og/') && route.endsWith('.png')) {
                    const page = (await scanContent(config)).find((p) => `/${ogFile(p.route)}` === route && pageImage(config, p)?.generated)
                    if (!page) return next()
                    res.setHeader('content-type', 'image/png')
                    return res.end(await (await ogRenderer(config)).render(page))
                  }
                  if (/\.[a-z0-9]+$/i.test(route)) return next()
                  const pages = await scanContent(config)
                  const page = pages.find((p) => p.route === route) ?? null
                  const redirect = page ? undefined : collectRedirects(config, pages)[route]
                  if (redirect) {
                    res.statusCode = 301
                    res.setHeader('location', redirectTarget(config, redirect) + url.search)
                    return res.end()
                  }
                  const title = page ? (page.route === '/' ? config.title : `${page.title} · ${config.title}`) : `Not found · ${config.title}`
                  const scripts = `<script type="module" src="${config.base}@fs${entryClient}"></script>`
                  const html = await s.transformIndexHtml(
                    req.url,
                    renderDocument({ config, page, title, body: '', scripts, image: pageImage(config, page), pages, extraHead: activePlugins(config).flatMap((p) => p.head?.(page, { config, pages }) ?? []) }),
                  )
                  res.statusCode = page ? 200 : 404
                  res.setHeader('content-type', 'text/html; charset=utf-8')
                  res.end(html)
                } catch (error) {
                  next(error)
                }
              })
            }
          },
        },
      ],
    }),
  )
  await server.listen()
  return server
}
