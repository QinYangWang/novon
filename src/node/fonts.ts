/**
 * The site's webfont: the `<link>`s that load it and the `<style>` that puts it on the theme's font
 * roles. `font` in the config is the whole feature — Google Fonts by family name, a stylesheet that
 * declares the face (中文网字计划 `result.css`, a self-hosted cascade), or both.
 */
import type { HeadTag, ResolvedConfig } from '../types.ts'

/** Fallbacks behind the site's family, so a missing subset still renders in a reasonable face. */
const TEXT_FALLBACK = 'ui-sans-serif, system-ui, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'
/** Code faces come first: latin stays monospaced, and CJK in code falls back to the site's family. */
const MONO_FALLBACK = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas'

/** A CSS font family name, quoted and escaped. */
const quote = (family: string) => `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/**
 * `Noto Sans SC` → `family=Noto+Sans+SC`; a full spec such as `Noto Sans SC:wght@400..700` keeps its
 * axis: the colon, `@` and `;` stay literal because Google's API reads them that way.
 */
export function googleFontsHref(spec: string): string {
  const encoded = encodeURIComponent(spec.trim())
    .replace(/%20/g, '+')
    .replace(/%3A/gi, ':')
    .replace(/%40/g, '@')
    .replace(/%3B/gi, ';')
    .replace(/%2C/gi, ',')
  return `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`
}

/** The `<style>` that points every font role at the family. */
export function fontStyle(config: ResolvedConfig): string {
  const family = config.font?.family
  if (!family) return ''
  const text = `${quote(family)}, ${TEXT_FALLBACK}`
  // Without an explicit code face the site's family still sits at the end, so CJK inside `code`
  // matches the page instead of falling back to whatever the browser picks.
  const mono = config.font?.mono ? `${quote(config.font.mono)}, ${MONO_FALLBACK}, monospace` : `${MONO_FALLBACK}, ${quote(family)}, monospace`
  return `:root{--default-font-family:${text};--font-sans:${text};--font-serif:${text};--font-heading:${text};--font-mono:${mono}}`
}

/** Everything `font` adds to `<head>`, in load order. */
export function fontHeadTags(config: ResolvedConfig): HeadTag[] {
  const font = config.font
  if (!font) return []
  const tags: HeadTag[] = []
  if (font.google.length) {
    tags.push({ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } })
    tags.push({ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true } })
    for (const spec of font.google) tags.push({ tag: 'link', attrs: { rel: 'stylesheet', href: googleFontsHref(spec) } })
  }
  for (const href of font.css) tags.push({ tag: 'link', attrs: { rel: 'stylesheet', href } })
  const style = fontStyle(config)
  if (style) tags.push({ tag: 'style', content: style })
  return tags
}