import { useMemo } from 'react';
import { ForecastCurve } from '../components/ForecastCurve';
import { fixtureFor, feedFor, type Market } from '../data/catalog';
import { probSeries, stateAt } from '../odds/feed';

interface Props {
  fixtureId: string;
  minute: number;
  markets: Market[];
  onOpen: (m: Market) => void;
}

export function Match({ fixtureId, minute, markets, onOpen }: Props) {
  const f = fixtureFor(fixtureId);
  const feed = feedFor(fixtureId);
  const series = useMemo(() => (f ? probSeries(feed, f.lamH, f.lamA) : []), [f, feed]);
  if (!f) return null;
  const s = stateAt(feed, minute);
  const lastEvent = [...s.past].reverse().find((e) => e.kind === 'goal' || e.kind === 'card' || e.kind === 'half' || e.kind === 'full');
  const eventText = !lastEvent
    ? minute === 0 ? `Kickoff ${f.kickoff}` : 'Ingen hændelser endnu'
    : lastEvent.kind === 'goal' ? `Mål ${lastEvent.side === 'h' ? f.home : f.away} · ${lastEvent.minute}'`
    : lastEvent.kind === 'card' ? `Kort · ${lastEvent.minute}'`
    : lastEvent.kind === 'half' ? 'Halvleg'
    : 'Slutfløjt';

  return (
    <section aria-label={`${f.home} mod ${f.away}`}>
      <div className="hero">
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>{f.league}</div>
        <div className="teams">
          <strong>{f.home}</strong>
          <div className="score num">{s.h}–{s.a}</div>
          <strong>{f.away}</strong>
        </div>
        <div className="meta">
          <span className="num">{minute === 0 ? 'Før kickoff' : `${minute}'`}</span>
          <span className="num">Skud {s.shotsH}–{s.shotsA}</span>
        </div>
        <div className="event-line" aria-live="polite">{eventText}</div>
      </div>

      <div className="section-title">Forløb</div>
      <div className="card">
        <ForecastCurve series={series} events={feed} homeLabel={f.home} minute={minute} />
      </div>

      <div className="section-title">Markeder</div>
      <div className="row-list">
        {markets.map((m) => (
          <button key={m.id} className="market-row" onClick={() => onOpen(m)}>
            <span>
              {m.title}
              <small>{m.selections.length} valg</small>
            </span>
            <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>›</span>
          </button>
        ))}
      </div>
    </section>
  );
}
