// Words and pictures for the rewards of a round: what "Det lærte du" shows for a key that moved, and
// the icon and sentence of each small "Også i dag" card. Pure; the screens render it.
//
// "Det lærte du" is concrete and true (review r1 P2-2): it shows the facts and numbers that moved in
// this round — "3 + 4 = 7", the number 4 as the child counted it, "Tallet efter" — never a sentence
// about a whole skill ("Jeg kan tælle til ti"), and "Det sidder fast" only at box 5 and never right
// after a failed trial.
import { ITEM_BY_ID } from '../../../../content/catalog'
import { REGION_BY_ID } from '../../../../content/curriculum'
import { factsOf, keyInfo, skillRegistry, type SkillRegistry } from '../../../../engine/registry'
import { hashSeed, makeRng } from '../../../../engine/rng'
import type { Box, ClipId, MasteryKey, Prompt, ShapeId, SkillId, SpeechPart, Term } from '../../../../engine/types'
import type { CeremonyCard } from '../../../../meta/ceremonyQueue'
import type { Reward } from '../../../../meta/rewards'
import { hasClip } from '../../../../speech/catalog'
import { equationSpeech } from '../../../../speech/equation'
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
  if (typeof fact.answer === 'number') {
    // the number, drawn the way the child counted it (a flashed picture stays on)
    const kind = def.kinds.includes('choice') ? 'choice' : def.kinds[0]
    const prompt = safely(() => def.prompt(fact, kind, makeRng(hashSeed(key))))
    let picture: Prompt | null = null
    if (prompt?.scene === 'objects') {
      const { flashMs: _flash, ...still } = prompt
      picture = still
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
