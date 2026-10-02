// Milepæl · hånd (niveau 30): kæmpeslikkepind. Pinden ligger i højre pote (poten tegnes over grebet), og
// den store, runde slikkepind med en hvirvel sidder for enden med en sløjfe om pinden. Riggen giver
// genstanden posen (`hold`): slikkepinden drejes væk fra ansigtet og hovedets omrids, til den går fri, og
// holdes i den sikre zone (fælles `aimAway`, som luppen). I "tænker" (poten ved hagen) sidder slikket oppe
// ved kinden, og pinden går ned gennem poten (`aimCheek`, review G1-r4, T3). Alt tegnes i en ramme, der er drejet tilbage til
// verdensrummet, så hvirvlen og lyset står ens i alle poser. Alene (butik) står den skråt som et ikon.
// Slikkepinden rækker med vilje ud over silhuetten (`reach`).
import { aimAway, aimCheek, aimSolo } from '../../rig/hold'
import { fabric } from '../../rig/palette'
import { blob, capsule, circle, ellipse, join, lune, spline, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemDef, Pt } from '../../rig/types'

/** Slikkepinden i hovedets modelenheder: pindens længde og radius og slikkets radius. */
const L = { stick: 27, sr: 3, candy: 23 }
/** Foretrukken retning (grader; −90 = op) og trin, når ansigtet er i vejen. */
const AIM = -66
const STEP = 18

/** Hvirvlen: en spiral fra midten ud mod kanten (i slikkets radius). */
const SWIRL: Vec[] = Array.from({ length: 22 }, (_, i) => {
  const t = (i / 21) * Math.PI * 4.2
  const r = 0.08 + (0.8 * i) / 21
  return [r * Math.cos(t), r * Math.sin(t)]
})

/** Sløjfen om pinden (to løkker og en knude), om (0,0), før skalering. */
const BOW: Vec[][] = [
  [[0, 0], [-6, -4.4], [-8.4, 0], [-6, 4.4]],
  [[0, 0], [6, -4.4], [8.4, 0], [6, 4.4]],
]

/** "Tænker": retningerne fra næsten lodret op til let under vandret på potens side. */
const CHEEK = { from: -84, to: 12 }

const front: ItemArt = ({ c, sw, a, hold }) => {
  const samples = [{ at: L.stick * 0.5, r: L.sr * 2 }, { at: L.stick + L.candy, r: L.candy }]
  const think = hold?.mood === 'think'
  const P = hold ? (think ? aimCheek(hold, samples, CHEEK.from, CHEEK.to) : aimAway(hold, samples, AIM, STEP)) : aimSolo(a.handRot, -60)
  const { at, k, g, d, u, rot } = P
  // Tegnes i en ramme drejet tilbage til verdensrummet (lyset oppefra til venstre, bokse langs akserne).
  const t = (-rot * Math.PI) / 180
  const pt = (p: Pt): Vec => {
    const q = at(p)
    return [q.x * Math.cos(t) - q.y * Math.sin(t), q.x * Math.sin(t) + q.y * Math.cos(t)]
  }
  const along = (s: number): Vec => pt({ x: g.x + d.x * s * u, y: g.y + d.y * s * u })
  const [cx, cy] = along(L.stick + L.candy)
  const R = L.candy * u * k
  const bowAt = along(L.stick - 1.5)
  const ang = (Math.atan2(d.y, d.x) * 180) / Math.PI + 90
  const bow = BOW.map((b) => blob(xf(b, { rot: ang, sx: u * k, dx: bowAt[0], dy: bowAt[1] }), 0.8))
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <g transform={`rotate(${rot.toFixed(2)})`}>
      <path d={capsule(along(think ? -9 : -3), along(L.stick + 2), L.sr * u * k)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.85} strokeLinejoin="round" />
      <path d={circle(cx, cy, R)} fill={c.main} {...stroke} />
      <path d={spline(SWIRL.map(([x, y]) => [cx + x * R, cy + y * R] as Vec))} fill="none" stroke={c.trim} strokeWidth={R * 0.2} strokeLinecap="round" />
      <path d={lune(cx, cy, R - sw / 2, R - sw / 2, R * 0.16, -15, 105)} fill={c.ink} opacity={0.12} />
      <path d={circle(cx, cy, R)} fill="none" {...stroke} />
      <path d={join(...bow)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={join(ellipse(cx - R * 0.42, cy - R * 0.46, R * 0.22, R * 0.12, -40), circle(cx + R * 0.5, cy + R * 0.42, R * 0.07))} fill={c.highlight} />
    </g>
  )
}

export const milepaelSlikkepind: ItemDef = {
  id: 'milepael-slikkepind',
  set: 'milepael',
  slot: 'hand',
  nameClip: 'name.item.milepael-slikkepind',
  source: { kind: 'level', level: 30 },
  colorways: [
    fabric('jordbaer', 'jordbær', 'berry', 'snow', 'sunflower'),
    fabric('citron', 'citron', 'sunflower', 'snow', 'sky'),
    fabric('mynte', 'mynte', 'mint', 'snow', 'rose'),
  ],
  art: { front },
  fit: { anchor: 'pawR', scaleBy: 'fixed', baseScale: 1, baseWidth: 34 },
  reach: true,
  icon: { box: [-26, -76, 66, 79] },
}

export default milepaelSlikkepind
