// Spoken money (SPEC §10.1). Amounts are in øre: 1250 → "tolv kroner og halvtreds øre",
// 100 → "en krone", 50 → "halvtreds øre", 10000 → "et hundrede kroner".
//
// "krone" is common gender, so 1 is "en". A standalone final "en" keeps the noun singular
// ("et hundrede og en krone", like "tusind og én nat"); a compound takes plural ("enogtyve kroner").
import type { ClipId, SpeechForm } from '../engine/types'
import { numberClips, numberWords } from './numberWords'

/** Coins and notes in øre (SPEC §2.2, money domain). */
export const COINS = [50, 100, 200, 500, 1000, 2000] as const
export const NOTES = [5000, 10000, 20000, 50000] as const
export type Denomination = (typeof COINS)[number] | (typeof NOTES)[number]
export const DENOMINATIONS: readonly Denomination[] = [...COINS, ...NOTES]

/** Singular after a number ending in a standalone "en": 1, 101, 201 … (not 21, 31 …). */
function singularKrone(kroner: number): boolean {
  return kroner === 1 || (kroner > 100 && kroner % 100 === 1)
}

export function moneyWords(ore: number): string {
  const total = Math.max(0, Math.round(ore))
  const kr = Math.floor(total / 100)
  const o = total % 100
  const krone = (k: number) => `${numberWords(k, 'c')} ${singularKrone(k) ? 'krone' : 'kroner'}`
  if (kr > 0 && o > 0) return `${krone(kr)} og ${numberWords(o, 'c')} øre`
  if (kr > 0) return krone(kr)
  if (o > 0) return `${numberWords(o, 'c')} øre`
  return 'nul kroner'
}

/**
 * Clip ids: the number in mid form followed by a unit noun in the requested form
 * (`noun.unit.krone|kroner|ore.<form>`), or "kroner og" (`noun.unit.kroner_og`) between the parts.
 */
export function moneyClips(ore: number, form: SpeechForm): ClipId[] {
  const total = Math.max(0, Math.round(ore))
  const kr = Math.floor(total / 100)
  const o = total % 100
  const kroneNoun = (k: number) => (singularKrone(k) ? 'krone' : 'kroner')
  if (kr > 0 && o > 0) {
    return [
      ...numberClips(kr, 'mid', 'c'),
      `noun.unit.${kroneNoun(kr)}_og`,
      ...numberClips(o, 'mid', 'c'),
      `noun.unit.ore.${form}`,
    ]
  }
  if (kr > 0) return [...numberClips(kr, 'mid', 'c'), `noun.unit.${kroneNoun(kr)}.${form}`]
  if (o > 0) return [...numberClips(o, 'mid', 'c'), `noun.unit.ore.${form}`]
  return ['n.mid.0', `noun.unit.kroner.${form}`]
}

// ─── Coin and note names ───────────────────────────────────────────────────

export type CoinCase = 'indef' | 'def' | 'pl'

/** Stem, definite suffix and plural for each denomination. */
const COIN_WORDS: Readonly<Record<Denomination, readonly [indef: string, def: string, pl: string]>> = {
  50: ['halvtredsøre', 'halvtredsøren', 'halvtredsører'],
  100: ['enkrone', 'enkronen', 'enkroner'],
  200: ['tokrone', 'tokronen', 'tokroner'],
  500: ['femkrone', 'femkronen', 'femkroner'],
  1000: ['tikrone', 'tikronen', 'tikroner'],
  2000: ['tyvekrone', 'tyvekronen', 'tyvekroner'],
  5000: ['halvtredskroneseddel', 'halvtredskronesedlen', 'halvtredskronesedler'],
  10000: ['hundredkroneseddel', 'hundredkronesedlen', 'hundredkronesedler'],
  20000: ['tohundredkroneseddel', 'tohundredkronesedlen', 'tohundredkronesedler'],
  50000: ['femhundredkroneseddel', 'femhundredkronesedlen', 'femhundredkronesedler'],
}

export function isDenomination(ore: number): ore is Denomination {
  return (DENOMINATIONS as readonly number[]).includes(ore)
}

/** "en tyvekrone" (indef, with article), "tyvekronen" (def), "tyvekroner" (pl). */
export function coinWords(ore: Denomination, kind: CoinCase): string {
  const [indef, def, pl] = COIN_WORDS[ore]
  return kind === 'indef' ? `en ${indef}` : kind === 'def' ? def : pl
}

/** `noun.coin.<ore>.<indef|def|pl>.<form>`. */
export function coinClip(ore: Denomination, kind: CoinCase, form: SpeechForm): ClipId {
  return `noun.coin.${ore}.${kind}.${form}`
}
