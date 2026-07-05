import { describe, expect, it } from 'vitest'
import { MICRO } from '../src/data/elements'
import {
  challengeTargetMicro,
  generateChallenge,
} from '../src/game/challenge'
import { isSolution } from '../src/game/solver'
import type { Mode } from '../src/game/types'

const MODES: Mode[] = ['balancer', 'ram', 'molekyle']
const SEEDS = 500

describe('solvability: hver genereret challenge har en løsning fra tray’en', () => {
  for (const mode of MODES) {
    it(`${mode}: ${SEEDS} tilfældige seeds`, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const { challenge, solution } = generateChallenge(mode, seed, {
          fewest: seed % 2 === 0,
        })
        const targetMicro = challengeTargetMicro(challenge)
        const tolMicro = Math.round(challenge.toleranceU * MICRO)

        expect(solution.length).toBeGreaterThan(0)
        // Den konstruerede løsning består KUN af tray-grundstoffer og rammer målet
        expect(isSolution(solution, targetMicro, tolMicro)).toBe(true)
        // Målet er positivt og endeligt
        expect(targetMicro).toBeGreaterThan(0)
        expect(Number.isFinite(targetMicro)).toBe(true)
      }
    })
  }

  it('molekyle-løsningen er præcis molekylets atomer (eksakt, tolerance 0)', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { challenge, solution } = generateChallenge('molekyle', seed)
      const targetMicro = challengeTargetMicro(challenge)
      expect(isSolution(solution, targetMicro, 0)).toBe(true)
    }
  })

  it('fri leg genererer en tom, åben vægt', () => {
    const { challenge } = generateChallenge('fri', 1)
    expect(challenge.fixedSide).toHaveLength(0)
    expect(challenge.targetMass).toBeNull()
  })
})
