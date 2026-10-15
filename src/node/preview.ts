import { existsSync, statSync } from 'node:fs'
import { join, normalize } from 'node:path'
import type { ResolvedConfig } from '../types.ts'

/** Serves dist/ the way a static host would. */
export function preview(config: ResolvedConfig, port = 4173) {
  const dist = join(config.root, 'dist')
  if (!existsSync(dist)) throw new Error('Nothing to preview. Run `novon build` first.')
  const prefix = config.base.replace(/\/$/, '')
  return Bun.serve({
    port,
    fetch(req) {
      let path = decodeURIComponent(new URL(req.url).pathname)
      if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length) || '/'
      const file = normalize(join(dist, path))
      if (!file.startsWith(dist)) return new Response('Forbidden', { status: 403 })
      const candidates = [file, join(file, 'index.html'), `${file}.html`]
      const hit = candidates.find((c) => existsSync(c) && statSync(c).isFile())
      if (hit) return new Response(Bun.file(hit))
      return new Response(Bun.file(join(dist, '404.html')), { status: 404, headers: { 'content-type': 'text/html' } })
    },
  })
}
