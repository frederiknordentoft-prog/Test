import { describe, expect, it } from 'vitest'
import { buildTask, defaultOptionClip, isMisconceptionId, lineTolerance, masteryKeyOf, offeredTagsOf, resolveTag } from './tasks'
import { add100CarryFixture, addTo10Fixture, hear20Fixture, weightCompareFixture } from './testing/fixtureSkills'
import type { SkillModule } from './skills/types'
import { classifyAnswer } from './misconceptions'
import { guessP, isProduction } from './kinds'
import { isCorrect } from './answer'
import { makeRng } from './rng'
import type { Fact, SkillDef } from './types'

const factOf = (def: SkillDef, id: string): Fact => def.enumerate().find((f) => f.id === id)!
const carry = (a: number, b: number, family = 'TOplusTOcarry'): Fact =>
  ({ id: `add:${a}+${b}`, skill: 'add100Carry', family, operands: [a, b], answer: a + b, rank: 2 })

describe('choice cards (SPEC §4.1)', () => {
  it('shows the answer, one diagnostic distractor and one near miss', () => {
    for (let seed = 0; seed < 60; seed++) {
      const { task } = buildTask(addTo10Fixture, factOf(addTo10Fixture, 'add:5+3'), 'choice', makeRng(seed), 0)
      expect(task.options).toHaveLength(3)
      expect(task.options).toContain(8)
      const tags = task.options.filter((o) => o !== 8).map((o) => task.distractorTags[String(o)])
      expect(tags.filter(isMisconceptionId)).toHaveLength(1)
      expect(tags).toContain('near')
    }
  })

  it('rotates the diagnostic card to the misconception offered least', () => {
    const f = factOf(addTo10Fixture, 'add:5+3') // countFromFirst 7, wrongOperation 2
    for (let seed = 0; seed < 30; seed++) {
      const a = buildTask(addTo10Fixture, f, 'choice', makeRng(seed), 0, { offered: { countFromFirst: 4, wrongOperation: 1 } })
      expect(a.offered).toEqual(['wrongOperation'])
      const b = buildTask(addTo10Fixture, f, 'choice', makeRng(seed), 0, { offered: { countFromFirst: 1, wrongOperation: 4 } })
      expect(b.offered).toEqual(['countFromFirst'])
    }
  })

  it('aims the diagnostic card at a flagged misconception in the targeted slot', () => {
    const f = factOf(addTo10Fixture, 'add:6+2')
    for (let seed = 0; seed < 30; seed++) {
      const { offered } = buildTask(addTo10Fixture, f, 'choice', makeRng(seed), 0, { offered: { countFromFirst: 9 }, target: ['countFromFirst'] })
      expect(offered).toEqual(['countFromFirst'])
    }
  })

  it('tags every candidate, shown or not, so a typed answer can be classified too', () => {
    const { task } = buildTask(addTo10Fixture, factOf(addTo10Fixture, 'add:5+3'), 'keypad', makeRng(1), 0)
    expect(task.options).toEqual([])
    expect(task.distractorTags).toEqual({ '9': 'near', '7': 'countFromFirst', '5': 'operand', '3': 'operand', '2': 'wrongOperation' })
  })

  it('lets one misconception win over near/operand, and makes two on one value ambiguous', () => {
    expect(resolveTag(['near', 'countFromFirst'])).toBe('countFromFirst')
    expect(resolveTag(['operand', 'wrongOperation', 'operand'])).toBe('wrongOperation')
    expect(resolveTag(['smallerFromLarger', 'borrowNoDecrement'])).toBe('ambiguous')
    expect(resolveTag(['operand', 'near'])).toBe('operand')

    const clash: SkillModule = {
      ...addTo10Fixture,
      candidates: (f) => [
        { value: (f.answer as number) + 2, tag: 'smallerFromLarger' },
        { value: (f.answer as number) + 2, tag: 'borrowNoDecrement' },
        { value: (f.answer as number) + 1, tag: 'near' },
        { value: (f.answer as number) + 3, tag: 'other' },
      ],
    }
    for (let seed = 0; seed < 40; seed++) {
      const { task, offered } = buildTask(clash, factOf(addTo10Fixture, 'add:3+3'), 'choice', makeRng(seed), 0)
      expect(task.distractorTags['8']).toBe('ambiguous')
      expect(offered).toEqual([])
      if (task.options.includes(8)) expect(classifyAnswer(task, 8)).toBe('ambiguous')
    }
  })

  it('never shows a card that is right, negative, out of range or twice', () => {
    for (const def of [addTo10Fixture, add100CarryFixture, hear20Fixture] as SkillDef[]) {
      for (const f of def.enumerate()) {
        for (let seed = 0; seed < 5; seed++) {
          const { task } = buildTask(def, f, 'choice', makeRng(seed), seed)
          expect(new Set(task.options.map(String)).size).toBe(task.options.length)
          const wrong = task.options.filter((o) => o !== task.answer)
          expect(wrong).toHaveLength(task.options.length - 1)
          for (const o of wrong) {
            expect(isCorrect(task, o)).toBe(false)
            expect(o as number).toBeGreaterThanOrEqual(task.range[0])
            expect(o as number).toBeLessThanOrEqual(task.range[1])
            expect(task.distractorTags[String(o)]).toBeDefined()
            expect(classifyAnswer(task, o)).toBe(task.distractorTags[String(o)])
          }
        }
      }
    }
  })

  it('falls back to a near miss the skill did not list', () => {
    const bare: SkillModule = { ...addTo10Fixture, candidates: () => [] }
    const { task } = buildTask(bare, factOf(addTo10Fixture, 'add:4+4'), 'choice', makeRng(3), 0)
    expect(task.options).toHaveLength(3)
    for (const o of task.options.filter((x) => x !== 8)) expect(task.distractorTags[String(o)]).toBe('near')
  })

  it('refuses a card task with nothing to put beside the answer', () => {
    const lonely: SkillModule = { ...weightCompareFixture, candidates: () => [] }
    expect(() => buildTask(lonely, weightCompareFixture.enumerate()[0], 'choice', makeRng(1), 0)).toThrow(/distractor/)
  })

  it('is reproducible from its seed', () => {
    const f = factOf(addTo10Fixture, 'add:7+2')
    expect(buildTask(addTo10Fixture, f, 'choice', makeRng(42), 3)).toEqual(buildTask(addTo10Fixture, f, 'choice', makeRng(42), 3))
  })
})

describe('keypad (SPEC §3.1)', () => {
  const kr = (answer: number): SkillModule => ({
    ...addTo10Fixture,
    answerType: () => 'ore',
    enumerate: () => [{ id: `pay:${answer}`, skill: 'addTo10', family: 'small', operands: [answer], answer, rank: 0 }],
    range: () => [0, 10000],
    candidates: () => [{ value: answer + 100, tag: 'near' }],
  })

  it('takes whole kroner only, scaled by 100 with a kr suffix', () => {
    const def = kr(1700)
    const { task } = buildTask(def, def.enumerate()[0], 'keypad', makeRng(1), 0)
    expect(task.entryScale).toBe(100)
    expect(task.unit).toBe('kr')
    expect(task.maxDigits).toBe(3) // up to 100 kr
    const half = kr(1250)
    expect(() => buildTask(half, half.enumerate()[0], 'keypad', makeRng(1), 0)).toThrow(/whole kroner/)
  })

  it('asserts on minutes, tokens and sets', () => {
    for (const type of ['minutes', 'token', 'set'] as const) {
      const def: SkillModule = { ...addTo10Fixture, answerType: () => type }
      expect(() => buildTask(def, factOf(addTo10Fixture, 'add:1+1'), 'keypad', makeRng(1), 0)).toThrow(/keypad/)
    }
  })

  it('sizes the keypad from the range, with room for 1004 in hear1000 and placeValue1000', () => {
    const { task } = buildTask(addTo10Fixture, factOf(addTo10Fixture, 'add:1+1'), 'keypad', makeRng(1), 0)
    expect(task.maxDigits).toBe(2)
    const wide: SkillModule = { ...hear20Fixture, id: 'hear1000', range: () => [100, 1000] }
    const f: Fact = { id: 'h:104', skill: 'hear1000', family: 'h0o', operands: [104], answer: 104, rank: 0 }
    expect(buildTask(wide, f, 'keypad', makeRng(1), 0).task.maxDigits).toBe(5)
  })

  it('never uses tolerance off the number line', () => {
    expect(buildTask(add100CarryFixture, carry(38, 45), 'keypad', makeRng(1), 0).task.tolerance).toBe(0)
  })
})

describe('number lines, clocks and presentation', () => {
  it('uses 5 % of the line as tolerance, but never so much that a tap stops being production', () => {
    expect(lineTolerance(20)).toBe(0)
    expect(lineTolerance(50)).toBe(2)
    expect(lineTolerance(100)).toBe(5)
    expect(lineTolerance(200)).toBe(10)
    expect(lineTolerance(1000)).toBe(50)
    for (const span of [10, 20, 30, 50, 100, 150, 200, 500, 1000]) {
      expect((2 * lineTolerance(span) + 1) / (span + 1)).toBeLessThanOrEqual(0.12)
    }
    const { task } = buildTask(add100CarryFixture, carry(38, 45), 'numberline', makeRng(1), 0)
    expect(task.tolerance).toBe(5)
    expect(isProduction(task)).toBe(true)
    expect(isCorrect(task, 88)).toBe(true)
    expect(isCorrect(task, 89)).toBe(false)
    const own: SkillModule = { ...add100CarryFixture, tolerance: () => 2 }
    expect(buildTask(own, carry(38, 45), 'numberline', makeRng(1), 0).task.tolerance).toBe(2)
  })

  it('compares clocks on the dial: 12 hours analog, 24 hours when a 24-hour task is not set on a dial', () => {
    const clock: SkillModule = {
      ...addTo10Fixture,
      kinds: ['choice', 'keypad', 'clockSet'],
      answerType: () => 'minutes',
      prompt: (f) => ({ scene: 'clock', minutes: null, step: 30, h24: (f.answer as number) >= 720 }),
      optionView: () => 'clock',
      range: () => [0, 1439],
      candidates: (f) => [{ value: (f.answer as number) + 60, tag: 'halfPastNext' }],
    }
    const halfPastTwo: Fact = { id: 'clk:150', skill: 'addTo10', family: 'small', operands: [150], answer: 150, rank: 0 }
    const analog = buildTask(clock, halfPastTwo, 'clockSet', makeRng(1), 0).task
    expect(analog.modulo).toBe(720)
    expect(isCorrect(analog, 150 + 720)).toBe(true)
    expect(classifyAnswer(analog, 210 + 720)).toBe('halfPastNext')
    const evening: Fact = { ...halfPastTwo, id: 'clk:870', answer: 870 }
    // an analog face cannot show the afternoon: 14:30 set on the dial is half past two
    const set = buildTask(clock, evening, 'clockSet', makeRng(1), 0).task
    expect(set.modulo).toBe(720)
    expect(isCorrect(set, 150)).toBe(true)
    expect(buildTask(clock, evening, 'choice', makeRng(1), 0).task.modulo).toBe(1440)
  })

  it('starts a clockSet dial on its step, never on the answer nor on a misconception’s clock, and only clockSet', () => {
    const clock: SkillModule = {
      ...addTo10Fixture,
      kinds: ['choice', 'clockSet'],
      answerType: () => 'minutes',
      prompt: () => ({ scene: 'clock', minutes: null, step: 30, h24: false }),
      optionView: () => 'clock',
      range: () => [0, 719],
      candidates: (f) => [{ value: ((f.answer as number) + 60) % 720, tag: 'halfPastNext' }],
    }
    const starts = new Set<number>()
    for (let answer = 30; answer < 720; answer += 60) {
      const f: Fact = { id: `clk:${answer}`, skill: 'addTo10', family: 'small', operands: [answer], answer, rank: 0 }
      for (let seed = 1; seed <= 40; seed++) {
        const t = buildTask(clock, f, 'clockSet', makeRng(seed), 0).task
        expect(t.dialStart, f.id).toBeDefined()
        const start = t.dialStart!
        expect(start % 30, f.id).toBe(0)
        expect(start, f.id).not.toBe(answer)
        expect(start, f.id).not.toBe((answer + 60) % 720)
        starts.add(start)
      }
      expect(buildTask(clock, f, 'choice', makeRng(1), 0).task.dialStart).toBeUndefined()
    }
    // spread over the dial (no leaning that could tell the child about the answer)
    expect(starts.size).toBeGreaterThanOrEqual(20)
  })

  it('shows the scaffold at box 0 only, and never in a trial or placement', () => {
    const f = factOf(addTo10Fixture, 'add:2+3')
    expect(buildTask(addTo10Fixture, f, 'keypad', makeRng(1), 0, { box: 0 }).task.scaffold).toBe(true)
    expect(buildTask(addTo10Fixture, f, 'keypad', makeRng(1), 0, { box: 1 }).task.scaffold).toBe(false)
    expect(buildTask(addTo10Fixture, f, 'keypad', makeRng(1), 0, { box: 0, mode: 'trial' }).task.scaffold).toBe(false)
    expect(buildTask(addTo10Fixture, f, 'keypad', makeRng(1), 0, { box: 0, mode: 'placement' }).task.scaffold).toBe(false)
  })

  it('reads spoken option cards aloud, and only those', () => {
    const units: SkillModule = {
      ...weightCompareFixture,
      optionView: () => 'unitWord',
      candidates: () => [{ value: 'unit:m', tag: 'other' }, { value: 'unit:g', tag: 'other' }],
      answer: () => 'unit:cm',
    }
    const { task } = buildTask(units, weightCompareFixture.enumerate()[0], 'choice', makeRng(1), 0)
    expect(task.optionClips).toEqual(task.options.map((o) => `noun.unit.${String(o).slice(5)}`))
    const own: SkillModule = { ...units, optionClip: (_f, v) => `s.unit.${String(v)}` }
    expect(buildTask(own, weightCompareFixture.enumerate()[0], 'choice', makeRng(1), 0).task.optionClips?.[0]).toMatch(/^s\.unit\./)
    expect(buildTask(addTo10Fixture, factOf(addTo10Fixture, 'add:1+2'), 'choice', makeRng(1), 0).task.optionClips).toBeNull()
    expect(defaultOptionClip('cmp:<')).toBe('op.lt')
    expect(defaultOptionClip('frac:3/4')).toBe('noun.frac.3_4')
    expect(defaultOptionClip(7)).toBe('n.end.7')
  })

  it('carries the contrast marking of perceptual items', () => {
    const [congruent] = weightCompareFixture.enumerate()
    const conflict = weightCompareFixture.enumerate()[6]
    expect(buildTask(weightCompareFixture, congruent, 'choice', makeRng(1), 0).task.contrast).toBe('congruent')
    expect(buildTask(weightCompareFixture, conflict, 'choice', makeRng(1), 0).task.contrast).toBe('conflict')
    expect('contrast' in buildTask(addTo10Fixture, factOf(addTo10Fixture, 'add:1+2'), 'choice', makeRng(1), 0).task).toBe(false)
  })

  it('builds a multiSelect from the skill options, and lets the answer depend on the kind', () => {
    const conflict = weightCompareFixture.enumerate()[6]
    const { task } = buildTask(weightCompareFixture, conflict, 'multiSelect', makeRng(1), 0)
    expect(task.options).toEqual(['o0', 'o1', 'o2', 'o3', 'o4', 'o5'])
    expect(task.answerType).toBe('set')
    expect(String(task.answer).split('|')).toHaveLength(3)
    expect(isProduction(task)).toBe(true)
    expect(Object.values(task.distractorTags)).toContain('sizeIsWeight')
    const card = buildTask(weightCompareFixture, conflict, 'choice', makeRng(1), 0).task
    expect(card.answerType).toBe('token')
    expect(guessP(card)).toBe(0.5) // two things on the scale: capped at box 2
  })

  it('deals sortOrder cards out of order', () => {
    const sorting: SkillModule = { ...addTo10Fixture, kinds: ['choice', 'keypad', 'sortOrder'], answerType: () => 'set', answer: () => '3|5|8|12' }
    for (let seed = 0; seed < 50; seed++) {
      const { task } = buildTask(sorting, factOf(addTo10Fixture, 'add:1+2'), 'sortOrder', makeRng(seed), 0)
      expect([...task.options].sort((a, b) => Number(a) - Number(b))).toEqual([3, 5, 8, 12])
      expect(task.options.join('|')).not.toBe('3|5|8|12')
      expect(isProduction(task)).toBe(true)
    }
  })

  it('keys recall by fact and procedure by family', () => {
    expect(masteryKeyOf(addTo10Fixture, factOf(addTo10Fixture, 'add:1+2'))).toBe('add:1+2')
    expect(masteryKeyOf(add100CarryFixture, carry(38, 45))).toBe('add100Carry/TOplusTOcarry')
    const { task } = buildTask(add100CarryFixture, carry(38, 45), 'keypad', makeRng(1), 7)
    expect(task.id).toBe('add:38+45#7')
    expect(task.speech).toEqual(add100CarryFixture.speech(carry(38, 45)))
  })

  it('reports what it offered', () => {
    const built = buildTask(addTo10Fixture, factOf(addTo10Fixture, 'add:5+3'), 'choice', makeRng(1), 0)
    expect(built.offered).toEqual(offeredTagsOf(built.task))
    expect(offeredTagsOf(buildTask(addTo10Fixture, factOf(addTo10Fixture, 'add:5+3'), 'keypad', makeRng(1), 0).task)).toEqual([])
  })
})
