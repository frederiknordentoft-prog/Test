// kronerOre — Kroner og øre (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `kro:`.
//   readAmount        kro:readAmount:<øre>        a price with 50 øre, 1,50–49,50 kr, in the shop          49
//   fiftiesInKroner   kro:fiftiesInKroner:<øre>   4–20 halvtredsører on the table (2–10 kr)                  9
//   addHalves         kro:addHalves:<øre>         two things at 1,50–24,50 kr each (2,50 + 2,50)            24
// <øre> is the price on the tag (readAmount, addHalves) or what the coins are worth (fiftiesInKroner).
// Kinds: pay (production) and choice.
//   readAmount   the shop with the price tag "12,50 kr." and a purse with the halvtredsøre. "Betal tolv kroner
//                og halvtreds øre." (the tray's sum, answerType 'ore', so any exact tray is right) · "Hvilke
//                penge er præcis …?" three coin sets (optionView 'coins', answerType 'set').
//   fifties…     { scene: 'coins' } with the halvtredsører. "Hvor mange penge er der? Betal det samme med
//                kroner." (the pay view's purse for a whole-krone amount has no halvtredsøre) · choice:
//                "Hvor mange penge er der?" three amounts (optionView 'amount').
//   addHalves    the shop with one price tag. "Det koster to kroner og halvtreds øre. Betal for to af dem." ·
//                "… Hvad koster to af dem?" three amounts. The round screen draws two of the thing, each with
//                its tag (its answer is twice the tag), and pay's bubble says "Betal for to af dem." (QA3a P2-2).
// Wrong answers:
//   coinsAsCount   fiftiesInKroner: one krone per coin (six halvtredsører → 6 kr)
//   operand        the price of one (addHalves); 50 øre, the number on one coin (fiftiesInKroner)
//   near           the øre left out or paid with a krone, ±1 kr, ±50 øre, and the krone the two
//                  halvtredsører make forgotten (2,50 + 2,50 → 4 kr)
//   other          the 50 øre read as kroner (12,50 → 62 kr), the halvtredsøre swapped for a femkrone
// The catalogue has no misconception for reading or adding øre (as payExact has none for paying).
import type { AnswerValue, Fact, FamilyDef, HintSpec, Prompt, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'
import { canonical, drawAvoiding, familyRank } from '../place/kit'
import { KRONE_COINS, coinSet, fewestPieces, goodsFor, moneySays } from './kit'

const meta = metaOf('kronerOre')

/** The shop's purse: the coins with the halvtredsøre. */
const PURSE: readonly number[] = [...KRONE_COINS, 50]
const fewest = (ore: number): number[] => fewestPieces(ore, PURSE) ?? []

const make = (family: string, ore: number): Fact => ({
  id: `kro:${family}:${ore}`, skill: 'kronerOre', family, operands: [ore], answer: family === 'addHalves' ? 2 * ore : ore,
  rank: familyRank(meta.families, family),
})
const draw = (family: string, rng: Rng): Fact =>
  make(family, family === 'fiftiesInKroner' ? 100 * rng.between(2, 10) : 100 * rng.between(1, family === 'readAmount' ? 49 : 24) + 50)

const FACTS: readonly Fact[] = meta.families.flatMap(({ id }) =>
  canonical('kronerOre', id, (rng) => draw(id, rng), id === 'fiftiesInKroner' ? Array.from({ length: 9 }, (_, i) => make(id, 200 + 100 * i)) : undefined))

function parse(f: Pick<Fact, 'id'>) {
  const [, family, ore] = f.id.split(':')
  const p = Number(ore)
  return { family, p, total: family === 'addHalves' ? 2 * p : p }
}

function candidates(f: Fact) {
  const { family, p, total } = parse(f)
  const kr = p - 50
  const out: Entry[] = [[total + 100, 'near'], [total - 100, 'near'], [total + 50, 'near'], [total - 50, 'near']]
  // the coin sets are readAmount's cards: never the right set, which is the fewest pieces with the halvtredsøre
  if (family === 'readAmount') out.push([kr + 5000, 'other'], [coinSet(fewest(kr)), 'near'], [coinSet(fewest(p + 50)), 'near'], [coinSet([...fewest(kr), 500]), 'other'])
  else if (family === 'fiftiesInKroner') out.push([2 * p, 'coinsAsCount'], [50, 'operand'])
  else out.push([p, 'operand'])
  return tagged(total, out)
}

/** pay hands in the tray's sum; readAmount's cards are coin sets, the others' amounts. */
const answerOf = (f: Fact, kind: TaskKind): AnswerValue => {
  const { family, p, total } = parse(f)
  return family === 'readAmount' && kind === 'choice' ? coinSet(fewest(p)) : total
}

/**
 * readAmount: "Kommaet skiller kronerne fra ørerne. Betal først tolv kroner og læg så en halvtredsøre."
 * fiftiesInKroner: "To halvtredsører er en krone. Seks halvtredsører er tre kroner." addHalves: "To
 * halvtredsører er en krone. To kroner plus to kroner giver fire kroner. De to halvtredsører giver en krone
 * mere. Det er fem kroner." The picture counts the money up, biggest first.
 */
function hint(f: Fact, tag: string | null): HintSpec {
  const { family, p, total } = parse(f)
  const kr = p - 50
  const pieces = family === 'fiftiesInKroner' ? Array<number>(p / 50).fill(50) : family === 'addHalves' ? [...fewest(p), ...fewest(p)] : fewest(p)
  const standard: SpeechPart[] =
    family === 'readAmount'
      ? [say('hint.kronerOre.comma'), say('hint.kronerOre.first'), moneySays(kr, 'mid'), say('hint.kronerOre.thenFifty')]
      : family === 'fiftiesInKroner'
        ? [say('hint.kronerOre.twoFifties'), num(p / 50, 'mid'), say('noun.coin.50.pl.mid'), say('hint.change.is'), moneySays(p, 'end')]
        : [
            say('hint.kronerOre.twoFifties'), moneySays(kr, 'mid'), say('op.plus'), moneySays(kr, 'mid'), say('op.giver'), moneySays(2 * kr, 'end'),
            say('hint.kronerOre.oneMore'), say('frag.det_er'), moneySays(total, 'end'),
          ]
  const visual: HintSpec['visual'] = { scene: 'coinsSum', ore: pieces }
  if (tag === 'coinsAsCount') return hintOf([say('hint.countCoins.notTheCoins'), ...standard], visual, tag)
  return hintOf(tag === 'near' ? [say('hint.pay.countAgain'), ...standard] : standard, visual)
}

export default {
  ...meta,
  kinds: ['choice', 'pay'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id, rng), avoid),
  answer: answerOf,
  answerTypeFor: (f: Fact, kind: TaskKind) => (typeof answerOf(f, kind) === 'string' ? 'set' : 'ore'),
  answerType: () => 'ore',
  prompt(f: Fact): Prompt {
    const { family, p } = parse(f)
    return family === 'fiftiesInKroner' ? { scene: 'coins', ore: Array<number>(p / 50).fill(50) } : { scene: 'shop', thing: goodsFor(f.id, p), priceOre: p, purse: [...PURSE] }
  },
  optionView: (f: Fact) => (parse(f).family === 'readAmount' ? 'coins' : 'amount'),
  range: () => [0, 10000],
  speech(f: Fact, kind: TaskKind): SpeechPart[] {
    const { family, p } = parse(f)
    const pay = kind === 'pay'
    if (family === 'readAmount') return [say(pay ? 'frag.betal' : 's.payExact.whichMoney'), moneySays(p, 'end')]
    if (family === 'fiftiesInKroner') return [say('s.countCoins.howMuch'), ...(pay ? [say('s.kronerOre.payInKroner')] : [])]
    return [say('s.money.itCosts'), moneySays(p, 'end'), say(pay ? 's.kronerOre.payTwo' : 's.kronerOre.askTwo')]
  },
  candidates,
  hint: (f, tag) => hint(f, tag),
  fastMs: (_f: Fact, kind: TaskKind) => (kind === 'choice' ? 9_000 : undefined),
} satisfies SkillModule
