import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { LEVELS, getLevel } from '../../data/levels'
import { simulate } from './simulate'
import { solveLevel } from './solver'
import { BALL_TYPES } from './constants'
import { inventoryTypes } from '../game/inventory'
import type { BallType, PlacedPiece } from '../types'

type ReportExample = { ballType: string; placements: PlacedPiece[] }
type SolverReport = {
  allSolvable: boolean
  anyTrivial: boolean
  levels: { levelId: string; example: ReportExample | null }[]
}
const report = JSON.parse(
  readFileSync(resolve(process.cwd(), 'solver-report.json'), 'utf8'),
) as SolverReport

/** Full fingerprint of a run — result, reason, step count, and every ball frame. */
function fingerprint(level: (typeof LEVELS)[number], placements: PlacedPiece[], ball: BallType): string {
  const r = simulate(level, placements, ball)
  return JSON.stringify([r.result, r.reason, r.steps, r.trajectory])
}

describe('deterministic simulation', () => {
  const level = LEVELS[0]!
  const placements: PlacedPiece[] = [{ slotId: 'a', type: 'ramp', rotation: 2 }]

  it('produces a bit-identical trajectory and result across two runs', () => {
    const a = simulate(level, placements, 'iron')
    const b = simulate(level, placements, 'iron')
    expect(a.result).toBe(b.result)
    expect(a.reason).toBe(b.reason)
    expect(a.steps).toBe(b.steps)
    expect(a.trajectory.length).toBe(b.trajectory.length)
    // Bit-identical: JSON of every float (position + spin) matches exactly.
    expect(JSON.stringify(a.trajectory)).toBe(JSON.stringify(b.trajectory))
  })

  it('is deterministic for every level, placement, and ball type', () => {
    for (const lvl of LEVELS) {
      const candidates: PlacedPiece[][] = [[]]
      for (const slot of lvl.slots) {
        for (const type of inventoryTypes(lvl)) {
          for (let rot = 0; rot < 8; rot++) {
            candidates.push([{ slotId: slot.id, type, rotation: rot }])
          }
        }
      }
      for (const ball of BALL_TYPES) {
        for (const placement of candidates) {
          expect(fingerprint(lvl, placement, ball), `${lvl.id} ${ball} ${JSON.stringify(placement)}`).toBe(
            fingerprint(lvl, placement, ball),
          )
        }
      }
    }
  })

  it('different ball types generally produce different trajectories', () => {
    const iron = simulate(level, placements, 'iron')
    const basketball = simulate(level, placements, 'basketball')
    expect(JSON.stringify(iron.trajectory)).not.toBe(JSON.stringify(basketball.trajectory))
  })

  it('does not depend on the order of the placements array', () => {
    const lvl = LEVELS.find((l) => l.slots.length >= 2)!
    const types = inventoryTypes(lvl)
    const p1: PlacedPiece = { slotId: lvl.slots[0]!.id, type: types[0]!, rotation: 1 }
    const p2: PlacedPiece = { slotId: lvl.slots[1]!.id, type: types[0]!, rotation: 3 }
    expect(fingerprint(lvl, [p1, p2], 'iron')).toBe(fingerprint(lvl, [p2, p1], 'iron'))
  })
})

describe('shipped level pack', () => {
  // The exhaustive search lives in `npm run solve:levels` (which writes the
  // report below). These tests cross-check the committed report against the
  // current physics + levels, and stay fast.

  it('the solver report marks every level solvable and non-trivial', () => {
    expect(report.levels.length).toBe(LEVELS.length)
    expect(report.allSolvable, 'report.allSolvable').toBe(true)
    expect(report.anyTrivial, 'report.anyTrivial').toBe(false)
  })

  it("each level's recorded example solution still wins (report vs. live physics)", () => {
    for (const entry of report.levels) {
      const level = getLevel(entry.levelId)
      expect(level, `level ${entry.levelId} exists`).toBeTruthy()
      expect(entry.example, `${entry.levelId} has an example`).toBeTruthy()
      const ex = entry.example!
      const result = simulate(level!, ex.placements, ex.ballType as BallType).result
      expect(result, `${entry.levelId} recorded solution should win — re-run npm run solve:levels`).toBe('won')
    }
  })

  it('no level can be won with an empty placement on any ball (each is a real puzzle)', () => {
    for (const lvl of LEVELS) {
      for (const ball of BALL_TYPES) {
        expect(simulate(lvl, [], ball).result, `${lvl.id} must not win empty on ${ball}`).not.toBe('won')
      }
    }
  })

  it('the solver produces a winning solution for the first level', () => {
    const l1 = LEVELS[0]!
    const rep = solveLevel(l1, { maxSolutions: 1 })
    expect(rep.solvable).toBe(true)
    const ex = rep.example!
    expect(simulate(l1, ex.placements, ex.ballType).result).toBe('won')
  })
})
