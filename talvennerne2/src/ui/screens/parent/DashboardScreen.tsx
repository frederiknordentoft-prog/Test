// The parent dashboard (SPEC §9.1), behind the grown-ups' gate. One child at a time, never a
// comparison; plain adult Danish, no read-aloud. The numbers come from src/parent (pure functions):
// the stored data is read once per child, and the dashboard is rebuilt from the live profile when a
// setting changes.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNav } from '../../../app/nav'
import { PARENT_TABS, type ParentTab, type RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import { FRAME_HEX } from '../../../content/catalog'
import { buildDashboard } from '../../../parent/dashboard'
import { genitive, nameOf } from '../../../parent/format'
import { loadDashboard } from '../../../parent/load'
import type { ProfileDoc } from '../../../engine/types'
import type { DashSource, Dashboard } from '../../../parent/types'
import { useProfile } from '../../../state/useProfile'
import { useSession } from '../../../state/useSession'
import { TopBar } from '../../shell/TopBar'
import { CurriculumTab } from './dashboard/CurriculumTab'
import { MisconceptionsTab } from './dashboard/MisconceptionsTab'
import { OverviewTab } from './dashboard/OverviewTab'
import { PrintReport } from './dashboard/PrintReport'
import { RewardsTab } from './dashboard/RewardsTab'
import { SettingsTab } from './dashboard/SettingsTab'
import { SkillsTab } from './dashboard/SkillsTab'
import { TablesTab } from './dashboard/TablesTab'
import './dashboard/dashboard.css'
import './dashboard/print.css'

const TAB_LABEL: Readonly<Record<ParentTab, string>> = {
  overview: 'Overblik',
  curriculum: 'Pensumkort',
  skills: 'Færdigheder',
  tables: 'Tabeller',
  misconceptions: 'Misforståelser',
  rewards: 'Belønninger',
  settings: 'Indstillinger',
}

export default function DashboardScreen({ route }: ScreenProps<RouteOf<'parent'>>) {
  const profile = useProfile((s) => s.profile)
  const profiles = useSession((s) => s.profiles)
  const lastProfileId = useSession((s) => s.lastProfileId)
  const [tab, setTab] = useState<ParentTab>(route.tab ?? 'overview')
  const [loaded, setLoaded] = useState<{ profile: ProfileDoc; source: DashSource; dashboard: Dashboard } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  /** The child who was playing when the dashboard opened; looking at a sibling never changes that. */
  const origin = useRef<string | null>(profile?.id ?? null)
  /** Set on the way out, so the screen never loads a child while it leaves. */
  const leaving = useRef(false)
  const body = useRef<HTMLDivElement>(null)

  // Opened from the picker: show the child played last (or the first one).
  useEffect(() => {
    if (profile || profiles.length === 0 || leaving.current) return
    const id = lastProfileId && profiles.some((p) => p.id === lastProfileId) ? lastProfileId : profiles[0].id
    void useSession.getState().selectProfile(id)
  }, [profile, profiles, lastProfileId])

  const id = profile?.id ?? null
  useEffect(() => {
    const p = useProfile.getState().profile
    if (!id || !p) return
    let live = true
    setError(null)
    loadDashboard(p)
      .then(({ source, dashboard }) => live && setLoaded({ profile: p, source, dashboard }))
      .catch((err: unknown) => live && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [id, reload])

  // a changed setting rebuilds from the data already read
  const dash = useMemo(() => {
    if (!profile || loaded?.profile.id !== profile.id) return null
    return loaded.profile === profile ? loaded.dashboard : buildDashboard(profile, loaded.source)
  }, [profile, loaded])

  const choose = (next: ParentTab) => {
    setTab(next)
    useNav.getState().replace({ id: 'parent', tab: next }, 'none')
    body.current?.scrollTo({ top: 0 })
  }

  // Back to where the dashboard was opened from, with the child who was playing then.
  const back = () => {
    if (leaving.current) return
    leaving.current = true
    const start = origin.current
    const now = useProfile.getState().profile?.id ?? null
    const session = useSession.getState()
    const restore = start && now !== start ? session.selectProfile(start) : !start && now ? session.leaveProfile() : null
    if (restore) void restore.catch(() => undefined).finally(() => useNav.getState().back())
    else useNav.getState().back()
  }

  const onDeleted = () => {
    leaving.current = true
    origin.current = null
    const left = useSession.getState().profiles.length
    useNav.getState().root(left > 0 ? { id: 'profiles' } : { id: 'parentIntro' }, 'back')
  }

  const title = profile ? `${genitive(profile.name)} fremskridt` : 'Til forældre'
  return (
    <div className="tv-dash">
      <TopBar leading="back" onLeading={back} center={<h1 className="tv-dash__title">{title}</h1>} />
      <div className="tv-dash__sheet">
        <div className="tv-dash__head">
          {profiles.length > 1 && (
            <div className="tv-dash__kids" role="radiogroup" aria-label="Vælg barn">
              {profiles.map((p) => (
                <button
                  key={p.id} type="button" role="radio" aria-checked={p.id === id} className="tv-dkid"
                  style={{ '--frame': FRAME_HEX[p.frameColor] } as CSSProperties}
                  onClick={() => p.id !== id && void useSession.getState().selectProfile(p.id)}
                >
                  <span className="tv-dkid__initial" aria-hidden>{p.initial}</span>
                  {nameOf(p.name)}
                </button>
              ))}
            </div>
          )}
          <nav className="tv-dash__tabs" aria-label="Dashboardets dele">
            {PARENT_TABS.map((t) => (
              <button key={t} type="button" className="tv-dtab" aria-current={t === tab ? 'page' : undefined} onClick={() => choose(t)}>
                {TAB_LABEL[t]}
              </button>
            ))}
          </nav>
        </div>
        <div ref={body} className="tv-dash__body">
          <div className="tv-dash__content">
            {!profile && profiles.length === 0 && <p className="tv-dnote">Der er ingen spillere på denne enhed endnu.</p>}
            {error && <p className="tv-dnote" role="alert">Dataene kunne ikke læses: {error}</p>}
            {profile && !dash && !error && <p className="tv-dnote">Henter …</p>}
            {profile && tab === 'settings' && (
              <SettingsTab profile={profile} onImported={() => setReload((n) => n + 1)} onDeleted={onDeleted} />
            )}
            {dash && tab === 'overview' && <OverviewTab d={dash} onPrint={() => window.print()} />}
            {dash && tab === 'curriculum' && <CurriculumTab d={dash} />}
            {dash && tab === 'skills' && <SkillsTab d={dash} />}
            {dash && tab === 'tables' && <TablesTab d={dash} />}
            {dash && tab === 'misconceptions' && <MisconceptionsTab d={dash} />}
            {dash && tab === 'rewards' && <RewardsTab d={dash} />}
          </div>
        </div>
      </div>
      {dash && <PrintReport d={dash} />}
    </div>
  )
}
