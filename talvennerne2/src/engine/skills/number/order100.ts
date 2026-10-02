// order100 — Tal til 100 i rækkefølge (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `o100:`.
//   plus1           o100:plus1:<n>             n = 20–98, not x9 (no new ten), answer n + 1
//   minus1          o100:minus1:<n>            n = 21–99, not x0, answer n − 1
//   plus10          o100:plus10:<n>            n = 10–89, answer n + 10
//   minus10         o100:minus10:<n>           n = 20–99, answer n − 10
//   crossTen        o100:crossTen:after:<n>    n = 19, 29 … 99, answer n + 1 (39 → 40, 99 → 100)
//                   o100:crossTen:before:<n>   n = 20, 30 … 100, answer n − 1 (70 → 69)       18 (all canonical)
//   biggerDiffTens  o100:biggerDiffTens:<x>:<y>  different tens, the smaller number has the bigger ones
//                                               digit (47 and 62); spoken in this order, answer max
//   biggerSwapped   o100:biggerSwapped:<x>:<y>   the same two digits swapped (46 and 64), answer max
// Kinds: choice on the 100-board (the "?" cell, or the three cards' numbers lit up for "Hvilket tal er
// størst?"), keypad on stepping stones (production, the board stays out of it), and sortOrder
// (production): count on or back four stones — in tens for ±10 — or put four numbers biggest first.
// sortOrder comes first among the production kinds, because "the bigger of two" on a keypad is a
// coin flip (guessFloor 0.5): a trial or a key in box ≥ 3 is asked the hard way in every family.
// Wrong answers: the given number itself ('operand'), the neighbours (±1, ±2) and ±10 ('near', the
// cell below or above on the board), and the classic slips over a new ten: 30 after 39, 79 before
// 70 (the ten not changed, 'near'). Order has no misconception in the catalogue; a reversed typed
// answer (47 → 74) is left to the global digitSwap slip check.
import type { AnswerValue, Fact, FamilyDef, HintSpec, Prompt, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import { hintOf, metaOf, num, say, tagged, walk, type Entry } from './kit'
import { canonical, drawAvoiding, familyRank, placeNoun, rngFor, tensOf, within } from '../place/kit'

const meta = metaOf('order100')

type Family = 'plus1' | 'minus1' | 'plus10' | 'minus10' | 'crossTen' | 'biggerDiffTens' | 'biggerSwapped'
type Step = 1 | 10

/** One instance, read back from the id. */
type Order100 =
  | { family: 'plus1' | 'minus1' | 'plus10' | 'minus10'; n: number }
  | { family: 'crossTen'; dir: 'after' | 'before'; n: number }
  | { family: 'biggerDiffTens' | 'biggerSwapped'; x: number; y: number }

function idOf(q: Order100): string {
  switch (q.family) {
    case 'crossTen':
      return `o100:crossTen:${q.dir}:${q.n}`
    case 'biggerDiffTens':
    case 'biggerSwapped':
      return `o100:${q.family}:${q.x}:${q.y}`
    default:
      return `o100:${q.family}:${q.n}`
  }
}

function parseOrder100(id: string): Order100 {
  const [, family, a, b] = id.split(':')
  switch (family) {
    case 'crossTen':
      return { family, dir: a === 'after' ? 'after' : 'before', n: Number(b) }
    case 'biggerDiffTens':
    case 'biggerSwapped':
      return { family, x: Number(a), y: Number(b) }
    default:
      return { family: family as 'plus1', n: Number(a) }
  }
}

function answerOf(q: Order100): number {
  switch (q.family) {
    case 'plus1':
      return q.n + 1
    case 'minus1':
      return q.n - 1
    case 'plus10':
      return q.n + 10
    case 'minus10':
      return q.n - 10
    case 'crossTen':
      return q.dir === 'after' ? q.n + 1 : q.n - 1
    default:
      return Math.max(q.x, q.y)
  }
}

function make(q: Order100): Fact {
  const operands = 'n' in q ? [q.n] : [q.x, q.y]
  return { id: idOf(q), skill: 'order100', family: q.family, operands, answer: answerOf(q), rank: familyRank(meta.families, q.family) }
}

const parse = (f: Fact): Order100 => parseOrder100(f.id)

function draw(family: Family, rng: Rng): Fact {
  switch (family) {
    case 'plus1': {
      let n = rng.between(20, 98)
      while (n % 10 === 9) n = rng.between(20, 98)
      return make({ family, n })
    }
    case 'minus1': {
      let n = rng.between(21, 99)
      while (n % 10 === 0) n = rng.between(21, 99)
      return make({ family, n })
    }
    case 'plus10':
      return make({ family, n: rng.between(10, 89) })
    case 'minus10':
      return make({ family, n: rng.between(20, 99) })
    case 'crossTen':
      return rng.next() < 0.5 ? make({ family, dir: 'after', n: rng.between(1, 9) * 10 + 9 }) : make({ family, dir: 'before', n: rng.between(2, 10) * 10 })
    case 'biggerDiffTens': {
      // the smaller number has the bigger ones digit, so only the tens decide (47 < 62)
      const ta = rng.between(1, 8)
      const tb = rng.between(ta + 1, 9)
      const ob = rng.between(0, 8)
      const oa = rng.between(ob + 1, 9)
      const [a, b] = [ta * 10 + oa, tb * 10 + ob]
      return rng.next() < 0.5 ? make({ family, x: a, y: b }) : make({ family, x: b, y: a })
    }
    case 'biggerSwapped': {
      const t = rng.between(1, 9)
      let o = rng.between(1, 9)
      while (o === t) o = rng.between(1, 9)
      return make({ family, x: t * 10 + o, y: o * 10 + t })
    }
  }
}

const CROSS_TEN: readonly Fact[] = [
  ...walk(1, 9).map((t) => make({ family: 'crossTen', dir: 'after', n: t * 10 + 9 })),
  ...walk(2, 10).map((t) => make({ family: 'crossTen', dir: 'before', n: t * 10 })),
]

const FACTS: readonly Fact[] = meta.families.flatMap((fam) =>
  canonical('order100', fam.id, (rng) => draw(fam.id as Family, rng), fam.id === 'crossTen' ? CROSS_TEN : undefined),
)

// ─── Cards for "Hvilket tal er størst?" ─────────────────────────────────────

/** The two wrong cards, both below the answer: the other number and one more (the board lights all three). */
function biggerWrong(x: number, y: number): [operand: number, near: number] {
  const top = Math.max(x, y)
  const low = Math.min(x, y)
  return [low, top - 1 === low ? top - 2 : top - 1]
}

// ─── sortOrder: four stones or four numbers ─────────────────────────────────

interface Sorting {
  row: (number | null)[]
  order: number[]
  step?: number
  speech: SpeechPart[]
}

/** Two more numbers to sort with the pair, the same every time for one instance. */
function moreToSort(q: Extract<Order100, { x: number }>): number[] {
  const rng = rngFor(idOf(q))
  for (;;) {
    let more: number[]
    if (q.family === 'biggerSwapped') {
      // another pair of the same kind keeps the task about which digit stands first
      const t = rng.between(1, 9)
      const o = rng.between(1, 9)
      more = [t * 10 + o, o * 10 + t]
      if (t === o) continue
    } else {
      more = [rng.between(10, 99), rng.between(10, 99)]
    }
    if (new Set([q.x, q.y, ...more]).size === 4) return more
  }
}

function counting(start: number, step: Step, dir: 1 | -1, cue: string): Sorting {
  const order = [1, 2, 3, 4].map((i) => start + dir * step * i)
  return { row: [start, null, null, null, null], order, ...(dir === 1 && step === 10 ? { step } : {}), speech: [say(cue), num(start)] }
}

function sorting(q: Order100): Sorting {
  switch (q.family) {
    case 'plus1':
      return counting(Math.min(q.n, 96), 1, 1, 's.order20.countOn')
    case 'minus1':
      return counting(Math.max(q.n, 5), 1, -1, 's.order20.countBack')
    case 'plus10': {
      let s = q.n
      while (s + 40 > 100) s -= 10
      return counting(s, 10, 1, 's.order.countOnTens')
    }
    case 'minus10': {
      let s = q.n
      while (s - 40 < 0) s += 10
      return counting(s, 10, -1, 's.order.countBackTens')
    }
    case 'crossTen':
      // four stones over the new ten: 38, 39, 40, 41 · 41, 40, 39, 38
      return q.dir === 'after'
        ? counting(Math.min(q.n - 2, 96), 1, 1, 's.order20.countOn')
        : counting(Math.min(q.n + 2, 100), 1, -1, 's.order20.countBack')
    default: {
      const order = [q.x, q.y, ...moreToSort(q)].sort((a, b) => b - a)
      return { row: [null, null, null, null], order, speech: [say('s.order20.sortBiggestFirst')] }
    }
  }
}

// ─── Prompt, speech, candidates, hints ──────────────────────────────────────

function prompt(f: Fact, kind: TaskKind): Prompt {
  const q = parse(f)
  if (kind === 'sortOrder') {
    const s = sorting(q)
    return { scene: 'row', cells: s.row, ...(s.step ? { step: s.step } : {}) }
  }
  const answer = answerOf(q)
  if ('x' in q) {
    // the board lights the three numbers on the cards; the stones carry the two the keypad asks about
    return kind === 'choice' ? { scene: 'board', highlight: [q.x, q.y, biggerWrong(q.x, q.y)[1]] } : { scene: 'row', cells: [q.x, q.y] }
  }
  if (kind === 'choice') return { scene: 'board', highlight: [q.n], blank: answer }
  const step = q.family === 'plus10' || q.family === 'minus10' ? 10 : undefined
  const ahead = answer > q.n
  return { scene: 'row', cells: ahead ? [q.n, null] : [null, q.n], ...(step ? { step } : {}) }
}

function speech(f: Fact, kind: TaskKind): SpeechPart[] {
  const q = parse(f)
  if (kind === 'sortOrder') return sorting(q).speech
  switch (q.family) {
    case 'plus1':
      return [say('frag.hvilket_tal_kommer_efter'), num(q.n)]
    case 'minus1':
      return [say('frag.hvilket_tal_kommer_foer'), num(q.n)]
    case 'plus10':
      return [say('s.order.tenMore'), num(q.n)]
    case 'minus10':
      return [say('s.order.tenLess'), num(q.n)]
    case 'crossTen':
      return [say(q.dir === 'after' ? 'frag.hvilket_tal_kommer_efter' : 'frag.hvilket_tal_kommer_foer'), num(q.n)]
    default:
      return kind === 'choice' ? [say('s.order20.biggest')] : [say('s.order20.whichBigger'), num(q.x, 'mid'), say('s.order20.or'), num(q.y)]
  }
}

function candidates(f: Fact) {
  const q = parse(f)
  const answer = answerOf(q)
  const inRange = within(0, 100)
  const near = (...vs: number[]): Entry[] => vs.filter(inRange).map((v) => [v, 'near'] as const)
  switch (q.family) {
    case 'plus1':
      return tagged(answer, [[q.n, 'operand'], ...near(q.n + 2, q.n - 1, q.n + 10)])
    case 'minus1':
      return tagged(answer, [[q.n, 'operand'], ...near(q.n - 2, q.n + 1, q.n - 10)])
    case 'plus10':
      return tagged(answer, [[q.n, 'operand'], ...near(q.n + 1, q.n + 9, q.n + 11, q.n - 10)])
    case 'minus10':
      return tagged(answer, [[q.n, 'operand'], ...near(q.n - 1, q.n - 9, q.n - 11, q.n + 10)])
    case 'crossTen':
      // 39 → 30 (the ten not counted on), 70 → 79 (the ten not counted back)
      return q.dir === 'after'
        ? tagged(answer, [[q.n, 'operand'], ...near(answer - 10, q.n - 1, answer + 1)])
        : tagged(answer, [[q.n, 'operand'], ...near(answer + 10, q.n + 1, answer - 1)])
    default: {
      const [low, below] = biggerWrong(q.x, q.y)
      return tagged(answer, [[low, 'operand'], [below, 'near']])
    }
  }
}

const board = (cells: number[]) => ({ scene: 'board', highlight: cells.filter((v) => v >= 1 && v <= 100) }) as const

function hint(f: Fact): HintSpec {
  const q = parse(f)
  const answer = answerOf(q)
  switch (q.family) {
    case 'plus1':
      return hintOf([say('hint.order20.afterMeans'), say('hint.order100.boardRight')], board([q.n, answer]))
    case 'minus1':
      return hintOf([say('hint.order20.beforeMeans'), say('hint.order100.boardLeft')], board([q.n, answer]))
    case 'plus10':
      return hintOf([say('hint.order100.tenMoreMeans'), say('hint.order100.boardBelow')], board([q.n, answer]))
    case 'minus10':
      return hintOf([say('hint.order100.tenLessMeans'), say('hint.order100.boardAbove')], board([q.n, answer]))
    case 'crossTen': {
      // "Efter niogtredive kommer fyrre. Ti enere bliver til en tier."
      const lead = say(q.dir === 'after' ? 'hint.order.after' : 'hint.order.before')
      const told = [lead, num(q.n, 'mid'), say('hint.order.comes'), num(answer)]
      if (q.dir === 'before') return hintOf([...told, say('hint.order20.countBackward')], board([q.n, answer]))
      return hintOf([...told, say(answer === 100 ? 'hint.order.tenTensHundred' : 'hint.order.tenOnesTen')], board([q.n, answer]))
    }
    case 'biggerDiffTens':
      return hintOf([say('hint.order100.mostTens'), say('hint.order100.boardLower')], board([q.x, q.y]))
    case 'biggerSwapped': {
      // "Se på tierne først. Fireogtres har seks tiere."
      const t = tensOf(answer)
      return hintOf([say('hint.order100.lookTens'), num(answer, 'mid'), say('hint.place.has'), num(t, 'mid'), placeNoun('t', t, 'end')], board([q.x, q.y]))
    }
  }
}

export default {
  ...meta,
  kinds: ['choice', 'sortOrder', 'keypad'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id as Family, rng), avoid),
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'sortOrder' ? sorting(parse(f)).order.join('|') : answerOf(parse(f))),
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'sortOrder' ? 'set' : 'int'),
  answerType: () => 'int',
  prompt,
  optionView: () => 'numeral',
  range: () => [0, 100],
  speech,
  candidates,
  hint,
  // "Hvilket tal er størst, seksogfyrre eller fireogtres?" names both numbers: a coin flip on a keypad
  guessFloor: (f: Fact, kind: TaskKind) => (f.family.startsWith('bigger') && kind === 'keypad' ? 0.5 : 0),
} satisfies SkillModule
