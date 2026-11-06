import { defineMeta } from 'novon/config'

export default defineMeta({
  pages: [
    { group: 'Write', pages: ['content', 'writing', 'layouts'] },
    { group: 'Configure', pages: ['configuration', 'theming', 'search', 'agents', 'plugins'] },
    { group: 'Ship', pages: ['checking', 'deploying'] },
    { title: 'Changelog', href: 'https://github.com/QinYangWang/novon/commits/main' },
  ],
  items: {
    agents: { badge: 'New' },
    plugins: { badge: 'New' },
  },
})
