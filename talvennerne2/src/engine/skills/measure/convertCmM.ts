// convertCmM — Centimeter og meter (SPEC §2.2, pædagogik-forslaget §1.3: 1 m = 100 cm). Procedure, prefix `cmm:`.
//   mToCm          cmm:mToCm:<m>           "3 meter = ? centimeter", m = 1–9                          9 (all)
//   mCmToCm        cmm:mCmToCm:<m>:<c>     "2 meter 35 centimeter = ? centimeter", c = 1–99
//   cmToMCm        cmm:cmToMCm:<n>         "235 centimeter = ? meter 35 centimeter": the whole meters, n = 100–999
//   compareMixed   cmm:compareMixed:<m>:<c>  "1 meter − 37 centimeter = ? centimeter": how much longer a meter
//                                          or two are than c centimeter, c = 1–99
// Prompt: the equation, the units as words on the card (noun.unit.*), the answer's unit after the blank.
// "Hvor mange centimeter er to meter og femogtredive centimeter?" · "Hvor mange hele meter er …?" · "Hvor
// mange centimeter længere er en meter end syvogtredive centimeter?" Kinds: choice (three numbers) and
// keypad (production; room for a zero too many: 3000 for 3 m).
// Wrong answers:
//   tensZero           a meter taken as ten centimeter, or a zero too many: 3 m → 30 or 3000, 2 m 35 cm → 55
//                      or 2035, 235 cm → 23 m (SPEC §4.2: "mister nullet eller sætter et nul for meget")
//   zeroPlaceholder    c < 10: the zero of the tens dropped or moved, 2 m 5 cm → 25 or 250 (25 is also the
//                      meter taken as ten: 'ambiguous')
//   digitComplement10  1 m − 37 cm made up digit by digit: 73 (as change from100)
//   wrongOperation     compareMixed: the lengths added, 100 + 37
//   operand            a number on the card; near ±1, ±10, ±100 and a meter left out; other: 103 for 3 m,
//                      the numbers taken away as they stand (37 − 1)
import type { Fact, FamilyDef, HintSpec, Rng, SpeechPart, Term } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'
import { canonical, drawAvoiding, familyRank } from '../place/kit'
import { measureSays } from './kit2'

const meta = metaOf('convertCmM')

const answerOf = (family: string, a: number, b: number): number =>
  family === 'mToCm' ? 100 * a : family === 'mCmToCm' ? 100 * a + b : family === 'cmToMCm' ? Math.floor(a / 100) : 100 * a - b

/** b is the centimeter of mCmToCm and compareMixed; mToCm and cmToMCm have one number. */
const make = (family: string, a: number, b?: number): Fact => ({
  id: `cmm:${family}:${a}${b === undefined ? '' : `:${b}`}`, skill: 'convertCmM', family, operands: b === undefined ? [a] : [a, b],
  answer: answerOf(family, a, b ?? 0), rank: familyRank(meta.families, family),
})
const draw = (family: string, rng: Rng): Fact =>
  family === 'mToCm' ? make(family, rng.between(1, 9))
    : family === 'cmToMCm' ? make(family, rng.between(100, 999))
      : make(family, rng.between(1, family === 'mCmToCm' ? 9 : 2), rng.between(1, 99))

const FACTS: readonly Fact[] = meta.families.flatMap(({ id }) =>
  canonical('convertCmM', id, (rng) => draw(id, rng), id === 'mToCm' ? Array.from({ length: 9 }, (_, i) => make(id, i + 1)) : undefined))

function parse(f: Pick<Fact, 'id'>) {
  const [, family, sa, sb = '0'] = f.id.split(':')
  const a = Number(sa)
  const b = Number(sb)
  return { family, a, b, x: answerOf(family, a, b) }
}

const M: Term = { text: 'noun.unit.m.end' }
const CM: Term = { text: 'noun.unit.cm.end' }

function terms(f: Fact): Term[] {
  const { family, a, b } = parse(f)
  const rest = a % 100
  if (family === 'mToCm') return [{ n: a }, M, { op: '=' }, { blank: true }, CM]
  if (family === 'mCmToCm') return [{ n: a }, M, { n: b }, CM, { op: '=' }, { blank: true }, CM]
  if (family === 'cmToMCm') return [{ n: a }, CM, { op: '=' }, { blank: true }, M, ...(rest ? [{ n: rest }, CM] : [])]
  return [{ n: a }, M, { op: '−' }, { n: b }, CM, { op: '=' }, { blank: true }, CM]
}

function candidates(f: Fact) {
  const { family, a, b, x } = parse(f)
  const out: Entry[] = [[a, 'operand'], [x + 1, 'near'], [x - 1, 'near'], [x + 10, 'near'], [x - 10, 'near']]
  if (family === 'mToCm') out.push([10 * a, 'tensZero'], [1000 * a, 'tensZero'], [x + 100, 'near'], [x - 100, 'near'], [100 + a, 'other'])
  else if (family === 'mCmToCm') {
    out.push([b, 'operand'], [10 * a + b, 'tensZero'], [1000 * a + b, 'tensZero'], [x + 100, 'near'], [x - 100, 'near'])
    if (b < 10) out.push([10 * a + b, 'zeroPlaceholder'], [100 * a + 10 * b, 'zeroPlaceholder'])
  } else if (family === 'cmToMCm') out.push([a % 100, 'operand'], [Math.floor(a / 10), 'tensZero'])
  else {
    const t = Math.floor(b / 10)
    const o = b % 10
    out.push([b, 'operand'], [100 * a + b, 'wrongOperation'], [b - a, 'other'], [x - 100, 'near'])
    if (a === 1 && t && o) out.push([(10 - t) * 10 + 10 - o, 'digitComplement10'])
  }
  return tagged(x, out)
}

/**
 * "En meter er hundrede centimeter. To meter er to hundrede centimeter. Læg femogtredive centimeter til. Det
 * er to hundrede og femogtredive centimeter." · "… To hundrede centimeter er to meter. Der er femogtredive
 * centimeter til overs." · "… Et hundrede minus syvogtredive giver treogtres." The picture is the meter stick
 * as a line in centimeter: a hop for every meter and one for the rest (compareMixed: from c up to the meters).
 */
function hint(f: Fact, tag: string | null): HintSpec {
  const { family, a, b, x } = parse(f)
  const meters = family === 'cmToMCm' ? x : a
  const said: SpeechPart[] = [say(tag === 'tensZero' ? 'hint.convertCmM.twoZeros' : 'hint.convertCmM.meter')]
  if (family === 'cmToMCm') said.push(measureSays(100 * x, 'cm', 'mid'), say('hint.convertCmM.is'), measureSays(x, 'm', 'end'))
  else if (meters > 1) said.push(measureSays(meters, 'm', 'mid'), say('hint.convertCmM.is'), measureSays(100 * meters, 'cm', 'end'))
  if (family === 'mCmToCm') {
    said.push(say('hint.convertCmM.add'), measureSays(b, 'cm', 'mid'), say('hint.convertCmM.more'))
    if (tag === 'zeroPlaceholder') said.push(say('hint.convertCmM.noTens'))
    said.push(say('frag.det_er'), measureSays(x, 'cm', 'end'))
  }
  if (family === 'cmToMCm' && a % 100) said.push(say('hint.convertCmM.left'), measureSays(a % 100, 'cm', 'mid'), say('hint.convertCmM.over'))
  if (family === 'compareMixed') {
    if (tag === 'wrongOperation') said.unshift(say('hint.convertCmM.takeAway'))
    if (tag === 'digitComplement10') said.push(say('hint.convertCmM.notDigits'))
    said.push(num(100 * a, 'mid'), say('op.minus'), num(b, 'mid'), say('op.giver'), num(x, 'end'))
  }
  const top = family === 'cmToMCm' ? a : family === 'compareMixed' ? 100 * a : x
  const hops = family === 'compareMixed' ? [b, top] : Array.from({ length: meters + 1 }, (_, i) => 100 * i).concat(top > 100 * meters ? [top] : [])
  const mis = tag === 'tensZero' || tag === 'zeroPlaceholder' || tag === 'wrongOperation' || tag === 'digitComplement10' ? tag : undefined
  return hintOf(said, { scene: 'line', min: 0, max: top, hops }, mis)
}

export default {
  ...meta,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id, rng), avoid),
  // read back from the id, like everything else here (a fact rebuilt from a task has only its id)
  answer: (f: Fact) => parse(f).x,
  answerType: () => 'int',
  prompt: (f: Fact) => ({ scene: 'equation', terms: terms(f) }),
  optionView: () => 'numeral',
  range: (f: Fact) => [0, parse(f).family === 'cmToMCm' ? 99 : parse(f).family === 'compareMixed' ? 999 : 9999],
  speech(f: Fact): SpeechPart[] {
    const { family, a, b } = parse(f)
    if (family === 'mToCm') return [say('s.convertCmM.howManyCm'), measureSays(a, 'm', 'end')]
    if (family === 'mCmToCm') return [say('s.convertCmM.howManyCm'), measureSays(a, 'm', 'mid'), say('op.og'), measureSays(b, 'cm', 'end')]
    if (family === 'cmToMCm') return [say('s.convertCmM.howManyM'), measureSays(a, 'cm', 'end')]
    return [say('s.convertCmM.howMuchLonger'), measureSays(a, 'm', 'mid'), say('s.convertCmM.than'), measureSays(b, 'cm', 'end')]
  },
  candidates,
  hint: (f, tag) => hint(f, tag),
  fastMs: (f: Fact, kind) => (kind === 'choice' || parse(f).family === 'mToCm' ? 8_000 : 12_000),
} satisfies SkillModule
