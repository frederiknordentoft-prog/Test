import { useEffect, useMemo, useState } from 'react';
import { allMarkets, FIXTURES, type Category, type Market, type Selection } from './data/catalog';
import { Board } from './screens/Board';
import { Match } from './screens/Match';
import { MarketDetail } from './screens/MarketDetail';
import { SlipSheet } from './components/SlipSheet';
import { type SlipSelection } from './state/betslip';
import { type OddsFormat } from './odds/format';
import { FULL_MINUTES } from './odds/model';

type Route =
  | { name: 'board' }
  | { name: 'match'; fixtureId: string }
  | { name: 'market'; marketId: string; back: Route };

/** Kick-off offsets on the shared demo clock, so the fixtures are at different minutes. */
const KICKOFF_CLOCK: Record<string, number> = { 'sl-1': 0, 'cl-1': 12, 'pl-1': 25 };
const PRICE_STEP = 10; // prices refresh at most every 10 demo-seconds

function minuteFor(fixtureId: string, clock: number): number {
  const start = KICKOFF_CLOCK[fixtureId] ?? 0;
  return Math.min(FULL_MINUTES, Math.max(0, clock - start));
}

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'board' });
  const [clock, setClock] = useState(0);
  const [live, setLive] = useState(false);
  const [category, setCategory] = useState<Category | 'alle'>('alle');
  const [legs, setLegs] = useState<SlipSelection[]>([]);
  const [stake, setStake] = useState(100);
  const [mode, setMode] = useState<'single' | 'combined'>('single');
  const [slipOpen, setSlipOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [format] = useState<OddsFormat>('decimal');

  // Demo clock: one mock minute per second, only while live is on.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setClock((c) => (c >= 130 ? c : c + 1)), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Prices only change on a 10-minute step, so odds do not roll on every tick.
  const priceMinuteFor = (id: string) => Math.floor(minuteFor(id, clock) / PRICE_STEP) * PRICE_STEP;
  const markets = useMemo(() => allMarkets(priceMinuteFor), [clock]);

  const picked = new Set(legs.map((l) => l.id));
  const toggle = (s: Selection, m: Market) => {
    setLegs((prev) => {
      if (prev.some((l) => l.id === s.id)) return prev.filter((l) => l.id !== s.id);
      const withoutMarket = prev.filter((l) => l.marketId !== m.id);
      return [...withoutMarket, { id: s.id, marketId: m.id, label: `${s.label} · ${m.title}`, odds: s.odds, prob: s.prob }];
    });
  };

  const open = (m: Market) => setRoute({ name: 'market', marketId: m.id, back: route });
  const currentMarket = route.name === 'market' ? markets.find((m) => m.id === route.marketId) : undefined;
  const fixtureForMatch = route.name === 'match' ? FIXTURES.find((f) => f.id === route.fixtureId) : undefined;

  const back = () => {
    if (route.name === 'market') setRoute(route.back);
    else setRoute({ name: 'board' });
  };

  return (
    <div className="phone">
      <header className="topbar">
        <div>
          <div className="brand">Sportsbook <span>X</span></div>
          <span className="demo-badge">Demo · ikke rigtige odds</span>
        </div>
        <label className="live-toggle">
          <span className={`live-dot${live ? '' : ' off'}`} aria-hidden="true" />
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Live
        </label>
      </header>

      {route.name !== 'board' && (
        <button className="back" onClick={back}>‹ Tilbage</button>
      )}

      {route.name === 'board' && (
        <>
          <Board markets={markets} category={category} onCategory={setCategory} onOpen={open} clock={clock} />
          <div className="section-title">Kampe</div>
          <div className="row-list">
            {FIXTURES.map((f) => (
              <button key={f.id} className="market-row" onClick={() => setRoute({ name: 'match', fixtureId: f.id })}>
                <span>
                  {f.home} – {f.away}
                  <small>{f.league} · {f.kickoff}</small>
                </span>
                <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {route.name === 'match' && fixtureForMatch && (
        <Match
          fixtureId={fixtureForMatch.id}
          minute={minuteFor(fixtureForMatch.id, clock)}
          markets={markets.filter((m) => m.fixtureId === fixtureForMatch.id)}
          onOpen={open}
        />
      )}

      {route.name === 'market' && currentMarket && (
        <MarketDetail
          market={currentMarket}
          pickedIds={picked}
          onPick={(s) => toggle(s, currentMarket)}
          format={format}
          priceMinute={currentMarket.fixtureId ? priceMinuteFor(currentMarket.fixtureId) : null}
        />
      )}

      {legs.length > 0 && !slipOpen && (
        <div className="dock" role="region" aria-label="Slip-oversigt">
          <div className="summary"><b className="num">{legs.length}</b> valg i slip</div>
          <button className="btn" onClick={() => setSlipOpen(true)}>Slip</button>
        </div>
      )}

      {slipOpen && (
        <SlipSheet
          legs={legs}
          stake={stake}
          mode={mode}
          format={format}
          onStake={setStake}
          onMode={setMode}
          onRemove={(id) => setLegs((prev) => prev.filter((l) => l.id !== id))}
          onPlace={() => setToast('Demo: ingen bet er placeret')}
          onClose={() => setSlipOpen(false)}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
