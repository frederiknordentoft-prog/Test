// "Udskriv rapport" (SPEC §9.1 point 13): one printable page set, grouped by Fælles Mål and domain,
// without perler, prices or animals. Rendered beside the app (a portal) and only shown in print.
import { createPortal } from 'react-dom'
import { DOMAINS } from '../../../../content/skills'
import {
  countsText, DOT_LABEL, fmtDate, fmtMinutes, fmtPercent, fmtRelativeDay, nameOf, plural, trendText,
} from '../../../../parent/format'
import { afterAt } from '../../../../parent/signs'
import type { Dashboard } from '../../../../parent/types'
import { StatusDot } from './charts'
import { KAN_SELV_NOTE } from './parts'

const GROUPS = ['Tal og algebra', 'Geometri og måling'] as const

/** The report itself (exported for tests; the app mounts it through PrintReport). */
export function Report({ d }: { d: Dashboard }) {
  const o = d.overview
  const name = nameOf(d.name)
  const passed = d.trials.filter((t) => t.state === 'passed')
  return (
    <article className="tv-print" aria-hidden>
      <header className="tv-print__head">
        <h1>{name} · {d.grade}. klasse</h1>
        <p>Talvennerne 2 · rapport udskrevet {fmtDate(d.today)}</p>
      </header>

      <section>
        <h2>De sidste 14 dage</h2>
        <p>
          {o.activeDays} {plural(o.activeDays, 'aktiv dag', 'aktive dage')} · {o.rounds} {plural(o.rounds, 'tur', 'ture')} · {o.answers} {plural(o.answers, 'opgave', 'opgaver')} ·{' '}
          {o.accuracy === null ? 'ingen svar' : `${fmtPercent(o.accuracy)} rigtige i første forsøg`} · læringstid {fmtMinutes(o.learnMs)}
        </p>
        <p>Tendens: {trendText(d.trend.up.length, d.trend.down.length)}.</p>
        <p>Niveau: {d.estimate.text}.</p>
      </section>

      {d.recommendations.length > 0 && (
        <section>
          <h2>Anbefalinger</h2>
          {d.recommendations.map((r) => (
            <div key={`${r.rule}-${r.skill ?? r.misconception ?? r.region}`} className="tv-print__rec">
              <h3>{r.title}</h3>
              <p>{r.text}</p>
            </div>
          ))}
        </section>
      )}

      {GROUPS.map((group) => (
        <section key={group}>
          <h2>{group}</h2>
          {d.domains.filter((c) => DOMAINS.find((x) => x.id === c.domain)?.group === group).map((c) => (
            <div key={c.domain} className="tv-print__domain">
              <h3>{c.label}{c.off ? ' (fravalgt)' : ''}</h3>
              <p className="tv-print__meta">{countsText(c.counts)} · {trendText(c.trend.up.length, c.trend.down.length)}</p>
              <table>
                <tbody>
                  {c.rows.map((r) => (
                    <tr key={r.skill}>
                      <td className="tv-print__dot"><StatusDot kind={r.dot} size={12} label={null} /></td>
                      <td>{r.label}</td>
                      <td>{r.grade}. kl.</td>
                      <td>{DOT_LABEL[r.dot]}</td>
                      <td>{r.keys > 0 && r.dot !== 'notStarted' && r.dot !== 'skipped' ? `${fmtPercent(r.share4)} sikre` : ''}</td>
                      <td>{r.lastPractised ? `øvet ${fmtRelativeDay(r.lastPractised, d.today)}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ))}

      {(d.signs.concepts.length > 0 || d.signs.slips.length > 0) && (
        <section>
          <h2>Misforståelser</h2>
          {d.signs.concepts.map((s) => (
            <div key={s.id} className="tv-print__rec">
              <h3>Vi har set tegn på, at {name} {afterAt(s.title)}</h3>
              <p>Fx {s.example}. Prøv derhjemme: {s.homeTip}</p>
            </div>
          ))}
          {d.signs.slips.length > 0 && <p>Typiske fejl lige nu: {d.signs.slips.map((s) => `${s.where[0] ? `${s.where[0]}: ` : ''}${s.title}`).join('; ')}.</p>}
        </section>
      )}

      {passed.length > 0 && (
        <section>
          <h2>Beståede mesterprøver</h2>
          <p>{passed.map((t) => t.name).join(', ')}.</p>
        </section>
      )}

      <p className="tv-print__note">{KAN_SELV_NOTE} Status kan falde igen, hvis noget bliver glemt.</p>
    </article>
  )
}

/** The report, mounted beside the app so print CSS can show it alone. */
export function PrintReport({ d }: { d: Dashboard }) {
  if (typeof document === 'undefined') return null
  return createPortal(<Report d={d} />, document.body)
}
