// clockQuarter — Kvarter (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 24 facts, prefix `kvart:`.
//   quarterPast   kvart:<m>   "kvart over H" (H:15) for H = 1–12, kvart over tre is kvart:195     12
//   quarterTo     kvart:<m>   "kvart i H" ((H−1):45) for H = 1–12, kvart i tre is kvart:165       12
// Kinds: choice ("Find uret, der viser klokken kvart i tre.", three clocks) and clockSet (production,
// step 15).
// Wrong clocks (t is the answer, H the named hour):
//   quarterDirection   kvart over and kvart i swapped, the same hour: t − 30 (over) / t + 30 (i)
//   hourHandMisread    kvart i only, t − 60: on the 1:45 clock the short hand is nearly at two and is
//                      read as two (kvart over has its short hand just past the hour: no misread)
//   operand            H:00, the number heard as a whole hour
//   near               halv: H:30 for kvart over, (H−1):30 for kvart i; and the same quarter an hour
//                      later (kvart over: also an hour earlier)
// The values never coincide, so A9 has nothing to settle here. All of them are quarter hours, so the
// dial can set every one (candidatesFor keeps them all on clockSet).
import type { Fact, HintSpec, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, say } from '../number/kit'
import { HOUR_ORDER, clockAt, clockCandidates, clockCandidatesFor, clockMove, clockPrompt, clockQuestion, clockSays, dial, hourAt, hourNum } from './kit'

const meta = metaOf('clockQuarter')

type Family = 'quarterPast' | 'quarterTo'

/** The dial position of "kvart over H" (H:15) and "kvart i H" ((H−1):45). */
const quarterOf = (family: Family, h: number): number => dial(hourAt(h) + (family === 'quarterPast' ? 15 : -15))
const familyOf = (t: number): Family => (dial(t) % 60 === 15 ? 'quarterPast' : 'quarterTo')
/** The hour a fact names: kvart:195 → 3, kvart:165 → 3. */
const namedHour = (t: number): number => Math.floor(dial(t + (familyOf(t) === 'quarterPast' ? -15 : 15)) / 60) || 12

const FACTS: readonly Fact[] = (['quarterPast', 'quarterTo'] as const).flatMap((family, fi) =>
  HOUR_ORDER.map((h, i) => ({
    id: `kvart:${quarterOf(family, h)}`,
    skill: 'clockQuarter' as const,
    family,
    operands: [h],
    answer: quarterOf(family, h),
    rank: fi * 100 + i,
  })),
)

function candidates(f: Fact) {
  const t = Number(f.answer)
  if (familyOf(t) === 'quarterPast') {
    return clockCandidates(t, [
      [t - 30, 'quarterDirection'],
      [t - 15, 'operand'],
      [t + 15, 'near'],
      [t + 60, 'near'],
      [t - 60, 'near'],
    ])
  }
  return clockCandidates(t, [
    [t + 30, 'quarterDirection'],
    [t - 60, 'hourHandMisread'],
    [t + 15, 'operand'],
    [t - 15, 'near'],
    [t + 60, 'near'],
  ])
}

function hint(f: Fact, tag: string | null): HintSpec {
  const t = Number(f.answer)
  const h = namedHour(t)
  const past = familyOf(t) === 'quarterPast'
  // kvart over: the minute hand sweeps the quarter after the hour; kvart i: the clock a quarter before
  const visual = past ? clockMove(t - 15, t) : clockAt(t, 15)
  // "Kvart over tre er et kvarter efter tre. Den lange viser peger på tre, og den lille viser er lige gået forbi tre."
  // "Kvart i tre er et kvarter før tre. Den lange viser peger på ni, og den lille viser er næsten ved tre."
  const standard = past
    ? [clockSays(t, 'mid'), say('hint.clock.quarterAfter'), hourNum(h, 'end'), say('hint.clock.longAtThreeSmallPast'), hourNum(h, 'end')]
    : [clockSays(t, 'mid'), say('hint.clock.quarterBefore'), hourNum(h, 'end'), say('hint.clock.longAtNineSmallAlmost'), hourNum(h, 'end')]
  switch (tag) {
    case 'quarterDirection':
      return hintOf([say('hint.clock.overAndTo'), ...standard], visual, 'quarterDirection')
    case 'hourHandMisread':
      // "Se godt på den lille viser. Ved kvart i tre er den næsten ved tre."
      return hintOf([say('hint.clock.lookSmall'), say('hint.clock.at'), clockSays(t, 'mid'), say('hint.clock.itIsAlmostAt'), hourNum(h, 'end')], visual, 'hourHandMisread')
    default:
      return hintOf(standard, visual)
  }
}

export default {
  ...meta,
  kinds: ['choice', 'clockSet'],
  enumerate: () => [...FACTS],
  answerType: () => 'minutes',
  prompt: (_f: Fact, kind: TaskKind) => clockPrompt(kind, 15),
  optionView: () => 'clock',
  range: () => [0, 719],
  speech: (f: Fact, kind: TaskKind) => clockQuestion(Number(f.answer), kind),
  candidates,
  candidatesFor: (f: Fact, kind: TaskKind) => clockCandidatesFor(candidates(f), kind, 15),
  hint: (f, tag) => hint(f, tag),
} satisfies SkillModule
