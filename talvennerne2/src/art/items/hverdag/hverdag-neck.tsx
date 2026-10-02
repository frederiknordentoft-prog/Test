// Hverdag · hals: et tykt, stribet strikhalstørklæde med knude og to snipper med bløde frynser. Det
// ligger i halslaget (over kropstøjets krave, under hovedet), så hagen hviler på viklen. Viklen er et
// bånd, der hænger ned midtpå og løber op om halsen i siderne (runde ender); striber og skygge regnes
// ud mellem båndets kanter, så de passer præcist uden klip. Hele tørklædet flyttes ned under hagen på
// arter med lang mule (hest, enhjørning), og babyens store hoved tages med i regnestykket.
// (0,0) = halsleddet, tegnet ved neckWidth 58.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, capsule, ellipse, join, poly, ribbon, spline, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, ItemArt, ItemDef, Stage } from '../../rig/types'

/** Viklens halve bredde og kanter: y(x) = kant + hæng · (1 − (x/W)²). */
const W = 36
const top = (x: number) => -7 + 4 * (1 - (x / W) ** 2)
const bot = (x: number) => 8.5 + 8.5 * (1 - (x / W) ** 2)
const xs = (x0: number, x1: number, n = 5) => Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1))

/** Viklen: top- og bundkant med runde ender. */
const WRAP: Vec[] = [
  ...xs(-W + 3, W - 3, 9).map((x) => [x, top(x)] as Vec),
  [W + 2.2, 1.2],
  ...xs(W - 3, -W + 3, 9).map((x) => [x, bot(x)] as Vec),
  [-W - 2.2, 1.2],
]
/** Et stykke af viklen mellem x0 og x1 (striber og skygge). */
const slab = (x0: number, x1: number, y0 = top, y1 = bot): Vec[] => [
  ...xs(x0, x1, 3).map((x) => [x, y0(x)] as Vec),
  ...xs(x1, x0, 3).map((x) => [x, y1(x)] as Vec),
]
const STRIPES = [-27, -15, 10, 22].map((x) => poly(slab(x, x + 5.6)))
/** Skyggen langs viklens underkant (rundingen væk fra lyset). */
const WRAP_SHADE = poly(slab(-W + 3, W - 3, (x) => bot(x) - 4.2, bot))

/** Snipperne (rygrad og bredder) fra knuden ned; den bageste først. */
const TAIL_B: Vec[] = [[4, 15], [8.5, 24], [12, 33]]
const TAIL_A: Vec[] = [[-3, 15], [-5, 25], [-7.5, 36]]
const TAIL_W = [12, 13, 14]
const tail = (spine: readonly Vec[]) => blob(ribbon(spine, TAIL_W), 0.6)

/** Snippens retning i enden: enhedsvektor langs og punktet i enden. */
function endOf(spine: readonly Vec[]) {
  const [a, b] = [spine[spine.length - 2], spine[spine.length - 1]]
  const l = Math.hypot(b[0] - a[0], b[1] - a[1])
  return { a, b, u: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] as Vec }
}

/**
 * Tværbånd på snippen ved andel t af det sidste stykke (striberne følger snippens retning). Båndet slutter
 * ved konturens inderkant (`inset`), så snippens egen kontur aldrig skal stryges igen oven på andre dele.
 */
function crossband(spine: readonly Vec[], t: number, h: number, inset: number): string {
  const { a, b, u } = endOf(spine)
  const c: Vec = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const w = (TAIL_W[1] + (TAIL_W[2] - TAIL_W[1]) * t) / 2 - inset
  const at = (s: number, v: number): Vec => [c[0] + u[0] * s - u[1] * v, c[1] + u[1] * s + u[0] * v]
  return poly([at(-h / 2, -w), at(h / 2, -w), at(h / 2, w), at(-h / 2, w)])
}

/** Frynserne: tre korte, buttede totter under snippens ende (bløde, ikke tynde tråde). */
function fringe(spine: readonly Vec[]): string {
  const { b, u } = endOf(spine)
  return join(
    ...[-4.3, 0, 4.3].map((v, i) => {
      const s: Vec = [b[0] - u[1] * v - u[0] * 2, b[1] + u[0] * v - u[1] * 2]
      const len = 6.2 + (i === 1 ? 1.2 : 0)
      return capsule(s, [s[0] + u[0] * len, s[1] + u[1] * len], 2.1, 2.5)
    }),
  )
}

/** Knuden: en buttet, let skæv bolle midt på viklen. */
const KNOT = xf(
  [[0, -6], [5, -4.8], [7.4, 0], [5.6, 4.9], [0, 6.4], [-5.8, 4.7], [-7.4, 0], [-5.2, -5]],
  { rot: -10, dx: 0.5, dy: 13.6 },
)
/** Bløde folder i viklen på hver side af knuden. */
const FOLDS = [spline([[-21, 6.5], [-14, 10.6], [-8, 12]]), spline([[9, 12], [15, 10.8], [21, 7.5]]), spline([[-3.6, 9.6], [-0.6, 13.4], [0.4, 18]])]

/**
 * Hvor langt under halsleddet hagen når (modelrummet i kroppens region): mulen på heste og
 * enhjørninger går ned under halsleddet, og babyens hoved er større i forhold til kroppen.
 */
function chinDrop(a: AnchorSet, stage: Stage): number {
  const k = STAGE_XF[stage].head / STAGE_XF[stage].body
  return Math.max(0, a.mouth.y + 7 - a.neck.y) * k
}

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const drop = solo ? 0 : local({ x: a.neck.x, y: a.neck.y + chinDrop(a, stage) }).y
  return (
    <g transform={drop > 0.05 ? `translate(0 ${drop.toFixed(1)})` : undefined}>
      <path d={blob(WRAP, 0.75)} fill={c.main} />
      <path d={join(...STRIPES)} fill={c.trim} />
      <path d={WRAP_SHADE} fill={c.mainShade} />
      <path d={join(FOLDS[0], FOLDS[1])} fill="none" stroke={c.mainShade} strokeWidth={sw * 0.6} strokeLinecap="round" />
      <path d={blob(WRAP, 0.75)} fill="none" {...stroke} />
      <path d={join(fringe(TAIL_B), fringe(TAIL_A))} fill={c.accent} stroke={c.outline} strokeWidth={sw * 0.5} strokeLinejoin="round" />
      <path d={tail(TAIL_B)} fill={c.mainShade} {...stroke} />
      <path d={join(crossband(TAIL_B, 0.3, 3.4, sw * 0.5 + 0.15), crossband(TAIL_B, 0.82, 3.4, sw * 0.5 + 0.15))} fill={c.trim} />
      <path d={tail(TAIL_A)} fill={c.main} {...stroke} />
      <path d={join(crossband(TAIL_A, 0.25, 3.6, sw * 0.5 + 0.15), crossband(TAIL_A, 0.78, 3.6, sw * 0.5 + 0.15))} fill={c.trim} />
      <path d={blob(KNOT, 0.9)} fill={c.main} {...stroke} />
      <path d={FOLDS[2]} fill="none" stroke={c.mainShade} strokeWidth={sw * 0.6} strokeLinecap="round" />
      <path d={join(ellipse(-22, 2.6, 5.2, 2, -6), ellipse(-2.4, 11.4, 2.4, 1.5, -20))} fill={c.highlight} />
    </g>
  )
}

export const hverdagNeck: ItemDef = {
  id: 'hverdag-neck',
  set: 'hverdag',
  slot: 'neck',
  nameClip: 'name.item.hverdag-neck',
  source: { kind: 'level', level: 3 },
  colorways: [
    fabric('tomat', 'tomatrød', 'tomato', 'cream', 'cream'),
    fabric('skov', 'skovgrøn', 'leaf', 'sunflower', 'sunflower'),
    fabric('blaa', 'mørkeblå', 'navy', 'sky', 'sky'),
  ],
  art: { front },
  fit: { anchor: 'neck', scaleBy: 'neckWidth', baseScale: 1, baseWidth: 76 },
  icon: { box: [-40, -9, 80, 54] },
}

export default hverdagNeck
