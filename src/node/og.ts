/**
 * Social cards: a 1200×630 PNG per page, rendered at build time with satori
 * (JSX → SVG) and resvg (SVG → PNG), cached by content hash in `.novon/og/`.
 *
 * Fonts: `og.font` points at local TTF/OTF/WOFF files. Without it, novon fetches
 * a subset of a web font holding only the characters each card needs, so CJK
 * titles render without shipping a 10 MB font. Subsets are cached too.
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { createElement } from 'react'
import { novonRoot } from './vite.ts'
import { OgCard, type OgCardProps } from './og-card.tsx'
import { withBase } from '../shared.ts'
import type { OgOptions, PageMeta, ResolvedConfig } from '../types.ts'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

export interface OgImage {
  /** Path under the base, or an absolute URL. */
  src: string
  width?: number
  height?: number
  generated: boolean
}

export interface OgTokens {
  background: string
  foreground: string
  mutedForeground: string
  border: string
  primary: string
  primarySubtle: string
}

type ResolvedOg = Required<Pick<OgOptions, 'mode' | 'family'>> & OgOptions & { enabled: boolean }

export function ogOptions(config: ResolvedConfig): ResolvedOg {
  const raw = config.og
  const opts: OgOptions = typeof raw === 'object' && raw ? raw : {}
  const enabled = raw === false ? false : opts.enabled ?? true
  return { ...opts, enabled, mode: opts.mode ?? 'light', family: opts.family ?? webFamily(config.lang) }
}

function webFamily(lang: string): string {
  const l = lang.toLowerCase()
  if (l.startsWith('ja')) return 'Noto Sans JP'
  if (l.startsWith('ko')) return 'Noto Sans KR'
  if (l === 'zh-tw' || l === 'zh-hk' || l.startsWith('zh-hant')) return 'Noto Sans TC'
  return 'Noto Sans SC'
}

/** `/` → `og/index.png`, `/guide/a` → `og/guide/a.png` (relative to the output directory). */
export function ogFile(route: string): string {
  return `og/${route === '/' ? 'index' : route.slice(1)}.png`
}

/** The image a page shares: frontmatter `image`, the generated card, or none. */
export function pageImage(config: ResolvedConfig, page: PageMeta | null): OgImage | null {
  if (!page || page.og === false) return null
  if (page.image) return { src: page.image, generated: false }
  if (!ogOptions(config).enabled) return null
  return { src: `/${ogFile(page.route)}`, width: OG_WIDTH, height: OG_HEIGHT, generated: true }
}

/** Absolute URL when the site has a `url`, else a base path. */
export function imageUrl(config: ResolvedConfig, image: OgImage): string {
  if (/^https?:\/\//.test(image.src)) return image.src
  const path = withBase(config.base, image.src)
  return config.url ? new URL(path, config.url).href : path
}

// ---------- theme tokens ----------

function block(css: string, selector: RegExp): Record<string, string> {
  const m = selector.exec(css)
  if (!m) return {}
  const end = css.indexOf('}', m.index)
  const out: Record<string, string> = {}
  for (const d of css.slice(m.index, end).matchAll(/--([\w-]+):\s*([^;]+);/g)) out[d[1]] = d[2].trim()
  return out
}

/** oklch(L C H [/ a]) → rgb(), since the renderer only knows sRGB. */
function toSrgb(value: string): string {
  const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)$/.exec(value)
  if (!m) return value
  const L = Number(m[1]) / (m[2] ? 100 : 1)
  const C = Number(m[3])
  const h = (Number(m[4]) * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s]
  const [r, g, bl] = lin.map((x) => Math.round(255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055))))
  const alpha = m[5] ? Number(m[5]) / (m[6] ? 100 : 1) : 1
  return alpha < 1 ? `rgba(${r}, ${g}, ${bl}, ${alpha})` : `rgb(${r}, ${g}, ${bl})`
}

/** Reads the installed theme files so the card uses the same tokens as the site. */
export async function readTokens(accent: string, mode: 'light' | 'dark'): Promise<OgTokens> {
  const theme = await readFile(join(novonRoot, 'src/styles/theme.css'), 'utf8')
  const accents = await readFile(join(novonRoot, 'src/app/theme-accents.css'), 'utf8')
  const base = block(theme, /^:root\s*\{/m)
  const dark = mode === 'dark' ? block(theme, /^\.dark\s*\{/m) : {}
  const a = `html\\[data-accent="${accent}"\\]`
  const acc = { ...block(accents, new RegExp(`^${a},`, 'm')), ...(mode === 'dark' ? block(accents, new RegExp(`^${a}\\.dark,`, 'm')) : {}) }
  const vars: Record<string, string> = { ...base, ...dark, ...acc }
  const get = (name: string) => {
    let v = vars[name]
    for (let i = 0; v?.startsWith('var(') && i < 4; i++) v = vars[v.slice(6, -1)]
    if (!v) throw new Error(`theme token --${name} not found`)
    return toSrgb(v)
  }
  return {
    background: get('background'),
    foreground: get('foreground'),
    mutedForeground: get('muted-foreground'),
    border: get('border'),
    primary: get('primary'),
    primarySubtle: get('primary-subtle'),
  }
}

// ---------- fonts ----------

export interface OgFont {
  name: string
  data: ArrayBuffer | Buffer
  weight: 400 | 700
  style: 'normal'
}

const hash = (...parts: (string | Uint8Array)[]) => {
  const h = createHash('sha256')
  for (const p of parts) h.update(p)
  return h.digest('hex').slice(0, 16)
}

async function localFonts(config: ResolvedConfig, opts: ResolvedOg): Promise<OgFont[] | null> {
  if (!opts.font) return null
  const list = Array.isArray(opts.font) ? opts.font : [opts.font]
  const fonts: OgFont[] = []
  for (const [i, entry] of list.entries()) {
    const { path, weight } = typeof entry === 'string' ? { path: entry, weight: i === 1 ? 700 : 400 } : entry
    const file = resolve(config.root, path)
    if (extname(file).toLowerCase() === '.woff2') throw new Error(`og.font: ${path} is WOFF2; use a TTF, OTF or WOFF file`)
    fonts.push({ name: 'og', data: await readFile(file), weight: weight === 700 ? 700 : 400, style: 'normal' })
  }
  // One file covers both weights.
  if (fonts.length === 1) fonts.push({ ...fonts[0], weight: fonts[0].weight === 700 ? 400 : 700 })
  return fonts
}

/** A subset of a web font with just `text`'s characters, cached on disk. */
async function webFont(cacheDir: string, family: string, weight: 400 | 700, text: string): Promise<OgFont> {
  const chars = [...new Set(text)].sort().join('')
  const file = join(cacheDir, 'fonts', `${hash(family, String(weight), chars)}.ttf`)
  if (existsSync(file)) return { name: 'og', data: await readFile(file), weight, style: 'normal' }
  const css = await fetchText(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(chars)}`)
  const url = /src:\s*url\(([^)]+)\)\s*format\('(truetype|opentype|woff)'\)/.exec(css)?.[1]
  if (!url) throw new Error(`no TTF in the font response for ${family}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`font download failed: ${res.status}`)
  const data = Buffer.from(await res.arrayBuffer())
  await mkdir(join(cacheDir, 'fonts'), { recursive: true })
  await writeFile(file, data)
  return { name: 'og', data, weight, style: 'normal' }
}

async function fetchText(url: string): Promise<string> {
  // A non-browser user agent gets TrueType rather than WOFF2.
  const res = await fetch(url, { headers: { 'user-agent': 'novon' } })
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.text()
}

// ---------- images ----------

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp' }

async function dataUri(config: ResolvedConfig, src: string | undefined): Promise<string | undefined> {
  if (!src) return undefined
  if (/^(https?:|data:)/.test(src)) return src
  const file = join(config.root, 'public', src)
  const type = MIME[extname(file).toLowerCase()]
  if (!type || type === 'image/webp' || !existsSync(file)) return undefined
  const data = await readFile(file)
  // SVG text needs fonts the rasteriser does not have: better no image than a blank shape.
  if (type === 'image/svg+xml' && /<text[\s>]/.test(data.toString('utf8'))) return undefined
  return `data:${type};base64,${data.toString('base64')}`
}

// ---------- render ----------

export function cardProps(config: ResolvedConfig, page: PageMeta): Omit<OgCardProps, 'tokens' | 'image'> & { imageSrc?: string } {
  const author = page.author
  const avatar = author ? config.theme.authors?.[author]?.avatar : undefined
  const isPost = page.layout === 'blog' && page.kind === 'page' && Boolean(page.date)
  const home = page.route === '/'
  return {
    title: home ? config.title : page.title,
    description: home ? config.description : page.description,
    siteName: config.title,
    imageSrc: avatar ?? config.theme.logo ?? config.theme.favicon,
    imageShape: avatar ? 'circle' : 'square',
    author: isPost ? author : undefined,
    date: isPost ? page.date : undefined,
    tags: isPost ? page.tags : [],
  }
}

async function satoriSvg(element: unknown, fonts: OgFont[]): Promise<string> {
  const { default: satori } = await import('satori')
  return satori(element as any, { width: OG_WIDTH, height: OG_HEIGHT, fonts: fonts as any })
}

export async function toPng(svg: string): Promise<Uint8Array> {
  const { Resvg } = await import('@resvg/resvg-js')
  return new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng()
}

export interface OgRenderer {
  /** Renders one page's card, from cache when nothing changed. */
  render(page: PageMeta): Promise<Uint8Array>
  svg(page: PageMeta): Promise<string>
}

export async function ogRenderer(config: ResolvedConfig): Promise<OgRenderer> {
  const opts = ogOptions(config)
  const cacheDir = join(config.root, '.novon/og')
  const tokens = await readTokens(opts.accent ?? config.theme.accent, opts.mode)
  const local = await localFonts(config, opts)
  const images = new Map<string, string | undefined>()
  // The card's own source is part of the cache key, so editing it re-renders.
  const cardVersion = hash(await readFile(join(novonRoot, 'src/node/og-card.tsx')), JSON.stringify(tokens))

  const prepare = async (page: PageMeta) => {
    const { imageSrc, ...props } = cardProps(config, page)
    if (imageSrc && !images.has(imageSrc)) images.set(imageSrc, await dataUri(config, imageSrc))
    const image = imageSrc ? images.get(imageSrc) : undefined
    const all: OgCardProps = { ...props, image, tokens }
    const text = [all.title, all.description, all.siteName, all.author, all.date, ...(all.tags ?? []).map((t) => `#${t}`), ' ·…0123456789-'].filter(Boolean).join('')
    return { all, text }
  }
  const fontsFor = async (text: string) => local ?? Promise.all([webFont(cacheDir, opts.family, 400, text), webFont(cacheDir, opts.family, 700, text)])

  const svg = async (page: PageMeta) => {
    const { all, text } = await prepare(page)
    return satoriSvg(createElement(OgCard, all), await fontsFor(text))
  }
  return {
    svg,
    async render(page) {
      const { all, text } = await prepare(page)
      const fontKey = local ? local.map((f) => hash(new Uint8Array(f.data as ArrayBuffer))).join() : opts.family
      const key = hash(cardVersion, JSON.stringify(all), fontKey)
      const file = join(cacheDir, `${key}.png`)
      if (existsSync(file)) return readFile(file)
      const png = await toPng(await satoriSvg(createElement(OgCard, all), await fontsFor(text)))
      await mkdir(cacheDir, { recursive: true })
      await writeFile(file, png)
      return png
    },
  }
}

/** Renders every page's card into `outDir/og/`. Returns the routes that got one. */
export async function generateOgImages(config: ResolvedConfig, pages: PageMeta[], outDir: string): Promise<Set<string>> {
  const done = new Set<string>()
  const todo = pages.filter((p) => pageImage(config, p)?.generated)
  if (!todo.length) return done
  let renderer: OgRenderer
  try {
    renderer = await ogRenderer(config)
  } catch (error) {
    console.warn(`[novon] social cards skipped: ${(error as Error).message}`)
    return done
  }
  let warned = false
  const queue = [...todo]
  const worker = async () => {
    for (let page = queue.shift(); page; page = queue.shift()) {
      try {
        const png = await renderer.render(page)
        const file = join(outDir, ogFile(page.route))
        await mkdir(join(file, '..'), { recursive: true })
        await writeFile(file, png)
        done.add(page.route)
      } catch (error) {
        if (!warned) console.warn(`[novon] social card failed for ${page.route}: ${(error as Error).message}. Set og.font to a local font file to build offline.`)
        warned = true
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return done
}
