import * as React from 'react'
import { withBase } from '../shared.ts'
import { useSite } from './site.tsx'

const FILE = /\.[a-z0-9]{2,5}$/i

/** True for links novon can show without leaving the page. */
export function isInternal(href: string | undefined): href is string {
  return !!href && href.startsWith('/') && !href.startsWith('//') && !FILE.test(href.split(/[?#]/)[0])
}

export type LinkProps = React.ComponentProps<'a'> & { href: string }

/** An anchor that navigates in place for site routes. `href` is a route, without base. */
export function Link({ href, onClick, onMouseEnter, ...props }: LinkProps) {
  const { site, navigate, prefetch } = useSite()
  const internal = isInternal(href)
  const target = internal ? withBase(site.base, href) : href
  return (
    <a
      href={target}
      onMouseEnter={(e) => {
        onMouseEnter?.(e)
        if (internal) prefetch(href)
      }}
      onClick={(e) => {
        onClick?.(e)
        if (!internal || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        if (props.target && props.target !== '_self') return
        e.preventDefault()
        navigate(href)
      }}
      {...props}
    />
  )
}
