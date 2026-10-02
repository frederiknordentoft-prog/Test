// tens100 — Hele tiere plus og minus (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `t100:`:
//   addTens  t100:<a>+<b>   whole tens a, b ≥ 10, a + b ≤ 100 (30 + 40, 50 + 50)     45
//   subTens  t100:<a>-<b>   whole tens 10 ≤ b < a ≤ 100 (70 − 20, 100 − 30)          45
// enumerate() gives 20 seeded instances per family. "Hvad er tredive plus fyrre?" over 30 + 40 = □;
// kinds choice and keypad (production); card range 0–100.
// Wrong answers: tensZero — the zero lost or doubled (30 + 40 → 7 or 700; pædagogik §3.2 lists it for
// mulTens, "nul droppet eller ekstra nul", and it is the same idea with whole tens), wrongOperation
// (30 + 40 → 10, 70 − 20 → 90), the numbers from the question ('operand') and the next tens (±10).
// Values with two explanations (100 − 90 → 100: the zero doubled, or the 100 repeated) are 'ambiguous'.
// Hint (rods for the answer): "Tre tiere plus fire tiere giver syv tiere. Det er halvfjerds."
import type { Fact, FamilyDef, HintSpec, Rng, SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import { around, canonicalFacts, drawInstance, meaningOf, otherOperation, result, signOf, sumId, sumPrompt, sumSpeech, tensSum, type Drawer, type Sign } from './calc'

const META = metaOf('tens100')
const RANK: Readonly<Record<string, number>> = Object.fromEntries(META.families.map((f) => [f.id, f.rank]))

const make = (family: string, a: number, op: Sign, b: number): Fact => ({
  id: sumId('t100', a, op, b), skill: 'tens100', family, operands: [a, b], answer: result(a, op, b), rank: RANK[family],
})

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    if (family === 'addTens') {
      const i = rng.between(1, 9)
      return make('addTens', 10 * i, '+', 10 * rng.between(1, 10 - i))
    }
    const i = rng.between(2, 10)
    return make('subTens', 10 * i, '−', 10 * rng.between(1, i - 1))
  },
}

const CANON = canonicalFacts('tens100', drawer, META.families)

function hint(f: Fact, tag: string | null): HintSpec {
  const [a, b] = f.operands
  const op = signOf(f)
  const answer = f.answer as number
  const steps = [...tensSum(a / 10, op, b / 10), say('hint.addsub2.thatIs'), num(answer)]
  const visual = { scene: 'base', h: 0, t: answer / 10, o: 0, order: 'hto' } as const
  if (tag === 'tensZero') return hintOf([say('hint.addsub2.zeroTens'), ...steps], visual, 'tensZero')
  if (tag === 'wrongOperation') return hintOf([meaningOf(op), ...steps], visual, 'wrongOperation')
  return hintOf(steps, visual)
}

export default {
  ...META,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...CANON],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawInstance(drawer, family, rng, avoid),
  answerType: () => 'int',
  prompt: (f) => sumPrompt(f.operands[0], signOf(f), f.operands[1]),
  optionView: () => 'numeral',
  range: () => [0, 100],
  speech: (f) => sumSpeech(f.operands[0], signOf(f), f.operands[1]),
  candidates(f) {
    const [a, b] = f.operands
    const op = signOf(f)
    const answer = f.answer as number
    return tagged(answer, [
      ...(answer > 0 ? ([[answer / 10, 'tensZero'], [answer * 10, 'tensZero']] as const) : []),
      [otherOperation(a, op, b), 'wrongOperation'],
      [a, 'operand'], [b, 'operand'],
      ...around(answer, [10]).map((v) => [v, 'near'] as const),
    ])
  },
  hint,
} satisfies SkillModule
