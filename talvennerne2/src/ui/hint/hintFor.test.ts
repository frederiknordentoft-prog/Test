import { describe, expect, it } from 'vitest'
import type { ErrorTag, Fact, HintSpec, SkillDef, Task, TaskKind } from '../../engine/types'
import { makeRegistry } from '../../engine/registry'
import { FIXTURE_SKILLS, addTo10Fixture, add100CarryFixture, hear20Fixture } from '../../engine/testing/fixtureSkills'
import { buildTask } from '../../engine/tasks'
import { makeRng } from '../../engine/rng'
import { compile, toDanishText } from '../../speech/compile'
import { EXAMPLES } from '../../dev/tasks/examples'
import { defaultVisual, hintFor, scaffoldFor, speechFor } from './hintFor'

const FIX = makeRegistry(FIXTURE_SKILLS)
const fact = (def: SkillDef, id: string): Fact => def.enumerate().find((f) => f.id === id)!
const task = (def: SkillDef, id: string, kind: TaskKind): Task => buildTask(def, fact(def, id), kind, makeRng(7), 1).task
const ex = (id: string): Task => Object.values(EXAMPLES).flat().find((e) => e.id === id)!.task

describe('hintFor', () => {
  it('uses the round’s own words when a skill’s clips are not recorded, with the task’s numbers', () => {
    const t = task(addTo10Fixture, 'add:3+4', 'keypad')
    const h = hintFor(t, 6, FIX)
    expect(h.fromSkill).toBe(false)
    expect(h.visual).toEqual({ scene: 'dotsAdd', a: 3, b: 4 })
    expect(compile(h.speech).missing).toEqual([])
    expect(toDanishText(h.speech)).toBe('Læg dem sammen. Tre og fire giver syv.')
  })

  it('plays the forgotCarry film for 38 + 45 = 73', () => {
    const t = task(add100CarryFixture, add100CarryFixture.enumerate().find((f) => f.family === 'TOplusTOcarry')!.id, 'keypad')
    const [a, b] = (t.prompt as { terms: { n?: number }[] }).terms.filter((x) => 'n' in x).map((x) => x.n!)
    const h = hintFor(t, a + b - 10, FIX)
    expect(h.tag).toBe('forgotCarry')
    expect(h.misconception).toBe('forgotCarry')
    expect(h.animated).toBe(true)
    expect(h.visual).toEqual({ scene: 'anim.forgotCarry', a, b })
    expect(compile(h.speech).missing).toEqual([])
  })

  it('plays the digitSwap film for a reversed number', () => {
    const t = task(hear20Fixture, 'hear:13', 'keypad')
    const h = hintFor(t, 31, FIX)
    expect(h.misconception).toBe('digitSwap')
    expect(h.visual).toEqual({ scene: 'anim.digitSwap', n: 13, given: 31 })
    expect(toDanishText(h.speech)).toContain('En tier og tre enere giver tretten.')
  })

  it('plays the digitSwap film in the kroner the child typed on the kroner keypad (entryScale 100)', () => {
    const t = { ...task(hear20Fixture, 'hear:13', 'keypad'), answer: 4700, entryScale: 100 as const, range: [0, 10_000] as [number, number] }
    const h = hintFor(t, 7400, FIX)
    expect(h.misconception).toBe('digitSwap')
    expect(h.visual).toEqual({ scene: 'anim.digitSwap', n: 47, given: 74 })
  })

  it('plays the smallerFromLarger film from the task’s own tags when no skill is registered', () => {
    const h = hintFor(ex('keypad-52-37'), 25, FIX)
    expect(h.animated).toBe(true)
    expect(h.visual).toEqual({ scene: 'anim.smallerFromLarger', a: 52, b: 37 })
  })

  it('shows the standard strategy for a near miss', () => {
    const h = hintFor(ex('choice-8+5'), 14, FIX)
    expect(h.misconception).toBeNull()
    expect(h.animated).toBe(false)
    expect(h.visual).toEqual({ scene: 'makeTen', a: 8, b: 5 })
    expect(toDanishText(h.speech)).toBe('Fyld tieren op først. Otte og to giver ti. Ti og tre giver tretten.')
  })

  it('keeps a skill’s own words and picture, and passes the kind (SkillDef.hint third argument)', () => {
    let seenKind: TaskKind | undefined
    const own: SkillDef = {
      ...addTo10Fixture,
      hint(_f: Fact, tag: ErrorTag | null, kind?: TaskKind): HintSpec {
        seenKind = kind
        return { speech: [{ clip: 's.round.hint.makeTen' }], visual: { scene: 'makeTen', a: 6, b: 4 }, ...(tag === 'countFromFirst' ? { misconception: 'countFromFirst' } : {}) }
      },
    } as SkillDef
    const reg = makeRegistry([own])
    const t = task(own, 'add:6+4', 'choice')
    const h = hintFor(t, 9, reg)
    expect(seenKind).toBe('choice')
    expect(h.fromSkill).toBe(true)
    expect(h.visual).toEqual({ scene: 'makeTen', a: 6, b: 4 })
    expect(h.misconception).toBe('countFromFirst')
  })

  it('never breaks a round: a throwing skill falls back to the round’s strategy', () => {
    const broken = { ...addTo10Fixture, hint: () => { throw new Error('boom') } } as unknown as SkillDef
    const t = task(addTo10Fixture, 'add:2+5', 'choice')
    const errors = console.error
    console.error = () => {}
    try {
      const h = hintFor(t, 6, makeRegistry([broken]))
      expect(h.visual).toEqual({ scene: 'dotsAdd', a: 2, b: 5 })
    } finally {
      console.error = errors
    }
  })
})

describe('pictures drawn from the prompt', () => {
  it('pictures the target for countTap, not the pile', () => {
    expect(defaultVisual(ex('count-7'))).toEqual({ scene: 'objects', n: 7, layout: 'tenframe', thing: 'carrot' })
    expect(toDanishText(speechFor(defaultVisual(ex('count-7')), ex('count-7')))).toBe('Sig tallene højt, mens du lægger dem i kurven. Der skal være syv.')
  })

  it('puts numbers to order on a number line', () => {
    expect(defaultVisual(ex('sort-numbers'))).toEqual({ scene: 'line', min: 0, max: 20, hops: [5, 8, 12, 19] })
  })

  it('hops to the ten, then the ones, to find a place on the number line', () => {
    const t = ex('line-37')
    expect(defaultVisual(t)).toEqual({ scene: 'line', min: 0, max: 100, hops: [0, 30, 37] })
    expect(toDanishText(speechFor(defaultVisual(t), t))).toBe('Se på tallinjen. Tre tiere og syv enere giver syvogtredive.')
    expect(defaultVisual(ex('line-600'))).toEqual({ scene: 'line', min: 0, max: 1000, hops: [0, 600] })
  })

  it('goes back to ten for 13 − 5 and uses columns for two-digit sums', () => {
    const sub = { ...ex('choice-8+5'), prompt: { scene: 'equation' as const, terms: [{ n: 13 }, { op: '−' as const }, { n: 5 }, { op: '=' as const }, { blank: true as const }] }, answer: 8 }
    expect(defaultVisual(sub)).toEqual({ scene: 'backToTen', a: 13, b: 5 })
    expect(toDanishText(speechFor(defaultVisual(sub), sub))).toBe('Gå tilbage til ti først. Tretten minus tre giver ti. Ti minus to giver otte.')
    expect(defaultVisual(ex('keypad-38+45'))).toEqual({ scene: 'columns', a: 38, b: 45, op: '+', carry: true })
  })

  it('opens the standard picture behind the lightbulb, never a film', () => {
    expect(scaffoldFor(ex('choice-8+5'), FIX)).toEqual({ scene: 'makeTen', a: 8, b: 5 })
    expect(scaffoldFor(ex('keypad-52-37'), FIX)).toEqual({ scene: 'columns', a: 52, b: 37, op: '−', carry: true })
  })
})

describe('the borrowNoDecrement film (UI-fund 9)', () => {
  it('plays for 52 − 27 = 35 in sub100Borrow: a ten borrowed, the tens kept', async () => {
    // the round's own words when no skill has any (the same recorded sentence the skills use)
    expect(toDanishText(speechFor({ scene: 'anim.borrowNoDecrement', a: 52, b: 27 }, ex('keypad-52-37')))).toBe(
      'Når du veksler en tier, er der en tier mindre tilbage. Tooghalvtreds minus syvogtyve giver femogtyve.',
    )
    const { skillRegistry, keysForSkills } = await import('../../engine/registry')
    const reg = skillRegistry()
    const keys = keysForSkills([{ skill: 'sub100Borrow' }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })
    let played = 0
    for (const k of keys) {
      for (let seed = 1; seed < 6; seed++) {
        const t = k.build('keypad', makeRng(seed), 0)
        if (t.prompt.scene !== 'equation') continue
        const [a, b] = t.prompt.terms.filter((x): x is { n: number } => 'n' in x).map((x) => x.n)
        if (a % 10 >= b % 10 || a >= 100) continue
        const wrong = (Math.floor(a / 10) - Math.floor(b / 10)) * 10 + (a % 10) + 10 - (b % 10)
        const h = hintFor(t, wrong, reg)
        if (h.misconception !== 'borrowNoDecrement') continue
        played++
        expect(h.animated).toBe(true)
        expect(h.visual).toEqual({ scene: 'anim.borrowNoDecrement', a, b })
        expect(compile(h.speech).missing).toEqual([])
        expect(toDanishText(h.speech)).toMatch(/^Når du veksler en tier, er der en tier mindre tilbage\./)
      }
    }
    expect(played).toBeGreaterThan(0)
  })
})
