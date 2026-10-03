// clockHalf — Halve timer (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 12 facts, prefix `halv:`.
//   half   halv:<m>   "halv H" for H = 1–12 is half past the hour BEFORE H: halv tre is 2:30
//                     (halv:150), halv et is 12:30 (halv:30)                                    12
// Kinds: choice ("Find uret, der viser klokken halv tre.", three clocks) and clockSet (production,
// step 30: the minute hand snaps to twelve and six).
// Wrong clocks (t is the answer, H the named hour):
//   halfPastNext     t + 60    halv tre set as 3:30 ("tre og en halv")             concept, animated hint
//   hourHandMisread  t − 60    1:30: its short hand, midway to two, read as the next number (two)
//   handsSwapped     ≈ 6:13    the long hand midway between two and three, the short one on six
//                              (left out where the swap looks like the answer: halv seks, halv syv;
//                              cards only: the dial's half-hour step cannot set it, so candidatesFor
//                              leaves it out of clockSet)
//   operand          H:00      the number heard ("tre") as a whole hour
//   near             t − 30    the hour before (2:00)
// None of them coincide (A9 never has to step in): t ± 60 are half hours, the swap is never on a
// half or whole hour, H:00 is a whole hour.
import type { Fact, HintSpec, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, say } from '../number/kit'
import { HOUR_ORDER, clockCandidates, clockCandidatesFor, clockMove, clockPrompt, clockQuestion, clockSays, dial, hourAt, hourNum, prevHour, swappedHands } from './kit'

const meta = metaOf('clockHalf')

/** The dial position of "halv H": half past the hour before H. */
const halfTo = (h: number): number => dial(hourAt(h) - 30)
/** The hour a fact names (halv:150 → 3). */
const namedHour = (f: Fact): number => Math.floor(dial(Number(f.answer) + 30) / 60) || 12

const FACTS: readonly Fact[] = HOUR_ORDER.map((h, rank) => ({
  id: `halv:${halfTo(h)}`,
  skill: 'clockHalf' as const,
  family: 'half',
  operands: [h],
  answer: halfTo(h),
  rank,
}))

function candidates(f: Fact) {
  const t = Number(f.answer)
  return clockCandidates(t, [
    [t + 60, 'halfPastNext'],
    [t - 60, 'hourHandMisread'],
    [swappedHands(t), 'handsSwapped'],
    [t + 30, 'operand'],
    [t - 30, 'near'],
  ])
}

/** "… midt mellem to og tre." */
const between = (h: number): SpeechPart[] => [hourNum(prevHour(h), 'mid'), say('op.og'), hourNum(h, 'end')]

function hint(f: Fact, tag: string | null): HintSpec {
  const t = Number(f.answer)
  const h = namedHour(f)
  // the minute hand sweeps from the whole hour to the half: halvvejs hen mod H
  const visual = clockMove(t - 30, t)
  const standard = [clockSays(t, 'mid'), say('hint.clock.halfMeans'), hourNum(h, 'end'), say('hint.clock.longAtSixSmallBetween'), ...between(h)]
  switch (tag) {
    case 'halfPastNext':
      // "Halv tre er en halv time før tre. Den lille viser står midt mellem to og tre."
      return hintOf([clockSays(t, 'mid'), say('hint.clock.halfBefore'), hourNum(h, 'end'), say('hint.clock.smallBetween'), ...between(h)], visual, 'halfPastNext', true)
    case 'hourHandMisread':
      // "Se godt på den lille viser. Ved halv tre står den midt mellem to og tre."
      return hintOf([say('hint.clock.lookSmall'), say('hint.clock.at'), clockSays(t, 'mid'), say('hint.clock.itStandsBetween'), ...between(h)], visual, 'hourHandMisread')
    case 'handsSwapped':
      return hintOf([say('hint.clock.handsRoles'), ...standard], visual, 'handsSwapped')
    default:
      return hintOf(standard, visual)
  }
}

export default {
  ...meta,
  kinds: ['choice', 'clockSet'],
  enumerate: () => [...FACTS],
  answerType: () => 'minutes',
  prompt: (_f: Fact, kind: TaskKind) => clockPrompt(kind, 30),
  optionView: () => 'clock',
  range: () => [0, 719],
  speech: (f: Fact, kind: TaskKind) => clockQuestion(Number(f.answer), kind),
  candidates,
  candidatesFor: (f: Fact, kind: TaskKind) => clockCandidatesFor(candidates(f), kind, 30),
  hint: (f, tag) => hint(f, tag),
} satisfies SkillModule
