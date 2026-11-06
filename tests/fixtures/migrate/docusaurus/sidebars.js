/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Guides',
      collapsed: true,
      items: ['guides/install', { type: 'doc', id: 'guides/launch', label: 'Launch day' }],
    },
    { type: 'link', label: 'Status', href: 'https://status.acme.dev' },
  ],
}

module.exports = sidebars
