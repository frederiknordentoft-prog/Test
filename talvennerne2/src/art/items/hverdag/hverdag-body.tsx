// Hverdag · krop: stribet trøje med ærmer, ribkant og krave. Kropstøj klippes af riggen til artens
// krop (konturen/2 udenfor), og trøjen streger selv kroppens kontur igen over sit eget område, så
// ribkantens ender gemmer sig under konturen (review G0-r1, fund 2). Striberne og ribkanten krummer
// med kroppen; babyens korte torso får ribkanten højere oppe. Ærmerne tegnes på armene med striber
// og en ribmanchet over poten. Én parametrisk tegning giver de 3 grundformer (round/pear/tall).
import { fabric } from '../../rig/palette'
import { band, blob, ellipse, join, outside, rect, ribs, softBand, symmetric } from '../../rig/shapes'
import type { BodyKind, ItemArt, ItemDef, SleeveArt, SleeveUpArt } from '../../rig/types'

interface Cut {
  /** Kravens y (lokalt, (0,0) = bodyCenter) og ribkantens top/bund. */
  collar: number
  hemTop: number
  hemBottom: number
  /** Striber: y for top af hver stribe. */
  stripes: readonly number[]
}

const CUTS: Record<BodyKind, Cut> = {
  round: { collar: -36, hemTop: 9, hemBottom: 19, stripes: [-19, -6] },
  pear: { collar: -34, hemTop: 12, hemBottom: 22, stripes: [-17, -4] },
  tall: { collar: -40, hemTop: 6, hemBottom: 16, stripes: [-24, -11] },
}
/** Hvor meget striber og ribkant buer nedad midtpå (kroppens rundning set forfra). */
const SAG = 2.6
/** Hvor meget en stribe (`band` fra x −80 til 80) hænger ned ved x. */
const sagAt = (x: number) => {
  const t = Math.min(1, Math.max(0, (x + 80) / 160))
  return 4 * SAG * t * (1 - t)
}
/** Babyens torso er kortere: ribkanten sidder højere. */
const BABY_LIFT = 7

/** Trøjen lagt fladt (ikon uden bærer): krop, ærmer og halsudskæring. Venstre halvdel. */
const FLAT = blob(
  symmetric([[0, -34], [-12, -40], [-29, -37.5], [-44, -29], [-57.5, -9], [-48.5, -1], [-35, -13], [-36.5, 19.5], [0, 21]]),
  0.5,
)

const sweater = (kind: BodyKind): ItemArt => ({ c, sw, ids, restroke, solo, stage }) => {
  const k = CUTS[kind]
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  // Skyggen: alt uden for en lys ellipse forskudt op mod venstre (riggen klipper til kroppen).
  const lit = ellipse(-8, -12, 51, 47.5)
  if (solo) {
    const flat = `${ids.uid}-hv-flat`
    return (
      <>
        <clipPath id={flat}>
          <path d={FLAT} />
        </clipPath>
        <g clipPath={`url(#${flat})`}>
          <path d={rect(-80, -80, 160, 160)} fill={c.main} />
          <path d={join(...k.stripes.map((y) => band(-80, 80, y, y + 5.5, SAG)))} fill={c.trim} />
          <path d={outside(ellipse(-10, -16, 50, 42))} fill={c.mainShade} fillRule="evenodd" />
          <path d={band(-80, 80, 12, 30, 0)} fill={c.accent} {...stroke} />
          <path d={ribs(-36, 36, 14, 22, 12, 0)} fill="none" stroke={c.accentShade} strokeWidth={sw * 0.5} strokeLinecap="round" />
        </g>
        <path d={band(-13, 13, -40, -37, 6, 7)} fill={c.accent} {...stroke} />
        <path d={FLAT} fill="none" {...stroke} />
      </>
    )
  }
  const lift = stage === 1 ? BABY_LIFT : 0
  const hemTop = k.hemTop - lift
  const hemBottom = k.hemBottom - lift
  const clip = `${ids.uid}-hv-${kind}`
  return (
    <>
      <clipPath id={clip}>
        <path d={band(-90, 90, -90, hemBottom + sw / 2 + 0.2, 0, SAG)} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={rect(-80, -80, 160, 120)} fill={c.main} />
        <path d={join(...k.stripes.map((y) => band(-80, 80, y - lift, y - lift + 5.5, SAG)))} fill={c.trim} />
        <path d={outside(lit)} fill={c.mainShade} fillRule="evenodd" />
        <path d={band(-80, 80, hemTop, hemBottom, SAG)} fill={c.accent} {...stroke} />
        <path d={ribs(-60, 60, hemTop + 2, hemBottom - 2, 16, SAG)} fill="none" stroke={c.accentShade} strokeWidth={sw * 0.5} strokeLinecap="round" />
        {restroke()}
      </g>
      <path d={band(-27, 27, k.collar - 5, k.collar - 5, 4, 9)} fill={c.accent} {...stroke} />
    </>
  )
}

/**
 * Ærmet: trøjens farve med to striber og en ribmanchet over poten. Et langt ærme (lodrette forben, review
 * G1-r4, T5) har trøjens striber i samme højde som på kroppen og er åbent foroven.
 */
const sleeve: SleeveArt = ({ c, sw, sleeve: d, cuff, clipId, long, body, stage }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const y0 = cuff.y
  if (long) {
    const lift = stage === 1 ? BABY_LIFT : 0
    // Trøjens striber i armens ramme: samme højde som på kroppen (med kroppens bue ved skulderleddet).
    const y = (v: number) => long.s * (v + sagAt(long.origin.x) - long.origin.y)
    const stripes = join(...CUTS[body].stripes.map((t) => rect(-30, y(t - lift), 60, 5.5 * long.s)))
    return (
      <>
        <path d={long.d} fill={c.main} {...stroke} />
        <path d={stripes} fill={c.trim} clipPath={`url(#${clipId})`} />
        <path d={softBand(-cuff.half + 2.6, cuff.half - 2.6, y0 - 2.6, y0 + 2.8, 1.8, 1.8)} fill={c.accent} {...stroke} />
      </>
    )
  }
  return (
    <>
      <path d={d} fill={c.main} {...stroke} />
      <path d={join(rect(-20, y0 - 15, 40, 3.6), rect(-20, y0 - 7.6, 40, 3.6))} fill={c.trim} clipPath={`url(#${clipId})`} />
      {/* Manchetten buer med armens rundning (review G1-r2, H6). */}
      <path d={softBand(-cuff.half + 2.6, cuff.half - 2.6, y0 - 2.6, y0 + 2.8, 1.8, 1.8)} fill={c.accent} {...stroke} />
    </>
  )
}

/** Ærmet på en løftet arm (riggen regner formen ud langs armen): samme stof, striber og manchet. */
const sleeveUp: SleeveUpArt = ({ c, sw, fill, edge, bands, cuff }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <>
      <path d={fill} fill={c.main} />
      {bands && <path d={bands} fill={c.trim} />}
      <path d={edge} fill="none" {...stroke} />
      <path d={cuff} fill={c.accent} {...stroke} />
    </>
  )
}

export const hverdagBody: ItemDef = {
  id: 'hverdag-body',
  set: 'hverdag',
  slot: 'body',
  nameClip: 'name.item.hverdag-body',
  source: { kind: 'level', level: 4 },
  colorways: [
    fabric('himmel', 'himmelblå', 'sky', 'snow', 'navy'),
    fabric('koral', 'koral', 'coral', 'cream', 'tomato'),
    fabric('mint', 'mintgrøn', 'mint', 'snow', 'teal'),
  ],
  art: {
    front: sweater('round'),
    bodyShapes: { round: sweater('round'), pear: sweater('pear'), tall: sweater('tall') },
    sleeve,
    sleeveUp,
  },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [-60, -42, 120, 64] },
}

export default hverdagBody
