/**
 * GraphQL reference pages from a schema (SDL) or an introspection result,
 * written as MDX into `.novon/generated/<name>/` before each scan and mounted
 * at the schema's `path`: an overview, one page per query, mutation and
 * subscription, and one page per named type under `types/`. Arguments and
 * fields are TypeTables and examples are fences, so search, `.md` output and
 * llms.txt read them.
 */
import { readdir, rm } from 'node:fs/promises'
import { join, relative } from 'node:path'
import GithubSlugger from 'github-slugger'
import {
  buildClientSchema,
  buildSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  type GraphQLArgument,
  type GraphQLField,
  type GraphQLInputType,
  type GraphQLNamedType,
  type GraphQLSchema,
  type GraphQLType,
} from 'graphql'
import { labelsFor, type Labels } from '../labels.ts'
import type { GraphqlOptions, ResolvedConfig } from '../types.ts'
import { GENERATED_DIR, graphqlName, SOURCES_DIR } from './mounts.ts'
import { attr, fence, fieldTable, firstSentence, mdxText, readDescription, writeIfChanged, yaml, type Row } from './openapi.ts'

export const graphqlList = (config: Pick<ResolvedConfig, 'graphql'>): GraphqlOptions[] => (config.graphql ? (Array.isArray(config.graphql) ? config.graphql : [config.graphql]) : [])

export const graphqlCachePath = (config: ResolvedConfig, spec: GraphqlOptions) => join(config.root, SOURCES_DIR, `${graphqlName(spec)}.schema`)

/** A schema from SDL, or from an introspection result (`{ data: { __schema } }` or `{ __schema }`). */
export function parseGraphqlSchema(text: string, file = 'schema'): GraphQLSchema {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    const json = JSON.parse(trimmed)
    const result = json.data ?? json
    if (!result.__schema) throw new Error(`${file} is JSON but not an introspection result (no __schema)`)
    return buildClientSchema(result)
  }
  return buildSchema(text, { assumeValidSDL: true })
}

export type GraphqlKind = 'query' | 'mutation' | 'subscription'

export interface GraphqlOperation {
  kind: GraphqlKind
  field: GraphQLField<unknown, unknown>
  slug: string
}

const BADGE: Record<GraphqlKind, string> = { query: 'QUERY', mutation: 'MUT', subscription: 'SUB' }

export function graphqlOperations(schema: GraphQLSchema): GraphqlOperation[] {
  const slugger = new GithubSlugger()
  const out: GraphqlOperation[] = []
  const roots: [GraphqlKind, ReturnType<GraphQLSchema['getQueryType']>][] = [
    ['query', schema.getQueryType()],
    ['mutation', schema.getMutationType()],
    ['subscription', schema.getSubscriptionType()],
  ]
  for (const [kind, type] of roots) {
    if (!type) continue
    for (const field of Object.values(type.getFields())) out.push({ kind, field, slug: slugger.slug(typeSlug(field.name)) })
  }
  return out
}

const ROOT_NAMES = (schema: GraphQLSchema) => new Set([schema.getQueryType()?.name, schema.getMutationType()?.name, schema.getSubscriptionType()?.name].filter(Boolean) as string[])

/** Named types worth a page: everything but built-ins, introspection types and the root types. */
export function graphqlTypes(schema: GraphQLSchema): GraphQLNamedType[] {
  const roots = ROOT_NAMES(schema)
  const builtin = new Set(['String', 'Int', 'Float', 'Boolean', 'ID'])
  return Object.values(schema.getTypeMap())
    .filter((t) => !t.name.startsWith('__') && !roots.has(t.name) && !builtin.has(t.name))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const typeSlug = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

export function kindOf(t: GraphQLNamedType): string {
  if (isObjectType(t)) return 'type'
  if (isInterfaceType(t)) return 'interface'
  if (isUnionType(t)) return 'union'
  if (isEnumType(t)) return 'enum'
  if (isInputObjectType(t)) return 'input'
  return 'scalar'
}

function argRow(a: GraphQLArgument): Row {
  return {
    name: a.name,
    type: String(a.type),
    ...(isNonNullType(a.type) && a.defaultValue === undefined ? { required: true } : {}),
    ...(a.deprecationReason ? { deprecated: true } : {}),
    ...(a.defaultValue !== undefined ? { default: JSON.stringify(a.defaultValue) } : {}),
    ...(a.description ? { description: a.description } : {}),
  }
}

function fieldRows(t: GraphQLNamedType): Row[] {
  if (isObjectType(t) || isInterfaceType(t)) {
    return Object.values(t.getFields()).map((f) => {
      const args = f.args.length ? `Arguments: ${f.args.map((a) => `\`${a.name}: ${String(a.type)}\``).join(', ')}.` : ''
      const description = [f.description ?? '', args].filter(Boolean).join('\n\n')
      return {
        name: f.name,
        type: String(f.type),
        ...(isNonNullType(f.type) ? { required: true } : {}),
        ...(f.deprecationReason ? { deprecated: true } : {}),
        ...(description ? { description } : {}),
      }
    })
  }
  if (isInputObjectType(t)) {
    return Object.values(t.getFields()).map((f) => ({
      name: f.name,
      type: String(f.type),
      ...(isNonNullType(f.type) && f.defaultValue === undefined ? { required: true } : {}),
      ...(f.deprecationReason ? { deprecated: true } : {}),
      ...(f.defaultValue !== undefined ? { default: JSON.stringify(f.defaultValue) } : {}),
      ...(f.description ? { description: f.description } : {}),
    }))
  }
  return []
}

/* ---------- Examples ---------- */

function exampleValue(type: GraphQLInputType, depth = 0): unknown {
  if (isNonNullType(type)) return exampleValue(type.ofType as GraphQLInputType, depth)
  if (isListType(type)) return [exampleValue(type.ofType as GraphQLInputType, depth)]
  if (isEnumType(type)) return type.getValues()[0]?.value ?? null
  if (isInputObjectType(type)) {
    if (depth > 3) return {}
    const fields = Object.values(type.getFields())
    const wanted = fields.filter((f) => isNonNullType(f.type) && f.defaultValue === undefined)
    return Object.fromEntries((wanted.length ? wanted : fields.slice(0, 3)).map((f) => [f.name, exampleValue(f.type, depth + 1)]))
  }
  if (isScalarType(type)) {
    const scalars: Record<string, unknown> = { ID: '1', String: 'string', Int: 0, Float: 0, Boolean: true, DateTime: '2026-01-01T08:00:00Z', Date: '2026-01-01', URL: 'https://example.com', JSON: {} }
    return scalars[type.name] ?? 'string'
  }
  return null
}

/** A selection set: leaf fields that take no required arguments, one level of nested objects, eight fields a level. */
function selection(type: GraphQLType, indent: string, depth = 0): string {
  const named = getNamedType(type)
  if (!named || isScalarType(named) || isEnumType(named)) return ''
  if (isUnionType(named)) {
    const members = named.getTypes().slice(0, 4)
    const lines = [`${indent}  __typename`, ...members.map((m) => `${indent}  ... on ${m.name} {\n${leafLines(m, `${indent}    `)}\n${indent}  }`)]
    return ` {\n${lines.join('\n')}\n${indent}}`
  }
  if (!isObjectType(named) && !isInterfaceType(named)) return ''
  const lines: string[] = []
  for (const f of Object.values(named.getFields())) {
    if (lines.length >= 8) break
    if (f.deprecationReason) continue
    if (f.args.some((a) => isNonNullType(a.type) && a.defaultValue === undefined)) continue
    const inner = getNamedType(f.type)
    if (isScalarType(inner) || isEnumType(inner)) lines.push(`${indent}  ${f.name}`)
    else if (depth < 1) {
      const sub = selection(f.type, `${indent}  `, depth + 1)
      if (sub) lines.push(`${indent}  ${f.name}${sub}`)
    }
  }
  if (!lines.length) lines.push(`${indent}  __typename`)
  return ` {\n${lines.join('\n')}\n${indent}}`
}

function leafLines(t: GraphQLNamedType, indent: string): string {
  if (!isObjectType(t) && !isInterfaceType(t)) return `${indent}__typename`
  const leaves = Object.values(t.getFields())
    .filter((f) => {
      const n = getNamedType(f.type)
      return (isScalarType(n) || isEnumType(n)) && !f.args.some((a) => isNonNullType(a.type))
    })
    .slice(0, 4)
  return leaves.length ? leaves.map((f) => `${indent}${f.name}`).join('\n') : `${indent}__typename`
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function operationExample(o: GraphqlOperation): { document: string; variables: Record<string, unknown> } {
  const args = o.field.args.filter((a) => isNonNullType(a.type) || o.field.args.length <= 3)
  const vars = args.map((a) => `$${a.name}: ${String(a.type)}`).join(', ')
  const call = args.length ? `(${args.map((a) => `${a.name}: $${a.name}`).join(', ')})` : ''
  const document = `${o.kind} ${capitalize(o.field.name)}${vars ? `(${vars})` : ''} {\n  ${o.field.name}${call}${selection(o.field.type, '  ')}\n}`
  const variables = Object.fromEntries(args.map((a) => [a.name, a.defaultValue !== undefined ? a.defaultValue : exampleValue(a.type)]))
  return { document, variables }
}

/* ---------- Pages ---------- */

const KIND_LABEL = (t: Labels): Record<GraphqlKind, string> => ({ query: t.apiQueries, mutation: t.apiMutations, subscription: t.apiSubscriptions })

/** A link to a named type's page, or plain code for built-in scalars. */
function typeLink(schema: GraphQLSchema, type: GraphQLType, prefix: string): string {
  const named = getNamedType(type)
  const listed = graphqlTypes(schema).some((t) => t.name === named.name)
  return listed ? `[\`${String(type)}\`](${prefix}/types/${typeSlug(named.name)})` : `\`${String(type)}\``
}

export function graphqlOperationPage(schema: GraphQLSchema, spec: GraphqlOptions, o: GraphqlOperation, t: Labels, prefix: string): string {
  const f = o.field
  const description = f.description && f.description.trim() !== firstSentence(f.description) ? f.description : ''
  const signature = `${f.name}${f.args.length ? `(${f.args.map((a) => `${a.name}: ${String(a.type)}`).join(', ')})` : ''}: ${String(f.type)}`
  const out: string[] = [
    '---',
    `title: ${yaml(f.name)}`,
    ...(f.description ? [`description: ${yaml(firstSentence(f.description))}`] : []),
    `badge: ${BADGE[o.kind]}`,
    '---',
    '',
    `<ApiEndpoint method=${attr(o.kind)} path=${attr(signature)}${f.deprecationReason ? ' deprecated' : ''} />`,
    '',
  ]
  if (f.deprecationReason) out.push(`> ${mdxText(f.deprecationReason)}`, '')
  if (description) out.push(mdxText(description), '')
  if (f.args.length) out.push(`## ${t.apiArguments}`, '', fieldTable(f.args.map(argRow)), '')
  const returned = getNamedType(f.type)
  out.push(`## ${t.apiReturns}`, '', typeLink(schema, f.type, prefix), '')
  if (returned.description) out.push(mdxText(returned.description), '')
  const rows = fieldRows(returned)
  if (rows.length) out.push(fieldTable(rows), '')
  const { document, variables } = operationExample(o)
  const samples = [fence('graphql', document, 'title="GraphQL"')]
  if (Object.keys(variables).length) samples.push(fence('json', JSON.stringify(variables, null, 2), 'title="Variables"'))
  if (spec.endpoint && o.kind !== 'subscription') {
    const body = JSON.stringify({ query: document, ...(Object.keys(variables).length ? { variables } : {}) })
    samples.push(fence('sh', `curl -X POST "${spec.endpoint}" \\\n  -H "Content-Type: application/json" \\\n  -d '${body.replace(/'/g, "'\\''")}'`, 'title="curl"'))
  }
  out.push(`## ${t.apiExamples}`, '', `<CodeGroup storageKey="novon:graphql-sample">\n\n${samples.join('\n\n')}\n\n</CodeGroup>`, '')
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

export function graphqlTypePage(schema: GraphQLSchema, type: GraphQLNamedType, t: Labels, prefix: string): string {
  const out: string[] = ['---', `title: ${yaml(type.name)}`, ...(type.description ? [`description: ${yaml(firstSentence(type.description))}`] : []), '---', '']
  out.push(`<Badge>${kindOf(type)}</Badge>`, '')
  if (type.description) out.push(mdxText(type.description), '')
  if ((isObjectType(type) || isInterfaceType(type)) && type.getInterfaces().length) {
    out.push(`## ${t.apiImplements}`, '', ...type.getInterfaces().map((i) => `- ${typeLink(schema, i, prefix)}`), '')
  }
  const rows = fieldRows(type)
  if (rows.length) out.push(`## ${t.apiFields}`, '', fieldTable(rows), '')
  if (isEnumType(type)) {
    const values = type.getValues().map((v) => ({ name: v.name, type: 'enum', ...(v.deprecationReason ? { deprecated: true } : {}), ...(v.description ? { description: v.description } : {}) }))
    out.push(`## ${t.apiValues}`, '', fieldTable(values), '')
  }
  if (isUnionType(type)) out.push(`## ${t.apiMembers}`, '', ...type.getTypes().map((m) => `- ${typeLink(schema, m, prefix)}`), '')
  if (isInterfaceType(type)) {
    const impl = schema.getPossibleTypes(type)
    if (impl.length) out.push(`## ${t.apiImplementedBy}`, '', ...impl.map((m) => `- ${typeLink(schema, m, prefix)}`), '')
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

export function graphqlOverviewPage(schema: GraphQLSchema, spec: GraphqlOptions, ops: GraphqlOperation[], t: Labels, prefix: string): string {
  const title = spec.title ?? 'GraphQL API'
  const root = prefix === '/' ? '' : prefix
  const description = schema.description ?? ''
  const out: string[] = ['---', `title: ${yaml(title)}`, ...(description ? [`description: ${yaml(firstSentence(description))}`] : []), 'icon: Braces', '---', '']
  if (description) out.push(mdxText(description), '')
  if (spec.endpoint) out.push(`<ApiEndpoint method="post" path=${attr(spec.endpoint)} />`, '')
  const labels = KIND_LABEL(t)
  for (const kind of ['query', 'mutation', 'subscription'] as const) {
    const list = ops.filter((o) => o.kind === kind)
    if (!list.length) continue
    out.push(`## ${labels[kind]}`, '')
    for (const o of list) out.push(`- <ApiMethod method=${attr(kind)} /> [${o.field.name}](${root}/${o.slug})${o.field.description ? `: ${mdxText(firstSentence(o.field.description))}` : ''}`)
    out.push('')
  }
  const types = graphqlTypes(schema)
  if (types.length) out.push(`## ${t.apiTypes}`, '', typeList(types, root), '')
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

function typeList(types: GraphQLNamedType[], root: string): string {
  return types.map((type) => `- [${type.name}](${root}/types/${typeSlug(type.name)}) \`${kindOf(type)}\`${type.description ? `: ${mdxText(firstSentence(type.description))}` : ''}`).join('\n')
}

/** The `types/` folder's own page: every named type, so the folder has a title and a link in the sidebar. */
export function graphqlTypesIndex(types: GraphQLNamedType[], t: Labels, prefix: string): string {
  return `---\ntitle: ${yaml(t.apiTypes)}\n---\n\n${typeList(types, prefix === '/' ? '' : prefix)}\n`
}

export async function loadGraphqlSchema(config: ResolvedConfig, spec: GraphqlOptions): Promise<GraphQLSchema | null> {
  const text = await readDescription(config, spec.schema, graphqlCachePath(config, spec), 'GraphQL schema')
  if (text === null) return null
  return parseGraphqlSchema(text, spec.schema)
}

export async function writeGraphqlPages(config: ResolvedConfig): Promise<void> {
  const t = labelsFor(config.lang, config.theme.labels)
  for (const spec of graphqlList(config)) {
    const schema = await loadGraphqlSchema(config, spec)
    if (!schema) continue
    const dir = join(config.root, GENERATED_DIR, graphqlName(spec))
    const prefix = spec.path.replace(/\/+$/, '') || '/'
    const ops = graphqlOperations(schema)
    const types = graphqlTypes(schema)
    const labels = KIND_LABEL(t)
    const files = new Map<string, string>()
    files.set('index.mdx', graphqlOverviewPage(schema, spec, ops, t, prefix))
    for (const o of ops) files.set(`${o.slug}.mdx`, graphqlOperationPage(schema, spec, o, t, prefix === '/' ? '' : prefix))
    for (const type of types) files.set(`types/${typeSlug(type.name)}.mdx`, graphqlTypePage(schema, type, t, prefix === '/' ? '' : prefix))
    const groups = (['query', 'mutation', 'subscription'] as const)
      .map((kind) => ({ group: labels[kind], pages: ops.filter((o) => o.kind === kind).map((o) => o.slug) }))
      .filter((g) => g.pages.length)
    files.set('_meta.json', `${JSON.stringify({ title: spec.title ?? 'GraphQL', pages: [...groups, ...(types.length ? ['types'] : [])] }, null, 2)}\n`)
    if (types.length) files.set('types/index.mdx', graphqlTypesIndex(types, t, prefix))
    if (types.length) files.set('types/_meta.json', `${JSON.stringify({ title: t.apiTypes, collapsed: true, pages: types.map((x) => typeSlug(x.name)) }, null, 2)}\n`)
    for (const [name, text] of files) await writeIfChanged(join(dir, name), text)
    await prune(dir, dir, files)
  }
}

/** Removes generated files no longer written. */
async function prune(root: string, dir: string, keep: Map<string, string>) {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await prune(root, path, keep)
    else if (!keep.has(relative(root, path))) await rm(path, { force: true })
  }
}
