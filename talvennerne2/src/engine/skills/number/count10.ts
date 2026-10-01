// count10 — Tælle til 10 (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 28 facts, prefix `c10:`.
//   scatter  c10:scatter:<n>    n = 1–10 things spread out, counted one by one          10
//   flash    c10:<rep>:<n>      rep = dice | fingers | tenframe, n = 1–6, shown 1,5 s     18
// Kinds: choice ("Hvor mange gulerødder er der?" on number cards), keypad (the same, typed) and
// countTap ("Læg syv gulerødder i kurven"). keypad is the first production kind, so a mastered flash
// fact is still asked as a glance ("Hvor mange øjne så du?") and not only as counting out.
// Errors are near misses (±1, ±2); counting has no misconception in the catalogue.
import type { Fact, SkillModule } from '../types'
import type { CountThing } from '../../../speech/clips/skills/number'
import { metaOf } from './kit'
import {
  count10Hint, countCandidates, countOutSpeech, countPicture, countPile, howManySpeech, isFlash, usesPicture,
  type CountData, type CountLayout,
} from './counting'

/** A different thing for each number, so no picture repeats across numbers. */
const SCATTER: Readonly<Record<number, CountThing>> = {
  1: 'apple', 2: 'fish', 3: 'flower', 4: 'carrot', 5: 'star', 6: 'strawberry', 7: 'ball', 8: 'mushroom', 9: 'chestnut', 10: 'leaf',
}
const FLASH_REPS = ['dice', 'fingers', 'tenframe'] as const satisfies readonly CountLayout[]

/** The pile for "Læg … i kurven": always more than ten, so the target is never "all of them". */
export const COUNT10_PILE = 12

function fact(layout: CountLayout, n: number, thing: CountThing, order: number): Fact {
  const data: CountData = { layout, thing }
  return {
    id: `c10:${layout}:${n}`,
    skill: 'count10',
    family: layout === 'scatter' ? 'scatter' : 'flash',
    operands: [n],
    answer: n,
    // small numbers first; each number is met spread out, then on a die, fingers and a ten-frame
    rank: n * 4 + order,
    data: data as unknown as Fact['data'],
  }
}

const FACTS: readonly Fact[] = [
  ...Array.from({ length: 10 }, (_, i) => fact('scatter', i + 1, SCATTER[i + 1], 0)),
  // counting out a flash fact puts cubes in the basket
  ...FLASH_REPS.flatMap((rep, r) => Array.from({ length: 6 }, (_, i) => fact(rep, i + 1, 'cube', r + 1))),
].sort((a, b) => a.rank - b.rank)

export default {
  ...metaOf('count10'),
  kinds: ['choice', 'keypad', 'countTap'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f, kind) => (usesPicture(kind) ? countPicture(f, isFlash(f)) : countPile(f, COUNT10_PILE)),
  optionView: () => 'numeral',
  range: (_f, kind) => (kind === 'countTap' ? [0, COUNT10_PILE] : [1, 10]),
  speech: (f, kind) => (usesPicture(kind) ? howManySpeech(f, isFlash(f)) : countOutSpeech(f)),
  candidates: (f) => countCandidates(f, false),
  hint: (f) => count10Hint(f),
} satisfies SkillModule
