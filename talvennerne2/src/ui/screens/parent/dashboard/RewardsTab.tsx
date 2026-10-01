// Belønninger (SPEC §9.1 points 10–11, §13.13): the mastery trials, the latest rounds and the reward
// log — what the child earned and how. Everything is earned by doing sums.
import { fmtDate, fmtTsDate, fmtRelativeDay, nameOf, plural } from '../../../../parent/format'
import type { Dashboard, TrialRow } from '../../../../parent/types'
import { Note, Panel, Section } from './parts'

function trialText(t: TrialRow): string {
  if (t.state === 'passed') return `Bestået ${t.passedAt ? fmtTsDate(t.passedAt) : ''}${t.best ? ` · bedst ${t.best} af ${t.size}` : ''}`
  if (t.attempts === 0) return 'Ikke prøvet endnu'
  const tries = `${t.attempts} ${plural(t.attempts, 'forsøg', 'forsøg')} · bedst ${t.best} af ${t.size}`
  return t.bridge ? `${tries} · hjælpebroen er åben` : tries
}

export function RewardsTab({ d }: { d: Dashboard }) {
  const name = nameOf(d.name)
  const passed = d.trials.filter((t) => t.state === 'passed')
  const open = d.trials.filter((t) => t.state === 'open')
  return (
    <>
      <Note>Alt i spillet optjenes ved at regne. Intet kan købes for rigtige penge, og intet optjent kan gå tabt.</Note>
      <Section title="Mesterprøver" sub={`En mesterprøve er 10 skrevne svar uden hjælp; 8 rigtige består. Efter tre forsøg åbner en hjælpebro, så ${name} kan komme videre alligevel.`}>
        <Panel>
          {passed.length + open.length === 0 && <p>Ingen mesterprøver endnu.</p>}
          {passed.length > 0 && (
            <>
              <h3 className="tv-dh3">Bestået</h3>
              <ul className="tv-dlist">
                {passed.map((t) => <li key={t.id}><span>{t.name}</span><span className="tv-dmuted">{trialText(t)}</span></li>)}
              </ul>
            </>
          )}
          {open.length > 0 && (
            <>
              <h3 className="tv-dh3">Åbne</h3>
              <ul className="tv-dlist">
                {open.map((t) => <li key={t.id}><span>{t.name}</span><span className="tv-dmuted">{trialText(t)}</span></li>)}
              </ul>
            </>
          )}
        </Panel>
      </Section>

      <Section title="Seneste ture">
        {d.recentRounds.length > 0 ? (
          <Panel>
            <ul className="tv-dlist">
              {d.recentRounds.map((r) => (
                <li key={r.roundId}>
                  <span>{r.where}</span>
                  <span className="tv-dmuted">{fmtRelativeDay(r.day, d.today)} · {r.firstTryCorrect} af {r.tasks} rigtige i første forsøg</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Note>{name} har ikke spillet en tur de sidste fire uger.</Note>
        )}
      </Section>

      <Section title="Belønningslog" sub="Hvad der er optjent, og hvordan.">
        {d.rewards.length > 0 ? (
          d.rewards.map((day) => (
            <Panel key={day.day} className="tv-dlog">
              <h3 className="tv-dh3">{fmtRelativeDay(day.day, d.today) === fmtDate(day.day) ? fmtDate(day.day) : `${fmtRelativeDay(day.day, d.today)} · ${fmtDate(day.day)}`}</h3>
              <ul className="tv-dlist">
                {day.perler !== null && <li><span>{day.perler} perler</span><span className="tv-dmuted">For rigtige svar, stjerner og mesterprøver</span></li>}
                {day.rows.map((r, i) => <li key={`${r.ts}-${i}`}><span>{r.what}</span><span className="tv-dmuted">{r.why}</span></li>)}
              </ul>
            </Panel>
          ))
        ) : (
          <Note>Intet optjent endnu.</Note>
        )}
      </Section>
    </>
  )
}
