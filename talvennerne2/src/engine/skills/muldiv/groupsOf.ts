// groupsOf — Grupper af lige mange (SPEC §2.2, pædagogik-forslaget §1.3: "3 kurve med 4", gange som
// gentaget plus). Recall, 16 facts `grp:<g>x<s>` (prefix `grp:`; g groups of s, g, s = 2–5 — the order
// matters here, 3 groups of 4 is another picture than 4 groups of 3), one family 'groups'. Ranked by
// the total, then by the number of groups.
// The question: "Der er tre grupper med fire jordbær i hver. Hvor mange er der i alt?" over the groups
// (Prompt 'groups'); the thing is fixed per fact, its noun is the shared `noun.thing.<id>.pl`.
// Kinds: choice, keypad (production). Range 0–30.
// Wrong answers (pædagogik §3.2): mulAsAdd = g + s (3 groups of 4 → 7), the numbers from the question
// ('operand'), one group too many or too few (± s) and near misses (±1) as 'near'. A value with two
// explanations is 'ambiguous' (A9); g + s is never a number of the question.
// Hint: count group by group — "Tæl gruppe for gruppe. Fire. Otte. Tolv. Tre grupper med fire er tolv."
// mulAsAdd says first that the two numbers are not added.
import type { ErrorTag, Fact, HintSpec, SkillModule, SpeechPart } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'

const THINGS = ['carrot', 'apple', 'strawberry', 'chestnut', 'flower', 'fish', 'mushroom', 'star'] as const

const FACTS: readonly Fact[] = (() => {
  const out: Fact[] = []
  for (let g = 2; g <= 5; g++) {
    for (let s = 2; s <= 5; s++) {
      out.push({ id: `grp:${g}x${s}`, skill: 'groupsOf', family: 'groups', operands: [g, s], answer: g * s, rank: g * s * 10 + g })
    }
  }
  return out.sort((a, b) => a.rank - b.rank)
})()

/** g and s from the id. */
function parts(f: Pick<Fact, 'id'>): [number, number] {
  const m = /^grp:(\d+)x(\d+)$/.exec(f.id)
  if (!m) throw new Error(`not a groupsOf fact: ${f.id}`)
  return [Number(m[1]), Number(m[2])]
}

const thingOf = (g: number, s: number) => THINGS[(g * 5 + s * 3) % THINGS.length]

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const [g, s] = parts(f)
  const words: SpeechPart[] = [
    say('hint.groupsOf.countGroups'),
    ...Array.from({ length: g }, (_, i) => num((i + 1) * s)),
    num(g, 'mid'), say('s.groupsOf.groupsWith'), num(s, 'mid'), say('hint.groupsOf.is'), num(g * s),
  ]
  const visual = { scene: 'groups', groups: g, size: s, thing: thingOf(g, s) } as const
  if (tag === 'mulAsAdd') return hintOf([say('hint.groupsOf.countAll'), ...words], visual, 'mulAsAdd')
  return hintOf(words, visual)
}

export default {
  ...metaOf('groupsOf'),
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => {
    const [g, s] = parts(f)
    return { scene: 'groups', groups: g, size: s, thing: thingOf(g, s) }
  },
  optionView: () => 'numeral',
  range: () => [0, 30],
  speech: (f) => {
    const [g, s] = parts(f)
    return [
      say('s.groupsOf.thereAre'), num(g, 'mid'), say('s.groupsOf.groupsWith'), num(s, 'mid'), say(`noun.thing.${thingOf(g, s)}.pl`),
      say('s.groupsOf.inEach'), say('s.groupsOf.howMany'),
    ]
  },
  candidates(f) {
    const [g, s] = parts(f)
    const x = g * s
    return tagged(x, [
      [g + s, 'mulAsAdd'],
      [g, 'operand'], [s, 'operand'],
      [x + s, 'near'], [x - s, 'near'], [x + 1, 'near'], [x - 1, 'near'],
    ])
  },
  hint,
} satisfies SkillModule
