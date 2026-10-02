// Kongelig · hånd: et scepter. Et guldskaft med to ringe og en knop forneden ligger i højre pote (poten
// tegnes over grebet), og øverst sidder en rund ædelsten med et guldbånd om livet og en stjerne på toppen.
// Riggen giver genstanden posen (`hold`): scepteret drejes væk fra ansigtet og hovedets omrids, til det går
// fri, og holdes i den sikre zone (fælles `aimAway`, som luppen). Alt tegnes i en ramme, der er drejet
// tilbage til verdensrummet, så lys og skygge står ens i alle poser. Alene (butik) står det skråt som et
// ikon. Scepteret rækker med vilje ud over silhuetten (`reach`) og er stort nok til at ses i butikskortet
// på dyret (review G1-r4, B2).
import { aimAway, aimSolo } from '../../rig/hold'
import { fabric } from '../../rig/palette'
import { arc, capsule, circle, ellipse, join, lune, star } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemDef, Pt } from '../../rig/types'

/** Scepteret langs aksen fra grebet (hovedets modelenheder): skaft, ringe, stenen og stjernen. */
const S = { butt: -6.5, top: 33, r: 2.9, rings: [-2.5, 24.5] as const, orb: 40, orbR: 8.4, star: 52.5, starR: 6.2 }
/** Foretrukken retning (grader; −90 = op) og trin, når ansigtet er i vejen. */
const AIM = -64
const STEP = 18
/** Scepteret er stort, så det kan ses i butikskortet på dyret. */
const SIZE = 1.15

const front: ItemArt = ({ c, sw, a, hold }) => {
  // Knoppen forneden er med, så den heller aldrig går ud over den sikre zone (poten hviler tæt på jorden).
  const samples = [{ at: S.butt - 1, r: S.r * 1.5 }, { at: 14, r: 4 }, { at: S.orb, r: S.orbR + 1 }, { at: S.star, r: S.starR }].map((p) => ({ at: p.at * SIZE, r: p.r * SIZE }))
  const P = hold ? aimAway(hold, samples, AIM, STEP) : aimSolo(a.handRot, -62)
  const { at, k, g, d, u, rot } = P
  // Tegnes i en ramme drejet tilbage til verdensrummet (lyset oppefra til venstre, bokse langs akserne).
  const t = (-rot * Math.PI) / 180
  const pt = (p: Pt): Vec => {
    const q = at(p)
    return [q.x * Math.cos(t) - q.y * Math.sin(t), q.x * Math.sin(t) + q.y * Math.cos(t)]
  }
  const along = (s: number): Vec => pt({ x: g.x + d.x * s * SIZE * u, y: g.y + d.y * s * SIZE * u })
  const m = u * k * SIZE
  const ang = (Math.atan2(along(10)[1] - along(0)[1], along(10)[0] - along(0)[0]) * 180) / Math.PI
  const [ox, oy] = along(S.orb)
  const [kx, ky] = along(S.star)
  const R = S.orbR * m
  const rings = join(...S.rings.map((s) => capsule(along(s - 1.4), along(s + 1.4), S.r * 1.45 * m)))
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <g transform={`rotate(${rot.toFixed(2)})`}>
      <path d={join(capsule(along(S.butt), along(S.top), S.r * m), circle(...along(S.butt - 1), S.r * 1.5 * m))} fill={c.main} {...stroke} />
      <path d={capsule(along(S.butt + 2), along(S.top - 2), S.r * 0.38 * m)} fill={c.mainShade} />
      <path d={rings} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
      <path d={star(kx, ky, S.starR * m, 2 * m, 4, ang + 90)} fill={c.main} {...stroke} strokeWidth={sw * 0.8} />
      <path d={circle(ox, oy, R)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw} />
      <path d={lune(ox, oy, R - sw / 2, R - sw / 2, R * 0.3, -15, 110)} fill={c.accentShade} />
      <path d={arc(ox, oy, R * 0.98, R * 0.36, 0, 180)} fill="none" stroke={c.main} strokeWidth={sw * 0.9} strokeLinecap="round" />
      <path d={join(ellipse(ox - R * 0.4, oy - R * 0.42, R * 0.26, R * 0.15, -40), circle(ox + R * 0.48, oy + R * 0.18, R * 0.08))} fill={c.highlight} />
    </g>
  )
}

export const kongeligHand: ItemDef = {
  id: 'kongelig-hand',
  set: 'kongelig',
  slot: 'hand',
  nameClip: 'name.item.kongelig-hand',
  source: { kind: 'chest', nodeId: 'w2-figurer-chest' },
  colorways: [
    fabric('guld', 'guld', 'gold', 'tomato', 'berry'),
    fabric('soelv', 'sølv', 'silver', 'sky', 'teal'),
    fabric('rosaguld', 'rosaguld', 'coral', 'mint', 'violet'),
  ],
  art: { front },
  fit: { anchor: 'pawR', scaleBy: 'fixed', baseScale: 1, baseWidth: 30 },
  reach: true,
  icon: { box: [-14, -70, 62, 78] },
}

export default kongeligHand
