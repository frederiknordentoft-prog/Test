/**
 * The bands around the fan on the match screen. In F0 they are a static mock fed by the
 * look-dev frame, so the fan can be judged in context at real phone heights.
 */
import type { FanFrame } from '../../lookdev/model';
import { int, kr, odds } from '../../engine/lib/format';
import { go } from '../router';
import { useLongPress } from '../Hud';

export function Kampbaand({ frame, onLogoLong }: { frame: FanFrame; onLogoLong: () => void }) {
  const lp = useLongPress(onLogoLong);
  return (
    <header className="kb">
      <button className="back" aria-label="Tilbage til lobby" onClick={() => go('lobby')}>‹</button>
      <button className="kb-logo no-touch-ui" aria-label="Hold for debug-HUD" {...lp}>Ø</button>
      <div className="kb-score num" aria-label={`FCK ${frame.score.h}, Brøndby ${frame.score.a}`}>
        <span className="mono fck">FCK</span>
        <span className="sc">{frame.score.h}–{frame.score.a}</span>
        <span className="mono bif">BIF</span>
      </div>
      <span className="kb-min num"><i className="live" aria-hidden="true" />{Math.floor(frame.now)}′</span>
      <span className="pill">ÅBEN</span>
    </header>
  );
}

export function Instrumenthoved({ frame }: { frame: FanFrame }) {
  const ask = Math.round(frame.asks[0]);
  return (
    <section className="ih" aria-label="Pris">
      <div className="ih-left">
        <span className="ih-label">FCK vinder ▾</span>
        <span className="ih-price num">{ask}<small>øre</small></span>
      </div>
      <div className="ih-right">
        <span className="ih-futures"><b className="num">{frame.counts[0]}</b> af 100 fremtider</span>
        <span className="ih-sub">1 kr hvis FCK vinder · odds <span className="num">{odds(100 / ask)}</span></span>
      </div>
    </section>
  );
}

export function Andelsbar({ frame }: { frame: FanFrame }) {
  const segs = [
    { k: 'fck', label: 'FCK', v: Math.round(frame.asks[0]) },
    { k: 'x', label: 'X', v: Math.round(frame.asks[1]) },
    { k: 'bif', label: 'BIF', v: Math.round(frame.asks[2]) },
  ];
  return (
    <div className="ab" role="group" aria-label="Andelsbar: pris pr. udfald">
      {segs.map((s, i) => (
        <button key={s.k} className={`ab-seg ${s.k} ${i === 0 ? 'on' : ''}`} style={{ flexGrow: s.v }} aria-pressed={i === 0} aria-label={`${s.label} ${s.v} øre`}>
          <span className="ab-l">{s.label}</span>
          <span className="ab-v num">{s.v}</span>
        </button>
      ))}
    </div>
  );
}

export function Maalvejret({ frame }: { frame: FanFrame }) {
  const max = 0.2; // 5-minute windows rarely pass 20 %
  return (
    <section className="mv" aria-label="Målvejret">
      <p className="mv-h">{frame.headline}</p>
      <div className="mv-bars" role="list">
        {frame.windows.map((w) => {
          const h = Math.min(1, w.p / max);
          return (
            <button key={w.from} role="listitem" className="mv-bar" aria-label={`Mål ${Math.floor(w.from)}–${Math.min(90, w.to)}′: ${Math.round(w.p * 100)} procent`}>
              <span className="mv-col" style={{ height: `${h * 100}%` }}>
                <span className="mv-f" style={{ flexGrow: w.fckShare }} />
                <span className="mv-b" style={{ flexGrow: 1 - w.fckShare }} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mv-axis num" aria-hidden="true"><span>{Math.floor(frame.now)}′</span><span>90′</span></div>
    </section>
  );
}

export function PositionCard({ frame }: { frame: FanFrame }) {
  const shares = 510;
  const avg = 49;
  const stake = (shares * avg) / 100;
  const bid = Math.max(1, Math.round(frame.asks[0]) - 2);
  const value = (shares * bid) / 100;
  const pnl = value - stake;
  return (
    <section className="pc" aria-label="Din position">
      <div className="pc-top">
        <span className="pc-what">FCK vinder · <span className="num">{int(shares)}</span> andele @ <span className="num">{avg}</span></span>
        <span className="pc-win">Ved sejr <b className="num">{kr(shares)}</b></span>
      </div>
      <div className="pc-mid">
        <span className="pc-val">Værdi nu <b className="num">{kr(value)}</b></span>
        {Math.abs(pnl) < 0.5 ? <span className="pc-pnl num">± 0 kr</span> : <span className={`pc-pnl num ${pnl >= 0 ? 'up' : 'down'}`}>{pnl >= 0 ? '▲' : '▼'} {kr(Math.abs(pnl))}</span>}
        <span className="pc-bid">sælg til <span className="num">{bid}</span></span>
      </div>
      <div className="fader" role="slider" aria-label="Sælg andele" aria-valuemin={0} aria-valuemax={shares} aria-valuenow={shares} tabIndex={0}>
        <span className="fd-scale" aria-hidden="true"><i style={{ left: '0%' }}>Alt</i><i style={{ left: '50%' }}>½</i><i className="end" style={{ left: `${Math.min(100, (stake / value) * 100)}%` }}>Indsats hjem</i></span>
        <span className="fd-track" aria-hidden="true"><span className="fd-vu" style={{ width: `${Math.min(100, (value / shares) * 100)}%` }} /></span>
        <span className="fd-cap" aria-hidden="true" />
      </div>
    </section>
  );
}

export function Bundbjaelke({ pnl }: { pnl: number }) {
  return (
    <nav className="bb" aria-label="Hovednavigation">
      <button onClick={() => go('lobby')}>Lobby</button>
      <button>Byg</button>
      <button>Portefølje <span className={`num ${pnl >= 0 ? 'up' : 'down'}`}>{pnl >= 0 ? '+' : '−'}{int(Math.abs(pnl))} kr</span></button>
    </nav>
  );
}
