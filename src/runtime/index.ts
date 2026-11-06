/**
 * The browser-side API of novon: everything a page, a custom component or a
 * theme override can import from `novon`.
 *
 *   import { Callout, Button } from 'novon'
 */
export type { Frontmatter, Heading, PageMeta, SiteData, LayoutKind, Accent, NavLink, Author, PageAction, HeadTag, Meta, FolderMeta, I18nOptions, LocaleOptions, VersionsOptions, VersionOption, SourceOptions, OpenApiOptions, FeedbackOptions } from '../types.ts'

/* Writing components (also available in MDX without an import). */
export {
  Callout,
  Note,
  Tip,
  Info,
  Warning,
  Caution,
  Danger,
  LinkCard,
  CardGroup,
  Columns,
  Steps,
  Step,
  Tabs,
  Tab,
  Accordion,
  AccordionGroup,
  Pre,
  CodeGroup,
  PackageInstall,
  Term,
  Frame,
  YouTube,
  mdxComponents,
  type CalloutProps,
  type CalloutType,
  type LinkCardProps,
  type PackageInstallProps,
  type MdxComponents,
} from './mdx.tsx'
export { TypeTable, Field, Diff, Prompt, ImageZoom, Mermaid, Banner, toUnifiedDiff, type TypeTableEntry, type FieldProps, type DiffProps, type PromptProps, type ImageZoomProps } from './extras.tsx'
export { ApiEndpoint, ApiMethod, Changelog, ChangelogEntry, type ApiEndpointProps } from './reference.tsx'
export { LanguageSwitcher, VersionSwitcher, VersionNotice, FallbackNotice, localizeSite, localizeHref } from './i18n.tsx'
export { PageFeedback, sendFeedback, feedbackHref } from './feedback.tsx'
export { search, tokenize, loadSearchIndex, type SearchEntry, type SearchResult } from './search.ts'
export { PostList, PostItem, PostCard, PostCover, PostMeta, PostTags, TagList, TagLink } from './posts.tsx'
export { AuthorAvatar, useAuthor } from './author.tsx'
export { Outline, OutlinePopover, outlineItems, useActiveHeading, type OutlineItem, type OutlineProps, type OutlinePopoverProps } from './outline.tsx'
export { Icon, iconNames, resolveIcon, type IconProps } from './icons.tsx'

/* Site state and navigation. */
export { Link, isInternal, type LinkProps } from './link.tsx'
export { useSite, usePage, useBase, useOverride, useLabels } from './site.tsx'
export { labelsFor, fill, type Labels } from '../labels.ts'
export { Brand, Search, ThemeButton, SocialLinks, PageActions, Footer, NotFound, PageContent } from './chrome.tsx'
export { DocsLayout, DocsPage } from './layouts/docs.tsx'
export { BlogLayout } from './layouts/blog.tsx'
export { docsNav, flatten, type NavItem, type NavSection } from './nav.ts'
export { formatDate, withBase, humanize, postsOf, tagRoute, packageCommands, buildRoute, counterpart, splitReleaseHeading, type PackageCommandOptions } from '../shared.ts'

/* The component library novon is built from, for custom components and overrides. */
export * from '../ui/index.ts'
