// Fest · hoved: festhat med striber, konfetti-prikker, flæsekant og kvast. earMode 'under':
// hatten sidder mellem ørerne (klemmes til earGap · 1,15), og ørerne ligger ovenpå hattens kant.
// Flæsen drejer med keglen og er bredere end den, så keglens kontur aldrig titter frem under den.
import { fabric } from '../../rig/palette'
import { circle, join, poly, scallop, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemDef } from '../../rig/types'

const W = 31 // halv bundbredde
const BASE = 4 // bundens y (lidt under headTop, så hatten hviler på issen)
const APEX = -34
const TILT = -9

/** Keglens kant som funktion af y (lineær mellem spids og bund). */
const edgeX = (y: number) => (W * (y - APEX)) / (BASE - APEX)

/** Vandret stribe i keglen mellem y0 og y1 (præcist inden for kanterne). */
const stripe = (y0: number, y1: number): Vec[] => [
  [-edgeX(y0), y0], [edgeX(y0), y0], [edgeX(y1), y1], [-edgeX(y1), y1],
]

const front: ItemArt = ({ c, sw }) => {
  const t = (pts: readonly Vec[]) => xf(pts, { rot: TILT, about: [0, BASE] })
  const cone = t([[0, APEX - 1.5], [W, BASE], [0, BASE + 3], [-W, BASE]])
  const shade = t([[0, APEX - 1.5], [W, BASE], [0, BASE + 3], [W * 0.46, BASE]])
  const stripes = [stripe(-23, -17), stripe(-8, -2)].map((s) => poly(t(s)))
  const dots = t([[-10, -12], [8, -13], [-4, 1], [14, 1.5], [-18, 1.2], [2, -25.5], [-1, -13]])
  const ruffle = t([[0, BASE + 2.2]])[0]
  const top = t([[0, APEX - 3]])[0]
  const shine = t([[-W * 0.55, BASE - 3], [-3.5, APEX + 6], [-1.8, APEX + 8], [-W * 0.34, BASE - 2]])
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <>
      <path d={poly(cone)} fill={c.main} {...stroke} />
      <path d={poly(shade)} fill={c.mainShade} />
      <path d={join(...stripes)} fill={c.trim} />
      <path d={join(...dots.map(([x, y]) => circle(x, y, 2.1)))} fill={c.accent} />
      <path d={poly(shine)} fill={c.highlight} />
      <path d={poly(cone)} fill="none" {...stroke} />
      <path d={scallop(ruffle[0], ruffle[1], W + 6.5, 6.4, 13, 0.6, 0, TILT)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
      <path d={scallop(top[0], top[1], 7.5, 7.5, 8, 0.62, -90)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
    </>
  )
}

export const festHead: ItemDef = {
  id: 'fest-head',
  set: 'fest',
  slot: 'head',
  nameClip: 'name.item.fest-head',
  source: { kind: 'shop', price: 120 },
  colorways: [
    fabric('bær', 'bærrød', 'berry', 'sunflower', 'mint'),
    fabric('himmel', 'himmelblå', 'sky', 'snow', 'sunflower'),
    fabric('sol', 'solgul', 'sunflower', 'coral', 'sky'),
  ],
  art: { front },
  // baseWidth er keglens bund (flæsen må gerne række ind under ørerne, som ligger ovenpå).
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1.12, baseWidth: 62, earMode: 'under' },
  icon: { box: [-42, -47, 84, 62] },
}

export default festHead
