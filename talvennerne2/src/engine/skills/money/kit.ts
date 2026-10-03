// Shared by the money skills of 1.–2. klasse (coinNames, countCoins, payExact, change): coins and notes,
// coin-set tokens, the fewest pieces for an amount, the goods in the shop and the spoken amounts.
// No SkillDef default export, so the registry skips it.
//
// Answer model (SPEC §3.1): amounts are øre. A keypad takes whole kroner only (entryScale 100, the
// task builder refuses anything else), so countCoins and change never ask for øre. A coin set is
// a set answer: tokens `c<øre>` joined by '|', largest first ('c2000|c500|c200'), the order the pay
// view hands in its tray, so a tray's tokens look up the same distractor tag.
import type { SpeechForm, SpeechPart } from '../../types'
import { hashSeed } from '../../rng'
import { coinClip, type CoinCase, type Denomination } from '../../../speech/money'
import { num, say } from '../number/kit'

/** Danish coins and play notes in øre (SPEC §2.2, money domain); there is no 1000-krone note. */
export const COINS = [50, 100, 200, 500, 1000, 2000] as const
export const NOTES = [5000, 10000, 20000, 50000] as const
export const isCoin = (ore: number): boolean => (COINS as readonly number[]).includes(ore)

/** Whole-krone coins, largest first. */
export const KRONE_COINS = [2000, 1000, 500, 200, 100] as const

export const desc = (a: number, b: number): number => b - a
export const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0)

/**
 * The token of one coin or note. `copy` > 0 writes the same piece with leading zeros (`c0500`), so
 * several five-krone coins can be several cards of one multiSelect: every option is its own token,
 * and the views and the pay tray read the number (`c0500` is still the five-krone coin).
 */
export const pieceToken = (ore: number, copy = 0): string => `c${'0'.repeat(copy)}${ore}`

/** The value of a token ('c0500' → 500). */
export const pieceOf = (token: string): number => Number(token.slice(1))

/** A coin set as the answer token: largest first, joined by '|'. */
export const coinSet = (pieces: readonly number[]): string => [...pieces].sort(desc).map((p) => pieceToken(p)).join('|')

/**
 * The fewest pieces from `purse` that make `ore` exactly, largest first (null when it cannot).
 * Danish denominations are canonical, but this is exact for any purse (a dynamic programme).
 */
export function fewestPieces(ore: number, purse: readonly number[]): number[] | null {
  if (!Number.isInteger(ore) || ore < 0 || ore % 50 !== 0) return null
  const n = ore / 50
  const kinds = [...new Set(purse)].filter((v) => v % 50 === 0).sort(desc)
  const best = new Array<number>(n + 1).fill(Infinity)
  const last = new Array<number>(n + 1).fill(0)
  best[0] = 0
  for (let i = 1; i <= n; i++) {
    for (const v of kinds) {
      const k = v / 50
      if (k <= i && best[i - k] + 1 < best[i]) {
        best[i] = best[i - k] + 1
        last[i] = v
      }
    }
  }
  if (!Number.isFinite(best[n])) return null
  const out: number[] = []
  for (let i = n; i > 0; i -= last[i] / 50) out.push(last[i])
  return out.sort(desc)
}

/** Sums after each piece: [20, 20, 5, 2] → [20, 40, 45, 47] (kroner when the pieces are). */
export function runningTotals(pieces: readonly number[]): number[] {
  let s = 0
  return pieces.map((p) => (s += p))
}

// ─── The shop ───────────────────────────────────────────────────────────────

/** Things the shop sells (src/art/materials/Things.tsx); one per instance, from its id. */
export const GOODS = ['apple', 'strawberry', 'carrot', 'fish', 'ball', 'flower', 'mushroom', 'star'] as const
export type Good = (typeof GOODS)[number]

/**
 * What each thing can believably cost, in whole kroner (QA2 P3-4: a carrot for 90 kr). A child knows
 * that a carrot or an apple costs a few kroner and a ball or a fish a lot more; the price on the tag
 * is the fact's own, so only the thing beside it is chosen to fit.
 */
export const GOOD_PRICE_KR: Readonly<Record<Good, readonly [number, number]>> = {
  carrot: [1, 5],
  apple: [2, 8],
  strawberry: [2, 9],
  mushroom: [3, 15],
  flower: [10, 45],
  star: [10, 60],
  ball: [15, 99],
  fish: [30, 99],
}

/** The thing on the shop's counter for a price: one that believably costs it, picked from the id. */
export function goodsFor(id: string, priceOre: number): Good {
  const kr = priceOre / 100
  const fits = GOODS.filter((g) => GOOD_PRICE_KR[g][0] <= kr && kr <= GOOD_PRICE_KR[g][1])
  const from = fits.length > 0 ? fits : GOODS
  return from[hashSeed(id) % from.length]
}

// ─── Speech ─────────────────────────────────────────────────────────────────

/** "sytten kroner", "halvtreds øre". */
export const moneySays = (ore: number, form: SpeechForm = 'end'): SpeechPart => ({ money: { ore, form } })

/** "en tyvekrone", "femkronen", "femkroner". */
export const coinSays = (ore: number, kind: CoinCase, form: SpeechForm = 'end'): SpeechPart => say(coinClip(ore as Denomination, kind, form))

/**
 * Counting money up, biggest first: the running totals in kroner, then the amount ("Tyve fyrre
 * femogfyrre syvogfyrre. Det er syvogfyrre kroner."). One piece is just "Det er fem kroner."
 */
export function countUpSpeech(piecesOre: readonly number[]): SpeechPart[] {
  const sorted = [...piecesOre].sort(desc)
  const totals = runningTotals(sorted.map((p) => p / 100))
  const said: SpeechPart[] = []
  if (totals.length > 1) totals.forEach((t, i) => said.push(num(t, i === totals.length - 1 ? 'end' : 'mid')))
  return [...said, say('frag.det_er'), moneySays(sum(piecesOre), 'end')]
}

/**
 * Guess rate of a keypad answer in whole kroner (Task.guessFloor): one in the number of kroner the
 * keypad can take. The kind's own 1/(range size) counts øre, which no child can type.
 */
export const kronerGuess = (rangeOre: readonly [number, number]): number => 1 / (Math.floor(rangeOre[1] / 100) - Math.ceil(rangeOre[0] / 100) + 1)
