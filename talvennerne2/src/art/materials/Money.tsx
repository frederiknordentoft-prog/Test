// Play money (SPEC §11): coins in correct relative sizes and colours – 50 øre copper; 1, 2 and 5 kr
// silver with a hole; 10 and 20 kr gold – with the value as a number, and notes of 50, 100, 200
// and 500 kr marked "legepenge". No 1000 note, and no motif from the real coins or notes: the
// medallion carries the Talvenner paw.
import { circle, ellipse, join, n, polar, roundRect } from './geom'
import { MatSvg, Num } from './kit'
import type { MatBase } from './kit'
import { GROUND, HIGHLIGHT, MAT, SW, WHITE } from './palette'
import type { Tone } from './palette'

export const COIN_VALUES = [50, 100, 200, 500, 1000, 2000] as const
export type CoinOre = (typeof COIN_VALUES)[number]
export const NOTE_VALUES = [50, 100, 200, 500] as const
export type NoteKr = (typeof NOTE_VALUES)[number]

/** Real diameters in mm (Danmarks Nationalbank). */
export const COIN_MM: Record<CoinOre, number> = { 50: 21.5, 100: 20.25, 200: 24.5, 500: 28.5, 1000: 23.35, 2000: 27 }
/** Real note lengths in mm; all notes are 72 mm high. */
export const NOTE_MM: Record<NoteKr, number> = { 50: 125, 100: 135, 200: 145, 500: 155 }

const COIN_TONE: Record<CoinOre, Tone> = { 50: MAT.copper, 100: MAT.silver, 200: MAT.silver, 500: MAT.silver, 1000: MAT.gold, 2000: MAT.gold }
const HOLED = new Set<CoinOre>([100, 200, 500])

export interface CoinProps extends MatBase {
  ore: CoinOre
  /** CSS px per real millimetre (default 3.2: a 5-krone is 91 px wide). `size` overrides. */
  mm?: number
}

/** Rendered width of a coin at a given scale, for layout. */
export const coinWidth = (ore: CoinOre, mm = 3.2) => COIN_MM[ore] * mm

export function Coin({ ore, mm = 3.2, size, ...rest }: CoinProps) {
  const t = COIN_TONE[ore]
  const holed = HOLED.has(ore)
  const R = 46
  const cx = 50
  const cy = 49
  const edge = 4.5
  const hole = holed ? 9.5 : 0
  // Face with a real see-through hole (even-odd), and the coin's edge below it.
  const faceD = holed ? join(circle(cx, cy, R), circle(cx, cy, hole)) : circle(cx, cy, R)
  const edgeD = holed ? join(circle(cx, cy + edge, R), circle(cx, cy + edge, hole)) : circle(cx, cy + edge, R)
  const kr = ore >= 100
  const value = kr ? String(ore / 100) : '50'
  const unit = kr ? 'KR' : 'ØRE'
  // Beaded border for the gold coins, a plain raised rim for the others.
  const beads = ore >= 1000 ? join(...Array.from({ length: 28 }, (_, i) => {
    const [x, y] = polar(cx, cy, R - 7.5, (360 * i) / 28)
    return circle(x, y, 1.5)
  })) : ''
  return (
    <MatSvg w={100} h={100 + edge + 2} size={size ?? COIN_MM[ore] * mm} {...rest}>
      <path d={ellipse(cx, cy + edge + 2, R * 0.92, 5)} fill={GROUND} />
      <path d={edgeD} fill={t.shade} stroke={t.outline} strokeWidth={SW} fillRule="evenodd" />
      <path d={faceD} fill={t.fill} fillRule="evenodd" />
      {/* raised rim */}
      <path d={circle(cx, cy, R - 6)} fill="none" stroke={t.shade} strokeWidth={2.2} />
      {beads && <path d={beads} fill={t.shade} />}
      {/* sheen along the upper-left rim */}
      <path d={`M${n(cx - 30)} ${n(cy - 26)}A${R - 3} ${R - 3} 0 0 1 ${n(cx + 8)} ${n(cy - 42.5)}`} fill="none" stroke={HIGHLIGHT} strokeWidth={4.5} strokeLinecap="round" />
      {holed && <path d={circle(cx, cy, hole)} fill="none" stroke={t.outline} strokeWidth={2.4} />}
      {holed && <path d={`M${n(cx - hole + 1.5)} ${n(cy - 1.5)}A${hole - 1.5} ${hole - 1.5} 0 0 1 ${n(cx + hole - 1.5)} ${n(cy - 1.5)}`} fill="none" stroke={t.shade} strokeWidth={2.4} />}
      <path d={faceD} fill="none" stroke={t.outline} strokeWidth={SW} />
      {holed ? (
        <>
          <Num x={cx} y={cy - 22} size={27} fill={t.outline}>{value}</Num>
          <Num x={cx} y={cy + 23} size={12.5} fill={t.outline} letterSpacing={1}>{unit}</Num>
        </>
      ) : (
        <>
          <Num x={cx} y={cy - 5} size={ore === 50 ? 32 : 34} fill={t.outline}>{value}</Num>
          <Num x={cx} y={cy + 22} size={12} fill={t.outline} letterSpacing={1}>{unit}</Num>
        </>
      )}
    </MatSvg>
  )
}

const NOTE_TONE: Record<NoteKr, Tone> = { 50: MAT.note50, 100: MAT.note100, 200: MAT.note200, 500: MAT.note500 }

export interface BanknoteProps extends MatBase {
  kr: NoteKr
  /** CSS px per real millimetre (default 1.25: a 50-krone note is 156 px wide). `size` overrides. */
  mm?: number
}

export const noteWidth = (kr: NoteKr, mm = 1.25) => NOTE_MM[kr] * mm

function pawPath(x: number, y: number, s: number): string {
  return join(
    ellipse(x, y + 3 * s, 5.2 * s, 4.2 * s),
    ellipse(x - 6.2 * s, y - 2.4 * s, 2.1 * s, 2.6 * s),
    ellipse(x - 2.2 * s, y - 6 * s, 2.1 * s, 2.7 * s),
    ellipse(x + 2.2 * s, y - 6 * s, 2.1 * s, 2.7 * s),
    ellipse(x + 6.2 * s, y - 2.4 * s, 2.1 * s, 2.6 * s),
  )
}

export function Banknote({ kr, mm = 1.25, size, ...rest }: BanknoteProps) {
  const t = NOTE_TONE[kr]
  const W = NOTE_MM[kr] * 2
  const H = 144
  const pad = 10
  // Guilloche-style waves (one path) and the medallion.
  const waves = Array.from({ length: 3 }, (_, k) => {
    const y0 = H - 34 + k * 7
    let d = `M${pad + 6} ${n(y0)}`
    for (let x = pad + 6; x <= W - pad - 6; x += 12) d += `Q${n(x + 6)} ${n(y0 + (k % 2 ? 5 : -5))} ${n(x + 12)} ${n(y0)}`
    return d
  }).join('')
  const mx = W - 62
  const my = 62
  return (
    <MatSvg w={W} h={H + 6} size={size ?? NOTE_MM[kr] * mm} {...rest}>
      <path d={roundRect(4, 8, W - 4, H - 4, 12)} fill={GROUND} />
      <path d={roundRect(1.5, 1.5, W - 3, H - 3, 12)} fill={t.fill} />
      <path d={roundRect(pad, pad, W - 2 * pad, H - 2 * pad, 7)} fill="none" stroke={t.light} strokeWidth={2.5} />
      <path d={waves} fill="none" stroke={t.shade} strokeWidth={2} strokeLinecap="round" />
      <path d={circle(mx, my, 38)} fill={t.light} />
      <path d={circle(mx, my, 38)} fill="none" stroke={t.shade} strokeWidth={3} strokeDasharray="1 5.5" strokeLinecap="round" />
      <path d={pawPath(mx, my + 2, 2.3)} fill={t.shade} />
      <path d={`M${pad + 8} ${pad + 10}h${n(W * 0.3)}`} stroke={HIGHLIGHT} strokeWidth={5} strokeLinecap="round" />
      <Num x={pad + 16} y={60} size={62} fill={WHITE} anchor="start" stroke={t.outline} strokeWidth={7}>
        {kr}
      </Num>
      <Num x={pad + 18} y={H - 60} size={16} fill={t.outline} anchor="start" letterSpacing={2}>
        KRONER
      </Num>
      <Num x={W / 2} y={H - 20} size={14} fill={t.outline} weight={800} letterSpacing={2}>
        legepenge
      </Num>
      <path d={roundRect(1.5, 1.5, W - 3, H - 3, 12)} fill="none" stroke={t.outline} strokeWidth={SW} />
    </MatSvg>
  )
}
