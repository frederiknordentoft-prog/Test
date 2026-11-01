import type { DemoBet } from '../state/demoBets';
import { formatOdds, type OddsFormat } from '../odds/format';

interface Props {
  bets: DemoBet[];
  format: OddsFormat;
  /** Cash-out offer for a single open bet at the current price step. */
  quoteFor: (bet: DemoBet) => number;
  /** Current price step of the bet's market. The offer is valid for this step only. */
  stepFor: (bet: DemoBet) => number;
  onCashOut: (bet: DemoBet, offer: number, step: number) => void;
}

const kr = (n: number) => `${n.toFixed(2).replace('.', ',')} kr`;

/** Demo bets kept in this tab. Nothing is stored between reloads, and no money moves. */
export function OpenBets({ bets, format, quoteFor, stepFor, onCashOut }: Props) {
  return (
    <section aria-label="Mine bets (demo)">
      <h1 style={{ fontSize: 22, letterSpacing: '-0.02em', margin: '4px 0 6px' }}>Mine bets</h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 12px' }}>
        DEMO: lokalt i denne fane. Ingen penge.
      </p>

      {bets.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Ingen demo-bets endnu.</p>}

      <div className="row-list">
        {bets.map((bet) => {
          const offer = quoteFor(bet);
          const step = stepFor(bet);
          return (
            <article key={bet.id} className="card" aria-label={bet.label}>
              <div style={{ fontSize: 15 }}>{bet.label}</div>
              <div className="num" style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Indsats {kr(bet.stake)} · odds {formatOdds(bet.odds, format)}
              </div>

              {bet.status === 'cashed' && (
                <div className="num" style={{ marginTop: 10 }}>Afregnet (demo): {kr(bet.cashedOut ?? 0)}</div>
              )}

              {bet.status === 'open' && bet.kind === 'combined' && (
                <div style={{ marginTop: 10, fontSize: 14, color: 'var(--text-muted)' }}>
                  Kombinerede bets kan ikke afregnes før kampene er slut (demo).
                </div>
              )}

              {bet.status === 'open' && bet.kind === 'single' && (
                <div style={{ marginTop: 10 }}>
                  <div className="num">Tilbud nu: {kr(offer)}</div>
                  <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 4 }}>
                    Tilbuddet kan være lavere end din indsats. Det opdateres højst hvert 10. sekund.
                  </small>
                  {bet.requote && (
                    <small role="status" style={{ display: 'block', color: 'var(--warn)', marginTop: 6 }}>
                      Prisen er ændret siden tilbuddet blev vist. Accepter igen for det nye tilbud.
                    </small>
                  )}
                  <button
                    className="btn"
                    style={{ marginTop: 10, width: '100%' }}
                    disabled={offer <= 0}
                    onClick={() => onCashOut(bet, offer, step)}
                  >
                    Accepter tilbud (demo)
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
