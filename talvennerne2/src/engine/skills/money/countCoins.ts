// countCoins — Tæl penge (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `tael:`.
//   sameCoins      tael:sameCoins:2+2+2+2       one kind of coin, 1, 2, 5 or 10 kr, up to 20 kr    20 (all)
//   mixedTo20      tael:mixedTo20:10+5+2        2–5 coins, two kinds or more, 4–20 kr, largest first
//   mixedTo100     tael:mixedTo100:20+20+10+2   3–7 coins, 21–100 kr, largest first           (2. kl.)
//   biggestFirst   tael:biggestFirst:2+20+5+10  4–7 coins of three kinds or more, 21–100 kr, lying in
//                                               a jumble: the strategy is to start with the biggest (2. kl.)
// The id lists the coins in kroner in the order they lie. Whole kroner only (the keypad takes kroner),
// so there are no 50-øre coins; notes are kronerOre's and payExact's.
// Kinds: choice (three amounts as cards, optionView 'amount') and keypad (production, in kroner).
// Prompt: { scene: 'coins', ore } — the coins as they lie. "Hvor mange penge er der?"
// Wrong amounts:
//   coinsAsCount   the number of coins (10 + 5 + 2 kr → 3 kr)
//   operand        the number on one of the coins
//   near           ±1 kr, one coin left out or counted twice
//   other          ±10 kr
// A9: when the number of coins is also the number on a coin (two 2-krone coins, or 5 + 2), the child
// may have repeated the coin rather than counted the coins: that value is 'ambiguous', never evidence.
import type { Fact, FamilyDef, HintSpec, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'
import { canonical, drawAvoiding, familyRank } from '../place/kit'
import { countUpSpeech, desc, kronerGuess, sum } from './kit'

const meta = metaOf('countCoins')

type Family = 'sameCoins' | 'mixedTo20' | 'mixedTo100' | 'biggestFirst'

/** One instance, read back from the id: the coins in kroner, in the order they lie. */
interface Pile {
  family: Family
  coins: number[]
}

const idOf = (p: Pile): string => `tael:${p.family}:${p.coins.join('+')}`

function parse(id: string): Pile {
  const [, family, coins] = id.split(':')
  return { family: family as Family, coins: coins.split('+').map(Number) }
}

const make = (p: Pile): Fact => ({
  id: idOf(p),
  skill: 'countCoins',
  family: p.family,
  operands: [...p.coins],
  answer: sum(p.coins) * 100,
  rank: familyRank(meta.families, p.family),
})

// ─── The piles ──────────────────────────────────────────────────────────────

/** Every multiset of the coins with at most `most[v]` of each, as lists largest first. */
function multisets(most: Readonly<Record<number, number>>, keep: (coins: number[]) => boolean): number[][] {
  const values = Object.keys(most).map(Number).sort(desc)
  const out: number[][] = []
  const walk = (i: number, acc: number[]) => {
    if (i === values.length) {
      if (keep(acc)) out.push([...acc])
      return
    }
    for (let n = 0; n <= most[values[i]]; n++) walk(i + 1, [...acc, ...Array.from({ length: n }, () => values[i])])
  }
  walk(0, [])
  return out
}

const kinds = (coins: readonly number[]) => new Set(coins).size

const SAME: readonly number[][] = [
  ...[3, 4, 5, 6, 7, 8, 9].map((k) => Array.from({ length: k }, () => 1)),
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => Array.from({ length: k }, () => 2)),
  ...[2, 3, 4].map((k) => Array.from({ length: k }, () => 5)),
  [10, 10],
]

const MIXED_20 = multisets({ 10: 1, 5: 2, 2: 3, 1: 3 }, (c) => c.length >= 2 && c.length <= 5 && kinds(c) >= 2 && sum(c) >= 4 && sum(c) <= 20)
const MIXED_100 = multisets({ 20: 4, 10: 2, 5: 2, 2: 2, 1: 2 }, (c) => c.length >= 3 && c.length <= 7 && kinds(c) >= 2 && sum(c) >= 21 && sum(c) <= 100)
const JUMBLE = MIXED_100.filter((c) => c.length >= 4 && kinds(c) >= 3)

/** A jumble: neither largest first nor smallest first. */
function jumbled(coins: readonly number[], rng: Rng): number[] {
  for (;;) {
    const order = rng.shuffle(coins)
    const down = order.every((c, i) => i === 0 || order[i - 1] >= c)
    const up = order.every((c, i) => i === 0 || order[i - 1] <= c)
    if (!down && !up) return order
  }
}

function draw(family: Family, rng: Rng): Fact {
  switch (family) {
    case 'sameCoins':
      return make({ family, coins: rng.pick(SAME) })
    case 'mixedTo20':
      return make({ family, coins: rng.pick(MIXED_20) })
    case 'mixedTo100':
      return make({ family, coins: rng.pick(MIXED_100) })
    case 'biggestFirst':
      return make({ family, coins: jumbled(rng.pick(JUMBLE), rng) })
  }
}

const FACTS: readonly Fact[] = meta.families.flatMap((fam) =>
  canonical('countCoins', fam.id, (rng) => draw(fam.id as Family, rng), fam.id === 'sameCoins' ? SAME.map((coins) => make({ family: 'sameCoins', coins })) : undefined),
)

// ─── Task parts ─────────────────────────────────────────────────────────────

const rangeOf = (family: Family): [number, number] => (family === 'sameCoins' || family === 'mixedTo20' ? [0, 2000] : [0, 10000])

function candidates(f: Fact) {
  const { coins } = parse(f.id)
  const total = sum(coins)
  const least = Math.min(...coins)
  const kr = (v: number, tag: Entry[1]): Entry[] => (v > 0 ? [[v * 100, tag]] : [])
  return tagged(total * 100, [
    ...kr(coins.length, 'coinsAsCount'),
    ...[...new Set(coins)].flatMap((v) => kr(v, 'operand')),
    ...kr(total + 1, 'near'),
    ...kr(total - 1, 'near'),
    ...kr(total - least, 'near'),
    ...kr(total + least, 'near'),
    ...kr(total + 10, 'other'),
    ...kr(total - 10, 'other'),
  ])
}

/**
 * The strategy: count on from the biggest coins ("Start med de største mønter. Tyve fyrre femogfyrre
 * syvogfyrre. Det er syvogfyrre kroner."); one kind of coin is counted in steps of its value.
 */
function hint(f: Fact, tag: string | null): HintSpec {
  const { coins } = parse(f.id)
  const ore = coins.map((c) => c * 100)
  const same = kinds(coins) === 1
  // one kind of coin: count in steps of its value ("Tæl i spring med to."), a krone each for 1-krone coins
  const lead: SpeechPart[] = !same
    ? [say('hint.countCoins.biggestFirst')]
    : coins[0] === 1
      ? [say('hint.countCoins.oneEach')]
      : [say('hint.countCoins.skipBy'), num(coins[0], 'end')]
  const standard: SpeechPart[] = [...lead, ...countUpSpeech(ore)]
  const visual: HintSpec['visual'] = { scene: 'coinsSum', ore }
  if (tag === 'coinsAsCount') return hintOf([say('hint.countCoins.notTheCoins'), ...standard], visual, 'coinsAsCount')
  if (tag === 'operand') return hintOf([say('hint.countCoins.addThemAll'), ...standard], visual)
  return hintOf(standard, visual)
}

export default {
  ...meta,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id as Family, rng), avoid),
  // read back from the id, like everything else here (a fact rebuilt from a task has only its id)
  answer: (f: Fact) => sum(parse(f.id).coins) * 100,
  answerType: () => 'ore',
  prompt: (f: Fact) => ({ scene: 'coins', ore: parse(f.id).coins.map((c) => c * 100) }),
  optionView: () => 'amount',
  range: (f: Fact) => rangeOf(parse(f.id).family),
  speech: () => [say('s.countCoins.howMuch')],
  candidates,
  hint: (f, tag) => hint(f, tag),
  guessFloor: (f: Fact, kind: TaskKind) => (kind === 'keypad' ? kronerGuess(rangeOf(parse(f.id).family)) : 0),
} satisfies SkillModule
