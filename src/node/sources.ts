/**
 * Content from outside the site, cached under `.novon/sources/<name>/`:
 *
 * - `git`: a shallow, sparse clone of another repository (one folder of it).
 * - `files`: Markdown or MDX pages fetched from URLs.
 * - `github-releases`: a changelog page built from a repository's releases.
 *
 * `novon sync` refreshes every cache. Builds read the cache, so they work
 * offline once synced; a source with no cache yet is fetched on first use.
 */
import { existsSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GitSource, ReleasesSource, RemoteFilesSource, ResolvedConfig, SourceOptions } from '../types.ts'
import { SOURCES_DIR, sourceName } from './mounts.ts'
import { fetchSpec, specList } from './openapi.ts'

export interface SyncResult {
  name: string
  type: string
  ok: boolean
  message: string
}

export const sourceDir = (config: ResolvedConfig, s: SourceOptions) => join(config.root, SOURCES_DIR, sourceName(s))

function run(args: string[], cwd?: string): string {
  const r = Bun.spawnSync(args, { cwd, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  if (r.exitCode !== 0) throw new Error(r.stderr.toString().trim().split('\n').at(-1) || `${args.join(' ')} failed`)
  return r.stdout.toString().trim()
}

async function syncGit(config: ResolvedConfig, s: GitSource): Promise<string> {
  const dir = sourceDir(config, s)
  const tmp = `${dir}.tmp-${process.pid}`
  await rm(tmp, { recursive: true, force: true })
  await mkdir(join(dir, '..'), { recursive: true })
  const sparse = s.dir ? ['--filter=blob:none', '--sparse'] : []
  const isCommit = !!s.ref && /^[0-9a-f]{7,40}$/i.test(s.ref)
  try {
    if (isCommit) {
      run(['git', 'init', '-q', tmp])
      run(['git', 'remote', 'add', 'origin', s.repo], tmp)
      if (s.dir) {
        run(['git', 'config', 'core.sparseCheckout', 'true'], tmp)
        run(['git', 'sparse-checkout', 'set', '--no-cone', `/${s.dir.replace(/^\/+|\/+$/g, '')}/`], tmp)
      }
      run(['git', 'fetch', '-q', '--depth', '1', ...(s.dir ? ['--filter=blob:none'] : []), 'origin', s.ref!], tmp)
      run(['git', 'checkout', '-q', 'FETCH_HEAD'], tmp)
    } else {
      run(['git', 'clone', '-q', '--depth', '1', ...sparse, ...(s.ref ? ['--branch', s.ref] : []), s.repo, tmp])
      if (s.dir) run(['git', 'sparse-checkout', 'set', s.dir.replace(/^\/+|\/+$/g, '')], tmp)
    }
    const commit = run(['git', 'rev-parse', 'HEAD'], tmp)
    await writeFile(join(tmp, '.novon-source.json'), JSON.stringify({ type: 'git', repo: s.repo, ref: s.ref ?? null, commit, synced: new Date().toISOString() }, null, 2))
    await rm(dir, { recursive: true, force: true })
    await rename(tmp, dir)
    if (s.dir && !existsSync(join(dir, s.dir))) throw new Error(`no folder ${s.dir} in ${s.repo}`)
    return `${s.repo}${s.ref ? `@${s.ref}` : ''} (${commit.slice(0, 7)})`
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

async function syncFiles(config: ResolvedConfig, s: RemoteFilesSource): Promise<string> {
  const dir = sourceDir(config, s)
  const pages = new Map<string, string>()
  for (const [path, url] of Object.entries(s.files ?? {})) {
    const res = await fetch(url, { headers: { 'user-agent': 'novon' } })
    if (!res.ok) throw new Error(`${url} returned ${res.status}`)
    const ext = /\.md(\?|#|$)/i.test(url) ? 'md' : 'mdx'
    const clean = path.replace(/^\/+|\/+$/g, '') || 'index'
    pages.set(`${clean}.${ext}`, await res.text())
  }
  await rm(dir, { recursive: true, force: true })
  for (const [file, text] of pages) {
    await mkdir(join(dir, file, '..'), { recursive: true })
    await writeFile(join(dir, file), text)
  }
  return `${pages.size} file${pages.size === 1 ? '' : 's'}`
}

interface Release {
  tag_name: string
  name: string | null
  body: string | null
  html_url: string
  published_at: string | null
  created_at: string
  prerelease: boolean
  draft: boolean
}

/** A Markdown changelog page from releases, newest first: `## <name> (<date>)` and the release notes. */
export function releasesPage(s: Pick<ReleasesSource, 'title' | 'description' | 'repo'>, releases: Release[]): string {
  const head = ['---', `title: ${JSON.stringify(s.title ?? 'Changelog')}`, ...(s.description ? [`description: ${JSON.stringify(s.description)}`] : []), 'layout: changelog', '---', '']
  const body = releases.map((r) => {
    const date = (r.published_at ?? r.created_at ?? '').slice(0, 10)
    const name = (r.name?.trim() || r.tag_name).replace(/\n/g, ' ')
    // Release notes use `#` headings for their own sections; keep them below the release heading.
    const notes = (r.body ?? '').replace(/\r\n/g, '\n').replace(/^(#{1,4}) /gm, (_m, h: string) => `${'#'.repeat(Math.min(6, h.length + 2))} `).trim()
    return `## ${name}${date ? ` (${date})` : ''}\n\n${notes ? `${notes}\n\n` : ''}[${r.tag_name}](${r.html_url})`
  })
  return `${head.join('\n')}${body.join('\n\n')}\n`
}

async function syncReleases(config: ResolvedConfig, s: ReleasesSource): Promise<string> {
  const token = process.env[s.tokenEnv ?? 'GITHUB_TOKEN']
  const limit = Math.min(Math.max(s.limit ?? 50, 1), 100)
  const res = await fetch(`https://api.github.com/repos/${s.repo}/releases?per_page=${limit}`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'novon', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${s.repo}${res.status === 403 || res.status === 429 ? ' (rate limited; set GITHUB_TOKEN)' : ''}`)
  const releases = ((await res.json()) as Release[]).filter((r) => !r.draft && (s.prereleases !== false || !r.prerelease))
  const dir = sourceDir(config, s)
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  // Markdown, not MDX: release notes are GitHub Markdown and may hold HTML or braces.
  await writeFile(join(dir, 'index.md'), releasesPage(s, releases))
  return `${releases.length} release${releases.length === 1 ? '' : 's'} of ${s.repo}`
}

export async function syncSource(config: ResolvedConfig, s: SourceOptions): Promise<string> {
  if (s.type === 'git') return syncGit(config, s)
  if (s.type === 'files') return syncFiles(config, s)
  if (s.type === 'github-releases') return syncReleases(config, s)
  throw new Error(`Unknown source type "${(s as { type: string }).type}"`)
}

/** Refreshes every source and every OpenAPI description given as a URL. */
export async function syncAll(config: ResolvedConfig): Promise<SyncResult[]> {
  const out: SyncResult[] = []
  for (const s of config.sources ?? []) {
    try {
      out.push({ name: sourceName(s), type: s.type, ok: true, message: await syncSource(config, s) })
    } catch (error) {
      out.push({ name: sourceName(s), type: s.type, ok: false, message: (error as Error).message })
    }
  }
  for (const spec of specList(config).filter((x) => /^https?:\/\//.test(x.spec))) {
    try {
      await fetchSpec(config, spec)
      out.push({ name: spec.path, type: 'openapi', ok: true, message: spec.spec })
    } catch (error) {
      out.push({ name: spec.path, type: 'openapi', ok: false, message: `${spec.spec}: ${(error as Error).message}` })
    }
  }
  return out
}

const tried = new Set<string>()

/** Fetches sources that have no cache yet; a failure is a warning, and the build goes on without them. */
export async function ensureSources(config: ResolvedConfig): Promise<void> {
  for (const s of config.sources ?? []) {
    const dir = sourceDir(config, s)
    if (existsSync(dir) || tried.has(dir)) continue
    tried.add(dir)
    try {
      await syncSource(config, s)
    } catch (error) {
      console.warn(`\x1b[33mSource ${sourceName(s)} is not cached and could not be fetched: ${(error as Error).message}. Run \`novon sync\` when online.\x1b[0m`)
    }
  }
}
