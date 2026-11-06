/** Sends a custom event to every configured analytics provider that takes events. */
type Analytics = Window & {
  plausible?: (event: string, options?: { props?: Record<string, string> }) => void
  umami?: { track: (event: string, data?: Record<string, string>) => void }
  gtag?: (command: 'event', event: string, params?: Record<string, string>) => void
  posthog?: { capture?: (event: string, props?: Record<string, string>) => void }
  fathom?: { trackEvent?: (event: string) => void }
  sa_event?: (event: string, metadata?: Record<string, string>) => void
  _paq?: unknown[][]
}

export function track(event: string, props: Record<string, string> = {}): void {
  if (typeof window === 'undefined') return
  const w = window as Analytics
  w.plausible?.(event, { props })
  w.umami?.track(event, props)
  w.gtag?.('event', event, props)
  w.posthog?.capture?.(event, props)
  w.fathom?.trackEvent?.(event)
  w.sa_event?.(event, props)
  w._paq?.push(['trackEvent', 'novon', event, props.page ?? ''])
}
