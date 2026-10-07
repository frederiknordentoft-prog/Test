import { describe, expect, it } from 'vitest'
import { SKILLS, SKILL_BY_ID } from '../content/skills'
import { makeRng, type Rng } from '../engine/rng'
import type { Grade, SkillId } from '../engine/types'
import { buildDashboard } from './dashboard'
import { ago, answers, dailyFrom, profile, source } from './fixtures'
import { CORE_SKILLS, TOO_LITTLE, gradeEstimate, gradeMet } from './gradeEstimate'
import { DASH_RANK } from './metrics'
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

// ─── SPEC A22: a grade needs its own material ───────────────────────────────

const GRADES: readonly Grade[] = [0, 1, 2, 3]
const supported = (s: SkillState) => DASH_RANK[s.dash] >= DASH_RANK.support

/** The rule before SPEC A22 (the cumulative shares only): the reference for 0.–2. klasse. */
function metBefore(g: Grade, st: Readonly<Record<SkillId, SkillState>>): boolean | null {
  const set = CORE_SKILLS.filter((s) => st[s].grade <= g && !st[s].skipped)
  if (set.length === 0) return null
  const support = set.filter((s) => supported(st[s])).length / set.length
  const independent = set.filter((s) => st[s].dash === 'independent').length / set.length
  return support >= 0.8 - 1e-9 && independent >= 0.5 - 1e-9
}
const gradeBefore = (st: Readonly<Record<SkillId, SkillState>>): Grade | null =>
  [...GRADES].reverse().find((g) => metBefore(g, st) === true) ?? null

/** Share of grade g's own core skills (not skipped) at least "Med støtte"; null without any. */
function ownShare(g: Grade, st: Readonly<Record<SkillId, SkillState>>): number | null {
  const own = core(g).filter((s) => !st[s].skipped)
  return own.length > 0 ? own.filter((s) => supported(st[s])).length / own.length : null
}

/**
 * A random child: per grade, a random number of core skills at least "Med støtte" and of those a
 * random number at "Kan selv" (so every count is as likely as the next, thresholds included), the
 * rest of the grade practising or not started, and every other skill anything. `skip` marks core
 * skills skipped at start.
 */
function randomStates(rng: Rng, skip: (s: SkillId) => boolean = () => false): Record<SkillId, SkillState> {
  const marks: Partial<Record<SkillId, Mark>> = {}
  for (const g of GRADES) {
    const own = rng.shuffle(core(g))
    const sup = rng.int(own.length + 1)
    const ind = rng.int(sup + 1)
    own.forEach((s, i) => {
      marks[s] = i < ind ? 'independent' : i < sup ? 'support' : rng.pick(['practising', 'notStarted'] as const)
    })
  }
  for (const m of SKILLS) marks[m.id] ??= rng.pick(['independent', 'support', 'practising', 'notStarted'] as const)
  for (const s of CORE_SKILLS) if (skip(s)) marks[s] = 'skipped'
  return states(marks)
}

describe('grade estimate: a grade needs its own material (SPEC A22)', () => {
  const below3 = [...core(0), ...core(1), ...core(2)]

  it('counts the core skills the spec counts: 29 up to 2. klasse and 7 in 3. klasse', () => {
    expect(below3).toHaveLength(29)
    expect(core(3)).toEqual(['add1000', 'sub1000', 'mul34', 'mul6to9', 'div2510', 'divAll', 'mulTens'])
  })

  it('never meets 3. klasse on 0.–2. klasse alone (29 of 36 core skills is 80.6 %)', () => {
    const st = states(mark(below3, 'independent'))
    expect(metBefore(3, st)).toBe(true) // what the estimate used to say
    expect(gradeMet(3, st)).toBe(false)
    expect(gradeEstimate(st, enough)).toMatchObject({ grade: 2, text: 'Har styr på det meste af 2. klasses stof i tal og regning' })
    // 3 of its 7 own skills with support (43 %) is still too little, though 32 of 36 is 89 %
    const three = states({ ...mark(below3, 'independent'), ...mark(core(3), 'independent', 'support', 'support', 'practising') })
    expect(gradeMet(3, three)).toBe(false)
    expect(gradeEstimate(three, enough).grade).toBe(2)
  })

  it('meets 3. klasse with half of its own skills at "Med støtte"', () => {
    // 4 of 7 own skills with support (57 %): 33 of 36 with support, 30 independent
    const four = states({ ...mark(below3, 'independent'), ...mark(core(3), 'independent', 'support', 'support', 'support', 'practising') })
    expect(gradeMet(3, four)).toBe(true)
    expect(gradeEstimate(four, enough)).toMatchObject({ grade: 3, text: 'Har styr på det meste af 3. klasses stof i tal og regning' })
    // exactly half: one own skill skipped at start, 3 of the other 6 with support
    const half = states({ ...mark(below3, 'independent'), ...mark(core(3), 'skipped', 'support', 'support', 'independent', 'practising') })
    expect(ownShare(3, half)).toBe(0.5)
    expect(gradeMet(3, half)).toBe(true)
  })

  it('does not meet a grade whose own core skills were all skipped at start', () => {
    // placed past every 3. klasse core skill: only 0.–2. klasse is left to judge by
    const st = states({ ...mark(below3, 'independent'), ...mark(core(3), 'skipped') })
    expect(metBefore(3, st)).toBe(true)
    expect(gradeMet(3, st)).toBe(false)
    expect(gradeEstimate(st, enough).grade).toBe(2)
    // and with nothing left at all, there is nothing to judge by
    expect(gradeMet(3, states(mark(CORE_SKILLS, 'skipped')))).toBeNull()
  })

  it('leaves 0.–2. klasse exactly as before in every combination of counts without skipped skills', () => {
    // Without skipped skills only the counts per grade matter: try every one of them up to 2. klasse
    // (a skill's place in its grade does not change a share).
    const st = states()
    const diffs: string[] = []
    const set = (g: Grade, sup: number, ind: number) => core(g).forEach((s, i) => {
      const dash: DashStatus = i < ind ? 'independent' : i < sup ? 'support' : 'practising'
      st[s] = { ...st[s], dash, status: dash, dot: dash }
    })
    const counts = (n: number) => Array.from({ length: n + 1 }, (_, sup) => Array.from({ length: sup + 1 }, (_, ind) => [sup, ind] as const)).flat()
    let combos = 0
    for (const [s0, i0] of counts(core(0).length)) {
      set(0, s0, i0)
      if (gradeMet(0, st) !== metBefore(0, st)) diffs.push(`0: ${s0}/${i0}`)
      for (const [s1, i1] of counts(core(1).length)) {
        set(1, s1, i1)
        if (gradeMet(1, st) !== metBefore(1, st)) diffs.push(`1: ${s0}/${i0} ${s1}/${i1}`)
        for (const [s2, i2] of counts(core(2).length)) {
          set(2, s2, i2)
          combos += 1
          if (gradeMet(2, st) !== metBefore(2, st)) diffs.push(`2: ${s0}/${i0} ${s1}/${i1} ${s2}/${i2}`)
        }
      }
    }
    expect(combos).toBe(36 * 91 * 66)
    expect(diffs).toEqual([])
  })

  it('gives the same estimate as before for 0.–2. klasse in random states without skipped skills (property)', () => {
    const rng = makeRng(22)
    const diffs: string[] = []
    let lowered = 0
    const met = [0, 0, 0]
    for (let n = 0; n < 3000; n++) {
      const st = randomStates(rng)
      for (const g of [0, 1, 2] as const) {
        if (gradeMet(g, st) !== metBefore(g, st)) diffs.push(`state ${n}, grade ${g}`)
        if (metBefore(g, st)) met[g] += 1
      }
      const before = gradeBefore(st)
      const now = gradeEstimate(st, enough)
      if (before !== 3) {
        if (now.grade !== before) diffs.push(`state ${n}: ${before} → ${now.grade}`)
        continue
      }
      // only 3. klasse can change: kept with its own material, else the highest of 0.–2. klasse
      const own = ownShare(3, st)!
      const expected = own >= 0.5 ? 3 : ([2, 1, 0] as const).find((g) => metBefore(g, st) === true) ?? null
      if (now.grade !== expected) diffs.push(`state ${n}: 3 → ${now.grade}, own share ${own}`)
      if (now.grade !== 3) lowered += 1
    }
    expect(diffs).toEqual([])
    // the random children reach every grade, and some were "3. klasse" on 0.–2. klasse alone
    for (const g of [0, 1, 2]) expect(met[g], `grade ${g} met`).toBeGreaterThan(20)
    expect(lowered).toBeGreaterThan(0)
  })

  it('changes 0.–2. klasse only when skills of the grade itself were skipped at start (property)', () => {
    // Only a placement skips skills, and only 3. klasse has one. Skipped skills shaped like a
    // placement (everything up to a stage, some of it confirmed since) and at random.
    const rng = makeRng(2222)
    const diffs: string[] = []
    for (let n = 0; n < 3000; n++) {
      const stage = rng.next() * 4
      const confirmed = rng.next() * 0.5
      const placed = (s: SkillId) => SKILL_BY_ID[s].stage <= stage && rng.next() >= confirmed
      const anywhere = () => rng.next() < 0.3
      const st = randomStates(rng, n % 2 === 0 ? placed : anywhere)
      for (const g of [0, 1, 2] as const) {
        const ownSkipped = core(g).some((s) => st[s].skipped)
        if ((g === 0 || !ownSkipped) && gradeMet(g, st) !== metBefore(g, st)) diffs.push(`state ${n}, grade ${g}`)
      }
    }
    expect(diffs).toEqual([])
  })
})
