// Tidsloopet: 1 uge = 3 sek. (6 sek. fra 2026) ved 1x. Kalder stepUge(), når ugen er gået.
// Under pause fryses ugens fremdrift (i stedet for at nulstille), så interpolation og ugeprogress står stille.
// Tiden står også stille, mens en dialog er åben — både signal-dialoger og brugeråbnede menuer (som i Game Dev
// Story). Menuer rører ikke `paused`, så spillet kører bare videre, når menuen lukkes (var det pauset, forbliver det pauset).
// Skiftes tempoet midt i en uge, bevares brøkdelen af ugen (ingen hop i ugeprogress eller interpolation).
import { useEffect } from 'react';
import { clock, ugeVarighedMs, useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { gem, noedGem } from '../../store/persistence';

/** Gem straks i autosave (fanen skjules eller lukkes — Safari på mobil dræber ofte baggrundsfaner).
 *  IndexedDB er asynkron og når ofte ikke at blive færdig ved et reload, så der skrives også en synkron nødkopi. */
function gemNu(): void {
  const g = useGame.getState().game;
  if (!g || g.slut) return;
  noedGem(g);
  void gem('auto', g);
}

export function useGameLoop(): void {
  useEffect(() => {
    let raf = 0;
    let sidst = performance.now();
    let akk = 0;
    let sidsteUge = -1;
    let sidsteUgeMs = 0;
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
      if (g) {
        const ugeMs = ugeVarighedMs(g.uge, st.speed);
        // Tempo skiftet: behold brøkdelen af ugen
        if (sidsteUgeMs > 0 && ugeMs !== sidsteUgeMs) akk *= ugeMs / sidsteUgeMs;
        sidsteUgeMs = ugeMs;
        clock.ugeMs = ugeMs;
        if (!st.paused && st.dialoger.length === 0 && !g.slut && !useUi.getState().dialog) {
          akk += dt;
          if (akk >= ugeMs) {
            akk = 0;
            st.stepUge();
            const ny = useGame.getState().game;
            sidsteUge = ny?.uge ?? -1;
            if (ny) sidsteUgeMs = ugeVarighedMs(ny.uge, useGame.getState().speed);
          } else {
            clock.sidsteTickMs = nu - akk;
          }
        } else {
          clock.sidsteTickMs = nu - akk; // frys interpolationen, hvor den er
        }
      } else {
        sidsteUgeMs = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // Pause, når fanen skjules (spec 6.19) — og gem, så et dræbt faneblad ikke mister spillet
    const vis = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!useGame.getState().paused) useGame.getState().pause('Fanen var skjult');
      gemNu();
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', gemNu);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', gemNu);
    };
  }, []);
}
