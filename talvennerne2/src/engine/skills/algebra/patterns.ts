// patterns — Mønstre (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, 5 families, prefix `ptn:`.
//   AB  AAB  ABB  ABC  growing (A B, A B B, A B B B …)
// Instance `ptn:<family>:<A>.<B>[.<C>]:<shown>`: the beads A, B (C) and how many are shown before the
// gap. Beads are tokens `pat:<name>` from one kind: colours (red, blue, yellow — no red/green pair),
// shapes (circle, triangle, square) or countable things (carrot, apple …; the materials draw them).
//
// choice: "Hvad kommer så?" — the row with one empty place; cards are the pattern's other beads and
//   one bead from outside it.
// fillSlots (production): "Fortsæt mønstret." — two empty places (AB, growing) or three (AAB, ABB,
//   ABC) and a palette of three beads: the pattern's own plus one from outside (ABC: its three).
//   3² = 9 and 3³ = 27 ways to fill, so a guess is at most 1 in 9 (SPEC §3.3).
// At least two whole repeats are shown before the gap (growing: two whole groups and part of the third),
// and the gap falls on every place of the repeat across instances.
// Wrong answers: another bead of the pattern ('near'), one from outside ('other'), the continuation
// shifted by one place ('near'). Patterns have no misconception in the catalogue.
import type { AnswerValue, Candidate, Fact, FamilyDef, HintSpec, Rng, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hashSeed, makeRng } from '../../rng'
import { hintOf, metaOf, say, tagged } from '../number/kit'

type Family = 'AB' | 'AAB' | 'ABB' | 'ABC' | 'growing'

const KINDS_OF_BEADS = {
  colour: ['red', 'blue', 'yellow'],
  shape: ['circle', 'triangle', 'square'],
  thing: ['carrot', 'apple', 'flower', 'fish', 'leaf', 'mushroom', 'strawberry', 'ball', 'chestnut', 'star'],
} as const
type BeadKind = keyof typeof KINDS_OF_BEADS

interface Shape {
  /** Different beads in the pattern. */
  beads: 2 | 3
  /** Empty places to fill in fillSlots. */
  slots: 2 | 3
  /** How many beads are shown before the gap (a range, so the gap moves through the repeat). */
  shown: readonly number[]
}

const SHAPES: Readonly<Record<Family, Shape>> = {
  AB: { beads: 2, slots: 2, shown: [4, 5, 6, 7] },
  AAB: { beads: 2, slots: 3, shown: [6, 7, 8] },
  ABB: { beads: 2, slots: 3, shown: [6, 7, 8] },
  ABC: { beads: 3, slots: 3, shown: [6, 7, 8] },
  growing: { beads: 2, slots: 2, shown: [8, 9, 10] },
}

/** The i-th bead (by name) of an endless pattern. */
export function beadAt(family: Family, units: readonly string[], i: number): string {
  const [a, b, c] = units
  switch (family) {
    case 'AB':
      return i % 2 === 0 ? a : b
    case 'AAB':
      return i % 3 === 2 ? b : a
    case 'ABB':
      return i % 3 === 0 ? a : b
    case 'ABC':
      return [a, b, c][i % 3]
    case 'growing': {
      // groups A B, A B B, A B B B …: group g is one A and g B's
      let g = 1
      let pos = i
      while (pos >= g + 1) {
        pos -= g + 1
        g++
      }
      return pos === 0 ? a : b
    }
  }
}

interface PatternData {
  kind: BeadKind
  units: string[]
  shown: number
  /** A bead from the same kind that is not in the pattern (none for ABC). */
  outside: string | null
}
const dataOf = (f: Fact) => f.data as unknown as PatternData
const familyOf = (f: Fact) => f.family as Family
const pat = (name: string) => `pat:${name}`

function make(family: Family, kind: BeadKind, units: string[], shown: number): Fact {
  const id = `ptn:${family}:${units.join('.')}:${shown}`
  const rest = KINDS_OF_BEADS[kind].filter((b) => !units.includes(b))
  const outside = family === 'ABC' || rest.length === 0 ? null : makeRng(hashSeed(id)).pick(rest)
  const data: PatternData = { kind, units, shown, outside }
  return {
    id,
    skill: 'patterns',
    family,
    operands: [shown],
    answer: pat(beadAt(family, units, shown)),
    rank: (['AB', 'AAB', 'ABB', 'ABC', 'growing'] as const).indexOf(family),
    data: data as unknown as Fact['data'],
  }
}

function draw(family: Family, rng: Rng): Fact {
  const shape = SHAPES[family]
  const kind = rng.pick(['colour', 'shape', 'thing'] as const)
  const units = rng.shuffle(KINDS_OF_BEADS[kind]).slice(0, shape.beads)
  return make(family, kind, units, rng.pick(shape.shown))
}

const CANON: readonly Fact[] = (Object.keys(SHAPES) as Family[]).flatMap((family) => {
  const rng = makeRng(hashSeed(`patterns/${family}`))
  const out = new Map<string, Fact>()
  while (out.size < 20) {
    const f = draw(family, rng)
    out.set(f.id, f)
  }
  return [...out.values()]
})

/** The beads shown before the gap. */
const shownBeads = (f: Fact): string[] =>
  Array.from({ length: dataOf(f).shown }, (_, i) => pat(beadAt(familyOf(f), dataOf(f).units, i)))

/** The next `n` beads after the shown ones, starting `skip` places later. */
const nextBeads = (f: Fact, n: number, skip = 0): string[] =>
  Array.from({ length: n }, (_, i) => pat(beadAt(familyOf(f), dataOf(f).units, dataOf(f).shown + skip + i)))

const slotsOf = (f: Fact) => SHAPES[familyOf(f)].slots

/** The palette: the pattern's beads and the one from outside. */
const paletteOf = (f: Fact): string[] => [...dataOf(f).units, ...(dataOf(f).outside ? [dataOf(f).outside!] : [])].map(pat)

function candidates(f: Fact): Candidate[] {
  const { units, outside } = dataOf(f)
  const shifted = nextBeads(f, slotsOf(f), 1).join('|')
  return tagged(f.answer, [
    ...units.map((u) => [pat(u), 'near'] as const),
    ...(outside ? [[pat(outside), 'other'] as const] : []),
    [shifted, 'near'],
  ])
}

function hint(f: Fact): HintSpec {
  const completed = [...shownBeads(f), ...nextBeads(f, slotsOf(f))]
  return hintOf([say(`hint.patterns.${familyOf(f)}`), say('hint.patterns.sayIt')], { scene: 'row', cells: completed })
}

export default {
  ...metaOf('patterns'),
  kinds: ['choice', 'fillSlots'],
  enumerate: () => [...CANON],
  instance(family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) {
    let f = draw(family.id as Family, rng)
    for (let i = 0; i < 30 && avoid.has(f.id); i++) f = draw(family.id as Family, rng)
    return f
  },
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'fillSlots' ? nextBeads(f, slotsOf(f)).join('|') : f.answer),
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'fillSlots' ? 'set' : 'token'),
  answerType: () => 'token',
  options: (f: Fact, _kind: TaskKind, rng: Rng): AnswerValue[] => rng.shuffle(paletteOf(f)),
  prompt: (f, kind) => ({ scene: 'row', cells: [...shownBeads(f), ...Array<null>(kind === 'fillSlots' ? slotsOf(f) : 1).fill(null)] }),
  optionView: () => 'patternToken',
  range: () => [0, 1],
  speech: (_f, kind) => [say(kind === 'fillSlots' ? 's.patterns.continue' : 's.patterns.whatNext')],
  candidates,
  hint,
} satisfies SkillModule
