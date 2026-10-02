// halfShape — Halve (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 16 facts, prefix `hlv:`.
//   equal    hlv:<shape>:e   the figure cut down the middle into two halves      8
//   unequal  hlv:<shape>:u   the figure cut off the middle into two unequal parts 8
// Figures (standard variant, all mirror-symmetric about the middle line, geo.ts): cirkel, kvadrat,
// rektangel, trekant, sekskant, ottekant, rombe and trapez. The cut is Shape2D's dashed line (`cut`).
// trueFalse: "Er figuren delt i to halve?" on the one figure (KIND2's example). multiSelect
// (production): "Tryk på alle figurer, der er delt i to halve." Six figures (prompt 'shapes', ids
// h0–h5, each with its `cut`, see below): the fact's own, two or three more cut in halves, and figures
// that are not: cut unequally, or not cut at all.
//
// unequalParts (perceptual, "to dele er altid halve", SPEC §4.2–4.3): on an unequal fact, 'yes' on the
// card and taking the unequally cut figures with the halves are the misconception's answers; the
// unequal facts are 'conflict', the equal ones 'congruent' (there a two-parts-are-halves child answers
// right: on the cards 'yes', and the plate of an equal fact has no unequal cut, only uncut figures).
// 'no' on an equal fact is 'other'; a multiSelect that leaves a half out is 'near'.
//
// The figures of a multiSelect carry their cut in the prompt items (`cut`, the field Shape2D draws).
// The task views draw the items without it until the proposed one-line change to faces.tsx and
// PromptScene (see the SK2-GEO report) lands; the true/false task is drawn complete today.
import type { AnswerValue, Fact, Prompt, Rng, ShapeId, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hashSeed, makeRng } from '../../rng'
import { hintOf, metaOf, say, tagged, type Entry } from '../number/kit'

type Cut = 'equal' | 'unequal'

const SHAPES: readonly ShapeId[] = ['circle', 'square', 'rectangle', 'triangle', 'hexagon', 'octagon', 'rhombus', 'trapezoid']

interface Item {
  id: string
  shape: ShapeId
  variant: number
  cut?: Cut
}

interface Parsed {
  shape: ShapeId
  cut: Cut
}

function parse(f: Pick<Fact, 'id'>): Parsed {
  const [, shape, c] = f.id.split(':')
  return { shape: shape as ShapeId, cut: c === 'e' ? 'equal' : 'unequal' }
}

/**
 * The six figures of "Tryk på alle …", the same every time for one fact. An equal fact: three or four
 * halves and uncut figures. An unequal fact: its own figure, one more unequal cut, halves and an uncut
 * one, so the two-parts-are-halves answer differs from the right one.
 */
function itemsFor(shape: ShapeId, cut: Cut): Item[] {
  const rng = makeRng(hashSeed(`hlv-items:${shape}:${cut}`))
  const others = rng.shuffle(SHAPES.filter((s) => s !== shape))
  const figs: Omit<Item, 'id'>[] = [{ shape, variant: 0, cut }]
  if (cut === 'equal') {
    const halves = rng.next() < 0.5 ? 2 : 3
    for (let i = 0; i < halves; i++) figs.push({ shape: others[i], variant: 0, cut: 'equal' })
    while (figs.length < 6) figs.push({ shape: others[figs.length - 1], variant: rng.pick([0, 4, 5]) })
  } else {
    figs.push({ shape: others[0], variant: 0, cut: 'unequal' })
    figs.push({ shape: others[1], variant: 0, cut: 'equal' }, { shape: others[2], variant: 0, cut: 'equal' })
    figs.push({ shape: others[3], variant: 0, cut: rng.next() < 0.5 ? 'equal' : undefined })
    figs.push({ shape: others[4], variant: rng.pick([0, 4, 5]) })
  }
  const ids = rng.shuffle([0, 1, 2, 3, 4, 5]).map((i) => `h${i}`)
  return figs.map((fig, i) => ({ id: ids[i], ...fig }))
}

const items = (f: Fact): Item[] => {
  const { shape, cut } = parse(f)
  return itemsFor(shape, cut)
}
const join = (ids: readonly string[]): string => [...ids].sort().join('|')
const halves = (f: Fact): string => join(items(f).filter((i) => i.cut === 'equal').map((i) => i.id))

const FACTS: readonly Fact[] = (['equal', 'unequal'] as const).flatMap((family, fi) =>
  SHAPES.map((shape, si) => ({
    id: `hlv:${shape}:${family === 'equal' ? 'e' : 'u'}`,
    skill: 'halfShape' as const,
    family,
    operands: [],
    answer: family === 'equal' ? 'yes' : 'no',
    rank: si * 2 + fi,
  })),
)

function candidates(f: Fact) {
  const { cut } = parse(f)
  const all = items(f)
  const yes = halves(f)
  const entries: Entry[] = [[cut === 'equal' ? 'no' : 'yes', cut === 'equal' ? 'other' : 'unequalParts']]
  // every cut figure taken for halves
  const cutOnes = join(all.filter((i) => i.cut).map((i) => i.id))
  if (cutOnes !== yes) entries.push([cutOnes, 'unequalParts'])
  // one of the halves left out
  const ids = yes.split('|')
  if (ids.length > 2) entries.push([join(ids.slice(1)), 'near'])
  return tagged(f.answer, entries)
}

function hint(f: Fact, tag: string | null, kind?: TaskKind) {
  const { shape, cut } = parse(f)
  const visual: Prompt = { scene: 'shape', shape, variant: 0, cut }
  const verdict = say(cut === 'equal' ? 'hint.halfShape.same' : 'hint.halfShape.notSame')
  if (tag === 'unequalParts') {
    return hintOf([say('hint.halfShape.twoPartsNotHalves'), say('hint.halfShape.halvesSame'), ...(kind === 'multiSelect' ? [] : [verdict])], visual, 'unequalParts')
  }
  if (kind === 'multiSelect') return hintOf([say('hint.halfShape.lookEach'), say('hint.halfShape.halvesSame')], visual)
  return hintOf([say('hint.halfShape.fold'), verdict], visual)
}

export default {
  ...metaOf('halfShape'),
  kinds: ['trueFalse', 'multiSelect'],
  enumerate: () => [...FACTS],
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'multiSelect' ? halves(f) : f.answer),
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'multiSelect' ? 'set' : 'token'),
  answerType: () => 'token',
  prompt: (f: Fact, kind: TaskKind, rng: Rng): Prompt => {
    if (kind === 'multiSelect') return { scene: 'shapes', items: rng.shuffle(items(f)) }
    const { shape, cut } = parse(f)
    return { scene: 'shape', shape, variant: 0, cut }
  },
  optionView: (_f: Fact, kind: TaskKind) => (kind === 'multiSelect' ? 'shape' : 'yesNo'),
  range: () => [0, 1],
  speech: (_f: Fact, kind: TaskKind) =>
    kind === 'multiSelect' ? [say('frag.tryk_paa'), say('s.halfShape.all')] : [say('s.halfShape.isHalves')],
  candidates,
  hint,
  contrast: (f: Fact) => (parse(f).cut === 'unequal' ? 'conflict' : 'congruent'),
} satisfies SkillModule
