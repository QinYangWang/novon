/**
 * The analytics consent banner from config `consent`. The head script keeps the
 * analytics scripts inert and exposes `window.novonConsent`; the banner asks
 * once per consent version (its storage key) and shows again after
 * `novonConsent.reset()`.
 */
import { ConsentBanner as Banner } from '@/ui/consent-banner'
import { withBase } from '../shared.ts'
import { useSite } from './site.tsx'

type Choice = 'granted' | 'denied' | null

export interface NovonConsent {
  version: string
  /** The storage key, `novon:consent:<version>`. */
  key: string
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

/** Above the read-aloud bar: a higher order sits closer to the bottom edge. */
export const CONSENT_ORDER = 10

export function ConsentBanner() {
  const { site } = useSite()
  const consent = site.consent
  if (!consent) return null
  const policy = consent.policy && (/^[a-z][a-z0-9+.-]*:/i.test(consent.policy) ? consent.policy : withBase(site.base, consent.policy))
  // The banner writes the answer under the version's key; the head script hears it and runs or holds the scripts.
  return <Banner data-novon-chrome="" storageKey={`novon:consent:${consent.version}`} text={consent.text} policyHref={policy || undefined} order={CONSENT_ORDER} />
}
