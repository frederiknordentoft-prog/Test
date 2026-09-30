// Hverdag · krop: stribet trøje med ribkant og krave. Kropstøj klippes af riggen til artens krop
// udvidet 2 enheder (fit-regel 3); trøjen streger selv kroppens kontur igen over sit eget område.
// Én parametrisk tegning giver de 3 grundformer (round/pear/tall), så hals og hofte sidder rigtigt.
import { fabric } from '../../rig/palette'
import { band, blob, ellipse, join, outside, rect, ribs, symmetric } from '../../rig/shapes'
import type { BodyKind, ItemArt, ItemDef } from '../../rig/types'

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

/** Trøjen lagt fladt (ikon uden bærer): krop, ærmer og halsudskæring. Venstre halvdel. */
const FLAT = blob(
  symmetric([[0, -34], [-12, -40], [-29, -37.5], [-44, -29], [-57.5, -9], [-48.5, -1], [-35, -13], [-36.5, 19.5], [0, 21]]),
  0.5,
)

const sweater = (kind: BodyKind): ItemArt => ({ c, sw, ids, restroke, solo }) => {
  const k = CUTS[kind]
  const clip = `${ids.uid}-hv-${kind}`
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  // Skyggen: alt uden for en lys ellipse forskudt op mod venstre (riggen klipper til kroppen).
  const lit = ellipse(-8, -12, 51, 47.5)
  if (solo) {
    const flat = `${ids.uid}-hv-flat`
    return (
      <>
        <defs>
          <clipPath id={flat}>
            <path d={FLAT} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${flat})`}>
          <path d={rect(-80, -80, 160, 160)} fill={c.main} />
          <path d={join(...k.stripes.map((y) => rect(-80, y, 160, 5.5)))} fill={c.trim} />
          <path d={outside(ellipse(-10, -16, 50, 42))} fill={c.mainShade} fillRule="evenodd" />
          <path d={band(-80, 80, 12, 30, 0)} fill={c.accent} {...stroke} />
          <path d={ribs(-36, 36, 14, 22, 12, 0)} fill="none" stroke={c.accentShade} strokeWidth={sw * 0.5} strokeLinecap="round" />
        </g>
        <path d={band(-13, 13, -40, -37, 6, 7)} fill={c.accent} {...stroke} />
        <path d={FLAT} fill="none" {...stroke} />
      </>
    )
  }
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d={rect(-90, -90, 180, 90 + (k.hemTop + k.hemBottom) / 2)} />
        </clipPath>
      </defs>
      <path d={rect(-80, -80, 160, 80 + k.hemTop + 2)} fill={c.main} />
      <path d={join(...k.stripes.map((y) => rect(-80, y, 160, 5.5)))} fill={c.trim} />
      <g clipPath={`url(#${clip})`}>
        <path d={outside(lit)} fill={c.mainShade} fillRule="evenodd" />
        {restroke()}
      </g>
      <path d={band(-80, 80, k.hemTop, k.hemBottom, 1.5)} fill={c.accent} {...stroke} />
      <path d={ribs(-60, 60, k.hemTop + 2, k.hemBottom - 2, 16, 1.5)} fill="none" stroke={c.accentShade} strokeWidth={sw * 0.5} strokeLinecap="round" />
      <path d={band(-27, 27, k.collar - 5, k.collar - 5, 4, 9)} fill={c.accent} {...stroke} />
      <path d={join(ellipse(-26, -14, 8, 4.2, -35))} fill={c.highlight} />
    </>
  )
}

export const hverdagBody: ItemDef = {
  id: 'hverdag-body',
  set: 'hverdag',
  slot: 'body',
  nameClip: 'item.hverdag-body',
  source: { kind: 'level', level: 3 },
  colorways: [
    fabric('himmel', 'himmelblå', 'sky', 'snow', 'navy'),
    fabric('koral', 'koral', 'coral', 'cream', 'tomato'),
    fabric('mint', 'mintgrøn', 'mint', 'snow', 'teal'),
  ],
  art: { front: sweater('round'), bodyShapes: { round: sweater('round'), pear: sweater('pear'), tall: sweater('tall') } },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 100 },
}

export default hverdagBody
