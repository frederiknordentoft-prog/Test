// Oracle tests for sidesCorners, shapes3D, sortShapes, symmetry and composeShapes (SPEC §2.2, §2.3,
// §3, §4.1–4.3, §10.1, §15.1), compared with shapes2.oracle.ts: figures measured on the materials' own
// drawing, solids and pattern blocks from the oracle's own tables, questions read off the voice.
import { describe, expect, it } from 'vitest'
import { classifyAnswer } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { guessP } from '../../kinds'
import { masteryKeyOf } from '../../tasks'
import type { ShapeId, SolidId, Task } from '../../types'
import {
  answerProblems, cardProblems, first, hintProblems, optionProblems, registeredSkill, sceneOf, spokenText, tagsToHint,
  taskSpeechProblems, tasksOf, type Built,
} from '../number/number.oracle'
import { numberWordProblems, numbersIn, word99 } from '../number/number2.oracle'
import { isPrototypical } from './shapes.oracle'
import {
  avoidChecks, classifyAll, detectableChecks, distinctIds, idChecks, instancesOf3, productionChecks, specKindChecks,
} from '../algebra/algebra2.oracle'
import {
  cardSolid, composeAsk, cornerCount, cutX, figure, fitsAsk, hasSymmetryLine, mirroredAbout, piecesPer, sortRule, solidAsk,
  solidIsA, THING_SOLID, UNCLEAR_THINGS, type SolidProp,
} from './shapes2.oracle'

const TIMEOUT = 240_000

function setup(id: Parameters<typeof registeredSkill>[0], seeds = 3) {
  const def = registeredSkill(id)
  const canon = def.enumerate()
  const instances = def.mode === 'procedure' ? instancesOf3(def) : new Map()
  const drawn = [...instances.values()].flat()
  const built: Built[] = [...tasksOf(def, canon, seeds), ...tasksOf(def, drawn, 1)]
  return { def, canon, instances, drawn, built }
}

const generic = (built: readonly Built[]) => built.flatMap((b) => [...answerProblems(b.task), ...cardProblems(b.task), ...optionProblems(b.task)])
/** No misconception in the catalogue fits these skills (SPEC §4.2): every wrong value is plain. */
const nothing = () => ({ mis: [] })
const said = (t: Task) => spokenText(t.speech)

/** Every non-empty choice of items, as the sorted ids a multiSelect answer is compared on. */
function selections(ids: readonly string[]): string[] {
  const out: string[] = []
  for (let mask = 1; mask < 2 ** ids.length; mask++) out.push(ids.filter((_, i) => mask & (2 ** i)).sort().join('|'))
  return out
}

/** A multiSelect task: every selection right only when it is the oracle's set, and never a misconception except `mis`. */
function selectionProblems(t: Task, want: string, mis: Readonly<Record<string, string>> = {}): string[] {
  const out: string[] = []
  for (const s of selections(t.options.map(String))) {
    const right = s === want
    const got = classifyAnswer(t, s)
    if (right !== isCorrect(t, s)) out.push(`${t.factId}: ${s} is ${isCorrect(t, s) ? 'right' : 'wrong'}, the oracle says ${right ? 'right' : 'wrong'}`)
    else if (!right && (mis[s] ?? 'plain') !== (['near', 'other', 'operand'].includes(String(got)) ? 'plain' : got)) out.push(`${t.factId}: ${s} is ${got}, expected ${mis[s] ?? 'a plain tag'}`)
  }
  return out
}

describe('the measuring (a check of the oracle itself)', () => {
  it('measures corners, sides, right angles, symmetry lines and halves on the materials as the definitions say', () => {
    expect([0, 1, 2].map((v) => cornerCount(figure('octagon', v)))).toEqual([8, 8, 8])
    expect(cornerCount(figure('semicircle', 0))).toBe(2)
    expect(cornerCount(figure('circle', 2))).toBe(0)
    // a square has four symmetry lines; a skew firkant, a scalene triangle and the irregular pentagon none
    expect(hasSymmetryLine(figure('square', 2))).toBe(true)
    expect(hasSymmetryLine(figure('rhombus', 2))).toBe(true)
    expect(hasSymmetryLine(figure('quadrilateral', 2))).toBe(false)
    expect(hasSymmetryLine(figure('triangle', 2))).toBe(false)
    expect(hasSymmetryLine(figure('pentagon', 2))).toBe(false)
    expect(hasSymmetryLine(figure('hexagon', 2))).toBe(true)
    // the middle line: mirrors the upright rectangle, only halves the turned one
    expect(cutX('rectangle', 1, 'equal')).toBe(50)
    expect(mirroredAbout(figure('rectangle', 0), 50)).toBe(true)
    expect(mirroredAbout(figure('rectangle', 1), 50)).toBe(false)
    expect(mirroredAbout(figure('semicircle', 0), 50)).toBe(true)
    expect(mirroredAbout(figure('semicircle', 1), 50)).toBe(false)
    expect(mirroredAbout(figure('circle', 0), 36)).toBe(false)
    expect(piecesPer('hexagon', 'triangle')).toBe(6)
    expect(piecesPer('big-square', 'square')).toBe(4)
  })
})

// ═══ sidesCorners ═══════════════════════════════════════════════════════════

describe('sidesCorners oracle', () => {
  const { def, canon, built } = setup('sidesCorners')
  const parse = (id: string) => /^sc:([sc]):([a-z]+):(\d)$/.exec(id)

  it('has SPEC §2.2’s 30 facts: 3-, 4-, 5-, 6- and 8-kant, standard, turned and skew, sides and corners', () => {
    const want = new Set<string>()
    for (const fam of ['s', 'c']) for (const shape of ['triangle', 'quadrilateral', 'pentagon', 'hexagon', 'octagon']) for (const v of [0, 1, 2]) want.add(`sc:${fam}:${shape}:${v}`)
    expect(new Set(canon.map((f) => f.id))).toEqual(want)
    expect(first(idChecks(def, canon, /^sc:[sc]:[a-z]+:\d$/, (id) => {
      const m = parse(id)
      return m && { family: m[1] === 's' ? 'sides' : 'corners', answer: cornerCount(figure(m[2] as ShapeId, Number(m[3]))) }
    }))).toEqual([])
    for (const f of canon) expect(masteryKeyOf(def, f)).toBe(f.id)
  })

  it('shows the fact’s figure, asks for its sides or corners, and the answer is what the drawing has', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const m = parse(fact.id)!
      const p = sceneOf(task.prompt, 'shape')
      const where = `${fact.id} ${kind}`
      if (p.shape !== m[2] || p.variant !== Number(m[3]) || p.mark) problems.push(`${where}: shows ${p.shape} ${p.variant} ${p.mark ?? ''}`)
      const asks = said(task) === 'Hvor mange sider har figuren?' ? 's' : said(task) === 'Hvor mange hjørner har figuren?' ? 'c' : null
      if (asks !== m[1]) problems.push(`${where}: asks "${said(task)}"`)
      // a polygon has as many sides as corners
      if (task.answer !== cornerCount(figure(p.shape, p.variant))) problems.push(`${where}: answer ${String(task.answer)}, the drawing has ${cornerCount(figure(p.shape, p.variant))}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards (0–12), classifies every wrong value as plain, and has SPEC’s production kinds and ceilings', () => {
    expect(first(generic(built))).toEqual([])
    expect(first(classifyAll(built, nothing))).toEqual([])
    expect(first(detectableChecks(built, nothing))).toEqual([])
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
  })

  it('hints on the fact’s own figure with its corners (or sides) marked, and names the measured number', () => {
    const problems: string[] = []
    for (const f of canon) {
      const m = parse(f.id)!
      for (const tag of tagsToHint(def, canon)) {
        const h = def.hint(f, tag)
        const v = h.visual
        const where = `${f.id} hint(${String(tag)})`
        if (v.scene !== 'shape' || v.shape !== m[2] || v.variant !== Number(m[3]) || v.mark !== (m[1] === 's' ? 'sides' : 'corners')) problems.push(`${where}: ${JSON.stringify(v)}`)
        if (numbersIn(spokenText(h.speech)).at(-1) !== f.answer) problems.push(`${where}: "${spokenText(h.speech)}"`)
      }
    }
    expect(first(problems)).toEqual([])
  })
}, TIMEOUT)

// ═══ shapes3D ═══════════════════════════════════════════════════════════════

describe('shapes3D oracle', () => {
  const { def, canon, built } = setup('shapes3D', 4)

  it('asks for every solid (by name or property) and every thing the materials draw; props in 2. kl.', () => {
    const named = new Set<SolidId>()
    const things = new Set<string>()
    for (const f of canon) {
      const m = /^s3d:([nop]):([a-z]+)(?::(\d))?$/.exec(f.id)
      expect(m, f.id).not.toBeNull()
      if (m![1] === 'n') named.add(m![2] as SolidId)
      if (m![1] === 'o') things.add(m![2])
      expect(f.family, f.id).toBe(m![1] === 'p' ? 'props' : 'names')
      expect(masteryKeyOf(def, f)).toBe(f.id)
    }
    expect(new Set(things)).toEqual(new Set(Object.keys(THING_SOLID)))
    expect([...named].sort()).toEqual(['cone', 'cube', 'cuboid', 'cylinder', 'sphere'])
    for (const prop of ['rolls', 'stacks', 'flat']) expect(canon.filter((f) => f.id.startsWith(`s3d:p:${prop}:`)).length, prop).toBe(5)
    expect(def.families.find((f) => f.id === 'props')?.grade).toBe(2)
  })

  it('answers every task by the question: the named solid (a terning is a kasse), the thing’s shape, or the property', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const ask = solidAsk(said(task))
      const where = `${fact.id} ${kind} "${said(task)}"`
      if (!ask) {
        problems.push(`${where}: the oracle cannot read the question`)
        continue
      }
      if (kind === 'choice') {
        const right = cardSolid(String(task.answer))
        if (ask.by === 'thing') {
          const p = sceneOf(task.prompt, 'solid')
          const thing = p.asObject ?? ''
          if (THING_SOLID[thing] !== p.solid || right !== THING_SOLID[thing]) problems.push(`${where}: a ${thing} drawn as ${p.solid}, answer ${String(task.answer)}`)
          for (const o of task.options) if (o !== task.answer && solidIsA(cardSolid(String(o))!, right!)) problems.push(`${where}: the wrong card ${String(o)} is also a ${right}`)
        } else {
          if (!right || !fitsAsk(ask, right)) problems.push(`${where}: answer ${String(task.answer)}`)
          // SPEC §2.3: a card that is also right (a cube for "kassen", a cylinder for "kan trille") is never dealt wrong
          for (const o of task.options) if (o !== task.answer && fitsAsk(ask, cardSolid(String(o))!)) problems.push(`${where}: the wrong card ${String(o)} fits too`)
        }
      } else if (ask.by !== 'thing') {
        const unclear = ask.by === 'prop' ? UNCLEAR_THINGS[ask.prop as SolidProp] : []
        if (kind === 'multiSelect') {
          const cards = task.options.map(String)
          const want = cards.filter((c) => fitsAsk(ask, cardSolid(c)!)).sort().join('|')
          if (task.answer !== want) problems.push(`${where}: answer ${String(task.answer)}, the oracle ${want}`)
          for (const c of cards) if (unclear.includes(c.slice(4))) problems.push(`${where}: the unclear ${c} is dealt`)
          if (cards.length !== 6) problems.push(`${where}: ${cards.length} cards`)
        } else {
          const shelf = sceneOf(task.prompt, 'compareObjects').objects
          const want = shelf.filter((t) => fitsAsk(ask, THING_SOLID[t])).length
          if (task.answer !== want) problems.push(`${where}: answer ${String(task.answer)}, the shelf ${shelf} has ${want}`)
          for (const t of shelf) if (unclear.includes(t) || !(t in THING_SOLID)) problems.push(`${where}: ${t} on the shelf`)
        }
      } else problems.push(`${where}: a thing question on ${kind}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('“Tryk på alle, der har form som en kasse” takes every cube too (SPEC §2.3), and the cards never show a cube wrong for kassen', () => {
    const kasse = built.filter((b) => b.kind === 'multiSelect' && said(b.task) === 'Tryk på alle, der har form som en kasse.')
    expect(kasse.length).toBeGreaterThan(0)
    for (const b of kasse) {
      const cubes = b.task.options.map(String).filter((c) => cardSolid(c) === 'cube')
      for (const c of cubes) expect(String(b.task.answer).split('|'), b.fact.id).toContain(c)
    }
  })

  it('deals valid cards and classifies every card, typed value and selection as plain (no misconception fits)', () => {
    expect(first(generic(built))).toEqual([])
    expect(first(classifyAll(built, nothing))).toEqual([])
    expect(first(detectableChecks(built, nothing))).toEqual([])
    expect(first(built.filter((b) => b.kind === 'multiSelect').flatMap((b) => selectionProblems(b.task, String(b.task.answer))))).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (six cards to choose among: 1 in 63; keypad 0–10)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task, card and hint with recorded clips and no digits', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
  })
}, TIMEOUT)

// ═══ sortShapes ═════════════════════════════════════════════════════════════

describe('sortShapes oracle', () => {
  const { def, canon, instances, drawn, built } = setup('sortShapes', 2)
  const items = (t: Task) => sceneOf(t.prompt, 'shapes').items

  it('has SPEC §2.2’s five families (fourEqualSides in 2. kl., rightAngle in 3. kl.), 20 canonical plates each', () => {
    const fams = def.families.map((f) => `${f.id}${f.grade !== undefined ? `:${f.grade}` : ''}`)
    expect(fams.sort()).toEqual(['fourCorners', 'fourEqualSides:2', 'noCorners', 'rightAngle:3', 'threeCorners'])
    for (const fam of def.families) expect(canon.filter((f) => f.family === fam.id).length, fam.id).toBe(20)
    expect(first(idChecks(def, [...canon, ...drawn], /^srt:[A-Za-z]+:\d+$/, (id) => {
      const fact = [...canon, ...drawn].find((f) => f.id === id)!
      return { family: id.split(':')[1], answer: fact.answer }
    }))).toEqual([])
    for (const [fam, facts] of instances) expect(distinctIds(facts), fam).toBeGreaterThanOrEqual(150)
    expect(first(avoidChecks(def, instances))).toEqual([])
  })

  it('makes the answer exactly the figures the question asks for, measured on the drawing (a turned square has four right angles)', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      const rule = sortRule(said(task))
      const its = items(task)
      const where = `${fact.id} "${said(task)}"`
      if (!rule) {
        problems.push(`${where}: the oracle cannot read the question`)
        continue
      }
      const members = its.filter((i) => rule(figure(i.shape, i.variant)))
      const want = members.map((i) => i.id).sort().join('|')
      if (task.answer !== want || fact.answer !== want) problems.push(`${where}: answer ${String(task.answer)}, the drawings give ${want}`)
      if (its.length < 6 || its.length > 8) problems.push(`${where}: ${its.length} figures`)
      if (members.length < 2 || its.length - members.length < 2) problems.push(`${where}: ${members.length} of ${its.length} figures are members`)
      if (new Set(its.map((i) => i.id)).size !== its.length) problems.push(`${where}: two figures share an id`)
    }
    expect(first(problems)).toEqual([])
  })

  it('marks a plate with a turned, stretched or small member as conflict, and only its nicely standing members are prototypeOnly', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      const rule = sortRule(said(task))!
      const members = items(task).filter((i) => rule(figure(i.shape, i.variant)))
      const nice = members.filter((i) => isPrototypical(i.shape, i.variant))
      const conflict = nice.length < members.length
      if ((task.contrast === 'conflict') !== conflict) problems.push(`${fact.id}: contrast ${task.contrast}, the plate is ${conflict ? 'conflict' : 'congruent'}`)
      const mis: Record<string, string> = conflict && nice.length > 0 ? { [nice.map((i) => i.id).sort().join('|')]: 'prototypeOnly' } : {}
      problems.push(...selectionProblems(task, String(task.answer), mis))
    }
    expect(first(problems)).toEqual([])
    // the opportunities: prototypeOnly on every plate (a contrast task counts on both sides, SPEC §4.3)
    expect(first(detectableChecks(built, (b, v) => {
      const rule = sortRule(said(b.task))!
      const members = items(b.task).filter((i) => rule(figure(i.shape, i.variant)))
      const nice = members.filter((i) => isPrototypical(i.shape, i.variant))
      return { mis: nice.length > 0 && nice.length < members.length && v === nice.map((i) => i.id).sort().join('|') ? ['prototypeOnly'] : [] }
    }))).toEqual([])
    // SPEC §4.3: at least six of each, so the contrast rule can conclude
    const contrasts = canon.map((f) => built.find((b) => b.fact.id === f.id)!.task.contrast)
    expect(contrasts.filter((c) => c === 'conflict').length).toBeGreaterThanOrEqual(6)
    expect(contrasts.filter((c) => c === 'congruent').length).toBeGreaterThanOrEqual(6)
  })

  it('has SPEC’s production kind and ceiling (6–8 figures: at most 1 in 63)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
  })
}, TIMEOUT)

// ═══ symmetry ═══════════════════════════════════════════════════════════════

/** Grid cells: the left half's pattern, the right half as shown, and the left mirrored in the middle line. */
function halves(p: Extract<Task['prompt'], { scene: 'grid' }>) {
  const half = p.w / 2
  const left = p.filled.filter((c) => c % p.w < half)
  const right = p.filled.filter((c) => c % p.w >= half)
  const mirror = left.map((c) => Math.floor(c / p.w) * p.w + (p.w - 1 - (c % p.w)))
  return { left, right, mirror }
}

describe('symmetry oracle', () => {
  const { def, canon, instances, drawn, built } = setup('symmetry', 2)

  it('has SPEC §2.2’s two families (mirrorGrid in 2. kl.), 20 canonical instances each', () => {
    const fams = def.families.map((f) => `${f.id}${f.grade !== undefined ? `:${f.grade}` : ''}`)
    expect(fams.sort()).toEqual(['isSymLine', 'mirrorGrid:2'])
    for (const fam of def.families) expect(canon.filter((f) => f.family === fam.id).length, fam.id).toBe(20)
    for (const [fam, facts] of instances) expect(distinctIds(facts), fam).toBeGreaterThanOrEqual(150)
    expect(first(avoidChecks(def, instances))).toEqual([])
    expect([...canon, ...drawn].every((f) => /^sym:(line|grid):\d+$/.test(f.id) && f.family === (f.id.startsWith('sym:line') ? 'isSymLine' : 'mirrorGrid'))).toBe(true)
  })

  it('answers every task by measuring: the line folds the figure, the grid is mirrored, the squares missing, the figures with a line', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const text = said(task)
      const where = `${fact.id} ${kind} "${text}"`
      let want: string | number | null = null
      if (task.prompt.scene === 'shape' && text === 'Er stregen en symmetrilinje?') {
        const p = task.prompt
        const x = p.cut ? cutX(p.shape, p.variant, p.cut) : null
        if (x === null) problems.push(`${where}: no line drawn`)
        else want = mirroredAbout(figure(p.shape, p.variant), x) ? 'yes' : 'no'
      } else if (task.prompt.scene === 'grid' && text === 'Er mønsteret spejlet rigtigt i stregen?') {
        const h = halves(task.prompt)
        want = [...h.right].sort((a, b) => a - b).join() === [...h.mirror].sort((a, b) => a - b).join() ? 'yes' : 'no'
      } else if (task.prompt.scene === 'grid' && text === 'Hvor mange felter mangler, før mønsteret er spejlet i stregen?') {
        const h = halves(task.prompt)
        if (h.right.some((c) => !h.mirror.includes(c))) problems.push(`${where}: a square on the right that is not in the mirror image`)
        want = h.mirror.filter((c) => !h.right.includes(c)).length
        if (want < 1) problems.push(`${where}: nothing missing`)
      } else if (task.prompt.scene === 'shapes' && text === 'Hvor mange af figurerne har en symmetrilinje?') {
        want = task.prompt.items.filter((i) => hasSymmetryLine(figure(i.shape, i.variant))).length
      } else if (task.prompt.scene === 'shapes' && text === 'Tryk på alle figurer, der har en symmetrilinje.') {
        want = task.prompt.items.filter((i) => hasSymmetryLine(figure(i.shape, i.variant))).map((i) => i.id).sort().join('|')
      } else problems.push(`${where}: the oracle cannot read the question on a ${task.prompt.scene} scene`)
      if (want !== null && task.answer !== want) problems.push(`${where}: answer ${String(task.answer)}, measured ${want}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('shows both judgments on the true/false cards, and members and non-members on every plate', () => {
    const tf = built.filter((b) => b.kind === 'trueFalse')
    for (const fam of ['isSymLine', 'mirrorGrid']) {
      const own = tf.filter((b) => b.fact.family === fam).map((b) => b.task.answer)
      expect(own.filter((a) => a === 'yes').length, fam).toBeGreaterThan(own.length / 5)
      expect(own.filter((a) => a === 'no').length, fam).toBeGreaterThan(own.length / 5)
    }
    const problems: string[] = []
    for (const { fact, task } of built) {
      if (task.kind !== 'multiSelect') continue
      const its = sceneOf(task.prompt, 'shapes').items
      const yes = its.filter((i) => hasSymmetryLine(figure(i.shape, i.variant))).length
      if (yes < 2 || its.length - yes < 1) problems.push(`${fact.id}: ${yes} of ${its.length} have a line`)
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies every judgment, count and selection as plain (no misconception fits)', () => {
    expect(first(generic(built))).toEqual([])
    expect(first(classifyAll(built, nothing))).toEqual([])
    expect(first(detectableChecks(built, nothing))).toEqual([])
    expect(first(built.filter((b) => b.kind === 'multiSelect').flatMap((b) => selectionProblems(b.task, String(b.task.answer))))).toEqual([])
    // a count answered on the keys (the grid kind until wave 3): every value 0–99 but the count is wrong and plain
    const problems: string[] = []
    for (const { task } of built.filter((b) => b.kind === 'grid')) {
      for (let v = 0; v <= 99; v++) {
        const got = classifyAnswer(task, v)
        if ((v === task.answer) !== (got === null) || (got !== null && !['near', 'other', 'operand'].includes(got))) problems.push(`${task.factId} grid ${v}: ${got}`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (multiSelect and grid box 5, true/false box 2)', () => {
    expect(first(productionChecks(built, new Set(['production', 'ceiling'])))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it.fails('grid tasks are counts typed on the keys (1 in 13), yet kinds.ts guesses as if the child mirrored cells', () => {
    // SPEC §3.2 grid: "multi: spejl mønsteret" (1/2^celler). Both families ask "how many?" instead
    // (answer an int, src/ui/task/registry.ts falls back to the keypad 0–12): isSymLine has no grid at all
    // (prompt 'shapes', kinds.ts invents a 4 × 4 one: 1/65536), mirrorGrid one of 16–30 cells.
    const grid = built.filter((b) => b.kind === 'grid')
    expect(grid.length).toBeGreaterThan(0)
    expect(first(grid.filter((b) => Math.abs(guessP(b.task) - 1 / 13) > 1e-12).map((b) => `${b.fact.id}: guessP ${guessP(b.task)}`))).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
  })
}, TIMEOUT)

// ═══ composeShapes ══════════════════════════════════════════════════════════

describe('composeShapes oracle', () => {
  const { def, canon, built } = setup('composeShapes', 4)

  it('has SPEC §2.2’s 16 facts: 8 "how many make one", 8 "how many can you make", ids naming the blocks', () => {
    expect(canon.length).toBe(16)
    expect(canon.filter((f) => f.id.startsWith('cps:m:')).length).toBe(8)
    expect(canon.filter((f) => f.id.startsWith('cps:k:')).length).toBe(8)
    expect(first(idChecks(def, canon, /^cps:(m:[a-z-]+:[a-z]+|k:\d+:[a-z]+:[a-z-]+)$/, (id) => {
      const p = id.split(':')
      if (p[1] === 'm') {
        const per = piecesPer(p[2], p[3])
        return per === null ? null : { family: 'compose', answer: per }
      }
      const per = piecesPer(p[4], p[3])
      return per === null || Number(p[2]) % per !== 0 ? null : { family: 'compose', answer: Number(p[2]) / per }
    }))).toEqual([])
    for (const f of canon) expect(masteryKeyOf(def, f)).toBe(f.id)
  })

  it('answers every task from the question and the blocks shown: pieces per whole by area, or the pieces you have shared out', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const q = composeAsk(said(task))
      const where = `${fact.id} ${kind} "${said(task)}"`
      if (!q) {
        problems.push(`${where}: the oracle cannot read the question`)
        continue
      }
      const per = piecesPer(q.whole, q.piece)
      const its = sceneOf(task.prompt, 'shapes').items
      if (per === null) {
        problems.push(`${where}: ${q.piece} do not cover a ${q.whole}`)
        continue
      }
      if (q.have === null) {
        if (task.answer !== per) problems.push(`${where}: answer ${String(task.answer)}, by area ${per}`)
        const base = q.whole.replace('big-', '') as ShapeId
        if (its.length !== 2 || !its.some((i) => i.shape === base) || !its.some((i) => i.shape === q.piece)) problems.push(`${where}: shows ${JSON.stringify(its)}`)
      } else {
        const have = word99(q.have)
        if (have === null || have % per !== 0 || task.answer !== have / per) problems.push(`${where}: answer ${String(task.answer)}, ${have} pieces make ${have === null ? '?' : have / per}`)
        if (its.length !== have || its.some((i) => i.shape !== q.piece)) problems.push(`${where}: shows ${its.length} pieces`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards (0–12), classifies every wrong value as plain, and has SPEC’s production kinds and ceilings', () => {
    expect(first(generic(built))).toEqual([])
    expect(first(classifyAll(built, nothing))).toEqual([])
    expect(first(detectableChecks(built, nothing))).toEqual([])
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
  })

  it('says its numbers as SPEC §10.1 does, and every hint ends on the answer (pieces per whole, or wholes made)', () => {
    expect(first(numberWordProblems(built))).toEqual([])
    const problems: string[] = []
    for (const f of canon) {
      for (const tag of tagsToHint(def, canon)) {
        const text = spokenText(def.hint(f, tag).speech)
        if (numbersIn(text).at(-1) !== f.answer) problems.push(`${f.id} hint(${String(tag)}): "${text}"`)
      }
    }
    expect(first(problems)).toEqual([])
  })
}, TIMEOUT)
