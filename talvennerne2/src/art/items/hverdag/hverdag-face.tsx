// Hverdag · ansigt: solbriller (pilotform) på øjnene med klare glas (review G1-r4, T1: brillerne må aldrig
// sidde over munden). Glassene omslutter øjet med luft til, at pupillerne kan kigge rundt og de lukkede
// øjnes vipper går fri, så stellet aldrig dækker øjnene (fit-regel 6). Glasset er kun svagt tonet (16 %)
// med et hvidt højlys i det øverste ydre hjørne uden for øjet, så øjnene er lige så tydelige som uden
// briller. Glassets inderside skråner udad forneden, så der er plads til næsen. Broen sidder over
// næseryggen, og stængerne forsvinder mod hovedets sider. Alt regnes ud fra bærerens øjenankre og stadiets
// øjenskala (babyens øjne er større), så brillerne sidder ens på alle arter og stadier. I butikken er
// glassene mørke, så ikonet læses som solbriller.
import { STAGE_XF } from '../../rig/anchors'
import { WHITE, fabric } from '../../rig/palette'
import { blob, circle, join, poly, quad, spline } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemDef } from '../../rig/types'

/**
 * Venstre glas (set forfra; +x mod næsen) i glasenheder (øjet plus luft plus en halv stelbredde). Alle
 * punkter ligger uden for enhedscirklen, så stellet går uden om øjet. Pilotform: flad overkant, rund
 * underkant og en inderside, der skråner udad forneden (plads til næsen).
 */
const LENS: readonly Vec[] = [
  [0.9, -1.05], [0.2, -1.17], [-0.72, -1.12], [-1.2, -0.74], [-1.3, -0.05], [-1.12, 0.66], [-0.62, 1.12],
  [0.02, 1.2], [0.62, 0.92], [1.0, 0.32], [1.08, -0.44],
]
/** Glassets tone på dyret (højst ca. 20 %, review G1-r4, T1) og i butikken (mørke solglas). */
const TINT = 0.16
const SOLO_TINT = 0.85

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const es = STAGE_XF[stage].eye
  const L = local(a.eyeL)
  const R = local(a.eyeR)
  // Modelenheder → lokale (genstanden er skaleret med hovedbredden).
  const k = Math.hypot(R.x - L.x, R.y - L.y) / Math.hypot(a.eyeR.x - a.eyeL.x, a.eyeR.y - a.eyeL.y)
  const erx = a.eyeRx * es * k
  const ery = a.eyeRy * es * k
  // Glasenhederne: øjet (de lukkede øjnes vipper er 1,3 · øjets bredde) plus luft plus en halv stelbredde.
  const half = sw * 0.85
  const ux = Math.max(erx + 2.2 * k, erx * 1.3) + half
  const uy = ery + 1.6 * k + half
  const lens = (cx: number, cy: number, side: 1 | -1): Vec[] => LENS.map(([x, y]) => [cx + side * x * ux, cy + y * uy] as Vec)
  const gl = lens(L.x, L.y, 1)
  const gr = lens(R.x, R.y, -1)
  const glass = join(blob(gl, 0.9), blob(gr, 0.9))
  // Broen over næseryggen (kun når glassene ikke rører hinanden) og stængerne mod hovedets sider.
  const bx0 = L.x + 0.9 * ux
  const bx1 = R.x - 0.9 * ux
  const by = (L.y + R.y) / 2 - 1.02 * uy
  const bridge = bx1 - bx0 > sw ? quad([bx0, by], [(bx0 + bx1) / 2, by - 3 * k], [bx1, by]) : ''
  const hc = local(a.headCenter)
  const hw = a.headRx * 0.92 * k
  const ty = (L.y + R.y) / 2 - 0.74 * uy
  const temples = join(
    spline([[L.x - 1.2 * ux, ty], [hc.x - hw * 0.95, ty - 2.4 * k], [hc.x - hw, ty - 4.4 * k]]),
    spline([[R.x + 1.2 * ux, ty], [hc.x + hw * 0.95, ty - 2.4 * k], [hc.x + hw, ty - 4.4 * k]]),
  )
  const frame = join(glass, bridge, temples)
  // Hvidt højlys: en skrå stribe i glassets øverste ydre hjørne og en prik forneden mod næsen, begge uden
  // for øjet.
  const glare = join(
    ...([[L.x, L.y, 1], [R.x, R.y, -1]] as const).map(([x, y, s]) =>
      join(
        poly([
          [x - s * 1.02 * ux, y - 0.42 * uy],
          [x - s * 0.66 * ux, y - 0.94 * uy],
          [x - s * 0.44 * ux, y - 0.94 * uy],
          [x - s * 0.84 * ux, y - 0.36 * uy],
        ]),
        circle(x + s * 0.5 * ux, y + 0.74 * uy, 0.09 * ux),
      ),
    ),
  )
  const studs = join(circle(L.x - 1.2 * ux, ty, 1.6 * k), circle(R.x + 1.2 * ux, ty, 1.6 * k))
  return (
    <>
      <path d={glass} fill={c.trim} opacity={solo ? SOLO_TINT : TINT} />
      <path d={glare} fill={c.highlight === 'none' ? 'none' : WHITE} opacity={0.85} />
      <path d={frame} fill="none" stroke={c.outline} strokeWidth={sw * 1.7} strokeLinecap="round" strokeLinejoin="round" />
      <path d={frame} fill="none" stroke={c.main} strokeWidth={sw * 0.74} strokeLinecap="round" strokeLinejoin="round" />
      <path d={studs} fill={c.accent} stroke={c.outline} strokeWidth={sw * 0.35} />
    </>
  )
}

export const hverdagFace: ItemDef = {
  id: 'hverdag-face',
  set: 'hverdag',
  slot: 'face',
  nameClip: 'name.item.hverdag-face',
  source: { kind: 'level', level: 7 },
  colorways: [
    fabric('sol', 'solgul', 'sunflower', 'charcoal', 'tomato'),
    fabric('rosa', 'rosa', 'berry', 'violet', 'rose'),
    fabric('himmel', 'himmelblå', 'sky', 'navy', 'snow'),
  ],
  art: { front },
  fit: { anchor: 'headCenter', scaleBy: 'headWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [-54, -19, 108, 46] },
}

export default hverdagFace
