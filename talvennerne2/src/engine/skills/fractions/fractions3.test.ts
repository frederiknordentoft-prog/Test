// The fraction skills of 3. klasse (SK3-GEO): fractionOfSet and fractionCompare. Answers are worked out
// again here from the ids and the cards (fractions compared by their values), never with the skills'
// own code.
import { describe, expect, it } from 'vitest'
import fractionOfSetModule from './fractionOfSet'
import fractionCompareModule from './fractionCompare'
import { geoSuite, textOf } from '../shapes/testing/suite'
import { tasksUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { isCorrect } from '../../answer'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { guessP, isProduction } from '../../kinds'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import { canShare, shareValue } from '../../../ui/task/share/logic'
import type { AnswerValue, Fact, FamilyDef, Prompt, SkillDef, Task } from '../../types'

const fractionOfSet: SkillDef = fractionOfSetModule
const fractionCompare: SkillDef = fractionCompareModule

/** Any fact by id: the canonical ones, else every instance of its family drawn until it comes. */
function fact(def: SkillDef, id: string): Fact {
  const known = def.enumerate().find((f) => f.id === id)
  if (known) return known
  for (const fam of def.families) {
    const avoid = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const f = def.instance!(fam, makeRng(i), avoid)
      if (f.id === id) return f
      avoid.add(f.id)
    }
  }
  throw new Error(`${def.id}: no fact ${id}`)
}
const task = (def: SkillDef, id: string, kind: Task['kind'], seed = 1) => buildTask(def, fact(def, id), kind, makeRng(seed), 0).task
const hintText = (def: SkillDef, id: string, tag: string | null, kind?: Task['kind']) => compile(def.hint(fact(def, id), tag as never, kind).speech).text

/** n/d of total from the id. */
const ofSet = (id: string) => {
  const [, nd, total] = id.split(':')
  const [n, d] = nd.split('/').map(Number)
  return { n, d, total: Number(total), part: (Number(total) * n) / d }
}
/**
 * How often a deal of three quarters on two plates is right by luck: the view takes only an empty pile, so
 * it is one of ⌊total/2⌋ + 1 deals (4: 4|0, 3|1, 2|2). 0 for a deal onto d plates (SPEC's 0.01 stands).
 */
const dealGuess = (f: Pick<Fact, 'id'>) => {
  const { n, total } = ofSet(f.id)
  return n > 1 ? 1 / (Math.floor(total / 2) + 1) : 0
}
/** The value of a fraction card. */
const valueOf = (o: AnswerValue) => {
  const [n, d] = String(o).slice(5).split('/').map(Number)
  return n / d
}
const biggestAsked = (t: Task) => textOf(t).includes('størst') || textOf(t).includes('største')

describe('fractions of 3. klasse (SK3-GEO)', () => {
  geoSuite(fractionOfSet, {
    families: { halfOf: 27, quarterOf: 15, thirdOf: 21, threeQuartersOf: 18 },
    idFormat: /^fos:(1\/2|1\/3|1\/4|3\/4):\d{1,2}:(strawberry|apple|carrot)$/,
    answerOf(f, kind) {
      const { n, part, total } = ofSet(f.id)
      // three quarters are dealt onto two plates: the deal itself
      return kind === 'share' && n > 1 ? `${part}|${total - part}` : part
    },
    isRight: (f, _t, o) => o === ofSet(f.id).part,
    ceilings: { share: 5, choice: 3, keypad: 5 },
    guessable: (f, kind) => kind === 'share' && dealGuess(f) > 0.12,
  })

  geoSuite(fractionCompare, {
    families: { pairBigger: 14, pairSmaller: 14, order4: 21 },
    idFormat: /^fcm:(b:[2-8],[2-8]|s:[2-8],[2-8]|o:[1-3]:[2-8],[2-8],[2-8],[2-8])$/,
    answerOf(f, kind, t) {
      const cards = [...t.options].sort((a, b) => valueOf(b) - valueOf(a))
      if (kind === 'sortOrder') return (f.family === 'pairBigger' ? cards : cards.reverse()).join('|')
      return biggestAsked(t) ? cards[0] : cards[cards.length - 1]
    },
    isRight(_f, t, o) {
      const values = t.options.map(valueOf)
      return valueOf(o) === (biggestAsked(t) ? Math.max(...values) : Math.min(...values))
    },
    ceilings: { choice: 3, sortOrder: 5 },
  })
})

// ─── fractionOfSet ──────────────────────────────────────────────────────────

describe('fractionOfSet', () => {
  const tasks = tasksUnderTest(fractionOfSet)

  it('deals the heap onto as many plates as the denominator, three quarters onto two', () => {
    for (const { fact: f, kind, task: t } of tasks) {
      const { n, d, total } = ofSet(f.id)
      if (kind !== 'share') {
        expect(t.prompt, f.id).toEqual({ scene: 'objects', n: total, layout: 'scatter', thing: f.id.split(':')[3] })
        continue
      }
      const p = t.prompt as Extract<Prompt, { scene: 'share' }>
      // three quarters of 4, 8 and 12 are one deal in 3, 5 and 7: no production (box 3); 16 and up are
      expect([p.total, p.recipients, canShare(t), isProduction(t)], f.id).toEqual([total, n > 1 ? 2 : d, true, !(n > 1 && total <= 12)])
      expect(guessP(t), f.id).toBeCloseTo(Math.max(0.01, dealGuess(f)), 12)
      // the right deal hands in the answer, an uneven one −1 (or a wrong split)
      const each = total / p.recipients
      const fair = n > 1 ? [t.answer, total - (t.answer as number)].map(Number) : Array.from({ length: p.recipients }, () => each)
      if (n > 1) {
        const part = Number(String(t.answer).split('|')[0])
        expect(isCorrect(t, shareValue(t, [total - part, part])), f.id).toBe(true)
        expect(isCorrect(t, shareValue(t, [total / 2, total / 2])), f.id).toBe(false)
      } else {
        expect(isCorrect(t, shareValue(t, fair)), f.id).toBe(true)
        expect(classifyAnswer(t, shareValue(t, [...fair.slice(1), fair[0] + 1].map((c, i) => (i === 0 ? c - 1 : c)))), f.id).toBe('shareUnequal')
      }
      expect(t.distractorTags, f.id).toEqual({})
    }
  })

  it('reads the denominator as the answer as denominatorAsAnswer, unless it is the whole heap or a likelier slip', () => {
    for (const { fact: f, kind, task: t } of tasks) {
      if (kind !== 'keypad') continue
      const { d, total, part } = ofSet(f.id)
      if (d === part) continue
      // the rest, one heap, one more or less: the same value has a likelier explanation (A9)
      const ambiguous = d === total || [total - part, total / d, part + 1, part - 1].includes(d)
      expect(classifyAnswer(t, d), f.id).toBe(ambiguous ? 'ambiguous' : 'denominatorAsAnswer')
      expect(detectableOf(t).includes('denominatorAsAnswer'), f.id).toBe(!ambiguous)
      expect(classifyAnswer(t, total), f.id).toBe(d === total ? 'ambiguous' : 'operand')
    }
    const t = task(fractionOfSet, 'fos:1/4:8:apple', 'choice')
    expect(t.options).toContain(4)
    expect(t.distractorTags['4']).toBe('denominatorAsAnswer')
  })

  it('never takes a denominator that is also the rest, one heap or one off as a sign (A9): ½ of 6, ¼ of 12 and 20, ⅓ of 6 and 12, ¾ of 16', () => {
    const both: [string, number][] = [
      ['fos:1/2:6:apple', 2], ['fos:1/4:12:carrot', 4], ['fos:1/4:20:apple', 4], ['fos:1/3:6:strawberry', 3], ['fos:1/3:12:apple', 3],
      ['fos:3/4:16:carrot', 4],
    ]
    for (const [id, d] of both) {
      for (const kind of ['keypad', 'choice'] as const) {
        const t = task(fractionOfSet, id, kind)
        expect([classifyAnswer(t, d), detectableOf(t)], `${id} ${kind}`).toEqual(['ambiguous', []])
      }
    }
    // where nothing else gives the denominator it stays the sign: ¼ of 8 → 4, ⅓ of 18 → 3, ¾ of 20 → 4
    for (const [id, d] of [['fos:1/4:8:apple', 4], ['fos:1/3:18:apple', 3], ['fos:3/4:20:apple', 4]] as const) {
      expect(classifyAnswer(task(fractionOfSet, id, 'keypad'), d), id).toBe('denominatorAsAnswer')
    }
  })

  it('asks in Danish, and deals into heaps in the hint', () => {
    expect(textOf(task(fractionOfSet, 'fos:1/4:12:strawberry', 'keypad'))).toBe('Hvor mange er en fjerdedel af tolv jordbær?')
    expect(textOf(task(fractionOfSet, 'fos:1/2:12:carrot', 'choice'))).toBe('Hvad er halvdelen af tolv gulerødder?')
    expect(textOf(task(fractionOfSet, 'fos:1/3:9:apple', 'share'))).toBe('Del ni æbler i tre lige store dele. Hvor mange er en tredjedel?')
    expect(textOf(task(fractionOfSet, 'fos:1/2:8:apple', 'share'))).toBe('Del otte æbler i to lige store dele. Hvor mange er halvdelen?')
    expect(textOf(task(fractionOfSet, 'fos:3/4:12:strawberry', 'share'))).toBe('Del tolv jordbær på de to tallerkener. Den ene skal have tre fjerdedele og den anden resten.')
    expect(hintText(fractionOfSet, 'fos:1/4:12:apple', null)).toBe('Del de tolv i fire lige store bunker. Der er tre i hver bunke. En fjerdedel af tolv er tre.')
    expect(hintText(fractionOfSet, 'fos:1/2:12:apple', null)).toBe('Del de tolv i to lige store bunker. Der er seks i hver bunke. Halvdelen af tolv er seks.')
    expect(hintText(fractionOfSet, 'fos:3/4:12:apple', null, 'share'))
      .toBe('Del de tolv i fire lige store bunker. Der er tre i hver bunke. Tre fjerdedele er tre af bunkerne. Tre gange tre giver ni. Læg ni på den ene tallerken og tre på den anden.')
    const h = fractionOfSet.hint(fact(fractionOfSet, 'fos:1/4:12:apple'), 'denominatorAsAnswer', 'keypad')
    expect([h.misconception, h.visual]).toEqual(['denominatorAsAnswer', { scene: 'groups', groups: 4, size: 3, thing: 'apple' }])
    expect(compile(h.speech).text).toMatch(/^Brøken fortæller, hvor mange lige store bunker du skal dele i\. Den fortæller ikke svaret\. /)
  })

  it('has more instances per family than a key keeps as recent, so a key never runs dry', () => {
    const rng = makeRng(5)
    for (const fam of fractionOfSet.families as FamilyDef[]) {
      const seen = new Set<string>()
      for (let i = 0; i < 60; i++) seen.add(fractionOfSet.instance!(fam, rng, seen).id)
      expect(seen.size, fam.id).toBeGreaterThanOrEqual(15)
    }
  })
})

// ─── fractionCompare ────────────────────────────────────────────────────────

describe('fractionCompare', () => {
  const tasks = tasksUnderTest(fractionCompare)

  it('deals cards of different values with one numerator, the pair’s own answer on the cards', () => {
    for (const { fact: f, kind, task: t } of tasks) {
      const values = t.options.map(valueOf)
      expect(new Set(values).size, f.id).toBe(values.length)
      expect(new Set(t.options.map((o) => String(o).slice(5).split('/')[0])).size, f.id).toBe(1)
      expect(t.options.length, f.id).toBe(kind === 'sortOrder' ? 4 : 3)
      if (kind === 'choice' && f.family !== 'order4') {
        const [a, b] = f.id.slice(6).split(',').map(Number)
        expect(t.answer, f.id).toBe(`frac:1/${f.family === 'pairBigger' ? a : b}`)
      }
      if (kind === 'sortOrder') expect(t.prompt, f.id).toEqual({ scene: 'row', cells: [null, null, null, null] })
    }
  })

  it('reads the biggest denominator taken for the biggest fraction as biggerDenominator', () => {
    for (const { fact: f, kind, task: t } of tasks) {
      const dens = t.options.map((o) => Number(String(o).split('/')[1]))
      if (kind === 'choice') {
        // biggest asked: the card with the biggest denominator; smallest asked: the smallest
        const pick = biggestAsked(t) ? Math.max(...dens) : Math.min(...dens)
        const card = t.options[dens.indexOf(pick)]
        expect(classifyAnswer(t, card), f.id).toBe('biggerDenominator')
        expect(detectableOf(t), f.id).toEqual(['biggerDenominator'])
      } else {
        // the cards in the order of their denominators
        const byDen = [...t.options].sort((a, b) => Number(String(a).split('/')[1]) - Number(String(b).split('/')[1]))
        const misread = (f.family === 'pairBigger' ? byDen.reverse() : byDen).join('|')
        expect(classifyAnswer(t, misread), f.id).toBe('biggerDenominator')
      }
    }
  })

  it('asks in Danish and shows the cards as bars in the hint', () => {
    const t = task(fractionCompare, 'fcm:b:2,4', 'choice')
    expect(textOf(t)).toBe('Hvilken brøk er størst?')
    expect(textOf(task(fractionCompare, 'fcm:s:2,4', 'choice'))).toBe('Hvilken brøk er mindst?')
    expect(textOf(task(fractionCompare, 'fcm:b:2,4', 'sortOrder'))).toBe('Sæt brøkerne i rækkefølge. Start med den største.')
    expect(textOf(task(fractionCompare, 'fcm:o:2:3,4,5,6', 'sortOrder'))).toBe('Sæt brøkerne i rækkefølge. Start med den mindste.')
    expect(hintText(fractionCompare, 'fcm:b:2,4', null, 'choice')).toBe('Jo flere lige store dele en hel er delt i, jo mindre bliver hver del. En halv er størst.')
    expect(hintText(fractionCompare, 'fcm:o:2:3,4,5,6', null, 'sortOrder'))
      .toBe('Brøkerne har lige mange dele, men delene er ikke lige store. Jo flere lige store dele en hel er delt i, jo mindre bliver hver del. Fra den mindste er de to sjettedele, to femtedele, to fjerdedele og to tredjedele.')
    const h = fractionCompare.hint(fact(fractionCompare, 'fcm:s:2,8'), 'biggerDenominator', 'choice')
    expect(h.misconception).toBe('biggerDenominator')
    expect(compile(h.speech).text).toMatch(/^Et stort tal under brøkstregen betyder små dele\. Det er ikke en stor brøk\. .* En ottendedel er mindst\.$/)
    expect(h.visual.scene).toBe('fractionBars')
  })
})
