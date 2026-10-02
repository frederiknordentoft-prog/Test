// Milepæl · hals (niveau 20): medaljehalskæde. Et stribet bånd kommer frem under hagen på begge sider af
// halsen og samles i en V ved medaljens øsken; medaljen hænger midt på brystet: en guldskive med en
// takket kant, en præget stjerne, cel-skygge og et smalt glansbånd, og et lille glimt ved siden af.
// Båndets farve skifter med farvesættet, mens medaljen altid er af guld (en belønning, aldrig en rang).
// Hele smykket flyttes ned under hagen på arter med lang mule (hest, enhjørning), og babyens store
// hoved tages med. (0,0) = halsleddet, tegnet ved neckWidth 58.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, circle, ellipse, join, lune, ribbon, scallop, star } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, ItemArt, ItemDef, Stage } from '../../rig/types'

/** Medaljens centrum og radius (den takkede kant er lidt større). */
const C: Vec = [0, 27]
const R = 12.5
/** Båndets to halvdele: fra halsens sider ned til medaljens top (bredde 8). */
const STRAP_L: Vec[] = [[-21, -3], [-14, 6], [-6.5, 13]]
const STRAP_R: Vec[] = [[21, -3], [14, 6], [6.5, 13]]
const W = 8.4

/** Hagen ligger under halsleddet på arter med lang mule (og babyens hoved er relativt større). */
function chinDrop(a: AnchorSet, stage: Stage): number {
  const k = STAGE_XF[stage].head / STAGE_XF[stage].body
  return Math.max(0, a.mouth.y + 7 - a.neck.y) * k
}

/** Midterstriben i båndet (en smal stribe langs båndets rygrad). */
const stripe = (spine: readonly Vec[]) => blob(ribbon(spine, W * 0.34), 0.6)

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const drop = solo ? 0 : local({ x: a.neck.x, y: a.neck.y + chinDrop(a, stage) }).y
  const gold = { stroke: c.trimOutline, strokeWidth: sw, strokeLinejoin: 'round' as const }
  return (
    <g transform={drop > 0.05 ? `translate(0 ${drop.toFixed(1)})` : undefined}>
      <path d={join(blob(ribbon(STRAP_L, W), 0.6), blob(ribbon(STRAP_R, W), 0.6))} fill={c.main} {...stroke} />
      <path d={join(stripe(STRAP_L), stripe(STRAP_R))} fill={c.accent} />
      <path d={blob([[-8.5, 10.5], [8.5, 10.5], [5, 17], [0, 18.5], [-5, 17]], 0.5)} fill={c.main} {...stroke} />
      <path d={scallop(C[0], C[1], R + 1.2, R + 1.2, 16, 0.6, -90)} fill={c.trim} {...gold} />
      <path d={lune(C[0], C[1], R, R, 3, -10, 110)} fill={c.trimShade} />
      <path d={circle(C[0], C[1], R * 0.66)} fill="none" stroke={c.trimShade} strokeWidth={sw * 0.6} />
      <path d={star(C[0], C[1] + 0.4, R * 0.5, R * 0.22, 5)} fill={c.trimShade} />
      <path d={join(ellipse(C[0] - 4.8, C[1] - 6, 3.4, 1.6, -38), star(C[0] + R + 4, C[1] - R + 1, 4.4, 1.2))} fill={c.highlight} />
    </g>
  )
}

export const milepaelMedalje: ItemDef = {
  id: 'milepael-medalje',
  set: 'milepael',
  slot: 'neck',
  nameClip: 'name.item.milepael-medalje',
  source: { kind: 'level', level: 20 },
  colorways: [
    fabric('roed', 'rød', 'tomato', 'gold', 'snow'),
    fabric('blaa', 'blå', 'sky', 'gold', 'navy'),
    fabric('groen', 'grøn', 'leaf', 'gold', 'sunflower'),
  ],
  art: { front },
  fit: { anchor: 'neck', scaleBy: 'neckWidth', baseScale: 1, baseWidth: 50 },
  icon: { box: [-25.5, -7.4, 51, 49] },
}

export default milepaelMedalje
