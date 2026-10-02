// rulerRead — Aflæs en lineal (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `lin:`.
//   from0    lin:from0:0+<len>:<thing>         the thing starts at 0, len 2–15                 (1. kl.)
//   offset   lin:offset:<start>+<len>:<thing>  it starts at 1–5, len 2–12, ends at 17 at most  (2. kl.)
// <thing> is one of the long things (kit2.ts LONG_THINGS); the id carries the whole instance.
// Prompt { scene: 'ruler', object, startCm, lengthCm } (a 15 cm ruler, 20 cm when the thing reaches past 15).
// "Hvor mange centimeter lang er tingen?" Kinds: choice (numbers) and keypad (production, suffix cm),
// range 0–20. (`draw`, a length to draw, is rulerDraw's and not built in v2.0, SPEC D9.)
// Wrong answers:
//   rulerEnd   offset only (SPEC §4.2): the mark where the thing ends (2 → 9 read as 9), or the marks
//              counted instead of the spaces between them (len + 1, 8)
//   operand    offset: the mark where the thing starts
//   near       len ± 1 (from0: len + 1 is the marks counted, but with the thing at 0 it cannot be told
//              apart from a slip), other: len ± 2
// A9: when the marks counted (len + 1) is also the start mark (start 5, len 4), the child may just have
// read the start: that value is 'ambiguous' and never evidence.
// Hints count the centimetres from start to end on a number line; rulerEnd moves the thing to 0.
import type { Fact, FamilyDef, HintSpec, Prompt, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, walk, type Entry } from '../number/kit'
import { canonical, drawAvoiding, familyRank } from '../place/kit'
import { LONG_THINGS, between, measureSays, type LongThing } from './kit2'

const meta = metaOf('rulerRead')

type Family = 'from0' | 'offset'

interface Lay {
  family: Family
  start: number
  len: number
  thing: LongThing
}

const idOf = (l: Lay) => `lin:${l.family}:${l.start}+${l.len}:${l.thing}`

function parse(id: string): Lay {
  const [, family, span, thing] = id.split(':')
  const [start, len] = span.split('+').map(Number)
  return { family: family as Family, start, len, thing: thing as LongThing }
}

const make = (l: Lay): Fact => ({
  id: idOf(l),
  skill: 'rulerRead',
  family: l.family,
  operands: [l.start, l.len],
  answer: l.len,
  rank: familyRank(meta.families, l.family),
})

/** Every offset lay: start 1–5, length 2–12, the end at 17 at most (a 20 cm ruler). */
const OFFSETS: readonly (readonly [number, number])[] = between(1, 5).flatMap((s) => between(2, 12).filter((n) => s + n <= 17).map((n) => [s, n] as const))

function draw(family: Family, rng: Rng): Fact {
  const thing = rng.pick(LONG_THINGS)
  if (family === 'from0') return make({ family, start: 0, len: rng.between(2, 15), thing })
  const [start, len] = rng.pick(OFFSETS)
  return make({ family, start, len, thing })
}

const FACTS: readonly Fact[] = meta.families.flatMap((fam) => canonical('rulerRead', fam.id, (rng) => draw(fam.id as Family, rng)))

const RANGE: [number, number] = [0, 20]
const scene = (l: Lay, start = l.start): Prompt => ({ scene: 'ruler', object: l.thing, startCm: start, lengthCm: l.len })

function candidates(f: Fact) {
  const l = parse(f.id)
  const end = l.start + l.len
  const offset = l.family === 'offset'
  const entries: Entry[] = [
    ...(offset ? [[end, 'rulerEnd'] as const, [l.len + 1, 'rulerEnd'] as const, [l.start, 'operand'] as const] : []),
    [l.len + 1, 'near'],
    [l.len - 1, 'near'],
    [l.len + 2, 'other'],
    [l.len - 2, 'other'],
  ]
  // a zero card says nothing about reading a ruler
  return tagged(l.len, entries.filter(([v]) => typeof v === 'number' && v > 0 && v <= RANGE[1]))
}

/**
 * from0: "Tingen starter ved nul. Den slutter ved syv. Så er den syv centimeter lang."
 * offset: "Tingen starter ved to. Den starter ikke ved nul. Tæl centimeterne fra to til ni. Så er den
 * syv centimeter lang." — on a number line with a hop for every centimetre.
 */
function hint(f: Fact, tag: string | null): HintSpec {
  const l = parse(f.id)
  const end = l.start + l.len
  const length: SpeechPart[] = [say('hint.rulerRead.soItIs'), measureSays(l.len, 'cm', 'mid'), say('hint.rulerRead.long')]
  const standard: SpeechPart[] =
    l.start === 0
      ? [say('hint.rulerRead.startsAtZero'), say('hint.rulerRead.endsAt'), num(end, 'end'), ...length]
      : [
          say('hint.rulerRead.startsAt'), num(l.start, 'end'), say('hint.rulerRead.notAtZero'),
          say('hint.rulerRead.countFrom'), num(l.start, 'mid'), say('hint.rulerRead.to'), num(end, 'end'), ...length,
        ]
  const hops: Prompt = { scene: 'line', min: 0, max: end > 15 ? 20 : 15, hops: walk(l.start, end) }
  if (tag === 'rulerEnd') return hintOf([say('hint.rulerRead.endIsNotLength'), ...standard], scene(l, 0), 'rulerEnd')
  if (tag === 'operand') return hintOf([say('hint.rulerRead.startIsNotLength'), ...standard], hops)
  if (tag === 'near') return hintOf([say('hint.rulerRead.countSpaces'), ...standard], hops)
  return hintOf(standard, hops)
}

export default {
  ...meta,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id as Family, rng), avoid),
  // read back from the id (a fact rebuilt from a task has only its id)
  answer: (f: Fact) => parse(f.id).len,
  answerType: () => 'int',
  prompt: (f: Fact) => scene(parse(f.id)),
  optionView: () => 'numeral',
  range: () => RANGE,
  speech: () => [say('s.rulerRead.howLong')],
  candidates,
  hint: (f: Fact, tag) => hint(f, tag),
  unit: (_f: Fact, kind: TaskKind) => (kind === 'keypad' ? 'cm' : null),
} satisfies SkillModule
