/**
 * Changelog pages (`layout: changelog`): every `##` heading is a release. A
 * heading may carry its date, `## 1.2.0 (2026-11-01)` or `## 1.2.0 · 2026-11-01`;
 * the page renders as a timeline and gets a feed at `<route>/rss.xml`.
 */
import matter from 'gray-matter'
import { pageSections } from './search-index.ts'
import { splitReleaseHeading } from '../shared.ts'

export { splitReleaseHeading }

export interface ChangelogEntry {
  /** Heading text without its date. */
  title: string
  date?: string
  anchor: string
  /** Plain text of the release notes. */
  text: string
}

export function changelogEntries(source: string, mdx = true): ChangelogEntry[] {
  const { content } = matter(source)
  const { sections } = pageSections(content, mdx)
  return sections.filter((s) => s.depth === 2).map((s) => ({ ...splitReleaseHeading(s.heading), anchor: s.anchor, text: s.text }))
}

export function changelogFeedPath(route: string): string {
  return `${route === '/' ? '' : route}/rss.xml`
}
