import { describe, expect, it } from 'vitest'
import { ISLANDS, factsForLevel } from './islands'
import { buildRound } from '../engine/roundBuilder'
import { makeRng } from '../engine/rng'

describe('islands', () => {
  it('every level can actually be filled with tasks', () => {
    ISLANDS.forEach((island, islandIndex) => {
      for (const level of island.levels) {
        const pool = factsForLevel(level, islandIndex)
        // small pools are fine on the first levels (counting to five is five
        // facts) — the round builder repeats them — but never down to one or two
        expect(`${level.id} har ${pool.length} regnestykker`).toBe(
          `${level.id} har ${Math.max(pool.length, 3)} regnestykker`,
        )

        const round = buildRound({
          facts: pool, states: {}, roundIndex: 0, size: level.size,
          kinds: level.kinds, rng: makeRng(1),
        })
        expect(round).toHaveLength(level.size)
        for (const task of round) expect(level.kinds).toContain(task.kind)
        for (let i = 1; i < round.length; i++)
          expect(`${level.id}[${i}]`).not.toBe(
            round[i].factId === round[i - 1].factId ? `${level.id}[${i}]` : '',
          )
      }
    })
  })

  it('festival rounds reach back into the earlier islands', () => {
    const broIndex = ISLANDS.findIndex((i) => i.id === 'bro')
    const festival = ISLANDS[broIndex].levels.find((l) => l.festival)!
    const skills = new Set(factsForLevel(festival, broIndex).map((f) => f.skill))
    expect(skills.has('addTo10')).toBe(true)
    expect(skills.has('addTo20')).toBe(true)
  })

  it('has unique ids all the way down', () => {
    expect(new Set(ISLANDS.map((i) => i.id)).size).toBe(ISLANDS.length)
    const levels = ISLANDS.flatMap((i) => i.levels.map((l) => l.id))
    expect(new Set(levels).size).toBe(levels.length)
    const species = ISLANDS.flatMap((i) => i.species.map((s) => s.id))
    expect(new Set(species).size).toBe(species.length)
  })
})
