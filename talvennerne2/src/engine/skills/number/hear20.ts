// hear20 — Hør og skriv tal til 20 (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 21 facts, `h20:<n>`.
//   small  n = 0–10     teens  n = 11–20
// The number is only heard ({ scene: 'hear' }): "Find tallet fjorten." on number cards, "Skriv tallet
// fjorten." on the keypad. Ranked 1–5, 0, 6–10, 20 and the irregular teens 11–19 last.
//
// Danish says the teens ones first (fjor-ten), so 41 for "fjorten" is the classic reversal: digitSwap,
// a concept in this skill (misconceptions.ts). For 13–19 the reversed number is shown as the
// diagnostic card, so the card range is 0–99 there; 12 → 21 is only classified, never shown. The
// forgotten ten (14 → 4) is a near miss (±10), and 6 for 9 or 9 for 6 (the numeral upside down) a plain wrong card.
import type { Fact, HintSpec, SkillModule } from '../types'
import { digitSwapOf } from '../../misconceptions'
import { hintOf, metaOf, num, say, tagged } from './kit'

/** Rank order: 1–5, 0, 6–10, 20, then 11–19 (irregular in Danish). */
const ORDER = [1, 2, 3, 4, 5, 0, 6, 7, 8, 9, 10, 20, 11, 12, 13, 14, 15, 16, 17, 18, 19]

const FACTS: readonly Fact[] = ORDER.map((n, rank) => ({
  id: `h20:${n}`,
  skill: 'hear20',
  family: n <= 10 ? 'small' : 'teens',
  operands: [n],
  answer: n,
  rank,
}))

/** 13–19 are said ones first; their reversal is the diagnostic card. */
const showsSwap = (n: number) => n >= 13 && n <= 19

const valueOf = (f: Fact) => f.answer as number

function hint(f: Fact, swapped: boolean): HintSpec {
  const n = valueOf(f)
  const frame = { scene: 'objects', n, layout: 'tenframe', thing: 'ball' } as const
  if (n === 0) return hintOf([say('hint.hear20.zero')], frame)
  if (n <= 10) return hintOf([say('hint.hear20.thisMany'), num(n)], frame)
  if (n === 20) return hintOf([num(20, 'mid'), say('hint.hear20.tenAnd'), num(10)], frame)
  const ones = n - 10
  // "Fjorten er ti og fire. Vi skriver ettallet først."
  const base = [num(n, 'mid'), say('hint.hear20.tenAnd'), num(ones)]
  const reversed = swapped && digitSwapOf(n) !== null
  // only 13–19 are said ones first ("Vi siger fire først …"); "tolv" is not
  const tail = reversed && showsSwap(n)
    ? [say('hint.hear20.weSay'), num(ones, 'mid'), say('hint.hear20.butOneFirst')]
    : [say('hint.hear20.oneFirst')]
  return reversed ? hintOf([...base, ...tail], frame, 'digitSwap', true) : hintOf([...base, ...tail], frame)
}

export default {
  ...metaOf('hear20'),
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: () => ({ scene: 'hear' }),
  optionView: () => 'numeral',
  range: (f) => (showsSwap(valueOf(f)) ? [0, 99] : [0, 20]),
  speech: (f, kind) => [say(kind === 'keypad' ? 's.hear20.write' : 'frag.find_tallet'), num(valueOf(f))],
  candidates(f) {
    const n = valueOf(f)
    const swap = digitSwapOf(n)
    return tagged(n, [
      ...(swap !== null ? ([[swap, 'digitSwap']] as const) : []),
      // near misses stay within the skill's 0–20, even where the card range opens to 99 for the swap
      ...[n - 1, n + 1, n - 2, n + 2].filter((v) => v <= 20).map((v) => [v, 'near'] as const),
      ...(n > 10 ? ([[n - 10, 'near']] as const) : []),
      // the numeral turned upside down: 6 and 9 are the classic pair at five or six
      ...(n === 6 || n === 9 ? ([[15 - n, 'other']] as const) : []),
    ])
  },
  hint: (f, tag) => hint(f, tag === 'digitSwap'),
} satisfies SkillModule
