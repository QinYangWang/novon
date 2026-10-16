#!/usr/bin/env bun
/**
 * Builds each starter template as a live demo inside the docs site, at
 * docs/dist/templates/<name>/. Run after `bun run build:docs`.
 *
 *   bun scripts/build-templates.ts
 */
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scaffold, templates, type Template } from '../src/node/new.ts'
import { loadConfig } from '../src/node/load-config.ts'
import { build } from '../src/node/build.ts'

const root = join(import.meta.dir, '..')
const docsDist = join(root, 'docs/dist')

/** Demo titles; a scaffolded site takes its title from its folder name. */
export const demos: Record<Template, { title: string }> = {
  blog: { title: 'Mira Chen' },
  docs: { title: 'Acme' },
}

/** Scaffolds a template into a temp folder, served from `base`, and builds it. Returns its dist folder. */
export async function buildDemo(template: Template, base: string, url?: string): Promise<string> {
  const dir = join(await mkdtemp(join(tmpdir(), 'novon-demo-')), template)
  await scaffold(dir, template)
  const file = join(dir, 'novon.config.ts')
  const cfg = await readFile(file, 'utf8')
  const extra = [`base: '${base}',`, url ? `url: '${url}',` : ''].filter(Boolean).join('\n  ')
  await writeFile(
    file,
    cfg
      .replace(/title: '[^']*'/, `title: '${demos[template].title}'`)
      .replace(/© (\d+) [^']*'/, `© $1 ${demos[template].title}'`)
      .replace('defineConfig({', `defineConfig({\n  ${extra}`),
  )
  await build(await loadConfig(dir))
  return join(dir, 'dist')
}

if (import.meta.main) {
  if (!existsSync(join(docsDist, 'index.html'))) throw new Error('Build the docs first: bun run build:docs')
  for (const t of templates) {
    const out = await buildDemo(t, `/novon/templates/${t}/`, 'https://qinyangwang.github.io')
    const target = join(docsDist, 'templates', t)
    await rm(target, { recursive: true, force: true })
    await cp(out, target, { recursive: true })
    console.log(`templates/${t} → ${target}`)
  }
}
