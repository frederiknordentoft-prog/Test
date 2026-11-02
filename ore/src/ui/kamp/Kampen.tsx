import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MatchStore, MatchView, Focus } from '../../state/match';
import { fmtKr, OUTCOME_ID, OUTCOME_LABEL, OUTCOME_SHORT } from '../../state/match';
import { Fan } from './Fan';
import { Tray, type TrayTarget } from './Tray';
import { HoldOverlay, STEPS, type HoldState } from './HoldToStake';
import { Roller } from '../Roller';
import { go } from '../router';
import { useLongPress } from '../Hud';
import { isMuted, setMuted } from '../../diag/audio';
import { Director } from './Director';
import { minuteLabel } from '../../engine/football/display';

export function useView(store: MatchStore): MatchView {
  return useSyncExternalStore(store.subscribeView, store.getView);
}

export function Kampen({ store, onLogoLong }: { store: MatchStore; onLogoLong: () => void }) {
  const v = useView(store);
  const [tray, setTray] = useState<TrayTarget | null>(null);
  const [lastStake, setLastStake] = useState(100);
  const [hold, setHold] = useState<HoldState | null>(null);
  const [director, setDirector] = useState(false);
  const [muted, setMutedS] = useState(isMuted());

  // Close the tray once a buy has gone through.
  const lastLog = useRef(store.book.log.length);
  useEffect(() => {
    if (store.book.log.length !== lastLog.current) {
      lastLog.current = store.book.log.length;
      if (!v.pending) setTray(null);
    }
  }, [v, store]);

  const openOutcome = (f: Focus) => {
    store.setFocus(f);
    store.holdSpeed(8000);
    setTray({ kind: 'buy', contracts: [{ id: OUTCOME_ID[f], label: OUTCOME_LABEL[f], side: OUTCOME_SHORT[f] }], title: `${OUTCOME_LABEL[f]}` });
  };

  return (
    <div className={`screen kamp ${v.halted ? 'halted' : ''}`} data-phase={v.phase}>
      <Kampbaand v={v} onLogoLong={() => setDirector(true)} muted={muted} toggleMute={() => {
        setMuted(!muted);
        setMutedS(!muted);
      }} />
      <Instrumenthoved v={v} store={store} />
      <div className="fan-slot">
        <Fan
          store={store}
          onLimitDraft={(focus, level) => {
            store.holdSpeed(8000);
            setTray({ kind: 'limit', focus, level });
          }}
          onBranchTap={(idx) => {
            const ng = v.d.next;
            store.holdSpeed(8000);
            setTray({
              kind: 'buy',
              title: 'Næste mål',
              note: `${v.d.branches[idx]?.label ?? ''}: sker det, går ${OUTCOME_LABEL[v.focus]} til ≈ kurs ${Math.round(v.d.branches[idx]?.price ?? 0)}.`,
              contracts: [
                { id: ng[0].id, label: 'Næste mål FCK', side: 'FCK' },
                { id: ng[1].id, label: 'Ingen flere mål', side: 'Ingen' },
                { id: ng[2].id, label: 'Næste mål BIF', side: 'BIF' },
              ].sort((a) => (idx === 0 ? (a.side === 'FCK' ? -1 : 0) : idx === 2 ? (a.side === 'BIF' ? -1 : 0) : a.side === 'Ingen' ? -1 : 0)),
            });
          }}
        />
      </div>
      <Andelsbar v={v} store={store} onTap={openOutcome} onDouble={(id, label) => {
        store.holdSpeed(8000);
        setTray({ kind: 'buy', title: label, contracts: [{ id, label, side: label }] });
      }} setHold={setHold} />
      {v.d.varQuote ? <VarStrip v={v} onPick={(i) => {
        const q = v.d.varQuote!;
        setTray({ kind: 'buy', title: 'Målet står?', contracts: [{ id: q.ja.id, label: 'Målet står', side: 'Ja' }, { id: q.nej.id, label: 'Målet annulleres', side: 'Nej' }].slice(i).concat([]) });
      }} /> : <Maalvejret v={v} store={store} onWindow={(a, b) => {
        store.holdSpeed(8000);
        const id = `w:${a}-${Math.round(b)}`;
        const label = `Mål ${a}–${b >= 90 ? '90+' : b}′`;
        setTray({ kind: 'buy', title: label, contracts: [{ id: `${id}:J`, label, side: 'Ja · mål' }, { id: `${id}:N`, label: `Tørvejr ${a}–${b >= 90 ? '90+' : b}′`, side: 'Tørvejr' }] });
      }} onAfterGoal={() => {
        const ag = v.d.afterGoal;
        if (!ag) return;
        setTray({ kind: 'buy', title: ag.ja.label, contracts: [{ id: ag.ja.id, label: ag.ja.label, side: 'Ja' }, { id: ag.nej.id, label: 'Efter målet: intet nyt mål', side: 'Nej' }] });
      }} />}
      <PositionCard v={v} store={store} />
      <nav className="bb" aria-label="Hovednavigation">
        <button onClick={() => go('lobby')}>Lobby</button>
        <button onClick={() => go('byg')}>Byg</button>
        <button onClick={() => go('portefolje')}>Portefølje <span className={`num ${pnlOf(v) >= 0 ? 'up' : 'down'}`}>{pnlOf(v) >= 0 ? '+' : '−'}{fmtKr(Math.abs(pnlOf(v)))}</span></button>
      </nav>
      {tray && <div className="scrim" onClick={() => setTray(null)} aria-hidden="true" />}
      {tray && <Tray store={store} view={v} target={tray} onClose={() => setTray(null)} lastStake={lastStake} setLastStake={setLastStake} />}
      {hold && <HoldOverlay h={hold} />}
      <Toasts v={v} />
      {director && <Director store={store} onClose={() => setDirector(false)} onLogoLong={onLogoLong} />}
    </div>
  );
}

export function pnlOf(v: MatchView): number {
  return v.positions.reduce((s, p) => s + p.pnl, 0);
}

function Kampbaand({ v, onLogoLong, muted, toggleMute }: { v: MatchView; onLogoLong: () => void; muted: boolean; toggleMute: () => void }) {
  const lp = useLongPress(onLogoLong);
  const status = v.phase === 'pre' ? 'AUKTION' : v.phase === 'HT' ? 'PAUSE' : v.phase === 'FT' || v.phase === 'closed' ? 'LUKKET' : v.haltKind === 'var' ? 'VAR' : v.halted ? 'STOPPET' : 'ÅBEN';
  return (
    <header className="kb">
      <button className="back" aria-label="Tilbage til lobby" onClick={() => go('lobby')}>‹</button>
      <button className="kb-logo no-touch-ui" aria-label="ØRE. Hold for instruktørpanel" {...lp}>Ø</button>
      <div className="kb-score num" aria-label={`FCK ${v.h}, Brøndby ${v.a}`}>
        <span className="mono fck">FCK</span>
        <span className="sc"><Roller value={v.h} />–<Roller value={v.a} /></span>
        <span className="mono bif">BIF</span>
      </div>
      <span className="kb-min num">{v.phase !== 'closed' && v.phase !== 'FT' && <i className="live-dot" aria-hidden="true" />}{v.minute}{v.speed > 1 ? ` ×${v.speed}` : ''}</span>
      <span className={`pill st-${status}`}>{status}</span>
      <button className="pill sound" onClick={toggleMute} aria-pressed={!muted} aria-label={muted ? 'Slå lyd til' : 'Slå lyd fra'}>{muted ? 'Lyd fra' : 'Lyd'}</button>
    </header>
  );
}

function Instrumenthoved({ v, store }: { v: MatchView; store: MatchStore }) {
  const f = v.focus;
  const q = v.d.outcomes[f];
  const counts = v.counts;
  const early = v.t < 8 && v.phase !== 'FT' && v.phase !== 'closed';
  return (
    <section className="ih" aria-label="Pris">
      <div className="ih-left">
        <button className="ih-label" onClick={() => store.setFocus(((f + 1) % 3) as Focus)} aria-label={`${OUTCOME_LABEL[f]}. Tryk for næste udfald`}>{OUTCOME_LABEL[f]} ▾</button>
        <span className={`ih-price num f${f}`}><small className="ih-unit">kurs</small><Roller value={q.ask} /></span>
      </div>
      <div className="ih-right">
        <span className="ih-futures"><b className={`num f${f}`}>{counts ? counts[f] : Math.round(q.p * 100)} %</b> chance</span>
        <span className="ih-sub">{early ? `udbetaler 100 hvis ${OUTCOME_SHORT[f] === 'X' ? 'uafgjort' : `${OUTCOME_SHORT[f]} vinder`}` : `odds ${(100 / q.ask).toFixed(2).replace('.', ',')} · sælg kurs ${q.bid}`}</span>
        {v.ghostStatus && <span className="ih-ghost">{v.ghostStatus}</span>}
      </div>
    </section>
  );
}

function Andelsbar({ v, store, onTap, onDouble, setHold }: { v: MatchView; store: MatchStore; onTap: (f: Focus) => void; onDouble: (id: string, label: string) => void; setHold: (h: HoldState | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const g = useRef<{ f: Focus; x: number; y: number; t: number; timer: number; step: number; holding: boolean; dx: number; dy: number; over: Focus } | null>(null);
  const segAt = (x: number): Focus => {
    const el = ref.current;
    if (!el) return 0;
    const kids = Array.from(el.querySelectorAll<HTMLElement>('.ab-seg'));
    const i = kids.findIndex((k) => {
      const r = k.getBoundingClientRect();
      return x >= r.left && x <= r.right;
    });
    return (i < 0 ? 0 : i) as Focus;
  };
  const down = (e: React.PointerEvent, f: Focus) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    store.holdSpeed(6000);
    const st = { f, x: e.clientX, y: e.clientY, t: performance.now(), timer: 0, step: -1, holding: false, dx: 0, dy: 0, over: f };
    g.current = st;
    // Hold to stake starts after 250 ms without a drag.
    st.timer = window.setTimeout(function tick() {
      const s = g.current;
      if (!s || s.over !== s.f) return;
      s.holding = true;
      s.step = Math.min(STEPS.length - 1, s.step + 1);
      setHold({ x: s.x, y: s.y, step: s.step, dx: s.dx, dy: s.dy, label: OUTCOME_SHORT[s.f], ask: v.d.outcomes[s.f].ask });
      s.timer = window.setTimeout(tick, 280);
    }, 250);
  };
  const move = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s) return;
    s.dx = e.clientX - s.x;
    s.dy = e.clientY - s.y;
    if (!s.holding && Math.abs(s.dx) > 10 && performance.now() - s.t < 250) {
      window.clearTimeout(s.timer);
      s.over = segAt(e.clientX);
    } else if (!s.holding) s.over = segAt(e.clientX);
    if (s.holding) setHold({ x: s.x, y: s.y, step: s.step, dx: s.dx, dy: s.dy, label: OUTCOME_SHORT[s.f], ask: v.d.outcomes[s.f].ask });
  };
  const up = () => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    window.clearTimeout(s.timer);
    setHold(null);
    if (s.holding) {
      const kr = STEPS[Math.max(0, s.step)];
      if (s.dx < -40) return;
      store.setFocus(s.f);
      if (s.dy < -40) store.requestBuy(OUTCOME_ID[s.f], kr);
      else onTap(s.f);
      return;
    }
    if (s.over !== s.f) {
      const pair = [s.f, s.over].sort();
      const dc = pair[0] === 0 && pair[1] === 1 ? v.d.dc[0] : pair[0] === 1 && pair[1] === 2 ? v.d.dc[1] : null;
      if (dc) onDouble(dc.id, dc.label);
      return;
    }
    onTap(s.f);
  };
  return (
    <div ref={ref} className="ab no-touch-ui" role="group" aria-label="Andelsbar: pris pr. udfald">
      {v.d.outcomes.map((q, i) => (
        <button
          key={q.id}
          className={`ab-seg s${i} ${v.focus === i ? 'on' : ''}`}
          style={{ flexGrow: q.ask }}
          aria-label={`${OUTCOME_LABEL[i]} kurs ${q.ask}. Tryk for at købe, hold for hurtigkøb`}
          onPointerDown={(e) => down(e, i as Focus)}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            const s = g.current;
            if (s) window.clearTimeout(s.timer);
            g.current = null;
            setHold(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onTap(i as Focus);
          }}
        >
          <span className="ab-l">{OUTCOME_SHORT[i]}</span>
          <span className="ab-v num"><Roller value={q.ask} /></span>
        </button>
      ))}
    </div>
  );
}

function Maalvejret({ v, store, onWindow, onAfterGoal }: { v: MatchView; store: MatchStore; onWindow: (a: number, b: number) => void; onAfterGoal: () => void }) {
  const rows = v.d.windows;
  const drag = useRef<{ a: number; b: number } | null>(null);
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null);
  const max = 0.2;
  const ag = v.d.afterGoal;
  return (
    <section className="mv" aria-label="Målvejret">
      <div className="mv-head">
        <p className="mv-h" aria-live="polite">{v.d.headline}</p>
        {ag && ag.open && <button className="mv-ag num" onClick={onAfterGoal}>Efter målet {ag.ja.ask}</button>}
      </div>
      <div
        className="mv-bars no-touch-ui"
        role="list"
        onPointerUp={() => {
          const s = drag.current;
          drag.current = null;
          setSel(null);
          if (s) onWindow(Math.min(s.a, s.b), Math.max(s.a, s.b) + 5 >= 90 ? store.sim.end : Math.max(s.a, s.b) + 5);
        }}
        onPointerLeave={() => {
          drag.current = null;
          setSel(null);
        }}
      >
        {rows.map((w) => {
          const h = w.settled === 'ja' ? 1 : Math.min(1, w.p / max);
          const inSel = sel && w.a >= Math.min(sel.a, sel.b) && w.a <= Math.max(sel.a, sel.b);
          return (
            <button
              key={w.a}
              role="listitem"
              className={`mv-bar ${w.running ? 'run' : ''} ${w.settled ? `st-${w.settled}` : ''} ${inSel ? 'sel' : ''}`}
              disabled={!w.open}
              aria-label={`Mål ${w.a}–${w.b >= 90 ? '90+' : w.b} minutter: ${Math.round(w.p * 100)} procent. Ja kurs ${w.ja.ask}, tørvejr kurs ${w.nej.ask}`}
              onPointerDown={(e) => {
                if (!w.open) return;
                (e.currentTarget.parentElement as HTMLElement).setPointerCapture?.(e.pointerId);
                drag.current = { a: w.a, b: w.a };
                setSel({ a: w.a, b: w.a });
                store.holdSpeed(6000);
              }}
              onPointerEnter={() => {
                if (drag.current && w.open) {
                  drag.current = { ...drag.current, b: w.a };
                  setSel({ ...drag.current });
                }
              }}
            >
              <span className="mv-col" style={{ height: `${Math.max(4, h * 100)}%` }}>
                {w.settled === 'ja' ? <span className="mv-check">✓</span> : <><span className="mv-f" style={{ flexGrow: w.share }} /><span className="mv-b" style={{ flexGrow: 1 - w.share }} /></>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mv-axis num" aria-hidden="true"><span>{rows[0] ? `${rows[0].a}′` : ''}</span>{rows.some((w) => w.a === 45) && v.t < 45 && <span>pause</span>}<span>90+</span></div>
    </section>
  );
}

function VarStrip({ v, onPick }: { v: MatchView; onPick: (i: number) => void }) {
  const q = v.d.varQuote!;
  return (
    <section className="mv var" aria-label="VAR-tjek">
      <p className="mv-h">VAR-tjek · Målet står? <b className="num">{Math.round(q.ja.p * 100)} %</b></p>
      <div className="var-row">
        <button onClick={() => onPick(0)} className="num">Ja · {q.ja.ask}</button>
        <button onClick={() => onPick(1)} className="num">Nej · {q.nej.ask}</button>
      </div>
    </section>
  );
}

function PositionCard({ v, store }: { v: MatchView; store: MatchStore }) {
  const pos = v.positions.find((p) => p.id === OUTCOME_ID[v.focus] && p.shares > 0 && !p.settled);
  const any = v.positions.filter((p) => p.shares > 0 && !p.settled);
  if (!pos) {
    return (
      <section className="pc empty" aria-label="Din position">
        {any.length ? (
          <p>{any.length} åben{any.length === 1 ? '' : 'e'} position{any.length === 1 ? '' : 'er'} · værdi {fmtKr(v.value)}. <button className="link" onClick={() => go('portefolje')}>Se porteføljen</button></p>
        ) : (
          <p><b>Hold på et udfald</b> i baren ovenfor for at købe, eller tryk for at vælge indsats. Langt tryk i viften sætter en købsgrænse.</p>
        )}
      </section>
    );
  }
  return (
    <section className="pc" aria-label="Din position">
      <div className="pc-top">
        <span className="pc-what">{pos.label} · <span className="num">{pos.shares}</span> andele @ kurs <span className="num">{Math.round(pos.avg)}</span></span>
        <span className="pc-win">Ved sejr <b className="num">{fmtKr(pos.atWin)}</b></span>
      </div>
      <div className="pc-mid">
        <span className="pc-val">Værdi nu <b className="num">{fmtKr(pos.value)}</b></span>
        {Math.abs(pos.pnl) < 0.5 ? <span className="pc-pnl num">± 0 kr</span> : <span className={`pc-pnl num ${pos.pnl >= 0 ? 'up' : 'down'}`}>{pos.pnl >= 0 ? '▲' : '▼'} {fmtKr(Math.abs(pos.pnl))}</span>}
        <span className="pc-bid">sælg til kurs <span className="num">{pos.bid}</span></span>
      </div>
      <Fader pos={pos} store={store} halted={v.halted} />
    </section>
  );
}

/** Mixing-desk fader: drag left to sell part or all; magnetic notches; release shows a confirm chip. */
function Fader({ pos, store, halted }: { pos: MatchView['positions'][number]; store: MatchStore; halted: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [frac, setFrac] = useState(1); // share of the position kept (1 = all held)
  const [confirm, setConfirm] = useState<number | null>(null);
  const stakeBack = pos.bid > 0 ? Math.min(pos.shares, Math.ceil((100 * pos.stake) / pos.bid)) : pos.shares;
  const notches: { at: number; label: string }[] = [{ at: 0, label: 'Alt' }, { at: 0.5, label: '½' }];
  if (pos.value > pos.stake && stakeBack < pos.shares) {
    const at = 1 - stakeBack / pos.shares;
    if (Math.abs(at - 0.5) * 300 < 32) notches[1] = { at, label: 'Indsats hjem ≈ ½' };
    else notches.push({ at, label: 'Indsats hjem' });
  }
  const sellN = Math.round((1 - frac) * pos.shares);
  const readout = sellN > 0 ? `Sælg ${sellN} → ${fmtKr((sellN * pos.bid) / 100)} nu · ${pos.shares - sellN} kører videre (ved sejr ${fmtKr(pos.shares - sellN)})` : null;
  const setFromX = (x: number) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let f = Math.max(0, Math.min(1, (x - r.left) / r.width));
    for (const n of notches) if (Math.abs(f - n.at) * r.width < 12) f = n.at;
    setFrac(f);
  };
  return (
    <div className="fader-wrap">
      {readout && <div className="fd-readout num" role="status">{readout}</div>}
      <div
        ref={track}
        className={`fader no-touch-ui ${halted ? 'off' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="Sælg andele"
        aria-valuemin={0}
        aria-valuemax={pos.shares}
        aria-valuenow={pos.shares - sellN}
        aria-valuetext={readout ?? 'Alle andele beholdes'}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setFrac((f) => Math.max(0, f - 0.1));
          if (e.key === 'ArrowRight') setFrac((f) => Math.min(1, f + 0.1));
          if (e.key === 'Enter' && sellN > 0) setConfirm(sellN);
        }}
        onPointerDown={(e) => {
          if (halted) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          store.holdSpeed(6000);
          setConfirm(null);
          setFromX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === 'touch') {
            if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) setFromX(e.clientX);
          }
        }}
        onPointerUp={() => {
          if (sellN > 0) setConfirm(sellN);
          else setFrac(1);
        }}
      >
        <span className="fd-scale" aria-hidden="true">{notches.map((n) => <i key={n.label} style={{ left: `${n.at * 100}%` }} className={n.at > 0.8 ? 'end' : ''}>{n.label}</i>)}</span>
        <span className="fd-track" aria-hidden="true"><span className="fd-vu" style={{ width: `${Math.min(100, pos.bid)}%` }} /></span>
        <span className="fd-cap" aria-hidden="true" style={{ left: `calc(${frac * 100}% - ${frac * 44}px)` }} />
      </div>
      {halted && <p className="fd-off">Salg åbner efter stoppet</p>}
      {confirm !== null && (
        <div className="fd-confirm">
          <button onClick={() => { setConfirm(null); setFrac(1); }}>Fortryd</button>
          <button className="go" onClick={() => {
            store.sell(pos.id, confirm);
            setConfirm(null);
            setFrac(1);
          }}>Sælg {confirm} → {fmtKr((confirm * pos.bid) / 100)}</button>
        </div>
      )}
    </div>
  );
}

function Toasts({ v }: { v: MatchView }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {v.toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}
    </div>
  );
}

export { minuteLabel };
