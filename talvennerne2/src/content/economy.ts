// The economy (SPEC §5.7): every number the meta layer pays out or charges, in one pure file.
// Nothing here knows about time — no clock, no calendar, no offers that run out (SPEC §13.3; a scan
// keeps the date API out of this file). Prices are fixed integers from the catalogue.
//
// Perler can only be earned by doing maths, never bought or exchanged. The constants below may be
// tuned within ±20 % of SPEC §5.7 to meet the nine acceptance checks in src/meta/economy.sim.test.ts;
// a value that differs from the SPEC table says so in its comment.
import { DECOR, ITEMS, PRICE_BY_SLOT, RECOLOR_PRICE } from './catalog'
import type { Medal } from '../engine/types'

// ─── Perler and XP per event ────────────────────────────────────────────────

/** Perler per event. */
export const PERLER = {
  /** Every right answer, retries and helped answers included. */
  correct: 1,
  /** A new star on a node, by star level (★1, ★2, ★3), the first time only. */
  star: [0, 1, 1, 2] as readonly number[],
  /** Mastery spark: a key reaches box 3 or box 5. */
  spark3: 1,
  spark5: 2,
  /** The golden egg caught. */
  golden: 2,
  /** A mastery trial passed for the first time (SPEC 10, −20 %: the shop must last past session 100). */
  trial: 8,
  /** A world finale passed (SPEC 25, −20 %). */
  finale: 20,
  /** Every level-up. */
  levelUp: 5,
  /** Bronze 3, silver 4, gold 8 (SPEC 3 / 5 / 10; silver and gold −20 %). */
  medal: { bronze: 3, silver: 4, gold: 8 } as Readonly<Record<Medal, number>>,
  /** A gold medal when the four golden animals of its world are already owned or waiting (SPEC 10, −20 %). */
  allGolden: 8,
} as const

/** XP per event. Level-ups and trophies give no XP. */
export const XP = {
  correct: 10,
  /** Per new star. */
  star: 20,
  spark3: 25,
  spark5: 50,
  golden: 10,
  trial: 100,
  finale: 250,
  medal: { bronze: 50, silver: 100, gold: 200 } as Readonly<Record<Medal, number>>,
} as const

// ─── Levels ─────────────────────────────────────────────────────────────────

export const MAX_LEVEL = 50

/** XP from level L to L + 1, for L = 1 … 49 (index 0 is level 1). */
export const XP_TO_NEXT: readonly number[] = [
  150, 250, 300, 450,
  ...Array<number>(5).fill(500),
  ...Array<number>(10).fill(1000),
  ...Array<number>(10).fill(2800),
  ...Array<number>(20).fill(6400),
]

/** Total XP at which `level` is reached (level 1 = 0, level 5 = 1 150, level 50 = 169 650). */
export function xpForLevel(level: number): number {
  let total = 0
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) total += XP_TO_NEXT[l - 1]
  return total
}

/** The level a child with `xp` has reached. */
export function levelForXp(xp: number): number {
  let level = 1
  let need = 0
  while (level < MAX_LEVEL) {
    need += XP_TO_NEXT[level - 1]
    if (xp < need) break
    level++
  }
  return level
}

/** Share of the way from the current level to the next (0–1), for the XP ring. */
export function levelProgress(xp: number): number {
  const level = levelForXp(xp)
  if (level >= MAX_LEVEL) return 1
  const from = xpForLevel(level)
  return (xp - from) / XP_TO_NEXT[level - 1]
}

export interface TitleDef { level: number; title: string; clip: string }

export const TITLES: readonly TitleDef[] = [
  { level: 1, title: 'Nybegynder', clip: 's.reward.title.1' },
  { level: 5, title: 'Opdager', clip: 's.reward.title.5' },
  { level: 10, title: 'Eventyrer', clip: 's.reward.title.10' },
  { level: 15, title: 'Talspejder', clip: 's.reward.title.15' },
  { level: 20, title: 'Regnemester', clip: 's.reward.title.20' },
  { level: 30, title: 'Talmagiker', clip: 's.reward.title.30' },
  { level: 40, title: 'Stjerneregner', clip: 's.reward.title.40' },
  { level: 50, title: 'Talvenne-legende', clip: 's.reward.title.50' },
]

export function titleFor(level: number): TitleDef {
  let out = TITLES[0]
  for (const t of TITLES) if (t.level <= level) out = t
  return out
}

/** The title that starts exactly at `level`, or null. */
export const titleAt = (level: number): TitleDef | null => TITLES.find((t) => t.level === level) ?? null

// ─── Prices (fixed, no rotation, no sales) ─────────────────────────────────

export { PRICE_BY_SLOT, RECOLOR_PRICE }
/** Extra colours per owned item (colourway 1 and 2). */
export const RECOLORS_PER_ITEM = 2

const SHOP_ITEMS = ITEMS.filter((i) => i.source.kind === 'shop')
/** One whole shop set (face + neck + head + hand + body + back). */
export const SHOP_SET_PRICE = 80 + 80 + 120 + 120 + 180 + 180
export const SHOP_TOTAL = SHOP_ITEMS.reduce((sum, i) => sum + (i.source.kind === 'shop' ? i.source.price : 0), 0)
export const RECOLOR_TOTAL = ITEMS.length * RECOLORS_PER_ITEM * RECOLOR_PRICE
export const DECOR_TOTAL = DECOR.reduce((sum, d) => sum + d.price, 0)
/** Everything perler can buy: the four shop sets, every recolour and the decor (about 7 500). */
export const TOTAL_SINK = SHOP_TOTAL + RECOLOR_TOTAL + DECOR_TOTAL

// ─── The egg ────────────────────────────────────────────────────────────────

/**
 * Warmth (right answers) egg number n needs: 15, 40, 60, then 72 up to egg 9, then 96 (SPEC 90 and
 * 120, −20 %: the hatch is the steady big moment that keeps a ceremony in every session).
 */
export function eggWarmthFor(eggNumber: number): number {
  if (eggNumber <= 1) return 15
  if (eggNumber === 2) return 40
  if (eggNumber === 3) return 60
  return eggNumber <= 9 ? 72 : 96
}

export const EGG = {
  /** Warmth per right answer. */
  perCorrect: 1,
  /** Extra warmth for a caught golden egg. */
  golden: 10,
  /** When every unlocked species has been found in every breed and colour, a full egg gives this much friendship to the buddy instead. */
  allFoundFriendship: 50,
} as const

// ─── Friendship and growth (SPEC §6.3) ─────────────────────────────────────

/** Total friendship for friendship level 1 … 10 (index 0 is level 1). */
export const FRIENDSHIP_LEVELS: readonly number[] = [0, 20, 50, 100, 170, 260, 370, 500, 650, 820]

export type FriendshipUnlock =
  | 'hop' | 'cheer' | 'spin' | 'young' | 'call' | 'signature' | 'grown' | 'dance' | 'star'

/** What each friendship level brings (level 1 is where every animal starts). */
export const FRIENDSHIP_UNLOCKS: Readonly<Record<number, FriendshipUnlock>> = {
  2: 'hop', 3: 'cheer', 4: 'spin', 5: 'young', 6: 'call', 7: 'signature', 8: 'grown', 9: 'dance', 10: 'star',
}

export const FRIENDSHIP = {
  /** Per right answer while the animal is the buddy (golden egg included). */
  perCorrect: 1,
  /** Per mastery spark while the animal is the buddy. */
  perSpark: 3,
} as const

/** Friendship levels where the animal grows: baby → young at 5, young → grown at 8, star form at 10. */
export const GROWTH = { young: 5, grown: 8, star: 10 } as const

export function friendshipLevel(friendship: number): number {
  let level = 1
  for (let l = 2; l <= FRIENDSHIP_LEVELS.length; l++) if (friendship >= FRIENDSHIP_LEVELS[l - 1]) level = l
  return level
}

// ─── Combo (juice only, never currency) ────────────────────────────────────

export type ComboEffect = 'paw' | 'goldenEgg' | 'superDance' | 'perfectBanner'

/** Right answers in a row → effect. Only looks; nothing here pays perler. */
export const COMBO: readonly { streak: number; effect: ComboEffect }[] = [
  { streak: 1, effect: 'paw' },
  { streak: 3, effect: 'goldenEgg' },
  { streak: 5, effect: 'superDance' },
  { streak: 10, effect: 'perfectBanner' },
]

/** The effect that starts exactly at this streak, or null. */
export const comboEffect = (streak: number): ComboEffect | null => COMBO.find((c) => c.streak === streak)?.effect ?? null

// ─── Stars (SPEC §5.5) ──────────────────────────────────────────────────────

export const STAR_RULES = {
  /** ★2: at most this many wrong first tries. */
  maxMistakesFor2: 2,
  /** ★3: at most this many wrong first tries … */
  maxMistakesFor3: 1,
  /** … and at least this many typed (production) answers in the round. No speed. */
  minProductionFor3: 3,
} as const
