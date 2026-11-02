import { useSyncExternalStore } from 'react';
import type { MatchStore } from '../../state/match';
import { fmtKr } from '../../state/match';
import { go } from '../router';
import { minuteLabel } from '../../engine/football/display';

export function Portefolje({ store }: { store: MatchStore }) {
  const v = useSyncExternalStore(store.subscribeView, store.getView);
  const open = v.positions.filter((p) => p.shares > 0 && !p.settled);
  const done = v.positions.filter((p) => p.settled || (p.shares === 0 && !p.settled));
  const limits = v.limits.filter((l) => l.status === 'aktiv');
  const pnl = v.positions.reduce((s, p) => s + p.pnl, 0);
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
                <div className="pf-row"><span className="tray-note">Sælg til kurs {p.bid}</span><button className="act" disabled={!store.isOpen(p.id)} onClick={() => store.sell(p.id, p.shares)}>Sælg alt · {fmtKr((p.shares * p.bid) / 100)}</button></div>
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
