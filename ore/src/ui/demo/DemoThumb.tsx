import { useEffect, useRef, useState } from 'react';
import type { MatchStore } from '../../state/match';
import { OUTCOME_ID } from '../../state/match';
import { DEMO_STEPS } from '../../engine/director/demo90';
import { go } from '../router';

/**
 * The ghost thumb: performs the demo's gestures through the store, with a visible marked thumb
 * and a one-line caption, so the viewer sees what a user would do.
 */
export function DemoThumb({ store }: { store: MatchStore }) {
  const [thumb, setThumb] = useState<{ x: number; y: number; note: string; press: boolean } | null>(null);
  const done = useRef(new Set<number>());

  useEffect(() => {
    const point = (sel: string, fx = 0.5, fy = 0.5) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width * fx, y: r.top + r.height * fy };
    };
    const show = (sel: string, note: string, press = true, fx = 0.5, fy = 0.5) => {
      const p = point(sel, fx, fy);
      if (p) setThumb({ ...p, note, press });
    };
    const off = store.onFrame(() => {
      const t = store.sim.t;
      const phase = store.sim.phase;
      DEMO_STEPS.forEach((s, i) => {
        if (done.current.has(i)) return;
        const due = s.do === 'settle' ? phase === 'closed' : s.do === 'byg' ? phase === 'HT' : t >= s.at && (phase === '1H' || phase === '2H') && !store.sim.halt;
        if (!due) return;
        done.current.add(i);
        store.holdSpeed(3500);
        if (s.do === 'hold') {
          show(`.ab-seg.s${s.outcome}`, s.note);
          store.setFocus(s.outcome);
          setTimeout(() => store.requestBuy(OUTCOME_ID[s.outcome], s.kr), 900);
          setTimeout(() => setThumb(null), 2600);
        } else if (s.do === 'limit') {
          show('.fan-wrap', s.note, true, 0.2, 0.62);
          setTimeout(() => store.placeLimit(s.outcome, s.level, s.kr), 900);
          setTimeout(() => setThumb(null), 2400);
        } else if (s.do === 'window') {
          show(`.mv-bar:nth-child(${Math.max(1, Math.floor((s.a - Math.floor(store.sim.t / 5) * 5) / 5) + 1)})`, s.note);
          setTimeout(() => store.requestBuy(`w:${s.a}-${s.b}:J`, s.kr), 900);
          setTimeout(() => setThumb(null), 2600);
        } else if (s.do === 'byg') {
          go('byg');
          setTimeout(() => {
            store.setLegs([{ kind: 'udfald', o: 0 }, { kind: 'maal', n: 3 }]);
            show('.byg-legs', s.note);
          }, 600);
          setTimeout(() => {
            const q = store.build.quote;
            if (q) store.requestBuy(q.id, s.kr);
          }, 4200);
          setTimeout(() => {
            setThumb(null);
            go('demo');
          }, 7200);
        } else if (s.do === 'fader') {
          show('.fader', s.note, true, 0.62, 0.6);
          setTimeout(() => setThumb(null), 2400);
        } else if (s.do === 'settle') {
          setTimeout(() => go('afregning'), 1400);
        }
      });
    });
    return off;
  }, [store]);

  if (!thumb) return null;
  return (
    <div className="ghost-thumb" style={{ left: thumb.x, top: thumb.y }} aria-hidden="true">
      <span className={`gt-dot ${thumb.press ? 'press' : ''}`} />
      <span className="gt-note">Demo · {thumb.note}</span>
    </div>
  );
}
