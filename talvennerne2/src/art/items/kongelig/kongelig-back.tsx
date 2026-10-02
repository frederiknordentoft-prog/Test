// Kongelig · ryg: en kongekåbe. Kåben hænger bag kroppen (lag 2) fra skuldrene ned mod jorden og breder
// sig ud i en blød bue, så den ses på begge sider af kroppen: fløjl inden for en bred hermelinskant (hvid med
// små sorte haler). Foran skuldrene (lag 9b, under hovedet) ligger en hermelinskrave i to dele med hver sin
// guldbroche, samlet af en tynd guldkæde, så kåben læses som en kongekåbe også i butikskortet på dyret
// (review G1-r4, B3: kappen må ikke kun ses i kortets kanter), og halsens smykke er frit midt for. Højden regnes ud fra halsleddet og jordlinjen, så kåben passer alle tre kropsformer og stadier,
// og på stor klemmes den vandret, så hjørnerne bliver i den sikre zone. (0,0) = bodyCenter, tegnet ved
// bodyWidth 100.
import { SAFE, STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, circle, drop, ellipse, join, spline } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, ItemArt, ItemArtProps, ItemDef, Stage } from '../../rig/types'

/** Kåbens halve bredde ved skuldrene og forneden (højre side breder sig en anelse mere). */
const TOP_W = 40
const LEFT_W = 82
const RIGHT_W = 86
/** Hermelinskantens bredde uden om fløjlet. */
const EDGE = 10

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
    [R * 0.84, top + h * 0.3],
    [R * 0.97, top + h * 0.66 - lift * 0.4],
    [R + 1 - inset * 0.3, bot - lift - inset * 0.6],
    [R * 0.6, bot - lift * 0.3 - inset * 0.8],
    [0, bot - inset],
    [-L * 0.6, bot - inset * 0.8],
    [-L - inset * 0.3, bot - lift * 0.3 - inset * 0.6],
    [-L * 0.97, top + h * 0.66],
    [-L * 0.84, top + h * 0.3],
    [-TOP_W + inset * 0.6, top + 2 + inset],
  ]
}

/** Hermelinens sorte haler langs kantens midte (kåbens nederste og ydre punkter; de øverste skjules af kroppen). */
function tails(top: number, bot: number, lift: number, sx: number): string {
  const mid = outline(top, bot, lift, EDGE / 2, sx).slice(2, 11)
  const extra = mid.slice(0, -1).map((p, i) => [(p[0] + mid[i + 1][0]) / 2, (p[1] + mid[i + 1][1]) / 2] as Vec)
  return join(...[...mid, ...extra].map(([x, y]) => drop(x, y - 1.2, 2)))
}

const front: ItemArt = ({ c, sw, a, local, solo, stage }) => {
  const m = solo ? { top: -46, bot: 44, lift: 9 } : mantleOf({ a, local })
  const { top, bot, lift } = m
  const sx = solo ? 0.56 : Math.min(1, (safeHalf({ a, local, stage }) - 5) / RIGHT_W)
  const L = LEFT_W * sx
  const R = RIGHT_W * sx
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  // Hermelinskanten er yderst (hele omridset), og fløjlet ligger inden for den.
  const shape = blob(outline(top, bot, lift, 0, sx), 0.8)
  const velvet = blob(outline(top, bot, lift, EDGE, sx), 0.8)
  return (
    <>
      <path d={shape} fill={c.trim} {...stroke} />
      <path d={velvet} fill={c.main} stroke={c.trimOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={tails(top, bot, lift, sx)} fill={c.ink} />
      <path d={join(spline([[-L * 0.42, top + 14], [-L * 0.52, (top + bot) / 2], [-L * 0.58, bot - 14]]), spline([[R * 0.42, top + 14], [R * 0.54, (top + bot) / 2], [R * 0.6, bot - lift * 0.3 - 14]]))} fill="none" stroke={c.mainShade} strokeWidth={sw * 1.1} strokeLinecap="round" />
      <path d={join(ellipse(-L * 0.74, top + (bot - top) * 0.5, 2.2, 8, 14), ellipse(R * 0.76, top + (bot - top) * 0.46, 2, 7, -16))} fill={c.highlight} />
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
  const piece = (s: 1 | -1): Vec[] => [[s * 18, y - 4], [s * 31, y - 6], [s * 42, y - 1.4], [s * 44.5, y + 6.6], [s * 38, y + 14], [s * 27.5, y + 15.4], [s * 19.5, y + 9.6]]
  const pins: Vec[] = [[-23, y + 2.6], [23, y + 2.6]]
  const spots: Vec[] = [[-37.5, y + 3.6], [-31, y + 11], [-40, y + 10.4], [37.5, y + 4], [31, y + 11.4], [40, y + 10.8]]
  return (
    <>
      <path d={join(blob(piece(-1), 0.65), blob(piece(1), 0.65))} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.9} strokeLinejoin="round" />
      <path d={join(...spots.map(([x, py]) => drop(x, py, 1.6)))} fill={c.ink} />
      <path d={spline([pins[0], [0, y + 8], pins[1]])} fill="none" stroke={c.accentOutline} strokeWidth={sw * 1.15} strokeDasharray={`0.1 ${(sw * 1.1).toFixed(2)}`} strokeLinecap="round" />
      <path d={join(...pins.map(([x, py]) => circle(x, py, 4.6)))} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.8} />
      <path d={join(...pins.map(([x, py]) => circle(x - 1.4, py - 1.5, 1.3)))} fill={c.highlight} />
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
