import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { plugin } from 'bun'
import { resolveConfig } from '../config.ts'
import type { Config, ResolvedConfig } from '../types.ts'

const configModule = resolve(import.meta.dir, '../config.ts')
const SPECIFIER = /(from\s*|import\s*\(\s*)(['"])novon(?:\/config)?\2/g
const registered = new Set<string>()

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A site has no node_modules, so `novon/config` cannot resolve from it. Script
 * files under the site root are loaded with that specifier pointed at novon.
 */
function registerSiteLoader(root: string) {
  if (registered.has(root)) return
  registered.add(root)
  plugin({
    name: `novon-site:${root}`,
    setup(build) {
      build.onLoad({ filter: new RegExp(`^${escapeRegExp(root)}/.*\\.(ts|mts|js|mjs)$`) }, async (args) => {
        const source = await Bun.file(args.path).text()
        return {
          contents: source.replace(SPECIFIER, (_m, lead: string, quote: string) => `${lead}${quote}${configModule}${quote}`),
          loader: /\.m?ts$/.test(args.path) ? 'ts' : 'js',
        }
      })
    },
  })
}

export async function loadConfig(dir: string): Promise<ResolvedConfig> {
  const root = resolve(dir)
  const file = ['novon.config.ts', 'novon.config.mts', 'novon.config.js', 'novon.config.mjs'].map((f) => join(root, f)).find(existsSync)
  if (!file) throw new Error(`No novon.config.ts in ${root}. Run \`novon new <dir>\` to start a site.`)
  registerSiteLoader(root)
  const mod = (await import(file)) as { default?: Config }
  if (!mod.default) throw new Error(`${file} must \`export default defineConfig({ ... })\``)
  return resolveConfig(mod.default, root)
}
