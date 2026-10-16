import * as React from 'react'
import { normalizeRoute, withBase } from '../shared.ts'
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
  // Only routes this site renders navigate in place; anything else under the base
  // (another site deployed beside it, a generated file) is a normal page load.
  const local = isInternal(href)
  const internal = local && site.pages.some((p) => p.route === normalizeRoute(href.split(/[?#]/)[0]))
  const target = local ? withBase(site.base, href) : href
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
