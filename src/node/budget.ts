/**
 * Bundle budgets: the gzipped JavaScript and CSS every page loads before it
 * runs (the client entry, its static imports and their stylesheets). Chunks
 * loaded on demand, like diagrams, do not count.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface AssetSizes {
  /** Gzipped bytes. */
  js: number
  css: number
  /** Bytes before compression. */
  rawJs: number
  rawCss: number
}

const UNITS: Record<string, number> = { b: 1, kb: 1000, kib: 1024, mb: 1000 ** 2, mib: 1024 ** 2 }

/** `200 kB`, `1.5MB`, `300kib` or a number of bytes. */
export function parseSize(value: number | string): number {
  if (typeof value === 'number') return value
  const m = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|kib|mb|mib)?$/)
  if (!m) throw new Error(`Budget "${value}" is not a size; write e.g. 200 kB`)
  return Math.round(Number(m[1]) * UNITS[m[2] ?? 'b'])
}

export function formatSize(bytes: number): string {
  return bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} kB`
}

export async function measureAssets(outDir: string, files: { js: string[]; css: string[] }): Promise<AssetSizes> {
  const size = async (list: string[]) => {
    let raw = 0
    let gz = 0
    for (const f of new Set(list)) {
      const data = await readFile(join(outDir, f))
      raw += data.length
      gz += Bun.gzipSync(data).length
    }
    return { raw, gz }
  }
  const js = await size(files.js)
  const css = await size(files.css)
  return { js: js.gz, css: css.gz, rawJs: js.raw, rawCss: css.raw }
}

/** One message per budget the sizes exceed. */
export function checkBudget(sizes: AssetSizes, budget: { js?: number | string; css?: number | string } = {}): string[] {
  const out: string[] = []
  for (const kind of ['js', 'css'] as const) {
    const limit = budget[kind]
    if (limit === undefined) continue
    const max = parseSize(limit)
    if (sizes[kind] > max) out.push(`${kind.toUpperCase()} is ${formatSize(sizes[kind])} gzipped, over the ${formatSize(max)} budget`)
  }
  return out
}
