/**
 * "On this page" for docs pages and posts. Kept small on purpose: the library's
 * outline component replaces it once it ships in the registry.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'
import type { Heading } from '../types.ts'

/** The heading being read: the last one above `line` px, or the last heading at the page end. */
export function useActiveHeading(ids: string[], line = 112): string | undefined {
  const [active, setActive] = React.useState<string | undefined>(ids[0])
  React.useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e)
    if (!els.length) return
    let frame = 0
    const update = () => {
      frame = 0
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      let current = els[0].id
      if (atEnd) current = els[els.length - 1].id
      else for (const el of els) if (el.getBoundingClientRect().top < line) current = el.id
      setActive(current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [ids, line])
  return active
}

export function Outline({ headings, className }: { headings: Heading[]; className?: string }) {
  const ids = React.useMemo(() => headings.map((h) => h.id), [headings])
  const active = useActiveHeading(ids)
  if (headings.length < 2) return null
  return (
    <nav aria-label="On this page" className={cn('flex flex-col gap-3', className)}>
      <p className="text-ui-xs font-medium tracking-wider text-muted-foreground uppercase">On this page</p>
      <ul className="flex flex-col border-s border-border">
        {headings.map((h) => {
          const current = h.id === active
          return (
            <li key={h.id} className="relative">
              <a
                href={`#${h.id}`}
                aria-current={current ? 'location' : undefined}
                className={cn(
                  'block py-1 text-ui-sm text-pretty transition-colors duration-150 outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline',
                  'before:absolute before:inset-y-1 before:-start-px before:w-0.5 before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity',
                  h.depth >= 3 ? 'ps-7' : 'ps-4',
                  current ? 'font-medium text-foreground before:opacity-100' : 'text-muted-foreground',
                )}
              >
                {h.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
