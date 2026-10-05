// clockDigital — Digitalt ur og 24 timer (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `dig:`.
//   analogToDigital  dig:analogToDigital:<m>  a time on the 12-hour dial in five-minute steps, m = 0–715  144
//   digital24        dig:digital24:<m>        an afternoon or evening time, 13:00–23:55, m = 780–1435   132
// <m> is minutes after midnight on the clock it is read from: dig:analogToDigital:165 is 2:45 (and 14:45
// is the same analog clock), dig:digital24:885 is 14:45.
// Kinds and prompts:
//   choice    analogToDigital: the analog clock, "Find det digitale ur, der viser det samme." Three 12-hour
//             digital clocks (optionView 'clockDigital', modulo 720).
//             digital24: the analog clock and the time of day said, "Klokken er kvart i tre om
//             eftermiddagen. Find det digitale ur, …" Three 24-hour digital clocks (modulo 1440).
//   clockSet  (production, step 5) the digital clock (12 or 24 hours) read aloud, "Det digitale ur viser
//             fjorten femogfyrre. Stil uret, så det viser det samme." The dial compares modulo 720, so
//             2:45 set for 14:45 is right (CONVENTIONS).
// Wrong clocks (t is the answer, h:mm its 12-hour reading), per presentation (candidatesFor):
//   hourHandMisread  mm ≥ 30: reading the analog clock t + 60 (2:45 read as 3:45), setting it t − 60
//                    (the short hand put on 2 for 2:45 gives 1:45 on a geared dial)
//   handsSwapped     reading: the long hand taken for the hours (kit swappedHands, a card); setting: the
//                    long hand put on h and the short one on mm/5 (2:45 → 9:10)
//   halfPastNext     digital24 cards, where the time said has "halv": t + 60 (halv tre taken as 3:30)
//   operand          digital24 cards: the 12-hour time said (2:45 for 14:45, no hours added)
//   other            the minute hand's number read as minutes (2:45 → 2:09) or the minutes put on that
//                    number (2:10 → 2:50); fourteen taken as four (14:45 → 4:45)
//   near             t ± 5, t ± 60
import type { Fact, FamilyDef, HintSpec, Prompt, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'
import { canonical, drawAvoiding, familyRank } from '../place/kit'
import { dayPartClip } from '../../../speech/clock'
import { clockAt, clockCandidatesFor, clockSays, dial, halfIsBefore, hourNum, hourOf, notYetAt, swappedHands } from './kit'

const meta = metaOf('clockDigital')

const make = (family: string, m: number): Fact => ({
  id: `dig:${family}:${m}`, skill: 'clockDigital', family, operands: [m], answer: m, rank: familyRank(meta.families, family),
})
const draw = (family: string, rng: Rng): Fact => make(family, family === 'digital24' ? 780 + 5 * rng.int(132) : 5 * rng.int(144))

const FACTS: readonly Fact[] = meta.families.flatMap(({ id }) => canonical('clockDigital', id, (rng) => draw(id, rng)))

const timeOf = (f: Pick<Fact, 'id'>): number => Number(f.id.split(':')[2])
const is24 = (f: Pick<Fact, 'id'>): boolean => f.id.startsWith('dig:digital24')

/** The digital time read aloud: "fjorten femogfyrre", "tolv nul fem" (12:05 on a 12-hour clock, not 0:05). */
const digitalSays = (m: number): SpeechPart => ({ clock: { minutes: m < 60 ? m + 720 : m, style: 'digital', form: 'end' } })

/**
 * The wrong times one presentation offers: reading the analog clock onto cards, or setting the dial from
 * the digital clock. The short hand misread is an hour on when the clock is read and an hour back when it
 * is set, so neither list calls the other's misread clock near: candidates() gives every time one tag.
 */
function offered(f: Pick<Fact, 'id'>, kind: TaskKind): Entry[] {
  const t = timeOf(f)
  const mm = t % 60
  const card = kind === 'choice'
  const day = is24(f) && card
  const late = mm >= 30
  const out: Entry[] = []
  // a 24-hour card past midnight is left out: as 0:30 it would be a time on the dial with another meaning
  const at = (v: number | null, tag: Entry[1]) => {
    const n = v === null || v >= 1440 ? null : day ? v : dial(v)
    if (n !== null && n !== (day ? t : dial(t))) out.push([n, tag])
  }
  if (day) {
    at(mm >= 25 && mm <= 35 ? t + 60 : null, 'halfPastNext')
    at(t - 720, 'operand')
  } else if (card) {
    at(swappedHands(t), 'handsSwapped')
    at(t - mm + mm / 5, 'other')
  } else {
    at((mm / 5) * 60 + ((5 * hourOf(t)) % 60), 'handsSwapped')
    if (mm < 12) at(t + 4 * mm, 'other')
  }
  if (late && !day) at(card ? t + 60 : t - 60, 'hourHandMisread')
  if (is24(f)) at(t - 600, 'other')
  for (const d of [5, -5, 60, -60]) if (!(late && !is24(f) && d === (card ? -60 : 60))) at(t + d, 'near')
  return out
}

/** One tag per wrong time, over both presentations (the misconceptions the skill can meet, for hints and plans). */
const candidates = (f: Fact) => tagged(timeOf(f), [...offered(f, 'choice'), ...offered(f, 'clockSet')])

/**
 * analogToDigital: "Den lille viser er gået forbi to. Den lange viser peger på ni, og det er femogfyrre
 * minutter. Det digitale ur viser to femogfyrre." digital24: "Fjorten minus tolv giver to. Så er klokken
 * kvart i tre om eftermiddagen." The picture is the analog clock.
 */
function hint(f: Fact, tag: string | null): HintSpec {
  const t = timeOf(f)
  const mm = t % 60
  const standard: SpeechPart[] = is24(f)
    ? [num(Math.floor(t / 60), 'mid'), say('op.minus'), num(12, 'mid'), say('op.giver'), num(Math.floor(t / 60) - 12, 'end'), say('hint.clockDigital.soItIs'), clockSays(t, 'mid'), say(dayPartClip(t))]
    : [
        say(mm ? 'hint.clockDigital.smallPast' : 'hint.clock.smallPointsAt'), hourNum(hourOf(t), 'end'), say('hint.clock5.longAt'), hourNum(mm / 5 || 12, 'mid'),
        say('hint.clockDigital.thatIs'), num(mm, 'mid'), say('hint.clockDigital.minutes'), say('s.clockDigital.shows'), digitalSays(t),
      ]
  const visual = clockAt(t, 5)
  switch (tag) {
    case 'hourHandMisread':
      return hintOf(notYetAt(t), visual, tag)
    case 'handsSwapped':
      return hintOf([say('hint.clock.handsRoles'), ...standard], visual, tag)
    case 'halfPastNext':
      return hintOf([...halfIsBefore(hourOf(t + 60)), ...standard], visual, tag, true)
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
  // the digital clock says whether it counts 24 hours: 12:30 on a 12-hour clock, never 0:30
  prompt: (f: Fact, kind: TaskKind): Prompt =>
    kind === 'clockSet' ? { scene: 'clock', minutes: timeOf(f), step: 5, digital: true, h24: is24(f) } : { scene: 'clock', minutes: timeOf(f), step: 5 },
  optionView: (_f: Fact, kind: TaskKind) => (kind === 'choice' ? 'clockDigital' : 'clock'),
  range: (f: Fact) => [0, is24(f) ? 1439 : 719],
  speech(f: Fact, kind: TaskKind): SpeechPart[] {
    const t = timeOf(f)
    if (kind === 'clockSet') return [say('s.clockDigital.shows'), digitalSays(t), say('s.clockDigital.setSame')]
    return is24(f) ? [say('frag.klokken_er'), clockSays(t, 'mid'), say(dayPartClip(t)), say('s.clockDigital.findDigital')] : [say('s.clockDigital.findDigital')]
  },
  candidates,
  candidatesFor(f: Fact, kind: TaskKind) {
    const own = new Set(offered(f, kind).map(([v]) => v))
    return clockCandidatesFor(candidates(f).filter((c) => own.has(c.value)), kind, 5)
  },
  hint: (f, tag) => hint(f, tag),
  fastMs: (_f: Fact, kind: TaskKind) => (kind === 'choice' ? 8_000 : 18_000),
} satisfies SkillModule
