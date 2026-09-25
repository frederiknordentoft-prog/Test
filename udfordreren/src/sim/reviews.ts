// Anmeldelser (spec 6.3): fire anmeldere 1-10, total /40, Guldkupon ≥ 32, Hall of Fame ≥ 36.
// Scoren sammenlignes med markedets nuværende standard — ikke med spillerens egne tidligere topscorer.
import type { GameState, LiveProduct, MarketId, Params, ProductTypeId, Review, ThemeId, Vertical } from './types';
import type { Rng } from './rng';
import { BALANCE } from '../data/balance';
import { REVIEWERS, GULDKUPON_TOTAL, HALL_OF_FAME_TOTAL } from '../data/reviewers';
import { PRODUCT_TYPES } from '../data/productTypes';
import { fitFor } from '../data/compatibility';
import { aarDecimal, kurve } from './time';
import { clamp } from './util';

/** Bedste aktive konkurrentprodukts kvalitet i de givne markeder og vertikal */
export function bedsteKonkurrentKvalitet(s: GameState, markeder: MarketId[], vertikal: Vertical): number {
  let best = 0;
  for (const p of s.produkter) {
    if (!p.aktiv || p.ejer === 'spiller') continue;
    if (PRODUCT_TYPES[p.typeId].vertikal !== vertikal) continue;
    if (!p.markeder.some((m) => markeder.includes(m))) continue;
    if (p.kvalitet > best) best = p.kvalitet;
  }
  return best;
}

/** Markedets standard pr. parameter: stiger med årstallet og med konkurrenternes bedste produkter */
/** `uge` = hvornår standarden måles (projekter bruges med deres startuge, så målstregen ikke flytter sig undervejs) */
export function markedsStandard(s: GameState, typeId: ProductTypeId, markeder: MarketId[] = ['dk'], uge: number = s.uge): number {
  const base = kurve(BALANCE.standardKurve, aarDecimal(uge));
  const komp = bedsteKonkurrentKvalitet(s, markeder, PRODUCT_TYPES[typeId].vertikal);
  return base * (1 + BALANCE.standardKonkurrent * Math.max(0, komp - 0.6));
}

export type ReviewInput = {
  typeId: ProductTypeId;
  themeId: ThemeId;
  params: Params;
  fejl: number;
  margin: number;
  intensitet: number;
  markeder: MarketId[];
  tidligEfterfoelger: boolean;
  standardUge?: number;
};

export type ReviewResult = { anmeldelser: Review[]; total40: number; guldkupon: boolean; hallOfFame: boolean; kvalitet: number; ratio: Params };

/** Mætning: en parameter langt over standarden giver aftagende udbytte */
export const paramQ = (r: number): number => 1 - Math.exp(-Math.max(0, r));

/** Fit som multiplikator i q-rum (1 = Ikke godt … 5 = Genialt) */
export const FIT_Q: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0.84, 2: 0.92, 3: 1.0, 4: 1.06, 5: 1.12 };

/** Score 1-10 fra en sammensat q-værdi (0..1) */
export function scoreFraQ(q: number): number {
  return 1 + 9 / (1 + Math.exp(-BALANCE.scoreK * (q - BALANCE.scoreQ0)));
}

export function ratioer(s: GameState, inp: Pick<ReviewInput, 'typeId' | 'params' | 'markeder' | 'standardUge'>): Params {
  const std = markedsStandard(s, inp.typeId, inp.markeder, inp.standardUge ?? s.uge);
  return {
    spaending: inp.params.spaending / std,
    originalitet: inp.params.originalitet / std,
    teknik: inp.params.teknik / std,
    tryghed: inp.params.tryghed / std,
  };
}

/** Kvalitet 0..1 (bruges af kunder, offshore og hitliste) */
export function kvalitetFra(r: Params, fit: number, fejl: number): number {
  const qAvg = (paramQ(r.spaending) + paramQ(r.originalitet) + paramQ(r.teknik) + paramQ(r.tryghed)) / 4;
  return clamp(qAvg * FIT_Q[fit as 1 | 2 | 3 | 4 | 5] * (1 - Math.min(0.3, fejl * 0.02)), 0.05, 0.99);
}

/** Hver anmelders sammensatte q-værdi (før støj). Eksporteres til tests og debug-visning. */
export function anmelderQ(s: GameState, inp: ReviewInput): Record<string, number> {
  const r = ratioer(s, inp);
  const q = { spaending: paramQ(r.spaending), originalitet: paramQ(r.originalitet), teknik: paramQ(r.teknik), tryghed: paramQ(r.tryghed) };
  const type = PRODUCT_TYPES[inp.typeId];
  const fitQ = FIT_Q[fitFor(inp.typeId, inp.themeId)];
  const niveau = 0.01 * (s.niveauer.type[inp.typeId] - 1) + 0.008 * (s.niveauer.tema[inp.themeId] - 1);
  // Platformen: en stærk egen platform løfter teknik og tryghed lidt (spec 6.12 kvalitetsloft)
  const pk = (s.platforme.kontoplatform.kvalitet + s.platforme[type.vertikal === 'betting' ? 'sportsbook' : 'kasinoplatform'].kvalitet) / 2;
  const platformBonus = 0.04 * ((pk - 50) / 50);
  const fejlStraf = Math.min(0.5, inp.fejl * 0.03);
  const fejlLet = Math.min(0.25, inp.fejl * 0.01);
  const efterfoelger = inp.tidligEfterfoelger ? 0.7 : 1;
  const qAvg = (q.spaending + q.originalitet + q.teknik + q.tryghed) / 4;
  const marginRatio = inp.margin / type.marginStd;
  // Kombinationen (fit) påvirker alle anmeldere — Tilsynet kun halvt — så kombinationsbogen betyder noget
  const fitHalv = Math.sqrt(fitQ);
  const raa: Record<string, number> = {
    branchebladet: (0.5 * q.teknik + 0.5 * q.originalitet) * fitQ * (1 - fejlLet) + niveau + platformBonus,
    tilsynet: (0.7 * q.tryghed + 0.3 * q.teknik) * fitHalv * (1 - 0.06 * (inp.intensitet - 3)) * (1 - 0.025 * (type.risiko - 5)) - fejlStraf + niveau * 0.5 + platformBonus / 2,
    forbrugerposten: (0.5 * qAvg + 0.5 * q.tryghed) * fitQ * Math.pow(1 / marginRatio, 0.6) * (1 - fejlLet) + niveau * 0.5,
    spillerforum: (0.7 * q.spaending + 0.3 * q.originalitet) * fitQ * fitQ * (1 + 0.03 * (inp.intensitet - 3)) * (1 - fejlLet) + niveau,
  };
  for (const k of Object.keys(raa)) raa[k] *= efterfoelger;
  return raa;
}

export function beregnAnmeldelser(s: GameState, rng: Rng, inp: ReviewInput): ReviewResult {
  const r = ratioer(s, inp);
  const raa = anmelderQ(s, inp);
  const anmeldelser: Review[] = REVIEWERS.map((rev) => {
    const score = clamp(Math.round(scoreFraQ(raa[rev.id]) + rng.gauss() * BALANCE.scoreStoej), 1, 10);
    const bucket = score <= 3 ? 0 : score <= 5 ? 1 : score <= 7 ? 2 : score <= 9 ? 3 : 4;
    return { anmelder: rev.id, score, citat: rng.pick(rev.citater[bucket]) };
  });
  const total40 = anmeldelser.reduce((a, b) => a + b.score, 0);
  return {
    anmeldelser,
    total40,
    guldkupon: total40 >= GULDKUPON_TOTAL,
    hallOfFame: total40 >= HALL_OF_FAME_TOTAL,
    kvalitet: kvalitetFra(r, fitFor(inp.typeId, inp.themeId), inp.fejl),
    ratio: r,
  };
}

/** Syntetiske anmeldelser til konkurrentprodukter (ud fra kvalitet) */
export function konkurrentAnmeldelser(rng: Rng, kvalitet: number): { anmeldelser: Review[]; total40: number } {
  const base = 1 + 9 * clamp((kvalitet - 0.2) / 0.75, 0, 1);
  const anmeldelser: Review[] = REVIEWERS.map((rev) => {
    const score = clamp(Math.round(base + rng.gauss() * 0.9), 1, 10);
    const bucket = score <= 3 ? 0 : score <= 5 ? 1 : score <= 7 ? 2 : score <= 9 ? 3 : 4;
    return { anmelder: rev.id, score, citat: rng.pick(rev.citater[bucket]) };
  });
  return { anmeldelser, total40: anmeldelser.reduce((a, b) => a + b.score, 0) };
}

export function produktVertikal(p: Pick<LiveProduct, 'typeId'>): Vertical {
  return PRODUCT_TYPES[p.typeId].vertikal;
}
