import { createServer, mergeConfig, type ViteDevServer } from 'vite'
import { scanContent } from './content.ts'
import { renderDocument } from './html.ts'
import { ogFile, ogRenderer, pageImage } from './og.ts'
import { pageMarkdown, searchIndex } from './plugins.ts'
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
                    return res.end(JSON.stringify(searchIndex(await scanContent(config))))
                  }
                  if (route.endsWith('.md')) {
                    const target = route === '/index.md' ? '/' : route.slice(0, -3)
                    const page = (await scanContent(config)).find((p) => p.route === target && p.file)
                    if (!page) return next()
                    res.setHeader('content-type', 'text/markdown; charset=utf-8')
                    return res.end(await pageMarkdown(config, page))
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
                  const title = page ? (page.route === '/' ? config.title : `${page.title} · ${config.title}`) : `Not found · ${config.title}`
                  const scripts = `<script type="module" src="${config.base}@fs${entryClient}"></script>`
                  const html = await s.transformIndexHtml(
                    req.url,
                    renderDocument({ config, page, title, body: '', scripts, image: pageImage(config, page) }),
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
