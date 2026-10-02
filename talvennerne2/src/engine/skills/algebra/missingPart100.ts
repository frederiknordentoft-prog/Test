// missingPart100 — Det manglende tal til 100 (SPEC §2.2: four families, pædagogik-forslaget §1.3
// missingPart20 widened to 100). Procedure, prefix `mp100:`; the id is the equation with '?' for the
// missing number, so it names its family:
//   addendCross20  mp100:<a>+?=<c>    a two-digit, c = 21–99, the missing part crosses a ten (38 + ? = 45)
//   toHundred      mp100:<a>+?=100    a = 11–89 (37 + ? = 100), or
//                  mp100:100-<a>=?    the same as a difference (100 − 37 = ?)
//   subtrahend     mp100:<c>-?=<d>    c = 21–99, the missing part 3–49, mostly with a borrow (52 − ? = 38)
//   minuend        mp100:?-<b>=<d>    the start is missing, ? = b + d ≤ 99 (? − 27 = 38)
// enumerate() gives 20 seeded instances per family. The question is composed (speech/equation.ts):
// "Otteogtredive plus hvad giver femogfyrre?", "Hvad er et hundrede minus syvogtredive?", "Tooghalvtreds
// minus hvad giver otteogtredive?", "Hvad minus syvogtyve giver otteogtredive?".
// Kinds: choice, keypad (production). Range 0–100 (three keypad digits, so 137 can be typed).
// Speed: choice 10 s, keypad 15 s (as add100Carry and sub100Borrow).
// Wrong answers (pædagogik §3.2, SPEC §4.2):
//   equalsAsAnswer     a + ? = c answered a + c (38 + ? = 45 → 83; 37 + ? = 100 → 137)
//   digitComplement10  toHundred: each digit made up to ten (37 + ? = 100 → 73, 100 − 37 → 73)
//   wrongOperation     the other operation on the two numbers shown: 100 − 37 → 137, 52 − ? = 38 → 90,
//                      ? − 27 = 38 → 11
// plus the numbers from the question ('operand') and near misses (±1, ±2, ±10). A misconception value
// that is also a number of the question (55 + ? = 100 → 55) is 'ambiguous' (A9).
// Hint, the empty number line (2. klasse): count up from the smaller number to the bigger one —
// "Start på otteogtredive. Hop to frem til fyrre. Hop fem frem til femogfyrre. Hoppene giver tilsammen
// syv." The minuend family hops the subtracted part back on: "… Svaret er femogtres." Misconception
// hints say why first (the equals sign, the whole way to a hundred, the operation).
import type { ErrorTag, Fact, FamilyDef, HintSpec, Prompt, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import type { Term } from '../../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import { equationSpeech } from '../../../speech/equation'
import { answerIs, around, canonicalFacts, digitComplement10, drawInstance, hopLine, hopSpeech, meaningOf, plusStops, swapHint, type Drawer } from '../addsub/calc'

type Family = 'addendCross20' | 'toHundred' | 'subtrahend' | 'minuend'

/** One instance: which number is missing, and the numbers shown. */
type Missing =
  | { family: 'addendCross20' | 'toHundred'; form: 'addend'; a: number; c: number }
  | { family: 'toHundred'; form: 'difference'; a: number }
  | { family: 'subtrahend'; c: number; d: number }
  | { family: 'minuend'; b: number; d: number }

const FAST: Partial<Record<TaskKind, number>> = { choice: 10_000, keypad: 15_000 }
const META = metaOf('missingPart100')
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))
const RANK: Readonly<Record<string, number>> = Object.fromEntries(FAMILIES.map((f) => [f.id, f.rank]))

function idOf(q: Missing): string {
  switch (q.family) {
    case 'subtrahend':
      return `mp100:${q.c}-?=${q.d}`
    case 'minuend':
      return `mp100:?-${q.b}=${q.d}`
    default:
      return q.form === 'difference' ? `mp100:100-${q.a}=?` : `mp100:${q.a}+?=${q.c}`
  }
}

/** The instance from its id (also for a fact the round screen rebuilt from its task). */
function parse(f: Pick<Fact, 'id'>): Missing {
  let m = /^mp100:(\d+)\+\?=(\d+)$/.exec(f.id)
  if (m) {
    const a = Number(m[1])
    const c = Number(m[2])
    return { family: c === 100 ? 'toHundred' : 'addendCross20', form: 'addend', a, c }
  }
  if ((m = /^mp100:100-(\d+)=\?$/.exec(f.id))) return { family: 'toHundred', form: 'difference', a: Number(m[1]) }
  if ((m = /^mp100:(\d+)-\?=(\d+)$/.exec(f.id))) return { family: 'subtrahend', c: Number(m[1]), d: Number(m[2]) }
  if ((m = /^mp100:\?-(\d+)=(\d+)$/.exec(f.id))) return { family: 'minuend', b: Number(m[1]), d: Number(m[2]) }
  throw new Error(`not a missingPart100 fact: ${f.id}`)
}

function answerOf(q: Missing): number {
  switch (q.family) {
    case 'subtrahend':
      return q.c - q.d
    case 'minuend':
      return q.b + q.d
    default:
      return q.form === 'difference' ? 100 - q.a : q.c - q.a
  }
}

/** The numbers shown in the question. */
function shownOf(q: Missing): number[] {
  switch (q.family) {
    case 'subtrahend':
      return [q.c, q.d]
    case 'minuend':
      return [q.b, q.d]
    default:
      return q.form === 'difference' ? [100, q.a] : [q.a, q.c]
  }
}

function terms(q: Missing): Term[] {
  const blank: Term = { blank: true }
  switch (q.family) {
    case 'subtrahend':
      return [{ n: q.c }, { op: '−' }, blank, { op: '=' }, { n: q.d }]
    case 'minuend':
      return [blank, { op: '−' }, { n: q.b }, { op: '=' }, { n: q.d }]
    default:
      return q.form === 'difference'
        ? [{ n: 100 }, { op: '−' }, { n: q.a }, { op: '=' }, blank]
        : [{ n: q.a }, { op: '+' }, blank, { op: '=' }, { n: q.c }]
  }
}

const make = (q: Missing): Fact => ({
  id: idOf(q), skill: 'missingPart100', family: q.family, operands: shownOf(q), answer: answerOf(q), rank: RANK[q.family],
})

/** A two-digit number with ones 1–9. */
const twoDigit = (rng: Rng, lo = 1, hi = 9) => 10 * rng.between(lo, hi) + rng.between(1, 9)

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    switch (family as Family) {
      case 'addendCross20': {
        const a = twoDigit(rng, 1, 8)
        const x = rng.between(3, 49)
        const c = a + x
        if (c < 21 || c > 99 || (a % 10) + (x % 10) < 10) return null
        return make({ family: 'addendCross20', form: 'addend', a, c })
      }
      case 'toHundred': {
        const a = rng.next() < 0.8 ? twoDigit(rng, 1, 8) : 10 * rng.between(1, 8)
        return make(rng.next() < 0.6 ? { family: 'toHundred', form: 'addend', a, c: 100 } : { family: 'toHundred', form: 'difference', a })
      }
      case 'subtrahend': {
        const c = twoDigit(rng, 2, 9)
        const x = rng.between(3, 49)
        const d = c - x
        if (d < 2) return null
        if (c % 10 >= x % 10 && rng.next() < 0.8) return null // mostly with a borrow
        return make({ family: 'subtrahend', c, d })
      }
      case 'minuend': {
        const b = rng.between(3, 49)
        const d = rng.between(3, 60)
        return b + d <= 99 && b !== d ? make({ family: 'minuend', b, d }) : null
      }
      default:
        return null
    }
  },
}

const CANON = canonicalFacts('missingPart100', drawer, FAMILIES)

/** Count up on the empty number line from `from` to `to`: the hops and what they make together. */
function countUp(from: number, to: number): { speech: SpeechPart[]; stops: number[] } {
  const stops = plusStops(from, to - from)
  return { speech: [...hopSpeech(stops), say('hint.addsub2.together'), num(to - from)], stops }
}

function strategy(q: Missing): { speech: SpeechPart[]; stops: number[] } {
  switch (q.family) {
    case 'subtrahend':
      return countUp(q.d, q.c)
    case 'minuend': {
      const stops = plusStops(q.d, q.b)
      return { speech: [...hopSpeech(stops), ...answerIs(q.b + q.d)], stops }
    }
    default:
      return q.form === 'difference' ? countUp(q.a, 100) : countUp(q.a, q.c)
  }
}

/** The equation with its missing number filled in, on the balance. */
function balanceOf(q: Missing): Prompt {
  const filled = terms(q).map((t): Term => ('blank' in t ? { n: answerOf(q) } : t))
  const eq = filled.findIndex((t) => 'op' in t && t.op === '=')
  return { scene: 'balance', left: filled.slice(0, eq), right: filled.slice(eq + 1) }
}

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const q = parse(f)
  const x = answerOf(q)
  if (tag === 'digitSwap') return swapHint(x)
  const s = strategy(q)
  const line = hopLine(s.stops)
  switch (tag) {
    case 'equalsAsAnswer':
      return hintOf([say('hint.algebra2.sameBothSides'), ...s.speech], balanceOf(q), 'equalsAsAnswer', true)
    case 'digitComplement10':
      return hintOf([say('hint.missingPart100.wholeWay'), ...s.speech], line, 'digitComplement10')
    case 'wrongOperation':
      return hintOf(
        [q.family === 'minuend' ? say('hint.missingPart100.startNumber') : meaningOf('−'), ...s.speech],
        line,
        'wrongOperation',
      )
    default:
      return hintOf(s.speech, line)
  }
}

export default {
  ...META,
  families: FAMILIES,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...CANON],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawInstance(drawer, family, rng, avoid),
  answerType: () => 'int',
  prompt: (f) => ({ scene: 'equation', terms: terms(parse(f)) }),
  optionView: () => 'numeral',
  range: () => [0, 100],
  speech: (f) => equationSpeech(terms(parse(f))),
  candidates(f) {
    const q = parse(f)
    const x = answerOf(q)
    const mis: [number, ErrorTag][] = []
    switch (q.family) {
      case 'subtrahend':
        mis.push([q.c + q.d, 'wrongOperation'])
        break
      case 'minuend':
        mis.push([Math.abs(q.d - q.b), 'wrongOperation'])
        break
      default:
        if (q.form === 'addend') mis.push([q.a + q.c, 'equalsAsAnswer'])
        else mis.push([100 + q.a, 'wrongOperation'])
        if (q.family === 'toHundred') {
          const dc = digitComplement10(100, q.a)
          if (dc !== null) mis.push([dc, 'digitComplement10'])
        }
    }
    return tagged(x, [
      ...mis,
      ...shownOf(q).map((n) => [n, 'operand'] as const),
      ...around(x, [1, 2, 10]).map((v) => [v, 'near'] as const),
    ])
  },
  hint,
  fastMs: (_f: Fact, kind: TaskKind) => FAST[kind],
} satisfies SkillModule
