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
    expect(pages.find((p) => p.route === '/events/on-pet-updated')?.badge).toBe('RECEIVE')
    expect(pages.find((p) => p.route === '/events/update-pet')?.badge).toBe('SEND')
    const search = JSON.parse(await read('search.json')) as { route: string }[]
    expect(search.some((e) => e.route === '/events/on-pet-updated')).toBe(true)
    expect(await read('llms-full.txt')).toContain('Channel parameters')
  })

  test('AsyncAPI 2 from a URL: cached, publish and subscribe pages, oneOf messages', async () => {
    expect(existsSync(asyncapiCachePath(config, { spec: `http://127.0.0.1:${server.port}/events.yaml`, path: '/legacy' }))).toBe(true)
    expect(pages.find((p) => p.route === '/legacy/user-signed-up')?.badge).toBe('SUBSCRIBE')
    const md = await read('legacy/send-welcome.md')
    expect(md).toContain('### Welcome')
    expect(md).toContain('### Reminder')
  })

  test('GraphQL from SDL: operations, types, examples, in .md, search and llms', async () => {
    expect(pages.find((p) => p.route === '/graphql/pet')?.badge).toBe('QUERY')
    expect(pages.find((p) => p.route === '/graphql/add-pet')?.badge).toBe('MUTATION')
    expect(pages.find((p) => p.route === '/graphql/pet-added')?.badge).toBe('SUBSCRIPTION')
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

/* ---------- part B: sources plugins, analytics vendors, consent, read aloud, export ---------- */

import { analyticsTags, consentOf, consentScript, inert } from '../src/node/analytics.ts'
import { blocksToMarkdown, cleanPagePath, mapItems, notionId, notionProperties, pick, syncHttp, syncNotion, writePages } from '../src/node/cms.ts'
import { articleOf, bookPages, epub, toXhtml } from '../src/node/export.ts'
import { crc32, unzip, zip } from '../src/node/zip.ts'
import { exportBook } from '../src/node/export.ts'
import { siteData } from '../src/node/vite.ts'
import { defineSource } from '../src/config.ts'

const NOTION_PAGE = 'https://www.notion.so/acme/Intro-0123456789abcdef0123456789abcdef'

function notionFetch(calls: string[]): typeof fetch {
  const rt = (text: string, annotations = {}) => ({ plain_text: text, annotations, href: null })
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(`${init?.method ?? 'GET'} ${url} ${(init?.headers as Record<string, string>)?.authorization ?? ''}`)
    const json = (v: unknown) => new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json' } })
    if (url.endsWith('/pages/01234567-89ab-cdef-0123-456789abcdef')) return json({ properties: { Name: { type: 'title', title: [rt('Intro')] } } })
    if (url.includes('/databases/') && url.endsWith('/query')) {
      return json({ has_more: false, results: [{ id: 'row1', properties: { Name: { type: 'title', title: [rt('First post')] }, Date: { type: 'date', date: { start: '2026-11-01T00:00:00Z' } }, Tags: { type: 'multi_select', multi_select: [{ name: 'news' }] } } }] })
    }
    if (url.includes('/blocks/01234567-89ab-cdef-0123-456789abcdef/children')) {
      return json({
        has_more: false,
        results: [
          { id: 'b1', type: 'heading_1', heading_1: { rich_text: [rt('Welcome')] } },
          { id: 'b2', type: 'paragraph', paragraph: { rich_text: [rt('Hello '), rt('world', { bold: true })] } },
          { id: 'b3', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [rt('one')] } },
          { id: 'b4', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [rt('two')] }, has_children: true },
          { id: 'b5', type: 'code', code: { language: 'type script', rich_text: [rt('let a = 1')] } },
        ],
      })
    }
    if (url.includes('/blocks/b4/children')) return json({ has_more: false, results: [{ id: 'b6', type: 'numbered_list_item', numbered_list_item: { rich_text: [rt('nested')] } }] })
    if (url.includes('/blocks/row1/children')) return json({ has_more: false, results: [{ id: 'r1', type: 'paragraph', paragraph: { rich_text: [rt('Post body')] } }] })
    return new Response('{}', { status: 404 })
  }) as typeof fetch
}

describe('part B units', () => {
  test('notion: IDs, rich text, blocks and properties', () => {
    expect(notionId(NOTION_PAGE)).toBe('01234567-89ab-cdef-0123-456789abcdef')
    expect(() => notionId('nope')).toThrow()
    const md = blocksToMarkdown([
      { id: '1', type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Title' }] } },
      { id: '2', type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'a' }] } },
      { id: '3', type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'b', annotations: { code: true } }] } },
      { id: '4', type: 'to_do', to_do: { checked: true, rich_text: [{ plain_text: 'done' }] } },
      { id: '5', type: 'divider', divider: {} },
      { id: '6', type: 'image', image: { external: { url: 'https://x.dev/a.png' }, caption: [] } },
    ])
    expect(md).toBe('### Title\n\n1. a\n2. `b`\n- [x] done\n\n---\n\n![](https://x.dev/a.png)')
    const meta = notionProperties({ properties: { Name: { type: 'title', title: [{ plain_text: 'Hi' }] }, Slug: { type: 'rich_text', rich_text: [{ plain_text: 'hi-there' }] }, Order: { type: 'number', number: 2 } } })
    expect(meta).toEqual({ title: 'Hi', slug: 'hi-there', frontmatter: { order: 2 } })
  })

  test('notion source: pages and a database through the API, token from env', async () => {
    const root = await mkdtemp(join(tmpdir(), 'novon-notion-'))
    const calls: string[] = []
    const real = globalThis.fetch
    globalThis.fetch = notionFetch(calls)
    process.env.TEST_NOTION = 'secret_x'
    try {
      const dir = join(root, 'out')
      const r = await syncNotion({ root } as any, { type: 'notion', path: '/notes', pages: [NOTION_PAGE], database: '0123456789abcdef0123456789abcdee', tokenEnv: 'TEST_NOTION' }, dir)
      expect(r).toBe('2 pages from Notion')
      const index = await readFile(join(dir, 'index.md'), 'utf8')
      expect(index).toContain("title: Intro")
      expect(index).toContain('## Welcome\n\nHello **world**\n\n- one\n- two\n  1. nested\n\n```typescript\nlet a = 1\n```')
      const post = await readFile(join(dir, 'first-post.md'), 'utf8')
      expect(post).toContain("date: '2026-11-01'")
      expect(post).toContain('- news')
      expect(calls.every((c) => c.endsWith('Bearer secret_x'))).toBe(true)
      await expect(syncNotion({ root } as any, { type: 'notion', path: '/n', pages: [NOTION_PAGE], tokenEnv: 'MISSING_TOKEN' }, dir)).rejects.toThrow('set MISSING_TOKEN')
    } finally {
      globalThis.fetch = real
    }
  })

  test('http source: items path, field map or function, bearer token', async () => {
    const root = await mkdtemp(join(tmpdir(), 'novon-http-'))
    const real = globalThis.fetch
    let auth = ''
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      auth = (init?.headers as Record<string, string>).authorization
      return new Response(JSON.stringify({ data: { posts: [{ slug: 'a', title: 'A', body: '# A\n\ntext', at: '2026-01-02T10:00:00Z' }, { slug: 'Nested/B b', title: 'B', body: 'b' }, { title: 'no slug' }] } }))
    }) as typeof fetch
    process.env.TEST_CMS = 'tok'
    try {
      const dir = join(root, 'out')
      expect(await syncHttp({ root } as any, { type: 'http', path: '/blog', url: 'https://cms.dev/posts', items: 'data.posts', tokenEnv: 'TEST_CMS', map: { path: 'slug', title: 'title', content: 'body', date: 'at' } }, dir)).toBe('2 pages')
      expect(auth).toBe('Bearer tok')
      expect(await readFile(join(dir, 'a.md'), 'utf8')).toContain("date: '2026-01-02'")
      expect(existsSync(join(dir, 'nested/b-b.md'))).toBe(true)
      await expect(syncHttp({ root } as any, { type: 'http', path: '/x', url: 'https://cms.dev/posts', items: 'nope' }, dir)).rejects.toThrow('no array')
    } finally {
      globalThis.fetch = real
    }
    expect(mapItems([{ id: 1 }], (item) => ({ path: `p${item.id}`, content: 'x' }))).toEqual([{ path: 'p1', content: 'x' }])
    expect(pick({ a: [{ b: 2 }] }, 'a.0.b')).toBe(2)
    expect(cleanPagePath('../Hello World/./x')).toBe('hello-world/x')
    await expect(writePages(join(root, 'dup'), [{ path: 'a', content: '' }, { path: 'A', content: '' }])).rejects.toThrow('two pages')
  })

  test('analytics vendors and consent', () => {
    const tags = analyticsTags({ posthog: { key: 'phc_1' }, fathom: 'ABC', simpleAnalytics: true, matomo: { url: 'https://m.dev', siteId: 3 } })
    const html = JSON.stringify(tags)
    expect(html).toContain('https://us-assets.i.posthog.com/static/array.js')
    expect(html).toContain('phc_1')
    expect(html).toContain('"data-site":"ABC"')
    expect(html).toContain('"data-spa":"auto"')
    expect(html).toContain('scripts.simpleanalyticscdn.com/latest.js')
    expect(html).toContain("https://m.dev/")
    expect(html).toContain("setSiteId',\\\"3\\\"")
    expect(analyticsTags({ posthog: { key: 'k', host: 'https://eu.i.posthog.com' } }).some((t) => t.attrs?.src === 'https://eu-assets.i.posthog.com/static/array.js')).toBe(true)
    expect(consentOf({ consent: true })).toBeNull()
    expect(consentOf({ consent: true, analytics: { fathom: 'X' } })).toEqual({ version: '1' })
    expect(consentOf({ consent: { version: 2, policy: '/privacy' }, analytics: { fathom: 'X' } })).toEqual({ version: '2', policy: '/privacy' })
    const held = inert(tags)
    expect(held.every((t) => t.tag !== 'script' || (t.attrs?.type === 'text/plain' && t.attrs['data-novon-consent'] === true))).toBe(true)
    const script = consentScript('2')
    expect(script).toContain('"novon:consent:2"')
    expect(script).toContain('window.novonConsent')
  })

  test('zip, xhtml and article extraction', async () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686)
    const data = zip([{ name: 'mimetype', data: 'application/epub+zip', store: true }, { name: 'a/b.txt', data: 'x'.repeat(500) }])
    expect(new TextDecoder().decode(data.subarray(30, 38))).toBe('mimetype')
    const files = unzip(data)
    expect(new TextDecoder().decode(files.get('a/b.txt'))).toBe('x'.repeat(500))
    expect(toXhtml('<p class="a b" hidden>x&nbsp;y<br><img src="/a.png" alt=x></p><input disabled/>', ['class'])).toBe('<p hidden="">x&#160;y<br/><img src="/a.png" alt="x"/></p><input disabled=""/>')
    const article = await articleOf('<main><article class="typeset"><h2>T</h2><button>copy</button><div data-novon-chrome="">x</div><p>Body <span aria-hidden="true">#</span></p><article><p>inner</p></article></article><footer>f</footer></main>')
    expect(article).toBe('<h2>T</h2><p>Body </p><article><p>inner</p></article>')
  })

  test('new labels exist in every built-in language', () => {
    for (const lang of ['en', 'zh-CN', 'ja']) {
      const l = labelsFor(lang)
      for (const k of ['listen', 'listenPause', 'listenResume', 'listenStop', 'readingAloud', 'readingPaused', 'consentText', 'consentAccept', 'consentDecline', 'consentPolicy'] as const) expect(l[k]).toBeTruthy()
    }
  })
})

describe('part B site: custom and http sources, consent, export', async () => {
  const root = await mkdtemp(join(tmpdir(), 'novon-rest-b-'))
  const server = Bun.serve({ port: 0, fetch: () => Response.json([{ slug: 'hello', title: 'Hello', content: 'From the CMS.' }]) })
  afterAll(() => server.stop(true))
  const files: Record<string, string> = {
    'novon.config.ts': `import { defineSource } from ${JSON.stringify(join(import.meta.dir, '../src/config.ts'))}
export default {
  title: 'Book',
  url: 'https://book.dev',
  og: false,
  analytics: { fathom: 'ABC' },
  consent: { text: 'We count **visits**.', policy: '/privacy', version: 3 },
  sources: [
    defineSource({ kind: 'sanity', path: '/cms', load: async () => [{ path: 'index', title: 'CMS', content: 'Custom source page with [a link](/guide).' }, { path: 'deep/page', title: 'Deep', content: 'Deep page.' }] }),
    { type: 'http', path: '/feed', url: 'http://127.0.0.1:${server.port}/' },
  ],
}
`,
    'public/cat.png': 'not really a png',
    'content/index.mdx': '---\ntitle: Home\n---\n\nHello.\n',
    'content/guide.mdx': '---\ntitle: Guide\norder: 1\n---\n\n## Use\n\nSee ![cat](/cat.png) and [home](/).\n',
    'content/privacy.mdx': '---\ntitle: Privacy\nhidden: true\n---\n\nPolicy.\n',
  }
  for (const [file, text] of Object.entries(files)) {
    await mkdir(join(root, file, '..'), { recursive: true })
    await writeFile(join(root, file), text)
  }
  const config = await loadConfig(root)
  await syncAll(config)
  await build(config, { quiet: true })
  const dist = join(root, 'dist')
  const read = (p: string) => readFile(join(dist, p), 'utf8')

  test('custom and http sources are mounted and built', async () => {
    expect(await read('cms/index.html')).toContain('Custom source page')
    expect(existsSync(join(dist, 'cms/deep/page/index.html'))).toBe(true)
    expect(await read('feed/hello/index.html')).toContain('From the CMS.')
    expect(existsSync(join(root, '.novon/sources/sanity-cms/index.md'))).toBe(true)
    expect(defineSource({ kind: 'x', path: '/x', load: () => [] }).type).toBe('custom')
  })

  test('consent: analytics inert in the head, banner data in the site', async () => {
    const html = await read('index.html')
    expect(html).toMatch(/<script[^>]*type="text\/plain"[^>]*data-novon-consent/)
    expect(html).toContain('novon:consent:3')
    const { pages } = await scanSite(config)
    const site = siteData(config, pages)
    expect(site.consent).toEqual({ version: '3', html: 'We count <strong>visits</strong>.', policy: '/privacy' })
  })

  test('check accepts the new keys', async () => {
    const issues = await check(config)
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(checkConfig({ ...config, sources: [{ type: 'notion', path: '/n', pages: ['x'] } as any] }).filter((i) => i.severity === 'error')).toEqual([])
  })

  test('export epub: chapters in order, nav, local images, chapter links', async () => {
    const { pages, folders } = await scanSite(config)
    expect(bookPages(config, pages, folders).map((p) => p.route).slice(0, 2)).toEqual(['/guide', '/'])
    const r = await exportBook(config, 'epub', { out: 'book.epub', built: true })
    const book = unzip(new Uint8Array(await readFile(r.file)))
    const text = (n: string) => new TextDecoder().decode(book.get(n))
    expect(text('mimetype')).toBe('application/epub+zip')
    expect(text('OEBPS/content.opf')).toContain('<dc:title>Book</dc:title>')
    expect(text('OEBPS/nav.xhtml')).toContain('epub:type="toc"')
    const guide = [...book.keys()].map((k) => (k.endsWith('.xhtml') && text(k).includes('<title>Guide</title>') ? text(k) : '')).find(Boolean)!
    expect(guide).toContain('src="images/1.png"')
    expect(guide).toMatch(/href="chapter-2\.xhtml"/)
    expect(book.has('OEBPS/images/1.png')).toBe(true)
  })

  test('export pdf without a browser writes the print file', async () => {
    process.env.NOVON_CHROME = join(root, 'no-chrome')
    try {
      const r = await exportBook(config, 'pdf', { out: 'out/book.pdf', built: true })
      expect(r.printed).toBe(false)
      const html = await readFile(r.printFile!, 'utf8')
      expect(html).toContain('id="chapter-2"')
      expect(html).toContain('<style>')
    } finally {
      delete process.env.NOVON_CHROME
    }
  })
})
