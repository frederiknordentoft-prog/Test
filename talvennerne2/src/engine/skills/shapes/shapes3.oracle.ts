// Independent oracles for the shapes skills of 3. klasse (area, gridCoords), ORK3b. Written by another
// agent than the generators (SPEC A5, §15.1): every right answer is worked out here from what the child is
// given — the squares drawn on the grid, the net with its axis numbers and its point, the spoken question —
// and checked against the fact id read by the module headers' documented formats, never from the
// generator code. The wrong answers are pædagogik §3.2's areaAsPerimeter ("3×4 → 14: 2(a+b)", the edge
// counted instead of the squares) measured on the drawing, and the plain slips the area module documents
// (rows + cols, one row or column short, the uncut rectangle, one rectangle of two, either figure alone or
// both, one more or less). The registry skips *.oracle.ts files, so none of this reaches the app.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CoordGrid } from '../../../art/materials'
import { GridView } from '../../../ui/task/grid/View'
import type { ViewMode } from '../../../ui/task/types'
import type { AnswerValue, ErrorTag, Fact, MisconceptionId, Prompt, SkillDef, SkillId, Task, TaskKind } from '../../types'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, defaultFastMs, guessP, isProduction } from '../../kinds'
import { hashSeed, makeRng } from '../../rng'
import type { Built } from '../number/number.oracle'
import { numbersIn } from '../number/number2.oracle'
import { SPEC_KINDS3, isMis } from '../algebra/algebra2.oracle'

// ═══ area: the squares on the grid ════════════════════════════════════════════

/** A square of the grid by column and row (row 0 at the top, as the prompt numbers its cells). */
export interface Cell {
  x: number
  y: number
}

export interface Drawn {
  w: number
  h: number
  cells: Cell[]
}

/** The squares an 'area' prompt fills, read row-major from the top left; null when a cell is off the grid or twice. */
export function drawnOf(p: Prompt): Drawn | null {
  if (p.scene !== 'area') return null
  const seen = new Set<number>()
  for (const c of p.cells) {
    if (!Number.isInteger(c) || c < 0 || c >= p.w * p.h || seen.has(c)) return null
    seen.add(c)
  }
  return { w: p.w, h: p.h, cells: [...seen].map((c) => ({ x: c % p.w, y: Math.floor(c / p.w) })) }
}

const key = (c: Cell) => `${c.x},${c.y}`
const NEIGHBOURS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/** The edge of a set of squares in square sides: every side a square does not share with another. */
export function edgeOf(cells: readonly Cell[]): number {
  const on = new Set(cells.map(key))
  return cells.reduce((n, c) => n + NEIGHBOURS.filter(([dx, dy]) => !on.has(key({ x: c.x + dx, y: c.y + dy }))).length, 0)
}

/** The figures of a drawing: squares that touch side by side belong together. */
export function figuresOf(cells: readonly Cell[]): Cell[][] {
  const left = new Map(cells.map((c) => [key(c), c]))
  const out: Cell[][] = []
  for (const start of cells) {
    if (!left.has(key(start))) continue
    const fig: Cell[] = []
    const todo = [start]
    left.delete(key(start))
    while (todo.length > 0) {
      const c = todo.pop()!
      fig.push(c)
      for (const [dx, dy] of NEIGHBOURS) {
        const k = key({ x: c.x + dx, y: c.y + dy })
        const n = left.get(k)
        if (n) {
          left.delete(k)
          todo.push(n)
        }
      }
    }
    out.push(fig)
  }
  return out
}

export interface Box {
  x0: number
  y0: number
  /** Columns and rows. */
  cols: number
  rows: number
}

export function boxOf(cells: readonly Cell[]): Box {
  const xs = cells.map((c) => c.x)
  const ys = cells.map((c) => c.y)
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  return { x0, y0, cols: Math.max(...xs) - x0 + 1, rows: Math.max(...ys) - y0 + 1 }
}

/** A figure that fills its bounding box: rows by columns. */
export const isRect = (cells: readonly Cell[]): boolean => {
  const b = boxOf(cells)
  return b.rows * b.cols === cells.length
}

/** Empty squares inside a figure that cannot reach the grid's edge through empty squares. */
export function holesOf(d: Drawn): number {
  const on = new Set(d.cells.map(key))
  const out = new Set<string>()
  const todo: Cell[] = []
  for (let x = 0; x < d.w; x++) for (const y of [0, d.h - 1]) todo.push({ x, y })
  for (let y = 0; y < d.h; y++) for (const x of [0, d.w - 1]) todo.push({ x, y })
  while (todo.length > 0) {
    const c = todo.pop()!
    if (c.x < 0 || c.y < 0 || c.x >= d.w || c.y >= d.h || on.has(key(c)) || out.has(key(c))) continue
    out.add(key(c))
    for (const [dx, dy] of NEIGHBOURS) todo.push({ x: c.x + dx, y: c.y + dy })
  }
  return d.w * d.h - d.cells.length - out.size
}

/**
 * An L: a rows-by-cols box with one rectangle cut out of one corner. Returns the box and the cut
 * (rows and columns of the missing corner), or null when the figure is not such an L.
 */
export function lShapeOf(cells: readonly Cell[]): { box: Box; cut: { rows: number; cols: number } } | null {
  const b = boxOf(cells)
  const on = new Set(cells.map(key))
  const missing: Cell[] = []
  for (let y = b.y0; y < b.y0 + b.rows; y++) for (let x = b.x0; x < b.x0 + b.cols; x++) if (!on.has(key({ x, y }))) missing.push({ x, y })
  if (missing.length === 0 || !isRect(missing)) return null
  const m = boxOf(missing)
  const atCorner = (m.x0 === b.x0 || m.x0 + m.cols === b.x0 + b.cols) && (m.y0 === b.y0 || m.y0 + m.rows === b.y0 + b.rows)
  if (!atCorner || m.cols >= b.cols || m.rows >= b.rows) return null
  return { box: b, cut: { rows: m.rows, cols: m.cols } }
}

export type AreaFamily = 'countSquares' | 'rowsCols' | 'lShape' | 'compareArea'

/** What the child is asked about a drawing, worked out on the drawing itself. */
export interface AreaQ {
  family: AreaFamily
  /** The right answer: the squares covered (compareArea: how many more the bigger figure covers). */
  answer: number
  /** areaAsPerimeter: the edge counted instead (compareArea: the difference of the two edges). */
  edge: number
  /** Plain slips the area module documents, measured on the drawing (one more or less included). */
  slips: number[]
}

/**
 * The question of a drawing by its family (the id's code: n, r, l, c). countSquares and rowsCols and
 * lShape cover their squares; compareArea has two figures and asks for the difference.
 */
export function areaQuestion(family: AreaFamily, d: Drawn): AreaQ | null {
  const figs = figuresOf(d.cells)
  const near = (n: number) => [n + 1, n - 1]
  if (family === 'compareArea') {
    if (figs.length !== 2) return null
    const [a, b] = figs.map((f) => f.length)
    const answer = Math.abs(a - b)
    return { family, answer, edge: Math.abs(edgeOf(figs[0]) - edgeOf(figs[1])), slips: [a, b, a + b, ...near(answer)] }
  }
  if (figs.length !== 1) return null
  const cells = figs[0]
  const n = cells.length
  const edge = edgeOf(cells)
  if (family === 'rowsCols') {
    const { rows: r, cols: c } = boxOf(cells)
    return { family, answer: n, edge, slips: [r + c, (r - 1) * c, r * (c - 1), ...near(n)] }
  }
  if (family === 'lShape') {
    const l = lShapeOf(cells)
    if (!l) return null
    const { rows: R, cols: C } = l.box
    const { rows: cr, cols: cc } = l.cut
    // the uncut rectangle, and the two rectangles of the L cut down or across
    return { family, answer: n, edge, slips: [R * C, R * (C - cc), (R - cr) * cc, (R - cr) * C, cr * (C - cc), ...near(n)] }
  }
  return { family, answer: n, edge, slips: near(n) }
}

/** An area id as its module header documents it: ara:n:<b><t>.<b><t>…, ara:r:RxC, ara:l:RxC-rxc, ara:c:RxC-rxc. */
export type AreaId =
  | { family: 'countSquares'; runs: [number, number][] }
  | { family: 'rowsCols'; rows: number; cols: number }
  | { family: 'lShape'; rows: number; cols: number; cutRows: number; cutCols: number }
  | { family: 'compareArea'; a: [number, number]; b: [number, number] }

export function areaIdOf(id: string): AreaId | null {
  let m = /^ara:n:(\d\d(?:\.\d\d)+)$/.exec(id)
  if (m) return { family: 'countSquares', runs: m[1].split('.').map((r) => [Number(r[0]), Number(r[1])] as [number, number]) }
  m = /^ara:r:(\d+)x(\d+)$/.exec(id)
  if (m) return { family: 'rowsCols', rows: Number(m[1]), cols: Number(m[2]) }
  m = /^ara:l:(\d+)x(\d+)-(\d+)x(\d+)$/.exec(id)
  if (m) return { family: 'lShape', rows: Number(m[1]), cols: Number(m[2]), cutRows: Number(m[3]), cutCols: Number(m[4]) }
  m = /^ara:c:(\d+)x(\d+)-(\d+)x(\d+)$/.exec(id)
  if (m) return { family: 'compareArea', a: [Number(m[1]), Number(m[2])], b: [Number(m[3]), Number(m[4])] }
  return null
}

/** The answer an area id gives by the header's words alone (no drawing). */
export function areaIdAnswer(q: AreaId): number {
  switch (q.family) {
    case 'countSquares':
      return q.runs.reduce((n, [b, t]) => n + t - b + 1, 0)
    case 'rowsCols':
      return q.rows * q.cols
    case 'lShape':
      return q.rows * q.cols - q.cutRows * q.cutCols
    case 'compareArea':
      return Math.abs(q.a[0] * q.a[1] - q.b[0] * q.b[1])
  }
}

/**
 * Does the drawing show what the id says? countSquares: column x of the 5-by-4 box (one square in from
 * the grid's edge) filled from row b to row t, 0 at the bottom; rowsCols: the rectangle one square in from
 * every edge; lShape: an R-by-C box with an r-by-c corner cut; compareArea: the two rectangles, apart.
 * Returns the problems.
 */
export function drawingProblems(q: AreaId, d: Drawn): string[] {
  const out: string[] = []
  const figs = figuresOf(d.cells)
  const inside = d.cells.every((c) => c.x >= 1 && c.y >= 1 && c.x <= d.w - 2 && c.y <= d.h - 2)
  if (!inside) out.push('a square on the grid’s outer row (the figure stands one square in)')
  if (holesOf(d) > 0) out.push('a hole in the figure')
  const same = (a: readonly Cell[], b: readonly Cell[]) => [...a].map(key).sort().join(';') === [...b].map(key).sort().join(';')
  switch (q.family) {
    case 'countSquares': {
      if (d.w !== 7 || d.h !== 6) out.push(`a ${d.w}-by-${d.h} grid, the header's box needs 7 by 6`)
      const want: Cell[] = q.runs.flatMap(([b, t], x) => Array.from({ length: t - b + 1 }, (_, i) => ({ x: 1 + x, y: 4 - (b + i) })))
      if (!same(want, d.cells)) out.push('the squares are not the columns of the id')
      if (q.runs.length < 3 || q.runs.length > 5) out.push(`${q.runs.length} columns, the header says 3–5`)
      if (q.runs.some(([b, t]) => b > t || b < 0 || t > 3)) out.push('a column outside the 4 rows of the box')
      if (figs.length !== 1) out.push(`${figs.length} figures, one expected`)
      if (figs.length === 1 && isRect(figs[0])) out.push('a rectangle, never one in countSquares')
      if (d.cells.length < 5 || d.cells.length > 12) out.push(`${d.cells.length} squares, the header says 5–12`)
      break
    }
    case 'rowsCols': {
      const want: Cell[] = Array.from({ length: q.rows * q.cols }, (_, i) => ({ x: 1 + (i % q.cols), y: 1 + Math.floor(i / q.cols) }))
      if (d.w !== q.cols + 2 || d.h !== q.rows + 2 || !same(want, d.cells)) out.push(`not a ${q.rows}-by-${q.cols} rectangle on a grid one square wider all round`)
      break
    }
    case 'lShape': {
      const l = figs.length === 1 ? lShapeOf(figs[0]) : null
      if (!l) out.push('not an L (a box with one corner cut)')
      else if (l.box.rows !== q.rows || l.box.cols !== q.cols || l.cut.rows !== q.cutRows || l.cut.cols !== q.cutCols) {
        out.push(`an L of ${l.box.rows}x${l.box.cols} cut ${l.cut.rows}x${l.cut.cols}, the id says ${q.rows}x${q.cols}-${q.cutRows}x${q.cutCols}`)
      }
      if (d.w !== q.cols + 2 || d.h !== q.rows + 2) out.push(`a ${d.w}-by-${d.h} grid for a ${q.rows}-by-${q.cols} box`)
      break
    }
    case 'compareArea': {
      const dims = figs.map((f) => (isRect(f) ? `${boxOf(f).rows}x${boxOf(f).cols}` : 'not a rectangle')).sort()
      const want = [`${q.a[0]}x${q.a[1]}`, `${q.b[0]}x${q.b[1]}`].sort()
      if (dims.join() !== want.join()) out.push(`figures ${dims.join(', ')}, the id says ${want.join(', ')}`)
      if (figs.length === 2) {
        const [p, r] = figs.map(boxOf).sort((s, t) => s.x0 - t.x0)
        if (p.x0 + p.cols >= r.x0) out.push('the two figures are not apart, side by side')
      }
      break
    }
  }
  return out
}

/**
 * SPEC §4.1 with A9 and A11 for an area value: areaAsPerimeter is evidence alone; with a plain slip on the
 * same value (the module's documented slips, one more or less) SPEC §4.1's letter keeps the misconception,
 * and the module makes it 'ambiguous' (never evidence) — the oracle accepts either; with the typed answer's
 * swapped digits where a swap can happen it is 'ambiguous' (A11). No number is shown or said (no A9).
 */
export function areaTags(q: AreaQ, v: number, swap: number | null): readonly ErrorTag[] {
  if (v !== q.edge || v === q.answer) return PLAIN
  if (swap === v) return ['ambiguous']
  if (q.slips.includes(v)) return ['areaAsPerimeter', 'ambiguous']
  return ['areaAsPerimeter']
}

// ═══ gridCoords: the point on the net ═════════════════════════════════════════

export interface PointQ {
  family: 'readPoint' | 'placePoint'
  x: number
  y: number
}

/** crd:r:<x>,<y> (read the drawn point) and crd:p:<x>,<y> (set the named point), x and y 0–6 (module header). */
export function pointIdOf(id: string): PointQ | null {
  const m = /^crd:([rp]):([0-6]),([0-6])$/.exec(id)
  return m ? { family: m[1] === 'r' ? 'readPoint' : 'placePoint', x: Number(m[2]), y: Number(m[3]) } : null
}

/** SPEC A21: a set point is one token 'pt:x,y'; a read point the two axis tokens 'x:3|y:2' (a set). */
export const gridAnswerOf = (q: PointQ, x = q.x, y = q.y): string => (q.family === 'readPoint' ? `x:${x}|y:${y}` : `pt:${x},${y}`)

/** Every answer the net takes: the 49 crossings, or a number on each axis (7 · 7). */
export function gridAnswers(q: Pick<PointQ, 'family'>, w = 6, h = 6): string[] {
  const out: string[] = []
  for (let x = 0; x <= w; x++) for (let y = 0; y <= h; y++) out.push(gridAnswerOf({ family: q.family, x: 0, y: 0 }, x, y))
  return out
}

/** A point read off an answer value, in the view's own two forms ('pt:3,2', 'x:3|y:2' in either order). */
export function pointOfAnswer(v: AnswerValue): { x: number; y: number } | null {
  if (typeof v !== 'string') return null
  let m = /^pt:(\d+),(\d+)$/.exec(v)
  if (m) return { x: Number(m[1]), y: Number(m[2]) }
  const parts = v.split('|')
  const x = parts.map((p) => /^x:(\d+)$/.exec(p)).find(Boolean)
  const y = parts.map((p) => /^y:(\d+)$/.exec(p)).find(Boolean)
  return parts.length === 2 && x && y ? { x: Number(x[1]), y: Number(y[1]) } : null
}

const num = (s: string) => Number(s)

/**
 * The grid view as drawn (src/ui/task/grid/View.tsx), read like a child reads it: the point's position
 * matched to the axis number straight below it and the one straight to its left, and the pair under the
 * net ("(3, 2)", blank where nothing is picked yet).
 */
export function readGridView(task: Task, mode: ViewMode = 'input', given: AnswerValue | null = null) {
  const html = renderToStaticMarkup(createElement(GridView, { task, mode, given, onSubmit: () => {}, onActivity: () => {}, onDraft: () => {}, speaking: null }))
  const xs = [...html.matchAll(/data-num="x\d+"><circle cx="([\d.]+)" cy="([\d.]+)"[^>]*><\/circle><text[^>]*>(\d+)<\/text>/g)].map((m) => ({ cx: num(m[1]), cy: num(m[2]), n: num(m[3]) }))
  const ys = [...html.matchAll(/data-num="y\d+"><circle cx="([\d.]+)" cy="([\d.]+)"[^>]*><\/circle><text[^>]*>(\d+)<\/text>/g)].map((m) => ({ cx: num(m[1]), cy: num(m[2]), n: num(m[3]) }))
  const at = /transform:translate\(([\d.]+)px, ([\d.]+)px\)/.exec(html)
  let point: { x: number; y: number } | null = null
  if (at) {
    const below = xs.find((l) => Math.abs(l.cx - num(at[1])) < 0.5)
    const side = ys.find((l) => Math.abs(l.cy - num(at[2])) < 0.5)
    point = below && side ? { x: below.n, y: side.n } : { x: NaN, y: NaN }
  }
  const digits = [...html.matchAll(/tv-grid__digit">(\d*)</g)].map((m) => (m[1] === '' ? null : num(m[1])))
  return {
    html,
    mode: /data-grid-mode="(place|read)"/.exec(html)?.[1] ?? null,
    xAxis: xs.map((l) => l.n),
    yAxis: ys.map((l) => l.n),
    point,
    pair: digits,
  }
}

/** The prompt card's net (CoordGrid in PromptScene) read the same way: the dot matched to its axis numbers. */
export function readCoordGrid(p: Prompt) {
  if (p.scene !== 'grid' || !p.coords) return null
  const svg = renderToStaticMarkup(createElement(CoordGrid, { w: p.w, h: p.h, points: p.point ? [{ x: p.point[0], y: p.point[1] }] : [] }))
  const labels = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>(\d+)<\/text>/g)].map((m) => ({ x: num(m[1]), y: num(m[2]), n: num(m[3]) }))
  // the x numbers stand in one row under the net, the y numbers in one column left of it; the 0 at
  // the corner is the origin of both
  const bottom = Math.max(...labels.map((l) => l.y))
  const leftmost = Math.min(...labels.map((l) => l.x))
  const xAxis = labels.filter((l) => l.y === bottom).sort((a, b) => a.x - b.x)
  const yAxis = labels.filter((l) => l.x === leftmost).sort((a, b) => b.y - a.y)
  // the axes are drawn from the origin: "M44 260H300M44 260V4"
  const axes = /d="M([\d.]+) ([\d.]+)H[\d.]+M\1 \2V[\d.-]+"/.exec(svg)
  const step = xAxis.length > 1 ? xAxis[1].x - xAxis[0].x : NaN
  const problems: string[] = []
  if (!axes) problems.push('no axes drawn from one corner')
  const ox = axes ? num(axes[1]) : NaN
  const oy = axes ? num(axes[2]) : NaN
  // every x number straight under its line, every y number level with its line (one baseline offset for all)
  xAxis.forEach((l, i) => {
    if (l.n !== i || Math.abs(l.x - (ox + i * step)) > 0.01) problems.push(`x number ${l.n} at ${l.x}`)
  })
  const lift = yAxis.length > 0 ? yAxis[0].y - (oy - step) : NaN
  yAxis.forEach((l, j) => {
    if (l.n !== j + 1 || Math.abs(l.y - lift - (oy - (j + 1) * step)) > 0.01) problems.push(`y number ${l.n} at ${l.y}`)
  })
  const dot = /<g><path d="M([\d.]+) ([\d.]+)a([\d.]+) /.exec(svg)
  let point: { x: number; y: number } | null = null
  if (dot) {
    const gx = (num(dot[1]) + num(dot[3]) - ox) / step
    const gy = (oy - num(dot[2])) / step
    const under = xAxis.find((l) => Math.abs(l.x - (ox + gx * step)) < 0.01)
    const level = gy === 0 ? { n: 0 } : yAxis.find((l) => Math.abs(l.y - lift - (oy - gy * step)) < 0.01)
    point = Number.isInteger(gx) && Number.isInteger(gy) && under && level ? { x: under.n, y: level.n } : { x: NaN, y: NaN }
  }
  return { xAxis: xAxis.map((l) => l.n), yAxis: [0, ...yAxis.map((l) => l.n)], point, problems }
}

/** What the voice asks on a gridCoords task, read off the Danish text. */
export type PointAsk =
  | { ask: 'set'; x: number; y: number }
  | { ask: 'readBoth' }
  | { ask: 'readAlong' | 'readUp' }
  | { ask: 'goAlong' | 'goUp'; x: number; y: number }

export function pointAsk(text: string): PointAsk | null {
  if (text === 'Hvor langt hen og hvor langt op er punktet?') return { ask: 'readBoth' }
  if (text === 'Hvor langt hen er punktet?') return { ask: 'readAlong' }
  if (text === 'Hvor langt op er punktet?') return { ask: 'readUp' }
  let m = /^Sæt punktet ([a-zæøå]+),? ([a-zæøå]+)\.$/.exec(text)
  if (m) {
    const n = numbersIn(`${m[1]} ${m[2]}`)
    return n.length === 2 ? { ask: 'set', x: n[0], y: n[1] } : null
  }
  m = /^Du skal sætte punktet ([a-zæøå]+),? ([a-zæøå]+)\. Hvor langt (hen|op) skal du gå\?$/.exec(text)
  if (m) {
    const n = numbersIn(`${m[1]} ${m[2]}`)
    return n.length === 2 ? { ask: m[3] === 'hen' ? 'goAlong' : 'goUp', x: n[0], y: n[1] } : null
  }
  return null
}

// ═══ The wave-3b kit (shared with fractions3.oracle.test.ts) ═══════════════════

/** 200 seeded instances per family, from the oracle's own seeds (SPEC §15.1). */
export function instancesB(def: SkillDef, perFamily = 200): Map<string, Fact[]> {
  const out = new Map<string, Fact[]>()
  for (const fam of def.families) {
    const rng = makeRng(hashSeed(`ork3b:${def.id}/${fam.id}`))
    out.set(fam.id, Array.from({ length: perFamily }, () => def.instance!(fam, rng, new Set())))
  }
  return out
}

/** Draws with a growing avoid set (SPEC §5.1): the distinct ids n draws give. */
export function freshIds(def: SkillDef, family: string, n: number): string[] {
  const fam = def.families.find((f) => f.id === family)!
  const rng = makeRng(hashSeed(`ork3b-fresh:${def.id}/${family}`))
  const seen = new Set<string>()
  for (let i = 0; i < n; i++) seen.add(def.instance!(fam, rng, seen).id)
  return [...seen]
}

/** Every order of the given cards. */
export function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]]
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]))
}

/** The things on a share task's plates: the pile and how many plates. */
const shareOf = (t: Task) => (t.prompt.scene === 'share' ? { total: t.prompt.total, plates: t.prompt.recipients } : null)

/**
 * What the child can hand in (SPEC §3.2): the cards; any number the keys take (at most 0–999); a point
 * of the net (49) or, for a count over a net, a number; every order of the sortOrder cards; on the share
 * view the even deal or −1, and for a deal asked as itself (answerType 'set') every way the pile can end
 * on the plates, largest first (the view hands in only an empty pile).
 */
export function handIns(t: Task): AnswerValue[] {
  switch (t.kind) {
    case 'choice':
    case 'pair':
    case 'trueFalse':
      return [...t.options]
    case 'keypad':
      return Array.from({ length: Math.min(1000, 10 ** t.maxDigits) }, (_, v) => v)
    case 'grid':
      if (typeof t.answer === 'number') return Array.from({ length: Math.min(1000, 10 ** t.maxDigits) }, (_, v) => v)
      return gridAnswers({ family: typeof t.answer === 'string' && t.answer.startsWith('pt:') ? 'placePoint' : 'readPoint' }, sceneW(t), sceneH(t))
    case 'sortOrder':
      return permutations(t.options).map((p) => p.join('|'))
    case 'share': {
      const s = shareOf(t)
      if (!s) return []
      if (t.answerType === 'set') return dealsOf(s.total, s.plates)
      return s.total % s.plates === 0 ? [s.total / s.plates, -1] : [-1]
    }
    default:
      throw new Error(`no hand-ins for ${t.kind}`)
  }
}

const sceneW = (t: Task) => (t.prompt.scene === 'grid' ? t.prompt.w : 6)
const sceneH = (t: Task) => (t.prompt.scene === 'grid' ? t.prompt.h : 6)

/** Every way `total` things can lie on `plates` plates, as the counts largest first ('9|3'). */
export function dealsOf(total: number, plates: number): string[] {
  const out: string[] = []
  const walk = (left: number, k: number, max: number, acc: number[]) => {
    if (k === 1) {
      if (left <= max) out.push([...acc, left].join('|'))
      return
    }
    for (let c = Math.min(max, left); c >= 0; c--) walk(left - c, k - 1, c, [...acc, c])
  }
  walk(total, plates, total, [])
  return out
}

/** The tags a wrong value may get: one, or several where SPEC leaves a choice (see areaTags). */
export type Judge = (b: Built, v: AnswerValue) => readonly ErrorTag[]
export const PLAIN: readonly ErrorTag[] = ['near', 'other', 'operand', 'digitSwap']

/**
 * Every value the child can hand in, classified by the engine against the oracle: right ones never an
 * error (in any tapping order of a set), wrong ones a tag the oracle allows.
 */
export function classifyB(built: readonly Built[], judge: Judge, right: (b: Built, v: AnswerValue) => boolean): string[] {
  const out = new Set<string>()
  for (const b of built) {
    const t = b.task
    for (const v of handIns(t)) {
      const got = classifyAnswer(t, v)
      const where = `${t.factId} ${t.kind} ${String(v)} (answer ${String(t.answer)})`
      if (right(b, v)) {
        if (got !== null) out.add(`${where}: right by the oracle, classified ${got}`)
        continue
      }
      const want = judge(b, v)
      if (got === null) out.add(`${where}: wrong by the oracle, classified right`)
      else if (!want.includes(got)) out.add(`${where}: ${got}, the oracle allows ${want.join('/')}`)
    }
  }
  return [...out]
}

/**
 * SPEC §4.3 "Mulighed": the misconceptions a task lets the child show are those some value it takes is
 * classified as — where the oracle allows only that misconception, or allows it and the engine chose it.
 * detectableOf must agree (an opportunity no answer can hit dilutes the flag rate).
 */
export function detectableB(built: readonly Built[], judge: Judge): string[] {
  const out = new Set<string>()
  for (const b of built) {
    const t = b.task
    const want = new Set<MisconceptionId>()
    for (const v of handIns(t)) {
      if (isCorrect(t, v)) continue
      const allowed = judge(b, v)
      const got = classifyAnswer(t, v)
      if (allowed.length === 1 && isMis(allowed[0])) want.add(allowed[0])
      else if (isMis(got) && allowed.includes(got)) want.add(got)
    }
    const got = new Set(detectableOf(t))
    const show = (s: Set<MisconceptionId>) => [...s].sort().join(',') || '∅'
    if (show(got) !== show(want)) out.add(`${t.factId} ${t.kind}: detectable ${show(got)}, its answers can show ${show(want)}`)
  }
  return [...out]
}

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))

/**
 * SPEC §3.2's guessP, read off what the child is shown, with A21: a point on the net is one of its
 * (w + 1)·(h + 1) crossings (or one number on each axis: the same 49), a count over a net is typed on the
 * keys (1 in 13 for 0–12). The share view is SPEC's 0.01.
 */
export function guessB(t: Task): number {
  switch (t.kind) {
    case 'choice':
      return 1 / t.options.length
    case 'keypad':
      return 1 / (t.range[1] - t.range[0] + 1)
    case 'grid':
      if (typeof t.answer === 'number') return 1 / (t.range[1] - t.range[0] + 1)
      if (t.prompt.scene !== 'grid') throw new Error(`grid without a net: ${t.factId}`)
      return 1 / ((t.prompt.w + 1) * (t.prompt.h + 1))
    case 'sortOrder':
      return 1 / factorial(t.options.length)
    case 'share':
      return 0.01
    default:
      throw new Error(`no oracle guess rate for ${t.kind}`)
  }
}
const ONLY_FOR: Readonly<Partial<Record<TaskKind, readonly SkillId[]>>> = { share: ['shareEqually', 'fractionOfSet'] }
export const productionB = (t: Task): boolean => guessB(t) <= 0.12 && (ONLY_FOR[t.kind]?.includes(t.skill) ?? true)
export const ceilingB = (t: Task): 2 | 3 | 5 => (productionB(t) ? 5 : guessB(t) >= 0.5 ? 2 : 3)

/** The engine's guessP, isProduction and ceilingFor per task against the oracle's. */
export function productionB3(built: readonly Built[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const where = `${fact.skill} ${fact.id} ${kind}`
    if (Math.abs(guessP(task) - guessB(task)) > 1e-12) out.add(`${where}: guessP ${guessP(task)}, oracle ${guessB(task)}`)
    if (isProduction(task) !== productionB(task)) out.add(`${where}: isProduction ${isProduction(task)}, oracle ${productionB(task)}`)
    if (ceilingFor(task) !== ceilingB(task)) out.add(`${where}: ceiling ${ceilingFor(task)}, oracle ${ceilingB(task)}`)
  }
  return [...out]
}

/** SPEC §3.2's fastMs per kind (a family may give more time, never less). */
export function specFastMs(t: Task): number {
  const extra = typeof t.answer === 'number' ? String(Math.abs(t.answer)).length - 1 : 0
  switch (t.kind) {
    case 'choice': return 5_000 + 1_500 * extra
    case 'keypad': return 6_000 + 2_000 * extra
    case 'grid': return typeof t.answer === 'number' ? 6_000 + 2_000 * extra : 8_000
    case 'sortOrder': return 2_500 * t.options.length
    case 'share': return 3_000 + 800 * (shareOf(t)?.total ?? 0)
    default: throw new Error(`no SPEC speed for ${t.kind}`)
  }
}

/** The speed the play screen uses (SkillDef.fastMs, else the family's, else the kind's formula) is never below SPEC's. */
export function speedProblems(def: SkillDef, built: readonly Built[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const ms = def.fastMs?.(fact, kind) ?? def.families.find((f) => f.id === fact.family)?.fastMs?.[kind] ?? defaultFastMs(task)
    if (ms < specFastMs(task)) out.add(`${fact.id} ${kind}: ${ms} ms, SPEC ${specFastMs(task)}`)
  }
  return [...out]
}

/** A typed answer's swapped digits where SPEC §4.1 lets a swap count (keypad, 13 or more, not on screen). */
export function typedSwap(t: Task, onScreen: readonly number[] = []): number | null {
  if (t.kind !== 'keypad' || typeof t.answer !== 'number' || t.answer < 13) return null
  const tens = Math.floor(t.answer / 10) % 10
  const ones = t.answer % 10
  if (tens === 0 || ones === 0 || tens === ones) return null
  const s = t.answer - 10 * tens - ones + 10 * ones + tens
  return onScreen.includes(s) ? null : s
}

/**
 * SPEC §2.2/§3.3 per skill (SPEC_KINDS3): the kinds are SPEC's; a starred kind is production for ≥ 90 % of
 * its tasks, an unstarred one never; a card task lifts at most to box 3 (box 2 on a coin flip).
 */
export function specKindB(def: SkillDef, built: readonly Built[]): string[] {
  const spec = SPEC_KINDS3[def.id]
  if (!spec) return [`${def.id}: not in the oracle's SPEC §2.2 table`]
  const out: string[] = []
  if ([...def.kinds].sort().join(',') !== [...spec.kinds].sort().join(',')) out.push(`${def.id}: kinds ${def.kinds}, SPEC ${spec.kinds}`)
  for (const kind of def.kinds) {
    const own = built.filter((b) => b.kind === kind)
    if (own.length === 0) continue
    const share = own.filter((b) => productionB(b.task)).length / own.length
    if (spec.production.includes(kind) && share < 0.9) out.push(`${def.id} ${kind}: production for ${(share * 100).toFixed(1)} %, SPEC wants ≥ 90 %`)
    if (!spec.production.includes(kind) && share > 0) out.push(`${def.id} ${kind}: production for ${(share * 100).toFixed(1)} %, SPEC says never`)
  }
  for (const { task } of built) {
    if (task.kind !== 'choice') continue
    if (ceilingFor(task) > (guessP(task) >= 0.5 ? 2 : 3)) out.push(`${task.factId} choice: ceiling ${ceilingFor(task)}`)
  }
  return out
}
