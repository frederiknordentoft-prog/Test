// Offshore-modellen (spec 6.10, 7.8) og offshore-fristelsen.
import type { GameState, MarketId, Vertical } from './types';
import type { Rng } from './rng';
import { MARKETS } from '../data/markets';
import { MARKET_CURVES } from '../data/marketCurves';
import { OFFSHORE_FORMEL as F, OFFSHORE_BASIS, OFFSHORE_AFGIFT_OVERRIDE, SELVUDELUKKEDE, START_BLOKERING, GRAA_MARKED, OFFSHORE_BRAND } from '../data/offshore';
import { HISTORISKE_REGLER, REGLER, DYNAMISK_PULJE } from '../data/regulationTimeline';
import { PRODUCT_TYPES } from '../data/productTypes';
import { aarDecimal, kurve, trin } from './time';
import { afvis, betal, clamp, nyhed, saetFlag, signal } from './util';
import { trendEffekt } from './trends';
import { inddragLicens } from './trust';

const DYNAMISKE = new Set([...DYNAMISK_PULJE.map((d) => d.regelId), 'dnsBlokering', 'betalingsblokering', 'lempelse', 'reklameforbud', 'afgiftsdifferentiering', 'afgiftssaenkning', 'euHarmonisering']);

export function erDynamiskRegel(id: string): boolean {
  return DYNAMISKE.has(id);
}

/** Referenceofffshore: kun historiske data (skatter, strenghed, faste regler, blokering), kvalitet 0,6 — en ren funktion af uge */
export function offshoreRefPp(m: MarketId, uge: number): number {
  const def = MARKETS[m];
  const aar = aarDecimal(uge);
  const afgift = OFFSHORE_AFGIFT_OVERRIDE[m] ?? ((trin(def.afgift.betting, uge) + trin(def.afgift.kasino, uge)) / 2) * 100;
  const strenghed = trin(def.strenghed, uge);
  const aktive = HISTORISKE_REGLER.filter((h) => h.marked === m && uge >= h.uge).map((h) => REGLER[h.regelId]);
  const bonusloft = aktive.some((r) => r.effekt.bonusMax !== undefined && r.effekt.bonusMax <= 1) ? 1 : 0;
  const regelPp = aktive.reduce((a, r) => a + (r.effekt.offshorePp ?? 0), 0);
  const sb = START_BLOKERING[m];
  let blok = 0;
  const dnsHist = HISTORISKE_REGLER.find((h) => h.marked === m && REGLER[h.regelId].effekt.blokering === 'dns');
  const dnsUge = sb?.dns ?? dnsHist?.uge;
  if (dnsUge !== undefined && uge >= dnsUge) blok += uge - dnsUge >= 104 ? F.dns / 2 : F.dns;
  if (sb?.betaling !== undefined && uge >= sb.betaling) blok += F.betaling;
  if (sb?.leverandoer) blok += F.leverandoer;
  const selv = SELVUDELUKKEDE[m] ? kurve(SELVUDELUKKEDE[m]!, aar) : 0;
  return (
    kurve(OFFSHORE_BASIS[m], aar) +
    F.afgift * (afgift - 20) +
    F.strenghed * (strenghed - 2) +
    F.bonusloft * bonusloft +
    F.selvudelukkede * selv -
    blok -
    F.kvalitet * (0.6 - 0.5) +
    regelPp
  );
}

/** Bedste licenserede produkts kvalitet i markedet (0..1) */
export function licenseretKvalitet(s: GameState, m: MarketId): number {
  let best = 0.5;
  for (const p of s.produkter) if (p.aktiv && p.markeder.includes(m) && p.kvalitet > best) best = p.kvalitet;
  return best;
}

/** Dynamisk offshore (pp) med spillerens og konkurrenternes kvalitet, dynamiske regler, blokering og trends */
export function offshoreDynPp(s: GameState, m: MarketId): number {
  const ms = s.markeder[m];
  const aar = aarDecimal(s.uge);
  const afgift = OFFSHORE_AFGIFT_OVERRIDE[m] ?? ((ms.afgiftPrVertikal.betting + ms.afgiftPrVertikal.kasino) / 2) * 100 + ms.afgiftTillaeg;
  const regler = ms.regler.map((id) => REGLER[id]).filter(Boolean);
  const bonusloft = regler.some((r) => r.effekt.bonusMax !== undefined && r.effekt.bonusMax <= 1) ? 1 : 0;
  const regelPp = regler.reduce((a, r) => a + (r.effekt.offshorePp ?? 0), 0);
  let blok = 0;
  if (ms.blokering.dns !== null && s.uge >= ms.blokering.dns) blok += s.uge - ms.blokering.dns >= 104 ? F.dns / 2 : F.dns;
  if (ms.blokering.betaling !== null && s.uge >= ms.blokering.betaling) blok += F.betaling;
  if (ms.blokering.leverandoer) blok += F.leverandoer;
  return (
    kurve(OFFSHORE_BASIS[m], aar) +
    F.afgift * (afgift - 20) +
    F.strenghed * (ms.strenghed - 2) +
    F.bonusloft * bonusloft +
    F.selvudelukkede * ms.selvudelukkede -
    blok -
    F.kvalitet * (licenseretKvalitet(s, m) - 0.5) +
    regelPp
  );
}

/** Trends (krypto, streamere, sweeps) lægges direkte på andelene i procentpoint (spec 7.8) */
export function offshoreTrendPp(s: GameState, m: MarketId): number {
  return trendEffekt(s, m).offshorePp;
}

export function offshoreAndele(pp: number, trendPp = 0): Record<Vertical, number> {
  return {
    kasino: clamp(pp * F.kasino + trendPp, F.min, F.max) / 100,
    betting: clamp(pp * F.betting + trendPp, F.min, F.max) / 100,
  };
}

/** Markedets samlede online-BSI (licenseret + offshore) pr. uge, før trends og hold-varians */
export function markedTotalBsi(m: MarketId, v: Vertical, uge: number): number {
  const punkter = MARKET_CURVES[m][v];
  const aar = aarDecimal(uge);
  if (punkter.length === 0 || aar < punkter[0][0]) return 0;
  const licenseret = (kurve(punkter, aar) * 1000) / 52;
  const ref = offshoreAndele(offshoreRefPp(m, uge))[v];
  return licenseret / (1 - ref);
}

// ---------- Verdensscenarier: markedsstørrelse og Norges åbning (fase 5) ----------

const NORDISKE: MarketId[] = ['dk', 'se', 'fi'];

/** Faktor på markedets samlede BSI: legale markeder vokser 6,5 %/år under kanaliseringens tilbagetog; Norden −13 % under den hårde hånd */
export function scenarieMarkedsFaktor(s: GameState, m: MarketId, uge = s.uge): number {
  let f = 1;
  const tilbagetog = (s.verdensscenarier.kanaliseringensTilbagetog ?? 0) > 0;
  const fra = 780; // uge 0 i 2027
  if (tilbagetog && m !== 'no' && uge > fra) f *= Math.pow(1.065, (uge - fra) / 52);
  if (s.flags.includes('haardHaand') && NORDISKE.includes(m)) f *= 0.87;
  return f;
}

/** Norge åbner kun i scenariet "Norge åbner" (25 %) */
export function norgeAaben(s: GameState, uge = s.uge): boolean {
  const u = s.verdensVurderinger?.norgeAabner;
  return u !== undefined && uge >= u;
}

/** Norge efter åbningen: offshore-andelen falder fra 100 % til ca. 35 % over to år */
export function norgeOffshore(s: GameState): number {
  const u = s.verdensVurderinger.norgeAabner ?? s.uge;
  return 1 - 0.65 * clamp((s.uge - u) / 104, 0, 1);
}

/** Markedets samlede online-BSI pr. uge i denne verden (før trends og hold) */
export function markedStoerrelse(s: GameState, m: MarketId, v: Vertical): number {
  if (m === 'no') {
    const g = GRAA_MARKED.no;
    return norgeAaben(s) && g ? (kurve(g[v], aarDecimal(s.uge)) * 1000) / 52 : 0;
  }
  return markedTotalBsi(m, v, s.uge) * scenarieMarkedsFaktor(s, m);
}

// ---------- Offshore-fristelsen (spec 6.10) ----------

export function setOffshoreBrand(s: GameState, aktiv: boolean): boolean {
  if (aktiv === s.offshoreBrand) return true;
  if (aktiv) {
    if (!s.produkter.some((p) => p.ejer === 'spiller')) return afvis(s, 'Et offshore-brand kræver mindst ét lanceret produkt at kopiere.');
    if (!betal(s, OFFSHORE_BRAND.opstart, 'opstarten af offshore-brandet')) return false;
    s.offshoreBrand = true;
    s.offshoreBrandStartUge = s.uge;
    saetFlag(s, 'haftOffshoreBrand');
    nyhed(s, `Et nyt kryptokasino med licens fra Curaçao dukker op. Rygterne peger på ${s.firmaNavn}.`, 'marked');
  } else {
    s.offshoreBrand = false;
    s.offshoreBrandStartUge = null;
    for (const m of Object.keys(s.markeder) as MarketId[]) s.markeder[m].offshoreBrandBsiPrUge = 0;
    nyhed(s, `${s.firmaNavn} lukker sit offshore-brand.`, 'firma');
  }
  return true;
}

/** Ugentlig grå BSI og risiko for at blive afsløret. Returnerer samlet BSI. */
export function ugentligtOffshoreBrand(s: GameState, rng: Rng): number {
  let sum = 0;
  for (const m of Object.keys(s.markeder) as MarketId[]) s.markeder[m].offshoreBrandBsiPrUge = 0;
  if (!s.offshoreBrand) return 0;
  const egne = s.produkter.filter((p) => p.ejer === 'spiller' && p.aktiv);
  const kvalitet = egne.length ? Math.max(...egne.map((p) => p.kvalitet)) : 0.3;
  const harKasino = egne.some((p) => PRODUCT_TYPES[p.typeId].vertikal === 'kasino');
  const harBetting = egne.some((p) => PRODUCT_TYPES[p.typeId].vertikal === 'betting');
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const ms = s.markeder[m];
    let b = 0;
    const graa = GRAA_MARKED[m];
    if (graa) {
      const aar = aarDecimal(s.uge);
      // Når Norge åbner, skrumper det grå marked med offshore-andelen
      const rest = m === 'no' && norgeAaben(s) ? norgeOffshore(s) : 1;
      if (harKasino) b += ((kurve(graa.kasino, aar) * 1000) / 52) * OFFSHORE_BRAND.andelGraa * (0.5 + kvalitet) * rest;
      if (harBetting) b += ((kurve(graa.betting, aar) * 1000) / 52) * OFFSHORE_BRAND.andelGraa * (0.5 + kvalitet) * rest;
    } else if (ms.aaben) {
      if (harKasino) b += ms.markedsBsiPrUge.kasino * ms.offshore.kasino * OFFSHORE_BRAND.andel * (0.5 + kvalitet);
      if (harBetting) b += ms.markedsBsiPrUge.betting * ms.offshore.betting * OFFSHORE_BRAND.andel * (0.5 + kvalitet);
    }
    ms.offshoreBrandBsiPrUge = b;
    sum += b;
  }
  // 10 % risiko pr. år for licenstab i alle regulerede markeder
  if (rng.chance(OFFSHORE_BRAND.tabRisikoPrAar / 52)) {
    for (const m of Object.keys(s.markeder) as MarketId[]) {
      const st = s.markeder[m].licens;
      if (st === 'aktiv' || st === 'suspenderet' || st === 'ansoegt') inddragLicens(s, m, 'Forbindelsen til et offshore-brand er afsløret.');
    }
    s.offshoreBrand = false;
    s.offshoreBrandStartUge = null;
    s.ventendeEvents.push({ eventId: 'offshoreAfsloeret', uge: s.uge, ctx: {} });
    signal(s, { k: 'event', eventId: 'offshoreAfsloeret' });
  }
  return sum;
}
