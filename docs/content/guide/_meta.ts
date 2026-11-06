import { defineMeta } from 'novon/config'

export default defineMeta({
  pages: [
    { group: 'Write', pages: ['content', 'writing', 'layouts', 'components'] },
    { group: 'Configure', pages: ['configuration', 'theming', 'search', 'languages', 'versions', 'sources', 'api-reference', 'feedback', 'agents', 'plugins'] },
    { group: 'Ship', pages: ['checking', 'deploying'] },
    { title: 'Commits', href: 'https://github.com/QinYangWang/novon/commits/main' },
  ],
  items: {
    languages: { badge: 'New' },
    versions: { badge: 'New' },
    sources: { badge: 'New' },
    'api-reference': { badge: 'New' },
    components: { badge: 'New' },
  },
})
