#!/usr/bin/env bun
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import pkg from '../package.json' with { type: 'json' }

const help = `novon ${pkg.version} ฅ^•ﻌ•^ฅ

Usage
  novon new [dir] [--template docs|blog] [--title T] [--yes]
                                           start a site (in the current folder without dir)
  novon dev [dir] [--port 4321] [--host]   preview with live reload
  novon build [dir] [--strict] [--budget-js 200kB] [--budget-css 60kB]
                                           write the static site to dir/dist
  novon preview [dir] [--port 4173]        serve dir/dist
  novon check [dir] [--json] [--strict] [--external]
                                           validate config, frontmatter, links and redirects
  novon audit [dir] [--json] [--strict]    check the built site for search and sharing problems
  novon version <id> [dir]                 freeze the current docs as version <id>
  novon sync [dir]                         refresh outside sources and remote API descriptions
  novon add <item…> [--dir dir] [--overwrite]
                                           install components from the PaneUI registry

A site is a novon.config.ts and a content/ folder of .mdx files.`

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    template: { type: 'string', short: 't' },
    title: { type: 'string' },
    yes: { type: 'boolean', short: 'y' },
    'budget-js': { type: 'string' },
    'budget-css': { type: 'string' },
    port: { type: 'string', short: 'p' },
    host: { type: 'boolean' },
    strict: { type: 'boolean' },
    json: { type: 'boolean' },
    external: { type: 'boolean' },
    dir: { type: 'string', short: 'd' },
    overwrite: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
})

const [command, target] = positionals
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`

async function main() {
  if (values.version) return console.log(pkg.version)
  if (values.help || !command) return console.log(help)

  if (command === 'new') {
    const { scaffold, templates } = await import('../src/node/new.ts')
    const { humanize } = await import('../src/shared.ts')
    let template = values.template
    let title = values.title
    const ask = !values.yes && process.stdin.isTTY
    if (ask && !template) template = prompt(`Template (${templates.join(', ')})`, 'docs') ?? 'docs'
    if (ask && !title) title = prompt('Site title', humanize(resolve(target ?? '.').split('/').at(-1) ?? 'site')) ?? undefined
    const dir = await scaffold(target ?? '.', (template ?? 'docs') as 'docs' | 'blog', { title: title || undefined })
    console.log(`Created ${template ?? 'docs'} site in ${dir}\n\n${target ? `  cd ${target}\n` : ''}  novon dev\n`)
    return
  }

  // `novon version <id> [dir]` and `novon add <item…>` take their argument before the site folder.
  const takesArgument = command === 'version' || command === 'add'
  const root = resolve((command === 'add' ? values.dir : takesArgument ? positionals[2] : target) ?? '.')
  if (takesArgument && !target) throw new Error(`novon ${command} needs ${command === 'add' ? 'an item, e.g. novon add timeline' : 'an id, e.g. novon version v1'}`)
  process.chdir(root)
  const { loadConfig } = await import('../src/node/load-config.ts')
  const config = await loadConfig(root)

  if (command === 'dev') {
    const { dev } = await import('../src/node/dev.ts')
    const server = await dev(config, values.port ? Number(values.port) : undefined, values.host ? '0.0.0.0' : undefined)
    const url = server.resolvedUrls?.local[0] ?? `http://localhost:${server.config.server.port}`
    console.log(`novon ${dim(pkg.version)}  ${url}`)
    return
  }
  if (command === 'build') {
    const { build } = await import('../src/node/build.ts')
    const budget = { ...(values['budget-js'] ? { js: values['budget-js'] } : {}), ...(values['budget-css'] ? { css: values['budget-css'] } : {}) }
    const r = await build(config, { strict: values.strict, budget })
    const { formatSize } = await import('../src/node/budget.ts')
    console.log(`Built ${r.pages} pages into ${r.outDir} ${dim(`in ${r.ms} ms · first load ${formatSize(r.assets.js)} JS, ${formatSize(r.assets.css)} CSS gzipped`)}`)
    return
  }
  if (command === 'check') {
    const { check, formatIssues, summarize } = await import('../src/node/check.ts')
    const issues = await check(config, { external: values.external })
    const { errors, warnings } = summarize(issues)
    if (values.json) console.log(JSON.stringify({ errors, warnings, issues }, null, 2))
    else if (issues.length) console.log(`${formatIssues(issues)}\n\n${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`)
    else console.log('No problems found.')
    if (errors || (values.strict && warnings)) process.exit(1)
    return
  }
  if (command === 'audit') {
    const { audit, formatAudit } = await import('../src/node/audit.ts')
    const { scanPages } = await import('../src/node/content.ts')
    const issues = await audit(config, { pages: (await scanPages(config)).pages })
    const errors = issues.filter((i) => i.severity === 'error').length
    const warnings = issues.length - errors
    if (values.json) console.log(JSON.stringify({ errors, warnings, issues }, null, 2))
    else if (issues.length) console.log(`${formatAudit(issues)}\n\n${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`)
    else console.log('No problems found.')
    if (errors || (values.strict && warnings)) process.exit(1)
    return
  }
  if (command === 'version') {
    const { freezeVersion } = await import('../src/node/version.ts')
    const r = await freezeVersion(config, target!)
    console.log(`Froze ${r.files} file${r.files === 1 ? '' : 's'} into ${r.dir}`)
    if (!r.configUpdated) console.log(`Add it to your config:\n\n  versions: { list: ['${target}'] },\n`)
    return
  }
  if (command === 'sync') {
    const { syncAll } = await import('../src/node/sources.ts')
    const results = await syncAll(config)
    if (!results.length) return console.log('Nothing to sync: no `sources` and no remote `openapi` descriptions.')
    for (const r of results) console.log(`${r.ok ? '✓' : '\x1b[31m✗\x1b[0m'} ${r.name}  ${dim(r.message)}`)
    if (results.some((r) => !r.ok)) process.exit(1)
    return
  }
  if (command === 'add') {
    const { addItems } = await import('../src/node/add.ts')
    const r = await addItems(config, positionals.slice(1), { overwrite: values.overwrite })
    for (const f of r.installed) console.log(`+ ${f}`)
    if (r.shared.length) console.log(dim(`uses novon's ${r.shared.join(', ')}`))
    const names = Object.keys(r.components)
    if (names.length) console.log(r.configUpdated ? `Registered for MDX: ${names.map((n) => `<${n}>`).join(' ')}` : `Add to \`components\` in your config:\n${Object.entries(r.components).map(([n, f]) => `  ${n}: '${f}',`).join('\n')}`)
    if (r.packages.length) console.log(`\nThese need npm packages novon does not have: ${r.packages.join(', ')}. Add a package.json and install them.`)
    return
  }
  if (command === 'preview') {
    const { preview } = await import('../src/node/preview.ts')
    const server = await preview(config, values.port ? Number(values.port) : undefined)
    console.log(`Serving dist at ${new URL(config.base, server.url).href}`)
    return
  }
  throw new Error(`Unknown command "${command}"\n\n${help}`)
}

main().catch((error) => {
  console.error(`\x1b[31m${error instanceof Error ? error.message : error}\x1b[0m`)
  if (process.env.NOVON_DEBUG && error instanceof Error) console.error(error.stack)
  process.exit(1)
})
