import { describe, expect, it } from 'vitest'
import count10Module from './count10'
import count20Module from './count20'
import hear20Module from './hear20'
import order20Module from './order20'
import { globalIdCheck, skillContract, tasksUnderTest } from './testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer, digitSwapOf } from '../../misconceptions'
import { keysForSkills } from '../../registry'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import type { Fact, Prompt, SkillDef, Task } from '../../types'

// Through the frozen contract, as the engine calls them.
const count10: SkillDef = count10Module
const count20: SkillDef = count20Module
const hear20: SkillDef = hear20Module
const order20: SkillDef = order20Module

const idNumber = (f: Fact) => Number(f.id.split(':').pop())
const objects = (p: Prompt) => {
  if (p.scene !== 'objects') throw new Error(`expected an objects scene, got ${p.scene}`)
  return p
}
const text = (t: Task) => compile(t.speech).text

describe('number skills of 0. klasse', () => {
  globalIdCheck()

  skillContract(count10, { families: { scatter: 10, flash: 18 }, answerOf: (f) => idNumber(f) })
  skillContract(count20, { families: { tenframe: 10, loose: 10 }, answerOf: (f) => idNumber(f) })
  skillContract(hear20, { families: { small: 11, teens: 10 }, answerOf: (f) => Number(f.id.slice(4)) })
  skillContract(order20, {
    families: { after: 20, before: 20, between: 19, bigger: 20 },
    answerOf(f, kind) {
      if (kind === 'sortOrder') return undefined // checked below, from the stones
      const [x, y] = f.operands
      return { after: x + 1, before: x - 1, between: (x + y) / 2, bigger: Math.max(x, y) }[f.family]
    },
  })
})

describe('count10', () => {
  const tasks = tasksUnderTest(count10, 2)

  it('has 1–10 spread out and 1–6 on a die, fingers and a ten-frame', () => {
    const ids = count10.enumerate().map((f) => f.id).sort()
    const want = [
      ...Array.from({ length: 10 }, (_, i) => `c10:scatter:${i + 1}`),
      ...['dice', 'fingers', 'tenframe'].flatMap((r) => Array.from({ length: 6 }, (_, i) => `c10:${r}:${i + 1}`)),
    ].sort()
    expect(ids).toEqual(want)
  })

  it('flashes the die, the fingers and the ten-frame for 1,5 s, and lets spread things stay', () => {
    for (const { fact, kind, task } of tasks) {
      if (kind === 'countTap') continue
      const p = objects(task.prompt)
      expect(p.n).toBe(task.answer)
      const layout = fact.id.split(':')[1]
      expect(p.layout).toBe(layout)
      expect(p.flashMs).toBe(layout === 'scatter' ? undefined : 1500)
      expect(text(task)).toMatch(layout === 'scatter' ? /^Hvor mange \S+ er der\?$/ : /^Hvor mange \S+ så du( på terningen)?\?$/)
    }
  })

  it('names the thing that is drawn', () => {
    for (const { kind, task } of tasks) {
      const p = objects(task.prompt)
      if (kind === 'countTap' || p.layout !== 'scatter') continue
      expect(compile(task.speech).clips).toEqual([`s.count.howMany.${p.thing}`])
    }
    const things = count10.enumerate().filter((f) => f.family === 'scatter').map((f) => objects(count10.prompt(f, 'choice', makeRng(1))).thing)
    expect(new Set(things).size).toBe(10)
  })

  it('counts out from a pile that is always bigger than the target, with the right noun', () => {
    for (const { fact, kind, task } of tasks) {
      if (kind !== 'countTap') continue
      const p = objects(task.prompt)
      expect(p.n).toBeGreaterThan(task.answer as number)
      expect(p.layout).toBe('row')
      expect(task.range).toEqual([0, p.n])
      const clips = compile(task.speech).clips
      expect(clips[0]).toBe('frag.laeg')
      expect(clips[2]).toBe(`noun.thing.${p.thing}.${task.answer === 1 ? 'sg' : 'pl'}`)
      expect(clips.at(-1)).toBe('frag.i_kurven')
      if (fact.id === 'c10:scatter:1') expect(text(task)).toBe('Læg et æble i kurven.')
      if (fact.id === 'c10:dice:1') expect(text(task)).toBe('Læg en klods i kurven.')
      if (fact.id === 'c10:scatter:7') expect(text(task)).toBe('Læg syv bolde i kurven.')
    }
  })

  it('asks a mastered fact on the keypad first, so a flash fact stays a glance', () => {
    expect(count10.kinds.filter((k) => k === 'keypad' || k === 'countTap')).toEqual(['keypad', 'countTap'])
  })

  it('gives a hint that matches the picture', () => {
    const hint = (id: string) => compile(count10.hint(count10.enumerate().find((f) => f.id === id)!, null).speech).text
    expect(hint('c10:fingers:6')).toBe('En hel hånd og en finger mere er seks.')
    expect(hint('c10:dice:5')).toBe('Et øje i hvert hjørne og et i midten. Det er fem.')
    expect(hint('c10:tenframe:5')).toBe('En fuld række er fem.')
    expect(hint('c10:scatter:8')).toBe('Peg på hver ting, mens du tæller. Tæl hver ting en gang.')
  })
})

describe('count20', () => {
  const tasks = tasksUnderTest(count20, 2)

  it('shows 11–20 in two ten-frames and spread out', () => {
    for (const { fact, kind, task } of tasks) {
      const p = objects(task.prompt)
      if (kind === 'countTap') {
        expect(p.n).toBeGreaterThan(20)
        continue
      }
      expect(p.n).toBe(task.answer)
      expect(p.layout).toBe(fact.family === 'tenframe' ? 'tenframe' : 'scatter')
      expect(p.flashMs).toBeUndefined()
      expect(text(task)).toMatch(fact.family === 'tenframe' ? /^Hvor mange prikker er der\?$/ : /^Hvor mange \S+ er der\?$/)
    }
  })

  it('keeps cards between 10 and 20 and tags the forgotten ten for typed answers', () => {
    const f = count20.enumerate().find((x) => x.id === 'c20:loose:14')!
    const task = buildTask(count20, f, 'keypad', makeRng(3), 0).task
    expect(classifyAnswer(task, 4)).toBe('near')
    expect(classifyAnswer(task, 13)).toBe('near')
    expect(classifyAnswer(task, 41)).toBe('digitSwap') // the global check: a reversed typed answer
  })

  it('teaches the ten as a chunk', () => {
    const f = count20.enumerate().find((x) => x.id === 'c20:tenframe:16')!
    expect(compile(count20.hint(f, 'near').speech).text).toBe('En fuld ti-ramme er ti. Tæl videre fra ti.')
  })
})

describe('hear20', () => {
  const tasks = tasksUnderTest(hear20, 8)

  it('ranks 0–10 first, then 20, and the irregular teens 11–19 last', () => {
    const byRank = [...hear20.enumerate()].sort((a, b) => a.rank - b.rank).map((f) => f.answer)
    expect(byRank.slice(-9)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19])
    expect(byRank[11]).toBe(20)
    expect(byRank.slice(0, 11).sort((a, b) => Number(a) - Number(b))).toEqual(Array.from({ length: 11 }, (_, i) => i))
  })

  it('only says the number', () => {
    for (const { fact, kind, task } of tasks) {
      expect(task.prompt).toEqual({ scene: 'hear' })
      const n = fact.answer as number
      const word = compile([{ num: n, form: 'end' }]).text.replace(/\.$/, '').toLowerCase()
      expect(text(task)).toBe(`${kind === 'keypad' ? 'Skriv' : 'Find'} tallet ${word}.`)
    }
  })

  it('shows the reversed number as the diagnostic card for 13–19 and classifies 12 → 21', () => {
    for (const { fact, kind, task } of tasks) {
      const n = fact.answer as number
      if (kind === 'choice' && n >= 13 && n <= 19) {
        expect(task.options).toContain(digitSwapOf(n))
        expect(task.distractorTags[String(digitSwapOf(n))]).toBe('digitSwap')
      }
      if (kind === 'choice' && (n < 13 || n > 19)) for (const o of task.options) expect(o as number).toBeLessThanOrEqual(20)
    }
    const twelve = buildTask(hear20, hear20.enumerate().find((f) => f.answer === 12)!, 'keypad', makeRng(1), 0).task
    expect(classifyAnswer(twelve, 21)).toBe('digitSwap')
    expect(classifyAnswer(twelve, 2)).toBe('near')
  })

  it('explains the teens: ten and the ones, written with the 1 first', () => {
    const f = (n: number) => hear20.enumerate().find((x) => x.answer === n)!
    expect(compile(hear20.hint(f(14), null).speech).text).toBe('Fjorten er ti og fire. Vi skriver ettallet først.')
    const swap = hear20.hint(f(14), 'digitSwap')
    expect(compile(swap.speech).text).toBe('Fjorten er ti og fire. Vi siger fire først, men vi skriver ettallet først.')
    expect(swap.misconception).toBe('digitSwap')
    expect(compile(hear20.hint(f(12), 'digitSwap').speech).text).toBe('Tolv er ti og to. Vi skriver ettallet først.')
    expect(compile(hear20.hint(f(7), null).speech).text).toBe('Så mange er syv.')
    expect(compile(hear20.hint(f(0), null).speech).text).toBe('Nul betyder, at der ingen er.')
  })

  it('keeps Tællelunden to 0–10', () => {
    const keys = keysForSkills([{ skill: 'hear20', max: 10 }], { states: {}, audioVerified: true })
    expect(keys.map((k) => k.key).sort()).toEqual(Array.from({ length: 11 }, (_, n) => `h20:${n}`).sort())
  })
})

describe('order20', () => {
  const tasks = tasksUnderTest(order20)
  const numbersOf = (t: Task): number[] => {
    const p = t.prompt
    const fromPrompt = p.scene === 'row' ? p.cells.filter((c): c is number => typeof c === 'number') : p.scene === 'line' ? [p.max] : []
    const fromOptions = t.options.filter((o): o is number => typeof o === 'number')
    const fromAnswer = String(t.answer).split('|').map(Number)
    return [...fromPrompt, ...fromOptions, ...fromAnswer]
  }

  it('sorts four cards that continue the stones, and contain the instance', () => {
    for (const { fact, task } of tasks) {
      if (task.kind !== 'sortOrder') continue
      const cards = String(task.answer).split('|').map(Number)
      const row = (task.prompt as Extract<Prompt, { scene: 'row' }>).cells
      expect(cards).toHaveLength(4)
      const [x, y] = fact.operands
      const step = (d: number) => cards.every((c, i) => i === 0 || c - cards[i - 1] === d)
      switch (fact.family) {
        case 'after':
          expect(cards[0]).toBe((row[0] as number) + 1)
          expect(step(1)).toBe(true)
          expect(cards).toContain(x + 1)
          break
        case 'before':
          expect(cards[0]).toBe((row[0] as number) - 1)
          expect(step(-1)).toBe(true)
          expect(cards).toContain(x - 1)
          break
        case 'between':
          expect(cards[0]).toBe((row[0] as number) + 1)
          expect(cards[3]).toBe((row[5] as number) - 1)
          expect(step(1)).toBe(true)
          expect(cards).toContain(x + 1)
          break
        case 'bigger':
          expect([...cards].sort((a, b) => b - a)).toEqual(cards)
          expect(new Set(cards).size).toBe(4)
          expect(cards).toContain(x)
          expect(cards).toContain(y)
          break
      }
      expect(row.filter((c) => c === null)).toHaveLength(4)
    }
  })

  it('never shows a card bigger than the answer to "which is biggest"', () => {
    for (const { fact, task } of tasks) {
      if (fact.family !== 'bigger' || task.kind !== 'choice') continue
      for (const o of task.options) expect(o as number).toBeLessThanOrEqual(task.answer as number)
      expect(task.options).toContain(Math.min(...fact.operands))
    }
  })

  it('stays inside the instance: stones and cards to sort never above its largest number (or 5)', () => {
    for (const { fact, task } of tasks) {
      const limit = Math.max(5, ...fact.operands, fact.answer as number)
      const line = task.prompt.scene === 'line' ? task.prompt.max : 0
      const shown = task.kind === 'choice' ? numbersOf(task).filter((n) => !task.options.includes(n)) : numbersOf(task)
      for (const n of shown) {
        if (n === line) continue // the line's end: 10 or 20
        expect(n, `${fact.id} ${task.kind}`).toBeLessThanOrEqual(limit)
        expect(n).toBeGreaterThanOrEqual(0)
      }
      // wrong cards may be a neighbour above, but never past the 0–10 / 0–20 the instance lives in
      expect(task.range).toEqual([0, limit <= 10 ? 10 : 20])
      if (line) expect(line).toBe(task.range[1])
    }
  })

  it('builds every kind from Tællelunden (max 10) with numbers to 10 only', () => {
    const keys = keysForSkills([{ skill: 'order20', max: 10 }], { states: {}, audioVerified: true })
    expect(keys.map((k) => k.key)).toEqual(['order20/after', 'order20/before', 'order20/between', 'order20/bigger'])
    for (const k of keys) {
      for (const kind of order20.kinds) {
        for (let i = 0; i < 60; i++) {
          const t = k.build(kind, makeRng(i * 7 + 1), i)
          for (const n of numbersOf(t)) expect(n, `${t.factId} ${kind}`).toBeLessThanOrEqual(10)
        }
      }
    }
  })

  it('asks the exact number on the line, and the line is production', () => {
    for (const { task } of tasks) {
      if (task.kind !== 'numberline') continue
      expect(task.tolerance).toBe(0)
      expect(task.prompt).toEqual({ scene: 'line', min: 0, max: task.range[1] })
    }
  })

  it('reads the questions in plain Danish', () => {
    const f = (id: string) => order20.enumerate().find((x) => x.id === id)!
    const t = (id: string, kind: Parameters<typeof order20.speech>[1]) => compile(order20.speech(f(id), kind)).text
    expect(t('o20:after:7', 'choice')).toBe('Hvilket tal kommer efter syv?')
    expect(t('o20:before:7', 'keypad')).toBe('Hvilket tal kommer før syv?')
    expect(t('o20:between:5:7', 'numberline')).toBe('Hvilket tal ligger mellem fem og syv?')
    expect(t('o20:after:7', 'sortOrder')).toBe('Tæl videre fra fire.')
    expect(t('o20:before:2', 'sortOrder')).toBe('Tæl baglæns fra fire.')
    expect(t('o20:between:5:7', 'sortOrder')).toBe('Hvilke tal ligger mellem to og syv?')
  })

  it('draws fresh instances inside the family, avoiding the recent ones', () => {
    for (const fam of order20.families) {
      const rng = makeRng(5)
      const avoid = new Set<string>()
      for (let i = 0; i < 15; i++) {
        const f = order20.instance!(fam, rng, avoid)
        expect(f.family).toBe(fam.id)
        expect(avoid.has(f.id)).toBe(false)
        avoid.add(f.id)
      }
    }
  })
})
