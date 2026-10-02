// addSub1000Round — Runde tal til 1000 (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `r1000:`,
// six families (disjoint, so an instance id names one family):
//   HplusH        r1000:<a>+<b>   whole hundreds, a + b ≤ 1000 (300 + 400)                       45
//   HminusH       r1000:<a>-<b>   whole hundreds, b < a ≤ 1000 (700 − 200)                       45
//   HTplusT       r1000:<a>+<b>   a = 110–980 with tens ≥ 1, b whole tens, no new hundred (370 + 20)
//   HTminusT      r1000:<a>-<b>   a = 110–990 with tens ≥ 1, b whole tens ≤ a's tens (370 − 20)
//   HplusTO       r1000:<a>+<b>   a whole hundreds 100–900, b two-digit with ones ≥ 1 (300 + 45)
//   HTplusTcarry  r1000:<a>+<b>   a = 110–990 with tens ≥ 1, b whole tens, the tens make a hundred,
//                                 a + b ≤ 1000 (370 + 50, 970 + 30)
// enumerate() gives 20 seeded instances per family. "Hvad er tre hundrede plus fire hundrede?" over
// 300 + 400 = □; kinds choice and keypad (production); card range 0–1000.
// Wrong answers: forgotCarry (HTplusTcarry: the new hundred left out, 370 + 50 → 320, pædagogik §3.2),
// tensZero (a whole-ten answer with its zero lost or doubled: 300 + 400 → 70 or 7000, 370 + 20 → 39 or
// 3900; pædagogik §3.2 lists it for mulTens), wrongOperation (|a − b| for plus, a + b for minus), the
// numbers from the question ('operand') and near misses: ±100 for whole hundreds (one hundred miscounted),
// ±10 for whole tens, ±1 and ±10 for HplusTO. Two explanations for one value make it 'ambiguous'.
// Hint (columns with flats, rods and cubes): "Regn med hele hundreder. Tre plus fire giver syv. Svaret er
// syv hundrede." · "Regn med tierne. Halvfjerds plus tyve giver halvfems. Hundrederne er de samme.
// Svaret er tre hundrede og halvfems." · "Halvfjerds plus halvtreds giver et hundrede og tyve. Ti tiere
// bliver til et hundrede mere." · "Hundrederne og resten skal bare stå sammen. Tre hundrede plus
// femogfyrre giver tre hundrede og femogfyrre."
import type { Fact, FamilyDef, HintSpec, Rng, SkillModule, SpeechPart } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import {
  answerIs, around, canonicalFacts, columns, digitSum, drawInstance, meaningOf, otherOperation, result, signOf, sumId, sumPrompt,
  sumSpeech, swapHint, tensCarry, type Drawer, type Sign,
} from './calc'

const META = metaOf('addSub1000Round')
const RANK: Readonly<Record<string, number>> = Object.fromEntries(META.families.map((f) => [f.id, f.rank]))

const make = (family: string, a: number, op: Sign, b: number): Fact => ({
  id: sumId('r1000', a, op, b), skill: 'addSub1000Round', family, operands: [a, b], answer: result(a, op, b), rank: RANK[family],
})

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    switch (family) {
      case 'HplusH': {
        const i = rng.between(1, 9)
        return make('HplusH', 100 * i, '+', 100 * rng.between(1, 10 - i))
      }
      case 'HminusH': {
        const i = rng.between(2, 10)
        return make('HminusH', 100 * i, '−', 100 * rng.between(1, i - 1))
      }
      case 'HTplusT': {
        const t = rng.between(1, 8)
        return make('HTplusT', 100 * rng.between(1, 9) + 10 * t, '+', 10 * rng.between(1, 9 - t))
      }
      case 'HTminusT': {
        const t = rng.between(1, 9)
        return make('HTminusT', 100 * rng.between(1, 9) + 10 * t, '−', 10 * rng.between(1, t))
      }
      case 'HplusTO':
        return make('HplusTO', 100 * rng.between(1, 9), '+', 10 * rng.between(1, 9) + rng.between(1, 9))
      default: {
        const t = rng.between(1, 9)
        const a = 100 * rng.between(1, 9) + 10 * t
        const b = 10 * rng.between(10 - t, 9)
        return a + b <= 1000 ? make('HTplusTcarry', a, '+', b) : null
      }
    }
  },
}

const CANON = canonicalFacts('addSub1000Round', drawer, META.families)

function strategy(f: Fact): SpeechPart[] {
  const [a, b] = f.operands
  const op = signOf(f)
  const answer = f.answer as number
  switch (f.family) {
    case 'HplusH':
    case 'HminusH':
      return [say('hint.addSub1000Round.hundreds'), ...digitSum(a / 100, op, b / 100), ...answerIs(answer)]
    case 'HTplusT':
    case 'HTminusT':
      return [say('hint.addSub1000Round.tens'), ...digitSum(a % 100, op, b), say('hint.addSub1000Round.hundredsSame'), ...answerIs(answer)]
    case 'HplusTO':
      return [say('hint.addSub1000Round.putTogether'), num(a, 'mid'), say('op.plus'), num(b, 'mid'), say('op.giver'), num(answer)]
    default:
      return [say('hint.addSub1000Round.tens'), ...digitSum(a % 100, '+', b), say('hint.addSub1000Round.newHundred'), ...answerIs(answer)]
  }
}

function hint(f: Fact, tag: string | null): HintSpec {
  const [a, b] = f.operands
  const op = signOf(f)
  const steps = strategy(f)
  const visual = columns(a, op, b)
  switch (tag) {
    case 'forgotCarry':
      return hintOf([say('hint.addSub1000Round.keepHundred'), ...steps], visual, 'forgotCarry', true)
    case 'tensZero':
      return hintOf([say(f.family === 'HplusH' || f.family === 'HminusH' ? 'hint.addSub1000Round.zeroHundreds' : 'hint.addsub2.zeroTens'), ...steps], visual, 'tensZero')
    case 'wrongOperation':
      return hintOf([meaningOf(op), ...steps], visual, 'wrongOperation')
    case 'digitSwap':
      return swapHint(f.answer as number)
    default:
      return hintOf(steps, visual)
  }
}

/** Near misses that look like the answer: whole hundreds ±100, whole tens ±10, otherwise ±1 and ±10. */
function nearOf(answer: number): number[] {
  if (answer % 100 === 0) return around(answer, [100])
  if (answer % 10 === 0) return around(answer, [10])
  return around(answer, [1, 10])
}

export default {
  ...META,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...CANON],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawInstance(drawer, family, rng, avoid),
  answerType: () => 'int',
  prompt: (f) => sumPrompt(f.operands[0], signOf(f), f.operands[1]),
  optionView: () => 'numeral',
  range: () => [0, 1000],
  speech: (f) => sumSpeech(f.operands[0], signOf(f), f.operands[1]),
  candidates(f) {
    const [a, b] = f.operands
    const op = signOf(f)
    const answer = f.answer as number
    const whole = answer > 0 && answer % 10 === 0
    return tagged(answer, [
      ...(f.family === 'HTplusTcarry' && tensCarry(a, b) ? ([[answer - 100, 'forgotCarry']] as const) : []),
      ...(whole ? ([[answer / 10, 'tensZero'], [answer * 10, 'tensZero']] as const) : []),
      [otherOperation(a, op, b), 'wrongOperation'],
      [a, 'operand'], [b, 'operand'],
      ...nearOf(answer).map((v) => [v, 'near'] as const),
    ])
  },
  hint,
} satisfies SkillModule
