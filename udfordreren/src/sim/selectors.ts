// Afledte værdier til UI'et. Rene funktioner over GameState — ingen mutation.
export { aarFor, ugeIAar, maanedFor, kvartalFor, datoTekst, ugeTekst, AI_AKT_UGE, SIDSTE_UGE, START_AAR } from './time';
export { minBudget, typeStatus, temaStatus, maxProjekter, ledigeTilProjekt, boostPris, boostEffekt, lanceringsStatus, budgetFaktor, vertikalStatus } from './projects';
export { markedsStandard, ratioer, anmelderQ, kvalitetFra } from './reviews';
export { opgaverFor, pladser, traeningPris, rolleskiftFor, ROLLESKIFT_PRIS, passiveEffekter, STAT_KEYS } from './staff';
export { kontraktKvalitet } from './contracts';
export { spillerKunderTotal, kundeAndel, effektivCac, kanalTilgaengelig, portefoeljeStyrke, friskhed, markedsKunder, aktiveMarkeder, spillerProdukter } from './customers';
export { aarligBsi, effektivAfgift } from './economy';
export { naesteRunde, vaerdiansaettelse, antalLanceringer, evaluerMaal } from './investors';
export { naesteKontor, kontorKrav } from './office';
export { naesteMesse, bookingAabent } from './expos';
export { forskningStatus, forskningsEffekt } from './insight';
export { tillidsPoster } from './trust';
export { ejerInfo } from './competitors';
export { niveauForXp, xpTilNaesteNiveau, NIVEAU_TAERSKLER } from './levels';
export { licensPris, SPILBARE_MARKEDER } from './markets';
export { effektTekst, eventTekst } from './events';
export { pauserFor, pauseTekst } from './signals';

import type { GameState, LiveProduct, MarketId, ProductTypeId, ThemeId } from './types';
import { fitFor, komboNoegle, FIT_NAVN, type Fit } from '../data/compatibility';
import { xpTilNaeste } from '../data/roles';

export function komboInfo(s: GameState, typeId: ProductTypeId, themeId: ThemeId): { set: boolean; fit: Fit | null; fitNavn: string; bedste40: number } {
  const k = s.kombinationsbog[komboNoegle(typeId, themeId)];
  if (!k?.set) return { set: false, fit: null, fitNavn: 'Første forsøg', bedste40: 0 };
  const fit = fitFor(typeId, themeId);
  return { set: true, fit, fitNavn: FIT_NAVN[fit], bedste40: k.bedste40 };
}

export function produkt(s: GameState, id: string): LiveProduct | undefined {
  return s.produkter.find((p) => p.id === id);
}

export function spillerensProdukter(s: GameState, kunAktive = true): LiveProduct[] {
  return s.produkter.filter((p) => p.ejer === 'spiller' && (!kunAktive || p.aktiv));
}

export function top10Med(s: GameState, m: MarketId) {
  return s.markeder[m].top10.map((e) => ({ ...e, produkt: s.produkter.find((p) => p.id === e.productId) }));
}

export function staffXpAndel(erfaring: number, niveau: number): number {
  return Math.min(1, erfaring / xpTilNaeste(niveau));
}

/** Alle signaler der viser at en handling blev afvist */
export function afvisninger(s: GameState): string[] {
  return s.signaler.filter((x) => x.k === 'fejl').map((x) => (x as { tekst: string }).tekst);
}
