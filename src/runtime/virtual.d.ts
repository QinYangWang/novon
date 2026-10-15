declare module 'virtual:novon/site' {
  import type { ComponentType } from 'react'
  import type { SiteData } from '../types.ts'
  export const site: SiteData
  export const loaders: Record<string, () => Promise<{ default: ComponentType<any>; frontmatter?: Record<string, unknown> }>>
  export const overrides: Partial<Record<import('../types.ts').OverrideSlot, ComponentType<any>>>
  export const components: Record<string, ComponentType<any>>
}
declare module 'virtual:novon/css'
