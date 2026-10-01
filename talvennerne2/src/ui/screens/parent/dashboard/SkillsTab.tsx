// Færdigheder: one card per domain (counts per status, trend, accuracy, answer time, time spent)
// with its skills as rows that fold out (share in box 4–5 with the 80 % mark, last practised,
// accuracy, median answer time, right-but-slow and the families).
import { countsText, fmtMinutes, fmtPercent, fmtRelativeDay, fmtSeconds, MEDAL_LABEL, plural, trendText } from '../../../../parent/format'
import type { Dashboard, DomainCard, MedianPair, SkillRow } from '../../../../parent/types'
import { DOT_LABEL } from '../../../../parent/format'
import { ShareBar, StatusDot } from './charts'
import { domainStyle } from './CurriculumTab'
import { KAN_SELV_NOTE, Note, Section } from './parts'

function medianText(m: MedianPair): string {
  if (m.now === null && m.before === null) return '–'
  const now = m.now === null ? 'for få svar' : fmtSeconds(m.now)
  return m.before === null ? now : `${now} (for 14 dage siden ${fmtSeconds(m.before)})`
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="tv-dfact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function SkillDetails({ r, today }: { r: SkillRow; today: string }) {
  return (
    <details className="tv-dskill">
      <summary className="tv-dskill__sum">
        <StatusDot kind={r.dot} label={null} />
        <span className="tv-dskill__name">{r.label}</span>
        <span className="tv-dskill__status">{DOT_LABEL[r.dot]}</span>
        <span className="tv-dskill__bar">
          <ShareBar value={r.share4} />
          <span className="tv-dskill__share">{r.keys === 0 ? 'kommer senere' : r.skipped ? 'ikke prøvet endnu' : `${fmtPercent(r.share4)} sikre`}</span>
        </span>
      </summary>
      <div className="tv-dskill__body">
        <dl className="tv-dfacts">
          <Fact label="Sidst øvet" value={r.lastPractised ? fmtRelativeDay(r.lastPractised, today) : 'ikke endnu'} />
          <Fact label="Rigtige i første forsøg (14 dage)" value={r.accuracy === null ? '–' : `${fmtPercent(r.accuracy)} af ${r.answers} svar`} />
          <Fact label="Rigtigt men langsomt (14 dage)" value={r.slowShare === null ? '–' : fmtPercent(r.slowShare)} />
          <Fact label="Median svartid, skrevne svar" value={medianText(r.median)} />
          {r.medal && <Fact label="Medalje i spillet" value={MEDAL_LABEL[r.medal]} />}
        </dl>
        {r.families.length > 1 && (
          <table className="tv-dfam">
            <thead>
              <tr><th scope="col">Del</th><th scope="col">Sikre (boks 4–5)</th><th scope="col">Rigtige, 14 dage</th></tr>
            </thead>
            <tbody>
              {r.families.map((f) => (
                <tr key={f.family}>
                  <th scope="row">{f.label}</th>
                  <td>{f.seen === 0 ? 'ikke øvet' : `${Math.round(f.share4 * f.keys)} af ${f.keys}`}</td>
                  <td>{f.accuracy === null ? '–' : `${fmtPercent(f.accuracy)} af ${f.answers}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="tv-dmuted">Bjælken viser, hvor stor en del af opgaverne der sidder fast (boks 4–5). Stregen ved 80 % er grænsen for »Kan selv«.</p>
      </div>
    </details>
  )
}

function DomainPanel({ c, today }: { c: DomainCard; today: string }) {
  const started = c.rows.filter((r) => r.dot !== 'notStarted')
  const waiting = c.rows.filter((r) => r.dot === 'notStarted')
  return (
    <article className="tv-ddomain" style={domainStyle(c.domain)}>
      <header className="tv-ddomain__head">
        <span className="tv-ddomain__chip" aria-hidden />
        <h3 className="tv-ddomain__title">{c.label}</h3>
        {c.off && <span className="tv-ddomain__off">Fravalgt</span>}
      </header>
      <p className="tv-ddomain__counts">{countsText(c.counts)}</p>
      <dl className="tv-dfacts tv-dfacts--row">
        <Fact label="Tendens" value={trendText(c.trend.up.length, c.trend.down.length)} />
        <Fact label="Rigtige i første forsøg" value={c.accuracy === null ? '–' : `${fmtPercent(c.accuracy)} af ${c.answers}`} />
        <Fact label="Svartid, skrevne svar" value={medianText(c.median)} />
        <Fact label="Tid brugt" value={fmtMinutes(c.learnMs)} />
      </dl>
      {c.ahead.length > 0 && <p className="tv-dmuted">Desuden i gang med {c.ahead.length} {plural(c.ahead.length, 'færdighed', 'færdigheder')} fra et højere klassetrin.</p>}
      {started.length > 0 && (
        <div className="tv-ddomain__rows">
          {started.map((r) => <SkillDetails key={r.skill} r={r} today={today} />)}
        </div>
      )}
      {waiting.length > 0 && (
        <p className="tv-ddomain__waiting">
          <StatusDot kind="notStarted" size={14} label={null} /> Ikke startet: {waiting.map((r) => r.label).join(', ')}
        </p>
      )}
    </article>
  )
}

export function SkillsTab({ d }: { d: Dashboard }) {
  return (
    <Section title="Færdigheder" sub={`Tal for de sidste 14 dage. Hvert emne viser færdighederne til og med ${d.grade + 1}. klasse.`}>
      {d.domains.map((c) => <DomainPanel key={c.domain} c={c} today={d.today} />)}
      <Note>{KAN_SELV_NOTE}</Note>
    </Section>
  )
}
