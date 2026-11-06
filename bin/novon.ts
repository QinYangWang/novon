#!/usr/bin/env bun
import { parseArgs } from 'node:util'
import { relative, resolve } from 'node:path'
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
  novon export epub|pdf [dir] [--out file] [--locale code]
                                           the docs as one book (PDF needs Chromium, or NOVON_CHROME)
  novon add <item…> [--dir dir] [--overwrite]
                                           install components from the PaneUI registry

Agent commands (run your own coding agent; --dry-run prints the prompt instead)
  novon translate <locale> [dir] [--check] [--strict] [--only glob]
                                           translate missing and stale pages into content/<locale>
  novon migrate <docusaurus|mintlify|nextra|vitepress|starlight|auto> [src] [--dir out] [--agent] [--overwrite]
                                           convert another framework's project into a novon site
  novon eval [dir] [--offline] [--generate n]
                                           answer the questions in evals.json from the docs
  novon skill [dir] [--agent]              write skills/<name>/SKILL.md for the site

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
    out: { type: 'string', short: 'o' },
    locale: { type: 'string', short: 'l' },
    check: { type: 'boolean' },
    only: { type: 'string' },
    'dry-run': { type: 'boolean' },
    agent: { type: 'boolean' },
    offline: { type: 'boolean' },
    generate: { type: 'string' },
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

  if (command === 'migrate') {
    const { migrate, migrationPrompt, MIGRATE_SOURCES } = await import('../src/node/migrate.ts')
    if (!target) throw new Error(`novon migrate needs a source: ${MIGRATE_SOURCES.join(', ')} or auto`)
    const dryRun = values['dry-run']
    const r = await migrate(target as 'auto', positionals[2] ?? '.', values.dir ?? 'novon', { overwrite: values.overwrite, dryRun })
    const rel = relative(process.cwd(), r.dir) || '.'
    if (dryRun) {
      for (const f of Object.keys(r.files)) console.log(`${dim('would write')} ${rel}/${f}`)
      console.log(dim(`and copy ${r.assets} static file${r.assets === 1 ? '' : 's'}`))
    } else console.log(`Migrated ${r.pages} page${r.pages === 1 ? '' : 's'} from ${r.source} into ${rel} ${dim(`(${r.metas} _meta.ts, ${r.assets} static files)`)}`)
    console.log(r.leftovers.length ? `${r.leftovers.length} thing${r.leftovers.length === 1 ? '' : 's'} left to do: see ${rel}/MIGRATION.md` : 'Nothing left over.')
    if (!values.agent || !r.leftovers.length) return
    const { loadConfig } = await import('../src/node/load-config.ts')
    const { resolveAgent, runAgent, commandLine, NO_AGENT } = await import('../src/node/agent.ts')
    const config = dryRun ? null : await loadConfig(r.dir).catch(() => null)
    const agent = resolveAgent(config?.agent)
    const prompt = migrationPrompt(r)
    if (dryRun) return console.log(`\n${agent ? dim(`$ ${commandLine(agent, { edit: true })}`) : dim('(no agent found)')}\n${prompt}`)
    if (!agent) throw new Error(NO_AGENT)
    console.log(dim(`Handing MIGRATION.md to ${agent.name}…`))
    const run = await runAgent(agent, prompt, { cwd: r.dir, edit: true })
    if (run.stdout.trim()) console.log(run.stdout.trim())
    if (!run.ok) throw new Error(`${agent.name} exited with ${run.code}${run.stderr.trim() ? `: ${run.stderr.trim().split('\n').at(-1)}` : ''}`)
    return
  }

  // `novon version <id> [dir]`, `novon translate <locale> [dir]` and `novon add <item…>` take their argument before the site folder.
  const takesArgument = command === 'version' || command === 'add' || command === 'export' || command === 'translate'
  const root = resolve((command === 'add' ? values.dir : takesArgument ? positionals[2] : target) ?? '.')
  if (takesArgument && !target) throw new Error(`novon ${command} needs ${command === 'add' ? 'an item, e.g. novon add timeline' : command === 'export' ? 'a format, e.g. novon export epub' : command === 'translate' ? 'a locale, e.g. novon translate ja' : 'an id, e.g. novon version v1'}`)
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
  if (command === 'export') {
    const { exportBook } = await import('../src/node/export.ts')
    const r = await exportBook(config, target as 'epub' | 'pdf', { out: values.out, locale: values.locale })
    const rel = (f: string) => relative(process.cwd(), f) || f
    if (target === 'pdf' && !r.printed) {
      console.log(`Wrote ${rel(r.printFile!)} ${dim(`(${r.chapters} chapters)`)}\nNo Chromium found: open it in a browser and print to PDF, or set NOVON_CHROME to a Chromium binary and run again.`)
      return
    }
    console.log(`Wrote ${rel(r.file)} ${dim(`(${r.chapters} chapters)`)}`)
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
  if (command === 'translate') {
    const { translationStatus, translatePages, translationPrompt } = await import('../src/node/translate.ts')
    const { resolveAgent, commandLine, NO_AGENT } = await import('../src/node/agent.ts')
    const items = await translationStatus(config, target!, { only: values.only })
    const todo = items.filter((i) => i.status !== 'current')
    const label = (i: (typeof items)[number]) => `${i.status === 'missing' ? '+' : '~'} ${i.file} ${dim(i.status === 'missing' ? 'missing' : `stale: ${i.reason}`)}`
    if (values.check) {
      for (const i of todo) console.log(label(i))
      console.log(todo.length ? `${todo.length} of ${items.length} page${items.length === 1 ? '' : 's'} need translating into ${target}` : `All ${items.length} pages are translated into ${target}.`)
      if (values.strict && todo.length) process.exit(1)
      return
    }
    if (!todo.length) return console.log(`All ${items.length} pages are translated into ${target}.`)
    const agent = resolveAgent(config.agent)
    if (values['dry-run']) {
      console.log(agent ? dim(`$ ${commandLine(agent)}`) : dim('(no agent found)'))
      for (const i of todo) console.log(`\n${label(i)}\n${dim('─'.repeat(40))}\n${translationPrompt(config, target!, i, await Bun.file(i.source).text(), i.status === 'stale' ? await Bun.file(i.target).text() : undefined)}`)
      return
    }
    if (!agent) {
      for (const i of todo) console.log(label(i))
      throw new Error(NO_AGENT)
    }
    console.log(dim(`Translating ${todo.length} page${todo.length === 1 ? '' : 's'} into ${target} with ${agent.name}…`))
    const r = await translatePages(config, target!, todo, agent, (i, ok) => console.log(`${ok ? '✓' : '\x1b[31m✗\x1b[0m'} content/${target}/${i.file}`))
    for (const f of r.failed) console.log(`\x1b[31m✗\x1b[0m ${f.file} ${dim(f.message)}`)
    if (r.failed.length) process.exit(1)
    return
  }
  if (command === 'eval') {
    const ev = await import('../src/node/eval.ts')
    const { resolveAgent, commandLine, NO_AGENT } = await import('../src/node/agent.ts')
    const agent = values.offline ? null : resolveAgent(config.agent)
    if (values.generate !== undefined) {
      const n = Number(values.generate) || 5
      if (values['dry-run']) return console.log(`${agent ? dim(`$ ${commandLine(agent)}`) : dim('(no agent found)')}\n${ev.generatePrompt(config, n, ev.docsFilePath(config), await ev.readEvals(root))}`)
      if (!agent) throw new Error(NO_AGENT)
      const r = await ev.generateEvals(config, n, await ev.corpus(config), agent)
      console.log(`Added ${r.added.length} check${r.added.length === 1 ? '' : 's'} to ${ev.EVALS_FILE}${r.dropped.length ? dim(` (dropped ${r.dropped.length} whose phrases are not in the docs)`) : ''}`)
      return
    }
    const checks = await ev.readEvals(root)
    if (!checks.length) return console.log(`No checks: add ${ev.EVALS_FILE} with [{ "question": "…", "expect": ["…"] }]${agent ? ', or run novon eval --generate 5' : ''}.`)
    if (values['dry-run']) {
      console.log(agent ? dim(`$ ${commandLine(agent)}`) : dim('(no agent: checks the docs offline)'))
      for (const c of checks) console.log(`\n${agent ? ev.questionPrompt(config, c, ev.docsFilePath(config)) : `${c.question}\n  expects ${c.expect.map((e) => JSON.stringify(e)).join(', ')}`}`)
      return
    }
    const docs = await ev.corpus(config)
    const show = (r: Awaited<ReturnType<typeof ev.evalOffline>>[number]) =>
      console.log(`${r.ok ? '✓' : '\x1b[31m✗\x1b[0m'} ${r.check.question}${r.ok ? '' : dim(`  ${r.error ?? `missing ${r.missing.map((m) => JSON.stringify(m)).join(', ')}`}`)}`)
    if (!agent) console.log(dim(values.offline ? 'Offline: checking that the docs contain each answer.' : `${NO_AGENT.split('.')[0]}: checking that the docs contain each answer.`))
    else console.log(dim(`Asking ${agent.name} ${checks.length} question${checks.length === 1 ? '' : 's'}…`))
    const results = agent ? await ev.evalWithAgent(config, checks, docs, agent, show) : ev.evalOffline(checks, docs)
    if (!agent) results.forEach(show)
    const failed = results.filter((r) => !r.ok).length
    console.log(`\n${results.length - failed} of ${results.length} passed`)
    if (failed) process.exit(1)
    return
  }
  if (command === 'skill') {
    const { writeSkill } = await import('../src/node/skill.ts')
    const { resolveAgent, commandLine, NO_AGENT } = await import('../src/node/agent.ts')
    const agent = values.agent ? resolveAgent(config.agent) : null
    if (values.agent && !agent && !values['dry-run']) throw new Error(NO_AGENT)
    const r = await writeSkill(config, { agent, dryRun: values['dry-run'] })
    if (values['dry-run']) {
      if (values.agent) {
        const { refinePrompt } = await import('../src/node/skill.ts')
        const { docsFilePath } = await import('../src/node/eval.ts')
        return console.log(`${agent ? dim(`$ ${commandLine(agent)}`) : dim('(no agent found)')}\n${refinePrompt(config, r.markdown, docsFilePath(config))}`)
      }
      return console.log(r.markdown)
    }
    if (r.warning) console.log(`\x1b[33mwarning\x1b[0m  ${r.warning}`)
    console.log(`Wrote ${relative(process.cwd(), r.file)}${r.refined ? dim(` (refined by ${agent!.name})`) : ''}`)
    if (config.agents === false || (config.agents && config.agents.skills === false)) console.log(dim('`agents` is off, so the build does not publish it.'))
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
