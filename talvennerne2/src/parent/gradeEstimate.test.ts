import { describe, expect, it } from 'vitest'
import { SKILLS, SKILL_BY_ID } from '../content/skills'
import type { SkillId } from '../engine/types'
import { buildDashboard } from './dashboard'
import { ago, answers, dailyFrom, profile, source } from './fixtures'
import { CORE_SKILLS, TOO_LITTLE, gradeEstimate, gradeMet } from './gradeEstimate'
import type { DashStatus, SkillState } from './types'

type Mark = DashStatus | 'skipped'

/** Every skill not started, except the given ones. */
function states(marks: Partial<Record<SkillId, Mark>> = {}): Record<SkillId, SkillState> {
  const out = {} as Record<SkillId, SkillState>
  for (const m of SKILLS) {
    const mark = marks[m.id] ?? 'notStarted'
    const dash: DashStatus = mark === 'skipped' ? 'notStarted' : mark
    out[m.id] = {
      skill: m.id, domain: m.domain, grade: m.grade, label: m.label, status: dash, dash, skipped: mark === 'skipped',
      dot: mark, medal: null, keys: 10, share4: 0, meanBox: 0,
    }
  }
  return out
}

const core = (grade: number) => CORE_SKILLS.filter((s) => SKILL_BY_ID[s].grade === grade)
const mark = (skills: readonly SkillId[], ...marks: Mark[]): Partial<Record<SkillId, Mark>> =>
  Object.fromEntries(skills.map((s, i) => [s, marks[i] ?? marks[marks.length - 1]]))
const enough = { answers: 400, activeDays: 12 }

describe('grade estimate: enough evidence first', () => {
  const all = states(mark(core(0), 'independent'))

  it('says "Vi ved endnu for lidt" under 150 answers or under 5 active days', () => {
    expect(gradeEstimate(all, { answers: 149, activeDays: 20 })).toMatchObject({ enough: false, grade: null, text: TOO_LITTLE })
    expect(gradeEstimate(all, { answers: 1000, activeDays: 4 })).toMatchObject({ enough: false, text: TOO_LITTLE })
    expect(gradeEstimate(all, { answers: 150, activeDays: 5 })).toMatchObject({ enough: true, grade: 0 })
  })

  it('reads the evidence from every kept day', () => {
    const days = [0, 1, 2, 3, 30].flatMap((d) => answers('addTo10', ago(d), 30))
    const d = buildDashboard(profile(), source({ daily: dailyFrom(days) }))
    expect(d.estimate).toMatchObject({ answers: 150, activeDays: 5, enough: true })
    const four = buildDashboard(profile(), source({ daily: dailyFrom(days.filter((a) => a.day !== ago(30))) }))
    expect(four.estimate.text).toBe(TOO_LITTLE)
  })
})

describe('grade estimate: whole grades', () => {
  it('needs ≥ 80 % at least "Med støtte" and ≥ 50 % "Kan selv" among the core skills up to the grade', () => {
    // 7 core skills in 0. klasse: 6 with support or better (86 %), 4 of them independent (57 %)
    const met = states(mark(core(0), 'independent', 'independent', 'independent', 'independent', 'support', 'support', 'practising'))
    expect(gradeEstimate(met, enough)).toMatchObject({ grade: 0, text: 'Har styr på det meste af 0. klasses stof i tal og regning' })
    // only 5 of 7 with support (71 %)
    const short = states(mark(core(0), 'independent', 'independent', 'independent', 'independent', 'support', 'practising'))
    expect(gradeEstimate(short, enough)).toMatchObject({ grade: null, text: 'Er i gang med 0. klasses stof i tal og regning' })
  })

  it('holds exactly at the thresholds', () => {
    // two skipped: 5 left, 4 with support (80 %), 3 independent (60 %)
    const at = states(mark(core(0), 'skipped', 'skipped', 'independent', 'independent', 'independent', 'support', 'practising'))
    expect(gradeMet(0, at)).toBe(true)
    // 2 independent of 5 is 40 %
    const below = states(mark(core(0), 'skipped', 'skipped', 'independent', 'independent', 'support', 'support', 'practising'))
    expect(gradeMet(0, below)).toBe(false)
  })

  it('counts grades cumulatively and picks the highest one met', () => {
    const marks = { ...mark(core(0), 'independent'), ...mark(core(1), 'independent', 'independent', 'independent', 'independent', 'independent', 'independent', 'support', 'support', 'support', 'support', 'practising', 'practising') }
    const e = gradeEstimate(states(marks), enough)
    // grade ≤ 1: 19 skills, 17 with support (89 %), 13 independent (68 %)
    expect(e.grade).toBe(1)
    expect(e.text).toBe('Har styr på det meste af 1. klasses stof i tal og regning')
    expect(Number.isInteger(e.grade)).toBe(true)
  })

  it('leaves skills skipped at start out, both from the shares and from the list', () => {
    // a 2. klasse child placed past 0. and 1. klasse: those skills are seeded, not seen
    const marks = {
      ...mark([...core(0), ...core(1)], 'skipped'),
      ...mark(core(2), 'independent', 'independent', 'independent', 'independent', 'independent', 'support', 'support', 'support', 'practising', 'practising'),
    }
    const e = gradeEstimate(states(marks), enough)
    expect(e.grade).toBe(2)
    expect(e.independent).toEqual(core(2).slice(0, 5))
    expect(e.independent.some((s) => SKILL_BY_ID[s].grade < 2)).toBe(false)
  })

  it('lists the core skills at "Kan selv", never other domains', () => {
    const e = gradeEstimate(states({ addTo10: 'independent', shapes2D: 'independent', clockHour: 'independent' }), enough)
    expect(e.independent).toEqual(['addTo10'])
  })

  it('never judges in colours or grades of quality', () => {
    for (const s of [states(), states(mark(core(0), 'independent'))]) {
      for (const ev of [enough, { answers: 0, activeDays: 0 }]) {
        expect(gradeEstimate(s, ev).text).not.toMatch(/rød|grøn|godt|dårlig|bagud|foran|niveau \d|%/i)
      }
    }
  })
})
