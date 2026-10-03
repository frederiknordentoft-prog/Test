// shareEqually — Del ligeligt (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 20 facts `shr:<total>:<g>`
// (prefix `shr:`): `total` carrots shared between g = 2–5 animals, q = 1–5 each (total = g · q), one
// family 'share'. Ranked by the number of animals, then by the share.
// The question: "Del tolv gulerødder ligeligt mellem tre dyr. Hvor mange får hvert dyr?" over the pile
// and the animals (Prompt 'share').
// Kinds: share (production — the child deals the carrots out; an uneven deal comes back as −1,
// 'shareUnequal', SPEC §3.2), choice and keypad (production). Until the share view lands, a share task
// is shown on the keypad (src/ui/task/registry.ts moduleFor). Range 0–30.
// Wrong answers: wrongOperation — another operation on the two numbers (12 between 3 → 9 or 15), the
// numbers from the question ('operand') and near misses (±1, ±2). A value with two explanations is
// 'ambiguous' (A9): 6 between 3 → 3 (6 − 3, or the 3 animals). These are the cards' and the keypad's:
// a deal hands in the share or −1 and nothing else, so the share kind has no candidates (candidatesFor)
// and is never an opportunity for wrongOperation.
// Hint: deal one at a time — "Læg en på hver tallerken ad gangen, rundt og rundt, til der ikke er
// flere. På hver tallerken ligger der nu fire. Tolv delt med tre giver fire." with each animal's share
// on its plate (the groups picture shows plates, so the words do too: QA2 P3-6).
import type { Candidate, ErrorTag, Fact, HintSpec, SkillModule, SpeechPart, TaskKind } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'

const FACTS: readonly Fact[] = (() => {
  const out: Fact[] = []
  for (let g = 2; g <= 5; g++) {
    for (let q = 1; q <= 5; q++) {
      out.push({ id: `shr:${g * q}:${g}`, skill: 'shareEqually', family: 'share', operands: [g * q, g], answer: q, rank: (g - 2) * 10 + q })
    }
  }
  return out
})()

/** total and g from the id. */
function parts(f: Pick<Fact, 'id'>): [number, number] {
  const m = /^shr:(\d+):(\d+)$/.exec(f.id)
  if (!m) throw new Error(`not a shareEqually fact: ${f.id}`)
  return [Number(m[1]), Number(m[2])]
}

function candidates(f: Fact): Candidate[] {
  const [total, g] = parts(f)
  const q = total / g
  return tagged(q, [
    [total - g, 'wrongOperation'], [total + g, 'wrongOperation'],
    [total, 'operand'], [g, 'operand'],
    [q + 1, 'near'], [q - 1, 'near'], [q + 2, 'near'], [q - 2, 'near'],
  ])
}

/** The share view hands in the share or −1 ('shareUnequal', SPEC §3.2): no wrong number to tag. */
const candidatesFor = (f: Fact, kind: TaskKind): Candidate[] => (kind === 'share' ? [] : candidates(f))

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const [total, g] = parts(f)
  const q = total / g
  const words: SpeechPart[] = [
    say('hint.shareEqually.oneEach'), say('hint.shareEqually.eachGets'), num(q),
    num(total, 'mid'), say('frag.muldiv.delt_med'), num(g, 'mid'), say('op.giver'), num(q),
  ]
  const visual = { scene: 'groups', groups: g, size: q, thing: 'carrot' } as const
  if (tag === 'wrongOperation') return hintOf([say('hint.shareEqually.giveAll'), ...words], visual, 'wrongOperation')
  if (tag === 'shareUnequal') return hintOf([say('hint.shareEqually.sameForAll'), ...words], visual)
  return hintOf(words, visual)
}

export default {
  ...metaOf('shareEqually'),
  kinds: ['share', 'choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => {
    const [total, g] = parts(f)
    return { scene: 'share', total, recipients: g, thing: 'carrot' }
  },
  optionView: () => 'numeral',
  range: () => [0, 30],
  speech: (f) => {
    const [total, g] = parts(f)
    return [
      say('s.shareEqually.share'), num(total, 'mid'), say('noun.thing.carrot.pl'), say('s.shareEqually.between'), num(g, 'mid'),
      say('noun.muldiv.dyr'), say('s.shareEqually.howMany'),
    ]
  },
  candidates,
  candidatesFor,
  hint,
} satisfies SkillModule
