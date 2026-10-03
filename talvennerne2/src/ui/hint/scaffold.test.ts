// QA2 P3-9: the support on a new key is a 0–10 counting line only where counting along a line can
// help — numbers, sums, rows and groups — never beside a figure ("Hvor mange sider har trekanten?",
// "Hvor mange halvcirkler skal der til for at lave en cirkel?"), a clock, coins or a measurement.
import { describe, expect, it } from 'vitest'
import { keysForSkills, skillRegistry } from '../../engine/registry'
import { makeRng } from '../../engine/rng'
import { SKILL_BY_ID } from '../../content/skills'
import { countingLine, supportFor } from './hintFor'

const reg = skillRegistry()
const ALONG = new Set(['number', 'addsub', 'algebra', 'muldiv'])

describe('the counting line on a new key (QA2 P3-9)', () => {
  it('never stands beside a figure, a clock, coins, a fraction or a measurement', () => {
    const skills = reg.all.filter((d) => d.grade <= 2 && !ALONG.has(SKILL_BY_ID[d.id]?.domain ?? '')).map((d) => ({ skill: d.id }))
    let n = 0
    for (const k of keysForSkills(skills, { skills: reg, states: {}, audioVerified: true, mode: 'round' })) {
      for (const kind of k.kinds) {
        const t = k.build(kind, makeRng(5), 0)
        expect(countingLine(t), `${t.factId} ${kind}`).toBeNull()
        const s = supportFor(t, reg)
        // the skill's own picture may be a line with what it is about marked (change: the price and
        // what was paid); a bare, empty 0–10 or 0–20 line never
        const bare = s?.scene === 'line' && s.min === 0 && (s.max === 10 || s.max === 20) && !s.hops && s.arrowAt === undefined && s.target === undefined
        expect(bare, `${t.factId} ${kind}`).toBe(false)
        n++
      }
    }
    expect(n).toBeGreaterThan(100)
  })

  it('"Hvor mange sider har trekanten?" and "Hvor mange halvcirkler …?" get none', () => {
    for (const skill of ['sidesCorners', 'composeShapes'] as const) {
      const keys = keysForSkills([{ skill }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })
      expect(keys.length, skill).toBeGreaterThan(0)
      for (const k of keys) for (const kind of k.kinds) expect(countingLine(k.build(kind, makeRng(1), 0)), `${k.key} ${kind}`).toBeNull()
    }
  })

  it('still counts along where it helps: a sum, a row, a heard number', () => {
    const keys = keysForSkills([{ skill: 'addTo10' }, { skill: 'order20' }, { skill: 'hear20' }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })
    const lines = keys.map((k) => countingLine(k.build(k.kinds[0], makeRng(1), 0))).filter((l) => l !== null)
    expect(lines.length).toBeGreaterThan(keys.length / 2)
  })
})
