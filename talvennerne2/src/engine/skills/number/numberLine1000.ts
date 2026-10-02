// numberLine1000 — Tallinjen til 1000 og afrunding (SPEC §2.2, pædagogik-forslaget §1.3). Procedure,
// prefix `nl1000:`.
//   placeHundreds  nl1000:placeHundreds:<n>  n = 100, 200 … 900                      9 (all canonical)
//   placeAny       nl1000:placeAny:<n>       n = 1–999                                999
//   round10   (3. kl.)  nl1000:round10:<n>   n = 101–999, ones digit 2–8: the nearest ten
//   round100  (3. kl.)  nl1000:round100:<n>  n = 101–999, last two digits 13–87: the nearest hundred
// Placing works as in numberLine100 on a 0–1000 line: the numberline (production, ±50 — 5 % of the
// line), the keypad reads an arrow on a hundred or a hop from the hundred before ("Hoppet starter
// ved tre hundrede. Hvor lander det?", +45 on the line), and the cards ask "Hvilket tal ligger
// mellem tre hundrede og fire hundrede?" (or "midt mellem") with the cards' numbers marked.
// Rounding (Trecifret bro, 3. kl.) asks for the nearest ten or hundred; five rounds up. On the line
// the needle must land closer to the rounded number than the number itself lies: the tolerance is
// one less than that distance (at most ±2 for tens, ±25 for hundreds), so leaving the number
// unrounded is never right, and no other ten or hundred is reached. The line is half a stretch —
// the half of the hundred's stretch the number lies in for tens (340–350 … 300–350 for 347, labelled
// every ten), the half of 0–1000 for hundreds (0–500, labelled every hundred) — so the narrowest
// window is still no narrower than the exact tap on a 0–20 line (1/21 of the line). Numbers too
// close to a ten or hundred for that (341, 305) are not drawn: on a line a finger cannot tell them
// from their rounding.
// The keypad and the cards ask "Hvilken tier ligger tre hundrede og syvogfyrre tættest på?" with the
// arrow at the number.
// Wrong answers: the ends of the stretch ('operand'), ±100 and ±200 (the wrong stretch: 'near',
// 'other'), ±50 next to a hundred; rounding the wrong way ('near'), to the wrong place ('other') and
// the number itself ('operand'). No catalogue misconception belongs here; a reversed typed answer is
// left to the global digitSwap slip check.
import type { Fact, FamilyDef, HintSpec, Prompt, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import { hintOf, metaOf, num, say, tagged, walk, type Entry } from './kit'
import { canonical, drawAvoiding, familyRank, hundredsOf, placeNoun, within } from '../place/kit'

const meta = metaOf('numberLine1000')

type Family = 'placeHundreds' | 'placeAny' | 'round10' | 'round100'

const make = (family: Family, n: number): Fact => ({
  id: `nl1000:${family}:${n}`, skill: 'numberLine1000', family, operands: [n], answer: answerFor(family, n), rank: familyRank(meta.families, family),
})

/** Five rounds up (345 → 350, 350 → 400). */
const roundTo = (n: number, step: number): number => Math.floor((n + step / 2) / step) * step

function answerFor(family: Family, n: number): number {
  if (family === 'round10') return roundTo(n, 10)
  if (family === 'round100') return roundTo(n, 100)
  return n
}

const stepOf = (family: Family): number => (family === 'round10' ? 10 : 100)

/** How far a number lies from its rounding: 347 → 3 (to 350), 345 → 5. */
const distance = (family: Family, n: number): number => Math.abs(answerFor(family, n) - n)

/** Rounding tolerance cap: an asked ten or hundred is reached, no other one (2·tol < step), and the half line stays production. */
const ROUND_CAP = { round10: 2, round100: 25 } as const

/**
 * The narrowest window a finger can hit on a line, as a share of it: the exact tap on a 0–20 line
 * (1 of 21 numbers), the narrowest window any number line in the app asks for.
 */
const MIN_WINDOW = 1 / 21

/** The half stretch a rounding numberline is asked on: 347 → 300–350 (tens), 347 → 0–500 (hundreds). */
function halfLine(family: 'round10' | 'round100', n: number): { min: number; max: number } {
  const span = family === 'round10' ? 50 : 500
  const min = Math.floor(n / span) * span
  return { min, max: min + span }
}

/** Rounding tolerance: one less than the number's distance to its rounding, so the number itself is never right. */
const roundTolerance = (family: 'round10' | 'round100', n: number): number => Math.min(ROUND_CAP[family], distance(family, n) - 1)

/** A number the rounding families draw: not a whole ten (hundred), and its window on the half line is wide enough to hit. */
function roundable(family: 'round10' | 'round100', n: number): boolean {
  if (n % stepOf(family) === 0) return false
  const { min, max } = halfLine(family, n)
  return (2 * roundTolerance(family, n) + 1) / (max - min + 1) >= MIN_WINDOW
}

const parse = (f: Fact): { family: Family; n: number } => {
  const [, family, n] = f.id.split(':')
  return { family: family as Family, n: Number(n) }
}

function draw(family: Family, rng: Rng): Fact {
  switch (family) {
    case 'placeHundreds':
      return make(family, rng.between(1, 9) * 100)
    case 'placeAny':
      return make(family, rng.between(1, 999))
    case 'round10':
    case 'round100': {
      let n = rng.between(101, 999)
      while (!roundable(family, n)) n = rng.between(101, 999)
      return make(family, n)
    }
  }
}

const HUNDREDS: readonly Fact[] = walk(1, 9).map((h) => make('placeHundreds', h * 100))

const FACTS: readonly Fact[] = meta.families.flatMap((fam) =>
  canonical('numberLine1000', fam.id, (rng) => draw(fam.id as Family, rng), fam.id === 'placeHundreds' ? HUNDREDS : undefined),
)

const LINE = { scene: 'line', min: 0, max: 1000 } as const
/** The hundred's own stretch of line for rounding to tens: 347 → 300–400. */
const stretchLine = (n: number) => ({ scene: 'line', min: hundredsOf(n) * 100, max: hundredsOf(n) * 100 + 100 }) as const

/** How the stretch around a number is asked on cards (like numberLine100, in hundreds). */
function stretchOf(family: Family, n: number): { lo: number; hi: number; middle: boolean } {
  const rest = n % 100
  if (family === 'placeHundreds' || rest === 0) return { lo: n - 100, hi: n + 100, middle: true }
  if (rest === 50) return { lo: n - 50, hi: n + 50, middle: true }
  return { lo: n - rest, hi: n - rest + 100, middle: false }
}

const hopStart = (n: number): number => (n % 100 === 0 ? n - 100 : n - (n % 100))

function prompt(f: Fact, kind: TaskKind): Prompt {
  const { family, n } = parse(f)
  switch (family) {
    case 'placeHundreds':
      return kind === 'keypad' ? { ...LINE, arrowAt: n } : { ...LINE }
    case 'placeAny':
      return kind === 'keypad' ? { ...LINE, hops: [hopStart(n), n] } : { ...LINE }
    case 'round10':
      if (kind === 'numberline') return { scene: 'line', ...halfLine(family, n) }
      return kind === 'keypad' ? { ...stretchLine(n), arrowAt: n } : { ...stretchLine(n) }
    case 'round100':
      if (kind === 'numberline') return { scene: 'line', ...halfLine(family, n) }
      return kind === 'keypad' ? { ...LINE, arrowAt: n } : { ...LINE }
  }
}

function speech(f: Fact, kind: TaskKind): SpeechPart[] {
  const { family, n } = parse(f)
  if (family === 'round10' || family === 'round100') {
    const ten = family === 'round10'
    if (kind === 'numberline') return [say(ten ? 's.nl1000.placeNearestTen' : 's.nl1000.placeNearestHundred'), num(n)]
    return [say(ten ? 's.nl1000.whichTen' : 's.nl1000.whichHundred'), num(n, 'mid'), say('s.nl1000.closest')]
  }
  if (kind === 'numberline') return [say('s.nl.place'), num(n)]
  if (kind === 'keypad') return family === 'placeHundreds' ? [say('s.nl.whichArrow')] : [say('s.nl.hopFrom'), num(hopStart(n)), say('s.nl.whereLand')]
  const { lo, hi, middle } = stretchOf(family, n)
  return [say(middle ? 's.nl.midway' : 's.order20.between'), num(lo, 'mid'), say('op.og'), num(hi)]
}

function candidates(f: Fact) {
  const { family, n } = parse(f)
  const ok = within(0, 1000)
  const answer = answerFor(family, n)
  if (family === 'round10' || family === 'round100') {
    const step = family === 'round10' ? 10 : 100
    const other = answer > n ? answer - step : answer + step
    const otherPlace = roundTo(n, step === 10 ? 100 : 10)
    const entries: Entry[] = [[n, 'operand'], ...[other].filter(ok).map((v) => [v, 'near'] as const), [otherPlace, 'other']]
    return tagged(answer, entries)
  }
  const { lo, hi, middle } = stretchOf(family, n)
  const entries: Entry[] = [
    ...[lo, hi].filter(ok).map((v) => [v, 'operand'] as const),
    ...[n - 100, n + 100].filter((v) => ok(v) && (v < lo || v > hi)).map((v) => [v, 'near'] as const),
    ...[n - 200, n + 200].filter(ok).map((v) => [v, 'other'] as const),
    ...(middle ? [n - 50, n + 50].filter((v) => ok(v) && v > lo && v < hi).map((v) => [v, 'near'] as const) : []),
  ]
  return tagged(n, entries)
}

function hint(f: Fact): HintSpec {
  const { family, n } = parse(f)
  if (family === 'round10' || family === 'round100') {
    const step = family === 'round10' ? 10 : 100
    const lo = Math.floor(n / step) * step
    const hi = lo + step
    const answer = answerFor(family, n)
    const visual = family === 'round10' ? { ...stretchLine(n), arrowAt: n, hops: [n, answer] } : { ...LINE, arrowAt: n, hops: [n, answer] }
    // "Tre hundrede og syvogfyrre ligger mellem tre hundrede og fyrre og tre hundrede og halvtreds.
    //  Det ligger tættest på tre hundrede og halvtreds." — and in the middle: "Midt imellem runder vi op."
    const between = [num(n, 'mid'), say('hint.nl.liesBetween'), num(lo, 'mid'), say('op.og'), num(hi)]
    const tail = n - lo === step / 2 ? [say('hint.nl1000.middleRoundsUp')] : [say('hint.nl1000.closestIs'), num(answer)]
    return hintOf([...between, ...tail], visual)
  }
  const rest = n % 100
  if (rest === 0) {
    // "Fire hundrede er fire hundreder. Hop hundrede ad gangen fra nul."
    const h = hundredsOf(n)
    return hintOf([num(n, 'mid'), say('hint.place.is'), num(h, 'mid', h === 1 ? 'n' : 'c'), placeNoun('h', h, 'end'), say('hint.nl1000.hopHundreds')], { ...LINE, hops: walk(0, h).map((k) => k * 100) })
  }
  const lo = n - rest
  const hi = lo + 100
  if (rest === 50) {
    return hintOf([num(n, 'mid'), say('hint.nl.liesMidway'), num(lo, 'mid'), say('op.og'), num(hi)], { ...LINE, arrowAt: n, hops: [lo, n] })
  }
  // "Tre hundrede og femogfyrre ligger mellem tre hundrede og fire hundrede. Start ved tre hundrede, og gå femogfyrre frem."
  const between = [num(n, 'mid'), say('hint.nl.liesBetween'), num(lo, 'mid'), say('op.og'), num(hi)]
  const walkOn = [say('hint.nl.startAt'), num(lo, 'mid'), say('hint.nl.andGo'), num(rest, 'mid'), say('hint.nl.forward')]
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
  // a rounding numberline is half a stretch; its guess rate is counted on that half
  range: (f, kind) => {
    const { family, n } = parse(f)
    if (kind !== 'numberline' || (family !== 'round10' && family !== 'round100')) return [0, 1000]
    const { min, max } = halfLine(family, n)
    return [min, max]
  },
  speech,
  candidates,
  hint,
  tolerance: (f: Fact) => {
    const { family, n } = parse(f)
    return family === 'round10' || family === 'round100' ? roundTolerance(family, n) : 50
  },
} satisfies SkillModule
