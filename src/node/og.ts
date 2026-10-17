/**
 * Social cards: the library's OgImage as a 1200×630 PNG per page, rendered with satori
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
import { OgImage as OgCard, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, type OgImageProps } from '@/components/og-image'
import { withBase } from '../shared.ts'
import type { OgOptions, PageMeta, ResolvedConfig } from '../types.ts'

export const OG_WIDTH = OG_IMAGE_WIDTH
export const OG_HEIGHT = OG_IMAGE_HEIGHT

export interface OgImage {
  /** Path under the base, or an absolute URL. */
  src: string
  width?: number
  height?: number
  generated: boolean
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

type CardProps = Omit<OgImageProps, 'logo' | 'avatar'> & { logoSrc?: string; avatarSrc?: string }

export function cardProps(config: ResolvedConfig, page: PageMeta): CardProps {
  const opts = ogOptions(config)
  const isPost = page.layout === 'blog' && page.kind === 'page' && Boolean(page.date)
  const author = isPost ? page.author : undefined
  const home = page.route === '/'
  return {
    title: home ? config.title : page.title,
    description: home ? config.description : page.description,
    siteName: config.title,
    logoSrc: config.theme.logo ?? config.theme.favicon,
    avatarSrc: author ? config.theme.authors?.[author]?.avatar : undefined,
    author,
    date: isPost ? page.date : undefined,
    tags: isPost ? page.tags : [],
    accent: opts.accent ?? config.theme.accent,
    mode: opts.mode,
    fontFamily: 'og',
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
  const local = await localFonts(config, opts)
  const images = new Map<string, string | undefined>()
  const image = async (src: string | undefined) => {
    if (!src) return undefined
    if (!images.has(src)) images.set(src, await dataUri(config, src))
    return images.get(src)
  }
  // The card component's source is part of the cache key, so a library update re-renders.
  const cardVersion = hash('og-v2', await readFile(join(novonRoot, 'src/components/og-image.tsx')))

  const prepare = async (page: PageMeta) => {
    const { logoSrc, avatarSrc, ...props } = cardProps(config, page)
    const all: OgImageProps = { ...props, logo: await image(logoSrc), avatar: await image(avatarSrc) }
    // Every character the card can draw, including the separators and the clamp's ellipsis.
    const tags = (all.tags ?? []).filter(Boolean).slice(0, 3).map((t) => `#${t}`)
    const text = [all.title, all.description, all.siteName, all.author, all.date, ...tags, ' #·…0123456789-'].filter(Boolean).join('')
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
