// Words and pictures for the rewards of a round: what "Det lærte du" shows for a key that moved, and
// the icon and sentence of each small "Også i dag" card. Pure; the screens render it.
//
// "Det lærte du" is concrete and true (review r1 P2-2): it shows the facts and numbers that moved in
// this round — "3 + 4 = 7", the number 4 as the child counted it, "Tallet efter" — never a sentence
// about a whole skill ("Jeg kan tælle til ti"), and "Det sidder fast" only at box 5 and never right
// after a failed trial. A fact is shown whole (QA2 P1-1): a time as a clock and its words ("kvart i
// ni", never the 525 minutes of its answer), a coin as the coin, and a number only with what it is
// about ("Halvdelen af 8 er 4", "3 grupper med 4 er 12"). Only a number the child counted or heard
// is the fact by itself.
import { ITEM_BY_ID } from '../../../../content/catalog'
import { REGION_BY_ID } from '../../../../content/curriculum'
import { factsOf, keyInfo, skillRegistry, type SkillRegistry } from '../../../../engine/registry'
import { hashSeed, makeRng } from '../../../../engine/rng'
import type { Box, ClipId, Fact, MasteryKey, Prompt, ShapeId, SkillDef, SkillId, SpeechForm, SpeechPart, Term } from '../../../../engine/types'
import type { CeremonyCard } from '../../../../meta/ceremonyQueue'
import type { Reward } from '../../../../meta/rewards'
import { hasClip } from '../../../../speech/catalog'
import { dayPartClip, dialMinutes } from '../../../../speech/clock'
import { equationSpeech } from '../../../../speech/equation'
import { shapeClip } from '../../../../speech/nouns'
import type { IconName } from '../../../design/icons'
import { goalSpeech } from '../map/words'

/** A recall fact id as an equation with its answer (CONVENTIONS.md "Fact-id'er"), or null. */
export function factTerms(key: MasteryKey): Term[] | null {
  let m: RegExpMatchArray | null
  const eq = (a: number, op: Term, b: number, c: number): Term[] => [{ n: a }, op, { n: b }, { op: '=' }, { n: c }]
  if ((m = /^add:(\d+)\+(\d+)$/.exec(key))) return eq(+m[1], { op: '+' }, +m[2], +m[1] + +m[2])
  if ((m = /^sub:(\d+)-(\d+)$/.exec(key))) return eq(+m[1], { op: '−' }, +m[2], +m[1] - +m[2])
  if ((m = /^ten:(\d+)$/.exec(key))) return eq(+m[1], { op: '+' }, 10 - +m[1], 10)
  if ((m = /^dbl:(\d+)$/.exec(key))) return eq(+m[1], { op: '+' }, +m[1], 2 * +m[1])
  if ((m = /^mp:(\d+)\+\?=(\d+)$/.exec(key))) return eq(+m[1], { op: '+' }, +m[2] - +m[1], +m[2])
  if ((m = /^mul:(\d+)x(\d+)$/.exec(key))) return eq(+m[1], { op: '·' }, +m[2], +m[1] * +m[2])
  if ((m = /^div:(\d+)\/(\d+)$/.exec(key))) return eq(+m[1], { op: ':' }, +m[2], +m[1] / +m[2])
  return null
}

/** "Jeg kan …" for a skill, when its sentence is recorded. */
export function canDoClip(skill: SkillId): ClipId | null {
  const id = `s.cando.${skill}`
  return hasClip(id) ? id : null
}

/** How a key that moved is shown: the sum, the number (as it was counted), the figure, the pattern, or its name. */
export type LearnedFace =
  | { t: 'eq'; terms: Term[] }
  /** A number: `picture` is what the child counted (null: the number was heard). */
  | { t: 'number'; n: number; picture: Prompt | null }
  /** A time on the dial (minutes 0–719): a small clock and the time in words. */
  | { t: 'clock'; minutes: number }
  /** A coin or a note (øre): the piece and its value. */
  | { t: 'money'; ore: number }
  /**
   * A fact in words with its numbers ("Halvdelen af 8 er 4", "3 sider"): `parts` is what the card
   * shows (numbers as numerals), with the figure it is about when there is one.
   */
  | { t: 'phrase'; parts: SpeechPart[]; figure: { shape: ShapeId; variant: number; mark?: 'sides' | 'corners' } | null }
  | { t: 'shape'; shape: ShapeId; variant: number }
  /** A pattern family, drawn as beads ('red', 'blue' …). */
  | { t: 'beads'; beads: string[] }
  | { t: 'label'; clip: ClipId }
  /**
   * A fact of 3. klasse in its own words (QA3a P2-1): `parts` is what the card shows (numbers, money,
   * lengths and fractions as numerals, times in words), with a small picture of what it is about.
   */
  | { t: 'fact'; parts: SpeechPart[]; pic: LearnedPic | null }
  /** Nothing concrete to show: only the badge. */
  | { t: 'none' }

/** The small picture beside a fact of 3. klasse. */
export type LearnedPic =
  /** A dial at `minutes` with the long hand's way shaded (clockwise); `digital` adds the digital clock. */
  | { t: 'dial'; minutes: number; sweep?: { from: number; to: number }; digital?: boolean }
  /** A 24-hour digital clock (0–1439). */
  | { t: 'digital'; minutes: number }
  /** Coins and notes (øre), biggest first. */
  | { t: 'coins'; ore: number[] }
  /** A point in a coordinate grid. */
  | { t: 'coords'; w: number; h: number; x: number; y: number }
  /** A figure of squares (Prompt 'area'). */
  | { t: 'area'; w: number; h: number; cells: number[] }
  | { t: 'fraction'; shape: 'circle' | 'rect' | 'bar' | 'square'; parts: number; colored: number }
  /** Fraction bars ('1/2', '1/3' …) in the order the fact names them. */
  | { t: 'bars'; fracs: string[] }
  | { t: 'shapes'; items: { shape: ShapeId; variant: number }[] }

export interface LearnedItem {
  key: string
  face: LearnedFace
  badge: ClipId
  speech: SpeechPart[]
}

/** What the round tells "Det lærte du" besides the reward. */
export interface LearnedContext {
  /** The keys answered right at the first try in this round, to make a family's first right answer concrete. */
  correct?: readonly { key: MasteryKey; skill: SkillId }[]
  /** The round was a trial that did not pass: nothing "sits" yet, whatever the boxes say. */
  failedTrial?: boolean
  /**
   * The instance of a procedure key the child last answered right (KeyState.recent): a family of
   * 3. klasse shows that one ("403 − 158 = 245"), not just its name (QA3a P2-1).
   */
  instanceOf?: (key: MasteryKey) => string | undefined
  skills?: SkillRegistry
}

/**
 * How well a key that moved sits, honestly: box 1 is a good start, box 2 better, box 3–4 going well,
 * and only box 5 (never right after a failed trial) "sits".
 */
export function boxBadge(box: Box, failedTrial = false): ClipId {
  if (box >= 5 && !failedTrial) return 's.reward.learned.box5'
  if (box >= 3) return 's.reward.learned.box3'
  return box >= 2 ? 's.reward.learned.moved' : 's.reward.learned.started'
}

/** A pattern family as eight beads or fewer (procedure key `patterns/<family>`). */
const PATTERN_BEADS: Readonly<Record<string, string[]>> = {
  AB: ['red', 'blue', 'red', 'blue'],
  AAB: ['red', 'red', 'blue', 'red', 'red', 'blue'],
  ABB: ['red', 'blue', 'blue', 'red', 'blue', 'blue'],
  ABC: ['red', 'blue', 'yellow', 'red', 'blue', 'yellow'],
  growing: ['red', 'blue', 'red', 'blue', 'blue'],
}

const said = (clip: ClipId): SpeechPart[] => (hasClip(clip) ? [{ clip }] : [])

function safely<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch {
    return null
  }
}

/**
 * Recall skills whose fact is the number itself: the number the child counted (count10's four dots
 * are "4") or heard (hear20). Any other number is shown with what it is about, or not at all.
 */
export const NUMBER_IS_FACT: ReadonlySet<SkillId> = new Set<SkillId>(['count10', 'count20', 'hear20'])

/** "Klokken er kvart i ni." — the clock's own phrase, never the minutes of the answer. */
export function clockSpeech(minutes: number): SpeechPart[] {
  return [{ clip: 'frag.klokken_er' }, { clock: { minutes: dialMinutes(minutes), style: 'analog', form: 'end' } }]
}

const whole = (w: string): { shape: ShapeId; big: boolean } =>
  w === 'big-triangle' ? { shape: 'triangle', big: true } : w === 'big-square' ? { shape: 'square', big: true } : { shape: w as ShapeId, big: false }

/** composeShapes in its own words: "6 trekanter giver en sekskant", "6 trekanter giver 3 romber". */
function composedParts(id: string, answer: number): SpeechPart[] | null {
  const make = /^cps:m:([a-z-]+):([a-z]+)$/.exec(id)
  const take = /^cps:k:(\d+):([a-z]+):([a-z-]+)$/.exec(id)
  if (!make && !take) return null
  const w = whole(make ? make[1] : take![3])
  const piece = (make ? make[2] : take![2]) as ShapeId
  const pieces: SpeechPart = { clip: w.big ? `s.composeShapes.small.${piece}.mid` : shapeClip(piece, 'pl', 'mid') }
  const wholeSays = (kind: 'indef' | 'pl'): SpeechPart => ({ clip: w.big ? `s.composeShapes.big.${w.shape}.${kind}.end` : shapeClip(w.shape, kind, 'end') })
  if (make) return [{ num: answer, form: 'mid' }, pieces, { clip: 'hint.composeShapes.give' }, wholeSays('indef')]
  return [{ num: Number(take![1]), form: 'mid' }, pieces, { clip: 'hint.composeShapes.give' }, { num: answer, form: 'mid' }, wholeSays('pl')]
}

/**
 * A number fact with what it is about (CONVENTIONS fact ids): the face and what is said. Null when the
 * skill has no such words yet — then the fact is left out rather than shown as a bare number.
 */
function numberFact(id: string, answer: number): { face: LearnedFace; speech: SpeechPart[] } | null {
  let m: RegExpMatchArray | null
  const phrase = (parts: SpeechPart[], speech = parts, figure: Extract<LearnedFace, { t: 'phrase' }>['figure'] = null) =>
    ({ face: { t: 'phrase' as const, parts, figure }, speech })
  if ((m = /^hlf:(\d+)$/.exec(id))) {
    return phrase([{ clip: 's.ceremony.learned.halfOf' }, { num: +m[1], form: 'mid' }, { clip: 'hint.halves.is' }, { num: answer, form: 'end' }])
  }
  if ((m = /^grp:(\d+)x(\d+)$/.exec(id))) {
    return phrase([{ num: +m[1], form: 'mid' }, { clip: 's.groupsOf.groupsWith' }, { num: +m[2], form: 'mid' }, { clip: 'hint.groupsOf.is' }, { num: answer, form: 'end' }])
  }
  if ((m = /^shr:(\d+):(\d+)$/.exec(id))) {
    // shared out as "delt med" in 2. klasse (SPEC A12)
    const terms: Term[] = [{ n: +m[1] }, { op: ':' }, { n: +m[2] }, { op: '=' }, { n: answer }]
    return { face: { t: 'eq', terms }, speech: [{ num: +m[1], form: 'mid' }, { clip: 'frag.muldiv.delt_med' }, { num: +m[2], form: 'mid' }, { clip: 'op.er_lig_med' }, { num: answer, form: 'end' }] }
  }
  if ((m = /^sc:([sc]):([a-z]+):(\d+)$/.exec(id))) {
    const what = m[1] === 's' ? 'sides' : 'corners'
    const word: SpeechPart = { clip: `hint.sidesCorners.${what}` }
    return phrase([{ num: answer, form: 'mid' }, word], [{ clip: 'hint.sidesCorners.has' }, { num: answer, form: 'mid' }, word], {
      shape: m[2] as ShapeId, variant: +m[3], mark: what,
    })
  }
  const composed = composedParts(id, answer)
  return composed ? phrase(composed) : null
}

// ─── Stjernefjeldet (3. klasse): a family's fact as the instance answered right (QA3a P2-1) ───

type Got = { face: LearnedFace; speech: SpeechPart[] }
type Denom = 2 | 3 | 4 | 5 | 6 | 8

/** A family of 3. klasse: the families of Stjernefjeldet's regions, also those of wave 2 skills. */
export function isFjeldFamily(def: SkillDef, family: string): boolean {
  return (def.families.find((f) => f.id === family)?.grade ?? def.grade) >= 3
}

const N = (n: number, form: SpeechForm = 'mid', gender?: 'c' | 'n'): SpeechPart => (gender ? { num: n, form, gender } : { num: n, form })
const C = (clip: ClipId): SpeechPart => ({ clip })
const KR = (ore: number, form: SpeechForm = 'mid'): SpeechPart => ({ money: { ore, form } })
const CM = (value: number, unit: 'cm' | 'm', form: SpeechForm = 'mid'): SpeechPart => ({ measure: { value, unit, form } })
const FR = (n: number, d: number, form: SpeechForm = 'mid'): SpeechPart => ({ frac: { n, d: d as Denom, form } })
const eqGot = (terms: Term[]): Got => ({ face: { t: 'eq', terms }, speech: equationSpeech(terms) })
const factGot = (parts: SpeechPart[], pic: LearnedPic | null = null, speech: SpeechPart[] = parts): Got => ({ face: { t: 'fact', parts, pic }, speech })
const sum = (a: number, op: '+' | '−' | '·' | ':', b: number, c: number): Got => eqGot([{ n: a }, { op }, { n: b }, { op: '=' }, { n: c }])

/** The fewest coins and notes for an amount (Danish money is canonical: biggest first is fewest). */
function fewest(ore: number, pieces: readonly number[]): number[] {
  const out: number[] = []
  let left = ore
  for (const p of pieces) {
    while (left >= p) {
      left -= p
      out.push(p)
    }
  }
  return left === 0 ? out : []
}
const KRONE_PIECES = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100]

/** "12-5" → x − y; "_" is the unknown of a balance. */
function side(t: string): { x: number | null; op: '+' | '−' | null; y: number | null } | null {
  const m = /^(\d+|_)(?:([+-])(\d+|_))?$/.exec(t)
  if (!m) return null
  const v = (s: string | undefined) => (s === undefined || s === '_' ? null : Number(s))
  return { x: v(m[1]), op: m[2] ? (m[2] === '+' ? '+' : '−') : null, y: v(m[3]) }
}

/** A balance of equalSides with its unknown filled in: 13 − 2 = 15 − 4. */
function balance(left: string, right: string): Term[] | null {
  const l = side(left)
  const r = side(right)
  if (!l || !r) return null
  const value = (s: NonNullable<typeof l>) => (s.op === null ? s.x : s.x === null || s.y === null ? null : s.op === '+' ? s.x + s.y : s.x - s.y)
  const [whole, part] = value(l) !== null ? [l, r] : [r, l]
  const v = value(whole)
  if (v === null) return null
  if (part.x === null) part.x = part.op === null ? v : part.op === '+' ? v - (part.y ?? 0) : v + (part.y ?? 0)
  else if (part.y === null) part.y = part.op === '+' ? v - part.x : part.x - v
  const terms = (s: typeof l): Term[] => (s.op === null ? [{ n: s.x! }] : [{ n: s.x! }, { op: s.op }, { n: s.y! }])
  return [...terms(l), { op: '=' }, ...terms(r)]
}

/** What one instance id of a family of 3. klasse says (null: an id this does not know). */
function fjeldFact(def: SkillDef, id: string, fact: Fact | undefined): Got | null {
  let m: RegExpMatchArray | null
  const rng = () => makeRng(hashSeed(id))
  switch (def.id) {
    case 'mulTens':
      return (m = /^mt:(\d+)x(\d+)$/.exec(id)) ? sum(+m[1], '·', +m[2], +m[1] * +m[2]) : null
    case 'add1000':
      return (m = /^a1000:(\d+)\+(\d+)$/.exec(id)) ? sum(+m[1], '+', +m[2], +m[1] + +m[2]) : null
    case 'sub1000':
      return (m = /^s1000:(\d+)-(\d+)$/.exec(id)) ? sum(+m[1], '−', +m[2], +m[1] - +m[2]) : null
    case 'inverseOps':
      return (m = /^inv:\d+x\d+:(\d+)\/(\d+)$/.exec(id)) ? sum(+m[1], ':', +m[2], +m[1] / +m[2]) : null
    case 'equalSides': {
      const terms = (m = /^eqs:[a-z]+:([^=]+)=([^:]+):\d+$/.exec(id)) ? balance(m[1], m[2]) : null
      return terms ? eqGot(terms) : null
    }
    case 'numberLine1000': {
      if (!(m = /^nl1000:round(10|100):(\d+)$/.exec(id))) return null
      const step = +m[1]
      return factGot([N(+m[2]), C('s.learned.closestTo'), N(Math.round(+m[2] / step) * step, 'end')])
    }
    case 'placeValue1000': {
      if (!(m = /^pv:regroup:(ht|to):(\d+):(\d+)$/.exec(id))) return null
      const [big, small] = m[1] === 'ht' ? (['h', 't'] as const) : (['t', 'o'] as const)
      const a = +m[2]
      const b = +m[3]
      const count = (k: number, place: 'h' | 't' | 'o'): SpeechPart[] => [
        N(k, 'mid', k === 1 && place === 'h' ? 'n' : undefined), C(`noun.place.${place}.${k === 1 ? 'sg' : 'pl'}.mid`),
      ]
      const total = m[1] === 'ht' ? 100 * a + 10 * b : 10 * a + b
      return factGot([...count(a, big), C('op.og'), ...count(b, small), C('hint.place.is'), N(total, 'end')])
    }
    case 'clockFive': {
      if (!(m = /^fem:([a-zA-Z]+):(\d+)$/.exec(id))) return null
      const at = dialMinutes(+m[2])
      const style = m[1] === 'halfForm' ? 'analogHalfForm' : 'analog'
      const time: SpeechPart = { clock: { minutes: at, style, form: 'end' } }
      return factGot([time], { t: 'dial', minutes: at }, [C('frag.klokken_er'), time])
    }
    case 'clockDigital': {
      if (!(m = /^dig:(analogToDigital|digital24):(\d+)$/.exec(id))) return null
      const at = +m[2]
      const digital: SpeechPart[] = [C('s.clockDigital.shows'), { clock: { minutes: at, style: 'digital', form: 'end' } }]
      if (m[1] === 'analogToDigital') {
        const time: SpeechPart = { clock: { minutes: at, style: 'analog', form: 'end' } }
        return factGot([time], { t: 'dial', minutes: dialMinutes(at), digital: true }, [C('frag.klokken_er'), time, ...digital])
      }
      const time: SpeechPart[] = [{ clock: { minutes: at, style: 'analog', form: 'mid' } }, C(dayPartClip(at))]
      return factGot(time, { t: 'digital', minutes: at }, [C('frag.klokken_er'), ...time, ...digital])
    }
    case 'clockElapsed': {
      if (!(m = /^tid:(plusHour|plusHalf|plusQuarter|minusHalf):(\d+)$/.exec(id))) return null
      const from = dialMinutes(+m[2])
      const delta = { plusHour: 60, plusHalf: 30, plusQuarter: 15, minusHalf: -30 }[m[1] as 'plusHour']
      const to = dialMinutes(from + delta)
      const parts: SpeechPart[] = [
        C(`hint.clockElapsed.d.${m[1]}`), { clock: { minutes: from, style: 'analog', form: 'mid' } },
        C(delta < 0 ? 'hint.clockElapsed.was' : 'hint.clockElapsed.is'), { clock: { minutes: to, style: 'analog', form: 'end' } },
      ]
      return factGot(parts, { t: 'dial', minutes: to, sweep: delta < 0 ? { from: to, to: from } : { from, to } })
    }
    case 'change': {
      if (!(m = /^byt:from100:(\d+)$/.exec(id))) return null
      const back = 10000 - +m[1]
      const parts = [C('hint.change.from'), N(+m[1] / 100), C('hint.change.to'), N(100), C('hint.change.is'), KR(back, 'end')]
      return factGot(parts, { t: 'coins', ore: fewest(back, KRONE_PIECES.slice(3)) })
    }
    case 'kronerOre': {
      if (!(m = /^kro:(readAmount|fiftiesInKroner|addHalves):(\d+)$/.exec(id))) return null
      const p = +m[2]
      if (m[1] === 'readAmount') return factGot([KR(p, 'end')], { t: 'coins', ore: fewest(p, [...KRONE_PIECES.slice(4), 50]) })
      if (m[1] === 'fiftiesInKroner') {
        const k = p / 50
        return factGot([N(k), C('noun.coin.50.pl.mid'), C('hint.change.is'), KR(p, 'end')], k <= 8 ? { t: 'coins', ore: Array<number>(k).fill(50) } : null)
      }
      return factGot([KR(p), C('op.plus'), KR(p), C('op.giver'), KR(2 * p, 'end')])
    }
    case 'payExact': {
      if (!(m = /^pay:fewestCoins:(\d+)$/.exec(id))) return null
      const pieces = fewest(+m[1], KRONE_PIECES)
      // "… En tyvekrone, en tikrone, en femkrone og to tokroner."
      const kinds = [...new Set(pieces)]
      const named = kinds.flatMap((piece, i): SpeechPart[] => {
        const k = pieces.filter((x) => x === piece).length
        const form = i === kinds.length - 1 ? 'end' : 'mid'
        const and = i > 0 && i === kinds.length - 1 ? [C('op.og')] : []
        return k === 1 ? [...and, C(`noun.coin.${piece}.indef.${form}`)] : [...and, N(k), C(`noun.coin.${piece}.pl.${form}`)]
      })
      return factGot([KR(+m[1], 'end')], { t: 'coins', ore: pieces }, [KR(+m[1], 'end'), ...named])
    }
    case 'convertCmM': {
      const is = C('hint.convertCmM.is')
      if ((m = /^cmm:mToCm:(\d+)$/.exec(id))) return factGot([CM(+m[1], 'm'), is, CM(100 * +m[1], 'cm', 'end')])
      if ((m = /^cmm:mCmToCm:(\d+):(\d+)$/.exec(id))) {
        return factGot([CM(+m[1], 'm'), C('op.og'), CM(+m[2], 'cm'), is, CM(100 * +m[1] + +m[2], 'cm', 'end')])
      }
      if ((m = /^cmm:cmToMCm:(\d+)$/.exec(id))) {
        const cm = +m[1]
        const rest = cm % 100
        const meters = CM(Math.floor(cm / 100), 'm', rest ? 'mid' : 'end')
        return factGot([CM(cm, 'cm'), is, meters, ...(rest ? [C('op.og'), CM(rest, 'cm', 'end')] : [])])
      }
      if ((m = /^cmm:compareMixed:(\d+):(\d+)$/.exec(id))) {
        return factGot([CM(+m[1], 'm'), is, CM(100 * +m[1] - +m[2], 'cm'), C('s.learned.longerThan'), CM(+m[2], 'cm', 'end')])
      }
      return null
    }
    case 'unitChoice': {
      const unit = /^unit:(g|kg)$/.exec(String(fact?.answer ?? ''))
      if (!(m = /^enh:weight:([a-zA-Z]+)$/.exec(id)) || !unit) return null
      return factGot([C(`noun.mt.${m[1]}`), C('hint.unitChoice.weighedIn'), C(`noun.unit.${unit[1]}.end`)])
    }
    case 'area': {
      if (!/^ara:[nrlc]:/.test(id)) return null
      const p = def.prompt({ id, skill: 'area', family: '', operands: [], answer: 0, rank: 0 }, 'choice', rng())
      if (p.scene !== 'area') return null
      const pic: LearnedPic = { t: 'area', w: p.w, h: p.h, cells: [...p.cells] }
      if ((m = /^ara:c:(\d+)x(\d+)-(\d+)x(\d+)$/.exec(id))) {
        const more = Math.abs(+m[1] * +m[2] - +m[3] * +m[4])
        return factGot([C('s.learned.area.bigger'), N(more, 'mid', more === 1 ? 'n' : undefined), C(more === 1 ? 's.learned.area.moreOne' : 's.learned.area.more')], pic)
      }
      return factGot([C('hint.area.covers'), N(p.cells.length), C(shapeClip('square', 'pl', 'end'))], pic)
    }
    case 'gridCoords': {
      if (!(m = /^crd:[rp]:(\d+),(\d+)$/.exec(id))) return null
      const [x, y] = [+m[1], +m[2]]
      const said = [C('hint.gridCoords.go'), N(x), C('hint.gridCoords.alongThen'), N(y), C('hint.gridCoords.upThere')]
      return factGot([{ free: `(${x}, ${y})` }], { t: 'coords', w: Math.max(6, x), h: Math.max(6, y), x, y }, said)
    }
    case 'sortShapes': {
      if (!/^srt:rightAngle:\d+$/.test(id)) return null
      // the plate is drawn from the id, so an instance rebuilt from it has the same figures
      const plate = fact ?? { id, skill: 'sortShapes', family: 'rightAngle', operands: [], answer: '', rank: 0 }
      const p = def.prompt(plate, 'multiSelect', rng())
      const answerOf = (def as SkillDef & { answer?: (f: Fact, kind: 'multiSelect') => unknown }).answer
      const right = new Set(String(answerOf ? answerOf(plate, 'multiSelect') : plate.answer).split('|'))
      if (p.scene !== 'shapes') return null
      const items = p.items.filter((it) => right.has(it.id)).slice(0, 3).map(({ shape, variant }) => ({ shape, variant }))
      return items.length > 0 ? factGot([C('s.learned.rightAngles')], { t: 'shapes', items }) : null
    }
    case 'skipCount': {
      if (!(m = /^skc:step25:(\d+):(\d+)$/.exec(id))) return null
      const start = +m[1]
      const row = Array.from({ length: +m[2] + 1 }, (_, i) => start + 25 * i)
      return factGot(row.map((v, i) => N(v, i === row.length - 1 ? 'end' : 'mid')))
    }
    case 'fractionOfSet': {
      if (!(m = /^fos:(\d)\/(\d):(\d+):[a-z]+$/.exec(id))) return null
      const [n, d, total] = [+m[1], +m[2], +m[3]]
      const of = n === 1 && d === 2 ? [C('hint.fractionOfSet.halfOf')] : [FR(n, d), C('s.fractionOfSet.of')]
      return factGot([...of, N(total), C('hint.fractionOfSet.is'), N((total * n) / d, 'end')])
    }
    case 'fractionCompare': {
      const is = C('hint.fractionOfSet.is')
      if ((m = /^fcm:([bs]):(\d),(\d)$/.exec(id))) {
        // a < b: 1/a is the bigger fraction
        const [big, small] = [+m[2], +m[3]]
        const [first, second] = m[1] === 'b' ? [big, small] : [small, big]
        const parts = [FR(1, first), is, C(m[1] === 'b' ? 'op.stoerre_end' : 'op.mindre_end'), FR(1, second, 'end')]
        return factGot(parts, { t: 'bars', fracs: [`1/${first}`, `1/${second}`] })
      }
      if ((m = /^fcm:o:(\d):(\d),(\d),(\d),(\d)$/.exec(id))) {
        // the denominators grow, so the fractions shrink: from the smallest, the last one comes first
        const k = +m[1]
        const ds = [+m[5], +m[4], +m[3], +m[2]]
        const parts = [C('hint.fractionCompare.fromSmallest'), ...ds.slice(0, 3).map((d) => FR(k, d)), C('op.og'), FR(k, ds[3], 'end')]
        return factGot(parts, { t: 'bars', fracs: ds.map((d) => `${k}/${d}`) })
      }
      return null
    }
    case 'fractionShape': {
      if (!(m = /^frs:(\d)\/(\d):(circle|rect|bar|square)$/.exec(id))) return null
      return factGot([FR(+m[1], +m[2], 'end')], { t: 'fraction', shape: m[3] as 'circle', parts: +m[2], colored: +m[1] })
    }
    default:
      return null
  }
}

/**
 * A family of 3. klasse as a fact: the instance the child answered right, else the family's first
 * fact (a key that moved without a known instance still shows what the family is about).
 */
function fjeldFace(def: SkillDef, family: string, instance: string | undefined): Got | null {
  const facts = factsOf(def)
  const first = facts.find((f) => f.family === family)
  for (const id of [instance, first?.id]) {
    if (!id) continue
    const got = safely(() => fjeldFact(def, id, facts.find((f) => f.id === id)))
    if (got) return got
  }
  return null
}

/** A key as something the child can see and hear (null: nothing concrete to show for it). */
export function keyFace(
  key: MasteryKey, skill: SkillId, skills: SkillRegistry = skillRegistry(), instance?: string,
): { face: LearnedFace; speech: SpeechPart[] } | null {
  const terms = factTerms(key)
  if (terms) return { face: { t: 'eq', terms }, speech: equationSpeech(terms) }

  // procedure keys are families: "Tallet efter", a pattern, and in 3. klasse the instance answered right
  if (key.startsWith(`${skill}/`)) {
    const family = key.slice(skill.length + 1)
    const def = skills.get(skill)
    if (def && isFjeldFamily(def, family)) return fjeldFace(def, family, instance)
    const beads = PATTERN_BEADS[family]
    if (skill === 'patterns' && beads) return { face: { t: 'beads', beads }, speech: said('s.reward.learned.pattern') }
    const clip = `s.reward.learned.${family}`
    return hasClip(clip) ? { face: { t: 'label', clip }, speech: [{ clip }] } : null
  }

  const def = skills.get(skill)
  const fact = def ? factsOf(def).find((f) => f.id === key) : undefined
  if (!def || !fact) return null
  if (isFjeldFamily(def, fact.family)) {
    const own = fjeldFace(def, fact.family, key)
    if (own) return own
  }
  const type = safely(() => def.answerType(fact))
  if (typeof fact.answer === 'number' && type === 'minutes') {
    const minutes = dialMinutes(fact.answer)
    return { face: { t: 'clock', minutes }, speech: clockSpeech(minutes) }
  }
  if (typeof fact.answer === 'number' && type === 'ore') {
    const clip = `noun.coin.${fact.answer}.indef.end`
    return hasClip(clip) ? { face: { t: 'money', ore: fact.answer }, speech: [{ clip }] } : null
  }
  if (typeof fact.answer === 'number') {
    if (!NUMBER_IS_FACT.has(skill)) return numberFact(fact.id, fact.answer)
    // the number, drawn the way the child counted it (a flashed picture stays on)
    const kind = def.kinds.includes('choice') ? 'choice' : def.kinds[0]
    const prompt = safely(() => def.prompt(fact, kind, makeRng(hashSeed(key))))
    let picture: Prompt | null = null
    if (prompt?.scene === 'objects') {
      // things spread out are lined up (one apple in a wide field reads as nothing); a die, fingers
      // and a ten-frame stay as they are — they are what the child learned to see
      const { flashMs: _flash, ...still } = prompt
      picture = still.layout === 'scatter' ? { ...still, layout: 'row' } : still
    }
    return { face: { t: 'number', n: fact.answer, picture }, speech: [{ clip: 's.reward.learned.number' }, { num: fact.answer, form: 'end' }] }
  }
  const shape = /^shape:([a-z]+):(\d+)$/.exec(String(fact.answer))
  if (shape) {
    const id = shape[1] as ShapeId
    return { face: { t: 'shape', shape: id, variant: Number(shape[2]) }, speech: said(`noun.shape.${id}.indef.end`) }
  }
  const clip = `s.reward.learned.${skill}`
  return hasClip(clip) ? { face: { t: 'label', clip }, speech: [{ clip }] } : null
}

/**
 * Up to three things to show under "Det lærte du", best first: the keys that moved (highest box
 * first), then the first right answer in a family, as the key it was answered on. When nothing moved,
 * one key the child got right, with praise for the practice.
 */
export function learnedItems(r: Extract<Reward, { t: 'learned' }>, ctx: LearnedContext = {}, max = 3): LearnedItem[] {
  const skills = ctx.skills ?? skillRegistry()
  const out: LearnedItem[] = []
  const shown = new Set<MasteryKey>()
  const add = (key: MasteryKey, skill: SkillId, badge: ClipId): boolean => {
    if (out.length >= max || shown.has(key)) return false
    const face = keyFace(key, skill, skills, ctx.instanceOf?.(key))
    if (!face) return false
    shown.add(key)
    out.push({ key, face: face.face, badge, speech: [...face.speech, { clip: badge }] })
    return true
  }
  for (const p of r.promoted) add(p.key, p.skill, boxBadge(p.box, ctx.failedTrial))
  for (const f of r.firsts) {
    const hit = ctx.correct?.find((c) => c.skill === f.skill && !shown.has(c.key) && keyInfo(c.key, skills)?.family === f.family)
    if (hit) add(hit.key, hit.skill, 's.reward.learned.first')
  }
  if (out.length === 0) {
    for (const c of ctx.correct ?? []) if (add(c.key, c.skill, 's.reward.learned.practiced')) break
  }
  if (out.length === 0) {
    out.push({ key: 'practiced', face: { t: 'none' }, badge: 's.reward.learned.practiced', speech: [{ clip: 's.reward.learned.practiced' }] })
  }
  return out
}

// ─── "Også i dag" ───────────────────────────────────────────────────────────

export function rewardIcon(r: Reward): IconName {
  switch (r.t) {
    case 'trophy': return 'trophy'
    case 'goal': return 'stamp'
    case 'item': return r.source.kind === 'chest' ? 'chest' : 'gift'
    case 'regionTier': return 'sparkle'
    case 'hut': return 'hut'
    case 'helpBridge': case 'trial': return 'bridge'
    case 'opened': return 'map'
    case 'medal': case 'allGolden': return 'medal'
    case 'levelUp': return 'crown'
    case 'growth': case 'friendship': case 'eggFriendship': return 'heart'
    case 'eggReady': case 'hatch': return 'egg'
    case 'animal': case 'choice': return 'paw'
    case 'stars': return 'star'
    default: return 'sparkle'
  }
}

/** The card's sentence with what it is about: the trophy, the thing, the region, the goal. */
export function cardSpeech(card: CeremonyCard): SpeechPart[] {
  const r = card.reward
  const parts = [...card.speech]
  const add = (clip: ClipId) => {
    if (hasClip(clip)) parts.push({ clip })
  }
  switch (r.t) {
    case 'trophy': add(`name.trophy.${r.id}`); break
    case 'item': add(ITEM_BY_ID[r.item].nameClip); break
    case 'regionTier': case 'hut': case 'helpBridge': add(REGION_BY_ID[r.region]?.nameClip ?? ''); break
    case 'opened': for (const region of r.regions) add(REGION_BY_ID[region]?.nameClip ?? ''); break
    case 'goal': return [...card.speech, ...goalSpeech(r.goal)]
    case 'medal': { const c = canDoClip(r.skill); if (c) parts.push({ clip: c }); break }
    case 'animal': add(`name.species.${r.animal.species}`); break
    case 'levelUp': parts.push({ num: r.level, form: 'end' }); break
    default: break
  }
  return parts
}
