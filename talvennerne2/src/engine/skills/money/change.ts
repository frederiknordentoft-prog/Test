// change — Byttepenge (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `byt:`.
//   from10    byt:from10:<øre>    paid with a 10-krone coin, price 1–9 kr                      9 (all)
//   from20    byt:from20:<øre>    paid with a 20-krone coin, price 3–19 kr (not 10)            16 (all)
//   from50    byt:from50:<øre>    paid with a 50-krone note, price 21–49 kr
//   from100   byt:from100:<øre>   paid with a 100-krone note, price 21–99 kr                  (3. kl.)
// The id carries the price; the family says what was paid. The answer is the change in øre (always
// whole kroner). Prompt: the shop, { scene: 'shop', thing, priceOre, paidOre, purse }.
// "Det koster tretten kroner. Du betaler med en tyvekrone. Hvor mange penge får du tilbage?"
// Kinds: choice (three amounts, optionView 'amount'), keypad (production, kroner) and pay (production:
// "Læg byttepengene i bakken." — the tray's sum, so any way of giving the change is right).
// Wrong amounts:
//   wrongOperation     price + paid (added instead of taken away)
//   digitComplement10  from100 only: each digit made up to ten, 100 − 37 → 73 (pædagogik §3.2 lists it
//                      for missingPart100/toHundred and sub100Borrow/fromTen; making change from a
//                      hundred is the same idea)
//   operand            the price or what was paid
//   near               ±1 kr, ±10 kr
// A9: a misconception that lands on a number from the question is 'ambiguous' — 100 − 55 made up
// digit by digit is 55, the price itself.
import type { Fact, FamilyDef, HintSpec, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'
import { canonical, drawAvoiding, familyRank } from '../place/kit'
import { coinSays, goodsFor, kronerGuess, moneySays } from './kit'

const meta = metaOf('change')

type Family = 'from10' | 'from20' | 'from50' | 'from100'

/** What the child pays with, in øre. */
const PAID: Readonly<Record<Family, number>> = { from10: 1000, from20: 2000, from50: 5000, from100: 10000 }

/** The coins and notes to give change with: everything smaller than what was paid. */
const PURSE: Readonly<Record<Family, readonly number[]>> = {
  from10: [500, 200, 100],
  from20: [1000, 500, 200, 100],
  from50: [2000, 1000, 500, 200, 100],
  from100: [5000, 2000, 1000, 500, 200, 100],
}

const between = (lo: number, hi: number, skip: readonly number[] = []): number[] =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((kr) => !skip.includes(kr))
/** Prices in kroner. */
const PRICES: Readonly<Record<Family, readonly number[]>> = {
  from10: between(1, 9),
  from20: between(3, 19, [10]),
  from50: between(21, 49),
  from100: between(21, 99),
}

interface Sale {
  family: Family
  price: number
}

const idOf = (s: Sale): string => `byt:${s.family}:${s.price}`

function parse(id: string): Sale & { paid: number; change: number } {
  const [, family, price] = id.split(':')
  const paid = PAID[family as Family]
  return { family: family as Family, price: Number(price), paid, change: paid - Number(price) }
}

const make = (s: Sale): Fact => ({
  id: idOf(s),
  skill: 'change',
  family: s.family,
  operands: [s.price / 100, PAID[s.family] / 100],
  answer: PAID[s.family] - s.price,
  rank: familyRank(meta.families, s.family),
})

const draw = (family: Family, rng: Rng): Fact => make({ family, price: rng.pick(PRICES[family]) * 100 })

const FACTS: readonly Fact[] = meta.families.flatMap((fam) => {
  const family = fam.id as Family
  return canonical('change', family, (rng) => draw(family, rng), PRICES[family].map((kr) => make({ family, price: kr * 100 })))
})

/** Room on the cards for the added amount (wrongOperation), whatever was paid. */
const rangeOf = (family: Family): [number, number] => [0, 2 * PAID[family]]

/** 100 − 37 made up digit by digit: 7 and 3 → 73 kr (null when a digit is 0). */
function digitComplement(priceKr: number): number | null {
  const t = Math.floor(priceKr / 10)
  const o = priceKr % 10
  return t > 0 && o > 0 ? (10 - t) * 10 + (10 - o) : null
}

function candidates(f: Fact) {
  const s = parse(f.id)
  const ore = (v: number | null, tag: Entry[1]): Entry[] => (v !== null && v > 0 ? [[v, tag]] : [])
  const complement = s.family === 'from100' ? digitComplement(s.price / 100) : null
  return tagged(s.change, [
    ...ore(s.price + s.paid, 'wrongOperation'),
    ...ore(complement === null ? null : complement * 100, 'digitComplement10'),
    ...ore(s.price, 'operand'),
    ...ore(s.paid, 'operand'),
    ...ore(s.change + 100, 'near'),
    ...ore(s.change - 100, 'near'),
    ...ore(s.change + 1000, 'near'),
    ...ore(s.change - 1000, 'near'),
  ])
}

/** Counting up from the price to what was paid: to the next ten first, then the rest of the way. */
function hops(priceKr: number, paidKr: number): number[] {
  const ten = Math.ceil(priceKr / 10) * 10
  return [...new Set([priceKr, ten, paidKr])].filter((v) => v <= paidKr)
}

function hint(f: Fact, tag: string | null): HintSpec {
  const s = parse(f.id)
  const price = s.price / 100
  const paid = s.paid / 100
  const visual: HintSpec['visual'] = { scene: 'line', min: 0, max: paid, hops: hops(price, paid) }
  // "Tæl op fra prisen til det, du betaler med. Fra tretten til tyve er syv kroner."
  const countUp: SpeechPart[] = [
    say('hint.change.countUp'), say('hint.change.from'), num(price, 'mid'), say('hint.change.to'), num(paid, 'mid'),
    say('hint.change.is'), moneySays(s.change, 'end'),
  ]
  if (tag === 'wrongOperation') {
    // "Du skal have penge tilbage, så du skal trække fra. Tyve minus tretten giver syv."
    const said = [say('hint.change.takeAway'), num(paid, 'mid'), say('op.minus'), num(price, 'mid'), say('op.giver'), num(paid - price, 'end')]
    return hintOf(said, visual, 'wrongOperation')
  }
  const ten = Math.ceil(price / 10) * 10
  if (tag === 'digitComplement10' && s.family === 'from100' && ten > price) {
    // "Tæl op til den næste tier først. Fra syvogtredive til fyrre er tre. Fra fyrre til et hundrede
    // er tres. Det er treogtres kroner." (From 91–99 the next ten is the hundred: one step.)
    const step = (from: number, to: number): SpeechPart[] => [
      say('hint.change.from'), num(from, 'mid'), say('hint.change.to'), num(to, 'mid'), say('hint.change.is'), num(to - from, 'end'),
    ]
    const said = [say('hint.change.nextTenFirst'), ...step(price, ten), ...(ten < paid ? step(ten, paid) : []), say('frag.det_er'), moneySays(s.change, 'end')]
    return hintOf(said, visual, 'digitComplement10')
  }
  return hintOf(countUp, visual)
}

export default {
  ...meta,
  kinds: ['choice', 'keypad', 'pay'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id as Family, rng), avoid),
  // read back from the id, like everything else here (a fact rebuilt from a task has only its id)
  answer: (f: Fact) => parse(f.id).change,
  answerType: () => 'ore',
  prompt: (f: Fact) => {
    const s = parse(f.id)
    return { scene: 'shop', thing: goodsFor(f.id), priceOre: s.price, paidOre: s.paid, purse: [...PURSE[s.family]] }
  },
  optionView: () => 'amount',
  range: (f: Fact) => rangeOf(parse(f.id).family),
  speech(f: Fact, kind: TaskKind): SpeechPart[] {
    const s = parse(f.id)
    return [
      say('s.money.itCosts'), moneySays(s.price, 'end'),
      say('frag.du_betaler_med'), coinSays(s.paid, 'indef', 'end'),
      say(kind === 'pay' ? 's.change.layChange' : 's.change.howMuchBack'),
    ]
  },
  candidates,
  hint: (f, tag) => hint(f, tag),
  guessFloor: (f: Fact, kind: TaskKind) => (kind === 'keypad' ? kronerGuess(rangeOf(parse(f.id).family)) : 0),
} satisfies SkillModule
