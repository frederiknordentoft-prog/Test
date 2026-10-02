// clockHour — Hele timer (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 12 facts, prefix `hel:`.
//   hour   hel:<m>   "klokken H" for H = 1–12, m = minutes on the dial (hel:180 is klokken tre,
//                    hel:0 klokken tolv)                                                        12
// Kinds: choice ("Find uret, der viser klokken tre.", three clocks) and clockSet (production, step 60:
// the minute hand snaps to twelve, so every clock the child can set is a whole hour).
// Wrong clocks: the hands swapped (handsSwapped: 3:00 → 12:15, the long hand on the hour and the
// short hand on twelve; only on cards, since a 60-minute step cannot set it) and the hour before
// and after ('near'). The named hour is the answer itself, so there is no 'operand' clock.
import type { Fact, HintSpec, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, say } from '../number/kit'
import { HOUR_ORDER, clockAt, clockCandidates, clockPrompt, clockQuestion, hourAt, hourNum, swappedHands } from './kit'

const meta = metaOf('clockHour')

/** The hour a fact names (1–12), read back from its dial position. */
const hourOf = (f: Fact): number => Math.floor(Number(f.answer) / 60) || 12

const FACTS: readonly Fact[] = HOUR_ORDER.map((h, rank) => ({
  id: `hel:${hourAt(h)}`,
  skill: 'clockHour' as const,
  family: 'hour',
  operands: [h],
  answer: hourAt(h),
  rank,
}))

function candidates(f: Fact) {
  const t = Number(f.answer)
  return clockCandidates(t, [
    [swappedHands(t), 'handsSwapped'],
    [t + 60, 'near'],
    [t - 60, 'near'],
  ])
}

/** "Ved hele timer peger den lange viser på tolv. Den lille viser peger på tre." */
function hint(f: Fact, tag: string | null): HintSpec {
  const t = Number(f.answer)
  const said = [say('hint.clock.wholeHour'), say('hint.clock.smallPointsAt'), hourNum(hourOf(f), 'end')]
  if (tag === 'handsSwapped') return hintOf([say('hint.clock.handsRoles'), ...said], clockAt(t, 60), 'handsSwapped')
  return hintOf(said, clockAt(t, 60))
}

export default {
  ...meta,
  kinds: ['choice', 'clockSet'],
  enumerate: () => [...FACTS],
  answerType: () => 'minutes',
  prompt: (_f: Fact, kind: TaskKind) => clockPrompt(kind, 60),
  optionView: () => 'clock',
  range: () => [0, 719],
  speech: (f: Fact, kind: TaskKind) => clockQuestion(Number(f.answer), kind),
  candidates,
  hint: (f, tag) => hint(f, tag),
} satisfies SkillModule
