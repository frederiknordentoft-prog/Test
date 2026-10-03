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
import type { Box, ClipId, MasteryKey, Prompt, ShapeId, SkillId, SpeechPart, Term } from '../../../../engine/types'
import type { CeremonyCard } from '../../../../meta/ceremonyQueue'
import type { Reward } from '../../../../meta/rewards'
import { hasClip } from '../../../../speech/catalog'
import { dialMinutes } from '../../../../speech/clock'
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
  /** Nothing concrete to show: only the badge. */
  | { t: 'none' }

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

/** A key as something the child can see and hear (null: nothing concrete to show for it). */
export function keyFace(key: MasteryKey, skill: SkillId, skills: SkillRegistry = skillRegistry()): { face: LearnedFace; speech: SpeechPart[] } | null {
  const terms = factTerms(key)
  if (terms) return { face: { t: 'eq', terms }, speech: equationSpeech(terms) }

  // procedure keys are families: "Tallet efter", a pattern
  if (key.startsWith(`${skill}/`)) {
    const family = key.slice(skill.length + 1)
    const beads = PATTERN_BEADS[family]
    if (skill === 'patterns' && beads) return { face: { t: 'beads', beads }, speech: said('s.reward.learned.pattern') }
    const clip = `s.reward.learned.${family}`
    return hasClip(clip) ? { face: { t: 'label', clip }, speech: [{ clip }] } : null
  }

  const def = skills.get(skill)
  const fact = def ? factsOf(def).find((f) => f.id === key) : undefined
  if (!def || !fact) return null
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
    const face = keyFace(key, skill, skills)
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
