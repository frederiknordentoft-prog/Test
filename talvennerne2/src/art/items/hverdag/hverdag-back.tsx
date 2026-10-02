// Hverdag · ryg: en rygsæk. Selve sækken ligger bag kroppen (lag 2) og er bredere end kroppen, så dens
// sider, sidelommer og øverste hjørner ses ved skuldrene; halen ligger foran den. Stropperne tegnes i
// stroplaget (6b: over kroppen og kropstøjet, under poterne og halsgenstanden), så de går ned over
// brystet og ind under armene. De klippes til kroppen (riggens kropskontur bruges som klip), så de
// forsvinder rundt om kroppens side, og et brystbånd med spænde samler dem. Alene (butik) ses sækken
// forfra med frontlomme, lynlås og bærehank. (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { fabric } from '../../rig/palette'
import { blob, ellipse, join, lune, rect, ribbon, spline, symmetric } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { BodyKind, ItemArt, ItemDef } from '../../rig/types'

/** Sækken bag kroppen (venstre halvdel, top → bund på midterlinjen). */
const BAG = symmetric([[0, -44], [-30, -43], [-50, -38], [-57, -24], [-58, 6], [-55.5, 22], [-43, 28], [0, 29]])
/** Sidelommerne: buttede lommer ud over sækkens sider forneden (inden for silhuetten + 6 på alle arter). */
const SIDE_POCKETS = join(
  blob([[-53.5, -4], [-61, -2], [-63.5, 10], [-61, 21], [-53.5, 23], [-50, 10]], 0.9),
  blob([[53.5, -4], [61, -2], [63.5, 10], [61, 21], [53.5, 23], [50, 10]], 0.9),
)
const POCKET_SEAMS = join(spline([[-57, 4], [-61.5, 5.5]]), spline([[57, 4], [61.5, 5.5]]))

/** Alene (butik): en højere sæk forfra med hank, sidelommer og stropperne, der buer ud i siderne. */
const SOLO_BAG = symmetric([[0, -48], [-22, -47], [-35, -39], [-40, -20], [-40, 18], [-36, 29], [-22, 33], [0, 33.5]])
const SOLO_POCKETS = join(
  blob([[-38, 0], [-46, 2], [-48, 14], [-45, 26], [-37, 27], [-35, 12]], 0.9),
  blob([[38, 0], [46, 2], [48, 14], [45, 26], [37, 27], [35, 12]], 0.9),
)
const SOLO_HANDLE = spline([[-11, -46], [-9, -56], [0, -58.5], [9, -56], [11, -46]])
const SOLO_STRAPS = join(spline([[-27, -43], [-47, -26], [-50, 2], [-41, 26]]), spline([[27, -43], [47, -26], [50, 2], [41, 26]]))

/** Stropperne (rygrad pr. kropsform): fra skulderen under hagen, ned over brystet og ud under armen. */
const STRAP: Record<BodyKind, Vec[]> = {
  round: [[-15, -56], [-19, -38], [-27, -20], [-38, -4], [-52, 8]],
  pear: [[-15, -52], [-20, -35], [-29, -18], [-41, -3], [-56, 8]],
  tall: [[-13, -62], [-16, -44], [-22, -26], [-31, -10], [-46, 6]],
}
const STRAP_W = 8.4
/** Brystbåndets højde (andel af rygraden) pr. kropsform. */
const CHEST: Record<BodyKind, number> = { round: -25, pear: -22, tall: -30 }

const strapPts = (kind: BodyKind, side: 1 | -1): Vec[] => STRAP[kind].map(([x, y]) => [side * x, y] as Vec)
const strapPath = (kind: BodyKind, side: 1 | -1) => blob(ribbon(strapPts(kind, side), STRAP_W), 0.55)

/** Stroppens x på højden y (lineært mellem rygradens punkter). */
function strapX(kind: BodyKind, y: number): number {
  const s = STRAP[kind]
  for (let i = 0; i < s.length - 1; i++) {
    const [x0, y0] = s[i]
    const [x1, y1] = s[i + 1]
    if (y >= y0 && y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0)
  }
  return s[s.length - 1][0]
}

const bag: ItemArt = ({ c, sw, solo }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  if (solo) {
    // Forfra: en høj sæk med bærehank, frontlomme med lynlås, sidelommer og stropperne i siderne.
    return (
      <>
        <path d={SOLO_STRAPS} fill="none" stroke={c.outline} strokeWidth={sw * 2.6} strokeLinecap="round" />
        <path d={SOLO_STRAPS} fill="none" stroke={c.mainShade} strokeWidth={sw * 1.3} strokeLinecap="round" />
        <path d={SOLO_HANDLE} fill="none" stroke={c.outline} strokeWidth={sw * 2.3} strokeLinecap="round" />
        <path d={SOLO_HANDLE} fill="none" stroke={c.main} strokeWidth={sw * 1.1} strokeLinecap="round" />
        <path d={SOLO_POCKETS} fill={c.trim} {...stroke} />
        <path d={blob(SOLO_BAG, 0.7)} fill={c.main} {...stroke} />
        <path d={lune(0, -6, 36, 36, 4, -5, 100)} fill={c.mainShade} />
        <path d={rect(-25, 4, 50, 24, 8)} fill={c.trim} {...stroke} />
        <path d={spline([[-20, 10.5], [0, 12.5], [20, 10.5]])} fill="none" stroke={c.trimOutline} strokeWidth={sw * 0.6} strokeLinecap="round" />
        <path d={spline([[-30, -24], [0, -29], [30, -24]])} fill="none" stroke={c.outline} strokeWidth={sw * 0.6} strokeLinecap="round" />
        <path d={join(rect(-2.8, 10, 5.6, 8.5, 2.2), rect(19, -28.5, 4.6, 7, 1.8))} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.6} />
        <path d={ellipse(-21, -36, 6.5, 3.2, -28)} fill={c.highlight} />
      </>
    )
  }
  return (
    <>
      <path d={SIDE_POCKETS} fill={c.trim} {...stroke} />
      <path d={POCKET_SEAMS} fill="none" stroke={c.trimOutline} strokeWidth={sw * 0.55} strokeLinecap="round" />
      <path d={blob(BAG, 0.55)} fill={c.main} {...stroke} />
      <path d={lune(0, -7, 58, 35, 4.5, -5, 100)} fill={c.mainShade} />
      <path d={ellipse(-50, -30, 4.5, 2.6, -30)} fill={c.highlight} />
    </>
  )
}

/** Stropperne og brystbåndet, klippet til kroppen (de går rundt om kroppens sider). */
const straps: ItemArt = ({ c, sw, ids, restroke, body: kind }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const clip = `${ids.uid}-rs-${kind}`
  const y = CHEST[kind]
  const xl = strapX(kind, y)
  const buckleY = y + 13
  const bx = strapX(kind, buckleY)
  return (
    <>
      <clipPath id={clip}>{restroke()}</clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={join(strapPath(kind, -1), strapPath(kind, 1))} fill={c.main} {...stroke} />
        <path d={join(rect(xl, y - 2.3, -2 * xl, 4.6, 2))} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.75} strokeLinejoin="round" />
        <path
          d={join(rect(-5, y - 4, 10, 8, 2.6), rect(bx - 5.4, buckleY - 2.8, 10.8, 5.6, 1.8), rect(-bx - 5.4, buckleY - 2.8, 10.8, 5.6, 1.8))}
          fill={c.accent}
          stroke={c.accentOutline}
          strokeWidth={sw * 0.6}
          strokeLinejoin="round"
        />
      </g>
    </>
  )
}

export const hverdagBack: ItemDef = {
  id: 'hverdag-back',
  set: 'hverdag',
  slot: 'back',
  nameClip: 'name.item.hverdag-back',
  source: { kind: 'level', level: 8 },
  colorways: [
    fabric('havgroen', 'havgrøn', 'teal', 'sunflower', 'tomato'),
    fabric('koral', 'koral', 'coral', 'cream', 'sky'),
    fabric('lilla', 'lilla', 'lilac', 'violet', 'sunflower'),
  ],
  art: {
    front: bag,
    straps,
  },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 120 },
  icon: { box: [-54, -61, 108, 96] },
}

export default hverdagBack
