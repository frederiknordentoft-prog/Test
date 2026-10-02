// Milepæl · ryg (niveau 15): superheltekappe. Kappen hænger bag kroppen (lag 2) fra skuldrene ned mod
// jorden og breder sig ud i en blød bue, så den ses på begge sider af kroppen og mellem fødderne; højre
// side løfter sig en anelse, som om vinden tager den. Forsiden viser kappens inderside i skygge med en
// smal kant af yderstoffet og en guldbort forneden. Halen, manken og pindsvinets pigge ligger foran den.
// Foran halsen (lag 9b, under hovedet) samles kappen af en krave og et rundt spænde med en stjerne. Højden
// regnes ud fra halsleddet og jordlinjen, så kappen passer alle tre kropsformer og stadier.
// (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, circle, ellipse, join, lune, softBand, star } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, ItemArt, ItemArtProps, ItemDef, Stage } from '../../rig/types'

/**
 * Kappens halve bredde ved skuldrene og forneden (venstre og højre, højre flagrer lidt længere ud). Den
 * breder sig godt ud over kroppens sider (kroppens halve bredde er 50), så den ses tydeligt bag dyret.
 */
const TOP_W = 30
const LEFT_W = 80
const RIGHT_W = 86

/** Kappen fra halsen ned mod jorden (lokale koordinater). */
function capeOf(p: Pick<ItemArtProps, 'a' | 'local' | 'solo'>) {
  const top = p.solo ? -44 : p.local(p.a.neck).y - 4
  const ground = p.solo ? 46 : p.local(p.a.ground).y
  const bot = ground - 7
  return { top, bot, lift: (bot - top) * 0.16 }
}

/** Kappens omrids: skuldrene, siderne der breder sig ud, og en blød bue forneden med flagrende hjørner. */
function outline(top: number, bot: number, lift: number, inset = 0): Vec[] {
  const h = bot - top
  const L = LEFT_W - inset
  const R = RIGHT_W - inset
  return [
    [0, top + inset],
    [TOP_W - inset * 0.6, top + 2 + inset],
    [R * 0.68, top + h * 0.36],
    [R * 0.9, top + h * 0.72 - lift * 0.4],
    [R + 2 - inset * 0.4, bot - lift - inset * 0.5],
    [R * 0.62, bot - lift * 0.3 - inset * 0.8],
    [0, bot - inset],
    [-L * 0.62, bot - inset * 0.8],
    [-L - inset * 0.4, bot - lift * 0.28 - inset * 0.5],
    [-L * 0.9, top + h * 0.72],
    [-L * 0.68, top + h * 0.36],
    [-TOP_W + inset * 0.6, top + 2 + inset],
  ]
}

const front: ItemArt = ({ c, sw, a, local, solo }) => {
  const { top, bot, lift } = capeOf({ a, local, solo })
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const shape = blob(outline(top, bot, lift), 0.8)
  // Guldborten langs kanten forneden (mellem kappens bund og en lidt højere bue).
  const hem = blob(
    [
      [RIGHT_W + 1.4, bot - lift - 0.6], [RIGHT_W * 0.62, bot - lift * 0.3 - 0.2], [0, bot - 0.2],
      [-LEFT_W * 0.62, bot - 0.2], [-LEFT_W - 1.2, bot - lift * 0.28 - 0.6],
      [-LEFT_W * 0.62 + 1, bot - 6.2], [0, bot - 6.4], [RIGHT_W * 0.62 - 1, bot - lift * 0.3 - 6.2],
    ],
    0.7,
  )
  return (
    <>
      <path d={shape} fill={c.main} {...stroke} />
      <path d={blob(outline(top, bot - 5, lift, 7), 0.8)} fill={c.mainShade} />
      <path d={hem} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={shape} fill="none" {...stroke} />
      <path d={join(ellipse(-LEFT_W * 0.86, top + (bot - top) * 0.62, 2.4, 10, 18), ellipse(RIGHT_W * 0.86, top + (bot - top) * 0.58, 2.2, 9, -20))} fill={c.highlight} />
      {solo && <Collar c={c} sw={sw} y={top + 4} />}
    </>
  )
}

/** Hagen ligger under halsleddet på arter med lang mule (og babyens hoved er relativt større). */
function chinDrop(a: AnchorSet, stage: Stage): number {
  const k = STAGE_XF[stage].head / STAGE_XF[stage].body
  return Math.max(0, a.mouth.y + 5 - a.neck.y) * k
}

/** Kraven over skuldrene og spændet med stjernen. */
function Collar({ c, sw, y }: { c: ItemArtProps['c']; sw: number; y: number }) {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <>
      <path d={softBand(-24, 24, y - 3.4, y + 3.4, 3.2, 3.2)} fill={c.main} {...stroke} />
      <path d={circle(0, y + 3.8, 7)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.85} />
      <path d={lune(0, y + 3.8, 7 - sw / 2, 7 - sw / 2, 1.6, -10, 100)} fill={c.trimShade} />
      <path d={star(0, y + 4.1, 4.8, 2, 5)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.4} strokeLinejoin="round" />
    </>
  )
}

/** Foran halsen (lag 9b): kraven og spændet, flyttet ned under hagen på arter med lang mule. */
const collar: ItemArt = ({ c, sw, a, local, stage }) => {
  const y = local({ x: a.neck.x, y: a.neck.y + chinDrop(a, stage) }).y + 3
  return <Collar c={c} sw={sw} y={y} />
}

export const milepaelKappe: ItemDef = {
  id: 'milepael-kappe',
  set: 'milepael',
  slot: 'back',
  nameClip: 'name.item.milepael-kappe',
  source: { kind: 'level', level: 15 },
  colorways: [
    fabric('helt', 'heltrød', 'tomato', 'sunflower', 'tomato'),
    fabric('nat', 'natblå', 'navy', 'sunflower', 'sky'),
    fabric('lilla', 'lilla', 'violet', 'mint', 'rose'),
  ],
  art: { front, back: collar },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 166 },
  reach: true,
  icon: { box: [-83, -48, 172, 96] },
}

export default milepaelKappe
