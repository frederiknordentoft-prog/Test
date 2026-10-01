// "Misforståelser" (SPEC §4.3, §9.1): what the engine has concluded, in the parent's words. The
// engine decides when it dares to conclude (flagged / resolved); this module only finds where the
// evidence came from and sorts it: concepts as "Vi har set tegn på …" (at most two), slips together
// under "Typiske fejl lige nu", lifted flags under "Ser ud til at være på plads".
import { MISCONCEPTION_TEXTS } from '../content/misconceptionTexts'
import { SKILL_BY_ID } from '../content/skills'
import { natureFor, WINDOW_DAYS as EVIDENCE_DAYS } from '../engine/misconceptions'
import type { AnswerLogEntry, DailyAggregate, MisconceptionId, MisconceptionState, ProfileDoc, SkillId } from '../engine/types'
import { familyLabel } from './familyLabels'
import { inWindow, windowEnding } from './format'
import type { Sign, Signs } from './types'

export const MAX_CONCEPTS = 2
export const MAX_RESOLVED = 6

/** Where the evidence came from: wrong answers with this tag per skill and family, most first. */
export function evidenceOf(
  id: MisconceptionId, answers: readonly AnswerLogEntry[], daily: readonly DailyAggregate[], today: string,
): { skills: SkillId[]; where: string[] } {
  const w = windowEnding(today, EVIDENCE_DAYS)
  const bySkill = new Map<SkillId, number>()
  const byFamily = new Map<string, number>()
  for (const a of answers) {
    if (a.correct || a.errorTag !== id || !inWindow(a.day, w)) continue
    bySkill.set(a.skill, (bySkill.get(a.skill) ?? 0) + 1)
    const fam = `${a.skill}/${a.family}`
    byFamily.set(fam, (byFamily.get(fam) ?? 0) + 1)
  }
  if (bySkill.size === 0) {
    // the answer log only goes back so far: the daily aggregates keep the error counts
    for (const d of daily) {
      if (!inWindow(d.day, w)) continue
      for (const [skill, s] of Object.entries(d.bySkill) as [SkillId, NonNullable<DailyAggregate['bySkill'][SkillId]>][]) {
        const n = s.errors[id] ?? 0
        if (n > 0) bySkill.set(skill, (bySkill.get(skill) ?? 0) + n)
      }
    }
  }
  const skills = [...bySkill.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
  // a times table or a division family says more than the skill ("7-tabellen")
  const where = skills.map((skill) => {
    const fams = [...byFamily.entries()].filter(([f]) => f.startsWith(`${skill}/`)).sort((a, b) => b[1] - a[1])
    const top = fams[0]?.[0].slice(skill.length + 1)
    const tableLike = top && /^[td]\d+$/.test(top)
    return tableLike ? familyLabel(skill, top) : SKILL_BY_ID[skill].label
  })
  return { skills, where: [...new Set(where)] }
}

function signOf(id: MisconceptionId, s: MisconceptionState, input: { answers: readonly AnswerLogEntry[]; daily: readonly DailyAggregate[]; today: string }): Sign {
  const t = MISCONCEPTION_TEXTS[id]
  const { skills, where } = evidenceOf(id, input.answers, input.daily, input.today)
  // digitSwap is a concept only where Danish number words cause it (hear*, tensOnes, placeValue1000)
  const nature = t.nature === 'mixed' ? (skills[0] ? natureFor(id, skills[0]) : 'slip') : t.nature
  return {
    id, nature, title: t.title, example: t.example, parent: t.parent, homeTip: t.homeTip, where, skills,
    flaggedAt: s.flaggedAt, resolvedAt: s.resolvedAt, weight: s.hits.reduce((sum, h) => sum + h.w, 0),
  }
}

export function signs(input: { profile: Pick<ProfileDoc, 'misconceptions'>; answers: readonly AnswerLogEntry[]; daily: readonly DailyAggregate[]; today: string }): Signs {
  const flagged: Sign[] = []
  const resolved: Sign[] = []
  for (const [id, s] of Object.entries(input.profile.misconceptions) as [MisconceptionId, MisconceptionState | undefined][]) {
    if (!s || !MISCONCEPTION_TEXTS[id]) continue
    if (s.status === 'flagged') flagged.push(signOf(id, s, input))
    else if (s.status === 'resolved') resolved.push(signOf(id, s, input))
  }
  // the most evidence first; between equals, the newest flag
  const order = (a: Sign, b: Sign) => b.weight - a.weight || (b.flaggedAt ?? 0) - (a.flaggedAt ?? 0)
  return {
    concepts: flagged.filter((s) => s.nature === 'concept').sort(order).slice(0, MAX_CONCEPTS),
    slips: flagged.filter((s) => s.nature === 'slip').sort(order),
    resolved: resolved.sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0)).slice(0, MAX_RESOLVED),
  }
}

/** "Barnet …" in the parent texts, with the child's name instead. */
export function personal(text: string, name: string): string {
  const n = name.trim()
  return n ? text.replace(/(^|[.!?]\s+)Barnet\b/g, `$1${n}`) : text
}
