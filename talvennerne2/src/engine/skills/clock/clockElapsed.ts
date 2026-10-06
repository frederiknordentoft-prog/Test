// clockElapsed — Tid der går (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `tid:`.
//   plusHour      tid:plusHour:<s>      "Hvad er klokken om en time?"                 48
//   plusHalf      tid:plusHalf:<s>      "… om en halv time?"                          48
//   plusQuarter   tid:plusQuarter:<s>   "… om et kvarter?"                            48
//   minusHalf     tid:minusHalf:<s>     "Hvad var klokken for en halv time siden?"    48
// <s> is the start, a quarter hour on the 12-hour dial (0–705): tid:plusHalf:195 starts at kvart over tre
// and asks for kvart i fire (225).
// Prompt: the start clock, { scene: 'clock', minutes: s, step: 15 }, and the start said: "Klokken er kvart
// over tre. Hvad er klokken om en halv time?" Kinds: choice (three clocks) and clockSet (production, step
// 15: "… Stil uret, så det viser, hvad klokken er om en halv time."). The dial starts on the start clock
// (dialStart), so the child turns the long hand by the time span, the hint's own strategy; a tick without
// moving the hands is the start clock, 'operand'.
// Wrong clocks (a is the answer, d the time asked for):
//   wrongOperation   s − d: the hands turned the other way ("om" for "for … siden"). Left out for a half hour
//                    across the hour (3:45 + ½ h → 3:15), where the same clock is the hour forgotten
//   halfPastNext     a start on "halv": a + 60, halv tre taken as 3:30              concept, animated hint
//                    (minusHalf from halv tre: the same clock as wrongOperation, so 'ambiguous')
//   operand          s, the clock not moved
//   near             a ± 15, a ± 60, and the hour not changed across the hour (a ∓ 60)
import type { Fact, FamilyDef, HintSpec, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, say } from '../number/kit'
import { canonical, drawAvoiding, familyRank } from '../place/kit'
import { clockCandidates, clockMove, clockSays, dial, halfIsBefore, hourOf } from './kit'

const meta = metaOf('clockElapsed')

/** Minutes the hands move per family. */
const D: Readonly<Record<string, number>> = { plusHour: 60, plusHalf: 30, plusQuarter: 15, minusHalf: -30 }

const make = (family: string, s: number): Fact => ({
  id: `tid:${family}:${s}`, skill: 'clockElapsed', family, operands: [s], answer: dial(s + D[family]), rank: familyRank(meta.families, family),
})
const draw = (family: string, rng: Rng): Fact => make(family, 15 * rng.int(48))

const FACTS: readonly Fact[] = meta.families.flatMap(({ id }) => canonical('clockElapsed', id, (rng) => draw(id, rng)))

function parse(f: Pick<Fact, 'id'>) {
  const [, family, start] = f.id.split(':')
  const s = Number(start)
  const d = D[family]
  return { family, s, d, a: dial(s + d), across: Math.floor(((s % 60) + d) / 60) !== 0 }
}

function candidates(f: Fact) {
  const { s, d, a, across } = parse(f)
  return clockCandidates(a, [
    [across && Math.abs(d) === 30 ? null : s - d, 'wrongOperation'],
    [s % 60 === 30 ? a + 60 : null, 'halfPastNext'],
    [s, 'operand'],
    [across ? a - Math.sign(d) * 60 : null, 'near'],
    [a + 15, 'near'],
    [a - 15, 'near'],
    [a + 60, 'near'],
    [a - 60, 'near'],
  ])
}

/**
 * "En halv time efter kvart over tre er klokken kvart i fire. Den lange viser går en halv gang rundt." The
 * picture is the minute hand's sweep from the start (back from it for minusHalf).
 */
function hint(f: Fact, tag: string | null): HintSpec {
  const { family, s, d, a } = parse(f)
  const standard: SpeechPart[] = [
    say(`hint.clockElapsed.d.${family}`), clockSays(s, 'mid'), say(d < 0 ? 'hint.clockElapsed.was' : 'hint.clockElapsed.is'), clockSays(a, 'end'),
    say(`hint.clockElapsed.hand.${family}`),
  ]
  const visual = d < 0 ? clockMove(a, s) : clockMove(s, a)
  if (tag === 'wrongOperation') return hintOf([say(d < 0 ? 'hint.clockElapsed.earlier' : 'hint.clockElapsed.later'), ...standard], visual, tag)
  if (tag === 'halfPastNext') return hintOf([...halfIsBefore(hourOf(s + 60)), ...standard], visual, tag, true)
  return hintOf(standard, visual)
}

export default {
  ...meta,
  kinds: ['choice', 'clockSet'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id, rng), avoid),
  // read back from the id, which holds the start (a fact rebuilt from a task has only its id)
  answer: (f: Fact) => parse(f).a,
  answerType: () => 'minutes',
  prompt: (f: Fact) => ({ scene: 'clock', minutes: parse(f).s, step: 15 }),
  // the dial starts where the time starts: never the answer, never a misconception's clock (validateSkill)
  dialStart: (f: Fact) => parse(f).s,
  optionView: () => 'clock',
  range: () => [0, 719],
  speech: (f: Fact, kind: TaskKind) => [
    say('frag.klokken_er'), clockSays(parse(f).s, 'end'), say(`s.clockElapsed.${kind === 'clockSet' ? 'set' : 'ask'}.${parse(f).family}`),
  ],
  candidates,
  hint: (f, tag) => hint(f, tag),
  fastMs: (_f: Fact, kind: TaskKind) => (kind === 'choice' ? 10_000 : 20_000),
} satisfies SkillModule
