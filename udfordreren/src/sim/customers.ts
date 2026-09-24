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

export const VERTIKALER: Vertical[] = ['betting', 'kasino'];

/** Markedets licenserede online-BSI pr. uge (mio. kr.) før hold-varians */
export function markedsBsiBasis(m: MarketId, v: Vertical, uge: number): number {
  const kurvePunkter = MARKET_CURVES[m][v];
  const aar = aarDecimal(uge);
  if (kurvePunkter.length && aar < kurvePunkter[0][0]) return 0;
  return (kurve(kurvePunkter, aar) * 1000) / 52;
}

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
  return (
    def.cac *
    MARKETS[m].cacFaktor *
    (1 + andel * andel * CAC_ANDEL_FAKTOR) *
    konkurrentTryk(s, m) *
    Math.max(0.5, 1 + eff.cac + passiv.cac)
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
  for (const k of CHANNEL_IDS) {
    if (k === 'crm') continue;
    const spend = (s.marketingMix[k] ?? 0) * andelAfBudget;
    if (spend <= 0 || !kanalTilgaengelig(s, k)) continue;
    const cac = effektivCac(s, k, m);
    if (!cac) continue;
    const effSpend = spend / (1 + spend / CHANNELS[k].maetning);
    nye += (effSpend * 1e6) / cac;
  }
  return nye * (1 + BONUS_TILGANG[s.bonusNiveau]);
}

/** Startkunder ved lancering + kryds-salg første gang en vertikal lanceres */
export function lanceringsKunder(s: GameState, p: LiveProduct): void {
  const v = PRODUCT_TYPES[p.typeId].vertikal;
  const fit = FIT_FAKTOR[fitFor(p.typeId, p.themeId)];
  for (const m of p.markeder) {
    const ms = s.markeder[m];
    const N = markedsKunder(s, m, v);
    const foersteIVertikal = !s.produkter.some(
      (x) => x.id !== p.id && x.ejer === 'spiller' && x.markeder.includes(m) && PRODUCT_TYPES[x.typeId].vertikal === v,
    );
    const start = N * BALANCE.startKunderAndel * (0.4 + p.total40 / 40) * (1 + s.hype / 40) * fit * (0.6 + s.omdoemme / 125);
    ms.spillerKunder[v] += start;
    if (foersteIVertikal) {
      const anden = ANDEN_VERTIKAL[v];
      const kryds = ms.spillerKunder[anden] * BALANCE.krydsSalgStart;
      ms.spillerKunder[v] += kryds;
      if (v !== s.startVertikal && s.milepaele.andenVertikal === undefined) s.milepaele.andenVertikal = s.uge;
    }
    ms.spillerKunder[v] = Math.min(ms.spillerKunder[v], N * BALANCE.maksAndel);
  }
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

  for (const p of s.produkter) if (p.ejer === 'spiller') p.bsiPrUge = {};

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
        (1 + BONUS_CHURN[s.bonusNiveau]) *
        Math.max(0.5, 1 + eff.churn + passiv.churn) *
        (1 + Math.min(0.5, fejlSnit * 0.02));
      C = C + betalte + organisk + hitliste + mund + kryds - C * clamp(churnRate, 0.002, 0.5);
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
        (1 + VIP_ARPU[s.vipProgram]) *
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
