import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build as viteBuild, mergeConfig, type Manifest } from 'vite'
import { scanContent } from './content.ts'
import { renderDocument } from './html.ts'
import { generateOgImages, pageImage } from './og.ts'
import { activePlugins } from './plugins.ts'
import { entryClient, entryServer, viteConfig } from './vite.ts'
import type { PageMeta, ResolvedConfig } from '../types.ts'
import { withBase } from '../shared.ts'

export interface BuildResult {
  outDir: string
  pages: number
  ms: number
}

export function htmlPath(route: string, trailingSlash?: boolean): string {
  if (route === '/') return 'index.html'
  return trailingSlash === false ? `${route.slice(1)}.html` : `${route.slice(1)}/index.html`
}

/** Collects the CSS and preload links for the client entry from the manifest. */
function assetTags(manifest: Manifest, base: string): { head: string; scripts: string } {
  const key = Object.keys(manifest).find((k) => manifest[k].isEntry)
  if (!key) throw new Error('client build produced no entry')
  const entry = manifest[key]
  const css = new Set<string>()
  const preload = new Set<string>()
  const visit = (k: string) => {
    const chunk = manifest[k]
    if (!chunk) return
    chunk.css?.forEach((c) => css.add(c))
    for (const i of chunk.imports ?? []) {
      if (!preload.has(manifest[i]?.file)) {
        preload.add(manifest[i]?.file)
        visit(i)
      }
    }
  }
  visit(key)
  const href = (f: string) => withBase(base, `/${f}`)
  const head = [
    ...[...css].map((c) => `<link rel="stylesheet" href="${href(c)}">`),
    ...[...preload].filter(Boolean).map((f) => `<link rel="modulepreload" href="${href(f)}">`),
  ].join('\n')
  return { head, scripts: `<script type="module" src="${href(entry.file)}"></script>` }
}

export async function build(config: ResolvedConfig): Promise<BuildResult> {
  const started = performance.now()
  process.env.NODE_ENV = 'production'
  const outDir = join(config.root, 'dist')
  const serverDir = join(config.root, '.novon/server')
  await rm(outDir, { recursive: true, force: true })
  const base = await viteConfig(config, 'production')

  await viteBuild(
    mergeConfig(base, {
      build: {
        outDir,
        emptyOutDir: true,
        manifest: true,
        target: 'es2022',
        rollupOptions: { input: entryClient, checks: { pluginTimings: false } } as any,
        chunkSizeWarningLimit: 1500,
      },
    }),
  )
  await viteBuild(
    mergeConfig(base, {
      publicDir: false,
      ssr: { noExternal: true },
      build: { outDir: serverDir, emptyOutDir: true, ssr: entryServer, target: 'node20', rollupOptions: { output: { entryFileNames: 'entry-server.mjs' }, checks: { pluginTimings: false } } as any },
    }),
  )

  const manifest = JSON.parse(await readFile(join(outDir, '.vite/manifest.json'), 'utf8')) as Manifest
  const { head, scripts } = assetTags(manifest, config.base)
  const server = (await import(pathToFileURL(join(serverDir, 'entry-server.mjs')).href)) as {
    render: (url: string) => Promise<{ html: string; title: string; page: PageMeta | null }>
    renderContent: (url: string) => Promise<string>
  }

  const pages = await scanContent(config)
  const cards = await generateOgImages(config, pages, outDir)
  for (const page of pages) {
    const { html, title } = await server.render(withBase(config.base, page.route))
    const file = join(outDir, htmlPath(page.route, config.trailingSlash))
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, renderDocument({ config, page, title, body: html, head, scripts, image: imageOf(page) }))
  }
  function imageOf(page: PageMeta) {
    const image = pageImage(config, page)
    return image && (!image.generated || cards.has(page.route)) ? image : null
  }
  const missing = await server.render(withBase(config.base, '/__novon_not_found__'))
  await writeFile(join(outDir, '404.html'), renderDocument({ config, page: null, title: missing.title, body: missing.html, head, scripts }))

  const emit = async (path: string, data: string | Uint8Array) => {
    const file = join(outDir, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, data)
  }
  const renderContent = (page: PageMeta) => server.renderContent(withBase(config.base, page.route))
  for (const plugin of activePlugins(config)) await plugin.buildEnd?.({ outDir, config, pages, emit, renderContent })
  await writeFile(join(outDir, '.nojekyll'), '')
  await rm(join(outDir, '.vite'), { recursive: true, force: true })

  return { outDir: relative(process.cwd(), outDir) || '.', pages: pages.length, ms: Math.round(performance.now() - started) }
}
