/**
 * `novon add <item>`: installs a component's source from the PaneUI registry
 * into the site's `components/` folder and registers its components for MDX.
 * Parts novon already ships (`@/ui/button`, `@/lib/utils`, the theme) are
 * imported from novon, not copied.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import type { ResolvedConfig } from '../types.ts'
import { configFile } from './check.ts'
import { novonRoot } from './vite.ts'

export const REGISTRY = 'https://paneui.dev/r/{name}.json'

interface RegistryFile {
  path: string
  content?: string
  type?: string
  target?: string
}

interface RegistryItem {
  name: string
  type?: string
  title?: string
  dependencies?: string[]
  registryDependencies?: string[]
  files?: RegistryFile[]
}

/** Item types that only carry styles; novon's theme already has them. */
const STYLE_TYPES = new Set(['registry:style', 'registry:theme', 'registry:font', 'registry:base'])

/** `@paneui/timeline`, `timeline` or a full URL → the item's JSON URL. */
export function itemUrl(item: string, registry = process.env.NOVON_REGISTRY ?? REGISTRY): string {
  if (/^https?:\/\//.test(item)) return item
  return registry.replace('{name}', item.replace(/^@[\w-]+\//, ''))
}

/** Where a registry file lives: its import alias (`@/ui/timeline`) and its path in a site. */
export function placement(file: RegistryFile): { alias: string; site: string; novon: string } {
  const name = basename(file.path)
  const stem = name.replace(/\.(tsx?|jsx?)$/, '')
  const kind = file.type === 'registry:ui' ? 'ui' : file.type === 'registry:lib' || file.type === 'registry:hook' ? 'lib' : 'components'
  return { alias: `@/${kind}/${stem}`, site: kind === 'components' ? `components/${name}` : `components/${kind}/${name}`, novon: join(novonRoot, 'src', kind, name) }
}

/** Exported component names of a module: capitalised `export function X`, `export const X` and `export { X, Y }` names. */
export function exportedComponents(source: string): string[] {
  const names = new Set<string>()
  for (const m of source.matchAll(/^export\s+(?:default\s+)?(?:function|const)\s+([A-Z]\w*)/gm)) names.add(m[1])
  for (const m of source.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).at(-1)!.trim()
      if (/^[A-Z]\w*$/.test(name) && !/^type\s/.test(part.trim())) names.add(name)
    }
  }
  return [...names]
}

/** Adds `components` entries to the config file's text; null when it cannot find where. */
export function addComponentsToConfig(text: string, entries: Record<string, string>): string | null {
  const missing = Object.entries(entries).filter(([name]) => !new RegExp(`['"]?${name}['"]?\\s*:`).test(text.match(/components\s*:\s*\{[\s\S]*?\}/)?.[0] ?? ''))
  if (!missing.length) return text
  const lines = missing.map(([name, file]) => `${name}: '${file}',`)
  const block = text.match(/components\s*:\s*\{/)
  if (block) return text.replace(block[0], `${block[0]}\n    ${lines.join('\n    ')}`)
  const open = text.match(/(defineConfig\(\s*\{|export\s+default\s*\{)/)
  if (!open) return null
  return text.replace(open[0], `${open[0]}\n  components: {\n    ${lines.join('\n    ')}\n  },`)
}

export interface AddResult {
  installed: string[]
  /** Parts novon already ships, used as they are. */
  shared: string[]
  components: Record<string, string>
  /** npm packages novon does not have; the site needs a package.json with them. */
  packages: string[]
  configUpdated: boolean
}

async function fetchItem(url: string): Promise<RegistryItem> {
  const res = await fetch(url, { headers: { 'user-agent': 'novon' } })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return (await res.json()) as RegistryItem
}

/** Whether novon's own installation has an npm package. */
const resolvable = (pkg: string) => existsSync(join(novonRoot, 'node_modules', pkg.replace(/(?!^)@[^/]*$/, '')))

export async function addItems(config: ResolvedConfig, items: string[], opts: { overwrite?: boolean; register?: boolean } = {}): Promise<AddResult> {
  const result: AddResult = { installed: [], shared: [], components: {}, packages: [], configUpdated: false }
  const seen = new Set<string>()
  const queue = items.map((i) => ({ url: itemUrl(i), top: true }))
  const written: { file: string; content: string }[] = []
  const local = new Map<string, string>()
  while (queue.length) {
    const { url, top } = queue.shift()!
    if (seen.has(url)) continue
    seen.add(url)
    const item = await fetchItem(url)
    if (STYLE_TYPES.has(item.type ?? '') || /^theme/.test(item.name)) continue
    for (const dep of item.registryDependencies ?? []) queue.push({ url: itemUrl(dep), top: false })
    for (const pkg of item.dependencies ?? []) if (!resolvable(pkg) && !result.packages.includes(pkg)) result.packages.push(pkg)
    for (const file of item.files ?? []) {
      if (file.content === undefined) continue
      const place = placement(file)
      // Shipped with novon: imports of `@/ui/x` already resolve there.
      if (existsSync(place.novon) && !top) {
        if (!result.shared.includes(place.alias)) result.shared.push(place.alias)
        continue
      }
      local.set(place.alias, place.site)
      written.push({ file: place.site, content: file.content })
      if (top && /\.(tsx|jsx)$/.test(place.site)) {
        for (const name of exportedComponents(file.content)) result.components[name] = `./${place.site}#${name}`
      }
    }
  }
  for (const { file, content } of written) {
    const abs = join(config.root, file)
    if (existsSync(abs) && !opts.overwrite) {
      const same = (await readFile(abs, 'utf8')) === content
      if (!same) throw new Error(`${file} exists and differs; pass --overwrite to replace it`)
    }
    // Imports of parts installed beside it become relative; the rest resolve from novon.
    const rewritten = content.replace(/(from\s*|import\s*\(\s*)(["'])(@\/[\w/-]+)\2/g, (m, lead: string, q: string, spec: string) => {
      const target = local.get(spec)
      if (!target) return m
      let rel = relative(dirname(file), target).replace(/\.(tsx?|jsx?)$/, '')
      if (!rel.startsWith('.')) rel = `./${rel}`
      return `${lead}${q}${rel}${q}`
    })
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, rewritten)
    result.installed.push(file)
  }
  if (opts.register !== false && Object.keys(result.components).length) {
    const file = join(config.root, configFile(config.root))
    if (existsSync(file)) {
      const text = await readFile(file, 'utf8')
      const next = addComponentsToConfig(text, result.components)
      if (next !== null) {
        if (next !== text) await writeFile(file, next)
        result.configUpdated = true
      }
    }
  }
  return result
}
