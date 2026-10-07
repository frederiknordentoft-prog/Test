// Oracle tests for area and gridCoords (SPEC §2.2, §3, §4.1 with A9/A11, §10.1, §15.1, A21), ORK3b, against
// shapes3.oracle.ts: the squares counted and their edge measured on the drawn grid, the point read off the
// net by its axis numbers, the question read off the voice — never the generator's own numbers.
import { describe, expect, it } from 'vitest'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { getSkill } from '../../registry'
import { masteryKeyOf } from '../../tasks'
import type { AnswerValue, ErrorTag, Task } from '../../types'
import { shownKind } from '../../../ui/task/registry'
import { tasksUnderTest } from '../number/testing/harness'
import {
  answerProblems, cardProblems, first, hintProblems, registeredSkill, spokenText, tagsToHint, taskSpeechProblems, tasksOf,
  type Built,
} from '../number/number.oracle'
import { numbersIn } from '../number/number2.oracle'
import { animationChecks, idChecks, sentences } from '../algebra/algebra2.oracle'
import {
  PLAIN, areaIdAnswer, areaIdOf, areaQuestion, areaTags, boxOf, classifyB, detectableB, drawingProblems, drawnOf, figuresOf, freshIds,
  gridAnswerOf, gridAnswers, instancesB, isRect, lShapeOf, pointAsk, pointIdOf, pointOfAnswer, productionB3, readCoordGrid, readGridView,
  specKindB, speedProblems, typedSwap, type AreaFamily, type AreaQ,
} from './shapes3.oracle'

const TIMEOUT = 300_000
const said = (parts: Task['speech']) => spokenText(parts)

function setup(id: 'area' | 'gridCoords', seeds = 2) {
  const def = registeredSkill(id)
  const canon = def.enumerate()
  const instances = instancesB(def)
  const drawn = [...instances.values()].flat()
  const built: Built[] = [...tasksOf(def, canon, seeds), ...tasksOf(def, drawn, 1)]
  return { def, canon, instances, drawn, built }
}

// ═══ area ═════════════════════════════════════════════════════════════════════

const FAMILY_OF_CODE: Readonly<Record<string, AreaFamily>> = { n: 'countSquares', r: 'rowsCols', l: 'lShape', c: 'compareArea' }
const familyOfId = (id: string): AreaFamily => FAMILY_OF_CODE[id.split(':')[1]]

/** The question of a task, worked out on its drawing. */
function areaQ(t: Task): AreaQ {
  const d = drawnOf(t.prompt)
  const q = d && areaQuestion(familyOfId(t.factId), d)
  if (!q) throw new Error(`${t.factId}: the drawing does not fit its family`)
  return q
}

const QUESTIONS: Readonly<Record<AreaFamily, string>> = {
  countSquares: 'Hvor mange kvadrater dækker figuren?',
  rowsCols: 'Hvor mange kvadrater dækker rektanglet?',
  lShape: 'Hvor mange kvadrater dækker figuren?',
  compareArea: 'Hvor mange flere kvadrater dækker den største figur?',
}

describe('the area oracle itself', () => {
  it('measures squares, edges, figures and Ls on a drawing as a child counts them', () => {
    const rect = { w: 6, h: 5, cells: [7, 8, 9, 10, 13, 14, 15, 16, 19, 20, 21, 22] } // 3 rows of 4
    const d = drawnOf({ scene: 'area', ...rect })!
    expect(areaQuestion('rowsCols', d)).toEqual({ family: 'rowsCols', answer: 12, edge: 14, slips: [7, 8, 9, 13, 11] })
    // an L: a 3-by-3 box with its top right square cut
    const l = drawnOf({ scene: 'area', w: 5, h: 5, cells: [6, 7, 11, 12, 13, 16, 17, 18] })!
    expect(lShapeOf(figuresOf(l.cells)[0])).toEqual({ box: { x0: 1, y0: 1, cols: 3, rows: 3 }, cut: { rows: 1, cols: 1 } })
    expect(areaQuestion('lShape', l)?.edge).toBe(12)
    expect(isRect(figuresOf(l.cells)[0])).toBe(false)
    // two figures apart: 1 by 4 and 2 by 2 — four squares each, edges 10 and 8
    const two = drawnOf({ scene: 'area', w: 9, h: 4, cells: [19, 20, 21, 22, 15, 16, 24, 25] })!
    expect(figuresOf(two.cells).map((f) => boxOf(f))).toHaveLength(2)
    expect(areaQuestion('compareArea', two)).toMatchObject({ answer: 0, edge: 2 })
    expect(areaIdAnswer(areaIdOf('ara:l:5x4-2x3')!)).toBe(14)
    expect(areaIdAnswer(areaIdOf('ara:n:03.12.22')!)).toBe(7)
  })
})

describe('area oracle', () => {
  const { def, canon, instances, built } = setup('area')

  it('has SPEC §2.2’s four families with the module’s formats, 20 canonical facts each, and the id’s answer', () => {
    const counts: Record<string, number> = {}
    for (const f of canon) counts[f.family] = (counts[f.family] ?? 0) + 1
    expect(counts).toEqual({ countSquares: 20, rowsCols: 20, lShape: 20, compareArea: 20 })
    const all = [...canon, ...[...instances.values()].flat()]
    const format = /^ara:(n:\d\d(\.\d\d){2,4}|[rlc]:\d+x\d+(-\d+x\d+)?)$/
    expect(first(idChecks(def, all, format, (id) => {
      const q = areaIdOf(id)
      return q && { family: q.family, answer: areaIdAnswer(q) }
    }))).toEqual([])
    for (const f of all) expect(f.operands, f.id).toEqual([]) // no number is shown or said (A9 never applies)
  }, TIMEOUT)

  it('has every rectangle of 2–5 rows by 2–6 columns, 81 Ls (3–5 each way, a smaller corner cut) and 23 pairs', () => {
    const rects = new Set<string>()
    for (let r = 2; r <= 5; r++) for (let c = 2; c <= 6; c++) rects.add(`ara:r:${r}x${c}`)
    expect(new Set(freshIds(def, 'rowsCols', 40))).toEqual(rects)
    const ls = new Set<string>()
    for (let r = 3; r <= 5; r++) for (let c = 3; c <= 5; c++) for (let a = 1; a < r; a++) for (let b = 1; b < c; b++) ls.add(`ara:l:${r}x${c}-${a}x${b}`)
    expect(ls.size).toBe(81)
    expect(new Set(freshIds(def, 'lShape', 120))).toEqual(ls)
    const pairs = freshIds(def, 'compareArea', 60)
    expect(pairs).toHaveLength(23)
    for (const id of pairs) {
      const q = areaIdOf(id)
      if (q?.family !== 'compareArea') throw new Error(id)
      // a long figure (1–2 rows) and a compact one that is never as long, of different areas
      const [long, squat] = q.a[1] > q.b[1] ? [q.a, q.b] : [q.b, q.a]
      expect(long[0] <= 2 && long[1] > squat[1] && long[0] * long[1] !== squat[0] * squat[1], id).toBe(true)
    }
    // countSquares is seeded: every draw fresh while it can be
    expect(new Set(freshIds(def, 'countSquares', 60)).size).toBe(60)
  }, TIMEOUT)

  it('draws each figure as its id says, one square in from the grid’s edge, without holes', () => {
    const problems = built.flatMap(({ fact, task }) => {
      const d = drawnOf(task.prompt)
      const q = areaIdOf(fact.id)
      if (!d || !q) return [`${fact.id}: ${task.prompt.scene} prompt`]
      return drawingProblems(q, d).map((p) => `${fact.id} ${task.kind}: ${p}`)
    })
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('answers what the drawing covers (compareArea: how many more), and asks the family’s question', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const q = areaQ(task)
      const where = `${fact.id} ${kind}`
      if (task.answer !== q.answer) problems.push(`${where}: answer ${String(task.answer)}, the drawing ${q.answer}`)
      if (q.answer !== areaIdAnswer(areaIdOf(fact.id)!)) problems.push(`${where}: the drawing ${q.answer}, the id ${areaIdAnswer(areaIdOf(fact.id)!)}`)
      if (said(task.speech) !== QUESTIONS[q.family]) problems.push(`${where}: asks "${said(task.speech)}"`)
      if (q.family === 'rowsCols' && !isRect(drawnOf(task.prompt)!.cells)) problems.push(`${where}: asks about a rectangle, draws none`)
      if (task.answerType !== 'int' || task.optionView !== 'numeral') problems.push(`${where}: ${task.answerType} on ${task.optionView} cards`)
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('deals three different number cards in 0–40 with the answer once, every card tagged as it classifies', () => {
    expect(first(built.flatMap((b) => [...answerProblems(b.task), ...cardProblems(b.task, (c) => c >= 0 && c <= 40)]))).toEqual([])
  }, TIMEOUT)

  it('classifies the edge counted as the area as areaAsPerimeter, every other value plain (A11: a typed swap is ambiguous)', () => {
    const judge = (b: Built, v: AnswerValue) => (typeof v === 'number' ? areaTags(areaQ(b.task), v, typedSwap(b.task)) : PLAIN)
    expect(first(classifyB(built, judge, (b, v) => v === areaQ(b.task).answer))).toEqual([])
    expect(first(detectableB(built, judge))).toEqual([])
  }, TIMEOUT)

  it('shows the areaAsPerimeter card whenever the edge is evidence and fits the cards', () => {
    const problems: string[] = []
    for (const { task } of built) {
      if (task.kind !== 'choice') continue
      const q = areaQ(task)
      const evidence = q.edge !== q.answer && q.edge <= 40 && !q.slips.includes(q.edge)
      if (evidence && !task.options.includes(q.edge)) problems.push(`${task.factId}: cards [${task.options}], the edge ${q.edge} is not among them`)
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('leaves areaAsPerimeter evidence in every family (the edge is a value of its own on most figures)', () => {
    const share: Record<string, [number, number]> = {}
    for (const { fact, task } of built) {
      if (task.kind !== 'keypad') continue
      const s = (share[fact.family] ??= [0, 0])
      s[1]++
      if (detectableOf(task).includes('areaAsPerimeter')) s[0]++
    }
    for (const [fam, [hit, all]] of Object.entries(share)) expect(hit / all, fam).toBeGreaterThan(0.5)
  }, TIMEOUT)

  it('has SPEC’s kinds and ceilings: choice (1 in 3, box 3), keypad 0–40 (production, box 5), and SPEC’s speed or more', () => {
    expect(first(productionB3(built))).toEqual([])
    expect(first(specKindB(def, built))).toEqual([])
    expect(first(speedProblems(def, built))).toEqual([])
    for (const { task } of built) if (task.kind === 'keypad') expect([task.range, task.maxDigits], task.factId).toEqual([[0, 40], 2])
  }, TIMEOUT)

  it('speaks every task and hint with recorded clips and no digits', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    const facts = [...canon, ...[...instances.values()].flat().slice(0, 200)]
    expect(first(facts.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
    expect(first(animationChecks(def, facts, tagsToHint(def, canon)))).toEqual([])
  }, TIMEOUT)

  it('hints on the task’s own figure and says only true arithmetic about it', () => {
    const problems = new Set<string>()
    const seen = new Set<string>()
    for (const { fact, task } of built) {
      if (seen.has(fact.id)) continue
      seen.add(fact.id)
      const q = areaQ(task)
      const d = drawnOf(task.prompt)!
      const fig = figuresOf(d.cells)
      for (const tag of [null, 'near', 'other', 'ambiguous', 'areaAsPerimeter'] as (ErrorTag | null)[]) {
        for (const kind of [undefined, 'choice', 'keypad'] as const) {
          const h = def.hint(fact, tag, kind)
          const text = spokenText(h.speech)
          const where = `${fact.id} hint(${String(tag)}, ${kind ?? '-'})`
          if (JSON.stringify(h.visual) !== JSON.stringify(task.prompt)) problems.add(`${where}: another picture ${JSON.stringify(h.visual)}`)
          const own = tag === 'areaAsPerimeter'
          if (own !== text.startsWith('Arealet er de kvadrater, der dækker figuren. Tæl ikke kanten rundt om den.')) problems.add(`${where}: "${text}"`)
          if ((h.misconception ?? null) !== (own ? 'areaAsPerimeter' : null)) problems.add(`${where}: misconception ${h.misconception}`)
          const ss = sentences(text)
          const n = (s: string) => numbersIn(s)
          const has = (re: RegExp) => ss.find((s) => re.test(s))
          switch (q.family) {
            case 'countSquares': {
              const s = has(/^Figuren dækker /)
              if (!s || n(s).join() !== `${q.answer}`) problems.add(`${where}: "${text}"`)
              break
            }
            case 'rowsCols': {
              const b = boxOf(fig[0])
              const rows = has(/^Der er .+ rækker med .+ kvadrater i hver\.$/)
              const sum = has(/ gange .+ giver /)
              if (!rows || n(rows).join() !== `${b.rows},${b.cols}`) problems.add(`${where}: "${rows}" for ${b.rows} rows of ${b.cols}`)
              if (!sum || n(sum).join() !== `${b.rows},${b.cols},${q.answer}`) problems.add(`${where}: "${sum}"`)
              break
            }
            case 'lShape': {
              // the two rectangles named must be one of the two ways the L splits, and add up
              const l = lShapeOf(fig[0])!
              const { rows: R, cols: C } = l.box
              const { rows: r, cols: c } = l.cut
              const splits = [[R * (C - c), (R - r) * c], [(R - r) * C, r * (C - c)]].map((p) => [...p].sort((x, y) => x - y).join())
              const parts = has(/^Det ene rektangel dækker .+ og det andet dækker /)
              const sum = has(/ plus .+ giver /)
              const named = parts ? n(parts) : []
              if (!parts || !splits.includes([...named].sort((x, y) => x - y).join())) problems.add(`${where}: "${parts}" is no split of the L (${splits.join(' / ')})`)
              if (!sum || n(sum).join() !== `${named.join()},${q.answer}`) problems.add(`${where}: "${sum}"`)
              if (!has(/^Del figuren i to rektangler\.$/)) problems.add(`${where}: "${text}"`)
              break
            }
            case 'compareArea': {
              const areas = fig.map((f) => f.length)
              const parts = has(/^Den ene figur dækker .+ og den anden dækker /)
              const diff = has(/ minus .+ giver /)
              if (!parts || [...n(parts)].sort((x, y) => x - y).join() !== [...areas].sort((x, y) => x - y).join()) problems.add(`${where}: "${parts}", the figures cover ${areas}`)
              if (!diff || n(diff).join() !== `${Math.max(...areas)},${Math.min(...areas)},${q.answer}`) problems.add(`${where}: "${diff}"`)
              if (own && !text.includes('En lang figur er ikke altid den største.')) problems.add(`${where}: "${text}"`)
              break
            }
          }
        }
      }
    }
    expect(first([...problems])).toEqual([])
  }, TIMEOUT)

  it('avoids the instances it is told to avoid while the family has others (SPEC §5.1)', () => {
    for (const fam of ['rowsCols', 'lShape', 'compareArea']) {
      const ids = freshIds(def, fam, 20)
      expect(new Set(ids).size, fam).toBe(20)
    }
  }, TIMEOUT)
})

// ═══ gridCoords ═══════════════════════════════════════════════════════════════

describe('gridCoords oracle', () => {
  const { def, canon, instances, built } = setup('gridCoords')
  const point = (t: Task) => pointIdOf(t.factId)!

  it('has 49 points per family on the net with axes 0–6, 20 canonical each, ids crd:r|p:x,y', () => {
    const all = [...canon, ...[...instances.values()].flat()]
    expect(first(idChecks(def, all, /^crd:[rp]:[0-6],[0-6]$/, (id) => {
      const q = pointIdOf(id)
      return q && { family: q.family, answer: gridAnswerOf(q) }
    }))).toEqual([])
    for (const fam of ['readPoint', 'placePoint'] as const) {
      expect(canon.filter((f) => f.family === fam), fam).toHaveLength(20)
      const want = new Set(gridAnswers({ family: fam }).map((a) => `crd:${fam === 'readPoint' ? 'r' : 'p'}:${pointOfAnswer(a)!.x},${pointOfAnswer(a)!.y}`))
      expect(new Set(freshIds(def, fam, 60)), fam).toEqual(want)
    }
    for (const f of all) expect(masteryKeyOf(def, f)).toBe(`gridCoords/${f.family}`)
  }, TIMEOUT)

  it('A21 on the net: the drawn point (by its axis numbers) and the voice give the answer, pt:x,y or x:a|y:b', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      if (task.kind !== 'grid') continue
      const q = point(task)
      const where = `${fact.id} grid`
      const view = readGridView(task)
      const ask = pointAsk(said(task.speech))
      if (task.answerType !== 'set' || task.answer !== gridAnswerOf(q)) problems.push(`${where}: answer ${String(task.answer)} (${task.answerType})`)
      if (view.xAxis.join() !== '0,1,2,3,4,5,6' || view.yAxis.join() !== '0,1,2,3,4,5,6') problems.push(`${where}: axes ${view.xAxis} / ${view.yAxis}`)
      if (shownKind(task) !== 'grid') problems.push(`${where}: shown as ${shownKind(task)}`)
      if (q.family === 'readPoint') {
        if (view.mode !== 'read' || view.point?.x !== q.x || view.point?.y !== q.y) problems.push(`${where}: ${view.mode} with the point at ${JSON.stringify(view.point)}`)
        if (ask?.ask !== 'readBoth') problems.push(`${where}: asks "${said(task.speech)}"`)
        // the answer the strips hand in when the child picks the point's two numbers
        const picked = readGridView(task, 'correct', `x:${q.x}|y:${q.y}`)
        if (picked.pair.join() !== `${q.x},${q.y}`) problems.push(`${where}: the picked pair shows ${picked.pair}`)
      } else {
        if (view.mode !== 'place' || view.point !== null) problems.push(`${where}: ${view.mode}, a point drawn before the first tap ${JSON.stringify(view.point)}`)
        if (view.pair.join() !== `${q.x},${q.y}`) problems.push(`${where}: the pair under the net is (${view.pair})`)
        if (ask?.ask !== 'set' || ask.x !== q.x || ask.y !== q.y) problems.push(`${where}: asks "${said(task.speech)}"`)
        const set = readGridView(task, 'correct', `pt:${q.x},${q.y}`)
        if (set.point?.x !== q.x || set.point?.y !== q.y) problems.push(`${where}: the set point shows at ${JSON.stringify(set.point)}`)
      }
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('asks one of the point’s numbers on three cards: over the drawn point (read) or the empty net (place)', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      if (task.kind !== 'choice') continue
      const q = point(task)
      const where = `${fact.id} choice`
      const net = readCoordGrid(task.prompt)
      const ask = pointAsk(said(task.speech))
      if (!net || net.problems.length > 0 || net.xAxis.join() !== '0,1,2,3,4,5,6' || net.yAxis.join() !== '0,1,2,3,4,5,6') problems.push(`${where}: the net ${JSON.stringify(net)}`)
      let want: number | null = null
      if (q.family === 'readPoint') {
        if (net?.point?.x !== q.x || net?.point?.y !== q.y) problems.push(`${where}: the point drawn at ${JSON.stringify(net?.point)}`)
        want = ask?.ask === 'readAlong' ? q.x : ask?.ask === 'readUp' ? q.y : null
      } else {
        if (net?.point) problems.push(`${where}: a point drawn on the net it asks to set`)
        if (ask && (ask.ask === 'goAlong' || ask.ask === 'goUp') && ask.x === q.x && ask.y === q.y) want = ask.ask === 'goAlong' ? q.x : q.y
      }
      if (want === null || task.answer !== want) problems.push(`${where}: "${said(task.speech)}" answered ${String(task.answer)}`)
      if (task.answerType !== 'int' || task.optionView !== 'numeral' || task.range.join() !== '0,6') problems.push(`${where}: ${task.answerType} ${task.optionView} ${task.range}`)
    }
    expect(first(problems)).toEqual([])
    expect(first(built.flatMap((b) => [...answerProblems(b.task), ...cardProblems(b.task, (c) => c >= 0 && c <= 6)]))).toEqual([])
  }, TIMEOUT)

  /**
   * gridCoords' one misconception is coordSwap (SPEC A23; updated by GENFIX3 with the integrator's approval,
   * before A23 every wrong value was plain): the two numbers swapped are coordSwap on the net (both
   * families) and on readPoint's cards; on placePoint's cards the other number is said in the question, so
   * it is 'ambiguous' (A9). Where that card's number is also one step off, SPEC §4.1's letter keeps the
   * misconception and the conservative reading makes it 'ambiguous': either is allowed. One step off along
   * an axis is 'near'.
   */
  const judge = (b: Built, v: AnswerValue): readonly ErrorTag[] => {
    const t = b.task
    const q = point(t)
    if (t.kind === 'choice') {
      const asked = t.answer as number
      const other = asked === q.x && asked !== q.y ? q.y : q.x
      if (v === other && other !== asked) {
        if (q.family === 'placePoint') return ['ambiguous']
        return Math.abs(other - asked) === 1 ? ['coordSwap', 'ambiguous'] : ['coordSwap']
      }
      // one step off; the engine's own near miss (±1, ±10, ±2) where the net's edge leaves too few
      return [1, 2, 10].includes(Math.abs((v as number) - asked)) ? ['near'] : ['other']
    }
    const p = pointOfAnswer(v)
    if (!p) return ['other']
    if (p.x === q.y && p.y === q.x) return ['coordSwap']
    return Math.abs(p.x - q.x) + Math.abs(p.y - q.y) === 1 ? ['near'] : ['other']
  }

  it('classifies every point and card: right only the asked one (a read pair in either order), a swapped pair coordSwap (A23)', () => {
    expect(first(classifyB(built, judge, (b, v) => {
      if (b.task.kind === 'choice') return v === b.task.answer
      const p = pointOfAnswer(v)
      const q = point(b.task)
      return p !== null && p.x === q.x && p.y === q.y
    }))).toEqual([])
    expect(first(detectableB(built, judge))).toEqual([])
    for (const { task } of built) {
      if (task.kind !== 'grid' || point(task).family !== 'readPoint') continue
      const q = point(task)
      expect(isCorrect(task, `y:${q.y}|x:${q.x}`), task.factId).toBe(true)
      expect(classifyAnswer(task, `y:${q.y}|x:${q.x}`), task.factId).toBeNull()
    }
  }, TIMEOUT)

  // updated to SPEC A23 by GENFIX3 with the integrator's approval (before: plain everywhere, no coordSwap in §4.2)
  it('tags a swapped pair the same way on every kind (SPEC A23): coordSwap on the net and readPoint’s cards, ambiguous on placePoint’s (A9)', () => {
    const tags = new Map<string, Set<string>>()
    for (const { task } of built) {
      const q = point(task)
      if (q.x === q.y) continue
      const swapped = task.kind === 'grid' ? gridAnswerOf(q, q.y, q.x) : (task.answer === q.x ? q.y : q.x)
      if (task.kind === 'choice' && Math.abs(q.x - q.y) === 1) continue // the other number is also one step off
      const k = `${q.family} ${task.kind}`
      ;(tags.get(k) ?? tags.set(k, new Set()).get(k)!).add(String(classifyAnswer(task, swapped)))
    }
    expect(Object.fromEntries([...tags].map(([k, s]) => [k, [...s].sort().join()]))).toEqual({
      'readPoint grid': 'coordSwap', 'placePoint grid': 'coordSwap', 'readPoint choice': 'coordSwap', 'placePoint choice': 'ambiguous',
    })
    // a swap can be shown on the net and on readPoint's cards (its card is dealt), never by a point with x = y
    for (const { task } of built) {
      const q = point(task)
      const can = q.x !== q.y && (task.kind === 'grid' || q.family === 'readPoint')
      expect(detectableOf(task), `${task.factId} ${task.kind}`).toEqual(can ? ['coordSwap'] : [])
    }
  }, TIMEOUT)

  it('A21: a point is 1 in 49 on the net (production, box 5); a card 1 in 3 (box 3); SPEC’s speed or more', () => {
    expect(first(productionB3(built))).toEqual([])
    expect(first(specKindB(def, built))).toEqual([])
    expect(first(speedProblems(def, built))).toEqual([])
    for (const { task } of built) {
      if (task.kind !== 'grid') continue
      expect([guessP(task), isProduction(task), ceilingFor(task)], task.factId).toEqual([1 / 49, true, 5])
    }
  }, TIMEOUT)

  it('A21: symmetry’s count over a net stays on the keypad, guessed 1 in 13', () => {
    const symmetry = getSkill('symmetry')!
    const grid = tasksUnderTest(symmetry).filter((b) => b.kind === 'grid')
    expect(grid.length).toBeGreaterThan(0)
    for (const { fact, task } of grid) {
      expect(typeof task.answer, fact.id).toBe('number')
      expect(shownKind(task), fact.id).toBe('keypad')
      expect(task.range[1] - task.range[0] + 1, fact.id).toBe(13)
      expect(guessP(task), fact.id).toBeCloseTo(1 / 13, 12)
      expect(task.answerType, fact.id).toBe('int')
    }
  }, TIMEOUT)

  it('speaks every task and hint with recorded clips and no digits', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
  }, TIMEOUT)

  it('hints on the net with the point, and walks or reads its own numbers (the order first after a swap)', () => {
    const problems = new Set<string>()
    for (const f of [...canon, ...[...instances.values()].flat().slice(0, 98)]) {
      const q = pointIdOf(f.id)!
      for (const tag of [null, 'near', 'other', 'operand'] as (ErrorTag | null)[]) {
        for (const kind of [undefined, 'choice', 'grid'] as const) {
          const h = def.hint(f, tag, kind)
          const text = spokenText(h.speech)
          const where = `${f.id} hint(${String(tag)}, ${kind ?? '-'})`
          const net = readCoordGrid(h.visual as Task['prompt'])
          if (!net || net.point?.x !== q.x || net.point?.y !== q.y) problems.add(`${where}: the picture ${JSON.stringify(h.visual)}`)
          const order = text.startsWith('Det første tal er hen, og det andet tal er op. ')
          const swapped = tag === 'other' || tag === 'operand'
          if (swapped && !order) problems.add(`${where}: no word on the order after a possible swap: "${text}"`)
          const rest = order ? text.slice('Det første tal er hen, og det andet tal er op. '.length) : text
          if (q.family === 'placePoint') {
            const m = /^Start i nul\. Gå (\S+) hen og så (\S+) op\. Der er punktet\.$/.exec(rest)
            if (!m || numbersIn(`${m[1]} ${m[2]}`).join() !== `${q.x},${q.y}`) problems.add(`${where}: "${text}"`)
          } else {
            const down = /Kig lige ned under punktet\. Der står (\S+)\./.exec(rest)
            const side = /Kig lige over til venstre\. Der står (\S+)\./.exec(rest)
            if (down && numbersIn(down[1]).join() !== `${q.x}`) problems.add(`${where}: "${text}"`)
            if (side && numbersIn(side[1]).join() !== `${q.y}`) problems.add(`${where}: "${text}"`)
            if (!down && !side) problems.add(`${where}: "${text}"`)
            if (kind !== 'choice' && (!down || !side)) problems.add(`${where}: reads only one number: "${text}"`)
          }
          if (h.misconception !== undefined) problems.add(`${where}: a ${h.misconception} hint`)
        }
      }
    }
    expect(first([...problems])).toEqual([])
  }, TIMEOUT)
})

