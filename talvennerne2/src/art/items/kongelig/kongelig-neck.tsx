// Kongelig · hals: en dobbelt perlekæde med et vedhæng. To rækker perler ligger i bløde buer under
// hagen (den nederste lidt længere og med større perler), og en slebet sten hænger i en lille øsken midt
// på den nederste række. Hver perle har cel-skygge forneden til højre og et lille hvidt højlys. Hele
// smykket flyttes ned under hagen på arter med lang mule (hest, enhjørning), og babyens store hoved
// tages med. (0,0) = halsleddet, tegnet ved neckWidth 58.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { circle, ellipse, join, lune, poly } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, ItemArt, ItemDef, Stage } from '../../rig/types'

/** En række perler langs en parabel fra halsens ene side til den anden: halv bredde, top, bund, antal og radius. */
interface Strand {
  w: number
  top: number
  bottom: number
  count: number
  r: number
}
const STRANDS: readonly Strand[] = [
  { w: 21, top: -1, bottom: 13, count: 9, r: 2.7 },
  { w: 24.5, top: 2, bottom: 22.5, count: 11, r: 3.1 },
]
/** Vedhænget under den nederste række. */
const GEM = { y: 30.5, rx: 4.4, ry: 5.4 }

/** Perlernes centre langs rækkens bue (jævnt fordelt i x, så de ligger tæt på tværs af brystet). */
function pearls(s: Strand): Vec[] {
  return Array.from({ length: s.count }, (_, i) => {
    const t = -1 + (2 * i) / (s.count - 1)
    const x = s.w * Math.sin((t * Math.PI) / 2)
    return [x, s.bottom - (s.bottom - s.top) * (x / s.w) ** 2] as Vec
  })
}

/** Hagen ligger under halsleddet på arter med lang mule (og babyens hoved er relativt større). */
function chinDrop(a: AnchorSet, stage: Stage): number {
  const k = STAGE_XF[stage].head / STAGE_XF[stage].body
  return Math.max(0, a.mouth.y + 6 - a.neck.y) * k
}

const ALL = STRANDS.flatMap((s) => pearls(s).map(([x, y]) => ({ x, y, r: s.r })))
const BEADS = join(...ALL.map((p) => circle(p.x, p.y, p.r)))
const SHADE = join(...ALL.map((p) => lune(p.x, p.y, p.r - 0.5, p.r - 0.5, p.r * 0.42, -20, 110)))
const SHINE = join(...ALL.map((p) => circle(p.x - p.r * 0.36, p.y - p.r * 0.38, p.r * 0.3)))

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const drop = solo ? 0 : local({ x: a.neck.x, y: a.neck.y + chinDrop(a, stage) }).y
  const bail = STRANDS[1].bottom + STRANDS[1].r + 1.4
  return (
    <g transform={drop > 0.05 ? `translate(0 ${drop.toFixed(1)})` : undefined}>
      <path d={BEADS} fill={c.main} stroke={c.outline} strokeWidth={sw * 0.7} />
      <path d={SHADE} fill={c.mainShade} />
      <path d={circle(0, bail, 2.2)} fill="none" stroke={c.trimOutline} strokeWidth={sw * 1.2} />
      <path d={circle(0, bail, 2.2)} fill="none" stroke={c.trim} strokeWidth={sw * 0.5} />
      <path d={poly([[0, GEM.y - GEM.ry], [GEM.rx, GEM.y - GEM.ry * 0.25], [GEM.rx * 0.62, GEM.y + GEM.ry * 0.62], [0, GEM.y + GEM.ry], [-GEM.rx * 0.62, GEM.y + GEM.ry * 0.62], [-GEM.rx, GEM.y - GEM.ry * 0.25]])} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={poly([[0, GEM.y - GEM.ry * 0.5], [GEM.rx * 0.5, GEM.y], [0, GEM.y + GEM.ry * 0.62], [-GEM.rx * 0.5, GEM.y]])} fill={c.accentShade} />
      <path d={join(SHINE, ellipse(-1.4, GEM.y - GEM.ry * 0.42, 1, 1.4, 0))} fill={c.highlight === 'none' ? 'none' : c.highlight} />
    </g>
  )
}

export const kongeligNeck: ItemDef = {
  id: 'kongelig-neck',
  set: 'kongelig',
  slot: 'neck',
  nameClip: 'name.item.kongelig-neck',
  source: { kind: 'chest', nodeId: 'w2-hundreder-chest' },
  colorways: [
    fabric('hvid', 'hvide perler', 'snow', 'gold', 'berry'),
    fabric('rosa', 'rosa perler', 'rose', 'silver', 'violet'),
    fabric('lavendel', 'lavendel', 'lilac', 'gold', 'teal'),
  ],
  art: { front },
  fit: { anchor: 'neck', scaleBy: 'neckWidth', baseScale: 1, baseWidth: 52 },
  icon: { box: [-29, -5, 58, 43] },
}

export default kongeligNeck
