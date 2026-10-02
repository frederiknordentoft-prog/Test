// order1000 — Tal til 1000 i rækkefølge (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `o1000:`.
//   plus1 / minus1       o1000:plus1:<n>     ±1 inside a hundred (349 + 1, not 399 + 1)
//   plus10 / minus10     o1000:plus10:<n>    ±10 inside a hundred
//   plus100 / minus100   o1000:plus100:<n>   ±100 (to 999, from 200)
//   crossHundred         o1000:crossHundred:<plus1|plus10|minus1|minus10>:<n>
//                        over a new hundred: 399 + 1, 395 + 10, 400 − 1, 405 − 10 (and up to 1000)
//   bigger3              o1000:bigger3:<a>:<b>:<c>   the biggest of three: two share the hundreds,
//                        the third has fewer hundreds but more tens (452, 427, 398)
//   biggerMixed          o1000:biggerMixed:<x>:<y>   a two-digit and a three-digit number where the
//                        two-digit one has the bigger first digit (69 and 102); spoken in this order
// Kinds: choice and keypad on stepping stones ([345, □] with +10 or +100 between them), sortOrder
// (production): count on or back four stones, or put four numbers biggest first. "Which is
// biggest" is asked on cards on a 0–1000 line (bigger3) or as the sign between two numbers
// (biggerMixed: <, > or =, read aloud), on a keypad as a 1-in-2 or 1-in-3 guess (guessFloor), and
// production is the sortOrder: it comes first among the production kinds, as in order20.
//
// firstDigitCompare (69 > 102, pædagogik §3.2): the wrong sign card ('cmp:>' for 69 □ 102) and the
// order by first digit in sortOrder (98, 69, 345, 102) are its evidence. On a keypad the answer 69 to
// "niogtres eller et hundrede og to?" is also a number from the question, so it is 'ambiguous' (A9).
// Other wrong answers: the given number ('operand'), the wrong place (+1 for +10: 'other'), near
// misses, and over a new hundred the hundred not changed (300 after 399, 499 before 400: 'near').
import type { AnswerValue, AnswerType, Fact, FamilyDef, HintSpec, OptionView, Prompt, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import type { ClipId } from '../../types'
import { hintOf, metaOf, num, say, tagged, type Entry } from './kit'
import { canonical, drawAvoiding, familyRank, hundredsOf, joined, rngFor, within } from '../place/kit'

const meta = metaOf('order1000')

type Step = 1 | 10 | 100
type PlusMinus = 'plus1' | 'plus10' | 'plus100' | 'minus1' | 'minus10' | 'minus100'
type Cross = 'plus1' | 'plus10' | 'minus1' | 'minus10'
type Family = PlusMinus | 'crossHundred' | 'bigger3' | 'biggerMixed'

type Order1000 =
  | { family: PlusMinus; n: number }
  | { family: 'crossHundred'; way: Cross; n: number }
  | { family: 'bigger3'; nums: [number, number, number] }
  | { family: 'biggerMixed'; x: number; y: number }

function idOf(q: Order1000): string {
  switch (q.family) {
    case 'crossHundred':
      return `o1000:crossHundred:${q.way}:${q.n}`
    case 'bigger3':
      return `o1000:bigger3:${q.nums.join(':')}`
    case 'biggerMixed':
      return `o1000:biggerMixed:${q.x}:${q.y}`
    default:
      return `o1000:${q.family}:${q.n}`
  }
}

function parseOrder1000(id: string): Order1000 {
  const [, family, ...rest] = id.split(':')
  switch (family) {
    case 'crossHundred':
      return { family, way: rest[0] as Cross, n: Number(rest[1]) }
    case 'bigger3':
      return { family, nums: rest.map(Number) as [number, number, number] }
    case 'biggerMixed':
      return { family, x: Number(rest[0]), y: Number(rest[1]) }
    default:
      return { family: family as PlusMinus, n: Number(rest[0]) }
  }
}

const parse = (f: Fact): Order1000 => parseOrder1000(f.id)

/** Size and direction of a ± family. */
function moveOf(way: PlusMinus | Cross): { step: Step; dir: 1 | -1 } {
  return { step: Number(way.replace(/^(plus|minus)/, '')) as Step, dir: way.startsWith('plus') ? 1 : -1 }
}

function answerOf(q: Order1000): number {
  switch (q.family) {
    case 'crossHundred': {
      const { step, dir } = moveOf(q.way)
      return q.n + dir * step
    }
    case 'bigger3':
      return Math.max(...q.nums)
    case 'biggerMixed':
      return Math.max(q.x, q.y)
    default: {
      const { step, dir } = moveOf(q.family)
      return q.n + dir * step
    }
  }
}

function make(q: Order1000): Fact {
  const operands = q.family === 'bigger3' ? [...q.nums] : q.family === 'biggerMixed' ? [q.x, q.y] : [q.n]
  return { id: idOf(q), skill: 'order1000', family: q.family, operands, answer: answerOf(q), rank: familyRank(meta.families, q.family) }
}

/** A number in [lo, hi] that `ok` accepts. */
function pickWhere(rng: Rng, lo: number, hi: number, ok: (n: number) => boolean): number {
  let n = rng.between(lo, hi)
  while (!ok(n)) n = rng.between(lo, hi)
  return n
}

function draw(family: Family, rng: Rng): Fact {
  switch (family) {
    case 'plus1':
      return make({ family, n: pickWhere(rng, 100, 998, (n) => n % 100 !== 99) })
    case 'minus1':
      return make({ family, n: pickWhere(rng, 101, 999, (n) => n % 100 !== 0) })
    case 'plus10':
      return make({ family, n: pickWhere(rng, 100, 989, (n) => n % 100 < 90) })
    case 'minus10':
      return make({ family, n: pickWhere(rng, 110, 999, (n) => n % 100 >= 10) })
    case 'plus100':
      return make({ family, n: rng.between(100, 899) })
    case 'minus100':
      return make({ family, n: rng.between(200, 999) })
    case 'crossHundred': {
      const way = rng.pick<Cross>(['plus1', 'plus10', 'minus1', 'minus10'])
      switch (way) {
        case 'plus1':
          return make({ family, way, n: rng.between(1, 9) * 100 + 99 })
        case 'minus1':
          return make({ family, way, n: rng.between(2, 10) * 100 })
        case 'plus10': {
          // 390–399 → 400–409 … 890–899 → 900–909, and 990 → 1000
          const h = rng.between(1, 9)
          return make({ family, way, n: h === 9 ? 990 : h * 100 + 90 + rng.between(0, 9) })
        }
        case 'minus10': {
          const h = rng.between(2, 10)
          return make({ family, way, n: h === 10 ? 1000 : h * 100 + rng.between(0, 9) })
        }
      }
      break
    }
    case 'bigger3': {
      // 452 and 427 share the hundreds; 398 has fewer hundreds but more tens than both
      const h = rng.between(2, 9)
      const t1 = rng.between(0, 7)
      let t2 = rng.between(0, 7)
      while (t2 === t1) t2 = rng.between(0, 7)
      const t3 = rng.between(Math.max(t1, t2) + 1, 9)
      const nums = [h * 100 + t1 * 10 + rng.between(0, 9), h * 100 + t2 * 10 + rng.between(0, 9), (h - 1) * 100 + t3 * 10 + rng.between(0, 9)]
      return make({ family, nums: rng.shuffle(nums) as [number, number, number] })
    }
    case 'biggerMixed': {
      // 69 and 102: the two-digit number has the bigger first digit
      const d = rng.between(2, 9)
      const small = d * 10 + rng.between(0, 9)
      const big = rng.between(1, d - 1) * 100 + rng.between(0, 99)
      return rng.next() < 0.5 ? make({ family, x: small, y: big }) : make({ family, x: big, y: small })
    }
  }
  throw new Error(`order1000: unknown family ${family}`)
}

/** crossHundred has few instances of its plus1 and minus1 ways; the canonical set mixes all four. */
const FACTS: readonly Fact[] = meta.families.flatMap((fam) => canonical('order1000', fam.id, (rng) => draw(fam.id as Family, rng)))

// ─── Biggest first, and the order by first digit ────────────────────────────

const firstDigit = (n: number): number => Number(String(n)[0])
const biggestFirst = (nums: readonly number[]): number[] => [...nums].sort((a, b) => b - a)
/** firstDigitCompare: the numbers ordered by their first digit (all different in biggerMixed). */
const byFirstDigit = (nums: readonly number[]): number[] => [...nums].sort((a, b) => firstDigit(b) - firstDigit(a) || b - a)

/** Four numbers to sort: the instance's own and more of the same kind, the same every time. */
function toSort(q: Extract<Order1000, { family: 'bigger3' | 'biggerMixed' }>): number[] {
  const rng = rngFor(idOf(q))
  if (q.family === 'bigger3') {
    for (;;) {
      const extra = rng.between(100, 999)
      if (!q.nums.includes(extra)) return [...q.nums, extra]
    }
  }
  // biggerMixed: one more two-digit and one more three-digit number, four different first digits,
  // the new two-digit number's first digit bigger than the new three-digit number's
  const small = Math.min(q.x, q.y)
  const big = Math.max(q.x, q.y)
  for (;;) {
    const ds = rng.between(2, 9)
    const db = rng.between(1, ds - 1)
    const used = new Set([firstDigit(small), firstDigit(big)])
    if (used.has(ds) || used.has(db)) continue
    return [q.x, q.y, ds * 10 + rng.between(0, 9), db * 100 + rng.between(0, 99)]
  }
}

// ─── sortOrder ──────────────────────────────────────────────────────────────

interface Sorting {
  row: (number | null)[]
  order: number[]
  step?: number
  speech: SpeechPart[]
}

const COUNT_CUES: Readonly<Record<Step, readonly [on: ClipId, back: ClipId]>> = {
  1: ['s.order20.countOn', 's.order20.countBack'],
  10: ['s.order.countOnTens', 's.order.countBackTens'],
  100: ['s.order.countOnHundreds', 's.order.countBackHundreds'],
}

/** Four stones counted on (or back) from `start`, kept inside 0–1000. */
function counting(from: number, step: Step, dir: 1 | -1): Sorting {
  let start = Math.min(1000, Math.max(0, from))
  while (start + dir * 4 * step > 1000) start -= step
  while (start + dir * 4 * step < 0) start += step
  const order = [1, 2, 3, 4].map((i) => start + dir * step * i)
  const cue = COUNT_CUES[step][dir === 1 ? 0 : 1]
  return { row: [start, null, null, null, null], order, ...(dir === 1 && step > 1 ? { step } : {}), speech: [say(cue), num(start)] }
}

function sorting(q: Order1000): Sorting {
  switch (q.family) {
    case 'bigger3':
    case 'biggerMixed':
      return { row: [null, null, null, null], order: biggestFirst(toSort(q)), speech: [say('s.order20.sortBiggestFirst')] }
    case 'crossHundred': {
      // the four stones go over the new hundred: 397, 398 → 399, 400, 401
      const { step, dir } = moveOf(q.way)
      return counting(q.n - dir * 2 * step, step, dir)
    }
    default: {
      const { step, dir } = moveOf(q.family)
      return counting(q.n, step, dir)
    }
  }
}

// ─── Per kind ───────────────────────────────────────────────────────────────

const signOf = (x: number, y: number): string => (x < y ? 'cmp:<' : 'cmp:>')
const isSignTask = (q: Order1000, kind: TaskKind) => kind === 'choice' && q.family === 'biggerMixed'

function answer(f: Fact, kind: TaskKind): AnswerValue {
  const q = parse(f)
  if (kind === 'sortOrder') return joined(sorting(q).order)
  if (q.family === 'biggerMixed' && kind === 'choice') return signOf(q.x, q.y)
  return answerOf(q)
}

function answerTypeFor(f: Fact, kind: TaskKind): AnswerType {
  if (kind === 'sortOrder') return 'set'
  return isSignTask(parse(f), kind) ? 'token' : 'int'
}

const optionView = (f: Fact, kind: TaskKind): OptionView => (isSignTask(parse(f), kind) ? 'relation' : 'numeral')

const SIGN_CLIPS: Readonly<Record<string, ClipId>> = { 'cmp:<': 'op.mindre_end', 'cmp:>': 'op.stoerre_end', 'cmp:=': 'op.er_lig_med' }
const optionClip = (_f: Fact, value: AnswerValue): ClipId => (typeof value === 'string' ? SIGN_CLIPS[value] ?? 'op.er_lig_med' : `n.end.${value}`)

function prompt(f: Fact, kind: TaskKind): Prompt {
  const q = parse(f)
  if (kind === 'sortOrder') {
    const s = sorting(q)
    return { scene: 'row', cells: s.row, ...(s.step ? { step: s.step } : {}) }
  }
  switch (q.family) {
    case 'bigger3':
      // the cards are the three numbers; the line marks where each one lies
      return kind === 'choice' ? { scene: 'line', min: 0, max: 1000 } : { scene: 'row', cells: [...q.nums] }
    case 'biggerMixed':
      return kind === 'choice' ? { scene: 'equation', terms: [{ n: q.x }, { blank: true }, { n: q.y }] } : { scene: 'row', cells: [q.x, q.y] }
    default: {
      const way = q.family === 'crossHundred' ? q.way : q.family
      const { step, dir } = moveOf(way)
      return { scene: 'row', cells: dir === 1 ? [q.n, null] : [null, q.n], ...(step > 1 ? { step } : {}) }
    }
  }
}

const ASK: Readonly<Record<PlusMinus, ClipId>> = {
  plus1: 'frag.hvilket_tal_kommer_efter', minus1: 'frag.hvilket_tal_kommer_foer',
  plus10: 's.order.tenMore', minus10: 's.order.tenLess', plus100: 's.order.hundredMore', minus100: 's.order.hundredLess',
}

function speech(f: Fact, kind: TaskKind): SpeechPart[] {
  const q = parse(f)
  if (kind === 'sortOrder') return sorting(q).speech
  switch (q.family) {
    case 'bigger3': {
      if (kind === 'choice') return [say('s.order20.biggest')]
      const [a, b, c] = q.nums
      return [say('s.order20.whichBigger'), num(a, 'mid'), num(b, 'mid'), say('s.order20.or'), num(c)]
    }
    case 'biggerMixed':
      return kind === 'choice'
        ? [say('s.order1000.whichSign'), num(q.x, 'mid'), say('op.og'), num(q.y)]
        : [say('s.order20.whichBigger'), num(q.x, 'mid'), say('s.order20.or'), num(q.y)]
    case 'crossHundred':
      return [say(ASK[q.way]), num(q.n)]
    default:
      return [say(ASK[q.family]), num(q.n)]
  }
}

function candidates(f: Fact) {
  const q = parse(f)
  const ans = answerOf(q)
  const inRange = within(0, 1000)
  const tag = (t: 'near' | 'other', ...vs: number[]): Entry[] => vs.filter(inRange).map((v) => [v, t] as const)
  switch (q.family) {
    case 'plus1':
      return tagged(ans, [[q.n, 'operand'], ...tag('near', q.n + 2, q.n - 1, ans + 10)])
    case 'minus1':
      return tagged(ans, [[q.n, 'operand'], ...tag('near', q.n - 2, q.n + 1, ans - 10)])
    case 'plus10':
      return tagged(ans, [[q.n, 'operand'], ...tag('other', q.n + 1, q.n + 100), ...tag('near', ans + 10, ans + 1, ans - 1)])
    case 'minus10':
      return tagged(ans, [[q.n, 'operand'], ...tag('other', q.n - 1, q.n - 100), ...tag('near', ans - 10, ans + 1, ans - 1)])
    case 'plus100':
      return tagged(ans, [[q.n, 'operand'], ...tag('other', q.n + 10, q.n + 1), ...tag('near', ans + 100, ans + 10, ans - 10)])
    case 'minus100':
      return tagged(ans, [[q.n, 'operand'], ...tag('other', q.n - 10, q.n - 1), ...tag('near', ans - 100, ans + 10, ans - 10)])
    case 'crossHundred':
      // the hundred not changed: 399 + 1 → 300, 400 − 1 → 499
      switch (q.way) {
        case 'plus1':
          return tagged(ans, [[q.n, 'operand'], ...tag('near', ans - 100, q.n - 1, ans + 1)])
        case 'plus10':
          return tagged(ans, [[q.n, 'operand'], ...tag('near', ans - 100, ans + 10), ...tag('other', q.n + 1)])
        case 'minus1':
          return tagged(ans, [[q.n, 'operand'], ...tag('near', ans + 100, q.n + 1, ans - 1)])
        case 'minus10':
          return tagged(ans, [[q.n, 'operand'], ...tag('near', ans + 100, ans - 10), ...tag('other', q.n - 1)])
      }
      break
    case 'bigger3': {
      // the two other numbers are the two wrong cards: the one with the same hundreds is the near miss
      const [mid, low] = biggestFirst(q.nums).slice(1)
      return tagged(ans, [[mid, 'near'], [low, 'operand']])
    }
    case 'biggerMixed': {
      const small = Math.min(q.x, q.y)
      const four = toSort(q)
      return tagged(ans, [
        // the other number of the question: a first-digit reading, or just the other number (A9)
        [small, 'operand'], [small, 'firstDigitCompare'], ...tag('near', ans - 1, ans + 1),
        [signOf(q.y, q.x), 'firstDigitCompare'], ['cmp:=', 'other'],
        [joined(byFirstDigit(four)), 'firstDigitCompare'], [joined([...biggestFirst(four)].reverse()), 'other'],
      ])
    }
  }
  return []
}

// ─── Hints ──────────────────────────────────────────────────────────────────

/** A stretch of the line around `centre`, `half` each way, kept inside 0–1000. */
function around(centre: number, half: number, hops: number[]) {
  const min = Math.max(0, Math.min(centre - half, 1000 - 2 * half))
  return { scene: 'line', min, max: min + 2 * half, hops } as const
}

function hint(f: Fact, tag: string | null): HintSpec {
  const q = parse(f)
  const ans = answerOf(q)
  switch (q.family) {
    case 'plus1':
      return hintOf([say('hint.order20.afterMeans'), say('hint.order20.countForward')], around(Math.floor(Math.min(q.n, ans) / 10) * 10 + 5, 5, [q.n, ans]))
    case 'minus1':
      return hintOf([say('hint.order20.beforeMeans'), say('hint.order20.countBackward')], around(Math.floor(Math.min(q.n, ans) / 10) * 10 + 5, 5, [q.n, ans]))
    case 'plus10':
      return hintOf([say('hint.order1000.tenMore')], around(hundredsOf(q.n) * 100 + 50, 50, [q.n, ans]))
    case 'minus10':
      return hintOf([say('hint.order1000.tenLess')], around(hundredsOf(q.n) * 100 + 50, 50, [q.n, ans]))
    case 'plus100':
      return hintOf([say('hint.order1000.hundredMore')], { scene: 'line', min: 0, max: 1000, hops: [q.n, ans] })
    case 'minus100':
      return hintOf([say('hint.order1000.hundredLess')], { scene: 'line', min: 0, max: 1000, hops: [q.n, ans] })
    case 'crossHundred': {
      const { step, dir } = moveOf(q.way)
      const hundred = dir === 1 ? Math.floor(ans / 100) * 100 : Math.floor(q.n / 100) * 100
      const visual = around(hundred, step === 1 ? 10 : 50, [q.n, ans])
      if (step === 1) {
        // "Efter tre hundrede og nioghalvfems kommer fire hundrede. Ti tiere bliver til et hundrede."
        const told = [say(dir === 1 ? 'hint.order.after' : 'hint.order.before'), num(q.n, 'mid'), say('hint.order.comes'), num(ans)]
        return hintOf([...told, say(dir === 1 ? 'hint.order.tenTensHundred' : 'hint.order20.countBackward')], visual)
      }
      // "Ti mere end tre hundrede og femoghalvfems er fire hundrede og fem. Ti tiere bliver til et hundrede."
      const told = [say(dir === 1 ? 'hint.order.tenMoreThan' : 'hint.order.tenLessThan'), num(q.n, 'mid'), say('hint.place.is'), num(ans)]
      return hintOf([...told, say(dir === 1 ? 'hint.order.tenTensHundred' : 'hint.order.hundredTenTens')], visual)
    }
    case 'bigger3':
      return hintOf([say('hint.order1000.hundredsThenTens')], { scene: 'line', min: 0, max: 1000, hops: [...q.nums].sort((a, b) => a - b) })
    case 'biggerMixed': {
      const visual: HintSpec['visual'] = { scene: 'line', min: 0, max: 1000, hops: [Math.min(q.x, q.y), ans] }
      if (tag === 'firstDigitCompare') {
        return hintOf([say('hint.order1000.notFirstDigit'), say('hint.order1000.threeDigitsBigger')], visual, 'firstDigitCompare')
      }
      return hintOf([say('hint.order1000.threeDigitsBigger')], visual)
    }
  }
}

export default {
  ...meta,
  kinds: ['choice', 'sortOrder', 'keypad'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id as Family, rng), avoid),
  answer,
  answerTypeFor,
  answerType: () => 'int',
  prompt,
  optionView,
  optionClip,
  range: () => [0, 1000],
  speech,
  candidates,
  hint: (f, tag) => hint(f, tag),
  // the keypad question names the two (or three) numbers to choose from
  guessFloor: (f: Fact, kind: TaskKind) => (kind !== 'keypad' ? 0 : f.family === 'biggerMixed' ? 0.5 : f.family === 'bigger3' ? 1 / 3 : 0),
} satisfies SkillModule
