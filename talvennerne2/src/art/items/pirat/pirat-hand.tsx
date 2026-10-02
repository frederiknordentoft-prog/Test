// Pirat · hånd: en kikkert (søkikkert) med tre udtræk, messingringe og et blankt glas forrest. Den holdes
// om det smalle okularstykke i højre pote (poten tegnes over grebet), og det brede rør med glasset peger
// skråt op og ud. Riggen giver genstanden posen (`hold`): kikkerten drejes væk fra ansigtet og hovedets
// omrids, til den går fri, og holdes i den sikre zone (fælles `aimAway`, som luppen). Alt tegnes i en
// ramme, der er drejet tilbage til verdensrummet, så lys og skygge står ens i alle poser. Alene (butik)
// ligger den skråt som et ikon. Kikkerten rækker med vilje ud over silhuetten (`reach`).
import { aimAway, aimSolo } from '../../rig/hold'
import { fabric } from '../../rig/palette'
import { capsule, ellipse, join, poly } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemDef, Pt } from '../../rig/types'

/** Udtrækkene (fra grebet og ud): start, slut og radius i hovedets modelenheder. */
const SEGS: readonly [number, number, number][] = [
  [-9, 10, 4],
  [9, 26, 5.5],
  [25, 46, 7.2],
]
/** Messingringene (position og radius) og glassets plads forrest. */
const RINGS: readonly [number, number][] = [[9.6, 6.1], [25.6, 7.9], [44.6, 8.7]]
const LENS = 47
/** Foretrukken retning (grader; −90 = op) og trin, når ansigtet er i vejen. */
const AIM = -42
const STEP = 18

const front: ItemArt = ({ c, sw, a, hold }) => {
  const P = hold ? aimAway(hold, [{ at: 18, r: 5 }, { at: LENS, r: 7.5 }], AIM, STEP) : aimSolo(a.handRot, -35)
  const { at, k, g, d, u, rot } = P
  // Tegnes i en ramme drejet tilbage til verdensrummet (lyset oppefra til venstre, bokse langs akserne).
  const t = (-rot * Math.PI) / 180
  const pt = (p: Pt): Vec => {
    const q = at(p)
    return [q.x * Math.cos(t) - q.y * Math.sin(t), q.x * Math.sin(t) + q.y * Math.cos(t)]
  }
  const along = (s: number): Vec => pt({ x: g.x + d.x * s * u, y: g.y + d.y * s * u })
  const r = (v: number) => v * u * k
  // Retningen i den tilbagedrejede ramme (til glassets ellipse og ringenes bånd).
  const ang = (Math.atan2(d.y, d.x) * 180) / Math.PI
  const nx = -d.y
  const ny = d.x
  // En ring: et kort bånd på tværs af røret.
  const ring = (s: number, rad: number) => {
    const [x0, y0] = along(s - 1.4)
    const [x1, y1] = along(s + 1.4)
    const w = r(rad)
    return poly([[x0 + nx * w, y0 + ny * w], [x1 + nx * w, y1 + ny * w], [x1 - nx * w, y1 - ny * w], [x0 - nx * w, y0 - ny * w]])
  }
  // Udtrækkene tegnes fra det smalleste til det bredeste, så hvert rør forsvinder ind i det næste.
  const tubes = SEGS.map(([s0, s1, rad]) => capsule(along(s0), along(s1), r(rad)))
  // Skyggen langs rørenes nederste side og et smalt højlys langs den øverste (lyset oppe til venstre).
  const side = ny > 0 ? 1 : -1
  const offset = (s0: number, s1: number, o: number, w: number) => {
    const [x0, y0] = along(s0)
    const [x1, y1] = along(s1)
    return capsule([x0 + nx * o, y0 + ny * o], [x1 + nx * o, y1 + ny * o], w)
  }
  const shade = SEGS.map(([s0, s1, rad]) => offset(s0 + 1.2, s1 - 0.6, r(rad * 0.48) * side, r(rad * 0.4)))
  const shine = SEGS.map(([s0, s1, rad]) => offset(s0 + 3, s1 - 3, -r(rad * 0.5) * side, r(rad * 0.16)))
  const [lx, ly] = along(LENS)
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <g transform={`rotate(${rot.toFixed(2)})`}>
      {tubes.flatMap((tube, i) => [
        <path key={`t${i}`} d={tube} fill={c.main} {...stroke} />,
        <path key={`s${i}`} d={shade[i]} fill={c.mainShade} />,
      ])}
      <path d={join(...RINGS.map(([s, rad]) => ring(s, rad)))} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
      <path d={ellipse(lx, ly, r(3), r(7.4), ang)} fill={c.accent} stroke={c.trimOutline} strokeWidth={sw * 0.8} />
      <path d={join(ellipse(lx - r(0.7), ly - r(2.8), r(1), r(2.1), ang), ...shine)} fill={c.highlight} />
    </g>
  )
}

export const piratHand: ItemDef = {
  id: 'pirat-hand',
  set: 'pirat',
  slot: 'hand',
  nameClip: 'name.item.pirat-hand',
  source: { kind: 'shop', price: 120 },
  colorways: [
    fabric('laeder', 'læderbrun', 'cocoa', 'gold', 'sky'),
    fabric('sort', 'sort', 'charcoal', 'gold', 'mint'),
    fabric('roed', 'rød', 'tomato', 'silver', 'sky'),
  ],
  art: { front },
  fit: { anchor: 'pawR', scaleBy: 'fixed', baseScale: 1, baseWidth: 40 },
  reach: true,
  icon: { box: [-12, -38, 56, 45] },
}

export default piratHand
