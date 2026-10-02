// tensOnes — Tiere og enere (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `to:`.
//   build      to:build:<n>             n = 10–99: rods and cubes → the number                 90
//   decompose  to:decompose:tens:<n>    "Hvor mange tiere er der i syvogfyrre?" n = 10–99       90
//              to:decompose:ones:<n>    "Hvor mange enere …?" n = 11–99, not whole tens          81
//   swapped    to:swapped:<n>           "Tre enere og fem tiere" (ones said first, blocks ones
//                                       first) → 53, n with two non-zero digits                 81
//   expand     to:expand:<n>            "Syvogfyrre er fyrre plus hvad?" (47 = 40 + □) → 7       81
// Kinds, all about the same instance:
//   choice / keypad  the question above (keypad: production). Blocks are drawn tens first, except in
//                    swapped, where the ones come first as they are said.
//   buildBase        production: build the number from its numeral (build, decompose: only its tens
//                    or ones — "Byg kun tierne i syvogfyrre" → 40), from the words (swapped), or
//                    build what is missing (expand → 7). The answer is what the blocks are worth.
//   fillSlots        not production here (SPEC §2.2): the number's two digits in the right order, tens
//                    first ('4|7'); expand fills 47 = □ + □ from 4, 40, 7 and 70 ('40|7', either order).
// Wrong answers (pædagogik §3.2), tagged on the facts' numbers — the counts in the picture or the
// words are operands, the number in the question is one:
//   addsPlaceParts  4 tiere og 7 enere → 11 (build, swapped). With no ones, 4 is also the count of
//                   rods in the picture: an operand, so 'ambiguous' (A9).
//   digitSwap       74 for 47, the digits in the order Danish says them (build, swapped; '7|4' and
//                   '70|4' on the palette), and in decompose the other digit (7 tiere in syvogfyrre).
//   faceValue       decompose: the tens' value instead of their number (40 for "hvor mange tiere");
//                   in 40 itself that is the number in the question ('ambiguous', A9). expand on the
//                   palette: the digits instead of their values ('4|7').
//   near/other      ±1, ±10; in expand the tens digit, the ones as tens.
// Hints: the blocks with "fire tiere og syv enere", and a sentence for each misconception.
import type { AnswerType, AnswerValue, Fact, FamilyDef, HintSpec, Prompt, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import { digitSwapOf } from '../../misconceptions'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'
import { blocks, canonical, drawAvoiding, familyRank, isPlaces, joined, onesOf, placeCount, placeNoun, placeWords, tensOf, within } from './kit'

const meta = metaOf('tensOnes')

type Family = 'build' | 'decompose' | 'swapped' | 'expand'
type Part = 'tens' | 'ones'

type TensOnes =
  | { family: 'build' | 'swapped' | 'expand'; n: number }
  | { family: 'decompose'; part: Part; n: number }

const idOf = (q: TensOnes): string => (q.family === 'decompose' ? `to:decompose:${q.part}:${q.n}` : `to:${q.family}:${q.n}`)

function parseTensOnes(id: string): TensOnes {
  const bits = id.split(':')
  if (bits[1] === 'decompose') return { family: 'decompose', part: bits[2] === 'ones' ? 'ones' : 'tens', n: Number(bits[3]) }
  return { family: bits[1] as 'build', n: Number(bits[2]) }
}

const parse = (f: Fact): TensOnes => parseTensOnes(f.id)

/** The answer to the question on cards and the keypad. */
function answerOf(q: TensOnes): number {
  const t = tensOf(q.n)
  const o = onesOf(q.n)
  switch (q.family) {
    case 'decompose':
      return q.part === 'tens' ? t : o
    case 'expand':
      return o
    default:
      return q.n
  }
}

function make(q: TensOnes): Fact {
  const t = tensOf(q.n)
  const o = onesOf(q.n)
  // the numbers the child is given: the counts of rods and cubes, or the number in the question
  const operands = q.family === 'build' || q.family === 'swapped' ? [t, o] : q.family === 'expand' ? [q.n, t * 10] : [q.n]
  return { id: idOf(q), skill: 'tensOnes', family: q.family, operands, answer: answerOf(q), rank: familyRank(meta.families, q.family) }
}

const twoDigits = (n: number) => tensOf(n) > 0 && onesOf(n) > 0

function draw(family: Family, rng: Rng): Fact {
  switch (family) {
    case 'build':
      return make({ family, n: rng.between(10, 99) })
    case 'decompose': {
      // ones of a whole ten would be 0: no blocks to build, so only tens are asked there
      const n = rng.between(10, 99)
      const part: Part = onesOf(n) === 0 || rng.next() < 0.5 ? 'tens' : 'ones'
      return make({ family, part, n })
    }
    case 'swapped':
    case 'expand': {
      let n = rng.between(11, 99)
      while (!twoDigits(n)) n = rng.between(11, 99)
      return make({ family, n })
    }
  }
}

const FACTS: readonly Fact[] = meta.families.flatMap((fam) => canonical('tensOnes', fam.id, (rng) => draw(fam.id as Family, rng)))

// ─── Per kind ───────────────────────────────────────────────────────────────

/** What the built blocks are worth: the number, only its tens or ones, or what is missing. */
function builtValue(q: TensOnes): number {
  if (q.family === 'decompose') return q.part === 'tens' ? tensOf(q.n) * 10 : onesOf(q.n)
  if (q.family === 'expand') return onesOf(q.n)
  return q.n
}

function answer(f: Fact, kind: TaskKind): AnswerValue {
  const q = parse(f)
  const t = tensOf(q.n)
  const o = onesOf(q.n)
  if (kind === 'fillSlots') return q.family === 'expand' ? joined([t * 10, o]) : joined([t, o])
  if (kind === 'buildBase') return builtValue(q)
  return answerOf(q)
}

const answerTypeFor = (_f: Fact, kind: TaskKind): AnswerType => (kind === 'fillSlots' ? 'set' : 'int')

/** 47 = 40 + 7 may be filled as 7 + 40 too. */
function accept(f: Fact, kind: TaskKind): AnswerValue[] {
  const q = parse(f)
  return kind === 'fillSlots' && q.family === 'expand' ? [joined([onesOf(q.n), tensOf(q.n) * 10])] : []
}

/**
 * The palette. tensOnes' fillSlots is not production (SPEC §2.2): the two digits of the number
 * (and one more when they are the same) — what is asked is their order, tens first, so a guess hits
 * one time in four. For 47 = □ + □: its digits and its tens (4, 40, 7, 70), where either order of
 * 40 and 7 is right — two in sixteen (guessFloor below).
 */
function palette(q: TensOnes): number[] {
  const t = tensOf(q.n)
  const o = onesOf(q.n)
  if (q.family !== 'expand') return t === o ? [t, t === 9 ? 8 : t + 1] : [t, o]
  const spare = t === o ? (t === 9 ? 8 : t + 1) : null
  return spare === null ? [t, t * 10, o, o * 10] : [t, t * 10, spare, spare * 10]
}

function options(f: Fact, kind: TaskKind, rng: Rng): AnswerValue[] {
  return kind === 'fillSlots' ? rng.shuffle(palette(parse(f))) : []
}

/** fillSlots: the right fillings (both orders of 40 + 7) over every filling of the slots. */
function guessFloor(f: Fact, kind: TaskKind): number {
  if (kind !== 'fillSlots') return 0
  const q = parse(f)
  return (1 + accept(f, kind).length) / palette(q).length ** 2
}

const numeral = (n: number): Prompt => ({ scene: 'equation', terms: [{ n }] })

function prompt(f: Fact, kind: TaskKind): Prompt {
  const q = parse(f)
  const t = tensOf(q.n)
  switch (q.family) {
    case 'build':
      return kind === 'buildBase' ? numeral(q.n) : blocks(q.n)
    case 'decompose':
      return numeral(q.n)
    case 'swapped':
      return kind === 'buildBase' ? { scene: 'hear' } : blocks(q.n, 'oth')
    case 'expand':
      return kind === 'fillSlots'
        ? { scene: 'equation', terms: [{ n: q.n }, { op: '=' }, { blank: true }, { op: '+' }, { blank: true }] }
        : { scene: 'equation', terms: [{ n: q.n }, { op: '=' }, { n: t * 10 }, { op: '+' }, { blank: true }] }
  }
}

/** "Tre enere og fem tiere" — the ones said first, as in the family's name. */
const onesThenTens = (n: number, form: 'mid' | 'end'): SpeechPart[] => placeWords([['o', onesOf(n)], ['t', tensOf(n)]], form)

function speech(f: Fact, kind: TaskKind): SpeechPart[] {
  const q = parse(f)
  const t = tensOf(q.n)
  switch (q.family) {
    case 'build':
      if (kind === 'buildBase') return [say('s.place.build'), num(q.n)]
      return kind === 'fillSlots' ? [say('s.place.whichNumberBlocks'), say('s.place.writeWithTokens')] : [say('s.place.whichNumberBlocks')]
    case 'decompose':
      if (kind === 'buildBase') return [say(q.part === 'tens' ? 's.place.buildOnlyTens' : 's.place.buildOnlyOnes'), num(q.n)]
      if (kind === 'fillSlots') return [say('s.place.howManyTensOnes'), num(q.n)]
      return [say(q.part === 'tens' ? 's.place.howManyTens' : 's.place.howManyOnes'), num(q.n)]
    case 'swapped':
      if (kind === 'buildBase') return [say('s.place.lay'), ...onesThenTens(q.n, 'end')]
      return [...onesThenTens(q.n, 'end'), say(kind === 'fillSlots' ? 's.place.writeNumberWithTokens' : 's.place.whichNumber')]
    case 'expand':
      if (kind === 'fillSlots') return [num(q.n, 'mid'), say('hint.place.is'), say('frag.hvad'), say('op.plus'), say('frag.hvad')]
      return [num(q.n, 'mid'), say('hint.place.is'), num(t * 10, 'mid'), say('op.plus'), say('frag.hvad'), ...(kind === 'buildBase' ? [say('s.place.buildMissing')] : [])]
  }
}

function candidates(f: Fact) {
  const q = parse(f)
  const n = q.n
  const t = tensOf(n)
  const o = onesOf(n)
  const swap = digitSwapOf(n)
  const ok = within(0, 99)
  const near = (...vs: number[]): Entry[] => vs.filter(ok).map((v) => [v, 'near'] as const)
  switch (q.family) {
    case 'build':
    case 'swapped':
      return tagged(n, [
        [t + o, 'addsPlaceParts'], [t, 'operand'], [o, 'operand'],
        ...(swap !== null ? ([[swap, 'digitSwap'], [joined([o, t]), 'digitSwap']] as const) : []),
        ...near(n - 1, n + 1, n - 10, n + 10),
      ])
    case 'decompose': {
      const ans = answerOf(q)
      const other = q.part === 'tens' ? o : t
      return tagged(ans, [
        [n, 'operand'],
        ...(q.part === 'tens' ? ([[t * 10, 'faceValue']] as const) : []),
        // the other digit: syv tiere in syvogfyrre, said first
        ...(other !== 0 && other !== ans ? ([[other, 'digitSwap']] as const) : []),
        ...(swap !== null ? ([[joined([o, t]), 'digitSwap']] as const) : []),
        ...[ans - 1, ans + 1].filter(within(0, 9)).map((v) => [v, 'near'] as const),
      ])
    }
    case 'expand':
      return tagged(o, [
        [n, 'operand'], [t * 10, 'operand'], [t, 'other'], [o * 10, 'other'],
        ...[o - 1, o + 1].filter(within(1, 9)).map((v) => [v, 'near'] as const),
        // on the palette: the digits for their values, or the number reversed (70 + 4)
        [joined([t, o]), 'faceValue'], [joined([o, t]), 'faceValue'],
        ...(swap !== null ? ([[joined([o * 10, t]), 'digitSwap'], [joined([t, o * 10]), 'digitSwap']] as const) : []),
      ])
  }
}

/**
 * "Byg kun tierne i syvogfyrre" is answered with what the blocks are worth (40), so its slips are about
 * blocks: four cubes (the digit, not its value: faceValue), seven rods (the other digit as tens, said
 * first: digitSwap); seven cubes are just wrong. Every other presentation has the fact's candidates.
 */
function candidatesFor(f: Fact, kind: TaskKind) {
  const q = parse(f)
  if (kind !== 'buildBase' || q.family !== 'decompose' || q.part !== 'tens') return candidates(f)
  const t = tensOf(q.n)
  const o = onesOf(q.n)
  const built = t * 10
  return tagged(built, [
    [q.n, 'operand'],
    [t, 'faceValue'],
    ...(o !== 0 && o !== t ? ([[o * 10, 'digitSwap']] as const) : []),
    ...[built - 10, built + 10, built - 1, built + 1].filter(within(0, 99)).map((v) => [v, 'near'] as const),
  ])
}

// ─── Hints ──────────────────────────────────────────────────────────────────

/** "Vi siger syv først, men vi skriver tierne først." */
const saySwap = (n: number): SpeechPart[] => [say('hint.hear20.weSay'), num(onesOf(n), 'mid'), say('hint.hear.butTensFirst')]

/** "En stang er ti, ikke en. Fire stænger er fyrre." */
function rodsAreTens(n: number): SpeechPart[] {
  const t = tensOf(n)
  return [say('hint.place.rodIsTen'), num(t, 'mid'), say(t === 1 ? 'hint.place.rodIs' : 'hint.place.rodsAre'), num(t * 10)]
}

function hint(f: Fact, tag: string | null, kind?: TaskKind): HintSpec {
  const q = parse(f)
  const n = q.n
  const t = tensOf(n)
  const o = onesOf(n)
  const visual = blocks(n)
  const swapped = tag === 'digitSwap' && digitSwapOf(n) !== null
  switch (q.family) {
    case 'build':
    case 'swapped': {
      // "Fem tiere og tre enere er treoghalvtreds."
      const sentence = [...placeWords(o === 0 ? [['t', t]] : [['t', t], ['o', o]], 'mid'), say('hint.place.is'), num(n)]
      if (tag === 'addsPlaceParts') return hintOf([...rodsAreTens(n), ...sentence], visual, 'addsPlaceParts')
      if (swapped) return hintOf([...sentence, ...saySwap(n)], visual, 'digitSwap', true)
      const lead = q.family === 'build' ? say('hint.place.countRodsFirst') : say('hint.place.tensFirstAlways')
      return hintOf(q.family === 'build' ? [lead, ...sentence] : [...sentence, lead], visual)
    }
    case 'decompose': {
      const said = isPlaces(n, o === 0 ? [['t', t]] : [['t', t], ['o', o]])
      if (tag === 'faceValue' && q.part === 'tens') {
        // "Fire tiere er fyrre værd. Men der er fire tiere."
        const worth = [placeCount('t', t), placeNoun('t', t, 'mid'), say('hint.place.is'), num(t * 10, 'mid'), say('hint.place.worthEnd')]
        return hintOf([...worth, say('hint.place.butThereAre'), placeCount('t', t), placeNoun('t', t, 'end')], visual, 'faceValue')
      }
      if (tag === 'digitSwap' && o !== 0 && o !== t) return hintOf([...said, ...saySwap(n)], visual, 'digitSwap', true)
      if (kind === 'buildBase') return hintOf([...said, say(q.part === 'tens' ? 'hint.place.buildRods' : 'hint.place.buildCubes')], visual)
      return hintOf([...said, say('hint.place.tensDigitFirst')], visual)
    }
    case 'expand': {
      // "Syvogfyrre er fire tiere og syv enere. Fire tiere er fyrre. Det, der mangler, er syv."
      const said = isPlaces(n)
      const tens = [placeCount('t', t), placeNoun('t', t, 'mid'), say('hint.place.is'), num(t * 10)]
      if (tag === 'faceValue') {
        // "Firetallet står på tiernes plads. Så er det fyrre værd."
        const digit = [say(`noun.digit.${t}.mid`), say('hint.place.onTensPlace'), say('hint.place.soItIs'), num(t * 10, 'mid'), say('hint.place.worthEnd')]
        return hintOf([...said, ...digit], visual, 'faceValue')
      }
      if (swapped) return hintOf([...said, ...saySwap(n)], visual, 'digitSwap', true)
      return hintOf([...said, ...tens, say('hint.place.missingIs'), num(o)], visual)
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
  range: () => [0, 99],
  speech,
  candidates,
  candidatesFor,
  hint: (f, tag, kind) => hint(f, tag, kind),
  guessFloor,
} satisfies SkillModule
