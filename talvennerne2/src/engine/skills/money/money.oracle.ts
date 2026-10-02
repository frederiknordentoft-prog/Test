// Independent oracles for the money skills of 1.–2. klasse (coinNames, countCoins, payExact, change).
// Written by another agent than the generators (SPEC A5, §15.1): every right answer is worked out here
// from what the child is given — the fact id, the coins in the picture, the price and the spoken
// question — and never from the generator code. Amounts are øre (SPEC §3.1); a keypad takes kroner.
// The registry skips *.oracle.ts files, so none of this reaches the app.
import type { AnswerValue, MisconceptionId, Prompt, Task } from '../../types'
import { numbersIn } from '../number/number2.oracle'
import { typedSwap, type WhyB } from '../clock/clock.oracle'

// ─── Coins and notes ────────────────────────────────────────────────────────

/** Danish coins (50 øre – 20 kr) and the play notes (50 – 500 kr), in øre. */
export const COINS_ORE = [50, 100, 200, 500, 1000, 2000] as const
export const NOTES_ORE = [5000, 10000, 20000, 50000] as const
export const PIECES_ORE: readonly number[] = [...COINS_ORE, ...NOTES_ORE]
export const isPiece = (ore: number): boolean => PIECES_ORE.includes(ore)
export const isCoin = (ore: number): boolean => (COINS_ORE as readonly number[]).includes(ore)

const STEMS: Readonly<Record<string, number>> = {
  halvtredsør: 50, enkron: 100, tokron: 200, femkron: 500, tikron: 1000, tyvekron: 2000,
  halvtredskronesed: 5000, hundredkronesed: 10000, hundredekronesed: 10000, tohundredkronesed: 20000,
  tohundredekronesed: 20000, femhundredkronesed: 50000, femhundredekronesed: 50000,
}

export type CoinCase = 'indef' | 'def' | 'pl'

/**
 * A coin or note named the Danish way: "femkrone" / "femkronen" / "femkroner", "halvtredsøre",
 * "hundredkroneseddel" / "-sedlen" / "-sedler" → its value in øre and its form.
 */
export function coinWord(word: string): { ore: number; form: CoinCase } | null {
  const w = word.toLowerCase()
  const forms: readonly [RegExp, CoinCase][] = [
    [/^(.+kron)e$/, 'indef'], [/^(.+kron)en$/, 'def'], [/^(.+kron)er$/, 'pl'],
    [/^(halvtredsør)e$/, 'indef'], [/^(halvtredsør)en$/, 'def'], [/^(halvtredsør)er$/, 'pl'],
    [/^(.+kronesed)del$/, 'indef'], [/^(.+kronesed)len$/, 'def'], [/^(.+kronesed)ler$/, 'pl'],
  ]
  for (const [re, form] of forms) {
    const m = re.exec(w)
    if (m && m[1] in STEMS) return { ore: STEMS[m[1]], form }
  }
  return null
}

/** The coins and notes a sentence names, in order. */
export const coinsNamed = (text: string): { ore: number; form: CoinCase }[] =>
  text.toLowerCase().split(/[^a-zæøå]+/).flatMap((w) => {
    const c = coinWord(w)
    return c ? [c] : []
  })

/** A piece token: 'c500', also with leading zeros for a second card of the same coin ('c0500'). */
export function tokenPiece(token: AnswerValue): number | null {
  const m = typeof token === 'string' ? /^c0*([1-9]\d*)$/.exec(token) : null
  return m && isPiece(Number(m[1])) ? Number(m[1]) : null
}

/** The pieces of a coin-set answer ('c2000|c500' → [2000, 500]); null when a token is no piece. */
export function setPieces(value: AnswerValue): number[] | null {
  if (typeof value !== 'string' || value === '') return null
  const ps = value.split('|').map(tokenPiece)
  return ps.every((p) => p !== null) ? (ps as number[]) : null
}

const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0)

/**
 * Every way to pay `ore` with the fewest pieces from the purse (each piece as often as needed), as
 * multisets largest first. Worked out by counting, not greedily, so a purse without 1 kr still finds 2 + 2 + 2.
 */
export function fewestWays(ore: number, purse: readonly number[]): number[][] {
  const kinds = [...new Set(purse)].sort((a, b) => b - a)
  let best = Infinity
  let ways: number[][] = []
  const walk = (i: number, left: number, acc: number[]) => {
    if (acc.length > best) return
    if (left === 0) {
      if (acc.length < best) {
        best = acc.length
        ways = []
      }
      ways.push([...acc])
      return
    }
    if (i === kinds.length) return
    const v = kinds[i]
    for (let n = Math.floor(left / v); n >= 0; n--) walk(i + 1, left - n * v, [...acc, ...Array.from({ length: n }, () => v)])
  }
  walk(0, ore, [])
  return ways
}

export const setToken = (pieces: readonly number[]): string => [...pieces].sort((a, b) => b - a).map((p) => `c${p}`).join('|')

// ─── Amounts as said ───────────────────────────────────────────────────────

/**
 * The amounts a sentence says, in øre: "sytten kroner" 1700, "en krone" 100, "halvtreds øre" 50,
 * "tolv kroner og halvtreds øre" 1250, "et hundrede kroner" 10000.
 */
export function amountsIn(text: string): number[] {
  const out: number[] = []
  const re = /((?:[a-zæøå]+ )*?)(kroner|krone|øre)(?: og ((?:[a-zæøå]+ )*?)øre)?(?=[\s.,?!]|$)/g
  const lower = text.toLowerCase()
  for (const m of lower.matchAll(re)) {
    const lead = numbersIn(m[1])
    const n = lead.length > 0 ? lead[lead.length - 1] : null
    if (n === null) continue
    if (m[2] === 'øre') out.push(n)
    else out.push(n * 100 + (m[3] !== undefined ? (numbersIn(m[3])[0] ?? 0) : 0))
  }
  return out
}

// ─── coinNames ──────────────────────────────────────────────────────────────

/** mnt:<øre> → the piece; family coins (50 øre – 20 kr) or notes (50 – 500 kr). */
export function coinNamesOracle(id: string): { family: string; answer: number } | null {
  const m = /^mnt:(\d+)$/.exec(id)
  const ore = m ? Number(m[1]) : NaN
  return isPiece(ore) ? { family: isCoin(ore) ? 'coins' : 'notes', answer: ore } : null
}

/** "Tryk på femkronen." (one piece, definite) · "Tryk på alle femkroner." (all of them, plural). */
export function askedPiece(text: string, kind: string): number | null {
  const m = kind === 'multiSelect' ? /^Tryk på alle ([a-zæøå]+)\.$/.exec(text) : /^Tryk på ([a-zæøå]+)\.$/.exec(text)
  const c = m ? coinWord(m[1]) : null
  return c && c.form === (kind === 'multiSelect' ? 'pl' : 'def') ? c.ore : null
}

// ─── countCoins ─────────────────────────────────────────────────────────────

export interface Pile {
  family: string
  /** Kroner, in the order the coins lie. */
  coins: number[]
}

/** tael:<family>:<kr+kr+…>: the coins in kroner as they lie. */
export function parsePile(id: string): Pile | null {
  const m = /^tael:(sameCoins|mixedTo20|mixedTo100|biggestFirst):(\d+(?:\+\d+)*)$/.exec(id)
  return m ? { family: m[1], coins: m[2].split('+').map(Number) } : null
}

/**
 * pædagogik §1.3: sameCoins one kind of coin (≤ 20 kr), mixedTo20 two kinds or more up to 20 kr,
 * mixedTo100 up to 100 kr, biggestFirst up to 100 kr lying so that starting with the biggest means
 * looking for it (not already biggest first). Whole-krone coins only: the keypad takes kroner.
 */
export function pileProblems(p: Pile): string[] {
  const out: string[] = []
  const total = sum(p.coins)
  const kinds = new Set(p.coins).size
  if (!p.coins.every((c) => isCoin(c * 100) && c >= 1)) out.push(`coins ${p.coins} are not all whole-krone coins`)
  if (p.coins.length < 2) out.push('fewer than two coins')
  const sorted = p.coins.every((c, i) => i === 0 || p.coins[i - 1] >= c)
  switch (p.family) {
    case 'sameCoins':
      if (kinds !== 1 || total > 20) out.push(`sameCoins with ${kinds} kinds, ${total} kr`)
      break
    case 'mixedTo20':
      if (kinds < 2 || total > 20) out.push(`mixedTo20 with ${kinds} kinds, ${total} kr`)
      break
    case 'mixedTo100':
      if (kinds < 2 || total > 100) out.push(`mixedTo100 with ${kinds} kinds, ${total} kr`)
      break
    case 'biggestFirst':
      if (kinds < 2 || total > 100 || sorted) out.push(`biggestFirst ${p.coins} (${total} kr) already lies biggest first or is too much`)
      break
  }
  return out
}

/**
 * A wrong amount for a pile: the number of coins (coinsAsCount, pædagogik §3.2: 10 + 5 + 2 kr → 3) unless
 * it happens to be the amount; the number on one of the coins ('operand'); a typed amount with its kroner
 * digits swapped (SPEC §4.1). A9: the number of coins that is also the number on a coin is 'ambiguous'.
 */
export function explainPile(p: Pile, task: Task, v: number): WhyB {
  const total = sum(p.coins)
  const mis: MisconceptionId[] = []
  if (p.coins.length !== total && v === p.coins.length * 100) mis.push('coinsAsCount')
  return { mis, operand: p.coins.some((c) => c * 100 === v), swap: typedSwap(task, v, p.coins) }
}

// ─── payExact ───────────────────────────────────────────────────────────────

export interface Purchase {
  family: string
  price: number
}

/** pay:<family>:<øre>: to20 (≤ 20 kr), to50 (21–50), to100 (51–100), fewestCoins (≤ 100, as few pieces as possible). */
export function parsePurchase(id: string): Purchase | null {
  const m = /^pay:(to20|to50|to100|fewestCoins):(\d+)$/.exec(id)
  if (!m) return null
  const price = Number(m[2])
  const kr = price / 100
  const fits = { to20: kr >= 1 && kr <= 20, to50: kr > 20 && kr <= 50, to100: kr > 50 && kr <= 100, fewestCoins: kr >= 1 && kr <= 100 }[m[1]]
  return Number.isInteger(kr) && fits ? { family: m[1], price } : null
}

/** "Betal sytten kroner." / "Hvilke penge er præcis sytten kroner?" (fewestCoins: "… med så få mønter og sedler som muligt.") → the amount. */
export function priceAsked(text: string): { price: number; fewest: boolean } | null {
  const pay = /^Betal (.+?)( med så få mønter og sedler som muligt)?\.$/.exec(text)
  const pick = /^Hvilke penge er præcis (.+?)( med færrest mønter og sedler)?\?$/.exec(text)
  const m = pay ?? pick
  if (!m) return null
  const a = amountsIn(m[1])
  return a.length === 1 ? { price: a[0], fewest: m[2] !== undefined } : null
}

// ─── change ─────────────────────────────────────────────────────────────────

export interface Sale {
  family: string
  price: number
  paid: number
}

const PAID: Readonly<Record<string, number>> = { from10: 1000, from20: 2000, from50: 5000, from100: 10000 }

/** byt:<family>:<price øre>, paid with a 10- or 20-krone coin, a 50- or 100-krone note. */
export function parseSale(id: string): Sale | null {
  const m = /^byt:(from10|from20|from50|from100):(\d+)$/.exec(id)
  if (!m) return null
  const price = Number(m[2])
  const paid = PAID[m[1]]
  return price > 0 && price < paid && price % 100 === 0 ? { family: m[1], price, paid } : null
}

/** "Det koster tretten kroner. Du betaler med en tyvekrone. …" → what it costs and what is paid with. */
export function saleAsked(text: string): { price: number; paid: number } | null {
  const m = /^Det koster (.+?)\. Du betaler med en ([a-zæøå]+)\. (Hvor mange penge får du tilbage\?|Læg byttepengene i bakken\.)$/.exec(text)
  if (!m) return null
  const a = amountsIn(m[1])
  const c = coinWord(m[2])
  return a.length === 1 && c && c.form === 'indef' ? { price: a[0], paid: c.ore } : null
}

/** pædagogik §3.2 digitComplement10 ("100−37→73"): each digit of the price made up to ten (null with a 0 digit). */
export function digitComplementKr(priceKr: number): number | null {
  const t = Math.floor(priceKr / 10)
  const o = priceKr % 10
  return priceKr >= 11 && priceKr <= 99 && t > 0 && o > 0 ? 10 * (10 - t) + (10 - o) : null
}

/**
 * A wrong amount of change: the price and what was paid added (wrongOperation, "modsat regneart"); from a
 * hundred, the price made up digit by digit (digitComplement10, the 100 − 37 → 73 idea); the price or
 * what was paid ('operand'); a typed amount with its kroner digits swapped. A9: a misconception value
 * that is also the price is 'ambiguous'.
 */
export function explainChange(s: Sale, task: Task, v: number): WhyB {
  const mis: MisconceptionId[] = []
  if (v === s.price + s.paid) mis.push('wrongOperation')
  const comp = s.paid === 10000 ? digitComplementKr(s.price / 100) : null
  if (comp !== null && v === comp * 100) mis.push('digitComplement10')
  return { mis, operand: v === s.price || v === s.paid, swap: typedSwap(task, v, [s.price / 100, s.paid / 100]) }
}

// ─── Shop scenes ────────────────────────────────────────────────────────────

/** The shop prompt, or null. */
export const shopOf = (p: Prompt): Extract<Prompt, { scene: 'shop' }> | null => (p.scene === 'shop' ? p : null)

/** Some different exact ways to pay an amount from a purse: the fewest, all of the smallest piece, one big piece broken up. */
export function exactTrays(ore: number, purse: readonly number[]): number[][] {
  const out: number[][] = []
  const ways = fewestWays(ore, purse)
  if (ways.length > 0) out.push(ways[0])
  const small = Math.min(...purse)
  if (ore % small === 0 && ore / small <= 24) out.push(Array.from({ length: ore / small }, () => small))
  if (ways.length > 0 && ways[0].length > 0) {
    const [big, ...rest] = ways[0]
    const smaller = purse.filter((p) => p < big)
    const broken = smaller.length > 0 ? fewestWays(big, smaller)[0] : undefined
    if (broken) out.push([...rest, ...broken])
  }
  return out.filter((t) => sum(t) === ore && t.length <= 24)
}
