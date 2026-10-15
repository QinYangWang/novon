import { defineConfig } from 'novon/config'

export default defineConfig({
  title: '__TITLE__',
  description: 'Documentation for __TITLE__.',
  // url: 'https://example.com',
  layout: 'docs',
  // layers: [{ path: '/blog', layout: 'blog' }],
  nav: [{ label: 'Guide', href: '/guide' }],
  theme: {
    accent: 'blue',
    social: {
      // github: 'https://github.com/you/__NAME__',
    },
    // editLink: 'https://github.com/you/__NAME__/edit/main/',
  },
  plugins: ['search', 'sitemap', 'rss', 'llms'],
})
