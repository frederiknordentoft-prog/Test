// Små hooks til medieforespørgsler og reduceret bevægelse (uden rerender pr. frame).
import { useSyncExternalStore } from 'react';
import { useGame } from '../../store/gameStore';

function lytTil(query: string) {
  return (cb: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const mq = window.matchMedia(query);
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  };
}

const abonnenter = new Map<string, (cb: () => void) => () => void>();

/** true, når medieforespørgslen matcher (opdateres ved ændring) */
export function useMedia(query: string): boolean {
  let sub = abonnenter.get(query);
  if (!sub) {
    sub = lytTil(query);
    abonnenter.set(query, sub);
  }
  return useSyncExternalStore(
    sub,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** Samme brydepunkt som Tailwind-varianten `bred:` i index.css */
export const BRED_QUERY = '(min-width: 1024px), (orientation: landscape) and (min-width: 640px)';

/** Smal skærm (mobil portræt): kompakt HUD og fanebjælke i bunden */
export function useSmal(): boolean {
  return !useMedia(BRED_QUERY);
}

/** Reduceret bevægelse: indstillingen i spillet ELLER styresystemets præference */
export function useReduceretBevaegelse(): boolean {
  const indstilling = useGame((s) => s.settings.reduceretBevaegelse);
  const system = useMedia('(prefers-reduced-motion: reduce)');
  return indstilling || system;
}

/** Ikke-hook-variant (til effekter uden for React) */
export function reduceretBevaegelseNu(): boolean {
  if (useGame.getState().settings.reduceretBevaegelse) return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
