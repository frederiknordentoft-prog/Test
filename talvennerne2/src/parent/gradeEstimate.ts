// "Niveau" (SPEC §9.1 point 9): only whole grades, only with enough evidence, and without any
// red/green verdict. Grade g counts when the core skills (Tal og tælling, Titalssystemet, Plus og
// minus, Gange og division) with grade ≤ g are ≥ 80 % at least "Med støtte" and ≥ 50 % "Kan selv".
// Skills seeded by placement and not yet confirmed are left out: the child skipped them, nobody saw
// them done.
//
// A grade also needs its own material (SPEC A22): at least half of the grade's own core skills (the
// ones not skipped) at "Med støtte" or better, and a grade without any such skill is not met. Before,
// 3. klasse was met on 0.–2. klasse alone (29 of 36 core skills is 80.6 %). For 0.–2. klasse the 80 %
// share already implies it unless skills of the grade itself are skipped, and only a placement skips
// skills, which only 3. klasse has: their estimate is the same as before (tested).
import { DOMAIN_BY_ID, SKILLS } from '../content/skills'
import type { Grade, SkillId } from '../engine/types'
import { DASH_RANK } from './metrics'
import type { GradeEstimate, SkillState } from './types'

export const ESTIMATE_MIN_ANSWERS = 150
export const ESTIMATE_MIN_DAYS = 5
export const SUPPORT_SHARE = 0.8
export const INDEPENDENT_SHARE = 0.5
/** Share of the grade's own core skills at least "Med støtte" (SPEC A22). */
export const OWN_SUPPORT_SHARE = 0.5

export const TOO_LITTLE = 'Vi ved endnu for lidt'

const GRADES: readonly Grade[] = [0, 1, 2, 3]

/** Core skills, by curriculum order. */
export const CORE_SKILLS: readonly SkillId[] = SKILLS.filter((m) => DOMAIN_BY_ID[m.domain].core).map((m) => m.id)

/**
 * Whether the core skills up to grade g meet both shares and the grade's own core skills theirs
 * (null: nothing left to judge by).
 */
export function gradeMet(g: Grade, states: Readonly<Record<SkillId, SkillState>>): boolean | null {
  const set = CORE_SKILLS.filter((s) => states[s].grade <= g && !states[s].skipped)
  if (set.length === 0) return null
  const supported = (s: SkillId) => DASH_RANK[states[s].dash] >= DASH_RANK.support
  const support = set.filter(supported).length / set.length
  const independent = set.filter((s) => states[s].dash === 'independent').length / set.length
  // SPEC A22: never met on the grades below alone
  const own = set.filter((s) => states[s].grade === g)
  const ownSupport = own.length > 0 ? own.filter(supported).length / own.length : 0
  return support >= SUPPORT_SHARE - 1e-9 && independent >= INDEPENDENT_SHARE - 1e-9 &&
    own.length > 0 && ownSupport >= OWN_SUPPORT_SHARE - 1e-9
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
