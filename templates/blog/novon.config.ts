import { defineConfig } from 'novon/config'

export default defineConfig({
  title: '__TITLE__',
  description: 'Notes and essays.',
  // url: 'https://example.com',
  layout: 'blog',
  nav: [
    { label: 'Posts', href: '/' },
    { label: 'About', href: '/about' },
  ],
  theme: {
    accent: 'neutral',
    social: { rss: true },
    footer: { text: '© __YEAR__ __TITLE__' },
  },
  plugins: ['search', 'sitemap', 'rss', 'llms'],
})
