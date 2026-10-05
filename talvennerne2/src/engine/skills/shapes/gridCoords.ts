// gridCoords — Koordinater (SPEC §2.2, A21, pædagogik-forslaget §1.3). Procedure, prefix `crd:`: a point
// (x, y), x and y 0–6, on the net with axes 0–6 (Prompt 'grid' with coords; 49 per family):
//   readPoint   crd:r:<x>,<y>   the point is drawn, the child reads it off
//   placePoint  crd:p:<x>,<y>   the point is named, the child sets it
// The 20 canonical facts per family are spread over the net, the points off the axes first.
// Kinds:
//   grid (production, A21, src/ui/task/grid): readPoint "Hvor langt hen og hvor langt op er punktet?" —
//     the child taps the point's number on each axis; the answer is the tokens 'x:3|y:2' (a set, any
//     order). placePoint "Sæt punktet tre, to." — the child taps the crossing; the answer is 'pt:3,2'.
//     Either is 1 in 49 by guessing (kinds.ts).
//   choice: one of the point's numbers on three cards — "Hvor langt hen er punktet?" over the point
//     (readPoint), "Du skal sætte punktet tre, to. Hvor langt op skal du gå?" over the empty net
//     (placePoint). The instance decides which number: "hen" when x + y is even.
// Wrong answers: coordSwap (SPEC A23, a concept) — the two numbers swapped: 'x:2|y:3' read and 'pt:2,3'
// set on the net, and on readPoint's cards the point's other number. On placePoint's cards the other
// number was said in the question, an operand as well, so it is 'ambiguous' (A9). A point with x = y
// cannot show it. One step off along either axis is 'near'.
// Hint: "Kig lige ned under punktet. Der står tre. Kig lige over til venstre. Der står to." (read) or
// "Start i nul. Gå tre hen og så to op. Der er punktet." (place), after "Det første tal er hen, og det
// andet tal er op." for coordSwap (its own hint) and the other wrong answers, and always on placePoint's
// cards.
import type { AnswerValue, Candidate, ErrorTag, Fact, FamilyDef, Prompt, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'

type Family = 'readPoint' | 'placePoint'
/** The net's size: axes 0–6. */
const N = 6
const FAST: Partial<Record<TaskKind, number>> = { choice: 7_000, grid: 10_000 }
const META = metaOf('gridCoords')
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))

interface Point {
  family: Family
  x: number
  y: number
  /** The cards ask "hen" (x), else "op" (y). */
  along: boolean
}

function parse(f: Pick<Fact, 'id'>): Point {
  const m = /^crd:([rp]):(\d),(\d)$/.exec(f.id)
  if (!m) throw new Error(`gridCoords: bad id ${f.id}`)
  const [x, y] = [Number(m[2]), Number(m[3])]
  return { family: m[1] === 'r' ? 'readPoint' : 'placePoint', x, y, along: (x + y) % 2 === 0 }
}

const gridAnswer = ({ family, x, y }: Point): string => (family === 'readPoint' ? `x:${x}|y:${y}` : `pt:${x},${y}`)

function factOf(family: Family, x: number, y: number, rank = 0): Fact {
  const id = `crd:${family === 'readPoint' ? 'r' : 'p'}:${x},${y}`
  return { id, skill: 'gridCoords', family, operands: family === 'placePoint' ? [x, y] : [], answer: gridAnswer(parse({ id })), rank }
}

const POINTS: readonly (readonly [number, number])[] = Array.from({ length: (N + 1) ** 2 }, (_, i) => [i % (N + 1), Math.floor(i / (N + 1))])
const INSIDE = POINTS.filter(([x, y]) => x > 0 && y > 0)
const ON_AXES = POINTS.filter(([x, y]) => x === 0 || y === 0)
/** 16 points off the axes and 4 on them, picked with a fixed stride so they spread over the net. */
const CANON = [...Array.from({ length: 16 }, (_, i) => INSIDE[(i * 11) % INSIDE.length]), ...Array.from({ length: 4 }, (_, i) => ON_AXES[(i * 5) % ON_AXES.length])]

const FACTS: readonly Fact[] = (['readPoint', 'placePoint'] as const).flatMap((family, fi) => CANON.map(([x, y], i) => factOf(family, x, y, fi * 100 + i)))

function instance(fam: FamilyDef, rng: Rng, avoid: ReadonlySet<string>): Fact {
  const family = fam.id as Family
  const all = POINTS.map(([x, y]) => factOf(family, x, y))
  const fresh = all.filter((f) => !avoid.has(f.id))
  return rng.pick(fresh.length > 0 ? fresh : all)
}

/** The number a card asks for. */
const asked = (p: Point) => (p.along ? p.x : p.y)

function candidatesFor(f: Fact, kind: TaskKind): Candidate[] {
  const p = parse(f)
  if (kind === 'choice') {
    const v = asked(p)
    const other = p.along ? p.y : p.x
    // the swap (A23); placePoint said the other number, so there it is an operand too: 'ambiguous' (A9)
    const swap: Entry[] = p.family === 'placePoint' ? [[other, 'coordSwap'], [other, 'operand']] : [[other, 'coordSwap']]
    return tagged(v, [...swap, [v + 1, 'near'], [v - 1, 'near']])
  }
  const at = (x: number, y: number) => gridAnswer({ ...p, x, y })
  const near: Entry[] = [[p.x + 1, p.y], [p.x - 1, p.y], [p.x, p.y + 1], [p.x, p.y - 1]]
    .filter(([x, y]) => x >= 0 && y >= 0 && x <= N && y <= N)
    .map(([x, y]) => [at(x, y), 'near'])
  return tagged(gridAnswer(p), [[at(p.y, p.x), 'coordSwap'], ...near])
}

function hint(f: Fact, tag: ErrorTag | null, kind?: TaskKind) {
  const p = parse(f)
  const visual: Prompt = { scene: 'grid', w: N, h: N, filled: [], coords: true, point: [p.x, p.y] }
  const swapped = tag === 'coordSwap' || tag === 'other' || tag === 'operand'
  let words: SpeechPart[]
  if (p.family === 'placePoint') {
    words = [say('hint.gridCoords.fromZero'), say('hint.gridCoords.go'), num(p.x, 'mid'), say('hint.gridCoords.alongThen'), num(p.y, 'mid'), say('hint.gridCoords.upThere')]
  } else {
    const down = [say('hint.gridCoords.down'), num(p.x)]
    const side = [say('hint.gridCoords.side'), num(p.y)]
    words = kind === 'choice' ? (p.along ? down : side) : [...down, ...side]
  }
  const order = swapped || (kind === 'choice' && p.family === 'placePoint')
  return hintOf(order ? [say('hint.gridCoords.order'), ...words] : words, visual, tag === 'coordSwap' ? 'coordSwap' : undefined)
}

export default {
  ...META,
  families: FAMILIES,
  kinds: ['choice', 'grid'],
  enumerate: () => [...FACTS],
  instance,
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'grid' ? f.answer : asked(parse(f))),
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'grid' ? 'set' : 'int'),
  answerType: () => 'set',
  prompt: (f: Fact): Prompt => {
    const p = parse(f)
    return { scene: 'grid', w: N, h: N, filled: [], coords: true, ...(p.family === 'readPoint' ? { point: [p.x, p.y] as [number, number] } : {}) }
  },
  optionView: (_f: Fact, kind: TaskKind) => (kind === 'grid' ? 'picture' : 'numeral'),
  range: () => [0, N],
  speech: (f: Fact, kind: TaskKind): SpeechPart[] => {
    const p = parse(f)
    if (p.family === 'readPoint') return [say(kind === 'grid' ? 's.gridCoords.read' : p.along ? 's.gridCoords.readAlong' : 's.gridCoords.readUp')]
    const pair = [num(p.x, 'mid'), num(p.y)]
    if (kind === 'grid') return [say('s.gridCoords.place'), ...pair]
    return [say('s.gridCoords.toPlace'), ...pair, say(p.along ? 's.gridCoords.howFarAlong' : 's.gridCoords.howFarUp')]
  },
  candidates: (f: Fact) => [...candidatesFor(f, 'grid'), ...candidatesFor(f, 'choice')],
  candidatesFor,
  hint,
} satisfies SkillModule
