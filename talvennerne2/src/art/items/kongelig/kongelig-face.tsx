// Kongelig · ansigt: en monokel over det ene øje med klart glas (review G1-r4: briller sidder på øjnene
// med klare glas). Den runde ramme omslutter øjet med luft til, at pupillen kan kigge rundt og det lukkede
// øjes vipper går fri, så rammen aldrig dækker øjet (fit-regel 6); glasset er kun svagt tonet (16 %) med et
// hvidt højlys i det øverste ydre hjørne uden for øjet. Fra rammens yderside hænger en perlekæde i en blød
// bue ned langs kinden til hovedets side. Alt regnes ud fra bærerens øjenankre og stadiets øjenskala
// (babyens øjne er større). I butikken er glasset tydeligere tonet, så ikonet læses som glas.
import { STAGE_XF } from '../../rig/anchors'
import { WHITE, fabric } from '../../rig/palette'
import { circle, ellipse, join, poly, spline } from '../../rig/shapes'
import type { ItemArt, ItemDef } from '../../rig/types'

/** Glassets tone på dyret (højst ca. 20 %) og i butikken. */
const TINT = 0.16
const SOLO_TINT = 0.5

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
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
  const rx = ux * 1.1
  const ry = uy * 1.08
  const lens = ellipse(E.x, E.y, rx, ry)
  // Kæden: fra rammens nederste yderside i en blød bue ned langs kinden til hovedets side.
  const hc = local(a.headCenter)
  const hw = a.headRx * 0.93 * k
  const t0 = (52 * Math.PI) / 180
  const start = [E.x + Math.cos(t0) * rx, E.y + Math.sin(t0) * ry] as const
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
  const round = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const beads = `0.1 ${(sw * 1.25).toFixed(2)}`
  return (
    <>
      <path d={chain} fill="none" stroke={c.outline} strokeWidth={sw * 1.25} strokeDasharray={beads} {...round} />
      <path d={chain} fill="none" stroke={c.main} strokeWidth={sw * 0.62} strokeDasharray={beads} {...round} />
      <path d={lens} fill={c.trim} opacity={solo ? SOLO_TINT : TINT} />
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
