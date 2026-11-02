import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MatchStore } from '../../state/match';
import { fmtKr, legKey, legLabel } from '../../state/match';
import type { Leg } from '../../engine/mc/paths';
import { Book } from '../../engine/book/portfolio';
import { go } from '../router';

/**
 * Byg en fremtid: combining bets is filtering simulated futures. Each leg burns the futures that
 * don't satisfy it; what is left is the price. Strands are drawn as score paths (goal difference
 * over time), with window legs shaded on the time axis.
 */
export function Byg({ store }: { store: MatchStore }) {
  const v = useSyncExternalStore(store.subscribeView, store.getView);
  const [legs, setLegs] = useState<Leg[]>(store.build.legs);
  const [stake, setStake] = useState(50);
  const cv = useRef<HTMLCanvasElement>(null);
  const q = store.build.quote;
  const r = store.build.result;
  const t = v.t;
  const nextWin = Math.min(85, Math.ceil((t + 1) / 5) * 5);
  const options: { group: string; legs: Leg[] }[] = [
    { group: 'Udfald', legs: [{ kind: 'udfald', o: 0 }, { kind: 'udfald', o: 1 }, { kind: 'udfald', o: 2 }] },
    { group: 'Mål', legs: [{ kind: 'maal', n: v.h + v.a + 1 }, { kind: 'maal', n: v.h + v.a + 2 }, { kind: 'maal', n: Math.max(3, v.h + v.a + 3) }, { kind: 'btts' }] },
    { group: 'Målvindue', legs: [{ kind: 'vindue', a: nextWin, b: Math.min(nextWin + 10, 90) }, { kind: 'vindue', a: Math.min(nextWin + 10, 80), b: Math.min(nextWin + 20, 90) }] },
  ];
  const has = (l: Leg) => legs.some((x) => legKey(x) === legKey(l));
  const toggle = (l: Leg) => {
    let next = has(l) ? legs.filter((x) => legKey(x) !== legKey(l)) : [...legs.filter((x) => !(x.kind === 'udfald' && l.kind === 'udfald') && !(x.kind === 'maal' && l.kind === 'maal')), l];
    if (next.length > 3) next = next.slice(-3);
    setLegs(next);
    store.setLegs(next);
  };
  useEffect(() => {
    if (store.build.legs.length && !store.build.quote) store.setLegs(store.build.legs);
  }, [store]);
  useEffect(() => setLegs(store.build.legs), [v, store]);

  // Draw score paths.
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
    const left = 34;
    const right = w - 40;
    const top = 14;
    const bottom = h - 22;
    const end = store.sim.end;
    const t0 = r?.t0 ?? t;
    const X = (tt: number) => left + ((tt - t0) / Math.max(1, end - t0)) * (right - left);
    const Y = (d: number) => top + ((3 - Math.max(-3, Math.min(3, d))) / 6) * (bottom - top);
    for (const l of legs) {
      if (l.kind !== 'vindue') continue;
      g.fillStyle = 'rgba(197,139,255,0.10)';
      g.fillRect(X(Math.max(l.a, t0)), top, X(l.b) - X(Math.max(l.a, t0)), bottom - top);
    }
    g.font = '600 10px "ORE Tight", Arial';
    g.fillStyle = '#8a94a3';
    g.textAlign = 'right';
    for (const d of [-2, -1, 0, 1, 2]) {
      g.strokeStyle = d === 0 ? '#2a3240' : '#161c24';
      g.beginPath();
      g.moveTo(left, Y(d) + 0.5);
      g.lineTo(right, Y(d) + 0.5);
      g.stroke();
      g.fillText(d === 0 ? 'lige' : d > 0 ? `FCK +${d}` : `BIF +${-d}`, left - 4, Y(d) + 3);
    }
    g.textAlign = 'left';
    g.fillText(`${Math.floor(t0)}′`, left, h - 6);
    g.textAlign = 'right';
    g.fillText('90+', right, h - 6);
    if (!r) return;
    const all = (1 << legs.length) - 1;
    const ends = new Map<number, number>();
    g.globalCompositeOperation = 'lighter';
    for (const s of r.strands) {
      const alive = legs.length === 0 || (s.cell & all) === all;
      g.strokeStyle = alive ? 'rgba(92,225,255,0.38)' : 'rgba(120,120,120,0.07)';
      g.lineWidth = alive ? 1.3 : 1;
      g.beginPath();
      const jitter = ((s.id % 7) - 3) * 0.6;
      let d = s.d[0];
      g.moveTo(X(t0), Y(d) + jitter);
      for (let i = 0; i < s.goalT.length; i++) {
        g.lineTo(X(s.goalT[i]), Y(d) + jitter);
        d += s.goalTeam[i] === 0 ? 1 : -1;
        g.lineTo(X(s.goalT[i]), Y(d) + jitter);
      }
      g.lineTo(right, Y(d) + jitter);
      g.stroke();
      if (alive) ends.set(d, (ends.get(d) ?? 0) + 1);
    }
    g.globalCompositeOperation = 'source-over';
    // Endpoints stacked as dots at full time.
    ends.forEach((n, d) => {
      for (let i = 0; i < n; i++) {
        g.fillStyle = '#5ce1ff';
        g.beginPath();
        g.arc(right + 6 + (i % 6) * 5, Y(d) - 6 + Math.floor(i / 6) * 5, 1.8, 0, Math.PI * 2);
        g.fill();
      }
    });
  }, [r, legs, t, store]);

  const survivors = r && legs.length ? r.strands.filter((s) => (s.cell & ((1 << legs.length) - 1)) === (1 << legs.length) - 1).length : 100;
  const lift = q && q.naive > 0 ? q.joint / q.naive : 1;
  const ask = q?.ask ?? 0;
  const { shares } = ask ? Book.sharesFor(stake, ask) : { shares: 0 };
  const pending = v.pending && q && v.pending.contract === q.id ? v.pending : null;
  return (
    <div className="screen byg">
      <div className="bar">
        <button className="back" aria-label="Tilbage til kampen" onClick={() => go(v.demo ? 'demo' : 'kamp')}>‹</button>
        <h1>Byg en fremtid</h1>
        <span className="num bar-meta">{v.h}–{v.a} · {v.minute}</span>
      </div>
      <div className="scroll">
        <div className="byg-body">
          <p className="lead">Vælg op til tre ben. Hvert ben brænder de fremtider af, der ikke opfylder det. Det, der er tilbage, er prisen.</p>
          <div className="byg-count" aria-live="polite">
            <b className="num">{legs.length ? survivors : 100}</b> af 100 fremtider tilbage
            {q && !q.tooUnlikely && <span className="num"> → kurs {q.ask}</span>}
          </div>
          <canvas ref={cv} className="byg-canvas" role="img" aria-label={`${survivors} af 100 simulerede fremtider opfylder de valgte ben.`} />
          <div className="byg-legs">
            {options.map((o) => (
              <div key={o.group} className="byg-group">
                <span className="byg-gl">{o.group}</span>
                <div className="chips">
                  {o.legs.map((l) => (
                    <button key={legKey(l)} className={has(l) ? 'on' : ''} aria-pressed={has(l)} onClick={() => toggle(l)}>{legLabel(l)}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {q && (
            <div className="byg-quote">
              {q.tooUnlikely ? (
                <p className="tray-note">For usandsynlig at bygge: under 5 % af fremtiderne.</p>
              ) : (
                <>
                  <p className="byg-ticker num"><b>{q.label}</b> · kurs {q.ask} · odds {(100 / q.ask).toFixed(2).replace('.', ',')}</p>
                  {legs.length > 1 && (
                    <p className="tray-note num">Hver for sig {Math.round(q.naive * 100)} % · samlet {Math.round(q.joint * 100)} %{lift >= 1.15 ? ' · benene hænger sammen og trækker hinanden op' : lift <= 0.87 ? ' · benene trækker hinanden ned' : ''}</p>
                  )}
                  <div className="chips" role="group" aria-label="Indsats">
                    {[25, 50, 100, 250].map((c) => <button key={c} className={c === stake ? 'on' : ''} aria-pressed={c === stake} onClick={() => setStake(c)}><span className="num">{c}</span> kr</button>)}
                  </div>
                  <div className="tray-pay"><span>Udbetaling ved sejr</span><b className="num">{fmtKr(shares)}</b></div>
                  {pending ? (
                    pending.state === 'lock' ? <div className="lock" role="status"><span className="lock-ring" aria-hidden="true" /> Låser kurs {pending.lockedAsk} …</div>
                    : <div className="requote"><span>Kursen flyttede sig – acceptér {pending.newAsk}?</span><button className="tray-cancel" onClick={() => store.cancelPending()}>Annullér</button><button className="tray-buy" onClick={() => store.acceptRequote()}>Acceptér</button></div>
                  ) : (
                    <button className="tray-buy wide" disabled={!store.isOpen(q.id) || shares < 1} onClick={() => store.requestBuy(q.id, stake)}>Køb {stake} kr · ved sejr {fmtKr(shares)}</button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
