// Pensumkort (SPEC §9.1 point 3): Fælles Mål groups and domains as rows, 0.–3. klasse as columns,
// one dot per skill with both colour and shape. A row opens to name its skills.
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { DOMAINS, SKILLS } from '../../../../content/skills'
import type { DomainId, Grade } from '../../../../engine/types'
import { DOT_LABEL, countsText } from '../../../../parent/format'
import type { Dashboard, DotKind } from '../../../../parent/types'
import { StatusDot } from './charts'
import { DotLegend, KAN_SELV_NOTE, Note, Section } from './parts'

const GRADES: readonly Grade[] = [0, 1, 2, 3]
const GROUPS = ['Tal og algebra', 'Geometri og måling'] as const

export const domainStyle = (d: DomainId) =>
  ({ '--dc': `var(--color-d-${d})`, '--dc-deep': `var(--color-d-${d}-deep)`, '--dc-soft': `var(--color-d-${d}-soft)` }) as CSSProperties

export function CurriculumTab({ d }: { d: Dashboard }) {
  const [open, setOpen] = useState<DomainId | null>(null)
  return (
    <Section title="Pensumkort" sub="Hver prik er en færdighed. Tryk på en række for at se navnene.">
      <DotLegend />
      <div className="tv-dmap">
        <div className="tv-dmap__cols" aria-hidden>
          <span />
          {GRADES.map((g) => <span key={g}>{g}. kl.</span>)}
        </div>
        {GROUPS.map((group) => (
          <div key={group} className="tv-dmap__group">
            <h3 className="tv-dmap__heading">{group}</h3>
            {DOMAINS.filter((x) => x.group === group).map((dm) => {
              const skills = SKILLS.filter((m) => m.domain === dm.id)
              const isOpen = open === dm.id
              const counts: Record<DotKind, number> = { notStarted: 0, practising: 0, support: 0, independent: 0, skipped: 0 }
              for (const m of skills) counts[d.skills[m.id].dot] += 1
              return (
                <div key={dm.id} className="tv-dmap__domain" style={domainStyle(dm.id)}>
                  <button
                    type="button" className="tv-dmap__row" aria-expanded={isOpen} aria-label={`${dm.label}: ${countsText(counts)}`}
                    onClick={() => setOpen(isOpen ? null : dm.id)}
                  >
                    <span className="tv-dmap__name">{dm.label}</span>
                    {GRADES.map((g) => (
                      <span key={g} className="tv-dmap__cell">
                        {skills.filter((m) => m.grade === g).map((m) => <StatusDot key={m.id} kind={d.skills[m.id].dot} label={null} />)}
                      </span>
                    ))}
                  </button>
                  {isOpen && (
                    <ul className="tv-dmap__list">
                      {skills.map((m) => (
                        <li key={m.id}>
                          <StatusDot kind={d.skills[m.id].dot} label={null} />
                          <span className="tv-dmap__skill">{m.label}</span>
                          <span className="tv-dmap__status">{m.grade}. kl. · {DOT_LABEL[d.skills[m.id].dot]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <Note>{KAN_SELV_NOTE} Prikkerne viser status lige nu; den kan falde igen, hvis noget bliver glemt. Medaljerne i spillet bliver, hvor de er.</Note>
    </Section>
  )
}
