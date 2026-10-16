#!/usr/bin/env bun
/**
 * Pulls the component library into src/ui, src/components, src/styles and src/app.
 * Those files are installed, never edited by hand: run this to update them.
 *
 *   bun scripts/sync-ui.ts
 */
import { $ } from 'bun'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')

export const items = [
  'theme', 'theme-accents', 'typeset', 'icons', 'button', 'badge', 'card', 'alert', 'tabs', 'accordion',
  'collapsible', 'tooltip', 'menu', 'file-tree', 'marquee', 'scroll-progress', 'theme-toggle',
  'command-palette', 'breadcrumb', 'avatar', 'icon-chip', 'scroll-area', 'segmented-control', 'drawer',
  'code-block', 'kbd', 'separator', 'animated-sidebar', 'page-header', 'outline', 'cover-art',
  'sidebar-nav', 'simple-table',
]

if (import.meta.main) {
  await $`bunx --bun shadcn@latest add -y -o ${items.map((i) => `@qinyang/${i}`)}`.cwd(root)
  console.log('ui synced')
}
