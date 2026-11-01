import type { Market, Selection } from '../data/catalog';

interface Props {
  market: Market;
  onPick: (s: Selection) => void;
  pickedIds: Set<string>;
}

/** Ranked outright list. Shares sum to 100 %. The "Andet" row is info only. */
export function Ladder({ market, onPick, pickedIds }: Props) {
  const top = market.selections[0]?.prob ?? 1;
  return (
    <div>
      <div className="ladder" role="list">
        {market.selections.map((s) => (
          <button
            key={s.id}
            role="listitem"
            className="ladder-row"
            aria-pressed={pickedIds.has(s.id)}
            onClick={() => onPick(s)}
          >
            <span>{s.label}</span>
            <span className="pct num">{Math.round(s.prob * 100)} % · {s.odds.toFixed(2).replace('.', ',')}</span>
            <span className="bar" aria-hidden="true"><i style={{ width: `${(s.prob / top) * 100}%` }} /></span>
          </button>
        ))}
        {market.infoRows.map((r) => (
          <div key={r.label} className="ladder-row info" role="listitem" aria-disabled="true">
            <span>{r.label}</span>
            <span className="pct num">{Math.round(r.prob * 100)} %</span>
            <span className="bar" aria-hidden="true"><i style={{ width: `${(r.prob / top) * 100}%`, opacity: 0.4 }} /></span>
          </div>
        ))}
      </div>
      <div className="ladder-foot">
        <span>I alt 100 %</span>
        <span>Kun information for "Andet"</span>
      </div>
    </div>
  );
}
