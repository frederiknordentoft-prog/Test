// The dashboard's views render every tab from a computed model, keep the house rules in what they
// show (no ×/÷, no score, status as shape + word) and print without perler or animals.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { skillRegistry } from '../../../../engine/registry'
import { buildDashboard } from '../../../../parent/dashboard'
import { ago, answers, dailyFrom, key, keysAt, misconception, profile, snap, source, TODAY } from '../../../../parent/fixtures'
import { keyIndexOf } from '../../../../parent/load'
import type { Dashboard } from '../../../../parent/types'
import { StatusDot, TableGridView } from './charts'
import { CurriculumTab } from './CurriculumTab'
import { MisconceptionsTab } from './MisconceptionsTab'
import { OverviewTab } from './OverviewTab'
import { RewardsTab } from './RewardsTab'
import { SettingsTab } from './SettingsTab'
import { SkillsTab } from './SkillsTab'
import { TablesTab } from './TablesTab'
import { tableGrid } from '../../../../parent/metrics'
import { tableIndex } from '../../../../parent/fixtures'
import DashboardScreen from '../DashboardScreen'

const index = keyIndexOf(skillRegistry())

function demo(): Dashboard {
  const log = [...answers('addTo10', TODAY, 25, { correct: 23, fast: 6 }), ...answers('count10', ago(2), 12), ...answers('compareLength', ago(1), 8, { correct: 5, errorTag: 'lengthByEnd' })]
  const p = profile({
    grade: 1,
    keys: { ...keysAt(index.addTo10!, 3), ...keysAt(index.count10!, 5), ...keysAt(index.tenFriends!, 2, { seeded: true, seen: 0, correct: 0 }), 'order20/after': key(1) },
    skillStats: { count10: { prodCorrect: 60, prodDays: [ago(5), ago(3), ago(1)] } },
    skillMedals: { count10: 'gold' },
    misconceptions: { lengthByEnd: misconception('flagged'), countFromFirst: misconception('flagged'), digitSwap: misconception('resolved') },
    rewardLog: [{ ts: Date.parse(`${ago(1)}T10:00:00Z`), kind: 'perler', what: '14', why: 'round:w0-plus10-l1' }, { ts: Date.parse(`${ago(1)}T10:01:00Z`), kind: 'animal', what: 'cat:domestic:c1', why: 'friend:round:w0-plus10-friend' }],
  })
  return buildDashboard(p, source({ index, answers: log, daily: dailyFrom(log, { [TODAY]: { learnMs: 600_000, playMs: 300_000, rounds: 3 }, [ago(20)]: { snapshot: { count10: snap('practising') } } }) }))
}

const all = (d: Dashboard) => [
  renderToStaticMarkup(<OverviewTab d={d} onPrint={() => {}} />),
  renderToStaticMarkup(<CurriculumTab d={d} />),
  renderToStaticMarkup(<SkillsTab d={d} />),
  renderToStaticMarkup(<TablesTab d={d} />),
  renderToStaticMarkup(<MisconceptionsTab d={d} />),
  renderToStaticMarkup(<RewardsTab d={d} />),
]

describe('dashboard views', () => {
  it('render every tab', () => {
    const html = all(demo())
    expect(html[0]).toContain('Anbefalinger')
    expect(html[0]).toContain('Kan selv kræver, at barnet skriver svaret selv på to forskellige dage.')
    expect(html[1]).toContain('Pensumkort')
    expect(html[2]).toContain('Plus til 10')
    expect(html[4]).toContain('Vi har set tegn på')
    expect(html[4]).toContain('Typiske fejl lige nu')
    expect(html[4]).toContain('Ser ud til at være på plads')
    expect(html[5]).toContain('Mesterprøver')
  })

  it('render the settings with export, import, delete and the voice credit', () => {
    const html = renderToStaticMarkup(<SettingsTab profile={profile()} onImported={() => {}} onDeleted={() => {}} />)
    expect(html).toContain('Følg lydløs-knappen')
    expect(html).toContain('Gør kopien klar')
    expect(html).toContain('Hent fra en fil')
    expect(html).toContain('Slet Adas profil')
    expect(html).toContain('Røst-v3 Chatterbox fra CoRal-projektet (Alexandra Instituttet), OpenRAIL-licens')
    expect(html).toContain('href="./lyt.html"')
  })

  it('never show × or ÷, a score or a streak', () => {
    for (const html of all(demo())) {
      expect(html).not.toMatch(/[×÷]/)
      expect(html).not.toMatch(/score|point|streak|i træk|i streg/i)
    }
  })

  it('draw every status with its own shape', () => {
    const shapes = (['notStarted', 'practising', 'support', 'independent', 'skipped'] as const).map((k) => renderToStaticMarkup(<StatusDot kind={k} />))
    expect(new Set(shapes).size).toBe(5)
    expect(shapes[4]).toContain('stroke-dasharray')
    expect(shapes[3]).toContain('aria-label="Kan selv"')
  })

  it('render the screen with its tabs before any child exists', () => {
    const html = renderToStaticMarkup(<DashboardScreen route={{ id: 'parent' }} />)
    for (const t of ['Overblik', 'Pensumkort', 'Færdigheder', 'Tabeller', 'Misforståelser', 'Belønninger', 'Indstillinger']) expect(html).toContain(`>${t}</button>`)
    expect(html).toContain('Der er ingen spillere på denne enhed endnu.')
    expect(html).toContain('aria-current="page"')
  })

  it('draw the 10 · 10 table with the products in its titles', () => {
    const html = renderToStaticMarkup(<TableGridView grid={tableGrid(profile({ keys: { 'mul:3x7': key(4) } }), tableIndex())} />)
    expect(html).toContain('3 · 7 = 21: boks 4, sidder fast')
    expect(html).toContain('7 · 3 = 21: boks 4, sidder fast')
    expect(html.match(/<rect/g)).toHaveLength(100)
  })
})
