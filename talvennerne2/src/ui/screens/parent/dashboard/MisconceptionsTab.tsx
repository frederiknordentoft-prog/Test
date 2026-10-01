// Misforståelser (SPEC §4.3, §9.1 point 7): "Vi har set tegn på …" (concepts, at most two, with a
// home tip), "Typiske fejl lige nu" (slips, in a neutral tone) and "Ser ud til at være på plads".
import { fmtTsDate, lastSentence, nameOf, sentence } from '../../../../parent/format'
import { afterAt, personal } from '../../../../parent/signs'
import type { Dashboard } from '../../../../parent/types'
import { Note, Panel, Section } from './parts'

export function MisconceptionsTab({ d }: { d: Dashboard }) {
  const name = nameOf(d.name)
  const { concepts, slips, resolved } = d.signs
  const nothing = concepts.length === 0 && slips.length === 0 && resolved.length === 0
  return (
    <>
      <Section title="Vi har set tegn på …" sub="Appen siger først noget, når den samme fejl går igen i flere forskellige opgaver og på flere dage – og oftere, end gæt kan forklare.">
        {concepts.length > 0 ? (
          concepts.map((s) => (
            <Panel key={s.id} className="tv-dsign">
              <h3 className="tv-dh3">… at {name} {afterAt(s.title)}</h3>
              <p className="tv-dsign__example">Fx: {s.example}</p>
              <p>{personal(s.parent, name)}</p>
              {s.where.length > 0 && <p className="tv-dmuted">Set i: {s.where.join(', ')}</p>}
              <div className="tv-dtip">
                <h4 className="tv-dtip__title">Prøv derhjemme</h4>
                <p>{s.homeTip}</p>
              </div>
            </Panel>
          ))
        ) : (
          <Note>{nothing ? `Vi har ikke set tegn på misforståelser hos ${name}.` : 'Ingen lige nu.'}</Note>
        )}
      </Section>

      <Section title="Typiske fejl lige nu" sub="Små fejl, som er helt almindelige, mens noget sætter sig.">
        {slips.length > 0 ? (
          <Panel>
            <ul className="tv-dslips">
              {slips.map((s) => (
                <li key={s.id}>
                  {s.where.length > 0 && <b>{s.where[0]}: </b>}
                  {name} {s.title} (fx {s.example}). {lastSentence(s.parent)}
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Note>Ingen lige nu.</Note>
        )}
      </Section>

      <Section title="Ser ud til at være på plads">
        {resolved.length > 0 ? (
          <Panel>
            <ul className="tv-dslips">
              {resolved.map((s) => (
                <li key={s.id}>
                  Tidligere tegn på, at {name} {afterAt(s.title)}. {s.resolvedAt ? sentence(`På plads siden ${fmtTsDate(s.resolvedAt)}`) : ''}
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Note>Her kommer det, som {name} har fået styr på efter et tegn.</Note>
        )}
      </Section>
    </>
  )
}
