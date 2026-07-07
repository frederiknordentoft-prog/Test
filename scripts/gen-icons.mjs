// Genererer PWA-ikoner proceduralt (ingen eksterne assets, jf. spec):
// en messing-skålvægt på pergament, rasteriseret i ren JS og PNG-enkodet
// med Nodes zlib. Kører som del af `npm run build`.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bitdybde
  ihdr[9] = 6 // RGBA
  // scanlines med filter 0
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4)
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = a
  }
  const fillRect = (x0, y0, w, h, c) => {
    for (let y = Math.round(y0); y < Math.round(y0 + h); y++)
      for (let x = Math.round(x0); x < Math.round(x0 + w); x++) set(x, y, ...c)
  }
  const fillCircle = (cx, cy, rad, c) => {
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++)
      for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) set(x, y, ...c)
      }
  }
  const fillEllipse = (cx, cy, rx, ry, c) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, ...c)
      }
  }

  const parchment = [239, 227, 200]
  const parchDark = [222, 204, 166]
  const brass = [176, 141, 63]
  const brassLight = [216, 185, 106]
  const walnut = [74, 50, 32]

  const u = size / 100 // designenheder

  // Baggrund m. blød "vignet" (mørkere ring nederst)
  fillRect(0, 0, size, size, parchment)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2)
      if (d > 0.82) set(x, y, ...parchDark)
    }

  // Søjle + fod
  fillRect(47 * u, 30 * u, 6 * u, 48 * u, walnut)
  fillRect(30 * u, 76 * u, 40 * u, 8 * u, walnut)

  // Bjælke (let skrå: højre tungere) — to segmenter
  for (let i = -32; i <= 32; i++) {
    const x = 50 * u + i * u
    const y = 28 * u + i * 0.14 * u
    fillRect(x - u * 0.6, y - 2 * u, 1.4 * u, 4 * u, i % 2 ? brass : brassLight)
  }
  fillCircle(50 * u, 28 * u, 3.4 * u, brassLight)

  // Kæder
  fillRect(17.6 * u, 23.6 * u, 1 * u, 18 * u, brass)
  fillRect(81.6 * u, 32.6 * u, 1 * u, 18 * u, brass)

  // Skåle
  fillEllipse(18 * u, 43 * u, 13 * u, 4.5 * u, brassLight)
  fillEllipse(18 * u, 42 * u, 13 * u, 4 * u, brass)
  fillEllipse(82 * u, 52 * u, 13 * u, 4.5 * u, brassLight)
  fillEllipse(82 * u, 51 * u, 13 * u, 4 * u, brass)

  // Atomer: ét stort (tungt) i højre, tre små i venstre
  fillCircle(82 * u, 45 * u, 5 * u, [0, 114, 178])
  fillCircle(13 * u, 38 * u, 2.6 * u, [230, 159, 0])
  fillCircle(19 * u, 37 * u, 2.6 * u, [0, 158, 115])
  fillCircle(25 * u, 38 * u, 2.6 * u, [213, 94, 0])

  return px // rå RGBA — enkodning sker efter downsampling
}

/** 4× supersampling: render stort og midl ned — giver bløde, ikke-pixelerede kanter. */
function downsample(rgba, srcSize, factor) {
  const dstSize = srcSize / factor
  const out = Buffer.alloc(dstSize * dstSize * 4)
  for (let y = 0; y < dstSize; y++)
    for (let x = 0; x < dstSize; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let dy = 0; dy < factor; dy++)
        for (let dx = 0; dx < factor; dx++) {
          const i = ((y * factor + dy) * srcSize + x * factor + dx) * 4
          r += rgba[i]
          g += rgba[i + 1]
          b += rgba[i + 2]
          a += rgba[i + 3]
        }
      const n = factor * factor
      const o = (y * dstSize + x) * 4
      out[o] = Math.round(r / n)
      out[o + 1] = Math.round(g / n)
      out[o + 2] = Math.round(b / n)
      out[o + 3] = Math.round(a / n)
    }
  return out
}

mkdirSync(OUT_DIR, { recursive: true })
const SS = 4
for (const size of [180, 192, 512]) {
  const big = makeIcon(size * SS)
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), encodePng(size, downsample(big, size * SS, SS)))
}
console.log(`PWA-ikoner genereret i ${OUT_DIR} (4× supersamplet)`)
