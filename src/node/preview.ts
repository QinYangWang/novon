import { existsSync, statSync } from 'node:fs'
import { join, normalize } from 'node:path'
import type { ResolvedConfig } from '../types.ts'
import { readRedirectRules } from './redirects.ts'

/** Serves dist/ the way a static host would, `_redirects` rules included. */
export async function preview(config: ResolvedConfig, port = 4173) {
  const dist = join(config.root, 'dist')
  if (!existsSync(dist)) throw new Error('Nothing to preview. Run `novon build` first.')
  const prefix = config.base.replace(/\/$/, '')
  const rules = await readRedirectRules(dist)
  return Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url)
      let path = decodeURIComponent(url.pathname)
      const rule = rules.get(path.replace(/\/+$/, '') || '/')
      if (rule) return new Response(null, { status: rule.status, headers: { location: rule.to + url.search + url.hash } })
      if (prefix) {
        // Like the real host: the site lives under its base path and nowhere else.
        if (path === '/') return Response.redirect(`${prefix}/`, 302)
        if (path !== prefix && !path.startsWith(`${prefix}/`)) {
          return new Response(`Not found. The site is served under ${prefix}/`, { status: 404 })
        }
        path = path.slice(prefix.length) || '/'
      }
      const file = normalize(join(dist, path))
      if (!file.startsWith(dist)) return new Response('Forbidden', { status: 403 })
      const bare = file.replace(/\/+$/, '')
      const candidates = [file, join(file, 'index.html'), `${bare}.html`]
      const hit = candidates.find((c) => existsSync(c) && statSync(c).isFile())
      if (hit) return new Response(Bun.file(hit))
      return new Response(Bun.file(join(dist, '404.html')), { status: 404, headers: { 'content-type': 'text/html' } })
    },
  })
}
