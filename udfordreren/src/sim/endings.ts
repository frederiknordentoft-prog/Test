// Slutninger, eftermæle, tidslinje, eftertanke og Arkivet (spec 6.17, 6.18).
import type { GameState, MarketId, Signal } from './types';
import type { Rng } from './rng';
import { SLUTNINGER, SLUT_KRAV, EFTERMAELE, type SlutId } from '../data/endings';
import { ARKIV_MARKED, EFTERTANKE, arkivId } from '../data/archive';
import { MARKETS } from '../data/markets';
import { PRODUCT_TYPES } from '../data/productTypes';
import { RESEARCH_BY_ID } from '../data/research';
import { aarFor, datoTekst } from './time';
import { clamp, nyhed, signal, tidslinje } from './util';
import { vaerdiansaettelse } from './investors';
import { byTal, risikoAndel } from './town';
import { aarligBsi } from './economy';

// ---------- Arkivet ----------

export function laasOpArkiv(s: GameState, id: string | undefined): void {
  const a = arkivId(id);
  if (a && !s.arkiv.includes(a)) s.arkiv.push(a);
}

/** Kvartalsvis: åbne markeder og konkurrenter, spilleren møder, låser opslag op */
export function kvartalsArkiv(s: GameState): void {
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const ms = s.markeder[m];
    if (!ms.aaben) continue;
    laasOpArkiv(s, ARKIV_MARKED[m]);
    if (ms.licens !== 'aktiv') continue;
    for (const c of s.konkurrenter) if (c.markeder.includes(m) && (c.tilstede || c.ejetAf)) laasOpArkiv(s, c.arkivId);
  }
}

// ---------- Eftermæle ----------

/** Ugentlige akkumulatorer til eftermælet og byens årlige udvikling */
export function ugentligEftermaele(s: GameState): void {
  const e = s.eftermaeleAkk;
  const aktive = (Object.keys(s.markeder) as MarketId[]).filter((m) => s.markeder[m].licens === 'aktiv' || s.markeder[m].licens === 'suspenderet');
  if (aktive.length) {
    e.tillidSum += aktive.reduce((a, m) => a + s.markeder[m].tilsynstillid, 0) / aktive.length;
    e.tillidUger += 1;
  }
  for (const m of aktive) e.maxSanktion = Math.max(e.maxSanktion, s.markeder[m].sanktion.trin);
  if (s.markeder.dk.licens === 'inddraget') e.dkTabt = true;
  if (s.uge % 4 === 0 && byTal(s).aktive >= 20) {
    e.risikoSum += risikoAndel(s) ?? 0;
    e.risikoProever += 1;
  }
  if (s.uge % 52 === 51) {
    const t = byTal(s);
    const n = Math.max(1, t.aktive);
    s.byAarlig.push({ aar: aarFor(s.uge), rekreativ: t.rekreativ / n, engageret: t.engageret / n, vip: t.vip / n, risiko: t.risiko / n, problem: t.problem / n });
  }
}

export type EftermaeleDel = { navn: string; point: number; maks: number; forklaring: string };

export function eftermaele(s: GameState): { total: number; dele: EftermaeleDel[] } {
  const e = s.eftermaeleAkk;
  const tillid = e.tillidUger ? e.tillidSum / e.tillidUger : 0;
  const risiko = e.risikoProever ? e.risikoSum / e.risikoProever : 0.09;
  const egne = s.produkter.filter((p) => p.ejer === 'spiller');
  const guld = egne.filter((p) => p.guldkupon).length;
  const hof = egne.filter((p) => p.hallOfFame).length;
  const galla = s.galla.reduce((a, g) => a + g.vundet.length, 0);
  const kombinationer = Object.values(s.kombinationsbog).filter((k) => k.set).length;
  const features = s.forskning.ulaast.filter((id) => RESEARCH_BY_ID[id]?.feature).length;
  const licenser = (Object.keys(s.markeder) as MarketId[]).filter((m) => s.markeder[m].licens === 'aktiv').length;
  const licensPoint = clamp(
    EFTERMAELE.licens - (s.flags.includes('haftOffshoreBrand') ? 6 : 0) - 2 * e.maxSanktion - (e.dkTabt ? 8 : 0) + Math.min(3, licenser - 1),
    0,
    EFTERMAELE.licens,
  );
  const dele: EftermaeleDel[] = [
    { navn: 'Tilsynstillid', point: EFTERMAELE.tillid * clamp((tillid - 50) / 45, 0, 1), maks: EFTERMAELE.tillid, forklaring: `Gennemsnit ${Math.round(tillid)}` },
    { navn: 'Byens sundhed', point: EFTERMAELE.by * clamp((0.16 - risiko) / 0.14, 0, 1), maks: EFTERMAELE.by, forklaring: `${Math.round(risiko * 100)} % i risiko eller problem i snit` },
    { navn: 'Guldkuponer og Hall of Fame', point: Math.min(EFTERMAELE.guld, guld + 2 * hof), maks: EFTERMAELE.guld, forklaring: `${guld} Guldkuponer, ${hof} i Hall of Fame` },
    { navn: 'Gallapriser', point: Math.min(EFTERMAELE.galla, galla), maks: EFTERMAELE.galla, forklaring: `${galla} priser` },
    { navn: 'Innovation', point: Math.min(EFTERMAELE.innovation, 0.15 * kombinationer + 0.3 * features), maks: EFTERMAELE.innovation, forklaring: `${kombinationer} kombinationer, ${features} features` },
    { navn: 'Licenseret status', point: licensPoint, maks: EFTERMAELE.licens, forklaring: `${licenser} aktive licenser${s.flags.includes('haftOffshoreBrand') ? ', offshore-brand' : ''}${e.maxSanktion ? `, højeste sanktion trin ${e.maxSanktion}` : ''}` },
  ];
  for (const d of dele) d.point = Math.round(d.point * 10) / 10;
  return { total: Math.round(dele.reduce((a, d) => a + d.point, 0) * 10) / 10, dele };
}

// ---------- Slutninger ----------

export function afslut(s: GameState, id: SlutId, vaerdi?: number): void {
  if (s.slut) return;
  const v = vaerdi ?? (id === 'konkurs' || id === 'tabtLicens' ? 0 : vaerdiansaettelse(s));
  const em = eftermaele(s).total;
  s.slut = { id, vaerdi: Math.round(v * 10) / 10, eftermaele: em, stifterVaerdi: Math.round(v * s.investorer.ejerandelStiftere * 10) / 10, uge: s.uge };
  tidslinje(s, `Slutningen: ${SLUTNINGER[id].titel}.`, 'firma');
  signal(s, { k: 'slut', id });
}

/** Ved spillets afslutning (uge 1247): hvilken slutning passer bedst? */
export function klassificer(s: GameState): SlutId {
  if (!baerendeLicens(s)) return 'tabtLicens';
  const e = s.eftermaeleAkk;
  const risiko = e.risikoProever ? e.risikoSum / e.risikoProever : 0.09;
  const em = eftermaele(s).total;
  // Det, der definerer firmaet mest: en agentflåde, B2B-forretningen, ansvarligheden — ellers størrelsen
  const agenter = s.agenter.length;
  if (agenter >= SLUT_KRAV.aiAgenter && agenter / (agenter + s.staff.length) >= SLUT_KRAV.aiAndel) return 'aiNativeLeder';
  if (s.platforme.sportsbook.b2bKunder + s.platforme.kasinoplatform.b2bKunder >= SLUT_KRAV.leverandoerKunder) return 'leverandoer';
  if (em >= SLUT_KRAV.ansvarligEftermaele && risiko <= SLUT_KRAV.ansvarligRisiko && !s.flags.includes('haftOffshoreBrand')) return 'ansvarligUdfordrer';
  if (vaerdiansaettelse(s) >= SLUT_KRAV.boersVaerdi) return 'boersnotering';
  return 'danskeLykke';
}

/** Har spilleren en licens, der bærer firmaet? (dansk licens eller et andet aktivt marked med kunder) */
export function baerendeLicens(s: GameState): boolean {
  if (s.markeder.dk.licens === 'aktiv' || s.markeder.dk.licens === 'suspenderet') return true;
  return (Object.keys(s.markeder) as MarketId[]).some((m) => m !== 'dk' && s.markeder[m].licens === 'aktiv' && s.markeder[m].spillerKunder.betting + s.markeder[m].spillerKunder.kasino >= 1000);
}

/** Ugentligt: en inddraget licens uden andre bærende markeder slutter spillet */
export function ugentligSlut(s: GameState): void {
  if (s.slut) return;
  const inddraget = (Object.keys(s.markeder) as MarketId[]).some((m) => s.markeder[m].licens === 'inddraget');
  if (inddraget && !baerendeLicens(s)) afslut(s, 'tabtLicens');
}

/** Kvartalsvis: Danske Lykke byder på en mindre udfordrer (statsselskabet køber, fakta a3) */
export function kvartalsSlut(s: GameState, rng: Rng): void {
  if (s.slut || s.opkoebstilbud || aarFor(s.uge) < 2016) return;
  const dl = s.konkurrenter.find((c) => c.id === 'danskeLykke');
  if (!dl || !dl.tilstede || s.markeder.dk.licens !== 'aktiv') return;
  const andel = s.markeder.dk.andele.spiller ?? 0;
  const [lo, hi] = SLUT_KRAV.danskeLykkeAndel;
  if (andel < lo || andel > hi || !rng.chance(SLUT_KRAV.danskeLykkeChance)) return;
  const pris = Math.round(Math.max(5, aarligBsi(s)) * rng.range(SLUT_KRAV.danskeLykkeMultipel[0], SLUT_KRAV.danskeLykkeMultipel[1]) * 10) / 10;
  s.opkoebstilbud = { competitorId: dl.id, pris, udloeberUge: s.uge + 8, markedsandel: andel };
  nyhed(s, `${dl.navn} byder ${Math.round(pris)} mio. kr. for ${s.firmaNavn}. Statsselskabet vil have udfordreren ind i folden.`, 'konkurrent', dl.arkivId);
  signal(s, { k: 'tilbud', competitorId: dl.id, pris });
}

// ---------- Tidslinje ----------

export { tidslinje };

/** Registrér ugens vigtige øjeblikke fra signalerne */
export function registrerTidslinje(s: GameState, signaler: Signal[] = s.signaler): void {
  for (const sig of signaler) {
    switch (sig.k) {
      case 'anmeldelse': {
        const p = s.produkter.find((x) => x.id === sig.productId);
        if (p) tidslinje(s, `${p.navn} (${PRODUCT_TYPES[p.typeId].navn}) lanceret: ${p.total40}/40.`, 'produkt');
        if (p?.typeId === 'betBuilder') laasOpArkiv(s, 'a18');
        break;
      }
      case 'guldkupon': { const p = s.produkter.find((x) => x.id === sig.productId); if (p) tidslinje(s, `Guldkupon til ${p.navn}!`, 'pris'); break; }
      case 'hallOfFame': { const p = s.produkter.find((x) => x.id === sig.productId); if (p) tidslinje(s, `${p.navn} kommer i Hall of Fame!`, 'pris'); break; }
      case 'nr1': { const p = s.produkter.find((x) => x.id === sig.productId); if (p) tidslinje(s, `${p.navn} er nr. 1 i ${MARKETS[sig.marked].navn}.`, 'pris'); break; }
      case 'licens': tidslinje(s, `Licens i ${MARKETS[sig.marked].navn} (${sig.vertikal}).`, 'marked'); break;
      case 'runde': tidslinje(s, `Finansieringsrunde: ${sig.kapital} mio. kr.`, 'firma'); break;
      case 'kontor': tidslinje(s, `Nyt kontor: ${sig.tier}.`, 'firma'); break;
      case 'galla': if (sig.vundet.length) tidslinje(s, `Branchegallaen ${sig.aar}: ${sig.vundet.length} ${sig.vundet.length === 1 ? 'pris' : 'priser'}.`, 'pris'); break;
      case 'sanktion': tidslinje(s, `Sanktion i ${MARKETS[sig.marked].navn} (trin ${sig.trin}).`, 'krise'); break;
      case 'aktSkift': tidslinje(s, 'AI-laboratoriet åbner. Verdensbilledet 2026 er trukket.', 'ai'); break;
      case 'aiScenarie': tidslinje(s, `${sig.titel} tager fart.`, 'ai'); break;
      case 'verdensNyhed': tidslinje(s, sig.titel, 'verden'); break;
      case 'transformation': tidslinje(s, `${sig.erstattet} stillinger overtaget af agenter.`, 'ai'); break;
      case 'agent': if (sig.handling === 'ny' && s.agenter.length === 1) tidslinje(s, 'Den første AI-agent er i drift.', 'ai'); break;
      case 'opkoeb': { const c = s.konkurrenter.find((x) => x.id === sig.competitorId); tidslinje(s, `I købte ${c?.navn ?? 'en konkurrent'}.`, 'firma'); break; }
      case 'platform': if (sig.faerdig) tidslinje(s, `Platformen kører nu på ${sig.model}.`, 'firma'); break;
      case 'markedAabner': laasOpArkiv(s, ARKIV_MARKED[sig.marked]); break;
      case 'konkurrentNyhed': laasOpArkiv(s, sig.arkivId); break;
      default: break;
    }
  }
}

// ---------- Eftertanke ----------

/** Tre nysgerrige kort om, hvor jeres vej afveg fra den virkelige (spec 6.17) */
export function eftertanke(s: GameState): { id: string; titel: string; tekst: string; arkivId: string }[] {
  const e = s.eftermaeleAkk;
  const risiko = e.risikoProever ? e.risikoSum / e.risikoProever : 0.09;
  const dkNr1 = s.milepaele.foersteNr1Dk !== undefined;
  const betingelser: Record<string, number> = {
    overhaledeStat: dkNr1 ? 9 : 0,
    koebteUnibit: s.konkurrenter.find((c) => c.id === 'unibit')?.ejetAf === 'spiller' ? 10 : 0,
    vandtLiga: s.sponsorater.some((x) => x.ejer === 'spiller' && x.marked === 'dk') || s.reaktioner.some((r) => r.regel === 'R7' && !r.competitorId) ? 8 : 0,
    egenPlatform: (['kontoplatform', 'sportsbook', 'kasinoplatform'] as const).some((k) => s.platforme[k].model === 'egen') ? 7 : 0,
    offshore: s.flags.includes('haftOffshoreBrand') ? 8 : 0,
    byRoed: risiko > 0.12 || s.flags.includes('byRoed') ? 7 : 0,
    byGroen: risiko < 0.05 && !s.flags.includes('byRoed') ? 5 : 0,
    norgeAabnede: s.markeder.no.aaben ? 9 : 0,
    hoejesteret: s.flags.includes('boerslicensMulig') ? 8 : 0,
    usaStor: (s.markeder.us.andele.spiller ?? 0) > 0.08 ? 7 : 0,
    hollandAfgift: s.markeder.nl.afgiftTillaeg > 0 && s.markeder.nl.licens === 'aktiv' ? 6 : 0,
    ontario: s.markeder.on.licens === 'aktiv' ? 3 : 0,
    sverige: s.markeder.se.licens === 'aktiv' ? 3 : 0,
    kombispil: s.produkter.some((p) => p.ejer === 'spiller' && p.typeId === 'betBuilder') ? 2 : 0,
    opkoebt: s.slut?.id === 'exit' || s.slut?.id === 'danskeLykke' ? 6 : 0,
    danmarkStart: 1,
  };
  return EFTERTANKE.filter((k) => (betingelser[k.id] ?? 0) > 0)
    .sort((a, b) => (betingelser[b.id] ?? 0) - (betingelser[a.id] ?? 0) || (a.id < b.id ? -1 : 1))
    .slice(0, 3);
}

export function slutTekst(id: string): { titel: string; tekst: string; tone: string } {
  return SLUTNINGER[id as SlutId] ?? { titel: id, tekst: '', tone: 'blandet' };
}

export function slutDato(s: GameState): string {
  return datoTekst(s.slut?.uge ?? s.uge);
}
