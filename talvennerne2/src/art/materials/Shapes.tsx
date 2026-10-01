// Plane figures (ShapeId) in six variants – 0 standard, 1 rotated, 2 stretched/irregular, 3 small,
// 4 patterned, 5 outline only – so tasks can show non-prototypical examples (SPEC §2.3,
// paedagogik shapes2D). Every variant stays a true member of its class: a "stretched" square is a
// rotated, larger square, never a rectangle; a circle is never an ellipse. Green toning, 3.2 stroke.
import { useId } from 'react'
import type { ShapeId } from '../../engine/types'
import { circle, join, n, poly, polar, regularPoints, roundPoly, segments } from './geom'
import type { V2 } from './geom'
import { MatSvg } from './kit'
import type { MatBase } from './kit'
import { MAT, PRIMARY } from './palette'
import type { Tone } from './palette'

export const SHAPE_IDS: readonly ShapeId[] = [
  'circle', 'triangle', 'quadrilateral', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon', 'semicircle', 'rhombus', 'trapezoid',
]
export const SHAPE_VARIANTS = ['standard', 'rotated', 'stretched', 'small', 'patterned', 'outline'] as const

const SWS = 3.2
const C: V2 = [50, 50]

const rot = (pts: V2[], deg: number, about: V2 = C): V2[] => {
  const a = (deg * Math.PI) / 180
  const [cx, cy] = about
  return pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)] as V2)
}
const scale = (pts: V2[], k: number, about: V2 = C): V2[] => pts.map(([x, y]) => [about[0] + (x - about[0]) * k, about[1] + (y - about[1]) * k] as V2)
const rectPts = (w: number, h: number): V2[] => [[50 - w / 2, 50 - h / 2], [50 + w / 2, 50 - h / 2], [50 + w / 2, 50 + h / 2], [50 - w / 2, 50 + h / 2]]
/** Centre a polygon's bounding box on (50, 50). */
const centre = (pts: V2[]): V2[] => {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const dx = 50 - (Math.min(...xs) + Math.max(...xs)) / 2
  const dy = 50 - (Math.min(...ys) + Math.max(...ys)) / 2
  return pts.map(([x, y]) => [x + dx, y + dy] as V2)
}

type Geo = { kind: 'poly'; pts: V2[] } | { kind: 'circle'; r: number } | { kind: 'semi'; r: number; rot: number }

/** The polygon (or circle) for a shape and variant, before the small/pattern/outline treatment. */
function geometry(shape: ShapeId, variant: number): Geo {
  const v = variant === 3 || variant === 4 || variant === 5 ? 0 : variant
  switch (shape) {
    case 'circle':
      return { kind: 'circle', r: v === 2 ? 44 : 38 }
    case 'semicircle':
      return { kind: 'semi', r: v === 2 ? 44 : 40, rot: v === 1 ? 90 : v === 2 ? 200 : 0 }
    case 'triangle': {
      if (v === 1) return { kind: 'poly', pts: centre(rot(regularPoints(50, 56, 42, 3, -90), 38)) }
      if (v === 2) return { kind: 'poly', pts: centre([[10, 76], [90, 70], [34, 20]]) }
      return { kind: 'poly', pts: centre(regularPoints(50, 56, 44, 3, -90)) }
    }
    case 'quadrilateral': {
      if (v === 1) return { kind: 'poly', pts: rot(rectPts(56, 56), 45) }
      if (v === 2) return { kind: 'poly', pts: centre([[16, 26], [78, 14], [88, 80], [26, 70]]) }
      return { kind: 'poly', pts: rectPts(66, 56) }
    }
    case 'square': {
      if (v === 1) return { kind: 'poly', pts: rot(rectPts(58, 58), 45) }
      if (v === 2) return { kind: 'poly', pts: rot(rectPts(64, 64), 18) }
      return { kind: 'poly', pts: rectPts(66, 66) }
    }
    case 'rectangle': {
      if (v === 1) return { kind: 'poly', pts: rot(rectPts(78, 40), -28) }
      if (v === 2) return { kind: 'poly', pts: rectPts(34, 84) }
      return { kind: 'poly', pts: rectPts(84, 50) }
    }
    case 'rhombus': {
      const base: V2[] = [[50, 10], [78, 50], [50, 90], [22, 50]]
      if (v === 1) return { kind: 'poly', pts: rot(base, 90) }
      if (v === 2) {
        // A sheared rhombus: all four sides 44 long.
        const s = 44
        const a = (62 * Math.PI) / 180
        return { kind: 'poly', pts: centre([[0, 0], [s, 0], [s + s * Math.cos(a), s * Math.sin(a)], [s * Math.cos(a), s * Math.sin(a)]].map(([x, y]) => [x + 10, y + 20] as V2)) }
      }
      return { kind: 'poly', pts: base }
    }
    case 'trapezoid': {
      const base: V2[] = [[28, 28], [72, 28], [90, 72], [10, 72]]
      if (v === 1) return { kind: 'poly', pts: rot(base, 180) }
      if (v === 2) return { kind: 'poly', pts: centre([[18, 26], [58, 26], [90, 74], [8, 74]]) }
      return { kind: 'poly', pts: base }
    }
    case 'pentagon':
    case 'hexagon':
    case 'octagon': {
      const sides = shape === 'pentagon' ? 5 : shape === 'hexagon' ? 6 : 8
      const regular = regularPoints(50, 50, 42, sides, -90)
      if (v === 1) return { kind: 'poly', pts: centre(rot(regular, 180 / sides)) }
      if (v === 2) {
        // Irregular: stretched sideways and pulled at alternate corners, still convex.
        const irr = regular.map(([x, y], i) => {
          const k = i % 2 ? 0.86 : 1
          return [50 + (x - 50) * 1.18 * k, 50 + (y - 50) * 0.82 * k] as V2
        })
        return { kind: 'poly', pts: centre(irr) }
      }
      return { kind: 'poly', pts: centre(regular) }
    }
  }
}

function geoPath(g: Geo): string {
  if (g.kind === 'circle') return circle(50, 50, g.r)
  if (g.kind === 'semi') {
    const [cx, cy] = semiCentre(g)
    const [x1, y1] = polar(cx, cy, g.r, 180 + g.rot)
    const [x2, y2] = polar(cx, cy, g.r, g.rot)
    return `M${n(x1)} ${n(y1)}A${n(g.r)} ${n(g.r)} 0 0 1 ${n(x2)} ${n(y2)}z`
  }
  return roundPoly(g.pts, 3.5)
}

/** Centre of the full circle such that the half-disc's bounding box is centred on (50, 50). */
function semiCentre(g: { r: number; rot: number }): V2 {
  // Sample the boundary (diameter ends + the arc) in a frame centred at the origin.
  const pts: V2[] = [polar(0, 0, g.r, 180 + g.rot), polar(0, 0, g.r, g.rot)]
  for (let a = 180; a <= 360; a += 5) pts.push(polar(0, 0, g.r, a + g.rot))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return [50 - (Math.min(...xs) + Math.max(...xs)) / 2, 50 - (Math.min(...ys) + Math.max(...ys)) / 2]
}

function corners(g: Geo): V2[] {
  if (g.kind === 'poly') return g.pts
  if (g.kind === 'semi') {
    const [cx, cy] = semiCentre(g)
    return [polar(cx, cy, g.r, 180 + g.rot), polar(cx, cy, g.r, g.rot)]
  }
  return []
}

export interface Shape2DProps extends MatBase {
  shape: ShapeId
  /** 0 standard, 1 rotated, 2 stretched/irregular, 3 small, 4 patterned, 5 outline only. */
  variant?: number
  tone?: Tone
  /** Hint overlays: dots on corners, or alternating colours on the sides. */
  mark?: 'corners' | 'sides'
  /** A dividing line through the figure: into two equal halves, or two unequal parts. */
  cut?: 'equal' | 'unequal'
}

export function Shape2D({ shape, variant = 0, tone = MAT.shape, mark, cut, size, ...rest }: Shape2DProps) {
  const uid = useId().replace(/:/g, '')
  const small = variant === 3
  const g0 = geometry(shape, variant)
  const g: Geo = small
    ? g0.kind === 'poly'
      ? { kind: 'poly', pts: scale(g0.pts, 0.55) }
      : { ...g0, r: g0.r * 0.55 }
    : g0
  const d = geoPath(g)
  const outlineOnly = variant === 5
  const patterned = variant === 4
  const clipId = `shp${uid}`
  const stripes = patterned ? segments(Array.from({ length: 14 }, (_, i) => [-10 + i * 10, 110, 30 + i * 10, -10] as const)) : ''
  let cutD = ''
  if (cut) {
    const x = cut === 'equal' ? 50 : 36
    cutD = `M${x} -2V102`
  }
  const pts = corners(g)
  return (
    <MatSvg w={100} h={100} size={size ?? 100} {...rest}>
      {(patterned || cut) && (
        <defs>
          <clipPath id={clipId}>
            <path d={d} />
          </clipPath>
        </defs>
      )}
      {!outlineOnly && <path d={d} fill={tone.fill} />}
      {patterned && <path d={stripes} stroke={tone.shade} strokeWidth={4.5} clipPath={`url(#${clipId})`} />}
      {cut && <path d={cutD} stroke={tone.outline} strokeWidth={2.6} strokeDasharray="6 5" strokeLinecap="round" clipPath={`url(#${clipId})`} />}
      {mark === 'sides' && pts.length > 2 ? (
        pts.map((p, i) => {
          const q = pts[(i + 1) % pts.length]
          return <path key={i} d={poly([p, q], false)} stroke={i % 2 ? PRIMARY : MAT.counterB.fill} strokeWidth={6} strokeLinecap="round" />
        })
      ) : (
        <path d={d} fill="none" stroke={tone.outline} strokeWidth={SWS} strokeLinejoin="round" />
      )}
      {mark === 'corners' && pts.length > 0 && <path d={join(...pts.map(([x, y]) => circle(x, y, 5)))} fill={PRIMARY} stroke={MAT.face.fill} strokeWidth={2} />}
    </MatSvg>
  )
}
