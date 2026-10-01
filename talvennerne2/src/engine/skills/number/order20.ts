// order20 — Før, efter og størst til 20 (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `o20:`.
//   after    o20:after:<n>          n = 0–19, answer n + 1                                    20
//   before   o20:before:<n>         n = 1–20, answer n − 1                                    20
//   between  o20:between:<a>:<c>    c = a + 2, a = 0–18, answer a + 1                         19
//   bigger   o20:bigger:<x>:<y>     |x − y| = 1–3 (not 0 vs 1), spoken in this order, answer max  112
// Every family is asked four ways, all about the same instance:
//   choice / keypad  stepping stones ([7, □], [□, 7], [5, □, 7]) — "Hvilket tal kommer efter syv?"
//                    bigger: "Hvilket tal er størst?" on three cards, all below the answer (choice),
//                    "Hvilket tal er størst, seks eller otte?" (keypad and number line)
//   numberline       the same question, tapped on a 0–10 line (0–20 once a number is above 10)
//   sortOrder        four cards onto four stones: count on (after), count back (before), the numbers
//                    between two stones (between), the biggest first (bigger)
// sortOrder is the first production kind: it is a real 1-in-24 task for every family, while "the
// bigger of two" on a keypad or a line is a coin flip. Every number a task shows stays at or below
// the instance's own largest number (or 5), so a region limit like Tællelunden's max 10 holds.
// Wrong answers: the given number itself ('operand', 7 → 7) and the neighbours (6 or 9 for "after
// seven"); order has no misconception in the catalogue.
import type { AnswerValue, Fact, FamilyDef, HintSpec, Prompt, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import { hashSeed, makeRng } from '../../rng'
import { hintOf, metaOf, num, say, tagged, walk } from './kit'

type Family = 'after' | 'before' | 'between' | 'bigger'

function make(family: Family, operands: number[]): Fact {
  const [x, y] = operands
  const answer = family === 'after' ? x + 1 : family === 'before' ? x - 1 : family === 'between' ? x + 1 : Math.max(x, y)
  return {
    id: `o20:${family}:${operands.join(':')}`,
    skill: 'order20',
    family,
    operands,
    answer,
    rank: FAMILY_RANK[family],
  }
}

const FAMILY_RANK: Readonly<Record<Family, number>> = { after: 0, before: 1, between: 2, bigger: 3 }

function draw(family: Family, rng: Rng): Fact {
  switch (family) {
    case 'after':
      return make('after', [rng.between(0, 19)])
    case 'before':
      return make('before', [rng.between(1, 20)])
    case 'between': {
      const a = rng.between(0, 18)
      return make('between', [a, a + 2])
    }
    case 'bigger': {
      for (;;) {
        const d = rng.between(1, 3)
        const lo = rng.between(0, 20 - d)
        // 0 vs 1 leaves no third card below the answer
        if (lo === 0 && d === 1) continue
        return make('bigger', rng.next() < 0.5 ? [lo, lo + d] : [lo + d, lo])
      }
    }
  }
}

/** after, before and between have few instances: all of them. bigger: 20 seeded pairs. */
const CANON: readonly Fact[] = [
  ...walk(0, 19).map((n) => make('after', [n])),
  ...walk(1, 20).map((n) => make('before', [n])),
  ...walk(0, 18).map((a) => make('between', [a, a + 2])),
  ...(() => {
    const rng = makeRng(hashSeed('order20/bigger'))
    const out = new Map<string, Fact>()
    while (out.size < 20) {
      const f = draw('bigger', rng)
      out.set(f.id, f)
    }
    return [...out.values()]
  })(),
]

const familyOf = (f: Fact) => f.family as Family

/** The instance's largest number decides the line and the card range: 0–10 or 0–20. */
const top = (f: Fact) => (Math.max(...f.operands, f.answer as number) <= 10 ? 10 : 20)

// ─── sortOrder: four cards onto four stones ─────────────────────────────────

interface Sorting {
  /** Stones in the prompt: given numbers and a null for each card. */
  row: (number | null)[]
  /** The cards in the right order. */
  order: number[]
  speech: SpeechPart[]
}

/** Four numbers for "biggest first": the pair and two more at or below max(bigger, 3), seeded by the id. */
function biggerFour(f: Fact): number[] {
  const [x, y] = f.operands
  const hi = Math.max(x, y, 3)
  const pool = walk(Math.max(0, hi - 7), hi).filter((v) => v !== x && v !== y)
  const extra = makeRng(hashSeed(f.id)).shuffle(pool).slice(0, 2)
  return [x, y, ...extra].sort((a, b) => b - a)
}

function sorting(f: Fact): Sorting {
  const [x] = f.operands
  const blanks = [null, null, null, null]
  switch (familyOf(f)) {
    case 'after': {
      // count on four steps, ending on the answer (from 0 for the smallest numbers)
      const s = Math.max(0, x - 3)
      return { row: [s, ...blanks], order: walk(s + 1, s + 4), speech: [say('s.order20.countOn'), num(s)] }
    }
    case 'before': {
      // count back four steps from the number (from 4 for the smallest numbers)
      const t = Math.max(x, 4)
      return { row: [t, ...blanks], order: walk(t - 1, t - 4), speech: [say('s.order20.countBack'), num(t)] }
    }
    case 'between': {
      // the four numbers between two stones five apart, ending on the larger given number
      const w = Math.max(0, x - 3)
      return {
        row: [w, ...blanks, w + 5],
        order: walk(w + 1, w + 4),
        speech: [say('s.order20.numbersBetween'), num(w, 'mid'), say('op.og'), num(w + 5)],
      }
    }
    case 'bigger':
      return { row: blanks, order: biggerFour(f), speech: [say('s.order20.sortBiggestFirst')] }
  }
}

// ─── Prompt, speech and candidates per kind ─────────────────────────────────

function prompt(f: Fact, kind: TaskKind): Prompt {
  const [x, y] = f.operands
  if (kind === 'sortOrder') return { scene: 'row', cells: sorting(f).row }
  if (kind === 'numberline') return { scene: 'line', min: 0, max: top(f) }
  switch (familyOf(f)) {
    case 'after':
      return { scene: 'row', cells: [x, null] }
    case 'before':
      return { scene: 'row', cells: [null, x] }
    case 'between':
      return { scene: 'row', cells: [x, null, y] }
    case 'bigger':
      // the cards carry the numbers; the line is there to compare on
      return kind === 'choice' ? { scene: 'line', min: 0, max: top(f) } : { scene: 'row', cells: [x, y] }
  }
}

function speech(f: Fact, kind: TaskKind): SpeechPart[] {
  if (kind === 'sortOrder') return sorting(f).speech
  const [x, y] = f.operands
  switch (familyOf(f)) {
    case 'after':
      return [say('frag.hvilket_tal_kommer_efter'), num(x)]
    case 'before':
      return [say('frag.hvilket_tal_kommer_foer'), num(x)]
    case 'between':
      return [say('s.order20.between'), num(x, 'mid'), say('op.og'), num(y)]
    case 'bigger':
      return kind === 'choice'
        ? [say('s.order20.biggest')]
        : [say('s.order20.whichBigger'), num(x, 'mid'), say('s.order20.or'), num(y)]
  }
}

function candidates(f: Fact) {
  const [x, y] = f.operands
  const answer = f.answer as number
  switch (familyOf(f)) {
    case 'after':
      return tagged(answer, [[x, 'operand'], [x + 2, 'near'], [x - 1, 'near']])
    case 'before':
      return tagged(answer, [[x, 'operand'], [x - 2, 'near'], [x + 1, 'near']])
    case 'between':
      return tagged(answer, [[x, 'operand'], [y, 'operand'], [x - 1, 'near'], [y + 1, 'near']])
    case 'bigger': {
      // exactly two wrong cards, both below the answer: the smaller of the pair and one more
      const a = Math.min(x, y)
      return tagged(answer, [[a, 'operand'], [a + 1 < answer ? a + 1 : a - 1, 'near']])
    }
  }
}

function hint(f: Fact): HintSpec {
  const [x, y] = f.operands
  const line = (hops: number[]) => ({ scene: 'line', min: 0, max: top(f), hops }) as const
  switch (familyOf(f)) {
    case 'after':
      return hintOf([say('hint.order20.afterMeans'), say('hint.order20.countForward')], { ...line([x, x + 1]), arrowAt: x })
    case 'before':
      return hintOf([say('hint.order20.beforeMeans'), say('hint.order20.countBackward')], { ...line([x, x - 1]), arrowAt: x })
    case 'between':
      return hintOf([say('hint.order20.betweenCount'), say('hint.order20.betweenMiddle')], line(walk(x, y)))
    case 'bigger':
      return hintOf([say('hint.order20.biggerLast')], line(walk(Math.min(x, y), Math.max(x, y))))
  }
}

export default {
  ...metaOf('order20'),
  kinds: ['choice', 'sortOrder', 'numberline', 'keypad'],
  enumerate: () => [...CANON],
  instance(family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) {
    let f = draw(family.id as Family, rng)
    for (let i = 0; i < 30 && avoid.has(f.id); i++) f = draw(family.id as Family, rng)
    return f
  },
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'sortOrder' ? sorting(f).order.join('|') : f.answer),
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'sortOrder' ? 'set' : 'int'),
  answerType: () => 'int',
  prompt,
  optionView: () => 'numeral',
  range: (f) => [0, top(f)],
  speech,
  candidates,
  hint,
  // "Hvilket tal er størst, seks eller otte?" names both numbers: on a keypad or a line it is a
  // coin flip, so it never counts as production (sortOrder is this family's production kind)
  guessFloor: (f: Fact, kind: TaskKind) => (f.family === 'bigger' && (kind === 'keypad' || kind === 'numberline') ? 0.5 : 0),
} satisfies SkillModule
