// Akt-chrome for hele skallen (spec 6.19): sætter <html data-akt="garage|vaekst|ai"> ud fra spillets uge.
// CSS-tokens i src/index.css skifter så farver og glød pr. akt. Uden spil (titelskærmen) fjernes attributten.
import { useEffect } from 'react';
import { useGame } from '../../store/gameStore';
import { aktFor } from '../../render/actChrome';

export function useAktChrome(): void {
  const akt = useGame((s) => (s.game ? aktFor(s.game.uge) : null));
  useEffect(() => {
    const r = document.documentElement;
    if (akt) r.dataset.akt = akt;
    else delete r.dataset.akt;
  }, [akt]);
}
