/** A minimal zip writer: stored or deflated entries, enough for EPUB. */
import { deflateRawSync } from 'node:zlib'

const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  data: string | Uint8Array
  /** Store without compression (EPUB's `mimetype` must be). */
  store?: boolean
}

export function zip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  // 1980-01-01 00:00: a fixed time keeps the output reproducible.
  const time = 0
  const date = (1 << 5) | 1
  for (const e of entries) {
    const name = enc.encode(e.name)
    const raw = typeof e.data === 'string' ? enc.encode(e.data) : e.data
    const store = e.store || raw.length < 64
    const body = store ? raw : new Uint8Array(deflateRawSync(raw))
    const crc = crc32(raw)
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, store ? 0 : 8, true)
    lv.setUint16(10, time, true)
    lv.setUint16(12, date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, body.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, store ? 0 : 8, true)
    cv.setUint16(12, time, true)
    cv.setUint16(14, date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, body.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    locals.push(local, body)
    centrals.push(central)
    offset += local.length + body.length
  }
  const size = centrals.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, size, true)
  ev.setUint32(16, offset, true)
  const out = new Uint8Array(offset + size + 22)
  let at = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** Reads the entry names and contents back (stored or deflated), for tests and checks. */
export function unzip(data: Uint8Array): Map<string, Uint8Array> {
  const { inflateRawSync } = require('node:zlib') as typeof import('node:zlib')
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const out = new Map<string, Uint8Array>()
  let at = 0
  while (at + 30 <= data.length && view.getUint32(at, true) === 0x04034b50) {
    const method = view.getUint16(at + 8, true)
    const size = view.getUint32(at + 18, true)
    const nameLen = view.getUint16(at + 26, true)
    const extra = view.getUint16(at + 28, true)
    const name = new TextDecoder().decode(data.subarray(at + 30, at + 30 + nameLen))
    const start = at + 30 + nameLen + extra
    const body = data.subarray(start, start + size)
    out.set(name, method === 8 ? new Uint8Array(inflateRawSync(body)) : body)
    at = start + size
  }
  return out
}
