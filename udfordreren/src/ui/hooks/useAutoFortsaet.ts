// Én fælles regel for pause og dialoger:
// - En signal-dialog (anmeldelse, kvartalsmøde, galla, event, messe, Top 10 …) stopper tiden, mens den er åben.
//   Dens egen pausegrund ("Kvartalsmøde", "Hændelse" …) er opfyldt, når den lukkes.
// - Når den SIDSTE dialog i køen lukkes, kører tiden videre af sig selv — medmindre der stadig er en pausegrund
//   tilbage (fx "Licens godkendt", "Spil indlæst", "Fanen var skjult"), eller spilleren selv havde trykket pause.
// - Pausegrunde, der er blevet løst undervejs (produktet er lanceret, fasen har fået et hold, de ledige har fået
//   noget at lave), ryddes løbende, så pausebanneret aldrig viser en forældet grund. Løser spilleren den SIDSTE
//   automatiske grund (fx starter et produkt under "Ledige medarbejdere"), kører tiden videre af sig selv —
//   medmindre spilleren selv havde trykket pause.
// Brugeråbnede menuer (nyt produkt, tildel, gem …) fryser blot tidsloopet (se useGameLoop) og rører ikke pausen.
import { useEffect } from 'react';
import { GRUND_LEDIGT_HOLD, useGame } from '../../store/gameStore';
import { pauseTekst } from '../../sim/signals';
import type { GameState } from '../../sim/types';

/** Automatiske pausegrunde, der kan være blevet løst af spilleren, siden de opstod */
function erLoest(grund: string, g: GameState): boolean {
  switch (grund) {
    case 'Klar til lancering':
      return !g.projekter.some((p) => p.klar);
    case 'Ny fase':
      return g.projekter.every((p) => p.klar || p.faseTildeling[p.fase].length > 0);
    case 'Ledige medarbejdere': {
      if (g.projekter.some((p) => !p.klar)) return true;
      const travle = new Set(g.kontraktopgaver.flatMap((k) => k.staff));
      return g.staff.every((m) => travle.has(m.id));
    }
    case GRUND_LEDIGT_HOLD:
      // Løst, så snart nogen har noget at lave: en opgave eller en projektfase med folk på
      return g.kontraktopgaver.length > 0 || g.projekter.some((p) => !p.klar && p.faseTildeling[p.fase].length > 0);
    default:
      return false;
  }
}

export function useAutoFortsaet(): void {
  useEffect(() => {
    /** Spilleren har selv sat spillet på pause (mellemrum/pauseknap) — så bliver det sådan */
    let manuel = false;
    /** Pausegrunde, der hører til dialoger i den nuværende kø */
    const dialogGrunde = new Set<string>();
    let planlagt = false;
    let sidsteLukket = false;

    /** Kører efter notifikationen (ændr ikke storen midt i en), altid ud fra den nyeste tilstand */
    const afslut = () => {
      planlagt = false;
      const nu = useGame.getState();
      const g = nu.game;
      if (!g || nu.dialoger.length > 0) return;
      const lukket = sidsteLukket;
      sidsteLukket = false;
      const rest = nu.pauseGrunde.filter((x) => !erLoest(x, g) && !(lukket && dialogGrunde.has(x)));
      if (lukket) dialogGrunde.clear();
      if (!nu.paused) return;
      // Kør videre, når den sidste dialog er lukket, eller når spilleren har løst alle automatiske pausegrunde
      const loestAlt = nu.pauseGrunde.length > 0 && rest.length === 0;
      if ((lukket || loestAlt) && !manuel && rest.length === 0 && !g.slut) nu.fortsaet();
      else if (rest.length !== nu.pauseGrunde.length) useGame.setState({ pauseGrunde: rest });
    };

    return useGame.subscribe((s, prev) => {
      // Nyt, indlæst eller lukket spil: start forfra
      if (s.game !== prev.game && (!s.game || !prev.game || s.game.seed !== prev.game.seed)) {
        manuel = false;
        sidsteLukket = false;
        dialogGrunde.clear();
      }
      if (!s.paused) {
        manuel = false;
        sidsteLukket = false;
      } else if (!prev.paused) manuel = s.dialoger.length === 0 && s.pauseGrunde.length === 0;

      for (const d of s.dialoger) {
        const t = pauseTekst(d.signal);
        if (t) dialogGrunde.add(t);
      }
      if (prev.dialoger.length > 0 && s.dialoger.length === 0) sidsteLukket = true;
      if (!s.game || !s.paused || s.dialoger.length > 0) return;
      if (!sidsteLukket && s.pauseGrunde.length === 0) return;
      if (!planlagt) {
        planlagt = true;
        queueMicrotask(afslut);
      }
    });
  }, []);
}
