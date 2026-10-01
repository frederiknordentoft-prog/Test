// Data displays for readChart (SPEC §2.2): a bar chart with a numbered axis and a pictogram. The
// categories are usually species; pass `renderCat` to draw them (SVG content in a size×size box at
// x, y). Without it each category gets a coloured token with a paw.
import type { ReactNode } from 'react'
import { circle, ellipse, join, n, roundRect, segments } from './geom'
import { MatSvg, Num } from './kit'
import { GUIDE, HIGHLIGHT, INK, INK_2, MAT, ROW_TINT, WHITE } from './palette'
import type { Tone } from './palette'
import type { MatBase } from './kit'
import { ThingArt } from './Things'

export interface ChartDatum {
  cat: string
  n: number
}
export type RenderCat = (cat: string, x: number, y: number, size: number, index: number) => ReactNode

const BAR_TONES: Tone[] = [MAT.bar, MAT.barB, MAT.barC, MAT.barD]

function paw(x: number, y: number, s: number): string {
  return join(
    ellipse(x, y + 2.4 * s, 4 * s, 3.2 * s),
    ellipse(x - 4.6 * s, y - 1.8 * s, 1.6 * s, 2 * s),
    ellipse(x - 1.6 * s, y - 4.6 * s, 1.6 * s, 2.1 * s),
    ellipse(x + 1.6 * s, y - 4.6 * s, 1.6 * s, 2.1 * s),
    ellipse(x + 4.6 * s, y - 1.8 * s, 1.6 * s, 2 * s),
  )
}

/** Default category token: a coloured disc with a paw. */
function CatToken({ x, y, size, tone }: { x: number; y: number; size: number; tone: Tone }) {
  const r = size / 2
  return (
    <g>
      <path d={circle(x + r, y + r, r - 1.5)} fill={tone.fill} stroke={tone.outline} strokeWidth={2.4} />
      <path d={paw(x + r, y + r + 1, r / 11)} fill={WHITE} />
    </g>
  )
}

export interface BarChartProps extends MatBase {
  data: ChartDatum[]
  /** Axis maximum (default: the largest value rounded up to an even number, at least 4). */
  max?: number
  renderCat?: RenderCat
}

export function BarChart({ data, max, renderCat, size, ...rest }: BarChartProps) {
  const top = Math.max(4, max ?? Math.ceil(Math.max(0, ...data.map((d) => d.n)) / 2) * 2)
  const step = top <= 10 ? 1 : top <= 20 ? 2 : 5
  const left = 48
  const colW = 74
  const plotH = 200
  const y0 = 222
  const W = left + data.length * colW + 12
  const H = y0 + 62
  const yOf = (v: number) => y0 - (v / top) * plotH
  const grid = segments(Array.from({ length: Math.floor(top / step) }, (_, i) => [left, yOf((i + 1) * step), W - 8, yOf((i + 1) * step)] as const))
  return (
    <MatSvg w={W} h={H} size={size ?? W} {...rest}>
      <path d={grid} stroke={GUIDE} strokeWidth={1.6} strokeDasharray="1 6" strokeLinecap="round" />
      {Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => (
        <Num key={i} x={left - 14} y={yOf(i * step)} size={15} fill={INK_2} weight={800}>
          {i * step}
        </Num>
      ))}
      {data.map((d, i) => {
        const t = BAR_TONES[i % BAR_TONES.length]
        const x = left + 14 + i * colW
        const bw = colW - 28
        const h = (Math.max(0, d.n) / top) * plotH
        const bar = roundRect(x, y0 - h, bw, h + 6, 8)
        return (
          <g key={`${d.cat}-${i}`}>
            {h > 0 && (
              <>
                <path d={bar} fill={t.fill} />
                <path d={roundRect(x + bw - 12, y0 - h + 6, 10, h - 4, 4)} fill={t.shade} />
                <path d={`M${n(x + 9)} ${n(y0 - h + 12)}V${n(Math.max(y0 - h + 12, y0 - 10))}`} stroke={HIGHLIGHT} strokeWidth={5} strokeLinecap="round" />
                <path d={bar} fill="none" stroke={t.outline} strokeWidth={2.6} />
              </>
            )}
            {renderCat ? renderCat(d.cat, x + bw / 2 - 20, y0 + 14, 40, i) : <CatToken x={x + bw / 2 - 20} y={y0 + 14} size={40} tone={t} />}
          </g>
        )
      })}
      <path d={`M${left} 14V${y0}H${W - 6}`} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </MatSvg>
  )
}

export interface PictogramProps extends MatBase {
  data: ChartDatum[]
  /** Symbol drawn per unit (a ThingId, default 'star'). */
  symbol?: string
  renderCat?: RenderCat
}

export function Pictogram({ data, symbol = 'star', renderCat, size, ...rest }: PictogramProps) {
  const maxN = Math.max(1, ...data.map((d) => d.n))
  const rowH = 56
  const left = 64
  const sym = 40
  const W = left + maxN * (sym + 4) + 16
  const H = data.length * rowH + 8
  return (
    <MatSvg w={W} h={H} size={size ?? W} {...rest}>
      {data.map((d, i) => {
        const y = 4 + i * rowH
        const t = BAR_TONES[i % BAR_TONES.length]
        return (
          <g key={`${d.cat}-${i}`}>
            <path d={roundRect(4, y + 2, W - 8, rowH - 4, 16)} fill={i % 2 ? ROW_TINT : 'none'} />
            {renderCat ? renderCat(d.cat, 12, y + 8, 40, i) : <CatToken x={12} y={y + 8} size={40} tone={t} />}
            <path d={`M${left - 6} ${y + 10}V${y + rowH - 10}`} stroke={GUIDE} strokeWidth={2} strokeLinecap="round" />
            {Array.from({ length: Math.max(0, d.n) }, (_, k) => (
              <ThingArt key={k} id={symbol} x={left + k * (sym + 4)} y={y + 8} k={sym / 48} />
            ))}
          </g>
        )
      })}
    </MatSvg>
  )
}
