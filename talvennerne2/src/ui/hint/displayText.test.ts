// QA2 P3-2: the text beside a clock strategy writes the dial's numbers one way in the whole
// sentence — numerals, like the dial — while the voice keeps saying them as words.
import { describe, expect, it } from 'vitest'
import { factsOf, skillRegistry } from '../../engine/registry'
import { buildTask } from '../../engine/tasks'
import { makeRng } from '../../engine/rng'
import type { Task } from '../../engine/types'
import { clipText } from '../../speech/catalog'
import { compile } from '../../speech/compile'
import { dialNumerals, displayText } from './displayText'
import { hintFor } from './hintFor'

const reg = skillRegistry()
const WORDS = /(?<![\p{L}\d])(to|tre|fire|fem|seks|syv|otte|ni|ti|elleve|tolv)(?![\p{L}\d])/u

function clockTasks(): Task[] {
  const out: Task[] = []
  for (const skill of ['clockHour', 'clockHalf', 'clockQuarter'] as const) {
    const def = reg.get(skill)!
    for (const f of factsOf(def)) out.push(buildTask(def, f, 'choice', makeRng(3), 0).task)
  }
  return out
}

describe('clock strategies on screen (QA2 P3-2)', () => {
  it('writes "Ved hele timer peger den lange viser på 12. Den lille viser peger på 12."', () => {
    const def = reg.get('clockHour')!
    const t = buildTask(def, factsOf(def).find((f) => f.id === 'hel:0')!, 'choice', makeRng(3), 0).task
    const wrong = t.options.find((o) => o !== t.answer)!
    const h = hintFor(t, wrong, reg)
    const text = displayText(h.speech, clipText)
    expect(text).toContain('Ved hele timer peger den lange viser på 12.')
    expect(text).toContain('Den lille viser peger på 12.')
    // the voice still says the words
    expect(compile(h.speech).text).toMatch(/peger på tolv/)
  })

  it('never mixes an hour word with numerals in any clock strategy, for any answer', () => {
    let n = 0
    for (const t of clockTasks()) {
      for (const given of [null, ...t.options.filter((o) => o !== t.answer)]) {
        const text = displayText(hintFor(t, given, reg).speech, clipText)
        if (!/\d/.test(text)) continue
        expect(text, `${t.factId} ${String(given)}: ${text}`).not.toMatch(WORDS)
        n++
      }
    }
    expect(n).toBeGreaterThan(50)
  })

  it('leaves "en halv time" and "et kvarter" alone, and words inside other words', () => {
    expect(dialNumerals('er en halv time før')).toBe('er en halv time før')
    expect(dialNumerals('Kvart over er et kvarter efter den hele time.')).toBe('Kvart over er et kvarter efter den hele time.')
    expect(dialNumerals('Den lange viser peger på seks, og den lille viser står midt mellem')).toBe('Den lange viser peger på 6, og den lille viser står midt mellem')
    expect(dialNumerals('trekant tiår')).toBe('trekant tiår')
  })
})
