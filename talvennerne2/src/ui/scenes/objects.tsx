// Everyday objects for comparing and measuring (Prompt 'compareObjects', 'ruler', 'unitsRow', and
// 'obj:<id>' picture tokens). The materials library draws the countable things; these are the
// things a child compares: a pencil, a rope, a teddy, a balloon … Same style as the materials:
// flat fill, a shade on the lower right, a 45 % highlight and a coloured contour. Colours come from
// the materials palette only.
import type { ReactNode } from 'react'
import { blob, circle, ellipse, join, lune, n, roundRect } from '../../art/materials/geom'
import type { V2 } from '../../art/materials/geom'
import { THING_IDS, ThingArt } from '../../art/materials'
import { HIGHLIGHT, INK, MAT } from '../../art/materials/palette'
import type { Tone } from '../../art/materials/palette'

const SW = 2.6

function Body({ d, tone, shade, hi, sw = SW }: { d: string; tone: Tone; shade?: string; hi?: string; sw?: number }) {
  return (
    <>
      <path d={d} fill={tone.fill} />
      {shade && <path d={shade} fill={tone.shade} />}
      {hi && <path d={hi} fill={HIGHLIGHT} />}
      <path d={d} fill="none" stroke={tone.outline} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
    </>
  )
}

const shiftPts = (pts: readonly V2[], dx: number, dy: number, k = 1, cx = 24, cy = 24): V2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * k + dx, cy + (y - cy) * k + dy] as V2)

// ─── Compact objects (48 x 48 box, standing on y ≈ 44) ─────────────────────

function compact(id: string): ReactNode | null {
  switch (id) {
    case 'teddy': {
      const t = MAT.wood
      const body: V2[] = [[24, 22], [33, 25], [36, 34], [33, 43], [24, 45], [15, 43], [12, 34], [15, 25]]
      return (
        <>
          <Body d={join(circle(14, 9.5, 4.6), circle(34, 9.5, 4.6))} tone={t} />
          <path d={join(circle(14, 9.5, 2.2), circle(34, 9.5, 2.2))} fill={MAT.chestnutCap.fill} />
          <Body d={blob(body, 0.9)} tone={t} shade={blob(shiftPts(body, 2.4, 1.2, 0.8), 0.9)} />
          <Body d={join(ellipse(10.5, 31, 4, 6.5), ellipse(37.5, 31, 4, 6.5))} tone={t} />
          <Body d={circle(24, 15.5, 10.5)} tone={t} shade={lune(24, 15.5, 9, 2.6, 2.6)} hi={ellipse(19.5, 10.5, 2.6, 1.6)} />
          <path d={ellipse(24, 19, 4.6, 3.4)} fill={MAT.chestnutCap.fill} />
          <path d={join(circle(20, 14, 1.5), circle(28, 14, 1.5), ellipse(24, 17.6, 1.6, 1.1))} fill={INK} />
          <path d={ellipse(24, 35, 5.5, 5)} fill={MAT.chestnutCap.fill} />
        </>
      )
    }
    case 'balloon': {
      const t = MAT.strawberry
      return (
        <>
          <path d="M24 33c-2 4 2 6 0 9s1 4 0 6" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <Body d={blob([[24, 3], [34, 8], [36, 19], [30, 30], [24, 33], [18, 30], [12, 19], [14, 8]], 0.9)} tone={t} shade={lune(24, 18, 12, 3.5, 3.5)} hi={ellipse(18.5, 11, 2.4, 4)} />
          <Body d="M21.5 33.5h5l-1.2 2.4h-2.6z" tone={t} sw={1.8} />
        </>
      )
    }
    case 'stone': {
      const t = MAT.silver
      const pts: V2[] = [[8, 34], [12, 24], [22, 19], [34, 20], [42, 28], [42, 38], [33, 43], [17, 43], [9, 40]]
      return <Body d={blob(pts, 0.85)} tone={t} shade={blob(shiftPts(pts, 3, 2.5, 0.72), 0.85)} hi={ellipse(19, 27, 4, 2.2)} />
    }
    case 'pillow': {
      const t = MAT.note50
      const pts: V2[] = [[5, 16], [14, 19], [24, 17], [34, 19], [43, 16], [41, 30], [43, 42], [34, 39], [24, 41], [14, 39], [5, 42], [7, 30]]
      return (
        <>
          <Body d={blob(pts, 0.7)} tone={t} shade={blob(shiftPts(pts, 2, 2.4, 0.7), 0.7)} hi={ellipse(15, 25, 4, 2)} />
          <path d="M24 26v6M21 29h6" stroke={t.outline} strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
        </>
      )
    }
    case 'feather': {
      const t = MAT.face
      const pts: V2[] = [[40, 6], [42, 14], [36, 26], [26, 36], [14, 42], [11, 39], [16, 28], [26, 16]]
      return (
        <>
          <Body d={blob(pts, 0.8)} tone={t} shade={blob(shiftPts(pts, 2, 2, 0.7), 0.8)} />
          <path d="M41 7C33 20 22 32 8 45" fill="none" stroke={t.outline} strokeWidth={2} strokeLinecap="round" />
          <path d={join('M33 18l-5-3M28 25l-6-3', 'M22 31l-5-2M31 22l4 2', 'M25 29l4 3')} stroke={t.outline} strokeWidth={1.4} strokeLinecap="round" opacity={0.55} />
        </>
      )
    }
    case 'book': {
      const t = MAT.counterA
      return (
        <>
          <Body d={roundRect(9, 15, 32, 27, 3)} tone={MAT.stem} />
          <path d="M12 21h26M12 26h26M12 31h26M12 36h26" stroke={MAT.stem.outline} strokeWidth={1.2} opacity={0.5} />
          <Body d={roundRect(7, 9, 32, 30, 4)} tone={t} shade={roundRect(33, 11, 5, 27, 2)} hi={roundRect(11, 12, 4, 20, 2)} />
          <path d={roundRect(15, 16, 16, 7, 2)} fill={MAT.stem.fill} opacity={0.9} />
        </>
      )
    }
    case 'key': {
      const t = MAT.gold
      return (
        <>
          <Body d={join(circle(14, 24, 9), circle(14, 24, 4))} tone={t} hi={ellipse(10.5, 19.5, 2.4, 1.4)} />
          <Body d={roundRect(21, 21.5, 22, 5, 2.5)} tone={t} />
          <Body d={join(roundRect(33, 26, 4, 7, 1.5), roundRect(39, 26, 4, 5, 1.5))} tone={t} sw={2} />
        </>
      )
    }
    case 'box': {
      const t = MAT.cube
      return (
        <>
          <path d="M6 18l18-8 18 8-18 8z" fill={t.light} stroke={t.outline} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M6 18v18l18 9V26z" fill={t.fill} stroke={t.outline} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M42 18v18l-18 9V26z" fill={t.shade} stroke={t.outline} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M15 14l18 8" stroke={t.outline} strokeWidth={1.6} opacity={0.5} />
        </>
      )
    }
    case 'marble': {
      const t = MAT.fish
      return (
        <>
          <Body d={circle(24, 30, 13)} tone={t} shade={lune(24, 30, 11.5, 3.4, 3.4)} hi={ellipse(19.5, 24.5, 3.4, 2.2)} />
          <path d="M15 32c5-6 12-6 18-1" fill="none" stroke={MAT.fishFin.shade} strokeWidth={2.4} strokeLinecap="round" />
        </>
      )
    }
    case 'bottle': {
      const t = MAT.leafGreen
      const pts: V2[] = [[20, 12], [28, 12], [28, 19], [33, 25], [33, 43], [15, 43], [15, 25], [20, 19]]
      return (
        <>
          <Body d={blob(pts, 0.35)} tone={t} shade={roundRect(27, 26, 4, 15, 2)} hi={roundRect(18, 26, 3, 13, 1.5)} />
          <Body d={roundRect(19, 6, 10, 7, 2)} tone={MAT.counterB} />
          <path d={roundRect(15.8, 30, 16.4, 7, 1)} fill={MAT.stem.fill} opacity={0.85} />
        </>
      )
    }
    case 'cup': {
      const t = MAT.counterB
      return (
        <>
          <Body d="M33 22c7 0 7 12 0 12" tone={t} />
          <Body d={blob([[10, 15], [36, 15], [34, 38], [29, 43], [17, 43], [12, 38]], 0.4)} tone={t} shade={roundRect(27, 18, 5, 21, 2.5)} hi={roundRect(15, 19, 3, 14, 1.5)} />
        </>
      )
    }
    default:
      return null
  }
}

/** True for objects this module or the materials library can draw. */
export function knownObject(id: string): boolean {
  return compact(id) !== null || isLong(id) || (THING_IDS as readonly string[]).includes(id)
}

/** A compact object (or a countable thing) in a 48 x 48 box at (x, y), scaled by k. */
export function ObjectArt({ id, x = 0, y = 0, k = 1 }: { id: string; x?: number; y?: number; k?: number }) {
  const art = compact(id)
  if (!art && isLong(id)) {
    return (
      <g transform={`translate(${n(x)} ${n(y)}) scale(${n(k)})`}>
        <LongArt id={id} length={44} x={2} y={24} />
      </g>
    )
  }
  if (!art) return <ThingArt id={id} x={x} y={y} k={k} />
  return <g transform={`translate(${n(x)} ${n(y)}) scale(${n(k)})`}>{art}</g>
}

/** One object in its own svg (cards, faces). */
export function ObjectIcon({ id, size = 64, className }: { id: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden overflow="visible">
      <ObjectArt id={id} />
    </svg>
  )
}

// ─── Long objects (drawn along x, any length) ──────────────────────────────

export const LONG_IDS = ['pencil', 'crayon', 'brush', 'rope', 'ribbon', 'stick', 'straw', 'worm', 'scarf'] as const

/** A long object from (x, y − h/2) to (x + length, y + h/2), lying on its side. */
export function LongArt({ id, length, x, y, h = 14 }: { id: string; length: number; x: number; y: number; h?: number }) {
  const L = Math.max(h * 1.6, length)
  const top = y - h / 2
  switch (id) {
    case 'pencil':
    case 'crayon': {
      const body = id === 'crayon' ? MAT.apple : MAT.ruler
      const tip = Math.min(L * 0.18, h * 1.5)
      const end = id === 'crayon' ? 0 : Math.min(L * 0.12, h * 0.9)
      return (
        <g>
          {end > 0 && <Body d={roundRect(x, top, end + 3, h, h * 0.35)} tone={MAT.petal} sw={2.2} />}
          {end > 0 && <Body d={roundRect(x + end - 1, top - 0.5, 5, h + 1, 1)} tone={MAT.silver} sw={2} />}
          <Body d={`M${n(x + end + 4)} ${n(top)}H${n(x + L - tip)}L${n(x + L)} ${n(y)}L${n(x + L - tip)} ${n(top + h)}H${n(x + end + 4)}Z`} tone={body} sw={2.4} />
          <path d={`M${n(x + end + 4)} ${n(y + h * 0.18)}H${n(x + L - tip)}`} stroke={body.shade} strokeWidth={h * 0.32} opacity={0.9} />
          <path d={`M${n(x + L - tip)} ${n(top)}L${n(x + L)} ${n(y)}L${n(x + L - tip)} ${n(top + h)}Z`} fill={id === 'crayon' ? body.shade : MAT.wood.fill} stroke={MAT.wood.outline} strokeWidth={2.2} strokeLinejoin="round" />
          <path d={`M${n(x + L - tip * 0.36)} ${n(y - h * 0.18)}L${n(x + L)} ${n(y)}L${n(x + L - tip * 0.36)} ${n(y + h * 0.18)}Z`} fill={id === 'crayon' ? body.outline : INK} />
          <path d={`M${n(x + end + 8)} ${n(top + h * 0.26)}H${n(x + L - tip - 4)}`} stroke={HIGHLIGHT} strokeWidth={2.4} strokeLinecap="round" />
        </g>
      )
    }
    case 'brush': {
      // a paintbrush: a long handle, a metal ferrule and a dipped tip
      const handle = MAT.counterB
      const hair = Math.min(L * 0.2, h * 1.8)
      const ferrule = Math.min(L * 0.1, h * 0.9)
      const stem = L - hair - ferrule
      return (
        <g>
          <Body d={roundRect(x, top + h * 0.18, stem, h * 0.64, h * 0.32)} tone={handle} sw={2.2} />
          <Body d={roundRect(x + stem - 2, top + h * 0.06, ferrule + 3, h * 0.88, 2)} tone={MAT.silver} sw={2.2} />
          <Body d={`M${n(x + stem + ferrule)} ${n(top + h * 0.1)}Q${n(x + L)} ${n(y - h * 0.15)} ${n(x + L)} ${n(y)}Q${n(x + L)} ${n(y + h * 0.15)} ${n(x + stem + ferrule)} ${n(top + h * 0.9)}Z`} tone={MAT.chestnut} sw={2.2} />
          <path d={`M${n(x + L - hair * 0.38)} ${n(y - h * 0.22)}Q${n(x + L)} ${n(y)} ${n(x + L - hair * 0.38)} ${n(y + h * 0.22)}Z`} fill={MAT.counterA.fill} />
          <path d={`M${n(x + 5)} ${n(top + h * 0.32)}H${n(x + stem - 6)}`} stroke={HIGHLIGHT} strokeWidth={2.2} strokeLinecap="round" />
        </g>
      )
    }
    case 'rope': {
      const t = MAT.wood
      const twists = Math.max(2, Math.round(L / 10))
      const step = (L - 8) / twists
      return (
        <g>
          <Body d={roundRect(x, top + h * 0.15, L, h * 0.7, h * 0.35)} tone={t} />
          <path d={Array.from({ length: twists }, (_, i) => `M${n(x + 6 + i * step)} ${n(top + h * 0.2)}l${n(step * 0.55)} ${n(h * 0.6)}`).join('')} stroke={t.outline} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
          <path d={join(circle(x + 2, y, 2.6), circle(x + L - 2, y, 2.6))} fill={t.shade} />
        </g>
      )
    }
    case 'ribbon':
    case 'scarf': {
      const t = id === 'scarf' ? MAT.counterA : MAT.frac
      const wave = Math.max(2, Math.round(L / 26))
      const seg = L / wave
      let d = `M${n(x)} ${n(top + 2)}`
      for (let i = 0; i < wave; i++) d += `q${n(seg / 2)} ${n(-3)} ${n(seg)} 0`
      d += `L${n(x + L)} ${n(top + h - 2)}`
      for (let i = 0; i < wave; i++) d += `q${n(-seg / 2)} ${n(3)} ${n(-seg)} 0`
      d += 'Z'
      return (
        <g>
          <Body d={d} tone={t} />
          <path d={`M${n(x + 4)} ${n(top + h * 0.35)}H${n(x + L - 4)}`} stroke={HIGHLIGHT} strokeWidth={2} strokeLinecap="round" />
        </g>
      )
    }
    case 'straw': {
      const t = MAT.counterB
      const stripes = Math.max(2, Math.round(L / 12))
      const sw = (L - 4) / stripes
      return (
        <g>
          <path d={roundRect(x, top + h * 0.2, L, h * 0.6, h * 0.3)} fill={MAT.frame.fill} />
          <path d={Array.from({ length: stripes }, (_, i) => roundRect(x + 2 + i * sw, top + h * 0.2, sw * 0.45, h * 0.6, 1)).join('')} fill={t.fill} />
          <path d={roundRect(x, top + h * 0.2, L, h * 0.6, h * 0.3)} fill="none" stroke={t.outline} strokeWidth={2.2} />
        </g>
      )
    }
    case 'worm': {
      const t = MAT.petal
      const segs = Math.max(3, Math.round(L / 9))
      const step = (L - h) / segs
      return (
        <g>
          <Body d={roundRect(x, top + h * 0.12, L, h * 0.76, h * 0.38)} tone={t} />
          <path d={Array.from({ length: segs - 1 }, (_, i) => `M${n(x + h * 0.6 + (i + 1) * step)} ${n(top + h * 0.2)}v${n(h * 0.6)}`).join('')} stroke={t.outline} strokeWidth={1.4} opacity={0.45} strokeLinecap="round" />
          <path d={join(circle(x + L - h * 0.42, y - 1.5, 1.4))} fill={INK} />
        </g>
      )
    }
    default: {
      // stick (and anything unknown): a twig with two knots
      const t = MAT.chestnut
      return (
        <g>
          <Body d={roundRect(x, top + h * 0.2, L, h * 0.6, h * 0.3)} tone={t} />
          <path d={join(ellipse(x + L * 0.3, y, 2, 1.4), ellipse(x + L * 0.7, y + 1, 1.8, 1.3))} fill={t.outline} opacity={0.5} />
          <path d={`M${n(x + 4)} ${n(top + h * 0.34)}H${n(x + L - 4)}`} stroke={HIGHLIGHT} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )
    }
  }
}

/** True when the object is long and thin (compared by length, drawn on its side). */
export function isLong(id: string): boolean {
  return (LONG_IDS as readonly string[]).includes(id)
}
