// composeShapes — Sammensæt figurer (SPEC §2.2, pædagogik-forslaget §1.3: "2 trekanter = kvadrat").
// Recall, 16 facts, prefix `cps:`, with the pattern blocks every classroom has (all sides equally long:
// trekant, rombe, trapez, sekskant, kvadrat) and halves of a circle:
//   make  cps:m:<whole>:<piece>         "Hvor mange trekanter skal der til for at lave en sekskant?"  8
//   take  cps:k:<count>:<piece>:<whole> "Du har seks trekanter. Hvor mange romber kan du lave af dem?" 8
// A big triangle or square (`big-triangle`, `big-square`) has sides two pieces long: four small ones.
// The prompt shows the whole beside one piece (make), or the pieces you have (take) ({ scene: 'shapes' }).
// choice: three number cards. keypad (production): 0–12.
// Wrong answers: one piece too many or too few ('near'); in a take task the number of pieces you have
// ('operand', a number from the question, A9) and the whole counted as made of triangles when it is
// made of other pieces ('other'). No misconception in the catalogue (SPEC §4.2).
// Hint: "Forestil dig, at du lægger trekanter på sekskanten. Der skal seks til." / "En rombe er lavet
// af to trekanter. Seks trekanter giver tre romber."
import type { Fact, Prompt, ShapeId, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'
import { shapeClip } from '../../../speech/nouns'

type Whole = ShapeId | 'big-triangle' | 'big-square'

/** How many pieces make one whole (pattern blocks: a hexagon is 6 triangles, 3 rhombi or 2 trapezia). */
const MAKES: Readonly<Record<string, number>> = {
  'rhombus/triangle': 2,
  'trapezoid/triangle': 3,
  'hexagon/triangle': 6,
  'hexagon/trapezoid': 2,
  'hexagon/rhombus': 3,
  'circle/semicircle': 2,
  'big-triangle/triangle': 4,
  'big-square/square': 4,
}

const MAKE: readonly (readonly [Whole, ShapeId])[] = [
  ['circle', 'semicircle'], ['rhombus', 'triangle'], ['trapezoid', 'triangle'], ['hexagon', 'trapezoid'],
  ['hexagon', 'rhombus'], ['big-square', 'square'], ['big-triangle', 'triangle'], ['hexagon', 'triangle'],
]
const TAKE: readonly (readonly [number, ShapeId, Whole])[] = [
  [4, 'triangle', 'rhombus'], [6, 'semicircle', 'circle'], [4, 'trapezoid', 'hexagon'], [6, 'triangle', 'rhombus'],
  [6, 'triangle', 'trapezoid'], [6, 'rhombus', 'hexagon'], [8, 'triangle', 'rhombus'], [6, 'trapezoid', 'hexagon'],
]

type Parsed =
  | { type: 'make'; whole: Whole; piece: ShapeId; per: number; answer: number }
  | { type: 'take'; whole: Whole; piece: ShapeId; per: number; count: number; answer: number }

function parse(f: Pick<Fact, 'id'>): Parsed {
  const parts = f.id.split(':')
  if (parts[1] === 'm') {
    const [whole, piece] = [parts[2] as Whole, parts[3] as ShapeId]
    const per = MAKES[`${whole}/${piece}`]
    return { type: 'make', whole, piece, per, answer: per }
  }
  const [count, piece, whole] = [Number(parts[2]), parts[3] as ShapeId, parts[4] as Whole]
  const per = MAKES[`${whole}/${piece}`]
  return { type: 'take', whole, piece, per, count, answer: count / per }
}

const FACTS: readonly Fact[] = [
  ...MAKE.map(([whole, piece]) => `cps:m:${whole}:${piece}`),
  ...TAKE.map(([count, piece, whole]) => `cps:k:${count}:${piece}:${whole}`),
].map((id, rank) => {
  const p = parse({ id })
  return { id, skill: 'composeShapes' as const, family: 'compose', operands: p.type === 'take' ? [p.count] : [], answer: p.answer, rank }
})

const bigOf = (w: Whole): ShapeId | null => (w === 'big-triangle' ? 'triangle' : w === 'big-square' ? 'square' : null)

/** A whole's words: the catalogue noun, or "en stor trekant" / "et stort kvadrat". */
function wholeSays(w: Whole, kind: 'indef' | 'def' | 'pl', form: 'mid' | 'end'): SpeechPart {
  const big = bigOf(w)
  if (big) return say(`s.composeShapes.big.${big}.${kind}.${form}`)
  return say(shapeClip(w as ShapeId, kind, form))
}
/** A piece's words in the plural; the pieces of a big figure are "små trekanter". */
function pieceSays(p: Parsed, form: 'mid' | 'end'): SpeechPart {
  if (bigOf(p.whole)) return say(`s.composeShapes.small.${p.piece}.${form}`)
  return say(shapeClip(p.piece, 'pl', form))
}

function prompt(f: Fact): Prompt {
  const p = parse(f)
  if (p.type === 'make') {
    const big = bigOf(p.whole)
    return {
      scene: 'shapes',
      items: [
        { id: 'w', shape: big ?? (p.whole as ShapeId), variant: 0 },
        { id: 'p', shape: p.piece, variant: big ? 3 : 0 },
      ],
    }
  }
  return { scene: 'shapes', items: Array.from({ length: p.count }, (_, i) => ({ id: `p${i}`, shape: p.piece, variant: 0 })) }
}

function candidates(f: Fact) {
  const p = parse(f)
  const n = p.answer
  const entries: Entry[] = [[n - 1, 'near'], [n + 1, 'near']]
  if (p.type === 'take') {
    entries.push([p.count, 'operand'], [p.per, 'other'], [p.count * p.per, 'other'])
    // as if every whole were made of triangles
    const tri = MAKES[`${p.whole}/triangle`]
    if (tri && p.count % tri === 0) entries.push([p.count / tri, 'other'])
  } else {
    // as if the whole were made of another piece
    for (const [key, per] of Object.entries(MAKES)) if (key.startsWith(`${p.whole}/`)) entries.push([per, 'other'])
    entries.push([n + 2, 'other'])
  }
  return tagged(n, entries)
}

function hint(f: Fact) {
  const p = parse(f)
  const visual = prompt(f)
  if (p.type === 'make') {
    return hintOf([
      say('hint.composeShapes.imagine'), pieceSays(p, 'mid'), say('hint.composeShapes.on'), wholeSays(p.whole, 'def', 'end'),
      say('hint.composeShapes.takes'), num(p.answer, 'mid'), say('hint.composeShapes.toIt'),
    ], visual)
  }
  return hintOf([
    wholeSays(p.whole, 'indef', 'mid'), say('hint.composeShapes.madeOf'), num(p.per, 'mid'), pieceSays(p, 'end'),
    num(p.count, 'mid'), pieceSays(p, 'mid'), say('hint.composeShapes.give'), num(p.answer, 'mid'), wholeSays(p.whole, 'pl', 'end'),
  ], visual)
}

export default {
  ...metaOf('composeShapes'),
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt,
  optionView: () => 'numeral',
  range: () => [0, 12],
  speech: (f: Fact, _kind: TaskKind) => {
    const p = parse(f)
    if (p.type === 'make') return [say('s.composeShapes.howMany'), pieceSays(p, 'mid'), say('s.composeShapes.needed'), wholeSays(p.whole, 'indef', 'end')]
    return [say('s.composeShapes.youHave'), num(p.count, 'mid'), pieceSays(p, 'end'), say('s.composeShapes.howMany'), wholeSays(p.whole, 'pl', 'mid'), say('s.composeShapes.canMake')]
  },
  candidates,
  hint,
} satisfies SkillModule
