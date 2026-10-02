// Independent oracles for the place-value skills of 1.–2. klasse (tensOnes, placeValue1000). Every
// right answer is worked out here from what the child is given — the fact id, the blocks in the
// picture, the place words that are said ("tre enere og fem tiere"), the numeral or the expansion on
// the card — never from the generator code. Wrong answers follow pædagogik §3.2 (addsPlaceParts,
// digitSwap, faceValue, zeroPlaceholder, concatNumberWords), worked out here. The registry skips
// *.oracle.ts files, so none of this reaches the app.
import type { AnswerValue, MisconceptionId, Prompt, Task, TaskKind } from '../../types'
import { spokenText } from '../number/number.oracle'
import { concatWords, digitsOf, numbersIn, swapTO, word99, zeroSlips, type Why } from '../number/number2.oracle'

// ─── Reading the question ───────────────────────────────────────────────────

const PLACE_NOUNS: Readonly<Record<string, number>> = {
  ener: 1, enere: 1, tier: 10, tiere: 10, hundrede: 100, hundreder: 100,
}

/** "Tre enere og fem tiere" → 53, "Seks hundreder og en tier" → 610, "to hundreder og fjorten tiere" → 340 (counts times places). */
export function placeWordsValue(text: string): number | null {
  const w = text.toLowerCase().replace(/[.,?!]/g, ' ').split(/\s+/).filter((x) => x !== '')
  let sum = 0
  let found = 0
  for (let i = 0; i + 1 < w.length; i++) {
    const count = w[i] === 'et' ? 1 : word99(w[i])
    const place = PLACE_NOUNS[w[i + 1]]
    if (count === null || place === undefined) continue
    sum += count * place
    found++
    i++
  }
  return found > 0 ? sum : null
}

/** The value of the blocks in a base picture (100 per plate, 10 per rod, 1 per cube, nothing regrouped). */
export const blocksValue = (p: Prompt): number | null => (p.scene === 'base' ? 100 * p.h + 10 * p.t + p.o : null)

/** The terms of an equation card as numbers, '□' for a blank and the operator otherwise. */
export function equationOf(p: Prompt): (number | string)[] | null {
  if (p.scene !== 'equation') return null
  return p.terms.map((t) => ('n' in t ? t.n : 'blank' in t ? '□' : 'op' in t ? t.op : '?'))
}

/** "N = a + □ + c": the missing part (null for any other card). */
export function missingPart(p: Prompt): number | null {
  const eq = equationOf(p)
  if (!eq || eq.length < 5 || eq[1] !== '=' || typeof eq[0] !== 'number') return null
  const parts = eq.slice(2).filter((_, i) => i % 2 === 0)
  const ops = eq.slice(2).filter((_, i) => i % 2 === 1)
  if (!ops.every((o) => o === '+') || parts.filter((x) => x === '□').length !== 1) return null
  const shown = parts.filter((x): x is number => typeof x === 'number')
  return eq[0] - shown.reduce((s, x) => s + x, 0)
}

// ─── tensOnes ───────────────────────────────────────────────────────────────

export interface TensOnesQ {
  family: 'build' | 'decompose' | 'swapped' | 'expand'
  part?: 'tens' | 'ones'
  n: number
  t: number
  o: number
}

/** to:build:<10–99> · to:decompose:tens:<10–99> · to:decompose:ones:<11–99, not whole tens> · to:swapped|expand:<two non-zero digits>. */
export function parseTensOnes(id: string): TensOnesQ | null {
  const m = /^to:(build|swapped|expand):(\d+)$/.exec(id) ?? /^to:(decompose):(tens|ones):(\d+)$/.exec(id)
  if (!m) return null
  const n = Number(m[m.length - 1])
  const [t, o] = [Math.floor(n / 10), n % 10]
  if (n < 10 || n > 99) return null
  if (m[1] === 'decompose') {
    if (m[2] === 'ones' && o === 0) return null
    return { family: 'decompose', part: m[2] as 'tens' | 'ones', n, t, o }
  }
  if ((m[1] === 'swapped' || m[1] === 'expand') && o === 0) return null
  return { family: m[1] as 'build', n, t, o }
}

/** The answer on cards and the keypad: the number, the count of tens or ones, the missing ones. */
export function tensOnesAnswer(q: TensOnesQ): number {
  if (q.family === 'decompose') return q.part === 'tens' ? q.t : q.o
  return q.family === 'expand' ? q.o : q.n
}

/** What the built blocks must be worth: "Byg kun tierne i syvogfyrre" is four rods, 40. */
export function tensOnesBuilt(q: TensOnesQ): number {
  return q.family === 'decompose' && q.part === 'tens' ? q.t * 10 : tensOnesAnswer(q)
}

/** The answer as the child works it out from the picture, the words and the card. */
export function tensOnesFromTask(t: Task, q: TensOnesQ): number | null {
  const text = spokenText(t.speech)
  const p = t.prompt
  if (t.kind === 'buildBase') {
    if (text.startsWith('Byg tallet ')) return numbersIn(text)[0] ?? null
    if (text.startsWith('Byg kun tierne i ')) return 10 * Math.floor((numbersIn(text)[0] ?? NaN) / 10)
    if (text.startsWith('Byg kun enerne i ')) return (numbersIn(text)[0] ?? NaN) % 10
    if (text.startsWith('Læg ')) return placeWordsValue(text)
    if (text.endsWith('Byg det, der mangler.')) return missingPart(p)
    return null
  }
  switch (q.family) {
    case 'build':
      return text.startsWith('Hvilket tal viser klodserne?') ? blocksValue(p) : null
    case 'decompose': {
      const said = numbersIn(text)
      if (said.length !== 1 || JSON.stringify(equationOf(p)) !== JSON.stringify([said[0]])) return null
      if (text.startsWith('Hvor mange tiere er der i ')) return Math.floor(said[0] / 10)
      if (text.startsWith('Hvor mange enere er der i ')) return said[0] % 10
      return null
    }
    case 'swapped': {
      const v = placeWordsValue(text)
      return v !== null && v === blocksValue(p) && p.scene === 'base' && p.order === 'oth' ? v : null
    }
    case 'expand':
      return missingPart(p)
  }
}

/**
 * fillSlots, as the child sees it: the digits of the number in the blocks or the words (tens first),
 * or — for "47 = □ + □" — any parts that make the number (40 + 7 and 7 + 40 alike).
 */
export function slotsRight(q: { n: number; parts: boolean }, filling: readonly number[]): boolean {
  if (q.parts) return filling.reduce((s, x) => s + x, 0) === q.n && filling.every((x) => x > 0)
  return filling.join('|') === digitsOf(q.n).join('|')
}

/** Every filling of a fillSlots task (palette^slots). */
export function fillings(t: Task): number[][] {
  const palette = t.options.filter((o): o is number => typeof o === 'number')
  const k = String(t.answer).split('|').length
  let out: number[][] = [[]]
  for (let i = 0; i < k; i++) out = out.flatMap((f) => palette.map((x) => [...f, x]))
  return out
}

/**
 * pædagogik §3.2 for tensOnes: addsPlaceParts (4 tiere og 7 enere → 11), digitSwap (a concept here: the
 * digits in the order Danish says them, 74 for 47; in decompose the other digit), faceValue (the tens'
 * value for their count: 40 for "hvor mange tiere"; the digits for the values in 47 = □ + □), the
 * numbers given ('operand': the counts in the picture or words, the number in the question), near misses.
 */
export function explainTensOnes(q: TensOnesQ, kind: TaskKind, v: AnswerValue): Why {
  const { n, t: tens, o } = q
  if (typeof v === 'string') {
    // fillSlots: a filling of digits or parts
    const f = v.split('|').map(Number)
    if (q.family === 'expand') {
      const set = [...f].sort((a, b) => a - b).join('|')
      const is = (xs: number[]) => set === [...xs].sort((a, b) => a - b).join('|')
      return { mis: is([tens, o]) ? ['faceValue'] : is([o * 10, tens]) ? ['digitSwap'] : [] }
    }
    // SPEC §4.1: a swap needs two different non-zero digits (60 written 0|6 is not one)
    return { mis: f.join('|') === [o, tens].join('|') && o !== tens && o !== 0 ? ['digitSwap'] : [] }
  }
  const answer = kind === 'buildBase' ? tensOnesBuilt(q) : tensOnesAnswer(q)
  const mis: MisconceptionId[] = []
  let operand = false
  if (q.family === 'build' || q.family === 'swapped') {
    if (v === tens + o) mis.push('addsPlaceParts')
    if (v === swapTO(n)) mis.push('digitSwap')
    operand = v === tens || v === o
  } else if (q.family === 'decompose') {
    const other = q.part === 'tens' ? o : tens
    if (kind === 'buildBase' && q.part === 'tens') {
      // what was built for "Byg kun tierne i 47": 4 cubes (the digit, not its value), 7 rods (the other digit as tens)
      if (v === tens) mis.push('faceValue')
      if (other !== 0 && other !== tens && v === other * 10) mis.push('digitSwap')
    } else {
      if (q.part === 'tens' && v === tens * 10) mis.push('faceValue')
      if (other !== 0 && other !== answer && v === other) mis.push('digitSwap')
    }
    operand = v === n
  } else {
    operand = v === n || v === tens * 10
  }
  const near = [1, 2, 10].includes(Math.abs(v - answer))
  return { mis, operand, near }
}

// ─── placeValue1000 ─────────────────────────────────────────────────────────

export interface PlaceValueQ {
  family: 'buildHTO' | 'zeroPlace' | 'digitValue' | 'expand' | 'regroup'
  /** The number the instance is about. */
  n: number
  /** digitValue/expand: the place asked about. */
  place?: 'h' | 't'
  /** regroup: the two counts said ("to hundreder og fjorten tiere": 2, 14) and their places. */
  counts?: [number, number]
  pair?: 'ht' | 'to'
}

const nonZeroParts = (n: number): number[] => [Math.floor(n / 100) * 100, (Math.floor(n / 10) % 10) * 10, n % 10].filter((x) => x > 0)

/**
 * pv:buildHTO:<100–999> · pv:zeroPlace:<one zero inside: 304, 320> · pv:digitValue:<h|t>:<n> (two or more
 * non-zero digits, the asked one non-zero) · pv:expand:<h|t>:<digits 1–9> · pv:regroup:<ht|to>:<1–8>:<11–19>.
 */
export function parsePlaceValue(id: string): PlaceValueQ | null {
  let m = /^pv:(buildHTO|zeroPlace):(\d+)$/.exec(id)
  if (m) {
    const n = Number(m[2])
    const zeros = digitsOf(n).filter((d) => d === 0).length
    if (n < 100 || n > 999) return null
    if (m[1] === 'zeroPlace' && zeros !== 1) return null
    return { family: m[1] as 'buildHTO', n }
  }
  m = /^pv:(digitValue|expand):(h|t):(\d+)$/.exec(id)
  if (m) {
    const n = Number(m[3])
    const place = m[2] as 'h' | 't'
    const d = place === 'h' ? Math.floor(n / 100) : Math.floor(n / 10) % 10
    if (n < 100 || n > 999 || d === 0) return null
    if (m[1] === 'expand' && digitsOf(n).includes(0)) return null
    if (m[1] === 'digitValue' && nonZeroParts(n).length < 2) return null
    return { family: m[1] as 'digitValue', n, place }
  }
  m = /^pv:regroup:(ht|to):(\d+):(\d+)$/.exec(id)
  if (m) {
    const [a, b] = [Number(m[2]), Number(m[3])]
    if (a < 1 || a > 9 || b < 10 || b > 19) return null
    const pair = m[1] as 'ht' | 'to'
    return { family: 'regroup', n: pair === 'ht' ? 100 * a + 10 * b : 10 * a + b, counts: [a, b], pair }
  }
  return null
}

/** The value a digitValue/expand question asks for: the hundreds or the tens of the number. */
export const placeValueOf = (q: PlaceValueQ): number =>
  q.place === 'h' ? Math.floor(q.n / 100) * 100 : (Math.floor(q.n / 10) % 10) * 10

/** The answer on cards, the keypad and the blocks. */
export const placeValueAnswer = (q: PlaceValueQ): number => (q.place ? placeValueOf(q) : q.n)

/** fillSlots writes the parts (400 + 70 + 2, any order) in digitValue and expand, else the digits. */
export const writesParts = (q: PlaceValueQ): boolean => q.family === 'digitValue' || q.family === 'expand'

/** The answer as the child works it out from the blocks, the words and the card. */
export function placeValueFromTask(t: Task, q: PlaceValueQ): number | null {
  const text = spokenText(t.speech)
  const p = t.prompt
  if (t.kind === 'buildBase') {
    if (text.startsWith('Byg tallet ')) return numbersIn(text)[0] ?? null
    if (text.startsWith('Byg kun hundrederne i ')) return 100 * Math.floor((numbersIn(text)[0] ?? NaN) / 100)
    if (text.startsWith('Byg kun tierne i ')) return 10 * (Math.floor((numbersIn(text)[0] ?? NaN) / 10) % 10)
    if (text.startsWith('Læg ')) return placeWordsValue(text)
    if (text.endsWith('Byg det, der mangler.')) return missingPart(p)
    return null
  }
  switch (q.family) {
    case 'buildHTO':
      return text.startsWith('Hvilket tal viser klodserne?') ? blocksValue(p) : null
    case 'zeroPlace':
    case 'regroup': {
      // the words and the blocks say the same number
      const v = placeWordsValue(text)
      return v !== null && v === blocksValue(p) ? v : null
    }
    case 'digitValue': {
      const said = numbersIn(text)
      if (said.length !== 1 || JSON.stringify(equationOf(p)) !== JSON.stringify([said[0]])) return null
      if (text.startsWith('Hvad er hundrederne værd i ')) return Math.floor(said[0] / 100) * 100
      if (text.startsWith('Hvad er tierne værd i ')) return (Math.floor(said[0] / 10) % 10) * 10
      return null
    }
    case 'expand':
      return missingPart(p)
  }
}

/**
 * pædagogik §3.2 for placeValue1000: addsPlaceParts (3 plader, 4 stænger og 5 terninger → 12),
 * zeroPlaceholder (304 → 34 or 340), concatNumberWords ("tre hundreder og fire enere" → 3004),
 * digitSwap (a concept here: 345 → 354), faceValue (7 for the tens of 472; '4|7|2' for 400 + 70 + 2),
 * the numbers given ('operand': the counts, the number, the shown parts) and near misses.
 */
export function explainPlaceValue(q: PlaceValueQ, v: AnswerValue): Why {
  const n = q.n
  const [h, tt, o] = [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10]
  if (typeof v === 'string') {
    const f = v.split('|').map(Number)
    if (writesParts(q)) {
      const set = (xs: readonly number[]) => [...xs].sort((a, b) => a - b).join('|')
      const digitsForParts = nonZeroParts(n).map((x) => Number(String(x)[0]))
      const swapped = swapTO(n)
      const mis: MisconceptionId[] = []
      if (set(f) === set(digitsForParts)) mis.push('faceValue')
      if (swapped !== null && set(f) === set(nonZeroParts(swapped))) mis.push('digitSwap')
      return { mis }
    }
    const written = Number(f.join(''))
    const mis: MisconceptionId[] = []
    // the zero is what buildHTO and zeroPlace are about (pædagogik §3.2); regroup is about the regrouping
    if (q.family !== 'regroup' && f.length === 3 && f[0] !== 0 && zeroSlips(n).includes(written)) mis.push('zeroPlaceholder')
    if (swapTO(n) === written) mis.push('digitSwap')
    return { mis }
  }
  const answer = placeValueAnswer(q)
  const near = [1, 2, 10, 100].includes(Math.abs(v - answer))
  const mis: MisconceptionId[] = []
  switch (q.family) {
    case 'buildHTO':
    case 'zeroPlace': {
      if (v === h + tt + o) mis.push('addsPlaceParts')
      if (zeroSlips(n).includes(v)) mis.push('zeroPlaceholder')
      if (v === swapTO(n)) mis.push('digitSwap')
      if (q.family === 'zeroPlace' && v === concatWords(n)) mis.push('concatNumberWords')
      // the counts in the picture (buildHTO) or the counts said (zeroPlace: no zero is said)
      const counts = q.family === 'buildHTO' ? [h, tt, o] : [h, tt || o]
      return { mis, operand: counts.includes(v), near }
    }
    case 'digitValue':
    case 'expand': {
      const d = answer / (q.place === 'h' ? 100 : 10)
      if (v === d) mis.push('faceValue')
      const shown = q.family === 'expand' ? nonZeroParts(n).filter((x) => x !== answer) : []
      const otherPlace = v === d * (q.place === 'h' ? 10 : 100)
      return { mis, operand: v === n || shown.includes(v), near, plain: otherPlace }
    }
    case 'regroup': {
      const [a, b] = q.counts!
      if (v === a + b) mis.push('addsPlaceParts')
      // SPEC §4.1: in placeValue1000 a reversed number is digitSwap (a concept here), whatever the family
      if (v === swapTO(n)) mis.push('digitSwap')
      const plain = v === 100 * a + b || v === answer - (q.pair === 'ht' ? 100 : 10)
      return { mis, operand: v === a || v === b, near, plain }
    }
  }
}

/** The number a fillSlots task writes: its digits, or the parts that make it. */
export const slotsTarget = (q: PlaceValueQ): { n: number; parts: boolean } => ({ n: q.n, parts: writesParts(q) })
