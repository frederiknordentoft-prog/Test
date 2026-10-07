import { describe, expect, it } from 'vitest'
import { factsOf, skillRegistry } from '../../../engine/registry'
import { hashSeed, makeRng } from '../../../engine/rng'
import { buildTask } from '../../../engine/tasks'
import type { SpeechPart, Task, TaskKind } from '../../../engine/types'
import { clipText, hasClip } from '../../../speech/catalog'
import { toDanishText } from '../../../speech/compile'
import { familyInstruction, instructionClip, shortInstruction } from '../../../speech/clips/ui/kinds'
import { shopsTwice } from './RoundScreen'

/**
 * The bubble says what the task asks for (QA3a P2-2): "Betal det, det koster." only where the tray is
 * to hold the price. The change (also Købmandsgården's), the price of two, the same money in kroner
 * and the fewest coins have their own words, and the price of two shows two of the thing.
 */

const reg = skillRegistry()
const text = (parts: readonly SpeechPart[]) => parts.map((p) => ('clip' in p ? clipText(p.clip) : '')).join(' ')

function tasksOf(skill: string, kind: TaskKind): Task[] {
  const def = reg.get(skill as never)!
  return factsOf(def).filter((_, i) => i % 3 === 0).map((f, i) => buildTask(def, f, kind, makeRng(hashSeed(`${f.id}:${i}`)), 0).task)
}

describe('the pay bubble follows the family', () => {
  it('says what the tray is to hold', () => {
    expect(text(shortInstruction('pay', 'change', 'from100'))).toBe('Læg byttepengene i bakken.')
    expect(text(shortInstruction('pay', 'change', 'from20'))).toBe('Læg byttepengene i bakken.')
    expect(text(shortInstruction('pay', 'kronerOre', 'addHalves'))).toBe('Betal for to af dem.')
    expect(text(shortInstruction('pay', 'kronerOre', 'fiftiesInKroner'))).toBe('Betal det samme med kroner.')
    expect(text(shortInstruction('pay', 'payExact', 'fewestCoins'))).toBe('Betal med så få mønter og sedler som muligt.')
    // the price itself, and every other kind, keep the kind's own short words
    for (const [skill, family] of [['payExact', 'to20'], ['payExact', 'to100'], ['kronerOre', 'readAmount']]) {
      expect(shortInstruction('pay', skill, family)).toEqual([{ clip: instructionClip('pay', 'short') }])
    }
    expect(shortInstruction('choice', 'change', 'from100')).toEqual([{ clip: 's.kind.choice.short' }])
    expect(shortInstruction('keypad', 'kronerOre', 'addHalves')).toEqual([{ clip: 's.kind.keypad.short' }])
  })

  it('uses recorded words that end the spoken question', () => {
    for (const skill of ['change', 'kronerOre', 'payExact']) {
      for (const task of tasksOf(skill, 'pay')) {
        const own = familyInstruction('pay', task.skill, task.family)
        if (!own) continue
        for (const clip of own) expect(hasClip(clip), clip).toBe(true)
        // the question ends with the same words, so the bubble repeats it and never contradicts it
        const said = toDanishText(task.speech)
        expect(said.endsWith(text(own.map((clip) => ({ clip }))).replace(/^Betal /, '')), `${task.factId}: ${said}`).toBe(true)
      }
    }
  })
})

describe('the price of two shows two things', () => {
  it('draws two of the thing for addHalves, in both kinds, and one everywhere else', () => {
    for (const kind of ['pay', 'choice'] as const) {
      const tasks = tasksOf('kronerOre', kind)
      expect(tasks.filter((t) => t.family === 'addHalves').every(shopsTwice), kind).toBe(true)
      expect(tasks.filter((t) => t.family !== 'addHalves').some(shopsTwice), kind).toBe(false)
    }
    for (const [skill, kind] of [['change', 'pay'], ['change', 'choice'], ['payExact', 'pay'], ['payExact', 'choice']] as const) {
      expect(tasksOf(skill, kind).some(shopsTwice), `${skill} ${kind}`).toBe(false)
    }
  })
})
