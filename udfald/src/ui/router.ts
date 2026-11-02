/** Plain #name routes only (the artifact host passes nothing else through). */
import { useSyncExternalStore } from 'react';

export type Route = 'lobby' | 'kamp' | 'byg' | 'maal' | 'pulje' | 'portefolje' | 'afregning' | 'hallen' | 'demo' | 'demo-hallen' | 'spike';
const ROUTES: Route[] = ['lobby', 'kamp', 'byg', 'maal', 'pulje', 'portefolje', 'afregning', 'hallen', 'demo', 'demo-hallen', 'spike'];

function read(): Route {
  const h = location.hash.replace('#', '') as Route;
  return ROUTES.includes(h) ? h : 'lobby';
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener('hashchange', l);
      return () => window.removeEventListener('hashchange', l);
    },
    read,
  );
}

export function go(r: Route): void {
  try {
    location.hash = r;
  } catch {
    /* some hosts refuse hash writes; stay on the current view */
  }
}
