// Kongelig · krop: en festdragt (gallajakke) i fløjl med en høj guldkrave, en guldborte ned midt foran
// med tre snorelukninger, et ordensbånd skråt over brystet med en stjerne og en guldbort forneden.
// Kropstøj klippes af riggen til artens krop (konturen/2 udenfor); dragten klipper sig selv til sin længde
// og streger kroppens kontur igen inden for den, så pelsen ses under kanten. Lange ærmer starter ved
// skulderen og ender i en guldmanchet over poten (review G1-r4, T5); på løftede arme følger ærmet armen
// fra skulderen. Babyens korte torso får kanten og lukningerne højere oppe. Én parametrisk tegning giver
// de 3 grundformer (round/pear/tall). (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { fabric } from '../../rig/palette'
import { band, blob, capsule, ellipse, join, outside, rect, ribbon, softBand, star, symmetric } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { BodyKind, ItemArt, ItemDef, SleeveArt, SleeveUpArt } from '../../rig/types'

interface Cut {
  /** Halsudskæringens y (lokalt) og dragtens kant (hoften). */
  collar: number
  hem: number
}

const CUTS: Record<BodyKind, Cut> = {
  round: { collar: -36, hem: 19 },
  pear: { collar: -34, hem: 22 },
  tall: { collar: -40, hem: 16 },
}
/** Babyens torso er kortere: kanten og lukningerne sidder højere. */
const BABY_LIFT = 7
/** Kanten buer nedad midtpå (kroppens rundning set forfra). */
const SAG = 2.6

/** Guldborten midt foran med snorelukninger, ordensbåndet og stjernen ud fra halsen og kanten. */
function details(collar: number, hem: number) {
  const frogs = [10, 19, 28].map((dy) => capsule([-10.5, collar + dy], [10.5, collar + dy], 1.9))
  const sash: Vec[] = [[-44, collar + 2], [-12, (collar + hem) / 2 - 8], [12, hem - 14], [44, hem + 4]]
  return {
    braid: join(rect(-3.4, collar - 6, 6.8, hem - collar + 10, 1.6), ...frogs),
    sash: blob(ribbon(sash, 11.5), 0.5),
    star: star(-21, collar + 17.5, 6.4, 2.4, 5, -12),
  }
}

/** Dragten lagt fladt (ikon uden bærer): krop, lange ærmer, der hænger let ud til siden, og skøder. */
const FLAT = blob(
  symmetric([
    [0, -37], [-12.5, -41], [-28, -38.5], [-42, -30.5], [-52.5, -9], [-58, 15], [-46.5, 18.5], [-39.5, -5],
    [-40, 25], [-20, 27.5], [0, 28],
  ]),
  0.45,
)

const tunic = (kind: BodyKind): ItemArt => ({ c, sw, ids, restroke, solo, stage }) => {
  const k = CUTS[kind]
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const lift = !solo && stage === 1 ? BABY_LIFT : 0
  const collar = solo ? -37 : k.collar
  const hem = solo ? 26 : k.hem - lift
  const d = details(collar, hem)
  const clip = `${ids.uid}-kd-${solo ? 'flat' : kind}`
  // Skyggen: alt uden for en lys ellipse forskudt op mod venstre (riggen klipper til kroppen).
  const lit = ellipse(-8, -12, 51, 47.5)
  return (
    <>
      <clipPath id={clip}>
        <path d={solo ? FLAT : band(-90, 90, -90, hem + sw / 2 + 0.2, 0, SAG)} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={rect(-80, -80, 160, 130)} fill={c.main} />
        <path d={outside(lit)} fill={c.mainShade} fillRule="evenodd" />
        <path d={d.braid} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
        <path d={d.sash} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw} strokeLinejoin="round" />
        {/* Guldbort forneden og stjernen på ordensbåndet (samme guld og kontur, én sti). */}
        <path d={join(band(-80, 80, hem - 5.5, hem, SAG), d.star)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
        {!solo && restroke()}
      </g>
      {solo && <path d={FLAT} fill="none" {...stroke} />}
      <path d={band(-17, 17, collar - 7, collar - 6, 3, 6)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
    </>
  )
}

/** Ærmet: dragtens fløjl og en guldmanchet over poten (et langt ærme følger forbenet fra skulderen). */
const sleeve: SleeveArt = ({ c, sw, sleeve: d, cuff, long }) => {
  const y0 = cuff.y
  return (
    <>
      <path d={long ? long.d : d} fill={c.main} stroke={c.outline} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
      <path d={softBand(-cuff.half + 2.6, cuff.half - 2.6, y0 - 3, y0 + 3, 1.8, 1.8)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
    </>
  )
}

/** Ærmet på en løftet arm (riggen regner formen ud langs armen): samme fløjl og guldmanchet. */
const sleeveUp: SleeveUpArt = ({ c, sw, fill, edge, cuff }) => (
  <>
    <path d={fill} fill={c.main} />
    <path d={edge} fill="none" stroke={c.outline} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
    <path d={cuff} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
  </>
)

export const kongeligBody: ItemDef = {
  id: 'kongelig-body',
  set: 'kongelig',
  slot: 'body',
  nameClip: 'name.item.kongelig-body',
  source: { kind: 'finale', world: 'skov' },
  colorways: [
    fabric('kongeblaa', 'kongeblå', 'navy', 'gold', 'tomato'),
    fabric('purpur', 'purpur', 'berry', 'gold', 'sky'),
    fabric('smaragd', 'smaragd', 'teal', 'silver', 'rose'),
  ],
  art: {
    front: tunic('round'),
    bodyShapes: { round: tunic('round'), pear: tunic('pear'), tall: tunic('tall') },
    sleeve,
    sleeveUp,
  },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [-61, -45, 122, 75] },
}

export default kongeligBody
