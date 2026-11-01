import { combinedOdds, combinedProb, potentialReturn, type SlipSelection } from '../state/betslip';
import { formatOdds, type OddsFormat } from '../odds/format';

interface Props {
  legs: SlipSelection[];
  stake: number;
  mode: 'single' | 'combined';
  format: OddsFormat;
  onStake: (n: number) => void;
  onMode: (m: 'single' | 'combined') => void;
  onRemove: (id: string) => void;
  onPlace: () => void;
  onClose: () => void;
}

/** Bet slip. Single bets by default. Combined view is opened on purpose, shows its probability, and assumes independent legs. */
export function SlipSheet({ legs, stake, mode, format, onStake, onMode, onRemove, onPlace, onClose }: Props) {
  const canCombine = legs.length >= 2;
  const effectiveMode = canCombine ? mode : 'single';
  const combOdds = combinedOdds(legs);
  const combProb = combinedProb(legs);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Bet slip">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Slip</strong>
        <button className="back" onClick={onClose} aria-label="Luk slip">Luk</button>
      </div>

      {legs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Ingen valg endnu.</p>}

      <div className="row-list">
        {legs.map((l) => (
          <div key={l.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div>
              <div>{l.label}</div>
              <small style={{ color: 'var(--text-muted)' }}>
                <span className="num">{formatOdds(l.odds, format)}</span> · <span className="num">{Math.round(l.prob * 100)} %</span>
              </small>
            </div>
            <button className="btn ghost" onClick={() => onRemove(l.id)} aria-label={`Fjern ${l.label}`} style={{ minHeight: 40, padding: '8px 12px' }}>
              Fjern
            </button>
          </div>
        ))}
      </div>

      <div className="stake">
        <label htmlFor="stake">Indsats (kr)</label>
        <input id="stake" className="num" type="number" min={1} step={10} value={stake} onChange={(e) => onStake(Math.max(0, Number(e.target.value) || 0))} />
      </div>

      {legs.length >= 1 && (
        <div style={{ marginTop: 14 }}>
          <div className="seg" role="group" aria-label="Visning">
            <button aria-pressed={effectiveMode === 'single'} onClick={() => onMode('single')}>Enkelt</button>
            <button aria-pressed={effectiveMode === 'combined'} onClick={() => onMode('combined')} disabled={!canCombine} aria-disabled={!canCombine}>
              Kombinér
            </button>
          </div>

          {effectiveMode === 'single' && (
            <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text-muted)' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {legs.map((l) => (
                  <li key={l.id} className="num" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', gap: 8 }}>
                    <span>{l.label}</span>
                    <span>Udbetaling {(stake * l.odds).toFixed(2).replace('.', ',')} kr</span>
                  </li>
                ))}
              </ul>
              <div className="num" style={{ marginTop: 8, color: 'var(--text)' }}>
                Indsats i alt: {(stake * legs.length).toFixed(0)} kr ({legs.length} enkeltbets)
              </div>
            </div>
          )}

          {effectiveMode === 'combined' && (
            <div className="card" style={{ marginTop: 12, fontSize: 14 }}>
              <div className="num">Samlet odds {formatOdds(combOdds, format)}</div>
              <div className="num" style={{ marginTop: 4 }}>Samlet sandsynlighed {(combProb * 100).toFixed(1).replace('.', ',')} %</div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                Antager at benene er uafhængige. Korrelation mellem valg er ikke modelleret.
              </small>
            </div>
          )}

          {effectiveMode === 'combined' && (
            <div className="num" style={{ marginTop: 12, fontSize: 18 }}>
              Udbetaling ved kombineret bet: {potentialReturn(stake, legs).toFixed(2).replace('.', ',')} kr
            </div>
          )}
        </div>
      )}

      <button className="btn" style={{ width: '100%', marginTop: 16 }} onClick={onPlace} disabled={legs.length === 0 || stake <= 0}>
        Læg bet (demo)
      </button>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
        DEMO: ingen bet placeres. Ingen penge, ingen konto.
      </p>
    </div>
  );
}
