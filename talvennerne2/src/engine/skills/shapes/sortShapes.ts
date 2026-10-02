// sortShapes — Sortér figurer (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `srt:`. An
// instance is a plate of 6–8 figures drawn from its id: `srt:<family>:<k>` (k = 0–999, the canonical
// facts are k = 0–19), so a fact rebuilt from its task id has the same plate.
//   threeCorners             "Tryk på alle figurer med tre hjørner."        1. kl.
//   fourCorners              "Tryk på alle figurer med fire hjørner."       1. kl.
//   noCorners                "Tryk på alle figurer uden hjørner."           1. kl.
//   fourEqualSides  (2. kl.) "Tryk på alle figurer med fire lige lange sider."
//   rightAngle      (3. kl.) "Tryk på alle figurer med fire rette hjørner."
// Kind: multiSelect only (production). Members follow the figures as drawn (geo.ts, isA.ts): a turned
// square drawn as a firkant has four equal sides and right angles, a square is a rectangle and a rhombus,
// a semicircle has two corners. Every member is in the answer; no distractor is a member (SPEC §2.3).
// Non-members are the near ones first (a pentagon among triangles, a semicircle among circles, a
// rectangle among the four-equal-sided).
//
// prototypeOnly (perceptual, SPEC §4.2–4.3): on a plate with a turned, stretched or small member, the
// members that stand "nicely" alone are the misconception's answer, and the plate is 'conflict'; a plate
// whose members all stand nicely is 'congruent'. Leaving out another member is 'near', taking a
// non-member too 'other'.
// Hint: what the property is, on a member with its corners marked; for prototypeOnly the turned member:
// "Selv om figuren er drejet, har den stadig tre hjørner."
import type { AnswerValue, Fact, FamilyDef, Prompt, Rng, ShapeId, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hashSeed, makeRng } from '../../rng'
import { hintOf, metaOf, say, tagged, type Entry } from '../number/kit'
import { CORNERS, fourEqualSides, prototypical, rightAngles, type Fig } from './geo'

type Family = 'threeCorners' | 'fourCorners' | 'noCorners' | 'fourEqualSides' | 'rightAngle'

const META = metaOf('sortShapes')
const FAMILY_IDS = META.families.map((f) => f.id as Family)
const INSTANCES = 1000
const CANONICAL = 20

const ALL: readonly Fig[] = (['circle', 'semicircle', 'triangle', 'quadrilateral', 'square', 'rectangle', 'rhombus', 'trapezoid', 'pentagon', 'hexagon', 'octagon'] as ShapeId[])
  // a turned circle looks like the standard one: never both on a plate (variant 1 is left out)
  .flatMap((shape) => [0, 1, 2, 3, 4, 5].filter((v) => !(shape === 'circle' && v === 1)).map((variant) => ({ shape, variant })))

const IS: Readonly<Record<Family, (f: Fig) => boolean>> = {
  threeCorners: (f) => CORNERS[f.shape] === 3,
  fourCorners: (f) => CORNERS[f.shape] === 4,
  noCorners: (f) => CORNERS[f.shape] === 0,
  fourEqualSides,
  rightAngle: rightAngles,
}

/** Non-members a child is most likely to take for members, tried first. */
const NEAR: Readonly<Record<Family, readonly ShapeId[]>> = {
  threeCorners: ['quadrilateral', 'pentagon', 'trapezoid', 'semicircle'],
  fourCorners: ['triangle', 'pentagon', 'hexagon'],
  noCorners: ['semicircle', 'octagon', 'hexagon'],
  fourEqualSides: ['rectangle', 'trapezoid', 'quadrilateral', 'hexagon'],
  rightAngle: ['rhombus', 'trapezoid', 'quadrilateral', 'pentagon'],
}

interface Item extends Fig {
  id: string
}

/** The plate of an instance, the same for one id. */
function plate(family: Family, k: number): Item[] {
  const rng = makeRng(hashSeed(`srt:${family}:${k}`))
  const is = IS[family]
  const members = ALL.filter(is)
  const size = 6 + rng.int(3)
  const memberCount = Math.min(2 + rng.int(3), size - 2)
  const nice = rng.shuffle(members.filter(prototypical))
  const odd = rng.shuffle(members.filter((m) => !prototypical(m)))
  // a plate either keeps to members that stand nicely (congruent) or has one turned, stretched or small
  const conflict = odd.length > 0 && rng.next() < 0.6
  const picked: Fig[] = conflict ? [odd[0]] : []
  // members of different shapes first, then any
  for (const distinct of [true, false]) {
    for (const m of nice) {
      if (picked.length >= memberCount) break
      if (picked.includes(m) || (distinct && picked.some((p) => p.shape === m.shape))) continue
      picked.push(m)
    }
  }
  const near = rng.shuffle(ALL.filter((f) => !is(f) && NEAR[family].includes(f.shape)))
  const far = rng.shuffle(ALL.filter((f) => !is(f) && !NEAR[family].includes(f.shape)))
  const others: Fig[] = []
  for (const distinct of [true, false]) {
    for (const f of [...near, ...far]) {
      if (picked.length + others.length >= size) break
      if (others.includes(f) || (distinct && others.some((o) => o.shape === f.shape))) continue
      others.push(f)
    }
  }
  const ids = rng.shuffle(Array.from({ length: size }, (_, i) => i)).map((i) => `s${i}`)
  return [...picked, ...others].map((f, i) => ({ id: ids[i], ...f }))
}

interface Parsed {
  family: Family
  k: number
  items: Item[]
}

const cache = new Map<string, Parsed>()
/** The instance from its id (also for a fact the round screen rebuilt from its task). */
function parse(f: Pick<Fact, 'id'>): Parsed {
  let hit = cache.get(f.id)
  if (!hit) {
    const [, family, k] = f.id.split(':')
    hit = { family: family as Family, k: Number(k), items: plate(family as Family, Number(k)) }
    if (cache.size > 500) cache.clear()
    cache.set(f.id, hit)
  }
  return hit
}

const join = (ids: readonly string[]): string => [...ids].sort().join('|')
const members = (p: Parsed): Item[] => p.items.filter(IS[p.family])
const answerOf = (p: Parsed): string => join(members(p).map((i) => i.id))
const isConflict = (p: Parsed): boolean => members(p).some((m) => !prototypical(m))

function factOf(family: Family, k: number): Fact {
  const id = `srt:${family}:${k}`
  const p = parse({ id })
  return {
    id,
    skill: 'sortShapes',
    family,
    operands: [],
    answer: answerOf(p),
    rank: FAMILY_IDS.indexOf(family),
  }
}

const FACTS: readonly Fact[] = FAMILY_IDS.flatMap((family) => Array.from({ length: CANONICAL }, (_, k) => factOf(family, k)))

function candidates(f: Fact) {
  const p = parse(f)
  const mine = members(p)
  const answer = answerOf(p)
  const entries: Entry[] = []
  const nicely = mine.filter(prototypical)
  if (isConflict(p) && nicely.length > 0) entries.push([join(nicely.map((i) => i.id)), 'prototypeOnly'])
  for (const m of mine) {
    if (mine.length > 2 && prototypical(m)) entries.push([join(mine.filter((x) => x !== m).map((i) => i.id)), 'near'])
  }
  for (const o of p.items.filter((i) => !IS[p.family](i))) entries.push([join([...mine.map((i) => i.id), o.id]), 'other'])
  return tagged(answer, entries)
}

function hint(f: Fact, tag: string | null) {
  const p = parse(f)
  const mine = members(p)
  const turned = mine.find((m) => !prototypical(m))
  const show = tag === 'prototypeOnly' && turned ? turned : (mine.find(prototypical) ?? mine[0])
  const visual: Prompt = { scene: 'shape', shape: show.shape, variant: show.variant, ...(show.shape === 'circle' ? {} : { mark: p.family === 'fourEqualSides' ? 'sides' as const : 'corners' as const }) }
  if (tag === 'prototypeOnly') return hintOf([say('hint.sortShapes.stillCounts'), say(`hint.sortShapes.${p.family}`), say('hint.sortShapes.lookEach')], visual, 'prototypeOnly')
  return hintOf([say(`hint.sortShapes.${p.family}`), say('hint.sortShapes.lookEach')], visual)
}

function instance(fam: FamilyDef, rng: Rng, avoid: ReadonlySet<string>): Fact {
  const family = fam.id as Family
  for (let i = 0; i < 50; i++) {
    const k = rng.int(INSTANCES)
    if (!avoid.has(`srt:${family}:${k}`)) return factOf(family, k)
  }
  return factOf(family, rng.int(INSTANCES))
}

export default {
  ...META,
  kinds: ['multiSelect'],
  enumerate: () => [...FACTS],
  instance,
  answer: (f: Fact): AnswerValue => answerOf(parse(f)),
  answerType: () => 'set',
  prompt: (f: Fact, _kind: TaskKind, rng: Rng): Prompt => ({ scene: 'shapes', items: rng.shuffle(parse(f).items) }),
  optionView: () => 'shape',
  range: () => [0, 1],
  speech: (f: Fact) => [say('frag.tryk_paa'), say(`s.sortShapes.${parse(f).family}`)],
  candidates,
  hint: (f, tag) => hint(f, tag),
  contrast: (f: Fact) => (isConflict(parse(f)) ? 'conflict' : 'congruent'),
} satisfies SkillModule
