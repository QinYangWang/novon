#!/usr/bin/env bun
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import pkg from '../package.json' with { type: 'json' }

const help = `novon ${pkg.version} ฅ^•ﻌ•^ฅ

Usage
  novon new <dir> [--template docs|blog]   start a site
  novon dev [dir] [--port 4321] [--host]   preview with live reload
  novon build [dir]                        write the static site to dir/dist
  novon preview [dir] [--port 4173]        serve dir/dist

A site is a novon.config.ts and a content/ folder of .mdx files.`

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    template: { type: 'string', short: 't', default: 'docs' },
    port: { type: 'string', short: 'p' },
    host: { type: 'boolean' },
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
    if (!target) throw new Error('Usage: novon new <dir> [--template docs|blog]')
    const { scaffold } = await import('../src/node/new.ts')
    const dir = await scaffold(target, values.template as 'docs' | 'blog')
    console.log(`Created ${values.template} site in ${dir}\n\n  cd ${target}\n  novon dev\n`)
    return
  }

  const root = resolve(target ?? '.')
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
    const r = await build(config)
    console.log(`Built ${r.pages} pages into ${r.outDir} ${dim(`in ${r.ms} ms`)}`)
    return
  }
  if (command === 'preview') {
    const { preview } = await import('../src/node/preview.ts')
    const server = preview(config, values.port ? Number(values.port) : undefined)
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
