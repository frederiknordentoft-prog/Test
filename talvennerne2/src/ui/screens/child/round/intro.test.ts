import { describe, expect, it } from 'vitest'
import type { Task } from '../../../../engine/types'
import { EXAMPLES } from '../../../../dev/tasks/examples'
import { afterIntro, optionReadout, pickRotating, readout, taskIntro } from './intro'
import type { Onboarding } from './intro'

const ex = (id: string): Task => Object.values(EXAMPLES).flat().find((e) => e.id === id)!.task
const fresh: Onboarding = { demosSeen: {}, instructionsHeard: {} }

describe('the intro of a task (SPEC §3.4)', () => {
  it('plays the demo the first two times a profile meets a kind', () => {
    const t = ex('keypad-38+45')
    expect(taskIntro(t, null, fresh)).toEqual({ demo: true, instruction: 'long' })
    let seen = afterIntro(fresh, 'keypad', taskIntro(t, null, fresh))
    expect(taskIntro(t, null, seen).demo).toBe(true)
    seen = afterIntro(seen, 'keypad', taskIntro(t, null, seen))
    expect(taskIntro(t, null, seen).demo).toBe(false)
  })

  it('reads the long instruction three times, then the short one', () => {
    const t = ex('choice-8+5')
    let seen = fresh
    const forms: (string | null)[] = []
    for (let i = 0; i < 5; i++) {
      const intro = taskIntro(t, 'keypad', seen)
      forms.push(intro.instruction)
      seen = afterIntro(seen, 'choice', intro)
    }
    expect(forms).toEqual(['long', 'long', 'long', 'short', 'short'])
  })

  it('says nothing new when the kind does not change, and never for the golden egg or a retry', () => {
    const t = ex('choice-8+5')
    expect(taskIntro(t, 'choice', fresh)).toEqual({ demo: false, instruction: null })
    expect(taskIntro(t, null, fresh, { golden: true })).toEqual({ demo: false, instruction: null })
    expect(taskIntro({ ...t, retryOf: 'x' }, null, fresh)).toEqual({ demo: false, instruction: null })
  })

  it('reads the question, then the instruction, then the spoken options in order', () => {
    const t = ex('choice-unit')
    const steps = readout(t, { demo: false, instruction: 'short' })
    expect(steps.map((s) => s.parts)).toEqual([
      t.speech,
      [{ clip: 's.kind.choice.short' }],
      [{ clip: 'noun.unit.cm.end' }],
      [{ clip: 'noun.unit.m.end' }],
      [{ clip: 'noun.unit.kg.end' }],
    ])
    expect(steps.map((s) => s.option)).toEqual([null, null, 0, 1, 2])
  })

  it('leaves the instruction out when the demo film just said it', () => {
    const steps = readout(ex('keypad-38+45'), { demo: true, instruction: 'long' })
    expect(steps).toHaveLength(1)
  })

  it('never reads numbers, clocks or shapes on cards', () => {
    expect(optionReadout(ex('choice-8+5'))).toEqual([])
    expect(optionReadout(ex('choice-clock'))).toEqual([])
    expect(optionReadout(ex('choice-shape'))).toEqual([])
  })

  it('rotates praise', () => {
    expect([0, 1, 2, 3].map((i) => pickRotating(['a', 'b', 'c'], i))).toEqual(['a', 'b', 'c', 'a'])
  })
})
