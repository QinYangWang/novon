/** Before a scan: outside sources fetched when not cached yet, and API reference pages written from OpenAPI, AsyncAPI and GraphQL descriptions. */
import type { ResolvedConfig } from '../types.ts'
import { writeAsyncApiPages } from './asyncapi.ts'
import { writeGraphqlPages } from './graphql.ts'
import { writeOpenApiPages } from './openapi.ts'
import { ensureSources } from './sources.ts'

export async function prepareGenerated(config: ResolvedConfig): Promise<void> {
  if (config.sources?.length) await ensureSources(config)
  if (config.openapi) await writeOpenApiPages(config)
  if (config.asyncapi) await writeAsyncApiPages(config)
  if (config.graphql) await writeGraphqlPages(config)
}
