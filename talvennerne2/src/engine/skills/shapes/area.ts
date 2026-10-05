// area — Areal (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `ara:`, four families drawn on
// the square grid (Prompt 'area': the figure's squares filled on a grid one square wider all round):
//   countSquares  ara:n:<k>              5–12 squares grown at random inside a 5-by-4 box, without holes
//                                        and never a whole rectangle; k = 0–999 seeds it (canonical 0–19)
//   rowsCols      ara:r:<rows>x<cols>    a rectangle of 2–5 rows of 2–6 squares                       20
//   lShape        ara:l:<a>x<b>-<c>x<d>  an a-by-b rectangle (3–5 each way) with a c-by-d corner cut off;
//                                        the corner follows from the numbers                     81 (20)
//   compareArea   ara:c:<r>x<c>-<r>x<c>  a long rectangle (1–2 rows) beside a compact one, never as long:
//                                        "how many more squares does the bigger figure cover?"     23 (20)
// choice: three number cards. keypad (production): 0–40. No number is shown or said, so a task has no
// operands (A9).
// Wrong answers: areaAsPerimeter — the edge counted instead of the squares: the figure's perimeter in
// square sides (rowsCols 2 · (rows + cols), lShape that of the whole rectangle, compareArea the difference
// of the two perimeters, never a value another slip gives; where one does, it is 'ambiguous'). Plain:
// rows + cols, one row or column short, the uncut rectangle, one rectangle of two (cut either way),
// either figure alone or both together ('other'), one more or less ('near').
// Hint: count every square once / rows times columns / two rectangles added / each figure's area and the
// difference, after "Arealet er de kvadrater, der dækker figuren. Tæl ikke kanten rundt om den." for
// areaAsPerimeter (compareArea adds "En lang figur er ikke altid den største.").
import type { Fact, FamilyDef, Prompt, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hashSeed, makeRng } from '../../rng'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'

type Family = 'countSquares' | 'rowsCols' | 'lShape' | 'compareArea'
type Rect = readonly [rows: number, cols: number]

const FAST: Readonly<Record<Family, Partial<Record<TaskKind, number>>>> = {
  countSquares: { choice: 9_000, keypad: 12_000 },
  rowsCols: { choice: 8_000, keypad: 10_000 },
  lShape: { choice: 12_000, keypad: 16_000 },
  compareArea: { choice: 14_000, keypad: 18_000 },
}
const META = metaOf('area')
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST[f.id as Family] }))
const SQ_MID: SpeechPart = say('noun.shape.square.pl.mid')
const SQ_END: SpeechPart = say('noun.shape.square.pl.end')

/** A figure on its grid: the cells (row-major from the top left), the answer and what the hint names. */
interface Figure {
  family: Family
  w: number
  h: number
  cells: number[]
  answer: number
  /** The areaAsPerimeter value. */
  edge: number
  /** Plain wrong answers. */
  other: number[]
  /** rowsCols: rows and columns; lShape and compareArea: the two areas the hint adds or subtracts. */
  parts: [number, number]
}

const area = ([r, c]: Rect) => r * c
const perimeter = ([r, c]: Rect) => 2 * (r + c)
/** The cells of a rows-by-cols rectangle at (x, y) on a grid w wide. */
const block = (w: number, x: number, y: number, [r, c]: Rect): number[] =>
  Array.from({ length: r * c }, (_, i) => (y + Math.floor(i / c)) * w + x + (i % c))

// ─── countSquares: a random figure in the 5-by-4 box of a 7-by-6 grid ────────

const BW = 7
const BH = 6
const inBox = (c: number) => c >= 0 && c < BW * BH && c % BW >= 1 && c % BW <= 5 && Math.floor(c / BW) >= 1 && Math.floor(c / BW) <= 4

/** The edge of a figure inside the box, counted in square sides. */
function edgeOf(cells: readonly number[]): number {
  const on = new Set(cells)
  return cells.reduce((n, c) => n + [c - 1, c + 1, c - BW, c + BW].filter((d) => !on.has(d)).length, 0)
}

/** True when an empty square cannot be reached from the grid's border (a hole). */
function hasHole(on: ReadonlySet<number>): boolean {
  const seen = new Set<number>()
  const todo = Array.from({ length: BW * BH }, (_, c) => c).filter((c) => !on.has(c) && !inBox(c))
  for (const c of todo) seen.add(c)
  while (todo.length > 0) {
    const c = todo.pop()!
    for (const d of [c % BW > 0 ? c - 1 : -1, c % BW < BW - 1 ? c + 1 : -1, c - BW, c + BW]) {
      if (d >= 0 && d < BW * BH && !on.has(d) && !seen.has(d)) {
        seen.add(d)
        todo.push(d)
      }
    }
  }
  return seen.size + on.size < BW * BH
}

function blob(k: number): number[] {
  const rng = makeRng(hashSeed(`ara:n:${k}`))
  let cells: number[] = []
  for (let tries = 0; tries < 60; tries++) {
    const n = 5 + rng.int(8)
    const on = new Set([(1 + rng.int(4)) * BW + 1 + rng.int(5)])
    while (on.size < n) {
      const c = rng.pick([...on])
      const d = rng.pick([c - 1, c + 1, c - BW, c + BW])
      if (inBox(d)) on.add(d)
    }
    cells = [...on].sort((a, b) => a - b)
    const xs = cells.map((c) => c % BW)
    const ys = cells.map((c) => Math.floor(c / BW))
    const box = (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1)
    if (box !== n && !hasHole(on)) break
  }
  return cells
}

// ─── The figures from their ids ─────────────────────────────────────────────

/** compareArea: a long rectangle and a compact one, where counting the edge would answer otherwise. */
const PAIRS: readonly (readonly [Rect, Rect])[] = (() => {
  const long: Rect[] = [[1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [2, 5], [2, 6], [2, 7], [2, 8]]
  const squat: Rect[] = [2, 3, 4].flatMap((r) => [r - 1, r, r + 1].filter((c) => c >= 2 && c <= 4).map((c): Rect => [r, c]))
  const out: [Rect, Rect][] = []
  for (const a of long) {
    for (const b of squat) {
      const diff = Math.abs(area(a) - area(b))
      const edge = Math.abs(perimeter(a) - perimeter(b))
      if (diff === 0 || diff > 8 || a[1] <= b[1] || a[1] + b[1] > 12) continue
      if ([diff, diff - 1, diff + 1, area(a), area(b), area(a) + area(b)].includes(edge)) continue
      out.push([a, b])
    }
  }
  return out
})()

const rectId = ([r, c]: Rect) => `${r}x${c}`
const parseRect = (s: string): Rect => s.split('x').map(Number) as unknown as Rect

const cache = new Map<string, Figure>()

/** The figure of an id (also for a fact the round screen rebuilt from its task). */
function figure(f: Pick<Fact, 'id'>): Figure {
  const hit = cache.get(f.id)
  if (hit) return hit
  const [, code, a] = f.id.split(':')
  let fig: Figure
  if (code === 'n') {
    const cells = blob(Number(a))
    fig = { family: 'countSquares', w: BW, h: BH, cells, answer: cells.length, edge: edgeOf(cells), other: [], parts: [0, 0] }
  } else if (code === 'r') {
    const [r, c] = parseRect(a)
    fig = {
      family: 'rowsCols', w: c + 2, h: r + 2, cells: block(c + 2, 1, 1, [r, c]), answer: r * c, edge: perimeter([r, c]),
      other: [r + c, (r - 1) * c, r * (c - 1), r, c], parts: [r, c],
    }
  } else if (code === 'l') {
    const [outer, cut] = a.split('-').map(parseRect)
    const [r, c] = outer
    const [cr, cc] = cut
    // the cut corner: top right, top left, bottom right or bottom left
    const corner = (r * c + cr + cc) % 4
    const x0 = corner % 2 === 0 ? c - cc : 0
    const y0 = corner < 2 ? 0 : r - cr
    const gone = new Set(block(c + 2, 1 + x0, 1 + y0, cut))
    const cells = block(c + 2, 1, 1, outer).filter((x) => !gone.has(x))
    // the hint cuts it into a full-height part and the rest; a child may cut across instead
    const parts: [number, number] = [r * (c - cc), (r - cr) * cc]
    fig = { family: 'lShape', w: c + 2, h: r + 2, cells, answer: cells.length, edge: perimeter(outer), other: [r * c, ...parts, cr * (c - cc), (r - cr) * c], parts }
  } else {
    const [p, q] = a.split('-').map(parseRect)
    // the long one stands left or right, as the id says
    const [left, right] = (p[1] + q[0]) % 2 === 0 ? [p, q] : [q, p]
    const w = left[1] + right[1] + 3
    const h = Math.max(left[0], right[0]) + 2
    const cells = [...block(w, 1, h - 1 - left[0], left), ...block(w, left[1] + 2, h - 1 - right[0], right)].sort((x, y) => x - y)
    const parts: [number, number] = [area(left), area(right)]
    fig = {
      family: 'compareArea', w, h, cells, answer: Math.abs(parts[0] - parts[1]), edge: Math.abs(perimeter(p) - perimeter(q)),
      other: [...parts, parts[0] + parts[1]], parts,
    }
  }
  if (cache.size > 500) cache.clear()
  cache.set(f.id, fig)
  return fig
}

const RANK: Readonly<Record<Family, number>> = { countSquares: 0, rowsCols: 1, lShape: 2, compareArea: 3 }

/** Every instance id of a family but countSquares (those are seeded). */
const IDS: Readonly<Record<Exclude<Family, 'countSquares'>, readonly string[]>> = {
  rowsCols: [2, 3, 4, 5].flatMap((r) => [2, 3, 4, 5, 6].map((c) => `ara:r:${r}x${c}`)),
  lShape: [3, 4, 5].flatMap((r) => [3, 4, 5].flatMap((c) =>
    Array.from({ length: (r - 1) * (c - 1) }, (_, i) => `ara:l:${r}x${c}-${1 + Math.floor(i / (c - 1))}x${1 + (i % (c - 1))}`))),
  compareArea: PAIRS.map(([p, q]) => `ara:c:${rectId(p)}-${rectId(q)}`),
}

function factOf(id: string, i: number): Fact {
  const fig = figure({ id })
  return { id, skill: 'area', family: fig.family, operands: [], answer: fig.answer, rank: RANK[fig.family] * 100 + i }
}

/** 20 canonical facts per family: seeds 0–19, every rectangle, and an even spread of the others. */
const FACTS: readonly Fact[] = [
  ...Array.from({ length: 20 }, (_, k) => factOf(`ara:n:${k}`, k)),
  ...(['rowsCols', 'lShape', 'compareArea'] as const).flatMap((fam) => {
    const ids = IDS[fam]
    return Array.from({ length: Math.min(20, ids.length) }, (_, i) => factOf(ids[Math.floor((i * ids.length) / Math.min(20, ids.length))], i))
  }),
]

function instance(fam: FamilyDef, rng: Rng, avoid: ReadonlySet<string>): Fact {
  const family = fam.id as Family
  if (family === 'countSquares') {
    let id = `ara:n:${rng.int(1000)}`
    for (let i = 0; i < 50 && avoid.has(id); i++) id = `ara:n:${rng.int(1000)}`
    return factOf(id, 0)
  }
  const ids = IDS[family]
  const fresh = ids.filter((id) => !avoid.has(id))
  return factOf(rng.pick(fresh.length > 0 ? fresh : ids), 0)
}

function candidates(f: Fact) {
  const fig = figure(f)
  const n = fig.answer
  // an edge another slip gives as well (5 by 5: four rows of five) is never evidence
  const clash = [...fig.other, n + 1, n - 1].includes(fig.edge)
  const entries: Entry[] = [[fig.edge, clash ? 'ambiguous' : 'areaAsPerimeter'], ...fig.other.map((v): Entry => [v, 'other']), [n + 1, 'near'], [n - 1, 'near']]
  return tagged(n, entries)
}

const QUESTION: Readonly<Record<Family, string>> = {
  countSquares: 's.area.cover', rowsCols: 's.area.rect', lShape: 's.area.cover', compareArea: 's.area.more',
}

function hint(f: Fact, tag: string | null) {
  const fig = figure(f)
  const [p, q] = fig.parts
  const sum = (a: number, op: string, b: number, c: number): SpeechPart[] => [num(a, 'mid'), say(op), num(b, 'mid'), say('op.giver'), num(c)]
  let words: SpeechPart[]
  switch (fig.family) {
    case 'countSquares':
      words = [say('hint.area.countEach'), say('hint.area.covers'), num(fig.answer, 'mid'), SQ_END]
      break
    case 'rowsCols':
      words = [say('hint.area.thereAre'), num(p, 'mid'), say('hint.area.rowsWith'), num(q, 'mid'), say('hint.area.inEach'), ...sum(p, 'op.gange', q, fig.answer)]
      break
    case 'lShape':
      words = [say('hint.area.split'), say('hint.area.oneRect'), num(p, 'mid'), SQ_MID, say('hint.area.otherRect'), num(q, 'mid'), SQ_END, ...sum(p, 'op.plus', q, fig.answer)]
      break
    case 'compareArea':
      words = [
        say('hint.area.eachFigure'), say('hint.area.oneFigure'), num(p, 'mid'), SQ_MID, say('hint.area.otherFigure'), num(q, 'mid'), SQ_END,
        ...sum(Math.max(p, q), 'op.minus', Math.min(p, q), fig.answer),
      ]
  }
  if (tag !== 'areaAsPerimeter') return hintOf(words, promptOf(f))
  const lead = fig.family === 'compareArea' ? [say('hint.area.notEdge'), say('hint.area.longNotBig')] : [say('hint.area.notEdge')]
  return hintOf([...lead, ...words], promptOf(f), 'areaAsPerimeter')
}

const promptOf = (f: Fact): Prompt => {
  const { w, h, cells } = figure(f)
  return { scene: 'area', w, h, cells }
}

export default {
  ...META,
  families: FAMILIES,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  instance,
  answerType: () => 'int',
  prompt: promptOf,
  optionView: () => 'numeral',
  range: () => [0, 40],
  speech: (f: Fact) => [say(QUESTION[figure(f).family])],
  candidates,
  hint,
} satisfies SkillModule
