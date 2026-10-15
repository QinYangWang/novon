/** Everything a site can say in `novon.config.ts`. */

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
  /** Extra stylesheets, relative to the site root. */
  css?: string[]
  /** Replace a built-in part with your own component file. */
  override?: Partial<Record<OverrideSlot, string>>
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
}

export interface MdxOptions {
  remarkPlugins?: any[]
  rehypePlugins?: any[]
  /** Shiki themes for light and dark. Default github-light / github-dark. */
  highlight?: { light?: string; dark?: string } | false
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
}

export interface ResolvedConfig extends Config {
  base: string
  lang: string
  layout: LayoutKind
  layers: Layer[]
  nav: NavLink[]
  theme: ThemeOptions & { accent: Accent; toc: boolean }
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
  cover?: string
  draft?: boolean
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
  cover?: string
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
}
