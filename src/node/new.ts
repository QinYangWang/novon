import { cp, readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { humanize } from '../shared.ts'

export const templates = ['docs', 'blog'] as const
export type Template = (typeof templates)[number]

const templateDir = resolve(import.meta.dir, '../../templates')

async function fill(dir: string, vars: Record<string, string>) {
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry)
    if ((await stat(full)).isDirectory()) await fill(full, vars)
    else if (/\.(ts|mdx|md|json)$/.test(entry)) {
      let text = await readFile(full, 'utf8')
      for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`__${k}__`, v)
      await writeFile(full, text)
    }
  }
}

export async function scaffold(target: string, template: Template = 'docs'): Promise<string> {
  if (!templates.includes(template)) throw new Error(`Unknown template "${template}". Use one of: ${templates.join(', ')}`)
  const dir = resolve(target)
  if (existsSync(dir) && (await readdir(dir)).length) throw new Error(`${dir} is not empty`)
  await cp(join(templateDir, template), dir, { recursive: true })
  const name = basename(dir)
  await fill(dir, { NAME: name, TITLE: humanize(name), YEAR: String(new Date().getFullYear()) })
  await writeFile(join(dir, '.gitignore'), 'dist\n.novon\n')
  return dir
}
