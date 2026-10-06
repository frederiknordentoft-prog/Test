import { describe, expect, it } from 'vitest'
import {
  classifyAnswer, detectableOf, digitSwapOf, digitSwapPossible, flaggedIds, halfTail, meetsFlag, misconceptionEvents, natureFor,
  promptNumbers, swapDisambiguated, swappedAnswer, updateMisconceptions, type MisconceptionStates,
} from './misconceptions'
import { buildTask } from './tasks'
import { FIXTURE_SKILLS, add100CarryFixture, addTo10Fixture, hear20Fixture, weightCompareFixture } from './testing/fixtureSkills'
import type { SkillModule } from './skills/types'
import { isProduction } from './kinds'
import { isCorrect } from './answer'
import { hashSeed, makeRng, type Rng } from './rng'
import {
  MISCONCEPTION_IDS, type AnswerLogEntry, type AnswerValue, type Candidate, type ErrorTag, type Fact, type MisconceptionId, type SkillDef, type Task,
  type TaskKind,
} from './types'
import { MISCONCEPTION_TEXTS } from '../content/misconceptionTexts'
import { factsOf, registeredSkills } from './registry'

const DAY0 = Date.parse('2026-09-01T10:00:00Z')
const dayOf = (n: number) => new Date(DAY0 + n * 86_400_000).toISOString().slice(0, 10)
const carry = (a: number, b: number, family = 'TOplusTOcarry'): Fact =>
  ({ id: `add:${a}+${b}`, skill: 'add100Carry', family, operands: [a, b], answer: a + b, rank: 2 })
const task = (def: SkillDef, f: Fact, kind: TaskKind, seed = 1) => buildTask(def, f, kind, makeRng(seed), 0).task

function logEntry(t: Task, given: AnswerValue, n: number, ts: number, over: Partial<AnswerLogEntry> = {}): AnswerLogEntry {
  return {
    profileId: 'p1', ts, day: dayOf(n), sessionId: 's', roundId: 'r', nodeId: 'n', mode: 'round', skill: t.skill,
    family: t.family, factId: t.factId, masteryKey: t.masteryKey, kind: t.kind, optionsCount: t.options.length,
    production: isProduction(t), given, answer: t.answer, correct: isCorrect(t, given), ms: 3000, fast: true,
    errorTag: classifyAnswer(t, given), detectable: detectableOf(t), boxBefore: 0, boxAfter: 0, scaffold: false,
    replays: 0, retryOf: null, assisted: false, audioUnverified: false, ...over,
  }
}

/** A child answering over days, with first-try accuracy per skill tracked like the data layer does. */
class Child {
  states: MisconceptionStates = {}
  tries: boolean[] = []
  ts = DAY0
  answer(t: Task, given: AnswerValue, n: number, over: Partial<AnswerLogEntry> = {}) {
    this.ts = Math.max(this.ts + 60_000, DAY0 + n * 86_400_000)
    const e = logEntry(t, given, n, this.ts, over)
    // like the data layer: the last 20 first tries in the skill, this one included
    this.tries.push(e.correct)
    const last = this.tries.slice(-20)
    const acc = last.filter(Boolean).length / last.length
    this.states = updateMisconceptions(this.states, e, { skillAccuracy20: acc, day: e.day, contrast: t.contrast })
    return e
  }
  flagged = () => flaggedIds(this.states)
}

// ─── classification ─────────────────────────────────────────────────────────

describe('classifying a wrong answer (SPEC §4.1)', () => {
  it('returns null for a right answer and the candidate tag for a known wrong one', () => {
    const t = task(add100CarryFixture, carry(38, 45), 'keypad')
    expect(classifyAnswer(t, 83)).toBeNull()
    expect(classifyAnswer(t, 73)).toBe('forgotCarry')
    expect(classifyAnswer(t, 84)).toBe('near')
    expect(classifyAnswer(t, 5)).toBe('other')
  })

  it('stops at a tagged candidate: 38 on 38 + 45 is an operand, not a reversed 83', () => {
    expect(digitSwapOf(83)).toBe(38)
    expect(classifyAnswer(task(add100CarryFixture, carry(38, 45), 'keypad'), 38)).toBe('operand')
  })

  it('finds digitSwap on typed answers of 13 or more that are not on screen', () => {
    const t = task(add100CarryFixture, carry(47, 25), 'keypad') // 72
    expect(classifyAnswer(t, 27)).toBe('digitSwap')
    expect(natureFor('digitSwap', 'add100Carry')).toBe('slip')
    // on cards it is only told apart in the hear/place skills
    const cards = task(add100CarryFixture, carry(47, 25), 'choice')
    expect(classifyAnswer(cards, 27)).toBe('other')
    // an answer below 13, or with a 0 digit, has no swap
    expect(digitSwapOf(12)).toBe(21)
    expect(digitSwapOf(40)).toBeNull()
    expect(digitSwapOf(44)).toBeNull()
    expect(digitSwapOf(253)).toBe(235)
  })

  it('treats digitSwap as a concept in hear*, tensOnes and placeValue1000', () => {
    const f = hear20Fixture.enumerate()[13]
    expect(classifyAnswer(task(hear20Fixture, f, 'keypad'), 31)).toBe('digitSwap')
    for (const skill of ['hear20', 'hear100', 'hear1000', 'tensOnes', 'placeValue1000'] as const) expect(natureFor('digitSwap', skill)).toBe('concept')
    expect(natureFor('tableNeighbour', 'mul6to9')).toBe('slip')
    expect(natureFor('forgotCarry', 'add100Carry')).toBe('concept')
  })

  it('reports an uneven share as shareUnequal', () => {
    const t = { ...task(addTo10Fixture, addTo10Fixture.enumerate()[5], 'keypad'), kind: 'share' as const, skill: 'shareEqually' as const }
    expect(classifyAnswer(t, -1)).toBe('shareUnequal')
  })
})

describe('digitSwap on a kroner keypad: the swap is in the kroner the child types (SPEC §4.1, A11)', () => {
  // A money keypad takes whole kroner (entryScale 100): the child types 47 and the answer is 4700 øre.
  // 4700 has no two-digit ending to reverse; 47 does, and 74 kr is 7400 øre.
  const pile = (coins: number[]): Fact => ({
    id: `tael:mixedTo100:${coins.join('+')}`, skill: 'countCoins', family: 'mixedTo100', operands: coins,
    answer: coins.reduce((s, c) => s + c, 0) * 100, rank: 0,
  })
  const kroner: SkillModule = {
    ...addTo10Fixture,
    id: 'countCoins',
    mode: 'procedure',
    kinds: ['choice', 'keypad'],
    answerType: () => 'ore',
    prompt: (f) => ({ scene: 'coins', ore: f.operands.map((c) => c * 100) }),
    optionView: () => 'amount',
    range: () => [0, 10000],
    candidates: (f): Candidate[] => [{ value: f.operands.length * 100, tag: 'coinsAsCount' }],
  }
  const typed = (coins: number[], def: SkillDef = kroner) => task(def, pile(coins), 'keypad')

  it('reads 47 kr typed as 74 kr as digitSwap and counts the keypad task as its opportunity', () => {
    const t = typed([20, 20, 5, 2])
    expect([t.answer, t.entryScale]).toEqual([4700, 100])
    expect(swappedAnswer(t)).toBe(7400)
    expect(digitSwapPossible(t)).toBe(true)
    expect(classifyAnswer(t, 7400)).toBe('digitSwap')
    expect(detectableOf(t).sort()).toEqual(['coinsAsCount', 'digitSwap'])
    expect(natureFor('digitSwap', 'countCoins')).toBe('slip')
    // 4700 reversed in øre is no amount anyone types
    expect(classifyAnswer(t, 74)).toBe('other')
  })

  it('finds no swap where the kroner have none (40, 44 kr), below 13 kr, or on cards', () => {
    for (const coins of [[20, 20], [20, 20, 2, 2], [10, 2]]) {
      const t = typed(coins)
      expect(swappedAnswer(t), String(coins)).toBeNull()
      expect(detectableOf(t), String(coins)).not.toContain('digitSwap')
    }
    expect(classifyAnswer(typed([10, 2]), 2100)).toBe('other')
    const cards = task(kroner, pile([20, 20, 5, 2]), 'choice')
    expect(swappedAnswer(cards)).toBeNull()
    expect(classifyAnswer(cards, 7400)).toBe('other')
  })

  it('compares the reversal with the numbers on screen in kroner: a coin showing it makes it no swap', () => {
    expect(promptNumbers({ scene: 'coins', ore: [2000, 500, 200] })).toEqual([20, 5, 2])
    expect(promptNumbers({ scene: 'shop', thing: 'apple', priceOre: 1300, paidOre: 2000, purse: [1000, 500] })).toEqual([13, 20])
    expect(promptNumbers({ scene: 'shop', thing: 'apple', priceOre: 1700, purse: [1000, 500] })).toEqual([17])
    // a made-up 13-krone coin beside 18 kr: 31 kr reversed is the 13 on the coin
    const t = typed([13, 18])
    expect(swappedAnswer(t)).toBeNull()
    expect(classifyAnswer(t, 1300)).toBe('other')
  })

  it('makes a misconception on the reversed kroner ambiguous (A11), alike in the tags, the classification and the opportunities', () => {
    const odd: SkillModule = { ...kroner, candidates: (f) => [...kroner.candidates(f), { value: 7400, tag: 'wrongOperation' }] }
    const t = typed([20, 20, 5, 2], odd)
    expect(swapDisambiguated(t, 7400, 'wrongOperation')).toBe('ambiguous')
    expect(t.distractorTags['7400']).toBe('ambiguous')
    expect(classifyAnswer(t, 7400)).toBe('ambiguous')
    expect(detectableOf(t)).toEqual(['coinsAsCount'])
  })

  it('leaves whole numbers as they were: the swap of 72 is 27, and 4700 on an int keypad has none', () => {
    const t = task(add100CarryFixture, carry(47, 25), 'keypad')
    expect(t.entryScale).toBe(1)
    expect(swappedAnswer(t)).toBe(27)
    expect(swappedAnswer({ ...t, answer: 4700 })).toBeNull()
    expect(swappedAnswer({ ...t, answer: 4700, entryScale: 100 })).toBe(7400)
  })
})

describe('opportunities (SPEC §4.3)', () => {
  it('counts only the cards shown on a card task', () => {
    for (let seed = 0; seed < 20; seed++) {
      const t = task(addTo10Fixture, addTo10Fixture.enumerate().find((f) => f.id === 'add:5+3')!, 'choice', seed)
      const shown = t.options.map((o) => t.distractorTags[String(o)]).filter((x): x is MisconceptionId => MISCONCEPTION_IDS.includes(x as MisconceptionId))
      expect(detectableOf(t).sort()).toEqual([...new Set(shown)].sort())
    }
  })

  it('counts every candidate misconception on a typed answer, and digitSwap where it can be seen', () => {
    expect(detectableOf(task(add100CarryFixture, carry(47, 25), 'keypad')).sort()).toEqual(['digitSwap', 'forgotCarry', 'wrongOperation'])
    // 45 + 5 = 50 has no reversal; on 38 + 45 = 83 the reversal 38 is on screen
    expect(detectableOf(task(add100CarryFixture, carry(45, 5, 'TOplusOcarry'), 'keypad'))).not.toContain('digitSwap')
    const bare = { ...add100CarryFixture, candidates: () => [{ value: 84, tag: 'near' as const }] }
    const onScreen = task(bare, carry(38, 45), 'keypad')
    expect(detectableOf(onScreen)).toEqual([])
    expect(classifyAnswer(onScreen, 38)).toBe('other')
  })

  it('counts a congruent contrast item for its perceptual misconception', () => {
    const congruent = weightCompareFixture.enumerate()[0]
    const t = task(weightCompareFixture, congruent, 'choice')
    expect(Object.values(t.distractorTags)).not.toContain('sizeIsWeight')
    expect(detectableOf(t)).toEqual(['sizeIsWeight'])
  })
})

// ─── evidence rules ─────────────────────────────────────────────────────────

function hitEntry(over: Partial<AnswerLogEntry> = {}): AnswerLogEntry {
  return {
    profileId: 'p1', ts: DAY0, day: dayOf(0), sessionId: 's', roundId: 'r', nodeId: 'n', mode: 'round',
    skill: 'add100Carry', family: 'TOplusTOcarry', factId: 'add:38+45', masteryKey: 'add100Carry/TOplusTOcarry',
    kind: 'keypad', optionsCount: 0, production: true, given: 73, answer: 83, correct: false, ms: 4000, fast: true,
    errorTag: 'forgotCarry', detectable: ['forgotCarry'], boxBefore: 1, boxAfter: 0, scaffold: false, replays: 0,
    retryOf: null, assisted: false, audioUnverified: false, ...over,
  }
}
const fold = (entries: AnswerLogEntry[], acc = 1, start: MisconceptionStates = {}) =>
  entries.reduce((s, e) => updateMisconceptions(s, e, { skillAccuracy20: acc, day: e.day }), start)

describe('when the app dares to conclude (SPEC §4.3)', () => {
  const three = (over: (i: number) => Partial<AnswerLogEntry> = () => ({})) =>
    [0, 1, 2].map((i) => hitEntry({ factId: `add:3${i}+45`, day: dayOf(i < 2 ? 0 : 1), ts: DAY0 + i * 86_400_000, ...over(i) }))

  it('flags after three typed hits on three facts over two days', () => {
    expect(fold(three()).forgotCarry?.status).toBe('flagged')
  })

  it('never uses retries, help, placement, a silent device or the golden egg', () => {
    const s0: MisconceptionStates = {}
    for (const over of [{ mode: 'retry' as const }, { retryOf: 'x#0' }, { assisted: true }, { mode: 'placement' as const }, { audioUnverified: true }, { mode: 'golden' as const }]) {
      expect(updateMisconceptions(s0, hitEntry(over), { skillAccuracy20: 1, day: dayOf(0) })).toBe(s0)
    }
  })

  it('needs three facts, two days and two typed hits', () => {
    expect(fold(three((i) => ({ factId: i === 2 ? 'add:30+45' : `add:3${i}+45` }))).forgotCarry?.status).toBe('watching')
    expect(fold(three(() => ({ day: dayOf(0) }))).forgotCarry?.status).toBe('watching')
    const cards = [0, 1, 2, 3, 4, 5].map((i) =>
      hitEntry({ factId: `add:3${i}+45`, day: dayOf(i % 2), kind: 'choice', production: false, optionsCount: 3 }))
    expect(fold(cards).forgotCarry?.status).toBe('watching')
  })

  it('needs the rate to beat guessing', () => {
    const misses = [...Array(12)].map((_, i) => hitEntry({ factId: `add:4${i}+45`, correct: true, errorTag: null, given: 83 }))
    expect(fold([...misses, ...three()]).forgotCarry?.status).toBe('watching')
  })

  it('ignores card evidence while the child is guessing (under 40 % in the skill)', () => {
    const cards = [0, 1, 2, 3].map((i) => hitEntry({ factId: `add:3${i}+45`, day: dayOf(i % 2), kind: 'choice', production: false, optionsCount: 3 }))
    const s = fold(cards, 0.3)
    expect(s).toEqual({})
  })

  it('forgets evidence older than 30 learning days', () => {
    const old = three().map((e) => ({ ...e, day: dayOf(0), ts: DAY0 }))
    let s = fold(old.slice(0, 2))
    s = updateMisconceptions(s, hitEntry({ day: dayOf(31), ts: DAY0 + 31 * 86_400_000, factId: 'add:39+45' }), { skillAccuracy20: 1, day: dayOf(31) })
    expect(s.forgotCarry?.hits).toHaveLength(1)
    expect(s.forgotCarry?.status).toBe('watching')
  })

  it('needs weight 4 and a 70 % lean to "one short" for countFromFirst', () => {
    const cff = (i: number, over: Partial<AnswerLogEntry> = {}) => hitEntry({
      skill: 'addTo10', factId: `add:${i}+3`, errorTag: 'countFromFirst', detectable: ['countFromFirst'], day: dayOf(i % 2),
      ts: DAY0 + i * 1000, ...over,
    })
    const run = (n: number) => Array.from({ length: n }, (_, i) => cff(i + 1))
    expect(fold(run(3)).countFromFirst?.status).toBe('watching') // weight 3
    // weight 4, but four typed answers one short are what slips either way give one time in sixteen
    expect(fold(run(4)).countFromFirst?.status).toBe('watching')
    expect(fold(run(10)).countFromFirst?.status).toBe('flagged')
    // the same ten, among five one-too-many slips: 67 %
    const other = [11, 12, 13, 14, 15].map((i) => cff(i, { errorTag: 'near' }))
    expect(fold([...other, ...run(10)]).countFromFirst?.status).toBe('watching')
    // cards lean to "one short" by themselves (it is always the diagnostic card): they do not count for the lean
    const cards = [11, 12, 13, 14, 15].map((i) => cff(i, { production: false, kind: 'choice', optionsCount: 3 }))
    expect(fold([...other, ...cards, ...run(10)]).countFromFirst?.status).toBe('watching')
  })

  it('reads the countFromFirst lean as a one-sided chance', () => {
    expect(halfTail(4, 4)).toBeCloseTo(1 / 16)
    expect(halfTail(10, 10)).toBeCloseTo(1 / 1024)
    expect(halfTail(10, 9)).toBeCloseTo(11 / 1024)
    expect(halfTail(6, 0)).toBeCloseTo(1)
  })

  it('resolves after six new chances with five right and no evidence in the last six', () => {
    let s = fold(three())
    expect(s.forgotCarry?.status).toBe('flagged')
    const right = (i: number) => hitEntry({ correct: true, errorTag: null, given: 83, day: dayOf(2), ts: DAY0 + 3 * 86_400_000 + i })
    for (let i = 0; i < 5; i++) s = updateMisconceptions(s, right(i), { skillAccuracy20: 1, day: dayOf(2) })
    expect(s.forgotCarry?.status).toBe('flagged')
    const before = s
    s = updateMisconceptions(s, right(5), { skillAccuracy20: 1, day: dayOf(2) })
    expect(s.forgotCarry?.status).toBe('resolved')
    expect(misconceptionEvents(before, s)).toEqual([{ t: 'misconceptionResolved', id: 'forgotCarry' }])
  })

  it('checks perceptual misconceptions by contrast only', () => {
    const hits = [0, 1, 2, 3].map((i) => ({ day: dayOf(i % 2), factId: `wgt:${i}`, w: 1, production: true }))
    const conflict = (hit: boolean) => ({ day: dayOf(0), pGuess: 0.5, hit, correct: !hit, contrast: 'conflict' as const })
    const congruent = (correct: boolean) => ({ day: dayOf(0), pGuess: 0.5, hit: false, correct, contrast: 'congruent' as const })
    const opps = [...Array(6)].map((_, i) => conflict(i < 4))
    expect(meetsFlag('sizeIsWeight', { hits, opps: [...opps, ...[...Array(6)].map(() => congruent(true))] })).toBe(true)
    // a guesser gets the congruent items wrong half the time
    expect(meetsFlag('sizeIsWeight', { hits, opps: [...opps, ...[...Array(6)].map((_, i) => congruent(i % 2 === 0))] })).toBe(false)
    // five congruent items are not enough to know
    expect(meetsFlag('sizeIsWeight', { hits, opps: [...opps, ...[...Array(5)].map(() => congruent(true))] })).toBe(false)
  })
})

// ─── fixtures (SPEC §4.3) ───────────────────────────────────────────────────

function randomAnswer(t: Task, rng: Rng): AnswerValue {
  switch (t.kind) {
    case 'choice':
    case 'pair':
    case 'trueFalse':
      return rng.pick(t.options)
    case 'multiSelect': {
      const picked = t.options.filter(() => rng.next() < 0.5).map(String)
      return (picked.length ? picked : [String(rng.pick(t.options))]).sort().join('|')
    }
    case 'sortOrder':
      return rng.shuffle(t.options).join('|')
    default:
      return rng.between(t.range[0], t.range[1]) * (t.entryScale === 100 ? 100 : 1)
  }
}

describe('fixture: a random guesser (SPEC §4.3)', () => {
  for (const def of FIXTURE_SKILLS) {
    it(`gets no flag in ${def.id} over 500 answers`, () => {
      const rng = makeRng(hashSeed(`guesser:${def.id}`))
      const child = new Child()
      const offered: Partial<Record<MisconceptionId, number>> = {}
      const facts = def.enumerate()
      for (let i = 0; i < 500; i++) {
        const fact = def.mode === 'procedure' && def.instance ? def.instance(rng.pick(def.families), rng, new Set()) : rng.pick(facts)
        const built = buildTask(def, fact, rng.pick(def.kinds), rng, i, { offered })
        for (const m of built.offered) offered[m] = (offered[m] ?? 0) + 1
        child.answer(built.task, randomAnswer(built.task, rng), Math.floor(i / 25))
        expect(child.flagged()).toEqual([])
      }
    })
  }
})

describe('fixture: a child who judges weight by size (SPEC §4.3)', () => {
  const bySize = (t: Task): AnswerValue => {
    if (t.prompt.scene !== 'compareObjects') throw new Error('scene')
    const { objects, sizes } = t.prompt
    if (t.kind === 'multiSelect') return sizes.slice(1).flatMap((s, i) => (s > 4 ? [`o${i}`] : [])).join('|')
    return `obj:${objects[sizes[0] > sizes[1] ? 0 : 1]}`
  }
  const facts = weightCompareFixture.enumerate()
  const conflict = facts.filter((f) => f.family === 'conflict')
  const congruent = facts.filter((f) => f.family === 'congruent')

  it('is flagged within 20 conflict items', () => {
    const child = new Child()
    let conflicts = 0
    let flaggedAt = -1
    for (let day = 0; day < 8 && flaggedAt < 0; day++) {
      for (let j = 0; j < 6 && flaggedAt < 0; j++) {
        const isConflict = j % 2 === 0
        const f = (isConflict ? conflict : congruent)[(day * 3 + (j >> 1)) % 6]
        const kind: TaskKind = (j >> 1) % 2 === 0 ? 'choice' : 'multiSelect'
        const t = task(weightCompareFixture, f, kind, day * 10 + j)
        if (isConflict) conflicts++
        child.answer(t, bySize(t), day)
        if (child.flagged().includes('sizeIsWeight')) flaggedAt = conflicts
      }
    }
    expect(flaggedAt).toBeGreaterThan(0)
    expect(flaggedAt).toBeLessThanOrEqual(20)
  })

  it('is never flagged from a single session', () => {
    const child = new Child()
    for (let i = 0; i < 40; i++) {
      const f = (i % 2 === 0 ? conflict : congruent)[i % 6]
      const t = task(weightCompareFixture, f, i % 4 < 2 ? 'choice' : 'multiSelect', i)
      child.answer(t, bySize(t), 0)
    }
    expect(child.flagged()).toEqual([])
  })
})

describe('fixture: one session never flags (SPEC §4.3)', () => {
  it('holds for a child who forgets every carry, 60 times in one sitting', () => {
    const rng = makeRng(7)
    const child = new Child()
    const families = add100CarryFixture.families.filter((f) => f.id !== 'toNextTen')
    for (let i = 0; i < 60; i++) {
      const f = add100CarryFixture.instance(rng.pick(families), rng, new Set())
      const t = task(add100CarryFixture, f, 'keypad', i)
      const forgot = Object.entries(t.distractorTags).find(([, tag]) => tag === 'forgotCarry')
      child.answer(t, forgot ? Number(forgot[0]) : t.answer, 0)
    }
    expect(child.flagged()).toEqual([])
    // the same child on a second day is flagged: the rule is about days, not leniency
    for (let i = 0; i < 10; i++) {
      const f = add100CarryFixture.instance(add100CarryFixture.families[2], rng, new Set())
      const t = task(add100CarryFixture, f, 'keypad', 100 + i)
      child.answer(t, (t.answer as number) - 10, 1)
    }
    expect(child.flagged()).toContain('forgotCarry')
  })
})

describe('fixture: random ±1 slips (SPEC §4.3)', () => {
  it('never become countFromFirst at 50 % right over 1000 answers', () => {
    const rng = makeRng(11)
    const child = new Child()
    const facts = addTo10Fixture.enumerate()
    for (let i = 0; i < 1000; i++) {
      const f = rng.pick(facts)
      const t = task(addTo10Fixture, f, 'keypad', i)
      const answer = t.answer as number
      const given = rng.next() < 0.5 ? answer : answer === 0 ? 1 : answer + rng.pick([1, -1])
      child.answer(t, given, Math.floor(i / 25))
      expect(child.flagged()).not.toContain('countFromFirst')
    }
  })

  it('while a steady "one short" child is flagged', () => {
    const rng = makeRng(12)
    const child = new Child()
    const facts = addTo10Fixture.enumerate().filter((f) => f.operands[1] > 0)
    for (let i = 0; i < 60; i++) {
      const t = task(addTo10Fixture, rng.pick(facts), 'keypad', i)
      child.answer(t, rng.next() < 0.5 ? t.answer : (t.answer as number) - 1, Math.floor(i / 20))
    }
    expect(child.flagged()).toContain('countFromFirst')
  })
})

// ─── parent texts ───────────────────────────────────────────────────────────

describe('parent texts for all 32 misconceptions', () => {
  it('has a title, example, parent text and home tip for every id', () => {
    expect(Object.keys(MISCONCEPTION_TEXTS).sort()).toEqual([...MISCONCEPTION_IDS].sort())
    for (const id of MISCONCEPTION_IDS) {
      const t = MISCONCEPTION_TEXTS[id]
      for (const field of [t.title, t.example, t.parent, t.homeTip]) expect(field.trim().length).toBeGreaterThan(5)
    }
  })

  it('agrees with natureFor', () => {
    for (const id of MISCONCEPTION_IDS) {
      const { nature } = MISCONCEPTION_TEXTS[id]
      if (id === 'digitSwap') expect(nature).toBe('mixed')
      else expect(nature).toBe(natureFor(id, 'addTo10'))
    }
  })

  it('uses the app notation, no emoji and no guilt', () => {
    const all = Object.values(MISCONCEPTION_TEXTS).flatMap((t) => [t.title, t.example, t.parent, t.homeTip]).join('\n')
    expect(all).not.toMatch(/[×÷]/)
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(all).not.toMatch(/\d\s*[-x*]\s*\d/)
    expect(all.toLowerCase()).not.toMatch(/savner|ked af det|venter på dig|glem ikke|kom tilbage|din ven bliver|kun \d+ til/)
  })
})

describe('resolving a perceptual flag', () => {
  it('is only lifted by conflict items, never by congruent ones alone', async () => {
    const { updateMisconceptions } = await import('./misconceptions')
    type States = Parameters<typeof updateMisconceptions>[0]
    const base = {
      profileId: 'p', sessionId: 's', roundId: 'r', nodeId: 'n', mode: 'round' as const, skill: 'weightCompare' as const,
      family: 'conflict', masteryKey: 'k', kind: 'keypad' as const, optionsCount: 0, production: true, answer: 1, ms: 3000,
      fast: true, boxBefore: 0 as const, boxAfter: 0 as const, scaffold: false, replays: 0, retryOf: null, assisted: false,
      audioUnverified: false, detectable: ['sizeIsWeight' as const],
    }
    const flagged: States = {
      sizeIsWeight: { status: 'flagged', hits: [], opps: [], flaggedAt: 1_000, resolvedAt: null },
    }
    let states = flagged
    // ten right answers on congruent items after the flag: still flagged
    for (let i = 0; i < 10; i++) {
      states = updateMisconceptions(states, { ...base, ts: 2_000 + i, day: '2026-09-02', factId: `w${i}`, given: 1, correct: true, errorTag: null }, {
        skillAccuracy20: 0.8, day: '2026-09-02', contrast: 'congruent',
      })
    }
    expect(states.sizeIsWeight?.status).toBe('flagged')
    // six right answers on conflict items lift it
    for (let i = 0; i < 6; i++) {
      states = updateMisconceptions(states, { ...base, ts: 3_000 + i, day: '2026-09-03', factId: `c${i}`, given: 1, correct: true, errorTag: null }, {
        skillAccuracy20: 0.8, day: '2026-09-03', contrast: 'conflict',
      })
    }
    expect(states.sizeIsWeight?.status).toBe('resolved')
  })
})

// ─── set answers in another order (GENFIX3, ORK3b's note) ─────────────────────

describe('classifyAnswer and a set handed in in another order', () => {
  /** classifyAnswer before the set rule: a tag only for the key exactly as the skill wrote it. */
  const before = (t: Task, g: AnswerValue): ErrorTag | null => {
    if (isCorrect(t, g)) return null
    if (t.kind === 'share' && g === -1) return 'shareUnequal'
    const tag = t.distractorTags[typeof g === 'number' && t.modulo ? String(((g % t.modulo) + t.modulo) % t.modulo) : String(g)]
    if (tag) return tag
    if (typeof g === 'number' && swappedAnswer(t) === g) return 'digitSwap'
    return 'other'
  }
  const UNORDERED: ReadonlySet<TaskKind> = new Set<TaskKind>(['multiSelect', 'grid', 'pay', 'share', 'colorParts'])
  const tokens = (s: string) => s.split('|').sort().join('|')
  /** The orders of a set answer the child can hand in besides the written one: reversed and turned once. */
  const reorder = (s: string): string[] => {
    const t = s.split('|')
    return t.length < 2 ? [] : [[...t].reverse().join('|'), [...t.slice(1), t[0]].join('|')]
  }

  it('reads a point read off the net y first as the same pair: y:2|x:4 is x:4|y:2 (A23 coordSwap, near)', () => {
    const def = registeredSkills().find((d) => d.id === 'gridCoords')!
    const fact = def.instance!(def.families.find((f) => f.id === 'readPoint')!, makeRng(1), new Set(factsOf(def).map((f) => f.id).filter((id) => id !== 'crd:r:4,2')))
    const t = task(def, factsOf(def).find((f) => f.id === 'crd:r:4,2') ?? fact, 'grid')
    expect(t.answer).toBe('x:4|y:2')
    expect([classifyAnswer(t, 'y:2|x:4'), classifyAnswer(t, 'x:2|y:4'), classifyAnswer(t, 'y:4|x:2'), classifyAnswer(t, 'y:2|x:5'), classifyAnswer(t, 'y:6|x:6')])
      .toEqual([null, 'coordSwap', 'coordSwap', 'near', 'other'])
  })

  it('classifies every other answer of every registered skill as before; only a set in another order changes, and never on an ordered kind', () => {
    const problems: string[] = []
    const seen = new Map<TaskKind, number>()
    const changed = new Map<TaskKind, number>()
    for (const def of registeredSkills()) {
      for (const [i, fact] of factsOf(def).entries()) {
        for (const kind of def.kinds) {
          const t = buildTask(def, fact, kind, makeRng(hashSeed(`set-order:${fact.id}:${kind}`)), i).task
          if (typeof t.answer !== 'string') continue
          seen.set(kind, (seen.get(kind) ?? 0) + 1)
          const written = [t.answer, ...t.accept, ...t.options, ...Object.keys(t.distractorTags)].filter((v): v is string => typeof v === 'string')
          for (const v of new Set([...written, ...written.flatMap(reorder)])) {
            const now = classifyAnswer(t, v)
            const was = before(t, v)
            if (now === was) continue
            changed.set(kind, (changed.get(kind) ?? 0) + 1)
            const same = Object.keys(t.distractorTags).filter((k) => tokens(k) === tokens(v))
            if (!UNORDERED.has(kind) || was !== 'other' || !same.some((k) => t.distractorTags[k] === now)) problems.push(`${fact.id} ${kind} ${v}: ${String(was)} → ${String(now)}`)
          }
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([])
    // the ordered kinds and the sets were all swept, and an ordered answer is never read as a set
    for (const kind of ['multiSelect', 'sortOrder', 'fillSlots', 'grid', 'pay'] as const) expect(seen.get(kind) ?? 0, kind).toBeGreaterThan(0)
    expect([changed.get('sortOrder') ?? 0, changed.get('fillSlots') ?? 0]).toEqual([0, 0])
  })
})
