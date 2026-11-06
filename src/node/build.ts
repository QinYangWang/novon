import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build as viteBuild, mergeConfig, type Manifest } from 'vite'
import { scanSite } from './content.ts'
import { renderDocument } from './html.ts'
import { generateOgImages, pageImage } from './og.ts'
import { activePlugins, markdownCache } from './plugins.ts'
import { checkBudget, measureAssets, type AssetSizes } from './budget.ts'
import { check, formatIssues, summarize, type Issue } from './check.ts'
import { collectRedirects, redirectPage, redirectRules } from './redirects.ts'
import { entryClient, entryServer, viteConfig } from './vite.ts'
import type { PageMeta, ResolvedConfig } from '../types.ts'
import { withBase } from '../shared.ts'

export interface BuildResult {
  outDir: string
  pages: number
  ms: number
  /** What the checks found; printed as warnings unless `quiet`. */
  issues: Issue[]
  /** Gzipped size of the JavaScript and CSS every page loads first. */
  assets: AssetSizes
}

export interface BuildOptions {
  /** Fail when the checks find anything. Default false. */
  strict?: boolean
  /** Do not print check results. */
  quiet?: boolean
  /** Override config `budget`. */
  budget?: { js?: number | string; css?: number | string }
}

export function htmlPath(route: string, trailingSlash?: boolean): string {
  if (route === '/') return 'index.html'
  return trailingSlash === false ? `${route.slice(1)}.html` : `${route.slice(1)}/index.html`
}

/** Collects the CSS and preload links for the client entry from the manifest, and the files they name. */
function assetTags(manifest: Manifest, base: string): { head: string; scripts: string; files: { js: string[]; css: string[] } } {
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
  return {
    head,
    scripts: `<script type="module" src="${href(entry.file)}"></script>`,
    files: { js: [entry.file, ...[...preload].filter(Boolean)], css: [...css] },
  }
}

export async function build(config: ResolvedConfig, options: BuildOptions = {}): Promise<BuildResult> {
  const started = performance.now()
  process.env.NODE_ENV = 'production'
  const issues = await check(config)
  if (issues.length && !options.quiet) {
    const { errors, warnings } = summarize(issues)
    console.warn(`${formatIssues(issues)}\n${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'} (novon check)`)
  }
  if (options.strict && issues.length) throw new Error(`Build stopped: novon check found ${issues.length} issue${issues.length === 1 ? '' : 's'} (--strict).`)
  const outDir = join(config.root, 'dist')
  const serverDir = join(config.root, '.novon/server')
  const plugins = activePlugins(config)
  for (const plugin of plugins) await plugin.buildStart?.({ config })
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
  const { head, scripts, files: entryFiles } = assetTags(manifest, config.base)
  const assets = await measureAssets(outDir, entryFiles)
  const budget = { ...config.budget, ...options.budget }
  const over = checkBudget(assets, budget)
  if (over.length) throw new Error(`Build stopped: over budget. ${over.join('; ')}`)
  const server = (await import(pathToFileURL(join(serverDir, 'entry-server.mjs')).href)) as {
    render: (url: string) => Promise<{ html: string; title: string; page: PageMeta | null }>
    renderContent: (url: string) => Promise<string>
  }

  const { pages, folders } = await scanSite(config)
  const cards = await generateOgImages(config, pages, outDir)
  const pluginHead = (page: PageMeta | null) => plugins.flatMap((p) => p.head?.(page, { config, pages }) ?? [])
  for (const page of pages) {
    const { html, title } = await server.render(withBase(config.base, page.route))
    const file = join(outDir, htmlPath(page.route, config.trailingSlash))
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, renderDocument({ config, page, title, body: html, head, scripts, image: imageOf(page), pages, extraHead: pluginHead(page) }))
  }
  function imageOf(page: PageMeta) {
    const image = pageImage(config, page)
    return image && (!image.generated || cards.has(page.route)) ? image : null
  }
  const missing = await server.render(withBase(config.base, '/__novon_not_found__'))
  await writeFile(join(outDir, '404.html'), renderDocument({ config, page: null, title: missing.title, body: missing.html, head, scripts, extraHead: pluginHead(null) }))

  const emit = async (path: string, data: string | Uint8Array) => {
    const file = join(outDir, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, data)
  }
  const renderContent = (page: PageMeta) => server.renderContent(withBase(config.base, page.route))
  const markdown = markdownCache(config, pages)
  await writeRedirects(config, pages, outDir)
  // Plugin routes; a file the site ships in public/ wins.
  for (const plugin of plugins) {
    const files = (await plugin.routes?.({ config, pages, folders, markdown })) ?? {}
    for (const [path, data] of Object.entries(files)) if (!existsSync(join(outDir, path))) await emit(path.replace(/^\/+/, ''), data)
  }
  for (const plugin of plugins) await plugin.buildEnd?.({ outDir, config, pages, emit, renderContent, markdown })
  await writeFile(join(outDir, '.nojekyll'), '')
  await rm(join(outDir, '.vite'), { recursive: true, force: true })

  return { outDir: relative(process.cwd(), outDir) || '.', pages: pages.length, ms: Math.round(performance.now() - started), issues, assets }
}

/** `_redirects` (after any rules from `public/_redirects`) and a forwarding page at each old path that has no page. */
async function writeRedirects(config: ResolvedConfig, pages: PageMeta[], outDir: string) {
  const redirects = collectRedirects(config, pages)
  const entries = Object.entries(redirects).filter(([from]) => !pages.some((p) => p.route === from))
  if (!entries.length) return
  for (const [from, to] of entries) {
    const file = join(outDir, htmlPath(from, config.trailingSlash))
    if (existsSync(file)) continue
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, redirectPage(config, to))
  }
  const rulesFile = join(outDir, '_redirects')
  const existing = existsSync(rulesFile) ? `${(await readFile(rulesFile, 'utf8')).trimEnd()}\n` : ''
  await writeFile(rulesFile, `${existing}${redirectRules(config, Object.fromEntries(entries))}\n`)
}
