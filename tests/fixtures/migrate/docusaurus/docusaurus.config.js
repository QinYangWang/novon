// @ts-check
import { themes as prismThemes } from 'prism-react-renderer'

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Acme Docs',
  tagline: 'Rockets for everyone.',
  url: 'https://docs.acme.dev',
  baseUrl: '/',
  presets: [
    [
      'classic',
      {
        docs: { sidebarPath: './sidebars.js' },
        theme: { customCss: './src/css/custom.css' },
      },
    ],
  ],
  themeConfig: {
    navbar: {
      items: [
        { type: 'docSidebar', sidebarId: 'docs', label: 'Docs' },
        { to: '/docs/guides/install', label: 'Install' },
        { href: 'https://github.com/acme/rockets', label: 'GitHub' },
      ],
    },
    prism: { theme: prismThemes.github },
  },
}

export default config
