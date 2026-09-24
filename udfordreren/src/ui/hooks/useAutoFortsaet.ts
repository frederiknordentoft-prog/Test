// Når en signal-dialog dukker op midt i et kørende spil, pauser spillet. Når den sidste dialog lukkes,
// fortsætter tiden automatisk — medmindre der stadig er en pausegrund (fx "Ny fase", eller en
// auto-pause spilleren har slået til for dialogens type i Indstillinger).
import { useEffect } from 'react';
import { useGame } from '../../store/gameStore';

export function useAutoFortsaet(): void {
  useEffect(() => {
    let koerteFoer = false;
    return useGame.subscribe((s, prev) => {
      if (s.dialoger.length > prev.dialoger.length && prev.dialoger.length === 0) koerteFoer = !prev.paused;
      if (prev.dialoger.length > 0 && s.dialoger.length === 0) {
        const fortsaet = koerteFoer && s.paused && s.pauseGrunde.length === 0 && !!s.game && !s.game.slut;
        koerteFoer = false;
        if (fortsaet) queueMicrotask(() => useGame.getState().fortsaet());
      }
      if (s.game !== prev.game && (!s.game || !prev.game)) koerteFoer = false;
    });
  }, []);
}
