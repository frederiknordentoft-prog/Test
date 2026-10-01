// Fraction figures: a circle, rectangle or bar cut into n equal – or deliberately unequal – parts
// with k coloured (fractionShape, halfShape, colorParts), and stacked fraction bars (fractionCompare).
// Part separators are one path.
import { circle, n, polar, rect, roundRect, sector, segments } from './geom'
import { MatSvg } from './kit'
import type { MatBase } from './kit'
import { HIGHLIGHT, MAT, SW } from './palette'

/** Relative sizes for unequal cuts: clearly unequal, never accidentally equal. */
const UNEQUAL: Record<number, number[]> = {
  2: [0.64, 0.36],
  3: [0.46, 0.32, 0.22],
  4: [0.36, 0.28, 0.2, 0.16],
  5: [0.3, 0.24, 0.2, 0.15, 0.11],
  6: [0.26, 0.21, 0.17, 0.14, 0.12, 0.1],
  8: [0.2, 0.17, 0.14, 0.12, 0.11, 0.1, 0.09, 0.07],
}
function weights(parts: number, equal: boolean): number[] {
  if (equal || !UNEQUAL[parts]) return Array.from({ length: parts }, () => 1 / parts)
  return UNEQUAL[parts]
}

export interface FractionShapeProps extends MatBase {
  shape: 'circle' | 'rect' | 'bar'
  parts: number
  colored: number
  equal?: boolean
  /** Which parts are coloured (indices); default the first `colored`. For colorParts. */
  on?: number[]
}

export function FractionShape({ shape, parts, colored, equal = true, on, size, ...rest }: FractionShapeProps) {
  const p = Math.max(1, Math.round(parts))
  const w = weights(p, equal)
  const isOn = (i: number) => (on ? on.includes(i) : i < colored)
  const full = MAT.frac
  const empty = MAT.fracEmpty
  if (shape === 'circle') {
    const cx = 60
    const cy = 60
    const r = 54
    let a = -90
    const slices = w.map((f, i) => {
      const a0 = a
      a += f * 360
      return { d: sector(cx, cy, r, a0, a), on: isOn(i), a0 }
    })
    const cuts = p > 1 ? segments(slices.map((s) => { const [x, y] = polar(cx, cy, r, s.a0); return [cx, cy, x, y] as const })) : ''
    return (
      <MatSvg w={120} h={120} size={size ?? 120} {...rest}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.on ? full.fill : empty.fill} />
        ))}
        <path d={`M${n(cx - 36)} ${n(cy - 30)}A46 46 0 0 1 ${n(cx - 6)} ${n(cy - 46)}`} fill="none" stroke={HIGHLIGHT} strokeWidth={5} strokeLinecap="round" />
        {cuts && <path d={cuts} stroke={full.outline} strokeWidth={2.6} strokeLinecap="round" />}
        <path d={circle(cx, cy, r)} fill="none" stroke={full.outline} strokeWidth={SW} />
        <path d={circle(cx, cy, 3.2)} fill={full.outline} />
      </MatSvg>
    )
  }
  const W = shape === 'bar' ? 220 : 140
  const H = shape === 'bar' ? 52 : 100
  const x0 = 4
  const y0 = 4
  const iw = W - 8
  const ih = H - 8
  let x = x0
  const cells = w.map((f, i) => {
    const cw = f * iw
    const c = { x, w: cw, on: isOn(i) }
    x += cw
    return c
  })
  const cuts = segments(cells.slice(1).map((c) => [c.x, y0, c.x, y0 + ih] as const))
  const radius = shape === 'bar' ? 10 : 14
  return (
    <MatSvg w={W} h={H} size={size ?? W} {...rest}>
      <path d={roundRect(x0, y0, iw, ih, radius)} fill={empty.fill} />
      {cells.map((c, i) =>
        c.on ? <path key={i} d={clipRect(c.x, y0, c.w, ih, x0, iw, radius)} fill={full.fill} /> : null,
      )}
      <path d={`M${x0 + 12} ${y0 + 8}H${n(x0 + iw * 0.4)}`} stroke={HIGHLIGHT} strokeWidth={4.5} strokeLinecap="round" />
      {p > 1 && <path d={cuts} stroke={full.outline} strokeWidth={2.6} />}
      <path d={roundRect(x0, y0, iw, ih, radius)} fill="none" stroke={full.outline} strokeWidth={SW} />
    </MatSvg>
  )
}

/** A cell of a rounded strip: square inner edges, rounded outer corners where it touches the ends. */
function clipRect(x: number, y: number, w: number, h: number, stripX: number, stripW: number, r: number): string {
  const atLeft = Math.abs(x - stripX) < 0.01
  const atRight = Math.abs(x + w - (stripX + stripW)) < 0.01
  if (!atLeft && !atRight) return rect(x, y, w, h)
  const rl = atLeft ? Math.min(r, w) : 0
  const rr = atRight ? Math.min(r, w) : 0
  return (
    `M${n(x + rl)} ${n(y)}H${n(x + w - rr)}` +
    (rr ? `A${n(rr)} ${n(rr)} 0 0 1 ${n(x + w)} ${n(y + rr)}V${n(y + h - rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x + w - rr)} ${n(y + h)}` : `V${n(y + h)}`) +
    `H${n(x + rl)}` +
    (rl ? `A${n(rl)} ${n(rl)} 0 0 1 ${n(x)} ${n(y + h - rl)}V${n(y + rl)}A${n(rl)} ${n(rl)} 0 0 1 ${n(x + rl)} ${n(y)}z` : `V${n(y)}z`)
  )
}

export interface FractionBarsProps extends MatBase {
  /** Fractions like '1/2', '3/4'. Each bar is the same whole, split into its denominator. */
  fracs: string[]
  /** Draw the whole (1) as a full bar on top. */
  whole?: boolean
}

export function FractionBars({ fracs, whole = false, size, ...rest }: FractionBarsProps) {
  const rows = (whole ? ['1/1'] : []).concat(fracs)
  const W = 260
  const bh = 40
  const gap = 12
  const H = rows.length * (bh + gap) - gap + 8
  const iw = W - 8
  return (
    <MatSvg w={W} h={H} size={size ?? W} {...rest}>
      {rows.map((f, r) => {
        const [num, den] = f.split('/').map(Number)
        const d = Math.max(1, den || 1)
        const k = Math.max(0, Math.min(d, num || 0))
        const y = 4 + r * (bh + gap)
        const cw = iw / d
        return (
          <g key={`${f}-${r}`}>
            <path d={roundRect(4, y, iw, bh, 10)} fill={MAT.fracEmpty.fill} />
            {Array.from({ length: k }, (_, i) => (
              <path key={i} d={clipRect(4 + i * cw, y, cw, bh, 4, iw, 10)} fill={MAT.frac.fill} />
            ))}
            {d > 1 && <path d={segments(Array.from({ length: d - 1 }, (_, i) => [4 + (i + 1) * cw, y, 4 + (i + 1) * cw, y + bh] as const))} stroke={MAT.frac.outline} strokeWidth={2.4} />}
            <path d={roundRect(4, y, iw, bh, 10)} fill="none" stroke={MAT.frac.outline} strokeWidth={2.8} />
          </g>
        )
      })}
    </MatSvg>
  )
}
