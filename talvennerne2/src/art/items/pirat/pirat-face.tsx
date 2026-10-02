// Pirat · ansigt: et tegneserieagtigt piratskæg. Et krøllet fuldskæg går fra kinderne ned under hagen og
// ender i en lille fletning med en perle, og et snoet overskæg krøller op fra næsens sider. Skægget går i en
// bue under munden, og overskægget sidder ved siden af næsen, så munden altid ses (højst mundvigene
// dækkes). Alt regnes ud fra bærerens næse, mund, kinder og øjne (skægget holder sig under øjnene), så det
// sidder ens på korte og lange snuder. Skægget har cel-skygge og tre krøller.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, circle, ellipse, join, ribbon, spline } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemDef } from '../../rig/types'

/** Overskæggets venstre halvdel (rygrad og bredder) i enheder om næsen; spejles. */
const STACHE: Vec[] = [[-3.4, 2], [-10, 4], [-17, 3], [-21.4, -1.4], [-20, -5.6], [-16.4, -5.8]]
const STACHE_W = [5.4, 6, 4.8, 3.6, 2.6, 1.2]

const front: ItemArt = ({ c, sw, a, local, stage }) => {
  const es = STAGE_XF[stage].eye
  const M = local(a.mouth)
  const N = local(a.muzzle)
  const CL = local(a.cheekL)
  const CR = local(a.cheekR)
  const EL = local(a.eyeL)
  const ER = local(a.eyeR)
  // Modelenheder → lokale (genstanden er skaleret med hovedbredden).
  const k = Math.hypot(ER.x - EL.x, ER.y - EL.y) / Math.hypot(a.eyeR.x - a.eyeL.x, a.eyeR.y - a.eyeL.y)
  const eyeBottom = Math.max(EL.y, ER.y) + a.eyeRy * es * k
  // Skægget hænger fra kæben: øverst i mundens højde ved kinderne (altid et stykke under øjnene), en
  // bue lige under munden og krøllede buler forneden.
  const top = Math.max(M.y - 1 * k, eyeBottom + 6 * k)
  const cx = M.x
  const w = Math.max(15 * k, ((CR.x - CL.x) / 2) * 0.72)
  const cy = Math.max(M.y + 6 * k, top + 5 * k)
  const h = Math.max(22 * k, M.y + 30 * k - cy)
  const bot = cy + h
  const lobes: Vec[] = Array.from({ length: 11 }, (_, i) => {
    const t = Math.PI - (Math.PI * i) / 10
    const r = i % 2 === 0 ? 1 : 0.9
    return [cx + Math.cos(t) * w * r, cy + Math.sin(t) * h * r] as Vec
  })
  const beard: Vec[] = [
    [cx - w * 0.9, top + 1 * k],
    [cx - w * 1.04, (top + cy) / 2],
    ...lobes.slice(1, 10),
    [cx + w * 1.04, (top + cy) / 2],
    [cx + w * 0.9, top + 1 * k],
    // Inderkanten: en bue lige under munden, så munden ses.
    [cx + w * 0.62, top + 1.6 * k],
    [M.x + 9 * k, M.y + 4.5 * k],
    [M.x, M.y + 6.5 * k],
    [M.x - 9 * k, M.y + 4.5 * k],
    [cx - w * 0.62, top + 1.6 * k],
  ]
  const shape = blob(beard, 0.7)
  // Krøller (strøg i konturfarven) og skyggen i bunden til højre.
  const curls = join(
    spline([[cx - w * 0.5, cy + h * 0.38], [cx - w * 0.36, cy + h * 0.62], [cx - w * 0.52, cy + h * 0.78]]),
    spline([[cx + w * 0.02, cy + h * 0.5], [cx + w * 0.14, cy + h * 0.74], [cx - w * 0.02, cy + h * 0.9]]),
    spline([[cx + w * 0.56, cy + h * 0.32], [cx + w * 0.68, cy + h * 0.56], [cx + w * 0.52, cy + h * 0.72]]),
  )
  const shade = blob(
    [[cx + w * 0.92, cy + h * 0.2], [cx + w * 0.74, cy + h * 0.66], [cx + w * 0.36, cy + h * 0.92], [cx + w * 0.04, cy + h * 0.98], [cx + w * 0.4, cy + h * 0.7], [cx + w * 0.7, cy + h * 0.36]],
    0.8,
  )
  // Fletningen og perlen under skæggets spids.
  const braid = join(ellipse(cx, bot + 3.4 * k, 3.6 * k, 4 * k, 0), ellipse(cx, bot + 9.6 * k, 3 * k, 3.4 * k, 0))
  const bead = circle(cx, bot + 14.8 * k, 3.2 * k)
  // Overskægget ved næsens sider.
  const stache = (sign: 1 | -1) =>
    blob(ribbon(STACHE.map(([x, y]) => [N.x + sign * x * k, N.y + 2 * k + y * k] as Vec), STACHE_W.map((v) => v * k)), 0.7)
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <>
      <path d={shape} fill={c.main} {...stroke} />
      <path d={shade} fill={c.mainShade} />
      <path d={curls} fill="none" stroke={c.outline} strokeWidth={sw * 0.5} strokeLinecap="round" />
      <path d={braid} fill={c.main} {...stroke} strokeWidth={sw * 0.8} />
      <path d={bead} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.7} />
      <path d={join(stache(-1), stache(1))} fill={c.main} {...stroke} strokeWidth={sw * 0.85} />
      <path d={join(ellipse(cx - w * 0.6, cy + h * 0.2, 3.4 * k, 1.6 * k, -40), circle(cx - 1 * k, bot + 13.6 * k, 1 * k))} fill={c.highlight} />
    </>
  )
}

export const piratFace: ItemDef = {
  id: 'pirat-face',
  set: 'pirat',
  slot: 'face',
  nameClip: 'name.item.pirat-face',
  source: { kind: 'shop', price: 80 },
  colorways: [
    fabric('brun', 'brun', 'cocoa', 'cocoa', 'gold'),
    fabric('ingefaer', 'ingefær', 'orange', 'orange', 'sky'),
    fabric('sort', 'sort', 'charcoal', 'charcoal', 'sunflower'),
  ],
  art: { front },
  fit: { anchor: 'headCenter', scaleBy: 'headWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [-46, 12, 92, 70] },
}

export default piratFace
