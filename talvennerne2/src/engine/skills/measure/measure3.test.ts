// Tests for convertCmM, Centimeter og meter (3. klasse, SK3-MAAL). The shared contract (number/testing/
// harness.ts) runs every fact, 200 seeded instances per family and both kinds through the real task builder,
// with the answer worked out from the card (the equation with its units); the blocks below check that the
// question says what the card shows, the keypad's room, the misconceptions (with A9 and A11) through the real
// diagnostics, the hints and the clips.
import { describe, expect, it } from 'vitest'
import convertCmMModule from './convertCmM'
import { factsUnderTest, flagsRaised, globalIdCheck, skillContract, speechProblems, tasksUnderTest } from '../number/testing/harness'
import { always, builder, guesser, right } from '../algebra/testing/diagnose'
import { isMisconception } from '../number/kit'
import { buildTask } from '../../tasks'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import { clipInfo } from '../../../speech/catalog'
import { clips as MEASURE3 } from '../../../speech/clips/skills/measure3'
import type { ErrorTag, Fact, SkillDef, Task, TaskKind, Term } from '../../types'

const convertCmM: SkillDef = convertCmMModule
const text = (t: Task) => compile(t.speech).text
const termsOf = (t: Task): Term[] => (t.prompt.scene === 'equation' ? t.prompt.terms : [])

/** The answer from the card alone: its numbers, its units (the unit words' clips) and its sign. */
function fromCard(t: Task): number {
  const terms = termsOf(t)
  const nums = terms.flatMap((x) => ('n' in x ? [x.n] : []))
  const first = terms.find((x) => 'text' in x)
  if (terms.some((x) => 'op' in x && x.op === '−')) return 100 * nums[0] - nums[1]
  if (first && 'text' in first && first.text === 'noun.unit.cm.end') return Math.floor(nums[0] / 100)
  return 100 * nums[0] + (nums[1] ?? 0)
}

// ─── Danish numbers up to 999, read without src/speech ───────────────────

const SMALL = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tyve']
const TENS: Readonly<Record<string, number>> = { tyve: 20, tredive: 30, fyrre: 40, halvtreds: 50, tres: 60, halvfjerds: 70, firs: 80, halvfems: 90 }
function below100(w: string): number {
  if (w === 'et') return 1
  if (SMALL.includes(w)) return SMALL.indexOf(w)
  if (w in TENS) return TENS[w]
  const m = /^(en|to|tre|fire|fem|seks|syv|otte|ni)og([a-z]+)$/.exec(w)
  if (!m || !(m[2] in TENS)) throw new Error(`no number in "${w}"`)
  return SMALL.indexOf(m[1]) + TENS[m[2]]
}
/** The numbers a sentence says: "to hundrede og femogtredive centimeter" → [235]. */
function saidNumbers(sentence: string): number[] {
  const w = sentence.toLowerCase().replace(/[?.,]/g, '').split(' ')
  const out: number[] = []
  for (let i = 0; i < w.length; i++) {
    let n: number
    try {
      n = below100(w[i])
    } catch {
      continue
    }
    if (w[i + 1] === 'hundrede') {
      n *= 100
      i++
      if (w[i + 1] === 'og') {
        try {
          n += below100(w[i + 2])
          i += 2
        } catch {
          // "og" before a word that is not a number: the hundreds stand alone
        }
      }
    }
    out.push(n)
  }
  return out
}

const fact = (id: string): Fact =>
  convertCmM.enumerate().find((f) => f.id === id) ?? { id, skill: 'convertCmM', family: id.split(':')[1], operands: [], answer: 0, rank: 0 }
const build = (id: string, kind: TaskKind, seed = 1): Task => buildTask(convertCmM, fact(id), kind, makeRng(seed), 0).task

describe('convertCmM: the contract', () => {
  globalIdCheck()
  skillContract(convertCmM, { families: { mToCm: 9, mCmToCm: 20, cmToMCm: 20, compareMixed: 20 }, answerOf: (_f, _k, task) => fromCard(task) })
})

describe('convertCmM', () => {
  const tasks = tasksUnderTest(convertCmM)

  it('draws whole meters 1–9, meters and 1–99 centimeter, 100–999 centimeter, and one or two meters against 1–99 centimeter', () => {
    for (const f of factsUnderTest(convertCmM)) {
      const [a, b] = f.id.split(':').slice(2).map(Number)
      expect(f.id.startsWith(`cmm:${f.family}:`), f.id).toBe(true)
      const ok = { mToCm: a >= 1 && a <= 9 && b === undefined, mCmToCm: a >= 1 && a <= 9 && b >= 1 && b <= 99, cmToMCm: a >= 100 && a <= 999 && b === undefined, compareMixed: (a === 1 || a === 2) && b >= 1 && b <= 99 }
      expect(ok[f.family as keyof typeof ok], f.id).toBe(true)
    }
  })

  it('says what the card shows: the same numbers and units, and the unit the answer is in', () => {
    for (const { fact: f, task } of tasks) {
      const card = termsOf(task).flatMap((x) => ('n' in x ? [x.n] : []))
      const said = saidNumbers(text(task))
      // cmToMCm's card also shows the centimeter left over, which is the answer's company, not the question
      expect(said, `${f.id}: "${text(task)}"`).toEqual(f.family === 'cmToMCm' ? card.slice(0, 1) : card)
      expect(text(task)).toMatch(f.family === 'cmToMCm' ? /^Hvor mange hele meter er / : /^Hvor mange centimeter (længere )?er /)
      const last = termsOf(task)[termsOf(task).length - 1]
      const after = termsOf(task)[termsOf(task).findIndex((x) => 'blank' in x) + 1]
      expect(after, f.id).toEqual({ text: f.family === 'cmToMCm' ? 'noun.unit.m.end' : 'noun.unit.cm.end' })
      expect('text' in last, f.id).toBe(true)
    }
    expect(text(build('cmm:mToCm:3', 'keypad'))).toBe('Hvor mange centimeter er tre meter?')
    expect(text(build('cmm:mCmToCm:2:35', 'keypad'))).toBe('Hvor mange centimeter er to meter og femogtredive centimeter?')
    expect(text(build('cmm:cmToMCm:235', 'choice'))).toBe('Hvor mange hele meter er to hundrede og femogtredive centimeter?')
    expect(text(build('cmm:compareMixed:1:37', 'keypad'))).toBe('Hvor mange centimeter længere er en meter end syvogtredive centimeter?')
    expect(build('cmm:cmToMCm:235', 'keypad').prompt).toEqual({
      scene: 'equation', terms: [{ n: 235 }, { text: 'noun.unit.cm.end' }, { op: '=' }, { blank: true }, { text: 'noun.unit.m.end' }, { n: 35 }, { text: 'noun.unit.cm.end' }],
    })
    expect(termsOf(build('cmm:cmToMCm:300', 'keypad'))).toHaveLength(5)
  })

  it('is production on the keypad, with room for a zero too many, and capped at box 3 on cards', () => {
    const digits = { mToCm: 4, mCmToCm: 4, cmToMCm: 2, compareMixed: 3 } as Record<string, number>
    for (const { fact: f, kind, task } of tasks) {
      expect([task.answerType, task.optionView, task.unit, task.entryScale]).toEqual(['int', 'numeral', null, 1])
      if (kind === 'keypad') {
        expect(task.maxDigits, f.id).toBe(digits[f.family])
        expect([isProduction(task), ceilingFor(task)], f.id).toEqual([true, 5])
        expect(guessP(task)).toBeCloseTo(1 / 10 ** digits[f.family])
      } else expect(ceilingFor(task)).toBe(3)
    }
    expect(convertCmM.fastMs!(fact('cmm:compareMixed:1:37'), 'keypad')).toBe(12_000)
  })

  it('reads a meter as ten centimeter (or a zero too many) as tensZero', () => {
    const three = build('cmm:mToCm:3', 'keypad')
    expect([classifyAnswer(three, 30), classifyAnswer(three, 3000), classifyAnswer(three, 3), classifyAnswer(three, 310), classifyAnswer(three, 103)])
      .toEqual(['tensZero', 'tensZero', 'operand', 'near', 'other'])
    const mixed = build('cmm:mCmToCm:2:35', 'keypad')
    expect([classifyAnswer(mixed, 55), classifyAnswer(mixed, 2035), classifyAnswer(mixed, 35), classifyAnswer(mixed, 2)]).toEqual(['tensZero', 'tensZero', 'operand', 'operand'])
    // 235 written 253 is the commonest slip of Danish numbers (A11: never a misconception's evidence)
    expect(classifyAnswer(mixed, 253)).toBe('digitSwap')
    const back = build('cmm:cmToMCm:235', 'keypad')
    expect([classifyAnswer(back, 23), classifyAnswer(back, 35), classifyAnswer(back, 3)]).toEqual(['tensZero', 'operand', 'near'])
    // 111 centimeter: eleven is the zero lost and the centimeter on the card, so never evidence (A9)
    expect(classifyAnswer(build('cmm:cmToMCm:111', 'keypad'), 11)).toBe('ambiguous')
  })

  it('reads the zero of the tens dropped or moved as zeroPlaceholder, and 25 for 2 m 5 cm as either idea', () => {
    const t = build('cmm:mCmToCm:2:5', 'keypad')
    expect(t.answer).toBe(205)
    expect([classifyAnswer(t, 250), classifyAnswer(t, 25), classifyAnswer(t, 2005)]).toEqual(['zeroPlaceholder', 'ambiguous', 'tensZero'])
  })

  it('reads 1 m − 37 cm made up digit by digit as digitComplement10, and the lengths added as wrongOperation', () => {
    for (const kind of ['keypad', 'choice'] as const) {
      const t = build('cmm:compareMixed:1:37', kind)
      expect(t.answer).toBe(63)
      expect([classifyAnswer(t, 73), classifyAnswer(t, 137), classifyAnswer(t, 37), classifyAnswer(t, 64)]).toEqual(['digitComplement10', 'wrongOperation', 'operand', 'near'])
    }
    // 100 − 55 made up digit by digit is 55, the number on the card (A9)
    expect(classifyAnswer(build('cmm:compareMixed:1:55', 'keypad'), 55)).toBe('ambiguous')
    // two meters: a meter left out
    const two = build('cmm:compareMixed:2:37', 'keypad')
    expect([classifyAnswer(two, 63), classifyAnswer(two, 237)]).toEqual(['near', 'wrongOperation'])
    // 62 typed as 26 is a reversed number; 63 as 36 is also 37 − 1, the numbers taken away as they stand
    expect(detectableOf(build('cmm:compareMixed:1:38', 'keypad')).sort()).toEqual(['digitComplement10', 'digitSwap', 'wrongOperation'])
    expect(classifyAnswer(build('cmm:compareMixed:1:38', 'keypad'), 26)).toBe('digitSwap')
    expect(classifyAnswer(build('cmm:compareMixed:1:37', 'keypad'), 36)).toBe('other')
    expect(detectableOf(build('cmm:mToCm:4', 'keypad'))).toEqual(['tensZero'])
  })

  it('shows a diagnostic card wherever the fact has one', () => {
    for (const { fact: f, kind, task } of tasks) {
      if (kind !== 'choice') continue
      const has = Object.entries(task.distractorTags).some(([k, tag]) => isMisconception(tag) && Number(k) <= task.range[1])
      expect(task.options.some((o) => isMisconception(task.distractorTags[String(o)])), f.id).toBe(has)
    }
  })

  it('counts meters as hundreds on a meter stick, and says the misconception first', () => {
    const said = (id: string, tag: string | null = null) => compile(convertCmM.hint(fact(id), tag as never).speech).text
    expect(said('cmm:mToCm:3')).toBe('En meter er hundrede centimeter. Tre meter er tre hundrede centimeter.')
    expect(said('cmm:mToCm:1')).toBe('En meter er hundrede centimeter.')
    expect(said('cmm:mToCm:3', 'tensZero')).toBe('En meter er hundrede centimeter, og hundrede har to nuller. Tre meter er tre hundrede centimeter.')
    expect(said('cmm:mCmToCm:2:35')).toBe('En meter er hundrede centimeter. To meter er to hundrede centimeter. Læg femogtredive centimeter til. Det er to hundrede og femogtredive centimeter.')
    expect(said('cmm:mCmToCm:2:5', 'zeroPlaceholder')).toBe('En meter er hundrede centimeter. To meter er to hundrede centimeter. Læg fem centimeter til. Der er ingen tiere, så der står et nul på tiernes plads. Det er to hundrede og fem centimeter.')
    expect(said('cmm:cmToMCm:235')).toBe('En meter er hundrede centimeter. To hundrede centimeter er to meter. Der er femogtredive centimeter til overs.')
    expect(said('cmm:compareMixed:1:37', 'digitComplement10')).toBe('En meter er hundrede centimeter. Træk ikke cifrene fra hver for sig. Tæl op til hundrede. Et hundrede minus syvogtredive giver treogtres.')
    expect(said('cmm:compareMixed:2:37', 'wrongOperation')).toBe('Når du skal finde ud af, hvor meget længere noget er, skal du trække fra. En meter er hundrede centimeter. To meter er to hundrede centimeter. To hundrede minus syvogtredive giver et hundrede og treogtres.')
    expect(convertCmM.hint(fact('cmm:mCmToCm:2:35'), null).visual).toEqual({ scene: 'line', min: 0, max: 235, hops: [0, 100, 200, 235] })
    expect(convertCmM.hint(fact('cmm:compareMixed:1:37'), null).visual).toEqual({ scene: 'line', min: 0, max: 100, hops: [37, 100] })
    for (const { fact: f, kind, task } of tasks.filter((_, i) => i % 4 === 0)) {
      const rebuilt: Fact = { id: task.factId, skill: task.skill, family: task.family, operands: [], answer: task.answer, rank: 0 }
      for (const tag of [null, 'near', 'operand', 'other', 'ambiguous', 'digitSwap', ...new Set(Object.values(task.distractorTags))] as (ErrorTag | null)[]) {
        const h = convertCmM.hint(f, tag, kind)
        expect(speechProblems(h.speech), `${f.id} ${String(tag)}`).toEqual([])
        expect(h.misconception ?? null).toBe(isMisconception(tag) && tag !== 'digitSwap' ? tag : null)
        expect(convertCmM.hint(rebuilt, tag, kind)).toEqual(h)
      }
    }
  })

  it('flags a child who keeps making one mistake, never one who answers right or guesses', () => {
    const kinds: TaskKind[] = ['choice', 'keypad', 'keypad']
    const only = (family: string, keep: (f: Fact) => boolean = () => true) => {
      const pool = factsUnderTest(convertCmM).filter((f) => f.family === family && keep(f))
      return (i: number) => buildTask(convertCmM, pool[i % pool.length], kinds[i % 3], makeRng(i), i).task
    }
    expect([...flagsRaised(only('mToCm'), 60, always('tensZero'))]).toContain('tensZero')
    expect([...flagsRaised(only('mCmToCm', (f) => Number(f.id.split(':')[3]) < 10), 60, always('zeroPlaceholder'))]).toContain('zeroPlaceholder')
    expect([...flagsRaised(only('compareMixed'), 80, always('wrongOperation'))]).toContain('wrongOperation')
    expect([...flagsRaised(only('compareMixed', (f) => f.id.startsWith('cmm:compareMixed:1:')), 80, always('digitComplement10'))]).toContain('digitComplement10')
    expect([...flagsRaised(builder('w3-penge-maal-l3', 'convertCmM', kinds), 160, always('tensZero'))]).toContain('tensZero')
    expect([...flagsRaised(builder('w3-penge-maal-l3', 'convertCmM', kinds), 120, right)]).toEqual([])
    expect([...flagsRaised(builder('w3-penge-maal-l3', 'convertCmM', kinds), 500, guesser(41))]).toEqual([])
  })

  it('has wave 3 clips in the measure sprite of wave 3, without digits', () => {
    for (const [id, words] of Object.entries(MEASURE3)) {
      expect(words, id).not.toMatch(/\d/)
      expect(clipInfo(id), id).toMatchObject({ wave: 3, pack: 'measure-3' })
    }
    expect(isCorrect(build('cmm:mToCm:5', 'keypad'), 500)).toBe(true)
  })
})
