# novon ฅ^•ﻌ•^ฅ

MDX in, static site out. Docs and blogs on Bun, Vite and React.

```bash
bun add -g novon

novon new my-docs                  # docs site
novon new my-blog --template blog  # blog
cd my-docs
novon dev                          # http://localhost:4321
novon build                        # dist/
```

A site is a config file and a folder of MDX. No `package.json`, no build
scripts, no theme source:

```text
my-docs/
├── novon.config.ts
└── content/
    ├── index.mdx          → /
    ├── getting-started.mdx→ /getting-started
    └── guide/
        ├── index.mdx      → /guide
        └── writing.mdx    → /guide/writing
```

- **Layouts.** `docs` (sidebar, search, page outline, prev/next) and `blog`
  (dated posts, tags, RSS). Mount both in one site with `layers`.
- **Writing.** Callouts, cards, steps, tabs, code groups, accordions, file trees
  and terms work in every page without an import. Code is highlighted at build
  time in both themes.
- **Output.** Every page is prerendered HTML that hydrates into a single-page
  app. `search.json`, `sitemap.xml`, `rss.xml`, `llms.txt`, a Markdown copy
  of each page and a share image per page come with it.
- **Extending.** Register React components for MDX, swap the header, footer,
  sidebar or 404 for your own, add stylesheets, or write a plugin.

Documentation: <https://qinyangwang.github.io/novon/> (source in
[docs/content](docs/content), `bun run dev`). Live demos of both templates:
[docs](https://qinyangwang.github.io/novon/templates/docs/) and
[blog](https://qinyangwang.github.io/novon/templates/blog/).

## The name

`novon` is the cat ฅ^•ﻌ•^ฅ spelled out: paw, eye, nose, eye, paw. It is
symmetric only in lowercase, so it is always written `novon`.

## Repository

| Path | What |
| --- | --- |
| `bin/novon.ts` | CLI |
| `src/node/` | Config loading, content scan, Vite setup, dev server, build, plugins |
| `src/runtime/` | The browser app: routing, layouts, MDX components |
| `src/ui/`, `src/components/`, `src/styles/theme.css`, `src/app/typeset.css` | Installed from the qinyang/ui registry; update with `bun scripts/sync-ui.ts`, never edit by hand |
| `templates/` | Starter sites for `novon new`; `bun run build:templates` builds them into `docs/dist/templates/` |
| `docs/` | This project's own site |
| `tests/` | `bun test` |

MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
