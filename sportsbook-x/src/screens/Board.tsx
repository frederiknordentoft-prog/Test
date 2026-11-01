import { CATEGORIES, type Category, type Market } from '../data/catalog';

interface Props {
  markets: Market[];
  category: Category | 'alle';
  onCategory: (c: Category | 'alle') => void;
  onOpen: (m: Market) => void;
}

function lead(m: Market) {
  if (m.layout === 'ladder') return m.selections[0];
  return [...m.selections].sort((a, b) => b.prob - a.prob)[0];
}

/**
 * Market board: every market on one canvas. Standard view shows probability only.
 * Tile size follows the number of choices (ladders are wide), not betting volume.
 */
export function Board({ markets, category, onCategory, onOpen }: Props) {
  const shown = markets.filter((m) => category === 'alle' || m.category === category);
  return (
    <section aria-label="Markedsbræt">
      <h1 className="sr-only">Markedsbræt</h1>
      <div className="pills" role="group" aria-label="Kategorier">
        <button className="pill" aria-pressed={category === 'alle'} onClick={() => onCategory('alle')}>Alle</button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className="pill" aria-pressed={category === c.id} onClick={() => onCategory(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '10px 0 0' }}>
        Sandsynlighed som standard. Priser opdateres højst hvert 10. sekund.
      </p>
      <div className="grid-board">
        {shown.map((m) => {
          const l = lead(m);
          const pct = Math.round((l?.prob ?? 0) * 100);
          return (
            <button
              key={m.id}
              className={`tile${m.layout === 'ladder' ? ' wide' : ''}`}
              onClick={() => onOpen(m)}
              aria-label={`${m.title}. Højeste: ${l?.label}, ${pct} procent`}
            >
              <small>{m.league}</small>
              <strong>{m.title}</strong>
              <div>
                <div className="lead">
                  <span>{l?.label}</span>
                  <b className="num">{pct} %</b>
                </div>
                <div className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
