// div2510 — Division med 2, 5 og 10 (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 30 facts `div:<c>/<d>`
// (CONVENTIONS; shared with divAll, whose divisors are the others): c = d · q for d = 2, 5, 10 and
// q = 1–10, families d2, d5, d10, ranked by divisor, then by q.
// The question: "Hvad er tyve divideret med fem?" over 20 : 5 = □ — from 3. klasse ":" is read "divideret
// med" (SPEC A19, speech/equation.ts), and the first division hint bridges it to the "delt med" of
// 2. klasse.
// Kinds: choice, keypad (production), share — the child deals c things out on d plates (the share view
// takes the equation as its deal, ui/task/share/logic.ts); in div2510 the deal is not production (SPEC §3.3:
// share is production only in shareEqually and fractionOfSet). Only a pile of at most 20 is dealt
// (kindsFor; pædagogik §1.3: "share (c ≤ 20)"): 16 of the 30 facts. A bigger one is asked on the cards and
// the keys, so no share task ever reaches the view with more than it deals (40, MAX_THINGS) and is shown
// as keys while it counts as a deal (ORK3a). Range 0–100. Speed: share 3 s + 0.8 s per thing, as for a
// deal of the share scene (kinds.ts); cards and keypad as kinds.ts says.
// Wrong answers (pædagogik §3.2): tableNeighbour — the quotient ± 1 while it is a fact of the table (q = 1–10);
// wrongOperation — c − d or c · d (another operation on the two numbers; ":" read as "·"); the numbers from
// the question ('operand') and near misses (± 2). A value with two explanations is 'ambiguous' (A9:
// 10 : 5 → 5 is c − d and the 5 of the question; 6 : 2 → 4 is q + 1 and c − d). The share view hands in the
// share or −1 ('shareUnequal') and nothing else, so the share kind has no candidates (candidatesFor).
// Hint (every one opens with the bridge, SPEC A19: "Divideret med betyder det samme som delt med."): the
// times table backwards over the array of q rows of d — "Hvad gange fem giver tyve? Fire gange fem giver
// tyve. Så giver tyve divideret med fem fire." tableNeighbour checks the answer by multiplying ("Prøv at
// gange dit svar med fem. Det skal give tyve.", animated, SPEC §4.3); wrongOperation says what dividing is
// ("Vi deler i lige store dele."). On the share view, and after an uneven deal, the dealing of 2. klasse
// with "divideret med": "Læg en på hver tallerken ad gangen, rundt og rundt, til der ikke er flere. På hver
// tallerken ligger der nu fire. Tolv divideret med tre giver fire." over d plates of q (a pile asked on the
// keypad gets the times table instead).
import type { Candidate, ErrorTag, Fact, HintSpec, SkillModule, SpeechPart, TaskKind } from '../types'
import { hintOf, metaOf, num, say } from '../number/kit'
import { equationSpeech } from '../../../speech/equation'
import {
  checkByTimes, divisionArray, divisionCandidates, divisionFacts, divisionOf, divisionStrategy, divisionTerms, soDivided, timesSays,
} from './tables'

const FACTS: readonly Fact[] = divisionFacts('div2510', [2, 5, 10])

const BRIDGE: SpeechPart = say('hint.div2510.bridge')

/** The share view deals at most this many things (ui/task/share/logic.ts MAX_THINGS); a bigger pile is typed. */
const DEALT_MAX = 40

/** The biggest pile asked on the share view (pædagogik §1.3: share for c ≤ 20); dealing more is a chore. */
const SHARE_MAX = 20
const KINDS: TaskKind[] = ['choice', 'keypad', 'share']
const UNDEALT: readonly TaskKind[] = ['choice', 'keypad']

/** The share view hands in the share or −1 ('shareUnequal', SPEC §3.2): no wrong number to tag. */
const candidatesFor = (f: Fact, kind: TaskKind): Candidate[] => (kind === 'share' ? [] : candidates(f))

function candidates(f: Fact): Candidate[] {
  const { c, d } = divisionOf(f)
  return divisionCandidates(c, d)
}

/** Dealing on plates, as in shareEqually, said with "divideret med". */
function dealing(c: number, d: number): SpeechPart[] {
  return [
    say('hint.shareEqually.oneEach'), say('hint.shareEqually.eachGets'), num(c / d),
    num(c, 'mid'), say('op.divideret_med'), num(d, 'mid'), say('op.giver'), num(c / d),
  ]
}

function hint(f: Fact, tag: ErrorTag | null, kind?: TaskKind): HintSpec {
  const { c, d, q } = divisionOf(f)
  if ((kind === 'share' && c <= DEALT_MAX) || tag === 'shareUnequal') {
    const plates = { scene: 'groups', groups: d, size: q, thing: 'carrot' } as const
    const lead = tag === 'shareUnequal' ? [say('hint.shareEqually.sameForAll')] : []
    return hintOf([BRIDGE, ...lead, ...dealing(c, d)], plates)
  }
  const visual = divisionArray(c, d)
  if (tag === 'tableNeighbour') {
    return hintOf([BRIDGE, ...checkByTimes(c, d), ...timesSays(q, d), ...soDivided(c, d)], visual, 'tableNeighbour', true)
  }
  if (tag === 'wrongOperation') return hintOf([BRIDGE, say('hint.div.equalParts'), ...divisionStrategy(c, d)], visual, 'wrongOperation')
  return hintOf([BRIDGE, ...divisionStrategy(c, d)], visual)
}

export default {
  ...metaOf('div2510'),
  kinds: KINDS,
  kindsFor: (f: Fact) => (divisionOf(f).c <= SHARE_MAX ? KINDS : UNDEALT),
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => {
    const { c, d } = divisionOf(f)
    return { scene: 'equation', terms: divisionTerms(c, d) }
  },
  optionView: () => 'numeral',
  range: () => [0, 100],
  speech: (f) => {
    const { c, d } = divisionOf(f)
    return equationSpeech(divisionTerms(c, d))
  },
  candidates,
  candidatesFor,
  hint,
  // the share view deals the whole pile: as long as a deal of the share scene takes (kinds.ts)
  fastMs: (f: Fact, kind: TaskKind) => (kind === 'share' ? 3_000 + 800 * divisionOf(f).c : undefined),
} satisfies SkillModule
