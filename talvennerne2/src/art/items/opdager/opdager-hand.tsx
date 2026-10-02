// Opdager · hånd: en lup med træskaft og messingring. Skaftet ligger i højre pote (poten tegnes over
// grebet), og glasset peger skråt op og ud. Riggen giver genstanden posen (`hold`): luppen drejes
// væk fra ansigtet, til glasset går fri af hoved og mule – ved tænker (poten ved hagen) peger den ned
// og ud, og ved jubel og vink løftes den op ved siden af hovedet. Ringen har cel-skygge, glasset en
// lys tone med en bred glans og en prik. Alene (butik) står luppen skråt som et ikon. Luppen holdes
// ud fra poten og rækker med vilje ud over silhuetten (`reach`).
import { SAFE } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { arc, capsule, circle, lune } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { HandHold, ItemArt, ItemDef, Pt } from '../../rig/types'

/** Luppen i hovedets modelenheder: skaftets længde og radius, kraven, ringen og glasset. */
const L = { butt: 5, handle: 16, hr: 3.4, collar: 4, ring: 14, glass: 10.8 }
/** Glassets foretrukne retning (grader; 0 = højre, −90 = op) og drejningen, når ansigtet er i vejen. */
const AIM = -58
const STEP = 18

interface Place {
  at: (p: Pt) => Pt
  k: number
  /** Grebet, retningen (enhedsvektor) og enheden (verdensrummet). */
  g: Pt
  d: Pt
  u: number
}

function place(hold: HandHold): Place {
  const o = hold.local({ x: 0, y: 0 })
  const e = hold.local({ x: 1, y: 0 })
  const k = Math.hypot(e.x - o.x, e.y - o.y)
  const H = hold.head
  const u = H.s
  const g = hold.grip
  // Ansigtet: hovedets ellipse ned til under munden (mulen), lidt udvidet.
  const top = H.y - H.ry
  const bottom = Math.max(H.y + H.ry, H.mouth.y + 9 * u)
  const fc = { x: H.x, y: (top + bottom) / 2 }
  const fr = { x: H.rx + 2 * u, y: (bottom - top) / 2 + 2 * u }
  const reach = L.handle + L.collar + L.ring
  // Ringens boks i verdensrummet (luppen tegnes i en ramme, der er drejet tilbage til verdensrummet).
  const box = L.ring * u + 2.6
  // En hvilende pote tegnes bag hovedet: hængeører, manke og pigge rundt om hovedet (vædder, løvehoved,
  // pindsvin) skjuler luppen der, så glassets centrum skal også ligge uden for ellipsen i hovedboksen.
  const hb = H.box
  const bc = { x: (hb.x0 + hb.x1) / 2, y: (hb.y0 + hb.y1) / 2 }
  const br = { x: (hb.x1 - hb.x0) / 2 + L.ring * u * 0.4, y: (hb.y1 - hb.y0) / 2 + L.ring * u * 0.4 }
  const lensAt = (deg: number) => {
    const t = (deg * Math.PI) / 180
    return { x: g.x + Math.cos(t) * reach * u, y: g.y + Math.sin(t) * reach * u }
  }
  // Hele ringen mod den udvidede ansigtsellipse: ≥ 1 betyder fri af ansigtet.
  const faceDist = (deg: number) => {
    const lens = lensAt(deg)
    return ((lens.x - fc.x) / (fr.x + L.ring * u)) ** 2 + ((lens.y - fc.y) / (fr.y + L.ring * u)) ** 2
  }
  const safe = (deg: number) => {
    const lens = lensAt(deg)
    return lens.x + box <= SAFE.x1 && lens.x - box >= SAFE.x0 && lens.y - box >= SAFE.y0 && lens.y + box <= SAFE.y1
  }
  const clear = (deg: number, ears: boolean, face: boolean) => {
    const lens = lensAt(deg)
    const open = !ears || hold.front || ((lens.x - bc.x) / br.x) ** 2 + ((lens.y - bc.y) / br.y) ** 2 >= 1
    return (!face || faceDist(deg) >= 1) && open && safe(deg)
  }
  // Foretrukken retning først, derefter skiftevis med og mod uret hele vejen rundt, til glasset går fri.
  // Den sikre zone gælder altid; findes ingen fri retning (babyens store hoved, lang manke), slækkes først
  // kravet om hovedboksen (ører, manke, pigge), og ellers vælges den sikre retning længst fra ansigtet.
  const tries = Array.from({ length: 20 }, (_, i) => AIM + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * STEP)
  const far = tries.filter(safe).sort((p, q) => faceDist(q) - faceDist(p))[0]
  const deg = tries.find((d) => clear(d, true, true)) ?? tries.find((d) => clear(d, false, true)) ?? far ?? AIM
  const t = (deg * Math.PI) / 180
  return { at: hold.local, k, g, d: { x: Math.cos(t), y: Math.sin(t) }, u }
}

/**
 * Alene (butik): 45° med glasset op mod højre. Pasformen drejer håndgenstande `handRot`; retningen
 * drejes tilbage, så ikonet står ens.
 */
function solo(handRot: number): Place {
  const t = (-handRot * Math.PI) / 180
  const at = (p: Pt): Pt => ({ x: p.x * Math.cos(t) - p.y * Math.sin(t), y: p.x * Math.sin(t) + p.y * Math.cos(t) })
  return { at, k: 1, g: { x: 0, y: 0 }, d: { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, u: 1 }
}

const front: ItemArt = ({ c, sw, a, hold }) => {
  const P = hold ? place(hold) : solo(a.handRot)
  const { at, k, g, d, u } = P
  // Alt tegnes i en gruppe, der drejer genstandens ramme tilbage til verdensrummet (`rotate(rot)`), så
  // lyset kommer oppefra til venstre, og hvert elements boks ligger langs verdensakserne (kontaktarkets
  // lint måler boksene i elementets egen ramme).
  const o = at({ x: 0, y: 0 })
  const e = at({ x: 1, y: 0 })
  const rot = (Math.atan2(e.y - o.y, e.x - o.x) * 180) / Math.PI
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
