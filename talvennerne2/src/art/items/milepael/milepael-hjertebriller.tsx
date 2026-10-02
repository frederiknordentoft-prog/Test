// Milepæl · ansigt (niveau 5): hjertebriller. To store hjerter med farvet stel sidder om øjnene, og
// glasset er klart med kun 15 % tone (review G1-r4, T2), så pupiller og højlys ses lige så tydeligt som
// uden briller, også på den mørkeste pels. Hjerterne regnes ud fra bærerens øjenankre og stadiets
// øjenskala (babyens øjne er større): de omslutter øjet med luft til, at pupillerne kan kigge en anelse
// rundt, så stellet aldrig dækker vipper og pupiller. På stadie 1 er hjerterne 13 % mindre, så spidserne
// ikke når ned til munden. Højlysene sidder i hjerternes øverste ydre bue uden for øjnene, og et lille
// glimt på venstre hjerte gør dem til en belønning. Broen hviler på næseryggen, og stængerne forsvinder
// mod hovedets sider. I butikken er glassene fyldt.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, ellipse, join, outside, quad, spline, star, symmetric } from '../../rig/shapes'
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
/** Det klare glas over øjnene (review G1-r4, T2: højst 20 % tone; fit-reglen tillader 25 %). */
const TINT = 0.15
/** Babyens hjerter er mindre (review G1-r4, T2), så spidsen ikke når munden. */
const BABY = 0.87

const front: ItemArt = ({ c, sw, a, local, stage, solo, ids }) => {
  const es = STAGE_XF[stage].eye
  const L = local(a.eyeL)
  const R = local(a.eyeR)
  // Modelenheder → lokale (genstanden er skaleret med hovedbredden).
  const k = Math.hypot(R.x - L.x, R.y - L.y) / Math.hypot(a.eyeR.x - a.eyeL.x, a.eyeR.y - a.eyeL.y)
  // Hjertets enheder: øjet plus blikkets luft plus en halv stelbredde.
  const half = sw * 0.85
  const baby = stage === 1 ? BABY : 1
  const ux = (a.eyeRx * es * k + GAZE * k + half) * baby
  const uy = (a.eyeRy * es * k + GAZE * k + half) * baby
  // Hjerterne må højst røre hinanden midtpå (tætsiddende øjne): så bliver broen et lille knudepunkt.
  // De klemmes aldrig mere, end at de lukkede øjnes vipper (1,35 · øjets bredde) stadig går fri – heller
  // ikke babyens mindre hjerter.
  const gap = Math.abs(R.x - L.x)
  const lashes = (a.eyeRx * es * k * 1.35 + sw * 1.6) / 1.18
  const sx = Math.max(lashes, Math.min(ux, Math.max(gap / 2 / 1.22, lashes)))
  const heart = (cx: number, cy: number): Vec[] => HEART.map(([x, y]) => [cx + x * sx, cy + y * uy] as Vec)
  const hl = heart(L.x, L.y)
  const hr = heart(R.x, R.y)
  const shapeL = blob(hl, 0.85)
  const shapeR = blob(hr, 0.85)
  const glass = join(shapeL, shapeR)
  // Rører hjerterne hinanden (tætsiddende øjne), klippes hvert stel uden for det andet hjerte, så
  // konturen bliver hjerternes fælles omrids og aldrig krydser sig selv; ellers samler en bro dem.
  const touch = 2 * 1.3 * sx + sw * 1.75 > gap
  const by = L.y - 0.7 * uy
  const bridge = touch ? '' : quad([L.x + 1.18 * sx, by], [(L.x + R.x) / 2, by - 3 * k], [R.x - 1.18 * sx, by])
  const hc = local(a.headCenter)
  const hw = a.headRx * 0.93 * k
  const ty = L.y - 0.86 * uy
  const templeL = spline([[L.x - 1.2 * sx, ty], [hc.x - hw * 0.95, ty - 2.4 * k], [hc.x - hw, ty - 4.4 * k]])
  const templeR = spline([[R.x + 1.2 * sx, ty], [hc.x + hw * 0.95, ty - 2.4 * k], [hc.x + hw, ty - 4.4 * k]])
  // Højlys i hjerternes øverste ydre bue (uden for øjnene) og et glimt på venstre hjerte.
  const shine = join(
    ellipse(L.x - 0.84 * sx, L.y - 0.98 * uy, 0.2 * sx, 0.12 * uy, -40),
    ellipse(R.x - 0.84 * sx, R.y - 0.98 * uy, 0.2 * sx, 0.12 * uy, -40),
  )
  const glint = star(L.x - 1.3 * sx, L.y - 1.32 * uy, 4.6 * k, 1.2 * k)
  const line = { fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const frame = (d: string, clip?: string) => (
    <g clipPath={clip ? `url(#${clip})` : undefined}>
      <path d={d} {...line} stroke={c.outline} strokeWidth={sw * 1.75} />
      <path d={d} {...line} stroke={c.main} strokeWidth={sw * 0.8} />
    </g>
  )
  const cl = `${ids.uid}-hbl`
  const cr = `${ids.uid}-hbr`
  return (
    <>
      <path d={glass} fill={c.trim} opacity={solo ? 0.9 : TINT} />
      {touch ? (
        <>
          <clipPath id={cl}>
            <path d={outside(shapeR)} clipRule="evenodd" />
          </clipPath>
          <clipPath id={cr}>
            <path d={outside(shapeL)} clipRule="evenodd" />
          </clipPath>
          {frame(join(shapeL, templeL), cl)}
          {frame(join(shapeR, templeR), cr)}
        </>
      ) : (
        frame(join(glass, bridge, templeL, templeR))
      )}
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
