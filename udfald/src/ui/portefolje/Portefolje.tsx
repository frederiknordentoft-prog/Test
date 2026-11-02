import { useSyncExternalStore } from 'react';
import type { MatchStore } from '../../state/match';
import { fmtKr } from '../../state/match';
import { go } from '../router';
import { minuteLabel } from '../../engine/football/display';
import { poolPnl } from '../kamp/Kampen';

export function Portefolje({ store }: { store: MatchStore }) {
  const v = useSyncExternalStore(store.subscribeView, store.getView);
  const open = v.positions.filter((p) => p.shares > 0 && !p.settled);
  const done = v.positions.filter((p) => p.settled || (p.shares === 0 && !p.settled));
  const limits = v.limits.filter((l) => l.status === 'aktiv');
  const exits = v.exits.filter((x) => x.status === 'aktiv');
  const pnl = v.positions.reduce((s, p) => s + p.pnl, 0) + poolPnl(v);
  const myPool = v.pool.user[0] + v.pool.user[1] + v.pool.user[2];
  return (
    <div className="screen">
      <div className="bar">
        <button className="back" aria-label="Tilbage" onClick={() => go(v.demo ? 'demo' : 'kamp')}>‹</button>
        <h1>Portefølje</h1>
        <span className="num bar-meta">{v.h}–{v.a} · {v.minute}</span>
      </div>
      <div className="scroll">
        <div className="pf">
          <div className="pf-sum">
            <div><span>Saldo</span><b className="num">{fmtKr(v.saldo)}</b></div>
            <div><span>Værdi af åbne</span><b className="num">{fmtKr(v.value)}</b></div>
            <div><span>Resultat</span><b className={`num ${pnl >= 0 ? 'up' : 'down'}`}>{pnl >= 0 ? '▲' : '▼'} {fmtKr(Math.abs(pnl))}</b></div>
          </div>
          <h2>Åbne positioner</h2>
          {open.length === 0 && <p className="tray-note">Ingen åbne positioner endnu.</p>}
          <ul className="pf-list">
            {open.map((p) => (
              <li key={p.id}>
                <div className="pf-row"><b>{p.label}</b><span className="num">{p.shares} andele @ kurs {Math.round(p.avg)}</span></div>
                <div className="pf-row sub num"><span>Værdi nu {fmtKr(p.value)}</span><span>Ved sejr {fmtKr(p.atWin)}</span><span className={p.pnl >= 0 ? 'up' : 'down'}>{p.pnl >= 0 ? '▲' : '▼'} {fmtKr(Math.abs(p.pnl))}</span></div>
                <div className="pf-row"><span className="tray-note">Sælg til kurs {p.bid}{exits.some((x) => x.contract === p.id) ? ` · ${exits.filter((x) => x.contract === p.id).map((x) => (x.kind === 'stop' ? `stop ${x.level}` : `sikr ${x.level}`)).join(' · ')}` : ''}</span><button className="act" disabled={!store.isOpen(p.id)} onClick={() => store.sell(p.id, p.shares)}>Sælg alt · {fmtKr((p.shares * p.bid) / 100)}</button></div>
              </li>
            ))}
          </ul>
          <h2>Købsgrænser</h2>
          {limits.length === 0 && <p className="tray-note">Hold fingeren i viften for at sætte en købsgrænse.</p>}
          <ul className="pf-list">
            {limits.map((l) => (
              <li key={l.id}><div className="pf-row"><b>{l.label} ved kurs {l.level}</b><span className="num">{l.kr} kr reserveret</span></div><div className="pf-row"><span /><button className="act" onClick={() => store.cancelLimit(l.id)}>Annullér</button></div></li>
            ))}
          </ul>
          <h2>Sikring</h2>
          {exits.length === 0 && <p className="tray-note">Tryk Sikring på en position i kampen for at sætte stop-loss eller sikre gevinsten.</p>}
          <ul className="pf-list">
            {exits.map((x) => (
              <li key={x.id}><div className="pf-row"><b>{x.kind === 'stop' ? 'Stop-loss' : 'Sikr gevinst'} · {x.label}</b><span className="num">ved kurs {x.level}</span></div><div className="pf-row"><span className="tray-note">{x.kind === 'stop' ? 'Sælger til første kurs efter stoppet' : 'Sælger, når salgskursen når niveauet'}</span><button className="act" onClick={() => store.cancelExit(x.id)}>Annullér</button></div></li>
            ))}
          </ul>
          <h2>Parken-puljen</h2>
          {myPool === 0 ? <p className="tray-note">Ingen indsatser i puljen. <button className="link" onClick={() => go('pulje')}>Se puljen</button></p> : (
            <ul className="pf-list">
              <li>
                <div className="pf-row"><b>Dine indsatser</b><span className="num">{[0, 1, 2].filter((i) => v.pool.user[i] > 0).map((i) => `${['FCK', 'X', 'BIF'][i]} ${fmtKr(v.pool.user[i])}`).join(' · ')}</span></div>
                <div className="pf-row sub num"><span>{v.pool.result ? (v.pool.result.payout > 0 ? `Udbetalt ${fmtKr(v.pool.result.payout)}` : 'Din side tabte') : v.pool.closed ? 'Lukket ved pausen · afgøres ved slutfløjt' : 'Åben til pausen'}</span><span className={poolPnl(v) >= 0 ? 'up' : 'down'}>{v.pool.result ? `${poolPnl(v) >= 0 ? '▲' : '▼'} ${fmtKr(Math.abs(poolPnl(v)))}` : ''}</span></div>
              </li>
            </ul>
          )}
          <h2>Afsluttet</h2>
          {done.length === 0 && <p className="tray-note">Intet afregnet endnu.</p>}
          <ul className="pf-list">
            {done.map((p) => (
              <li key={p.id}><div className="pf-row"><b>{p.label}</b><span className="num">{p.settled ? `afregnet ${p.settled.value === 100 ? '1 kr' : '0'} · ${minuteLabel(p.settled.t)}` : 'solgt'}</span></div><div className="pf-row sub num"><span>Resultat</span><span className={p.pnl >= 0 ? 'up' : 'down'}>{p.pnl >= 0 ? '▲' : '▼'} {fmtKr(Math.abs(p.pnl))}</span></div></li>
            ))}
          </ul>
          <button className="act primary" onClick={() => go('afregning')}>{v.phase === 'closed' ? 'Se afregningen' : 'Afregning (efter slutfløjt)'}</button>
        </div>
      </div>
    </div>
  );
}
