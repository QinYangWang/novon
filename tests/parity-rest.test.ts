import { afterAll, describe, expect, test } from 'bun:test'
// Local test servers are reached directly, never through a proxy.
process.env.NO_PROXY = '127.0.0.1,localhost'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSchema, introspectionFromSchema } from 'graphql'
import { loadConfig } from '../src/node/load-config.ts'
import { build } from '../src/node/build.ts'
import { check, checkConfig } from '../src/node/check.ts'
import { scanSite } from '../src/node/content.ts'
import { syncAll } from '../src/node/sources.ts'
import { parseSpec, treeSchema } from '../src/node/openapi.ts'
import { asyncapiCachePath, asyncOperations } from '../src/node/asyncapi.ts'
import { graphqlCachePath, graphqlOperations, graphqlTypes, operationExample, parseGraphqlSchema } from '../src/node/graphql.ts'
import { labelsFor } from '../src/labels.ts'

const OPENAPI = `openapi: 3.1.0
info: { title: Pets, version: 1.0.0 }
servers: [{ url: https://api.pets.dev }]
paths:
  /pets:
    post:
      operationId: createPet
      summary: Create a pet
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/Pet' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Pet' }
components:
  schemas:
    Pet:
      type: object
      required: [name]
      properties:
        name: { type: string, description: The pet's name. }
        parent: { $ref: '#/components/schemas/Pet' }
        tags: { type: array, items: { $ref: '#/components/schemas/Tag' } }
    Tag:
      type: object
      properties:
        id: { type: integer }
`

const ASYNC3 = `asyncapi: 3.0.0
info: { title: Events, version: 1.0.0, description: Live events. }
servers:
  prod: { host: events.pets.dev, protocol: wss }
channels:
  petUpdated:
    address: pets/{petId}
    parameters:
      petId: { description: The pet. }
    messages:
      updated: { $ref: '#/components/messages/Updated' }
operations:
  onPetUpdated:
    action: receive
    summary: Pet updated
    channel: { $ref: '#/channels/petUpdated' }
    tags: [{ name: Pets }]
  updatePet:
    action: send
    summary: Update a pet
    channel: { $ref: '#/channels/petUpdated' }
components:
  messages:
    Updated:
      name: Updated
      headers:
        type: object
        properties:
          trace: { type: string }
      payload:
        type: object
        required: [id]
        properties:
          id: { type: integer, description: Pet ID. }
          name: { type: string }
      examples:
        - payload: { id: 7, name: Mochi }
`

const ASYNC2 = `asyncapi: 2.6.0
info: { title: Legacy events, version: 0.1.0 }
channels:
  user/signedup:
    subscribe:
      operationId: userSignedUp
      summary: A user signed up
      message:
        payload:
          type: object
          properties:
            email: { type: string, format: email }
    publish:
      operationId: sendWelcome
      message:
        oneOf:
          - { name: Welcome, payload: { type: string } }
          - { name: Reminder, payload: { type: string } }
`

const SDL = `"The shop."
type Query {
  "A pet by ID."
  pet(id: ID!): Pet
  pets(first: Int = 10): [Pet!]!
}
type Mutation { addPet(input: PetInput!): Pet! }
type Subscription { petAdded: Pet! }
interface Node { id: ID! }
"A pet."
type Pet implements Node { id: ID!, name: String!, kind: Kind!, owner: Owner, legacy: String @deprecated(reason: "Gone.") }
type Owner implements Node { id: ID!, pets: [Pet!]! }
union Thing = Pet | Owner
enum Kind { CAT DOG }
input PetInput { name: String!, kind: Kind = CAT }
scalar DateTime
`

describe('a site with OpenAPI, AsyncAPI and GraphQL references', async () => {
  const root = await mkdtemp(join(tmpdir(), 'novon-rest-'))
  const introspection = JSON.stringify({ data: introspectionFromSchema(buildSchema(SDL)) })
  const server = Bun.serve({
    port: 0,
    fetch: (req) => {
      const path = new URL(req.url).pathname
      if (path === '/events.yaml') return new Response(ASYNC2)
      if (path === '/schema.json') return new Response(introspection)
      return new Response('no', { status: 404 })
    },
  })
  afterAll(() => server.stop(true))
  const files: Record<string, string> = {
    'novon.config.ts': `export default {
  title: 'Demo',
  url: 'https://demo.dev',
  og: false,
  i18n: { locales: { en: 'English', ja: '日本語' } },
  openapi: { spec: 'api.yaml', path: '/api' },
  asyncapi: [{ spec: 'events.yaml', path: '/events' }, { spec: 'http://127.0.0.1:${server.port}/events.yaml', path: '/legacy' }],
  graphql: [{ schema: 'schema.graphql', path: '/graphql', endpoint: 'https://pets.dev/graphql' }, { schema: 'http://127.0.0.1:${server.port}/schema.json', path: '/gql', title: 'Introspected' }],
  feedback: { href: 'https://github.com/a/b/issues/new?title={title}' },
  theme: { social: { rss: true } },
}
`,
    'api.yaml': OPENAPI,
    'events.yaml': ASYNC3,
    'schema.graphql': SDL,
    'content/index.mdx': '---\ntitle: Home\n---\n\nHello.\n',
    'content/ja/index.mdx': '---\ntitle: ホーム\n---\n\nこんにちは。\n',
    'content/guide.mdx': '---\ntitle: Guide\n---\n\n## Use\n\nText.\n',
    'content/changelog.mdx': '---\ntitle: Changelog\nlayout: changelog\n---\n\n## 1.1.0 (2026-11-01)\n\n- New things.\n\n## 1.0.0 (2026-10-01)\n\nFirst.\n',
  }
  for (const [file, text] of Object.entries(files)) {
    await mkdir(join(root, file, '..'), { recursive: true })
    await writeFile(join(root, file), text)
  }
  const config = await loadConfig(root)
  await build(config, { quiet: true })
  const dist = join(root, 'dist')
  const read = (p: string) => readFile(join(dist, p), 'utf8')
  const { pages } = await scanSite(config)

  test('OpenAPI schemas render as a tree with method badges; .md keeps the table', async () => {
    const html = await read('api/create-pet/index.html')
    expect(html).toContain('data-slot="schema-tree"')
    expect(html).toContain('data-slot="method-badge"')
    expect(html).toContain('data-slot="endpoint"')
    const md = await read('api/create-pet.md')
    expect(md).toMatch(/\| `name` \(required\) +\| `string`/)
    expect(md).not.toContain('ApiSchema')
    // A schema that contains itself stops at the first repeat in examples.
    expect(md).not.toContain('"parent": {\n      "name"')
  })

  test('AsyncAPI 3: a page per operation with parameters, headers, payload and example', async () => {
    const html = await read('events/on-pet-updated/index.html')
    expect(html).toContain('pets/{petId}')
    expect(html).toContain('data-slot="schema-tree"')
    const md = await read('events/on-pet-updated.md')
    expect(md).toContain('## Channel parameters')
    expect(md).toContain('`petId` (required)')
    expect(md).toContain('#### Message headers')
    expect(md).toContain('| `id` (required) | `integer`')
    expect(md).toContain('"name": "Mochi"')
    expect(await read('events.md')).toContain('Update a pet')
    expect(pages.find((p) => p.route === '/events/on-pet-updated')?.badge).toBe('RECV')
    expect(pages.find((p) => p.route === '/events/update-pet')?.badge).toBe('SEND')
    const search = JSON.parse(await read('search.json')) as { route: string }[]
    expect(search.some((e) => e.route === '/events/on-pet-updated')).toBe(true)
    expect(await read('llms-full.txt')).toContain('Channel parameters')
  })

  test('AsyncAPI 2 from a URL: cached, publish and subscribe pages, oneOf messages', async () => {
    expect(existsSync(asyncapiCachePath(config, { spec: `http://127.0.0.1:${server.port}/events.yaml`, path: '/legacy' }))).toBe(true)
    expect(pages.find((p) => p.route === '/legacy/user-signed-up')?.badge).toBe('SUB')
    const md = await read('legacy/send-welcome.md')
    expect(md).toContain('### Welcome')
    expect(md).toContain('### Reminder')
  })

  test('GraphQL from SDL: operations, types, examples, in .md, search and llms', async () => {
    expect(pages.find((p) => p.route === '/graphql/pet')?.badge).toBe('QUERY')
    expect(pages.find((p) => p.route === '/graphql/add-pet')?.badge).toBe('MUT')
    expect(pages.find((p) => p.route === '/graphql/pet-added')?.badge).toBe('SUB')
    const md = await read('graphql/pet.md')
    expect(md).toContain('## Arguments')
    expect(md).toContain('| `id` (required) | `ID!`')
    expect(md).toContain('query Pet($id: ID!)')
    expect(md).toContain('curl -X POST "https://pets.dev/graphql"')
    const type = await read('graphql/types/pet.md')
    expect(type).toContain('## Implements')
    expect(type).toContain('`legacy`')
    expect(await read('graphql/types/kind.md')).toContain('`CAT`')
    expect(await read('graphql/types/thing.md')).toContain('## Members')
    const search = JSON.parse(await read('search.json')) as { route: string }[]
    expect(search.some((e) => e.route === '/graphql/types/pet')).toBe(true)
    expect(await read('llms.txt')).toContain('/graphql/add-pet')
  })

  test('GraphQL from an introspection result at a URL', async () => {
    expect(existsSync(graphqlCachePath(config, { schema: `http://127.0.0.1:${server.port}/schema.json`, path: '/gql' }))).toBe(true)
    expect(await read('gql.md')).toContain('Introspected')
    expect(existsSync(join(dist, 'gql/types/pet-input/index.html'))).toBe(true)
  })

  test('novon sync refreshes AsyncAPI and GraphQL URLs', async () => {
    const results = await syncAll(config)
    expect(results.filter((r) => r.type === 'asyncapi' || r.type === 'graphql').map((r) => r.ok)).toEqual([true, true])
  })

  test('check accepts the new keys and rejects a missing path', async () => {
    const issues = await check(config)
    expect(issues.filter((i) => i.rule === 'config')).toEqual([])
    const bad = checkConfig({ ...config, source: { title: 'Demo', graphql: { schema: 'schema.graphql' }, asyncapi: { path: '/x' } } } as never)
    expect(bad.some((i) => /asyncapi/.test(i.message))).toBe(true)
    expect(bad.some((i) => i.rule === 'config' && /graphql/.test(i.message))).toBe(true)
  })

  test('library chrome: locale switcher, feed icon, inline feedback, anchored changelog', async () => {
    const home = await read('guide/index.html')
    expect(home).toContain('data-slot="locale-switcher"')
    expect(home).toContain('aria-label="RSS feed"')
    expect(home).toContain('data-placement="inline"')
    const changelog = await read('changelog/index.html')
    expect(changelog).toContain('data-slot="timeline-header"')
    expect(changelog).toContain('data-slot="timeline-anchor"')
    expect(changelog).toMatch(/<h2[^>]*id="110-2026-11-01"/)
  })
})

describe('reference units', () => {
  test('schema trees resolve $ref, keep cycles as titled leaves', () => {
    const doc = parseSpec(OPENAPI)
    const tree = treeSchema(doc, { $ref: '#/components/schemas/Pet' })
    expect(tree.title).toBe('Pet')
    expect(tree.properties.parent).toEqual({ type: 'object', title: 'Pet' })
    expect(tree.properties.tags.items.title).toBe('Tag')
    expect(tree.properties.tags.items.properties.id.type).toBe('integer')
  })

  test('AsyncAPI operations from 2.x and 3.x', () => {
    const v3 = asyncOperations(parseSpec(ASYNC3), 'Operations')
    expect(v3.map((o) => [o.slug, o.action, o.address, o.group])).toEqual([
      ['on-pet-updated', 'receive', 'pets/{petId}', 'Pets'],
      ['update-pet', 'send', 'pets/{petId}', 'pets/{petId}'],
    ])
    const v2 = asyncOperations(parseSpec(ASYNC2), 'Operations')
    expect(v2.map((o) => [o.slug, o.action, o.messages.length])).toEqual([
      ['send-welcome', 'publish', 2],
      ['user-signed-up', 'subscribe', 1],
    ])
  })

  test('GraphQL operations, types and examples; SDL and introspection agree', () => {
    const schema = parseGraphqlSchema(SDL)
    const ops = graphqlOperations(schema)
    expect(ops.map((o) => `${o.kind}:${o.slug}`)).toEqual(['query:pet', 'query:pets', 'mutation:add-pet', 'subscription:pet-added'])
    expect(graphqlTypes(schema).map((t) => t.name)).toEqual(['DateTime', 'Kind', 'Node', 'Owner', 'Pet', 'PetInput', 'Thing'])
    const ex = operationExample(ops[2])
    expect(ex.document).toContain('mutation AddPet($input: PetInput!)')
    expect(ex.document).not.toContain('legacy')
    expect(ex.variables).toEqual({ input: { name: 'string' } })
    expect(operationExample(ops[1]).variables).toEqual({ first: 10 })
    const fromJson = parseGraphqlSchema(JSON.stringify(introspectionFromSchema(schema)))
    expect(graphqlOperations(fromJson).map((o) => o.slug)).toEqual(ops.map((o) => o.slug))
  })

  test('labels for the new references exist in every built-in language', () => {
    for (const lang of ['en', 'zh-CN', 'ja']) {
      const t = labelsFor(lang)
      for (const key of ['apiChannelParameters', 'apiPayload', 'apiMessageHeaders', 'apiArguments', 'apiReturns', 'apiImplementedBy', 'rssFeed'] as const) expect(t[key]).toBeTruthy()
    }
  })
})
