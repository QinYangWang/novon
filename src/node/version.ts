/**
 * `novon version <id>`: freezes the current docs into `content/_versions/<id>`,
 * served at `/<id>/…` (after the docs layer's path). Partials and `{{variables}}`
 * are written out, so the snapshot keeps today's values; relative imports are
 * rewritten for the deeper folder. The id is added to `versions` in the config.
 */
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { layerFor } from '../shared.ts'
import type { ResolvedConfig } from '../types.ts'
import { locate, VERSIONS_DIR } from './mounts.ts'
import { expandSource } from './source.ts'
import { configFile } from './check.ts'

async function walkAll(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (e.name.startsWith('.') || (e.isDirectory() && e.name.startsWith('_'))) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walkAll(full)))
    else out.push(full)
  }
  return out
}

/** Relative `import … from './x'` specifiers, re-pointed from `from` to `to`. */
export function rewriteImports(source: string, fromDir: string, toDir: string): string {
  return source.replace(/^(import\s[^'"]*?from\s*|import\s*)(['"])(\.\.?\/[^'"]+)\2/gm, (_m, lead: string, q: string, spec: string) => {
    let next = relative(toDir, resolve(fromDir, spec)).split(sep).join('/')
    if (!next.startsWith('.')) next = `./${next}`
    return `${lead}${q}${next}${q}`
  })
}

/** Adds the version to `versions.list` in the config file's text, or a `versions` key when there is none. */
export function addVersionToConfig(text: string, id: string): string | null {
  const entry = `'${id}'`
  if (new RegExp(`versions\\s*:[\\s\\S]*?['"]${id.replace(/[.]/g, '\\.')}['"]`).test(text)) return text
  const list = text.match(/versions\s*:\s*\{[\s\S]*?list\s*:\s*\[/)
  if (list) return text.replace(list[0], `${list[0]}${entry}, `)
  const open = text.match(/(defineConfig\(\s*\{|export\s+default\s*\{)/)
  if (!open) return null
  return text.replace(open[0], `${open[0]}\n  versions: { list: [${entry}] },`)
}

export interface FreezeResult {
  dir: string
  files: number
  /** False when the config file could not be edited; add the id to `versions` by hand. */
  configUpdated: boolean
}

export async function freezeVersion(config: ResolvedConfig, id: string): Promise<FreezeResult> {
  if (!/^[A-Za-z0-9][\w.-]*$/.test(id)) throw new Error(`Version ids are letters, digits, dots, dashes and underscores (got "${id}")`)
  const target = join(config.root, VERSIONS_DIR, id)
  if (existsSync(target)) throw new Error(`${relative(process.cwd(), target) || target} already exists`)
  const content = join(config.root, 'content')
  let files = 0
  for (const abs of await walkAll(content)) {
    const rel = relative(content, abs).split(sep).join('/')
    // Only the docs layers are versioned; a blog beside them is not.
    const probe = /\.(mdx|md)$/.test(rel) ? `content/${rel}` : `content/${dirname(rel)}/index.mdx`
    const where = locate(config, probe)
    if (!where || layerFor(where.key, config.baseLayers, config.layout).layout !== 'docs') continue
    const out = join(target, rel)
    await mkdir(dirname(out), { recursive: true })
    if (/\.(mdx|md)$/.test(rel)) {
      const expanded = expandSource(await readFile(abs, 'utf8'), config, `content/${rel}`)
      await writeFile(out, rewriteImports(expanded.code, dirname(abs), dirname(out)))
    } else if (/^_meta\.(ts|mts|js|mjs)$/.test(rel.split('/').at(-1)!)) {
      await writeFile(out, rewriteImports(await readFile(abs, 'utf8'), dirname(abs), dirname(out)))
    } else await copyFile(abs, out)
    files++
  }
  if (!files) throw new Error('No docs pages to freeze')
  const file = configFile(config.root)
  let configUpdated = false
  if (file && existsSync(join(config.root, file)) && !file.endsWith('.json')) {
    const text = await readFile(join(config.root, file), 'utf8')
    const next = addVersionToConfig(text, id)
    if (next !== null) {
      if (next !== text) await writeFile(join(config.root, file), next)
      configUpdated = true
    }
  }
  return { dir: relative(config.root, target), files, configUpdated }
}
