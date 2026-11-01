import { useEffect, useRef, useSyncExternalStore } from 'react';
import { go } from './router';
import { useLongPress } from './Hud';
import type { MatchStore } from '../state/match';
import type { HallenStore } from '../state/hallen';

/** Two live cards: the derby (price line) and the hall (scope trace). Chrome stays still. */
export function Lobby({ derby, hallen, onLogoLong }: { derby: MatchStore; hallen: HallenStore; onLogoLong: () => void }) {
  const lp = useLongPress(onLogoLong);
  const v = useSyncExternalStore(derby.subscribeView, derby.getView);
  const hv = useSyncExternalStore(hallen.subscribe, hallen.getView);
  return (
    <div className="screen">
      <div className="scroll">
        <div className="lobby">
          <div className="lobby-head">
            <button className="logo no-touch-ui" aria-label="ØRE. Hold for debug-HUD" {...lp}>Ø<span>RE</span></button>
            <span className="phase-pill num">Saldo {Math.round(v.saldo).toLocaleString('da-DK')} kr</span>
          </div>
          <button className="card live-card" onClick={() => go('kamp')}>
            <span className="lc-league">Superligaen · Parken</span>
            <span className="lc-row"><b>FCK – Brøndby</b><span className="num">{v.h}–{v.a} · {v.minute}</span></span>
            <MiniLine store={derby} />
            <span className="lc-row"><span className="lc-price num"><b className="f0">{v.d.outcomes[0].ask}</b> øre FCK</span><span className="go">Til kampen ›</span></span>
          </button>
          <button className="card live-card" onClick={() => go('hallen')}>
            <span className="lc-league">Herreligaen · Gigantium</span>
            <span className="lc-row"><b>Aalborg – GOG</b><span className="num">{hv.h}–{hv.a} · {hv.minute}</span></span>
            <MiniScope store={hallen} />
            <span className="lc-row"><span className="lc-price num"><b className="aah">{hv.asks[0]}</b> øre Aalborg</span><span className="go">Til hallen ›</span></span>
          </button>
          <div className="demo-row">
            <button className="act primary" onClick={() => go('demo')}>Se demoen · 90 sek.</button>
            <button className="act" onClick={() => go('portefolje')}>Portefølje</button>
          </div>
          <p className="foot">Prototype · fiktive kurser · ingen rigtige penge</p>
        </div>
      </div>
    </div>
  );
}

function MiniLine({ store }: { store: MatchStore }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== w * dpr) {
        cv.width = w * dpr;
        cv.height = h * dpr;
      }
      const c = cv.getContext('2d');
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const H = store.sim.hist;
      if (H.n < 2) return;
      c.strokeStyle = '#5ce1ff';
      c.lineWidth = 1.6;
      c.beginPath();
      const span = Math.max(10, store.sim.t);
      for (let i = 0; i < H.n; i++) {
        const x = (H.t[i] / span) * (w - 6);
        const y = h - (H.ask[i * 3] / 100) * h;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    };
    draw();
    const off = store.onFrame(draw);
    return off;
  }, [store]);
  return <canvas ref={ref} className="mini" aria-hidden="true" />;
}

function MiniScope({ store }: { store: HallenStore }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== w * dpr) {
        cv.width = w * dpr;
        cv.height = h * dpr;
      }
      const c = cv.getContext('2d');
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const pts = store.trace(240);
      c.strokeStyle = 'rgba(244,237,228,0.25)';
      c.beginPath();
      c.moveTo(0, h / 2);
      c.lineTo(w, h / 2);
      c.stroke();
      c.strokeStyle = '#f4ede4';
      c.lineWidth = 1.6;
      c.beginPath();
      pts.forEach((d, i) => {
        const x = (i / Math.max(1, pts.length - 1)) * w;
        const y = h / 2 - (d / 8) * (h / 2);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.stroke();
    };
    draw();
    return store.onFrame(draw);
  }, [store]);
  return <canvas ref={ref} className="mini" aria-hidden="true" />;
}
