// The dashboard's views render every tab from a computed model, keep the house rules in what they
// show (no ×/÷, no score, status as shape + word) and print without perler or animals.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { skillRegistry } from '../../../../engine/registry'
import { buildDashboard } from '../../../../parent/dashboard'
import { ago, answers, dailyFrom, key, keysAt, misconception, profile, snap, source, TODAY } from '../../../../parent/fixtures'
import { keyIndexOf } from '../../../../parent/load'
import { RELEASED_WORLDS } from '../../../../meta/built'
import type { Dashboard } from '../../../../parent/types'
import { StatusDot, TableGridView } from './charts'
import { CurriculumTab } from './CurriculumTab'
import { MisconceptionsTab } from './MisconceptionsTab'
import { OverviewTab } from './OverviewTab'
import { Report as PrintReport } from './PrintReport'
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

  it('count the skills up to the grade above, never past 3. klasse (QA3 P3-1)', () => {
    const d = demo()
    expect(renderToStaticMarkup(<SkillsTab d={d} />)).toContain('færdighederne til og med 2. klasse.')
    const third = renderToStaticMarkup(<SkillsTab d={{ ...d, grade: 3 }} />)
    expect(third).toContain('færdighederne til og med 3. klasse.')
    expect(third).not.toContain('4. klasse')
  })

  it('render the settings with export, import, delete and the voice credit', () => {
    const html = renderToStaticMarkup(<SettingsTab profile={profile()} onImported={() => {}} onDelete={async () => {}} />)
    expect(html).toContain('Følg lydløs-knappen')
    expect(html).toContain('Gør kopien klar')
    expect(html).toContain('Hent fra en fil')
    expect(html).toContain('Slet Adas profil')
    expect(html).toContain('Røst-v3 Chatterbox fra CoRal-projektet (Alexandra Instituttet), OpenRAIL-licens')
    expect(html).toContain('href="./lyt.html"')
  })

  it('never show × or ÷, a score or a streak', () => {
    for (const html of all(demo())) {
      expect(html).not.toMatch(/[\u00d7\u00f7]/)
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
    // "Skift spiller" and "Ny spiller" are always at the top, also with a single child (review P1-1)
    expect(html).toMatch(/<button[^>]*data-switch-player=""[^>]*>.*Skift spiller<\/button>/)
    expect(html).toMatch(/<button[^>]*data-new-player=""[^>]*>.*Ny spiller<\/button>/)
  })

  it('render the grade and the places a grown-up can open (review P2-10)', () => {
    const html = renderToStaticMarkup(<SettingsTab profile={profile({ grade: 1 })} onImported={() => {}} onDelete={async () => {}} />)
    expect(html).toContain('Klassetrin')
    expect(html.match(/data-set-grade="/g)).toHaveLength(4)
    expect(html).toMatch(/aria-pressed="true"[^>]*data-set-grade="1"/)
    expect(html).toContain('Verdener og steder')
    expect(html).toContain('data-world-row="eng"')
    expect(html).toContain('Tiervennernes hule')
    // the released worlds can be opened; until Stjernefjeldet is released it "comes later"
    expect(html).toContain('Åbn hele Hestebakkerne')
    expect(html).toContain('Åbn hele Regnbueskoven')
    if (RELEASED_WORLDS.has('fjeld')) {
      expect(html).toContain('Børn i 0.–2. klasse starter i Engdalen')
      expect(html).toContain('Åbn hele Stjernefjeldet')
      expect(html).not.toContain('senere version')
    } else {
      expect(html).toContain('Alle børn starter i Engdalen')
      expect(html).toContain('Verdenen kommer i en senere version.')
    }
  })

  it('draw the 10 · 10 table with the products in its titles', () => {
    const html = renderToStaticMarkup(<TableGridView grid={tableGrid(profile({ keys: { 'mul:3x7': key(4) } }), tableIndex())} />)
    expect(html).toContain('3 · 7 = 21: boks 4, sidder fast')
    expect(html).toContain('7 · 3 = 21: boks 4, sidder fast')
    expect(html.match(/<rect/g)).toHaveLength(100)
  })
})

describe('counts in words (QA2 P3-14)', () => {
  it('says "1 aktiv dag af 14" and "1 opgave", and "2 aktive dage" in the overview and the print', () => {
    const base = demo()
    const one: Dashboard = { ...base, overview: { ...base.overview, activeDays: 1, rounds: 1, answers: 1 } }
    const two: Dashboard = { ...base, overview: { ...base.overview, activeDays: 2, rounds: 2, answers: 2 } }
    const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const view1 = text(renderToStaticMarkup(<OverviewTab d={one} onPrint={() => {}} />))
    expect(view1).toContain('aktiv dag af 14')
    expect(view1).not.toContain('aktive dag ')
    expect(view1).toMatch(/1 opgave\b(?!r)/)
    const print1 = text(renderToStaticMarkup(<PrintReport d={one} />))
    expect(print1).toContain('1 aktiv dag ·')
    expect(print1).toContain('1 tur ·')
    expect(print1).toContain('1 opgave ·')
    const view2 = text(renderToStaticMarkup(<OverviewTab d={two} onPrint={() => {}} />))
    expect(view2).toContain('aktive dage af 14')
    const print2 = text(renderToStaticMarkup(<PrintReport d={two} />))
    expect(print2).toContain('2 aktive dage ·')
    expect(print2).toContain('2 opgaver ·')
  })
})
