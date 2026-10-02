// Rytter · hånd: en stor gulerod med top, som en godbid til hesten. Den holdes om den smalle ende i
// højre pote (poten tegnes over grebet), så den tykke ende og den grønne top peger op og ud. Riggen giver
// genstanden posen (`hold`): guleroden drejes væk fra ansigtet og hovedets omrids, til den går fri, og
// holdes i den sikre zone (fælles `aimAway`, som luppen). Toppen er tre blade i en vifte, roden har
// tværriller og cel-skygge langs den ene side. Alt tegnes i en ramme, der er drejet tilbage til
// verdensrummet, så lys og skygge står ens i alle poser. Alene (butik) står den skråt som et ikon.
// Guleroden rækker med vilje ud over silhuetten (`reach`) og er stor nok til at fylde en tredjedel af
// butikskortet på dyret (review G1-r4, B2).
import { aimAway, aimSolo } from '../../rig/hold'
import { fabric } from '../../rig/palette'
import { blob, ellipse, join, spline } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemDef, Pt } from '../../rig/types'

/** Roden langs aksen fra grebet (hovedets modelenheder): punkt og halv bredde. Spidsen titter frem under poten. */
const ROOT: readonly (readonly [number, number])[] = [[-9, 0.6], [-4, 2.4], [4, 4.6], [12, 6.2], [20, 7.4], [25.5, 7]]
const TOP = 28
/** Bladene: vinkel fra aksen (grader) og længde. */
const LEAVES: readonly (readonly [number, number])[] = [[-30, 14], [0, 18], [30, 14]]
/** Foretrukken retning (grader; −90 = op) og trin, når ansigtet er i vejen. */
const AIM = -62
const STEP = 18

const front: ItemArt = ({ c, sw, a, hold }) => {
  const samples = [{ at: 12, r: 7 }, { at: TOP + 10, r: 11 }]
  const P = hold ? aimAway(hold, samples, AIM, STEP) : aimSolo(a.handRot, -58)
  const { at, k, g, d, u, rot } = P
  // Tegnes i en ramme drejet tilbage til verdensrummet (lyset oppefra til venstre, bokse langs akserne).
  const t = (-rot * Math.PI) / 180
  const pt = (p: Pt): Vec => {
    const q = at(p)
    return [q.x * Math.cos(t) - q.y * Math.sin(t), q.x * Math.sin(t) + q.y * Math.cos(t)]
  }
  const along = (s: number): Vec => pt({ x: g.x + d.x * s * u, y: g.y + d.y * s * u })
  // Aksens retning og normal i den tilbagedrejede ramme.
  const o = along(0)
  const e = along(10)
  const len = Math.hypot(e[0] - o[0], e[1] - o[1])
  const ax: Vec = [(e[0] - o[0]) / len, (e[1] - o[1]) / len]
  const nx: Vec = [-ax[1], ax[0]]
  const m = u * k
  const off = (s: number, w: number): Vec => {
    const p = along(s)
    return [p[0] + nx[0] * w * m, p[1] + nx[1] * w * m]
  }
  const left = ROOT.map(([s, w]) => off(s, w))
  const right = ROOT.map(([s, w]) => off(s, -w)).reverse()
  const root = blob([along(-10.4), ...left, along(TOP), ...right], 0.6)
  // Skyggen langs den side, der vender væk fra lyset (lyset oppe til venstre).
  const side = nx[0] + nx[1] > 0 ? 1 : -1
  const shade = blob([along(-8), ...ROOT.slice(1).map(([s, w]) => off(s, side * w * 0.98)), along(TOP - 1.6), ...ROOT.slice(1).map(([s, w]) => off(s, side * w * 0.42)).reverse()], 0.6)
  const ridges = join(...[1, 8, 15, 21].map((s, i) => spline([off(s, -side * (4 + i)), off(s + 1.2, -side * 1), off(s + 0.6, side * (2 + i * 0.8))])))
  // Bladene i en vifte fra toppen.
  const base = along(TOP - 2)
  const leaf = (deg: number, l: number) => {
    const r = (deg * Math.PI) / 180
    const dir: Vec = [ax[0] * Math.cos(r) - ax[1] * Math.sin(r), ax[0] * Math.sin(r) + ax[1] * Math.cos(r)]
    const n2: Vec = [-dir[1], dir[0]]
    const p = (s: number, w: number): Vec => [base[0] + (dir[0] * s + n2[0] * w) * m, base[1] + (dir[1] * s + n2[1] * w) * m]
    return { shape: blob([p(0, 0), p(l * 0.3, 3.6), p(l * 0.7, 3.4), p(l, 0), p(l * 0.7, -3.4), p(l * 0.3, -3.6)], 0.7), rib: spline([p(1.5, 0), p(l * 0.55, 0.3), p(l * 0.86, 0)]) }
  }
  const leaves = LEAVES.map(([deg, l]) => leaf(deg, l))
  const hl = off(16, -side * 3.6)
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <g transform={`rotate(${rot.toFixed(2)})`}>
      <path d={join(...leaves.map((x) => x.shape))} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.85} strokeLinejoin="round" />
      <path d={join(...leaves.map((x) => x.rib))} fill="none" stroke={c.accentShade} strokeWidth={sw * 0.5} strokeLinecap="round" />
      <path d={root} fill={c.main} />
      <path d={shade} fill={c.mainShade} />
      <path d={ridges} fill="none" stroke={c.outline} strokeWidth={sw * 0.45} strokeLinecap="round" opacity={0.6} />
      <path d={root} fill="none" {...stroke} />
      <path d={ellipse(hl[0], hl[1], 1.4 * m, 4.2 * m, (Math.atan2(ax[1], ax[0]) * 180) / Math.PI + 90)} fill={c.highlight} />
    </g>
  )
}

export const rytterHand: ItemDef = {
  id: 'rytter-hand',
  set: 'rytter',
  slot: 'hand',
  nameClip: 'name.item.rytter-hand',
  source: { kind: 'chest', nodeId: 'w1-tiere-chest' },
  colorways: [
    fabric('orange', 'orange', 'orange', 'sunflower', 'leaf'),
    fabric('lilla', 'lilla', 'violet', 'lilac', 'mint'),
    fabric('gul', 'gul', 'sunflower', 'cream', 'olive'),
  ],
  art: { front },
  fit: { anchor: 'pawR', scaleBy: 'fixed', baseScale: 1, baseWidth: 30 },
  reach: true,
  icon: { box: [-8, -42, 48, 56] },
}

export default rytterHand
