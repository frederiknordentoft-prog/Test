// Grids: the coordinate grid with axes 0–6 (gridCoords), the square grid for area and symmetry, and
// the 100 board. Grid lines are always one path.
import { join, rect, roundRect, segments } from './geom'
import { Disc, MatSvg, Num } from './kit'
import type { MatBase } from './kit'
import { GUIDE, INK, INK_2, MAT, PRIMARY, PRIMARY_SOFT, WHITE } from './palette'
import type { Tone } from './palette'

// ── Coordinate grid ────────────────────────────────────────────────────────

export interface GridPoint {
  x: number
  y: number
  tone?: Tone
}

export interface CoordGridProps extends MatBase {
  w?: number
  h?: number
  points?: GridPoint[]
  /** Dashed guides from the axes to this point (the "walk along, then up" hint). */
  guide?: [number, number]
}

export function CoordGrid({ w = 6, h = 6, points = [], guide, size, ...rest }: CoordGridProps) {
  const cell = 40
  const ox = 44
  const oy = 20 + h * cell
  const W = ox + w * cell + 34
  const H = oy + 40
  const X = (x: number) => ox + x * cell
  const Y = (y: number) => oy - y * cell
  const lines = segments([
    ...Array.from({ length: w }, (_, i) => [X(i + 1), Y(0), X(i + 1), Y(h)] as const),
    ...Array.from({ length: h }, (_, i) => [X(0), Y(i + 1), X(w), Y(i + 1)] as const),
  ])
  const arrows = `M${X(w) + 22} ${Y(0)}l-9 -6v12zM${X(0)} ${Y(h) - 22}l-6 9h12z`
  return (
    <MatSvg w={W} h={H} size={size ?? W} {...rest}>
      <path d={rect(X(0), Y(h), w * cell, h * cell)} fill={WHITE} />
      <path d={lines} stroke={GUIDE} strokeWidth={2} />
      {guide && (
        <path
          d={`M${X(guide[0])} ${Y(0)}V${Y(guide[1])}H${X(0)}`}
          fill="none"
          stroke={PRIMARY}
          strokeWidth={3}
          strokeDasharray="7 6"
          strokeLinecap="round"
        />
      )}
      <path d={`M${X(0)} ${Y(0)}H${X(w) + 16}M${X(0)} ${Y(0)}V${Y(h) - 16}`} stroke={INK} strokeWidth={3.2} strokeLinecap="round" />
      <path d={arrows} fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      {Array.from({ length: w + 1 }, (_, i) => (
        <Num key={`x${i}`} x={X(i)} y={Y(0) + 20} size={17} fill={INK}>
          {i}
        </Num>
      ))}
      {Array.from({ length: h }, (_, i) => (
        <Num key={`y${i}`} x={X(0) - 18} y={Y(i + 1)} size={17} fill={INK}>
          {i + 1}
        </Num>
      ))}
      {points.map((p, i) => (
        <Disc key={i} cx={X(p.x)} cy={Y(p.y)} r={11} tone={p.tone ?? MAT.point} sw={2.6} />
      ))}
    </MatSvg>
  )
}

// ── Square grid (area, symmetry) ───────────────────────────────────────────

export interface SquareGridProps extends MatBase {
  w: number
  h: number
  /** Filled cells, row-major from the top-left (0 … w·h−1). */
  filled?: number[]
  /** A mirror line down the middle (v) or across (h). */
  axis?: 'v' | 'h'
  tone?: Tone
  /** Size of one cell in CSS px (default 36). */
  cellPx?: number
}

export function SquareGrid({ w, h, filled = [], axis, tone = MAT.gridFill, cellPx = 36, size, ...rest }: SquareGridProps) {
  const cell = 40
  const pad = 6
  const W = w * cell + pad * 2
  const H = h * cell + pad * 2
  const cells = join(...filled.filter((c) => c >= 0 && c < w * h).map((c) => rect(pad + (c % w) * cell, pad + Math.floor(c / w) * cell, cell, cell)))
  const lines = segments([
    ...Array.from({ length: w - 1 }, (_, i) => [pad + (i + 1) * cell, pad, pad + (i + 1) * cell, pad + h * cell] as const),
    ...Array.from({ length: h - 1 }, (_, i) => [pad, pad + (i + 1) * cell, pad + w * cell, pad + (i + 1) * cell] as const),
  ])
  const mirror = axis === 'v' ? `M${pad + (w * cell) / 2} ${pad - 4}V${pad + h * cell + 4}` : axis === 'h' ? `M${pad - 4} ${pad + (h * cell) / 2}H${pad + w * cell + 4}` : ''
  return (
    <MatSvg w={W} h={H} size={size ?? (W * cellPx) / cell} {...rest}>
      <path d={roundRect(pad, pad, w * cell, h * cell, 6)} fill={WHITE} />
      {cells && <path d={cells} fill={tone.fill} />}
      <path d={lines} stroke={tone.outline} strokeOpacity={0.35} strokeWidth={2} />
      {cells && <path d={cells} fill="none" stroke={tone.outline} strokeWidth={2.4} strokeLinejoin="round" />}
      <path d={roundRect(pad, pad, w * cell, h * cell, 6)} fill="none" stroke={INK_2} strokeWidth={2.6} />
      {mirror && <path d={mirror} stroke={PRIMARY} strokeWidth={4} strokeDasharray="10 7" strokeLinecap="round" />}
    </MatSvg>
  )
}

// ── 100 board ──────────────────────────────────────────────────────────────

export interface HundredBoardProps extends MatBase {
  /** Cells coloured yellow (numbers 1–100). */
  highlight?: number[]
  /** Cells coloured violet, e.g. the hop path of +10. */
  mark?: number[]
  /** The number hidden as "?". */
  blank?: number
}

export function HundredBoard({ highlight = [], mark = [], blank, size, ...rest }: HundredBoardProps) {
  const cell = 40
  const gap = 3
  const pad = 6
  const W = pad * 2 + 10 * cell + 9 * gap
  const pos = (v: number) => {
    const i = v - 1
    return { x: pad + (i % 10) * (cell + gap), y: pad + Math.floor(i / 10) * (cell + gap) }
  }
  const hi = new Set(highlight)
  const mk = new Set(mark)
  const base = join(...Array.from({ length: 100 }, (_, i) => i + 1).filter((v) => !hi.has(v) && !mk.has(v) && v !== blank).map((v) => { const p = pos(v); return roundRect(p.x, p.y, cell, cell, 8) }))
  const hiD = join(...[...hi].filter((v) => v >= 1 && v <= 100 && v !== blank).map((v) => { const p = pos(v); return roundRect(p.x, p.y, cell, cell, 8) }))
  const mkD = join(...[...mk].filter((v) => v >= 1 && v <= 100 && v !== blank && !hi.has(v)).map((v) => { const p = pos(v); return roundRect(p.x, p.y, cell, cell, 8) }))
  const b = blank !== undefined ? pos(blank) : null
  return (
    <MatSvg w={W} h={W} size={size ?? W} {...rest}>
      <path d={roundRect(0, 0, W, W, 14)} fill={MAT.frame.shade} />
      <path d={base} fill={WHITE} stroke={GUIDE} strokeWidth={1.2} />
      {hiD && <path d={hiD} fill={MAT.cellHi.fill} stroke={MAT.cellHi.outline} strokeOpacity={0.5} strokeWidth={1.6} />}
      {mkD && <path d={mkD} fill={PRIMARY_SOFT} stroke={PRIMARY} strokeOpacity={0.6} strokeWidth={1.6} />}
      {b && <path d={roundRect(b.x + 1, b.y + 1, cell - 2, cell - 2, 8)} fill={PRIMARY_SOFT} stroke={PRIMARY} strokeWidth={2} strokeDasharray="4 3" />}
      {Array.from({ length: 100 }, (_, i) => {
        const v = i + 1
        const p = pos(v)
        const isBlank = v === blank
        return (
          <Num key={v} x={p.x + cell / 2} y={p.y + cell / 2} size={isBlank ? 20 : 16} fill={isBlank ? PRIMARY : INK} weight={isBlank ? 900 : 800}>
            {isBlank ? '?' : v}
          </Num>
        )
      })}
    </MatSvg>
  )
}
