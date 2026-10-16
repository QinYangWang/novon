import { defineConfig } from 'novon/config'

export default defineConfig({
  title: '__TITLE__',
  description: 'Notes on writing, tools and small websites.',
  // url: 'https://example.com',
  layout: 'blog',
  nav: [
    { label: 'Writing', href: '/' },
    { label: 'About', href: '/about' },
  ],
  theme: {
    accent: 'violet',
    social: {
      // github: 'https://github.com/you',
      email: 'hello@example.com',
      rss: true,
    },
    // Frontmatter `author` picks an entry here for the card under each post.
    authors: {
      'Mira Chen': {
        bio: 'Writes about tools, habits and the small web. Lives in Lisbon.',
        // avatar: '/mira.jpg',
      },
    },
    footer: { text: '© __YEAR__ __TITLE__' },
  },
  plugins: ['search', 'sitemap', 'rss', 'llms'],
})
