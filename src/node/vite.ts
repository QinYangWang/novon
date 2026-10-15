import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import mdx from '@mdx-js/rollup'
import { scanContent } from './content.ts'
import { mdxOptions } from './mdx.ts'
import type { PageMeta, ResolvedConfig, SiteData } from '../types.ts'

export const novonRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const runtimeDir = join(novonRoot, 'src/runtime')
export const entryClient = join(runtimeDir, 'entry-client.tsx')
export const entryServer = join(runtimeDir, 'entry-server.tsx')

const SITE_ID = 'virtual:novon/site'
const CSS_ID = 'virtual:novon/css'

export function siteData(config: ResolvedConfig, pages: PageMeta[]): SiteData {
  const plugins = config.plugins ?? []
  return {
    title: config.title,
    description: config.description,
    url: config.url,
    base: config.base,
    lang: config.lang,
    nav: config.nav,
    theme: { ...config.theme, override: undefined, css: undefined },
    layers: config.layers,
    defaultLayout: config.layout,
    pages: pages.map(({ text: _text, ...p }) => p),
    search: plugins.includes('search'),
    rss: plugins.includes('rss'),
  }
}

/** The stylesheet entry: the theme plus the site's own files as class sources. */
async function writeCssEntry(config: ResolvedConfig): Promise<string> {
  const dir = join(config.root, '.novon')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, '.gitignore'), '*\n')
  const file = join(dir, 'novon.css')
  const lines = [
    `@import ${JSON.stringify(join(novonRoot, 'src/styles/novon.css'))};`,
    `@source ${JSON.stringify(join(config.root, 'content'))};`,
  ]
  for (const extra of ['theme', 'components']) {
    if (existsSync(join(config.root, extra))) lines.push(`@source ${JSON.stringify(join(config.root, extra))};`)
  }
  for (const css of config.theme.css ?? []) lines.push(`@import ${JSON.stringify(resolve(config.root, css))};`)
  await writeFile(file, `${lines.join('\n')}\n`)
  return file
}

function sitePlugin(config: ResolvedConfig, cssFile: string): Plugin {
  let server: ViteDevServer | undefined
  const resolvedSite = `\0${SITE_ID}`
  return {
    name: 'novon:site',
    enforce: 'pre',
    configureServer(s) {
      server = s
      const reload = (file: string) => {
        if (!file.startsWith(join(config.root, 'content'))) return
        const mod = s.moduleGraph.getModuleById(resolvedSite)
        if (mod) s.moduleGraph.invalidateModule(mod)
        s.ws.send({ type: 'full-reload' })
      }
      s.watcher.on('add', reload)
      s.watcher.on('unlink', reload)
    },
    async resolveId(id) {
      if (id === SITE_ID) return resolvedSite
      if (id === CSS_ID) return cssFile
      return null
    },
    async load(id) {
      if (id !== resolvedSite) return null
      const pages = await scanContent(config)
      const data = siteData(config, pages)
      const loaders = pages
        .filter((p) => p.file)
        .map((p) => `  ${JSON.stringify(p.route)}: () => import(${JSON.stringify(join(config.root, p.file))}),`)
      const imports: string[] = []
      const overrides: string[] = []
      for (const [slot, file] of Object.entries(config.theme.override ?? {})) {
        const name = `Override_${slot}`
        imports.push(`import ${name} from ${JSON.stringify(resolve(config.root, file!))}`)
        overrides.push(`  ${slot}: ${name},`)
      }
      const components: string[] = []
      for (const [name, file] of Object.entries(config.components ?? {})) {
        const local = `Component_${name}`
        imports.push(`import ${local} from ${JSON.stringify(resolve(config.root, file))}`)
        components.push(`  ${JSON.stringify(name)}: ${local},`)
      }
      if (server) for (const p of pages) if (p.file) server.watcher.add(join(config.root, p.file))
      return [
        ...imports,
        `export const site = ${JSON.stringify(data)}`,
        `export const loaders = {\n${loaders.join('\n')}\n}`,
        `export const overrides = {\n${overrides.join('\n')}\n}`,
        `export const components = {\n${components.join('\n')}\n}`,
      ].join('\n')
    },
    handleHotUpdate(ctx) {
      // Frontmatter drives navigation, so a content edit refreshes the site index too.
      if (/\.(mdx|md)$/.test(ctx.file) && ctx.file.startsWith(join(config.root, 'content'))) {
        const mod = ctx.server.moduleGraph.getModuleById(resolvedSite)
        if (mod) {
          ctx.server.moduleGraph.invalidateModule(mod)
          return [...ctx.modules, mod]
        }
      }
    },
  }
}

/** Site files have no node_modules: bare imports fall back to novon's own installation. */
function fallbackResolve(): Plugin {
  const anchor = join(novonRoot, 'package.json')
  return {
    name: 'novon:fallback-resolve',
    enforce: 'pre',
    async resolveId(id, importer, options) {
      if (!importer || id.startsWith('.') || id.startsWith('/') || id.startsWith('\0') || id.includes(':')) return null
      if (importer.startsWith(novonRoot) && !importer.startsWith(join(novonRoot, 'docs'))) return null
      const own = await this.resolve(id, importer, { ...options, skipSelf: true })
      if (own) return own
      return this.resolve(id, anchor, { ...options, skipSelf: true })
    },
  }
}

export async function viteConfig(config: ResolvedConfig, mode: 'development' | 'production'): Promise<InlineConfig> {
  const cssFile = await writeCssEntry(config)
  return {
    configFile: false,
    root: config.root,
    base: config.base,
    mode,
    publicDir: join(config.root, 'public'),
    cacheDir: join(config.root, '.novon/vite'),
    logLevel: 'warn',
    appType: 'custom',
    resolve: {
      alias: [
        { find: /^novon$/, replacement: join(runtimeDir, 'index.ts') },
        { find: /^@\//, replacement: `${join(novonRoot, 'src')}/` },
      ],
      dedupe: ['react', 'react-dom', '@mdx-js/react'],
    },
    plugins: [
      sitePlugin(config, cssFile),
      fallbackResolve(),
      { enforce: 'pre', ...mdx(mdxOptions(config)) },
      react({ include: /\.(mdx|md|jsx|tsx|js|ts)$/ }),
      tailwind(),
    ],
    server: { fs: { allow: [config.root, novonRoot] } },
    optimizeDeps: { entries: [entryClient] },
  }
}
