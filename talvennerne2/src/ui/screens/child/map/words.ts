// Small pure helpers for spoken lines shared by the map and the end of the round.
import { REGION_BY_ID } from '../../../../content/curriculum'
import type { ClipId, Goal, GoalKind, SpeechPart } from '../../../../engine/types'
import type { IconName } from '../../../design/icons'

/** The words of a spoken line as shown text: clip texts and numbers joined by spaces. */
export function lineText(parts: readonly SpeechPart[], text: (id: ClipId) => string): string {
  return parts
    .map((p) => ('clip' in p ? text(p.clip) : 'num' in p ? String(p.num) : 'free' in p ? p.free : ''))
    .filter(Boolean)
    .join(' ')
}

export const GOAL_CLIP: Readonly<Record<GoalKind, ClipId>> = {
  mix: 's.reward.goal.mix',
  revisit: 's.reward.goal.revisit',
  streak5: 's.reward.goal.streak5',
  write10: 's.reward.goal.write10',
  stars3: 's.reward.goal.stars3',
}

export const GOAL_ICON: Readonly<Record<GoalKind, IconName>> = { mix: 'retry', revisit: 'map', streak5: 'paw', write10: 'pencil', stars3: 'star' }

/** A goal read aloud: its sentence, and the region for "Tag en tur forbi …". */
export function goalSpeech(g: Goal): SpeechPart[] {
  const parts: SpeechPart[] = [{ clip: GOAL_CLIP[g.kind] }]
  if (g.kind === 'revisit' && g.region && REGION_BY_ID[g.region]) parts.push({ clip: REGION_BY_ID[g.region].nameClip })
  return parts
}
