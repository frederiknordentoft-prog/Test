// Words and pictures for the rewards of a round: what "Det lærte du" shows for a key that moved (the
// fact itself when it is a sum, else what the child can now), and the icon and sentence of each
// small "Også i dag" card. Pure; the screens render it.
import { ITEM_BY_ID } from '../../../../content/catalog'
import { REGION_BY_ID } from '../../../../content/curriculum'
import type { Box, ClipId, MasteryKey, SkillId, SpeechPart, Term } from '../../../../engine/types'
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

export interface LearnedItem {
  key: string
  /** The fact as a sum, or null (then `canDo` names the skill). */
  terms: Term[] | null
  canDo: ClipId | null
  badge: ClipId
  speech: SpeechPart[]
}

const boxBadge = (box: Box): ClipId => (box >= 5 ? 's.reward.learned.box5' : box >= 3 ? 's.reward.learned.box3' : 's.reward.learned.moved')

/** Up to three things to show under "Det lærte du", best first. */
export function learnedItems(r: Extract<Reward, { t: 'learned' }>, max = 3): LearnedItem[] {
  const out: LearnedItem[] = []
  const skills = new Set<SkillId>()
  for (const p of r.promoted) {
    if (out.length >= max) break
    const terms = factTerms(p.key)
    const canDo = canDoClip(p.skill)
    // a skill without a fact form is named once, however many of its keys moved
    if (!terms && (skills.has(p.skill) || !canDo)) continue
    skills.add(p.skill)
    const badge = boxBadge(p.box)
    out.push({ key: p.key, terms, canDo, badge, speech: [...(terms ? equationSpeech(terms) : [{ clip: canDo! }]), { clip: badge }] })
  }
  for (const f of r.firsts) {
    if (out.length >= max) break
    const canDo = canDoClip(f.skill)
    if (!canDo || skills.has(f.skill)) continue
    skills.add(f.skill)
    out.push({ key: `${f.skill}/${f.family}`, terms: null, canDo, badge: 's.reward.learned.first', speech: [{ clip: canDo }, { clip: 's.reward.learned.first' }] })
  }
  if (out.length === 0) {
    const skill = r.practiced.find((s) => canDoClip(s))
    const canDo = skill ? canDoClip(skill) : null
    out.push({
      key: 'practiced',
      terms: null,
      canDo,
      badge: 's.reward.learned.practiced',
      speech: [...(canDo ? [{ clip: canDo }] : []), { clip: 's.reward.learned.practiced' }],
    })
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
