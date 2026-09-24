// Tidsloopet: 1 uge = 3 sek. (6 sek. fra 2026) ved 1x. Kalder stepUge(), når ugen er gået.
// Under pause fryses ugens fremdrift (i stedet for at nulstille), så interpolation og ugeprogress står stille.
import { useEffect } from 'react';
import { clock, ugeVarighedMs, useGame } from '../../store/gameStore';

export function useGameLoop(): void {
  useEffect(() => {
    let raf = 0;
    let sidst = performance.now();
    let akk = 0;
    let sidsteUge = -1;
    const loop = (nu: number) => {
      const dt = Math.min(250, nu - sidst);
      sidst = nu;
      const st = useGame.getState();
      const g = st.game;
      // Ugen blev ændret udefra (indlæsning, debug-hop, nyt spil): start forfra på ugen
      if (!g || g.uge !== sidsteUge) {
        akk = 0;
        sidsteUge = g?.uge ?? -1;
      }
      if (g && !st.paused && st.dialoger.length === 0 && !g.slut) {
        akk += dt;
        const ugeMs = ugeVarighedMs(g.uge, st.speed);
        clock.ugeMs = ugeMs;
        if (akk >= ugeMs) {
          akk = 0;
          st.stepUge();
          sidsteUge = useGame.getState().game?.uge ?? -1;
        } else {
          clock.sidsteTickMs = nu - akk;
        }
      } else if (g) {
        clock.ugeMs = ugeVarighedMs(g.uge, st.speed);
        clock.sidsteTickMs = nu - akk; // frys interpolationen, hvor den er
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // Pause, når fanen skjules (spec 6.19)
    const vis = () => {
      if (document.visibilityState === 'hidden' && !useGame.getState().paused) useGame.getState().pause('Fanen var skjult');
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
}
