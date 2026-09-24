// Konkurrenter (spec 6.8). Fase 1-2: Danske Lykke + 3 konkurrenter i dk, der lancerer egne produkter
// og deler den del af markedet, spilleren og offshore ikke tager.
import type { Competitor, GameState, LiveProduct, MarketId, ProductTypeId, ThemeId, Vertical } from './types';
import type { Rng } from './rng';
import { COMPETITORS, PRODUKT_SUFFIKS, type CompetitorDef } from '../data/competitors';
import { PRODUCT_TYPES, PRODUCT_TYPE_IDS } from '../data/productTypes';
import { THEMES, THEME_IDS } from '../data/themes';
import { fitFor } from '../data/compatibility';
import { BALANCE } from '../data/balance';
import { aarFor, trin } from './time';
import { clamp, nyId, nyhed } from './util';
import { konkurrentAnmeldelser, produktVertikal } from './reviews';
import { lanceringsBoelge, lanceringsBoelgeStoerrelse, frigivBoelge, markedsKunder, produktVaegt, VERTIKALER } from './customers';
import { VERTICALS } from '../data/verticals';
import { FIT_FAKTOR } from '../data/compatibility';

export const DEF_BY_ID: Record<string, CompetitorDef> = Object.fromEntries(COMPETITORS.map((c) => [c.id, c]));

export function konkurrentStyrke(c: Competitor, uge: number): number {
  const def = DEF_BY_ID[c.id];
  return def ? trin(def.styrke, uge) : c.styrke;
}

function naesteLancering(rng: Rng, innovation: number): number {
  const aar = BALANCE.konkurrentLanceringInterval * (3 / (1.2 + 0.6 * innovation));
  return Math.round(52 * aar * rng.range(0.7, 1.3));
}

export function initKonkurrenter(s: GameState, rng: Rng): void {
  s.konkurrenter = COMPETITORS.map((d) => ({
    id: d.id,
    navn: d.navn,
    arketype: d.arketype,
    arkivId: d.arkivId,
    markeder: [...d.markeder],
    vertikaler: [...d.vertikaler],
    styrke: trin(d.styrke, 0),
    aggressivitet: d.aggressivitet,
    innovation: d.innovation,
    opkoebslyst: d.opkoebslyst,
    compliance: d.compliance,
    marketingMultiplikator: 1,
    tilstede: d.fraUge <= 0,
    cooldowns: {},
    farve: d.farve,
    monogram: d.monogram,
    naesteLanceringUge: naesteLancering(rng, d.innovation) - rng.int(10, 40),
    sidsteHandling: 'Aktiv i Danmark fra dag ét.',
  }));
  for (const d of COMPETITORS) {
    d.startProdukter.forEach((sp, i) => {
      const lanceret = d.id === 'danskeLykke' && sp.navn === 'Haven Kasino' ? 0 : -rng.int(20, 160);
      const { anmeldelser, total40 } = konkurrentAnmeldelser(rng, sp.kvalitet);
      s.produkter.push({
        id: nyId(s, 'lp'),
        navn: sp.navn,
        ejer: d.id,
        typeId: sp.typeId,
        themeId: sp.themeId,
        markeder: [...sp.markeder],
        margin: PRODUCT_TYPES[sp.typeId].marginStd,
        intensitet: 3,
        kvalitet: sp.kvalitet,
        lanceretUge: lanceret,
        anmeldelser,
        total40,
        guldkupon: total40 >= 32,
        hallOfFame: false,
        bsiPrUge: {},
        samletBsi: 0,
        aktiv: true,
        features: [],
        fejl: 0,
        version: 1,
        bedstePlacering: {},
        ugerITop10: 0,
      });
      void i;
    });
  }
}

function vaelgTypeOgTema(rng: Rng, c: Competitor, aar: number): { typeId: ProductTypeId; themeId: ThemeId; v: Vertical } {
  const v = rng.pick(c.vertikaler);
  const typer = PRODUCT_TYPE_IDS.filter((t) => {
    const def = PRODUCT_TYPES[t];
    return def.vertikal === v && def.fraAar <= aar && !def.krav.lovligMarked && t !== 'aiSlots' && t !== 'egneSlots';
  });
  const typeId = rng.pick(typer.length ? typer : (['prematch'] as ProductTypeId[]));
  const temaer = THEME_IDS.filter((th) => THEMES[th].fraAar <= aar);
  const themeId = rng.weighted(temaer, (th) => Math.pow(fitFor(typeId, th), 2));
  return { typeId, themeId, v: PRODUCT_TYPES[typeId].vertikal };
}

export function konkurrentKvalitet(rng: Rng, c: Competitor, uge: number): number {
  const aar = aarFor(uge) - 2012;
  return clamp(0.36 + 0.045 * konkurrentStyrke(c, uge) + 0.05 * c.innovation + 0.012 * aar + 0.06 * rng.gauss(), 0.2, 0.95);
}

export function lancerKonkurrentProdukt(s: GameState, rng: Rng, c: Competitor, marked: MarketId): LiveProduct {
  const def = DEF_BY_ID[c.id];
  const { typeId, themeId } = vaelgTypeOgTema(rng, c, aarFor(s.uge));
  const kvalitet = konkurrentKvalitet(rng, c, s.uge);
  const { anmeldelser, total40 } = konkurrentAnmeldelser(rng, kvalitet);
  const brand = def ? rng.pick(def.brands) : c.navn;
  const navn = `${brand} ${rng.pick(PRODUKT_SUFFIKS[typeId])}`;
  const t = PRODUCT_TYPES[typeId];
  const p: LiveProduct = {
    id: nyId(s, 'lp'),
    navn,
    ejer: c.id,
    typeId,
    themeId,
    markeder: [marked],
    margin: Math.round((t.marginStd + (rng.next() - 0.5) * (t.marginMax - t.marginMin) * 0.5) * 1000) / 1000,
    intensitet: clamp(Math.round(2 + c.aggressivitet * 0.4 + rng.gauss() * 0.5), 1, 5) as 1 | 2 | 3 | 4 | 5,
    kvalitet,
    lanceretUge: s.uge,
    anmeldelser,
    total40,
    guldkupon: total40 >= 32,
    hallOfFame: total40 >= 36,
    bsiPrUge: {},
    samletBsi: 0,
    aktiv: true,
    features: t.feature ? [t.feature] : [],
    fejl: 0,
    version: 1,
    bedstePlacering: {},
    ugerITop10: 0,
  };
  // Lanceringsbølge (bruges af hitlisten: ugens nye spillere)
  p.ventendeSpillere = {
    [marked]: lanceringsBoelgeStoerrelse(s, marked, t.vertikal, total40, FIT_FAKTOR[fitFor(typeId, themeId)], 10 + 6 * c.aggressivitet, 45 + 5 * c.styrke),
  };
  s.produkter.push(p);
  c.sidsteHandling = `Lancerede ${navn} (${t.navn}, ${THEMES[themeId].navn}).`;
  nyhed(s, `${c.navn} lancerer ${navn} — ${total40}/40 hos anmelderne.`, 'konkurrent');
  // Ryd op: højst N aktive produkter pr. vertikal pr. marked
  const v = t.vertikal;
  const egne = s.produkter.filter((x) => x.aktiv && x.ejer === c.id && x.markeder.includes(marked) && produktVertikal(x) === v);
  if (egne.length > BALANCE.maxProdukterPrVertikal) {
    const svagest = egne.filter((x) => x.id !== p.id).sort((a, b) => produktVaegt(s, a) - produktVaegt(s, b))[0];
    if (svagest) {
      svagest.aktiv = false;
      svagest.pensioneretUge = s.uge;
      svagest.bsiPrUge = {};
    }
  }
  return p;
}

/** Ugentlig konkurrentadfærd og fordeling af markedets resterende BSI */
export function ugentligeKonkurrenter(s: GameState, rng: Rng): void {
  for (const c of s.konkurrenter) {
    c.styrke = konkurrentStyrke(c, s.uge);
    if (!c.tilstede) continue;
    if (s.uge >= c.naesteLanceringUge) {
      const marked = rng.pick(c.markeder.filter((m) => s.markeder[m].aaben));
      if (marked) lancerKonkurrentProdukt(s, rng, c, marked);
      c.naesteLanceringUge = s.uge + naesteLancering(rng, c.innovation);
    }
  }
  for (const p of s.produkter) {
    if (p.ejer === 'spiller') continue;
    p.bsiPrUge = {};
    p.nyeSpillerePrUge = {};
  }

  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const ms = s.markeder[m];
    if (!ms.aaben) {
      ms.andele = {};
      continue;
    }
    const andeleBsi: Record<string, number> = { spiller: 0, offshore: 0, oevrige: 0 };
    let total = 0;
    for (const v of VERTIKALER) {
      const markedBsi = ms.markedsBsiPrUge[v];
      const offshore = markedBsi * ms.offshore[v];
      const spiller = ms.spillerBsiPrUge[v];
      const rest = Math.max(0, markedBsi - offshore - spiller);
      andeleBsi.offshore += offshore;
      andeleBsi.spiller += spiller;
      total += markedBsi + Math.max(0, spiller - (markedBsi - offshore));
      const aktoerer = s.konkurrenter.filter((c) => c.tilstede && c.markeder.includes(m) && c.vertikaler.includes(v));
      const vaegte = aktoerer.map((c) => {
        const prods = s.produkter.filter((p) => p.aktiv && p.ejer === c.id && p.markeder.includes(m) && produktVertikal(p) === v);
        const portefoelje = prods.reduce((a, p) => a + produktVaegt(s, p), 0);
        const w = prods.length ? Math.pow(c.styrke, BALANCE.styrkeExp) * c.marketingMultiplikator * (0.6 + 0.4 * Math.min(1.5, portefoelje)) : 0;
        return { c, prods, w };
      });
      const oevrigeVaegt = m === 'dk' ? BALANCE.oevrigeVaegt : BALANCE.oevrigeVaegt * 2;
      const sumW = vaegte.reduce((a, x) => a + x.w, 0) + oevrigeVaegt;
      andeleBsi.oevrige += (rest * oevrigeVaegt) / sumW;
      const Nv = markedsKunder(s, m, v);
      for (const { c, prods, w } of vaegte) {
        const bsiC = (rest * w) / sumW;
        andeleBsi[c.id] = (andeleBsi[c.id] ?? 0) + bsiC;
        // Konkurrentens kunder og ugentlige tilgang (erstatning for churn × marketingtryk)
        const kunderC = markedBsi > 0 ? (bsiC / markedBsi) * Nv : 0;
        // Etablerede brands har lavere churn end en udfordrer, så deres faste tilgang er mindre
        const tilgang = kunderC * VERTICALS[v].churnPrUge * BALANCE.konkurrentTilgang * c.marketingMultiplikator;
        // Konkurrenternes brands deler mere jævnt end spillerens produkter; nye lanceringer får en bølge
        const pSum = prods.reduce((a, p) => a + produktVaegt(s, p) * lanceringsBoelge(s, p), 0) || 1;
        for (const p of prods) {
          const andel = (produktVaegt(s, p) * lanceringsBoelge(s, p)) / pSum;
          const b = bsiC * andel;
          p.bsiPrUge[m] = (p.bsiPrUge[m] ?? 0) + b;
          p.samletBsi += b;
          p.nyeSpillerePrUge![m] = (p.nyeSpillerePrUge![m] ?? 0) + tilgang * andel + frigivBoelge(p, m);
        }
      }
    }
    ms.andele = {};
    if (total > 0) for (const [k, v] of Object.entries(andeleBsi)) ms.andele[k] = v / total;
  }
}

export function ejerInfo(s: GameState, ejer: string): { navn: string; farve: string; monogram: string } {
  if (ejer === 'spiller') return { navn: s.firmaNavn, farve: '#ffd23f', monogram: s.firmaNavn.slice(0, 2).toUpperCase() };
  const c = s.konkurrenter.find((x) => x.id === ejer);
  if (c) return { navn: c.navn, farve: c.farve, monogram: c.monogram };
  return { navn: ejer, farve: '#888', monogram: '?' };
}
