// Pirat · hals: et prikket bandana, bundet om halsen. Den trekantede snip hænger ned over brystet med
// spidsen nedad, og båndet går rundt om halsen under hagen med en lille knude og to korte flagrende ender
// i siden. Prikkerne regnes ud inden for snippen, og cel-skyggen ligger nederst til højre. Det ligger i
// halslaget (over kropstøjets krave, under hovedet) og flyttes ned under hagen på arter med lang mule.
// Alene (butik) ses det bundet om en usynlig hals: båndets bagside lukker løkken foroven, knuden er stor,
// og de to snipper flagrer ud til siden, så det læses som et halstørklæde (review G1-r4, B4).
// (0,0) = halsleddet, tegnet ved neckWidth 58.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, circle, ellipse, join, ribbon, spline } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, ItemArt, ItemDef, Stage } from '../../rig/types'

/** Båndet om halsen: hænger lidt ned midtpå og går op om halsen i siderne. */
const W = 31
const BAND: Vec[] = [
  [-W, -3], [-W * 0.5, 1], [0, 2.6], [W * 0.5, 1], [W, -3], [W + 1.8, 1.8], [W * 0.5, 7.4], [0, 9], [-W * 0.5, 7.4], [-W - 1.8, 1.8],
]
/** Snippen: en blød trekant med spidsen nedad. */
const TIP: Vec[] = [[-25, 4], [0, 6.4], [25, 4], [12, 18], [3, 30], [0, 32], [-3, 30], [-12, 18]]
/** Skyggen langs snippens højre kant (inden for snippen). */
const SHADE: Vec[] = [[23, 5], [12, 18], [3, 30], [0, 31.4], [2.6, 25], [9.4, 15], [17, 7]]
/** Prikkerne inden for snippen. */
const DOTS: Vec[] = [[-14, 11], [0, 13], [14, 11], [-6, 21], [7, 21], [0, 27.4]]
/** Knuden i venstre side og de to flagrende ender. */
const KNOT: Vec = [-25, 3.6]
const ENDS: Vec[][] = [
  [[-27, 3], [-34, 0], [-40, 3], [-38, 9], [-31, 8]],
  [[-27, 5], [-33, 8.4], [-35, 15], [-29.4, 15], [-25.6, 9]],
]

/** Alene: båndets bagside (løkken om halsen) fra knuden over toppen til højre side, og de lange snipper. */
const SOLO_LOOP: Vec[] = [[-W + 1, 1], [-W * 0.7, -8.4], [0, -12.6], [W * 0.7, -8.4], [W - 1, 1]]
const SOLO_ENDS: Vec[][] = [
  [[-27, 1.6], [-34, -5], [-42, -9.4], [-50, -8], [-47.4, -2.4], [-40, 1.2], [-31, 5.4]],
  [[-27.6, 6], [-32, 12], [-39.6, 18.4], [-37.4, 24.4], [-31, 21], [-27.4, 14], [-24, 8]],
]
const SOLO_KNOT: Vec = [-26, 3.4]

/** Hagen ligger under halsleddet på arter med lang mule (og babyens hoved er relativt større). */
function chinDrop(a: AnchorSet, stage: Stage): number {
  const k = STAGE_XF[stage].head / STAGE_XF[stage].body
  return Math.max(0, a.mouth.y + 7 - a.neck.y) * k
}

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const drop = solo ? 0 : local({ x: a.neck.x, y: a.neck.y + chinDrop(a, stage) }).y
  if (solo)
    return (
      <>
        <path d={blob(ribbon(SOLO_LOOP, 6.4), 0.7)} fill={c.mainShade} {...stroke} />
        <path d={join(...SOLO_ENDS.map((e) => blob(e, 0.8)))} fill={c.main} {...stroke} />
        <path d={join(spline([[-31, 1.4], [-38.6, -3.6], [-45.4, -6]]), spline([[-28.6, 9], [-32.4, 15], [-36, 20]]))} fill="none" stroke={c.mainShade} strokeWidth={sw * 0.9} strokeLinecap="round" />
        <path d={blob(TIP, 0.55)} fill={c.main} {...stroke} />
        <path d={blob(SHADE, 0.6)} fill={c.mainShade} />
        <path d={join(...DOTS.map(([x, y]) => circle(x, y, 2.3)))} fill={c.trim} />
        <path d={blob(TIP, 0.55)} fill="none" {...stroke} />
        <path d={blob(BAND, 0.7)} fill={c.main} {...stroke} />
        <path d={join(circle(-15, 4.6, 1.6), circle(15, 4.6, 1.6), circle(0, 5.6, 1.6), circle(-10, -9.6, 1.4), circle(10, -9.6, 1.4))} fill={c.trim} />
        <path d={ellipse(SOLO_KNOT[0], SOLO_KNOT[1], 6.6, 5.8, -20)} fill={c.main} {...stroke} />
        <path d={join(ellipse(-12, 9, 3.4, 1.6, -18), ellipse(SOLO_KNOT[0] - 2, SOLO_KNOT[1] - 2, 2.2, 1.3, -20))} fill={c.highlight} />
      </>
    )
  return (
    <g transform={drop > 0.05 ? `translate(0 ${drop.toFixed(1)})` : undefined}>
      <path d={join(...ENDS.map((e) => blob(e, 0.8)))} fill={c.mainShade} {...stroke} />
      <path d={blob(TIP, 0.55)} fill={c.main} {...stroke} />
      <path d={blob(SHADE, 0.6)} fill={c.mainShade} />
      <path d={join(...DOTS.map(([x, y]) => circle(x, y, 2.3)))} fill={c.trim} />
      <path d={blob(TIP, 0.55)} fill="none" {...stroke} />
      <path d={blob(BAND, 0.7)} fill={c.main} {...stroke} />
      <path d={join(circle(-15, 4.6, 1.6), circle(15, 4.6, 1.6), circle(0, 5.6, 1.6))} fill={c.trim} />
      <path d={ellipse(KNOT[0], KNOT[1], 5, 4.4, -20)} fill={c.main} {...stroke} />
      <path d={join(ellipse(-12, 9, 3.4, 1.6, -18), ellipse(KNOT[0] - 1.6, KNOT[1] - 1.4, 1.6, 1, -20))} fill={c.highlight} />
    </g>
  )
}

export const piratNeck: ItemDef = {
  id: 'pirat-neck',
  set: 'pirat',
  slot: 'neck',
  nameClip: 'name.item.pirat-neck',
  source: { kind: 'shop', price: 80 },
  colorways: [
    fabric('roed', 'rød', 'tomato', 'snow', 'snow'),
    fabric('blaa', 'blå', 'navy', 'snow', 'snow'),
    fabric('sort', 'sort', 'charcoal', 'sunflower', 'sunflower'),
  ],
  art: { front },
  fit: { anchor: 'neck', scaleBy: 'neckWidth', baseScale: 1, baseWidth: 66 },
  icon: { box: [-53, -17, 87, 51] },
}

export default piratNeck
