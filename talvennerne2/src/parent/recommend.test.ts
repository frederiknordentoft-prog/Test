import { describe, expect, it } from 'vitest'
import { skillRegistry } from '../engine/registry'
import type { AnswerLogEntry, NodeId, ProfileDoc } from '../engine/types'
import { nodesOfRegion } from '../content/curriculum'
import { buildDashboard } from './dashboard'
import { ago, answers, dailyFrom, key, keysAt, misconception, profile, snap, source, tableIndex, TODAY, type DayExtra } from './fixtures'
import { keyIndexOf } from './load'
import { MAX_RECOMMENDATIONS } from './recommend'
import type { Recommendation, SkillKeyIndex } from './types'

const realIndex = keyIndexOf(skillRegistry())
const addKeys = realIndex.addTo10!
const count10Keys = realIndex.count10!

function recs(p: ProfileDoc, log: AnswerLogEntry[] = [], extra: Record<string, DayExtra> = {}, index: SkillKeyIndex = realIndex): Recommendation[] {
  return buildDashboard(p, source({ index, answers: log, daily: dailyFrom(log, extra) })).recommendations
}
const rules = (rs: Recommendation[]) => rs.map((r) => r.rule)
const withoutR6 = (rs: Recommendation[]) => rs.filter((r) => r.rule !== 'R6')

describe('R1: a concept flag with its home tip', () => {
  it('turns a flagged concept into "Vi har set tegn på …" with the home tip and the name', () => {
    const r = recs(profile({ misconceptions: { forgotCarry: misconception('flagged') } }))
    expect(r[0].rule).toBe('R1')
    expect(r[0].title).toBe('Vi har set tegn på, at Ada glemmer tieren, der skal med')
    expect(r[0].text).toContain('Regn med mønter: 38 kr. og 45 kr.')
    expect(r[0].misconception).toBe('forgotCarry')
  })

  it('leaves slips and watched or resolved ideas out', () => {
    const r = recs(profile({
      misconceptions: { tableNeighbour: misconception('flagged'), mulAsAdd: misconception('watching'), faceValue: misconception('resolved') },
    }))
    expect(withoutR6(r)).toEqual([])
  })

  it('shows at most two concepts, the most evidence first', () => {
    const r = recs(profile({
      misconceptions: {
        forgotCarry: misconception('flagged', 3), zeroPlaceholder: misconception('flagged', 5), mulAsAdd: misconception('flagged', 4),
      },
    }))
    expect(rules(r)).toEqual(['R1', 'R1', 'R6'])
    expect(r.map((x) => x.misconception).slice(0, 2)).toEqual(['zeroPlaceholder', 'mulAsAdd'])
  })
})

describe('R2: right but slow', () => {
  const r2 = (n: number, correct: number, fast: number) =>
    recs(profile(), answers('addTo10', TODAY, n, { correct, fast })).filter((r) => r.rule === 'R2')

  it('needs ≥ 85 % right, < 40 % fast and ≥ 20 answers in 14 days', () => {
    expect(r2(20, 17, 7)).toHaveLength(1)
    expect(r2(19, 17, 7)).toHaveLength(0)
    expect(r2(20, 16, 7)).toHaveLength(0)
    expect(r2(20, 17, 8)).toHaveLength(0)
  })

  it('uses the spec text with the name, the label and a home tip', () => {
    expect(r2(20, 18, 2)[0].text).toBe(
      'Ada regner »Plus til 10« rigtigt, men bruger stadig tid på det. Det er helt normalt – hurtighed kommer med små, hyppige gentagelser. Prøv at slå med to terninger og sige summen, før I tæller prikkerne.',
    )
  })

  it('only counts the last 14 days', () => {
    expect(recs(profile(), answers('addTo10', ago(14), 30, { correct: 30, fast: 0 })).filter((r) => r.rule === 'R2')).toEqual([])
  })

  it('skips a switched-off domain', () => {
    const p = profile({ settings: { ...profile().settings, domainsOff: ['addsub'] } })
    expect(recs(p, answers('addTo10', TODAY, 20, { correct: 20, fast: 0 })).filter((r) => r.rule === 'R2')).toEqual([])
  })
})

describe('R3: a plateau', () => {
  const spread = (skill: 'addTo10' | 'mul6to9', n: number, correct: number) =>
    [0, 2, 4].flatMap((d) => answers(skill, ago(d), n, { correct, fast: correct }))

  it('names a skill practised a lot on three days without moving', () => {
    const p = profile({ keys: keysAt(addKeys, 1) })
    const r = recs(p, spread('addTo10', 11, 7), { [ago(20)]: { snapshot: { addTo10: snap('practising', 1) } } })
    const r3 = r.find((x) => x.rule === 'R3')!
    expect(r3.title).toBe('»Plus til 10« står lidt stille')
    expect(r3.text).toContain('Ada har øvet »Plus til 10« meget de sidste to uger')
  })

  it('does not call it a plateau when the boxes moved or the practice was thin', () => {
    const p = profile({ keys: keysAt(addKeys, 1) })
    expect(recs(p, spread('addTo10', 11, 7), { [ago(20)]: { snapshot: { addTo10: snap('practising', 0.5) } } }).some((x) => x.rule === 'R3')).toBe(false)
    expect(recs(p, spread('addTo10', 9, 6), { [ago(20)]: { snapshot: { addTo10: snap('practising', 1) } } }).some((x) => x.rule === 'R3')).toBe(false)
    const oneDay = answers('addTo10', TODAY, 33, { correct: 20, fast: 20 })
    expect(recs(p, oneDay, { [ago(20)]: { snapshot: { addTo10: snap('practising', 1) } } }).some((x) => x.rule === 'R3')).toBe(false)
  })

  it('points at the table with the lowest mean box for the times tables', () => {
    const index = { ...realIndex, ...tableIndex() }
    const keys = keysAt(index.mul6to9!, (i) => (index.mul6to9![i].family === 't7' ? 1 : 2))
    const p = profile({ grade: 2, keys })
    const r = recs(p, spread('mul6to9', 11, 7), { [ago(20)]: { snapshot: { mul6to9: snap('support', 1.7) } } }, index)
    const r3 = r.find((x) => x.rule === 'R3')!
    expect(r3.title).toBe('7-tabellen driller lidt')
    expect(r3.text).toContain('Den tabel, der driller mest, er 7-tabellen. Prøv at sige 7-tabellen som et rim')
  })
})

describe('R4: forgotten', () => {
  it('suggests a refresh when the status fell in the last two weeks', () => {
    const p = profile({ keys: keysAt(count10Keys, 3) })
    const r = recs(p, [], { [ago(20)]: { snapshot: { count10: snap('independent', 4.5, 0.9) } } })
    const r4 = r.find((x) => x.rule === 'R4')!
    expect(r4.title).toBe('Genopfrisk »Tælle til 10«')
    expect(r4.skill).toBe('count10')
  })

  it('suggests a refresh when the status is below a medal the child earned', () => {
    const p = profile({ keys: keysAt(addKeys, 3), skillMedals: { addTo10: 'gold' } })
    expect(recs(p).find((x) => x.rule === 'R4')?.skill).toBe('addTo10')
    const kept = profile({ keys: keysAt(addKeys, 3), skillMedals: { addTo10: 'bronze' } })
    expect(recs(kept).some((x) => x.rule === 'R4')).toBe(false)
  })
})

describe('R5: "Med støtte" without typed answers for a week', () => {
  const p = profile({ keys: keysAt(addKeys, 3) })

  it('suggests the next step when no answer was typed for 7 days', () => {
    const r5 = recs(p, answers('addTo10', ago(9), 5)).find((x) => x.rule === 'R5')!
    expect(r5.title).toBe('Næste skridt i »Plus til 10«')
    expect(r5.text).toContain('»Kan selv« kræver, at barnet skriver svaret selv på to forskellige dage.')
  })

  it('stays quiet when the child typed answers in the last 7 days (picked cards do not count)', () => {
    expect(recs(p, answers('addTo10', ago(6), 2)).some((x) => x.rule === 'R5')).toBe(false)
    expect(recs(p, answers('addTo10', ago(1), 5, { production: false })).some((x) => x.rule === 'R5')).toBe(true)
  })

  it('does not count a skill skipped at start', () => {
    const seeded = profile({ keys: keysAt(addKeys, 2, { seeded: true, seen: 0, correct: 0 }) })
    expect(recs(seeded).some((x) => x.rule === 'R5')).toBe(false)
  })
})

describe('R6: "Klar til"', () => {
  it('names the first open region not played yet', () => {
    const r = recs(profile())
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ rule: 'R6', title: 'Klar til: Tællelunden', region: 'w0-tal10' })
  })

  it('puts a trial whose rounds are all played first', () => {
    const nodes: ProfileDoc['nodes'] = {}
    for (const n of nodesOfRegion('w0-tal10')) if (n.slot !== 'trial') nodes[n.id as NodeId] = { plays: 1, stars: 2, skipped: false, lastAt: 1 }
    const r = recs(profile({ nodes }))
    expect(r[0].title).toBe('Klar til: mesterprøven i Tællelunden')
    const passed = recs(profile({ nodes, trials: { 'w0-tal10': { attempts: 1, failed: 0, best: 9, passedAt: 5, lastAttemptRound: 1 } } }))
    expect(passed[0].title).toBe('Klar til: Formhaven')
  })
})

describe('priority and limits', () => {
  it('gives at most three, in rule order, never two about the same skill', () => {
    const p = profile({
      keys: { ...keysAt(addKeys, 3), ...keysAt(count10Keys, 3) },
      skillMedals: { addTo10: 'gold', count10: 'gold' },
      misconceptions: { forgotCarry: misconception('flagged') },
    })
    const log = answers('addTo10', TODAY, 20, { correct: 20, fast: 2 })
    const r = recs(p, log)
    expect(r).toHaveLength(MAX_RECOMMENDATIONS)
    expect(rules(r)).toEqual(['R1', 'R2', 'R4'])
    expect(r[1].skill).toBe('addTo10')
    // addTo10 is also forgotten (gold medal, now "Med støtte"), but already recommended
    expect(r[2].skill).toBe('count10')
  })

  it('has nothing to say about a child who has not played, except where to start', () => {
    expect(rules(recs(profile()))).toEqual(['R6'])
  })

  it('writes the name into every text, never "barnet" alone', () => {
    const p = profile({ name: 'Bo', keys: keysAt(addKeys, 3), misconceptions: { forgotCarry: misconception('flagged') } })
    const r = recs(p, answers('addTo10', ago(9), 5))
    expect(r.length).toBeGreaterThan(1)
    for (const x of r) expect(`${x.title} ${x.text}`).toMatch(/\bBo\b/)
  })

  it('works on a key that is set but unseen', () => {
    expect(() => recs(profile({ keys: { [addKeys[0].key]: key(0, { seen: 0 }) } }))).not.toThrow()
  })
})
