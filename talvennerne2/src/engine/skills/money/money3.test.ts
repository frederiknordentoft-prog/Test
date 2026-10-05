// Tests for kronerOre, Kroner og øre (3. klasse, SK3-MAAL). The shared contract (number/testing/harness.ts)
// runs every fact, 200 seeded instances per family and both kinds through the real task builder, with the
// answer worked out from the shop or the coins on the table; the blocks below add what the pay view hands
// in, the cards, coinsAsCount through the real diagnostics, the hints and the clips.
import { describe, expect, it } from 'vitest'
import kronerOreModule from './kronerOre'
import { factsUnderTest, flagsRaised, globalIdCheck, skillContract, speechProblems, tasksUnderTest } from '../number/testing/harness'
import { always, builder, right } from '../algebra/testing/diagnose'
import { isMisconception } from '../number/kit'
import { buildTask } from '../../tasks'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import { clipInfo } from '../../../speech/catalog'
import { clips as MONEY3 } from '../../../speech/clips/skills/money3'
import { canPay, purseOf } from '../../../ui/task/pay/logic'
import type { AnswerValue, Fact, Prompt, SkillDef, Task, TaskKind } from '../../types'

const kronerOre: SkillDef = kronerOreModule
const PIECES = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
const sumOf = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0)
const text = (t: Task) => compile(t.speech).text

/** Greedy fewest pieces, written apart from the skill's kit (Danish denominations are canonical). */
function greedy(ore: number, purse: readonly number[]): number[] {
  const out: number[] = []
  let left = ore
  for (const d of [...purse].sort((a, b) => b - a)) while (left >= d) (out.push(d), (left -= d))
  return left === 0 ? out : []
}
const setOf = (pieces: readonly number[]) => pieces.map((p) => `c${p}`).join('|')
const piecesOfSet = (v: AnswerValue) => String(v).split('|').map((t) => Number(t.slice(1)))
const shop = (p: Prompt) => {
  if (p.scene !== 'shop') throw new Error(`expected the shop, got ${p.scene}`)
  return p
}

/** What the task asks for, from the shop's tag or the coins on the table. */
function asked(task: Task, kind: TaskKind): AnswerValue {
  const p = task.prompt
  if (p.scene === 'coins') return sumOf(p.ore)
  const { priceOre, purse } = shop(p)
  if (/af dem/.test(text(task))) return 2 * priceOre
  return kind === 'pay' ? priceOre : setOf(greedy(priceOre, purse))
}

const fact = (id: string): Fact =>
  kronerOre.enumerate().find((f) => f.id === id) ?? { id, skill: 'kronerOre', family: id.split(':')[1], operands: [], answer: 0, rank: 0 }
const build = (id: string, kind: TaskKind, seed = 1): Task => buildTask(kronerOre, fact(id), kind, makeRng(seed), 0).task

describe('kronerOre: the contract', () => {
  globalIdCheck()
  skillContract(kronerOre, { families: { readAmount: 20, fiftiesInKroner: 9, addHalves: 20 }, answerOf: (_f, kind, task) => asked(task, kind) })
})

describe('kronerOre', () => {
  const tasks = tasksUnderTest(kronerOre)

  it('draws prices with fifty øre, and four to twenty halvtredsører worth whole kroner', () => {
    for (const f of factsUnderTest(kronerOre)) {
      const ore = Number(f.id.split(':')[2])
      expect(f.id).toBe(`kro:${f.family}:${ore}`)
      if (f.family === 'fiftiesInKroner') expect(ore % 100 === 0 && ore >= 200 && ore <= 1000, f.id).toBe(true)
      else expect(ore % 100 === 50 && ore >= 150 && ore <= (f.family === 'readAmount' ? 4950 : 2450), f.id).toBe(true)
    }
    expect(kronerOre.enumerate().filter((f) => f.family === 'fiftiesInKroner').map((f) => f.id.split(':')[2]))
      .toEqual(['200', '300', '400', '500', '600', '700', '800', '900', '1000'])
  })

  it('pays in the shop with the halvtredsøre in the purse, or in kroner for the halvtredsører on the table', () => {
    for (const { fact: f, kind, task } of tasks) {
      const where = `${f.id} ${kind}`
      if (kind === 'pay') {
        expect([task.answerType, isProduction(task), ceilingFor(task)], where).toEqual(['ore', true, 5])
        expect(guessP(task)).toBeCloseTo(0.01)
        // the pay view can pay it, and the coins it offers (src/ui/task/pay/logic.ts)
        expect(canPay(task), where).toBe(true)
        const purse = purseOf(task)
        expect(purse.includes(50), where).toBe(f.family !== 'fiftiesInKroner')
        // any exact tray is right
        expect(isCorrect(task, sumOf(greedy(Number(task.answer), purse))), where).toBe(true)
      } else {
        expect(ceilingFor(task), where).toBe(3)
        expect(task.optionView, where).toBe(f.family === 'readAmount' ? 'coins' : 'amount')
      }
      if (task.prompt.scene === 'coins') expect(task.prompt.ore.every((o) => o === 50), where).toBe(true)
      else expect(shop(task.prompt).purse, where).toEqual([2000, 1000, 500, 200, 100, 50])
    }
  })

  it('deals coin-set cards for the price on the tag: only the fewest pieces with the halvtredsøre pay it', () => {
    for (const { fact: f, kind, task } of tasks) {
      if (kind !== 'choice' || f.family !== 'readAmount') continue
      const price = shop(task.prompt).priceOre
      expect(task.answerType).toBe('set')
      for (const o of task.options) {
        const pieces = piecesOfSet(o)
        expect(pieces.every((p) => PIECES.includes(p)), `${f.id} ${String(o)}`).toBe(true)
        if (o !== task.answer) expect(sumOf(pieces), `${f.id} ${String(o)}`).not.toBe(price)
      }
      expect(piecesOfSet(task.answer)).toContain(50)
    }
  })

  it('says the price, the halvtredsører or the two things', () => {
    expect(text(build('kro:readAmount:1250', 'pay'))).toBe('Betal tolv kroner og halvtreds øre.')
    expect(text(build('kro:readAmount:1250', 'choice'))).toBe('Hvilke penge er præcis tolv kroner og halvtreds øre?')
    expect(build('kro:readAmount:1250', 'choice').answer).toBe('c1000|c200|c50')
    expect(text(build('kro:fiftiesInKroner:300', 'pay'))).toBe('Hvor mange penge er der? Betal det samme med kroner.')
    expect(text(build('kro:fiftiesInKroner:300', 'choice'))).toBe('Hvor mange penge er der?')
    expect(build('kro:fiftiesInKroner:300', 'pay').prompt).toEqual({ scene: 'coins', ore: [50, 50, 50, 50, 50, 50] })
    expect(text(build('kro:addHalves:250', 'choice'))).toBe('Det koster to kroner og halvtreds øre. Hvad koster to af dem?')
    expect(text(build('kro:addHalves:250', 'pay'))).toBe('Det koster to kroner og halvtreds øre. Betal for to af dem.')
    expect(build('kro:addHalves:250', 'pay').answer).toBe(500)
  })

  it('reads one krone per halvtredsøre as coinsAsCount, on the tray and on the cards', () => {
    for (const kind of ['pay', 'choice'] as const) {
      const t = build('kro:fiftiesInKroner:300', kind)
      expect([classifyAnswer(t, 600), classifyAnswer(t, 50), classifyAnswer(t, 250), classifyAnswer(t, 300)]).toEqual(['coinsAsCount', 'operand', 'near', null])
      expect(detectableOf(t)).toEqual(['coinsAsCount'])
    }
    // a krone forgotten from the two halvtredsører, one thing paid, the øre left out, fifty øre read as kroner
    const two = build('kro:addHalves:250', 'pay')
    expect([classifyAnswer(two, 400), classifyAnswer(two, 250), classifyAnswer(two, 450)]).toEqual(['near', 'operand', 'near'])
    const read = build('kro:readAmount:1250', 'pay')
    expect([classifyAnswer(read, 1200), classifyAnswer(read, 1300), classifyAnswer(read, 6200)]).toEqual(['near', 'near', 'other'])
    expect(classifyAnswer(build('kro:readAmount:1250', 'choice'), 'c1000|c200')).toBe('near')
    expect(classifyAnswer(build('kro:readAmount:1250', 'choice'), 'c1000|c500|c200')).toBe('other')
    for (const f of factsUnderTest(kronerOre)) {
      expect(kronerOre.candidates(f).some((c) => isMisconception(c.tag) && c.tag !== 'coinsAsCount'), f.id).toBe(false)
    }
  })

  it('explains the comma, the halvtredsører two by two and the krone they make', () => {
    const said = (id: string, tag: string | null = null) => compile(kronerOre.hint(fact(id), tag as never).speech).text
    expect(said('kro:readAmount:1250')).toBe('Kommaet skiller kronerne fra ørerne. Betal først tolv kroner og læg så en halvtredsøre.')
    expect(said('kro:readAmount:150', 'near')).toBe('Tæl pengene efter. Kommaet skiller kronerne fra ørerne. Betal først en krone og læg så en halvtredsøre.')
    expect(said('kro:fiftiesInKroner:300')).toBe('To halvtredsører er en krone. Seks halvtredsører er tre kroner.')
    expect(said('kro:fiftiesInKroner:300', 'coinsAsCount')).toBe('Tæl ikke, hvor mange mønter der er, men hvad der står på dem. To halvtredsører er en krone. Seks halvtredsører er tre kroner.')
    expect(said('kro:addHalves:250')).toBe('To halvtredsører er en krone. To kroner plus to kroner giver fire kroner. De to halvtredsører giver en krone mere. Det er fem kroner.')
    expect(kronerOre.hint(fact('kro:addHalves:250'), null).visual).toEqual({ scene: 'coinsSum', ore: [200, 50, 200, 50] })
    expect(kronerOre.hint(fact('kro:fiftiesInKroner:300'), 'coinsAsCount')).toMatchObject({ misconception: 'coinsAsCount', visual: { scene: 'coinsSum', ore: [50, 50, 50, 50, 50, 50] } })
    for (const { fact: f, kind, task } of tasks.filter((_, i) => i % 4 === 0)) {
      const rebuilt: Fact = { id: task.factId, skill: task.skill, family: task.family, operands: [], answer: task.answer, rank: 0 }
      for (const tag of [null, 'near', 'operand', 'other', ...new Set(Object.values(task.distractorTags))] as const) {
        const h = kronerOre.hint(f, tag, kind)
        expect(speechProblems(h.speech), `${f.id} ${String(tag)}`).toEqual([])
        expect(h.misconception ?? null).toBe(tag === 'coinsAsCount' ? tag : null)
        expect(kronerOre.hint(rebuilt, tag, kind)).toEqual(h)
      }
    }
  })

  it('flags a child who takes every coin for a krone, never one who answers right or guesses', () => {
    const kinds: TaskKind[] = ['choice', 'pay', 'pay']
    const fifties = factsUnderTest(kronerOre).filter((f) => f.family === 'fiftiesInKroner')
    const counts = (i: number) => buildTask(kronerOre, fifties[i % fifties.length], kinds[i % 3], makeRng(i), i).task
    expect([...flagsRaised(counts, 60, always('coinsAsCount'))]).toContain('coinsAsCount')
    expect([...flagsRaised(builder('w3-penge-maal-l3', 'kronerOre', kinds), 160, always('coinsAsCount'))]).toContain('coinsAsCount')
    expect([...flagsRaised(builder('w3-penge-maal-l3', 'kronerOre', kinds), 120, right)]).toEqual([])
    const rng = makeRng(17)
    // a guesser pays any whole number of halvtredsører up to the range, or taps a card
    const guess = (t: Task): AnswerValue => (t.kind === 'choice' ? rng.pick(t.options) : 50 * rng.int(t.range[1] / 50 + 1))
    expect([...flagsRaised(builder('w3-penge-maal-l3', 'kronerOre', kinds), 500, guess)]).toEqual([])
  })

  it('has wave 3 clips in the money sprite of wave 3, without digits', () => {
    for (const [id, words] of Object.entries(MONEY3)) {
      expect(words, id).not.toMatch(/\d/)
      expect(clipInfo(id), id).toMatchObject({ wave: 3, pack: 'money-3' })
    }
  })
})
