// The shapes skills of 1.–2. klasse (SK2-GEO): sidesCorners, shapes3D, sortShapes, symmetry and
// composeShapes. Every answer is worked out again here from tables written by hand from the materials
// (src/art/materials/Shapes.tsx, Solids.tsx, ui/scenes/objects.tsx), never with the skills' own code.
import { describe, expect, it } from 'vitest'
import sidesCornersModule from './sidesCorners'
import shapes3DModule from './shapes3D'
import sortShapesModule from './sortShapes'
import symmetryModule from './symmetry'
import composeShapesModule from './composeShapes'
import { geoSuite, factById, textOf } from './testing/suite'
import { globalIdCheck, tasksUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import type { Fact, Prompt, ShapeId, SkillDef, SolidId, Task } from '../../types'

const sidesCorners: SkillDef = sidesCornersModule
const shapes3D: SkillDef = shapes3DModule
const sortShapes: SkillDef = sortShapesModule
const symmetry: SkillDef = symmetryModule
const composeShapes: SkillDef = composeShapesModule

// ─── Hand tables ────────────────────────────────────────────────────────────

const CORNERS: Record<ShapeId, number> = {
  circle: 0, semicircle: 2, triangle: 3, quadrilateral: 4, square: 4, rectangle: 4, rhombus: 4, trapezoid: 4, pentagon: 5, hexagon: 6, octagon: 8,
}
/** What the generic firkant is drawn as, per variant (Shapes.tsx). */
const drawn = (s: ShapeId, v: number): ShapeId => (s !== 'quadrilateral' ? s : v === 1 ? 'square' : v === 2 ? 'quadrilateral' : 'rectangle')
const CLASSES: Record<ShapeId, ShapeId[]> = {
  circle: ['circle'], semicircle: ['semicircle'], triangle: ['triangle'], quadrilateral: ['quadrilateral'],
  rectangle: ['rectangle', 'quadrilateral'], rhombus: ['rhombus', 'quadrilateral'], square: ['square', 'rectangle', 'rhombus', 'quadrilateral'],
  trapezoid: ['trapezoid', 'quadrilateral'], pentagon: ['pentagon'], hexagon: ['hexagon'], octagon: ['octagon'],
}
const is = (s: ShapeId, v: number, c: ShapeId) => CLASSES[drawn(s, v)].includes(c)
/** Figures without any line of symmetry: the skew triangle, firkant, pentagon and trapezium. */
const NO_LINE = new Set(['triangle.2', 'quadrilateral.2', 'pentagon.2', 'trapezoid.2'])
const hasLine = (s: ShapeId, v: number) => !NO_LINE.has(`${s}.${v}`)
/** Figures the vertical line down the middle mirrors (variants 3–5 are variant 0 made small, striped, outlined). */
const MIDDLE: Record<ShapeId, number[]> = {
  circle: [0, 1, 2], semicircle: [0], triangle: [0], quadrilateral: [0, 1], square: [0, 1], rectangle: [0, 2],
  rhombus: [0, 1], trapezoid: [0, 1], pentagon: [0, 1], hexagon: [0, 1, 2], octagon: [0, 1, 2],
}
const middle = (s: ShapeId, v: number) => MIDDLE[s].includes(v >= 3 ? 0 : v)

const SOLID_OF_THING: Record<string, SolidId> = { ball: 'sphere', marble: 'sphere', cube: 'cube', book: 'cuboid', straw: 'cylinder', carrot: 'cone' }
const ROLLS: SolidId[] = ['sphere', 'cylinder', 'cone']
const STACKS: SolidId[] = ['cube', 'cuboid', 'cylinder']
const FLAT: SolidId[] = ['cube', 'cuboid', 'pyramid']
const solidOfCard = (c: string): SolidId => (c.startsWith('solid:') ? (c.slice(6) as SolidId) : SOLID_OF_THING[c.slice(4)])
/** Right for a shapes3D fact: shaped like the solid (a cube is also a kasse), or has the property. */
function solidFits(f: Fact, card: string): boolean {
  const [, code, a] = f.id.split(':')
  const s = solidOfCard(card)
  if (code === 'n' || code === 'o') {
    const want = code === 'n' ? (a as SolidId) : SOLID_OF_THING[a]
    return s === want || (want === 'cuboid' && s === 'cube')
  }
  return (a === 'rolls' ? ROLLS : a === 'stacks' ? STACKS : FLAT).includes(s)
}

const shapesOf = (t: Task) => (t.prompt as Extract<Prompt, { scene: 'shapes' }>).items
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort().join('|')

// ─── Contracts ──────────────────────────────────────────────────────────────

describe('shapes of 1.–2. klasse (SK2-GEO)', () => {
  globalIdCheck()

  geoSuite(sidesCorners, {
    families: { sides: 15, corners: 15 },
    idFormat: /^sc:[sc]:(triangle|quadrilateral|pentagon|hexagon|octagon):[012]$/,
    answerOf: (f) => CORNERS[f.id.split(':')[2] as ShapeId],
    ceilings: { choice: 3, keypad: 5 },
  })

  const COMPOSE: Record<string, number> = {
    'cps:m:circle:semicircle': 2, 'cps:m:rhombus:triangle': 2, 'cps:m:trapezoid:triangle': 3, 'cps:m:hexagon:trapezoid': 2,
    'cps:m:hexagon:rhombus': 3, 'cps:m:big-square:square': 4, 'cps:m:big-triangle:triangle': 4, 'cps:m:hexagon:triangle': 6,
    'cps:k:4:triangle:rhombus': 2, 'cps:k:6:semicircle:circle': 3, 'cps:k:4:trapezoid:hexagon': 2, 'cps:k:6:triangle:rhombus': 3,
    'cps:k:6:triangle:trapezoid': 2, 'cps:k:6:rhombus:hexagon': 2, 'cps:k:8:triangle:rhombus': 4, 'cps:k:6:trapezoid:hexagon': 3,
  }
  geoSuite(composeShapes, {
    families: { compose: 16 },
    idFormat: /^cps:(m:[a-z-]+:[a-z]+|k:\d+:[a-z]+:[a-z-]+)$/,
    answerOf: (f) => COMPOSE[f.id],
    ceilings: { choice: 3, keypad: 5 },
  })

  geoSuite(shapes3D, {
    families: { names: 11, props: 15 },
    idFormat: /^s3d:(n:(sphere|cube|cuboid|cylinder|cone)|o:(ball|marble|cube|book|straw|carrot)|p:(rolls|stacks|flat):[0-4])$/,
    answerOf(f, kind, task) {
      if (kind === 'multiSelect') return task.options.filter((o) => solidFits(f, String(o))).map(String).sort().join('|')
      if (kind === 'keypad') {
        const p = task.prompt as Extract<Prompt, { scene: 'compareObjects' }>
        return p.objects.filter((o) => solidFits(f, `obj:${o}`)).length
      }
      return task.answer
    },
    isRight: (f, _t, o) => typeof o === 'string' && solidFits(f, o),
    ceilings: { choice: 3, multiSelect: 5, keypad: 5 },
  })

  const SORT: Record<string, (s: ShapeId, v: number) => boolean> = {
    threeCorners: (s) => CORNERS[s] === 3,
    fourCorners: (s) => CORNERS[s] === 4,
    noCorners: (s) => CORNERS[s] === 0,
    fourEqualSides: (s, v) => is(s, v, 'rhombus'),
    rightAngle: (s, v) => is(s, v, 'rectangle'),
  }
  geoSuite(sortShapes, {
    families: { threeCorners: 20, fourCorners: 20, noCorners: 20, fourEqualSides: 20, rightAngle: 20 },
    idFormat: /^srt:(threeCorners|fourCorners|noCorners|fourEqualSides|rightAngle):\d{1,3}$/,
    answerOf: (f, _k, task) => ids(shapesOf(task).filter((i) => SORT[f.family](i.shape, i.variant))),
    isRight: (f, task, o) => {
      const i = shapesOf(task).find((x) => x.id === o)!
      return SORT[f.family](i.shape, i.variant)
    },
    ceilings: { multiSelect: 5 },
    perceptual: 'prototypeOnly',
  })

  geoSuite(symmetry, {
    families: { isSymLine: 20, mirrorGrid: 20 },
    idFormat: /^sym:(line|grid):\d{1,3}$/,
    answerOf(f, kind, task) {
      const p = task.prompt
      if (kind === 'multiSelect' || (kind === 'grid' && p.scene === 'shapes')) {
        const members = shapesOf(task).filter((i) => hasLine(i.shape, i.variant))
        return kind === 'grid' ? members.length : ids(members)
      }
      if (p.scene === 'shape') return p.cut === 'equal' && middle(p.shape, p.variant) ? 'yes' : 'no'
      const g = p as Extract<Prompt, { scene: 'grid' }>
      const filled = new Set(g.filled)
      const left = g.filled.filter((c) => c % g.w < g.w / 2)
      const mirror = left.map((c) => Math.floor(c / g.w) * g.w + (g.w - 1 - (c % g.w)))
      if (kind === 'grid') return mirror.filter((c) => !filled.has(c)).length
      const right = g.filled.filter((c) => c % g.w >= g.w / 2)
      return right.length === mirror.length && mirror.every((c) => filled.has(c)) ? 'yes' : 'no'
    },
    isRight: (_f, task, o) => {
      const i = shapesOf(task).find((x) => x.id === o)!
      return hasLine(i.shape, i.variant)
    },
    ceilings: { trueFalse: 2, multiSelect: 5, grid: 5 },
  })
})

// ─── Skill by skill ─────────────────────────────────────────────────────────

const task = (def: SkillDef, id: string, kind: Task['kind'], seed = 1) => buildTask(def, factById(def, id), kind, makeRng(seed), 0).task

describe('sidesCorners', () => {
  it('asks and explains in plain Danish', () => {
    expect(textOf(task(sidesCorners, 'sc:c:hexagon:1', 'keypad'))).toBe('Hvor mange hjørner har figuren?')
    expect(textOf(task(sidesCorners, 'sc:s:triangle:2', 'choice'))).toBe('Hvor mange sider har figuren?')
    const h = sidesCorners.hint(factById(sidesCorners, 'sc:c:hexagon:1'), null)
    expect(compile(h.speech).text).toBe('Sæt en finger på et hjørne, og tæl hjørnerne hele vejen rundt. Figuren har seks hjørner.')
    expect(h.visual).toEqual({ scene: 'shape', shape: 'hexagon', variant: 1, mark: 'corners' })
    const near = sidesCorners.hint(factById(sidesCorners, 'sc:s:octagon:0'), 'near')
    expect(compile(near.speech).text).toBe('Tæl hver side én gang, og stop, når du er tilbage, hvor du startede. Figuren har otte sider.')
  })

  it('takes 0–12 on the keypad and tags a corner counted twice as near', () => {
    const t = task(sidesCorners, 'sc:c:pentagon:2', 'keypad')
    expect([t.range, t.maxDigits, t.distractorTags['6'], t.distractorTags['4'], t.distractorTags['8']]).toEqual([[0, 12], 2, 'near', 'near', 'other'])
  })
})

describe('composeShapes', () => {
  it('asks with the pattern blocks', () => {
    expect(textOf(task(composeShapes, 'cps:m:hexagon:triangle', 'keypad'))).toBe('Hvor mange trekanter skal der til for at lave en sekskant?')
    expect(textOf(task(composeShapes, 'cps:m:big-square:square', 'choice'))).toBe('Hvor mange små kvadrater skal der til for at lave et stort kvadrat?')
    expect(textOf(task(composeShapes, 'cps:k:6:triangle:rhombus', 'keypad'))).toBe('Du har seks trekanter. Hvor mange romber kan du lave af dem?')
    expect(compile(composeShapes.hint(factById(composeShapes, 'cps:k:6:triangle:rhombus'), null).speech).text)
      .toBe('En rombe er lavet af to trekanter. Seks trekanter giver tre romber.')
    expect(compile(composeShapes.hint(factById(composeShapes, 'cps:m:big-triangle:triangle'), null).speech).text)
      .toBe('Forestil dig, at du lægger små trekanter på den store trekant. Der skal fire til.')
  })

  it('shows the pieces you have, and tags their number as a number from the question (A9)', () => {
    const t = task(composeShapes, 'cps:k:8:triangle:rhombus', 'keypad')
    expect(shapesOf(t)).toHaveLength(8)
    expect(t.distractorTags['8']).toBe('operand')
  })
})

describe('shapes3D', () => {
  it('never deals a cube as the wrong card for the kasse, and takes cubes into "alle kasser" (SPEC §2.3)', () => {
    let cubes = 0
    for (const { fact, task: t } of tasksUnderTest(shapes3D, 12)) {
      if (!fact.id.startsWith('s3d:n:cuboid') && fact.id !== 's3d:o:book') continue
      if (t.kind === 'choice') expect(t.options).not.toContain('solid:cube')
      if (t.kind === 'multiSelect') {
        for (const o of t.options.filter((x) => x === 'solid:cube' || x === 'obj:cube')) {
          expect(String(t.answer).split('|')).toContain(o)
          cubes++
        }
      }
    }
    expect(cubes).toBeGreaterThan(0)
  })

  it('asks in plain Danish', () => {
    expect(textOf(task(shapes3D, 's3d:n:sphere', 'choice'))).toBe('Tryk på kuglen.')
    expect(textOf(task(shapes3D, 's3d:o:carrot', 'choice'))).toBe('Hvilken figur har samme form som tingen?')
    expect(task(shapes3D, 's3d:o:carrot', 'choice').prompt).toEqual({ scene: 'solid', solid: 'cone', asObject: 'carrot' })
    expect(textOf(task(shapes3D, 's3d:n:cuboid', 'multiSelect'))).toBe('Tryk på alle, der har form som en kasse.')
    expect(textOf(task(shapes3D, 's3d:n:cylinder', 'keypad'))).toBe('Hvor mange af tingene har form som en cylinder?')
    expect(textOf(task(shapes3D, 's3d:p:rolls:2', 'choice'))).toBe('Hvilken figur kan trille?')
    expect(textOf(task(shapes3D, 's3d:p:flat:0', 'multiSelect'))).toBe('Tryk på alle, der kun har flade sider.')
    expect(compile(shapes3D.hint(factById(shapes3D, 's3d:n:cuboid'), null).speech).text).toBe('En kasse har seks flader, der er rektangler. En terning er også en kasse.')
  })

  it('counts the things on the shelf on the keypad', () => {
    const t = task(shapes3D, 's3d:n:cuboid', 'keypad')
    expect(t.prompt.scene).toBe('compareObjects')
    // the book and the toy cube are both kasser
    expect(t.answer).toBe(2)
  })
})

describe('sortShapes', () => {
  const tasks = tasksUnderTest(sortShapes)

  it('deals 6–8 figures, never the same figure twice', () => {
    for (const { fact, task: t } of tasks) {
      const items = shapesOf(t)
      expect(items.length, fact.id).toBeGreaterThanOrEqual(6)
      expect(items.length, fact.id).toBeLessThanOrEqual(8)
      expect(new Set(items.map((i) => `${i.shape}.${i.variant}`)).size, fact.id).toBe(items.length)
    }
  })

  it('offers the prototype-only answer on conflict plates: exactly the members that stand nicely', () => {
    let conflicts = 0
    for (const { fact, task: t } of tasks) {
      const members = shapesOf(t).filter((i) => String(t.answer).split('|').includes(i.id))
      const odd = members.filter((i) => i.shape !== 'circle' && [1, 2, 3].includes(i.variant))
      expect(t.contrast, fact.id).toBe(odd.length > 0 ? 'conflict' : 'congruent')
      const proto = Object.entries(t.distractorTags).filter(([, tag]) => tag === 'prototypeOnly').map(([k]) => k)
      if (odd.length === 0) {
        expect(proto, fact.id).toEqual([])
        continue
      }
      conflicts++
      expect(proto, fact.id).toEqual([ids(members.filter((i) => !odd.includes(i)))])
    }
    expect(conflicts).toBeGreaterThan(100)
  })

  it('takes a turned square drawn as a firkant into "fire lige lange sider", and squares into "fire rette hjørner"', () => {
    const fes = tasks.filter((x) => x.fact.family === 'fourEqualSides').flatMap((x) => shapesOf(x.task).map((i) => ({ i, t: x.task })))
    const turned = fes.filter(({ i }) => i.shape === 'quadrilateral' && i.variant === 1)
    expect(turned.length).toBeGreaterThan(0)
    for (const { i, t } of turned) expect(String(t.answer).split('|')).toContain(i.id)
  })

  it('asks in plain Danish', () => {
    expect(textOf(task(sortShapes, 'srt:noCorners:3', 'multiSelect'))).toBe('Tryk på alle figurer uden hjørner.')
    expect(textOf(task(sortShapes, 'srt:fourEqualSides:3', 'multiSelect'))).toBe('Tryk på alle figurer med fire lige lange sider.')
    const conflict = sortShapes.enumerate().find((f) => sortShapes.candidates(f).some((c) => c.tag === 'prototypeOnly'))!
    const h = sortShapes.hint(conflict, 'prototypeOnly')
    expect(h.misconception).toBe('prototypeOnly')
    expect(compile(h.speech).text).toMatch(/^Selv om figuren er drejet, lille eller skæv, tæller den med\./)
  })
})

describe('symmetry', () => {
  const tasks = tasksUnderTest(symmetry)

  it('asks whether a line is a symmetry line, also where the line only halves the figure', () => {
    const lines = tasks.filter((x) => x.task.kind === 'trueFalse' && x.task.prompt.scene === 'shape').map((x) => x.task)
    const answers = new Set(lines.map((t) => t.answer))
    expect(answers).toEqual(new Set(['yes', 'no']))
    // a turned rectangle cut down the middle: two equal parts, but not mirrored
    expect(lines.some((t) => t.prompt.scene === 'shape' && t.prompt.shape === 'rectangle' && t.prompt.variant === 1 && t.answer === 'no')).toBe(true)
  })

  it('shows a mirrored, a moved and an unfinished pattern on the grid', () => {
    const grids = tasks.filter((x) => x.task.kind === 'trueFalse' && x.task.prompt.scene === 'grid').map((x) => x.task)
    expect(new Set(grids.map((t) => t.answer))).toEqual(new Set(['yes', 'no']))
    for (const t of tasks.filter((x) => x.task.kind === 'grid' && x.fact.family === 'mirrorGrid')) {
      expect(t.task.answer as number).toBeGreaterThanOrEqual(1)
      expect(t.task.answerType).toBe('int')
    }
  })

  it('asks in plain Danish', () => {
    const line = symmetry.enumerate().find((f) => f.family === 'isSymLine')!
    expect(textOf(buildTask(symmetry, line, 'trueFalse', makeRng(1), 0).task)).toBe('Er stregen en symmetrilinje?')
    expect(textOf(buildTask(symmetry, line, 'multiSelect', makeRng(1), 0).task)).toBe('Tryk på alle figurer, der har en symmetrilinje.')
    const grid = symmetry.enumerate().find((f) => f.family === 'mirrorGrid')!
    expect(textOf(buildTask(symmetry, grid, 'grid', makeRng(1), 0).task)).toBe('Hvor mange felter mangler, før mønsteret er spejlet i stregen?')
    expect(compile(symmetry.hint(grid, null, 'grid').speech).text)
      .toBe('Hvert farvet felt skal have et spejlfelt lige så langt fra stregen på den anden side. Find de spejlfelter, der ikke er farvet endnu, og tæl dem.')
  })
})
