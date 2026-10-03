// Fest · hoved: festhat med striber, konfetti-prikker, flæsekant og kvast. earMode 'under':
// hatten sidder mellem ørerne (klemmes til earGap · 1,15), og ørerne ligger ovenpå hattens kant.
// Flæsen drejer med keglen og er bredere end den, så keglens kontur aldrig titter frem under den.
import { fabric } from '../../rig/palette'
import { circle, join, poly, scallop, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemArtProps, ItemDef } from '../../rig/types'

const W = 30 // halv bundbredde
const BASE = 6 // bundens y (under headTop, så hatten hviler på issen)
const APEX = -26
const TILT = -9

/** Keglens kant som funktion af y (lineær mellem spids og bund). */
const edgeX = (y: number) => (W * (y - APEX)) / (BASE - APEX)

/** Vandret stribe i keglen mellem y0 og y1 (præcist inden for kanterne). */
const stripe = (y0: number, y1: number): Vec[] => [
  [-edgeX(y0), y0], [edgeX(y0), y0], [edgeX(y1), y1], [-edgeX(y1), y1],
]

/**
 * Hattens vip i grader ud fra pasformen (invers af fitTransform): en hat ved siden af et horn er vippet mod venstre
 * øre (fit.ts, UNDER_BESIDE_HORN); ellers står den lige (ikonet og alle arter uden horn).
 */
const tiltOf = (local: ItemArtProps['local']): number => {
  const o = local({ x: 0, y: 0 })
  const e = local({ x: 1, y: 0 })
  return (-Math.atan2(e.y - o.y, e.x - o.x) * 180) / Math.PI
}
/**
 * Ved siden af et horn (review G2-r2, T6/B6): en slankere kegle (bunden 25 % smallere), så dens øvre halvdel og
 * kvasten står fri af hornet, og en ca. 30 % smallere flæse, der ikke ligner en krøllet pandelok.
 */
const BESIDE_HORN = { cone: 0.75, ruffle: 0.7, lobes: 10 } as const

const front: ItemArt = ({ c, sw, local }) => {
  const horn = tiltOf(local) < -10
  const k = horn ? BESIDE_HORN.cone : 1
  const t = (pts: readonly Vec[]) => xf(pts, { rot: TILT, about: [0, BASE] })
  const sx = (pts: readonly Vec[]): Vec[] => pts.map(([x, y]) => [x * k, y] as Vec)
  const cone = t(sx([[0, APEX - 1.5], [W, BASE], [0, BASE + 3], [-W, BASE]]))
  const shade = t(sx([[0, APEX - 1.5], [W, BASE], [0, BASE + 3], [W * 0.46, BASE]]))
  const stripes = [stripe(-17, -11.5), stripe(-4, 1.5)].map((s) => poly(t(sx(s))))
  const dots = t(sx([[-9, -8], [8, -9], [-3, 4], [14, 4], [-17, 3.6], [2, -19.5], [-0.5, -9]]))
  const ruffle = t([[0, BASE + 2.2]])[0]
  const top = t([[0, APEX - 3]])[0]
  const shine = t(sx([[-W * 0.55, BASE - 3], [-3.5, APEX + 6], [-1.8, APEX + 8], [-W * 0.34, BASE - 2]]))
  const ruffleRx = horn ? (W + 6.5) * BESIDE_HORN.ruffle : W + 6.5
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <>
      <path d={poly(cone)} fill={c.main} {...stroke} />
      <path d={poly(shade)} fill={c.mainShade} />
      <path d={join(...stripes)} fill={c.trim} />
      <path d={join(...dots.map(([x, y]) => circle(x, y, 2.1)))} fill={c.accent} />
      <path d={poly(shine)} fill={c.highlight} />
      <path d={poly(cone)} fill="none" {...stroke} />
      <path d={scallop(ruffle[0], ruffle[1], ruffleRx, 6.4, horn ? BESIDE_HORN.lobes : 13, 0.6, 0, TILT)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
      <path d={scallop(top[0], top[1], 6.8, 6.8, 8, 0.62, -90)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
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
  // baseWidth er keglens bund (flæsen må gerne række ind under ørerne, som ligger ovenpå). På en art med
  // horn vipper riggen hatten mod venstre øre bag hornet i fuld størrelse (fit.ts, review G1-r4, T6).
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1.06, baseWidth: 60, earMode: 'under' },
  icon: { box: [-40, -38, 80, 56] },
}

export default festHead
