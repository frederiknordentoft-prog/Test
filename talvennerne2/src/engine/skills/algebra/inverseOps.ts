// inverseOps — Regnefamilier (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `inv:`, three
// families; an instance is the known fact, then the asked one:
//   addToSub       inv:<a>+<b>:<c>-<s>   a + b = c is shown, c − s asked (s = a or b): 7 + 5 = 12, så 12 − 5 = ?
//   subToAdd       inv:<c>-<b>:<p>+<q>   c − b = a is shown, a + b asked (either order): 12 − 5 = 7, så 7 + 5 = ?
//   mulToDiv (3.)  inv:<a>x<b>:<c>/<s>   a · b = c is shown, c : s asked: 3 · 4 = 12, så 12 : 4 = ?
// Plus and minus: 40 % one-digit numbers over ten (7 + 5 = 12), else a two-digit sum up to 99
// (38 + 17 = 55). mulToDiv: the small table, factors 2–10.
// The card shows both equations ("7 + 5 = 12 så 12 − 5 = □"); the voice reads "Syv plus fem giver tolv.
// Hvad er tolv minus fem?" (division: "Hvad er tolv divideret med fire?", op.divideret_med — mulToDiv is
// 3. klasse, where ":" is read "divideret med", SPEC A19; A12's "delt med" stays in 0.–2. klasse).
// Kinds: choice, keypad (production). Range 0–100. Speed: choice 8 s, keypad 10 s (two equations to read).
// Wrong answers: wrongOperation — the other operation on the asked numbers (12 − 5 → 17, 7 + 5 → 2,
// 12 : 4 → 48 or 8), the numbers shown ('operand'; the answer itself stands in the known fact) and
// near misses (±1, ±2, ±10). A wrongOperation value that is also a number on the card (12 − 4 = 8,
// så 8 + 4 → 4) is 'ambiguous' (A9).
// Hint: the family — "Plus og minus hører sammen. Syv plus fem giver tolv. Så giver tolv minus fem syv."
// with the hop on a number line (mulToDiv: the array). wrongOperation says what the sign means first.
import type { ErrorTag, Fact, FamilyDef, HintSpec, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import type { Term } from '../../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import { equationSpeech } from '../../../speech/equation'
import { around, canonicalFacts, drawInstance, hopLine, meaningOf, swapHint, type Drawer } from '../addsub/calc'

type Family = 'addToSub' | 'subToAdd' | 'mulToDiv'

/** The known fact `a op b = c` and the asked one `c op' s` (subToAdd: `p + q`). */
type Pair =
  | { family: 'addToSub'; a: number; b: number; s: number }
  | { family: 'subToAdd'; c: number; b: number; p: number; q: number }
  | { family: 'mulToDiv'; a: number; b: number; s: number }

const FAST: Partial<Record<TaskKind, number>> = { choice: 8_000, keypad: 10_000 }
const META = metaOf('inverseOps')
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))
const RANK: Readonly<Record<string, number>> = Object.fromEntries(FAMILIES.map((f) => [f.id, f.rank]))

function idOf(q: Pair): string {
  switch (q.family) {
    case 'addToSub':
      return `inv:${q.a}+${q.b}:${q.a + q.b}-${q.s}`
    case 'subToAdd':
      return `inv:${q.c}-${q.b}:${q.p}+${q.q}`
    case 'mulToDiv':
      return `inv:${q.a}x${q.b}:${q.a * q.b}/${q.s}`
  }
}

/** The instance from its id (also for a fact the round screen rebuilt from its task). */
function parse(f: Pick<Fact, 'id'>): Pair {
  let m = /^inv:(\d+)\+(\d+):(\d+)-(\d+)$/.exec(f.id)
  if (m) return { family: 'addToSub', a: Number(m[1]), b: Number(m[2]), s: Number(m[4]) }
  if ((m = /^inv:(\d+)-(\d+):(\d+)\+(\d+)$/.exec(f.id))) return { family: 'subToAdd', c: Number(m[1]), b: Number(m[2]), p: Number(m[3]), q: Number(m[4]) }
  if ((m = /^inv:(\d+)x(\d+):(\d+)\/(\d+)$/.exec(f.id))) return { family: 'mulToDiv', a: Number(m[1]), b: Number(m[2]), s: Number(m[4]) }
  throw new Error(`not an inverseOps fact: ${f.id}`)
}

function answerOf(q: Pair): number {
  switch (q.family) {
    case 'addToSub':
      return q.a + q.b - q.s
    case 'subToAdd':
      return q.c
    case 'mulToDiv':
      return (q.a * q.b) / q.s
  }
}

/** Every number on the card. */
function shownOf(q: Pair): number[] {
  switch (q.family) {
    case 'addToSub':
      return [q.a, q.b, q.a + q.b, q.s]
    case 'subToAdd':
      return [q.c, q.b, q.c - q.b, q.p, q.q]
    case 'mulToDiv':
      return [q.a, q.b, q.a * q.b, q.s]
  }
}

/** Known fact, "så", the asked one with its blank. */
function terms(q: Pair): Term[] {
  const so: Term = { text: 'frag.inverseOps.so' }
  switch (q.family) {
    case 'addToSub': {
      const c = q.a + q.b
      return [{ n: q.a }, { op: '+' }, { n: q.b }, { op: '=' }, { n: c }, so, { n: c }, { op: '−' }, { n: q.s }, { op: '=' }, { blank: true }]
    }
    case 'subToAdd':
      return [{ n: q.c }, { op: '−' }, { n: q.b }, { op: '=' }, { n: q.c - q.b }, so, { n: q.p }, { op: '+' }, { n: q.q }, { op: '=' }, { blank: true }]
    case 'mulToDiv': {
      const c = q.a * q.b
      return [{ n: q.a }, { op: '·' }, { n: q.b }, { op: '=' }, { n: c }, so, { n: c }, { op: ':' }, { n: q.s }, { op: '=' }, { blank: true }]
    }
  }
}

/** "Syv plus fem giver tolv." */
const known = (x: number, op: string, y: number, z: number): SpeechPart[] => [num(x, 'mid'), say(op), num(y, 'mid'), say('op.giver'), num(z)]

function speech(f: Fact): SpeechPart[] {
  const q = parse(f)
  switch (q.family) {
    case 'addToSub': {
      const c = q.a + q.b
      return [...known(q.a, 'op.plus', q.b, c), ...equationSpeech([{ n: c }, { op: '−' }, { n: q.s }, { op: '=' }, { blank: true }])]
    }
    case 'subToAdd':
      return [...known(q.c, 'op.minus', q.b, q.c - q.b), ...equationSpeech([{ n: q.p }, { op: '+' }, { n: q.q }, { op: '=' }, { blank: true }])]
    case 'mulToDiv': {
      const c = q.a * q.b
      return [...known(q.a, 'op.gange', q.b, c), say('frag.hvad_er'), num(c, 'mid'), say('op.divideret_med'), num(q.s)]
    }
  }
}

const make = (q: Pair): Fact => ({ id: idOf(q), skill: 'inverseOps', family: q.family, operands: shownOf(q), answer: answerOf(q), rank: RANK[q.family] })

/** Two addends: one-digit over ten (40 %) or a two-digit sum up to 99. */
function addends(rng: Rng): [number, number] | null {
  if (rng.next() < 0.4) {
    const a = rng.between(2, 9)
    const b = rng.between(2, 9)
    return a + b > 10 ? [a, b] : null
  }
  const a = rng.between(11, 79)
  const b = rng.between(3, 39)
  return a + b <= 99 ? [a, b] : null
}

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    switch (family as Family) {
      case 'addToSub': {
        const ab = addends(rng)
        if (!ab || ab[0] === ab[1]) return null
        return make({ family: 'addToSub', a: ab[0], b: ab[1], s: rng.pick(ab) })
      }
      case 'subToAdd': {
        const ab = addends(rng)
        if (!ab || ab[0] === ab[1]) return null
        const [a, b] = ab
        const [p, q] = rng.next() < 0.5 ? [a, b] : [b, a]
        return make({ family: 'subToAdd', c: a + b, b, p, q })
      }
      case 'mulToDiv': {
        const a = rng.between(2, 10)
        const b = rng.between(2, 10)
        return make({ family: 'mulToDiv', a, b, s: rng.pick([a, b]) })
      }
      default:
        return null
    }
  },
}

const CANON = canonicalFacts('inverseOps', drawer, FAMILIES)

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const q = parse(f)
  const x = answerOf(q)
  if (tag === 'digitSwap') return swapHint(x)
  let words: SpeechPart[]
  let visual: HintSpec['visual']
  let meaning: SpeechPart
  switch (q.family) {
    case 'addToSub': {
      const c = q.a + q.b
      words = [say('hint.inverseOps.plusMinus'), ...known(q.a, 'op.plus', q.b, c), say('hint.inverseOps.soGives'), num(c, 'mid'), say('op.minus'), num(q.s, 'mid'), num(x)]
      visual = hopLine([c, x])
      meaning = meaningOf('−')
      break
    }
    case 'subToAdd': {
      const a = q.c - q.b
      words = [say('hint.inverseOps.plusMinus'), ...known(q.c, 'op.minus', q.b, a), say('hint.inverseOps.soGives'), num(q.p, 'mid'), say('op.plus'), num(q.q, 'mid'), num(x)]
      visual = hopLine([q.p, x])
      meaning = meaningOf('+')
      break
    }
    case 'mulToDiv': {
      const c = q.a * q.b
      words = [say('hint.inverseOps.timesDivide'), ...known(q.a, 'op.gange', q.b, c), say('hint.inverseOps.soGives'), num(c, 'mid'), say('op.divideret_med'), num(q.s, 'mid'), num(x)]
      visual = { scene: 'array', rows: x, cols: q.s }
      meaning = say('hint.inverseOps.divideMeans')
      break
    }
  }
  if (tag === 'wrongOperation') return hintOf([meaning, ...words], visual, 'wrongOperation')
  return hintOf(words, visual)
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
  speech,
  candidates(f) {
    const q = parse(f)
    const x = answerOf(q)
    const wrong: number[] =
      q.family === 'addToSub' ? [q.a + q.b + q.s]
        : q.family === 'subToAdd' ? [Math.abs(q.p - q.q)]
          : [q.a * q.b * q.s, q.a * q.b - q.s]
    return tagged(x, [
      ...wrong.map((v) => [v, 'wrongOperation'] as const),
      ...shownOf(q).map((n) => [n, 'operand'] as const),
      ...around(x, q.family === 'mulToDiv' ? [1, 2] : [1, 2, 10]).map((v) => [v, 'near'] as const),
    ])
  },
  hint,
  fastMs: (_f: Fact, kind: TaskKind) => FAST[kind],
} satisfies SkillModule
