// Tests for the place-value skills tensOnes and placeValue1000 (SK2-NUM). The shared contract
// (number/testing/harness.ts) runs every fact, 200 seeded instances per family and every kind through
// the real task builder; the blocks below add independent answers, the misconceptions and A9,
// production and ceilings per kind, and the hints of a fact rebuilt from its task.
import { describe, expect, it } from 'vitest'
import tensOnesModule from './tensOnes'
import placeValue1000Module from './placeValue1000'
import { factsUnderTest, skillContract, tasksUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, isProduction } from '../../kinds'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import type { AnswerValue, Fact, SkillDef, Task, TaskKind } from '../../types'

const tensOnes: SkillDef = tensOnesModule
const placeValue1000: SkillDef = placeValue1000Module

const digits = (n: number) => ({ h: Math.floor(n / 100), t: Math.floor(n / 10) % 10, o: n % 10 })

/** tensOnes, from the id alone: what cards and keypad, the blocks and the palette must give. */
function tensOnesAnswer(id: string, kind: TaskKind): AnswerValue {
  const bits = id.split(':')
  const n = Number(bits.at(-1))
  const { t, o } = digits(n)
  const family = bits[1]
  if (kind === 'fillSlots') return family === 'expand' ? `${t * 10}|${o}` : `${t}|${o}`
  if (family === 'decompose') {
    const tens = bits[2] === 'tens'
    if (kind === 'buildBase') return tens ? t * 10 : o
    return tens ? t : o
  }
  if (family === 'expand') return o
  return n
}

/** placeValue1000, from the id alone. */
function placeValueAnswer(id: string, kind: TaskKind): AnswerValue {
  const bits = id.split(':')
  const family = bits[1]
  let n: number
  if (family === 'regroup') {
    const [a, b] = [Number(bits[3]), Number(bits[4])]
    n = bits[2] === 'ht' ? a * 100 + b * 10 : a * 10 + b
  } else n = Number(bits.at(-1))
  const { h, t, o } = digits(n)
  const parts = [h * 100, t * 10, o].filter((v) => v > 0)
  if (kind === 'fillSlots') return family === 'digitValue' || family === 'expand' ? parts.join('|') : String(n).split('').join('|')
  if (family === 'digitValue' || family === 'expand') return bits[2] === 'h' ? h * 100 : t * 10
  return n
}

describe('place-value skills: the contract', () => {
  skillContract(tensOnes, {
    families: { build: 20, decompose: 20, swapped: 20, expand: 20 },
    answerOf: (f, kind) => tensOnesAnswer(f.id, kind),
  })
  skillContract(placeValue1000, {
    families: { buildHTO: 20, zeroPlace: 20, digitValue: 20, expand: 20, regroup: 20 },
    answerOf: (f, kind) => placeValueAnswer(f.id, kind),
  })
})

const text = (t: Task) => compile(t.speech).text
const hintText = (def: SkillDef, f: Fact, tag: Parameters<SkillDef['hint']>[1], kind?: TaskKind) => compile(def.hint(f, tag, kind).speech).text

/** A fact by id: canonical, or drawn until it turns up (the instance is kept in the id). */
function fact(def: SkillDef, id: string): Fact {
  const canon = def.enumerate().find((f) => f.id === id)
  if (canon) return canon
  const family = def.families.find((f) => id.split(':')[1] === f.id)!
  const rng = makeRng(11)
  for (let i = 0; i < 50000; i++) {
    const f = def.instance!(family, rng, new Set())
    if (f.id === id) return f
  }
  throw new Error(`no instance ${id}`)
}
const task = (def: SkillDef, id: string, kind: TaskKind, seed = 1): Task => buildTask(def, fact(def, id), kind, makeRng(seed), 0).task

// ─── tensOnes ───────────────────────────────────────────────────────────────

describe('tensOnes', () => {
  const tasks = tasksUnderTest(tensOnes)

  it('draws every family inside its numbers', () => {
    for (const f of factsUnderTest(tensOnes)) {
      const bits = f.id.split(':')
      const n = Number(bits.at(-1))
      const { t, o } = digits(n)
      expect(n >= 10 && n <= 99, f.id).toBe(true)
      if (f.family === 'swapped' || f.family === 'expand') expect(t > 0 && o > 0, f.id).toBe(true)
      if (f.family === 'decompose' && bits[2] === 'ones') expect(o, f.id).toBeGreaterThan(0)
    }
  })

  it('shows blocks tens first, and ones first for the swapped words; builds from the numeral', () => {
    for (const { fact: f, kind, task: t } of tasks) {
      const n = Number(f.id.split(':').at(-1))
      const { t: tens, o } = digits(n)
      if (f.family === 'build' && kind !== 'buildBase') expect(t.prompt).toEqual({ scene: 'base', h: 0, t: tens, o, order: 'hto' })
      if (f.family === 'swapped' && kind !== 'buildBase') expect(t.prompt).toEqual({ scene: 'base', h: 0, t: tens, o, order: 'oth' })
      if (kind === 'buildBase' && (f.family === 'build' || f.family === 'decompose')) expect(t.prompt).toEqual({ scene: 'equation', terms: [{ n }] })
      if (kind === 'buildBase') expect(t.range[1]).toBeLessThan(100) // rods and cubes only, no plates
    }
  })

  it('reads the questions in plain Danish', () => {
    expect(text(task(tensOnes, 'to:build:47', 'keypad'))).toBe('Hvilket tal viser klodserne?')
    expect(text(task(tensOnes, 'to:build:47', 'buildBase'))).toBe('Byg tallet syvogfyrre.')
    expect(text(task(tensOnes, 'to:decompose:tens:47', 'keypad'))).toBe('Hvor mange tiere er der i syvogfyrre?')
    expect(text(task(tensOnes, 'to:decompose:tens:47', 'buildBase'))).toBe('Byg kun tierne i syvogfyrre.')
    expect(text(task(tensOnes, 'to:swapped:53', 'keypad'))).toBe('Tre enere og fem tiere. Hvilket tal er det?')
    expect(text(task(tensOnes, 'to:swapped:53', 'buildBase'))).toBe('Læg tre enere og fem tiere.')
    expect(text(task(tensOnes, 'to:swapped:51', 'keypad'))).toBe('En ener og fem tiere. Hvilket tal er det?')
    expect(text(task(tensOnes, 'to:expand:47', 'keypad'))).toBe('Syvogfyrre er fyrre plus hvad?')
    expect(text(task(tensOnes, 'to:expand:47', 'fillSlots'))).toBe('Syvogfyrre er hvad plus hvad?')
    expect(text(task(tensOnes, 'to:expand:47', 'buildBase'))).toBe('Syvogfyrre er fyrre plus hvad? Byg det, der mangler.')
  })

  it('classifies the misconceptions of pædagogik §3.2', () => {
    const build47 = task(tensOnes, 'to:build:47', 'keypad')
    expect(classifyAnswer(build47, 11)).toBe('addsPlaceParts')
    expect(classifyAnswer(build47, 74)).toBe('digitSwap')
    expect(classifyAnswer(build47, 4)).toBe('operand')
    expect(classifyAnswer(build47, 48)).toBe('near')
    const swapped = task(tensOnes, 'to:swapped:53', 'keypad')
    expect(classifyAnswer(swapped, 35)).toBe('digitSwap')
    expect(classifyAnswer(swapped, 8)).toBe('addsPlaceParts')
    const tens47 = task(tensOnes, 'to:decompose:tens:47', 'keypad')
    expect(classifyAnswer(tens47, 40)).toBe('faceValue')
    expect(classifyAnswer(tens47, 7)).toBe('digitSwap') // syv tiere in syv-og-fyrre
    expect(classifyAnswer(tens47, 47)).toBe('operand')
    expect(classifyAnswer(task(tensOnes, 'to:decompose:ones:47', 'keypad'), 4)).toBe('digitSwap')
    const slots = task(tensOnes, 'to:expand:47', 'fillSlots')
    expect(isCorrect(slots, '40|7')).toBe(true)
    expect(isCorrect(slots, '7|40')).toBe(true)
    expect(classifyAnswer(slots, '4|7')).toBe('faceValue')
    expect(classifyAnswer(slots, '70|4')).toBe('digitSwap')
    expect(classifyAnswer(task(tensOnes, 'to:swapped:53', 'fillSlots'), '3|5')).toBe('digitSwap')
    // building the swapped number for "Byg tallet syvogfyrre": 7 rods and 4 cubes
    expect(classifyAnswer(task(tensOnes, 'to:build:47', 'buildBase'), 74)).toBe('digitSwap')
    // what was built for "Byg kun tierne i syvogfyrre" is classified by what it is worth (40): seven rods
    // are the other digit as tens (digitSwap), four cubes the digit for its value (faceValue), and seven
    // cubes — the ones, not the tens — are just wrong
    const builtTens47 = task(tensOnes, 'to:decompose:tens:47', 'buildBase')
    expect(classifyAnswer(builtTens47, 70)).toBe('digitSwap')
    expect(classifyAnswer(builtTens47, 4)).toBe('faceValue')
    expect(classifyAnswer(builtTens47, 7)).toBe('other')
  })

  it('makes fillSlots an order task of two digits (no production), and buildBase production', () => {
    for (const { fact: f, kind, task: t } of tasks) {
      if (kind === 'fillSlots') {
        expect(t.options.length, f.id).toBe(f.family === 'expand' ? 4 : 2)
        expect(isProduction(t)).toBe(false)
        expect(ceilingFor(t)).toBe(3)
      }
      if (kind === 'buildBase') expect(isProduction(t)).toBe(true)
    }
  })

  it('explains with the blocks, and each misconception with its own sentence', () => {
    expect(hintText(tensOnes, fact(tensOnes, 'to:build:47'), null)).toBe('Hver stang er en tier. Tæl stængerne først. Fire tiere og syv enere er syvogfyrre.')
    expect(hintText(tensOnes, fact(tensOnes, 'to:build:47'), 'addsPlaceParts'))
      .toBe('En stang er ti, ikke en. Fire stænger er fyrre. Fire tiere og syv enere er syvogfyrre.')
    expect(hintText(tensOnes, fact(tensOnes, 'to:swapped:53'), 'digitSwap'))
      .toBe('Fem tiere og tre enere er treoghalvtreds. Vi siger tre først, men vi skriver tierne først.')
    expect(hintText(tensOnes, fact(tensOnes, 'to:decompose:tens:47'), 'faceValue')).toBe('Fire tiere er fyrre værd. Men der er fire tiere.')
    expect(hintText(tensOnes, fact(tensOnes, 'to:expand:47'), null)).toBe('Syvogfyrre er fire tiere og syv enere. Fire tiere er fyrre. Det, der mangler, er syv.')
    expect(hintText(tensOnes, fact(tensOnes, 'to:expand:47'), 'faceValue'))
      .toBe('Syvogfyrre er fire tiere og syv enere. Firetallet står på tiernes plads. Så er det fyrre værd.')
    expect(hintText(tensOnes, fact(tensOnes, 'to:build:40'), null)).toBe('Hver stang er en tier. Tæl stængerne først. Fire tiere er fyrre.')
    const swap = tensOnes.hint(fact(tensOnes, 'to:build:47'), 'digitSwap')
    expect(swap).toMatchObject({ misconception: 'digitSwap', animated: true, visual: { scene: 'base', t: 4, o: 7 } })
  })
})

// ─── placeValue1000 ─────────────────────────────────────────────────────────

describe('placeValue1000', () => {
  const tasks = tasksUnderTest(placeValue1000)

  it('draws every family inside its numbers', () => {
    for (const f of factsUnderTest(placeValue1000)) {
      const bits = f.id.split(':')
      if (f.family === 'regroup') {
        const [a, b] = [Number(bits[3]), Number(bits[4])]
        expect(a >= 1 && a <= 8 && b >= 11 && b <= 19, f.id).toBe(true)
        continue
      }
      const n = Number(bits.at(-1))
      const { h, t, o } = digits(n)
      expect(n >= 100 && n <= 999, f.id).toBe(true)
      if (f.family === 'zeroPlace') expect((t === 0) !== (o === 0), f.id).toBe(true)
      if (f.family === 'expand') expect(h * t * o, f.id).toBeGreaterThan(0)
      if (f.family === 'digitValue') expect([h, t, o].filter((d) => d > 0).length, f.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('takes five digits on the keypad, and offers plates only where hundreds are in play', () => {
    for (const { kind, task: t } of tasks) {
      if (kind === 'keypad') expect(t.maxDigits).toBe(5)
      if (kind === 'buildBase') expect(t.range[1]).toBeGreaterThanOrEqual(100)
      if (kind === 'fillSlots') expect(isProduction(t)).toBe(true)
    }
  })

  it('reads the questions in plain Danish', () => {
    expect(text(task(placeValue1000, 'pv:zeroPlace:304', 'keypad'))).toBe('Tre hundreder og fire enere. Hvilket tal er det?')
    expect(text(task(placeValue1000, 'pv:zeroPlace:320', 'fillSlots'))).toBe('Tre hundreder og to tiere. Skriv tallet med brikkerne.')
    expect(text(task(placeValue1000, 'pv:zeroPlace:104', 'buildBase'))).toBe('Byg tallet et hundrede og fire.')
    expect(text(task(placeValue1000, 'pv:digitValue:t:472', 'keypad'))).toBe('Hvad er tierne værd i fire hundrede og tooghalvfjerds?')
    expect(text(task(placeValue1000, 'pv:digitValue:h:472', 'buildBase'))).toBe('Byg kun hundrederne i fire hundrede og tooghalvfjerds.')
    expect(text(task(placeValue1000, 'pv:expand:t:472', 'keypad'))).toBe('Fire hundrede og tooghalvfjerds er fire hundrede plus hvad plus to?')
    expect(text(task(placeValue1000, 'pv:expand:t:472', 'fillSlots'))).toBe('Fire hundrede og tooghalvfjerds er hvad plus hvad plus hvad?')
    expect(text(task(placeValue1000, 'pv:regroup:ht:2:14', 'keypad'))).toBe('To hundreder og fjorten tiere. Hvilket tal er det?')
  })

  it('classifies the misconceptions of pædagogik §3.2', () => {
    const blocks = task(placeValue1000, 'pv:buildHTO:345', 'keypad')
    expect(classifyAnswer(blocks, 12)).toBe('addsPlaceParts')
    expect(classifyAnswer(blocks, 354)).toBe('digitSwap')
    expect(classifyAnswer(task(placeValue1000, 'pv:buildHTO:304', 'keypad'), 34)).toBe('zeroPlaceholder')
    expect(classifyAnswer(task(placeValue1000, 'pv:buildHTO:304', 'fillSlots'), '3|4|0')).toBe('zeroPlaceholder')
    const zero = task(placeValue1000, 'pv:zeroPlace:304', 'keypad')
    expect(classifyAnswer(zero, 34)).toBe('zeroPlaceholder')
    expect(classifyAnswer(zero, 340)).toBe('zeroPlaceholder')
    expect(classifyAnswer(zero, 3004)).toBe('concatNumberWords')
    expect(classifyAnswer(zero, 7)).toBe('addsPlaceParts')
    expect(classifyAnswer(task(placeValue1000, 'pv:zeroPlace:320', 'keypad'), 30020)).toBe('concatNumberWords')
    const worth = task(placeValue1000, 'pv:digitValue:t:472', 'keypad')
    expect(classifyAnswer(worth, 7)).toBe('faceValue')
    expect(classifyAnswer(worth, 700)).toBe('other')
    expect(classifyAnswer(worth, 472)).toBe('operand')
    expect(classifyAnswer(task(placeValue1000, 'pv:expand:t:472', 'keypad'), 7)).toBe('faceValue')
    const slots = task(placeValue1000, 'pv:expand:t:472', 'fillSlots')
    expect(isCorrect(slots, '400|70|2')).toBe(true)
    expect(isCorrect(slots, '2|70|400')).toBe(true)
    expect(classifyAnswer(slots, '4|7|2')).toBe('faceValue')
    expect(classifyAnswer(slots, '400|20|7')).toBe('digitSwap')
    expect(classifyAnswer(task(placeValue1000, 'pv:regroup:ht:2:14', 'keypad'), 16)).toBe('addsPlaceParts')
  })

  it('explains with the blocks, and each misconception with its own sentence', () => {
    const h = (id: string, tag: Parameters<SkillDef['hint']>[1], kind?: TaskKind) => hintText(placeValue1000, fact(placeValue1000, id), tag, kind)
    expect(h('pv:buildHTO:345', null)).toBe('En plade er hundrede, en stang er ti, og en terning er en. Tre hundreder fire tiere og fem enere er tre hundrede og femogfyrre.')
    expect(h('pv:zeroPlace:304', 'zeroPlaceholder')).toBe('Tre hundreder nul tiere og fire enere er tre hundrede og fire. Nullet holder tiernes plads.')
    expect(h('pv:zeroPlace:104', 'concatNumberWords')).toBe('Et hundrede nul tiere og fire enere er et hundrede og fire. Det skriver vi med tre cifre.')
    expect(h('pv:digitValue:t:472', 'faceValue')).toBe('Syvtallet står på tiernes plads. Så er det halvfjerds værd.')
    expect(h('pv:expand:t:472', null)).toBe('Fire hundrede og tooghalvfjerds er fire hundrede plus halvfjerds plus to.')
    expect(h('pv:regroup:ht:2:14', null)).toBe('Ti tiere er et hundrede. Fjorten tiere er et hundrede og fire tiere.')
    expect(placeValue1000.hint(fact(placeValue1000, 'pv:digitValue:t:472'), 'faceValue').visual).toEqual({ scene: 'base', h: 0, t: 7, o: 0, order: 'hto' })
  })
})
