/**
 * Layout af urværket: en lille kæde af tandhjul i indgreb.
 * Alle mål er i "clock units" — procent af urværkets bredde, centreret i (0,0),
 * så layoutet skalerer med terningen.
 */

import { TOOTH_ROOT_FRACTION, TOOTH_TIP_FRACTION } from './gear'

export type GearLayer = 'front' | 'back'

export type TrainDef =
  | { id: string; teeth: number; layer?: GearLayer } // drivhjul (første)
  | { id: string; teeth: number; layer?: GearLayer; meshWith: string; angle: number } // i indgreb med et andet hjul
  | { id: string; teeth: number; layer?: GearLayer; coaxialWith: string } // på samme aksel som et andet hjul

export type GearSpec = {
  id: string
  teeth: number
  layer: GearLayer
  cx: number
  cy: number
  /** delecirklens radius */
  r: number
  outerR: number
  rootR: number
  innerR: number
  toothDepth: number
  /** statisk rotationsoffset (grader) så tænderne griber ind i hinanden */
  phase: number
  /** +1 = med uret, -1 = mod uret */
  dir: 1 | -1
  /** vinkelhastighed relativt til drivhjulet (drivhjulet = 1) */
  speed: number
  /** id på det hjul, dette er i indgreb med (null for drivhjul og koaksiale hjul) */
  meshWith: string | null
  coaxialWith: string | null
}

/** Modul: tandafstand langs delecirklen = MODULE * PI. Delecirkel-radius = MODULE * teeth / 2. */
export const MODULE = 2.35
const ADDENDUM = MODULE * 0.5
const DEDENDUM = MODULE * 0.625

const DEG = 180 / Math.PI

function normalizeDeg(a: number, period: number): number {
  // til (-period/2, period/2]
  let x = a % period
  if (x <= -period / 2) x += period
  if (x > period / 2) x -= period
  return x
}

export function buildTrain(defs: readonly TrainDef[]): GearSpec[] {
  const out: GearSpec[] = []
  const byId = new Map<string, GearSpec>()

  for (const def of defs) {
    const r = (MODULE * def.teeth) / 2
    const outerR = r + ADDENDUM
    const rootR = r - DEDENDUM
    const base = {
      id: def.id,
      teeth: def.teeth,
      layer: def.layer ?? 'front',
      r,
      outerR,
      rootR,
      innerR: Math.max(1.2, r * 0.16),
      toothDepth: outerR - rootR,
    }

    let spec: GearSpec
    if ('meshWith' in def) {
      const parent = byId.get(def.meshWith)
      if (!parent) throw new Error(`Ukendt forældrehjul: ${def.meshWith}`)
      const theta = def.angle
      const dist = parent.r + r
      const cx = parent.cx + dist * Math.cos(theta / DEG)
      const cy = parent.cy + dist * Math.sin(theta / DEG)
      const pitchA = 360 / parent.teeth
      const pitchB = 360 / def.teeth
      // Forældrehjulets nærmeste tand i retning theta ligger ved theta - delta.
      const delta = normalizeDeg(theta - parent.phase, pitchA)
      // I den justerede stilling skal B have et mellemrum, der peger mod A (theta + 180).
      const phase = theta + 180 + pitchB / 2 + (delta * parent.teeth) / def.teeth
      spec = {
        ...base,
        cx,
        cy,
        phase: ((phase % 360) + 360) % 360,
        dir: parent.dir === 1 ? -1 : 1,
        speed: (parent.speed * parent.teeth) / def.teeth,
        meshWith: parent.id,
        coaxialWith: null,
      }
    } else if ('coaxialWith' in def) {
      const parent = byId.get(def.coaxialWith)
      if (!parent) throw new Error(`Ukendt akselhjul: ${def.coaxialWith}`)
      spec = {
        ...base,
        cx: parent.cx,
        cy: parent.cy,
        phase: 0,
        dir: parent.dir,
        speed: parent.speed,
        meshWith: null,
        coaxialWith: parent.id,
      }
    } else {
      spec = { ...base, cx: 0, cy: 0, phase: 0, dir: 1, speed: 1, meshWith: null, coaxialWith: null }
    }

    byId.set(spec.id, spec)
    out.push(spec)
  }
  return out
}

/** Selve urværket: 6 hjul — 4 i forreste lag, 2 i bageste lag (kompoundhjul på G1's aksel). */
export const TRAIN_DEFS: readonly TrainDef[] = [
  { id: 'drive', teeth: 22 },
  { id: 'p1', teeth: 11, meshWith: 'drive', angle: -32 },
  { id: 'p2', teeth: 13, meshWith: 'drive', angle: 203 },
  { id: 'p3', teeth: 9, meshWith: 'drive', angle: 96 },
  { id: 'w4', teeth: 20, layer: 'back', coaxialWith: 'p1' },
  { id: 'p5', teeth: 10, layer: 'back', meshWith: 'w4', angle: 92 },
]

export const TRAIN: readonly GearSpec[] = buildTrain(TRAIN_DEFS)

/** Omdrejningstid for drivhjulet i sekunder. */
export const DRIVE_PERIOD_S = 16

export function periodFor(spec: GearSpec): number {
  return DRIVE_PERIOD_S / spec.speed
}

/**
 * Geometrisk indgrebstest: hver tandspids på A, der rager ind i B's tandzone,
 * skal ligge i et mellemrum på B (og omvendt). Returnerer en liste af problemer.
 */
export function meshProblems(
  a: GearSpec,
  b: GearSpec,
  rootFraction = TOOTH_ROOT_FRACTION,
  tipFraction = TOOTH_TIP_FRACTION,
): string[] {
  const problems: string[] = []
  const check = (from: GearSpec, to: GearSpec) => {
    const pitchFrom = 360 / from.teeth
    const pitchTo = 360 / to.teeth
    for (let k = 0; k < from.teeth; k++) {
      const center = from.phase + k * pitchFrom
      for (const corner of [-1, 1]) {
        const ang = (center + (corner * (pitchFrom * tipFraction)) / 2) / DEG
        const px = from.cx + from.outerR * Math.cos(ang)
        const py = from.cy + from.outerR * Math.sin(ang)
        const dx = px - to.cx
        const dy = py - to.cy
        const rho = Math.hypot(dx, dy)
        if (rho >= to.outerR) continue // uden for B's tandzone
        if (rho < to.rootR) {
          problems.push(`${from.id} tand ${k} rammer ${to.id}'s rod (rho=${rho.toFixed(2)})`)
          continue
        }
        // B's tandhalvbredde ved denne radius (trapez: bredest ved roden)
        const t = (rho - to.rootR) / (to.outerR - to.rootR)
        const halfWidth = (pitchTo * (rootFraction + (tipFraction - rootFraction) * t)) / 2
        const beta = Math.atan2(dy, dx) * DEG
        const offset = Math.abs(normalizeDeg(beta - to.phase, pitchTo))
        if (offset < halfWidth) {
          problems.push(
            `${from.id} tand ${k} kolliderer med ${to.id} (offset ${offset.toFixed(2)}° < ${halfWidth.toFixed(2)}°)`,
          )
        }
      }
    }
  }
  check(a, b)
  check(b, a)
  return problems
}
