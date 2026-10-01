// Opdager · ansigt: eventyrbriller (flyverbriller) skubbet op i panden. Et syet læderbånd går hen over
// panden og forsvinder mod hovedets sider, og de to store, runde glas med polstret kant og messingring
// sidder på båndet lige over øjnene, med luft til at pupillerne kan kigge op (blikket flytter dem
// højst 3 enheder), så øjnene altid er fri. Glassene har en bred glans og nitter. Alt regnes ud fra
// bærerens øjenankre og stadiets øjenskala (babyens øjne er større). Pandelokken (hest, enhjørning)
// falder hen over båndet, og ørerne står foran det.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { arc, circle, join, softBand, spline } from '../../rig/shapes'
import type { ItemArt, ItemDef } from '../../rig/types'

/** Glassene i øjenmål (øjets rx): polstringens, messingringens og glassets radius. */
const PAD = 1.24
const BEZEL = 1.02
const GLASS = 0.8
/** Luft (modelenheder) mellem polstringen og øjets overkant: blikket kan løfte pupillen op til 3. */
const GAP = 4.2

const front: ItemArt = ({ c, sw, a, local, stage }) => {
  const es = STAGE_XF[stage].eye
  const L = local(a.eyeL)
  const R = local(a.eyeR)
  // Modelenheder → lokale (genstanden er skaleret med hovedbredden).
  const k = Math.hypot(R.x - L.x, R.y - L.y) / Math.hypot(a.eyeR.x - a.eyeL.x, a.eyeR.y - a.eyeL.y)
  const rx = a.eyeRx * es * k
  const ry = a.eyeRy * es * k
  const r = PAD * rx
  // Glassene sidder over øjnene (lidt ind mod midten), med polstringens underkant GAP over øjet.
  const cy = (L.y + R.y) / 2 - ry - GAP * k - sw * 0.5 - r
  const xs = [L.x + 1.8 * k, R.x - 1.8 * k]
  // Båndet hen over panden: fra hovedets ene side til den anden, buet med hovedets rundning.
  const hc = local(a.headCenter)
  const hw = a.headRx * 0.95 * k
  const strap = softBand(hc.x - hw, hc.x + hw, cy - 4.4 * k, cy + 4.4 * k, 2.6 * k, 2.6 * k)
  const seam = join(
    spline([[hc.x - hw * 0.93, cy - 0.6 * k], [hc.x - hw * 0.8, cy + 0.7 * k], [xs[0] - r, cy + 1.4 * k]]),
    spline([[xs[1] + r, cy + 1.4 * k], [hc.x + hw * 0.8, cy + 0.7 * k], [hc.x + hw * 0.93, cy - 0.6 * k]]),
  )
  const ring = (f: number) => join(...xs.map((x) => circle(x, cy, f * rx)))
  const shine = join(...xs.map((x) => arc(x, cy, GLASS * rx * 0.66, GLASS * rx * 0.66, 196, 266)))
  const dot = join(...xs.map((x) => circle(x + GLASS * rx * 0.42, cy + GLASS * rx * 0.4, GLASS * rx * 0.11)))
  const rivets = join(...xs.flatMap((x) => [circle(x - r * 0.98, cy, 1.35 * k), circle(x + r * 0.98, cy, 1.35 * k)]))
  const bridge = softBand(xs[0] + r * 0.8, xs[1] - r * 0.8, cy - 2.2 * k, cy + 2.6 * k, 0.8 * k, 0.8 * k)
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <>
      <path d={strap} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw} strokeLinejoin="round" />
      <path d={seam} fill="none" stroke={c.accentShade} strokeWidth={sw * 0.42} strokeDasharray={`${(2.2 * k).toFixed(1)} ${(1.8 * k).toFixed(1)}`} strokeLinecap="round" />
      <path d={bridge} fill={c.main} {...stroke} strokeWidth={sw * 0.8} />
      <path d={ring(PAD)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw} />
      <path d={ring(BEZEL)} fill={c.main} {...stroke} strokeWidth={sw * 0.7} />
      <path d={ring(GLASS)} fill={c.trim} stroke={c.outline} strokeWidth={sw * 0.55} />
      <path d={shine} fill="none" stroke={c.highlight} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <path d={dot} fill={c.highlight} />
      <path d={rivets} fill={c.main} stroke={c.outline} strokeWidth={sw * 0.3} />
    </>
  )
}

export const opdagerFace: ItemDef = {
  id: 'opdager-face',
  set: 'opdager',
  slot: 'face',
  nameClip: 'name.item.opdager-face',
  source: { kind: 'finale', world: 'eng' },
  colorways: [
    fabric('messing', 'messing', 'gold', 'sky', 'cocoa'),
    fabric('soelv', 'sølv', 'silver', 'mint', 'navy'),
    fabric('roed', 'rød', 'tomato', 'sunflower', 'charcoal'),
  ],
  art: { front },
  fit: { anchor: 'headCenter', scaleBy: 'headWidth', baseScale: 1, baseWidth: 104 },
  icon: { box: [-55, -34, 110, 30] },
}

export default opdagerFace
