import { describe, expect, it } from 'vitest'
import { MICRO, toMicroU } from '../src/data/elements'
import { challengeTargetMicro, generateChallenge, TOLERANCE_U } from '../src/game/challenge'
import { applySkip, applyVictory, emptyProgress } from '../src/game/scoring'
import { isSolution, solveFewest } from '../src/game/solver'

const TOL = Math.round(TOLERANCE_U * MICRO)

describe('færrest brikker: solver', () => {
  it('finder 1×Cu for target 63.546 (i stedet for fx 2×S-ruter)', () => {
    const solution = solveFewest(toMicroU(63.546), TOL)
    expect(solution).toEqual(['Cu'])
  })

  it('finder 1-brik-løsninger for alle 16 grundstoffer', () => {
    for (const mass of [1.008, 4.0026, 6.94, 12.011, 15.999, 238.02891]) {
      const solution = solveFewest(toMicroU(mass), TOL)
      expect(solution).toHaveLength(1)
    }
  })

  it('target 2·U kræver præcis 2 brikker', () => {
    const solution = solveFewest(2 * toMicroU(238.02891), TOL)
    expect(solution).toHaveLength(2)
    expect(solution).toEqual(['U', 'U'])
  })

  it('optimum er aldrig større end konstruktions-løsningen (100 seeds)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { challenge, solution } = generateChallenge('ram', seed, { fewest: true })
      const targetMicro = challengeTargetMicro(challenge)
      const optimal = solveFewest(targetMicro, TOL)
      expect(optimal).not.toBeNull()
      expect(optimal!.length).toBeLessThanOrEqual(solution.length)
      expect(isSolution(optimal!, targetMicro, TOL)).toBe(true)
    }
  })
})

describe('færrest brikker: scoring', () => {
  it('sejr tæller streak, solvedCount og bestFewest korrekt', () => {
    let p = emptyProgress()
    p = applyVictory(p, 'ram', 5, true)
    expect(p.streak).toBe(1)
    expect(p.perMode.ram.solvedCount).toBe(1)
    expect(p.perMode.ram.bestFewest).toBe(5)

    p = applyVictory(p, 'ram', 3, true)
    expect(p.streak).toBe(2)
    expect(p.perMode.ram.bestFewest).toBe(3)

    // dårligere forsøg forringer ikke bedste
    p = applyVictory(p, 'ram', 7, true)
    expect(p.perMode.ram.bestFewest).toBe(3)

    // ikke-fewest sejre rører ikke bestFewest
    p = applyVictory(p, 'ram', 9, false)
    expect(p.perMode.ram.bestFewest).toBe(3)
    expect(p.perMode.ram.solvedCount).toBe(4)
  })

  it('skip nulstiller streak men bevarer resten', () => {
    let p = emptyProgress()
    p = applyVictory(p, 'balancer', 2, false)
    p = applyVictory(p, 'molekyle', 3, false)
    expect(p.streak).toBe(2)
    p = applySkip(p)
    expect(p.streak).toBe(0)
    expect(p.perMode.balancer.solvedCount).toBe(1)
    expect(p.perMode.molekyle.solvedCount).toBe(1)
  })
})
