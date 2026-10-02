// Milepæl · ansigt (niveau 5): hjertebriller. To store hjerter med farvet stel sidder om øjnene, og
// glasset er kun tonet (≤ 25 % opacitet, fit-regel 6), så øjnene altid ses igennem. Hjerterne regnes ud
// fra bærerens øjenankre og stadiets øjenskala (babyens øjne er større): de omslutter øjet med luft til,
// at pupillerne kan kigge en anelse rundt, så stellet aldrig dækker øjnene. Højlysene sidder i hjerternes
// øverste ydre bue uden for øjnene, og et lille glimt på venstre hjerte gør dem til en belønning. Broen
// hviler på næseryggen, og stængerne forsvinder mod hovedets sider. I butikken er glassene fyldt.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, ellipse, join, quad, spline, star, symmetric } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemDef } from '../../rig/types'

/**
 * Hjertet i øjenmål (x i øjets halve bredde, y i øjets halve højde, begge med luft): den venstre halvdel
 * fra kløften øverst (over øjets top) til spidsen forneden. Alle punkter ligger uden for enhedscirklen,
 * så stellet går uden om øjet.
 */
const HEART = symmetric([
  [0, -1.12], [-0.32, -1.42], [-0.7, -1.46], [-1.06, -1.18], [-1.24, -0.7], [-1.22, -0.12], [-1.04, 0.5],
  [-0.72, 1.02], [-0.36, 1.38], [0, 1.62],
])
/** Luft (modelenheder) mellem øjet og glassets kant: blikket flytter pupillen op til 3 enheder. */
const GAZE = 2.9
/** Det tonede glas over øjnene (fit-reglen tillader højst 25 %). */
const TINT = 0.24

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const es = STAGE_XF[stage].eye
  const L = local(a.eyeL)
  const R = local(a.eyeR)
  // Modelenheder → lokale (genstanden er skaleret med hovedbredden).
  const k = Math.hypot(R.x - L.x, R.y - L.y) / Math.hypot(a.eyeR.x - a.eyeL.x, a.eyeR.y - a.eyeL.y)
  // Hjertets enheder: øjet plus blikkets luft plus en halv stelbredde.
  const half = sw * 0.85
  const ux = a.eyeRx * es * k + GAZE * k + half
  const uy = a.eyeRy * es * k + GAZE * k + half
  // Hjerterne må ikke vokse ind i hinanden: de klemmes, så der er plads til broen mellem dem.
  const gap = Math.abs(R.x - L.x)
  const sx = Math.min(ux, (gap / 2 - 1.2 * k) / 1.24)
  const heart = (cx: number, cy: number): Vec[] => HEART.map(([x, y]) => [cx + x * sx, cy + y * uy] as Vec)
  const hl = heart(L.x, L.y)
  const hr = heart(R.x, R.y)
  const glass = join(blob(hl, 0.85), blob(hr, 0.85))
  // Broen mellem hjerternes øverste buer og stængerne mod hovedets sider.
  const by = L.y - 0.7 * uy
  const bridge = quad([L.x + 1.18 * sx, by], [(L.x + R.x) / 2, by - 3 * k], [R.x - 1.18 * sx, by])
  const hc = local(a.headCenter)
  const hw = a.headRx * 0.93 * k
  const ty = L.y - 0.86 * uy
  const temples = join(
    spline([[L.x - 1.2 * sx, ty], [hc.x - hw * 0.95, ty - 2.4 * k], [hc.x - hw, ty - 4.4 * k]]),
    spline([[R.x + 1.2 * sx, ty], [hc.x + hw * 0.95, ty - 2.4 * k], [hc.x + hw, ty - 4.4 * k]]),
  )
  const frame = join(glass, bridge, temples)
  // Højlys i hjerternes øverste ydre bue (uden for øjnene) og et glimt på venstre hjerte.
  const shine = join(
    ellipse(L.x - 0.84 * sx, L.y - 0.98 * uy, 0.2 * sx, 0.12 * uy, -40),
    ellipse(R.x - 0.84 * sx, R.y - 0.98 * uy, 0.2 * sx, 0.12 * uy, -40),
  )
  const glint = star(L.x - 1.3 * sx, L.y - 1.32 * uy, 4.6 * k, 1.2 * k)
  return (
    <>
      <path d={glass} fill={c.trim} opacity={solo ? 0.9 : TINT} />
      <path d={frame} fill="none" stroke={c.outline} strokeWidth={sw * 1.75} strokeLinecap="round" strokeLinejoin="round" />
      <path d={frame} fill="none" stroke={c.main} strokeWidth={sw * 0.8} strokeLinecap="round" strokeLinejoin="round" />
      <path d={shine} fill={c.highlight} />
      <path d={glint} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.4} strokeLinejoin="round" />
    </>
  )
}

export const milepaelHjertebriller: ItemDef = {
  id: 'milepael-hjertebriller',
  set: 'milepael',
  slot: 'face',
  nameClip: 'name.item.milepael-hjertebriller',
  source: { kind: 'level', level: 5 },
  colorways: [
    fabric('rosa', 'rosa', 'berry', 'rose', 'sunflower'),
    fabric('roed', 'rød', 'tomato', 'coral', 'sunflower'),
    fabric('lilla', 'lilla', 'violet', 'lilac', 'mint'),
  ],
  art: { front },
  fit: { anchor: 'headCenter', scaleBy: 'headWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [-50, -24, 100, 52] },
}

export default milepaelHjertebriller
