// Solid figures (SolidId) in isometric view with three tones – top light, left mid, right dark
// (SPEC §11, kunst-lyd-teknik §1.6): sphere, cube, cuboid (kasse), cylinder, cone and pyramid.
import type { SolidId } from '../../engine/types'
import { circle, ellipse, join, lune, n, poly } from './geom'
import type { V2 } from './geom'
import { MatSvg } from './kit'
import type { MatBase } from './kit'
import { GROUND, HIGHLIGHT, MAT } from './palette'
import type { Tone } from './palette'

export const SOLID_IDS: readonly SolidId[] = ['sphere', 'cube', 'cuboid', 'cylinder', 'cone', 'pyramid']

const SWS = 3

/** Isometric projection of (x, y, z) with unit `s`, then offset. */
const iso = (s: number, ox: number, oy: number) => (x: number, y: number, z: number): V2 => [ox + (x - y) * 0.866 * s, oy + (x + y) * 0.5 * s - z * s]

function Box({ dx, dy, dz, s, tone }: { dx: number; dy: number; dz: number; s: number; tone: Tone }) {
  // Centre the projected bounding box in the 100 box.
  const top = -dz * s
  const bottom = (dx + dy) * 0.5 * s
  const left = -dy * 0.866 * s
  const right = dx * 0.866 * s
  const P = iso(s, 50 - (left + right) / 2, 48 - (top + bottom) / 2)
  const topF = poly([P(0, 0, dz), P(dx, 0, dz), P(dx, dy, dz), P(0, dy, dz)])
  const leftF = poly([P(0, dy, 0), P(dx, dy, 0), P(dx, dy, dz), P(0, dy, dz)])
  const rightF = poly([P(dx, 0, 0), P(dx, dy, 0), P(dx, dy, dz), P(dx, 0, dz)])
  const outline = join(
    poly([P(0, 0, dz), P(dx, 0, dz), P(dx, 0, 0), P(dx, dy, 0), P(0, dy, 0), P(0, dy, dz)]),
    poly([P(0, dy, dz), P(dx, dy, dz), P(dx, 0, dz)], false),
    poly([P(dx, dy, dz), P(dx, dy, 0)], false),
  )
  const [gx, gy] = P(dx / 2, dy / 2, 0)
  return (
    <>
      <path d={ellipse(gx, gy + 6, (dx + dy) * 0.55 * s, (dx + dy) * 0.18 * s)} fill={GROUND} />
      <path d={leftF} fill={tone.fill} />
      <path d={rightF} fill={tone.shade} />
      <path d={topF} fill={tone.light} />
      <path d={outline} fill="none" stroke={tone.outline} strokeWidth={SWS} strokeLinejoin="round" />
    </>
  )
}

function art(solid: SolidId, t: Tone) {
  switch (solid) {
    case 'cube':
      return <Box dx={1} dy={1} dz={1} s={38} tone={t} />
    case 'cuboid':
      return <Box dx={1.55} dy={0.8} dz={0.85} s={34} tone={t} />
    case 'pyramid': {
      const s = 46
      const raw = iso(s, 0, 0)
      const all = [raw(0, 0, 0), raw(1, 0, 0), raw(1, 1, 0), raw(0, 1, 0), raw(0.5, 0.5, 1.25)]
      const xs = all.map((p) => p[0])
      const ys = all.map((p) => p[1])
      const P = iso(s, 50 - (Math.min(...xs) + Math.max(...xs)) / 2, 46 - (Math.min(...ys) + Math.max(...ys)) / 2)
      const apex = P(0.5, 0.5, 1.25)
      const [ax, ay] = apex
      const [gx, gy] = P(0.5, 0.5, 0)
      return (
        <>
          <path d={ellipse(gx, gy + 6, s * 0.95, s * 0.3)} fill={GROUND} />
          <path d={poly([P(0, 1, 0), P(1, 1, 0), apex])} fill={t.fill} />
          <path d={poly([P(1, 0, 0), P(1, 1, 0), apex])} fill={t.shade} />
          <path d={poly([P(0, 1, 0), P(0, 0, 0), P(1, 0, 0)], false)} fill="none" stroke={t.outline} strokeWidth={2} strokeDasharray="4 5" strokeLinecap="round" opacity={0.45} />
          <path d={join(poly([P(1, 0, 0), P(1, 1, 0), P(0, 1, 0), apex]), poly([P(1, 1, 0), apex], false))} fill="none" stroke={t.outline} strokeWidth={SWS} strokeLinejoin="round" />
          <path d={`M${n(ax - 5)} ${n(ay + 12)}L${n(ax - 13)} ${n(ay + 30)}`} stroke={HIGHLIGHT} strokeWidth={4} strokeLinecap="round" />
        </>
      )
    }
    case 'cylinder': {
      const cx = 50
      const rx = 30
      const ry = 12
      const yt = 22
      const yb = 76
      const body = `M${cx - rx} ${yt}V${yb}A${rx} ${ry} 0 0 0 ${cx + rx} ${yb}V${yt}z`
      const shade = `M${cx + 8} ${yt + ry - 0.5}V${yb + ry - 0.6}A${rx} ${ry} 0 0 0 ${cx + rx} ${yb}V${yt}z`
      return (
        <>
          <path d={ellipse(cx, yb + 8, rx + 8, ry * 0.7)} fill={GROUND} />
          <path d={body} fill={t.fill} />
          <path d={shade} fill={t.shade} />
          <path d={`M${cx - rx + 8} ${yt + 16}V${yb - 4}`} stroke={HIGHLIGHT} strokeWidth={5} strokeLinecap="round" />
          <path d={ellipse(cx, yt, rx, ry)} fill={t.light} />
          <path d={join(body, ellipse(cx, yt, rx, ry))} fill="none" stroke={t.outline} strokeWidth={SWS} strokeLinejoin="round" />
        </>
      )
    }
    case 'cone': {
      const cx = 50
      const rx = 32
      const ry = 12
      const yb = 76
      const apexY = 12
      const body = `M${cx} ${apexY}L${cx + rx} ${yb}A${rx} ${ry} 0 0 1 ${cx - rx} ${yb}z`
      const shade = `M${cx} ${apexY}L${cx + rx} ${yb}A${rx} ${ry} 0 0 1 ${cx + 6} ${yb + ry - 0.4}z`
      return (
        <>
          <path d={ellipse(cx, yb + 8, rx + 8, ry * 0.7)} fill={GROUND} />
          <path d={body} fill={t.fill} />
          <path d={shade} fill={t.shade} />
          <path d={`M${cx - 6} ${apexY + 16}L${cx - 18} ${yb - 8}`} stroke={HIGHLIGHT} strokeWidth={5} strokeLinecap="round" />
          <path d={`M${cx - rx} ${yb}A${rx} ${ry} 0 0 1 ${cx + rx} ${yb}`} fill="none" stroke={t.outline} strokeWidth={2} strokeDasharray="4 5" strokeLinecap="round" opacity={0.45} />
          <path d={body} fill="none" stroke={t.outline} strokeWidth={SWS} strokeLinejoin="round" />
        </>
      )
    }
    case 'sphere':
      return (
        <>
          <path d={ellipse(50, 88, 30, 6)} fill={GROUND} />
          <path d={circle(50, 48, 36)} fill={t.fill} />
          <path d={lune(50, 48, 34.5, 10, 10)} fill={t.shade} />
          <path d={ellipse(38, 34, 9, 5.5)} fill={HIGHLIGHT} transform="rotate(-38 38 34)" />
          <path d={circle(50, 48, 36)} fill="none" stroke={t.outline} strokeWidth={SWS} />
        </>
      )
  }
}

export interface Solid3DProps extends MatBase {
  solid: SolidId
  tone?: Tone
}

export function Solid3D({ solid, tone = MAT.solid, size, ...rest }: Solid3DProps) {
  return (
    <MatSvg w={100} h={100} size={size ?? 100} {...rest}>
      {art(solid, tone)}
    </MatSvg>
  )
}
