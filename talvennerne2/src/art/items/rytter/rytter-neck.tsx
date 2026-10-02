// Rytter · hals: en vinderrosette i et smalt bånd om halsen. Båndet kommer frem under hagen på begge
// sider af halsen og samles bag rosetten midt på brystet. Rosetten er en plisseret krans med folder, en
// inderkrans i en anden farve og en knap med en lille hestesko, og to bånd med svalehaler hænger ned
// under den. Cel-skygge på kransen og knappen og et lille glimt. Hele smykket flyttes ned under hagen på
// arter med lang mule (hest, enhjørning), og babyens store hoved tages med. (0,0) = halsleddet, tegnet
// ved neckWidth 58.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { arc, blob, circle, ellipse, join, line, lune, poly, ribbon, scallop, star } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, ItemArt, ItemDef, Stage } from '../../rig/types'

/** Rosettens centrum og kransens radius (inderkrans og knap er mindre). */
const C: Vec = [0, 29]
const R = 15.5
const INNER = 9.6
const BUTTON = 5.6
/** Halsbåndets to halvdele: fra halsens sider ned bag rosetten. */
const STRAP_L: Vec[] = [[-21, -3], [-14, 7], [-6, 17]]
const STRAP_R: Vec[] = [[21, -3], [14, 7], [6, 17]]
const W = 6.4
/** Svalehalerne: bånd fra rosettens bund ned og lidt ud, med et V-hak forneden. */
const TAILS: Vec[][] = [
  [[-2.5, 36], [-9.6, 34.5], [-15.8, 58], [-11.2, 54.2], [-6.6, 59.6]],
  [[2.5, 36], [9.6, 34.5], [13.6, 59], [9.6, 55.4], [4.8, 60]],
]

/** Hagen ligger under halsleddet på arter med lang mule (og babyens hoved er relativt større). */
function chinDrop(a: AnchorSet, stage: Stage): number {
  const k = STAGE_XF[stage].head / STAGE_XF[stage].body
  return Math.max(0, a.mouth.y + 7 - a.neck.y) * k
}

/** Kransens folder: korte stråler fra inderkransen ud mod kanten. */
const PLEATS = join(
  ...Array.from({ length: 14 }, (_, i) => {
    const t = ((i + 0.5) / 14) * Math.PI * 2
    return line([C[0] + Math.cos(t) * (INNER + 1.6), C[1] + Math.sin(t) * (INNER + 1.6)], [C[0] + Math.cos(t) * (R - 2.2), C[1] + Math.sin(t) * (R - 2.2)])
  }),
)

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const drop = solo ? 0 : local({ x: a.neck.x, y: a.neck.y + chinDrop(a, stage) }).y
  return (
    <g transform={drop > 0.05 ? `translate(0 ${drop.toFixed(1)})` : undefined}>
      <path d={join(blob(ribbon(STRAP_L, W), 0.6), blob(ribbon(STRAP_R, W), 0.6))} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
      <path d={join(...TAILS.map((t) => poly(t)))} fill={c.main} {...stroke} />
      <path d={poly([[-9.6, 34.5], [-12.6, 46], [-6.4, 45.4], [-2.5, 36]])} fill={c.mainShade} />
      <path d={scallop(C[0], C[1], R, R, 18, 0.62, -90)} fill={c.main} {...stroke} />
      <path d={lune(C[0], C[1], R - 1.2, R - 1.2, 3.4, -10, 115)} fill={c.mainShade} />
      <path d={PLEATS} fill="none" stroke={c.outline} strokeWidth={sw * 0.4} strokeLinecap="round" opacity={0.55} />
      <path d={scallop(C[0], C[1], INNER, INNER, 12, 0.6, -90)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
      <path d={circle(C[0], C[1], BUTTON)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.7} />
      <path d={arc(C[0], C[1] + 0.4, 2.6, 2.8, 150, 390)} fill="none" stroke={c.accentOutline} strokeWidth={sw * 0.5} strokeLinecap="round" />
      <path d={join(ellipse(C[0] - 6.4, C[1] - 7.6, 3.6, 1.7, -38), star(C[0] + R + 3.6, C[1] - R + 2, 4.2, 1.1))} fill={c.highlight} />
    </g>
  )
}

export const rytterNeck: ItemDef = {
  id: 'rytter-neck',
  set: 'rytter',
  slot: 'neck',
  nameClip: 'name.item.rytter-neck',
  source: { kind: 'finale', world: 'bakke' },
  colorways: [
    fabric('blaa', 'himmelblå', 'sky', 'snow', 'gold'),
    fabric('roed', 'rød', 'tomato', 'cream', 'gold'),
    fabric('lilla', 'lilla', 'violet', 'rose', 'silver'),
  ],
  art: { front },
  fit: { anchor: 'neck', scaleBy: 'neckWidth', baseScale: 1, baseWidth: 46 },
  icon: { box: [-26, -8, 52, 70] },
}

export default rytterNeck
