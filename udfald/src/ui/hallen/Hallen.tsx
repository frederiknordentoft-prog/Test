import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { HallenStore } from '../../state/hallen';
import { HB_LABELS } from '../../state/hallen';
import { go } from '../router';

const AAH = '#f4ede4';
const GOG = '#7fa0ff';
const TRIG = '#ff8fd6';

/**
 * Hallen: handball as a signal. The hero is an oscilloscope of the goal difference with phosphor
 * afterglow, gridded by the court's own lines (0, the 9 m line at ±5, the 6 m line at ±8).
 * Drag the trigger line to a level; it is priced as a first passage before the chosen deadline.
 */
export function HallenScreen({ store, demo }: { store: HallenStore; demo: boolean }) {
  const v = useSyncExternalStore(store.subscribe, store.getView);
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [stake, setStake] = useState(100);
  const dragging = useRef(false);

  useEffect(() => {
    const c = cv.current;
    const el = wrap.current;
    if (!c || !el) return;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const ro = new ResizeObserver((e) => {
      w = Math.round(e[0].contentRect.width);
      h = Math.round(e[0].contentRect.height);
      c.width = w * dpr;
      c.height = h * dpr;
      draw();
    });
    ro.observe(el);
    const Y = (d: number) => h / 2 - (Math.max(-10, Math.min(10, d)) / 10) * (h / 2 - 16);
    const draw = () => {
      const g = c.getContext('2d');
      if (!g || w < 2) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const s = store.sim;
      const k = s.k;
      const left = 34;
      const right = w - 12;
      const X = (kk: number) => left + (kk / 4800) * (right - left);
      // Court lines as the graticule.
      const lines: [number, string][] = [[0, 'midte'], [5, '9 m'], [-5, '9 m'], [8, '6 m'], [-8, '6 m']];
      g.font = '600 9.5px "UDF Tight", Arial';
      g.textAlign = 'right';
      for (const [d, label] of lines) {
        g.strokeStyle = d === 0 ? 'rgba(244,237,228,0.32)' : 'rgba(244,237,228,0.12)';
        g.setLineDash(d === 0 ? [] : [3, 5]);
        g.beginPath();
        g.moveTo(left, Y(d) + 0.5);
        g.lineTo(right, Y(d) + 0.5);
        g.stroke();
        g.fillStyle = 'rgba(244,237,228,0.45)';
        g.fillText(d === 0 ? '0' : `${d > 0 ? '+' : ''}${d}`, left - 6, Y(d) + 3);
        void label;
      }
      g.setLineDash([]);
      // Halftime marker.
      g.strokeStyle = 'rgba(244,237,228,0.12)';
      g.beginPath();
      g.moveTo(X(2400) + 0.5, 10);
      g.lineTo(X(2400) + 0.5, h - 10);
      g.stroke();
      // Power-play bands.
      const snap = s.snapshot();
      if (snap.powerplay) {
        g.fillStyle = snap.powerplay.team === 0 ? 'rgba(244,237,228,0.06)' : 'rgba(127,160,255,0.08)';
        g.fillRect(X(k), 10, Math.max(4, X(Math.round(snap.powerplay.untilT * 80)) - X(k)), h - 20);
      }
      // Trigger line and deadline.
      const tr = store.trigger;
      g.strokeStyle = TRIG;
      g.setLineDash([6, 4]);
      g.beginPath();
      g.moveTo(left, Y(tr.level) + 0.5);
      g.lineTo(X(Math.min(4800, tr.deadline * 80)), Y(tr.level) + 0.5);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = TRIG;
      g.beginPath();
      g.arc(X(Math.min(4800, tr.deadline * 80)), Y(tr.level), 4, 0, Math.PI * 2);
      g.fill();
      // The trace: phosphor with afterglow (older is dimmer), AaH above zero, GOG below.
      const hist = s.diffHistory();
      const step = Math.max(1, Math.floor(k / ((right - left) * 1.5)));
      for (let i = step; i <= k; i += step) {
        const d0 = hist[i - step];
        const d1 = hist[i];
        const age = (k - i) / Math.max(1, k);
        const a = 0.25 + 0.75 * Math.exp(-age * 4);
        g.strokeStyle = d1 >= 0 ? `rgba(244,237,228,${a})` : `rgba(127,160,255,${a})`;
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(X(i - step), Y(d0));
        g.lineTo(X(i - step) + (X(i) - X(i - step)) * 0.98, Y(d0));
        g.lineTo(X(i), Y(d1));
        g.stroke();
      }
      // Beam head with glow.
      const dNow = hist[k];
      g.fillStyle = 'rgba(244,237,228,0.25)';
      g.beginPath();
      g.arc(X(k), Y(dNow), 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = dNow >= 0 ? AAH : GOG;
      g.beginPath();
      g.arc(X(k), Y(dNow), 3.5, 0, Math.PI * 2);
      g.fill();
      // Freeze-flash when a trigger is hit.
      if (k - v.flashK < 2) {
        g.fillStyle = 'rgba(255,143,214,0.25)';
        g.fillRect(0, 0, w, h);
      }
    };
    const off = store.onFrame(draw);
    draw();
    // Drag the trigger level.
    const toLevel = (y: number) => {
      const r = el.getBoundingClientRect();
      const d = Math.round(((r.height / 2 - (y - r.top)) / (r.height / 2 - 16)) * 10);
      return Math.max(-9, Math.min(9, d === 0 ? (y - r.top < r.height / 2 ? 1 : -1) : d));
    };
    const down = (e: PointerEvent) => {
      dragging.current = true;
      el.setPointerCapture(e.pointerId);
      store.setTrigger({ level: toLevel(e.clientY) });
      draw();
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      store.setTrigger({ level: toLevel(e.clientY) });
      draw();
    };
    const up = () => {
      dragging.current = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      ro.disconnect();
      off();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [store, v.flashK]);

  const tr = v.trigger;
  const levelLabel = tr.level > 0 ? `Aalborg +${tr.level}` : `GOG +${-tr.level}`;
  const deadlines = [40, 45, 50, 60].filter((d) => d > v.t + 0.5);
  const pos = v.positions.filter((p) => p.shares > 0 || p.settled);
  return (
    <div className="screen hallen">
      <header className="kb">
        <button className="back" aria-label="Tilbage til lobby" onClick={() => go('lobby')}>‹</button>
        <div className="kb-score num" aria-label={`Aalborg ${v.h}, GOG ${v.a}`}>
          <span className="mono aah">AaH</span>
          <span className="sc">{v.h}–{v.a}</span>
          <span className="mono gog">GOG</span>
        </div>
        <span className="kb-min num">{!v.over && <i className="live-dot" aria-hidden="true" />}{v.minute}{demo ? ' ×2' : ''}</span>
        {v.powerplay ? <span className="pill">OVERTAL {v.powerplay.team === 0 ? 'AaH' : 'GOG'} {Math.floor(v.powerplay.leftS / 60)}:{String(v.powerplay.leftS % 60).padStart(2, '0')}</span> : <span className="pill">ÅBEN</span>}
      </header>
      <section className="atk" aria-label="Angrebet">
        <span>Angreb <b className={v.possession === 0 ? 'aah' : 'gog'}>{v.possession === 0 ? 'Aalborg' : 'GOG'}</b> · <span className="num">{v.attackS} s</span></span>
        {v.passive.active && <span className="pips" aria-label={`Passivt spil: ${v.passive.passesLeft} afleveringer tilbage`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < v.passive.passesLeft ? 'on' : ''} />)}</span>}
        <span className="num">Mål i angrebet {Math.round(v.nextGoal * 100)} %</span>
      </section>
      <div ref={wrap} className="scope no-touch-ui" role="img" aria-label={`Målforskel over tid. Aalborg fører med ${v.h - v.a}. Træk for at sætte triggerniveau.`}>
        <canvas ref={cv} />
      </div>
      <section className="trig" aria-label="Trigger">
        <div className="trig-row">
          <span className="trig-q"><b style={{ color: TRIG }}>{levelLabel}</b> før {tr.deadline >= 60 ? 'slut' : `${tr.deadline}′`}?</span>
          <span className="num trig-p">kurs <b>{v.triggerAsk || '–'}</b> · {Math.round(v.triggerP * 100)} % chance</span>
        </div>
        <div className="chips">
          {deadlines.map((d) => <button key={d} className={tr.deadline === d ? 'on' : ''} aria-pressed={tr.deadline === d} onClick={() => store.setTrigger({ deadline: d })}>før {d >= 60 ? 'slut' : `${d}′`}</button>)}
          {[50, 100, 250].map((k) => <button key={k} className={stake === k ? 'on' : ''} onClick={() => setStake(k)}><span className="num">{k}</span> kr</button>)}
        </div>
        <button className="tray-buy wide" disabled={v.over || !v.triggerAsk || v.triggerAsk >= 99} onClick={() => store.buy('trig', stake)}>Køb trigger {stake} kr · ved ramning {Math.floor((100 * stake) / Math.max(1, v.triggerAsk))} kr</button>
      </section>
      <div className="ab hb" role="group" aria-label="Pris pr. udfald">
        {(['A', 'X', 'G'] as const).map((k, i) => (
          <button key={k} className={`ab-seg h${i}`} style={{ flexGrow: v.asks[i] }} onClick={() => store.buy(k, stake)} aria-label={`${HB_LABELS[i]} kurs ${v.asks[i]}. Tryk for at købe for ${stake} kr`}>
            <span className="ab-l">{['AaH', 'X', 'GOG'][i]}</span>
            <span className="ab-v num">{v.asks[i]}</span>
          </button>
        ))}
      </div>
      <section className="hb-pos">
        {pos.length === 0 ? <p className="tray-note">Træk i skopet for at vælge niveau. Tryk på en flise for at købe udfaldet for {stake} kr.</p> : pos.slice(-3).map((p) => <p key={p.id} className="num">{p.label} · {p.shares} andele @ {Math.round(p.avg)}{p.settled ? ` · afregnet ${p.settled.value === 100 ? '1 kr' : '0'}` : ''}</p>)}
      </section>
      <div className="toasts" role="status" aria-live="polite">{v.toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}</div>
    </div>
  );
}
