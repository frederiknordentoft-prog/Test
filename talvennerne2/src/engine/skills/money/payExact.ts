// payExact — Betal præcist (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `pay:`.
//   to20          pay:to20:<øre>          3–19 kr (not 5 and 10: one coin), coins up to 20 kr   15 (all)
//   to50          pay:to50:<øre>          21–49 kr, coins up to 20 kr
//   to100         pay:to100:<øre>         51–99 kr, the 50-krone note and the coins
//   fewestCoins   pay:fewestCoins:<øre>   6–99 kr (not 10, 20, 50) with as few pieces as possible  (3. kl.)
// Prompt: the shop, { scene: 'shop', thing, priceOre, purse } (the purse is what the pay view offers).
// pay (production): "Betal sytten kroner." The answer is the tray's sum in øre (answerType 'ore'), so
//   every exact way of paying is right; fewestCoins asks for the coins themselves, the fewest set
//   ('c2000|c500|c200', answerType 'set', compared as a multiset).
// choice: "Hvilke penge er præcis sytten kroner?" Three coin sets as cards (optionView 'coins'): the
//   fewest set, and sets that are a krone or a coin off. No card ever pays the price another way
//   (that would be a right answer marked wrong) — except in fewestCoins, where the same money in more
//   pieces is the wrong card that matters.
// Paying has no misconception in the catalogue: ±1 kr and a coin left out are 'near', a bigger coin
// swapped for a smaller one or ±10 kr 'other'.
import type { AnswerValue, Fact, FamilyDef, HintSpec, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, say, tagged, type Entry } from '../number/kit'
import { canonical, drawAvoiding, familyRank } from '../place/kit'
import { KRONE_COINS, coinSet, countUpSpeech, desc, fewestPieces, goodsFor, moneySays, sum } from './kit'

const meta = metaOf('payExact')

type Family = 'to20' | 'to50' | 'to100' | 'fewestCoins'

/** What the purse holds per family (øre, largest first). */
const PURSE: Readonly<Record<Family, readonly number[]>> = {
  to20: KRONE_COINS,
  to50: KRONE_COINS,
  to100: [5000, ...KRONE_COINS],
  fewestCoins: [5000, ...KRONE_COINS],
}

/** Prices in kroner. */
const between = (lo: number, hi: number, skip: readonly number[] = []): number[] =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((kr) => !skip.includes(kr))
const PRICES: Readonly<Record<Family, readonly number[]>> = {
  to20: between(3, 19, [5, 10]),
  to50: between(21, 49),
  to100: between(51, 99),
  fewestCoins: between(6, 99, [10, 20, 50]),
}

interface Purchase {
  family: Family
  price: number
}

const idOf = (p: Purchase): string => `pay:${p.family}:${p.price}`

function parse(id: string): Purchase {
  const [, family, price] = id.split(':')
  return { family: family as Family, price: Number(price) }
}

const make = (p: Purchase): Fact => ({
  id: idOf(p),
  skill: 'payExact',
  family: p.family,
  operands: [p.price / 100],
  answer: p.price,
  rank: familyRank(meta.families, p.family),
})

const draw = (family: Family, rng: Rng): Fact => make({ family, price: rng.pick(PRICES[family]) * 100 })

const FACTS: readonly Fact[] = meta.families.flatMap((fam) => {
  const family = fam.id as Family
  const all = PRICES[family].map((kr) => make({ family, price: kr * 100 }))
  return canonical('payExact', family, (rng) => draw(family, rng), all)
})

/** The fewest pieces from the family's purse. */
const fewest = (p: Purchase): number[] => fewestPieces(p.price, PURSE[p.family]) ?? []

/** The piece just below `ore` in the purse (null below the smallest). */
function smallerThan(ore: number, purse: readonly number[]): number | null {
  return [...purse].sort(desc).find((v) => v < ore) ?? null
}

/**
 * The same money in more pieces (fewestCoins' wrong card): the biggest piece that can be split is
 * paid with the pieces just below it.
 */
function splitOne(pieces: readonly number[], purse: readonly number[]): number[] | null {
  for (const big of [...new Set(pieces)].sort(desc)) {
    const smaller = purse.filter((v) => v < big)
    const parts = fewestPieces(big, smaller)
    if (parts && parts.length > 1) {
      const rest = [...pieces]
      rest.splice(rest.indexOf(big), 1)
      return [...rest, ...parts]
    }
  }
  return null
}

/** Coin sets that are a krone or a coin off, and (fewestCoins) the right money in more pieces. */
function wrongSets(p: Purchase): Entry[] {
  const right = fewest(p)
  const purse = PURSE[p.family]
  const out: Entry[] = []
  const add = (pieces: number[] | null, tag: Entry[1]) => {
    if (!pieces || pieces.length === 0) return
    // a card that pays the price is right in every family but fewestCoins
    if (sum(pieces) === p.price && p.family !== 'fewestCoins') return
    out.push([coinSet(pieces), tag])
  }
  add([...right, 100], 'near')
  if (right.length > 1) add(right.slice(0, -1), 'near')
  const big = right[0]
  const lower = smallerThan(big, purse)
  if (lower !== null) add([lower, ...right.slice(1)], 'other')
  if (p.family === 'fewestCoins') add(splitOne(right, purse), 'near')
  return out
}

function candidates(f: Fact) {
  const p = parse(f.id)
  const ore = (v: number, tag: Entry[1]): Entry[] => (v > 0 ? [[v, tag]] : [])
  return tagged(f.answer, [
    // the tray's sum (pay)
    ...ore(p.price + 100, 'near'),
    ...ore(p.price - 100, 'near'),
    ...ore(p.price + 1000, 'other'),
    ...ore(p.price - 1000, 'other'),
    // coin sets (choice, and the fewestCoins tray)
    ...wrongSets(p),
  ])
}

function hint(f: Fact, tag: string | null): HintSpec {
  const p = parse(f.id)
  const pieces = fewest(p)
  const lead = say(p.family === 'fewestCoins' ? 'hint.pay.fewest' : 'hint.pay.biggestFirst')
  const said: SpeechPart[] = [lead, ...countUpSpeech(pieces)]
  const visual: HintSpec['visual'] = { scene: 'coinsSum', ore: pieces }
  return hintOf(tag === 'near' ? [say('hint.pay.countAgain'), ...said] : said, visual)
}

export default {
  ...meta,
  kinds: ['pay', 'choice'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id as Family, rng), avoid),
  answer(f: Fact, kind: TaskKind): AnswerValue {
    const p = parse(f.id)
    return kind === 'pay' && p.family !== 'fewestCoins' ? p.price : coinSet(fewest(p))
  },
  answerTypeFor: (f: Fact, kind: TaskKind) => (kind === 'pay' && parse(f.id).family !== 'fewestCoins' ? 'ore' : 'set'),
  answerType: () => 'ore',
  prompt: (f: Fact) => {
    const p = parse(f.id)
    return { scene: 'shop', thing: goodsFor(f.id), priceOre: p.price, purse: [...PURSE[p.family]] }
  },
  optionView: () => 'coins',
  range: (f: Fact) => [0, parse(f.id).family === 'to20' ? 2000 : parse(f.id).family === 'to50' ? 5000 : 10000],
  speech(f: Fact, kind: TaskKind): SpeechPart[] {
    const p = parse(f.id)
    if (p.family === 'fewestCoins') {
      // "Betal syvogtyve kroner med så få mønter og sedler som muligt." · "Hvilke penge er præcis
      // syvogtyve kroner med færrest mønter og sedler?"
      return kind === 'pay'
        ? [say('frag.betal'), moneySays(p.price, 'mid'), say('s.payExact.asFewAsPossible')]
        : [say('s.payExact.whichMoney'), moneySays(p.price, 'mid'), say('s.payExact.withFewest')]
    }
    return kind === 'pay' ? [say('frag.betal'), moneySays(p.price, 'end')] : [say('s.payExact.whichMoney'), moneySays(p.price, 'end')]
  },
  candidates,
  hint: (f, tag) => hint(f, tag),
} satisfies SkillModule
