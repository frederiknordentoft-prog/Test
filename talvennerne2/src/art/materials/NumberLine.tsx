// Number line 0–20 / 0–100 / 0–1000 (SPEC Prompt 'line'): minor and major ticks as one path each,
// labels on the major ticks, an arrow marker, a target dot and hop arcs with arrowheads. `xOf`
// exposes the value → x mapping so an interactive numberline kind can hit-test the same geometry.
import { circle, n, roundPoly, segments } from './geom'
import { MatSvg, Num } from './kit'
import type { MatBase } from './kit'
import { INK, INK_2, MAT, PRIMARY, WHITE } from './palette'

export interface NumberLineProps extends MatBase {
  min: number
  max: number
  /** Tick every `step` (default: 1 up to a span of 20, else span/20 rounded to 5, 10, 50 …). */
  step?: number
  /** Label every `labelEvery` (default: every tick up to 20 ticks, else every 10th value step). */
  labelEvery?: number
  /** Labels only at the ends (the empty number line). */
  endsOnly?: boolean
  arrowAt?: number
  target?: number
  /** Visited values in order; each pair is drawn as a hop with its size, e.g. [8, 10, 13]. */
  hops?: number[]
  /** Show "+2" / "−3" over each hop. */
  hopLabels?: boolean
}

export const NL = { W: 640, PAD: 34, Y: 118, H: 176 } as const

/** The smallest 1, 2 or 5 · 10^k that is at least x. */
function niceAtLeast(x: number): number {
  const pow = 10 ** Math.floor(Math.log10(x))
  for (const m of [1, 2, 5, 10]) if (m * pow >= x - 1e-9) return m * pow
  return 10 * pow
}

/** Tick step: every whole number up to a span of 20, otherwise about 20 ticks. */
export function niceStep(span: number): number {
  return span <= 20 ? 1 : niceAtLeast(span / 20)
}

/** x coordinate (in NL units) of a value. */
export function xOf(v: number, min: number, max: number): number {
  return NL.PAD + ((v - min) / (max - min)) * (NL.W - 2 * NL.PAD)
}

export function NumberLine({ min, max, step, labelEvery, endsOnly, arrowAt, target, hops, hopLabels = true, size, ...rest }: NumberLineProps) {
  const s = step ?? niceStep(max - min)
  const ticks = Math.round((max - min) / s)
  // Up to 0–20 every tick is labelled; beyond that a tenth of the span (10s on 0–100, 100s on 0–1000).
  const every = labelEvery ?? (max - min <= 20 ? s : Math.max(s, niceAtLeast((max - min) / 10)))
  const X = (v: number) => xOf(v, min, max)
  const { W, Y, H } = NL
  const major: [number, number, number, number][] = []
  const minor: [number, number, number, number][] = []
  const labels: number[] = []
  for (let i = 0; i <= ticks; i++) {
    const v = min + i * s
    const isLabel = endsOnly ? i === 0 || i === ticks : Math.abs((v - min) % every) < 1e-9
    if (isLabel || i === 0 || i === ticks) {
      major.push([X(v), Y - 12, X(v), Y + 12])
      if (isLabel) labels.push(v)
    } else minor.push([X(v), Y - 7, X(v), Y + 7])
  }
  const hopPaths: { d: string; head: string; label: string; x: number; y: number }[] = []
  if (hops && hops.length > 1) {
    for (let i = 0; i < hops.length - 1; i++) {
      const a = hops[i]
      const b = hops[i + 1]
      const xa = X(a)
      const xb = X(b)
      const lift = Math.max(14, Math.min(64, Math.abs(xb - xa) * 0.45))
      const y0 = Y - 15
      const top = y0 - lift * 1.33
      const d = `M${n(xa)} ${y0}C${n(xa)} ${n(top)} ${n(xb)} ${n(top)} ${n(xb)} ${y0 - 6}`
      const head = roundPoly([[xb, Y - 13], [xb - 7.5, Y - 27], [xb + 7.5, Y - 27]], 1.5)
      const diff = b - a
      const peak = 0.25 * y0 + 0.75 * top
      hopPaths.push({ d, head, label: diff >= 0 ? `+${diff}` : `−${Math.abs(diff)}`, x: (xa + xb) / 2, y: peak - 13 })
    }
  }
  return (
    <MatSvg w={W} h={H} size={size ?? W} {...rest}>
      <path d={`M${NL.PAD - 22} ${Y}H${W - NL.PAD + 22}`} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d={`M${W - NL.PAD + 26} ${Y}l-11 -7v14z`} fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <path d={segments(minor)} stroke={INK_2} strokeWidth={2.4} strokeLinecap="round" />
      <path d={segments(major)} stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
      {labels.map((v) => (
        <Num key={v} x={X(v)} y={Y + 32} size={ticks > 20 && !endsOnly ? 18 : 20} fill={INK}>
          {v}
        </Num>
      ))}
      {hopPaths.map((h, i) => (
        <g key={i}>
          <path d={h.d} fill="none" stroke={PRIMARY} strokeWidth={3.6} strokeLinecap="round" />
          <path d={h.head} fill={PRIMARY} stroke={PRIMARY} strokeWidth={1.5} strokeLinejoin="round" />
          {hopLabels && (
            <Num x={h.x} y={h.y} size={17} fill={PRIMARY} stroke={WHITE} strokeWidth={5}>
              {h.label}
            </Num>
          )}
        </g>
      ))}
      {target !== undefined && <path d={circle(X(target), Y, 9)} fill={MAT.point.fill} stroke={WHITE} strokeWidth={3} />}
      {arrowAt !== undefined && (
        <g>
          <path d={`M${n(X(arrowAt))} ${Y - 16}V${Y - 58}`} stroke={MAT.counterB.outline} strokeWidth={4} strokeLinecap="round" />
          <path d={roundPoly([[X(arrowAt), Y - 14], [X(arrowAt) - 12, Y - 34], [X(arrowAt) + 12, Y - 34]], 2.5)} fill={MAT.counterB.fill} stroke={MAT.counterB.outline} strokeWidth={2.6} strokeLinejoin="round" />
        </g>
      )}
    </MatSvg>
  )
}
