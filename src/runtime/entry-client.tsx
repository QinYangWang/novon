import { createRoot, hydrateRoot } from 'react-dom/client'
import { components, loaders, overrides, site } from 'virtual:novon/site'
import 'virtual:novon/css'
import { App } from './app.tsx'
import { loadRoute } from './site.tsx'

const initial = await loadRoute(site, loaders, location.pathname + location.hash)
const root = document.getElementById('novon')!
const app = <App site={site} loaders={loaders} overrides={overrides} components={components} initial={initial} />

// Built pages arrive prerendered; the dev server sends an empty shell.
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
