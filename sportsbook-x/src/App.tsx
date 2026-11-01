import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { allMarkets, FIXTURES, type Category, type Market, type Selection } from './data/catalog';
import { Board } from './screens/Board';
import { Match } from './screens/Match';
import { MarketDetail } from './screens/MarketDetail';
import { OpenBets } from './screens/OpenBets';
import { SlipSheet } from './components/SlipSheet';
import { type SlipSelection, combinedOdds, combinedProb } from './state/betslip';
import { emptyBook, quoteFor, reduceBook, stepOf, type DemoBet } from './state/demoBets';
import { type OddsFormat } from './odds/format';
import { FULL_MINUTES } from './odds/model';
import { MOCK_MINUTE_MS, PRICE_STEP_MIN } from './config';

type Route =
  | { name: 'board' }
  | { name: 'match'; fixtureId: string }
  | { name: 'market'; marketId: string; back: Route }
  | { name: 'bets' };

/** Kick-off offsets on the shared demo clock, so the fixtures are at different minutes. */
const KICKOFF_CLOCK: Record<string, number> = { 'sl-1': 0, 'cl-1': 12, 'pl-1': 25 };

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
  const [format, setFormat] = useState<OddsFormat>('decimal');
  const [book, dispatch] = useReducer(reduceBook, emptyBook);
  const slipButtonRef = useRef<HTMLButtonElement>(null);

  // Demo clock: one mock minute per MOCK_MINUTE_MS, only while Live is on.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setClock((c) => (c >= 130 ? c : c + 1)), MOCK_MINUTE_MS);
    return () => window.clearInterval(id);
  }, [live]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Prices only change on a price step, so odds do not roll on every tick.
  const priceMinuteFor = (id: string) => Math.floor(minuteFor(id, clock) / PRICE_STEP_MIN) * PRICE_STEP_MIN;
  const markets = useMemo(() => allMarkets(priceMinuteFor), [clock]);

  const probNowFor = (selectionId: string): number => {
    for (const m of markets) {
      const s = m.selections.find((x) => x.id === selectionId);
      if (s) return s.prob;
    }
    return 0;
  };
  const stepForMarket = (marketId: string): number => {
    const m = markets.find((x) => x.id === marketId);
    if (!m?.fixtureId) return 0;
    return stepOf(minuteFor(m.fixtureId, clock));
  };

  const picked = new Set(legs.map((l) => l.id));
  const toggle = (s: Selection, m: Market) => {
    setLegs((prev) => {
      if (prev.some((l) => l.id === s.id)) return prev.filter((l) => l.id !== s.id);
      const withoutMarket = prev.filter((l) => l.marketId !== m.id);
      return [...withoutMarket, { id: s.id, marketId: m.id, label: `${s.label} · ${m.title}`, odds: s.odds, prob: s.prob }];
    });
  };

  const placeBets = () => {
    if (legs.length === 0 || !(stake > 0)) return;
    if (mode === 'combined' && legs.length >= 2) {
      dispatch({
        type: 'place',
        kind: 'combined',
        label: `Kombineret (${legs.length} valg)`,
        selectionId: null,
        odds: combinedOdds(legs),
        prob: combinedProb(legs),
        stake,
        step: 0,
      });
    } else {
      for (const l of legs) {
        dispatch({
          type: 'place',
          kind: 'single',
          label: l.label,
          selectionId: l.id,
          odds: l.odds,
          prob: l.prob,
          stake,
          step: stepForMarket(l.marketId),
        });
      }
    }
    setLegs([]);
    setSlipOpen(false);
    setToast('Demo: bet gemt lokalt. Ingen penge.');
  };

  const open = (m: Market) => setRoute({ name: 'market', marketId: m.id, back: route });
  const currentMarket = route.name === 'market' ? markets.find((m) => m.id === route.marketId) : undefined;
  const fixtureForMatch = route.name === 'match' ? FIXTURES.find((f) => f.id === route.fixtureId) : undefined;

  const back = () => {
    if (route.name === 'market') setRoute(route.back);
    else setRoute({ name: 'board' });
  };

  const closeSlip = () => {
    setSlipOpen(false);
    slipButtonRef.current?.focus();
  };

  const marketOfBet = (bet: DemoBet): string =>
    markets.find((m) => m.selections.some((s) => s.id === bet.selectionId))?.id ?? '';

  const cashOut = (bet: DemoBet, quotedOffer: number, quotedStep: number) => {
    const currentStep = stepForMarket(marketOfBet(bet));
    dispatch({ type: 'cashOut', betId: bet.id, quotedOffer, quotedStep, currentStep });
    setToast(
      quotedStep === currentStep
        ? 'Demo: afregnet lokalt. Ingen penge.'
        : 'Prisen er ændret. Accepter igen for det nye tilbud.',
    );
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
          <input type="checkbox" role="switch" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Live
        </label>
      </header>

      {route.name !== 'board' && (
        <button className="back" onClick={back}>‹ Tilbage</button>
      )}

      {route.name === 'board' && (
        <>
          <Board markets={markets} category={category} onCategory={setCategory} onOpen={open} />
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
          onFormat={setFormat}
          priceMinute={currentMarket.fixtureId ? priceMinuteFor(currentMarket.fixtureId) : null}
        />
      )}

      {route.name === 'bets' && (
        <OpenBets
          bets={book.bets}
          format={format}
          quoteFor={(bet) => quoteFor(bet, probNowFor(bet.selectionId ?? ''))}
          stepFor={(bet) => stepForMarket(marketOfBet(bet))}
          onCashOut={cashOut}
        />
      )}

      <AnimatePresence>
        {legs.length > 0 && !slipOpen && (
          <motion.div
            key="slip-dock"
            className="dock"
            role="region"
            aria-label="Slip-oversigt"
            initial={{ opacity: 0, y: 16, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 16, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="summary"><b className="num">{legs.length}</b> valg i slip</div>
            <button ref={slipButtonRef} className="btn" onClick={() => setSlipOpen(true)}>Slip</button>
          </motion.div>
        )}

        {legs.length === 0 && book.bets.length > 0 && route.name !== 'bets' && !slipOpen && (
          <motion.div
            key="bets-dock"
            className="dock"
            role="region"
            aria-label="Mine bets"
            initial={{ opacity: 0, y: 16, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 16, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="summary">Demo-bets gemt lokalt</div>
            <button className="btn ghost" onClick={() => setRoute({ name: 'bets' })}>Mine bets</button>
          </motion.div>
        )}

        {slipOpen && (
          <SlipSheet
            key="slip"
            legs={legs}
            stake={stake}
            mode={mode}
            format={format}
            onStake={setStake}
            onMode={setMode}
            onRemove={(id) => setLegs((prev) => prev.filter((l) => l.id !== id))}
            onPlace={placeBets}
            onClose={closeSlip}
          />
        )}

        {toast && (
          <motion.div
            key={toast}
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 8, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, x: '-50%' }}
            transition={{ duration: 0.2 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
