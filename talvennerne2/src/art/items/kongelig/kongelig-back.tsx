// Kongelig · ryg: en kongekåbe. Kåben hænger bag kroppen (lag 2) fra skuldrene ned mod jorden og breder
// sig ud i en blød bue, så den ses på begge sider af kroppen. Forsiden viser kåbens hermelinsfor (hvidt med
// små sorte haler) inden for en bred fløjlskant, så den læses som en kongekåbe, også i butikskortet på dyret
// (review G1-r4, B3: kappen må ikke kun ses i kortets kanter). Foran skuldrene (lag 9b, under hovedet)
// ligger to hermelinsstykker med hver sin guldbroche, samlet af en tynd guldkæde, der lader halsens smykke
// være frit. Højden regnes ud fra halsleddet og jordlinjen, så kåben passer alle tre kropsformer og stadier,
// og på stor klemmes den vandret, så hjørnerne bliver i den sikre zone. (0,0) = bodyCenter, tegnet ved
// bodyWidth 100.
import { SAFE, STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, circle, drop, ellipse, join, spline } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, ItemArt, ItemArtProps, ItemDef, Stage } from '../../rig/types'

/** Kåbens halve bredde ved skuldrene og forneden (højre side breder sig en anelse mere). */
const TOP_W = 30
const LEFT_W = 82
const RIGHT_W = 86
/** Fløjlskanten uden om hermelinsforet. */
const EDGE = 9

/** Kåben fra halsen ned mod jorden (lokale koordinater). */
function mantleOf(p: Pick<ItemArtProps, 'a' | 'local'>) {
  const top = p.local(p.a.neck).y - 4
  const bot = p.local(p.a.ground).y - 6
  return { top, bot, lift: (bot - top) * 0.1 }
}

/** Hvor bredt kåben må være (lokale enheder fra midten) for at holde sig i den sikre zone i stadiet. */
function safeHalf(p: Pick<ItemArtProps, 'a' | 'local' | 'stage'>): number {
  const k = STAGE_XF[p.stage].fig * STAGE_XF[p.stage].body
  const model = (wx: number) => p.a.ground.x + (wx - p.a.ground.x) / k
  const l = p.local({ x: model(SAFE.x0 + 2.5), y: p.a.bodyCenter.y })
  const r = p.local({ x: model(SAFE.x1 - 2.5), y: p.a.bodyCenter.y })
  return Math.min(-l.x, r.x)
}

/** Kåbens omrids: skuldrene, siderne der breder sig ud, og en blød bue forneden. */
function outline(top: number, bot: number, lift: number, inset = 0, sx = 1): Vec[] {
  const h = bot - top
  const L = LEFT_W * sx - inset
  const R = RIGHT_W * sx - inset
  return [
    [0, top + inset],
    [TOP_W - inset * 0.6, top + 2 + inset],
    [R * 0.66, top + h * 0.34],
    [R * 0.92, top + h * 0.7 - lift * 0.4],
    [R + 1 - inset * 0.3, bot - lift - inset * 0.6],
    [R * 0.6, bot - lift * 0.3 - inset * 0.8],
    [0, bot - inset],
    [-L * 0.6, bot - inset * 0.8],
    [-L - inset * 0.3, bot - lift * 0.3 - inset * 0.6],
    [-L * 0.92, top + h * 0.7],
    [-L * 0.66, top + h * 0.34],
    [-TOP_W + inset * 0.6, top + 2 + inset],
  ]
}

/** Hermelinens sorte haler: små dråber spredt over foret ved kåbens sider (det, der ses ved siden af kroppen). */
function tails(top: number, bot: number, L: number, R: number): string {
  const h = bot - top
  const spots: Vec[] = []
  for (const [fx, fy] of [[0.84, 0.36], [0.7, 0.55], [0.9, 0.62], [0.78, 0.8], [0.6, 0.88], [0.92, 0.86]] as const) {
    spots.push([-L * fx, top + h * fy], [R * fx, top + h * (fy + 0.03)])
  }
  return join(...spots.map(([x, y]) => drop(x, y, 1.9)))
}

const front: ItemArt = ({ c, sw, a, local, solo, stage, ids }) => {
  const m = solo ? { top: -46, bot: 44, lift: 9 } : mantleOf({ a, local })
  const { top, bot, lift } = m
  const sx = solo ? 0.56 : Math.min(1, (safeHalf({ a, local, stage }) - 5) / RIGHT_W)
  const L = LEFT_W * sx
  const R = RIGHT_W * sx
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const shape = blob(outline(top, bot, lift, 0, sx), 0.8)
  const lining = blob(outline(top, bot - 2, lift, EDGE * (solo ? 0.8 : 1), sx), 0.8)
  const clip = `${ids.uid}-kk`
  return (
    <>
      <path d={shape} fill={c.main} {...stroke} />
      <path d={lining} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
      <clipPath id={clip}>
        <path d={lining} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={ellipse(0, bot + 4, R * 1.05, (bot - top) * 0.34)} fill={c.trimShade} />
        <path d={tails(top, bot, L, R)} fill={c.ink} />
      </g>
      <path d={join(spline([[-L * 0.5, top + 14], [-L * 0.6, (top + bot) / 2], [-L * 0.66, bot - 12]]), spline([[R * 0.5, top + 14], [R * 0.6, (top + bot) / 2], [R * 0.68, bot - lift * 0.3 - 12]]))} fill="none" stroke={c.trimShade} strokeWidth={sw * 0.7} strokeLinecap="round" />
      <path d={join(ellipse(-L * 0.94, top + (bot - top) * 0.56, 2.2, 8, 14), ellipse(R * 0.95, top + (bot - top) * 0.5, 2, 7, -16))} fill={c.highlight} />
      {solo && <Shoulders c={c} sw={sw} y={top + 3} />}
    </>
  )
}

/** Hagen ligger under halsleddet på arter med lang mule (og babyens hoved er relativt større). */
function chinDrop(a: AnchorSet, stage: Stage): number {
  const k = STAGE_XF[stage].head / STAGE_XF[stage].body
  return Math.max(0, a.mouth.y + 5 - a.neck.y) * k
}

/** Hermelinsstykkerne over skuldrene med broche og kæden imellem (halsens smykke er frit). */
function Shoulders({ c, sw, y }: { c: ItemArtProps['c']; sw: number; y: number }) {
  const piece = (s: 1 | -1): Vec[] => [[s * 20, y - 3], [s * 31, y - 4.5], [s * 39, y + 1], [s * 37.5, y + 9.5], [s * 29, y + 12], [s * 21.5, y + 7]]
  const pins: Vec[] = [[-27.5, y + 3.6], [27.5, y + 3.6]]
  return (
    <>
      <path d={join(blob(piece(-1), 0.7), blob(piece(1), 0.7))} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.9} strokeLinejoin="round" />
      <path d={join(drop(-34, y + 6, 1.5), drop(34, y + 6.4, 1.5), drop(-24, y + 8.2, 1.4), drop(24, y + 8.6, 1.4))} fill={c.ink} />
      <path d={spline([pins[0], [0, y + 9], pins[1]])} fill="none" stroke={c.accentOutline} strokeWidth={sw * 1.15} strokeDasharray={`0.1 ${(sw * 1.1).toFixed(2)}`} strokeLinecap="round" />
      <path d={join(...pins.map(([x, py]) => circle(x, py, 4.4)))} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.8} />
      <path d={join(...pins.map(([x, py]) => circle(x - 1.3, py - 1.4, 1.2)))} fill={c.highlight} />
    </>
  )
}

/** Foran skuldrene (lag 9b, under hovedet); alene tegner forsiden dem selv øverst på kåben. */
const shoulders: ItemArt = ({ c, sw, a, local, stage, solo }) =>
  solo ? null : <Shoulders c={c} sw={sw} y={local({ x: a.neck.x, y: a.neck.y + chinDrop(a, stage) }).y + 2} />

export const kongeligBack: ItemDef = {
  id: 'kongelig-back',
  set: 'kongelig',
  slot: 'back',
  nameClip: 'name.item.kongelig-back',
  source: { kind: 'finale', world: 'skov' },
  colorways: [
    fabric('purpur', 'purpur', 'berry', 'snow', 'gold'),
    fabric('kongeblaa', 'kongeblå', 'navy', 'snow', 'gold'),
    fabric('roed', 'rød', 'tomato', 'cream', 'silver'),
  ],
  art: { front, back: shoulders },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 168 },
  reach: true,
  icon: { box: [-50, -48, 100, 94] },
}

export default kongeligBack
