// Watches measurements and marks challenges complete.
// Robustness: a challenge only completes when its condition holds SUSTAINED
// (several consecutive 10 Hz ticks) and the flow has settled after a shape change —
// startup transients (pressure waves) must not award trophies.

import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { CHALLENGES } from './challenges';
import { da } from '../i18n/da';

const SETTLE_SECONDS = 8;
const SUSTAIN_TICKS = 8; // ×0.1 s målinger i træk

export function useChallengeWatcher(): void {
  const thetaWindow = useRef<{ t: number; v: number }[]>([]);
  const shapeChangedAt = useRef(0);
  const sustain = useRef<Record<string, number>>({});

  useEffect(() => {
    const unsub = useStore.subscribe((s, prev) => {
      const now = performance.now() / 1000;
      if (s.committedShape !== prev.committedShape) {
        shapeChangedAt.current = now;
        sustain.current = {};
        thetaWindow.current = [];
      }
      if (s.measure === prev.measure || !s.measure) return;
      const w = thetaWindow.current;
      w.push({ t: now, v: s.measure.thetaDeg });
      while (w.length > 2 && w[0].t < now - 5) w.shift();
      if (now - shapeChangedAt.current < SETTLE_SECONDS) return;
      let mn = Infinity, mx = -Infinity;
      for (const e of w) {
        if (e.v < mn) mn = e.v;
        if (e.v > mx) mx = e.v;
      }
      const ctx = {
        m: s.measure,
        hasShape: !!s.committedShape,
        kind: s.committedShape?.kind ?? null,
        pivotLocked: s.pivotLocked,
        thetaAmplitude: w.length > 3 ? (mx - mn) / 2 : 0,
      };
      for (const ch of CHALLENGES) {
        if (s.completedChallenges.includes(ch.id)) continue;
        sustain.current[ch.id] = ch.done(ctx) ? (sustain.current[ch.id] ?? 0) + 1 : 0;
        if (sustain.current[ch.id] >= SUSTAIN_TICKS) {
          s.completeChallenge(ch.id);
          s.showToast(`🏆 ${ch.title} — ${da.challengeDone}`);
        }
      }
    });
    return unsub;
  }, []);
}
