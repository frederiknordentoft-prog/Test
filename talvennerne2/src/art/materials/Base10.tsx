// Multibase (Dienes blocks, SPEC §11): unit cube, rod (10) and flat (100) in an oblique 3/4 view with
// three tones – top light, front mid, side dark. All grid lines of a block are one path, so a flat is
// a handful of elements. Base10Group lays out h flats, t rods and o units bottom-aligned.
import { join, n, poly } from './geom'
import type { V2 } from './geom'
import { MatSvg } from './kit'
import type { MatBase } from './kit'
import { MAT } from './palette'
import type { Tone } from './palette'

export type Base10Kind = 'unit' | 'rod' | 'flat'

const DEPTH = 0.5 // oblique depth factor (xs along 45°)

interface BlockGeo {
  front: string
  top: string
  side: string
  grid: string
  outline: string
}

/** Geometry of one block with its front-bottom-left corner at (x, y + h). */
function blockGeo(kind: Base10Kind, x: number, y: number, s: number): BlockGeo {
  const cols = kind === 'flat' ? 10 : 1
  const rows = kind === 'unit' ? 1 : 10
  const w = cols * s
  const h = rows * s
  const d = s * DEPTH
  const P = (px: number, py: number): V2 => [px, py]
  const front = poly([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)])
  const top = poly([P(x, y), P(x + d, y - d), P(x + w + d, y - d), P(x + w, y)])
  const side = poly([P(x + w, y), P(x + w + d, y - d), P(x + w + d, y + h - d), P(x + w, y + h)])
  let grid = ''
  for (let k = 1; k < rows; k++) {
    const yy = y + k * s
    grid += `M${n(x)} ${n(yy)}H${n(x + w)}L${n(x + w + d)} ${n(yy - d)}`
  }
  for (let k = 1; k < cols; k++) {
    const xx = x + k * s
    grid += `M${n(xx)} ${n(y + h)}V${n(y)}L${n(xx + d)} ${n(y - d)}`
  }
  const outline = join(
    poly([P(x, y), P(x + d, y - d), P(x + w + d, y - d), P(x + w + d, y + h - d), P(x + w, y + h), P(x, y + h)]),
    `M${n(x)} ${n(y)}H${n(x + w)}V${n(y + h)}M${n(x + w)} ${n(y)}L${n(x + w + d)} ${n(y - d)}`,
  )
  return { front, top, side, grid, outline }
}

function Block({ geo, tone, s }: { geo: BlockGeo; tone: Tone; s: number }) {
  const sw = Math.max(1.4, s * 0.12)
  return (
    <g>
      <path d={geo.front} fill={tone.fill} />
      <path d={geo.top} fill={tone.light} />
      <path d={geo.side} fill={tone.shade} />
      {geo.grid && <path d={geo.grid} fill="none" stroke={tone.outline} strokeOpacity={0.45} strokeWidth={sw * 0.6} strokeLinecap="round" />}
      <path d={geo.outline} fill="none" stroke={tone.outline} strokeWidth={sw} strokeLinejoin="round" />
    </g>
  )
}

export interface Base10BlockProps extends MatBase {
  kind: Base10Kind
  /** Edge of one unit cube in CSS px (default 16). */
  unit?: number
}

export function Base10Block({ kind, unit = 16, size, ...rest }: Base10BlockProps) {
  const s = 20
  const cols = kind === 'flat' ? 10 : 1
  const rows = kind === 'unit' ? 1 : 10
  const d = s * DEPTH
  const pad = 2
  const W = cols * s + d + pad * 2
  const H = rows * s + d + pad * 2
  const geo = blockGeo(kind, pad, pad + d, s)
  return (
    <MatSvg w={W} h={H} size={size ?? (W * unit) / s} {...rest}>
      <Block geo={geo} tone={MAT.wood} s={s} />
    </MatSvg>
  )
}

export interface Base10GroupProps extends MatBase {
  h?: number
  t?: number
  o: number
  /** 'oth' shows the units first (used by the digitSwap hint). */
  order?: 'hto' | 'oth'
  unit?: number
}

/** h flats, t rods and o units in one picture, bottom-aligned, grouped with breathing room. */
export function Base10Group({ h = 0, t = 0, o, order = 'hto', unit = 12, size, ...rest }: Base10GroupProps) {
  const s = 20
  const d = s * DEPTH
  const gap = s * 0.35
  const groupGap = s * 1.1
  const tall = 10 * s
  const baseY = tall + d + 4
  type Part = { w: number; draw: (x: number) => BlockGeo[] }
  // Up to three flats stand side by side; more are fanned so they still fit and can be counted.
  const flatStep = h > 3 ? d + gap * 1.8 : 10 * s + d + gap * 2
  const flats: Part | null = h > 0 ? { w: 10 * s + d + (h - 1) * flatStep, draw: (x) => Array.from({ length: h }, (_, i) => blockGeo('flat', x + i * flatStep, baseY - tall, s)) } : null
  const rods: Part | null = t > 0 ? { w: t * s + (t - 1) * gap + d, draw: (x) => Array.from({ length: t }, (_, i) => blockGeo('rod', x + i * (s + gap), baseY - tall, s)) } : null
  const unitCols = Math.ceil(o / 5)
  const units: Part | null = o > 0
    ? {
        w: unitCols * s + (unitCols - 1) * gap + d,
        draw: (x) =>
          Array.from({ length: o }, (_, i) => {
            const col = Math.floor(i / 5)
            const row = i % 5
            return blockGeo('unit', x + col * (s + gap), baseY - s - row * (s + gap * 0.6), s)
          }),
      }
    : null
  const parts = (order === 'hto' ? [flats, rods, units] : [units, rods, flats]).filter((p): p is Part => p !== null)
  let x = 4
  const drawn: BlockGeo[][] = []
  for (const p of parts) {
    drawn.push(p.draw(x))
    x += p.w + groupGap
  }
  const W = Math.max(40, x - groupGap + 4)
  const H = baseY + 4
  return (
    <MatSvg w={W} h={H} size={size ?? (W * unit) / s} {...rest}>
      {drawn.flat().map((geo, i) => (
        <Block key={i} geo={geo} tone={MAT.wood} s={s} />
      ))}
    </MatSvg>
  )
}
