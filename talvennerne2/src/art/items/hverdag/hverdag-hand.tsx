// Hverdag · hånd: en ballon i en snor. Snoren holdes i højre pote (poten tegnes over grebet), og
// ballonen svæver ved hovedets højre side over skulderen – aldrig foran ansigtet. Riggen giver
// genstanden posen (`hold`): ballonens plads regnes ud i verdensrummet fra hovedets ellipse, løftes
// over en løftet pote (jubel, vink), holdes under tankeprikker og Z'er og inden for den sikre zone.
// Snoren er en blød kurve fra poten til knuden; når poten er løftet foran hovedet (tænker), går den
// ned under hagen og op ved siden af hovedet i stedet for hen over ansigtet. Alene (butik) står
// ballonen over en bugtet snor. Ballonen rækker med vilje ud over silhuetten (`reach`).
import { SAFE } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { cubic, ellipse, join, lune, poly, spline } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { HandHold, ItemArt, ItemDef, Pt } from '../../rig/types'

/** Ballonen i hovedets modelenheder: halvakser og knudens højde. */
const B = { rx: 15.8, ry: 18.6, knot: 4 }

interface Place {
  /** Verdensrummet → lokale koordinater, rammens drejning (grader) og lokale enheder pr. verdensenhed. */
  at: (p: Pt) => Pt
  rot: number
  k: number
  /** Ballonens centrum og halvakser (verdensrummet) og snorens kurve (start, to kontrolpunkter, knude). */
  c: Pt
  rx: number
  ry: number
  string: readonly [Pt, Pt, Pt, Pt]
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
function bez(p: readonly [Pt, Pt, Pt, Pt], t: number): Pt {
  const a = lerp(p[0], p[1], t)
  const b = lerp(p[1], p[2], t)
  const c = lerp(p[2], p[3], t)
  return lerp(lerp(a, b, t), lerp(b, c, t), t)
}

/** Ballonens plads og snorens kurve i posen (verdensrummet). */
function place(hold: HandHold): Place {
  const o = hold.local({ x: 0, y: 0 })
  const e = hold.local({ x: 1, y: 0 })
  const rot = (Math.atan2(e.y - o.y, e.x - o.x) * 180) / Math.PI
  const k = Math.hypot(e.x - o.x, e.y - o.y)
  const H = hold.head
  const u = H.s
  const rx = B.rx * u
  const ry = B.ry * u
  const g = hold.grip
  // Ved hovedets højre side i øjenhøjde (uden for manke og hængeører); over en løftet pote; under
  // tankeprikker og Z'er.
  let cx = Math.max(H.x + H.rx + 6 * u, H.box.x1 - 1 * u) + rx
  let cy = Math.min(H.y - 0.12 * H.ry, g.y - ry - 26 * u)
  if (hold.fx && cx + rx > hold.fx.x - 8 * u) cy = Math.max(cy, hold.fx.y + 7 * u + ry)
  // Den sikre zone: kontaktarkets lint måler hvert element i genstandens (drejede) ramme, så ballonens
  // boks regnes som den drejede ellipses boks ført tilbage til verdensrummet (plus konturen).
  const t = (rot * Math.PI) / 180
  const [cs, sn] = [Math.abs(Math.cos(t)), Math.abs(Math.sin(t))]
  const hx = Math.hypot(rx * cs, ry * sn)
  const hy = Math.hypot(rx * sn, ry * cs)
  const W = hx * cs + hy * sn + 2.4
  const Hh = hx * sn + hy * cs + 2.4
  cx = Math.min(cx, SAFE.x1 - W)
  cy = Math.max(cy, SAFE.y0 + Hh)
  const knot = { x: cx, y: cy + ry + B.knot * u }
  // Snoren: en blød kurve, der går lodret op i knuden.
  const rise = Math.max(18 * u, (g.y - knot.y) * 0.45)
  let string: [Pt, Pt, Pt, Pt] = [g, lerp(g, knot, 0.36), { x: knot.x - 2 * u, y: knot.y + rise }, knot]
  // Foran hovedet må snoren ikke krydse ansigtet (hovedet ned til under munden, så mulen er med): den
  // går ned under hagen og op ved siden af hovedet.
  const top = H.y - H.ry
  const bottom = Math.max(H.y + H.ry, H.mouth.y + 9 * u)
  const fc = { x: H.x, y: (top + bottom) / 2 }
  const fr = { x: H.rx + 3 * u, y: (bottom - top) / 2 + 3 * u }
  const inHead = (p: Pt) => ((p.x - fc.x) / fr.x) ** 2 + ((p.y - fc.y) / fr.y) ** 2 < 1
  const hits = (s: readonly [Pt, Pt, Pt, Pt]) => Array.from({ length: 15 }, (_, i) => bez(s, (i + 1) / 16)).some(inHead)
  if (hold.front && hits(string)) {
    const below = bottom + 8 * u
    for (let i = 0; i < 6 && hits(string); i++) {
      const drop = below + i * 8 * u
      string = [g, { x: g.x + 10 * u, y: Math.max(g.y, drop) + 6 * u }, { x: knot.x + 4 * u, y: Math.max(knot.y, drop) + 4 * u }, knot]
    }
  }
  return { at: hold.local, rot, k, c: { x: cx, y: cy }, rx, ry, string }
}

/**
 * Alene (butik): ballonen over en bugtet snor. Pasformen drejer håndgenstande `handRot`; rammen drejes
 * tilbage, så ballonen står lodret i ikonet.
 */
function solo(handRot: number): Place {
  const t = (-handRot * Math.PI) / 180
  const at = (p: Pt): Pt => ({ x: p.x * Math.cos(t) - p.y * Math.sin(t), y: p.x * Math.sin(t) + p.y * Math.cos(t) })
  return {
    at,
    rot: -handRot,
    k: 1,
    c: { x: 0, y: -45 },
    rx: B.rx,
    ry: B.ry,
    string: [{ x: -1, y: 0 }, { x: 6, y: -9 }, { x: -6, y: -16 }, { x: 0, y: -45 + B.ry + B.knot }],
  }
}

const front: ItemArt = ({ c, sw, a, hold }) => {
  const P = hold ? place(hold) : solo(a.handRot)
  const { at, rot, k } = P
  const pt = (p: Pt): Vec => {
    const q = at(p)
    return [q.x, q.y]
  }
  // Ballonens dele i verdensrummet om centrum (i ballonens egne mål), ført ind i den lokale ramme.
  const off = (dx: number, dy: number): Pt => ({ x: P.c.x + dx * P.rx, y: P.c.y + dy * P.ry })
  const ctr = at(P.c)
  const body = ellipse(ctr.x, ctr.y, P.rx * k, P.ry * k, rot)
  const shade = lune(0, 0, P.rx * k - sw / 2, P.ry * k - sw / 2, P.rx * k * 0.2, -20, 105)
  const hl = at(off(-0.42, -0.42))
  const dot = at(off(-0.12, -0.72))
  const knot = poly([pt(off(0, 1)), pt(off(-0.22, 1 + (B.knot * 1.1) / B.ry)), pt(off(0.22, 1 + (B.knot * 1.1) / B.ry))])
  const [s0, s1, s2, s3] = P.string.map(pt)
  return (
    <>
      <path d={hold ? cubic(s0, s1, s2, s3) : spline([s0, pt({ x: 5, y: -6 }), pt({ x: -5, y: -14 }), pt({ x: 2, y: -20 }), s3])} fill="none" stroke={c.outline} strokeWidth={sw * 0.5} strokeLinecap="round" />
      <path d={body} fill={c.main} />
      <g transform={`translate(${ctr.x.toFixed(1)} ${ctr.y.toFixed(1)}) rotate(${rot.toFixed(1)})`}>
        <path d={shade} fill={c.mainShade} />
      </g>
      <path d={body} fill="none" stroke={c.outline} strokeWidth={sw} strokeLinejoin="round" />
      <path d={knot} fill={c.main} stroke={c.outline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={join(ellipse(hl.x, hl.y, P.rx * k * 0.2, P.ry * k * 0.3, rot + 30), ellipse(dot.x, dot.y, P.rx * k * 0.08, P.ry * k * 0.07, rot))} fill={c.highlight} />
    </>
  )
}

export const hverdagHand: ItemDef = {
  id: 'hverdag-hand',
  set: 'hverdag',
  slot: 'hand',
  nameClip: 'name.item.hverdag-hand',
  source: { kind: 'level', level: 6 },
  colorways: [
    fabric('roed', 'rød', 'tomato', 'cream', 'cream'),
    fabric('gul', 'solgul', 'sunflower', 'cream', 'cream'),
    fabric('blaa', 'himmelblå', 'sky', 'snow', 'snow'),
  ],
  art: { front },
  fit: { anchor: 'pawR', scaleBy: 'fixed', baseScale: 1, baseWidth: 30 },
  reach: true,
  icon: { box: [-18, -65.5, 36, 66.5] },
}

export default hverdagHand
