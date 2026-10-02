// hear100 — Hør og skriv tal til 100 (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `h100:`.
//   d2x … d9x   h100:<n>   n = 10·d … 10·d + 9 for d = 2–9: ten per family, 80 in all (all canonical)
// The number is only heard ({ scene: 'hear' }): "Find tallet syvogfyrre." on cards, "Skriv tallet
// syvogfyrre." on the keypad, the production kind.
//
// Wrong answers: Danish says the ones first (syv-og-fyrre), so 74 for 47 is digitSwap — a concept in
// this skill (misconceptions.ts). The three "halv-" tens are easily mixed up (halvtreds 50,
// halvfjerds 70, halvfems 90): 57 or 97 for 77 is a plain 'other'. ±1 and ±10 are near misses. The
// question has no number but the answer itself, so no wrong answer is an operand.
// Hint: the number as tens and ones ("Syvogfyrre er fire tiere og syv enere. Vi skriver tierne
// først."), with the blocks; for a reversed answer "Vi siger syv først …" and the digitSwap film.
import type { Fact, FamilyDef, HintSpec, Rng, SkillModule } from '../types'
import { digitSwapOf } from '../../misconceptions'
import { hintOf, metaOf, num, say, tagged, type Entry } from './kit'
import { blocks, canonical, drawAvoiding, isPlaces, onesOf, tensOf, within } from '../place/kit'

const meta = metaOf('hear100')

/** 'd4x' → 4. */
const decadeOf = (family: string): number => Number(family.slice(1, 2))

function make(n: number): Fact {
  const family = `d${tensOf(n)}x`
  return { id: `h100:${n}`, skill: 'hear100', family, operands: [n], answer: n, rank: tensOf(n) - 2 }
}

/** The number in the id (also for a fact the round screen rebuilt from a task). */
const valueOf = (f: Fact): number => Number(f.id.slice(f.id.indexOf(':') + 1))

const draw = (family: string, rng: Rng): Fact => make(decadeOf(family) * 10 + rng.int(10))

const FACTS: readonly Fact[] = meta.families.flatMap((fam) =>
  canonical('hear100', fam.id, (rng) => draw(fam.id, rng), Array.from({ length: 10 }, (_, o) => make(decadeOf(fam.id) * 10 + o))),
)

/** halvtreds, halvfjerds and halvfems: the same ones with one of the other "halv-" tens. */
function halfSiblings(n: number): number[] {
  const t = tensOf(n)
  if (t !== 5 && t !== 7 && t !== 9) return []
  return [5, 7, 9].filter((x) => x !== t).map((x) => x * 10 + onesOf(n))
}

function candidates(f: Fact) {
  const n = valueOf(f)
  const swap = digitSwapOf(n)
  const entries: Entry[] = [
    ...(swap !== null ? ([[swap, 'digitSwap']] as const) : []),
    ...[n - 1, n + 1, n - 10, n + 10].filter(within(0, 99)).map((v) => [v, 'near'] as const),
    ...halfSiblings(n).map((v) => [v, 'other'] as const),
  ]
  return tagged(n, entries)
}

function hint(f: Fact, swapped: boolean): HintSpec {
  const n = valueOf(f)
  const t = tensOf(n)
  const o = onesOf(n)
  const visual = blocks(n)
  if (o === 0) {
    // "Halvtreds er fem tiere. Der er ingen enere, så vi skriver et nul til sidst."
    return hintOf([...isPlaces(n, [['t', t]]), say('hint.place.zeroOnesLast')], visual)
  }
  const said = isPlaces(n)
  if (swapped && digitSwapOf(n) !== null) {
    // "Vi siger syv først, men vi skriver tierne først." (pædagogik §3.4)
    return hintOf([...said, say('hint.hear20.weSay'), num(o, 'mid'), say('hint.hear.butTensFirst')], visual, 'digitSwap', true)
  }
  return hintOf([...said, say('hint.hear.tensFirst')], visual)
}

export default {
  ...meta,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id, rng), avoid),
  answerType: () => 'int',
  prompt: () => ({ scene: 'hear' }),
  optionView: () => 'numeral',
  range: () => [0, 99],
  speech: (f, kind) => [say(kind === 'keypad' ? 's.hear20.write' : 'frag.find_tallet'), num(valueOf(f))],
  candidates,
  hint: (f, tag) => hint(f, tag === 'digitSwap'),
} satisfies SkillModule
