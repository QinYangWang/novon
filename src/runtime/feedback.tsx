/**
 * Page feedback from config `feedback`: a mood and a note, sent where the site
 * says (a URL template opened in a new tab, a `post:` endpoint, an analytics
 * event). novon runs no server of its own.
 */
import * as React from 'react'
import { FeedbackWidget, type FeedbackData } from '@/components/feedback-widget'
import { withBase } from '../shared.ts'
import type { FeedbackOptions, PageMeta, SiteData } from '../types.ts'
import { useLabels, useSite } from './site.tsx'
import { track } from './track.ts'

/** Fills `{page}`, `{url}`, `{title}`, `{mood}` and `{message}`, URL-encoded. */
export function feedbackHref(template: string, values: Record<string, string>): string {
  return template.replace(/\{(page|url|title|mood|message)\}/g, (_m, k: string) => encodeURIComponent(values[k] ?? ''))
}

/** Whether a page shows the widget. */
export function showsFeedback(options: FeedbackOptions | undefined, page: PageMeta | null): boolean {
  if (!options || !page || page.kind !== 'page' || page.feedback === false) return false
  const on = options.on ?? 'docs'
  return on === 'all' || on === page.layout
}

export async function sendFeedback(site: SiteData, page: PageMeta, data: FeedbackData): Promise<void> {
  const options = site.feedback ?? {}
  const url = typeof location === 'undefined' ? withBase(site.base, page.route) : location.href.split('#')[0]
  const values = { page: page.route, url, title: page.title, mood: data.mood ?? '', message: data.message }
  const event = options.event === false ? null : (options.event ?? 'feedback')
  if (event) track(event, { page: page.route, mood: values.mood })
  const href = options.href
  if (!href) return
  if (href.startsWith('post:')) {
    const res = await fetch(href.slice(5), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values), keepalive: true })
    if (!res.ok) throw new Error(`feedback endpoint returned ${res.status}`)
    return
  }
  window.open(feedbackHref(href, values), '_blank', 'noopener')
}

/** "Was this helpful?" at the end of the page, when `feedback` is set and the page takes it. */
export function PageFeedback({ page }: { page: PageMeta }) {
  const { site } = useSite()
  const t = useLabels()
  if (!showsFeedback(site.feedback, page)) return null
  return (
    <div data-novon-chrome="" data-novon-feedback="">
      <FeedbackWidget
        key={page.route}
        placement="inline"
        bordered={false}
        label={t.feedback}
        title={t.feedbackTitle}
        placeholder={t.feedbackPlaceholder}
        successTitle={t.feedbackThanks}
        successDescription={t.feedbackThanksText}
        onSubmit={(data) => sendFeedback(site, page, data)}
      />
    </div>
  )
}
