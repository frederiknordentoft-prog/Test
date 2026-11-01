import { useEffect, useState } from 'react';
import type { MatchStore, MatchView, Focus } from '../../state/match';
import { fmtKr, OUTCOME_ID, OUTCOME_SHORT } from '../../state/match';
import { Book } from '../../engine/book/portfolio';

export type TrayTarget =
  | { kind: 'buy'; contracts: { id: string; label: string; side: string }[]; title: string; note?: string; stake?: number }
  | { kind: 'limit'; focus: Focus; level: number; stake?: number };

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

  if (target.kind === 'limit') {
    const ask = view.d.outcomes[target.focus].ask;
    const { shares } = Book.sharesFor(stake, target.level);
    return (
      <div className="tray" role="dialog" aria-label="Købsgrænse">
        {header}
        <h2 className="tray-title">Købsgrænse · {OUTCOME_SHORT[target.focus]} ved {target.level} øre</h2>
        <p className="tray-note">Fyldes automatisk, når prisen rammer {target.level} øre (nu {ask}). Under et handelsstop fyldes den til første pris efter stoppet.</p>
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
      <p className="tray-price num">{c.label} · <b>{ask} øre</b> · odds {ask ? (100 / ask).toFixed(2).replace('.', ',') : '–'}</p>
      <Chips stake={stake} setStake={setStake} lastStake={lastStake} />
      <div className="tray-pay"><span>Udbetaling ved sejr</span><b className="num">{fmtKr(shares)}</b><small className="num">{shares} andele for {fmtKr(cost)}</small></div>
      {pending && pending.contract === c.id ? (
        pending.state === 'lock' ? (
          <div className="lock" role="status"><span className="lock-ring" aria-hidden="true" /> Låser prisen {pending.lockedAsk} øre …</div>
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
            {open ? `Køb ${stake} kr` : view.haltKind === 'var' ? 'Kun VAR-markedet er åbent' : 'Handlen er stoppet'}
          </button>
        </div>
      )}
      {OUTCOME_ID.includes(c.id as (typeof OUTCOME_ID)[number]) && <p className="tray-foot">Hold på en udfaldsflise for at købe hurtigt.</p>}
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
