import type { ComponentId, Pips } from '../content/model'
import { COMPONENTS, CORE_ID } from '../content/model'

export type Side = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'

export type View = { rx: number; ry: number }

export type Hinge = 'right' | 'bottom' | 'top'

export type FaceDef = {
  side: Side
  pips: Pips
  /** fladens orientering i terningens koordinatsystem (uden translateZ) */
  rotation: string
  /** kameravinkel, der bringer fladen frontalt i et ¾-perspektiv */
  view: View
  /** hvilken kant fladen svinger om, når den åbnes */
  hinge: Hinge
}

/**
 * En rigtig terning: modstående sider giver 7. Standardvisningen viser
 * top (3), front (1) og højre (2) — så de tre første komponenter ses først.
 */
export const FACES: readonly FaceDef[] = [
  { side: 'front', pips: 1, rotation: 'rotateX(0deg) rotateY(0deg)', view: { rx: -22, ry: -34 }, hinge: 'right' },
  { side: 'right', pips: 2, rotation: 'rotateX(0deg) rotateY(90deg)', view: { rx: -22, ry: -124 }, hinge: 'right' },
  { side: 'top', pips: 3, rotation: 'rotateX(90deg) rotateY(0deg)', view: { rx: -62, ry: -14 }, hinge: 'bottom' },
  { side: 'bottom', pips: 4, rotation: 'rotateX(-90deg) rotateY(0deg)', view: { rx: 68, ry: -14 }, hinge: 'top' },
  { side: 'left', pips: 5, rotation: 'rotateX(0deg) rotateY(-90deg)', view: { rx: -22, ry: 56 }, hinge: 'right' },
  { side: 'back', pips: 6, rotation: 'rotateX(0deg) rotateY(180deg)', view: { rx: -22, ry: -214 }, hinge: 'right' },
]

/**
 * Fast funktionsliste per flade, så CSS kan interpolere mellem alle tilstande:
 * orientering → skub ud (translateZ) → sving om hængselkanten (--swing).
 * Siderne svinger om højre kant; låg og bund svinger om den kant, der vender mod kameraet.
 */
export function faceTransform(face: FaceDef): string {
  const base = `${face.rotation} translateZ(var(--tz))`
  switch (face.hinge) {
    case 'right':
      return `${base} translateX(50%) rotateY(var(--swing)) translateX(-50%)`
    case 'bottom':
      return `${base} translateY(50%) rotateX(calc(-1 * var(--swing))) translateY(-50%)`
    case 'top':
      return `${base} translateY(-50%) rotateX(var(--swing)) translateY(50%)`
  }
}

export const VIEW_ASSEMBLED: View = { rx: -24, ry: -36 }
export const VIEW_EXPLODED: View = { rx: -28, ry: -42 }

/** Hvor langt fladerne skydes ud i eksploderet tilstand (faktor af halv sidelængde). */
export const EXPLODE_FACTOR = 1.9

/**
 * Åbningsvinkel om hængselkanten (højre kant). Positiv = den frie kant svinger
 * udad mod beskueren, så fladens forside stadig vender mod kameraet i alle seks ¾-visninger.
 */
export const SWING_DEG = 52

/** Urværkets faste resthældning i forhold til kameraet (grader) — giver dybde uden kantstilling. */
export const CLOCK_TILT: View = { rx: 9, ry: -16 }

/**
 * Urværkets skala når terningen er samlet. Boksen (inkl. gløden) skal ligge helt inden
 * for den indskrevne kugle, så dens plan ikke skærer fladerne (det giver synlige sømme).
 */
export const CLOCK_SCALE_ASSEMBLED = 0.5

const FACE_BY_ID = new Map<ComponentId, FaceDef>()
const ID_BY_PIPS = new Map<Pips, ComponentId>()
for (const c of COMPONENTS) {
  if (c.pips === null) continue
  const face = FACES.find((f) => f.pips === c.pips)
  if (!face) throw new Error(`Ingen flade for ${c.pips} øjne`)
  FACE_BY_ID.set(c.id, face)
  ID_BY_PIPS.set(c.pips, c.id)
}

export function faceForComponent(id: ComponentId): FaceDef | null {
  return FACE_BY_ID.get(id) ?? null
}

export function componentForPips(pips: Pips): ComponentId {
  const id = ID_BY_PIPS.get(pips)
  if (!id) throw new Error(`Ingen komponent med ${pips} øjne`)
  return id
}

/** Kameravinkel for en given tilstand. */
export function viewFor(stage: 'assembled' | 'exploded', open: ComponentId | null): View {
  if (open && open !== CORE_ID) {
    const face = faceForComponent(open)
    if (face) return face.view
  }
  return stage === 'assembled' ? VIEW_ASSEMBLED : VIEW_EXPLODED
}

/** Vælger den repræsentation af target (± k·360) der ligger nærmest current, så terningen drejer korteste vej. */
export function nearestAngle(target: number, current: number): number {
  const k = Math.round((current - target) / 360)
  return target + k * 360
}

/** Terningeøjne på et 3×3-gitter (række, kolonne), som på en rigtig terning. */
export function pipLayout(pips: Pips): ReadonlyArray<readonly [number, number]> {
  const C: readonly [number, number] = [1, 1]
  const TL: readonly [number, number] = [0, 0]
  const TR: readonly [number, number] = [0, 2]
  const BL: readonly [number, number] = [2, 0]
  const BR: readonly [number, number] = [2, 2]
  const ML: readonly [number, number] = [1, 0]
  const MR: readonly [number, number] = [1, 2]
  switch (pips) {
    case 1:
      return [C]
    case 2:
      return [TL, BR]
    case 3:
      return [TL, C, BR]
    case 4:
      return [TL, TR, BL, BR]
    case 5:
      return [TL, TR, C, BL, BR]
    case 6:
      return [TL, ML, BL, TR, MR, BR]
  }
}
