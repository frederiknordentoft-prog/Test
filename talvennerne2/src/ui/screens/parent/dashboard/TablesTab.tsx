// Tabeller (SPEC §9.1 point 6): the 10 · 10 table, each product shaded by its box. Empty while no
// times-table skill is known to this build and none has been played (metrics.tableGrid).
import { nameOf } from '../../../../parent/format'
import type { Dashboard } from '../../../../parent/types'
import { TableGridView } from './charts'
import { Note, Panel, Section } from './parts'

const STEPS: readonly { cls: string; label: string }[] = [
  { cls: 'new', label: 'Ikke øvet' },
  { cls: '0', label: 'Boks 0' },
  { cls: '1', label: 'Boks 1' },
  { cls: '2', label: 'Boks 2' },
  { cls: '3', label: 'Boks 3' },
  { cls: '4', label: 'Boks 4' },
  { cls: '5', label: 'Boks 5' },
]

export function TablesTab({ d }: { d: Dashboard }) {
  const name = nameOf(d.name)
  if (!d.tables.available) {
    return (
      <Section title="Tabeller">
        <Note>
          Gitteret fyldes ud, når {name} begynder på gangetabellerne. 2-, 5- og 10-tabellen hører til i Regnbueskoven (2. klasse), 3- og 4-tabellen og 6-
          til 9-tabellen i Stjernefjeldet (3. klasse).
        </Note>
      </Section>
    )
  }
  const seen = d.tables.rows.flat().filter((c) => c.key && c.seen).length
  return (
    <Section title="Tabeller" sub={seen > 0 ? `Hvert felt er et gangestykke. Jo mørkere, jo bedre sidder det fast hos ${name}.` : `${name} er ikke begyndt på gangetabellerne endnu.`}>
      <Panel className="tv-dgrid">
        <TableGridView grid={d.tables} />
        <ul className="tv-dgrid__key" aria-label="Forklaring">
          {STEPS.map((s) => (
            <li key={s.cls}><span className={`tv-dgrid__swatch tv-grid__cell--${s.cls}`} />{s.label}</li>
          ))}
        </ul>
      </Panel>
      <Note>Et gangestykke rykker en boks op, når svaret er rigtigt og kommer hurtigt. Boks 4 og 5 kræver, at {name} skriver svaret selv på forskellige dage. 3 · 7 og 7 · 3 er samme felt.</Note>
    </Section>
  )
}
