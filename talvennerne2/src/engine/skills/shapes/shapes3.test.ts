// The shapes skills of 3. klasse (SK3-GEO): area and gridCoords. Every answer is worked out again here
// from the ids and the drawn grids (the figure's squares, the point), never with the skills' own code.
import { describe, expect, it } from 'vitest'
import areaModule from './area'
import gridCoordsModule from './gridCoords'
import { geoSuite, factById, textOf } from './testing/suite'
import { globalIdCheck, tasksUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { makeRng } from '../../rng'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { ceilingFor, defaultFastMs, guessP } from '../../kinds'
import { compile } from '../../../speech/compile'
import type { Fact, FamilyDef, Prompt, SkillDef, Task } from '../../types'

const area: SkillDef = areaModule
const gridCoords: SkillDef = gridCoordsModule

type AreaPrompt = Extract<Prompt, { scene: 'area' }>
type GridPrompt = Extract<Prompt, { scene: 'grid' }>
const areaOf = (t: Pick<Task, 'prompt'>) => t.prompt as AreaPrompt
/** Any fact by id: the canonical ones, else every instance of its family drawn until it comes. */
function fact(def: SkillDef, id: string): Fact {
  const known = def.enumerate().find((f) => f.id === id)
  if (known) return known
  for (const fam of def.families) {
    const avoid = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const f = def.instance!(fam, makeRng(i), avoid)
      if (f.id === id) return f
      avoid.add(f.id)
    }
  }
  return factById(def, id)
}
const task = (def: SkillDef, id: string, kind: Task['kind'], seed = 1) => buildTask(def, fact(def, id), kind, makeRng(seed), 0).task

// ─── Hand geometry ──────────────────────────────────────────────────────────

/** The figure's pieces: the filled squares split into 4-connected parts. */
function parts(p: AreaPrompt): number[][] {
  const left = new Set(p.cells)
  const out: number[][] = []
  for (const start of p.cells) {
    if (!left.has(start)) continue
    const part: number[] = []
    const todo = [start]
    left.delete(start)
    while (todo.length > 0) {
      const c = todo.pop()!
      part.push(c)
      const near = [c % p.w > 0 ? c - 1 : -1, c % p.w < p.w - 1 ? c + 1 : -1, c - p.w, c + p.w]
      for (const d of near) if (left.has(d)) {
        left.delete(d)
        todo.push(d)
      }
    }
    out.push(part.sort((a, b) => a - b))
  }
  return out
}
const box = (p: AreaPrompt, cells: number[]) => {
  const xs = cells.map((c) => c % p.w)
  const ys = cells.map((c) => Math.floor(c / p.w))
  return { x0: Math.min(...xs), y0: Math.min(...ys), cols: Math.max(...xs) - Math.min(...xs) + 1, rows: Math.max(...ys) - Math.min(...ys) + 1 }
}
/** Unit sides on the edge of a figure: every side of a square that does not touch another. */
function edge(p: AreaPrompt): number {
  const on = new Set(p.cells)
  let n = 0
  for (const c of p.cells) {
    if (c % p.w === 0 || !on.has(c - 1)) n++
    if (c % p.w === p.w - 1 || !on.has(c + 1)) n++
    if (!on.has(c - p.w)) n++
    if (!on.has(c + p.w)) n++
  }
  return n
}
const rect = (s: string) => s.split('x').map(Number) as [number, number]

/** The area answer from the id and the picture. */
function areaAnswer(f: Fact, t: Task): number {
  const [, code, a] = f.id.split(':')
  const p = areaOf(t)
  if (code === 'r') return rect(a)[0] * rect(a)[1]
  if (code === 'l') {
    const [[r, c], [cr, cc]] = a.split('-').map(rect)
    return r * c - cr * cc
  }
  if (code === 'c') {
    const [[r1, c1], [r2, c2]] = a.split('-').map(rect)
    return Math.abs(r1 * c1 - r2 * c2)
  }
  return p.cells.length
}

// ─── Contracts ──────────────────────────────────────────────────────────────

describe('shapes of 3. klasse (SK3-GEO)', () => {
  globalIdCheck()

  geoSuite(area, {
    families: { countSquares: 20, rowsCols: 20, lShape: 20, compareArea: 20 },
    idFormat: /^ara:(n:[0-3]{2}(\.[0-3]{2}){2,4}|r:[2-5]x[2-6]|l:[3-5]x[3-5]-[1-4]x[1-4]|c:[12]x[4-8]-[2-4]x[2-4])$/,
    answerOf: (f, _kind, t) => areaAnswer(f, t),
    isRight: (f, t, o) => o === areaAnswer(f, t),
    ceilings: { choice: 3, keypad: 5 },
  })

  geoSuite(gridCoords, {
    families: { readPoint: 20, placePoint: 20 },
    idFormat: /^crd:[rp]:[0-6],[0-6]$/,
    answerOf(f, kind) {
      const [, code, xy] = f.id.split(':')
      const [x, y] = xy.split(',').map(Number)
      if (kind === 'grid') return code === 'r' ? `x:${x}|y:${y}` : `pt:${x},${y}`
      return (x + y) % 2 === 0 ? x : y
    },
    isRight(f, _t, o) {
      const [x, y] = f.id.slice(6).split(',').map(Number)
      return o === ((x + y) % 2 === 0 ? x : y)
    },
    ceilings: { choice: 3, grid: 5 },
  })
})

// ─── area ───────────────────────────────────────────────────────────────────

describe('area', () => {
  const tasks = tasksUnderTest(area)

  it('draws each figure as its id says, one square from the edge of its grid', () => {
    const problems: string[] = []
    for (const { fact, task: t } of tasks) {
      const p = areaOf(t)
      const [, code, a] = fact.id.split(':')
      const pieces = parts(p)
      const shape = pieces.map((c) => box(p, c))
      const where = `${fact.id} ${JSON.stringify(shape)}`
      if (p.cells.some((c) => c % p.w === 0 || c % p.w === p.w - 1 || c < p.w || c >= p.w * (p.h - 1))) problems.push(`${where}: touches the edge`)
      if (code === 'r' && (pieces.length !== 1 || shape[0].rows !== rect(a)[0] || shape[0].cols !== rect(a)[1] || p.cells.length !== rect(a)[0] * rect(a)[1])) problems.push(where)
      if (code === 'l') {
        const [[r, c]] = a.split('-').map(rect)
        if (pieces.length !== 1 || shape[0].rows !== r || shape[0].cols !== c) problems.push(where)
      }
      if (code === 'c') {
        const want = a.split('-').map(rect).map(([r, c]) => `${r}x${c}`).sort()
        const got = shape.map((s) => `${s.rows}x${s.cols}`).sort()
        if (pieces.length !== 2 || JSON.stringify(want) !== JSON.stringify(got) || pieces.some((c, i) => c.length !== shape[i].rows * shape[i].cols)) problems.push(where)
      }
      if (code === 'n') {
        // column x from the left holds rows b–t counted from the bottom row of the 5-by-4 box (grid row 4)
        const want = a.split('.').flatMap((run, x) => {
          const [b, t] = [Number(run[0]), Number(run[1])]
          return Array.from({ length: t - b + 1 }, (_, i) => (4 - b - i) * p.w + 1 + x)
        })
        const b = shape[0]
        if (JSON.stringify([...want].sort((u, v) => u - v)) !== JSON.stringify(p.cells)) problems.push(`${where}: not its columns`)
        if (pieces.length !== 1 || p.cells.length < 5 || p.cells.length > 12 || b.rows * b.cols === p.cells.length || b.cols > 5 || b.rows > 4) problems.push(where)
      }
    }
    expect(problems.slice(0, 10)).toEqual([])
  })

  it('grows figures without holes for countSquares', () => {
    for (const { fact, task: t } of tasks) {
      if (!fact.id.startsWith('ara:n:')) continue
      const p = areaOf(t)
      // the empty squares all reach the grid's border
      const empty = new Set(Array.from({ length: p.w * p.h }, (_, c) => c).filter((c) => !p.cells.includes(c)))
      const reached = new Set([...empty].filter((c) => c % p.w === 0 || c < p.w))
      const todo = [...reached]
      while (todo.length > 0) {
        const c = todo.pop()!
        for (const d of [c % p.w > 0 ? c - 1 : -1, c % p.w < p.w - 1 ? c + 1 : -1, c - p.w, c + p.w]) if (empty.has(d) && !reached.has(d)) {
          reached.add(d)
          todo.push(d)
        }
      }
      expect(reached.size, fact.id).toBe(empty.size)
    }
  })

  it('reads the edge counted as the area as areaAsPerimeter, unless another slip gives it too', () => {
    const problems: string[] = []
    for (const { fact, task: t } of tasks) {
      if (t.kind !== 'keypad') continue
      const p = areaOf(t)
      const [, code, a] = fact.id.split(':')
      // the edge the child counts: around the figure; for two figures the difference of the two
      const per = (s: string) => 2 * (rect(s)[0] + rect(s)[1])
      const counted = code === 'c' ? Math.abs(per(a.split('-')[0]) - per(a.split('-')[1])) : edge(p)
      const answer = t.answer as number
      if (counted === answer) continue
      const got = classifyAnswer(t, counted)
      // what other slips give: rows + cols, a row or column short, the uncut rectangle and its pieces
      // (cut down or across), either figure or both, one off
      const [[r, c], [cr, cc]] = code === 'n' ? [[0, 0], [0, 0]] : a.split('-').map(rect).concat([[0, 0]])
      const plain: Record<string, number[]> = {
        n: [], r: [r + c, (r - 1) * c, r * (c - 1), r, c], l: [r * c, r * (c - cc), (r - cr) * cc, cr * (c - cc), (r - cr) * c],
        c: [r * c, cr * cc, r * c + cr * cc],
      }
      const want = plain[code].includes(counted) || Math.abs(counted - answer) === 1 ? 'ambiguous' : 'areaAsPerimeter'
      if (got !== want) problems.push(`${fact.id}: ${counted} is ${String(got)}, expected ${want}`)
      if (want === 'areaAsPerimeter' && !detectableOf(t).includes('areaAsPerimeter')) problems.push(`${fact.id}: not an opportunity`)
    }
    expect(problems.slice(0, 10)).toEqual([])
    // the perimeter card is dealt on the cards
    const t = task(area, 'ara:r:2x3', 'choice')
    expect(t.options).toContain(10)
    expect(t.distractorTags['10']).toBe('areaAsPerimeter')
  })

  it('pairs a long figure with a compact one, the misconception’s value never another slip’s', () => {
    const pairs = area.enumerate().filter((f) => f.family === 'compareArea')
    for (const f of pairs) {
      const [[r1, c1], [r2, c2]] = f.id.slice(6).split('-').map(rect)
      const [a1, a2] = [r1 * c1, r2 * c2]
      const d = Math.abs(a1 - a2)
      const e = Math.abs(2 * (r1 + c1) - 2 * (r2 + c2))
      expect(r1, f.id).toBeLessThanOrEqual(2)
      expect(c1, f.id).toBeGreaterThan(c2)
      expect(d, f.id).toBeGreaterThan(0)
      expect([d, d - 1, d + 1, a1, a2, a1 + a2], f.id).not.toContain(e)
    }
    expect(area.instance).toBeDefined()
  })

  it('asks in Danish and explains each family', () => {
    expect(textOf(task(area, factIdOf(area, 'countSquares'), 'keypad'))).toBe('Hvor mange kvadrater dækker figuren?')
    expect(textOf(task(area, 'ara:r:3x4', 'choice'))).toBe('Hvor mange kvadrater dækker rektanglet?')
    expect(textOf(task(area, factIdOf(area, 'compareArea'), 'keypad'))).toBe('Hvor mange flere kvadrater dækker den største figur?')
    const hint = (id: string, tag: string | null = null) => compile(area.hint(fact(area, id), tag as never).speech).text
    expect(hint('ara:r:3x4')).toBe('Der er tre rækker med fire kvadrater i hver. Tre gange fire giver tolv.')
    expect(hint('ara:r:3x4', 'areaAsPerimeter')).toBe('Arealet er de kvadrater, der dækker figuren. Tæl ikke kanten rundt om den. Der er tre rækker med fire kvadrater i hver. Tre gange fire giver tolv.')
    expect(hint('ara:l:3x4-2x2')).toBe('Del figuren i to rektangler. Det ene rektangel dækker seks kvadrater og det andet dækker to kvadrater. Seks plus to giver otte.')
    expect(hint(factIdOf(area, 'countSquares'))).toMatch(/^Peg på hvert kvadrat, mens du tæller, og tæl hvert kvadrat én gang\. Figuren dækker \w+ kvadrater\.$/)
    const c = area.hint(fact(area, 'ara:c:1x8-3x3'), 'areaAsPerimeter')
    expect(c.misconception).toBe('areaAsPerimeter')
    expect(compile(c.speech).text).toContain('En lang figur er ikke altid den største.')
    expect(compile(c.speech).text).toContain('Den ene figur dækker ni kvadrater og den anden dækker otte kvadrater. Ni minus otte giver en.')
  })

  it('draws fresh instances of every family, avoiding recent ones', () => {
    const rng = makeRng(7)
    for (const fam of area.families as FamilyDef[]) {
      const seen = new Set<string>()
      for (let i = 0; i < 40; i++) seen.add(area.instance!(fam, rng, seen).id)
      expect(seen.size, fam.id).toBeGreaterThanOrEqual(fam.id === 'compareArea' ? 15 : 20)
    }
  })
})

// ─── gridCoords ─────────────────────────────────────────────────────────────

describe('gridCoords', () => {
  const tasks = tasksUnderTest(gridCoords)

  it('plays points on the net with axes 0–6: a set of tokens on the grid, a number on the cards', () => {
    for (const { fact, kind, task: t } of tasks) {
      const p = t.prompt as GridPrompt
      const [x, y] = fact.id.slice(6).split(',').map(Number)
      expect([p.scene, p.w, p.h, p.coords], fact.id).toEqual(['grid', 6, 6, true])
      // the point is drawn when it is read, and never when it is to be set
      expect(p.point, fact.id).toEqual(fact.family === 'readPoint' ? [x, y] : undefined)
      if (kind === 'grid') {
        expect([t.answerType, t.options, guessP(t), ceilingFor(t), defaultFastMs(t)], fact.id).toEqual(['set', [], 1 / 49, 5, 8000])
      } else {
        expect([t.answerType, t.range, t.optionView], fact.id).toEqual(['int', [0, 6], 'numeral'])
        for (const o of t.options) expect(o as number, fact.id).toBeLessThanOrEqual(6)
      }
    }
  })

  it('reads the swapped numbers as coordSwap (SPEC A23), and as ambiguous where placePoint said them (A9)', () => {
    const read = task(gridCoords, 'crd:r:2,5', 'grid')
    expect([read.answer, classifyAnswer(read, 'x:5|y:2'), classifyAnswer(read, 'x:3|y:5'), classifyAnswer(read, 'x:6|y:6')]).toEqual(['x:2|y:5', 'coordSwap', 'near', 'other'])
    const place = task(gridCoords, 'crd:p:3,2', 'grid')
    expect([place.answer, classifyAnswer(place, 'pt:2,3'), classifyAnswer(place, 'pt:3,3')]).toEqual(['pt:3,2', 'coordSwap', 'near'])
    // "Du skal sætte punktet fire, to. Hvor langt hen skal du gå?" — the 2 was said: a swap and an operand
    const card = task(gridCoords, 'crd:p:4,2', 'choice')
    expect([card.answer, card.distractorTags['2']]).toEqual([4, 'ambiguous'])
    const readCard = task(gridCoords, 'crd:r:4,2', 'choice')
    expect([readCard.answer, readCard.distractorTags['2'], readCard.options.includes(2)]).toEqual([4, 'coordSwap', true])
    // a swap is a sign on the net and on readPoint's cards (its card always dealt); a point with x = y has none
    for (const { fact, task: t } of tasks) {
      const [x, y] = fact.id.slice(6).split(',').map(Number)
      expect(detectableOf(t), `${fact.id} ${t.kind}`).toEqual(x !== y && (t.kind === 'grid' || fact.family === 'readPoint') ? ['coordSwap'] : [])
    }
  })

  it('asks in Danish: set the point, read it, or one of its numbers', () => {
    expect(textOf(task(gridCoords, 'crd:p:3,2', 'grid'))).toBe('Sæt punktet tre to.')
    expect(textOf(task(gridCoords, 'crd:r:3,2', 'grid'))).toBe('Hvor langt hen og hvor langt op er punktet?')
    expect(textOf(task(gridCoords, 'crd:r:3,2', 'choice'))).toBe('Hvor langt op er punktet?')
    expect(textOf(task(gridCoords, 'crd:r:4,2', 'choice'))).toBe('Hvor langt hen er punktet?')
    expect(textOf(task(gridCoords, 'crd:p:3,2', 'choice'))).toBe('Du skal sætte punktet tre to. Hvor langt op skal du gå?')
  })

  it('walks to the point in the hint, with the order of the numbers after a swap', () => {
    const hint = (id: string, tag: string | null, kind: Task['kind']) => compile(gridCoords.hint(fact(gridCoords, id), tag as never, kind).speech).text
    expect(hint('crd:p:3,2', null, 'grid')).toBe('Start i nul. Gå tre hen og så to op. Der er punktet.')
    expect(hint('crd:p:3,2', 'other', 'grid')).toBe('Det første tal er hen, og det andet tal er op. Start i nul. Gå tre hen og så to op. Der er punktet.')
    // coordSwap's own hint starts with the order (SPEC A23)
    expect(hint('crd:p:3,2', 'coordSwap', 'grid')).toBe('Det første tal er hen, og det andet tal er op. Start i nul. Gå tre hen og så to op. Der er punktet.')
    expect(hint('crd:r:2,5', 'coordSwap', 'choice')).toMatch(/^Det første tal er hen, og det andet tal er op\. /)
    expect(gridCoords.hint(fact(gridCoords, 'crd:r:2,5'), 'coordSwap', 'grid').misconception).toBe('coordSwap')
    expect(gridCoords.hint(fact(gridCoords, 'crd:r:2,5'), 'other', 'grid').misconception).toBeUndefined()
    expect(hint('crd:r:2,5', null, 'grid')).toBe('Kig lige ned under punktet. Der står to. Kig lige over til venstre. Der står fem.')
    expect(hint('crd:r:2,5', null, 'choice')).toBe('Kig lige over til venstre. Der står fem.')
    expect(gridCoords.hint(fact(gridCoords, 'crd:r:2,5'), null, 'grid').visual).toEqual({ scene: 'grid', w: 6, h: 6, filled: [], coords: true, point: [2, 5] })
  })

  it('reaches every point of the net, and avoids the recent ones', () => {
    const rng = makeRng(3)
    for (const fam of gridCoords.families as FamilyDef[]) {
      const seen = new Set<string>()
      for (let i = 0; i < 49; i++) seen.add(gridCoords.instance!(fam, rng, seen).id)
      expect(seen.size, fam.id).toBe(49)
    }
  })
})

/** The first canonical fact of a family. */
function factIdOf(def: SkillDef, family: string): string {
  return def.enumerate().find((f) => f.family === family)!.id
}
