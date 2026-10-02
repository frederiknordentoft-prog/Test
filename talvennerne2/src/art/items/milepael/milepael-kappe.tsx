// Milepæl · ryg (niveau 15): superheltekappe. Kappen hænger bag kroppen (lag 2) fra skuldrene ned mod
// jorden og breder sig ud i en blød bue, så den ses på begge sider af kroppen og mellem fødderne; højre
// side løfter sig en anelse, som om vinden tager den. Forsiden viser kappens inderside i skygge med en
// smal kant af yderstoffet og en guldbort forneden. Halen, manken og pindsvinets pigge ligger foran den.
// Foran halsen (lag 9b, under hovedet) samles kappen af en krave og et rundt spænde med en stjerne. Højden
// regnes ud fra halsleddet og jordlinjen, så kappen passer alle tre kropsformer og stadier, og på stor
// (bredere krop) klemmes den vandret, så hjørnerne bliver i den sikre zone.
// (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { SAFE, STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, circle, ellipse, join, lune, poly, softBand, spline, star } from '../../rig/shapes'
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
function capeOf(p: Pick<ItemArtProps, 'a' | 'local'>) {
  const top = p.local(p.a.neck).y - 4
  const bot = p.local(p.a.ground).y - 7
  return { top, bot, lift: (bot - top) * 0.16 }
}

/**
 * Hvor bredt kappen må være (lokale enheder fra midten) for at holde sig i den sikre zone i stadiet (kroppen
 * og dermed kappen vokser på stor).
 */
function safeHalf(p: Pick<ItemArtProps, 'a' | 'local' | 'stage' | 'solo'>): number {
  const k = STAGE_XF[p.stage].fig * STAGE_XF[p.stage].body
  const model = (wx: number) => p.a.ground.x + (wx - p.a.ground.x) / k
  const l = p.local({ x: model(SAFE.x0 + 2.5), y: p.a.bodyCenter.y })
  const r = p.local({ x: model(SAFE.x1 - 2.5), y: p.a.bodyCenter.y })
  return Math.min(-l.x, r.x)
}

/** Kappens omrids: skuldrene, siderne der breder sig ud, og en blød bue forneden med flagrende hjørner. */
function outline(top: number, bot: number, lift: number, inset = 0, sx = 1): Vec[] {
  const h = bot - top
  const L = LEFT_W * sx - inset
  const R = RIGHT_W * sx - inset
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

const front: ItemArt = ({ c, sw, a, local, solo, stage, ids }) => {
  if (solo) return <SoloCape c={c} sw={sw} uid={ids.uid} />
  const { top, bot, lift } = capeOf({ a, local })
  // Kappen klemmes vandret, så hjørnerne bliver i den sikre zone (stor har en bredere krop).
  // (Det højre hjørne flagrer 2 enheder ud over bredden, og konturen og splinen lægger lidt til.)
  const sx = Math.min(1, (safeHalf({ a, local, stage, solo }) - 5.5) / RIGHT_W)
  const LW = LEFT_W * sx
  const RW = RIGHT_W * sx
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const shape = blob(outline(top, bot, lift, 0, sx), 0.8)
  // Guldborten langs kanten forneden (mellem kappens bund og en lidt højere bue).
  const hem = blob(
    [
      [RW + 1.4, bot - lift - 0.6], [RW * 0.62, bot - lift * 0.3 - 0.2], [0, bot - 0.2],
      [-LW * 0.62, bot - 0.2], [-LW - 1.2, bot - lift * 0.28 - 0.6],
      [-LW * 0.62 + 1, bot - 6.2], [0, bot - 6.4], [RW * 0.62 - 1, bot - lift * 0.3 - 6.2],
    ],
    0.7,
  )
  return (
    <>
      <path d={shape} fill={c.main} {...stroke} />
      <path d={blob(outline(top, bot - 5, lift, 7, sx), 0.8)} fill={c.mainShade} />
      <path d={hem} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={join(spline([[-LW * 0.22, top + 12], [-LW * 0.3, (top + bot) / 2], [-LW * 0.36, bot - 8]]), spline([[RW * 0.26, top + 12], [RW * 0.36, (top + bot) / 2], [RW * 0.44, bot - lift * 0.3 - 8]]))} fill="none" stroke={c.mainShade} strokeWidth={sw * 0.7} strokeLinecap="round" />
      <path d={shape} fill="none" {...stroke} />
      <path d={join(ellipse(-LW * 0.86, top + (bot - top) * 0.62, 2.4, 10, 18), ellipse(RW * 0.86, top + (bot - top) * 0.58, 2.2, 9, -20))} fill={c.highlight} />
    </>
  )
}

/**
 * Alene (butik): kappen blafrer i vinden. Kraven sidder oppe til venstre med stjernespændet, og stoffet
 * hænger ned og blæser ud til højre, hvor den frie kant slår tre bløde flige med guldbort. Folderne løber
 * fra kraven ud mod fligene, og stoffets underside skygger forneden.
 */
const SOLO_CAPE: Vec[] = [
  [-10, -41], [8, -43], [28, -40], [50, -32], [41, -20], [52, -7], [40, 3], [48, 17], [28, 25], [6, 31],
  [-16, 36], [-34, 39], [-38, 20], [-37, -4], [-33, -25], [-28, -39],
]
/** Guldborten følger den frie kant (fra den øverste flig rundt til hjørnet nede til venstre). */
const SOLO_HEM_ZONE: Vec[] = [
  [62, -40], [50, -32], [37, -21], [35, -6], [33, 8], [20, 16], [0, 22], [-20, 27], [-36, 40], [-60, 44],
  [-60, 70], [70, 70],
]
const SOLO_FOLDS: Vec[][] = [
  [[-14, -35], [12, -30], [40, -20]],
  [[-18, -33], [8, -12], [39, 3]],
  [[-24, -33], [-16, 0], [-4, 32]],
]
/** Stoffets underside forneden til venstre (skygge). */
const SOLO_SHADE: Vec[] = [[-40, 6], [-36, 34], [-14, 38], [14, 30], [-2, 26], [-20, 22], [-30, 8]]

function SoloCape({ c, sw, uid }: { c: ItemArtProps['c']; sw: number; uid: string }) {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const shape = blob(SOLO_CAPE, 0.62)
  const clip = `${uid}-kp`
  const zone = `${uid}-kz`
  // Borten: 4,6 enheder guld inden for konturen og en tynd mørk kant ind mod stoffet.
  const hem = sw + 9.2
  return (
    <>
      <path d={shape} fill={c.main} />
      <clipPath id={clip}>
        <path d={shape} />
      </clipPath>
      <clipPath id={zone}>
        <path d={poly(SOLO_HEM_ZONE)} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={blob(SOLO_SHADE, 0.7)} fill={c.mainShade} />
        <path d={join(...SOLO_FOLDS.map((f) => spline(f)))} fill="none" stroke={c.mainShade} strokeWidth={sw * 1.1} strokeLinecap="round" />
        <g clipPath={`url(#${zone})`}>
          <path d={shape} fill="none" stroke={c.trimOutline} strokeWidth={hem + sw * 1.1} />
          <path d={shape} fill="none" stroke={c.trim} strokeWidth={hem} />
        </g>
      </g>
      <path d={shape} fill="none" {...stroke} />
      <path d={softBand(-36, -6, -45, -37, -1.6, -1.6)} fill={c.main} {...stroke} />
      <path d={circle(-21, -38, 7)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.85} />
      <path d={star(-21, -37.7, 4.8, 2, 5)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.4} strokeLinejoin="round" />
      <path d={join(ellipse(-31, -10, 2.4, 10, 4), ellipse(14, -36, 6, 1.8, 6))} fill={c.highlight} />
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
  icon: { box: [-42, -49, 97, 92] },
}

export default milepaelKappe
