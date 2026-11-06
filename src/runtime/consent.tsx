/**
 * The analytics consent banner from config `consent`. The head script keeps the
 * analytics scripts inert and exposes `window.novonConsent`; this asks once per
 * consent version and shows again after `novonConsent.reset()`.
 */
import * as React from 'react'
import { Button } from '@/ui/button'
import { Card, CardContent, CardFooter } from '@/ui/card'
import { withBase } from '../shared.ts'
import { useLabels, useSite } from './site.tsx'

type Choice = 'granted' | 'denied' | null

export interface NovonConsent {
  version: string
  get(): Choice
  allow(): void
  deny(): void
  reset(): void
}

declare global {
  interface Window {
    novonConsent?: NovonConsent
  }
}

export function ConsentBanner() {
  const { site } = useSite()
  const t = useLabels()
  // Hidden until mounted: the choice lives in the reader's storage, not in the HTML.
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    if (!site.consent) return
    const sync = () => setOpen(!!window.novonConsent && window.novonConsent.get() === null)
    sync()
    window.addEventListener('novon:consent', sync)
    return () => window.removeEventListener('novon:consent', sync)
  }, [site.consent])
  const consent = site.consent
  if (!consent || !open) return null
  const policy = consent.policy && (/^[a-z][a-z0-9+.-]*:/i.test(consent.policy) ? consent.policy : withBase(site.base, consent.policy))
  return (
    <div data-novon-chrome="" data-novon-consent-banner="" className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:justify-end sm:p-4">
      <Card role="region" aria-label={t.consentPolicy} size="sm" className="w-full max-w-sm shadow-lg">
        <CardContent className="text-ui-sm text-muted-foreground">
          {consent.html ? <span dangerouslySetInnerHTML={{ __html: consent.html }} /> : t.consentText}{' '}
          {policy && (
            <a href={policy} className="text-foreground underline underline-offset-4">
              {t.consentPolicy}
            </a>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.novonConsent?.deny()}>
            {t.consentDecline}
          </Button>
          <Button size="sm" onClick={() => window.novonConsent?.allow()}>
            {t.consentAccept}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
