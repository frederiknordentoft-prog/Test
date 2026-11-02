import { useEffect, useState } from 'react';
import type { MatchStore, MatchView, Focus } from '../../state/match';
import { fmtKr, OUTCOME_ID } from '../../state/match';
import { Book, type ExitKind } from '../../engine/book/portfolio';

export type TrayTarget =
  | { kind: 'buy'; contracts: { id: string; label: string; side: string }[]; title: string; note?: string; stake?: number }
  | { kind: 'limit'; focus: Focus; level: number; stake?: number }
  | { kind: 'exit'; contract: string; stake?: number };

const CHIPS = [25, 50, 100, 250, 500];

/** Ordresedlen: the order tray. The real payout is always visible, the confirm button sits low. */
export function Tray({ store, view, target, onClose, lastStake, setLastStake }: { store: MatchStore; view: MatchView; target: TrayTarget; onClose: () => void; lastStake: number; setLastStake: (n: number) => void }) {
  const [stake, setStake] = useState(target.stake ?? lastStake);
  const [side, setSide] = useState(0);
  useEffect(() => {
    setSide(0);
    setStake(target.stake ?? lastStake);
  }, [target, lastStake]);

  const header = (
    <div className="tray-top num">
      <span>Portefølje: værdi {fmtKr(view.value)}</span>
      <span>saldo {fmtKr(view.available)}</span>
    </div>
  );

  if (target.kind === 'exit') return <ExitTray store={store} view={view} contract={target.contract} onClose={onClose} header={header} />;

  if (target.kind === 'limit') {
    const sp = store.spec(target.focus);
    const ask = sp.ask;
    const { shares } = Book.sharesFor(stake, target.level);
    return (
      <div className="tray" role="dialog" aria-label="Købsgrænse">
        {header}
        <h2 className="tray-title">Købsgrænse · {sp.short} ved kurs {target.level}</h2>
        <p className="tray-note">Fyldes automatisk, når kursen rammer {target.level} (nu {ask}). Under et handelsstop fyldes den til første pris efter stoppet.</p>
        <Chips stake={stake} setStake={setStake} lastStake={lastStake} />
        <div className="tray-pay"><span>Udbetaling ved sejr</span><b className="num">{fmtKr(shares)}</b></div>
        <div className="tray-actions">
          <button className="tray-cancel" onClick={onClose}>Annullér</button>
          <button
            className="tray-buy"
            onClick={() => {
              store.placeLimit(target.focus, target.level, stake);
              setLastStake(stake);
              onClose();
            }}
          >
            Sæt købsgrænse · {stake} kr
          </button>
        </div>
      </div>
    );
  }

  const c = target.contracts[Math.min(side, target.contracts.length - 1)];
  const q = store.quote(c.id);
  const open = store.isOpen(c.id);
  const ask = q?.ask ?? 0;
  const { shares, cost } = ask > 0 ? Book.sharesFor(stake, ask) : { shares: 0, cost: 0 };
  const pending = view.pending;
  return (
    <div className="tray" role="dialog" aria-label={target.title}>
      {header}
      <h2 className="tray-title">{target.title}</h2>
      {target.contracts.length > 1 && (
        <div className="seg" role="group" aria-label="Side">
          {target.contracts.map((x, i) => {
            const qq = store.quote(x.id);
            return (
              <button key={x.id} className={i === side ? 'on' : ''} aria-pressed={i === side} onClick={() => setSide(i)}>
                {x.side} <span className="num">{qq?.ask ?? '–'}</span>
              </button>
            );
          })}
        </div>
      )}
      {target.note && <p className="tray-note">{target.note}</p>}
      <p className="tray-price num">{c.label} · <b>kurs {ask}</b> · odds {ask ? (100 / ask).toFixed(2).replace('.', ',') : '–'}</p>
      <Chips stake={stake} setStake={setStake} lastStake={lastStake} />
      <div className="tray-pay"><span>Udbetaling ved sejr</span><b className="num">{fmtKr(shares)}</b><small className="num">{shares} andele for {fmtKr(cost)}</small></div>
      {pending && pending.contract === c.id ? (
        pending.state === 'lock' ? (
          <div className="lock" role="status"><span className="lock-ring" aria-hidden="true" /> Låser kurs {pending.lockedAsk} …</div>
        ) : (
          <div className="requote" role="alertdialog" aria-label="Kursen flyttede sig">
            <span>Kursen flyttede sig – acceptér {pending.newAsk}?</span>
            <button className="tray-cancel" onClick={() => store.cancelPending()}>Annullér</button>
            <button className="tray-buy" onClick={() => store.acceptRequote()}>Acceptér</button>
          </div>
        )
      ) : (
        <div className="tray-actions">
          <button className="tray-cancel" onClick={onClose}>Luk</button>
          <button
            className="tray-buy"
            disabled={!open || shares < 1}
            onClick={() => {
              store.requestBuy(c.id, stake);
              setLastStake(stake);
            }}
          >
            {open ? `Køb ${stake} kr` : (store.closedReason(c.id) ?? 'Handlen er stoppet')}
          </button>
        </div>
      )}
      {OUTCOME_ID.includes(c.id as (typeof OUTCOME_ID)[number]) && <p className="tray-foot">Hold på en resultatflise for at købe hurtigt.</p>}
    </div>
  );
}

/**
 * Sikring: stop-loss and take-profit on one position, in whole points, with the exact payout if it
 * fires, computed from the shares held now. A stop sells at the first price after it is hit.
 */
function ExitTray({ store, view, contract, onClose, header }: { store: MatchStore; view: MatchView; contract: string; onClose: () => void; header: React.ReactNode }) {
  const pos = view.positions.find((p) => p.id === contract && p.shares > 0 && !p.settled);
  const active = view.exits.filter((x) => x.contract === contract && x.status === 'aktiv');
  const cur = (k: ExitKind) => active.find((x) => x.kind === k);
  const sug = Book.exitSuggestion(pos?.avg ?? 50, pos?.bid ?? 50);
  const [stop, setStop] = useState(cur('stop')?.level ?? sug.stop);
  const [take, setTake] = useState(cur('take')?.level ?? sug.take);
  if (!pos) {
    return (
      <div className="tray" role="dialog" aria-label="Sikring">
        {header}
        <h2 className="tray-title">Sikring</h2>
        <p className="tray-note">Ingen åben position at sikre.</p>
        <div className="tray-actions"><button className="tray-cancel" onClick={onClose}>Luk</button></div>
      </div>
    );
  }
  const row = (kind: ExitKind, level: number, set: (n: number) => void) => {
    const on = cur(kind);
    const valid = kind === 'stop' ? level < pos.bid : level > pos.bid;
    const kr = (pos.shares * level) / 100;
    return (
      <div className={`ex-row ${kind}`}>
        <div className="ex-head">
          <b>{kind === 'stop' ? 'Stop-loss' : 'Sikr gevinst'}</b>
          {on && <span className="ex-on num">aktiv ved {on.level}</span>}
        </div>
        <div className="ex-ctl">
          <button aria-label={`${kind === 'stop' ? 'Stop-loss' : 'Sikr gevinst'} ét point ned`} onClick={() => set(Math.max(1, level - 1))}>−</button>
          <span className="ex-level num">kurs {level}</span>
          <button aria-label={`${kind === 'stop' ? 'Stop-loss' : 'Sikr gevinst'} ét point op`} onClick={() => set(Math.min(99, level + 1))}>+</button>
        </div>
        <p className="ex-pay num">
          {kind === 'stop'
            ? `Rammer kursen ${level}, sælges ${pos.shares} andele ≈ ${fmtKr(kr)}, til første kurs efter stoppet.`
            : `Når salgskursen når ${level}, sælges ${pos.shares} andele for mindst ${fmtKr(kr)}.`}
        </p>
        <div className="ex-actions">
          {on && <button className="tray-cancel" onClick={() => store.cancelExit(on.id)}>Fjern</button>}
          <button className="tray-buy" disabled={!valid || on?.level === level} onClick={() => store.placeExit(contract, kind, level)}>
            {!valid ? (kind === 'stop' ? `Skal under ${pos.bid}` : `Skal over ${pos.bid}`) : on?.level === level ? `Aktiv ved ${level}` : on ? `Flyt til ${level}` : `Sæt ${kind === 'stop' ? 'stop-loss' : 'Sikr gevinst'}`}
          </button>
        </div>
      </div>
    );
  };
  return (
    <div className="tray" role="dialog" aria-label="Sikring">
      {header}
      <h2 className="tray-title">Sikring · {pos.label}</h2>
      <p className="tray-note num">{pos.shares} andele @ kurs {Math.round(pos.avg)} · sælg nu til kurs {pos.bid}. Den ene annullerer den anden.</p>
      {row('stop', stop, setStop)}
      {row('take', take, setTake)}
      <div className="tray-actions"><button className="tray-cancel" onClick={onClose}>Færdig</button></div>
    </div>
  );
}

function Chips({ stake, setStake, lastStake }: { stake: number; setStake: (n: number) => void; lastStake: number }) {
  const chips = CHIPS.includes(lastStake) ? CHIPS : [...CHIPS, lastStake];
  return (
    <div className="chips" role="group" aria-label="Indsats">
      {chips.map((c) => (
        <button key={c} className={c === stake ? 'on' : ''} aria-pressed={c === stake} onClick={() => setStake(c)}>
          <span className="num">{c}</span> kr
        </button>
      ))}
    </div>
  );
}
