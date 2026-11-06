// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  site: 'https://nebula.dev',
  integrations: [
    starlight({
      title: 'Nebula',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/nebula/nebula' }],
      sidebar: [
        { label: 'Guides', items: [{ label: 'First steps', slug: 'guides/example' }, 'guides/advanced'] },
        { label: 'Reference', autogenerate: { directory: 'reference' } },
      ],
    }),
  ],
})
