/**
 * The browser-side API of novon: everything a page, a custom component or a
 * theme override can import from `novon`.
 *
 *   import { Callout, Button } from 'novon'
 */
export type { Frontmatter, Heading, PageMeta, SiteData, LayoutKind, Accent, NavLink, Author } from '../types.ts'

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
  Term,
  Frame,
  YouTube,
  mdxComponents,
  type CalloutProps,
  type CalloutType,
  type LinkCardProps,
  type MdxComponents,
} from './mdx.tsx'
export { PostList, PostItem, PostCard, PostCover, PostMeta, PostTags, TagList, TagLink } from './posts.tsx'
export { AuthorAvatar, useAuthor } from './author.tsx'
export { Outline, useActiveHeading } from './outline.tsx'
export { Icon, iconNames, resolveIcon, type IconProps } from './icons.tsx'

/* Site state and navigation. */
export { Link, isInternal, type LinkProps } from './link.tsx'
export { useSite, usePage, useBase, useOverride } from './site.tsx'
export { Brand, Search, ThemeButton, SocialLinks, PageActions, Footer, NotFound, PageContent } from './chrome.tsx'
export { DocsLayout, DocsPage } from './layouts/docs.tsx'
export { BlogLayout } from './layouts/blog.tsx'
export { docsNav, flatten, type NavItem, type NavSection } from './nav.ts'
export { formatDate, withBase, humanize, postsOf, tagRoute } from '../shared.ts'

/* The component library novon is built from, for custom components and overrides. */
export * from '../ui/index.ts'
