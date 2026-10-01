// count20 — Tælle til 20 (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 20 facts, prefix `c20:`.
//   tenframe  c20:tenframe:<n>   n = 11–20 counters in two ten-frames (a full ten and the rest)   10
//   loose     c20:loose:<n>      n = 11–20 things spread out                                     10
// Kinds: choice and keypad ("Hvor mange prikker er der?") and countTap ("Læg fjorten klodser i
// kurven"). The hint teaches the ten as a chunk: a full ten-frame is ten, then count on.
// Errors are near misses (±1, ±2) and the forgotten ten (14 → 4), which only a typed answer can show.
import type { Fact, SkillModule } from '../types'
import type { CountThing } from '../../../speech/clips/skills/number'
import { metaOf } from './kit'
import { count20Hint, countCandidates, countOutSpeech, countPicture, countPile, howManySpeech, usesPicture, type CountData } from './counting'

/** Loose things, a different one for each number. */
const LOOSE: Readonly<Record<number, CountThing>> = {
  11: 'carrot', 12: 'apple', 13: 'strawberry', 14: 'fish', 15: 'flower', 16: 'star', 17: 'mushroom', 18: 'ball', 19: 'leaf', 20: 'chestnut',
}

/** The pile for "Læg … i kurven": more than twenty. */
export const COUNT20_PILE = 24

function fact(family: 'tenframe' | 'loose', n: number): Fact {
  const data: CountData = family === 'tenframe' ? { layout: 'tenframe', thing: 'cube' } : { layout: 'scatter', thing: LOOSE[n] }
  return {
    id: `c20:${family}:${n}`,
    skill: 'count20',
    family,
    operands: [n],
    answer: n,
    // the ten-frame first for each number: it shows the ten that the loose things hide
    rank: (n - 11) * 2 + (family === 'tenframe' ? 0 : 1),
    data: data as unknown as Fact['data'],
  }
}

const FACTS: readonly Fact[] = Array.from({ length: 10 }, (_, i) => [fact('tenframe', i + 11), fact('loose', i + 11)]).flat()

export default {
  ...metaOf('count20'),
  kinds: ['choice', 'keypad', 'countTap'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f, kind) => (usesPicture(kind) ? countPicture(f, false) : countPile(f, COUNT20_PILE)),
  optionView: () => 'numeral',
  range: (_f, kind) => (kind === 'countTap' ? [0, COUNT20_PILE] : [10, 20]),
  speech: (f, kind) => (usesPicture(kind) ? howManySpeech(f, false) : countOutSpeech(f)),
  candidates: (f) => countCandidates(f, true),
  hint: (f) => count20Hint(f),
} satisfies SkillModule
