import { defineConfig } from 'novon/config'

export default defineConfig({
  title: 'novon',
  description: 'MDX in, static site out.',
  url: 'https://qinyangwang.github.io',
  base: '/novon/',
  layout: 'docs',
  nav: [
    { label: 'Guide', href: '/guide' },
    { label: 'API', href: '/reference' },
    { label: 'Templates', href: '/templates' },
    { label: 'GitHub', href: 'https://github.com/QinYangWang/novon' },
  ],
  components: { TemplateCard: './components/TemplateCard.tsx' },
  variables: { version: 'latest' },
  banner: { text: 'novon now speaks [more than one language](/guide/languages) and keeps [old versions](/guide/versions).', id: 'p2' },
  i18n: {
    defaultLocale: 'en',
    locales: {
      en: 'English',
      ja: {
        label: '日本語',
        description: 'MDX から静的サイトへ。',
        nav: [
          { label: 'ガイド', href: '/guide' },
          { label: 'API', href: '/reference' },
          { label: 'テンプレート', href: '/templates' },
          { label: 'GitHub', href: 'https://github.com/QinYangWang/novon' },
        ],
        banner: 'novon は[複数の言語](/guide/languages)と[古いバージョン](/guide/versions)に対応しました。',
      },
    },
  },
  versions: { latest: 'Latest', list: [{ id: 'v0', label: 'v0', archived: true }] },
  openapi: { spec: 'api/petstore.yaml', path: '/reference', samples: ['curl', 'javascript', 'python', 'go'] },
  asyncapi: { spec: 'api/events.yaml', path: '/events' },
  graphql: { schema: 'api/schema.graphql', path: '/graphql', title: 'GraphQL API', endpoint: 'https://petstore.example.com/graphql' },
  feedback: { href: 'https://github.com/QinYangWang/novon/issues/new?title=Docs%20feedback%3A%20{title}&body={mood}%0A%0A{message}%0A%0A{url}' },
  theme: {
    accent: 'blue',
    favicon: '/favicon.svg',
    social: { github: 'https://github.com/QinYangWang/novon', rss: true },
    editLink: 'https://github.com/QinYangWang/novon/edit/main/docs/',
    footer: { text: 'MIT licensed · ฅ^•ﻌ•^ฅ' },
  },
})
