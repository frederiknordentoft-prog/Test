// Konkurrenter (spec 6.8). Fase 1-2: Danske Lykke + 3 konkurrenter i dk, der lancerer egne produkter
// og deler den del af markedet, spilleren og offshore ikke tager.
import type { Competitor, GameState, LiveProduct, MarketId, ProductTypeId, ThemeId, Vertical } from './types';
import type { Rng } from './rng';
import { COMPETITORS, PRODUKT_SUFFIKS, type CompetitorDef } from '../data/competitors';
import { MARKETS } from '../data/markets';
import { PRODUCT_TYPES, PRODUCT_TYPE_IDS } from '../data/productTypes';
import { THEMES, THEME_IDS } from '../data/themes';
import { fitFor } from '../data/compatibility';
import { BALANCE } from '../data/balance';
import { aarFor, trin } from './time';
import { afvis, betal, clamp, nyId, nyhed, signal } from './util';
import { konkurrentAnmeldelser, produktVertikal } from './reviews';
import { lanceringsBoelge, lanceringsBoelgeStoerrelse, frigivBoelge, markedsKunder, produktVaegt, VERTIKALER } from './customers';
import { konkurrentMarketing, r4Markedsindtog, r6StatsejetExit, taelReaktion } from './reactions';
import { KONKURRENT_EVENTS } from '../data/competitorEvents';
import { VERTICALS } from '../data/verticals';
import { FIT_FAKTOR } from '../data/compatibility';

export const DEF_BY_ID: Record<string, CompetitorDef> = Object.fromEntries(COMPETITORS.map((c) => [c.id, c]));

export function konkurrentStyrke(c: Competitor, uge: number): number {
  const def = DEF_BY_ID[c.id];
  return def ? trin(def.styrke, uge) : c.styrke;
}

function naesteLancering(rng: Rng, innovation: number, antalMarkeder = 1): number {
  const aar = (BALANCE.konkurrentLanceringInterval * (3 / (1.2 + 0.6 * innovation))) / Math.sqrt(Math.max(1, antalMarkeder));
  return Math.max(4, Math.round(52 * aar * rng.range(0.7, 1.3)));
}

/** Vælg marked for en lancering: store markeder og markeder, hvor konkurrenten har få produkter */
function vaelgMarked(s: GameState, rng: Rng, c: Competitor): MarketId | null {
  const aabne = c.markeder.filter((m) => s.markeder[m].aaben);
  if (aabne.length === 0) return null;
  return rng.weighted(aabne, (m) => {
    const str = s.markeder[m].markedsBsiPrUge.betting + s.markeder[m].markedsBsiPrUge.kasino + 1;
    const egne = s.produkter.filter((p) => p.aktiv && p.ejer === c.id && p.markeder.includes(m)).length;
    return Math.sqrt(str) / (1 + egne);
  });
}

/** Når et marked åbner, går de tilstedeværende konkurrenter ind med et produkt pr. vertikal */
export function markedsindtog(s: GameState, rng: Rng, m: MarketId): void {
  for (const c of s.konkurrenter) {
    if (!c.tilstede || !c.markeder.includes(m)) continue;
    konkurrentIndtog(s, rng, c, m);
    c.sidsteHandling = `Gik ind i ${MARKETS[m].navn} ved åbningen.`;
  }
  r4Markedsindtog(s, rng, m);
}

/** En konkurrent lancerer ét produkt pr. vertikal i et marked, hvor den ikke har noget */
export function konkurrentIndtog(s: GameState, rng: Rng, c: Competitor, m: MarketId): void {
  for (const v of c.vertikaler) {
    if (s.produkter.some((p) => p.aktiv && p.ejer === c.id && p.markeder.includes(m) && produktVertikal(p) === v)) continue;
    lancerKonkurrentProdukt(s, rng, c, m, v);
  }
}

/** Konkurrenter med en senere startdato (Betanu 2023, Kalshee 2025, Agentix 2028) dukker op */
function nyeKonkurrenter(s: GameState, rng: Rng): void {
  for (const c of s.konkurrenter) {
    const def = DEF_BY_ID[c.id];
    if (c.tilstede || c.ejetAf || !def || def.fraUge <= 0 || s.uge !== def.fraUge) continue;
    c.tilstede = true;
    const markeder = c.markeder.filter((m) => s.markeder[m].aaben);
    for (const m of markeder) konkurrentIndtog(s, rng, c, m);
    c.sidsteHandling = `Gik ind på markedet i ${markeder.map((m) => MARKETS[m].navn).join(', ')}.`;
    nyhed(s, `Ny udfordrer: ${c.navn} går ind i ${markeder.map((m) => MARKETS[m].navn).join(', ')} med høj aggressivitet.`, 'konkurrent', c.arkivId);
    for (const m of markeder) {
      s.reaktioner.push({
        id: nyId(s, 'r'), regel: 'R4', competitorId: c.id, marked: m, startUge: s.uge, slutUge: s.uge + 6 * 13, effekt: { marketingMult: 2 },
        tekst: `${c.navn} går ind i ${MARKETS[m].navn} med dobbelt marketing.`,
      });
      taelReaktion(s, 'R4');
    }
  }
}

/** Historiske konkurrenttiltag (spec 7.5). Aflyses pænt, hvis spilleren har købt målet. */
function historiskeTiltag(s: GameState): void {
  for (const e of KONKURRENT_EVENTS) {
    if (s.uge < e.uge || s.konkurrentHistorik.includes(e.id)) continue;
    s.konkurrentHistorik.push(e.id);
    const blokeret = (e.kraever ?? []).some((id) => {
      const c = s.konkurrenter.find((x) => x.id === id);
      return !c || c.ejetAf === 'spiller' || (!c.tilstede && !c.ejetAf);
    });
    if (blokeret) {
      if (e.opkoeb) nyhed(s, `${e.tekst.replace(/\.$/, '')} — men handlen bliver aldrig til noget, fordi verden har ændret sig.`, 'konkurrent');
      continue;
    }
    if (e.flag && !s.flags.includes(e.flag)) s.flags.push(e.flag);
    if (e.presMarked) s.markeder[e.presMarked.marked].politiskPres = clamp(s.markeder[e.presMarked.marked].politiskPres + e.presMarked.pres, 0, 5);
    if (e.opkoeb) {
      const maal = s.konkurrenter.find((x) => x.id === e.opkoeb!.maal);
      if (maal) {
        maal.ejetAf = e.opkoeb.ejer;
        maal.sidsteHandling = `Købt af ${s.konkurrenter.find((x) => x.id === e.opkoeb!.ejer)?.navn ?? e.opkoeb.ejer}.`;
        if (e.opkoeb.ejerErStat) {
          maal.compliance = Math.max(maal.compliance, 4);
          r6StatsejetExit(s, maal);
        }
      }
    }
    nyhed(s, e.tekst, 'konkurrent', e.arkivId);
    signal(s, { k: 'konkurrentNyhed', tekst: e.tekst, arkivId: e.arkivId });
  }
}

/** Årlig BSI for en konkurrent (alle markeder) */
export function konkurrentAarligBsi(s: GameState, c: Competitor): number {
  return s.produkter.filter((p) => p.aktiv && p.ejer === c.id).reduce((a, p) => a + Object.values(p.bsiPrUge).reduce((x, y) => x + (y ?? 0), 0), 0) * 52;
}

export function opkoebStatus(s: GameState, c: Competitor): { ok: boolean; grund?: string; pris: number } {
  const pris = Math.round(Math.max(2, 3 * konkurrentAarligBsi(s, c)) * 10) / 10;
  if (!c.tilstede) return { ok: false, grund: 'Konkurrenten er ikke aktiv.', pris };
  if (c.ejetAf) return { ok: false, grund: 'Konkurrenten er allerede opkøbt.', pris };
  if (c.arketype === 'statsselskab') return { ok: false, grund: 'Statsselskaber er ikke til salg.', pris };
  if (c.arketype === 'globalGigant' || c.styrke > 3.5) return { ok: false, grund: 'For stor til at købe. I kan kun købe mindre konkurrenter.', pris };
  if (s.kapital < pris) return { ok: false, grund: `Kræver ${Math.round(pris)} mio. kr. i kassen.`, pris };
  return { ok: true, pris };
}

/** Spilleren køber en mindre konkurrent (ca. 3× årlig BSI): produkter, kunder og licenser følger med */
export function acquire(s: GameState, competitorId: string): boolean {
  const c = s.konkurrenter.find((x) => x.id === competitorId);
  if (!c) return afvis(s, 'Ukendt konkurrent.');
  const st = opkoebStatus(s, c);
  if (!st.ok) return afvis(s, st.grund ?? 'Kan ikke købe konkurrenten.');
  if (!betal(s, st.pris, `opkøbet af ${c.navn}`)) return false;
  for (const m of c.markeder) {
    const ms = s.markeder[m];
    if (!ms.aaben) continue;
    const andel = ms.andele[c.id] ?? 0;
    for (const v of c.vertikaler) {
      const N = markedsKunder(s, m, v);
      ms.spillerKunder[v] += N * andel * 0.8;
      if (ms.licens !== 'inddraget') ms.vertikaler[v] = { status: 'aktiv', klarUge: s.uge };
    }
    if (ms.licens === 'ingen' || ms.licens === 'ansoegt') ms.licens = 'aktiv';
  }
  for (const p of s.produkter) {
    if (p.ejer !== c.id || !p.aktiv) continue;
    p.ejer = 'spiller';
  }
  c.ejetAf = 'spiller';
  c.tilstede = false;
  c.sidsteHandling = `Købt af ${s.firmaNavn}.`;
  s.planlagteKopier = s.planlagteKopier.filter((k) => k.competitorId !== c.id);
  s.reaktioner = s.reaktioner.filter((r) => r.competitorId !== c.id);
  nyhed(s, `${s.firmaNavn} køber ${c.navn} for ${Math.round(st.pris)} mio. kr.`, 'firma', c.arkivId);
  signal(s, { k: 'opkoeb', competitorId: c.id, pris: st.pris });
  return true;
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

function vaelgTypeOgTema(rng: Rng, c: Competitor, aar: number, fastV?: Vertical): { typeId: ProductTypeId; themeId: ThemeId; v: Vertical } {
  const v = fastV ?? rng.pick(c.vertikaler);
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

export function lancerKonkurrentProdukt(s: GameState, rng: Rng, c: Competitor, marked: MarketId, fastV?: Vertical): LiveProduct {
  const def = DEF_BY_ID[c.id];
  const { typeId, themeId } = vaelgTypeOgTema(rng, c, aarFor(s.uge), fastV);
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
  nyhed(s, `${c.navn} lancerer ${navn}${marked !== 'dk' ? ` i ${MARKETS[marked].navn}` : ''} — ${total40}/40 hos anmelderne.`, 'konkurrent');
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
      const marked = vaelgMarked(s, rng, c);
      if (marked) lancerKonkurrentProdukt(s, rng, c, marked);
      c.naesteLanceringUge = s.uge + naesteLancering(rng, c.innovation, c.markeder.filter((m) => s.markeder[m].aaben).length);
    }
  }
  for (const m of Object.keys(s.markeder) as MarketId[]) if (s.markeder[m].aabnetUge === s.uge && s.uge > 0) markedsindtog(s, rng, m);
  nyeKonkurrenter(s, rng);
  historiskeTiltag(s);
  for (const c of s.konkurrenter) c.marketingMultiplikator = Math.max(1, ...c.markeder.map((m) => konkurrentMarketing(s, c.id, m)));
  for (const p of s.produkter) {
    if (p.ejer === 'spiller') continue;
    p.bsiPrUge = {};
    p.nyeSpillerePrUge = {};
  }

  // Indeks over aktive konkurrentprodukter pr. ejer (hurtigere end at filtrere hele listen pr. marked og vertikal)
  const aktivePrEjer = new Map<string, LiveProduct[]>();
  for (const p of s.produkter) {
    if (!p.aktiv || p.ejer === 'spiller') continue;
    const l = aktivePrEjer.get(p.ejer);
    if (l) l.push(p);
    else aktivePrEjer.set(p.ejer, [p]);
  }
  // Ryd op: pensionerede konkurrentprodukter ældre end fire år fjernes (spillerens egne bevares til tidslinjen)
  if (s.uge % 13 === 0) s.produkter = s.produkter.filter((p) => p.aktiv || p.ejer === 'spiller' || s.uge - (p.pensioneretUge ?? p.lanceretUge) < 208);

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
        const prods = (aktivePrEjer.get(c.id) ?? []).filter((p) => p.markeder.includes(m) && produktVertikal(p) === v);
        const portefoelje = prods.reduce((a, p) => a + produktVaegt(s, p), 0);
        const w = prods.length ? Math.pow(c.styrke, BALANCE.styrkeExp) * konkurrentMarketing(s, c.id, m) * (0.6 + 0.4 * Math.min(1.5, portefoelje)) : 0;
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
        const tilgang = kunderC * VERTICALS[v].churnPrUge * BALANCE.konkurrentTilgang * konkurrentMarketing(s, c.id, m);
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
  return { navn: ejer, farve: '#8a8a8a', monogram: '?' };
}
