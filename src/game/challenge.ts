import { ELEMENTS, MICRO, toMicroU, type Element } from '../data/elements'
import { MOLECULES, type Molecule } from '../data/molecules'
import { mulberry32, pick, randInt } from './rng'
import type { Challenge, Mode, Tile } from './types'

export const TOLERANCE_U = 0.6
/**
 * I molekyle-mode er sejren låst til de RIGTIGE atomer (eksakt multiset),
 * så tolerancen er kun visuel generøsitet for bjælken.
 */
export const MOLECULE_TOLERANCE_U = 0.3

let tileCounter = 0
function makeElementTile(el: Element, prefix: string): Tile {
  return { id: `${prefix}-${el.symbol}-${tileCounter++}`, kind: 'element', element: el }
}
function makeMoleculeTile(m: Molecule, prefix: string): Tile {
  return { id: `${prefix}-${m.formula}-${tileCounter++}`, kind: 'molecule', molecule: m }
}

export type GeneratedChallenge = {
  challenge: Challenge
  /** Kendt løsning (grundstofsymboler til spillersiden) — findes pr. konstruktion. */
  solution: string[]
}

/**
 * Challenges genereres BY CONSTRUCTION: løsnings-multisettet trækkes først,
 * og udfordringen afledes af det. Dermed er hver challenge løselig pr. design.
 */
export function generateChallenge(
  mode: Mode,
  seed: number,
  opts: { fewest?: boolean } = {},
): GeneratedChallenge {
  const rng = mulberry32(seed)

  switch (mode) {
    case 'fri':
      return {
        challenge: {
          mode,
          fixedSide: [],
          fixedSideOf: 'left',
          targetMass: null,
          toleranceU: TOLERANCE_U,
          seed,
        },
        solution: [],
      }

    case 'balancer': {
      const k = 2 + randInt(rng, 4) // 2..5 brikker
      const picked: Element[] = []
      for (let i = 0; i < k; i++) picked.push(pick(rng, ELEMENTS))
      return {
        challenge: {
          mode,
          fixedSide: picked.map((el) => makeElementTile(el, 'fixed')),
          fixedSideOf: 'left',
          targetMass: null,
          toleranceU: TOLERANCE_U,
          seed,
        },
        solution: picked.map((el) => el.symbol),
      }
    }

    case 'ram': {
      const k = 2 + randInt(rng, 5) // 2..6 brikker
      const picked: Element[] = []
      for (let i = 0; i < k; i++) picked.push(pick(rng, ELEMENTS))
      const targetMicro = picked.reduce((s, el) => s + toMicroU(el.mass), 0)
      return {
        challenge: {
          mode,
          fixedSide: [],
          fixedSideOf: 'left',
          targetMass: targetMicro / MICRO,
          fewestMode: opts.fewest ?? false,
          toleranceU: TOLERANCE_U,
          seed,
        },
        solution: picked.map((el) => el.symbol),
      }
    }

    case 'molekyle': {
      const molecule = pick(rng, MOLECULES)
      const solution: string[] = []
      for (const [symbol, count] of Object.entries(molecule.atoms)) {
        for (let i = 0; i < count; i++) solution.push(symbol)
      }
      return {
        challenge: {
          mode,
          fixedSide: [makeMoleculeTile(molecule, 'fixed')],
          fixedSideOf: 'left',
          targetMass: null,
          toleranceU: MOLECULE_TOLERANCE_U,
          molecule,
          seed,
        },
        solution,
      }
    }
  }
}

/** Målmassen i mikro-u for en challenge (fixed side-sum eller targetMass). */
export function challengeTargetMicro(c: Challenge): number {
  if (c.targetMass !== null) return Math.round(c.targetMass * MICRO)
  let sum = 0
  for (const t of c.fixedSide) {
    sum += t.kind === 'element' ? toMicroU(t.element.mass) : toMicroU(t.molecule.molarMass)
  }
  return sum
}
