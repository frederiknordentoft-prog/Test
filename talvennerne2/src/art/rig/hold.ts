// Affine matricer til håndgenstande (fit-regel 5 udvidet): riggen fører genstandens lokale ramme
// gennem hele kæden (figurens og kroppens nøglepose, kroppens region, potens drejning eller løftede
// spids og pasformen) og hovedet gennem sin region og hældning. Så kan en ballon svæve ved skulderen
// og en lup pege væk fra ansigtet i alle humør. Ren talmatematik; ingen DOM.
import { SAFE } from './anchors'
import type { HandHold, PoseXf, Pt } from './types'

/** 2D-affin matrix [a b c d e f] som i SVG: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Mat = readonly [number, number, number, number, number, number]

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0]

export const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y]
export const scale = (sx: number, sy = sx): Mat => [sx, 0, 0, sy, 0, 0]
export function rotate(deg: number): Mat {
  const t = (deg * Math.PI) / 180
  return [Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t), 0, 0]
}

/** Matricerne ganget sammen fra venstre (som transform-attributter, yderst først). */
export const chain = (...ms: readonly Mat[]): Mat => ms.reduce(mul, IDENTITY)

export const applyMat = (m: Mat, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })

export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2]
  const a = m[3] / det
  const b = -m[1] / det
  const c = -m[2] / det
  const d = m[0] / det
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])]
}

/** Samme rækkefølge som shapes.tf: translate → rotate → scale. */
export const xfMat = (o: PoseXf | undefined): Mat =>
  o ? chain(translate(o.x ?? 0, o.y ?? 0), rotate(o.rot ?? 0), scale(o.sx ?? 1, o.sy ?? o.sx ?? 1)) : IDENTITY

/** Om et punkt (hop og ånding om fodpunktet): translate(p) · xf · translate(−p). */
export const about = (p: Pt, o: PoseXf | undefined): Mat => (o ? chain(translate(p.x, p.y), xfMat(o), translate(-p.x, -p.y)) : IDENTITY)

// ---------------------------------------------------------------------------------------------
// Håndgenstande, der peger væk fra ansigtet (lup, slikkepind, kikkert)

/** Et punkt på genstandens akse: afstanden fra grebet og radius (hovedets modelenheder). */
export interface AimSample {
  at: number
  r: number
}

export interface Aim {
  /** Verdensrummet → genstandens lokale koordinater, lokale enheder pr. verdensenhed og rammens drejning (grader). */
  at: (p: Pt) => Pt
  k: number
  rot: number
  /** Grebet, retningen (enhedsvektor) og hovedets enhed (verdensrummet). */
  g: Pt
  d: Pt
  u: number
}

/**
 * Retningen for en håndgenstand, der holdes ud fra poten (fit-regel 5 og 6): den foretrukne vinkel
 * `aim` (grader; 0 = højre, −90 = op) først, derefter skiftevis med og mod uret i trin på `step` hele
 * vejen rundt, til alle prøvepunkter på aksen går fri af ansigtet (hovedets ellipse ned til under
 * munden), af hovedboksen, når poten hviler bag hovedet (ører, manke, pigge), og holder sig i den sikre
 * zone. Findes ingen fri retning (babyens store hoved), slækkes kravet om hovedboksen, og ellers vælges
 * den sikre retning længst fra ansigtet.
 */
export function aimAway(hold: HandHold, samples: readonly AimSample[], aim: number, step = 18): Aim {
  const o = hold.local({ x: 0, y: 0 })
  const e = hold.local({ x: 1, y: 0 })
  const k = Math.hypot(e.x - o.x, e.y - o.y)
  const rot = (Math.atan2(e.y - o.y, e.x - o.x) * 180) / Math.PI
  const H = hold.head
  const u = H.s
  const g = hold.grip
  // Ansigtet: hovedets ellipse ned til under munden (mulen), lidt udvidet.
  const top = H.y - H.ry
  const bottom = Math.max(H.y + H.ry, H.mouth.y + 9 * u)
  const fc = { x: H.x, y: (top + bottom) / 2 }
  const fr = { x: H.rx + 2 * u, y: (bottom - top) / 2 + 2 * u }
  const hb = H.box
  const bc = { x: (hb.x0 + hb.x1) / 2, y: (hb.y0 + hb.y1) / 2 }
  const pts = (deg: number) => {
    const t = (deg * Math.PI) / 180
    return samples.map((s) => ({ x: g.x + Math.cos(t) * s.at * u, y: g.y + Math.sin(t) * s.at * u, r: s.r * u }))
  }
  // Mod den udvidede ansigtsellipse (randen med): ≥ 1 betyder fri af ansigtet; det nærmeste punkt tæller.
  const faceDist = (deg: number) =>
    Math.min(...pts(deg).map((p) => ((p.x - fc.x) / (fr.x + p.r)) ** 2 + ((p.y - fc.y) / (fr.y + p.r)) ** 2))
  // Boksen i verdensrummet (genstanden tegnes i en ramme, der er drejet tilbage til verdensrummet).
  const safe = (deg: number) =>
    pts(deg).every((p) => p.x + p.r + 2.6 <= SAFE.x1 && p.x - p.r - 2.6 >= SAFE.x0 && p.y - p.r - 2.6 >= SAFE.y0 && p.y + p.r + 2.6 <= SAFE.y1)
  const open = (deg: number) =>
    hold.front ||
    pts(deg).every((p) => ((p.x - bc.x) / ((hb.x1 - hb.x0) / 2 + p.r * 0.4)) ** 2 + ((p.y - bc.y) / ((hb.y1 - hb.y0) / 2 + p.r * 0.4)) ** 2 >= 1)
  const tries = Array.from({ length: Math.ceil(360 / step) + 1 }, (_, i) => aim + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * step)
  const free = (deg: number, box: boolean) => faceDist(deg) >= 1 && (!box || open(deg)) && safe(deg)
  const far = tries.filter(safe).sort((p, q) => faceDist(q) - faceDist(p))[0]
  let deg = tries.find((d) => free(d, true)) ?? tries.find((d) => free(d, false)) ?? far ?? aim
  // En løftet pote (jubel, vink) holder genstanden oppe ved poten (review G1-r4, T4): hænger den eneste
  // frie retning ned under grebet (stor figur, poten højt ved hovedet), må genstanden ligge foran hovedet,
  // så længe øjne, mund og tankeprikker går fri. "Tænker" og "ups" (poten ved hage eller mund) beholder
  // retningen ned og ud.
  if (hold.front && (hold.mood === 'wave' || hold.mood === 'cheer') && Math.sin((deg * Math.PI) / 180) > 0.25) {
    const lifted = tries.find((d) => Math.sin((d * Math.PI) / 180) <= 0.25 && clearOfFace(hold, pts(d), u) && safe(d))
    if (lifted !== undefined) deg = lifted
  }
  const t = (deg * Math.PI) / 180
  return { at: hold.local, k, rot, g, d: { x: Math.cos(t), y: Math.sin(t) }, u }
}

/** Prøvepunkterne (med radius) går fri af øjnene, munden og tankeprikkerne (ikke af resten af hovedet). */
function clearOfFace(hold: HandHold, pts: readonly { x: number; y: number; r: number }[], u: number): boolean {
  const H = hold.head
  return pts.every(
    (p) =>
      H.eyes.every((e) => ((p.x - e.x) / (H.eye.rx + p.r + 3 * u)) ** 2 + ((p.y - e.y) / (H.eye.ry + p.r + 3 * u)) ** 2 >= 1) &&
      Math.hypot(p.x - H.mouth.x, p.y - H.mouth.y) >= p.r + 6 * u &&
      (!hold.fx || Math.hypot(p.x - hold.fx.x, p.y - hold.fx.y) >= p.r + 10 * u),
  )
}

/**
 * Genstanden oppe ved kinden (slikkepinden i "tænker", review G1-r4, T3): poten ved hagen holder pinden,
 * og slikket ligger ved kinden på potens side. Retningen søges fra `from` (næsten lodret op) ned mod
 * `to` (vandret ud) på potens side, til alle prøvepunkter går fri af øjne, mund og tankeprikker og holder
 * sig i den sikre zone. Findes ingen, bruges `aimAway`.
 */
export function aimCheek(hold: HandHold, samples: readonly AimSample[], from: number, to: number, step = 6): Aim {
  const base = aimAway(hold, samples, from)
  const { g, u } = base
  // Håndgenstanden sidder altid i højre pote (set forfra til højre): slikket ved kinden på den side.
  const side = 1
  const pts = (deg: number) => {
    const t = (deg * Math.PI) / 180
    return samples.map((s) => ({ x: g.x + side * Math.cos(t) * s.at * u, y: g.y + Math.sin(t) * s.at * u, r: s.r * u }))
  }
  const safe = (deg: number) =>
    pts(deg).every((p) => p.x + p.r + 2.6 <= SAFE.x1 && p.x - p.r - 2.6 >= SAFE.x0 && p.y - p.r - 2.6 >= SAFE.y0 && p.y + p.r + 2.6 <= SAFE.y1)
  for (let deg = from; deg <= to; deg += step) {
    if (!safe(deg) || !clearOfFace(hold, pts(deg), u)) continue
    const t = (deg * Math.PI) / 180
    return { ...base, d: { x: side * Math.cos(t), y: Math.sin(t) } }
  }
  return base
}

/**
 * Alene (butik): retningen `deg` i et ikon. Pasformen drejer håndgenstande `handRot`; rammen drejes
 * tilbage, så ikonet står ens for alle genstande.
 */
export function aimSolo(handRot: number, deg: number): Aim {
  const t = (-handRot * Math.PI) / 180
  const at = (p: Pt): Pt => ({ x: p.x * Math.cos(t) - p.y * Math.sin(t), y: p.x * Math.sin(t) + p.y * Math.cos(t) })
  const r = (deg * Math.PI) / 180
  return { at, k: 1, rot: -handRot, g: { x: 0, y: 0 }, d: { x: Math.cos(r), y: Math.sin(r) }, u: 1 }
}
