import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../data/levels'
import { simulate } from './simulate'
import { solveLevel } from './solver'
import { inventoryTypes } from '../game/inventory'
import type { PlacedPiece } from '../types'

/** Full fingerprint of a run — result, reason, step count, and every ball position. */
function fingerprint(level: (typeof LEVELS)[number], placements: PlacedPiece[]): string {
  const r = simulate(level, placements)
  return JSON.stringify([r.result, r.reason, r.steps, r.trajectory])
}

describe('deterministic simulation', () => {
  const level = LEVELS[0]!
  const placements: PlacedPiece[] = [{ slotId: 'a', type: 'ramp', rotation: 2 }]

  it('produces a bit-identical trajectory and result across two runs', () => {
    const a = simulate(level, placements)
    const b = simulate(level, placements)
    expect(a.result).toBe(b.result)
    expect(a.reason).toBe(b.reason)
    expect(a.steps).toBe(b.steps)
    expect(a.trajectory.length).toBe(b.trajectory.length)
    // Bit-identical: JSON of every float matches exactly.
    expect(JSON.stringify(a.trajectory)).toBe(JSON.stringify(b.trajectory))
  })

  it('is deterministic for every shipped level and placement', () => {
    for (const lvl of LEVELS) {
      const candidates: PlacedPiece[][] = [[]]
      for (const slot of lvl.slots) {
        for (const type of inventoryTypes(lvl)) {
          for (let rot = 0; rot < 4; rot++) {
            candidates.push([{ slotId: slot.id, type, rotation: rot }])
          }
        }
      }
      for (const placement of candidates) {
        expect(fingerprint(lvl, placement), `${lvl.id} ${JSON.stringify(placement)}`).toBe(
          fingerprint(lvl, placement),
        )
      }
    }
  })

  it('does not depend on the order of the placements array', () => {
    const lvl = LEVELS.find((l) => l.slots.length >= 2)!
    const types = inventoryTypes(lvl)
    const p1: PlacedPiece = { slotId: lvl.slots[0]!.id, type: types[0]!, rotation: 1 }
    const p2: PlacedPiece = { slotId: lvl.slots[1]!.id, type: types[0]!, rotation: 3 }
    expect(fingerprint(lvl, [p1, p2])).toBe(fingerprint(lvl, [p2, p1]))
  })
})

describe('shipped level pack', () => {
  it('every level is solvable with at least one example solution', () => {
    for (const lvl of LEVELS) {
      const rep = solveLevel(lvl, { maxSolutions: 5 })
      expect(rep.solvable, `${lvl.id} (${lvl.name}) should be solvable`).toBe(true)
      expect(rep.example, `${lvl.id} should have an example`).not.toBeNull()
    }
  })

  it("the solver's example solution actually wins when simulated", () => {
    for (const lvl of LEVELS) {
      const rep = solveLevel(lvl, { maxSolutions: 1 })
      const result = simulate(lvl, rep.example!).result
      expect(result, `${lvl.id} example should win`).toBe('won')
    }
  })

  it('no level can be won with an empty placement (each is a real puzzle)', () => {
    for (const lvl of LEVELS) {
      expect(simulate(lvl, []).result, `${lvl.id} must not win empty`).not.toBe('won')
    }
  })
})
