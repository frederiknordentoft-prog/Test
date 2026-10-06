// Everyday objects for comparing and measuring (Prompt 'compareObjects', 'ruler', 'unitsRow', and
// 'obj:<id>' picture tokens), and the things unitChoice measures (`mt:<thing>` cards). The
// materials library draws the countable things; these are the things a child compares: a pencil, a
// rope, a teddy, a balloon … Same style as the materials: flat fill, a shade on the lower right, a
// 45 % highlight and a coloured contour. Colours come from the materials palette only.
import type { ReactNode } from 'react'
import { arc, blob, circle, ellipse, join, lune, n, poly, roundPoly, roundRect, segments, starPoints } from '../../art/materials/geom'
import type { V2 } from '../../art/materials/geom'
import { THING_IDS, ThingArt } from '../../art/materials'
import { HIGHLIGHT, INK, MAT } from '../../art/materials/palette'
import type { Tone } from '../../art/materials/palette'

const SW = 2.6

/** Fill, shade, what lies on the fill (children), highlight and contour. */
function Body({ d, tone, shade, hi, sw = SW, children }: { d: string; tone: Tone; shade?: string; hi?: string; sw?: number; children?: ReactNode }) {
  return (
    <>
      <path d={d} fill={tone.fill} />
      {shade && <path d={shade} fill={tone.shade} />}
      {children}
      {hi && <path d={hi} fill={HIGHLIGHT} />}
      <path d={d} fill="none" stroke={tone.outline} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
    </>
  )
}

const shiftPts = (pts: readonly V2[], dx: number, dy: number, k = 1, cx = 24, cy = 24): V2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * k + dx, cy + (y - cy) * k + dy] as V2)

/** Drawn upright, shown turned by `a` degrees (the cutlery, the comb). */
const Turn = ({ a, children }: { a: number; children: ReactNode }) => <g transform={`rotate(${a} 24 24)`}>{children}</g>

/** A strip of water with small waves, 5 high from y, rounded at both ends within x 2-46 (the ship, the bridge). */
const water = (y: number) => `M5 ${y}${'q4.75-2.4 9.5 0'.repeat(4)}a2.5 2.5 0 0 1 0 5H5a2.5 2.5 0 0 1 0-5z`
const WATER = { fill: MAT.fish.light, line: MAT.fish.outline, sw: 2 }

/** A detail left out at the small size of the struck answer and the confirm button (task.css .tv-fine). */
const FINE = 'tv-fine'

/** Wheels with their hubs. */
const wheels = (xs: readonly number[], y: number, r = 4.8) => (
  <>
    <path d={join(...xs.map((x) => circle(x, y, r)))} fill={INK} />
    <path d={join(...xs.map((x) => circle(x, y, r * 0.38)))} fill={MAT.silver.fill} />
  </>
)

/** A detail in one element: its fill and a contour. */
const Part = ({ d, fill, line, sw = 1.6 }: { d: string; fill: string; line: string; sw?: number }) => (
  <path d={d} fill={fill} stroke={line} strokeWidth={sw} strokeLinejoin="round" />
)

/** Outline points of `count` teeth `w` wide between x0 and x1, root at y0 and tip at y1, right to left. */
function teeth(count: number, x0: number, x1: number, w: number, y0: number, y1: number): V2[] {
  const step = (x1 - x0 - w) / (count - 1)
  const pts: V2[] = []
  for (let k = count - 1; k >= 0; k--) {
    const x = x0 + k * step
    pts.push([x + w, y1], [x, y1])
    if (k > 0) pts.push([x, y0], [x - step + w, y0])
  }
  return pts
}

// ─── The things unitChoice measures (48 x 48; named without the word at 46 px) ─

function measured(id: string): ReactNode | null {
  switch (id) {
    case 'fork': {
      // three tines with gaps as wide as they are (apart down to 24 px), a neck and a long handle
      const pts: V2[] = [[15, 17], ...teeth(3, 15, 33, 3.6, 13, 2).reverse(), [33, 17], [30, 22], [26.2, 25], [27, 41], [26.2, 45], [24, 46.5], [21.8, 45], [21, 41], [21.8, 25], [18, 22]]
      return (
        <Turn a={40}>
          <Body d={roundPoly(pts, 1.2)} tone={MAT.silver} shade={roundRect(24.6, 25, 1.8, 17, 0.9)} hi={roundRect(21.9, 28, 1.4, 11, 0.7)} sw={2.4} />
        </Turn>
      )
    }
    case 'spoon': {
      // the bowl (laffe) with its hollow, a narrow neck and a long handle, turned the other way
      const pts: V2[] = [[24, 1.5], [29.5, 4], [31.5, 11], [29.5, 18.5], [26.2, 23], [25.6, 28], [26.8, 41], [26, 45], [24, 46.5], [22, 45], [21.2, 41], [22.4, 28], [21.8, 23], [18.5, 18.5], [16.5, 11], [18.5, 4]]
      return (
        <Turn a={-38}>
          <Body d={blob(pts, 0.9)} tone={MAT.silver} shade={ellipse(25, 13, 4.6, 7.2)} hi={join(ellipse(21.4, 8.5, 1.5, 3), roundRect(22.4, 30, 1.3, 10, 0.65))} sw={2.4} />
        </Turn>
      )
    }
    case 'shoe': {
      // a trainer from the side: the upper, white laces tied in a bow, and a white sole that follows
      // the upper and curves up into the toe cap, in the shoe's own contour
      const t = MAT.apple
      const upper: V2[] = [[5, 38], [5, 21], [7.5, 15.5], [13, 14.5], [17, 19], [25, 22], [34, 26.5], [42, 29.5], [46, 34], [46, 38]]
      const sole: V2[] = [[5, 36.5], [24, 37], [35, 36.5], [37, 32], [42.5, 30.4], [46.4, 34.2], [46.4, 39.5], [43, 42.6], [8, 42.6], [5, 40.4]]
      const laces = join(
        segments([[17, 18.5, 22, 22.5], [17, 22.5, 22, 18.5], [23, 21.5, 28, 25.5], [23, 25.5, 28, 21.5], [29, 24, 33.5, 28], [29, 28, 33.5, 24], [13.5, 13, 10.5, 17.5], [13.5, 13, 16.5, 17.5]]),
        ellipse(10.6, 11, 3.1, 2.1),
        ellipse(16.6, 11, 3.1, 2.1),
      )
      return (
        <>
          <Body d={roundPoly(upper, 3)} tone={t} shade={roundRect(22, 30.5, 13, 4.5, 2.2)} hi={ellipse(9.5, 25, 1.8, 4.5)} />
          <Part d={blob(sole, 0.6)} fill={MAT.frame.fill} line={t.outline} sw={SW} />
          <path d={laces} fill="none" stroke={t.outline} strokeWidth={3.8} strokeLinecap="round" />
          <path d={laces} fill="none" stroke={MAT.frame.fill} strokeWidth={1.8} strokeLinecap="round" />
        </>
      )
    }
    case 'comb': {
      // a straight back (ryg) with six wide teeth hanging from it, the gaps as wide as the teeth
      const pts: V2[] = [[4, 16], [7, 12.5], [41, 12.5], [44, 16], ...teeth(6, 4, 44, 3.6, 22.5, 36)]
      return (
        <Turn a={-10}>
          <Body d={roundPoly(pts, 1.2)} tone={MAT.counterA} shade={roundRect(6, 18.6, 36, 3, 1.5)} hi={roundRect(8, 14.6, 22, 1.8, 0.9)} sw={2.4} />
        </Turn>
      )
    }
    case 'bus': {
      // a long, low box: a row of windows, a door of two tall panes behind the windscreen at the
      // slanted front, a headlight under it and two wheels near the ends
      const t = MAT.star
      const body: V2[] = [[2, 15], [40.5, 15], [46, 22.5], [46, 39], [2, 39]]
      const glass = join(
        ...[5, 12.5, 20].map((x) => roundRect(x, 18, 6, 8, 1.6)),
        roundRect(28, 18, 2.6, 16.5, 1),
        roundRect(31.4, 18, 2.6, 16.5, 1),
        roundPoly([[37, 17.6], [40, 17.6], [43.8, 23], [43.8, 28], [37, 28]], 1.2),
      )
      return (
        <>
          <Body d={roundPoly(body, 3)} tone={t} shade={roundRect(4, 35, 40, 2.8, 1.4)} hi={roundRect(5, 16.2, 22, 1.4, 0.7)} />
          <Part d={glass} fill={MAT.rim.light} line={t.outline} />
          <Part d={circle(44, 33.4, 1.5)} fill={MAT.frame.fill} line={t.outline} sw={1.2} />
          {wheels([9.5, 37.5], 39.5)}
        </>
      )
    }
    case 'train': {
      // a steam engine (cab with a window, boiler, chimney) pulling one wagon
      const t = MAT.apple
      const loco: V2[] = [[19, 36], [19, 9], [32, 9], [32, 19], [45, 19], [45, 36]]
      return (
        <>
          <path d="M15 31h6" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Body d={roundRect(2, 18, 14, 18, 2.5)} tone={MAT.leafGreen} shade={roundRect(4, 29.5, 10, 4.6, 2)} />
          <path d={roundPoly([[36, 19.5], [35, 10], [43, 10], [42, 19.5]], 1.2)} fill={INK} />
          <Body d={roundPoly(loco, 2.5)} tone={t} shade={roundRect(21, 30, 22, 4.6, 2.3)} hi={roundRect(34, 21.4, 8.5, 1.8, 0.9)} />
          <Part d={roundRect(22, 12.5, 7, 7, 1.5)} fill={MAT.rim.light} line={t.outline} />
          <path d={join(circle(6.5, 38.5, 3.4), circle(12, 38.5, 3.4), circle(24.5, 38, 4.6), circle(33.5, 39, 3.4), circle(40.5, 39, 3.4))} fill={INK} />
        </>
      )
    }
    case 'lorry': {
      // a tall cargo box behind a lower cab with one window, three wheels under a dark chassis
      const t = MAT.fish
      const cab: V2[] = [[31, 37], [31, 16], [38, 16], [45.5, 25], [45.5, 37]]
      return (
        <>
          <path d={roundRect(2, 33.5, 43, 4, 1.5)} fill={INK} />
          <Body d={roundRect(2, 9.5, 28, 25.5, 2.5)} tone={MAT.counterB} shade={roundRect(5, 28.5, 23, 4.6, 2.3)} hi={roundRect(5, 12.5, 1.8, 13, 0.9)} />
          <Body d={roundPoly(cab, 2.5)} tone={t} shade={roundRect(33, 30.5, 10.5, 4.6, 2.3)} />
          <Part d={roundPoly([[33.6, 18.6], [37.4, 18.6], [42.6, 25], [33.6, 25]], 1)} fill={MAT.rim.light} line={t.outline} />
          {wheels([10, 21.5, 38.5], 38.5)}
        </>
      )
    }
    case 'ship': {
      // a hull with portholes on the water, a white cabin and a funnel (skorsten) with a black top
      const t = MAT.apple
      const hull: V2[] = [[2, 26], [46, 26], [40.5, 39.5], [8, 39.5]]
      return (
        <>
          <Part d={water(41)} {...WATER} />
          <Part d={roundPoly([[33, 26.5], [34.5, 9], [42.5, 9], [41, 26.5]], 1.4)} fill={MAT.star.fill} line={MAT.star.outline} sw={SW} />
          <path d={roundRect(34.3, 9, 8.4, 4.4, 1.2)} fill={INK} />
          <Part d={roundRect(9, 17, 23, 10, 2)} fill={MAT.frame.fill} line={MAT.frame.outline} sw={SW} />
          <path d={join(...[12.5, 18.5, 24.5].map((x) => roundRect(x, 19.5, 4, 4, 1)))} fill={MAT.rim.fill} />
          <Body d={roundPoly(hull, 2)} tone={t} shade={roundPoly([[26, 34], [42.6, 34], [40.5, 38.2], [26, 38.2]], 1.5)} hi={roundRect(6, 28.2, 30, 1.8, 0.9)} />
          <path d={join(circle(14, 31.8, 1.9), circle(22, 31.8, 1.9), circle(30, 31.8, 1.9))} fill={MAT.frame.fill} />
        </>
      )
    }
    case 'whale': {
      // a big round head, a light belly, the tail fin raised and a spout from the blowhole
      const t = MAT.note500
      const body: V2[] = [[46, 31], [42, 39], [30, 42.5], [17, 41], [9, 36], [5, 29], [10, 29.5], [16, 31], [22, 25], [32, 20.5], [41, 21.5]]
      const tail: V2[] = [[9.5, 32], [3, 28], [1, 21], [5.5, 24.5], [10, 19.5], [11.5, 26]]
      const spout = join('M32 19.5C31.5 13 28 10.5 25 10', 'M32 19.5C32.5 13 36 10.5 39 10', 'M32 19.5V10')
      return (
        <>
          <Part d={blob(tail, 0.6)} fill={t.fill} line={t.outline} sw={SW} />
          <Body d={blob(body, 0.8)} tone={t} shade={blob(shiftPts(body, 2, 3, 0.86), 0.8)} hi={ellipse(30, 25, 4, 1.8)}>
            <path d={blob([[45, 32.5], [41.5, 38.6], [30, 41.8], [20, 40], [28, 37], [39, 35.5]], 0.8)} fill={t.light} />
          </Body>
          <path d={circle(38, 28.5, 2)} fill={INK} />
          <path d="M40.5 34.5q2.6 1 4.6-0.6" fill="none" stroke={t.outline} strokeWidth={1.6} strokeLinecap="round" />
          <path d={spout} fill="none" stroke={MAT.fish.fill} strokeWidth={2.6} strokeLinecap="round" />
          <path d={join(circle(24.5, 8.5, 1.7), circle(32, 7.5, 1.7), circle(39.5, 8.5, 1.7))} fill={MAT.fish.fill} />
        </>
      )
    }
    case 'plane': {
      // seen from the side and a little above: both wings, the tail fin and a row of windows
      const t = MAT.apple
      const body: V2[] = [[3, 23], [12, 20.5], [36, 20], [43, 22], [46.5, 26], [43, 30], [36, 31.5], [12, 31.5], [5, 28.5]]
      const near = join(roundPoly([[21, 27.5], [31, 27.5], [21, 43], [15, 43]], 1.5), roundPoly([[5, 26.5], [13, 26.5], [9, 32.5], [4.5, 32.5]], 1))
      return (
        <>
          <Part d={roundPoly([[24, 22], [19, 8.5], [23.5, 8.5], [32, 22]], 1.5)} fill={t.shade} line={t.outline} sw={SW} />
          <Part d={roundPoly([[4, 24], [2.5, 9], [7.5, 9], [16, 22]], 1.5)} fill={t.fill} line={t.outline} sw={SW} />
          <Body d={blob(body, 0.6)} tone={MAT.face} shade={blob(shiftPts(body, 1.5, 2.6, 0.82), 0.6)} hi={roundRect(12, 22.4, 20, 1.6, 0.8)} />
          <path d={join(...[15, 20, 25, 30].map((x) => circle(x, 25, 1.5)), roundPoly([[38, 22.6], [42.5, 23.2], [44.6, 26], [38, 26]], 1))} fill={MAT.rim.fill} />
          <Part d={near} fill={t.fill} line={t.outline} sw={SW} />
        </>
      )
    }
    case 'bridge': {
      // one stone arch (bue) over the water, a railing along the top
      const t = MAT.silver
      const r = 14.5
      const post = (x: number) => [x, 10.5, x, 17] as const
      const joints = segments([[24, 27.5, 24, 23.5], [13.75, 31.75, 10.9, 28.9], [34.25, 31.75, 37.1, 28.9]])
      return (
        <>
          <Part d={water(38)} {...WATER} />
          <Body d={`M2 17H46V42H${24 + r}A${r} ${r} 0 0 0 ${24 - r} 42H2Z`} tone={t} shade={roundRect(39.5, 27, 5, 13.5, 2)} hi={roundRect(5, 19.5, 30, 1.8, 0.9)} />
          <path className={FINE} d={join(arc(24, 42, r + 4, 180, 360), joints)} fill="none" stroke={t.outline} strokeWidth={1.4} opacity={0.55} />
          <path d={segments([[2.5, 10.5, 45.5, 10.5], ...[3, 17, 31, 45].map(post)])} stroke={t.outline} strokeWidth={2} strokeLinecap="round" />
          <path className={FINE} d={segments([10, 24, 38].map(post))} stroke={t.outline} strokeWidth={2} strokeLinecap="round" />
        </>
      )
    }
    case 'house': {
      // walls with two windows and a door (dør), a red roof (tag) and a chimney
      const roof: V2[] = [[3.5, 25], [24, 6], [44.5, 25]]
      const cross = segments([[15.25, 28, 15.25, 34.5], [12, 31.25, 18.5, 31.25], [32.75, 28, 32.75, 34.5], [29.5, 31.25, 36, 31.25]])
      return (
        <>
          <Part d={roundRect(30.5, 8, 6, 12, 1.2)} fill={MAT.apple.shade} line={MAT.apple.outline} sw={SW} />
          <Body d={roundRect(9, 22, 30, 22, 2)} tone={MAT.ruler} shade={roundRect(30.5, 24, 6.5, 18, 2)} />
          <Body d={roundPoly(roof, 2.5)} tone={MAT.apple} shade={roundRect(25, 20.5, 14, 3, 1.5)} />
          <Part d={join(roundRect(12, 28, 6.5, 6.5, 1.2), roundRect(29.5, 28, 6.5, 6.5, 1.2))} fill={MAT.rim.light} line={MAT.ruler.outline} />
          <path className={FINE} d={cross} stroke={MAT.ruler.outline} strokeWidth={1.2} />
          <Part d="M20.5 44V34.5a3.5 3.5 0 0 1 7 0V44z" fill={MAT.chestnut.fill} line={MAT.chestnut.outline} sw={2} />
          <path className={FINE} d={circle(25.6, 38.6, 0.9)} fill={INK} />
        </>
      )
    }
    default:
      return null
  }
}

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
    // ─── The things unitChoice weighs in kilograms and grams (3. klasse), beside the feather, the strawberry and the key
    case 'letter': {
      // an envelope seen from the back: the closed flap as a V, the folds below it and a heart seal on the tip
      const t = MAT.face
      const heart: V2[] = [[24, 34.5], [19.6, 30], [19.8, 26.6], [22.8, 26.4], [24, 28], [25.2, 26.4], [28.2, 26.6], [28.4, 30]]
      return (
        <>
          <Body d={roundRect(4, 13, 40, 28, 3)} tone={t} shade={roundRect(6, 35.5, 36, 3.6, 1.8)} hi={roundRect(7.5, 16, 10, 1.8, 0.9)} />
          <path d={segments([[6.5, 38.5, 19, 28.5], [41.5, 38.5, 29, 28.5]])} stroke={t.outline} strokeWidth={1.4} strokeLinecap="round" opacity={0.5} />
          <path d={poly([[5.5, 15], [24, 30], [42.5, 15]], false)} fill="none" stroke={t.outline} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
          <Part d={blob(heart, 0.75)} fill={MAT.strawberry.fill} line={MAT.strawberry.outline} sw={1.6} />
        </>
      )
    }
    case 'dog': {
      // a dog from the side: a round body on four short legs, a big head with a floppy ear and a light snout,
      // a raised tail and a red collar
      const t = MAT.wood
      const body: V2[] = [[12, 26], [20, 23], [31, 23.5], [36, 28], [35, 35], [27, 37.5], [16, 37.5], [10, 33]]
      const legs = join(roundRect(12.5, 32, 5, 12, 2.5), roundRect(19.5, 34, 5, 10, 2.5), roundRect(26, 34, 5, 10, 2.5), roundRect(31, 31, 5, 13, 2.5))
      return (
        <>
          <Part d={legs} fill={t.shade} line={t.outline} sw={2.4} />
          <Part d={blob([[11.5, 28.5], [6.5, 23], [4.6, 15.5], [8, 15.2], [10, 21], [14.5, 25]], 0.7)} fill={t.fill} line={t.outline} sw={2.2} />
          <Body d={blob(body, 0.85)} tone={t} shade={blob(shiftPts(body, 2, 2, 0.75), 0.85)} hi={ellipse(18, 27, 4, 1.6)} />
          <Part d={roundRect(28.5, 24.5, 9, 4.4, 2.2)} fill={MAT.apple.fill} line={MAT.apple.outline} sw={1.6} />
          <Body d={circle(36, 18.5, 9.5)} tone={t} />
          <Part d={blob([[43.5, 20.5], [47, 23], [46.6, 27.4], [41, 28.6], [37, 26]], 0.8)} fill={MAT.chestnutCap.fill} line={t.outline} sw={2.2} />
          <Part d={blob([[30.5, 11.5], [34.5, 11.6], [34.6, 21.5], [31, 26], [27.4, 22.4], [28.2, 15]], 0.8)} fill={MAT.chestnut.fill} line={MAT.chestnut.outline} sw={2} />
          <path d={join(circle(39.6, 16, 1.6), ellipse(46.4, 22.8, 1.7, 1.3))} fill={INK} />
        </>
      )
    }
    case 'bike': {
      // two wheels with silver rims and hubs, a red frame (seat tube, top tube, down tube and fork), the
      // handlebar, a saddle and a pedal
      const t = MAT.apple
      const R: V2 = [11, 33]
      const C: V2 = [22.5, 33]
      const S: V2 = [19, 19]
      const H: V2 = [34.5, 18]
      const F: V2 = [37, 33]
      const tubes = segments([[...R, ...C], [...C, ...S], [...S, ...R], [...S, ...H], [...H, ...C], [...H, ...F], [...H, 32.5, 12.5], [30, 12, 36.5, 12]])
      return (
        <>
          <path d={join(circle(11, 33, 9.4), circle(37, 33, 9.4))} fill="none" stroke={INK} strokeWidth={3.2} />
          <path d={join(circle(11, 33, 6.6), circle(37, 33, 6.6))} fill="none" stroke={MAT.silver.fill} strokeWidth={1.4} />
          <path d={tubes} stroke={t.outline} strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" />
          <path d={tubes} stroke={t.fill} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          <path d={join(circle(11, 33, 2), circle(37, 33, 2), circle(22.5, 33, 2.4))} fill={MAT.silver.fill} stroke={MAT.silver.outline} strokeWidth={1.2} />
          <Part d={blob([[13.5, 17.2], [19, 15.4], [24, 16.4], [22.6, 19], [16, 19.2]], 0.8)} fill={MAT.chestnut.fill} line={MAT.chestnut.outline} sw={1.6} />
          <path d={segments([[19.5, 37.5, 25.5, 37.5]])} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
        </>
      )
    }
    case 'sofa': {
      // a two-seat sofa from the front: a high back, two cushions, rounded arms and short dark legs
      const t = MAT.bar
      return (
        <>
          <path d={join(roundRect(8, 39, 4.4, 5, 1.2), roundRect(35.6, 39, 4.4, 5, 1.2))} fill={INK} />
          <Body d={roundRect(8, 11, 32, 21, 5)} tone={t} shade={roundRect(29.5, 13.5, 7.5, 16, 3)} hi={roundRect(11.5, 14.5, 3, 11, 1.5)} />
          <Body d={join(roundRect(10.5, 27, 13.5, 9, 3), roundRect(24, 27, 13.5, 9, 3))} tone={{ ...t, fill: t.light }} />
          <Part d={roundRect(9, 34, 30, 7, 2.5)} fill={t.shade} line={t.outline} sw={SW} />
          <Body d={join(roundRect(3, 21.5, 9.5, 20, 4.5), roundRect(35.5, 21.5, 9.5, 20, 4.5))} tone={t} shade={join(roundRect(8, 25, 3, 14, 1.5), roundRect(40.5, 25, 3, 14, 1.5))} />
        </>
      )
    }
    case 'suitcase': {
      // a suitcase with a handle on top, two leather straps with brass buckles and a star sticker
      const t = MAT.counterB
      const handle = arc(24, 15.5, 6.4, 180, 360)
      return (
        <>
          <path d={handle} fill="none" stroke={MAT.chestnut.outline} strokeWidth={5.2} strokeLinecap="round" />
          <path d={handle} fill="none" stroke={MAT.chestnut.fill} strokeWidth={2.6} strokeLinecap="round" />
          <Body d={roundRect(4, 15, 40, 28, 4)} tone={t} shade={roundRect(36.5, 17.5, 5, 23, 2.5)} hi={roundRect(7.5, 18, 2.6, 15, 1.3)} />
          <Part d={join(roundRect(12, 15, 5, 28, 1), roundRect(31, 15, 5, 28, 1))} fill={MAT.chestnut.fill} line={MAT.chestnut.outline} sw={1.6} />
          <Part d={join(roundRect(11, 20, 7, 4.6, 1.2), roundRect(30, 20, 7, 4.6, 1.2))} fill={MAT.gold.fill} line={MAT.gold.outline} sw={1.4} />
          <Part d={roundPoly(starPoints(24, 31, 5.6, 2.6), 0.8)} fill={MAT.star.light} line={MAT.star.outline} sw={1.4} />
        </>
      )
    }
    default:
      return measured(id)
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
