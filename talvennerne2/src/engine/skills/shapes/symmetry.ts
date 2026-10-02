// symmetry — Symmetri (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `sym:`. An instance is
// drawn from its id, `sym:<line|grid>:<k>` (k = 0–999, canonical k = 0–19), so a fact rebuilt from its
// task id is the same task.
//   isSymLine  (1. kl.) a figure with a dashed line down it (Shape2D's cut), and a plate of six figures
//   mirrorGrid (2. kl.) a pattern on a 4×4 to 6×5 grid, mirrored in the line down the middle
// Kinds (every instance has all three):
//   trueFalse: isSymLine "Er stregen en symmetrilinje?" — the line is down the middle of a figure that
//     is mirrored in it (yes), off the middle (no), or down the middle of a figure it only halves (a
//     turned rectangle: no). mirrorGrid "Er mønsteret spejlet rigtigt?" — the whole grid, mirrored (yes),
//     moved across instead of mirrored, or with one square missing (no).
//   grid (production): mirrorGrid "Hvor mange felter mangler, før mønsteret er spejlet?" — part of the
//     mirror image is there; the answer is how many squares are missing (1–4). isSymLine: "Hvor mange af
//     figurerne har en symmetrilinje?" on the plate. The answer is a number, so until the grid view of
//     wave 3 exists the round shows it on the keypad (src/ui/task/registry.ts falls back to it).
//   multiSelect (production): "Tryk på alle figurer, der har en symmetrilinje." on the plate (prompt
//     'shapes'): the members can be folded onto themselves (geo.ts hasMirrorLine), the skew triangle,
//     firkant, pentagon and trapezium cannot.
// Wrong answers: the other judgment on true/false, one too many or too few ('near'), all the figures or
// all the squares of the pattern ('other'), one member left out or a non-member taken ('near'/'other').
// No misconception in the catalogue (SPEC §4.2).
// Hint: "Forestil dig, at du folder figuren langs stregen. Passer de to halvdele oven på hinanden?",
// "Hvert felt skal have et spejlfelt lige så langt fra stregen på den anden side." with the mirror drawn.
import type { AnswerValue, Fact, FamilyDef, Prompt, Rng, ShapeId, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hashSeed, makeRng } from '../../rng'
import { hintOf, metaOf, say, tagged, type Entry } from '../number/kit'
import { hasMirrorLine, mirroredByMiddle, type Fig } from './geo'

type Family = 'isSymLine' | 'mirrorGrid'
type Cut = 'equal' | 'unequal'

const FAST: Partial<Record<TaskKind, number>> = { trueFalse: 6_000, grid: 12_000, multiSelect: 14_000 }
const META = metaOf('symmetry')
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))
const CODE: Readonly<Record<Family, string>> = { isSymLine: 'line', mirrorGrid: 'grid' }
const INSTANCES = 1000
const CANONICAL = 20

/** Figures the plates are made of: everything but the turned circle (it looks like the standard one). */
const FIGS: readonly Fig[] = (['circle', 'semicircle', 'triangle', 'quadrilateral', 'square', 'rectangle', 'rhombus', 'trapezoid', 'pentagon', 'hexagon', 'octagon'] as ShapeId[])
  .flatMap((shape) => [0, 1, 2, 3, 4, 5].filter((v) => !(shape === 'circle' && v === 1)).map((variant) => ({ shape, variant })))

/** Figures the middle line halves without mirroring (the line is not a symmetry line, yet both parts are equal). */
const HALVED_ONLY: readonly Fig[] = [{ shape: 'rectangle', variant: 1 }, { shape: 'square', variant: 2 }, { shape: 'rhombus', variant: 2 }]

interface Item extends Fig {
  id: string
}

interface LineTask {
  family: 'isSymLine'
  /** The true/false figure and its line. */
  fig: Fig
  cut: Cut
  plate: Item[]
}
interface GridTask {
  family: 'mirrorGrid'
  w: number
  h: number
  /** The pattern on the left half. */
  left: number[]
  /** True/false: the right half shown, and whether it is the mirror image. */
  shown: number[]
  mirrored: boolean
  /** Grid: the part of the mirror image already there. */
  partial: number[]
  missing: number
  plate: Item[]
}
type Parsed = LineTask | GridTask

const mirrorCell = (w: number, c: number): number => Math.floor(c / w) * w + (w - 1 - (c % w))

/** Six figures, two to four of them with a symmetry line. */
function plateFor(rng: Rng): Item[] {
  const yes = rng.shuffle(FIGS.filter(hasMirrorLine))
  const no = rng.shuffle(FIGS.filter((f) => !hasMirrorLine(f)))
  const count = 2 + rng.int(3)
  const picked: Fig[] = []
  for (const f of yes) if (picked.length < count && !picked.some((p) => p.shape === f.shape)) picked.push(f)
  for (const f of no) if (picked.length < 6) picked.push(f)
  const ids = rng.shuffle([0, 1, 2, 3, 4, 5]).map((i) => `f${i}`)
  return picked.map((f, i) => ({ id: ids[i], ...f }))
}

function lineTask(k: number): LineTask {
  const rng = makeRng(hashSeed(`sym:line:${k}`))
  const plate = plateFor(rng)
  const way = rng.int(3)
  if (way === 2) return { family: 'isSymLine', fig: rng.pick(HALVED_ONLY), cut: 'equal', plate }
  const fig = rng.pick(FIGS.filter((f) => mirroredByMiddle(f) && f.variant !== 5))
  return { family: 'isSymLine', fig, cut: way === 0 ? 'equal' : 'unequal', plate }
}

function gridTask(k: number): GridTask {
  const rng = makeRng(hashSeed(`sym:grid:${k}`))
  const w = rng.pick([4, 6])
  const h = rng.pick([4, 5])
  const half = w / 2
  const leftCells = Array.from({ length: w * h }, (_, c) => c).filter((c) => c % w < half)
  const left = rng.shuffle(leftCells).slice(0, 3 + rng.int(3)).sort((a, b) => a - b)
  const mirror = left.map((c) => mirrorCell(w, c)).sort((a, b) => a - b)
  // true/false: the mirror image, the pattern moved across, or the mirror with one square missing
  const moved = left.map((c) => c + half).sort((a, b) => a - b)
  const way = rng.int(3)
  const wrong = way === 1 && moved.join() !== mirror.join() ? moved : rng.shuffle(mirror).slice(1).sort((a, b) => a - b)
  const shown = way === 0 ? mirror : wrong
  const missing = 1 + rng.int(Math.min(4, mirror.length - 1))
  const partial = rng.shuffle(mirror).slice(missing).sort((a, b) => a - b)
  return { family: 'mirrorGrid', w, h, left, shown, mirrored: way === 0, partial, missing, plate: plateFor(rng) }
}

const cache = new Map<string, Parsed>()
/** The instance from its id (also for a fact the round screen rebuilt from its task). */
function parse(f: Pick<Fact, 'id'>): Parsed {
  let hit = cache.get(f.id)
  if (!hit) {
    const [, code, k] = f.id.split(':')
    hit = code === 'line' ? lineTask(Number(k)) : gridTask(Number(k))
    if (cache.size > 500) cache.clear()
    cache.set(f.id, hit)
  }
  return hit
}

const join = (ids: readonly string[]): string => [...ids].sort().join('|')
const members = (p: Parsed): Item[] => p.plate.filter(hasMirrorLine)
const judged = (p: Parsed): 'yes' | 'no' =>
  p.family === 'isSymLine' ? (p.cut === 'equal' && mirroredByMiddle(p.fig) ? 'yes' : 'no') : p.mirrored ? 'yes' : 'no'

function factOf(family: Family, k: number): Fact {
  const id = `sym:${CODE[family]}:${k}`
  return { id, skill: 'symmetry', family, operands: [], answer: judged(parse({ id })), rank: family === 'isSymLine' ? 0 : 1 }
}

const FACTS: readonly Fact[] = (['isSymLine', 'mirrorGrid'] as const).flatMap((family) => Array.from({ length: CANONICAL }, (_, k) => factOf(family, k)))

function answerFor(f: Fact, kind: TaskKind): AnswerValue {
  const p = parse(f)
  if (kind === 'trueFalse') return judged(p)
  if (kind === 'multiSelect') return join(members(p).map((i) => i.id))
  return p.family === 'mirrorGrid' ? p.missing : members(p).length
}

function prompt(f: Fact, kind: TaskKind, rng: Rng): Prompt {
  const p = parse(f)
  if (kind === 'multiSelect' || (kind === 'grid' && p.family === 'isSymLine')) return { scene: 'shapes', items: rng.shuffle(p.plate) }
  if (p.family === 'isSymLine') return { scene: 'shape', shape: p.fig.shape, variant: p.fig.variant, cut: p.cut }
  const right = kind === 'trueFalse' ? p.shown : p.partial
  return { scene: 'grid', w: p.w, h: p.h, filled: [...p.left, ...right].sort((a, b) => a - b), axis: 'v' }
}

function candidates(f: Fact): ReturnType<typeof tagged> {
  const p = parse(f)
  const entries: Entry[] = [[judged(p) === 'yes' ? 'no' : 'yes', 'other']]
  // grid: how many are missing (mirrorGrid) or have a line (isSymLine)
  const n = p.family === 'mirrorGrid' ? p.missing : members(p).length
  entries.push([n - 1, 'near'], [n + 1, 'near'])
  entries.push(p.family === 'mirrorGrid' ? [p.left.length, 'other'] : [p.plate.length, 'other'])
  // multiSelect: a member left out, a non-member taken
  const mine = members(p)
  for (const m of mine) if (mine.length > 1) entries.push([join(mine.filter((x) => x !== m).map((i) => i.id)), 'near'])
  for (const o of p.plate.filter((i) => !hasMirrorLine(i))) entries.push([join([...mine.map((i) => i.id), o.id]), 'other'])
  return tagged(f.answer, entries).filter((c) => c.value !== n || typeof c.value !== 'number')
}

function hint(f: Fact, _tag: string | null, kind?: TaskKind) {
  const p = parse(f)
  if (kind === 'multiSelect' || (kind === 'grid' && p.family === 'isSymLine')) {
    const m = members(p)[0]
    return hintOf([say('hint.symmetry.fold'), say('hint.symmetry.skewNot')], { scene: 'shape', shape: m.shape, variant: m.variant, cut: 'equal' })
  }
  if (p.family === 'isSymLine') {
    return hintOf([say('hint.symmetry.foldLine'), say(judged(p) === 'yes' ? 'hint.symmetry.fits' : 'hint.symmetry.notFits')], { scene: 'shape', shape: p.fig.shape, variant: p.fig.variant, cut: p.cut })
  }
  const mirror = p.left.map((c) => mirrorCell(p.w, c))
  return hintOf([say('hint.symmetry.mirrorCell'), say(kind === 'grid' ? 'hint.symmetry.countMissing' : 'hint.symmetry.checkEach')], {
    scene: 'grid', w: p.w, h: p.h, filled: [...p.left, ...mirror].sort((a, b) => a - b), axis: 'v',
  })
}

function instance(fam: FamilyDef, rng: Rng, avoid: ReadonlySet<string>): Fact {
  const family = fam.id as Family
  for (let i = 0; i < 50; i++) {
    const k = rng.int(INSTANCES)
    if (!avoid.has(`sym:${CODE[family]}:${k}`)) return factOf(family, k)
  }
  return factOf(family, rng.int(INSTANCES))
}

export default {
  ...META,
  families: FAMILIES,
  // grid first among the production kinds: the mirror task is what a trial asks of mirrorGrid
  kinds: ['trueFalse', 'grid', 'multiSelect'],
  enumerate: () => [...FACTS],
  instance,
  answer: answerFor,
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'trueFalse' ? 'token' : kind === 'multiSelect' ? 'set' : 'int'),
  answerType: () => 'token',
  prompt,
  optionView: (_f: Fact, kind: TaskKind) => (kind === 'trueFalse' ? 'yesNo' : kind === 'multiSelect' ? 'shape' : 'numeral'),
  range: (_f: Fact, kind: TaskKind) => (kind === 'grid' ? [0, 12] : [0, 1]),
  speech: (f: Fact, kind: TaskKind) => {
    const p = parse(f)
    if (kind === 'multiSelect') return [say('frag.tryk_paa'), say('s.symmetry.allWithLine')]
    if (kind === 'grid') return [say(p.family === 'mirrorGrid' ? 's.symmetry.howManyMissing' : 's.symmetry.howManyWithLine')]
    return [say(p.family === 'mirrorGrid' ? 's.symmetry.isMirrored' : 's.symmetry.isLine')]
  },
  candidates,
  hint,
} satisfies SkillModule
