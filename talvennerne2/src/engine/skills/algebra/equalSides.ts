// equalSides — Lighedstegnet (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `eqs:`, four
// families. An instance is a true equation with one number marked '_' (the probe) and the value the
// probe shows in a true/false task: `eqs:<tf|add|sub|mix>:<left>=<right>:<shown>`, each side a number
// or a sum or difference of two (numbers to 20):
//   trueFalse      eqs:tf:7+2=_:9 · _=7+2 · 7+2=4+_ · 7+2=9+_ (x = 0, pædagogik's "7 + 2 = 9 + 0?")
//   balanceAdd     eqs:add:8+4=_+5:7 · 8+4=5+_ · _+5=8+4 · 5+_=8+4
//   balanceSub (3.)    eqs:sub:12-5=_-3:10 · 12-5=10-_ (and mirrored)
//   balanceMixed (3.)  eqs:mix:7+3=12-_:2 · 15-6=_+4 (and mirrored)
// Kinds: trueFalse ("Otte plus fire er lig med tolv plus fem. Er der lige meget på begge sider?" —
// answer 'yes'/'no', the probe shown with `shown`), choice and keypad (production; the probe is the
// blank: "Otte plus fire er lig med hvad plus fem?"). The scene is the seesaw (balance). Range 0–40.
// Speed: true/false 8 s, cards 9 s, keypad 12 s (a side must be worked out first).
// Wrong answers (pædagogik §3.2 equalsAsAnswer: "8 + 4 = □ + 5 → 12 or 17"): the value of the whole
// side written in the blank (12) and the sum carried on (12 + 5 → 17; with "□ − 3": 7 − 3), the numbers
// shown ('operand') and near misses (±1, ±2). The whole side's value is a number on the card in
// "7 + 2 = 9 + □" (9), so there it is 'ambiguous' (A9). On a true/false card the wrong judgment is
// equalsAsAnswer when a child who reads = as "the answer comes now" would give it: "7 + 2 = 9 + 2"
// looks right to them (the first number after = is the answer), "9 = 7 + 2" and "7 + 2 = 4 + 5" look
// wrong; otherwise it is 'other'.
// Hint: work out the whole side, then the missing number — "Regn først den side ud, hvor der ikke
// mangler noget. Otte plus fire giver tolv. Den anden side skal også give tolv. Tolv minus fem giver
// syv." True/false: "Otte plus fire giver tolv. Tolv plus fem giver sytten. Siderne giver ikke det
// samme." equalsAsAnswer says what the equals sign means first (an animated hint, SPEC §4.3).
import type { AnswerValue, ErrorTag, Fact, FamilyDef, HintSpec, Prompt, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import type { Term } from '../../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import { equationSpeech } from '../../../speech/equation'
import { answerIs, canonicalFacts, drawInstance, swapHint, type Drawer } from '../addsub/calc'

type Family = 'trueFalse' | 'balanceAdd' | 'balanceSub' | 'balanceMixed'
type Sign = '+' | '-'
/** A side: one number, or two with a sign; null marks the probe. */
interface Side { x: number | null; sign?: Sign; y?: number | null }
interface Eq { family: Family; left: Side; right: Side; shown: number }

const FAST: Partial<Record<TaskKind, number>> = { trueFalse: 8_000, choice: 9_000, keypad: 12_000 }
const META = metaOf('equalSides')
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))
const RANK: Readonly<Record<string, number>> = Object.fromEntries(FAMILIES.map((f) => [f.id, f.rank]))

// ─── Reading and writing ────────────────────────────────────────────────────

const CODE: Readonly<Record<Family, string>> = { trueFalse: 'tf', balanceAdd: 'add', balanceSub: 'sub', balanceMixed: 'mix' }
const FAMILY_OF: Readonly<Record<string, Family>> = Object.fromEntries(Object.entries(CODE).map(([f, c]) => [c, f as Family]))

const sideText = (s: Side) => {
  const n = (v: number | null | undefined) => (v === null || v === undefined ? '_' : String(v))
  return s.sign ? `${n(s.x)}${s.sign}${n(s.y)}` : n(s.x)
}
const idOf = (e: Eq) => `eqs:${CODE[e.family]}:${sideText(e.left)}=${sideText(e.right)}:${e.shown}`

function readSide(t: string): Side {
  const m = /^(\d+|_)(?:([+-])(\d+|_))?$/.exec(t)
  if (!m) throw new Error(`bad side ${t}`)
  const v = (s: string) => (s === '_' ? null : Number(s))
  return m[2] ? { x: v(m[1]), sign: m[2] as Sign, y: v(m[3]) } : { x: v(m[1]) }
}

/** The instance from its id (also for a fact the round screen rebuilt from its task). */
function parse(f: Pick<Fact, 'id'>): Eq {
  const m = /^eqs:([a-z]+):([^=]+)=([^:]+):(\d+)$/.exec(f.id)
  if (!m || !FAMILY_OF[m[1]]) throw new Error(`not an equalSides fact: ${f.id}`)
  return { family: FAMILY_OF[m[1]], left: readSide(m[2]), right: readSide(m[3]), shown: Number(m[4]) }
}

// ─── Values ─────────────────────────────────────────────────────────────────

const hasProbe = (s: Side) => s.x === null || s.y === null

function valueOf(s: Side, probe = 0): number {
  const x = s.x ?? probe
  if (!s.sign) return x
  const y = s.y ?? probe
  return s.sign === '+' ? x + y : x - y
}

/** The probe's true value. */
function solve(e: Eq): number {
  const [full, part] = hasProbe(e.left) ? [e.right, e.left] : [e.left, e.right]
  const v = valueOf(full)
  if (!part.sign) return v
  if (part.sign === '+') return v - (part.x ?? part.y ?? 0)
  return part.x === null ? v + (part.y ?? 0) : (part.x ?? 0) - v
}

const fullSide = (e: Eq): Side => (hasProbe(e.left) ? e.right : e.left)
const probeSide = (e: Eq): Side => (hasProbe(e.left) ? e.left : e.right)

const termsOf = (s: Side, probe: Term): Term[] => {
  const t = (v: number | null | undefined): Term => (v === null || v === undefined ? probe : { n: v })
  return s.sign ? [t(s.x), { op: s.sign === '+' ? '+' : '−' }, t(s.y)] : [t(s.x)]
}

/** The balance with the probe as a blank, a shown value or the answer. */
function balance(e: Eq, probe: Term): Extract<Prompt, { scene: 'balance' }> {
  return { scene: 'balance', left: termsOf(e.left, probe), right: termsOf(e.right, probe) }
}

const shownNumbers = (e: Eq): number[] =>
  [e.left.x, e.left.y, e.right.x, e.right.y].filter((v): v is number => typeof v === 'number')

/** What a child who reads = as "the answer comes now" says to the statement as shown. */
function readerSays(e: Eq): 'yes' | 'no' {
  const left = e.left.x === null || e.left.y === null ? { ...e.left, ...(e.left.x === null ? { x: e.shown } : { y: e.shown }) } : e.left
  if (!left.sign) return e.right.sign ? 'no' : left.x === valueOf(e.right, e.shown) ? 'yes' : 'no'
  const first = e.right.x ?? e.shown
  return first === valueOf(left) ? 'yes' : 'no'
}

const truth = (e: Eq): 'yes' | 'no' => (e.shown === solve(e) ? 'yes' : 'no')

// ─── Instances ──────────────────────────────────────────────────────────────

const make = (family: Family, left: Side, right: Side, shown: number): Fact | null => {
  const e: Eq = { family, left, right, shown }
  const x = solve(e)
  if (x < 0 || shown < 0 || Math.max(...shownNumbers(e), x, shown) > 20) return null
  return { id: idOf(e), skill: 'equalSides', family, operands: shownNumbers(e), answer: x, rank: RANK[family] }
}

/** The probe's value on a true/false card: right half the time, else a near or tempting value. */
function shownFor(rng: Rng, x: number, tempting: number | null): number {
  const r = rng.next()
  if (r < 0.5) return x
  if (tempting !== null && tempting !== x && r < 0.75) return tempting
  const near = x + rng.pick([-2, -1, 1, 2])
  return near >= 0 ? near : x + 1
}

const sum = (a: number, b: number): Side => ({ x: a, sign: '+', y: b })
const diff = (a: number, b: number): Side => ({ x: a, sign: '-', y: b })

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    switch (family as Family) {
      case 'trueFalse': {
        const a = rng.between(1, 10)
        const b = rng.between(1, 10)
        const v = a + b
        if (v > 20) return null
        switch (rng.pick(['sum', 'first', 'both', 'trap'] as const)) {
          case 'sum':
            return make('trueFalse', sum(a, b), { x: null }, shownFor(rng, v, null))
          case 'first':
            return make('trueFalse', { x: null }, sum(a, b), shownFor(rng, v, null))
          case 'both': {
            const p = rng.between(1, v - 1)
            if (p === a || p === b) return null
            return make('trueFalse', sum(a, b), { x: p, sign: '+', y: null }, shownFor(rng, v - p, v))
          }
          case 'trap':
            return make('trueFalse', sum(a, b), { x: v, sign: '+', y: null }, rng.next() < 0.4 ? 0 : rng.between(1, 3))
        }
        return null
      }
      case 'balanceAdd': {
        const a = rng.between(2, 9)
        const b = rng.between(2, 9)
        const v = a + b
        const d = rng.between(1, v - 1)
        if (d === a || d === b || v < 6) return null
        const x = v - d
        const full = sum(a, b)
        const shown = shownFor(rng, x, v)
        switch (rng.int(4)) {
          case 0: return make('balanceAdd', full, { x: null, sign: '+', y: d }, shown)
          case 1: return make('balanceAdd', full, { x: d, sign: '+', y: null }, shown)
          case 2: return make('balanceAdd', { x: null, sign: '+', y: d }, full, shown)
          default: return make('balanceAdd', { x: d, sign: '+', y: null }, full, shown)
        }
      }
      case 'balanceSub': {
        const a = rng.between(10, 20)
        const b = rng.between(2, 9)
        const v = a - b
        if (rng.next() < 0.5) {
          const d = rng.between(1, 9)
          const part: Side = { x: null, sign: '-', y: d }
          const shown = shownFor(rng, v + d, v)
          return rng.next() < 0.5 ? make('balanceSub', diff(a, b), part, shown) : make('balanceSub', part, diff(a, b), shown)
        }
        const c = rng.between(v + 1, 20)
        if (c === a) return null
        const part: Side = { x: c, sign: '-', y: null }
        const shown = shownFor(rng, c - v, v)
        return rng.next() < 0.5 ? make('balanceSub', diff(a, b), part, shown) : make('balanceSub', part, diff(a, b), shown)
      }
      case 'balanceMixed': {
        if (rng.next() < 0.5) {
          const a = rng.between(2, 9)
          const b = rng.between(2, 9)
          const v = a + b
          const c = rng.between(v + 1, 20)
          if (v >= 20) return null
          const part: Side = { x: c, sign: '-', y: null }
          const shown = shownFor(rng, c - v, v)
          return rng.next() < 0.5 ? make('balanceMixed', sum(a, b), part, shown) : make('balanceMixed', part, sum(a, b), shown)
        }
        const a = rng.between(10, 20)
        const b = rng.between(2, 9)
        const v = a - b
        const d = rng.between(1, v - 1)
        const part: Side = { x: null, sign: '+', y: d }
        const shown = shownFor(rng, v - d, v)
        return rng.next() < 0.5 ? make('balanceMixed', diff(a, b), part, shown) : make('balanceMixed', part, diff(a, b), shown)
      }
      default:
        return null
    }
  },
}

const CANON = canonicalFacts('equalSides', drawer, FAMILIES)

// ─── Wrong answers ──────────────────────────────────────────────────────────

/** equalsAsAnswer values for the blank: the whole side's value, and the sum carried on with the probe's side. */
function equalsValues(e: Eq): number[] {
  const v = valueOf(fullSide(e))
  const part = probeSide(e)
  const out = [v]
  if (part.sign === '+') out.push(v + (part.x ?? part.y ?? 0))
  if (part.sign === '-' && part.x === null) out.push(v - (part.y ?? 0))
  return out
}

// ─── Speech and hints ───────────────────────────────────────────────────────

const OP: Readonly<Record<Sign, string>> = { '+': 'op.plus', '-': 'op.minus' }

/** "Otte plus fire giver tolv." (nothing for a single number). */
function sideSays(s: Side, probe: number): SpeechPart[] {
  if (!s.sign) return []
  return [num(s.x ?? probe, 'mid'), say(OP[s.sign]), num(s.y ?? probe, 'mid'), say('op.giver'), num(valueOf(s, probe))]
}

/** The missing number from the whole side's value: "Tolv minus fem giver syv." */
function solveSays(e: Eq): SpeechPart[] {
  const v = valueOf(fullSide(e))
  const part = probeSide(e)
  const x = solve(e)
  if (!part.sign) return answerIs(x)
  if (part.sign === '+') return [num(v, 'mid'), say('op.minus'), num(part.x ?? part.y ?? 0, 'mid'), say('op.giver'), num(x)]
  if (part.x === null) return [num(v, 'mid'), say('op.plus'), num(part.y ?? 0, 'mid'), say('op.giver'), num(x)]
  return [num(part.x, 'mid'), say('op.minus'), num(v, 'mid'), say('op.giver'), num(x)]
}

/**
 * "Otte plus fire er lig med hvad plus fem?" — read term by term (equation.ts would close the sentence
 * on the last number of "7 + 2 = 9 + □"); the last number is in end form only when nothing follows it.
 */
function askSays(e: Eq): SpeechPart[] {
  const b = balance(e, { blank: true })
  const terms: Term[] = [...b.left, { op: '=' }, ...b.right]
  const last = terms.length - 1
  return terms.map((t, i): SpeechPart => {
    if ('n' in t) return num(t.n, i === last ? 'end' : 'mid')
    if ('op' in t) return say(t.op === '=' ? 'op.er_lig_med' : t.op === '+' ? 'op.plus' : 'op.minus')
    return say('frag.hvad')
  })
}

function hint(f: Fact, tag: ErrorTag | null, kind?: TaskKind): HintSpec {
  const e = parse(f)
  const x = solve(e)
  const lead = tag === 'equalsAsAnswer' ? [say('hint.algebra2.sameBothSides')] : []
  const mark = (speech: SpeechPart[], visual: HintSpec['visual']) =>
    tag === 'equalsAsAnswer' ? hintOf(speech, visual, 'equalsAsAnswer', true) : hintOf(speech, visual)
  if (kind === 'trueFalse') {
    const words = [...sideSays(e.left, e.shown), ...sideSays(e.right, e.shown), say(truth(e) === 'yes' ? 'hint.equalSides.both' : 'hint.equalSides.notBoth')]
    return mark([...lead, ...words], balance(e, { n: e.shown }))
  }
  if (tag === 'digitSwap') return swapHint(x)
  const words = [
    say('hint.equalSides.fullSide'), ...sideSays(fullSide(e), x),
    say('hint.equalSides.otherSide'), num(valueOf(fullSide(e))),
    ...solveSays(e),
  ]
  return mark([...lead, ...words], balance(e, { n: x }))
}

export default {
  ...META,
  families: FAMILIES,
  kinds: ['trueFalse', 'choice', 'keypad'],
  enumerate: () => [...CANON],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawInstance(drawer, family, rng, avoid),
  answerType: () => 'int',
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'trueFalse' ? 'token' : 'int'),
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'trueFalse' ? truth(parse(f)) : solve(parse(f))),
  prompt: (f, kind) => {
    const e = parse(f)
    return balance(e, kind === 'trueFalse' ? { n: e.shown } : { blank: true })
  },
  optionView: (_f, kind) => (kind === 'trueFalse' ? 'yesNo' : 'numeral'),
  range: () => [0, 40],
  speech: (f, kind) => {
    const e = parse(f)
    if (kind !== 'trueFalse') return askSays(e)
    const b = balance(e, { n: e.shown })
    return [...equationSpeech([...b.left, { op: '=' }, ...b.right]), say('s.equalSides.same')]
  },
  candidates(f) {
    const e = parse(f)
    const x = solve(e)
    const t = truth(e)
    const wrong = t === 'yes' ? 'no' : 'yes'
    return [
      ...tagged(x, [
        ...equalsValues(e).map((v) => [v, 'equalsAsAnswer'] as const),
        ...shownNumbers(e).map((n) => [n, 'operand'] as const),
        [x + 1, 'near'], [x - 1, 'near'], [x + 2, 'near'], [x - 2, 'near'],
      ]),
      { value: wrong, tag: readerSays(e) === wrong ? 'equalsAsAnswer' : 'other' },
    ]
  },
  hint,
  fastMs: (_f: Fact, kind: TaskKind) => FAST[kind],
} satisfies SkillModule
