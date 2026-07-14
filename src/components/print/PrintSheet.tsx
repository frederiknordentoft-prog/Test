import {
  RECIPES,
  SIZE_LABELS,
  TEMP_LABELS,
  type Milestone,
  type NightAdjustment,
  type PlanInput,
} from '../../lib/schedule';
import { formatColdProof, formatDayTimeAbsolute, grams } from '../../lib/format';

/**
 * A standalone paper version of the whole plan. Hidden on screen
 * (`display:none`), shown only in `@media print`, so "Gem som PDF" produces a
 * self-contained sheet the baker can follow without the app.
 */
export function PrintSheet({
  milestones,
  input,
  adjustment,
}: {
  milestones: Milestone[];
  input: PlanInput;
  adjustment: NightAdjustment;
}) {
  const r = RECIPES[input.size];
  const rows: Array<[string, number]> = [
    ['Aktiv surdej', r.starter],
    ['Vand', r.water],
    ['Mel', r.flour],
    ['Salt', r.salt],
  ];

  return (
    <div className="print-sheet" aria-hidden="true">
      <h1 className="print-title">🍞 Min bageplan for surdejsbrød</h1>
      <p className="print-intro">
        Planen er beregnet baglæns fra dit færdig-tidspunkt. Følg trinene oppefra og ned.
        Hævetider er vejledende — gå efter dejen, ikke kun uret.
      </p>
      <p className="print-meta">
        {SIZE_LABELS[input.size]} · {TEMP_LABELS[input.temp]} · koldhævning{' '}
        {formatColdProof(adjustment.effectiveColdProofMin)}
      </p>
      {adjustment.note && <p className="print-adjust">{adjustment.note}</p>}

      <section className="print-recipe">
        <h2>Opskrift</h2>
        <ul>
          {rows.map(([label, amount]) => (
            <li key={label}>
              <span>{label}</span>
              <span>{grams(amount)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Tidsplan</h2>
        <ol className="print-steps">
          {milestones.map((m) => (
            <li key={m.id} className="print-step">
              <div className="print-when">{formatDayTimeAbsolute(m.at)}</div>
              <div className="print-what">
                {m.icon} {m.title}
              </div>
              <p className="print-desc">{m.description}</p>
              {m.note && <p className="print-step-note">💡 {m.note}</p>}
            </li>
          ))}
        </ol>
      </section>

      <p className="print-footer">
        Hævetider er vejledende — gå efter dejen, ikke kun uret. God fornøjelse!
      </p>
    </div>
  );
}
