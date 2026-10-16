import * as React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar'
import { withBase } from '../shared.ts'
import type { Author } from '../types.ts'
import { useSite } from './site.tsx'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join('').toUpperCase()
  return parts
    .slice(0, 2)
    .map((p) => [...p][0])
    .join('')
    .toUpperCase()
}

/** The `theme.authors` entry for a name, if any. */
export function useAuthor(name: string | undefined): Author | undefined {
  const { site } = useSite()
  return name ? site.theme.authors?.[name] : undefined
}

/** A person's avatar: their image from `theme.authors`, or their initials. */
export function AuthorAvatar({ name, image, size = 'md', className }: { name: string; image?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const { site } = useSite()
  const src = image ?? site.theme.authors?.[name]?.avatar
  return (
    <Avatar size={size} className={className}>
      {src && <AvatarImage src={withBase(site.base, src)} alt="" />}
      <AvatarFallback className="bg-primary-subtle text-primary">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
