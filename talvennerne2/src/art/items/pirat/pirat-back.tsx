// Pirat · ryg: et sammenrullet skattekort i en rem. Rullen ligger skråt bag ryggen (lag 2): den øverste
// ende med papirets snirkel stikker frem over højre skulder, og den nederste ved venstre hofte; to
// læderremme er spændt om rullen, og et rødt kryds og en prikket sti titter frem på papiret. Foran går
// bæreremmen skråt over brystet fra højre skulder mod venstre hofte (stroplaget, klippet til kroppen og
// under poterne) med et messingspænde. Alene (butik) er kortet rullet halvt ud, så stien og krydset ses.
// Rullen rækker med vilje ud over silhuetten (`reach`). (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { fabric } from '../../rig/palette'
import { blob, capsule, circle, ellipse, join, line, poly, rect, ribbon, spline, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { BodyKind, ItemArt, ItemDef, ItemPalette } from '../../rig/types'

/** Rullens akse: fra den øverste ende (over højre skulder) til den nederste (ved venstre hofte). */
const TOP: Vec = [58, -52]
const BOT: Vec = [-70, 20]
const R = 11

const at = (t: number): Vec => [TOP[0] + (BOT[0] - TOP[0]) * t, TOP[1] + (BOT[1] - TOP[1]) * t]
const LEN = Math.hypot(BOT[0] - TOP[0], BOT[1] - TOP[1])
const U: Vec = [(BOT[0] - TOP[0]) / LEN, (BOT[1] - TOP[1]) / LEN]
const N: Vec = [-U[1], U[0]]
const ANG = (Math.atan2(U[1], U[0]) * 180) / Math.PI

/** Et bånd på tværs af rullen ved andel t (remmene), med halv bredde h langs aksen. */
function strapAt(t: number, h: number, w = R + 1.4): string {
  const [x, y] = at(t)
  const p = (s: number, v: number): Vec => [x + U[0] * s + N[0] * v, y + U[1] * s + N[1] * v]
  return poly([p(-h, -w), p(h, -w), p(h, w), p(-h, w)])
}

/** Snirklen i rullens øverste ende: en lille spiral i papiret. */
function curl(): string {
  const pts: Vec[] = Array.from({ length: 14 }, (_, i) => {
    const t = (i / 13) * Math.PI * 3
    const r = 1 + (6.4 * i) / 13
    return [r * Math.cos(t), r * Math.sin(t) * 0.55]
  })
  return spline(xf(pts, { rot: ANG + 90, dx: TOP[0], dy: TOP[1] }))
}

const front: ItemArt = ({ c, sw, solo }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  if (solo) return <Unrolled c={c} sw={sw} />
  const roll = capsule(TOP, BOT, R)
  // Papirets kant langs rullen og skyggen på den nederste side.
  const edge = line([TOP[0] + N[0] * R * 0.35, TOP[1] + N[1] * R * 0.35], [BOT[0] + N[0] * R * 0.35, BOT[1] + N[1] * R * 0.35])
  const shade = capsule([TOP[0] + N[0] * R * 0.55, TOP[1] + N[1] * R * 0.55], [BOT[0] + N[0] * R * 0.55, BOT[1] + N[1] * R * 0.55], R * 0.42)
  // Krydset på papiret ved den nederste ende (uden for kroppens silhuet, så det ses ved hoften).
  const [mx, my] = at(0.9)
  const x = join(line([mx - 3.6, my - 3.6], [mx + 3.6, my + 3.6]), line([mx - 3.6, my + 3.6], [mx + 3.6, my - 3.6]))
  return (
    <>
      <path d={roll} fill={c.main} {...stroke} />
      <path d={shade} fill={c.mainShade} />
      <path d={edge} fill="none" stroke={c.outline} strokeWidth={sw * 0.45} strokeLinecap="round" />
      <path d={ellipse(TOP[0], TOP[1], R * 0.55, R, ANG)} fill={c.main} {...stroke} />
      <path d={curl()} fill="none" stroke={c.outline} strokeWidth={sw * 0.5} strokeLinecap="round" />
      <path d={x} fill="none" stroke={c.trim} strokeWidth={sw * 0.9} strokeLinecap="round" />
      <path d={join(strapAt(0.1, 2.8), strapAt(0.78, 2.8))} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={ellipse(TOP[0] - N[0] * 4, TOP[1] - N[1] * 4 + 8, 1.4, 6, ANG + 90)} fill={c.highlight} />
    </>
  )
}

/** Kortet halvt rullet ud (butikken): papiret med stien og krydset, rullen til venstre og en rem om den. */
function Unrolled({ c, sw }: { c: ItemPalette; sw: number }) {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const sheet = blob([[-24, -30], [10, -33], [36, -29], [40, -2], [37, 27], [8, 31], [-24, 28]], 0.5)
  const path = spline([[-12, 18], [-2, 8], [10, 12], [16, 0], [12, -10], [22, -18]])
  const x: Vec = [24, -19]
  return (
    <>
      <path d={sheet} fill={c.main} {...stroke} />
      <path d={join(ellipse(4, -8, 9, 6, -20), ellipse(20, 14, 7, 4.5, 10))} fill={c.mainShade} />
      <path d={path} fill="none" stroke={c.trim} strokeWidth={sw * 0.7} strokeDasharray={`${(sw * 0.9).toFixed(1)} ${(sw * 1.1).toFixed(1)}`} strokeLinecap="round" />
      <path d={join(line([x[0] - 5, x[1] - 5], [x[0] + 5, x[1] + 5]), line([x[0] - 5, x[1] + 5], [x[0] + 5, x[1] - 5]))} fill="none" stroke={c.trim} strokeWidth={sw * 1.1} strokeLinecap="round" />
      <path d={rect(-36, -36, 18, 70, 9)} fill={c.main} {...stroke} />
      <path d={rect(-30, -34, 6, 66, 3)} fill={c.mainShade} />
      <path d={join(rect(-38, -22, 22, 6, 2), rect(-38, 16, 22, 6, 2))} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={circle(-27, -36, 2.6)} fill={c.highlight} />
    </>
  )
}

/** Bæreremmen over brystet: fra højre skulder mod venstre hofte (pr. kropsform), med et spænde. */
const SLING: Record<BodyKind, Vec[]> = {
  round: [[26, -58], [6, -34], [-16, -12], [-42, 12], [-60, 26]],
  pear: [[26, -54], [6, -31], [-17, -9], [-44, 14], [-62, 28]],
  tall: [[24, -66], [6, -42], [-14, -20], [-36, 4], [-54, 22]],
}

const straps: ItemArt = ({ c, sw, ids, restroke, body }) => {
  const clip = `${ids.uid}-pk`
  const s = SLING[body]
  const mid = s[2]
  const t = Math.atan2(s[3][1] - s[1][1], s[3][0] - s[1][0]) * (180 / Math.PI)
  const buckle = xf([[-4.4, -4.8], [4.4, -4.8], [4.4, 4.8], [-4.4, 4.8]], { rot: t, dx: mid[0], dy: mid[1] })
  return (
    <>
      <clipPath id={clip}>{restroke()}</clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={blob(ribbon(s, 7), 0.55)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw} strokeLinejoin="round" />
        <path d={blob(buckle, 0.4)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      </g>
    </>
  )
}

export const piratBack: ItemDef = {
  id: 'pirat-back',
  set: 'pirat',
  slot: 'back',
  nameClip: 'name.item.pirat-back',
  source: { kind: 'shop', price: 180 },
  colorways: [
    fabric('pergament', 'pergament', 'sand', 'tomato', 'cocoa'),
    fabric('lys', 'lyst papir', 'cream', 'navy', 'tomato'),
    fabric('gammelt', 'gammelt kort', 'mustard', 'berry', 'charcoal'),
  ],
  art: { front, straps },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 140 },
  reach: true,
  icon: { box: [-38, -37, 80, 72] },
}

export default piratBack
