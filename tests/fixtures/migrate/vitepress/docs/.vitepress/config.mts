import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Comet',
  description: 'A fast comet tracker.',
  base: '/comet/',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'GitHub', link: 'https://github.com/comet/comet' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Comet?', link: '/guide/' },
            { text: 'Getting started', link: '/guide/getting-started' },
          ],
        },
        { text: 'Advanced', collapsed: true, items: [{ text: 'Config', link: '/guide/config.md' }] },
      ],
    },
  },
})
