// Pirat · krop: en stribet sømandstrøje med bredere striber end Hverdags trøje, et snøret V i halsen og en
// glat kant ved hoften. Kropstøj klippes af riggen til artens krop (konturen/2 udenfor); trøjen klipper sig
// selv ved kanten og streger kroppens kontur igen inden for sit eget område. Striberne krummer med kroppen.
// Ærmerne er stribede hele vejen ned til en glat manchet over poten – på hvilende arme (riggens ærmeform)
// og på løftede arme (riggens bøjede ærme med striber), så de følger armene i alle poser. Babyens korte
// torso får kanten højere oppe. Én parametrisk tegning giver de 3 grundformer (round/pear/tall).
// (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { fabric } from '../../rig/palette'
import { band, blob, ellipse, join, line, outside, rect, softBand, symmetric } from '../../rig/shapes'
import type { BodyKind, ItemArt, ItemDef, SleeveArt, SleeveUpArt } from '../../rig/types'

interface Cut {
  /** V'ets top (kravens y), dets bund og kantens top/bund. */
  collar: number
  vBottom: number
  hemTop: number
  hemBottom: number
}
const CUTS: Record<BodyKind, Cut> = {
  round: { collar: -40, vBottom: -24, hemTop: 11, hemBottom: 19 },
  pear: { collar: -38, vBottom: -22, hemTop: 14, hemBottom: 22 },
  tall: { collar: -44, vBottom: -28, hemTop: 8, hemBottom: 16 },
}
/** Striberne: y for toppen af hver stribe (fra brystet ned), 7 enheder brede. */
const STRIPES = [-30, -16, -2]
const STRIPE_H = 7
const SAG = 2.6
const BABY_LIFT = 7

/** Trøjen lagt fladt (ikon uden bærer): krop og ærmer. Venstre halvdel. */
const FLAT = blob(
  symmetric([[0, -34], [-12, -40], [-29, -37.5], [-44, -29], [-57.5, -9], [-48.5, -1], [-35, -13], [-36.5, 19.5], [0, 21]]),
  0.5,
)

const shirt = (kind: BodyKind): ItemArt => ({ c, sw, ids, restroke, solo, stage }) => {
  const k = CUTS[kind]
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const lift = !solo && stage === 1 ? BABY_LIFT : 0
  const hemTop = solo ? 12 : k.hemTop - lift
  const hemBottom = solo ? 21 : k.hemBottom - lift
  const clip = `${ids.uid}-pb-${solo ? 'flat' : kind}`
  const lit = ellipse(-8, -12, 51, 47.5)
  const collar = solo ? -38 : k.collar
  const vb = solo ? -22 : k.vBottom
  // Det snørede V: hudfarvet (åbent) er ikke muligt i tøjlaget, så V'et er en mørk kile med snøre på kryds.
  const vee = blob([[-9, collar], [0, vb], [9, collar]], 0.4)
  const laces = join(line([-4.6, collar + 4], [3, collar + 9]), line([4.6, collar + 4], [-3, collar + 9]), line([-2.6, collar + 10], [2.2, vb - 2]))
  return (
    <>
      <clipPath id={clip}>
        <path d={solo ? FLAT : band(-90, 90, -90, hemBottom + sw / 2 + 0.2, 0, SAG)} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={rect(-80, -80, 160, 120)} fill={c.main} />
        <path d={join(...STRIPES.map((y) => band(-80, 80, y - lift, y - lift + STRIPE_H, SAG)))} fill={c.trim} />
        <path d={outside(lit)} fill={c.ink} fillRule="evenodd" opacity={0.12} />
        <path d={band(-80, 80, hemTop, hemBottom + 4, SAG)} fill={c.main} {...stroke} />
        {!solo && restroke()}
      </g>
      {solo && <path d={FLAT} fill="none" {...stroke} />}
      <path d={vee} fill={c.mainShade} {...stroke} />
      <path d={laces} fill="none" stroke={c.accent} strokeWidth={sw * 0.6} strokeLinecap="round" />
    </>
  )
}

/** Ærmet: stribet hele vejen ned (striberne klippes til ærmets form) og en glat manchet over poten. */
const sleeve: SleeveArt = ({ c, sw, sleeve: d, cuff, clipId, long, stage }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const y0 = cuff.y
  // Langt ærme (lodrette forben, review G1-r4, T5): trøjens striber i samme højde og åbent foroven.
  if (long) {
    const lift = stage === 1 ? BABY_LIFT : 0
    // Trøjens striber i armens ramme: samme højde som på kroppen (med kroppens bue ved skulderleddet).
    const t = Math.min(1, Math.max(0, (long.origin.x + 80) / 160))
    const y = (v: number) => long.s * (v + 4 * SAG * t * (1 - t) - long.origin.y)
    return (
      <>
        <path d={long.d} fill={c.main} {...stroke} />
        <path d={join(...STRIPES.map((v) => rect(-30, y(v - lift), 60, STRIPE_H * long.s)))} fill={c.trim} clipPath={`url(#${clipId})`} />
        <path d={softBand(-cuff.half + 2.6, cuff.half - 2.6, y0 - 2.6, y0 + 2.8, 1.8, 1.8)} fill={c.main} {...stroke} />
      </>
    )
  }
  return (
    <>
      <path d={d} fill={c.main} {...stroke} />
      <path d={join(rect(-20, y0 - 22, 40, 5), rect(-20, y0 - 11, 40, 5))} fill={c.trim} clipPath={`url(#${clipId})`} />
      <path d={softBand(-cuff.half + 2.6, cuff.half - 2.6, y0 - 2.6, y0 + 2.8, 1.8, 1.8)} fill={c.main} {...stroke} />
    </>
  )
}

/** Ærmet på en løftet arm (riggen regner formen ud langs armen): samme striber og en glat manchet. */
const sleeveUp: SleeveUpArt = ({ c, sw, fill, edge, bands, cuff }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <>
      <path d={fill} fill={c.main} />
      {bands && <path d={bands} fill={c.trim} />}
      <path d={edge} fill="none" {...stroke} />
      <path d={cuff} fill={c.main} {...stroke} />
    </>
  )
}

export const piratBody: ItemDef = {
  id: 'pirat-body',
  set: 'pirat',
  slot: 'body',
  nameClip: 'name.item.pirat-body',
  source: { kind: 'shop', price: 180 },
  colorways: [
    fabric('roed', 'rød-hvid', 'snow', 'tomato', 'charcoal'),
    fabric('blaa', 'blå-hvid', 'snow', 'navy', 'tomato'),
    fabric('sort', 'sort-gul', 'charcoal', 'sunflower', 'tomato'),
  ],
  art: {
    front: shirt('round'),
    bodyShapes: { round: shirt('round'), pear: shirt('pear'), tall: shirt('tall') },
    sleeve,
    sleeveUp,
  },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [-60, -42, 120, 64] },
}

export default piratBody
