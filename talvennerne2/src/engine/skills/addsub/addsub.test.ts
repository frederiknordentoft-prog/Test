import { describe, expect, it } from 'vitest'
import addTo10Module from './addTo10'
import subTo10Module from './subTo10'
import tenFriendsModule from './tenFriends'
import { skillContract, tasksUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { keysForNode } from '../../registry'
import { NODE_BY_ID } from '../../../content/curriculum'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import { questionClip } from '../../../speech/recallQuestions'
import type { Fact, SkillDef } from '../../types'

const addTo10: SkillDef = addTo10Module
const subTo10: SkillDef = subTo10Module
const tenFriends: SkillDef = tenFriendsModule

const parse = (id: string): [number, number] => {
  const m = /^(?:add|sub):(\d+)[+-](\d+)$/.exec(id)!
  return [Number(m[1]), Number(m[2])]
}
const factOf = (def: SkillDef, id: string): Fact => def.enumerate().find((f) => f.id === id)!
const tagOf = (def: SkillDef, id: string, value: number) => def.candidates(factOf(def, id)).find((c) => c.value === value)?.tag
const hintText = (def: SkillDef, id: string, tag: Parameters<SkillDef['hint']>[1]) => compile(def.hint(factOf(def, id), tag).speech).text

describe('plus and minus skills of 0. klasse', () => {
  skillContract(addTo10, { families: { small: 21, big: 45 }, answerOf: (f) => parse(f.id)[0] + parse(f.id)[1] })
  skillContract(subTo10, { families: { small: 21, big: 45 }, answerOf: (f) => parse(f.id)[0] - parse(f.id)[1] })
  skillContract(tenFriends, { families: { pairs: 11 }, answerOf: (f) => 10 - Number(f.id.slice(4)) })
})

describe('addTo10', () => {
  it('has exactly the 66 sums to ten, each read by its recorded question', () => {
    const ids = addTo10.enumerate().map((f) => f.id)
    const want: string[] = []
    for (let a = 0; a <= 10; a++) for (let b = 0; a + b <= 10; b++) want.push(`add:${a}+${b}`)
    expect([...ids].sort()).toEqual(want.sort())
    for (const f of addTo10.enumerate()) {
      expect(addTo10.speech(f, 'choice')).toEqual([{ clip: questionClip(f.id) }])
      expect(f.family).toBe((f.answer as number) <= 5 ? 'small' : 'big')
    }
  })

  it('tags counting from the first number, the wrong operation, the numbers asked and near misses', () => {
    expect(tagOf(addTo10, 'add:5+3', 7)).toBe('countFromFirst')
    expect(tagOf(addTo10, 'add:5+3', 2)).toBe('wrongOperation')
    expect(tagOf(addTo10, 'add:5+3', 5)).toBe('operand')
    expect(tagOf(addTo10, 'add:5+3', 9)).toBe('near')
    expect(tagOf(addTo10, 'add:3+5', 2)).toBe('wrongOperation') // 5 − 3: the smaller from the bigger
    // two explanations for one value: never evidence
    expect(tagOf(addTo10, 'add:5+1', 5)).toBe('ambiguous') // counted from five, or repeated it
    expect(tagOf(addTo10, 'add:2+4', 2)).toBe('ambiguous') // 4 − 2, or repeated the 2
    // nothing to count on from zero, and a − 0 is the answer itself
    expect(tagOf(addTo10, 'add:6+0', 5)).toBe('near')
    expect(addTo10.candidates(factOf(addTo10, 'add:0+0')).every((c) => c.tag === 'near' || c.tag === 'operand')).toBe(true)
  })

  it('rotates the diagnostic card and always deals a near miss', () => {
    const f = factOf(addTo10, 'add:5+3')
    const shown = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const offered = i % 2 === 0 ? { countFromFirst: 0, wrongOperation: 5 } : { countFromFirst: 5, wrongOperation: 0 }
      const t = buildTask(addTo10, f, 'choice', makeRng(i), i, { offered }).task
      const tags = t.options.filter((o) => o !== 8).map((o) => t.distractorTags[String(o)])
      expect(tags).toContain(i % 2 === 0 ? 'countFromFirst' : 'wrongOperation')
      expect(tags.some((x) => x === 'near' || x === 'operand')).toBe(true)
      for (const o of t.options) shown.add(String(o))
    }
    expect(shown.has('7') && shown.has('2')).toBe(true)
  })

  it('opens Plusengen with all 66 keys and both misconceptions detectable on 5 + 3', () => {
    const keys = keysForNode(NODE_BY_ID['w0-plus10-l1'], { states: {}, audioVerified: true })
    expect(keys).toHaveLength(66)
    const k = keys.find((x) => x.key === 'add:5+3')!
    expect([...k.detectable!].sort()).toEqual(['countFromFirst', 'wrongOperation'])
    expect(k.op).toBe('+')
    const t = k.build('keypad', makeRng(1), 0)
    expect(classifyAnswer(t, 7)).toBe('countFromFirst')
    expect(detectableOf(t).sort()).toEqual(['countFromFirst', 'wrongOperation'])
  })

  it('teaches counting on from the bigger number', () => {
    expect(hintText(addTo10, 'add:3+5', null)).toBe('Start på fem. Hop tre gange frem.')
    expect(hintText(addTo10, 'add:5+3', 'countFromFirst')).toBe('Start på fem. Hop tre gange frem. Det første hop lander på seks.')
    expect(hintText(addTo10, 'add:5+3', 'wrongOperation')).toBe('Plus betyder, at der kommer flere til. Start på fem. Hop tre gange frem.')
    expect(hintText(addTo10, 'add:9+1', null)).toBe('Start på ni. Hop en gang frem.')
    expect(hintText(addTo10, 'add:0+4', 'countFromFirst')).toBe('Plus nul giver det samme tal.')
    const h = addTo10.hint(factOf(addTo10, 'add:5+3'), 'countFromFirst')
    expect(h.visual).toEqual({ scene: 'line', min: 0, max: 10, hops: [5, 6, 7, 8] })
    expect(h.misconception).toBe('countFromFirst')
  })
})

describe('subTo10', () => {
  it('has exactly the 66 differences inside ten', () => {
    const want: string[] = []
    for (let a = 0; a <= 10; a++) for (let b = 0; b <= a; b++) want.push(`sub:${a}-${b}`)
    expect(subTo10.enumerate().map((f) => f.id).sort()).toEqual(want.sort())
    for (const f of subTo10.enumerate()) expect(subTo10.speech(f, 'keypad')).toEqual([{ clip: questionClip(f.id) }])
  })

  it('tags one too many (counted the start), plus instead of minus and the numbers asked', () => {
    expect(tagOf(subTo10, 'sub:9-3', 7)).toBe('countFromFirst')
    expect(tagOf(subTo10, 'sub:9-3', 12)).toBe('wrongOperation')
    expect(tagOf(subTo10, 'sub:9-3', 9)).toBe('operand')
    expect(tagOf(subTo10, 'sub:9-3', 3)).toBe('operand')
    expect(tagOf(subTo10, 'sub:9-3', 5)).toBe('near')
    expect(tagOf(subTo10, 'sub:5-1', 5)).toBe('ambiguous') // counted from five, or repeated it
    expect(tagOf(subTo10, 'sub:5-3', 3)).toBe('ambiguous') // 5 − 3 + 1 = 3 is also the 3 asked
    expect(tagOf(subTo10, 'sub:7-0', 8)).toBe('near')
  })

  it('can show "plus instead of minus" above ten as the diagnostic card', () => {
    const f = factOf(subTo10, 'sub:9-3')
    const t = buildTask(subTo10, f, 'choice', makeRng(2), 0, { target: ['wrongOperation'] }).task
    expect(t.options).toContain(12)
    expect(t.distractorTags['12']).toBe('wrongOperation')
  })

  it('teaches counting back on the number line', () => {
    expect(hintText(subTo10, 'sub:9-3', null)).toBe('Start på ni. Hop tre gange tilbage.')
    expect(hintText(subTo10, 'sub:9-3', 'countFromFirst')).toBe('Start på ni. Hop tre gange tilbage. Det første hop lander på otte.')
    expect(hintText(subTo10, 'sub:9-3', 'wrongOperation')).toBe('Minus betyder, at nogle bliver taget væk. Start på ni. Hop tre gange tilbage.')
    expect(hintText(subTo10, 'sub:10-10', null)).toBe('Når man tager det hele væk, er der nul tilbage.')
    expect(hintText(subTo10, 'sub:4-0', null)).toBe('Minus nul giver det samme tal.')
    expect(subTo10.hint(factOf(subTo10, 'sub:9-3'), null).visual).toEqual({ scene: 'line', min: 0, max: 10, hops: [9, 8, 7, 6] })
  })

  it('counts up when most of it is taken away, and hops back for plus-instead-of-minus', () => {
    expect(hintText(subTo10, 'sub:10-8', null)).toBe('Start på otte. Hop op til ti og tæl hoppene.')
    expect(subTo10.hint(factOf(subTo10, 'sub:10-8'), null).visual).toEqual({ scene: 'line', min: 0, max: 10, hops: [8, 9, 10] })
    expect(hintText(subTo10, 'sub:10-8', 'countFromFirst')).toBe('Start på otte. Hop op til ti og tæl hoppene. Det første hop lander på ni.')
    expect(hintText(subTo10, 'sub:10-8', 'wrongOperation')).toBe('Minus betyder, at nogle bliver taget væk. Start på ti. Hop otte gange tilbage.')
    // half or less: back
    expect(hintText(subTo10, 'sub:8-4', null)).toBe('Start på otte. Hop fire gange tilbage.')
  })

  it('introduces small, meaningful differences first', () => {
    const order = [...subTo10.enumerate()].sort((x, y) => x.rank - y.rank).map((f) => f.id)
    expect(order[0]).toBe('sub:1-1')
    expect(order.indexOf('sub:0-0')).toBeGreaterThan(order.indexOf('sub:2-1'))
    const plus = [...addTo10.enumerate()].sort((x, y) => x.rank - y.rank).map((f) => f.id)
    expect(plus[0]).toBe('add:1+1')
    expect(plus.indexOf('add:3+0')).toBeGreaterThan(plus.indexOf('add:2+1'))
  })
})

describe('tenFriends', () => {
  const tasks = tasksUnderTest(tenFriends, 6)

  it('asks a + ? = 10 for a = 0–10 with the recorded question', () => {
    expect(tenFriends.enumerate().map((f) => f.id).sort()).toEqual(Array.from({ length: 11 }, (_, a) => `ten:${a}`).sort())
    expect(compile(tenFriends.speech(factOf(tenFriends, 'ten:4'), 'pair')).text).toBe('Fire plus hvad giver ti?')
  })

  it('drags one of four bubbles onto a ten-frame, and shows the equation on cards and keypad', () => {
    for (const { fact, kind, task } of tasks) {
      const a = fact.operands[0]
      if (kind === 'pair') {
        expect(task.prompt).toEqual({ scene: 'objects', n: a, layout: 'tenframe', thing: 'ball' })
        expect(task.options).toHaveLength(4)
      } else {
        expect(task.prompt).toEqual({ scene: 'equation', terms: [{ n: a }, { op: '+' }, { blank: true }, { op: '=' }, { n: 10 }] })
      }
      for (const o of task.options) expect(o as number).toBeLessThanOrEqual(10)
    }
  })

  it('introduces the easy partners first', () => {
    const order = [...tenFriends.enumerate()].sort((x, y) => x.rank - y.rank).map((f) => f.id)
    expect(order.slice(0, 3)).toEqual(['ten:9', 'ten:1', 'ten:5'])
    expect(order.slice(-2)).toEqual(['ten:10', 'ten:0'])
  })

  it('points at the empty cells', () => {
    expect(hintText(tenFriends, 'ten:4', 'near')).toBe('Tæl de tomme felter i ti-rammen.')
    expect(hintText(tenFriends, 'ten:10', null)).toBe('Ti-rammen er allerede fuld.')
    expect(tenFriends.hint(factOf(tenFriends, 'ten:4'), null).visual).toEqual({ scene: 'objects', n: 4, layout: 'tenframe', thing: 'ball' })
  })
})
