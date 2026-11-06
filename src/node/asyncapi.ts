/**
 * Event API reference pages from AsyncAPI 2.x and 3.x descriptions, written
 * as MDX into `.novon/generated/<name>/` before each scan and mounted at the
 * description's `path`: an overview page and one page per operation, grouped
 * by tag (or channel) in the sidebar. Payloads and headers are schema trees
 * with a TypeTable beside them, and examples are fences, so search, `.md`
 * output and llms.txt read them.
 */
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import GithubSlugger from 'github-slugger'
import { labelsFor, type Labels } from '../labels.ts'
import type { AsyncApiOptions, ResolvedConfig } from '../types.ts'
import { asyncapiName, GENERATED_DIR, SOURCES_DIR } from './mounts.ts'
import { attr, deref, exampleOf, fence, fieldTable, firstSentence, mdxText, parseSpec, readDescription, refName, schemaBlock, typeName, writeIfChanged, yaml, type Row } from './openapi.ts'

type Json = any

export const asyncapiList = (config: Pick<ResolvedConfig, 'asyncapi'>): AsyncApiOptions[] => (config.asyncapi ? (Array.isArray(config.asyncapi) ? config.asyncapi : [config.asyncapi]) : [])

export const asyncapiCachePath = (config: ResolvedConfig, spec: AsyncApiOptions) => join(config.root, SOURCES_DIR, `${asyncapiName(spec)}.spec`)

export interface AsyncMessage {
  name: string
  message: Json
}

export interface AsyncOperation {
  id: string
  /** `send` / `receive` (3.x) or `publish` / `subscribe` (2.x), as written. */
  action: string
  address: string
  channel: Json
  op: Json
  messages: AsyncMessage[]
  group: string
  slug: string
  title: string
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_\s/.]+/g, '-').replace(/[{}]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase()

/** A message, or a 2.x `oneOf` of messages, as a list. */
function messagesOf(doc: Json, raw: Json, fallback: string): AsyncMessage[] {
  if (!raw) return []
  const list: Json[] = Array.isArray(raw) ? raw : Array.isArray(deref(doc, raw).oneOf) ? deref(doc, raw).oneOf : [raw]
  return list.map((m, i) => {
    const message = deref(doc, m)
    return { name: message.name ?? message.messageId ?? refName(m) ?? (list.length > 1 ? `${fallback}${i + 1}` : fallback), message }
  })
}

export function asyncOperations(doc: Json, fallbackGroup: string): AsyncOperation[] {
  const major = Number(String(doc.asyncapi ?? '').split('.')[0])
  const out: Omit<AsyncOperation, 'slug'>[] = []
  if (major === 2) {
    for (const [address, raw] of Object.entries<Json>(doc.channels ?? {})) {
      const channel = deref(doc, raw)
      for (const action of ['publish', 'subscribe'] as const) {
        const op = channel[action]
        if (!op) continue
        const id = op.operationId ?? `${action} ${address}`
        out.push({ id, action, address, channel, op, messages: messagesOf(doc, op.message, `${op.operationId ?? action}Message`), group: op.tags?.[0]?.name ?? address, title: op.summary ?? op.operationId ?? `${action} ${address}` })
      }
    }
  } else {
    for (const [id, raw] of Object.entries<Json>(doc.operations ?? {})) {
      const op = deref(doc, raw)
      const channel = deref(doc, op.channel)
      const address = channel.address ?? refName(op.channel) ?? id
      const own = Array.isArray(op.messages) && op.messages.length ? op.messages : Object.values<Json>(channel.messages ?? {})
      const messages = own.map((m: Json) => {
        const message = deref(doc, m)
        return { name: message.name ?? refName(m) ?? id, message }
      })
      out.push({ id, action: op.action ?? 'send', address, channel, op, messages, group: op.tags?.[0]?.name ?? address, title: op.summary ?? op.title ?? id })
    }
  }
  const slugger = new GithubSlugger()
  return out.map((o) => ({ ...o, group: o.group || fallbackGroup, slug: slugger.slug(kebab(o.id) || 'operation') }))
}

/** Sidebar badges: short, so they fit beside HTTP methods. */
const ACTION_BADGE: Record<string, string> = { send: 'SEND', receive: 'RECV', publish: 'PUB', subscribe: 'SUB' }

/** A payload schema; 3.x may wrap it with its format. */
const payloadSchema = (p: Json) => (p && p.schemaFormat && p.schema ? p.schema : p)

function serverList(doc: Json): { name: string; url: string; protocol?: string; description?: string }[] {
  return Object.entries<Json>(doc.servers ?? {}).map(([name, raw]) => {
    const s = deref(doc, raw)
    const url = s.url ?? `${s.host ?? ''}${s.pathname ?? ''}`
    const filled = String(url).replace(/\{(\w+)\}/g, (_m: string, k: string) => s.variables?.[k]?.default ?? `{${k}}`)
    return { name, url: filled, protocol: s.protocol, description: s.description }
  })
}

function serverUrl(doc: Json): string | undefined {
  const s = serverList(doc)[0]
  if (!s) return undefined
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s.url) || !s.protocol ? s.url : `${s.protocol}://${s.url}`
}

function parameterRows(doc: Json, params: Json): Row[] {
  return Object.entries<Json>(params ?? {}).map(([name, raw]) => {
    const p = deref(doc, raw)
    const schema = p.schema ?? (p.enum ? { type: 'string', enum: p.enum } : { type: 'string' })
    const def = p.default ?? p.schema?.default
    return { name, type: typeName(doc, schema), required: true, ...(def !== undefined ? { default: JSON.stringify(def) } : {}), ...(p.description ? { description: p.description } : {}) }
  })
}

function messageSection(doc: Json, m: AsyncMessage, t: Labels): string[] {
  const msg = m.message
  const out: string[] = [`### ${mdxText(msg.title ?? m.name)}`, '']
  const contentType = msg.contentType ?? doc.defaultContentType
  if (contentType) out.push(`\`${contentType}\``, '')
  if (msg.summary) out.push(mdxText(msg.summary), '')
  if (msg.description && msg.description !== msg.summary) out.push(mdxText(msg.description), '')
  const headers = msg.headers ? payloadSchema(deref(doc, msg.headers)) : undefined
  if (headers) out.push(`#### ${t.apiMessageHeaders}`, '', schemaBlock(doc, headers), '')
  const payload = msg.payload ? payloadSchema(deref(doc, msg.payload)) : undefined
  if (payload) {
    out.push(`#### ${t.apiPayload}`, '', schemaBlock(doc, payload), '')
    const given = Array.isArray(msg.examples) ? msg.examples.find((e: Json) => e?.payload !== undefined)?.payload : undefined
    const example = given ?? exampleOf(doc, payload)
    if (example !== undefined && example !== null) {
      const json = !contentType || contentType.includes('json')
      out.push(fence(json ? 'json' : 'text', typeof example === 'string' ? example : JSON.stringify(example, null, 2), `title=${attr(`${m.name} · ${contentType ?? 'application/json'}`)}`), '')
    }
  }
  return out
}

export function asyncOperationPage(doc: Json, o: AsyncOperation, t: Labels): string {
  const { op } = o
  const description = op.description && op.description.trim() !== firstSentence(op.description) ? op.description : ''
  const out: string[] = [
    '---',
    `title: ${yaml(o.title)}`,
    ...(op.description ? [`description: ${yaml(firstSentence(op.description))}`] : []),
    `badge: ${ACTION_BADGE[o.action] ?? o.action.toUpperCase()}`,
    '---',
    '',
    `<ApiEndpoint method=${attr(o.action)} path=${attr(o.address)}${serverUrl(doc) ? ` server=${attr(serverUrl(doc)!.replace(/\/$/, '') + (o.address.startsWith('/') ? '' : '/'))}` : ''}${op.deprecated ? ' deprecated' : ''} />`,
    '',
  ]
  if (description) out.push(mdxText(description), '')
  if (o.channel.description) out.push(mdxText(o.channel.description), '')
  const params = parameterRows(doc, o.channel.parameters)
  if (params.length) out.push(`## ${t.apiChannelParameters}`, '', fieldTable(params), '')
  if (o.messages.length) {
    out.push(`## ${t.apiMessages}`, '')
    for (const m of o.messages) out.push(...messageSection(doc, m, t))
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

export function asyncOverviewPage(doc: Json, spec: AsyncApiOptions, ops: AsyncOperation[], t: Labels, prefix: string): string {
  const info = doc.info ?? {}
  const title = spec.title ?? info.title ?? 'Event API'
  const out: string[] = ['---', `title: ${yaml(title)}`, ...(info.description ? [`description: ${yaml(firstSentence(info.description))}`] : []), 'icon: Bolt', '---', '']
  if (info.version) out.push(`<Badge>${mdxText(String(info.version))}</Badge>`, '')
  if (info.description) out.push(mdxText(info.description), '')
  const servers = serverList(doc)
  if (servers.length) out.push(`## ${t.apiServers}`, '', ...servers.map((s) => `- **${mdxText(s.name)}**: \`${s.url}\`${s.protocol ? ` (${s.protocol})` : ''}${s.description ? `. ${mdxText(s.description)}` : ''}`), '')
  out.push(`## ${t.apiOperations}`, '')
  for (const group of [...new Set(ops.map((o) => o.group))]) {
    out.push(`### ${mdxText(group)}`, '')
    for (const o of ops.filter((x) => x.group === group)) out.push(`- <ApiMethod method=${attr(o.action)} /> [${mdxText(o.title).replace(/[[\]]/g, '\\$&')}](${prefix === '/' ? '' : prefix}/${o.slug}) \`${o.address}\``)
    out.push('')
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

export async function loadAsyncApi(config: ResolvedConfig, spec: AsyncApiOptions): Promise<Json | null> {
  const text = await readDescription(config, spec.spec, asyncapiCachePath(config, spec), 'AsyncAPI description')
  if (text === null) return null
  const doc = parseSpec(text)
  if (!doc?.asyncapi || !/^[23]\./.test(String(doc.asyncapi))) throw new Error(`${spec.spec} is not an AsyncAPI 2 or 3 description (asyncapi: ${doc?.asyncapi ?? 'missing'})`)
  return doc
}

export async function writeAsyncApiPages(config: ResolvedConfig): Promise<void> {
  const t = labelsFor(config.lang, config.theme.labels)
  for (const spec of asyncapiList(config)) {
    const doc = await loadAsyncApi(config, spec)
    if (!doc) continue
    const dir = join(config.root, GENERATED_DIR, asyncapiName(spec))
    const ops = asyncOperations(doc, t.apiOperations)
    const prefix = spec.path.replace(/\/+$/, '') || '/'
    const files = new Map<string, string>()
    files.set('index.mdx', asyncOverviewPage(doc, spec, ops, t, prefix))
    for (const o of ops) files.set(`${o.slug}.mdx`, asyncOperationPage(doc, o, t))
    const groups = [...new Set(ops.map((o) => o.group))]
    files.set('_meta.json', `${JSON.stringify({ title: spec.title ?? doc.info?.title ?? 'Events', pages: groups.map((g) => ({ group: g, pages: ops.filter((o) => o.group === g).map((o) => o.slug) })) }, null, 2)}\n`)
    for (const [name, text] of files) await writeIfChanged(join(dir, name), text)
    for (const name of await readdir(dir).catch(() => [] as string[])) if (!files.has(name)) await rm(join(dir, name), { force: true })
  }
}
