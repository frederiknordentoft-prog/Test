// Milepæl · ryg (niveau 40): fe-vinger. To par vinger sidder bag kroppen (lag 2) ved ryggens anker: de
// store øvre vinger rejser sig skråt op og ud langs skuldrene, og de små nedre vinger peger ned og ud ved
// hofterne, så de ses på begge sider af kroppen uden at nå op til tankeprikker, ører og manke. De nedre
// vinger er en tone mørkere (de ligger bagerst), og hver vinge har et lyst felt, to buede årer og et par
// glimtende prikker. Halen, manken og pindsvinets pigge ligger foran vingerne. På stor (bredere krop)
// klemmes vingerne vandret, så spidserne bliver i den sikre zone.
// (0,0) = back, tegnet ved bodyWidth 100.
import { SAFE, STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, circle, join, mirrorX, spline, star, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, ItemArt, ItemDef, Pt, Stage } from '../../rig/types'

/** Den venstre øvre vinge (roden ved ryggen, spidsen op og ud) og dens lyse felt. */
const UPPER: Vec[] = [[-8, -2], [-30, -26], [-54, -46], [-74, -54], [-86, -48], [-86, -32], [-74, -16], [-50, -4], [-26, 4]]
const UPPER_IN = xf(UPPER, { sx: 0.62, sy: 0.58, about: [-62, -40] })
/** Den venstre nedre vinge (ned og ud ved hoften) og dens lyse felt. */
const LOWER: Vec[] = [[-12, 6], [-36, 12], [-60, 22], [-74, 38], [-70, 52], [-54, 55], [-32, 40], [-12, 18]]
const LOWER_IN = xf(LOWER, { sx: 0.56, sy: 0.56, about: [-56, 40] })
/** Årerne: buer fra roden ud i vingen. */
const VEINS: Vec[][] = [
  [[-22, -8], [-46, -26], [-70, -40]],
  [[-24, -2], [-50, -12], [-74, -22]],
  [[-24, 14], [-44, 26], [-60, 44]],
]

/** Vingernes yderste spids (lokale enheder fra ryggen), inkl. stjernen. */
const SPAN = 90

/**
 * Hvor bredt vingerne må være (lokale enheder fra ryggen) for at holde sig i den sikre zone i stadiet
 * (kroppen og dermed vingerne vokser på stor). Venstre side har ekstra luft, fordi jubel vipper hele
 * figuren 2° om fodpunktet, så de øverste vingespidser flytter mod venstre.
 */
function safeSpan(a: AnchorSet, stage: Stage, local: (p: Pt) => Pt): number {
  const k = STAGE_XF[stage].fig * STAGE_XF[stage].body
  const model = (wx: number) => a.ground.x + (wx - a.ground.x) / k
  const l = local({ x: model(SAFE.x0 + 7.5), y: a.back.y })
  const r = local({ x: model(SAFE.x1 - 2.5), y: a.back.y })
  return Math.min(-l.x, r.x)
}

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  // Vingerne klemmes vandret, så spidserne bliver i den sikre zone (stor har en bredere krop).
  const sx = solo ? 1 : Math.min(1, safeSpan(a, stage, local) / SPAN)
  const w = (pts: readonly Vec[]) => (sx < 1 ? xf(pts, { sx, sy: 1 }) : pts)
  const pair = (pts: readonly Vec[]) => join(blob(w(pts), 0.9), blob(mirrorX(w(pts)), 0.9))
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const veins = join(...VEINS.flatMap((v) => [spline(w(v)), spline(mirrorX(w(v)))]))
  const dots = join(
    ...[[-72, -44, 2.6], [-60, -30, 1.8], [-62, 46, 2.2]].flatMap(([x, y, r]) => [circle(x * sx, y, r), circle(-x * sx, y, r)]),
  )
  return (
    <>
      <path d={pair(LOWER)} fill={c.mainShade} {...stroke} />
      <path d={pair(LOWER_IN)} fill={c.trim} opacity={0.7} />
      <path d={pair(UPPER)} fill={c.main} {...stroke} />
      <path d={pair(UPPER_IN)} fill={c.trim} opacity={0.75} />
      <path d={veins} fill="none" stroke={c.outline} strokeWidth={sw * 0.42} strokeLinecap="round" opacity={0.55} />
      <path d={dots} fill={c.accent} />
      <path d={join(star(-80 * sx, -58, 6, 1.6), star(82 * sx, -12, 4.6, 1.3))} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.4} strokeLinejoin="round" />
    </>
  )
}

export const milepaelFevinger: ItemDef = {
  id: 'milepael-fevinger',
  set: 'milepael',
  slot: 'back',
  nameClip: 'name.item.milepael-fevinger',
  source: { kind: 'level', level: 40 },
  colorways: [
    fabric('lilla', 'lilla', 'lilac', 'snow', 'sunflower'),
    fabric('mint', 'mintgrøn', 'mint', 'snow', 'rose'),
    fabric('rosa', 'rosa', 'rose', 'cream', 'sky'),
  ],
  art: { front },
  fit: { anchor: 'back', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 176 },
  reach: true,
  icon: { box: [-90, -66, 180, 125] },
}

export default milepaelFevinger
