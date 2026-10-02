// Opdager · hals: et messingkompas i en lædersnor. Snoren kommer frem under hagen på begge sider af
// halsen og samles i kompassets øsken; kompasset hænger midt på brystet, lille nok til at ligge mellem
// poterne og over forbenene. Huset har cel-skygge, skiven fire streger og en nål med rød nordspids og
// mørk sydspids, og glasset et højlys. Hele smykket flyttes ned under hagen på arter med lang mule
// (hest, enhjørning), og babyens store hoved tages med. (0,0) = halsleddet, tegnet ved neckWidth 58.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { circle, ellipse, join, line, lune, poly, spline } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, ItemArt, ItemDef, Stage } from '../../rig/types'

/** Kompassets centrum og radier (huset, skiven) og øskenen øverst. */
const C: Vec = [0, 24]
const R = 13.8
const FACE = 8.9
const EYE: Vec = [0, C[1] - R - 2.6]

/** Snoren: fra halsens sider under hagen ned til øskenen (to buer, der mødes i øskenen). */
const CORD = join(
  spline([[-20, -2], [-14, 4], [-6, 8], [-1.6, EYE[1] + 1]]),
  spline([[20, -2], [14, 4], [6, 8], [1.6, EYE[1] + 1]]),
)
/** I butikken: snoren lagt som en løkke over kompasset. */
const CORD_LOOP = spline([[-1.6, EYE[1] + 0.6], [-10, 3], [-14, -7], [-8, -15], [0, -17], [8, -15], [14, -7], [10, 3], [1.6, EYE[1] + 0.6]])
/** Nålen: en smal rombe; nordspidsen peger op mod venstre (den har lige fundet nord). */
const NEEDLE_ROT = -24
const needleHalf = (north: boolean): string => {
  const t = (NEEDLE_ROT * Math.PI) / 180
  const rot = ([x, y]: Vec): Vec => [C[0] + x * Math.cos(t) - y * Math.sin(t), C[1] + x * Math.sin(t) + y * Math.cos(t)]
  const tip = north ? -7.4 : 7.4
  const pts: Vec[] = [[-2.6, 0], [0, tip], [2.6, 0]]
  return poly(pts.map(rot))
}
/** Skivens fire streger (nord, øst, syd, vest). */
const TICKS = join(
  ...[0, 90, 180, 270].map((deg) => {
    const t = (deg * Math.PI) / 180
    const at = (r: number): Vec => [C[0] + r * Math.sin(t), C[1] - r * Math.cos(t)]
    return line(at(FACE - 1.2), at(FACE - 3.4))
  }),
)

/** Hagen ligger under halsleddet på arter med lang mule (og babyens hoved er relativt større). */
function chinDrop(a: AnchorSet, stage: Stage): number {
  const k = STAGE_XF[stage].head / STAGE_XF[stage].body
  return Math.max(0, a.mouth.y + 7 - a.neck.y) * k
}

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const drop = solo ? 0 : local({ x: a.neck.x, y: a.neck.y + chinDrop(a, stage) }).y
  return (
    <g transform={drop > 0.05 ? `translate(0 ${drop.toFixed(1)})` : undefined}>
      <path d={solo ? CORD_LOOP : CORD} fill="none" stroke={c.outline} strokeWidth={sw * 1.15} strokeLinecap="round" />
      <path d={solo ? CORD_LOOP : CORD} fill="none" stroke={c.mainShade} strokeWidth={sw * 0.4} strokeLinecap="round" />
      <path d={join(circle(EYE[0], EYE[1], 3.6), circle(EYE[0], EYE[1], 1.6))} fill={c.main} fillRule="evenodd" {...stroke} strokeWidth={sw * 0.7} />
      <path d={circle(C[0], C[1], R)} fill={c.main} {...stroke} />
      <path d={lune(C[0], C[1], R - sw / 2, R - sw / 2, 2.2, -10, 105)} fill={c.mainShade} />
      <path d={circle(C[0], C[1], FACE)} fill={c.trim} stroke={c.outline} strokeWidth={sw * 0.55} />
      <path d={TICKS} fill="none" stroke={c.outline} strokeWidth={sw * 0.38} strokeLinecap="round" />
      <path d={needleHalf(true)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.28} strokeLinejoin="round" />
      <path d={needleHalf(false)} fill={c.ink} stroke={c.ink} strokeWidth={sw * 0.28} strokeLinejoin="round" />
      <path d={circle(C[0], C[1], 1.5)} fill={c.main} stroke={c.outline} strokeWidth={sw * 0.28} />
      <path d={join(ellipse(C[0] - 3.4, C[1] - 4.6, 2.6, 1.3, -38), ellipse(C[0] - R * 0.6, C[1] - R * 0.52, 2, 1.2, -42))} fill={c.highlight} />
    </g>
  )
}

export const opdagerNeck: ItemDef = {
  id: 'opdager-neck',
  set: 'opdager',
  slot: 'neck',
  nameClip: 'name.item.opdager-neck',
  source: { kind: 'finale', world: 'eng' },
  colorways: [
    fabric('messing', 'messing', 'gold', 'cream', 'tomato'),
    fabric('soelv', 'sølv', 'silver', 'snow', 'berry'),
    fabric('skov', 'skovgrøn', 'teal', 'cream', 'orange'),
  ],
  art: { front },
  fit: { anchor: 'neck', scaleBy: 'neckWidth', baseScale: 1, baseWidth: 44 },
  icon: { box: [-15.6, -19, 31.2, 59.6] },
}

export default opdagerNeck
