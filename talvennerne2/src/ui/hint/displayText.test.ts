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

// QA3a P3-2 and P3-3: the strategies of 3. klasse read clearly on screen.
describe('the text beside a strategy of 3. klasse', () => {
  const said = (parts: Parameters<typeof displayText>[0]) => displayText(parts, clipText)

  it('writes "c divideret med d q" as the equation: "Så giver 18 : 3 = 6."', () => {
    const parts = [{ clip: 'hint.div.soGives' }, { num: 18, form: 'mid' }, { clip: 'op.divideret_med' }, { num: 3, form: 'mid' }, { num: 6, form: 'end' }] as const
    expect(said([...parts])).toBe('Så giver 18 : 3 = 6.')
    // the voice keeps its words
    expect(compile([...parts]).text).toBe('Så giver atten divideret med tre seks.')
    // a question stays a question, and numbers that are no quotient are left as they are
    expect(said([{ clip: 'frag.hvad_er' }, { num: 18, form: 'mid' }, { clip: 'op.divideret_med' }, { num: 3, form: 'end' }])).toBe('Hvad er 18 divideret med 3?')
    expect(said([{ num: 18, form: 'mid' }, { clip: 'op.divideret_med' }, { num: 3, form: 'mid' }, { num: 5, form: 'end' }])).toBe('18 divideret med 3 5.')
  })

  it('shows every division strategy of 3. klasse with its equation, never two numbers side by side', () => {
    let n = 0
    for (const skill of ['div2510', 'divAll'] as const) {
      const def = reg.get(skill)!
      for (const f of factsOf(def)) {
        const t = buildTask(def, f, 'choice', makeRng(5), 0).task
        for (const given of [null, ...t.options.filter((o) => o !== t.answer)]) {
          const text = displayText(hintFor(t, given, reg).speech, clipText)
          if (!text.includes('Så giver')) continue
          const [c, d] = f.operands
          expect(text, `${f.id}: ${text}`).toContain(`Så giver ${c} : ${d} = ${c / d}.`)
          expect(text, f.id).not.toMatch(/divideret med \d+ \d+/)
          n++
        }
      }
    }
    expect(n).toBeGreaterThan(50)
  })

  it('says "er klokken 10.15", never "klokken kl. 10.15"', () => {
    const def = reg.get('clockElapsed')!
    let n = 0
    for (const f of factsOf(def)) {
      const t = buildTask(def, f, 'choice', makeRng(5), 0).task
      for (const given of [null, ...t.options.filter((o) => o !== t.answer)]) {
        const text = displayText(hintFor(t, given, reg).speech, clipText)
        expect(text, `${f.id}: ${text}`).not.toMatch(/klokken kl\./i)
        if (/(er|var) klokken \d+\.\d\d/.test(text)) n++
      }
    }
    expect(n).toBeGreaterThan(20)
    expect(said([{ clip: 'hint.clockElapsed.d.plusHalf' }, { clock: { minutes: 585, style: 'analog', form: 'mid' } }, { clip: 'hint.clockElapsed.is' }, { clock: { minutes: 615, style: 'analog', form: 'end' } }]))
      .toBe('En halv time efter kl. 9.45 er klokken 10.15.')
  })
})
