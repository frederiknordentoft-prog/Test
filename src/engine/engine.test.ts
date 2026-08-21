import { describe, expect, it } from 'vitest'
import { factsFor, factsForSkills } from './facts'
import { distractorsFor } from './distractors'
import { buildTask } from './tasks'
import { buildRound } from './roundBuilder'
import { emptyState, isDue, masteryOf, updateFactState } from './mastery'
import { hashSeed, makeRng } from './rng'
import type { Fact, FactStates, SkillId } from './types'

const ALL_SKILLS: SkillId[] = [
  'count', 'neighbour', 'addTo10', 'subTo10', 'tenFriends', 'doubles',
  'halves', 'addTo20', 'subTo20', 'tensAndOnes', 'addTo100', 'subTo100',
]

/** The arithmetic truth, written independently of the generator. */
function expectedAnswer(f: Fact): number {
  switch (f.skill) {
    case 'count': return f.a
    case 'neighbour': return f.a + f.b
    case 'addTo10': case 'addTo20': case 'addTo100': return f.a + f.b
    case 'subTo10': case 'subTo20': case 'subTo100': return f.a - f.b
    case 'tenFriends': return 10 - f.a
    case 'doubles': return f.a * 2
    case 'halves': return f.a / 2
    case 'tensAndOnes': return f.a * 10 + f.b
  }
}

describe('facts', () => {
  it('every single fact has the right answer', () => {
    for (const skill of ALL_SKILLS)
      for (const f of factsFor(skill))
        expect(`${f.id} = ${f.answer}`).toBe(`${f.id} = ${expectedAnswer(f)}`)
  })

  it('no fact id is reused for two different sums', () => {
    const byId = new Map<string, Fact>()
    for (const skill of ALL_SKILLS)
      for (const f of factsFor(skill)) {
        const seen = byId.get(f.id)
        if (seen) expect([seen.a, seen.b, seen.answer]).toEqual([f.a, f.b, f.answer])
        else byId.set(f.id, f)
      }
  })

  it('never produces a negative answer', () => {
    for (const skill of ALL_SKILLS)
      for (const f of factsFor(skill)) expect(f.answer).toBeGreaterThanOrEqual(0)
  })

  it('the crossing-the-ten skills only contain sums that actually cross', () => {
    for (const f of factsFor('addTo20')) expect(f.answer).toBeGreaterThan(10)
    for (const f of factsFor('subTo20')) {
      expect(f.a).toBeGreaterThan(10)
      expect(f.answer).toBeLessThan(10)
    }
  })

  it('is sorted easiest first', () => {
    for (const skill of ALL_SKILLS) {
      const ranks = factsFor(skill).map((f) => f.rank)
      expect(ranks).toEqual(ranks.slice().sort((a, b) => a - b))
    }
  })
})

describe('distractors', () => {
  it('are always usable wrong answers, for every fact in the app', () => {
    for (const skill of ALL_SKILLS)
      for (const f of factsFor(skill)) {
        const rng = makeRng(hashSeed(f.id))
        const wrong = distractorsFor(f, 2, rng, [0, Math.max(20, f.answer + 20)])
        expect(wrong).toHaveLength(2)
        expect(new Set(wrong).size).toBe(2)
        for (const w of wrong) {
          expect(w).not.toBe(f.answer)
          expect(w).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(w)).toBe(true)
        }
      }
  })

  it('includes a near miss so the child has to do the maths', () => {
    for (const f of factsFor('addTo20')) {
      const wrong = distractorsFor(f, 2, makeRng(hashSeed(f.id)), [0, 20])
      expect(wrong.some((w) => Math.abs(w - f.answer) <= 2)).toBe(true)
    }
  })

  it('offers the swapped-digits mistake on tens and ones', () => {
    const fact = factsFor('tensAndOnes').find((f) => f.a === 4 && f.b === 3)!
    const wrong = distractorsFor(fact, 2, makeRng(1), [0, 100])
    expect(fact.answer).toBe(43)
    // 34 is the mistake worth offering; it must at least be a legal candidate
    const all = new Set<number>()
    for (let s = 0; s < 40; s++) for (const w of distractorsFor(fact, 2, makeRng(s), [0, 100])) all.add(w)
    expect(all.has(34)).toBe(true)
    expect(wrong).not.toContain(43)
  })
})

describe('tasks', () => {
  it('choice tasks hold the answer exactly once', () => {
    for (const skill of ALL_SKILLS)
      for (const f of factsFor(skill)) {
        const task = buildTask(f, 'choice', makeRng(hashSeed(f.id)), 0)
        expect(task.options).toHaveLength(3)
        expect(task.options.filter((o) => o === task.answer)).toHaveLength(1)
        expect(new Set(task.options).size).toBe(3)
      }
  })

  it('always has something to say out loud', () => {
    for (const skill of ALL_SKILLS)
      for (const f of factsFor(skill)) {
        const task = buildTask(f, 'choice', makeRng(1), 0)
        expect(task.speech.length).toBeGreaterThan(3)
        expect(task.speech).not.toContain('undefined')
      }
  })

  it('is reproducible from its seed', () => {
    const f = factsFor('addTo20')[5]
    expect(buildTask(f, 'choice', makeRng(42), 0)).toEqual(buildTask(f, 'choice', makeRng(42), 0))
  })
})

describe('mastery', () => {
  const FAST = 5000

  it('promotes a quick correct answer', () => {
    expect(updateFactState(undefined, true, 1200, 1, FAST).box).toBe(1)
  })

  it('holds position when the answer is right but slow — knowing is not recalling', () => {
    const at3 = { ...emptyState(), box: 3, seen: 4 }
    expect(updateFactState(at3, true, 11000, 5, FAST).box).toBe(3)
  })

  it('drops two boxes on a mistake, never all the way to zero from the top', () => {
    const at5 = { ...emptyState(), box: 5, seen: 9 }
    expect(updateFactState(at5, false, 3000, 5, FAST).box).toBe(3)
    const at1 = { ...emptyState(), box: 1, seen: 2 }
    expect(updateFactState(at1, false, 3000, 5, FAST).box).toBe(0)
  })

  it('rests a well-known fact for longer than a shaky one', () => {
    const solid = { ...emptyState(), box: 5, lastRound: 10 }
    const shaky = { ...emptyState(), box: 1, lastRound: 10 }
    expect(isDue(shaky, 11)).toBe(true)
    expect(isDue(solid, 11)).toBe(false)
    expect(isDue(solid, 26)).toBe(true)
  })

  it('reports mastery as a fraction of the whole set', () => {
    const states: FactStates = { a: { ...emptyState(), box: 5 }, b: { ...emptyState(), box: 0 } }
    expect(masteryOf(['a', 'b'], states)).toBe(0.5)
    expect(masteryOf([], states)).toBe(0)
  })
})

describe('round building', () => {
  const pool = factsForSkills(['addTo10', 'subTo10'])

  it('always fills the round', () => {
    for (let seed = 0; seed < 25; seed++) {
      const round = buildRound({ facts: pool, states: {}, roundIndex: 0, size: 10, kinds: ['choice'], rng: makeRng(seed) })
      expect(round).toHaveLength(10)
    }
  })

  it('never asks the same fact twice in one round', () => {
    for (let seed = 0; seed < 25; seed++) {
      const round = buildRound({ facts: pool, states: {}, roundIndex: 0, size: 10, kinds: ['choice'], rng: makeRng(seed) })
      expect(new Set(round.map((t) => t.factId)).size).toBe(10)
    }
  })

  it('opens with something the child can already do', () => {
    const states: FactStates = {}
    for (const f of pool.slice(0, 6)) states[f.id] = { ...emptyState(), box: 5, seen: 8, correct: 8, lastRound: 0 }
    for (const f of pool.slice(6, 20)) states[f.id] = { ...emptyState(), box: 1, seen: 3, correct: 1, lastRound: 0 }

    for (let seed = 0; seed < 25; seed++) {
      const round = buildRound({ facts: pool, states, roundIndex: 5, size: 10, kinds: ['choice'], rng: makeRng(seed) })
      expect(states[round[0].factId].box).toBeGreaterThanOrEqual(3)
    }
  })

  it('mixes roughly two solid, five shaky and three new', () => {
    const states: FactStates = {}
    for (const f of pool.slice(0, 8)) states[f.id] = { ...emptyState(), box: 5, seen: 9, correct: 9, lastRound: 0 }
    for (const f of pool.slice(8, 25)) states[f.id] = { ...emptyState(), box: 1, seen: 3, correct: 1, lastRound: 0 }

    const round = buildRound({ facts: pool, states, roundIndex: 1, size: 10, kinds: ['choice'], rng: makeRng(7) })
    const box = (id: string) => states[id]?.box
    expect(round.filter((t) => box(t.factId) === undefined)).toHaveLength(3)
    expect(round.filter((t) => box(t.factId) === 5)).toHaveLength(2)
    expect(round.filter((t) => box(t.factId) === 1)).toHaveLength(5)
  })

  it('does not park the right answer in the same slot three times running', () => {
    for (let seed = 0; seed < 40; seed++) {
      const round = buildRound({ facts: pool, states: {}, roundIndex: 0, size: 10, kinds: ['choice'], rng: makeRng(seed) })
      let run = 1
      for (let i = 1; i < round.length; i++) {
        const here = round[i].options.indexOf(round[i].answer)
        const before = round[i - 1].options.indexOf(round[i - 1].answer)
        run = here === before ? run + 1 : 1
        expect(run).toBeLessThan(3)
      }
    }
  })

  it('is reproducible from its seed', () => {
    const opts = { facts: pool, states: {}, roundIndex: 0, size: 10, kinds: ['choice'] as const }
    expect(buildRound({ ...opts, rng: makeRng(99) })).toEqual(buildRound({ ...opts, rng: makeRng(99) }))
  })

  it('only uses presentations that fit the skill', () => {
    const tenPool = factsFor('tenFriends')
    const round = buildRound({ facts: tenPool, states: {}, roundIndex: 0, size: 8, kinds: ['pair', 'choice'], rng: makeRng(3) })
    for (const t of round) expect(['pair', 'choice']).toContain(t.kind)
    const countRound = buildRound({ facts: factsFor('count'), states: {}, roundIndex: 0, size: 8, kinds: ['count', 'choice'], rng: makeRng(3) })
    for (const t of countRound) expect(['count', 'choice']).toContain(t.kind)
  })
})
