import { useEffect, useRef, useState } from 'react';
import { report, setCheck, useChecks, type Status } from '../diag/store';
import { checkWorkers } from '../diag/workers';
import { runCanvasBench } from '../diag/canvasBench';
import { bell } from '../diag/audio';
import { go } from '../ui/router';

const ORDER: [string, string][] = [
  ['env', 'Miljø'],
  ['csp', 'CSP'],
  ['fonts', 'Fonte'],
  ['audio', 'Lyd'],
  ['fps', 'Billedrate'],
  ['worker-fil', 'Worker (fil)'],
  ['worker-blob', 'Worker (blob)'],
  ['mc-main', 'MC i hovedtråd'],
  ['worker-mode', 'Konklusion'],
  ['view-transition', 'ViewTransition'],
  ['storage', 'Lager'],
  ['canvas', 'Canvas-ydelse'],
  ['gestus', 'Gestus'],
];

const COLOR: Record<Status, string> = { afventer: 'var(--text-2)', ok: 'var(--up)', advarsel: 'var(--bif)', fejl: 'var(--down)' };

export function Spike() {
  const checks = useChecks();
  const [copied, setCopied] = useState('');
  useEffect(() => {
    void checkWorkers();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report());
      setCopied('Kopieret. Indsæt rapporten i chatten.');
    } catch {
      setCopied('Kopiering blev afvist. Markér teksten nederst og kopiér den manuelt.');
    }
  };

  return (
    <div className="screen">
      <div className="bar">
        <button className="back" aria-label="Tilbage til lobby" onClick={() => go('lobby')}>‹</button>
        <h1>Diagnose</h1>
      </div>
      <div className="scroll">
        <div className="spike">
          <ul className="checks">
            {ORDER.map(([k, label]) => {
              const c = checks[k];
              return (
                <li key={k}>
                  <span className="dot" style={{ background: COLOR[c?.status ?? 'afventer'] }} aria-hidden="true" />
                  <span className="lbl">{label}</span>
                  <span className="det">{c?.detail ?? 'ikke kørt'}</span>
                </li>
              );
            })}
          </ul>
          <div className="actions">
            <button className="act" onClick={() => void runCanvasBench()}>Mål canvas-ydelse</button>
            <button className="act" onClick={() => bell(660, 990, 1.8, 0.2)}>Afspil lukkeklokke</button>
            <button className="act" onClick={() => void checkWorkers()}>Test workere igen</button>
          </div>
          <GestureBox />
          <button className="act primary" onClick={() => void copy()}>Kopiér rapport</button>
          {copied && <p className="note" role="status">{copied}</p>}
          <details className="raw">
            <summary>Rå rapport</summary>
            <pre>{report()}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}

/** Vertical drags, long-press and cancels inside a touch-action:none box. Tells us whether the host steals gestures. */
function GestureBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [log, setLog] = useState({ downs: 0, cancels: 0, maxDy: 0, longPress: 0, last: '–' });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let y0 = 0;
    let moved = 0;
    let timer: number | undefined;
    const st = { downs: 0, cancels: 0, maxDy: 0, longPress: 0, last: '–' };
    const push = () => {
      setLog({ ...st });
      setCheck('gestus', {
        status: st.cancels ? 'advarsel' : st.downs ? 'ok' : 'afventer',
        detail: st.downs ? `${st.downs} tryk · maks lodret træk ${Math.round(st.maxDy)} px · langt tryk ${st.longPress} · afbrudt af værten ${st.cancels}` : 'Prøv felterne nedenfor',
        data: { ...st },
      });
    };
    const down = (e: PointerEvent) => {
      st.downs++;
      y0 = e.clientY;
      moved = 0;
      el.setPointerCapture(e.pointerId);
      timer = window.setTimeout(() => {
        if (moved < 6) {
          st.longPress++;
          st.last = 'langt tryk';
          push();
        }
      }, 450);
      st.last = 'ned';
      push();
    };
    const move = (e: PointerEvent) => {
      const dy = Math.abs(e.clientY - y0);
      moved = Math.max(moved, dy);
      if (dy > st.maxDy) st.maxDy = dy;
    };
    const up = () => {
      window.clearTimeout(timer);
      st.last = `op (træk ${Math.round(moved)} px)`;
      push();
    };
    const cancel = () => {
      window.clearTimeout(timer);
      st.cancels++;
      st.last = 'AFBRUDT af værten';
      push();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
  }, []);
  return (
    <div className="gesture">
      <p>Træk lodret op og ned i feltet, og hold fingeren stille i et sekund. Hvis Claude-arket lukker, siden ruller, eller der kommer en tekst-lup, er det et fund.</p>
      <div ref={ref} className="gesture-box no-touch-ui" role="application" aria-label="Gestus-testfelt">
        <span>{log.last}</span>
        <small>tryk {log.downs} · maks træk {Math.round(log.maxDy)} px · langt {log.longPress} · afbrudt {log.cancels}</small>
      </div>
    </div>
  );
}
