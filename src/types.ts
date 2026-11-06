/** Everything a site can say in `novon.config.ts`. */
import type { Labels } from './labels.ts'

export type { Labels }

export type LayoutKind = 'docs' | 'blog'

export type Accent = 'blue' | 'neutral' | 'green' | 'orange' | 'rose' | 'violet'

export interface Layer {
  /** URL prefix the layer owns, e.g. `/blog`. The longest matching prefix wins. */
  path: string
  layout: LayoutKind
  /** Label used in navigation and feeds. Defaults to the layer's index page title. */
  title?: string
}

export interface NavLink {
  label: string
  href: string
}

export interface ThemeOptions {
  /** Primary colour preset. Default `blue`. */
  accent?: Accent
  /** Base corner radius, any CSS length. Default comes from the theme. */
  radius?: string
  /** Show the "On this page" column on docs pages. Default true. */
  toc?: boolean
  /** Paths under `public/`, e.g. `/logo.svg`. */
  logo?: string
  logoDark?: string
  favicon?: string
  /** Links shown as icons in the header. */
  social?: { github?: string; x?: string; email?: string; rss?: boolean }
  /** `base` + the page's file path gives "Edit this page". */
  editLink?: string
  footer?: { text?: string; links?: NavLink[] }
  /** Blog authors by the name used in frontmatter `author`: a short bio and an avatar under `public/`. */
  authors?: Record<string, Author>
  /** Extra stylesheets, relative to the site root. */
  css?: string[]
  /** Replace single built-in strings; the rest follow `lang`. */
  labels?: Partial<Labels>
  /** Replace a built-in part with your own component file. */
  override?: Partial<Record<OverrideSlot, string>>
  /**
   * The page actions menu, in order. `copy` is the button beside it.
   * Default `['copy', 'markdown', 'pdf', 'listen', 'edit', 'chatgpt', 'claude', 'perplexity']`; `false` hides it.
   */
  pageActions?: PageAction[] | false
  /** Show the last-updated date on pages. Default true. */
  lastUpdated?: boolean
  /** Open Markdown images full size on click. Default true. */
  imageZoom?: boolean
}

/**
 * A built-in page action, or a link of your own. In `href`, `{markdown}` is the
 * page's absolute `.md` URL, `{url}` the page URL and `{prompt}` the encoded
 * "read this page" prompt.
 */
export type PageAction = 'copy' | 'markdown' | 'pdf' | 'listen' | 'edit' | 'chatgpt' | 'claude' | 'perplexity' | { label: string; href: string }

/** An extra element for `<head>`. */
export interface HeadTag {
  tag: 'meta' | 'link' | 'script' | 'style' | 'noscript'
  attrs?: Record<string, string | boolean>
  /** Inner text, for `script`, `style` and `noscript`. */
  content?: string
}

export interface Author {
  bio?: string
  avatar?: string
  url?: string
}

export type OverrideSlot = 'Header' | 'Footer' | 'Sidebar' | 'NotFound' | 'PostHeader'

export type BuiltinPlugin = 'search' | 'sitemap' | 'rss' | 'llms'

/**
 * A plugin: a name and any of the hooks below. Hooks run in the order plugins
 * are listed, built-in ones first.
 */
export interface NovonPlugin {
  name: string
  /** Change the resolved config; return a new one or edit it in place. Runs once, when the config loads. */
  config?: (config: ResolvedConfig) => ResolvedConfig | void | Promise<ResolvedConfig | void>
  /** Runs before a build starts. */
  buildStart?: (ctx: HookContext) => void | Promise<void>
  /** Change a page's source before it is compiled, indexed, checked or written as Markdown. */
  transformContent?: (source: string, ctx: ContentContext) => string | void | Promise<string | void>
  /** Add to or change a page's data after its frontmatter is read. */
  pageData?: (page: PageMeta, ctx: PageDataContext) => PageMeta | void | Promise<PageMeta | void>
  /** Extra `<head>` elements for a page; `page` is null on the 404 page. */
  head?: (page: PageMeta | null, ctx: HookContext & { pages: PageMeta[] }) => HeadTag[] | void
  /** Files the site serves besides pages, by path (`api/pages.json`); served by `novon dev` and written by the build. */
  routes?: (ctx: RoutesContext) => Record<string, string | Uint8Array> | void | Promise<Record<string, string | Uint8Array> | void>
  /** Markdown and HTML plugins for every page, after novon's own. */
  remarkPlugins?: any[]
  rehypePlugins?: any[]
  /** Runs after every page is written. */
  buildEnd?: (ctx: BuildContext) => void | Promise<void>
}

export interface HookContext {
  config: ResolvedConfig
}

export interface RoutesContext extends HookContext {
  pages: PageMeta[]
  /** Folder settings from `_meta` files. */
  folders: Record<string, FolderMeta>
  /** A page as plain Markdown, as written to `<route>.md`. */
  markdown: (page: PageMeta) => Promise<string>
}

export interface ContentContext extends HookContext {
  /** File path relative to the site root. */
  file: string
}

export interface PageDataContext extends ContentContext {
  frontmatter: Frontmatter
}

export interface BuildContext {
  outDir: string
  config: ResolvedConfig
  pages: PageMeta[]
  /** Writes a file relative to the output directory. */
  emit: (path: string, data: string | Uint8Array) => Promise<void>
  /** A page's rendered body HTML, without the layout. */
  renderContent?: (page: PageMeta) => Promise<string>
  /** A page as plain Markdown, as written to `<route>.md`. Cached per build. */
  markdown?: (page: PageMeta) => Promise<string>
}

export interface MdxOptions {
  remarkPlugins?: any[]
  rehypePlugins?: any[]
  /** Code themes for light and dark. Default github-light / github-dark. */
  highlight?: { light?: string; dark?: string } | false
  /** Number the lines of every code block. A fence's `lineNumbers` or `lineNumbers=false` wins. Default false. */
  lineNumbers?: boolean
  /** `$…$` and `$$…$$` math, rendered at build time. `false` turns it off; `{ singleDollar: false }` keeps single dollars as text. Default true. */
  math?: boolean | { singleDollar?: boolean }
  /** ` ```mermaid ` fences become diagrams, drawn in the browser. Default true. */
  mermaid?: boolean
}

/** Social cards: a 1200×630 PNG per page at `/og/<route>.png`. */
export interface OgOptions {
  /** Default true. */
  enabled?: boolean
  /**
   * Local TTF, OTF or WOFF files relative to the site root, for offline builds:
   * one file, `[regular, bold]`, or `{ path, weight }` entries. Without it a
   * subset of a web font is downloaded per card and cached.
   */
  font?: string | (string | { path: string; weight?: 400 | 700 })[]
  /** Web font family when `font` is unset. Default follows `lang` (Noto Sans SC, JP, KR or TC). */
  family?: string
  /** Default `light`. */
  mode?: 'light' | 'dark'
  /** Default `theme.accent`. */
  accent?: Accent
}

export interface Config {
  title: string
  description?: string
  /** Absolute site URL, used for sitemap, feeds and canonical links. */
  url?: string
  /** Sub-path the site is served from, e.g. `/docs/`. Default `/`. */
  base?: string
  lang?: string
  /** Default layout for every page. Default `docs`. */
  layout?: LayoutKind
  /** Mount other layouts by URL prefix. */
  layers?: Layer[]
  /** Top navigation. */
  nav?: NavLink[]
  theme?: ThemeOptions
  /** Components available in every MDX file without an import: name → file (its default export), or `file#Name` for a named export. */
  components?: Record<string, string>
  plugins?: (BuiltinPlugin | NovonPlugin)[]
  mdx?: MdxOptions
  /** Social cards. On by default; `false` turns them off. */
  og?: boolean | OgOptions
  /** `false` writes `guide.html` instead of `guide/index.html`. Links never end in a slash. */
  trailingSlash?: boolean
  /** The feed the `rss` plugin writes. */
  rss?: RssOptions
  /** Tag pages of blog layers. */
  tags?: TagOptions
  /** Old path → new path or URL. Written to `_redirects` and as redirect pages. */
  redirects?: Record<string, string>
  /** Extra elements for every page's `<head>`. */
  head?: HeadTag[]
  /** Values for `{{name}}` in pages and partials. */
  variables?: Record<string, string | number | boolean>
  /** A site-wide announcement above the header. */
  banner?: BannerOptions | string | false
  /** Analytics scripts. Page views of in-site navigation are sent by each script's own history tracking. */
  analytics?: AnalyticsOptions
  /** Ask before loading analytics: the scripts stay inert until the reader allows them. Only with `analytics`. */
  consent?: ConsentOptions | boolean
  /** Files for coding agents and AI tools. */
  agents?: AgentOptions | false
  /** Fail the build when the JavaScript or CSS a page loads first is larger, gzipped. Numbers are bytes; strings like `200 kB`. */
  budget?: { js?: number | string; css?: number | string }
  /** More than one language: `content/<locale>/…` holds each translation; the default locale stays at the root. */
  i18n?: I18nOptions
  /** Frozen docs versions under `content/_versions/<id>`, served at `/<id>/…`. Made with `novon version <id>`. */
  versions?: VersionsOptions
  /** Content from elsewhere: another git repository, Markdown URLs, GitHub releases. Cached by `novon sync`. */
  sources?: SourceOptions[]
  /** API reference pages generated from OpenAPI 3 descriptions. */
  openapi?: OpenApiOptions | OpenApiOptions[]
  /** Event API reference pages generated from AsyncAPI 2 or 3 descriptions. */
  asyncapi?: AsyncApiOptions | AsyncApiOptions[]
  /** GraphQL reference pages generated from a schema (SDL) or an introspection result. */
  graphql?: GraphqlOptions | GraphqlOptions[]
  /** A "Was this helpful?" widget on pages. It only sends; you choose where. */
  feedback?: FeedbackOptions | false
}

export interface AsyncApiOptions {
  /** An AsyncAPI 2.x or 3.x file (JSON or YAML), relative to the site root, or a URL (cached by `novon sync`). */
  spec: string
  /** URL prefix for the reference, e.g. `/events`. */
  path: string
  /** Overview page title. Default: the description's `info.title`. */
  title?: string
}

export interface GraphqlOptions {
  /** A schema file (`.graphql`, SDL) or an introspection result (`.json`), relative to the site root, or a URL (cached by `novon sync`). */
  schema: string
  /** URL prefix for the reference, e.g. `/graphql`. */
  path: string
  /** Overview page title. Default `GraphQL API`. */
  title?: string
  /** The endpoint shown on the overview page and in examples. */
  endpoint?: string
}

export interface LocaleOptions {
  /** Name in the language switcher, e.g. `日本語`. */
  label: string
  /** BCP 47 tag for `<html lang>` and built-in strings. Default: the locale code. */
  lang?: string
  /** Text direction. Default `ltr`. */
  dir?: 'ltr' | 'rtl'
  /** Site title and description in this language. */
  title?: string
  description?: string
  /** Top navigation in this language. Default: `nav`, each link pointed at its translation when there is one. */
  nav?: NavLink[]
  /** Replace single built-in strings in this language. */
  labels?: Partial<Labels>
  /** Banner text in this language. */
  banner?: string
}

export interface I18nOptions {
  /** The locale at the root of the site. Default `lang`. */
  defaultLocale?: string
  /** Locale code (the URL segment) → its name or options. Include the default locale. */
  locales: Record<string, string | LocaleOptions>
  /** Serve the default-locale page, marked as untranslated, where a translation is missing. Default true. */
  fallback?: boolean
}

export interface ResolvedLocale extends LocaleOptions {
  code: string
  lang: string
  dir: 'ltr' | 'rtl'
}

export interface ResolvedI18n {
  defaultLocale: string
  locales: ResolvedLocale[]
  fallback: boolean
}

export interface VersionOption {
  /** URL segment and folder name, e.g. `v1`. */
  id: string
  /** Name in the version switcher. Default: the id. */
  label?: string
  /** Not in the switcher, search, sitemap or llms.txt; pages still build. */
  hidden?: boolean
  /** Listed, but left out of search, sitemap and llms.txt, with an "archived" banner. */
  archived?: boolean
}

export interface VersionsOptions {
  /** Name of the current docs in the switcher. Default `Latest`. */
  latest?: string
  /** Older versions, newest first. */
  list: (string | VersionOption)[]
}

export interface ResolvedVersions {
  latest: string
  list: (VersionOption & { label: string })[]
}

/** Where outside content comes from. Each source is mounted at `path`. */
export type SourceOptions = GitSource | RemoteFilesSource | ReleasesSource | NotionSource | HttpSource | CustomSource

interface SourceBase {
  /** Cache folder name. Default: derived from the source. */
  name?: string
  /** URL prefix the pages are served under, e.g. `/sdk`. */
  path: string
}

export interface GitSource extends SourceBase {
  type: 'git'
  /** Clone URL. */
  repo: string
  /** Branch, tag or commit. Default: the remote's default branch. */
  ref?: string
  /** Folder inside the repository holding the pages. Default: the root. */
  dir?: string
  /** "Edit this page" base for these pages, e.g. `https://github.com/acme/sdk/edit/main/docs`. */
  editLink?: string
}

export interface RemoteFilesSource extends SourceBase {
  type: 'files'
  /** Page path (relative to `path`, without extension) → Markdown or MDX URL. */
  files: Record<string, string>
}

export interface ReleasesSource extends SourceBase {
  type: 'github-releases'
  /** `owner/name`. */
  repo: string
  /** Page title. Default `Changelog`. */
  title?: string
  description?: string
  /** Environment variable holding a token, for private repositories or rate limits. Default `GITHUB_TOKEN`. */
  tokenEnv?: string
  /** Newest releases to keep. Default 50. */
  limit?: number
  /** Include pre-releases. Default true. */
  prereleases?: boolean
}

/** A page a source produces. */
export interface SourcePage {
  /** Path relative to the source's `path`, without extension; `index` is its root page. */
  path: string
  title?: string
  description?: string
  /** The page body. */
  content: string
  /** `md` (default) is plain Markdown; `mdx` allows components. */
  format?: 'md' | 'mdx'
  /** More frontmatter: `date`, `tags`, `order`, … */
  frontmatter?: Record<string, unknown>
}

export interface SourceContext {
  config: ResolvedConfig
  /** The global fetch, with a `user-agent`. */
  fetch: typeof fetch
  env: Record<string, string | undefined>
}

export interface NotionSource extends SourceBase {
  type: 'notion'
  /** Page IDs or URLs; each becomes a page, the first one the source's index. */
  pages?: string[]
  /** A database ID or URL; each row becomes a page named after its title (or a `slug` property). */
  database?: string
  /** Environment variable holding the integration token. Default `NOTION_TOKEN`. */
  tokenEnv?: string
}

export interface HttpSource extends SourceBase {
  type: 'http'
  /** A URL returning JSON. */
  url: string
  headers?: Record<string, string>
  /** Environment variable holding a bearer token. */
  tokenEnv?: string
  /** Dot path to the array of items in the response, e.g. `data.posts`. Default: the response itself. */
  items?: string
  /** Turns an item into a page: field names (dot paths), or a function. Default `{ path: 'slug', title: 'title', content: 'content' }`. */
  map?: { path: string; content: string; title?: string; description?: string; date?: string } | ((item: any, index: number) => SourcePage | null | undefined)
}

export interface CustomSource extends SourceBase {
  type: 'custom'
  /** What the source is, for messages and the cache name, e.g. `sanity`. */
  kind: string
  load: (ctx: SourceContext) => SourcePage[] | Promise<SourcePage[]>
}

export interface OpenApiOptions {
  /** An OpenAPI 3.0 or 3.1 file (JSON or YAML), relative to the site root, or a URL (cached by `novon sync`). */
  spec: string
  /** URL prefix for the reference, e.g. `/api`. */
  path: string
  /** Overview page title. Default: the description's `info.title`. */
  title?: string
  /** Code samples, in order. Default `['curl', 'javascript', 'python']`. */
  samples?: ('curl' | 'javascript' | 'python' | 'go')[]
  /** Base URL used in samples. Default: the first `servers` entry. */
  server?: string
}

export interface FeedbackOptions {
  /**
   * Where a response goes. A URL template opens in a new tab with `{page}`, `{url}`, `{title}`,
   * `{mood}`, `{message}` filled in (a new GitHub issue, a form). `post:` + URL sends JSON instead.
   */
  href?: string
  /** Also send an analytics event with this name to every configured provider that takes events. Default `feedback`. */
  event?: string | false
  /** Show it on docs pages, blog posts, or both. Default `docs`. */
  on?: 'docs' | 'blog' | 'all'
}

export interface BannerOptions {
  /** Inline Markdown: `**bold**`, `` `code` ``, `[links](/x)`. */
  text: string
  /** Makes the whole banner a link. */
  href?: string
  /** Show a close button; a closed banner stays closed until its `id` changes. Default true. */
  dismissible?: boolean
  /** Change it to show a closed banner again. Default: derived from `text`. */
  id?: string
}

export interface ConsentOptions {
  /** The banner's text, inline Markdown. Default: a built-in sentence in the site's language. */
  text?: string
  /** Link to the privacy or cookie policy, shown in the banner. */
  policy?: string
  /** Change it to ask again; each version is stored as `novon:consent:<version>`. Default `1`. */
  version?: string | number
}

export interface AnalyticsOptions {
  plausible?: { domain: string; src?: string }
  umami?: { websiteId: string; src?: string }
  /** Google Analytics 4 measurement ID, `G-…`. */
  ga4?: string | { id: string }
  /** Cloudflare Web Analytics token. */
  cloudflare?: string | { token: string }
  /** PostHog project key; `host` defaults to `https://us.i.posthog.com`. */
  posthog?: { key: string; host?: string }
  /** Fathom site ID, or `{ site, src }` for a custom domain. */
  fathom?: string | { site: string; src?: string }
  /** Simple Analytics: `true`, or `{ src, hostname }`. */
  simpleAnalytics?: true | { src?: string; hostname?: string }
  /** Matomo (cloud or self-hosted): the tracker's base URL and site ID. */
  matomo?: { url: string; siteId: string | number }
  /** Any other script: a URL, or head elements. */
  custom?: string | HeadTag[]
}

export interface AgentOptions {
  /** A folder of agent skills to publish, each a subfolder with a `SKILL.md`. Default `skills` when it exists. */
  skills?: string | false
  /** Generate a skill describing the site at `/skill.md`. Needs `url`. Default true. */
  skill?: boolean
  /** Discovery manifest (`/.well-known/ard.json`, `ai-catalog.json`) and API catalog (`/.well-known/api-catalog`). Needs `url`. Default true. */
  discovery?: boolean
  /** The static JSON API under `/api/` and its `/openapi.json`. Default true. */
  api?: boolean
  /** Register search and page tools with an agent in the reader's browser (WebMCP). Default true. */
  webmcp?: boolean
}

/** A folder's `_meta.ts`: how it appears in the sidebar. */
export interface Meta {
  /** Section or group label. Default: the folder's index page label, else its name. */
  title?: string
  /** Position among its siblings. */
  order?: number
  icon?: string
  badge?: string
  /** Start folded. Default false. */
  collapsed?: boolean
  /**
   * Children in order, by file or folder name without extension. `'...'` stands for
   * the rest in their usual order; without it the rest follow. A `{ group, pages }`
   * entry puts pages under a small label; a `{ title, href }` entry is an external link.
   */
  pages?: (string | MetaGroup | MetaLink)[]
  /** Per child: a sidebar title, a badge, or `hidden` to leave it out of navigation, search and feeds. */
  items?: Record<string, { title?: string; badge?: string; icon?: string; hidden?: boolean }>
}

export interface MetaGroup {
  group: string
  pages: string[]
}

export interface MetaLink {
  title: string
  href: string
}

/** What the sidebar needs to know about one folder. */
export interface FolderMeta {
  title?: string
  order?: number
  icon?: string
  badge?: string
  collapsed?: boolean
  /** Group label → the routes under it, in order. */
  groups?: { label: string; routes: string[] }[]
  /** External links and where they go: after the route, or first. */
  links?: { title: string; href: string; after?: string }[]
}

export interface RssOptions {
  /** Default `/rss.xml`. */
  path?: string
  /** Put each post's full HTML in the feed. Default false. */
  full?: boolean
}

export interface TagOptions {
  /** Segment under the blog layer. Default `/tags`. */
  path?: string
  /** Lowercase tag URLs. Default true. */
  lowercase?: boolean
}

export interface ResolvedConfig extends Omit<Config, 'i18n' | 'versions'> {
  base: string
  lang: string
  layout: LayoutKind
  layers: Layer[]
  nav: NavLink[]
  theme: ThemeOptions & { accent: Accent; toc: boolean }
  rss: Required<RssOptions>
  tags: Required<TagOptions>
  redirects: Record<string, string>
  variables: Record<string, string | number | boolean>
  root: string
  /** The layers as written, before locales and versions added theirs. */
  baseLayers: Layer[]
  i18n?: ResolvedI18n
  versions?: ResolvedVersions
}

export interface Frontmatter {
  title?: string
  description?: string
  /** Sidebar label when it should differ from the title. */
  label?: string
  /** Lower numbers come first in the sidebar. */
  order?: number
  icon?: string
  date?: string
  updated?: string
  tags?: string[]
  author?: string
  /** An image under `public/`; `false` for no cover. Without it a post gets generated cover art. */
  cover?: string | false
  draft?: boolean
  /** Share image: a path under `public/` or a URL. Replaces the generated card. */
  image?: string | false
  /** `false`: no generated card and no share image for this page. */
  og?: boolean
  /** Leave the page out of navigation, search and feeds. */
  hidden?: boolean
  /** Ask search engines not to index the page; also leaves it out of the sitemap and llms.txt. */
  noindex?: boolean
  /** Old paths that redirect here. */
  redirectFrom?: string | string[]
  /** Extra elements for this page's `<head>`. */
  head?: HeadTag[]
  /** A short tag beside the sidebar link, e.g. `New`. */
  badge?: string
  /** `changelog`: each `##` section is a release on a timeline, and the page gets a feed. */
  layout?: 'changelog'
  /** `false` hides the feedback widget on this page. */
  feedback?: boolean
  [key: string]: unknown
}

export interface Heading {
  depth: number
  id: string
  text: string
}

/** One page, known before any MDX is compiled. */
export interface PageMeta {
  /** URL path without base, e.g. `/guide/writing`. */
  route: string
  /** File path relative to the site root, e.g. `content/guide/writing.mdx`. */
  file: string
  title: string
  description?: string
  label: string
  order: number
  icon?: string
  date?: string
  updated?: string
  tags: string[]
  author?: string
  cover?: string | false
  /** Frontmatter `image`. */
  image?: string
  /** `false` when the page opts out of share images. */
  og?: false
  /** Estimated minutes to read the body. */
  readingTime?: number
  hidden: boolean
  noindex?: boolean
  /** Old routes that redirect here, from frontmatter `redirectFrom`. */
  redirectFrom?: string[]
  /** Frontmatter `head`. */
  head?: HeadTag[]
  /** Sidebar badge, from frontmatter or `_meta.ts`. */
  badge?: string
  /** Path of the layer that owns this page, `/` for the default. */
  layer: string
  layout: LayoutKind
  /** Generated pages (post lists, tag pages) have no file. */
  kind: 'page' | 'posts' | 'tag'
  tag?: string
  /** Plain text of the body, for search and llms.txt. Stripped at runtime. */
  text?: string
  headings?: Heading[]
  /** Extra data from plugins' `pageData`. */
  data?: Record<string, unknown>
  /** Locale code, when the site has `i18n`. */
  locale?: string
  /** Version id for a frozen version; unset for the current docs. */
  version?: string
  /** The route without its locale and version segments: the same page in every language and version shares it. */
  key?: string
  /** A default-locale page served at a locale's route because it has no translation yet. */
  fallback?: boolean
  /** "Edit this page" URL when it is not `theme.editLink` + file; empty for none. */
  editUrl?: string
  /** Frontmatter `layout: changelog`. */
  changelog?: boolean
  /** Frontmatter `feedback: false`. */
  feedback?: false
}

/** The runtime's view of the site, serialised into the client bundle. */
export interface SiteData {
  title: string
  description?: string
  url?: string
  base: string
  lang: string
  nav: NavLink[]
  theme: ResolvedConfig['theme']
  layers: Layer[]
  /** Layers as written, before locales and versions added theirs. */
  baseLayers?: Layer[]
  defaultLayout: LayoutKind
  pages: PageMeta[]
  search: boolean
  rss: boolean
  /** Feed URL path, without base. */
  rssPath: string
  tags: Required<TagOptions>
  /** Internal redirects, old route → new route or URL, followed by in-page navigation. */
  redirects: Record<string, string>
  /** Folder settings from `_meta.ts` files, by folder route. */
  folders: Record<string, FolderMeta>
  banner?: { html: string; href?: string; dismissible: boolean; id: string }
  /** WebMCP tools are registered. */
  webmcp: boolean
  i18n?: ResolvedI18n
  versions?: ResolvedVersions
  feedback?: FeedbackOptions
  /** The consent banner, when `consent` and `analytics` are both set. */
  consent?: { html?: string; policy?: string; version: string }
}
