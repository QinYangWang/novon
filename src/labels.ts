/**
 * The words novon's layouts print, by language. A site picks a set with `lang`
 * and replaces single strings with `theme.labels`. `{n}`, `{date}` and `{novon}`
 * are filled in where the string is used. No Node or React imports here.
 */

export interface Labels {
  /** The outline's heading. The library has it in every language; set it only to replace it. */
  onThisPage?: string
  /** The outline's back-to-top link. The library has it in every language; set it only to replace it. */
  backToTop?: string
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
  /** The read-aloud page action and its bar. */
  viewMarkdown: string
  editPage: string
  askAboutPage: string
  /** `{name}`, e.g. ChatGPT. */
  openIn: string
  /** The question sent with "Open in"; `{url}` is the page's Markdown URL. */
  openInPrompt: string
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
  /** Page action that opens the print dialog, where the page can be saved as PDF. */
  downloadPdf: string
  dismissBanner: string
  zoomImage: string
  closeImage: string
  prompt: string
  copyPrompt: string
  diagram: string
  diagramError: string
  property: string
  type: string
  default: string
  description: string
  required: string
  /** `{version}` */
  outdatedVersion: string
  /** `{version}` */
  archivedVersion: string
  viewLatest: string
  /** `{language}`, `{original}` */
  untranslated: string
  /** The feedback button. */
  feedback: string
  feedbackTitle: string
  feedbackPlaceholder: string
  feedbackThanks: string
  feedbackThanksText: string
  releases: string
  /** The header's feed button. */
  rssFeed: string
  /** Link to a changelog's feed. */
  subscribe: string
  apiEndpoints: string
  apiParameters: string
  apiPathParameters: string
  apiQueryParameters: string
  apiHeaderParameters: string
  apiCookieParameters: string
  apiRequestBody: string
  apiResponses: string
  apiAuthentication: string
  apiExamples: string
  apiServers: string
  apiChannels: string
  apiOperations: string
  apiMessages: string
  apiPayload: string
  apiMessageHeaders: string
  apiChannelParameters: string
  apiSend: string
  apiReceive: string
  apiQueries: string
  apiMutations: string
  apiSubscriptions: string
  apiTypes: string
  apiArguments: string
  apiFields: string
  apiReturns: string
  apiValues: string
  apiImplements: string
  apiMembers: string
  apiImplementedBy: string
}

export const en: Labels = {
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
  openIn: 'Open in {name}',
  openInPrompt: 'Read {url} and answer questions about it.',
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
  downloadPdf: 'Download PDF',
  dismissBanner: 'Dismiss',
  zoomImage: 'Zoom image',
  closeImage: 'Close image',
  prompt: 'Prompt',
  copyPrompt: 'Copy prompt',
  diagram: 'Diagram',
  diagramError: 'This diagram could not be drawn.',
  property: 'Property',
  type: 'Type',
  default: 'Default',
  description: 'Description',
  required: 'Required',
  outdatedVersion: 'You are reading the docs for {version}.',
  archivedVersion: '{version} is archived and no longer updated.',
  viewLatest: 'Go to the latest version',
  untranslated: 'This page is not translated into {language} yet; it is shown in {original}.',
  rssFeed: 'RSS feed',
  feedback: 'Feedback',
  feedbackTitle: 'Was this page helpful?',
  feedbackPlaceholder: 'What could be better?',
  feedbackThanks: 'Thanks for the feedback',
  feedbackThanksText: 'It helps make these pages better.',
  releases: 'Releases',
  subscribe: 'Subscribe',
  apiEndpoints: 'Endpoints',
  apiParameters: 'Parameters',
  apiPathParameters: 'Path parameters',
  apiQueryParameters: 'Query parameters',
  apiHeaderParameters: 'Headers',
  apiCookieParameters: 'Cookies',
  apiRequestBody: 'Request body',
  apiResponses: 'Responses',
  apiAuthentication: 'Authentication',
  apiExamples: 'Examples',
  apiServers: 'Servers',
  apiChannels: 'Channels',
  apiOperations: 'Operations',
  apiMessages: 'Messages',
  apiPayload: 'Payload',
  apiMessageHeaders: 'Message headers',
  apiChannelParameters: 'Channel parameters',
  apiSend: 'Send',
  apiReceive: 'Receive',
  apiQueries: 'Queries',
  apiMutations: 'Mutations',
  apiSubscriptions: 'Subscriptions',
  apiTypes: 'Types',
  apiArguments: 'Arguments',
  apiFields: 'Fields',
  apiReturns: 'Returns',
  apiValues: 'Values',
  apiImplements: 'Implements',
  apiMembers: 'Members',
  apiImplementedBy: 'Implemented by',
}

export const zhCN: Labels = {
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
  openIn: '在 {name} 中打开',
  openInPrompt: '阅读 {url}，然后回答关于它的问题。',
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
  downloadPdf: '下载 PDF',
  dismissBanner: '关闭',
  zoomImage: '放大图片',
  closeImage: '关闭图片',
  prompt: '提示词',
  copyPrompt: '复制提示词',
  diagram: '图表',
  diagramError: '图表无法绘制。',
  property: '属性',
  type: '类型',
  default: '默认值',
  description: '说明',
  required: '必填',
  outdatedVersion: '你正在阅读 {version} 版本的文档。',
  archivedVersion: '{version} 已归档，不再更新。',
  viewLatest: '查看最新版本',
  untranslated: '此页尚未翻译成{language}，以下为{original}原文。',
  rssFeed: 'RSS 订阅',
  feedback: '反馈',
  feedbackTitle: '这页内容有帮助吗？',
  feedbackPlaceholder: '有什么可以改进的？',
  feedbackThanks: '感谢你的反馈',
  feedbackThanksText: '这能帮助我们改进文档。',
  releases: '版本记录',
  subscribe: '订阅',
  apiEndpoints: '接口',
  apiParameters: '参数',
  apiPathParameters: '路径参数',
  apiQueryParameters: '查询参数',
  apiHeaderParameters: '请求头',
  apiCookieParameters: 'Cookie',
  apiRequestBody: '请求体',
  apiResponses: '响应',
  apiAuthentication: '认证',
  apiExamples: '示例',
  apiServers: '服务器',
  apiChannels: '频道',
  apiOperations: '操作',
  apiMessages: '消息',
  apiPayload: '载荷',
  apiMessageHeaders: '消息头',
  apiChannelParameters: '频道参数',
  apiSend: '发送',
  apiReceive: '接收',
  apiQueries: '查询',
  apiMutations: '变更',
  apiSubscriptions: '订阅',
  apiTypes: '类型',
  apiArguments: '参数',
  apiFields: '字段',
  apiReturns: '返回',
  apiValues: '取值',
  apiImplements: '实现',
  apiMembers: '成员',
  apiImplementedBy: '实现类型',
}

export const ja: Labels = {
  readingProgress: '読書の進捗',
  search: '検索',
  searchButton: '検索…',
  searchPlaceholder: 'サイト内を検索…',
  theme: 'テーマ',
  email: 'メール',
  mainNav: 'メイン',
  openNavigation: 'ナビゲーションを開く',
  navigation: 'ナビゲーション',
  documentation: 'ドキュメント',
  pagination: 'ページ送り',
  previous: '前へ',
  next: '次へ',
  updated: '{date} 更新',
  minRead: '{n} 分で読めます',
  copyPage: 'ページをコピー',
  copied: 'コピーしました',
  morePageActions: 'その他の操作',
  viewMarkdown: 'Markdown で表示',
  editPage: 'このページを編集',
  askAboutPage: 'このページについて質問',
  openIn: '{name} で開く',
  openInPrompt: '{url} を読んで、内容についての質問に答えてください。',
  allPosts: 'すべての記事',
  latest: '最新',
  allWriting: 'すべての記事',
  topics: 'トピック',
  keepReading: '続けて読む',
  aboutAuthor: '著者について',
  follow: 'フォロー',
  postCountOne: '{n} 件の記事',
  postCount: '{n} 件の記事',
  noPosts: 'まだ記事はありません。',
  notFound: '見つかりません',
  notFoundTitle: 'このページは存在しません',
  notFoundText: '移動したか、リンクが間違っている可能性があります。',
  goHome: 'ホームへ',
  builtWith: '{novon} で作成',
  video: '動画',
  downloadPdf: 'PDF をダウンロード',
  dismissBanner: '閉じる',
  zoomImage: '画像を拡大',
  closeImage: '画像を閉じる',
  prompt: 'プロンプト',
  copyPrompt: 'プロンプトをコピー',
  diagram: '図',
  diagramError: 'この図は描画できませんでした。',
  property: 'プロパティ',
  type: '型',
  default: 'デフォルト',
  description: '説明',
  required: '必須',
  outdatedVersion: '{version} のドキュメントを表示しています。',
  archivedVersion: '{version} はアーカイブされており、更新されません。',
  viewLatest: '最新版を見る',
  untranslated: 'このページはまだ{language}に翻訳されていません。{original}で表示しています。',
  rssFeed: 'RSS フィード',
  feedback: 'フィードバック',
  feedbackTitle: 'このページは役に立ちましたか？',
  feedbackPlaceholder: '改善できる点はありますか？',
  feedbackThanks: 'フィードバックありがとうございます',
  feedbackThanksText: 'ページの改善に役立てます。',
  releases: 'リリース',
  subscribe: '購読',
  apiEndpoints: 'エンドポイント',
  apiParameters: 'パラメーター',
  apiPathParameters: 'パスパラメーター',
  apiQueryParameters: 'クエリパラメーター',
  apiHeaderParameters: 'ヘッダー',
  apiCookieParameters: 'Cookie',
  apiRequestBody: 'リクエストボディ',
  apiResponses: 'レスポンス',
  apiAuthentication: '認証',
  apiExamples: '例',
  apiServers: 'サーバー',
  apiChannels: 'チャンネル',
  apiOperations: '操作',
  apiMessages: 'メッセージ',
  apiPayload: 'ペイロード',
  apiMessageHeaders: 'メッセージヘッダー',
  apiChannelParameters: 'チャンネルパラメーター',
  apiSend: '送信',
  apiReceive: '受信',
  apiQueries: 'クエリ',
  apiMutations: 'ミューテーション',
  apiSubscriptions: 'サブスクリプション',
  apiTypes: '型',
  apiArguments: '引数',
  apiFields: 'フィールド',
  apiReturns: '戻り値',
  apiValues: '値',
  apiImplements: '実装',
  apiMembers: 'メンバー',
  apiImplementedBy: '実装する型',
}

export const builtinLabels: Record<string, Labels> = { en, 'zh-CN': zhCN, ja }

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
