// numberLine100 — Tallinjen til 100 (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `nl100:`.
//   placeTens  nl100:placeTens:<n>   n = 10, 20 … 90                                   9 (all canonical)
//   placeAny   nl100:placeAny:<n>    n = 1–99                                          99
//   readArrow  nl100:readArrow:<n>   n = 5, 10 … 95 (on the line's ticks)              19 (all canonical)
// Each family is asked three ways about the same number on a 0–100 line:
//   numberline  "Sæt nålen ved syvogtredive." — the production kind; ±5 for placeTens and placeAny
//               (an estimate), ±2 for readArrow (the nearest tick: exact, as the family says)
//   keypad      read the line: the arrow at a tick ("Hvilket tal peger pilen på?", placeTens and
//               readArrow), or a hop from the ten before for any number ("Hoppet starter ved
//               tredive. Hvor lander det?", the line shows +7) — an arrow between ticks cannot be
//               read exactly, and the keypad is exact
//   choice      the cards' numbers are marked on the line (src/ui/scenes/MarkedLine): "Hvilket tal
//               ligger mellem tredive og fyrre?", or "… midt mellem …" for tens and fives. No
//               wrong card lies in that stretch.
// Wrong answers: the two tens around the number ('operand': they are said, or labelled next to the
// arrow), ±10 and ±20 ('near'/'other': the wrong stretch of the line), ±5 next to a ten or five.
// No misconception from the catalogue belongs here; a reversed typed answer (37 → 73) is left to
// the global digitSwap slip check, so it is never a candidate.
import type { Fact, FamilyDef, HintSpec, Prompt, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import { hintOf, metaOf, num, say, tagged, walk, type Entry } from './kit'
import { canonical, drawAvoiding, familyRank, onesOf, placeNoun, tensOf, within } from '../place/kit'

const meta = metaOf('numberLine100')

type Family = 'placeTens' | 'placeAny' | 'readArrow'

const make = (family: Family, n: number): Fact => ({
  id: `nl100:${family}:${n}`, skill: 'numberLine100', family, operands: [n], answer: n, rank: familyRank(meta.families, family),
})

const parse = (f: Fact): { family: Family; n: number } => {
  const [, family, n] = f.id.split(':')
  return { family: family as Family, n: Number(n) }
}

const MEMBERS: Readonly<Record<Family, readonly number[]>> = {
  placeTens: walk(1, 9).map((t) => t * 10),
  placeAny: walk(1, 99),
  readArrow: walk(1, 19).map((k) => k * 5),
}

const draw = (family: Family, rng: Rng): Fact => make(family, rng.pick(MEMBERS[family]))

const FACTS: readonly Fact[] = meta.families.flatMap((fam) => {
  const family = fam.id as Family
  return canonical('numberLine100', family, (rng) => draw(family, rng), MEMBERS[family].map((n) => make(family, n)))
})

const LINE = { scene: 'line', min: 0, max: 100 } as const

/** How the stretch around a number is asked on cards: "mellem a og b", or "midt mellem a og b". */
export function stretchOf(family: Family, n: number): { lo: number; hi: number; middle: boolean } {
  const o = onesOf(n)
  if (family !== 'placeAny' || o === 5 || o === 0) {
    const half = o === 5 ? 5 : 10
    return { lo: n - half, hi: n + half, middle: true }
  }
  return { lo: n - o, hi: n - o + 10, middle: false }
}

/** The keypad's hop starts at the ten before the number (the ten below for whole tens). */
const hopStart = (n: number): number => (onesOf(n) === 0 ? n - 10 : n - onesOf(n))

/** The keypad reads an arrow on a tick, or a hop for any other number. */
const readsArrow = (family: Family): boolean => family !== 'placeAny'

function prompt(f: Fact, kind: TaskKind): Prompt {
  const { family, n } = parse(f)
  if (kind === 'keypad') return readsArrow(family) ? { ...LINE, arrowAt: n } : { ...LINE, hops: [hopStart(n), n] }
  return { ...LINE }
}

function speech(f: Fact, kind: TaskKind): SpeechPart[] {
  const { family, n } = parse(f)
  if (kind === 'numberline') return [say('s.nl.place'), num(n)]
  if (kind === 'keypad') return readsArrow(family) ? [say('s.nl.whichArrow')] : [say('s.nl.hopFrom'), num(hopStart(n)), say('s.nl.whereLand')]
  const { lo, hi, middle } = stretchOf(family, n)
  return [say(middle ? 's.nl.midway' : 's.order20.between'), num(lo, 'mid'), say('op.og'), num(hi)]
}

function candidates(f: Fact) {
  const { family, n } = parse(f)
  const { lo, hi, middle } = stretchOf(family, n)
  const ok = within(0, 100)
  const entries: Entry[] = [
    // the ends of the stretch: said in the question, or the labelled tens next to the arrow
    ...[lo, hi].filter(ok).map((v) => [v, 'operand'] as const),
    ...[n - 10, n + 10].filter((v) => ok(v) && (v < lo || v > hi)).map((v) => [v, 'near'] as const),
    ...[n - 20, n + 20].filter(ok).map((v) => [v, 'other'] as const),
    // inside a "midt mellem" stretch, the halfway points are wrong too
    ...(middle ? [n - 5, n + 5].filter((v) => ok(v) && v > lo && v < hi).map((v) => [v, 'near'] as const) : []),
    // the hop's own label (+7) typed as the answer
    ...(!readsArrow(family) && n >= 10 && onesOf(n) > 0 ? ([[onesOf(n), 'operand']] as const) : []),
  ]
  return tagged(n, entries)
}

function hint(f: Fact): HintSpec {
  const { n } = parse(f)
  const o = onesOf(n)
  if (o === 0) {
    // "Halvfjerds er syv tiere. Hop ti ad gangen fra nul."
    const t = tensOf(n)
    return hintOf([num(n, 'mid'), say('hint.place.is'), num(t, 'mid'), placeNoun('t', t, 'end'), say('hint.nl.hopTens')], { ...LINE, hops: walk(0, t).map((k) => k * 10) })
  }
  const lo = n - o
  const hi = lo + 10
  if (o === 5) {
    // "Femogtredive ligger midt mellem tredive og fyrre."
    return hintOf([num(n, 'mid'), say('hint.nl.liesMidway'), num(lo, 'mid'), say('op.og'), num(hi)], { ...LINE, arrowAt: n, hops: [lo, n] })
  }
  // "Syvogtredive ligger mellem tredive og fyrre. Start ved tredive, og gå syv frem."
  const between = [num(n, 'mid'), say('hint.nl.liesBetween'), num(lo, 'mid'), say('op.og'), num(hi)]
  const walkOn = [say('hint.nl.startAt'), num(lo, 'mid'), say('hint.nl.andGo'), num(o, 'mid'), say('hint.nl.forward')]
  return hintOf([...between, ...walkOn], { ...LINE, hops: [lo, n] })
}

export default {
  ...meta,
  kinds: ['numberline', 'choice', 'keypad'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id as Family, rng), avoid),
  answerType: () => 'int',
  prompt,
  optionView: () => 'numeral',
  range: () => [0, 100],
  speech,
  candidates,
  hint,
  // placing is an estimate (±5); the readArrow numbers sit on ticks five apart, so ±2 is the tick itself
  tolerance: (f: Fact) => (parse(f).family === 'readArrow' ? 2 : 5),
} satisfies SkillModule
