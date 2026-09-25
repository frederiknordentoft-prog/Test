// Kundemotoren (spec 6.4): tilgang via kanaler (CAC), hype, anmeldelser og hitliste; churn; BSI pr. kunde.
import type { AcqChannel, GameState, LiveProduct, MarketId, Vertical } from './types';
import type { Rng } from './rng';
import { MARKETS } from '../data/markets';
import { MARKET_CURVES } from '../data/marketCurves';
import { PRODUCT_TYPES } from '../data/productTypes';
import { VERTICALS, ANDEN_VERTIKAL } from '../data/verticals';
import { CHANNELS, CHANNEL_IDS, CAC_ANDEL_FAKTOR, CRM_MAX_CHURN_REDUKTION } from '../data/acquisition';
import { BONUS_CHURN, BONUS_TILGANG, VIP_ARPU } from '../data/costs';
import { FIT_FAKTOR, fitFor } from '../data/compatibility';
import { BALANCE } from '../data/balance';
import { aarDecimal, aarFor, kurve } from './time';
import { clamp } from './util';
import { forskningsEffekt } from './insight';
import { passiveEffekter } from './staff';
import { markedTotalBsi } from './offshore';
import { effektivBonus, effektivVip, regelEffekt } from './regulation';
import { trendEffekt } from './trends';

export const VERTIKALER: Vertical[] = ['betting', 'kasino'];

/** Markedets samlede online-BSI pr. uge (licenseret + offshore, mio. kr.) før trends og hold-varians */
export function markedsBsiBasis(m: MarketId, v: Vertical, uge: number): number {
  return markedTotalBsi(m, v, uge);
}

/** Markedets licenserede online-BSI pr. uge ifølge kurven (spec 7.3) */
export function licenseretBsiKurve(m: MarketId, v: Vertical, uge: number): number {
  const kurvePunkter = MARKET_CURVES[m][v];
  const aar = aarDecimal(uge);
  if (kurvePunkter.length === 0 || aar < kurvePunkter[0][0]) return 0;
  return (kurve(kurvePunkter, aar) * 1000) / 52;
}

/** Strenghed over 2 gør kunderne dyrere og mindre værd (grænser, KYC, reklameregler) [D] */
export const strenghedCac = (streng: number): number => 1 + 0.06 * Math.max(0, streng - 2);
export const strenghedArpu = (streng: number, v: Vertical): number => 1 - 0.03 * Math.max(0, streng - 2) * (v === 'kasino' ? 1.5 : 1);

/** Antal aktive online-kunder i markedet (licenseret + offshore) */
export function markedsKunder(s: GameState, m: MarketId, v: Vertical): number {
  const bsiAar = markedsBsiBasis(m, v, s.uge) * 52 * 1e6; // kr.
  const arpu = MARKETS[m].arpu[v];
  return arpu > 0 ? bsiAar / arpu : 0;
}

export function friskhed(p: LiveProduct, uge: number, gange = 1): number {
  const hl = PRODUCT_TYPES[p.typeId].halveringstidUger * gange;
  const alder = Math.max(0, uge - p.lanceretUge);
  return Math.max(BALANCE.friskhedGulv, Math.pow(0.5, alder / hl));
}

/** Produktets vægt i porteføljen: kvalitet × friskhed × fit */
export function produktVaegt(s: GameState, p: LiveProduct): number {
  const fit = FIT_FAKTOR[fitFor(p.typeId, p.themeId)];
  const gange = p.ejer === 'spiller' ? 1 : BALANCE.konkurrentHalveringGange;
  return p.kvalitet * friskhed(p, s.uge, gange) * (0.8 + 0.2 * fit);
}

/** Nye produkter trækker ekstra aktivitet fra ejerens egne kunder de første uger (GDS-lanceringsbølge) */
export function lanceringsBoelge(s: GameState, p: LiveProduct): number {
  const alder = Math.max(0, s.uge - p.lanceretUge);
  return 1 + BALANCE.lanceringsBoelge * Math.exp(-alder / BALANCE.lanceringsBoelgeUger);
}

export function spillerProdukter(s: GameState, m: MarketId, v: Vertical): LiveProduct[] {
  return s.produkter.filter((p) => p.aktiv && p.ejer === 'spiller' && p.markeder.includes(m) && PRODUCT_TYPES[p.typeId].vertikal === v);
}

export function portefoeljeStyrke(s: GameState, m: MarketId, v: Vertical): number {
  const sumV = spillerProdukter(s, m, v).reduce((a, p) => a + produktVaegt(s, p), 0);
  return 1 - Math.exp(-BALANCE.portefoeljeK * sumV);
}

export function spillerKunderTotal(s: GameState): number {
  let n = 0;
  for (const m of Object.keys(s.markeder) as MarketId[]) n += s.markeder[m].spillerKunder.betting + s.markeder[m].spillerKunder.kasino;
  return n;
}

/** Spillerens andel af markedets kunder (begge vertikaler) */
export function kundeAndel(s: GameState, m: MarketId): number {
  const N = markedsKunder(s, m, 'betting') + markedsKunder(s, m, 'kasino');
  if (N <= 0) return 0;
  return (s.markeder[m].spillerKunder.betting + s.markeder[m].spillerKunder.kasino) / N;
}

/** Konkurrenternes marketingtryk i markedet (1 = normalt) */
export function konkurrentTryk(s: GameState, m: MarketId): number {
  const aktive = s.konkurrenter.filter((c) => c.tilstede && c.markeder.includes(m));
  if (aktive.length === 0) return 1;
  const snit = aktive.reduce((a, c) => a + c.marketingMultiplikator, 0) / aktive.length;
  return clamp(snit, 0.5, 3);
}

/** Effektiv CAC for en kanal i et marked (kr.) */
export function effektivCac(s: GameState, kanal: AcqChannel, m: MarketId): number | null {
  const def = CHANNELS[kanal];
  if (def.cac === null) return null;
  const andel = kundeAndel(s, m);
  const eff = forskningsEffekt(s);
  const passiv = passiveEffekter(s);
  const regel = regelEffekt(s, m);
  const effektivitet = Math.max(0.3, 1 + trendEffekt(s, m).marketingRoi + regel.marketingEffekt);
  return (
    (def.cac *
      MARKETS[m].cacFaktor *
      (1 + andel * andel * CAC_ANDEL_FAKTOR) *
      konkurrentTryk(s, m) *
      Math.max(0.5, 1 + eff.cac + passiv.cac) *
      (1 + regel.cac[kanal]) *
      strenghedCac(s.markeder[m].strenghed)) /
    effektivitet
  );
}

/** Aktive markeder for spilleren (licens aktiv i mindst én vertikal) */
export function aktiveMarkeder(s: GameState): MarketId[] {
  return (Object.keys(s.markeder) as MarketId[]).filter((m) => s.markeder[m].aaben && s.markeder[m].licens === 'aktiv');
}

export function kanalTilgaengelig(s: GameState, kanal: AcqChannel): boolean {
  const def = CHANNELS[kanal];
  if (aarFor(s.uge) < def.fraAar) return false;
  if (kanal === 'aiAgentApi' && s.platforme.kontoplatform.dataejerskab < 0.6) return false;
  return true;
}

/** Nye kunder fra betalte kanaler denne uge i et marked, før fordeling på vertikaler */
export function kanalTilgang(s: GameState, m: MarketId, andelAfBudget: number): number {
  let nye = 0;
  const lukket = regelEffekt(s, m).lukket;
  for (const k of CHANNEL_IDS) {
    if (k === 'crm' || lukket.includes(k)) continue;
    const spend = (s.marketingMix[k] ?? 0) * andelAfBudget;
    if (spend <= 0 || !kanalTilgaengelig(s, k)) continue;
    const cac = effektivCac(s, k, m);
    if (!cac) continue;
    const effSpend = spend / (1 + spend / CHANNELS[k].maetning);
    nye += (effSpend * 1e6) / cac;
  }
  return nye * (1 + BONUS_TILGANG[effektivBonus(s, m)]);
}

/** Anmeldelsens vægt i lanceringsbølgen: stejl som salget i Game Dev Story (0,2 ved 0/40 … 2,5 ved 40/40) */
export function lanceringsFaktor(total40: number): number {
  return 0.2 + 2.3 * Math.pow(Math.max(0, total40) / 40, 4);
}

/** Størrelsen på en lanceringsbølge (spillere) i et marked */
export function lanceringsBoelgeStoerrelse(s: GameState, m: MarketId, v: Vertical, total40: number, fitF: number, hype: number, omdoemme: number): number {
  const N = markedsKunder(s, m, v);
  return N * BALANCE.startKunderAndel * lanceringsFaktor(total40) * fitF * (1 + hype / 80) * (0.7 + omdoemme / 166);
}

/** Lanceringsbølge + kryds-salg første gang en vertikal lanceres. Spillerne kommer ind over de næste uger. */
export function lanceringsKunder(s: GameState, p: LiveProduct): void {
  const v = PRODUCT_TYPES[p.typeId].vertikal;
  const fit = FIT_FAKTOR[fitFor(p.typeId, p.themeId)];
  p.ventendeSpillere = {};
  for (const m of p.markeder) {
    const ms = s.markeder[m];
    const foersteIVertikal = !s.produkter.some(
      (x) => x.id !== p.id && x.ejer === 'spiller' && x.markeder.includes(m) && PRODUCT_TYPES[x.typeId].vertikal === v,
    );
    let pulje = lanceringsBoelgeStoerrelse(s, m, v, p.total40, fit, s.hype, s.omdoemme);
    if (foersteIVertikal) {
      pulje += ms.spillerKunder[ANDEN_VERTIKAL[v]] * BALANCE.krydsSalgStart;
      if (v !== s.startVertikal && s.milepaele.andenVertikal === undefined) s.milepaele.andenVertikal = s.uge;
    }
    p.ventendeSpillere[m] = pulje;
  }
}

/** Frigiv ca. halvdelen af en lanceringsbølge pr. uge */
export function frigivBoelge(p: LiveProduct, m: MarketId): number {
  const pulje = p.ventendeSpillere?.[m] ?? 0;
  if (pulje <= 0) return 0;
  const frigiv = pulje < 30 ? pulje : pulje * BALANCE.boelgeFrigivelse;
  p.ventendeSpillere![m] = pulje - frigiv;
  return frigiv;
}

/** Kampagne: engangsbeløb til hype og (for live produkter) kunder */
export function kampagneKunder(s: GameState, p: LiveProduct, budget: number): void {
  const v = PRODUCT_TYPES[p.typeId].vertikal;
  for (const m of p.markeder) {
    const cac = effektivCac(s, 'sociale', m) ?? 1500;
    const effBudget = budget / (1 + budget / 1.5);
    const nye = ((effBudget * 1e6) / (cac * 1.2)) / p.markeder.length;
    s.markeder[m].spillerKunder[v] += nye;
  }
}

export type KundeUge = { bsi: Record<MarketId, Record<Vertical, number>>; bsiIalt: number };

/** Ugentlig tilgang, churn og BSI for spilleren. Skriver bsiPrUge på produkterne. */
export function ugentligeKunder(s: GameState, rng: Rng): KundeUge {
  const res: KundeUge = { bsi: {} as KundeUge['bsi'], bsiIalt: 0 };
  const eff = forskningsEffekt(s);
  const passiv = passiveEffekter(s);
  const markeder = aktiveMarkeder(s);
  // Markedsføringsbudgettet fordeles efter markedsstørrelse
  const vaegte = markeder.map((m) => markedsKunder(s, m, 'betting') + markedsKunder(s, m, 'kasino'));
  const vaegtSum = vaegte.reduce((a, b) => a + b, 0) || 1;
  const crmSpend = s.marketingMix.crm ?? 0;
  const totalKunder = Math.max(1, spillerKunderTotal(s));
  const crmReduktion = CRM_MAX_CHURN_REDUKTION * (1 - Math.exp(-(crmSpend * 1e6) / (totalKunder * 15)));

  for (const p of s.produkter) {
    if (p.ejer !== 'spiller') continue;
    p.bsiPrUge = {};
    p.nyeSpillerePrUge = {};
  }
  // Suspenderet licens: kunderne kan ikke spille og siver væk; inddraget: kunderne er tabt
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const ms = s.markeder[m];
    if (ms.licens === 'suspenderet') for (const v of VERTIKALER) ms.spillerKunder[v] *= 0.9;
    if (ms.licens === 'inddraget') for (const v of VERTIKALER) ms.spillerKunder[v] = 0;
    if (ms.licens !== 'aktiv') ms.spillerBsiPrUge = { betting: 0, kasino: 0 };
  }

  markeder.forEach((m, mi) => {
    const ms = s.markeder[m];
    res.bsi[m] = { betting: 0, kasino: 0 };
    const andelBudget = vaegte[mi] / vaegtSum;
    const betalteNye = kanalTilgang(s, m, andelBudget);
    const styrke: Record<Vertical, number> = {
      betting: ms.vertikaler.betting.status === 'aktiv' ? portefoeljeStyrke(s, m, 'betting') : 0,
      kasino: ms.vertikaler.kasino.status === 'aktiv' ? portefoeljeStyrke(s, m, 'kasino') : 0,
    };
    const N: Record<Vertical, number> = { betting: markedsKunder(s, m, 'betting'), kasino: markedsKunder(s, m, 'kasino') };
    const fordelingSum = styrke.betting * N.betting + styrke.kasino * N.kasino;

    for (const v of VERTIKALER) {
      const produkter = spillerProdukter(s, m, v);
      let C = ms.spillerKunder[v];
      if (produkter.length === 0) {
        // Uden produkter i vertikalen forsvinder kunderne hurtigt
        ms.spillerKunder[v] = C * 0.85;
        continue;
      }
      const st = styrke[v];
      // Tilgang
      const betalte = fordelingSum > 0 ? (betalteNye * st * N[v]) / fordelingSum / VERTICALS[v].cacFaktor : 0;
      const organisk = N[v] * BALANCE.hypeOrganisk * s.hype * st * (0.5 + s.omdoemme / 100);
      let hitliste = 0;
      for (const e of ms.top10) {
        const pr = produkter.find((x) => x.id === e.productId);
        if (pr) hitliste += N[v] * BALANCE.top10Organisk * ((11 - e.placering) / 10) * pr.kvalitet;
      }
      const mund = C * BALANCE.mundTilMund * st;
      const kryds = ms.spillerKunder[ANDEN_VERTIKAL[v]] * BALANCE.krydsSalgUge * (spillerProdukter(s, m, ANDEN_VERTIKAL[v]).length > 0 ? 1 : 0);
      const boelger = produkter.map((p) => frigivBoelge(p, m));
      const basisTilgang = betalte + organisk + hitliste + mund + kryds;
      // Churn
      const vaegtSumP = produkter.reduce((a, p) => a + produktVaegt(s, p), 0) || 1;
      const marginRatio = produkter.reduce((a, p) => a + (p.margin / PRODUCT_TYPES[p.typeId].marginStd) * produktVaegt(s, p), 0) / vaegtSumP;
      const intensitet = produkter.reduce((a, p) => a + p.intensitet * produktVaegt(s, p), 0) / vaegtSumP;
      const fejlSnit = produkter.reduce((a, p) => a + p.fejl * produktVaegt(s, p), 0) / vaegtSumP;
      const churnRate =
        VERTICALS[v].churnPrUge *
        Math.max(0.5, 1 + 1.2 * (marginRatio - 1)) *
        (1.45 - 0.9 * st) *
        (1 - crmReduktion) *
        (1 + BONUS_CHURN[effektivBonus(s, m)]) *
        Math.max(0.5, 1 + eff.churn + passiv.churn) *
        (1 + Math.min(0.5, fejlSnit * 0.02));
      C = C + basisTilgang + boelger.reduce((a, b) => a + b, 0) - C * clamp(churnRate, 0.002, 0.5);
      C = clamp(C, 0, N[v] * BALANCE.maksAndel);
      ms.spillerKunder[v] = C;

      // BSI pr. kunde
      const hold = s.holdFaktor[m]?.[v] ?? 1;
      const arpuUge = MARKETS[m].arpu[v] / 52;
      const bsiKr =
        C *
        arpuUge *
        Math.pow(marginRatio, 0.85) *
        (1 + 0.07 * (intensitet - 3)) *
        (0.7 + 0.5 * st) *
        (1 + VIP_ARPU[effektivVip(s, m)]) *
        Math.max(0.3, 1 + regelEffekt(s, m).arpu[v]) *
        strenghedArpu(ms.strenghed, v) *
        (1 + (v === 'betting' ? passiv.bettingBsi : passiv.kasinoBsi)) *
        (1 + eff.arpu) *
        hold;
      const bsi = Math.max(0, bsiKr / 1e6);
      res.bsi[m][v] = bsi;
      res.bsiIalt += bsi;
      // Fordel på produkter: de stærkeste og friskeste produkter trækker mest (vægt²)
      const fordel = produkter.map((p) => Math.pow(produktVaegt(s, p), 2) * lanceringsBoelge(s, p) * (p.margin / PRODUCT_TYPES[p.typeId].marginStd));
      const fordelSum = fordel.reduce((a, b) => a + b, 0) || 1;
      for (const [i, p] of produkter.entries()) {
        const b = (bsi * fordel[i]) / fordelSum;
        p.bsiPrUge[m] = (p.bsiPrUge[m] ?? 0) + b;
        p.samletBsi += b;
        p.nyeSpillerePrUge![m] = (basisTilgang * fordel[i]) / fordelSum + boelger[i];
      }
    }
    ms.kunder = ms.spillerKunder.betting + ms.spillerKunder.kasino;
    ms.spillerBsiPrUge = { betting: res.bsi[m].betting, kasino: res.bsi[m].kasino };
  });
  void rng;
  return res;
}

/** Justér alle spillerens kunder med en andel (events) */
export function justerKunder(s: GameState, pct: number): void {
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    for (const v of VERTIKALER) s.markeder[m].spillerKunder[v] = Math.max(0, s.markeder[m].spillerKunder[v] * (1 + pct));
  }
}
