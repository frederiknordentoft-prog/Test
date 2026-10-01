// Countable things (ThingId): carrots on the meadow, apples, strawberries, chestnuts, flowers, fish …
// Each is drawn in a 48 x 48 box in the animals' style: flat fill, darker shade on the lower right,
// a 45 % highlight and a coloured contour. `ThingArt` returns SVG content for scenes that place
// many things in one svg; `Thing` wraps one in its own svg.
import type { ReactNode } from 'react'
import { blob, circle, ellipse, join, lune, n, poly, roundPoly, roundRect, segments, starPoints } from './geom'
import type { V2 } from './geom'
import { MatSvg } from './kit'
import type { MatBase } from './kit'
import { HIGHLIGHT, INK, MAT } from './palette'
import type { Tone } from './palette'

export const THING_IDS = [
  'carrot', 'apple', 'strawberry', 'chestnut', 'flower', 'fish', 'mushroom', 'leaf', 'star', 'ball', 'cube', 'clip',
] as const
export type KnownThing = (typeof THING_IDS)[number]

const SWT = 2.6

function Body({ d, tone, shade, hi }: { d: string; tone: Tone; shade?: string; hi?: string }) {
  return (
    <>
      <path d={d} fill={tone.fill} />
      {shade && <path d={shade} fill={tone.shade} />}
      {hi && <path d={hi} fill={HIGHLIGHT} />}
      <path d={d} fill="none" stroke={tone.outline} strokeWidth={SWT} strokeLinejoin="round" />
    </>
  )
}

const shift = (pts: V2[], dx: number, dy: number, k = 1, cx = 24, cy = 24): V2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * k + dx, cy + (y - cy) * k + dy] as V2)

function art(id: string): ReactNode {
  switch (id) {
    case 'carrot': {
      const body: V2[] = [[16, 16], [24, 14.5], [32, 16], [30.5, 27], [26.5, 38], [24, 44.5], [21.5, 38], [17.5, 27]]
      const leaves = join(
        blob([[22, 16], [15, 9], [14, 4], [19, 5], [24, 13]], 0.9),
        blob([[23, 15], [22, 6], [24, 1.5], [27, 5], [26, 14]], 0.9),
        blob([[25, 15], [30, 7], [35, 5], [35, 10], [28, 16]], 0.9),
      )
      return (
        <>
          <Body d={leaves} tone={MAT.leafGreen} />
          <Body d={blob(body, 0.75)} tone={MAT.carrot} shade={blob(shift(body, 3, 1, 0.72), 0.75)} hi={ellipse(20, 21, 2, 4)} />
          <path d="M20 24h4M22 31h4M22.5 37h2.5" stroke={MAT.carrot.outline} strokeWidth={1.8} strokeLinecap="round" />
        </>
      )
    }
    case 'apple': {
      const body: V2[] = [[24, 15], [31, 11.5], [39, 16], [41.5, 27], [36.5, 39], [28.5, 43.5], [24, 42], [19.5, 43.5], [11.5, 39], [6.5, 27], [9, 16], [17, 11.5]]
      return (
        <>
          <path d="M24 15C24.5 11 25.5 8 27.5 5.5" fill="none" stroke={MAT.chestnut.outline} strokeWidth={2.8} strokeLinecap="round" />
          <Body d={blob([[27, 9.5], [32, 4.5], [38, 4], [35.5, 9], [30, 11]], 0.9)} tone={MAT.leafGreen} />
          <Body d={blob(body, 0.85)} tone={MAT.apple} shade={lune(24, 28, 16.5, 4.5, 4.5)} hi={ellipse(15.5, 20, 3.4, 5)} />
        </>
      )
    }
    case 'strawberry': {
      const body: V2[] = [[9, 18], [24, 13.5], [39, 18], [37.5, 30], [29.5, 41], [24, 44.5], [18.5, 41], [10.5, 30]]
      const seeds = join(...([[17, 22], [24, 21], [31, 22], [20, 29], [28, 29], [24, 36], [15, 29], [33, 29]] as V2[]).map(([x, y]) => ellipse(x, y, 1.2, 1.8)))
      const calyx = roundPoly(starPoints(24, 15, 11, 4.5, 5, -90), 1.6)
      return (
        <>
          <Body d={blob(body, 0.8)} tone={MAT.strawberry} shade={lune(24, 27, 14.5, 4, 5)} hi={ellipse(16, 21, 2.6, 3.6)} />
          <path d={seeds} fill={MAT.seed.fill} />
          <Body d={calyx} tone={MAT.leafGreen} />
          <path d="M24 11V6" stroke={MAT.leafGreen.outline} strokeWidth={2.6} strokeLinecap="round" />
        </>
      )
    }
    case 'chestnut': {
      const body: V2[] = [[24, 6.5], [30.5, 13], [38.5, 21.5], [40.5, 32], [34.5, 42], [24, 45], [13.5, 42], [7.5, 32], [9.5, 21.5], [17.5, 13]]
      const cap: V2[] = [[10, 35], [24, 38.5], [38, 35], [34.5, 42], [24, 45], [13.5, 42]]
      return (
        <>
          <path d={blob(body, 0.85)} fill={MAT.chestnut.fill} />
          <path d={lune(24, 27, 16, 4, 3)} fill={MAT.chestnut.shade} />
          <path d={blob(cap, 0.8)} fill={MAT.chestnutCap.fill} />
          <path d={ellipse(17, 21, 4, 7)} fill={HIGHLIGHT} transform="rotate(28 17 21)" />
          <path d={blob(body, 0.85)} fill="none" stroke={MAT.chestnut.outline} strokeWidth={SWT} strokeLinejoin="round" />
          <path d="M11 36Q24 40.5 37 36" fill="none" stroke={MAT.chestnut.outline} strokeWidth={2} strokeLinecap="round" />
        </>
      )
    }
    case 'flower': {
      const petals = join(
        ...Array.from({ length: 5 }, (_, i) => {
          const a = (i * 72 - 90) * (Math.PI / 180)
          const cx = 24 + Math.cos(a) * 11
          const cy = 24 + Math.sin(a) * 11
          return blob(
            Array.from({ length: 8 }, (_, k) => {
              const t = (k / 8) * Math.PI * 2
              const px = Math.cos(t) * 9.5
              const py = Math.sin(t) * 7
              return [cx + px * Math.cos(a) - py * Math.sin(a), cy + px * Math.sin(a) + py * Math.cos(a)] as V2
            }),
          )
        }),
      )
      return (
        <>
          <path d={petals} fill={MAT.petal.fill} stroke={MAT.petal.outline} strokeWidth={SWT} strokeLinejoin="round" />
          <Body d={circle(24, 24, 7.5)} tone={MAT.petalCenter} shade={lune(24, 24, 6.2, 2, 2)} hi={ellipse(21.5, 21.5, 2, 1.4)} />
        </>
      )
    }
    case 'fish': {
      const body: V2[] = [[13, 24], [20, 15], [31, 13.5], [41, 20.5], [43.5, 24.5], [40, 28.5], [31, 34], [20, 33]]
      const tail = roundPoly([[15, 24], [4, 14], [7, 24], [4, 34]], 2.5)
      const fin = blob([[24, 15], [29, 8], [34, 9.5], [33, 15.5]], 0.8)
      return (
        <>
          <Body d={join(tail, fin)} tone={MAT.fishFin} />
          <Body d={blob(body, 0.9)} tone={MAT.fish} shade={blob(shift(body, 2, 4, 0.7), 0.9)} hi={ellipse(23, 19.5, 5, 2)} />
          <path d="M26 17.5Q23.5 24 26 30.5" fill="none" stroke={MAT.fish.outline} strokeWidth={2} strokeLinecap="round" />
          <path d={circle(35.5, 22, 2.6)} fill={INK} />
          <path d={circle(34.7, 21.1, 0.9)} fill={MAT.face.fill} />
        </>
      )
    }
    case 'mushroom': {
      const cap: V2[] = [[5.5, 26], [8.5, 15], [24, 6.5], [39.5, 15], [42.5, 26], [24, 28]]
      return (
        <>
          <Body d={roundRect(17, 22, 14, 21, 6)} tone={MAT.stem} shade={roundRect(25, 24, 4, 17, 2)} />
          <Body d={blob(cap, 0.7)} tone={MAT.mushroom} hi={ellipse(15, 14, 3.4, 2)} />
          <path d={join(circle(24, 14, 3.2), circle(33.5, 19.5, 2.4), circle(14.5, 21, 2.2), circle(30.5, 11.5, 1.6))} fill={MAT.stem.fill} />
        </>
      )
    }
    case 'leaf': {
      const leaf: V2[] = [[7, 41], [9, 25], [19, 12], [40, 6], [37, 25], [25, 37]]
      return (
        <>
          <Body d={blob(leaf, 0.75)} tone={MAT.leafGreen} shade={blob(shift(leaf, 3, 3, 0.62), 0.75)} />
          <path d={join('M8 40Q22 26 38 8', segments([[17, 30, 16, 23], [24, 23, 22.5, 16], [24, 23, 31, 24], [17, 30, 23, 31]]))} fill="none" stroke={MAT.leafGreen.outline} strokeWidth={2} strokeLinecap="round" />
        </>
      )
    }
    case 'star': {
      const d = roundPoly(starPoints(24, 25.5, 20, 9, 5, -90), 3)
      return <Body d={d} tone={MAT.star} shade={roundPoly(starPoints(26.5, 28.5, 13, 6, 5, -90), 2)} hi={ellipse(18, 18, 3, 2)} />
    }
    case 'ball': {
      return (
        <>
          <Body d={circle(24, 24, 18)} tone={MAT.ball} shade={lune(24, 24, 16.7, 4.5, 4.5)} hi={ellipse(17, 16, 4, 2.6)} />
          <path d="M6.5 22Q24 31 41.5 22" fill="none" stroke={MAT.face.fill} strokeWidth={5} />
          <path d="M6.5 22Q24 31 41.5 22" fill="none" stroke={MAT.ball.outline} strokeWidth={1.4} strokeOpacity={0.4} />
          <path d={circle(24, 24, 18)} fill="none" stroke={MAT.ball.outline} strokeWidth={SWT} />
        </>
      )
    }
    case 'cube': {
      const t = MAT.cube
      const front = poly([[9, 18], [33, 18], [33, 42], [9, 42]])
      const top = poly([[9, 18], [16, 11], [40, 11], [33, 18]])
      const side = poly([[33, 18], [40, 11], [40, 35], [33, 42]])
      return (
        <>
          <path d={front} fill={t.fill} />
          <path d={top} fill={t.light} />
          <path d={side} fill={t.shade} />
          <path d={join(poly([[9, 18], [16, 11], [40, 11], [40, 35], [33, 42], [9, 42]]), 'M9 18H33V42M33 18L40 11')} fill="none" stroke={t.outline} strokeWidth={SWT} strokeLinejoin="round" />
        </>
      )
    }
    case 'clip': {
      const t = MAT.clip
      // A paperclip: outer loop and inner loop as one open path.
      const d = join(`M17 34V13a5 5 0 0 1 ${10} 0v23`, 'a8 8 0 0 1-16 0V17', 'M21 16v17a2 2 0 0 0 4 0V19')
      return (
        <>
          <path d={d} fill="none" stroke={t.outline} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" transform="rotate(35 24 24)" />
          <path d={d} fill="none" stroke={t.fill} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" transform="rotate(35 24 24)" />
        </>
      )
    }
    default:
      return <Body d={circle(24, 24, 14)} tone={MAT.counterA} />
  }
}

/** SVG content for a thing in a 48 x 48 box at (x, y), scaled by `k`. For many things in one svg. */
export function ThingArt({ id, x = 0, y = 0, k = 1 }: { id: string; x?: number; y?: number; k?: number }) {
  return <g transform={`translate(${n(x)} ${n(y)}) scale(${n(k)})`}>{art(id)}</g>
}

export function Thing({ id, size, ...rest }: MatBase & { id: string }) {
  return (
    <MatSvg w={48} h={48} size={size ?? 48} {...rest}>
      {art(id)}
    </MatSvg>
  )
}
