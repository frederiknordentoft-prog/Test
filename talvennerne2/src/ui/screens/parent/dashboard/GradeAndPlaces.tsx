// Indstillinger, first two sections (SPEC §8, §9.1 point 12, review P2-10): the child's grade — fixed
// when a child moves up a class, or when the onboarding was left before the grade — and the worlds and
// regions a grown-up can open. Plain adult Danish, no read-aloud. Opening only ever adds to
// profile.unlocked (dashboard/openings.ts); nothing is closed again, and nothing is lost.
import { useMemo } from 'react'
import type { Grade, ProfileDoc, SkillId } from '../../../../engine/types'
import { nameOf } from '../../../../parent/format'
import { useProfile } from '../../../../state/useProfile'
import {
  GRADES, applyGrade, openingRows, regionOpenings, withOpenings, worldOpenings, type Openings,
} from './openings'
import { DashButton, Panel, Section } from './parts'

export function GradeSection({ profile, registered }: { profile: ProfileDoc; registered: ReadonlySet<SkillId> }) {
  const name = nameOf(profile.name)
  const setGrade = (g: Grade) => useProfile.getState().update((p) => applyGrade(p, g, registered))
  return (
    <Section title="Klassetrin" sub={`Ret det, når ${name} rykker op – eller hvis opstarten blev afbrudt, før klassetrinnet blev valgt.`}>
      <Panel>
        <div className="tv-dgrades" role="group" aria-label="Klassetrin">
          {GRADES.map((g) => (
            <button key={g} type="button" className="tv-dgrade" aria-pressed={profile.grade === g} onClick={() => setGrade(g)} data-set-grade={g}>
              {g}. klasse
            </button>
          ))}
        </div>
        <p className="tv-dline">Dashboardet tæller færdighederne med til og med {Math.min(profile.grade + 1, 3)}. klasse.</p>
        <p className="tv-dline">
          Alle børn starter i Engdalen, indtil indplaceringen er klar. Fra 1. klasse åbner klassetrinnet alle steder i verdenerne under det. Et lavere
          klassetrin lukker ikke noget igen.
        </p>
      </Panel>
    </Section>
  )
}

export function PlacesSection({ profile, registered }: { profile: ProfileDoc; registered: ReadonlySet<SkillId> }) {
  const name = nameOf(profile.name)
  const rows = useMemo(() => openingRows(profile, registered), [profile, registered])
  const open = (add: Openings) => useProfile.getState().update((p) => withOpenings(p, add))
  return (
    <Section
      title="Verdener og steder"
      sub={`Åbn et sted, så ${name} kan spille der med det samme – også uden at have klaret stederne før. Det lukkes ikke igen, og intet går tabt.`}
    >
      {rows.map((w) => (
        <Panel key={w.id} className="tv-dworld">
          <div className="tv-dworld__head" data-world-row={w.id}>
            <h3 className="tv-dworld__name">{w.name}</h3>
            <span className="tv-dworld__grade">{w.grade}. klasse</span>
          </div>
          {w.ready ? (
            <>
              <ul className="tv-dplaces">
                {w.regions.map((r) => (
                  <li key={r.id} className="tv-dplace" data-place={r.id} data-open={r.open ? '' : undefined}>
                    <span className="tv-dplace__name">{r.name}</span>
                    {r.open ? (
                      <span className="tv-dplace__state">Åben</span>
                    ) : r.openable ? (
                      <DashButton onClick={() => open(regionOpenings(r.id, registered))}>Åbn</DashButton>
                    ) : (
                      <span className="tv-dplace__state is-later">Kommer senere</span>
                    )}
                  </li>
                ))}
              </ul>
              {w.closed.length > 1 && (
                <div className="tv-dactions">
                  <DashButton onClick={() => open(worldOpenings(w.id, registered))}>Åbn hele {w.name}</DashButton>
                </div>
              )}
            </>
          ) : (
            <p className="tv-dmuted">Der er ingen opgaver her endnu. Verdenen kommer i en senere version.</p>
          )}
        </Panel>
      ))}
    </Section>
  )
}
