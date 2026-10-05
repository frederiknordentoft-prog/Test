// Independent oracles for kronerOre (Kroner og øre, 3. klasse), ORK3c, beside the wave-2 money oracle (money.oracle.ts)
// for the 3. klasse families Markedet plays of payExact (fewestCoins) and change (from100). Written by another agent
// than the generators (SPEC A5, §15.1): every right answer is worked out here from what the child is given — the
// price tag and the price said, the halvtredsører on the table, "to af dem" — and never from the generator code.
// Amounts are øre (SPEC §3.1); a tray hands in its sum (any exact payment is right) or, for fewestCoins, its coins.
// Wrong amounts are explained with pædagogik §3.2's formulas: coinsAsCount ("antal mønter": six halvtredsører taken
// as six kroner) where the child counts coins (fiftiesInKroner); the catalogue has nothing for reading or adding øre,
// so every other wrong amount is plain — the price of one (addHalves) and the number on a coin (50 øre) are numbers
// from the question. The registry skips *.oracle.ts files, so none of this reaches the app.
import type { AnswerValue, Prompt, Task } from '../../types'
import { amountsIn, coinWord, setPieces } from './money.oracle'
import { fewestCount, type WhyC } from '../clock/clock3.oracle'

/** The shop's coins with the halvtredsøre (SPEC §2.2 money: coins 50 øre – 20 kr; a price under 50 kr needs no note). */
export const SHOP_COINS: readonly number[] = [2000, 1000, 500, 200, 100, 50]

export interface KronerOre {
  family: 'readAmount' | 'fiftiesInKroner' | 'addHalves'
  /** The price on the tag (readAmount, addHalves) or what the coins on the table are worth (fiftiesInKroner), in øre. */
  ore: number
  /** What the task asks for: the price, the coins' worth, or two of the thing. */
  total: number
}

/**
 * kro:<family>:<øre> (pædagogik §1.3): readAmount a price with 50 øre, 1,50–49,50 kr; fiftiesInKroner 4–20 halvtredsører
 * (2–10 kr); addHalves a price with 50 øre, 1,50–24,50 kr, of which two are bought (2,50 + 2,50).
 */
export function kronerOreOf(id: string): KronerOre | null {
  const m = /^kro:(readAmount|fiftiesInKroner|addHalves):(\d+)$/.exec(id)
  if (!m) return null
  const ore = Number(m[2])
  const family = m[1] as KronerOre['family']
  if (family === 'fiftiesInKroner') return ore % 100 === 0 && ore >= 200 && ore <= 1000 ? { family, ore, total: ore } : null
  const top = family === 'readAmount' ? 4950 : 2450
  return ore % 100 === 50 && ore >= 150 && ore <= top ? { family, ore, total: family === 'addHalves' ? 2 * ore : ore } : null
}

/**
 * What the child hears and sees, worked out: "Betal tolv kroner og halvtreds øre." / "Hvilke penge er præcis …?" (the
 * price), "Hvor mange penge er der?" over halvtredsører on the table ("… Betal det samme med kroner." on the purse),
 * "Det koster to kroner og halvtreds øre. Hvad koster to af dem?" / "… Betal for to af dem." (two of the price).
 */
export function askedKronerOre(text: string, p: Prompt): { family: KronerOre['family']; ore: number; total: number; pay: boolean } | null {
  let m = /^(Betal|Hvilke penge er præcis) (.+?)[.?]$/.exec(text)
  if (m && p.scene === 'shop') {
    const a = amountsIn(m[2])
    return a.length === 1 && a[0] === p.priceOre ? { family: 'readAmount', ore: a[0], total: a[0], pay: m[1] === 'Betal' } : null
  }
  if ((text === 'Hvor mange penge er der?' || text === 'Hvor mange penge er der? Betal det samme med kroner.') && p.scene === 'coins') {
    const sum = p.ore.reduce((s, x) => s + x, 0)
    return { family: 'fiftiesInKroner', ore: sum, total: sum, pay: text.endsWith('kroner.') }
  }
  m = /^Det koster (.+?)\. (Hvad koster to af dem\?|Betal for to af dem\.)$/.exec(text)
  if (m && p.scene === 'shop') {
    const a = amountsIn(m[1])
    return a.length === 1 && a[0] === p.priceOre ? { family: 'addHalves', ore: a[0], total: 2 * a[0], pay: m[2].startsWith('Betal') } : null
  }
  return null
}

/** pædagogik §3.2 coinsAsCount and the numbers of the question, for a wrong amount (øre). */
export function explainKronerOre(q: KronerOre, coins: number, v: number): WhyC {
  if (q.family === 'fiftiesInKroner') return { mis: coins !== q.total / 100 && v === coins * 100 ? ['coinsAsCount'] : [], operand: v === 50 }
  if (q.family === 'addHalves') return { mis: [], operand: v === q.ore }
  return { mis: [] }
}

/** The amount a coin-set card or tray pays (null when a token is no coin or note). */
export const setAmount = (v: AnswerValue): number | null => {
  const ps = setPieces(v)
  return ps ? ps.reduce((s, x) => s + x, 0) : null
}

/** Some different exact ways to pay an amount from the purse: the fewest, halvtredsører for the øre, a krone broken into halves. */
export function exactTraysC(ore: number, purse: readonly number[]): number[][] {
  const out: number[][] = []
  const greedy = (left: number, from: readonly number[]): number[] | null => {
    const got: number[] = []
    for (const c of [...from].sort((a, b) => b - a)) while (left >= c) (got.push(c), (left -= c))
    return left === 0 ? got : null
  }
  const fewest = greedy(ore, purse)
  if (fewest && fewest.length === fewestCount(ore, purse)) out.push(fewest)
  if (purse.includes(50) && ore >= 100) {
    const halves = greedy(ore - 100, purse)
    if (halves) out.push([...halves, 50, 50])
  }
  if (purse.includes(100) && ore >= 200) {
    const ones = greedy(ore - 200, purse)
    if (ones) out.push([...ones, 100, 100])
  }
  return out.filter((t) => t.length <= 24)
}

/** "Seks halvtredsører er tre kroner." · "To halvtredsører er en krone.": coins named and what they are said to be worth. */
export function coinStatement(sentence: string): { coins: number; piece: number; said: number } | null {
  const m = /^([a-zæøå]+) ([a-zæøå]+) er (.+)\.$/i.exec(sentence)
  if (!m) return null
  const piece = coinWord(m[2])
  const count = (w: string) => ({ en: 1, et: 1, to: 2, tre: 3, fire: 4, fem: 5, seks: 6, syv: 7, otte: 8, ni: 9, ti: 10, elleve: 11, tolv: 12, tretten: 13, fjorten: 14, femten: 15, seksten: 16, sytten: 17, atten: 18, nitten: 19, tyve: 20 } as Record<string, number>)[w.toLowerCase()]
  const said = amountsIn(m[3])
  return piece && count(m[1]) !== undefined && said.length === 1 ? { coins: count(m[1]), piece: piece.ore, said: said[0] } : null
}

/** A shop or coins prompt's money, as drawn: the price tag's text, or the coins on the table. */
export const shopPrice = (p: Prompt): number | null => (p.scene === 'shop' ? p.priceOre : null)

/** Tasks of kronerOre answered with a coin set (readAmount's cards) and with an amount (the rest). */
export const isSetTask = (t: Task): boolean => t.answerType === 'set'
