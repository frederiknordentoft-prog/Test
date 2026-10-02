// measureUnits — Mål med klodser (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `maal:`.
//   cubes   maal:cubes:<n>:<thing>   a long thing measured with n cubes, n = 2–12   (9 things · 11 = 99)
//   clips   maal:clips:<n>:<thing>   the same with n paper clips, n = 2–10          (9 things · 9 = 81)
// <thing> is one of the long things (kit2.ts LONG_THINGS); the id carries the whole instance.
// Prompt { scene: 'unitsRow', object, unit: 'cube' | 'clip', length: n }: the thing lies above a row of
// n units that reach exactly from end to end. "Hvor mange klodser lang er tingen?"
// Kinds: choice (three numbers) and keypad (production), range 0–15 (a keypad guess is 1 in 16).
// Wrong answers: near ±1 (a unit skipped or counted twice), other ±2. SPEC §4.2 has no misconception
// for measuring with units, so there is no diagnostic card.
// fastMs: counting takes time — 3 s (choice) or 4 s (keypad) plus 0.7 s a unit.
import type { Fact, FamilyDef, HintSpec, Prompt, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import { canonical, drawAvoiding, familyRank } from '../place/kit'
import { LONG_THINGS, between, type LongThing } from './kit2'

const meta = metaOf('measureUnits')

type Family = 'cubes' | 'clips'

interface Row {
  family: Family
  n: number
  thing: LongThing
}

const LENGTHS: Readonly<Record<Family, readonly number[]>> = { cubes: between(2, 12), clips: between(2, 10) }

const idOf = (r: Row) => `maal:${r.family}:${r.n}:${r.thing}`

function parse(id: string): Row {
  const [, family, n, thing] = id.split(':')
  return { family: family as Family, n: Number(n), thing: thing as LongThing }
}

const make = (r: Row): Fact => ({
  id: idOf(r),
  skill: 'measureUnits',
  family: r.family,
  operands: [r.n],
  answer: r.n,
  rank: familyRank(meta.families, r.family),
})

const draw = (family: Family, rng: Rng): Fact => make({ family, n: rng.pick(LENGTHS[family]), thing: rng.pick(LONG_THINGS) })

const FACTS: readonly Fact[] = meta.families.flatMap((fam) => canonical('measureUnits', fam.id, (rng) => draw(fam.id as Family, rng)))

const scene = (r: Row): Prompt => ({ scene: 'unitsRow', object: r.thing, unit: r.family === 'cubes' ? 'cube' : 'clip', length: r.n })

function candidates(f: Fact) {
  const { n } = parse(f.id)
  return tagged(n, [
    [n + 1, 'near'],
    [n - 1, 'near'],
    [n + 2, 'other'],
    ...(n - 2 > 0 ? [[n - 2, 'other'] as const] : []),
  ])
}

/** "Tæl klodserne under tingen. Peg på hver klods, mens du tæller. Tingen er syv klodser lang." */
function hint(f: Fact, tag: string | null): HintSpec {
  const r = parse(f.id)
  const cubes = r.family === 'cubes'
  const standard: SpeechPart[] = [
    say(cubes ? 'hint.measureUnits.countCubes' : 'hint.measureUnits.countClips'),
    say('hint.measureUnits.thingIs'),
    num(r.n, 'mid'),
    say(cubes ? 'hint.measureUnits.cubesLong' : 'hint.measureUnits.clipsLong'),
  ]
  const lead = tag === 'near' ? [say('hint.measureUnits.eachOnce')] : []
  return hintOf([...lead, ...standard], scene(r))
}

export default {
  ...meta,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id as Family, rng), avoid),
  // read back from the id (a fact rebuilt from a task has only its id)
  answer: (f: Fact) => parse(f.id).n,
  answerType: () => 'int',
  prompt: (f: Fact) => scene(parse(f.id)),
  optionView: () => 'numeral',
  range: () => [0, 15],
  speech: (f: Fact) => [say(parse(f.id).family === 'cubes' ? 's.measureUnits.howManyCubes' : 's.measureUnits.howManyClips')],
  candidates,
  hint: (f: Fact, tag) => hint(f, tag),
  fastMs: (f: Fact, kind: TaskKind) => (kind === 'keypad' ? 4_000 : 3_000) + 700 * parse(f.id).n,
} satisfies SkillModule
