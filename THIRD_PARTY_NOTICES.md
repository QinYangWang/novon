# Third-party notices

The files in `src/ui/`, `src/components/`, `src/lib/`, `src/styles/theme.css`, `src/app/theme-accents.css` and `src/app/typeset.css` are installed from the PaneUI component library (https://github.com/taimatsuorg/paneui) by `scripts/sync-ui.ts`. That library's notices follow.

## Synara (visual style reference)

The library's native desktop structure (the 13px UI type scale, translucent fills, the Codex
rail shell layout, control densities) is adapted from the design tokens and UI components of
Synara, https://github.com/Emanuele-web04/synara (`apps/web/src/index.css`,
`apps/web/src/components/ui/*`, `apps/web/src/lib/appTypography.ts`). Values were re-expressed
as this project's own tokens and Tailwind classes; no source files were copied verbatim. Since
2026-10-16 the font, colour, radius and shadow values come from the foundation reference below.

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

## Foundation reference (colour roles, radius, shadow and type parameters, since 2026-10-16)

The default foundation in `app/globals.css` (and the `theme`, `theme-<accent>`, `theme-radius-*`
and `fonts` registry items) re-expresses design parameters published at
https://design.interfere.com (Colors, Radius, Shadows and Fonts pages, read 2026-10-16): the role
mapping of surfaces, text, fills, borders and the brand/positive/warning/danger colours onto
12-step scale steps, the page/shell/container/modal surface values, the 2–24px radius scale, the
four shadow strings (border, default, large, extra large) and the 400/450/500/600/700 weight
scale. Values were mapped onto this project's own shadcn token names; no stylesheet, script or
font file was copied. The reference's commercial typefaces are not used: this project
substitutes the open-licence fonts listed below. No licence is published for the reference
site; this notice records provenance only.

## Radix Colors (colour scales)

The gray, blue, green, orange, tomato, crimson, violet, pink, amber and cyan scales (and the
black/white alpha scales), in sRGB hex and display-p3, whose steps the theme colours, accent
presets and chart palette (`chart-1`…`chart-8`) use, are from Radix Colors,
https://github.com/radix-ui/colors. Only the individual step values are
used, written directly into the theme tokens.

MIT License

Copyright (c) 2022 WorkOS

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

## Fonts (Noto Sans, Noto Sans SC, JetBrains Mono, Newsreader, Noto Serif SC, Source Serif 4)

The theme's font stacks name these typefaces. The docs site and the `fonts` registry item
install them from npm as the Fontsource packages (`@fontsource-variable/noto-sans`,
`@fontsource-variable/noto-sans-sc`, `@fontsource-variable/jetbrains-mono`,
`@fontsource-variable/newsreader`, `@fontsource-variable/noto-serif-sc`,
`@fontsource-variable/source-serif-4`); the font files are not
vendored or modified. These fonts are licensed under the SIL Open Font License, Version 1.1
(https://openfontlicense.org); each package ships the full licence text in its `LICENSE` file.

- Noto Sans: Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic)
- Noto Sans SC and Noto Serif SC: Copyright Google Inc. (https://github.com/notofonts/noto-cjk)
- JetBrains Mono: Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)
- Newsreader: Copyright 2020 The Newsreader Project Authors (https://github.com/productiontype/Newsreader)

- Source Serif 4: the installed package ships its SIL Open Font License in `LICENSE`.

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

## Simple Icons (runtime dependency of `brand-icon` and the templates)

`brand-icon` renders logo paths from the `simple-icons` npm package
(https://github.com/simple-icons/simple-icons, https://simpleicons.org), installed as a dependency
and imported one icon at a time; no icon data is copied into this repository. The package is
released under CC0 1.0 Universal (public domain dedication):
https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md. Some individual icons carry
their own licence in the package's data file (`simple-icons/data/simple-icons.json`).

**Trademarks.** The brand names and logos shown by `brand-icon`, its examples and the templates
(GitHub, GitLab, Google, Linear, Jira, Notion, Figma, Sentry, Vercel, Stripe, Discord, Zapier,
Claude, Gemini and others) are trademarks of their respective owners. CC0 covers the drawings in the
package, not the marks: it grants no trademark rights and implies no endorsement or affiliation.
Follow each brand's own guidelines (the package links them in its data) when you use a logo or its
colour. Brands whose owners asked the package to remove their marks or have not given permission
(for example Microsoft and its products, Amazon/AWS, OpenAI, Salesforce/Slack, Adobe, Oracle, IBM,
Twilio, Yahoo) are not in the package; the templates show a neutral icon from this library's set
in their place and do not redraw those marks.

## make-interfaces-feel-better (interface-polish guidance for the design skill, since 2026-10-17)

Parts of `skills/paneui-design` (rules 33–40, `references/polish.md`, the polish checks in
`scripts/check.mjs`, `scripts/polish-probe.js` and `examples/`) restate interface-polish guidance from
the agent skill at https://github.com/jakubkrehel/make-interfaces-feel-better (commit 35545ea): icon-swap
values, image outlines, optical button padding, hit-area extension, exit and motion restraint, compositing
hints and the review report shape. The text, checks and examples were written for this library; where the
guidance conflicts with the library's rules (press scale, desktop target size, icon stroke and fill), the
library's rules apply. No files were copied verbatim.

MIT License

Copyright (c) 2026 Jakub Krehel

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

## Lobe Icons (vendor marks in `lib/brand-marks.ts`)

`lib/brand-marks.ts` (shipped with `brand-icon`) inlines two SVG paths, the OpenAI and xAI marks,
from the `@lobehub/icons-static-svg` npm package, version 1.95.1
(https://github.com/lobehub/lobe-icons, `icons/openai.svg` and `icons/xai.svg`), because the
`simple-icons` package does not carry those brands. Only the path data was copied; the package is
not a dependency.

MIT License

Copyright (c) 2023 LobeHub

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

**Trademarks.** OpenAI and xAI and their logos are trademarks of their owners. The MIT licence covers
the drawings as published in the package, not the marks: it grants no trademark rights and implies no
endorsement or affiliation. Follow each owner's brand guidelines when you use a logo.

## Traditional Chinese colour anchors

Paper uses seven named colour values from the GUSCSS / Traditional-Chinese-Colors
dataset by imoyao (https://github.com/imoyao/GUSCSS and
https://github.com/imoyao/Traditional-Chinese-Colors). Only colour names, pinyin
and hexadecimal values are retained in `tooling/fixtures/paper-anchors.json`;
no descriptions, artwork or implementation code are copied.

## Syntax highlighting

The default syntax highlighter uses `@pierre/highlights` 0.2.0 by Pierre, licensed
under Apache-2.0. Source and documentation: https://diffs.com/docs#highlights.
The package includes its licence and notices. No bundled theme artwork or palettes
are used; syntax scopes map to this project's theme tokens.

Shiki remains a fallback for unsupported languages, under the MIT licence:
https://github.com/shikijs/shiki/blob/main/LICENSE.

## Noto Sans SC (test fixture)

`tests/fixtures/noto-sans-sc-subset.ttf` is a small subset of Noto Sans SC,
Copyright 2014-2021 Adobe (http://www.adobe.com/), licensed under the SIL Open
Font License 1.1 (https://openfontlicense.org). It is used by the tests only and
is not part of the published package.
