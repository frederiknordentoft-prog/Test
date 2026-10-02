// placeValue1000 — Hundreder, tiere og enere (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `pv:`.
//   buildHTO    pv:buildHTO:<n>          n = 100–999: plates, rods and cubes → the number          900
//   zeroPlace   pv:zeroPlace:<n>         one zero inside: 304 or 320, said without the zero
//                                        ("Tre hundreder og fire enere") with the blocks          162
//   digitValue  pv:digitValue:<h|t>:<n>  "Hvad er tierne værd i fire hundrede og tooghalvfjerds?"
//                                        → 70 (hundreds or tens; at least two non-zero digits)
//   expand      pv:expand:<h|t>:<n>      472 = 400 + □ + 2 → 70 (or □ + 70 + 2 → 400), digits 1–9
//   regroup  (3. kl.)  pv:regroup:<ht|to>:<a>:<b>   "To hundreder og fjorten tiere" → 340 (b = 11–19),
//                                        "Tre tiere og femten enere" → 45
// Kinds, all about the same instance:
//   choice / keypad  the question above (keypad: production, five digits so 3004 and 30020 fit)
//   buildBase        production: build the number from its numeral, only the asked place
//                    ("Byg kun tierne i …" → 70), or what is missing; the answer is what the blocks
//                    are worth (100 per plate, 10 per rod, nothing regrouped)
//   fillSlots        production: the digits from a 0–9 palette ('3|0|4'), or the number written as
//                    its parts from a palette of digits, tens and hundreds ('400|70|2', any order)
// Wrong answers (pædagogik §3.2), with the counts in the picture or the words as operands:
//   addsPlaceParts     3 plader, 4 stænger og 5 terninger → 12 (buildHTO, zeroPlace, regroup)
//   zeroPlaceholder    the zero dropped or moved: 304 → 34 or 340, 320 → 32 or 302, 300 → 30 or 3
//   concatNumberWords  the words written one after the other: "tre hundreder og fire enere" → 3004
//   digitSwap          tens and ones swapped (345 → 354, '3|5|4')
//   faceValue          the digit for its value: 7 for the tens of 472, '4|7|2' for 400 + 70 + 2. In
//                      477 = 400 + □ + 7 the 7 is also in the question: 'ambiguous' (A9)
//   near/other         ±1, ±10, ±100; the right digit in the wrong place (700, 40), the whole number.
import type { AnswerType, AnswerValue, Fact, FamilyDef, HintSpec, Prompt, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import type { Term } from '../../types'
import { digitSwapOf } from '../../misconceptions'
import { hintOf, metaOf, num, say, tagged, walk, type Entry } from '../number/kit'
import {
  blocks, canonical, drawAvoiding, expandedParts, familyRank, hundredsOf, joined, onesOf, permutations, placeCount, placeNoun,
  placeWords, tensOf, within, type Place, type PlacePart,
} from './kit'

const meta = metaOf('placeValue1000')

type Family = 'buildHTO' | 'zeroPlace' | 'digitValue' | 'expand' | 'regroup'
type Asked = 'h' | 't'
type Pair = 'ht' | 'to'

type PlaceValue =
  | { family: 'buildHTO' | 'zeroPlace'; n: number }
  | { family: 'digitValue' | 'expand'; place: Asked; n: number }
  | { family: 'regroup'; pair: Pair; a: number; b: number }

function idOf(q: PlaceValue): string {
  switch (q.family) {
    case 'digitValue':
    case 'expand':
      return `pv:${q.family}:${q.place}:${q.n}`
    case 'regroup':
      return `pv:regroup:${q.pair}:${q.a}:${q.b}`
    default:
      return `pv:${q.family}:${q.n}`
  }
}

function parsePlaceValue(id: string): PlaceValue {
  const bits = id.split(':')
  switch (bits[1]) {
    case 'digitValue':
    case 'expand':
      return { family: bits[1], place: bits[2] === 'h' ? 'h' : 't', n: Number(bits[3]) }
    case 'regroup':
      return { family: 'regroup', pair: bits[2] === 'to' ? 'to' : 'ht', a: Number(bits[3]), b: Number(bits[4]) }
    default:
      return { family: bits[1] as 'buildHTO', n: Number(bits[2]) }
  }
}

const parse = (f: Fact): PlaceValue => parsePlaceValue(f.id)

/** The number an instance is about. */
const numberOf = (q: PlaceValue): number => (q.family === 'regroup' ? (q.pair === 'ht' ? 100 * q.a + 10 * q.b : 10 * q.a + q.b) : q.n)

const digitAt = (n: number, place: Place): number => (place === 'h' ? hundredsOf(n) : place === 't' ? tensOf(n) : onesOf(n))
const valueAt = (n: number, place: Place): number => digitAt(n, place) * (place === 'h' ? 100 : place === 't' ? 10 : 1)

/** The answer on cards and the keypad — and what the built blocks must be worth. */
function answerOf(q: PlaceValue): number {
  return q.family === 'digitValue' || q.family === 'expand' ? valueAt(q.n, q.place) : numberOf(q)
}

function make(q: PlaceValue): Fact {
  const n = numberOf(q)
  const operands =
    q.family === 'regroup' ? [q.a, q.b]
      : q.family === 'buildHTO' || q.family === 'zeroPlace' ? [hundredsOf(n), tensOf(n), onesOf(n)]
        : q.family === 'expand' ? [n, ...expandedParts(n).filter((v) => v !== valueAt(n, q.place))]
          : [n]
  return { id: idOf(q), skill: 'placeValue1000', family: q.family, operands, answer: answerOf(q), rank: familyRank(meta.families, q.family) }
}

/** Two or more non-zero digits, so the number has parts to write and a value to ask about. */
const partsOk = (n: number): boolean => expandedParts(n).length >= 2

function draw(family: Family, rng: Rng): Fact {
  switch (family) {
    case 'buildHTO':
      return make({ family, n: rng.between(100, 999) })
    case 'zeroPlace': {
      const h = rng.between(1, 9)
      const d = rng.between(1, 9)
      return make({ family, n: rng.next() < 0.5 ? h * 100 + d : h * 100 + d * 10 })
    }
    case 'digitValue': {
      let n = rng.between(100, 999)
      while (!partsOk(n)) n = rng.between(100, 999)
      const place: Asked = tensOf(n) === 0 || rng.next() < 0.5 ? 'h' : 't'
      return make({ family, place, n })
    }
    case 'expand': {
      const n = rng.between(1, 9) * 100 + rng.between(1, 9) * 10 + rng.between(1, 9)
      return make({ family, place: rng.next() < 0.5 ? 'h' : 't', n })
    }
    case 'regroup': {
      const pair: Pair = rng.next() < 0.5 ? 'ht' : 'to'
      return make({ family, pair, a: rng.between(1, 8), b: rng.between(11, 19) })
    }
  }
}

const FACTS: readonly Fact[] = meta.families.flatMap((fam) => canonical('placeValue1000', fam.id, (rng) => draw(fam.id as Family, rng)))

/** The widest wrong answer: "tre hundreder og to tiere" → 30020; five digits on the keypad. */
export const PLACE_VALUE_MAX = 99_999

// ─── Per kind ───────────────────────────────────────────────────────────────

/** fillSlots writes the parts (400 + 70 + 2) in digitValue and expand, else the digits. */
const writesParts = (q: PlaceValue): boolean => q.family === 'digitValue' || q.family === 'expand'

function answer(f: Fact, kind: TaskKind): AnswerValue {
  const q = parse(f)
  if (kind !== 'fillSlots') return answerOf(q)
  const n = numberOf(q)
  return writesParts(q) ? joined(expandedParts(n)) : joined(String(n).split('').map(Number))
}

const answerTypeFor = (_f: Fact, kind: TaskKind): AnswerType => (kind === 'fillSlots' ? 'set' : 'int')

/** 400 + 70 + 2 may be written in any order. */
function accept(f: Fact, kind: TaskKind): AnswerValue[] {
  const q = parse(f)
  if (kind !== 'fillSlots' || !writesParts(q)) return []
  const parts = expandedParts(numberOf(q))
  return permutations(parts).map(joined).filter((v) => v !== joined(parts))
}

const DIGITS: readonly number[] = walk(0, 9)

/** The palette: 0–9, or the number's parts and digits and one more of each place. */
function palette(q: PlaceValue): number[] {
  if (!writesParts(q)) return [...DIGITS]
  const n = numberOf(q)
  const pool = new Set<number>()
  for (const place of ['h', 't', 'o'] as const) {
    const d = digitAt(n, place)
    if (d > 0) pool.add(valueAt(n, place)).add(d)
  }
  // one more digit with its tens and hundreds, so no value is the only one of its size
  const spare = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !pool.has(d)) ?? 1
  pool.add(spare).add(spare * 10).add(spare * 100)
  return [...pool]
}

function options(f: Fact, kind: TaskKind, rng: Rng): AnswerValue[] {
  if (kind !== 'fillSlots') return []
  const q = parse(f)
  // the digits stay in keypad order; the parts are shuffled
  return writesParts(q) ? rng.shuffle(palette(q)) : palette(q)
}

/** fillSlots: every order of the parts is right (6 of 729 for three parts) — still production. */
function guessFloor(f: Fact, kind: TaskKind): number {
  if (kind !== 'fillSlots') return 0
  const q = parse(f)
  const slots = String(answer(f, kind)).split('|').length
  return (1 + accept(f, kind).length) / palette(q).length ** slots
}

const numeral = (n: number): Prompt => ({ scene: 'equation', terms: [{ n }] })

/** 472 = 400 + □ + 2, the asked place blank (fillSlots: every part blank). */
function expansion(n: number, blank: (place: Place) => boolean): Prompt {
  const terms: Term[] = [{ n }, { op: '=' }]
  const places = (['h', 't', 'o'] as const).filter((p) => digitAt(n, p) > 0)
  places.forEach((p, i) => {
    if (i > 0) terms.push({ op: '+' })
    terms.push(blank(p) ? { blank: true } : { n: valueAt(n, p) })
  })
  return { scene: 'equation', terms }
}

function prompt(f: Fact, kind: TaskKind): Prompt {
  const q = parse(f)
  const n = numberOf(q)
  switch (q.family) {
    case 'buildHTO':
    case 'zeroPlace':
      return kind === 'buildBase' ? numeral(n) : blocks(n)
    case 'digitValue':
      return kind === 'fillSlots' ? expansion(n, () => true) : numeral(n)
    case 'expand':
      return kind === 'fillSlots' ? expansion(n, () => true) : expansion(n, (p) => p === q.place)
    case 'regroup':
      if (kind === 'buildBase') return { scene: 'hear' }
      return q.pair === 'ht' ? { scene: 'base', h: q.a, t: q.b, o: 0, order: 'hto' } : { scene: 'base', h: 0, t: q.a, o: q.b, order: 'hto' }
  }
}

/** The non-zero places of a number as words: "tre hundreder og fire enere". */
const saidParts = (n: number): PlacePart[] => (['h', 't', 'o'] as const).filter((p) => digitAt(n, p) > 0).map((p) => [p, digitAt(n, p)] as const)

/** "Hvad er hundrederne plus hvad plus hvad?": every part asked. */
function allParts(n: number): SpeechPart[] {
  const k = expandedParts(n).length
  return [num(n, 'mid'), say('hint.place.is'), ...Array.from({ length: k }, (_, i) => (i === 0 ? [say('frag.hvad')] : [say('op.plus'), say('frag.hvad')])).flat()]
}

function speech(f: Fact, kind: TaskKind): SpeechPart[] {
  const q = parse(f)
  const n = numberOf(q)
  switch (q.family) {
    case 'buildHTO':
      if (kind === 'buildBase') return [say('s.place.build'), num(n)]
      return kind === 'fillSlots' ? [say('s.place.whichNumberBlocks'), say('s.place.writeWithTokens')] : [say('s.place.whichNumberBlocks')]
    case 'zeroPlace':
      if (kind === 'buildBase') return [say('s.place.build'), num(n)]
      return [...placeWords(saidParts(n)), say(kind === 'fillSlots' ? 's.place.writeNumberWithTokens' : 's.place.whichNumber')]
    case 'digitValue':
      if (kind === 'fillSlots') return allParts(n)
      if (kind === 'buildBase') return [say(q.place === 'h' ? 's.place.buildOnlyHundreds' : 's.place.buildOnlyTens'), num(n)]
      return [say(q.place === 'h' ? 's.pv.worthHundreds' : 's.pv.worthTens'), num(n)]
    case 'expand': {
      if (kind === 'fillSlots') return allParts(n)
      // "Fire hundrede og tooghalvfjerds er fire hundrede plus hvad plus to?"
      const parts = (['h', 't', 'o'] as const).filter((p) => digitAt(n, p) > 0)
      const last = parts.length - 1
      const asked = parts.flatMap((p, i) => [
        ...(i > 0 ? [say('op.plus')] : []),
        p === q.place ? say('frag.hvad') : num(valueAt(n, p), i === last ? 'end' : 'mid'),
      ])
      return [num(n, 'mid'), say('hint.place.is'), ...asked, ...(kind === 'buildBase' ? [say('s.place.buildMissing')] : [])]
    }
    case 'regroup': {
      const said = placeWords(q.pair === 'ht' ? [['h', q.a], ['t', q.b]] : [['t', q.a], ['o', q.b]])
      return kind === 'buildBase' ? [say('s.place.lay'), ...said] : [...said, say('s.place.whichNumber')]
    }
  }
}

/** The zero left out or moved: 304 → 34, 340 · 320 → 32, 302 · 300 → 30, 3. */
function zeroSlips(n: number): number[] {
  const h = hundredsOf(n)
  const t = tensOf(n)
  const o = onesOf(n)
  if (t === 0 && o === 0) return [h * 10, h]
  if (t === 0) return [h * 10 + o, h * 100 + o * 10]
  if (o === 0) return [h * 10 + t, h * 100 + t]
  return []
}

/** The same slips on a palette of three digits (a dropped zero cannot be written there). */
function zeroSlipSlots(n: number): string[] {
  const h = hundredsOf(n)
  const t = tensOf(n)
  const o = onesOf(n)
  if (t === 0 && o > 0) return [joined([h, o, 0])]
  if (o === 0 && t > 0) return [joined([h, 0, t])]
  return []
}

/** "tre hundreder og fire enere" written as the words come: 300 then 4 → 3004; 300 then 20 → 30020. */
function concatOf(n: number): number | null {
  const rest = n % 100
  if (rest === 0) return null
  return hundredsOf(n) * 10 ** (String(rest).length + 2) + rest
}

function candidates(f: Fact) {
  const q = parse(f)
  const n = numberOf(q)
  const h = hundredsOf(n)
  const t = tensOf(n)
  const o = onesOf(n)
  const swap = digitSwapOf(n)
  const ok = within(0, 999)
  const near = (...vs: number[]): Entry[] => vs.filter(ok).map((v) => [v, 'near'] as const)
  const swapped: Entry[] = swap !== null ? [[swap, 'digitSwap'], [joined([h, o, t]), 'digitSwap']] : []
  switch (q.family) {
    case 'buildHTO':
      return tagged(n, [
        [h + t + o, 'addsPlaceParts'], [h, 'operand'], [t, 'operand'], [o, 'operand'],
        ...zeroSlips(n).map((v) => [v, 'zeroPlaceholder'] as const), ...zeroSlipSlots(n).map((v) => [v, 'zeroPlaceholder'] as const),
        ...swapped, ...near(n - 1, n + 1, n - 10, n + 10, n - 100, n + 100),
      ])
    case 'zeroPlace': {
      const concat = concatOf(n)
      return tagged(n, [
        [h + t + o, 'addsPlaceParts'], [h, 'operand'], [t || o, 'operand'],
        ...zeroSlips(n).map((v) => [v, 'zeroPlaceholder'] as const), ...zeroSlipSlots(n).map((v) => [v, 'zeroPlaceholder'] as const),
        ...(concat !== null ? ([[concat, 'concatNumberWords']] as const) : []),
        ...near(n - 1, n + 1, n - 10, n + 10, n - 100, n + 100),
      ])
    }
    case 'digitValue':
    case 'expand': {
      const ans = valueAt(n, q.place)
      const d = digitAt(n, q.place)
      const step = q.place === 'h' ? 100 : 10
      const given = q.family === 'expand' ? expandedParts(n).filter((v) => v !== ans) : []
      const parts = expandedParts(n)
      return tagged(ans, [
        [n, 'operand'], ...given.map((v) => [v, 'operand'] as const),
        // the digit for its value (A9: in 477 = 400 + □ + 7 the 7 is in the question too)
        [d, 'faceValue'],
        // the right digit in the other place: 700 or 7 for the tens of 472, 40 for its hundreds
        [q.place === 'h' ? d * 10 : d * 100, 'other'],
        ...near(ans - step, ans + step),
        // the parts written as digits ('4|7|2'), or swapped round (400 + 20 + 7)
        [joined(parts.map((v) => Number(String(v)[0]))), 'faceValue'],
        ...(swap !== null ? ([[joined(expandedParts(swap)), 'digitSwap']] as const) : []),
      ])
    }
    case 'regroup': {
      // "to hundreder og fjorten tiere": the counts written (214), added (16), the extra ten left out (240)
      const written = q.a * 100 + q.b
      return tagged(n, [
        [q.a + q.b, 'addsPlaceParts'], [q.a, 'operand'], [q.b, 'operand'], [written, 'other'],
        [q.pair === 'ht' ? n - 100 : n - 10, 'other'], ...near(n - 1, n + 1, n - 10, n + 10),
      ])
    }
  }
}

// ─── Hints ──────────────────────────────────────────────────────────────────

/** "Tre hundreder, nul tiere og fire enere er tre hundrede og fire." */
const sentence = (n: number): SpeechPart[] => [...placeWords([['h', hundredsOf(n)], ['t', tensOf(n)], ['o', onesOf(n)]], 'mid'), say('hint.place.is'), num(n)]

/** "Nullet holder tiernes plads." */
function zeroWhy(n: number): SpeechPart[] {
  if (tensOf(n) === 0 && onesOf(n) === 0) return [say('hint.place.zeroBoth')]
  if (tensOf(n) === 0) return [say('hint.place.zeroHoldsTens')]
  if (onesOf(n) === 0) return [say('hint.place.zeroHoldsOnes')]
  return []
}

/** "Syvtallet står på tiernes plads. Så er det halvfjerds værd." */
function digitWorth(n: number, place: Asked): SpeechPart[] {
  const d = digitAt(n, place)
  return [
    say(`noun.digit.${d}.mid`), say(place === 'h' ? 'hint.place.onHundredsPlace' : 'hint.place.onTensPlace'),
    say('hint.place.soItIs'), num(valueAt(n, place), 'mid'), say('hint.place.worthEnd'),
  ]
}

function hint(f: Fact, tag: string | null, kind?: TaskKind): HintSpec {
  const q = parse(f)
  const n = numberOf(q)
  const visual = blocks(n)
  switch (q.family) {
    case 'buildHTO':
    case 'zeroPlace': {
      const said = sentence(n)
      if (tag === 'addsPlaceParts') return hintOf([say('hint.pv.plateRodCube'), ...said], visual, 'addsPlaceParts')
      if (tag === 'zeroPlaceholder') return hintOf([...said, ...zeroWhy(n)], visual, 'zeroPlaceholder')
      if (tag === 'concatNumberWords') return hintOf([...said, say('hint.hear1000.threeDigits')], visual, 'concatNumberWords')
      if (tag === 'digitSwap' && digitSwapOf(n) !== null) return hintOf([...said, say('hint.pv.tensBeforeOnes')], visual, 'digitSwap')
      const why = zeroWhy(n)
      return hintOf(q.family === 'buildHTO' ? [say('hint.pv.plateRodCube'), ...said, ...why] : [...said, ...why], visual)
    }
    case 'digitValue':
    case 'expand': {
      const place = q.place
      const only = { scene: 'base', h: place === 'h' ? hundredsOf(n) : 0, t: place === 't' ? tensOf(n) : 0, o: 0, order: 'hto' } as const
      // "Fire hundrede og tooghalvfjerds er fire hundrede plus halvfjerds plus to."
      const parts = expandedParts(n)
      const whole = [num(n, 'mid'), say('hint.place.is'), ...parts.flatMap((v, i) => [...(i > 0 ? [say('op.plus')] : []), num(v, i === parts.length - 1 ? 'end' : 'mid')])]
      if (tag === 'faceValue') {
        const visualFor = kind === 'fillSlots' ? visual : only
        return hintOf(kind === 'fillSlots' ? [...whole, ...digitWorth(n, place)] : digitWorth(n, place), visualFor, 'faceValue')
      }
      if (tag === 'digitSwap' && digitSwapOf(n) !== null) return hintOf([...whole, say('hint.pv.tensBeforeOnes')], visual, 'digitSwap')
      if (q.family === 'digitValue' && kind !== 'fillSlots') return hintOf(digitWorth(n, place), only)
      return hintOf(whole, visual)
    }
    case 'regroup': {
      // "Ti tiere er et hundrede. Fjorten tiere er et hundrede og fire tiere."
      const big: Place = q.pair === 'ht' ? 'h' : 't'
      const small: Place = q.pair === 'ht' ? 't' : 'o'
      const told = [placeCount(small, q.b), placeNoun(small, q.b, 'mid'), say('hint.place.is'), ...placeWords([[big, 1], [small, q.b - 10]])]
      return hintOf([say(q.pair === 'ht' ? 'hint.pv.tenTensHundred' : 'hint.pv.tenOnesTen'), ...told], visual)
    }
  }
}

export default {
  ...meta,
  kinds: ['choice', 'keypad', 'buildBase', 'fillSlots'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id as Family, rng), avoid),
  answer,
  answerTypeFor,
  answerType: () => 'int',
  accept,
  options,
  prompt,
  optionView: () => 'numeral',
  range: () => [0, PLACE_VALUE_MAX],
  speech,
  candidates,
  hint: (f, tag, kind) => hint(f, tag, kind),
  guessFloor,
} satisfies SkillModule
