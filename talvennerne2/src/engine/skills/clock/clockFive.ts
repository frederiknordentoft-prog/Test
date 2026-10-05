// clockFive — Fem minutter ad gangen (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `fem:`.
//   over       fem:over:<m>       "fem/ti/tyve minutter over H" (:05, :10, :20), H = 1–12            36
//   iHalv      fem:iHalv:<m>      "fem minutter i halv H" (:25)                                       12
//   overHalv   fem:overHalv:<m>   "fem minutter over halv H" (:35)                                    12
//   i          fem:i:<m>          "tyve/ti/fem minutter i H" (:40, :50, :55)                          36
//   halfForm   fem:halfForm:<m>   :20 and :40 said with "halv": "ti minutter i halv H", "ti minutter
//                                 over halv H" (SPEC §10.1, t.half.<m>)                               24
// <m> is the time on the 12-hour dial, 0–719 (12:00 is 0): fem:over:185 is fem minutter over tre, and
// fem:halfForm:200 ti minutter i halv fire. The canonical facts are 20 seeded times per family (all
// twelve in iHalv and overHalv).
// Kinds: choice ("Find uret, der viser klokken fem minutter i halv tre.", three clocks) and clockSet
// (production, step 5: "Stil uret, så klokken er fem minutter i halv tre.").
// Wrong clocks (t is the answer, ref the whole or half hour the phrase counts from, H the hour named):
//   quarterDirection  "over" and "i" swapped, mirrored in ref: fem minutter over tre set as fem minutter
//                     i tre (SPEC §4.2: clockQuarter and clockFive)
//   halfPastNext      the "halv" forms: t + 60, "halv tre" taken as 3:30          concept, animated hint
//   hourHandMisread   past the half hour: t − 60, the short hand near H read as H (2:50 found as 1:50)
//   handsSwapped      the long and the short hand swapped (kit swappedHands): a card, and on the dial
//                     only where it falls on five minutes (candidatesFor)
//   operand           H:00, the hour heard
//   near              t ± 5
// No two misconceptions share a clock here, and none is H:00, so A9 never has to step in (tagged() would).
import type { Fact, FamilyDef, HintSpec, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say } from '../number/kit'
import { canonical, drawAvoiding, familyRank } from '../place/kit'
import {
  clockAt, clockCandidates, clockCandidatesFor, clockMove, clockPrompt, clockQuestion, clockSays, halfIsBefore, hourNum, hourOf, notYetAt, swappedHands,
} from './kit'

const meta = metaOf('clockFive')

/** Minutes past the hour per family. */
const PAST: Readonly<Record<string, readonly number[]>> = { over: [5, 10, 20], iHalv: [25], overHalv: [35], i: [40, 50, 55], halfForm: [20, 40] }

const make = (family: string, t: number): Fact => ({
  id: `fem:${family}:${t}`, skill: 'clockFive', family, operands: [t], answer: t, rank: familyRank(meta.families, family),
})
const draw = (family: string, rng: Rng): Fact => make(family, rng.int(12) * 60 + rng.pick(PAST[family]))

const FACTS: readonly Fact[] = meta.families.flatMap(({ id }) =>
  canonical('clockFive', id, (rng) => draw(id, rng), PAST[id].length > 1 ? undefined : Array.from({ length: 12 }, (_, h) => make(id, h * 60 + PAST[id][0]))))

/** The time, its family and what the phrase counts from: the whole hour (over, i) or the half hour (halv). */
function parse(f: Pick<Fact, 'id'>) {
  const [, family, m] = f.id.split(':')
  const t = Number(m)
  const past = t % 60
  const halv = family !== 'over' && family !== 'i'
  const ref = halv ? t - past + 30 : past > 30 ? t - past + 60 : t - past
  return { family, t, ref, halv, style: family === 'halfForm' ? 'analogHalfForm' as const : undefined }
}

function candidates(f: Fact) {
  const { t, ref, halv } = parse(f)
  return clockCandidates(t, [
    [2 * ref - t, 'quarterDirection'],
    [halv ? t + 60 : null, 'halfPastNext'],
    [t % 60 > 30 ? t - 60 : null, 'hourHandMisread'],
    [swappedHands(t), 'handsSwapped'],
    [halv ? ref + 30 : ref, 'operand'],
    [t + 5, 'near'],
    [t - 5, 'near'],
  ])
}

/**
 * "Fem minutter over tre er fem minutter efter tre. Den lange viser peger på et." · "Fem minutter i halv
 * tre er fem minutter før halv tre. Den lange viser peger på fem." The picture is the minute hand sweeping
 * from the hour (or the half hour) to the time, or the clock itself when the phrase counts back.
 */
function hint(f: Fact, tag: string | null): HintSpec {
  const { t, ref, halv, style } = parse(f)
  const after = t > ref
  const standard: SpeechPart[] = [
    clockSays(t, 'mid', style), say('hint.clock5.is'), num(Math.abs(t - ref), 'mid'), say(after ? 'hint.clock5.minAfter' : 'hint.clock5.minBefore'),
    halv ? clockSays(ref, 'end') : hourNum(hourOf(ref), 'end'), say('hint.clock5.longAt'), hourNum((t % 60) / 5, 'end'),
  ]
  const visual = after ? clockMove(ref, t) : clockAt(t, 5)
  switch (tag) {
    case 'quarterDirection':
      return hintOf([say('hint.clock5.overAndTo'), ...standard], visual, tag)
    case 'halfPastNext':
      return hintOf([...halfIsBefore(hourOf(t + 60)), ...standard], clockMove(t - (t % 60), t), tag, true)
    case 'hourHandMisread':
      return hintOf(notYetAt(t, style), visual, tag)
    case 'handsSwapped':
      return hintOf([say('hint.clock.handsRoles'), ...standard], visual, tag)
    default:
      return hintOf(standard, visual)
  }
}

export default {
  ...meta,
  kinds: ['choice', 'clockSet'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id, rng), avoid),
  answerType: () => 'minutes',
  prompt: (_f: Fact, kind: TaskKind) => clockPrompt(kind, 5),
  optionView: () => 'clock',
  range: () => [0, 719],
  speech: (f: Fact, kind: TaskKind) => clockQuestion(parse(f).t, kind, parse(f).style),
  candidates,
  candidatesFor: (f: Fact, kind: TaskKind) => clockCandidatesFor(candidates(f), kind, 5),
  hint: (f, tag) => hint(f, tag),
  fastMs: (_f: Fact, kind: TaskKind) => (kind === 'choice' ? 8_000 : 18_000),
} satisfies SkillModule
