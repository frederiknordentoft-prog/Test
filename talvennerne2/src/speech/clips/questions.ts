// The 271 whole questions `q.<factId>` for the recall facts of 0.–1. klasse (see recallQuestions.ts).
import type { ClipId } from '../../engine/types'
import type { Wave } from '../catalog'
import { RECALL_QUESTIONS, WAVE1_QUESTION_SKILLS } from '../recallQuestions'

export const clips: Readonly<Record<ClipId, string>> = Object.fromEntries(RECALL_QUESTIONS.map((q) => [q.clip, q.text]))

const bySkill = new Map(RECALL_QUESTIONS.map((q) => [q.clip, q.skill]))

export function wave(id: ClipId): Wave {
  const skill = bySkill.get(id)
  return skill && WAVE1_QUESTION_SKILLS.includes(skill) ? 1 : 2
}

/** Domain sprite per wave: addsub-1, addsub-2, algebra-2 (missingPart10). */
export function pack(id: ClipId): string {
  return `${bySkill.get(id) === 'missingPart10' ? 'algebra' : 'addsub'}-${wave(id)}`
}
