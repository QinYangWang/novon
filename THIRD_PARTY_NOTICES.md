# Third-party notices

The files in `src/ui/`, `src/components/`, `src/lib/utils.ts`, `src/styles/theme.css`, `src/styles/accents.css` and `src/app/typeset.css` are installed from the qinyang/ui component library (https://github.com/QinYangWang/ui) by `scripts/sync-ui.ts`. That library's notices follow.


## Synara (visual style reference)

The library's default visual style ("native desktop": system UI font on a 13px scale,
translucent fills, hairline borders, near-flat elevation, 0.625rem radius steps, the Codex
rail shell layout, control densities) is adapted from the design tokens and UI components of
Synara, https://github.com/Emanuele-web04/synara (`apps/web/src/index.css`,
`apps/web/src/components/ui/*`, `apps/web/src/lib/appTypography.ts`). Values were re-expressed
as this project's own tokens and Tailwind classes; no source files were copied verbatim.

MIT License

Copyright (c) 2026 T3 Tools Inc.
Copyright (c) 2026 Emanuele Di Pietro

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## BoardUI (colour system)

The theme colours in `app/globals.css` (and the `theme` / `theme-<accent>` registry items) follow
BoardUI's colour system, https://github.com/BoardUI/boardui (`styles/theme.css`, commit
ec5c5eb, and https://www.boardui.com/components/color): the Tailwind neutral OKLCH ramp with
BoardUI's primitive overrides (neutral-100 #f7f7f7, neutral-200 #ebebeb, neutral-925 #121212,
blue-400 #3392ff), the role mapping of text, background, border and focus tokens, the
`--accent-50…950` ramp that drives the call-to-action colour (blue by default), and the
categorical chart palette. Values were re-expressed under this project's shadcn token names;
no source files were copied verbatim.

MIT License

Copyright (c) 2026 Mertcan Dundar Esmergul (BoardUI)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## @pierre/diffs (runtime dependency of `file-diff`)

`registry/base-nova/ui/file-diff.tsx` renders its rows with `@pierre/diffs`
(https://diffs.com), Copyright 2025 Pierre Computer Company,
licensed under the Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0).
It is installed from npm as a dependency and not vendored or modified; the package ships no
NOTICE file. Its full license text is in `node_modules/@pierre/diffs/LICENSE.md`.

## DiceBear and Notionists (generated avatars)

`registry/base-nova/ui/generated-avatar.tsx` (and the `avatar-generator` registry item) draws its
avatars with DiceBear's Notionists style. Both packages are installed from npm as dependencies
(`@dicebear/core`, `@dicebear/notionists`) and not vendored or modified; the component crops the
output, swaps in its own background, prefixes the SVG ids and strips DiceBear's `<metadata>`.
The library no longer ships any avatar artwork of its own.

### Artwork: Notionists by Zoish (CC0 1.0)

Source: Notionists, https://heyzoish.gumroad.com/l/notionists
Designer: Zoish, https://bio.link/heyzoish
License: CC0 1.0 Universal (public domain dedication),
https://creativecommons.org/publicdomain/zero/1.0/
No attribution is required; it is credited here and on the Avatar Generator docs page.

### Code: DiceBear (MIT)

https://www.dicebear.com, https://github.com/dicebear/dicebear

MIT License

Copyright (c) 2024 Florian Körner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## maily.to (feature reference for `email-editor`) and Tiptap (runtime dependency)

The block set of `email-editor` (logo, button variants, variables, image, alignment, divider,
spacer, footer, section, columns, repeat, show-if) follows the feature list of maily.to,
https://github.com/arikchakma/maily.to, MIT License, Copyright (c) Arik Chakma. No maily source
code was copied; the editor is written from scratch on this project's notion-editor base.

`notion-editor` and `email-editor` depend at runtime on Tiptap's open-source packages
(https://github.com/ueberdosis/tiptap, MIT License; no Tiptap Pro extensions), lowlight and
highlight.js (BSD-3-Clause), the unified / remark packages (MIT) and React Email
(`@react-email/components`, `@react-email/render`, MIT). They are npm dependencies, not vendored.

## shadcn/typeset (`app/typeset.css`, registry item `typeset`)

`app/typeset.css` is the typeset stylesheet from shadcn/ui, https://ui.shadcn.com/docs/typeset
(https://ui.shadcn.com/typeset.css), with the heading font defaulting to `inherit` and this
library's presets (`typeset-docs`, `typeset-reading`, `typeset-chat`) appended.

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## xterm.js (runtime dependency of `terminal`)

`registry/base-nova/ui/terminal.tsx` draws the terminal with `@xterm/xterm`, `@xterm/addon-fit`
and `@xterm/addon-web-links` (https://github.com/xtermjs/xterm.js), installed from npm as
dependencies. The component inlines the package's base stylesheet (`css/xterm.css`, minified,
with the scrollbar shadow rules removed, the IME composition colours switched to theme tokens and
a thinner scrollbar slider) so it works without a CSS import. MIT License:

Copyright (c) 2017-2019, The xterm.js authors (https://github.com/xtermjs/xterm.js)
Copyright (c) 2014-2016, SourceLair Private Company (https://www.sourcelair.com)
Copyright (c) 2012-2013, Christopher Jeffrey (https://github.com/chjj/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## node-pty and ws (used by `terminal-server/pty-bridge.mjs`)

The PTY bridge shipped with `terminal` imports `ws` (https://github.com/websockets/ws, MIT;
Copyright (c) 2011 Einar Otto Stangvik, (c) 2013 Arnout Kazemier and contributors, (c) 2016 Luigi
Pinca and contributors) and a PTY binding that users install themselves: `node-pty`
(https://github.com/microsoft/node-pty, MIT; Copyright (c) 2012-2015 Christopher Jeffrey,
(c) 2016 Daniel Imms, (c) 2018-present Microsoft Corporation) or its prebuilt fork
`@homebridge/node-pty-prebuilt-multiarch` (MIT, same notices). Neither binding is a dependency of
this repository and no code from them is vendored.


## @monaco-editor/react and the editor it loads (used by the `vscode` template)

The `vscode` template depends on `@monaco-editor/react` (https://github.com/suren-atoyan/monaco-react,
MIT; Copyright (c) 2018 Suren Atoyan), which loads `monaco-editor` (https://github.com/microsoft/monaco-editor,
MIT; Copyright (c) 2016 - present Microsoft Corporation) from the jsDelivr CDN at runtime. No code from
either is vendored in this repository.

## Noto Sans SC (test fixture)

`tests/fixtures/noto-sans-sc-subset.ttf` is a small subset of Noto Sans SC,
Copyright 2014-2021 Adobe (http://www.adobe.com/), licensed under the SIL Open
Font License 1.1 (https://openfontlicense.org). It is used by the tests only and
is not part of the published package.
