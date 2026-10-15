# Working on novon

- The name is always `novon`, lowercase, even at the start of a sentence: it
  spells the cat ฅ^•ﻌ•^ฅ and is only symmetric in lowercase.
- UI comes from the qinyang/ui registry. `src/ui/`, `src/components/`,
  `src/lib/utils.ts`, `src/styles/theme.css`, `src/app/theme-accents.css` and
  `src/app/typeset.css` are installed by `bun scripts/sync-ui.ts` and are never
  edited here. When a component is missing, buggy or awkward, fix it in the
  library and re-sync; do not copy or patch it in novon.
- novon's own code (`src/node`, `src/runtime`, `src/styles/novon.css`) composes
  those components with the library's tokens and utilities only: no raw
  colours, no hex values.
- A site must keep working with no `package.json`: anything a site file
  imports resolves from novon (`src/node/vite.ts`, `src/node/load-config.ts`).
- Keep public exports in `src/runtime/index.ts` stable.
- Docs are concise English. Run `bun run typecheck` and `bun test` before
  committing.
