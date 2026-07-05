// Watches measurements and marks challenges complete.

import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { CHALLENGES } from './challenges';
import { da } from '../i18n/da';

export function useChallengeWatcher(): void {
  const thetaWindow = useRef<{ t: number; v: number }[]>([]);

  useEffect(() => {
    const unsub = useStore.subscribe((s, prev) => {
      if (s.measure === prev.measure || !s.measure) return;
      const now = performance.now() / 1000;
      const w = thetaWindow.current;
      w.push({ t: now, v: s.measure.thetaDeg });
      while (w.length > 2 && w[0].t < now - 5) w.shift();
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
        if (!s.completedChallenges.includes(ch.id) && ch.done(ctx)) {
          s.completeChallenge(ch.id);
          s.showToast(`🏆 ${ch.title} — ${da.challengeDone}`);
        }
      }
    });
    return unsub;
  }, []);
}
