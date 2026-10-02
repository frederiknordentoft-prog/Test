// addSub20Simple — Plus og minus til 20 uden tierovergang (SPEC §2.2, pædagogik-forslaget §1.3).
// Procedure, prefix `as20:`, three families (disjoint, so an instance id names one family):
//   addTeen  as20:<a>+<b>   a = 11–19, b ≥ 1, the ones make at most ten (12 + 5, 13 + 7)       45
//   subTeen  as20:<a>-<b>   a = 11–19, 1 ≤ b ≤ the ones of a (17 − 4, 17 − 7)                   45
//   tenPlus  as20:10+<b> / as20:<b>+10, b = 1–9 (10 + 6, 6 + 10)                                 18
// enumerate() gives 20 seeded instances per family (tenPlus: all 18).
// "Hvad er tolv plus fem?" over 12 + 5 = □; kinds choice and keypad (production). Card range 0–20,
// 0–30 for subTeen so "plus instead of minus" (up to 28) can be a card.
// Wrong answers: wrongOperation (|a − b| for plus, a + b for minus), the numbers from the question
// ('operand'), near misses ±1, ±2 and ±10 (the ten forgotten: 12 + 5 → 7). The catalogue names no
// other misconception for this skill (no crossing of the ten).
// Hint (two ten-frames, the answer drawn as ten and the rest): "Læg enerne sammen. To og fem giver syv.
// Ti og syv giver sytten." · "Tag enerne væk. Syv minus fire giver tre. Ti og tre giver tretten." ·
// "En fuld ti-ramme er ti. Ti og seks giver seksten."
import type { Fact, FamilyDef, HintSpec, Rng, SkillModule, SpeechPart } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import { around, canonicalFacts, drawInstance, meaningOf, otherOperation, result, signOf, sumId, sumPrompt, sumSpeech, type Drawer, type Sign } from './calc'

const META = metaOf('addSub20Simple')
const RANK: Readonly<Record<string, number>> = Object.fromEntries(META.families.map((f) => [f.id, f.rank]))

const make = (family: string, a: number, op: Sign, b: number): Fact => ({
  id: sumId('as20', a, op, b), skill: 'addSub20Simple', family, operands: [a, b], answer: result(a, op, b), rank: RANK[family],
})

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    switch (family) {
      case 'addTeen': {
        const o = rng.between(1, 9)
        return make('addTeen', 10 + o, '+', rng.between(1, 10 - o))
      }
      case 'subTeen': {
        const o = rng.between(1, 9)
        return make('subTeen', 10 + o, '−', rng.between(1, o))
      }
      default: {
        const b = rng.between(1, 9)
        return rng.next() < 0.5 ? make('tenPlus', 10, '+', b) : make('tenPlus', b, '+', 10)
      }
    }
  },
}

const CANON = canonicalFacts('addSub20Simple', drawer, META.families)

/** The answer as a ten and the rest in two ten-frames. */
const frames = (n: number) => ({ scene: 'objects', n, layout: 'tenframe', thing: 'ball' }) as const

function strategy(f: Fact): SpeechPart[] {
  const [a, b] = f.operands
  const ten = (rest: number) => [num(10, 'mid'), say('op.og'), num(rest, 'mid'), say('op.giver'), num(10 + rest)]
  switch (f.family) {
    case 'addTeen':
      return [say('hint.addSub20Simple.addOnes'), num(a - 10, 'mid'), say('op.og'), num(b, 'mid'), say('op.giver'), num(a - 10 + b), ...ten(a - 10 + b)]
    case 'subTeen':
      return [say('hint.addSub20Simple.takeOnes'), num(a - 10, 'mid'), say('op.minus'), num(b, 'mid'), say('op.giver'), num(a - 10 - b), ...ten(a - 10 - b)]
    default:
      return [say('hint.addSub20Simple.fullFrame'), ...ten(a === 10 ? b : a)]
  }
}

function hint(f: Fact, tag: string | null): HintSpec {
  const steps = strategy(f)
  const visual = frames(f.answer as number)
  if (tag === 'wrongOperation') return hintOf([meaningOf(signOf(f)), ...steps], visual, 'wrongOperation')
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
  range: (f) => [0, f.family === 'subTeen' ? 30 : 20],
  speech: (f) => sumSpeech(f.operands[0], signOf(f), f.operands[1]),
  candidates(f) {
    const [a, b] = f.operands
    const op = signOf(f)
    const answer = f.answer as number
    return tagged(answer, [
      [otherOperation(a, op, b), 'wrongOperation'],
      [a, 'operand'], [b, 'operand'],
      ...around(answer, [1, 2, 10]).map((v) => [v, 'near'] as const),
    ])
  },
  hint,
} satisfies SkillModule
