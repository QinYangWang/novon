import { cp, readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { humanize } from '../shared.ts'

export const templates = ['docs', 'blog'] as const
export type Template = (typeof templates)[number]

const templateDir = resolve(import.meta.dir, '../../templates')

async function fill(dir: string, vars: Record<string, string>, only?: Set<string>) {
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry)
    if ((await stat(full)).isDirectory()) await fill(full, vars, only)
    else if (/\.(ts|mdx|md|json)$/.test(entry) && (!only || only.has(full))) {
      let text = await readFile(full, 'utf8')
      for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`__${k}__`, v)
      await writeFile(full, text)
    }
  }
}

async function files(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await files(full)))
    else out.push(full)
  }
  return out
}

/** What a coding agent needs to work on a novon site, written to the site's AGENTS.md. */
export function agentsMd(title: string, template: Template): string {
  return `# ${title}

A ${template === 'blog' ? 'blog' : 'documentation site'} built with novon: MDX in, static site out.

## Commands

- \`novon dev\`: preview at http://localhost:4321 with live reload
- \`novon check --strict\`: config, frontmatter, links, anchors, partials and variables
- \`novon build\`: write the static site to \`dist/\`

Run \`novon check --strict\` after every change and fix what it reports.

## Layout

- \`novon.config.ts\`: site settings (\`export default defineConfig({...})\`)
- \`content/\`: one page per \`.mdx\` or \`.md\` file; \`content/a/b.mdx\` is \`/a/b\`, \`index.mdx\` is its folder
- \`content/**/_meta.ts\`: a folder's sidebar order, title, badges and groups (\`defineMeta\`)
- \`content/_partials/\`: reusable snippets, included with \`<Partial file="name" />\`
- \`public/\`: files served as is (images, favicon)
- \`skills/\`: agent skills to publish, one folder with a \`SKILL.md\` each

## Writing

- Frontmatter: \`title\`, \`description\` (one sentence; used in search, feeds and share cards)${template === 'blog' ? ', `date`, `tags`, `author`' : ', `order`, `icon`, `badge`'}.
- Start sections at \`##\`; the page title is the \`#\` heading.
- Link pages by route (\`/guide/setup\`), not by file path; \`novon check\` verifies links and \`#anchors\`.
- Components work without imports: \`Callout\`, \`Steps\`, \`Tabs\`, \`CodeGroup\`, \`Card\`, \`TypeTable\`, \`Diff\`, \`Prompt\`, \`PackageInstall\`, \`FileTree\`, \`Mermaid\`. \`:::note\` blocks, \`$math$\` and \` \`\`\`mermaid \` fences work too.
- \`{{name}}\` is replaced with \`variables.name\` from the config.

## Reference

The novon docs: https://qinyangwang.github.io/novon/llms.txt
`
}

export interface ScaffoldOptions {
  /** Site title. Default: from the folder name. */
  title?: string
}

/**
 * A new site from a template. An empty or missing folder gets the whole
 * template; a folder with other files gets the template's files that are not
 * already there, unless it already holds a site.
 */
export async function scaffold(target: string, template: Template = 'docs', options: ScaffoldOptions = {}): Promise<string> {
  if (!templates.includes(template)) throw new Error(`Unknown template "${template}". Use one of: ${templates.join(', ')}`)
  const dir = resolve(target)
  const source = join(templateDir, template)
  const name = basename(dir)
  const vars = { NAME: name, TITLE: options.title ?? humanize(name), YEAR: String(new Date().getFullYear()) }
  const existing = existsSync(dir) ? (await readdir(dir)).filter((f) => f !== '.git' && f !== '.DS_Store') : []
  if (existing.some((f) => /^novon\.config\.m?[tj]s$/.test(f) || f === 'content')) throw new Error(`${dir} already has a novon site`)
  const added = new Set<string>()
  if (!existing.length) {
    await cp(source, dir, { recursive: true })
  } else {
    for (const file of await files(source)) {
      const to = join(dir, relative(source, file))
      if (existsSync(to)) continue
      await cp(file, to, { recursive: true })
      added.add(to)
    }
  }
  await fill(dir, vars, existing.length ? added : undefined)
  const gitignore = join(dir, '.gitignore')
  if (!existsSync(gitignore)) await writeFile(gitignore, 'dist\n.novon\n')
  else {
    const text = await readFile(gitignore, 'utf8')
    const missing = ['dist', '.novon'].filter((l) => !text.split('\n').some((x) => x.trim() === l || x.trim() === `${l}/`))
    if (missing.length) await writeFile(gitignore, `${text.replace(/\n?$/, '\n')}${missing.join('\n')}\n`)
  }
  if (!existsSync(join(dir, 'AGENTS.md'))) await writeFile(join(dir, 'AGENTS.md'), agentsMd(vars.TITLE, template))
  return dir
}
