// weightCompare — Tungest og lettest (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 12 facts `vgt:<id>`.
//   congruent  vgt:g1–g6   the heavy things are drawn big and the light ones small        6
//   conflict   vgt:k1–k6   the heavy things are drawn small, light ones big (a big balloon) 6
// A fact is a set of things a child knows the weight of: heavy (a stone, a bottle of water, a book) and
// light (a feather, a balloon, a leaf, a flower, a key, a strawberry, a marble, and a pillow next to a
// stone or a bottle). Every comparison is heavy against light, never two of a kind (stone or book?).
//
// choice: "Hvilken ting er tungest?" — three things on the shelf, one heavy and two light; cards `obj:<id>`.
// multiSelect (production): "Tryk på alle de ting, der er tungere end bamsen." — the teddy first in
// the prompt (the reference, src/ui/task/multiSelect/View.tsx), then six things `o0`–`o5` in a fixed
// order; the heavy ones (two or three) are the answer, a set like 'o1|o3'.
// Prompt { scene: 'compareObjects', objects, sizes, aligned: true, mode: 'weight', weights }: sizes are
// the drawn sizes (teddy 4); `weights` (grams, roughly real) is not in the frozen Prompt type — it is
// for a pan-scale picture (PanScale, src/art/materials/Balance.tsx) and proposed for types.ts. Until
// the scene draws scales, the weights are the child's own knowledge, which these things are chosen for.
//
// sizeIsWeight ("tror store ting altid er tungest", perceptual): the biggest thing on the card, and on
// multiSelect the things drawn bigger than the teddy. contrast is the family: on congruent facts that
// answer is right (and no candidate), on conflict facts it is the diagnostic card.
import type { AnswerValue, Fact, HintSpec, ObjectId, Prompt, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, say, tagged, type Entry } from '../number/kit'

const meta = metaOf('weightCompare')

/** Rough weights in grams; heavy things are always heavier than the teddy, light ones always lighter. */
export const GRAMS: Readonly<Record<string, number>> = {
  stone: 2000, bottle: 1000, book: 800, teddy: 250,
  pillow: 400, key: 20, strawberry: 15, flower: 10, marble: 8, balloon: 5, leaf: 2, feather: 1,
}
export const HEAVY: readonly ObjectId[] = ['stone', 'bottle', 'book']
export const TEDDY_SIZE = 4

type Thing = readonly [thing: ObjectId, size: number]

interface Scale {
  /** One heavy thing (the answer) and two light ones. */
  trio: readonly [Thing, Thing, Thing]
  /** Six things beside the teddy, in their fixed order o0–o5. */
  six: readonly Thing[]
}

const T = (thing: ObjectId, size: number): Thing => [thing, size]

/** Hand-made so every comparison is plain to a child; heavy things first in each trio. */
export const SCALES: Readonly<Record<string, Scale>> = {
  // congruent: heavy drawn big (5–7), light drawn small (1–3)
  g1: { trio: [T('stone', 6), T('feather', 2), T('key', 1)], six: [T('stone', 6), T('feather', 2), T('bottle', 5), T('leaf', 1), T('key', 2), T('flower', 3)] },
  g2: { trio: [T('bottle', 7), T('strawberry', 2), T('leaf', 1)], six: [T('leaf', 1), T('book', 6), T('marble', 1), T('bottle', 7), T('feather', 3), T('strawberry', 2)] },
  g3: { trio: [T('book', 6), T('key', 2), T('flower', 3)], six: [T('key', 2), T('stone', 5), T('flower', 3), T('book', 6), T('marble', 1), T('strawberry', 2)] },
  g4: { trio: [T('stone', 7), T('marble', 1), T('strawberry', 2)], six: [T('bottle', 6), T('leaf', 2), T('stone', 7), T('key', 1), T('book', 5), T('feather', 3)] },
  g5: { trio: [T('bottle', 6), T('balloon', 3), T('feather', 2)], six: [T('feather', 2), T('bottle', 6), T('strawberry', 1), T('marble', 2), T('stone', 5), T('flower', 3)] },
  g6: { trio: [T('book', 7), T('leaf', 2), T('marble', 1)], six: [T('flower', 2), T('key', 1), T('book', 7), T('stone', 6), T('leaf', 3), T('bottle', 5)] },
  // conflict: heavy drawn small (1–3), some light things drawn big (5–7)
  k1: { trio: [T('stone', 2), T('balloon', 7), T('key', 1)], six: [T('balloon', 7), T('stone', 2), T('feather', 5), T('bottle', 3), T('key', 1), T('leaf', 2)] },
  k2: { trio: [T('bottle', 3), T('pillow', 7), T('strawberry', 1)], six: [T('leaf', 6), T('bottle', 2), T('marble', 1), T('book', 3), T('balloon', 7), T('flower', 2)] },
  k3: { trio: [T('book', 2), T('balloon', 6), T('feather', 1)], six: [T('stone', 1), T('flower', 5), T('book', 3), T('balloon', 6), T('key', 2), T('strawberry', 1)] },
  k4: { trio: [T('stone', 1), T('pillow', 6), T('leaf', 2)], six: [T('feather', 6), T('bottle', 2), T('leaf', 5), T('stone', 1), T('marble', 1), T('balloon', 7)] },
  k5: { trio: [T('bottle', 2), T('balloon', 7), T('flower', 3)], six: [T('book', 2), T('balloon', 6), T('stone', 3), T('strawberry', 1), T('bottle', 2), T('leaf', 5)] },
  k6: { trio: [T('stone', 2), T('feather', 6), T('marble', 1)], six: [T('flower', 6), T('stone', 2), T('key', 1), T('balloon', 5), T('bottle', 3), T('feather', 7)] },
}

const ORDER = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6']

const token = (thing: ObjectId) => `obj:${thing}`
const scaleOf = (f: Fact): Scale => SCALES[f.id.slice(f.id.indexOf(':') + 1)]
const heavyIn = (things: readonly Thing[]) => things.flatMap(([thing], i) => (HEAVY.includes(thing) ? [`o${i}`] : [])).join('|')
const biggerThanTeddy = (things: readonly Thing[]) => things.flatMap(([, size], i) => (size > TEDDY_SIZE ? [`o${i}`] : [])).join('|')
/** The thing drawn biggest among the trio. */
const biggest = (trio: readonly Thing[]) => trio.reduce((a, b) => (b[1] > a[1] ? b : a))

const FACTS: readonly Fact[] = ORDER.map((id, rank) => ({
  id: `vgt:${id}`,
  skill: 'weightCompare',
  family: id.startsWith('g') ? 'congruent' : 'conflict',
  operands: [],
  answer: token(SCALES[id].trio[0][0]),
  // the two families alternate, so new keys meet both kinds of picture early
  rank: (rank % 6) * 2 + (id.startsWith('g') ? 0 : 1),
}))

/** The compareObjects scene with the weights a pan-scale picture would need (proposed for types.ts). */
export type WeighScene = Extract<Prompt, { scene: 'compareObjects' }> & { weights: number[] }

const weighScene = (things: readonly Thing[]): WeighScene => ({
  scene: 'compareObjects',
  objects: things.map(([thing]) => thing),
  sizes: things.map(([, size]) => size),
  aligned: true,
  mode: 'weight',
  weights: things.map(([thing]) => GRAMS[thing]),
})

const withTeddy = (six: readonly Thing[]): Thing[] => [T('teddy', TEDDY_SIZE), ...six]

function candidates(f: Fact) {
  const s = scaleOf(f)
  const [, a, b] = s.trio
  const big = biggest(s.trio)
  const misled = big[0] !== s.trio[0][0]
  const lights = [a, b].sort((x, y) => y[1] - x[1])
  const entries: Entry[] = [
    // the biggest thing is the diagnostic card where it is not the heaviest; otherwise the bigger light thing is the near miss
    ...lights.map(([thing], i): Entry => [token(thing), misled && thing === big[0] ? 'sizeIsWeight' : i === 0 ? 'near' : 'other']),
    [biggerThanTeddy(s.six), 'sizeIsWeight'],
  ]
  return tagged(heavyIn(s.six), tagged(f.answer, entries).map((c) => [c.value, c.tag] as const))
}

/**
 * The strategy: think of holding the things ("Tænk på, hvordan tingene føles, når du holder dem. En
 * sten er tung, selv når den er lille."); sizeIsWeight first: "Store ting er ikke altid tunge."
 */
function hint(f: Fact, tag: string | null, kind?: TaskKind): HintSpec {
  const s = scaleOf(f)
  const multi = kind === 'multiSelect'
  const heavy = multi ? s.six.filter(([thing]) => HEAVY.includes(thing)) : [s.trio[0]]
  const conflict = f.id.startsWith('vgt:k')
  const standard: SpeechPart[] = [
    say(multi ? 'hint.weightCompare.thinkTeddy' : 'hint.weightCompare.thinkHold'),
    ...[...new Set(heavy.map(([thing]) => thing))].map((thing) => say(`hint.weightCompare.${conflict ? 'heavyEvenSmall' : 'heavy'}.${thing}`)),
  ]
  const visual = multi ? weighScene([T('teddy', TEDDY_SIZE), ...heavy]) : weighScene(s.trio)
  if (tag === 'sizeIsWeight') return hintOf([say('hint.weightCompare.bigNotHeavy'), ...standard], visual, 'sizeIsWeight')
  return hintOf(standard, visual)
}

export default {
  ...meta,
  kinds: ['choice', 'multiSelect'],
  enumerate: () => [...FACTS],
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'multiSelect' ? heavyIn(scaleOf(f).six) : f.answer),
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'multiSelect' ? 'set' : 'token'),
  answerType: () => 'token',
  options: (f: Fact, kind: TaskKind) => (kind === 'multiSelect' ? scaleOf(f).six.map((_, i) => `o${i}`) : []),
  prompt: (f: Fact, kind: TaskKind, rng: Rng) => {
    const s = scaleOf(f)
    return kind === 'multiSelect' ? weighScene(withTeddy(s.six)) : weighScene(rng.shuffle(s.trio))
  },
  optionView: () => 'picture',
  range: () => [0, 1],
  speech: (_f: Fact, kind: TaskKind) => [say(kind === 'multiSelect' ? 's.weightCompare.heavierThanTeddy' : 's.weightCompare.heaviest')],
  candidates,
  hint: (f: Fact, tag, kind) => hint(f, tag, kind),
  contrast: (f: Fact) => (f.id.startsWith('vgt:k') ? 'conflict' : 'congruent'),
} satisfies SkillModule
