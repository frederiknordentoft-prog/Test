// hear1000 — Hør og skriv tal til 1000 (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `h1000:`.
//   hundreds  h1000:<n>   100, 200 … 900 and 1000 (tusind)                          10 (all canonical)
//   h0o       h1000:<n>   a zero for the tens: 101–109 … 901–909                    81
//   hTeen     h1000:<n>   a teen after the hundreds: 111–119 … 911–919              81
//   hT0       h1000:<n>   whole tens after the hundreds: 110, 120 … 990             81
//   hTO       h1000:<n>   the rest: 121–199 without round tens … 921–999            648
// The family follows from the number, so the id is the number. Heard only ({ scene: 'hear' }):
// "Find tallet tre hundrede og fire." on cards, "Skriv tallet …" on the keypad (production).
//
// Wrong answers (pædagogik §3.2):
//   concatNumberWords  "et hundrede og fire" written as the words come: 1004; "tre hundrede og
//                      femogfyrre" → 30045 (H·10^(d+2) + rest). The keypad takes five digits
//                      (tasks.ts WIDE_KEYPAD) and the card range goes to 99 999 so it can be seen.
//   zeroPlaceholder    the zero dropped or moved: 304 → 34 or 340, 320 → 32 or 302, 300 → 30 or 3,
//                      1000 → 100.
//   digitSwap          tens and ones swapped, as Danish says them (345 → 354, 213 → 231).
//   near               ±1, ±10, ±100.
// The question has no number but the answer, so no wrong answer is an operand.
// Hint: hundreds, tens and ones with the blocks, plus the misconception's own sentence.
import type { Fact, FamilyDef, HintSpec, Rng, SkillModule } from '../types'
import { digitSwapOf } from '../../misconceptions'
import { hintOf, metaOf, num, say, tagged, type Entry } from './kit'
import { blocks, canonical, drawAvoiding, hundredsOf, isPlaces, onesOf, tensOf, within, type PlacePart } from '../place/kit'

const meta = metaOf('hear1000')

type Family = 'hundreds' | 'h0o' | 'hTeen' | 'hT0' | 'hTO'

function familyOf(n: number): Family {
  const t = tensOf(n)
  const o = onesOf(n)
  if (n % 100 === 0) return 'hundreds'
  if (t === 0) return 'h0o'
  if (t === 1 && o > 0) return 'hTeen'
  if (o === 0) return 'hT0'
  return 'hTO'
}

const RANK: Readonly<Record<Family, number>> = { hundreds: 0, h0o: 1, hTeen: 2, hT0: 3, hTO: 4 }

function make(n: number): Fact {
  const family = familyOf(n)
  return { id: `h1000:${n}`, skill: 'hear1000', family, operands: [n], answer: n, rank: RANK[family] }
}

const valueOf = (f: Fact): number => Number(f.id.slice(f.id.indexOf(':') + 1))

/** Every number of a family, in order. */
function members(family: Family): number[] {
  if (family === 'hundreds') return Array.from({ length: 10 }, (_, i) => (i + 1) * 100)
  const out: number[] = []
  for (let n = 101; n <= 999; n++) if (familyOf(n) === family) out.push(n)
  return out
}

const MEMBERS: Readonly<Record<Family, readonly number[]>> = {
  hundreds: members('hundreds'), h0o: members('h0o'), hTeen: members('hTeen'), hT0: members('hT0'), hTO: members('hTO'),
}

const draw = (family: Family, rng: Rng): Fact => make(rng.pick(MEMBERS[family]))

const FACTS: readonly Fact[] = meta.families.flatMap((fam) => {
  const family = fam.id as Family
  return canonical('hear1000', family, (rng) => draw(family, rng), MEMBERS[family].map(make))
})

/** The widest wrong answer: 345 → 30045, so the cards and the keypad go to five digits. */
const HEAR1000_MAX = 99_999

/** "tre hundrede og femogfyrre" written word by word: 300 then 45 → 30045 (null for round hundreds). */
function concatOf(n: number): number | null {
  if (n >= 1000 || n % 100 === 0) return null
  const rest = n % 100
  return hundredsOf(n) * 10 ** (String(rest).length + 2) + rest
}

/** The zero left out or put in the wrong place. */
function zeroSlipsOf(n: number): number[] {
  const h = hundredsOf(n)
  const t = tensOf(n)
  const o = onesOf(n)
  if (n === 1000) return [100]
  if (n % 100 === 0) return [h * 10, h]
  if (t === 0) return [h * 10 + o, h * 100 + o * 10]
  if (o === 0) return [h * 10 + t, h * 100 + t]
  return []
}

function candidates(f: Fact) {
  const n = valueOf(f)
  const concat = concatOf(n)
  const swap = digitSwapOf(n)
  const entries: Entry[] = [
    ...(concat !== null ? ([[concat, 'concatNumberWords']] as const) : []),
    ...zeroSlipsOf(n).map((v) => [v, 'zeroPlaceholder'] as const),
    ...(swap !== null && n < 1000 ? ([[swap, 'digitSwap']] as const) : []),
    ...[n - 1, n + 1, n - 10, n + 10, n - 100, n + 100].filter(within(0, 1000)).map((v) => [v, 'near'] as const),
  ]
  return tagged(n, entries)
}

function hint(f: Fact, tag: string | null): HintSpec {
  const n = valueOf(f)
  const visual = blocks(n)
  if (n === 1000) {
    // "Tusind er ti hundreder."
    return hintOf(isPlaces(1000, [['h', 10]]), visual, tag === 'zeroPlaceholder' ? 'zeroPlaceholder' : undefined)
  }
  const h = hundredsOf(n)
  const t = tensOf(n)
  const o = onesOf(n)
  const parts: PlacePart[] = [['h', h], ['t', t], ['o', o]]
  const said = isPlaces(n, parts)
  switch (tag) {
    case 'concatNumberWords':
      // "Det skriver vi med tre cifre: hundreder, tiere og enere."
      return hintOf([...said, say('hint.hear1000.threeDigits')], visual, 'concatNumberWords')
    case 'zeroPlaceholder':
      if (n % 100 === 0) return hintOf([...said, say('hint.place.zeroBoth')], visual, 'zeroPlaceholder')
      return hintOf([...said, say(t === 0 ? 'hint.place.zeroHoldsTens' : 'hint.place.zeroHoldsOnes')], visual, 'zeroPlaceholder')
    case 'digitSwap':
      if (digitSwapOf(n) !== null) {
        return hintOf([...said, say('hint.hear20.weSay'), num(o, 'mid'), say('hint.hear.butTensFirst')], visual, 'digitSwap')
      }
      break
  }
  if (n % 100 === 0) return hintOf([...said, say('hint.place.zeroBoth')], visual)
  if (t === 0) return hintOf([...said, say('hint.place.zeroHoldsTens')], visual)
  if (o === 0) return hintOf([...said, say('hint.place.zeroHoldsOnes')], visual)
  return hintOf([...said, say('hint.hear1000.hundredsFirst')], visual)
}

export default {
  ...meta,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id as Family, rng), avoid),
  answerType: () => 'int',
  prompt: () => ({ scene: 'hear' }),
  optionView: () => 'numeral',
  range: () => [0, HEAR1000_MAX],
  speech: (f, kind) => [say(kind === 'keypad' ? 's.hear20.write' : 'frag.find_tallet'), num(valueOf(f))],
  candidates,
  hint: (f, tag) => hint(f, tag),
} satisfies SkillModule
