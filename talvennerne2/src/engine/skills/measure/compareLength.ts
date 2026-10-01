// compareLength — Længst og kortest (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 16 facts `lng:<id>`.
//   aligned  lng:a1–a8   four things that start at the same place                      8
//   offset   lng:o1–o8   four things moved sideways (o1–o6 mislead, o7–o8 do not)       8
// Every fact is four things (pencil, straw, stick, ribbon, brush, crayon — one of each) with a length
// and a start, asked "Hvilken ting er længst?" or "… kortest?". Lengths differ by at least two units
// between the answer and the runner-up, and no two things end at the same place.
//
// choice: three picture cards `obj:<thing>` for "Hvilken ting er længst?"; the scene shows all four.
// sortOrder (production): "Sæt tingene i rækkefølge. Start med den længste." — all four cards.
// Scene: { scene: 'compareObjects', objects, sizes, aligned, mode: 'length', starts }. `starts` (the
// left end of each thing, in the same units as sizes) is not in the frozen Prompt type yet; it is
// needed to draw the offset facts as designed and is proposed for types.ts. aligned facts start at 0.
//
// lengthByEnd ("ser kun på den ene ende", perceptual): the thing that sticks out furthest (for
// "kortest": the one that ends first). contrast is 'conflict' when that thing is not the answer — the
// longest does not stick out furthest — and 'congruent' otherwise (all aligned facts, o7 and o8, where
// the ends are in the same order as the lengths). On conflict facts it is the diagnostic card, and
// for sortOrder the order of the ends is the lengthByEnd candidate.
import type { AnswerValue, Candidate, Fact, HintSpec, ObjectId, Prompt, Rng, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, say, tagged } from '../number/kit'

type Question = 'long' | 'short'

interface Lineup {
  q: Question
  objects: readonly ObjectId[]
  sizes: readonly number[]
  starts: readonly number[]
}

/** The compareObjects scene with the starts the frozen type does not carry yet (proposed). */
export type CompareScene = Extract<Prompt, { scene: 'compareObjects' }> & { starts: number[] }

const L = (q: Question, objects: ObjectId[], sizes: number[], starts: number[] = [0, 0, 0, 0]): Lineup => ({ q, objects, sizes, starts })

/** In rank order: lined up first, then moved sideways without and with a misleading end. */
const LINEUPS: readonly (readonly [id: string, family: 'aligned' | 'offset', lineup: Lineup])[] = [
  ['a1', 'aligned', L('long', ['pencil', 'ribbon', 'straw', 'brush'], [6, 9, 4, 7])],
  ['a2', 'aligned', L('short', ['stick', 'crayon', 'pencil', 'ribbon'], [7, 3, 9, 5])],
  ['a3', 'aligned', L('long', ['brush', 'straw', 'stick', 'crayon'], [9, 4, 5, 7])],
  ['a4', 'aligned', L('short', ['ribbon', 'pencil', 'brush', 'stick'], [6, 8, 4, 10])],
  ['a5', 'aligned', L('long', ['crayon', 'stick', 'ribbon', 'straw'], [8, 5, 10, 3])],
  ['a6', 'aligned', L('short', ['straw', 'brush', 'crayon', 'pencil'], [9, 6, 3, 7])],
  ['a7', 'aligned', L('long', ['pencil', 'stick', 'straw', 'ribbon'], [3, 8, 6, 5])],
  ['a8', 'aligned', L('short', ['ribbon', 'crayon', 'brush', 'stick'], [4, 10, 7, 6])],
  // moved, but the ends are in the same order as the lengths
  ['o7', 'offset', L('long', ['brush', 'pencil', 'stick', 'crayon'], [7, 5, 9, 4], [1, 2, 1, 0])],
  ['o8', 'offset', L('short', ['crayon', 'ribbon', 'pencil', 'straw'], [6, 5, 8, 3], [1, 1, 2, 0])],
  // moved so that a shorter thing sticks out furthest (or a longer one ends first)
  ['o1', 'offset', L('long', ['stick', 'pencil', 'ribbon', 'straw'], [8, 6, 5, 4], [0, 4, 2, 1])],
  ['o2', 'offset', L('short', ['pencil', 'straw', 'brush', 'ribbon'], [4, 6, 7, 9], [4, 0, 2, 1])],
  ['o3', 'offset', L('long', ['crayon', 'brush', 'pencil', 'stick'], [5, 9, 7, 3], [6, 0, 1, 3])],
  ['o4', 'offset', L('short', ['ribbon', 'stick', 'crayon', 'pencil'], [8, 3, 6, 5], [2, 6, 0, 2])],
  ['o5', 'offset', L('long', ['straw', 'ribbon', 'crayon', 'brush'], [6, 4, 8, 5], [3, 6, 0, 1])],
  ['o6', 'offset', L('short', ['stick', 'brush', 'straw', 'crayon'], [6, 7, 4, 9], [0, 1, 5, 2])],
]

const lineupOf = (f: Fact) => f.data as unknown as Lineup
const token = (object: ObjectId) => `obj:${object}`

/** Indices ordered by length (longest first for "længst", shortest first for "kortest"). */
function byLength(l: Lineup): number[] {
  const dir = l.q === 'long' ? -1 : 1
  return [0, 1, 2, 3].sort((a, b) => dir * (l.sizes[a] - l.sizes[b]))
}
/** Indices ordered by where they end, as an eye that only sees the right-hand ends would. */
function byEnd(l: Lineup): number[] {
  const dir = l.q === 'long' ? -1 : 1
  const end = (i: number) => l.starts[i] + l.sizes[i]
  return [0, 1, 2, 3].sort((a, b) => dir * (end(a) - end(b)))
}

const FACTS: readonly Fact[] = LINEUPS.map(([id, family, lineup], rank) => ({
  id: `lng:${id}`,
  skill: 'compareLength',
  family,
  operands: [],
  answer: token(lineup.objects[byLength(lineup)[0]]),
  rank,
  data: lineup as unknown as Fact['data'],
}))

function scene(l: Lineup, aligned: boolean, order: readonly number[]): CompareScene {
  return {
    scene: 'compareObjects',
    objects: order.map((i) => l.objects[i]),
    sizes: order.map((i) => l.sizes[i]),
    starts: order.map((i) => (aligned ? 0 : l.starts[i])),
    aligned,
    mode: 'length',
  }
}

const isConflict = (l: Lineup) => byEnd(l)[0] !== byLength(l)[0]
const sequence = (l: Lineup, order: readonly number[]) => order.map((i) => token(l.objects[i])).join('|')

function candidates(f: Fact): Candidate[] {
  const l = lineupOf(f)
  const [answer, ...rest] = byLength(l)
  const misleading = byEnd(l)[0] !== answer ? byEnd(l)[0] : null
  const plain = rest.filter((i) => i !== misleading)
  const ends = sequence(l, byEnd(l))
  return tagged(f.answer, [
    ...(misleading !== null ? [[token(l.objects[misleading]), 'lengthByEnd'] as const] : []),
    // the runner-up is the near miss; the others are plainly wrong
    ...plain.map((i, k) => [token(l.objects[i]), k === 0 ? 'near' : 'other'] as const),
    ...(ends !== sequence(l, byLength(l)) ? [[ends, 'lengthByEnd'] as const] : []),
  ])
}

function hint(f: Fact, tag: string | null): HintSpec {
  const l = lineupOf(f)
  const align = say(l.q === 'long' ? 'hint.compareLength.alignLong' : 'hint.compareLength.alignShort')
  const lined = scene(l, true, [0, 1, 2, 3])
  if (tag === 'lengthByEnd') return hintOf([say('hint.compareLength.bothEnds'), align], lined, 'lengthByEnd')
  return hintOf([align], lined)
}

export default {
  ...metaOf('compareLength'),
  kinds: ['choice', 'sortOrder'],
  enumerate: () => [...FACTS],
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'sortOrder' ? sequence(lineupOf(f), byLength(lineupOf(f))) : f.answer),
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'sortOrder' ? 'set' : 'token'),
  answerType: () => 'token',
  prompt: (f: Fact, _kind: TaskKind, rng: Rng) => scene(lineupOf(f), f.family === 'aligned', rng.shuffle([0, 1, 2, 3])),
  optionView: () => 'picture',
  range: () => [0, 1],
  speech: (f, kind) => {
    const long = lineupOf(f).q === 'long'
    if (kind === 'sortOrder') return [say(long ? 's.compareLength.sortLong' : 's.compareLength.sortShort')]
    return [say(long ? 's.compareLength.longest' : 's.compareLength.shortest')]
  },
  candidates,
  hint,
  contrast: (f: Fact) => (isConflict(lineupOf(f)) ? 'conflict' : 'congruent'),
} satisfies SkillModule
