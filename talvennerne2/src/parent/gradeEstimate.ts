// "Niveau" (SPEC §9.1 point 9): only whole grades, only with enough evidence, and without any
// red/green verdict. Grade g counts when the core skills (Tal og tælling, Titalssystemet, Plus og
// minus, Gange og division) with grade ≤ g are ≥ 80 % at least "Med støtte" and ≥ 50 % "Kan selv".
// Skills seeded by placement and not yet confirmed are left out: the child skipped them, nobody saw
// them done.
import { DOMAIN_BY_ID, SKILLS } from '../content/skills'
import type { Grade, SkillId } from '../engine/types'
import { DASH_RANK } from './metrics'
import type { GradeEstimate, SkillState } from './types'

export const ESTIMATE_MIN_ANSWERS = 150
export const ESTIMATE_MIN_DAYS = 5
export const SUPPORT_SHARE = 0.8
export const INDEPENDENT_SHARE = 0.5

export const TOO_LITTLE = 'Vi ved endnu for lidt'

const GRADES: readonly Grade[] = [0, 1, 2, 3]

/** Core skills, by curriculum order. */
export const CORE_SKILLS: readonly SkillId[] = SKILLS.filter((m) => DOMAIN_BY_ID[m.domain].core).map((m) => m.id)

/** Whether the core skills up to grade g meet both shares (null: nothing left to judge by). */
export function gradeMet(g: Grade, states: Readonly<Record<SkillId, SkillState>>): boolean | null {
  const set = CORE_SKILLS.filter((s) => states[s].grade <= g && !states[s].skipped)
  if (set.length === 0) return null
  const support = set.filter((s) => DASH_RANK[states[s].dash] >= DASH_RANK.support).length / set.length
  const independent = set.filter((s) => states[s].dash === 'independent').length / set.length
  return support >= SUPPORT_SHARE - 1e-9 && independent >= INDEPENDENT_SHARE - 1e-9
}

export function gradeEstimate(
  states: Readonly<Record<SkillId, SkillState>>, evidence: { answers: number; activeDays: number },
): GradeEstimate {
  const independent = CORE_SKILLS.filter((s) => states[s].dash === 'independent' && !states[s].skipped)
  const base = { independent, answers: evidence.answers, activeDays: evidence.activeDays }
  if (evidence.answers < ESTIMATE_MIN_ANSWERS || evidence.activeDays < ESTIMATE_MIN_DAYS) {
    return { ...base, enough: false, grade: null, text: TOO_LITTLE }
  }
  const met = [...GRADES].reverse().find((g) => gradeMet(g, states) === true)
  if (met !== undefined) {
    return { ...base, enough: true, grade: met, text: `Har styr på det meste af ${met}. klasses stof i tal og regning` }
  }
  const started = CORE_SKILLS.filter((s) => states[s].status !== 'notStarted' && !states[s].skipped)
  const lowest = started.length > 0 ? Math.min(...started.map((s) => states[s].grade)) : 0
  return { ...base, enough: true, grade: null, text: `Er i gang med ${lowest}. klasses stof i tal og regning` }
}
