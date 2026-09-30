// Counting materials: ten-frames, dice, fingers and the bead string (rekenrek). Counters and beads
// are cel-shaded discs; everything reads at iPhone size.
import { blob, circle, ellipse, join, lune, n, roundRect, segments } from './geom'
import { Disc, MatSvg } from './kit'
import type { MatBase } from './kit'
import { GROUND, HIGHLIGHT, INK, MAT, SW } from './palette'
import type { Tone } from './palette'

// ── Ten-frame ──────────────────────────────────────────────────────────────

export interface TenFrameProps extends MatBase {
  /** Counters in the first colour (0–10). */
  n: number
  /** Further counters in the second colour after the first ones (e.g. 8 + 2 in "fyld op til 10"). */
  extra?: number
  /** Show empty frame cells with a faint dot (helps counting the gaps). */
  ghosts?: boolean
}

const CELL = 44

export function TenFrame({ n: count, extra = 0, ghosts = false, size, ...rest }: TenFrameProps) {
  const pad = 8
  const W = CELL * 5 + pad * 2
  const H = CELL * 2 + pad * 2
  const f = MAT.frame
  const lines = segments([
    ...[1, 2, 3, 4].map((i) => [pad + i * CELL, pad, pad + i * CELL, pad + 2 * CELL] as const),
    [pad, pad + CELL, pad + 5 * CELL, pad + CELL] as const,
  ])
  const a = Math.max(0, Math.min(10, Math.round(count)))
  const b = Math.max(0, Math.min(10 - a, Math.round(extra)))
  return (
    <MatSvg w={W} h={H + 6} size={size ?? W} {...rest}>
      <path d={roundRect(pad - 4, pad + 2, W - 2 * pad + 8, H - 2 * pad + 6, 14)} fill={GROUND} />
      <path d={roundRect(pad - 4, pad - 4, W - 2 * pad + 8, H - 2 * pad + 8, 14)} fill={f.fill} />
      <path d={lines} stroke={f.outline} strokeOpacity={0.55} strokeWidth={2} />
      {Array.from({ length: 10 }, (_, i) => {
        const cx = pad + (i % 5) * CELL + CELL / 2
        const cy = pad + Math.floor(i / 5) * CELL + CELL / 2
        if (i < a) return <Disc key={i} cx={cx} cy={cy} r={15} tone={MAT.counterA} sw={2.6} />
        if (i < a + b) return <Disc key={i} cx={cx} cy={cy} r={15} tone={MAT.counterB} sw={2.6} />
        return ghosts ? <path key={i} d={circle(cx, cy, 3)} fill={f.outline} opacity={0.25} /> : null
      })}
      <path d={roundRect(pad - 4, pad - 4, W - 2 * pad + 8, H - 2 * pad + 8, 14)} fill="none" stroke={f.outline} strokeWidth={SW} />
    </MatSvg>
  )
}

/** Two ten-frames stacked, for 11–20 (the first frame fills first). */
export function DoubleTenFrame({ n: count, size, ...rest }: MatBase & { n: number }) {
  const first = Math.min(10, count)
  const second = Math.max(0, Math.min(10, count - 10))
  const w = size ?? 236
  return (
    <span
      className={rest.className}
      style={{ display: 'inline-grid', gap: w * 0.04, ...rest.style }}
      role={rest.label ? 'img' : undefined}
      aria-label={rest.label}
      aria-hidden={rest.label ? undefined : true}
    >
      <TenFrame n={first} size={w} />
      <TenFrame n={second} size={w} ghosts={second === 0} />
    </span>
  )
}

// ── Dice ───────────────────────────────────────────────────────────────────

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}

export function Die({ n: value, size, ...rest }: MatBase & { n: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const t = MAT.die
  const pips = join(...(PIPS[value] ?? []).map(([x, y]) => circle(50 + x * 24, 48 + y * 24, 9)))
  return (
    <MatSvg w={100} h={108} size={size ?? 96} {...rest}>
      <path d={ellipse(50, 102, 40, 5)} fill={GROUND} />
      <path d={roundRect(4, 10, 92, 90, 24)} fill={t.shade} stroke={t.outline} strokeWidth={SW} />
      <path d={roundRect(4, 4, 92, 88, 24)} fill={t.fill} />
      <path d={pips} fill={INK} />
      <path d={join(...(PIPS[value] ?? []).map(([x, y]) => ellipse(50 + x * 24 - 3, 48 + y * 24 - 3.5, 3, 2)))} fill={HIGHLIGHT} />
      <path d={roundRect(4, 4, 92, 88, 24)} fill="none" stroke={t.outline} strokeWidth={SW} />
    </MatSvg>
  )
}

// ── Fingers ────────────────────────────────────────────────────────────────

export type SkinTone = 'a' | 'b' | 'c'
const SKIN: Record<SkinTone, Tone> = { a: MAT.skinA, b: MAT.skinB, c: MAT.skinC }

/** Finger capsule from (x, base) upwards, `len` long, `w` wide, tilted `rot` degrees. */
function capsule(x: number, base: number, len: number, w: number): string {
  const r = w / 2
  return `M${n(x - r)} ${n(base)}V${n(base - len + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(base - len + r)}V${n(base)}z`
}

export interface HandProps extends MatBase {
  /** Raised fingers 0–5: index, middle, ring, little, then the thumb. */
  n: number
  /** Mirror for the child's left hand. */
  side?: 'right' | 'left'
  skin?: SkinTone
}

export function Hand({ n: count, side = 'right', skin = 'b', size, ...rest }: HandProps) {
  const t = SKIN[skin]
  const k = Math.max(0, Math.min(5, Math.round(count)))
  const fingers = [
    { x: 41, len: 50, w: 17 },
    { x: 58, len: 56, w: 17 },
    { x: 75, len: 52, w: 16.5 },
    { x: 90, len: 40, w: 15 },
  ]
  const base = 80
  const fingerD = join(...fingers.map((f, i) => capsule(f.x, base + 6, i < k ? f.len + 6 : 20, f.w)))
  const palm = blob([[30, 80], [44, 67], [66, 66], [88, 67], [100, 80], [100, 108], [92, 134], [66, 146], [40, 134], [30, 108]], 0.9)
  const thumbUp = k >= 5
  const thumb = thumbUp
    ? blob([[46, 98], [34, 112], [22, 98], [12, 82], [18, 72], [27, 76], [38, 88]], 0.9)
    : blob([[36, 116], [34, 106], [46, 98], [60, 97], [68, 104], [62, 111], [48, 112]], 0.9)
  const cuff = roundRect(34, 138, 62, 22, 10)
  return (
    <MatSvg w={116} h={162} size={size ?? 96} {...rest}>
      <g transform={side === 'left' ? 'translate(116 0) scale(-1 1)' : undefined}>
        <path d={fingerD} fill={t.fill} stroke={t.outline} strokeWidth={SW} strokeLinejoin="round" />
        <path d={palm} fill={t.fill} />
        <path d={lune(66, 110, 36, 8, 6)} fill={t.shade} opacity={0.9} />
        <path d={palm} fill="none" stroke={t.outline} strokeWidth={SW} strokeLinejoin="round" />
        {/* knuckle creases for folded fingers */}
        <path
          d={fingers
            .map((f, i) => (i < k ? '' : `M${n(f.x - 5)} ${n(base - 2)}Q${n(f.x)} ${n(base + 2)} ${n(f.x + 5)} ${n(base - 2)}`))
            .join('')}
          fill="none"
          stroke={t.outline}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.6}
        />
        <path d={thumb} fill={t.fill} stroke={t.outline} strokeWidth={SW} strokeLinejoin="round" />
        <path d={cuff} fill={MAT.counterA.fill} stroke={MAT.counterA.outline} strokeWidth={SW} />
        <path d="M44 145h26" stroke={HIGHLIGHT} strokeWidth={4} strokeLinecap="round" />
      </g>
    </MatSvg>
  )
}

/** 0–10 fingers on two hands: the right hand shows up to five, the left hand the rest. */
export function Fingers({ n: count, skin = 'b', size = 96, label, className }: MatBase & { n: number; skin?: SkinTone }) {
  const c = Math.max(0, Math.min(10, Math.round(count)))
  const two = c > 5
  return (
    <span className={className} style={{ display: 'inline-flex', gap: size * 0.06, alignItems: 'flex-end' }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {two && <Hand n={5} side="left" skin={skin} size={size} />}
      <Hand n={two ? c - 5 : c} side="right" skin={skin} size={size} />
    </span>
  )
}

// ── Bead string (rekenrek) ─────────────────────────────────────────────────

export interface BeadStringProps extends MatBase {
  total?: number
  /** Beads pushed to the left (the counted ones); the rest wait at the right end. */
  left: number
  /** Colour changes every `group` beads (default 5). */
  group?: number
}

export function BeadString({ total = 20, left, group = 5, size, ...rest }: BeadStringProps) {
  const bw = 24
  const gapMid = 56
  const pad = 16
  const W = pad * 2 + total * bw + gapMid
  const H = 44
  const cy = 22
  const k = Math.max(0, Math.min(total, Math.round(left)))
  const beads = Array.from({ length: total }, (_, i) => {
    const x = pad + bw / 2 + i * bw + (i >= k ? gapMid : 0)
    const tone = Math.floor(i / group) % 2 === 0 ? MAT.beadA : MAT.beadB
    return { x, tone }
  })
  return (
    <MatSvg w={W} h={H} size={size ?? W} {...rest}>
      <path d={`M4 ${cy}H${W - 4}`} stroke={MAT.rim.outline} strokeWidth={3} strokeLinecap="round" />
      <path d={join(circle(4, cy, 3.5), circle(W - 4, cy, 3.5))} fill={MAT.rim.outline} />
      {beads.map((b, i) => (
        <g key={i}>
          <path d={ellipse(b.x, cy, bw / 2 - 0.5, 15)} fill={b.tone.fill} />
          <path d={lune(b.x, cy, 11, 3, 4)} fill={b.tone.shade} />
          <path d={ellipse(b.x - 3.5, cy - 7, 3.5, 2.4)} fill={HIGHLIGHT} />
          <path d={ellipse(b.x, cy, bw / 2 - 0.5, 15)} fill="none" stroke={b.tone.outline} strokeWidth={2.4} />
        </g>
      ))}
    </MatSvg>
  )
}
