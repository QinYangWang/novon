/**
 * The words novon's layouts print, by language. A site picks a set with `lang`
 * and replaces single strings with `theme.labels`. `{n}`, `{date}` and `{novon}`
 * are filled in where the string is used. No Node or React imports here.
 */

export interface Labels {
  onThisPage: string
  backToTop: string
  readingProgress: string
  search: string
  /** The search button's text on wide headers. */
  searchButton: string
  searchPlaceholder: string
  theme: string
  email: string
  mainNav: string
  openNavigation: string
  navigation: string
  documentation: string
  pagination: string
  previous: string
  next: string
  /** `{date}` */
  updated: string
  /** `{n}` */
  minRead: string
  copyPage: string
  copied: string
  morePageActions: string
  viewMarkdown: string
  editPage: string
  askAboutPage: string
  allPosts: string
  latest: string
  allWriting: string
  topics: string
  keepReading: string
  aboutAuthor: string
  follow: string
  /** `{n}`, for one post. */
  postCountOne: string
  /** `{n}` */
  postCount: string
  noPosts: string
  notFound: string
  notFoundTitle: string
  notFoundText: string
  goHome: string
  /** `{novon}` becomes the link. */
  builtWith: string
  video: string
}

export const en: Labels = {
  onThisPage: 'On this page',
  backToTop: 'Back to top',
  readingProgress: 'Reading progress',
  search: 'Search',
  searchButton: 'Search…',
  searchPlaceholder: 'Search the site…',
  theme: 'Theme',
  email: 'Email',
  mainNav: 'Main',
  openNavigation: 'Open navigation',
  navigation: 'Navigation',
  documentation: 'Documentation',
  pagination: 'Pagination',
  previous: 'Previous',
  next: 'Next',
  updated: 'Updated {date}',
  minRead: '{n} min read',
  copyPage: 'Copy page',
  copied: 'Copied',
  morePageActions: 'More page actions',
  viewMarkdown: 'View as Markdown',
  editPage: 'Edit this page',
  askAboutPage: 'Ask about this page',
  allPosts: 'All posts',
  latest: 'Latest',
  allWriting: 'All writing',
  topics: 'Topics',
  keepReading: 'Keep reading',
  aboutAuthor: 'About the author',
  follow: 'Follow',
  postCountOne: '{n} post',
  postCount: '{n} posts',
  noPosts: 'No posts yet.',
  notFound: 'Not found',
  notFoundTitle: "This page doesn't exist",
  notFoundText: 'It may have moved, or the link is mistyped.',
  goHome: 'Go home',
  builtWith: 'Built with {novon}',
  video: 'Video',
}

export const zhCN: Labels = {
  onThisPage: '本页目录',
  backToTop: '回到顶部',
  readingProgress: '阅读进度',
  search: '搜索',
  searchButton: '搜索…',
  searchPlaceholder: '搜索本站…',
  theme: '主题',
  email: '邮箱',
  mainNav: '主导航',
  openNavigation: '打开导航',
  navigation: '导航',
  documentation: '文档',
  pagination: '翻页',
  previous: '上一页',
  next: '下一页',
  updated: '更新于 {date}',
  minRead: '{n} 分钟阅读',
  copyPage: '复制页面',
  copied: '已复制',
  morePageActions: '更多操作',
  viewMarkdown: '查看 Markdown',
  editPage: '编辑此页',
  askAboutPage: '就此页提问',
  allPosts: '全部文章',
  latest: '最新',
  allWriting: '全部文章',
  topics: '话题',
  keepReading: '继续阅读',
  aboutAuthor: '关于作者',
  follow: '关注',
  postCountOne: '{n} 篇文章',
  postCount: '{n} 篇文章',
  noPosts: '还没有文章。',
  notFound: '页面不存在',
  notFoundTitle: '页面不存在',
  notFoundText: '它可能已被移动，或者链接有误。',
  goHome: '返回首页',
  builtWith: '基于 {novon} 构建',
  video: '视频',
}

export const builtinLabels: Record<string, Labels> = { en, 'zh-CN': zhCN }

/** The set for a language tag: exact match, then the language alone (`zh`, `zh-Hans`, `zh-TW` → `zh-CN`), then English. */
export function labelsFor(lang: string, overrides?: Partial<Labels>): Labels {
  const exact = Object.keys(builtinLabels).find((k) => k.toLowerCase() === lang.toLowerCase())
  const primary = lang.toLowerCase().split(/[-_]/)[0]
  const key = exact ?? Object.keys(builtinLabels).find((k) => k.toLowerCase().split('-')[0] === primary)
  const base = builtinLabels[key ?? 'en']
  if (!overrides) return base
  const set = Object.fromEntries(Object.entries(overrides).filter(([, v]) => typeof v === 'string'))
  return { ...base, ...set }
}

/** `fill('{n} posts', { n: 3 })` → `3 posts`. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m))
}
