// fractionOfSet — Brøkdel af en mængde (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `fos:`:
// `fos:<n>/<d>:<total>:<thing>`, a fraction of a heap of strawberries, apples or carrots (THING_IDs):
//   halfOf           1/2 of 4–20 (even)                9 · 3 things = 27
//   quarterOf        1/4 of 8–24 (fours)               5 · 3 = 15
//   thirdOf          1/3 of 6–24 (threes)              7 · 3 = 21
//   threeQuartersOf  3/4 of 4–24 (fours)               6 · 3 = 18
// The thing is part of the instance, so every family has more instances than a key keeps as recent
// (mastery.ts: five), and a key never runs out of fresh ones.
// Kinds:
//   share (production, the manipulative; MANIPULATIVE_ONLY_FOR): "Del tolv jordbær i fire lige store dele.
//     Hvor mange er en fjerdedel?" — the things onto d plates, the answer how many each plate got (the
//     share view hands in that count, or −1 for an uneven deal: shareUnequal). Three quarters are dealt
//     onto two plates, "Den ene skal have tre fjerdedele og den anden resten.", and handed in as the deal
//     itself, '9|3' (answerType 'set', largest first). The view takes only an empty pile, so that is one
//     of ⌊total/2⌋ + 1 deals, guessed as often (guessFloor, as A14 counts what the child can enter): three
//     quarters of 4, 8 and 12 (1 in 3, 5 and 7) are no production, from 16 on (1 in 9 or less) they are.
//   choice and keypad (production, 0–24): "Hvor mange er en fjerdedel af tolv jordbær?" ("Hvad er
//     halvdelen af …") over the heap (Prompt 'objects', scattered).
// Wrong answers: denominatorAsAnswer — the denominator itself (¼ of 12 → 4; the fraction is said, not a
// number of the question, so it is no operand: only the total is, A9). Plain: the rest (12 − 3), the unit
// share for three quarters, the total ('operand'), one more or less ('near'). A deal hands in its count
// or −1 and nothing else, so the share kind has no candidates (as in shareEqually).
// Hint: deal into d equal heaps — "Del de tolv i fire lige store bunker. Der er tre i hver bunke. En
// fjerdedel af tolv er tre." (three quarters: "Tre fjerdedele er tre af bunkerne. Tre gange tre giver
// ni.") over the heaps (Prompt 'groups'), after "Brøken fortæller, hvor mange lige store bunker du skal
// dele i. Den fortæller ikke svaret." for denominatorAsAnswer.
import type { AnswerValue, Candidate, ErrorTag, Fact, FamilyDef, Prompt, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import type { Denominator } from '../../../speech/fractions'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'

type Family = 'halfOf' | 'quarterOf' | 'thirdOf' | 'threeQuartersOf'

const THINGS = ['strawberry', 'apple', 'carrot'] as const
const FRACTION: Readonly<Record<Family, readonly [n: number, d: Denominator, totals: readonly number[]]>> = {
  halfOf: [1, 2, [4, 6, 8, 10, 12, 14, 16, 18, 20]],
  quarterOf: [1, 4, [8, 12, 16, 20, 24]],
  thirdOf: [1, 3, [6, 9, 12, 15, 18, 21, 24]],
  threeQuartersOf: [3, 4, [4, 8, 12, 16, 20, 24]],
}
const FAST: Partial<Record<TaskKind, number>> = { choice: 8_000, keypad: 10_000 }
const META = metaOf('fractionOfSet')
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))

interface Parsed {
  family: Family
  n: number
  d: Denominator
  total: number
  thing: string
  answer: number
}

function parse(f: Pick<Fact, 'id'>): Parsed {
  const m = /^fos:(\d)\/(\d):(\d+):(\w+)$/.exec(f.id)
  if (!m) throw new Error(`fractionOfSet: bad id ${f.id}`)
  const [n, d, total] = [Number(m[1]), Number(m[2]) as Denominator, Number(m[3])]
  const family = (Object.keys(FRACTION) as Family[]).find((k) => FRACTION[k][0] === n && FRACTION[k][1] === d)!
  return { family, n, d, total, thing: m[4], answer: (total / d) * n }
}

const ofFamily = (family: Family): Fact[] => {
  const [n, d, totals] = FRACTION[family]
  return totals.flatMap((total, i) => THINGS.map((thing, j) => {
    const id = `fos:${n}/${d}:${total}:${thing}`
    return { id, skill: 'fractionOfSet' as const, family, operands: [total], answer: (total / d) * n, rank: i * 3 + j }
  }))
}
const ALL: Readonly<Record<Family, readonly Fact[]>> = {
  halfOf: ofFamily('halfOf'), quarterOf: ofFamily('quarterOf'), thirdOf: ofFamily('thirdOf'), threeQuartersOf: ofFamily('threeQuartersOf'),
}

/** The deal of three quarters onto two plates, largest first ('9|3'). */
const deal = (p: Parsed) => `${p.answer}|${p.total - p.answer}`
const twoPlates = (p: Parsed, kind: TaskKind) => kind === 'share' && p.n > 1

function candidates(f: Fact): Candidate[] {
  const p = parse(f)
  const unit = p.total / p.d
  return tagged(p.answer, [
    [p.d, 'denominatorAsAnswer'], [p.total - p.answer, 'other'], [unit, 'other'], [p.total, 'operand'],
    [p.answer + 1, 'near'], [p.answer - 1, 'near'],
  ])
}

const frac = (p: Parsed, n: number, form: 'mid' | 'end'): SpeechPart => ({ frac: { n, d: p.d, form } })
const things = (p: Parsed): SpeechPart[] => [num(p.total, 'mid'), say(`noun.thing.${p.thing}.pl`)]

function speech(f: Fact, kind: TaskKind): SpeechPart[] {
  const p = parse(f)
  if (kind !== 'share') {
    return p.family === 'halfOf'
      ? [say('frag.halvdelen_af'), ...things(p)]
      : [say('s.fractionOfSet.howMany'), frac(p, p.n, 'mid'), say('s.fractionOfSet.of'), ...things(p)]
  }
  if (twoPlates(p, kind)) {
    return [say('s.fractionOfSet.deal'), ...things(p), say('s.fractionOfSet.onTwo'), say('s.fractionOfSet.oneGets'), frac(p, p.n, 'mid'), say('s.fractionOfSet.otherRest')]
  }
  return [
    say('s.fractionOfSet.deal'), ...things(p), say('s.fractionOfSet.into'), num(p.d, 'mid'), say('s.fractionOfSet.equalParts'),
    ...(p.family === 'halfOf' ? [say('s.fractionOfSet.howManyHalf')] : [say('s.fractionOfSet.howMany'), frac(p, 1, 'end')]),
  ]
}

function hint(f: Fact, tag: ErrorTag | null, kind?: TaskKind) {
  const p = parse(f)
  const unit = p.total / p.d
  const words: SpeechPart[] = [
    say('hint.fractionOfSet.dealThe'), num(p.total, 'mid'), say('s.fractionOfSet.into'), num(p.d, 'mid'), say('hint.fractionOfSet.piles'),
    say('hint.fractionOfSet.thereAre'), num(unit, 'mid'), say('hint.fractionOfSet.inEach'),
  ]
  if (p.n > 1) {
    words.push(frac(p, p.n, 'mid'), say('hint.fractionOfSet.threePiles'), num(p.n, 'mid'), say('op.gange'), num(unit, 'mid'), say('op.giver'), num(p.answer))
  } else {
    words.push(...(p.family === 'halfOf' ? [say('hint.fractionOfSet.halfOf')] : [frac(p, 1, 'mid'), say('s.fractionOfSet.of')]), num(p.total, 'mid'), say('hint.fractionOfSet.is'), num(p.answer))
  }
  if (twoPlates(p, kind ?? 'keypad')) {
    words.push(say('hint.fractionOfSet.put'), num(p.answer, 'mid'), say('hint.fractionOfSet.onOne'), num(p.total - p.answer, 'mid'), say('hint.fractionOfSet.onOther'))
  }
  const visual: Prompt = { scene: 'groups', groups: p.d, size: unit, thing: p.thing }
  if (tag === 'denominatorAsAnswer') return hintOf([say('hint.fractionOfSet.notAnswer'), ...words], visual, 'denominatorAsAnswer')
  if (tag === 'shareUnequal') return hintOf([say('hint.fractionOfSet.sameEach'), ...words], visual)
  return hintOf(words, visual)
}

function instance(fam: FamilyDef, rng: Rng, avoid: ReadonlySet<string>): Fact {
  const all = ALL[fam.id as Family]
  const fresh = all.filter((f) => !avoid.has(f.id))
  return rng.pick(fresh.length > 0 ? fresh : all)
}

export default {
  ...META,
  families: FAMILIES,
  // share first: the manipulative is what a trial asks (its first production kind)
  kinds: ['share', 'choice', 'keypad'],
  enumerate: () => (Object.values(ALL) as Fact[][]).flat(),
  instance,
  answer: (f: Fact, kind: TaskKind): AnswerValue => {
    const p = parse(f)
    return twoPlates(p, kind) ? deal(p) : p.answer
  },
  answerTypeFor: (f: Fact, kind: TaskKind) => (twoPlates(parse(f), kind) ? 'set' : 'int'),
  answerType: () => 'int',
  prompt: (f: Fact, kind: TaskKind): Prompt => {
    const p = parse(f)
    return kind === 'share'
      ? { scene: 'share', total: p.total, recipients: twoPlates(p, kind) ? 2 : p.d, thing: p.thing }
      : { scene: 'objects', n: p.total, layout: 'scatter', thing: p.thing }
  },
  optionView: () => 'numeral',
  range: () => [0, 24],
  speech,
  candidates,
  candidatesFor: (f: Fact, kind: TaskKind) => (kind === 'share' ? [] : candidates(f)),
  // a deal on two plates is one of ⌊total/2⌋ + 1 (12|0 … 6|6 for twelve things)
  guessFloor: (f: Fact, kind: TaskKind) => {
    const p = parse(f)
    return twoPlates(p, kind) ? 1 / (Math.floor(p.total / 2) + 1) : 0
  },
  hint,
} satisfies SkillModule
