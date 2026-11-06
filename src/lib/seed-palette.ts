function hashSeed(seed: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Scrambles a hash so nearby seeds land far apart. */
function mixHash(h: number) {
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

function hslHex(h: number, s: number, l: number) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const SCHEMES = [
  [0, 30, 60, 200],
  [0, 150, 180, 330],
  [0, 40, 180, 220],
] as const
const LIGHTS = [58, 72, 86, 66]

/** A harmonious palette of `count` hex colours for a seed; the same seed always gives the same colours. */
function seedPalette(seed: string, count = 4): string[] {
  const h = mixHash(hashSeed(seed))
  const hue = h % 360
  const scheme = SCHEMES[(h >>> 9) % SCHEMES.length]
  const sat = 68 + ((h >>> 12) % 20)
  return Array.from({ length: count }, (_, i) =>
    hslHex((hue + scheme[i % scheme.length] + Math.floor(i / scheme.length) * 15) % 360, Math.max(40, sat - i * 6), LIGHTS[i % LIGHTS.length])
  )
}

/**
 * A still frame of the mesh-gradient shader as CSS: one radial colour field per colour after the
 * first, placed by the seed. Use it as `background-image` over `background-color: colors[0]`.
 * Hex colours fade cleanly; other CSS colours fade through `transparent`.
 */
function meshGradient(colors: string[], seed: string): string {
  const h = mixHash(hashSeed(seed))
  return colors
    .slice(1)
    .map((color, i) => {
      const r = mixHash(h ^ Math.imul(i + 1, 0x9e3779b9))
      const x = r % 101
      const y = (r >>> 8) % 101
      const size = 55 + ((r >>> 16) % 30)
      const clear = /^#[0-9a-f]{6}$/i.test(color) ? `${color}00` : "transparent"
      return `radial-gradient(circle at ${x}% ${y}%, ${color} 0%, ${clear} ${size}%)`
    })
    .reverse()
    .join(", ")
}

export { hashSeed, meshGradient, mixHash, seedPalette }
