import * as React from 'react'
import * as Icons from '@/components/icons'

type IconComponent = React.ComponentType<{ className?: string }>

const table = Icons as unknown as Record<string, IconComponent>

/** Every icon name frontmatter and MDX accept, e.g. `Rocket` or `RocketIcon`. */
export const iconNames: string[] = Object.keys(table)
  .filter((k) => k.endsWith('Icon'))
  .map((k) => k.slice(0, -4))

const aliases: Record<string, string> = {
  Book: 'Bookmark',
  BookOpen: 'Bookmark',
  FileText: 'File',
  Puzzle: 'Shapes',
  Rocket: 'Sparkles',
  Zap: 'Bolt',
  Layers: 'Rows2',
  Palette: 'Palette',
  Github: 'Github',
  Rss: 'Inbox',
  Pen: 'Edit',
  PenLine: 'Edit',
  Package: 'Database',
  Wrench: 'Settings',
  Cog: 'Settings',
}

export function resolveIcon(name: string | undefined): IconComponent | undefined {
  if (!name) return undefined
  const base = name.replace(/Icon$/, '')
  return table[`${base}Icon`] ?? table[`${aliases[base] ?? ''}Icon`]
}

export interface IconProps {
  /** Icon name, e.g. `Sparkles`. Unknown names render nothing. */
  name?: string
  className?: string
}

export function Icon({ name, className }: IconProps) {
  const Component = resolveIcon(name)
  return Component ? <Component className={className} /> : null
}
