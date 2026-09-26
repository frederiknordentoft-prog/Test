// Markedsstandarden (hvorfor scoren kan falde, selv om I gør det rigtige) og Hall of Fame-kravet.
// Rene funktioner uden React og uden kit.tsx (så de kan unit-testes).
import type { GameState, LiveProduct } from '../../sim/types';
import { markedsStandard } from '../../sim/reviews';
import { HALL_OF_FAME_TOTAL, HALL_OF_FAME_TYPENIVEAU } from '../../data/reviewers';
import { START_AAR, UGER_PR_AAR } from '../../sim/time';

export type StandardSpring = { fra: number; til: number; pct: number; forrigeNavn: string };

/**
 * Hvor meget markedets standard (pr. parameter) er steget mellem to lanceringer — målt for det nye produkts type og
 * markeder, så de to tal kan sammenlignes. Konkurrenttillægget er dagens (historikken gemmes ikke).
 */
export function standardSpring(s: GameState, p: LiveProduct, forrige: LiveProduct): StandardSpring {
  const fra = markedsStandard(s, p.typeId, p.markeder, forrige.lanceretUge);
  const til = markedsStandard(s, p.typeId, p.markeder, p.lanceretUge);
  return { fra, til, pct: fra > 0 ? til / fra - 1 : 0, forrigeNavn: forrige.navn };
}

/** Standarden i januar år for år (til en lille søjlegraf), for produktets type og markeder */
export function standardKurve(s: GameState, p: Pick<LiveProduct, 'typeId' | 'markeder'>, fraAar: number, tilAar: number): { aar: number; v: number }[] {
  const ud: { aar: number; v: number }[] = [];
  for (let aar = fraAar; aar <= tilAar; aar++) ud.push({ aar, v: markedsStandard(s, p.typeId, p.markeder, (aar - START_AAR) * UGER_PR_AAR) });
  return ud;
}

/** Nåede produktet Hall of Fame-pointene, men manglede typeniveauet? Så forklares det (ellers ligner det en fejl). */
export function hallOfFameMangler(s: GameState, p: LiveProduct): { niveau: number; krav: number } | null {
  if (p.hallOfFame || p.total40 < HALL_OF_FAME_TOTAL) return null;
  const niveau = s.niveauer.type[p.typeId] ?? 1;
  return niveau < HALL_OF_FAME_TYPENIVEAU ? { niveau, krav: HALL_OF_FAME_TYPENIVEAU } : null;
}

/** Hall of Fame-kravet i én sætning (trofæhylden, firmapanelet) */
export const HALL_OF_FAME_KRAV = `${HALL_OF_FAME_TOTAL} point eller mere på en produkttype i niveau ${HALL_OF_FAME_TYPENIVEAU}+. Giver permanent niveaubonus.`;

/** Så mange uger efter en lancering med faldende score giver Knud sit råd om markedsstandarden */
const FALD_UGER = 8;

/** Faldt seneste lancering mindst 3 point i forhold til den forrige (inden for de seneste uger)? */
export function scoreFald(s: GameState): { produktId: string; spring: ReturnType<typeof standardSpring> } | null {
  const egne = s.produkter.filter((p) => p.ejer === 'spiller').sort((a, b) => b.lanceretUge - a.lanceretUge);
  const [nyeste, forrige] = egne;
  if (!nyeste || !forrige || s.uge - nyeste.lanceretUge > FALD_UGER) return null;
  if (nyeste.total40 > forrige.total40 - 3) return null;
  return { produktId: nyeste.id, spring: standardSpring(s, nyeste, forrige) };
}

