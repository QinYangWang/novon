import { defineConfig } from 'novon/config'

export default defineConfig({
  title: 'novon',
  description: 'MDX in, static site out.',
  url: 'https://qinyangwang.github.io',
  base: '/novon/',
  layout: 'docs',
  nav: [
    { label: 'Guide', href: '/guide' },
    { label: 'GitHub', href: 'https://github.com/QinYangWang/novon' },
  ],
  theme: {
    accent: 'blue',
    favicon: '/favicon.svg',
    social: { github: 'https://github.com/QinYangWang/novon' },
    editLink: 'https://github.com/QinYangWang/novon/edit/main/docs/',
    footer: { text: 'MIT licensed · ฅ^•ﻌ•^ฅ' },
  },
})
