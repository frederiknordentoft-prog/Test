import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { MatchStore } from '../../state/match';
import { fmtKr, OUTCOME_ID } from '../../state/match';
import { grade, type Grade } from '../../engine/book/portfolio';
import { goalsOf, minuteLabel } from '../../engine/football/display';
import { go } from '../router';

interface Graded { label: string; t: number; price: number; grade: Grade | '—'; clv: number | null }

/** The settlement: the whole match as a 1X2 river, your trades on it, the accounts and move grades. */
export function Afregning({ store }: { store: MatchStore }) {
  const v = useSyncExternalStore(store.subscribeView, store.getView);
  const cv = useRef<HTMLCanvasElement>(null);
  const sim = store.sim;
  const closed = v.phase === 'closed' || v.phase === 'FT';
  const log = store.book.log;

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const H = sim.hist;
    const end = Math.max(sim.end, 1);
    const X = (t: number) => 4 + (t / end) * (w - 8);
    const Y = (p: number) => 8 + (1 - p) * (h - 24);
    // Stacked bands: FCK at the top, then X, then BIF.
    const cols = ['rgba(92,225,255,0.55)', 'rgba(138,147,163,0.35)', 'rgba(255,210,0,0.55)'];
    for (let o = 0; o < 3; o++) {
      g.fillStyle = cols[o];
      g.beginPath();
      for (let i = 0; i < H.n; i++) {
        const below = o === 0 ? 0 : o === 1 ? H.mid[i * 3] : H.mid[i * 3] + H.mid[i * 3 + 1];
        const x = X(H.t[i]);
        if (i === 0) g.moveTo(x, Y(below));
        else g.lineTo(x, Y(below));
      }
      for (let i = H.n - 1; i >= 0; i--) {
        const above = o === 0 ? H.mid[i * 3] : o === 1 ? H.mid[i * 3] + H.mid[i * 3 + 1] : 1;
        g.lineTo(X(H.t[i]), Y(above));
      }
      g.closePath();
      g.fill();
    }
    for (const e of goalsOf(sim.events)) {
      g.strokeStyle = 'rgba(232,237,242,0.5)';
      g.beginPath();
      g.moveTo(X(e.t) + 0.5, 6);
      g.lineTo(X(e.t) + 0.5, h - 16);
      g.stroke();
      g.fillStyle = e.team === 0 ? '#5ce1ff' : '#ffd200';
      g.beginPath();
      g.arc(X(e.t), h - 10, 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // Your 1X2 trades as dots on the river.
    for (const e of log) {
      if (e.kind === 'settle') continue;
      const o = OUTCOME_ID.indexOf(e.contract as (typeof OUTCOME_ID)[number]);
      if (o < 0) continue;
      g.fillStyle = e.kind === 'sell' ? '#ff6b5e' : '#ffffff';
      g.strokeStyle = '#07090c';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(X(e.t), Y(o === 0 ? 1 - e.price / 200 : o === 1 ? 0.5 : e.price / 200), 4.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }, [v.k, sim, log]);

  const graded: Graded[] = [];
  for (const p of store.book.positions.values()) {
    const o = OUTCOME_ID.indexOf(p.id as (typeof OUTCOME_ID)[number]);
    for (const l of p.lots) {
      if (o < 0 || !l.baseline) {
        graded.push({ label: p.label, t: l.t, price: l.price, grade: '—', clv: null });
        continue;
      }
      // Closing reference: 10 game minutes later, or just before the next goal.
      const nextGoal = goalsOf(sim.events).find((g) => g.t > l.t);
      const tR = Math.min(l.t + 10, nextGoal ? nextGoal.t - 0.05 : Infinity, sim.t);
      const H = sim.hist;
      let i = 0;
      while (i < H.n - 1 && H.t[i + 1] <= tR) i++;
      const midR = H.mid[i * 3 + o];
      const frac = Math.min(1, Math.max(0, (tR - l.t) / 10));
      const baseR = l.baseline[0] + (l.baseline[1] - l.baseline[0]) * frac;
      const gr = grade(l.midAtEntry, midR, l.baseline[0], baseR);
      graded.push({ label: p.label, t: l.t, price: l.price, grade: gr.grade, clv: gr.clv });
    }
  }
  const tot = store.book.totals();
  const result = tot.paidOut - tot.staked + v.value;
  return (
    <div className="screen afregning">
      <div className="bar">
        <button className="back" aria-label="Tilbage" onClick={() => go('lobby')}>‹</button>
        <h1>Afregning</h1>
        <span className="num bar-meta">FCK {v.h}–{v.a} BIF</span>
      </div>
      <div className="scroll">
        <div className="af">
          {!closed && <p className="tray-note">Kampen er ikke slut endnu ({v.minute}). Afregningen opdateres live.</p>}
          <canvas ref={cv} className="river" role="img" aria-label="Kampens sandsynligheder som flod: FCK øverst, uafgjort i midten, Brøndby nederst. Prikkerne er dine handler." />
          <div className="river-legend"><span className="f0">FCK</span><span>Uafgjort</span><span className="f2">BIF</span></div>
          <div className="af-sum num">
            <div><span>Udbetalt</span><b>{fmtKr(tot.paidOut)}</b></div>
            <div><span>Indsat</span><b>{fmtKr(tot.staked)}</b></div>
            <div><span>Resultat</span><b className={result >= 0 ? 'up' : 'down'}>{result >= 0 ? '+' : '−'}{fmtKr(Math.abs(result))}</b></div>
          </div>
          <h2>Dine træk</h2>
          <p className="af-note">Karakteren måler købet, ikke udfaldet: hvor meget prisen flyttede sig i din retning de næste 10 kampminutter, fratrukket hvad tiden alene ville gøre. Karakterer gives for udfaldskøb; vinduer og byggede fremtider vises med —.</p>
          {graded.length === 0 && <p className="tray-note">Ingen køb i denne kamp.</p>}
          <ul className="af-list">
            {graded.map((gr, i) => (
              <li key={i}>
                <span className="af-what">{gr.label}<small className="num">{minuteLabel(gr.t)} · @ kurs {gr.price}</small></span>
                <span className={`af-grade g-${gr.grade.replace(/[^a-zA-ZæøåÆØÅ]/g, '')}`}>{gr.grade}</span>
              </li>
            ))}
          </ul>
          <ul className="af-list">
            {[...store.book.positions.values()].filter((p) => p.settled).map((p) => (
              <li key={p.id}><span className="af-what">{p.label}<small className="num">{p.lots.reduce((s, l) => s + l.shares, 0)} andele</small></span><span className={`num ${p.settled?.value === 100 ? 'up' : 'down'}`}>{p.settled?.value === 100 ? `+${fmtKr(p.settled.payout)}` : '0 kr'}</span></li>
            ))}
          </ul>
          <button className="act primary" onClick={() => go('lobby')}>Til lobbyen</button>
        </div>
      </div>
    </div>
  );
}
