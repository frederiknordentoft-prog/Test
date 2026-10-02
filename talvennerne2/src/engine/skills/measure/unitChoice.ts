// unitChoice — Vælg den rigtige enhed (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 24 facts `enh:<family>:<thing>`.
//   length   enh:length:<thing>   centimeter or meter: 8 small things (en blyant) and 8 big ones (en bus)   16
//   weight   enh:weight:<thing>   gram or kilogram: 4 light things (en fjer) and 4 heavy ones (en hund)  8 (3. kl.)
// choice: "Hvad måler man længden af en bus i?" ("… vægten af en hund i?") — the thing is named, the
// prompt is the loudspeaker ({ scene: 'hear' }); three unit cards `unit:<u>` with pictograms, read
// aloud (optionView 'unitWord'): the right unit, the other unit of the same kind (near) and a unit of
// the other kind (other: kilogram for a length).
// multiSelect (production): "Tryk på alle de ting, man måler i meter." — six word cards `mt:<thing>`
// read aloud (optionView 'token', clips `noun.mt.<thing>`): this fact's thing, one or two more with the
// same unit and the rest with the other unit of the family. The answer is the set of the same unit.
// SPEC §4.2 has no misconception for units. The cards are spoken because there are no pictures of a
// bus or a house yet (proposed for the materials library); the things are ones every child knows.
import type { AnswerValue, Fact, HintSpec, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, say, tagged } from '../number/kit'
import { rngFor } from '../place/kit'
import { UNIT_THINGS as THINGS, type UnitFamily as Family, type ThingUnit as Unit } from './kit2'

const meta = metaOf('unitChoice')

const PAIR: Readonly<Record<Family, readonly [Unit, Unit]>> = { length: ['cm', 'm'], weight: ['g', 'kg'] }
const OTHER: Readonly<Record<Family, readonly [Unit, Unit]>> = { length: ['g', 'kg'], weight: ['cm', 'm'] }

interface Ask {
  family: Family
  thing: string
  unit: Unit
}

function parse(id: string): Ask {
  const [, family, thing] = id.split(':')
  const fam = family as Family
  return { family: fam, thing, unit: THINGS[fam][thing][0] }
}

const unitToken = (u: Unit) => `unit:${u}`
const thingToken = (thing: string) => `mt:${thing}`

const FACTS: readonly Fact[] = (['length', 'weight'] as const).flatMap((family) =>
  Object.keys(THINGS[family]).map((thing) => {
    const unit = THINGS[family][thing][0]
    const second = unit === PAIR[family][1]
    const place = Object.keys(THINGS[family]).filter((t) => THINGS[family][t][0] === unit).indexOf(thing)
    return {
      id: `enh:${family}:${thing}`,
      skill: 'unitChoice' as const,
      family,
      operands: [],
      answer: unitToken(unit),
      // small and big things alternate, so the first new keys ask for both units
      rank: (family === 'length' ? 0 : 100) + place * 2 + (second ? 1 : 0),
    }
  }),
)

/** The six things of a multiSelect: this one, one or two more with its unit, the rest with the other unit. */
function sixOf(a: Ask): { same: string[]; other: string[] } {
  const rng = rngFor(`enh:${a.family}:${a.thing}`)
  const all = Object.keys(THINGS[a.family])
  const same = all.filter((t) => t !== a.thing && THINGS[a.family][t][0] === a.unit)
  const other = all.filter((t) => THINGS[a.family][t][0] !== a.unit)
  const k = rng.pick([1, 2])
  return { same: [a.thing, ...rng.shuffle(same).slice(0, k)], other: rng.shuffle(other).slice(0, 5 - k) }
}

const setOf = (things: readonly string[]) => things.map(thingToken).sort().join('|')

function candidates(f: Fact) {
  const a = parse(f.id)
  const [u1, u2] = PAIR[a.family]
  return tagged(f.answer, [
    [unitToken(a.unit === u1 ? u2 : u1), 'near'],
    ...OTHER[a.family].map((u) => [unitToken(u), 'other'] as const),
  ])
}

const QUESTION: Readonly<Record<Unit, string>> = {
  cm: 's.unitChoice.tapCm', m: 's.unitChoice.tapM', g: 's.unitChoice.tapG', kg: 's.unitChoice.tapKg',
}

/**
 * "Små ting måler vi i centimeter, og store ting måler vi i meter. En bus måler man i meter." A unit of
 * the other kind first: "Centimeter og meter bruger vi til at måle, hvor langt noget er."
 */
function hint(f: Fact, tag: string | null, kind?: TaskKind): HintSpec {
  const a = parse(f.id)
  const length = a.family === 'length'
  const rule = say(length ? 'hint.unitChoice.lengthRule' : 'hint.unitChoice.weightRule')
  const things = kind === 'multiSelect' ? sixOf(a).same : [a.thing]
  const says: SpeechPart[] = things.flatMap((t) => [
    say(`noun.mt.${t}`),
    say(length ? 'hint.unitChoice.measuredIn' : 'hint.unitChoice.weighedIn'),
    say(`noun.unit.${a.unit}.end`),
  ])
  const lead = tag === 'other' ? [say(length ? 'hint.unitChoice.lengthUnits' : 'hint.unitChoice.weightUnits')] : []
  return hintOf([...lead, rule, ...says], { scene: 'none' })
}

export default {
  ...meta,
  kinds: ['choice', 'multiSelect'],
  enumerate: () => [...FACTS],
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'multiSelect' ? setOf(sixOf(parse(f.id)).same) : unitToken(parse(f.id).unit)),
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'multiSelect' ? 'set' : 'token'),
  answerType: () => 'token',
  options: (f: Fact, kind: TaskKind, rng: Rng) => {
    if (kind !== 'multiSelect') return []
    const { same, other } = sixOf(parse(f.id))
    return rng.shuffle([...same, ...other].map(thingToken))
  },
  prompt: () => ({ scene: 'hear' }),
  optionView: (_f: Fact, kind: TaskKind) => (kind === 'multiSelect' ? 'token' : 'unitWord'),
  optionClip: (_f: Fact, v: AnswerValue) => (String(v).startsWith('unit:') ? `noun.unit.${String(v).slice(5)}.end` : `noun.mt.${String(v).slice(3)}`),
  range: () => [0, 1],
  speech: (f: Fact, kind: TaskKind) => {
    const a = parse(f.id)
    return [say(kind === 'multiSelect' ? QUESTION[a.unit] : `s.unitChoice.q.${a.thing}`)]
  },
  candidates,
  hint: (f: Fact, tag, kind) => hint(f, tag, kind),
} satisfies SkillModule
