// Kongelig · ansigt: en monokel over det ene øje med klart glas (review G1-r4: briller sidder på øjnene
// med klare glas). Den runde ramme omslutter øjet med luft til, at pupillen kan kigge rundt og det lukkede
// øjes vipper går fri, så rammen aldrig dækker øjet (fit-regel 6); glasset er klart i alle farvesæt (en
// svag, neutral tone på 14 %, så øjet bag glasset beholder artens egen irisfarve; review G2-r1, T13) med et
// hvidt højlys i det øverste ydre hjørne uden for øjet. Fra rammens yderside hænger en perlekæde i en blød
// bue ned langs kinden til hovedets side. Alt regnes ud fra bærerens øjenankre og stadiets øjenskala
// (babyens øjne er større). Alene (butik, review G2-r1, B10) er monoklen sin egen genstand og ikke en lup:
// et lille, let skråt glas i en tynd ring med højlys og en tynd perlekæde, der går i en lang bue ud af kortet.
import { STAGE_XF } from '../../rig/anchors'
import { FABRIC, WHITE, fabric } from '../../rig/palette'
import { circle, ellipse, join, poly, spline } from '../../rig/shapes'
import type { ItemArt, ItemArtProps, ItemDef } from '../../rig/types'

/** Glassets tone på dyret: klart og neutralt (højst ca. 20 %), så øjets farve aldrig skifter. */
const TINT = 0.14
/** Alene: et lyst, køligt glas, så ikonet læses som glas (det samme i alle farvesæt). */
const SOLO_GLASS = FABRIC.sky
const SOLO_TINT = 0.32

const round = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

/** Alene i butikken: lille skråt glas, tynd ring, højlys og en tynd kæde i en bue ud af kortet. */
function Solo({ c, sw }: Pick<ItemArtProps, 'c' | 'sw'>) {
  const cx = 21
  const cy = 0
  const rx = 12
  const ry = 13.2
  const rot = -16
  const lens = ellipse(cx, cy, rx, ry, rot)
  const t = (rot * Math.PI) / 180
  const at = (deg: number, k = 1): [number, number] => {
    const u = (deg * Math.PI) / 180
    const x = Math.cos(u) * rx * k
    const y = Math.sin(u) * ry * k
    return [cx + x * Math.cos(t) - y * Math.sin(t), cy + x * Math.sin(t) + y * Math.cos(t)]
  }
  const [sx, sy] = at(62, 1.06)
  // Kæden: ned fra ringens nederste yderside og i en lang, slap bue ud over kortets nederste højre kant.
  const chain = spline([[sx, sy], [sx + 1.5, sy + 9], [sx + 9, sy + 17.5], [sx + 21, sy + 19], [sx + 33, sy + 13]])
  const glare = join(
    poly([at(-128, 0.8), at(-100, 0.84), at(-96, 0.62), at(-122, 0.58)]),
    circle(...at(120, 0.58), 1.3),
  )
  const beads = `0.1 ${(sw * 1.05).toFixed(2)}`
  return (
    <>
      <path d={chain} fill="none" stroke={c.outline} strokeWidth={sw * 1.05} strokeDasharray={beads} {...round} />
      <path d={chain} fill="none" stroke={c.main} strokeWidth={sw * 0.5} strokeDasharray={beads} {...round} />
      <path d={lens} fill={SOLO_GLASS} opacity={SOLO_TINT} />
      <path d={glare} fill={c.highlight === 'none' ? 'none' : WHITE} opacity={0.9} />
      <path d={lens} fill="none" stroke={c.outline} strokeWidth={sw * 1.45} />
      <path d={lens} fill="none" stroke={c.main} strokeWidth={sw * 0.62} />
      <path d={circle(sx, sy, 1.7)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.4} />
    </>
  )
}

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  if (solo) return <Solo c={c} sw={sw} />
  const es = STAGE_XF[stage].eye
  const L = local(a.eyeL)
  const E = local(a.eyeR)
  // Modelenheder → lokale (genstanden er skaleret med hovedbredden).
  const k = Math.hypot(E.x - L.x, E.y - L.y) / Math.hypot(a.eyeR.x - a.eyeL.x, a.eyeR.y - a.eyeL.y)
  const erx = a.eyeRx * es * k
  const ery = a.eyeRy * es * k
  // Glasenheden: øjet (det lukkede øjes vipper er 1,3 · øjets bredde) plus luft plus en halv rammebredde.
  const half = sw * 1.05
  const ux = Math.max(erx + 2.2 * k, erx * 1.3) + half
  const uy = ery + 1.6 * k + half
  // Rammen er skubbet en anelse ud mod siden: inderkanten ligger 1,1 enheder fra øjet, yderkanten 1,3, så
  // det lukkede øjes vipper (der svinger ud og op i ydersiden) altid ligger inde i glasset.
  const rx = ux * 1.2
  const ry = uy * 1.08
  const cx = E.x + ux * 0.1
  const lens = ellipse(cx, E.y, rx, ry)
  // Kæden: fra rammens nederste yderside i en blød bue ned langs kinden til hovedets side.
  const hc = local(a.headCenter)
  const hw = a.headRx * 0.93 * k
  const t0 = (52 * Math.PI) / 180
  const start = [cx + Math.cos(t0) * rx, E.y + Math.sin(t0) * ry] as const
  const end = [Math.max(start[0] + 4 * k, hc.x + hw * 0.86), hc.y + a.headRy * 0.62 * k] as const
  const chain = spline([[start[0], start[1]], [start[0] + 2.6 * k, start[1] + 9 * k], [(start[0] + end[0]) / 2 + 1.6 * k, end[1] + 2.2 * k], [end[0], end[1]]])
  const glare = join(
    poly([
      [E.x + 1.0 * ux, E.y - 0.46 * uy],
      [E.x + 0.62 * ux, E.y - 0.96 * uy],
      [E.x + 0.42 * ux, E.y - 0.98 * uy],
      [E.x + 0.84 * ux, E.y - 0.38 * uy],
    ]),
    circle(E.x - 0.56 * ux, E.y + 0.76 * uy, 0.09 * ux),
  )
  const beads = `0.1 ${(sw * 1.25).toFixed(2)}`
  return (
    <>
      <path d={chain} fill="none" stroke={c.outline} strokeWidth={sw * 1.25} strokeDasharray={beads} {...round} />
      <path d={chain} fill="none" stroke={c.main} strokeWidth={sw * 0.62} strokeDasharray={beads} {...round} />
      <path d={lens} fill={WHITE} opacity={TINT} />
      <path d={glare} fill={c.highlight === 'none' ? 'none' : WHITE} opacity={0.85} />
      <path d={lens} fill="none" stroke={c.outline} strokeWidth={sw * 2.1} />
      <path d={lens} fill="none" stroke={c.main} strokeWidth={sw * 1.0} />
      <path d={join(circle(start[0], start[1], 2.1 * k), circle(end[0], end[1], 2.4 * k))} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.45} />
    </>
  )
}

export const kongeligFace: ItemDef = {
  id: 'kongelig-face',
  set: 'kongelig',
  slot: 'face',
  nameClip: 'name.item.kongelig-face',
  source: { kind: 'chest', nodeId: 'w2-klokken-chest' },
  colorways: [
    fabric('guld', 'guld', 'gold', 'sky', 'berry'),
    fabric('soelv', 'sølv', 'silver', 'mint', 'navy'),
    fabric('sort', 'sort', 'charcoal', 'lilac', 'gold'),
  ],
  art: { front },
  fit: { anchor: 'headCenter', scaleBy: 'headWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [0, -18.5, 52, 52] },
}

export default kongeligFace
