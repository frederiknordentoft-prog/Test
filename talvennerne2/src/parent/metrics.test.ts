import { describe, expect, it } from 'vitest'
import { SKILLS } from '../content/skills'
import { skillRegistry } from '../engine/registry'
import type { SkillId } from '../engine/types'
import { buildDashboard } from './dashboard'
import { ago, answer, answers, dailyFrom, key, keysAt, NOW, profile, snap, source, tableIndex, TODAY, tsOf } from './fixtures'
import { countsText, fmtMinutes, fmtPercent, fmtRelativeDay, fmtSeconds, genitive, lastSentence, sentence, trendText } from './format'
import { keyIndexOf } from './load'
import {
  currentPlace, domainCards, domainScope, learnByDomain, medianPair, nodeName, overview, recentRounds, skillState,
  skillStates, tableGrid, tallies, trendOf, trialRows, windows,
} from './metrics'
import { rewardDays, rewardWhat, rewardWhy } from './rewardText'
import type { Dashboard } from './types'

const reg = skillRegistry()
const realIndex = keyIndexOf(reg)
const addKeys = realIndex.addTo10!

describe('an empty profile', () => {
  const d = buildDashboard(profile(), source({ index: realIndex }))

  it('has fourteen empty days and no accuracy', () => {
    expect(d.overview.days).toHaveLength(14)
    expect(d.overview.days[13].day).toBe(TODAY)
    expect(d.overview.days[0].day).toBe(ago(13))
    expect(d.overview.days.every((x) => !x.active && x.learnMs === 0 && x.playMs === 0)).toBe(true)
    expect(d.overview).toMatchObject({ activeDays: 0, rounds: 0, answers: 0, accuracy: null, place: null })
  })

  it('shows every skill as not started and no trend', () => {
    expect(Object.values(d.skills).every((s) => s.status === 'notStarted' && s.dot === 'notStarted')).toBe(true)
    expect(d.trend).toEqual({ up: [], down: [] })
    expect(d.domains.every((c) => c.counts.notStarted === c.scope.length && c.accuracy === null)).toBe(true)
  })

  it('has an untouched times table, no signs, no recommendations and too little for an estimate', () => {
    // mul2510 is registered, so the grid is there, every product still unseen
    expect(d.tables.available).toBe(true)
    expect(d.tables.rows.flat().every((c) => !c.seen && c.box === 0)).toBe(true)
    expect(d.signs).toEqual({ concepts: [], slips: [], resolved: [] })
    expect(d.recommendations.filter((r) => r.rule !== 'R6')).toEqual([])
    expect(d.estimate.enough).toBe(false)
    expect(d.estimate.text).toBe('Vi ved endnu for lidt')
  })
})

describe('overview (14 days)', () => {
  const log = [...answers('addTo10', TODAY, 10, { correct: 8 }), ...answers('count10', ago(3), 5), ...answers('addTo10', ago(20), 30)]
  const daily = dailyFrom(log, {
    [TODAY]: { learnMs: 9 * 60_000, playMs: 4 * 60_000, rounds: 1 },
    [ago(3)]: { learnMs: 5 * 60_000, rounds: 1 },
    [ago(5)]: { playMs: 10 * 60_000 },
    [ago(20)]: { learnMs: 30 * 60_000, rounds: 3 },
  })
  const o = overview({ profile: profile(), daily, today: TODAY })

  it('keeps learning and play time as two series per day', () => {
    expect(o.days[13]).toMatchObject({ day: TODAY, learnMs: 9 * 60_000, playMs: 4 * 60_000, active: true })
    expect(o.days[8]).toMatchObject({ day: ago(5), learnMs: 0, playMs: 10 * 60_000, active: false })
    expect(o.learnMs).toBe(14 * 60_000)
    expect(o.playMs).toBe(14 * 60_000)
  })

  it('counts active days, rounds, tasks and first-try accuracy inside the window only', () => {
    expect(o.activeDays).toBe(2)
    expect(o.rounds).toBe(2)
    expect(o.answers).toBe(15)
    expect(o.firstTryCorrect).toBe(13)
    expect(o.accuracy).toBeCloseTo(13 / 15)
  })

  it('counts every kept day for the estimate', () => {
    expect(o.total).toEqual({ answers: 45, activeDays: 3 })
  })

  it('leaves retries and golden eggs out of the tasks', () => {
    const extra = [answer({ skill: 'addTo10', mode: 'retry', retryOf: 'x' }), answer({ skill: 'addTo10', mode: 'golden' })]
    const o2 = overview({ profile: profile(), daily: dailyFrom([...log, ...extra]), today: TODAY })
    expect(o2.answers).toBe(15)
  })

  it('names the region played last', () => {
    expect(currentPlace(profile())).toBeNull()
    const p = profile({ nodes: { 'w0-tal10-l1': { plays: 2, stars: 3, skipped: false, lastAt: 5 }, 'w0-plus10-l2': { plays: 1, stars: 1, skipped: false, lastAt: 9 } } })
    expect(currentPlace(p)).toEqual({ world: 'eng', worldName: 'Engdalen', region: 'w0-plus10', regionName: 'Plusengen' })
  })
})

describe('skill status on the dashboard', () => {
  it('maps silver to "Med støtte" and keeps the medal', () => {
    const keys = keysAt(addKeys, (i) => (i < addKeys.length / 2 + 1 ? 4 : 2))
    const p = profile({ keys, skillStats: { addTo10: { prodCorrect: 80, prodDays: [ago(2), ago(1)] } }, skillMedals: { addTo10: 'silver' } })
    const s = skillState('addTo10', p, realIndex)
    expect(s.status).toBe('silver')
    expect(s.dash).toBe('support')
    expect(s.dot).toBe('support')
    expect(s.medal).toBe('silver')
    expect(s.share4).toBeGreaterThanOrEqual(0.5)
  })

  it('shows a seeded skill as skipped at start until a typed answer confirms it', () => {
    const seeded = keysAt(addKeys, 2, { seeded: true, seen: 0, correct: 0 })
    expect(skillState('addTo10', profile({ keys: seeded }), realIndex).dot).toBe('skipped')
    // a card answer is not a confirmation
    const tapped = { ...seeded, [addKeys[0].key]: key(2, { seeded: true, seen: 1, correct: 1 }) }
    expect(skillState('addTo10', profile({ keys: tapped }), realIndex).dot).toBe('skipped')
    const typed = { ...seeded, [addKeys[0].key]: key(3, { seeded: false, seen: 1, correct: 1 }) }
    expect(skillState('addTo10', profile({ keys: typed }), realIndex).dot).toBe('practising')
  })

  it('treats a procedure skill the register does not know by its families', () => {
    const p = profile({ keys: { 'add100Carry/toNextTen': key(4) } })
    const s = skillState('add100Carry', p, {})
    expect(s.keys).toBe(5)
    expect(s.status).toBe('practising')
    expect(s.share4).toBeCloseTo(1 / 5)
  })

  it('has a state for each of the 72 skills', () => {
    expect(Object.keys(skillStates(profile(), realIndex, []))).toHaveLength(SKILLS.length)
  })
})

describe('domain cards', () => {
  it('count over the skills up to grade + 1 and list started skills above it apart', () => {
    const p = profile({ grade: 0, keys: { 'add1000/HTOplusTO': key(1) } })
    const states = skillStates(p, realIndex, [])
    const { scope, ahead } = domainScope('addsub', 0, states)
    expect(scope).toEqual(SKILLS.filter((m) => m.domain === 'addsub' && m.grade <= 1).map((m) => m.id))
    expect(ahead).toEqual(['add1000'])
    const card = domainCards({ ...source({ index: realIndex }), profile: p }, states).find((c) => c.domain === 'addsub')!
    expect(Object.values(card.counts).reduce((a, b) => a + b, 0)).toBe(scope.length)
    expect(card.rows.map((r) => r.skill)).toContain('add1000')
  })

  it('reads the counts as text in the spec order', () => {
    expect(countsText({ independent: 3, support: 2, practising: 1, skipped: 0, notStarted: 4 })).toBe('Kan selv 3 · Med støtte 2 · Øver 1 · Ikke startet 4')
    expect(countsText({ independent: 0, support: 0, practising: 0, skipped: 2, notStarted: 1 })).toBe('Sprunget over ved start 2 · Ikke startet 1')
  })

  it('share each day\'s learning time out by first tries', () => {
    const daily = dailyFrom([...answers('addTo10', TODAY, 3), ...answers('count10', TODAY, 1)], { [TODAY]: { learnMs: 8 * 60_000 } })
    const t = learnByDomain(daily, windows(TODAY).now)
    expect(t.addsub).toBe(6 * 60_000)
    expect(t.number).toBe(2 * 60_000)
    expect(t.clock).toBe(0)
  })

  it('mark a switched-off domain', () => {
    const p = profile({ settings: { ...profile().settings, domainsOff: ['clock'] } })
    const cards = domainCards({ ...source({ index: realIndex }), profile: p }, skillStates(p, realIndex, []))
    expect(cards.find((c) => c.domain === 'clock')!.off).toBe(true)
    expect(cards.find((c) => c.domain === 'number')!.off).toBe(false)
  })
})

describe('trend (status changes in 14 days)', () => {
  const states = (p = profile()) => skillStates(p, realIndex, [])

  it('counts a skill as moved up when its status now is above the last snapshot before the window', () => {
    const keys = keysAt(addKeys, 3)
    const st = states(profile({ keys }))
    expect(st.addTo10.dash).toBe('support')
    expect(trendOf(['addTo10'], st, { addTo10: snap('practising') })).toEqual({ up: ['addTo10'], down: [] })
    // first played inside the window: it was not started before
    expect(trendOf(['addTo10'], st, {})).toEqual({ up: ['addTo10'], down: [] })
    expect(trendOf(['addTo10'], st, { addTo10: snap('support') })).toEqual({ up: [], down: [] })
    // silver to "Med støtte" is no change on the dots
    expect(trendOf(['addTo10'], st, { addTo10: snap('silver') })).toEqual({ up: [], down: [] })
  })

  it('never counts a skill skipped at start as moved (QA3b: "Rykket op" beside "Sprunget over ved start")', () => {
    // seeded in box 2 and tapped in a round since (no typed answer yet): the dot is still dashed
    const seeded = keysAt(addKeys, 2, { seeded: true, seen: 1, correct: 1 })
    const st = states(profile({ keys: seeded }))
    expect(st.addTo10.dot).toBe('skipped')
    expect(st.addTo10.dash).not.toBe('notStarted')
    expect(trendOf(['addTo10'], st, {})).toEqual({ up: [], down: [] })
    // once a typed answer confirms it, it counts as usual
    const typed = states(profile({ keys: { ...seeded, [addKeys[0].key]: key(3, { seeded: false, seen: 1, correct: 1 }) } }))
    expect(trendOf(['addTo10'], typed, {})).toEqual({ up: ['addTo10'], down: [] })
  })

  it('counts a fall as "ser ud til at være glemt"', () => {
    const st = states(profile({ keys: keysAt(addKeys, 3) }))
    expect(trendOf(['addTo10'], st, { addTo10: snap('independent') })).toEqual({ up: [], down: ['addTo10'] })
  })

  it('reads the trend from the daily snapshots in the dashboard', () => {
    const keys = { ...keysAt(addKeys, 3), ...keysAt(realIndex.count10!, 0, { seen: 2 }) }
    const daily = dailyFrom([], {
      [ago(20)]: { snapshot: { addTo10: snap('practising'), count10: snap('independent') } },
      [ago(2)]: { snapshot: { addTo10: snap('support') } },
    })
    const d = buildDashboard(profile({ keys }), source({ index: realIndex, daily }))
    expect(d.trend).toEqual({ up: ['addTo10'], down: ['count10'] })
    expect(trendText(d.trend.up.length, d.trend.down.length)).toBe('+1 færdighed rykket op · 1 ser ud til at være glemt')
    expect(trendText(2, 0)).toBe('+2 færdigheder rykket op')
    expect(trendText(0, 0)).toBe('Ingen ændringer de sidste 14 dage')
  })
})

describe('skill rows', () => {
  const log = [
    ...answers('addTo10', TODAY, 10, { correct: 9, fast: 6, family: 'small' }),
    ...answers('addTo10', ago(2), 10, { correct: 10, fast: 2, family: 'big' }),
    ...answers('addTo10', ago(16), 4, { ms: 8000 }),
  ]
  const keys = keysAt(addKeys, (i) => (i < 20 ? 4 : 1))
  const p = profile({ keys })
  const input = { ...source({ index: realIndex, answers: log, daily: dailyFrom(log) }), profile: p }
  const row = domainCards(input, skillStates(p, realIndex, input.daily)).flatMap((c) => c.rows).find((r) => r.skill === 'addTo10')!

  it('has accuracy, fast and right-but-slow shares of the 14 days', () => {
    expect(row.answers).toBe(20)
    expect(row.accuracy).toBeCloseTo(19 / 20)
    expect(row.fastShare).toBeCloseTo(8 / 20)
    expect(row.slowShare).toBeCloseTo(11 / 20)
    expect(row.lastPractised).toBe(TODAY)
  })

  it('has the share in box 4–5 for the bar with its 80 % mark', () => {
    expect(row.share4).toBeCloseTo(20 / addKeys.length)
  })

  it('breaks down by family with labels', () => {
    expect(row.families.map((f) => f.label)).toEqual(['Til 5', 'Til 10'])
    const small = row.families[0]
    expect(small.answers).toBe(10)
    expect(small.accuracy).toBeCloseTo(0.9)
    expect(small.keys + row.families[1].keys).toBe(addKeys.length)
  })

  it('compares the median time to a typed answer now with two weeks before', () => {
    expect(row.median.now).toBe(3000)
    expect(row.median.before).toBe(8000)
    // fewer than three answers: no median
    const thin = medianPair(answers('addTo10', ago(16), 2), TODAY, () => true)
    expect(thin.before).toBeNull()
    // the placement's answers never count in the statistics (pædagogik §4.2, SPEC A24)
    const placed = answers('addTo10', ago(16), 5).map((a) => ({ ...a, mode: 'placement' as const, nodeId: 'placement' as const }))
    expect(medianPair(placed, TODAY, () => true).before).toBeNull()
    expect(medianPair(answers('addTo10', ago(16), 5), TODAY, () => true).before).not.toBeNull()
  })

  it('formats times, shares and days in Danish', () => {
    expect(fmtSeconds(4250)).toBe('4,3 s')
    expect(fmtPercent(0.874)).toBe('87 %')
    expect(fmtMinutes(65 * 60_000)).toBe('1 t 5 min')
    expect(fmtMinutes(20_000)).toBe('under 1 min')
    expect(fmtRelativeDay(TODAY, TODAY)).toBe('i dag')
    expect(fmtRelativeDay(ago(1), TODAY)).toBe('i går')
    expect(fmtRelativeDay(ago(4), TODAY)).toBe('for 4 dage siden')
    expect(fmtRelativeDay('2026-09-01', TODAY)).toBe('1. sep.')
    expect(genitive('Ada')).toBe('Adas')
    expect(genitive('Mads')).toBe("Mads'")
    expect(sentence('På plads siden 29. sep.')).toBe('På plads siden 29. sep.')
    expect(sentence('Bestået')).toBe('Bestået.')
    expect(lastSentence('Svaret ligger lige ved siden af, fx fra 6- eller 8-tabellen. Det er helt normalt, mens tabellen sætter sig.'))
      .toBe('Det er helt normalt, mens tabellen sætter sig.')
  })

  it('tallies first tries per skill from the daily aggregates', () => {
    expect(tallies(input.daily, windows(TODAY).now).addTo10).toEqual({ n: 20, correct: 19, fast: 8, nProd: 20 })
  })
})

describe('times table grid', () => {
  it('is empty until a multiplication skill exists', () => {
    const noTables = Object.fromEntries(Object.entries(realIndex).filter(([skill]) => !skill.startsWith('mul'))) as typeof realIndex
    expect(tableGrid(profile(), noTables).available).toBe(false)
    expect(tableGrid(profile(), realIndex).available).toBe(true)
  })

  it('colours each product by its box, the same key both ways round', () => {
    const p = profile({ keys: { 'mul:3x7': key(4), 'mul:2x5': key(1) } })
    const g = tableGrid(p, tableIndex())
    expect(g.available).toBe(true)
    expect(g.rows[6][2]).toMatchObject({ a: 7, b: 3, key: 'mul:3x7', skill: 'mul34', box: 4, seen: true })
    expect(g.rows[2][6]).toMatchObject({ key: 'mul:3x7', box: 4 })
    expect(g.rows[4][1]).toMatchObject({ key: 'mul:2x5', skill: 'mul2510', box: 1 })
    expect(g.rows[8][8]).toMatchObject({ key: 'mul:9x9', skill: 'mul6to9', box: 0, seen: false })
    // 1 · 1 belongs to no table skill
    expect(g.rows[0][0].key).toBeNull()
    expect(g.rows.flat().filter((c) => c.key !== null)).toHaveLength(99)
  })

  it('shows played products even before the skill is registered (an import)', () => {
    expect(tableGrid(profile({ keys: { 'mul:6x7': key(2) } }), {}).available).toBe(true)
  })
})

describe('trials, rounds and the reward log', () => {
  it('lists open and passed trials', () => {
    const p = profile({ trials: { 'w0-tal10': { attempts: 2, failed: 1, best: 9, passedAt: tsOf(ago(1)), lastAttemptRound: 3 } } })
    const rows = trialRows(p)
    expect(rows.find((r) => r.id === 'w0-tal10')).toMatchObject({ state: 'passed', best: 9, size: 10, attempts: 2, name: 'Tællelunden' })
    expect(rows.find((r) => r.id === 'w0-former')).toMatchObject({ state: 'open', attempts: 0 })
    expect(rows.some((r) => r.id === 'w3-areal')).toBe(false)
  })

  it('groups the latest rounds from the log, first tries only', () => {
    const log = [
      answer({ skill: 'addTo10', roundId: 'a', nodeId: 'w0-plus10-l1', ts: tsOf(ago(1), 9) }),
      answer({ skill: 'addTo10', roundId: 'a', nodeId: 'w0-plus10-l1', ts: tsOf(ago(1), 9, 1), correct: false }),
      answer({ skill: 'addTo10', roundId: 'a', nodeId: 'w0-plus10-l1', ts: tsOf(ago(1), 9, 2), mode: 'retry', retryOf: 'x' }),
      answer({ skill: 'count10', roundId: 'b', nodeId: 'practice', ts: tsOf(TODAY, 9) }),
    ]
    const r = recentRounds(log)
    expect(r.map((x) => x.roundId)).toEqual(['b', 'a'])
    expect(r[1]).toMatchObject({ where: 'Plusengen · 1. tur', tasks: 2, firstTryCorrect: 1 })
    expect(r[0].where).toBe('Blandet øvelse')
    expect(nodeName('w1-klokken-trial')).toBe('Urtårnet · mesterprøven')
    expect(nodeName('eng-finale')).toBe('Engdalen · finalen')
  })

  it('says what was earned and how', () => {
    expect(rewardWhat({ ts: 0, kind: 'medal', what: 'gold:addTo10', why: '' })).toBe('Guldmedalje i Plus til 10')
    expect(rewardWhat({ ts: 0, kind: 'animal', what: 'rabbit:lop:c2', why: '' })).toBe('Ny ven: Kanin (grå)')
    expect(rewardWhat({ ts: 0, kind: 'item', what: 'opdager-head', why: '' })).toBe('Ny ting: Opdagerhat')
    expect(rewardWhat({ ts: 0, kind: 'stars', what: 'w0-plus10-l1:3', why: '' })).toBe('3 stjerner på Plusengen · 1. tur')
    expect(rewardWhy('round:w0-plus10-l2')).toBe('En tur: Plusengen · 2. tur')
    expect(rewardWhy('friend:round:w0-tal10-friend')).toBe('Fundet på Tællelunden · venneturen')
    expect(rewardWhy('egg:3')).toBe('Klækket af æg nr. 3')
    expect(rewardWhy('shop')).toBe('Købt for perler')
    expect(rewardWhy('medal:silver:5')).toBe('5 sølvmedaljer i alt')
    expect(rewardWhy('medal:gold:addTo10')).toBe('Nåede »Kan selv«')
  })

  it('sums the perler per day and lists the rest newest first', () => {
    const p = profile({
      rewardLog: [
        { ts: tsOf(ago(1), 9), kind: 'perler', what: '12', why: 'round:w0-plus10-l1' },
        { ts: tsOf(ago(1), 10), kind: 'perler', what: '8', why: 'round:w0-plus10-l2' },
        { ts: tsOf(ago(1), 10, 5), kind: 'level', what: '2', why: 'level:2' },
        { ts: tsOf(TODAY, 9), kind: 'trophy', what: 'days-3', why: 'round:w0-plus10-l3' },
      ],
    })
    const days = rewardDays(p)
    expect(days.map((d) => d.day)).toEqual([TODAY, ago(1)])
    expect(days[1].perler).toBe(20)
    expect(days[1].rows.map((r) => r.what)).toEqual(['Niveau 2'])
    expect(days[0].rows[0].what).toBe('Trofæ: Tre dage med regning')
  })
})

describe('never a score', () => {
  /** Every key and string in the dashboard model. */
  function walk(x: unknown, keys: string[], strings: string[]): void {
    if (typeof x === 'string') strings.push(x)
    else if (Array.isArray(x)) x.forEach((v) => walk(v, keys, strings))
    else if (x && typeof x === 'object') {
      for (const [k, v] of Object.entries(x)) {
        keys.push(k)
        walk(v, keys, strings)
      }
    }
  }

  function busyDashboard(): Dashboard {
    const log = [...answers('addTo10', TODAY, 30, { correct: 28, fast: 5 }), ...answers('count10', ago(1), 20)]
    const keys = { ...keysAt(addKeys, 3), ...keysAt(realIndex.count10!, 5) }
    return buildDashboard(
      profile({ keys, skillStats: { count10: { prodCorrect: 60, prodDays: [ago(5), ago(3), ago(1)] } } }),
      source({ index: realIndex, answers: log, daily: dailyFrom(log, { [TODAY]: { learnMs: 600_000, rounds: 3 } }) }),
    )
  }

  it('has no score, points or rating anywhere in the model', () => {
    const keys: string[] = []
    const strings: string[] = []
    walk(busyDashboard(), keys, strings)
    expect(keys.filter((k) => /score|point|rating|rank|grade_?score|percent/i.test(k))).toEqual([])
    expect(strings.filter((s) => /score|point|\/\s*100|af 100|ud af 100/i.test(s))).toEqual([])
  })

  it('shows no number 0–100 as a mastery score on a domain card', () => {
    const d = busyDashboard()
    for (const c of d.domains) {
      const numeric = Object.entries(c).filter(([, v]) => typeof v === 'number').map(([k]) => k)
      // only measured quantities: answers, accuracy (a share 0–1, shown as "rigtige"), time
      expect(numeric.sort()).toEqual(['accuracy', 'answers', 'learnMs'].filter((k) => typeof (c as unknown as Record<string, unknown>)[k] === 'number').sort())
    }
  })

  it('has every number of the model finite', () => {
    const d = busyDashboard()
    const nums: number[] = []
    const visit = (x: unknown) => {
      if (typeof x === 'number') nums.push(x)
      else if (x && typeof x === 'object') Object.values(x).forEach(visit)
    }
    visit(d)
    expect(nums.every(Number.isFinite)).toBe(true)
  })

  it('uses the registered skills by their keys', () => {
    const ids = Object.keys(realIndex) as SkillId[]
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.every((id) => (realIndex[id]?.length ?? 0) > 0)).toBe(true)
  })

  it('has learning days in the window', () => {
    expect(windows(TODAY)).toEqual({ now: { from: ago(13), to: TODAY }, before: { from: ago(27), to: ago(14) } })
    expect(NOW).toBeGreaterThan(0)
  })
})
