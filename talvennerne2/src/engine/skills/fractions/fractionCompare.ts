// fractionCompare — Sammenlign brøker (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `fcm:`, on
// fraction cards (optionView 'fraction'), the denominators 2, 3, 4, 5, 6 and 8:
//   pairBigger   fcm:b:<a>,<b>                two unit fractions, 1/a > 1/b (a < b)                 14
//   pairSmaller  fcm:s:<a>,<b>                the same, the smaller one asked                        14
//   order4       fcm:o:<k>:<d1>,<d2>,<d3>,<d4>  four fractions with the same numerator k = 1–3        21
// Each instance fills its cards from its id: the pair plus one more card (choice: the answer stays the
// pair's own) or two more (sortOrder); order4 drops one of its four for the cards.
// Kinds: choice "Hvilken brøk er størst?" / "… mindst?" on three cards (pairSmaller asks for the
// smallest, the others for the biggest), over the loudspeaker (Prompt 'hear'): the bars would show the
// answer. sortOrder (production, 4 cards, 1 in 24): "Sæt brøkerne i rækkefølge. Start med den største."
// (pairBigger) or "… den mindste." (pairSmaller, order4), onto four places (Prompt 'row'), whose step
// is the direction (−1 down from the biggest, 1 up from the smallest): the view writes "Størst" and
// "Mindst" at the ends of the places, so the screen says it too (QA3a P2-3).
// Wrong answers: biggerDenominator — the biggest denominator taken for the biggest fraction: on the
// cards the one with the biggest denominator (biggest asked) or the smallest one (smallest asked), in a
// sortOrder the cards ordered by their denominators. Plain: the other card, two neighbours swapped
// ('near'). Same numerators throughout, so no two cards are ever equal.
// Hint: "Jo flere lige store dele en hel er delt i, jo mindre bliver hver del. En halv er størst." (or
// the whole order) over the cards as fraction bars, after "Et stort tal under brøkstregen betyder små
// dele. Det er ikke en stor brøk." for biggerDenominator; order4 starts with "Brøkerne har lige mange
// dele, men delene er ikke lige store."
import type { AnswerValue, Candidate, ErrorTag, Fact, FamilyDef, Rng, SpeechPart, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import type { Denominator } from '../../../speech/fractions'
import { hashSeed, makeRng } from '../../rng'
import { hintOf, metaOf, say, tagged, type Entry } from '../number/kit'

type Family = 'pairBigger' | 'pairSmaller' | 'order4'

const D: readonly Denominator[] = [2, 3, 4, 5, 6, 8]
const META = metaOf('fractionCompare')
const FAST: Partial<Record<TaskKind, number>> = { choice: 7_000, sortOrder: 14_000 }
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))

interface Parsed {
  family: Family
  k: number
  /** Denominators of the cards, biggest fraction first: three for choice, four for sortOrder. */
  three: Denominator[]
  four: Denominator[]
  /** The biggest is asked (pairBigger, order4 on cards) or the smallest. */
  biggest: boolean
}

const desc = (ds: readonly Denominator[]) => [...ds].sort((a, b) => a - b)
const cache = new Map<string, Parsed>()

/** The cards of an instance, drawn from its id. */
function parse(f: Pick<Fact, 'id'>): Parsed {
  const hit = cache.get(f.id)
  if (hit) return hit
  const parts = f.id.split(':')
  const rng = makeRng(hashSeed(f.id))
  let p: Parsed
  if (parts[1] === 'o') {
    const four = parts[3].split(',').map(Number) as Denominator[]
    const drop = rng.int(4)
    p = { family: 'order4', k: Number(parts[2]), three: four.filter((_, i) => i !== drop), four, biggest: true }
  } else {
    const [a, b] = parts[2].split(',').map(Number) as Denominator[]
    const biggest = parts[1] === 'b'
    const rest = rng.shuffle(D.filter((d) => d !== a && d !== b))
    // the third card leaves the answer with the pair: a smaller fraction than 1/a, a bigger one than 1/b
    const third = rest.find((d) => (biggest ? d > a : d < b))!
    p = { family: biggest ? 'pairBigger' : 'pairSmaller', k: 1, three: desc([a, b, third]), four: desc([a, b, ...rest.slice(0, 2)]), biggest }
  }
  if (cache.size > 300) cache.clear()
  cache.set(f.id, p)
  return p
}

const token = (k: number, d: number) => `frac:${k}/${d}`
/** The sortOrder answer: the cards from the asked end. */
const order = (p: Parsed, ds = p.four) => (p.family === 'pairBigger' ? ds : [...ds].reverse())
const sequence = (p: Parsed, ds: readonly number[]) => ds.map((d) => token(p.k, d)).join('|')

const PAIRS = D.flatMap((a) => D.filter((b) => b > a).map((b) => [a, b] as const))
const IDS: Readonly<Record<Family, readonly string[]>> = {
  // a pair needs a third card on the far side of its answer: 1/6 vs 1/8 has none bigger than 1/6 …
  pairBigger: PAIRS.filter(([a, b]) => D.some((d) => d > a && d !== b)).map(([a, b]) => `fcm:b:${a},${b}`),
  // … and 1/2 vs 1/3 none smaller than 1/3
  pairSmaller: PAIRS.filter(([a, b]) => D.some((d) => d < b && d !== a)).map(([a, b]) => `fcm:s:${a},${b}`),
  order4: [1, 2, 3].flatMap((k) => {
    const ds = D.filter((d) => d > k)
    const out: string[] = []
    for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) for (let m = j + 1; m < ds.length; m++) for (let n = m + 1; n < ds.length; n++) out.push(`fcm:o:${k}:${ds[i]},${ds[j]},${ds[m]},${ds[n]}`)
    return out
  }),
}

const factOf = (id: string, rank: number): Fact => {
  const p = parse({ id })
  return { id, skill: 'fractionCompare', family: p.family, operands: [], answer: sequence(p, order(p)), rank }
}
const FACTS: readonly Fact[] = (Object.keys(IDS) as Family[]).flatMap((fam, fi) => IDS[fam].map((id, i) => factOf(id, fi * 100 + i)))

function candidatesFor(f: Fact, kind: TaskKind): Candidate[] {
  const p = parse(f)
  if (kind === 'choice') {
    const [big, mid, small] = p.three
    // biggest asked: the biggest denominator is the misconception's card; smallest asked: the smallest
    const answer = token(p.k, p.biggest ? big : small)
    return tagged(answer, [[token(p.k, p.biggest ? small : big), 'biggerDenominator'], [token(p.k, mid), 'near']])
  }
  const right = order(p)
  const swaps: Entry[] = [0, 1, 2].map((i) => [sequence(p, right.map((_, j) => right[j === i ? i + 1 : j === i + 1 ? i : j])), 'near'])
  return tagged(sequence(p, right), [[sequence(p, [...right].reverse()), 'biggerDenominator'], ...swaps])
}

function hint(f: Fact, tag: ErrorTag | null, kind?: TaskKind) {
  const p = parse(f)
  const frac = (d: Denominator, form: 'mid' | 'end' = 'mid'): SpeechPart => ({ frac: { n: p.k, d, form } })
  const cards = kind === 'sortOrder' ? order(p) : p.three
  const words: SpeechPart[] = [say('hint.fractionCompare.moreParts')]
  if (p.family === 'order4') words.unshift(say('hint.fractionCompare.sameCount'))
  if (kind === 'sortOrder') {
    const last = cards[cards.length - 1]
    words.push(say(p.family === 'pairBigger' ? 'hint.fractionCompare.fromBiggest' : 'hint.fractionCompare.fromSmallest'), ...cards.slice(0, -1).map((d) => frac(d)), say('op.og'), frac(last, 'end'))
  } else {
    words.push(frac(p.biggest ? cards[0] : cards[2]), say(p.biggest ? 'hint.fractionCompare.isBiggest' : 'hint.fractionCompare.isSmallest'))
  }
  const visual = { scene: 'fractionBars', fracs: cards.map((d) => `${p.k}/${d}`) } as const
  if (tag === 'biggerDenominator') return hintOf([say('hint.fractionCompare.notBigNumber'), ...words], visual, 'biggerDenominator')
  return hintOf(words, visual)
}

function instance(fam: FamilyDef, rng: Rng, avoid: ReadonlySet<string>): Fact {
  const ids = IDS[fam.id as Family]
  const fresh = ids.filter((id) => !avoid.has(id))
  return factOf(rng.pick(fresh.length > 0 ? fresh : ids), 0)
}

export default {
  ...META,
  families: FAMILIES,
  kinds: ['choice', 'sortOrder'],
  enumerate: () => [...FACTS],
  instance,
  answer: (f: Fact, kind: TaskKind): AnswerValue => {
    const p = parse(f)
    return kind === 'sortOrder' ? f.answer : token(p.k, p.biggest ? p.three[0] : p.three[2])
  },
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'sortOrder' ? 'set' : 'token'),
  answerType: () => 'set',
  // the row's step is its direction (QA3a P2-3): down from the biggest, or up from the smallest
  prompt: (f: Fact, kind: TaskKind) => (kind === 'sortOrder' ? { scene: 'row', cells: [null, null, null, null], step: parse(f).family === 'pairBigger' ? -1 : 1 } : { scene: 'hear' }),
  optionView: () => 'fraction',
  range: () => [0, 1],
  speech: (f: Fact, kind: TaskKind) => {
    const p = parse(f)
    if (kind === 'sortOrder') return [say(p.family === 'pairBigger' ? 's.fractionCompare.sortBiggest' : 's.fractionCompare.sortSmallest')]
    return [say(p.biggest ? 's.fractionCompare.biggest' : 's.fractionCompare.smallest')]
  },
  candidates: (f: Fact) => [...candidatesFor(f, 'choice'), ...candidatesFor(f, 'sortOrder')],
  candidatesFor,
  hint,
} satisfies SkillModule
