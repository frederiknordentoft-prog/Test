import { useState, useSyncExternalStore } from 'react';
import type { MatchStore, Outcome } from '../../state/match';
import { fmtKr, OUTCOME_LABEL, OUTCOME_SHORT } from '../../state/match';
import { go } from '../router';

const CLS = ['fck', 'x', 'bif'];
// Pool sums change every tick: plain tabular numbers (an odometer mid-roll on six digits is unreadable).
const kr = (v: number) => `${Math.round(v).toLocaleString('da-DK')} kr`;

/**
 * Parken-puljen: a pari-mutuel pool on 1X2 against a simulated crowd. It closes at halftime; the
 * winning side splits the pool after the house's 10 %. Odds move until the close, so every number
 * here is an estimate until then, and labelled so.
 */
export function Pulje({ store }: { store: MatchStore }) {
  const v = useSyncExternalStore(store.subscribeView, store.getView);
  const p = v.pool;
  const [side, setSide] = useState<Outcome>(0);
  const [stake, setStake] = useState(100);
  const max = Math.max(...p.sides, 1);
  const myTotal = p.user[0] + p.user[1] + p.user[2];
  // Your payout if `side` wins, with this stake added on top of what you already have there.
  const est = ((p.total + stake) * (1 - p.take) * (p.user[side] + stake)) / (p.sides[side] + stake);
  const minsLeft = Math.max(0, Math.ceil(45 - v.t));
  const status = p.closed ? 'Lukket ved pausen · odds låst' : p.open ? `Åben · lukker ved pausen om ${minsLeft} min` : v.phase === 'pre' || v.phase === '1H' ? 'Stoppet under handelsstoppet' : 'Lukket';
  return (
    <div className="screen pulje">
      <div className="bar">
        <button className="back" aria-label="Tilbage til kampen" onClick={() => go(v.demo ? 'demo' : 'kamp')}>‹</button>
        <h1>Parken-puljen</h1>
        <span className="num bar-meta">{v.h}–{v.a} · {v.minute}</span>
      </div>
      <div className="scroll">
        <div className="pulje-body">
          <p className="lead">Alle indsatser på kampens resultat i én pulje. Vinderne deler puljen efter husets {Math.round(p.take * 100)} %. Jo færre der står på din side, jo mere får du.</p>
          <div className="pj-head">
            <div><span>Puljen</span><b className="num">{kr(p.total)}</b></div>
            <div><span>Publikum (simuleret)</span><b className="num">{p.n.toLocaleString('da-DK')} indsatser</b></div>
          </div>
          <p className={`pj-status ${p.open ? 'open' : ''}`} role="status">{status}</p>
          <div className="pj-bars" role="group" aria-label="Pengene pr. udfald">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                className={`pj-bar ${CLS[i]} ${side === i ? 'on' : ''} ${p.winner === i ? 'won' : ''}`}
                aria-pressed={side === i}
                aria-label={`${OUTCOME_LABEL[i]}: ${Math.round(p.sides[i]).toLocaleString('da-DK')} kroner i puljen, odds ${p.odds[i].toFixed(2).replace('.', ',')}`}
                onClick={() => setSide(i as Outcome)}
              >
                <span className="pj-l">{OUTCOME_SHORT[i]}</span>
                <span className="pj-track" aria-hidden="true"><span className="pj-fill" style={{ width: `${(100 * p.sides[i]) / max}%` }} /></span>
                <span className="pj-kr num">{kr(p.sides[i])}</span>
                <span className="pj-odds num">odds ≈ {p.odds[i].toFixed(2).replace('.', ',')}</span>
                {p.user[i] > 0 && <span className="pj-mine num">dig {fmtKr(p.user[i])}</span>}
              </button>
            ))}
          </div>
          {!p.closed && <p className="tray-note">Oddsene er skøn: de låses ved pausen, når puljen lukker.</p>}

          {p.result ? (
            <div className={`pj-result ${p.result.payout > 0 ? 'up' : 'down'}`} role="status">
              {p.result.refund ? `Puljen refunderet: ${fmtKr(p.result.payout)}` : p.result.payout > 0 ? `Puljen udbetalt: +${fmtKr(p.result.payout)}` : `${OUTCOME_LABEL[p.result.winner]} · din side tabte (${fmtKr(myTotal)})`}
            </div>
          ) : p.closed ? (
            <p className="pj-locked num">{myTotal ? `Du har ${fmtKr(myTotal)} i puljen. Afgøres ved slutfløjt.` : 'Puljen lukkede ved pausen. Næste kamp har en ny pulje.'}</p>
          ) : (
            <div className="pj-stake">
              <p className="byg-ticker num"><b>{OUTCOME_LABEL[side]}</b> · odds ≈ {p.odds[side].toFixed(2).replace('.', ',')} <small>(låses ved pausen)</small></p>
              <div className="chips" role="group" aria-label="Indsats">
                {[50, 100, 250, 500].map((c) => <button key={c} className={c === stake ? 'on' : ''} aria-pressed={c === stake} onClick={() => setStake(c)}><span className="num">{c}</span> kr</button>)}
              </div>
              <div className="tray-pay"><span>Din udbetaling, hvis {OUTCOME_SHORT[side] === 'X' ? 'uafgjort' : `${OUTCOME_SHORT[side]} vinder`} (skøn)</span><b className="num">{fmtKr(Math.round(est))}</b>{p.user[side] > 0 && <small className="num">i alt {fmtKr(p.user[side] + stake)} på {OUTCOME_SHORT[side]} med denne indsats</small>}</div>
              <button className="tray-buy wide" disabled={!p.open || stake > v.available} onClick={() => store.stakePool(side, stake)}>
                {p.open ? `Sæt ${stake} kr på ${OUTCOME_SHORT[side]}` : 'Puljen er stoppet'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
