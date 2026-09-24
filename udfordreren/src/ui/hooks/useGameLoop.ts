// Tidsloopet: 1 uge = 3 sek. (6 sek. fra 2026) ved 1x. Kalder stepUge(), når ugen er gået.
import { useEffect } from 'react';
import { clock, ugeVarighedMs, useGame } from '../../store/gameStore';

export function useGameLoop(): void {
  useEffect(() => {
    let raf = 0;
    let sidst = performance.now();
    let akk = 0;
    const loop = (nu: number) => {
      const dt = Math.min(250, nu - sidst);
      sidst = nu;
      const st = useGame.getState();
      const g = st.game;
      if (g && !st.paused && st.dialoger.length === 0 && !g.slut) {
        akk += dt;
        const ugeMs = ugeVarighedMs(g.uge, st.speed);
        clock.ugeMs = ugeMs;
        if (akk >= ugeMs) {
          akk = 0;
          st.stepUge();
        }
      } else {
        akk = 0;
        clock.sidsteTickMs = nu; // frys interpolation under pause
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // Pause, når fanen skjules (spec 6.19)
    const vis = () => {
      if (document.visibilityState === 'hidden') useGame.getState().pause('Fanen var skjult');
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
}
