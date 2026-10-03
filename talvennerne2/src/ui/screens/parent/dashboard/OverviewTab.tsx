// Overblik: the recommendations first, then the last 14 days (time, active days, rounds, tasks,
// first-try accuracy, where the child is now), the trend and the grade estimate.
import { SKILL_BY_ID } from '../../../../content/skills'
import type { SkillId } from '../../../../engine/types'
import { fmtMinutes, fmtPercent, nameOf, plural, trendText } from '../../../../parent/format'
import { ESTIMATE_MIN_ANSWERS, ESTIMATE_MIN_DAYS } from '../../../../parent/gradeEstimate'
import type { Dashboard } from '../../../../parent/types'
import { DayBars, DayCalendar } from './charts'
import { DashButton, KAN_SELV_NOTE, Note, Panel, Section, Stat } from './parts'

const labels = (skills: readonly SkillId[]) => skills.map((s) => SKILL_BY_ID[s].label).join(', ')

export function OverviewTab({ d, onPrint }: { d: Dashboard; onPrint: () => void }) {
  const o = d.overview
  const name = nameOf(d.name)
  const where = o.place
    ? o.place.regionName ? `${name} er nu i ${o.place.regionName} i ${o.place.worldName}.` : `${name} er nu i ${o.place.worldName}.`
    : `${name} har ikke spillet en tur endnu.`
  return (
    <>
      <Section title="Anbefalinger">
        {d.recommendations.length > 0 ? (
          <ol className="tv-drecs">
            {d.recommendations.map((r) => (
              <li key={`${r.rule}-${r.skill ?? r.misconception ?? r.region}`} className="tv-drec">
                <h3 className="tv-drec__title">{r.title}</h3>
                <p className="tv-drec__text">{r.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <Note>Ingen forslag lige nu. Der kommer forslag her, når {name} har spillet lidt mere.</Note>
        )}
      </Section>

      <Section title="De sidste 14 dage" sub={where}>
        <div className="tv-dstats">
          <Stat value={o.activeDays} label={`${plural(o.activeDays, 'aktiv dag', 'aktive dage')} af 14`} />
          <Stat value={o.rounds} label={plural(o.rounds, 'tur', 'ture')} />
          <Stat value={o.answers} label={plural(o.answers, 'opgave', 'opgaver')} />
          <Stat value={o.accuracy === null ? '–' : fmtPercent(o.accuracy)} label="rigtige i første forsøg" />
        </div>
        <Panel className="tv-dtime">
          <div className="tv-dtime__head">
            <h3 className="tv-dh3">Tid pr. dag</h3>
            <ul className="tv-dkey">
              <li><span className="tv-dkey__swatch tv-dkey__swatch--learn" />Læring {fmtMinutes(o.learnMs)}</li>
              <li><span className="tv-dkey__swatch tv-dkey__swatch--play" />Leg med dyr og tøj {fmtMinutes(o.playMs)}</li>
            </ul>
          </div>
          <DayBars days={o.days} today={d.today} />
        </Panel>
        <Panel>
          <h3 className="tv-dh3">Aktive dage</h3>
          <DayCalendar days={o.days} today={d.today} />
        </Panel>
      </Section>

      <Section title="Tendens" sub="Ændringer i status de sidste 14 dage">
        <Panel>
          <p className="tv-dlead">{trendText(d.trend.up.length, d.trend.down.length)}</p>
          {d.trend.up.length > 0 && <p className="tv-dline"><b>Rykket op:</b> {labels(d.trend.up)}</p>}
          {d.trend.down.length > 0 && <p className="tv-dline"><b>Ser ud til at være glemt:</b> {labels(d.trend.down)}</p>}
        </Panel>
      </Section>

      <Section title="Niveau">
        <Panel>
          <p className="tv-dlead">{d.estimate.text}</p>
          {d.estimate.enough ? (
            d.estimate.independent.length > 0 && <p className="tv-dline"><b>Kan selv:</b> {labels(d.estimate.independent)}</p>
          ) : (
            <p className="tv-dline">
              Et skøn kræver mindst {ESTIMATE_MIN_ANSWERS} svar fordelt på mindst {ESTIMATE_MIN_DAYS} dage. Indtil nu: {d.estimate.answers} svar på{' '}
              {d.estimate.activeDays} {plural(d.estimate.activeDays, 'dag', 'dage')}.
            </p>
          )}
          <p className="tv-dline tv-dmuted">Kun tal og regning (Tal og tælling, Titalssystemet, Plus og minus, Gange og division). Færdigheder, {name} sprang over ved start, tæller ikke med.</p>
        </Panel>
      </Section>

      <Note>{KAN_SELV_NOTE}</Note>
      <div className="tv-dactions">
        <DashButton onClick={onPrint}>Udskriv rapport</DashButton>
      </div>
    </>
  )
}
