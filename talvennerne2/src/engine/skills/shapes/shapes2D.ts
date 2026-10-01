// shapes2D — Flade figurer (SPEC §2.2–2.3, pædagogik-forslaget §1.3). Recall, 42 facts `shp:<shape>:<v>`.
//   basic       circle, triangle, quadrilateral ("firkant"); variants 0–5      18   0. kl.
//   squareRect  square, rectangle; variants 0–5                                 12   1. kl.
//   polygons    pentagon, hexagon, octagon; variants 0, 5, 1, 2                 12   1. kl.
// Variants are the materials' (Shapes.tsx): 0 standard, 1 turned, 2 stretched/skew, 3 small,
// 4 patterned, 5 outline. A fact is "this figure in this variant".
//
// choice: "Tryk på trekanten." Three shape cards: the fact's figure and two figures that are not
//   triangles. The cards are tokens `shape:<shape>:<variant>` (optionView 'shape', never read aloud);
//   the prompt is only the spoken question ({ scene: 'hear' }).
// multiSelect (production): "Tryk på alle trekanter." Six figures (prompt 'shapes', ids s0–s5): the
//   fact's figure, one or two more of its kind and non-members. "Alle rektangler" includes a square.
//
// Perceptual contrast (prototypeOnly, "genkender kun figurer, der står pænt"): a fact in a turned,
// stretched or small variant is 'conflict', the others 'congruent' (a circle looks the same any way).
// On a conflict fact the answer set holds two prototypical members beside the fact's own figure, and
// selecting only those is the prototypeOnly candidate; on the cards, any other figure is (the turned
// triangle was not seen as a triangle). On congruent facts the wrong cards are plain 'other'.
// isA (isA.ts): a distractor is never a member of the answer, every member is in the answer set.
import type { AnswerValue, Candidate, Fact, HintSpec, Prompt, Rng, ShapeId, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hashSeed, makeRng } from '../../rng'
import { hintOf, metaOf, say, tagged } from '../number/kit'
import { shows } from './isA'

type Family = 'basic' | 'squareRect' | 'polygons'

interface Figure {
  shape: ShapeId
  variant: number
}
interface Item extends Figure {
  id: string
}

/** Introduction order of the variants: as in the books first, then surface changes, then turned and skew. */
const ALL_VARIANTS = [0, 4, 5, 3, 1, 2] as const
const POLYGON_VARIANTS = [0, 5, 1, 2] as const

const FAMILIES: Readonly<Record<Family, { shapes: readonly ShapeId[]; variants: readonly number[] }>> = {
  basic: { shapes: ['circle', 'triangle', 'quadrilateral'], variants: ALL_VARIANTS },
  squareRect: { shapes: ['square', 'rectangle'], variants: ALL_VARIANTS },
  polygons: { shapes: ['pentagon', 'hexagon', 'octagon'], variants: POLYGON_VARIANTS },
}

/** Turned, stretched and small figures are the ones a prototype-only eye misses; a circle has none. */
export const isPrototypical = (shape: ShapeId, variant: number): boolean => shape === 'circle' || ![1, 2, 3].includes(variant)

const variantsOf = (shape: ShapeId): readonly number[] => (FAMILIES.polygons.shapes.includes(shape) ? POLYGON_VARIANTS : ALL_VARIANTS)
const each = (shape: ShapeId, variants: readonly number[] = variantsOf(shape)): Figure[] => variants.map((variant) => ({ shape, variant }))

/** Figures that are not the target, for the wrong cards and the non-members of a multiSelect. */
function othersFor(target: ShapeId): Figure[] {
  const pool = ((): Figure[] => {
    switch (target) {
      case 'circle':
        return [...each('triangle'), ...each('quadrilateral')]
      case 'triangle':
        return [...each('circle'), ...each('quadrilateral')]
      case 'quadrilateral':
        return [...each('circle'), ...each('triangle')]
      case 'square':
        // the other four-sided figures: rectangles, rhombi, trapezia and a skew one
        return [...each('rectangle'), ...each('rhombus', [0, 1, 2]), ...each('trapezoid', [0, 1, 2]), ...each('quadrilateral', [2])]
      case 'rectangle':
        // never a square: a square is a rectangle
        return [...each('rhombus', [0, 1, 2]), ...each('trapezoid', [0, 1, 2]), ...each('quadrilateral', [2]), ...each('triangle', [0, 1])]
      default:
        return FAMILIES.polygons.shapes.filter((s) => s !== target).flatMap((s) => each(s))
    }
  })()
  return pool.filter((f) => !shows(f.shape, f.variant, target))
}

const token = (f: Figure) => `shape:${f.shape}:${f.variant}`

interface ShapeData {
  shape: ShapeId
  variant: number
  /** The six figures of the multiSelect task, ids s0–s5. */
  items: Item[]
}
const dataOf = (f: Fact) => f.data as unknown as ShapeData

/** Six figures: the fact's own, one or two more members, the rest non-members. Deterministic per fact. */
function itemsFor(shape: ShapeId, variant: number): Item[] {
  const rng = makeRng(hashSeed(`shp-items:${shape}:${variant}`))
  const proto = variantsOf(shape).filter((v) => v !== variant && isPrototypical(shape, v))
  const members: Figure[] = [{ shape, variant }, ...rng.shuffle(proto).slice(0, 2).map((v) => ({ shape, variant: v }))]
  // "Tryk på alle rektangler": a square is one of them
  if (shape === 'rectangle') members[members.length - 1] = { shape: 'square', variant: members[members.length - 1].variant }
  const nonMembers = spread(othersFor(shape), 6 - members.length, rng)
  const ids = rng.shuffle([0, 1, 2, 3, 4, 5]).map((i) => `s${i}`)
  return [...members, ...nonMembers].map((f, i) => ({ id: ids[i], ...f }))
}

/** `n` figures taken round-robin over the shapes in the pool, so the non-members are not all alike. */
function spread(pool: readonly Figure[], n: number, rng: Rng): Figure[] {
  const byShape = new Map<ShapeId, Figure[]>()
  for (const f of rng.shuffle(pool)) byShape.set(f.shape, [...(byShape.get(f.shape) ?? []), f])
  const groups = rng.shuffle([...byShape.values()])
  const out: Figure[] = []
  for (let round = 0; out.length < n; round++) {
    for (const g of groups) if (out.length < n && g[round]) out.push(g[round])
  }
  return out
}

const FACTS: readonly Fact[] = (Object.keys(FAMILIES) as Family[]).flatMap((family, fi) =>
  FAMILIES[family].variants.flatMap((variant, vi) =>
    FAMILIES[family].shapes.map((shape, si) => {
      const data: ShapeData = { shape, variant, items: itemsFor(shape, variant) }
      return {
        id: `shp:${shape}:${variant}`,
        skill: 'shapes2D' as const,
        family,
        operands: [],
        answer: token({ shape, variant }),
        rank: fi * 100 + vi * 10 + si,
        data: data as unknown as Fact['data'],
      }
    }),
  ),
)

/** The members of the multiSelect, sorted ids joined by '|'. */
function memberSet(f: Fact, keep: (i: Item) => boolean = () => true): string {
  const { shape, items } = dataOf(f)
  return items.filter((i) => shows(i.shape, i.variant, shape) && keep(i)).map((i) => i.id).sort().join('|')
}

function candidates(f: Fact): Candidate[] {
  const { shape, variant } = dataOf(f)
  if (isPrototypical(shape, variant)) return tagged(f.answer, othersFor(shape).map((o) => [token(o), 'other'] as const))
  // A conflict fact: the asked figure is turned, stretched or small. A child who only knows figures that
  // stand "nicely" does not find it among the cards — whichever other card they tap — and in the
  // multiSelect leaves exactly that member out. The contrast rule (right on congruent facts) keeps a
  // child who simply does not know the figures from being read as this.
  return tagged(f.answer, [
    [memberSet(f, (i) => isPrototypical(i.shape, i.variant)), 'prototypeOnly'],
    ...othersFor(shape).map((o) => [token(o), 'prototypeOnly'] as const),
  ])
}

function hint(f: Fact, tag: string | null): HintSpec {
  const { shape, variant } = dataOf(f)
  const what = [say(`hint.shapes2D.${shape}`), ...(shape === 'rectangle' ? [say('hint.shapes2D.squareIsRect')] : [])]
  const visual: Prompt = { scene: 'shape', shape, variant, ...(shape === 'circle' ? {} : { mark: 'corners' as const }) }
  if (tag === 'prototypeOnly') {
    return hintOf([say('hint.shapes2D.stillShape'), say(`noun.shape.${shape}.indef.end`), ...what], visual, 'prototypeOnly')
  }
  return hintOf(what, visual)
}

export default {
  ...metaOf('shapes2D'),
  kinds: ['choice', 'multiSelect'],
  enumerate: () => [...FACTS],
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'multiSelect' ? memberSet(f) : f.answer),
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'multiSelect' ? 'set' : 'token'),
  answerType: () => 'token',
  prompt: (f, kind, rng) => (kind === 'multiSelect' ? { scene: 'shapes', items: rng.shuffle(dataOf(f).items) } : { scene: 'hear' }),
  optionView: () => 'shape',
  range: () => [0, 1],
  speech: (f, kind) =>
    kind === 'multiSelect'
      ? [say('frag.tryk_paa'), say('s.shapes2D.all'), say(`noun.shape.${dataOf(f).shape}.pl.end`)]
      : [say('frag.tryk_paa'), say(`noun.shape.${dataOf(f).shape}.def.end`)],
  candidates,
  hint,
  contrast: (f: Fact) => (isPrototypical(dataOf(f).shape, dataOf(f).variant) ? 'congruent' : 'conflict'),
} satisfies SkillModule
