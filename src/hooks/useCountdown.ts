import { useEffect, useState } from 'react';
import { countdown, type Countdown } from '../lib/format';

/**
 * Live countdown to a target timestamp. Ticks once a second while the tab is
 * visible, pauses when hidden, and resyncs on return. Only the component that
 * calls this re-renders — the timeline stays static.
 */
export function useCountdown(target: number | null): Countdown | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target == null) return;
    let id: number | undefined;
    const tick = () => setNow(Date.now());
    const start = () => {
      tick();
      id = window.setInterval(tick, 1000);
    };
    const stop = () => {
      if (id !== undefined) window.clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => {
      stop();
      if (document.visibilityState === 'visible') start();
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [target]);

  return target == null ? null : countdown(target, now);
}
