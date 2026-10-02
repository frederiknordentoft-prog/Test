// Opdager · hånd: en lup med træskaft og messingring. Skaftet ligger i højre pote (poten tegnes over
// grebet), og glasset peger skråt op og ud. Riggen giver genstanden posen (`hold`): luppen drejes
// væk fra ansigtet, til glasset går fri af hoved og mule – ved tænker (poten ved hagen) peger den ned
// og ud, og ved jubel og vink løftes den op ved siden af hovedet. Ringen har cel-skygge, glasset en
// lys tone med en bred glans og en prik. Alene (butik) står luppen skråt som et ikon. Luppen holdes
// ud fra poten og rækker med vilje ud over silhuetten (`reach`).
import { aimAway, aimSolo } from '../../rig/hold'
import { fabric } from '../../rig/palette'
import { arc, capsule, circle, lune } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemDef, Pt } from '../../rig/types'

/** Luppen i hovedets modelenheder: skaftets længde og radius, kraven, ringen og glasset. */
const L = { butt: 5, handle: 16, hr: 3.4, collar: 4, ring: 14, glass: 10.8 }
/** Glassets foretrukne retning (grader; 0 = højre, −90 = op) og drejningen, når ansigtet er i vejen. */
const AIM = -58
const STEP = 18

const front: ItemArt = ({ c, sw, a, hold }) => {
  // Glasset er prøvepunktet: det skal gå fri af ansigtet og hovedet og holde sig i den sikre zone.
  const P = hold ? aimAway(hold, [{ at: L.handle + L.collar + L.ring, r: L.ring }], AIM, STEP) : aimSolo(a.handRot, -45)
  const { at, k, g, d, u, rot } = P
  // Alt tegnes i en gruppe, der drejer genstandens ramme tilbage til verdensrummet (`rotate(rot)`), så
  // lyset kommer oppefra til venstre, og hvert elements boks ligger langs verdensakserne (kontaktarkets
  // lint måler boksene i elementets egen ramme).
  const t = (-rot * Math.PI) / 180
  const pt = (p: Pt): Vec => {
    const q = at(p)
    return [q.x * Math.cos(t) - q.y * Math.sin(t), q.x * Math.sin(t) + q.y * Math.cos(t)]
  }
  // Punkter langs luppens akse (verdensrummet) i den tilbagedrejede ramme.
  const along = (s: number): Vec => pt({ x: g.x + d.x * s * u, y: g.y + d.y * s * u })
  const [lx, ly] = along(L.handle + L.collar + L.ring)
  const r = L.ring * u * k
  const gr = L.glass * u * k
  const handle = capsule(along(-L.butt), along(L.handle), L.hr * u * k, L.hr * 1.08 * u * k)
  const collar = capsule(along(L.handle - 0.6), along(L.handle + L.collar + 0.8), L.hr * 1.32 * u * k)
  const grain = capsule(along(1.5), along(L.handle - 2), L.hr * 0.3 * u * k)
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <g transform={`rotate(${rot.toFixed(2)})`}>
      <path d={handle} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw} strokeLinejoin="round" />
      <path d={grain} fill={c.accentShade} />
      <path d={collar} fill={c.main} {...stroke} strokeWidth={sw * 0.85} />
      <path d={circle(lx, ly, r)} fill={c.main} {...stroke} />
      <path d={lune(lx, ly, r - 0.6 * u * k - sw / 2, r - 0.6 * u * k - sw / 2, 2.4 * u * k, -15, 110)} fill={c.mainShade} />
      <path d={circle(lx, ly, gr)} fill={c.trim} stroke={c.outline} strokeWidth={sw * 0.6} />
      <path d={arc(lx, ly, gr * 0.62, gr * 0.62, 196, 258)} fill="none" stroke={c.highlight} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <path d={circle(lx + gr * 0.4, ly + gr * 0.38, gr * 0.11)} fill={c.highlight} />
    </g>
  )
}

export const opdagerHand: ItemDef = {
  id: 'opdager-hand',
  set: 'opdager',
  slot: 'hand',
  nameClip: 'name.item.opdager-hand',
  source: { kind: 'chest', nodeId: 'w0-tal20-chest' },
  colorways: [
    fabric('messing', 'messing', 'gold', 'sky', 'cocoa'),
    fabric('soelv', 'sølv', 'silver', 'mint', 'navy'),
    fabric('roed', 'rød', 'tomato', 'sky', 'charcoal'),
  ],
  art: { front },
  fit: { anchor: 'pawR', scaleBy: 'fixed', baseScale: 1, baseWidth: 30 },
  reach: true,
  icon: { box: [-22, -46, 48, 48] },
}

export default opdagerHand
