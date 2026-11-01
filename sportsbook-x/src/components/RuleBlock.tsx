import type { Rules } from '../data/catalog';

/** Static settlement block. No countdowns. Changes are dated and never overwrite the original text. */
export function RuleBlock({ rules }: { rules: Rules }) {
  return (
    <section className="card rules" aria-label="Regler">
      <dl>
        <dt>Afgørelseskilde</dt>
        <dd>{rules.source}</dd>
        <dt>Slutning</dt>
        <dd>{rules.cutoff}</dd>
        <dt>Kanttilfælde</dt>
        <dd>{rules.edge}</dd>
      </dl>
      {rules.changes.length > 0 && (
        <div className="changes">
          {rules.changes.map((c, i) => (
            <div key={i}>Tillæg {c.date}: {c.text}</div>
          ))}
        </div>
      )}
    </section>
  );
}
