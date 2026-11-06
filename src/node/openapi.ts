/**
 * API reference pages from OpenAPI 3.0 and 3.1 descriptions, written as MDX
 * into `.novon/generated/<name>/` before each scan and mounted at the spec's
 * `path`: an overview page and one page per operation, grouped by tag in the
 * sidebar. Parameters and schemas are TypeTables, samples a CodeGroup of
 * fences, so search, `.md` output and llms.txt read them like any page.
 */
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import GithubSlugger from 'github-slugger'
import { labelsFor, type Labels } from '../labels.ts'
import type { OpenApiOptions, ResolvedConfig } from '../types.ts'
import { GENERATED_DIR, openapiName, SOURCES_DIR } from './mounts.ts'

type Json = any

export const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

export function specList(config: Pick<ResolvedConfig, 'openapi'>): OpenApiOptions[] {
  return config.openapi ? (Array.isArray(config.openapi) ? config.openapi : [config.openapi]) : []
}

export const isUrl = (s: string) => /^https?:\/\//i.test(s)

/** Where a spec given as a URL is cached by `novon sync`. */
export function specCachePath(config: ResolvedConfig, spec: OpenApiOptions): string {
  return join(config.root, SOURCES_DIR, `${openapiName(spec)}.spec`)
}

export function parseSpec(text: string): Json {
  const trimmed = text.trimStart()
  return trimmed.startsWith('{') ? JSON.parse(text) : Bun.YAML.parse(text)
}

export async function loadSpec(config: ResolvedConfig, spec: OpenApiOptions): Promise<Json | null> {
  const text = await readDescription(config, spec.spec, specCachePath(config, spec), 'OpenAPI description')
  return text === null ? null : parseSpec(text)
}

/**
 * A description file's text: read from the site, or for a URL from its cache,
 * fetched once when not cached yet. Null when the URL cannot be fetched.
 */
export async function readDescription(config: ResolvedConfig, ref: string, cache: string, what: string): Promise<string | null> {
  const file = isUrl(ref) ? cache : join(config.root, ref)
  if (!existsSync(file)) {
    if (!isUrl(ref)) throw new Error(`${what} ${ref} not found`)
    try {
      await fetchTo(ref, cache)
    } catch (error) {
      warnOnce(`${what}:${ref}`, `Could not fetch ${ref} (${(error as Error).message}); run \`novon sync\` when online.`)
      return null
    }
  }
  return readFile(file, 'utf8')
}

export async function fetchTo(url: string, file: string): Promise<void> {
  const res = await fetch(url, { headers: { 'user-agent': 'novon' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, await res.text())
}

export async function fetchSpec(config: ResolvedConfig, spec: OpenApiOptions): Promise<void> {
  await fetchTo(spec.spec, specCachePath(config, spec))
}

const warned = new Set<string>()
export function warnOnce(key: string, message: string) {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`\x1b[33m${message}\x1b[0m`)
}

/* ---------- References and schemas ---------- */

/** Follows a local `$ref` (`#/components/schemas/Pet`). */
export function deref(doc: Json, value: Json, seen = new Set<string>()): Json {
  let v = value
  while (v && typeof v === 'object' && typeof v.$ref === 'string') {
    if (seen.has(v.$ref) || !v.$ref.startsWith('#/')) return {}
    seen.add(v.$ref)
    v = v.$ref
      .slice(2)
      .split('/')
      .map((p: string) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
      .reduce((o: Json, k: string) => (o == null ? o : o[k]), doc)
  }
  return v ?? {}
}

export const refName = (v: Json): string | undefined => (v && typeof v.$ref === 'string' ? v.$ref.split('/').at(-1) : undefined)

/** A short type for a schema: `string<date-time>`, `Pet[]`, `"a" | "b"`, `string | null`. */
export function typeName(doc: Json, raw: Json, depth = 0): string {
  const named = refName(raw)
  const s = deref(doc, raw)
  if (depth > 4) return named ?? 'object'
  if (Array.isArray(s.enum) && s.enum.length && s.enum.length <= 8) return s.enum.map((e: unknown) => JSON.stringify(e)).join(' | ')
  for (const key of ['oneOf', 'anyOf'] as const) {
    if (Array.isArray(s[key])) return s[key].map((x: Json) => typeName(doc, x, depth + 1)).join(' | ')
  }
  if (Array.isArray(s.allOf)) return named ?? s.allOf.map((x: Json) => refName(x) ?? typeName(doc, x, depth + 1)).join(' & ')
  let types: string[] = Array.isArray(s.type) ? s.type : s.type ? [s.type] : s.properties ? ['object'] : s.items ? ['array'] : []
  const nullable = s.nullable === true || types.includes('null')
  types = types.filter((t) => t !== 'null')
  const parts = types.map((t) => {
    if (t === 'array') return `${s.items ? typeName(doc, s.items, depth + 1) : 'any'}[]`.replace(/^(.+ \| .+)\[\]$/, '($1)[]')
    if (t === 'object') return named ?? 'object'
    return s.format ? `${t}<${s.format}>` : t
  })
  const out = parts.join(' | ') || named || 'any'
  return nullable ? `${out} | null` : out
}

/** A schema with `allOf` merged into one object. */
function merged(doc: Json, raw: Json, depth = 0): Json {
  const s = deref(doc, raw)
  if (!Array.isArray(s.allOf) || depth > 6) return s
  const out: Json = { ...s, allOf: undefined, properties: { ...(s.properties ?? {}) }, required: [...(s.required ?? [])] }
  for (const part of s.allOf) {
    const m = merged(doc, part, depth + 1)
    Object.assign(out.properties, m.properties ?? {})
    out.required.push(...(m.required ?? []))
    if (!out.type && m.type) out.type = m.type
    if (!out.description && m.description) out.description = m.description
  }
  return out
}

export interface Row {
  name: string
  type: string
  required?: boolean
  deprecated?: boolean
  default?: string
  description?: string
}

/** Properties of a schema as rows, nested ones by dotted name (`owner.name`, `tags[].id`), four levels deep. */
export function schemaRows(doc: Json, raw: Json, prefix = '', depth = 0, seen: string[] = []): Row[] {
  const s = merged(doc, raw)
  if (depth > 4) return []
  const target = s.type === 'array' || (!s.properties && s.items) ? merged(doc, s.items ?? {}) : s
  const base = s.type === 'array' || (!s.properties && s.items) ? `${prefix}[]` : prefix
  const rows: Row[] = []
  const required = new Set<string>(target.required ?? [])
  for (const [key, value] of Object.entries<Json>(target.properties ?? {})) {
    const name = base ? `${base}.${key}` : key
    const ref = refName(value) ?? refName(value?.items)
    const prop = merged(doc, value)
    rows.push({
      name,
      type: typeName(doc, value),
      ...(required.has(key) ? { required: true } : {}),
      ...(prop.deprecated ? { deprecated: true } : {}),
      ...(prop.default !== undefined ? { default: JSON.stringify(prop.default) } : {}),
      ...(prop.description ? { description: prop.description } : {}),
    })
    // Nested objects, unless the same named schema is already open above (a tree, a linked list).
    const nested = prop.properties || prop.allOf || (prop.type === 'array' && merged(doc, prop.items ?? {}).properties)
    if (nested && !(ref && seen.includes(ref))) rows.push(...schemaRows(doc, value, name, depth + 1, ref ? [...seen, ref] : seen))
  }
  return rows
}

/**
 * A schema with every `$ref` resolved and `allOf` merged, in the subset the
 * schema tree reads. A named schema already open above (a tree, a linked
 * list) stays a titled leaf.
 */
export function treeSchema(doc: Json, raw: Json, seen: string[] = [], depth = 0): Json {
  const ref = refName(raw)
  if ((ref && seen.includes(ref)) || depth > 12) return { type: 'object', title: ref ?? 'object' }
  const open = ref ? [...seen, ref] : seen
  const s = merged(doc, raw)
  const out: Json = {}
  if (s.type !== undefined) out.type = s.type
  const title = ref ?? s.title
  if (title && (s.type === 'object' || s.properties || s.allOf)) out.title = title
  else if (s.title) out.title = s.title
  for (const key of ['description', 'format', 'default', 'const', 'readOnly', 'deprecated', 'nullable'] as const) if (s[key] !== undefined) out[key] = s[key]
  if (Array.isArray(s.enum)) out.enum = s.enum
  if (Array.isArray(s.required) && s.required.length) out.required = s.required
  if (s.properties && typeof s.properties === 'object') out.properties = Object.fromEntries(Object.entries<Json>(s.properties).map(([k, v]) => [k, treeSchema(doc, v, open, depth + 1)]))
  if (s.items) out.items = treeSchema(doc, s.items, open, depth + 1)
  for (const key of ['oneOf', 'anyOf'] as const) if (Array.isArray(s[key])) out[key] = s[key].map((x: Json) => treeSchema(doc, x, open, depth + 1))
  return out
}

/** A schema for a page: an expandable tree, with a TypeTable of the same rows for `.md` output and search. */
export function schemaBlock(doc: Json, raw: Json): string {
  const rows = schemaRows(doc, raw)
  if (!rows.length) return `Type: \`${typeName(doc, raw)}\``
  return `<ApiSchema schema={${JSON.stringify(treeSchema(doc, raw))}}>\n\n${fieldTable(rows)}\n\n</ApiSchema>`
}

/** An example value: the schema's own example, else one built from types. */
export function exampleOf(doc: Json, raw: Json, depth = 0, seen: string[] = []): unknown {
  const ref = refName(raw)
  // A named schema already being built (a tree, a linked list) is left out.
  if (ref && seen.includes(ref)) return undefined
  const open = ref ? [...seen, ref] : seen
  const s = merged(doc, raw)
  if (s.example !== undefined) return s.example
  if (Array.isArray(s.examples) && s.examples.length) return s.examples[0]
  if (s.default !== undefined) return s.default
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0]
  if (depth > 5) return null
  if (Array.isArray(s.oneOf) || Array.isArray(s.anyOf)) return exampleOf(doc, (s.oneOf ?? s.anyOf)[0], depth + 1, open)
  const type = Array.isArray(s.type) ? s.type.find((t: string) => t !== 'null') : (s.type ?? (s.properties ? 'object' : s.items ? 'array' : undefined))
  if (type === 'object') {
    const entries = Object.entries<Json>(s.properties ?? {}).map(([k, v]) => [k, exampleOf(doc, v, depth + 1, open)] as const)
    return Object.fromEntries(entries.filter(([, v]) => v !== undefined))
  }
  if (type === 'array') {
    const item = exampleOf(doc, s.items ?? {}, depth + 1, open)
    return item === undefined ? [] : [item]
  }
  if (type === 'integer' || type === 'number') return 0
  if (type === 'boolean') return true
  if (type === 'string') {
    const formats: Record<string, string> = { 'date-time': '2026-01-01T08:00:00Z', date: '2026-01-01', email: 'user@example.com', uri: 'https://example.com', uuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }
    return formats[s.format] ?? 'string'
  }
  return null
}

function mediaExample(doc: Json, media: Json): unknown {
  if (!media) return undefined
  if (media.example !== undefined) return media.example
  const first = media.examples && Object.values<Json>(media.examples)[0]
  if (first) return deref(doc, first).value
  return media.schema ? exampleOf(doc, media.schema) : undefined
}

/* ---------- Operations ---------- */

export interface Operation {
  method: (typeof METHODS)[number]
  path: string
  op: Json
  /** Path-level parameters merged in. */
  parameters: Json[]
  slug: string
  tag: string
  title: string
}

export function operations(doc: Json, fallbackTag: string): Operation[] {
  const out: Operation[] = []
  const slugger = new GithubSlugger()
  for (const [path, rawItem] of Object.entries<Json>(doc.paths ?? {})) {
    const item = deref(doc, rawItem)
    for (const method of METHODS) {
      const op = item[method]
      if (!op || op['x-internal'] || op['x-hidden']) continue
      const own = (op.parameters ?? []).map((p: Json) => deref(doc, p))
      const shared = (item.parameters ?? []).map((p: Json) => deref(doc, p)).filter((p: Json) => !own.some((o: Json) => o.name === p.name && o.in === p.in))
      const title = op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`
      const base = op.operationId ? kebab(op.operationId) : `${method}-${path}`
      out.push({ method, path, op, parameters: [...shared, ...own], slug: slugger.slug(base.replace(/[{}]/g, '')), tag: op.tags?.[0] ?? fallbackTag, title })
    }
  }
  return out
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase()

/* ---------- MDX ---------- */

/** Text from the description, safe as MDX: no JSX or expressions. */
export function mdxText(s: string | undefined): string {
  if (!s) return ''
  return s
    .replace(/\r\n/g, '\n')
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => (i % 2 ? part : part.replace(/[{}]/g, (c) => `\\${c}`).replace(/</g, '&lt;')))
    .join('')
    .trim()
}

/** A JSX attribute value; quoted text when it can be, an expression otherwise (JSX strings have no escapes). */
export const attr = (s: string) => (!/["\\]/.test(s) ? `"${s}"` : !/['\\\n]/.test(s) ? `{'${s}'}` : `{${JSON.stringify(s)}}`)
export const yaml = (s: string) => JSON.stringify(s)

export function fieldTable(rows: Row[]): string {
  if (!rows.length) return ''
  const fields = rows.map((r) => {
    const props = [`name=${attr(r.name)}`, `type=${attr(r.type)}`, r.required ? 'required' : '', r.deprecated ? 'deprecated' : '', r.default ? `default=${attr(r.default)}` : ''].filter(Boolean).join(' ')
    const text = mdxText(r.description)
    return text ? `  <Field ${props}>\n\n${text.replace(/^/gm, '  ').replace(/^ +$/gm, '')}\n\n  </Field>` : `  <Field ${props} />`
  })
  return `<TypeTable>\n${fields.join('\n')}\n</TypeTable>`
}

export function fence(lang: string, value: string, meta = ''): string {
  const ticks = value.includes('```') ? '````' : '```'
  return `${ticks}${lang}${meta ? ` ${meta}` : ''}\n${value}\n${ticks}`
}

function security(doc: Json, op: Json): { headers: Record<string, string>; query: Record<string, string>; text: string[] } {
  const reqs: Json[] = op.security ?? doc.security ?? []
  const schemes = doc.components?.securitySchemes ?? {}
  const headers: Record<string, string> = {}
  const query: Record<string, string> = {}
  const text: string[] = []
  const first = reqs.find((r) => Object.keys(r).length) ?? {}
  for (const [name, scopes] of Object.entries<string[]>(first)) {
    const s = deref(doc, schemes[name])
    if (!s?.type) continue
    const scopeText = scopes?.length ? ` Scopes: ${scopes.map((x) => `\`${x}\``).join(', ')}.` : ''
    if (s.type === 'http' && /^bearer$/i.test(s.scheme)) {
      headers.Authorization = 'Bearer $TOKEN'
      text.push(`- **${name}**: a bearer token${s.bearerFormat ? ` (${s.bearerFormat})` : ''} in the \`Authorization\` header.${scopeText}`)
    } else if (s.type === 'http' && /^basic$/i.test(s.scheme)) {
      headers.Authorization = 'Basic $CREDENTIALS'
      text.push(`- **${name}**: HTTP basic authentication.${scopeText}`)
    } else if (s.type === 'apiKey') {
      if (s.in === 'header') headers[s.name] = '$API_KEY'
      if (s.in === 'query') query[s.name] = '$API_KEY'
      text.push(`- **${name}**: an API key in the \`${s.name}\` ${s.in === 'query' ? 'query parameter' : s.in === 'cookie' ? 'cookie' : 'header'}.${scopeText}`)
    } else if (s.type === 'oauth2' || s.type === 'openIdConnect') {
      headers.Authorization = 'Bearer $TOKEN'
      text.push(`- **${name}**: ${s.type === 'oauth2' ? 'OAuth 2.0' : 'OpenID Connect'} access token in the \`Authorization\` header.${scopeText}`)
    } else text.push(`- **${name}**: ${s.type}.${scopeText}`)
    if (s.description) text.push(`  ${mdxText(s.description).replace(/\n/g, '\n  ')}`)
  }
  return { headers, query, text }
}

function serverUrl(doc: Json, spec: OpenApiOptions): string {
  if (spec.server) return spec.server.replace(/\/$/, '')
  const s = doc.servers?.[0]
  if (!s?.url) return 'https://api.example.com'
  return String(s.url)
    .replace(/\{(\w+)\}/g, (_m: string, k: string) => s.variables?.[k]?.default ?? k)
    .replace(/\/$/, '')
}

export function samples(doc: Json, spec: OpenApiOptions, o: Operation): string {
  const server = serverUrl(doc, spec)
  const auth = security(doc, o.op)
  const query = { ...auth.query }
  for (const p of o.parameters) if (p.in === 'query' && p.required) query[p.name] = String(p.example ?? exampleOf(doc, p.schema ?? {}) ?? '')
  const path = o.path.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const p = o.parameters.find((x) => x.in === 'path' && x.name === k)
    const v = p?.example ?? (p?.schema ? exampleOf(doc, p.schema) : undefined)
    return v === undefined || v === 'string' ? `{${k}}` : encodeURIComponent(String(v))
  })
  const qs = Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${v.startsWith('$') ? v : encodeURIComponent(v)}`).join('&')
  const url = `${server}${path}${qs ? `?${qs}` : ''}`
  const body = deref(doc, o.op.requestBody)
  const mediaType = body?.content ? (Object.keys(body.content).find((k) => k.includes('json')) ?? Object.keys(body.content)[0]) : undefined
  const example = mediaType ? mediaExample(doc, body.content[mediaType]) : undefined
  const json = example !== undefined && mediaType?.includes('json') ? JSON.stringify(example, null, 2) : undefined
  const headers: Record<string, string> = { ...auth.headers, ...(mediaType ? { 'Content-Type': mediaType } : {}) }
  for (const p of o.parameters) if (p.in === 'header' && p.required) headers[p.name] = String(p.example ?? exampleOf(doc, p.schema ?? {}) ?? '')
  const M = o.method.toUpperCase()
  const out: string[] = []
  const env = (v: string) => v.replace(/\$(\w+)/g, (_m, k: string) => `\${process.env.${k}}`)
  for (const lang of spec.samples ?? ['curl', 'javascript', 'python']) {
    if (lang === 'curl') {
      const lines = [`curl${M === 'GET' ? '' : ` -X ${M}`} "${url}"`, ...Object.entries(headers).map(([k, v]) => `  -H "${k}: ${v}"`)]
      if (json) lines.push(`  -d '${json.replace(/'/g, "'\\''")}'`)
      out.push(fence('sh', lines.join(' \\\n'), 'title="curl"'))
    } else if (lang === 'javascript') {
      const opts = [M === 'GET' ? '' : `  method: '${M}',`, Object.keys(headers).length ? `  headers: {\n${Object.entries(headers).map(([k, v]) => `    '${k}': \`${env(v)}\`,`).join('\n')}\n  },` : '', json ? `  body: JSON.stringify(${json.replace(/\n/g, '\n  ')}),` : ''].filter(Boolean)
      out.push(fence('js', `const res = await fetch(\`${env(url)}\`${opts.length ? `, {\n${opts.join('\n')}\n}` : ''})\nconst data = await res.json()`, 'title="JavaScript"'))
    } else if (lang === 'python') {
      const py = (v: string) => (v.includes('$') ? `f"${v.replace(/\$(\w+)/g, (_m, k: string) => `{os.environ['${k}']}`)}"` : JSON.stringify(v))
      const args = [Object.keys(headers).length ? `    headers={\n${Object.entries(headers).map(([k, v]) => `        "${k}": ${py(v)},`).join('\n')}\n    },` : '', json ? `    json=${pyLiteral(example)},` : ''].filter(Boolean)
      const needsOs = Object.values(headers).some((v) => v.includes('$')) || url.includes('$')
      out.push(fence('python', `${needsOs ? 'import os\n' : ''}import requests\n\nres = requests.${o.method}(\n    ${py(url)},\n${args.join('\n')}\n)\ndata = res.json()`.replace(/,\n\n\)/, ',\n)').replace(/\(\n    (.+),\n\n\)/, '($1)'), 'title="Python"'))
    } else if (lang === 'go') {
      const lines = [`body := ${json ? `strings.NewReader(\`${json}\`)` : 'http.NoBody'}`, `req, _ := http.NewRequest("${M}", "${url}", body)`, ...Object.entries(headers).map(([k, v]) => `req.Header.Set("${k}", ${v.includes('$') ? `"${v.split('$')[0]}" + os.Getenv("${v.split('$')[1]}")` : JSON.stringify(v)})`), 'res, err := http.DefaultClient.Do(req)']
      out.push(fence('go', lines.join('\n'), 'title="Go"'))
    }
  }
  return `<CodeGroup storageKey="novon:api-sample">\n\n${out.join('\n\n')}\n\n</CodeGroup>`
}

function pyLiteral(v: unknown, indent = '    '): string {
  return JSON.stringify(v, null, 4)
    .replace(/\btrue\b/g, 'True')
    .replace(/\bfalse\b/g, 'False')
    .replace(/\bnull\b/g, 'None')
    .replace(/\n/g, `\n${indent}`)
}

const STATUS: Record<string, string> = { '200': 'OK', '201': 'Created', '202': 'Accepted', '204': 'No Content', '301': 'Moved Permanently', '304': 'Not Modified', '400': 'Bad Request', '401': 'Unauthorized', '403': 'Forbidden', '404': 'Not Found', '409': 'Conflict', '422': 'Unprocessable Content', '429': 'Too Many Requests', '500': 'Internal Server Error', default: 'Default' }

export function operationPage(doc: Json, spec: OpenApiOptions, o: Operation, t: Labels): string {
  const { op } = o
  const out: string[] = []
  // The first sentence is the page description; the body repeats the description only when it says more.
  const description = op.description && op.description !== op.summary && op.description.trim() !== firstSentence(op.description) ? op.description : ''
  out.push(
    '---',
    `title: ${yaml(o.title)}`,
    ...(op.summary && op.description ? [`description: ${yaml(firstSentence(op.description))}`] : []),
    `badge: ${o.method.toUpperCase()}`,
    '---',
    '',
    `<ApiEndpoint method=${attr(o.method)} path=${attr(o.path)} server=${attr(serverUrl(doc, spec))}${op.deprecated ? ' deprecated' : ''} />`,
    '',
  )
  if (description) out.push(mdxText(description), '')
  const auth = security(doc, op)
  if (auth.text.length) out.push(`## ${t.apiAuthentication}`, '', ...auth.text, '')
  const groups: [string, string][] = [
    ['path', t.apiPathParameters],
    ['query', t.apiQueryParameters],
    ['header', t.apiHeaderParameters],
    ['cookie', t.apiCookieParameters],
  ]
  for (const [where, label] of groups) {
    const params = o.parameters.filter((p) => p.in === where)
    if (!params.length) continue
    const rows: Row[] = params.map((p) => ({
      name: p.name,
      type: typeName(doc, p.schema ?? (p.content ? Object.values<Json>(p.content)[0]?.schema : {}) ?? {}),
      ...(p.required ? { required: true } : {}),
      ...(p.deprecated ? { deprecated: true } : {}),
      ...(p.schema && deref(doc, p.schema).default !== undefined ? { default: JSON.stringify(deref(doc, p.schema).default) } : {}),
      ...(p.description ? { description: p.description } : {}),
    }))
    out.push(`## ${label}`, '', fieldTable(rows), '')
  }
  const body = deref(doc, op.requestBody)
  if (body?.content) {
    out.push(`## ${t.apiRequestBody}`, '')
    if (body.description) out.push(mdxText(body.description), '')
    for (const [media, value] of Object.entries<Json>(body.content)) {
      out.push(`\`${media}\`${body.required ? ` · ${t.required}` : ''}`, '')
      if (value.schema) out.push(schemaBlock(doc, value.schema), '')
    }
  }
  out.push(`## ${t.apiExamples}`, '', samples(doc, spec, o), '')
  const responses = Object.entries<Json>(op.responses ?? {})
  if (responses.length) {
    out.push(`## ${t.apiResponses}`, '')
    for (const [code, raw] of responses) {
      const r = deref(doc, raw)
      out.push(`### ${code} ${STATUS[code] ?? ''}`.trimEnd(), '')
      if (r.description) out.push(mdxText(r.description), '')
      const headers = Object.entries<Json>(r.headers ?? {})
      if (headers.length) {
        out.push(fieldTable(headers.map(([name, h]) => {
          const hd = deref(doc, h)
          return { name, type: typeName(doc, hd.schema ?? {}), ...(hd.description ? { description: hd.description } : {}) }
        })), '')
      }
      const media = r.content ? (Object.keys(r.content).find((k) => k.includes('json')) ?? Object.keys(r.content)[0]) : undefined
      if (media) {
        const value = r.content[media]
        if (value.schema && schemaRows(doc, value.schema).length) out.push(schemaBlock(doc, value.schema), '')
        const example = mediaExample(doc, value)
        if (example !== undefined) out.push(fence(media.includes('json') ? 'json' : 'text', typeof example === 'string' ? example : JSON.stringify(example, null, 2), `title=${attr(`${code} · ${media}`)}`), '')
      }
    }
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

export const firstSentence = (s: string) => s.replace(/\s+/g, ' ').trim().split(/(?<=[.!?。])\s/)[0].slice(0, 200)

export function overviewPage(doc: Json, spec: OpenApiOptions, ops: Operation[], t: Labels, prefix: string): string {
  const info = doc.info ?? {}
  const title = spec.title ?? info.title ?? 'API reference'
  const out: string[] = ['---', `title: ${yaml(title)}`, ...(info.summary || info.description ? [`description: ${yaml(info.summary ?? firstSentence(info.description))}`] : []), 'icon: Braces', '---', '']
  if (info.version) out.push(`<Badge>${mdxText(String(info.version))}</Badge>`, '')
  if (info.description) out.push(mdxText(info.description), '')
  const servers: Json[] = doc.servers ?? []
  if (servers.length) out.push(`## ${t.apiServers}`, '', ...servers.map((s) => `- \`${s.url}\`${s.description ? `: ${mdxText(s.description)}` : ''}`), '')
  const auth = security(doc, {})
  if (auth.text.length) out.push(`## ${t.apiAuthentication}`, '', ...auth.text, '')
  const tags = [...new Set(ops.map((o) => o.tag))]
  const tagInfo = (name: string) => (doc.tags ?? []).find((x: Json) => x.name === name)
  for (const tag of tags) {
    out.push(`## ${tag}`, '')
    const d = tagInfo(tag)?.description
    if (d) out.push(mdxText(d), '')
    for (const o of ops.filter((x) => x.tag === tag)) out.push(`- <ApiMethod method=${attr(o.method)} /> [${mdxText(o.title).replace(/[[\]]/g, '\\$&')}](${prefix === '/' ? '' : prefix}/${o.slug})`)
    out.push('')
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

/** The sidebar: the overview first, then one group per tag in the description's tag order. */
export function metaFor(doc: Json, ops: Operation[], title: string): Json {
  const order = (doc.tags ?? []).map((x: Json) => x.name)
  const tags = [...new Set(ops.map((o) => o.tag))].sort((a, b) => (order.indexOf(a) + 1 || 1e9) - (order.indexOf(b) + 1 || 1e9))
  return { title, pages: tags.map((tag) => ({ group: tag, pages: ops.filter((o) => o.tag === tag).map((o) => o.slug) })) }
}

export async function writeIfChanged(file: string, text: string) {
  if (existsSync(file) && (await readFile(file, 'utf8')) === text) return
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, text)
}

/** Writes every spec's pages, leaving unchanged files untouched (dev reloads only what changed). */
export async function writeOpenApiPages(config: ResolvedConfig): Promise<void> {
  const t = labelsFor(config.lang, config.theme.labels)
  for (const spec of specList(config)) {
    const doc = await loadSpec(config, spec)
    const dir = join(config.root, GENERATED_DIR, openapiName(spec))
    if (!doc) continue
    if (!doc.openapi || !/^3\./.test(String(doc.openapi))) throw new Error(`${spec.spec} is not an OpenAPI 3 description (openapi: ${doc.openapi ?? doc.swagger ?? 'missing'})`)
    const ops = operations(doc, t.apiEndpoints)
    const files = new Map<string, string>()
    const prefix = spec.path.replace(/\/+$/, '') || '/'
    files.set('index.mdx', overviewPage(doc, spec, ops, t, prefix))
    for (const o of ops) files.set(`${o.slug}.mdx`, operationPage(doc, spec, o, t))
    files.set('_meta.json', `${JSON.stringify(metaFor(doc, ops, spec.title ?? doc.info?.title ?? 'API'), null, 2)}\n`)
    for (const [name, text] of files) await writeIfChanged(join(dir, name), text)
    for (const name of await readdir(dir).catch(() => [] as string[])) if (!files.has(name)) await rm(join(dir, name), { force: true })
  }
}
