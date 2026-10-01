// Affine matricer til håndgenstande (fit-regel 5 udvidet): riggen fører genstandens lokale ramme
// gennem hele kæden (figurens og kroppens nøglepose, kroppens region, potens drejning eller løftede
// spids og pasformen) og hovedet gennem sin region og hældning. Så kan en ballon svæve ved skulderen
// og en lup pege væk fra ansigtet i alle humør. Ren talmatematik; ingen DOM.
import type { PoseXf, Pt } from './types'

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
