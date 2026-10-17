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
}

export interface Author {
  bio?: string
  avatar?: string
  url?: string
}

export type OverrideSlot = 'Header' | 'Footer' | 'Sidebar' | 'NotFound' | 'PostHeader'

export type BuiltinPlugin = 'search' | 'sitemap' | 'rss' | 'llms'

export interface NovonPlugin {
  name: string
  /** Runs after every page is written. */
  buildEnd?: (ctx: BuildContext) => void | Promise<void>
}

export interface BuildContext {
  outDir: string
  config: ResolvedConfig
  pages: PageMeta[]
  /** Writes a file relative to the output directory. */
  emit: (path: string, data: string | Uint8Array) => Promise<void>
  /** A page's rendered body HTML, without the layout. */
  renderContent?: (page: PageMeta) => Promise<string>
}

export interface MdxOptions {
  remarkPlugins?: any[]
  rehypePlugins?: any[]
  /** Shiki themes for light and dark. Default github-light / github-dark. */
  highlight?: { light?: string; dark?: string } | false
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
  /** Components available in every MDX file without an import: name → file. */
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

export interface ResolvedConfig extends Config {
  base: string
  lang: string
  layout: LayoutKind
  layers: Layer[]
  nav: NavLink[]
  theme: ThemeOptions & { accent: Accent; toc: boolean }
  rss: Required<RssOptions>
  tags: Required<TagOptions>
  root: string
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
  /** Path of the layer that owns this page, `/` for the default. */
  layer: string
  layout: LayoutKind
  /** Generated pages (post lists, tag pages) have no file. */
  kind: 'page' | 'posts' | 'tag'
  tag?: string
  /** Plain text of the body, for search and llms.txt. Stripped at runtime. */
  text?: string
  headings?: Heading[]
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
  defaultLayout: LayoutKind
  pages: PageMeta[]
  search: boolean
  rss: boolean
  /** Feed URL path, without base. */
  rssPath: string
  tags: Required<TagOptions>
}
