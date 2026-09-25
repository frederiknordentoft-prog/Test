// Konkurrenternes reaktionsregler (spec 6.8, 7.6). Hver reaktion vises i nyhedstickeren med en forklaring,
// så spilleren kan lære mønstrene. Kontrolleres hvert kvartal (R3/R4/R6/R7 udløses af hændelser).
import type { AktivReaktion, Competitor, GameState, LiveProduct, MarketId, ReaktionsRegel } from './types';
import type { Rng } from './rng';
import { MARKETS } from '../data/markets';
import { CHANNELS, CHANNEL_IDS } from '../data/acquisition';
import { R1, R2, R3_FORDEL, R3_KOPI_UGER, R4, R5, R7, R8, R9, R10, R12, REAKTIONS_REGLER } from '../data/reactionRules';
import { SPONSORATER } from '../data/competitorEvents';
import { aarFor, datoTekst } from './time';
import { aendrPres, afvis, clamp, nyId, nyhed, signal } from './util';
import { effektivBonus, effektivVip, aktiverRegel, annoncer } from './regulation';
import { aarligBsi } from './economy';

export const tomReaktionsTaeller = (): Record<ReaktionsRegel, number> => ({
  R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, R6: 0, R7: 0, R8: 0, R9: 0, R10: 0, R11: 0, R12: 0,
});

export function taelReaktion(s: GameState, r: ReaktionsRegel): void {
  s.reaktionsTaeller[r] = (s.reaktionsTaeller[r] ?? 0) + 1;
}

function reager(s: GameState, r: Omit<AktivReaktion, 'id' | 'startUge'>, visSignal = true): AktivReaktion {
  const a: AktivReaktion = { ...r, id: nyId(s, 'r'), startUge: s.uge };
  s.reaktioner.push(a);
  taelReaktion(s, r.regel);
  nyhed(s, `${r.tekst} (${r.regel}: ${REAKTIONS_REGLER[r.regel].navn})`, 'konkurrent');
  if (visSignal) signal(s, { k: 'reaktion', regel: r.regel, tekst: r.tekst, competitorId: r.competitorId, marked: r.marked });
  if (r.competitorId) {
    const c = s.konkurrenter.find((x) => x.id === r.competitorId);
    if (c) c.sidsteHandling = r.tekst;
  }
  return a;
}

/** Konkurrentens marketingtryk i et marked (produkt af aktive reaktioner) */
export function konkurrentMarketing(s: GameState, competitorId: string, m: MarketId): number {
  let f = 1;
  // Verdensscenarier: AI-native-bølgen og statsselskaberne under den hårde hånd
  const c = s.konkurrenter.find((x) => x.id === competitorId);
  if (c?.arketype === 'aiNative') f *= 1 + (s.aiScenarier.aiNative ?? 0);
  if (c?.arketype === 'statsselskab' && s.flags.includes('haardHaand')) f *= 1.5;
  for (const r of s.reaktioner) {
    if (r.competitorId !== competitorId || r.effekt.marketingMult === undefined) continue;
    if (r.marked && r.marked !== m) continue;
    f *= r.effekt.marketingMult;
  }
  return f;
}

/** Tillæg på spillerens CAC i et marked fra bonuskrige (R1) */
export function spillerCacTillaeg(s: GameState, m: MarketId): number {
  return s.reaktioner.filter((r) => r.marked === m && r.effekt.cacSpiller).reduce((a, r) => a + (r.effekt.cacSpiller ?? 0), 0);
}

/** Midlertidig aggressivitet fra afviste tilbud (R2) */
export function aggressivitet(s: GameState, c: Competitor): number {
  return c.aggressivitet + s.reaktioner.filter((r) => r.competitorId === c.id && r.effekt.aggressivitet).reduce((a, r) => a + (r.effekt.aggressivitet ?? 0), 0);
}

/** Samlet fordel af spillerens unikke features (R3): +4 % pr. feature, halveret ved hver kopi, maks 15 % */
export function featureFordel(s: GameState): number {
  let sum = 0;
  for (const f of Object.values(s.featureFordele)) sum += R3_FORDEL.pr * Math.pow(0.5, f.kopier);
  return Math.min(R3_FORDEL.maks, sum);
}

/** R12: har spilleren AI-risikodetektion med høj overvågning? */
export function r12Aktiv(s: GameState): boolean {
  return s.agenter.some((a) => a.funktion === 'risiko' && a.overvaagning >= R12.overvaagning);
}

// ---------- R3: kopiering af features ----------

/** Kaldes ved spillerens lancering: nye features planlægges kopieret */
export function nyeFeatures(s: GameState, rng: Rng, p: LiveProduct): void {
  for (const f of p.features) {
    if (s.featureFordele[f]) continue;
    const konkurrentHar = s.produkter.some((x) => x.aktiv && x.ejer !== 'spiller' && x.features.includes(f) && x.markeder.some((m) => p.markeder.includes(m)));
    if (konkurrentHar) continue;
    s.featureFordele[f] = { kopier: 0, lanceretUge: s.uge };
    const kopister = s.konkurrenter
      .filter((c) => c.tilstede && !c.ejetAf && R3_KOPI_UGER[c.arketype] && c.markeder.some((m) => p.markeder.includes(m)))
      .sort((a, b) => b.innovation - a.innovation || (a.id < b.id ? -1 : 1))
      .slice(0, R3_FORDEL.maxKopister);
    for (const c of kopister) {
      const [lo, hi] = R3_KOPI_UGER[c.arketype]!;
      const marked = c.markeder.find((m) => p.markeder.includes(m))!;
      s.planlagteKopier.push({ feature: f, competitorId: c.id, marked, uge: s.uge + rng.int(lo, hi) });
    }
  }
}

function ugentligeKopier(s: GameState): void {
  const klar = s.planlagteKopier.filter((k) => s.uge >= k.uge);
  if (!klar.length) return;
  s.planlagteKopier = s.planlagteKopier.filter((k) => s.uge < k.uge);
  for (const k of klar) {
    const c = s.konkurrenter.find((x) => x.id === k.competitorId);
    const fordel = s.featureFordele[k.feature];
    if (!c || !c.tilstede || !fordel) continue;
    const prod = s.produkter.find((p) => p.aktiv && p.ejer === c.id && p.markeder.includes(k.marked));
    if (prod && !prod.features.includes(k.feature)) prod.features.push(k.feature);
    fordel.kopier += 1;
    reager(s, {
      regel: 'R3', competitorId: c.id, marked: k.marked, slutUge: s.uge, effekt: {},
      tekst: `${c.navn} kopierer jeres ${k.feature}-feature i ${MARKETS[k.marked].navn}. Fordelen halveres.`,
    }, false);
  }
}

// ---------- R4: markedsindtog ----------

export function r4Markedsindtog(s: GameState, rng: Rng, m: MarketId): void {
  for (const c of s.konkurrenter) {
    if (!c.tilstede || !c.markeder.includes(m)) continue;
    if (c.arketype !== 'globalGigant' && c.arketype !== 'appFirst') continue;
    const kvartaler = rng.int(R4.kvartaler[0], R4.kvartaler[1]);
    reager(s, {
      regel: 'R4', competitorId: c.id, marked: m, slutUge: s.uge + kvartaler * 13, effekt: { marketingMult: R4.marketing },
      tekst: `${c.navn} går ind i ${MARKETS[m].navn} med dobbelt marketing i ${kvartaler} kvartaler.`,
    }, false);
  }
}

// ---------- R6: statsejet exit fra grå markeder ----------

export function r6StatsejetExit(s: GameState, c: Competitor): void {
  reager(s, {
    regel: 'R6', competitorId: c.id, slutUge: s.uge, effekt: {},
    tekst: `${c.navn} er nu statsejet og forlader de grå markeder (Norge).`,
  }, false);
}

// ---------- R7: sponsorauktioner ----------

export function bydSponsorat(s: GameState, bud: number): boolean {
  const a = s.sponsorAuktion;
  if (!a) return afvis(s, 'Der er ingen sponsorauktion lige nu.');
  if (bud < a.mindstebud) return afvis(s, `Mindstebuddet er ${a.mindstebud.toFixed(1).replace('.', ',')} mio. kr. om året.`);
  if (bud * (a.varighedUger / 52) > s.kapital * 3 + 5) return afvis(s, 'Buddet er for stort i forhold til kassen.');
  a.spillerBud = Math.round(bud * 100) / 100;
  nyhed(s, `${s.firmaNavn} byder ${a.spillerBud.toFixed(1).replace('.', ',')} mio. kr. om året på ${a.navn}.`, 'firma');
  return true;
}

function ugentligeSponsorater(s: GameState, rng: Rng): void {
  s.sponsorater = s.sponsorater.filter((x) => x.slutUge > s.uge);
  // Nye auktioner annonceres R7.varselUger før
  for (const sp of SPONSORATER) {
    if (s.uge !== sp.uge - R7.varselUger) continue;
    s.sponsorAuktion = { id: sp.id, navn: sp.navn, marked: sp.marked, afgoeresUge: sp.uge, mindstebud: sp.mindstebud, spillerBud: null, varighedUger: sp.varighedUger };
    nyhed(s, `${sp.navn} søger ny spilsponsor. Auktionen afgøres ${datoTekst(sp.uge)}.`, 'marked');
    if (s.markeder[sp.marked].licens === 'aktiv') signal(s, { k: 'sponsorAuktion', navn: sp.navn, marked: sp.marked });
  }
  const a = s.sponsorAuktion;
  if (!a || s.uge < a.afgoeresUge) return;
  s.sponsorAuktion = null;
  const bydere = s.konkurrenter.filter((c) => c.tilstede && c.markeder.includes(a.marked) && c.arketype !== 'statsselskab');
  // appFirst byder højest (spec 7.6)
  const bedste = [...bydere].sort((x, y) => (y.arketype === 'appFirst' ? 1 : 0) - (x.arketype === 'appFirst' ? 1 : 0) || aggressivitet(s, y) - aggressivitet(s, x))[0];
  const konkBud = a.mindstebud * rng.range(R7.appFirstBud[0], R7.appFirstBud[1]) * (bedste?.arketype === 'appFirst' ? 1.15 : 1);
  const spillerVandt = a.spillerBud !== null && a.spillerBud > konkBud;
  const vinder = spillerVandt ? 'spiller' : (bedste?.id ?? 'ingen');
  s.sponsorater.push({ id: a.id, navn: a.navn, marked: a.marked, ejer: vinder, slutUge: s.uge + a.varighedUger, bud: Math.round((spillerVandt ? a.spillerBud! : konkBud) * 100) / 100 });
  const vinderNavn = spillerVandt ? s.firmaNavn : (bedste?.navn ?? 'Ingen');
  if (spillerVandt) {
    // Betaling pr. år trækkes ugentligt i økonomien via sponsorOmkostning
    nyhed(s, `${s.firmaNavn} vinder sponsoratet af ${a.navn} for ${a.spillerBud!.toFixed(1).replace('.', ',')} mio. kr. om året!`, 'firma');
  } else if (bedste) {
    bedste.sidsteHandling = `Vandt sponsoratet af ${a.navn}.`;
  }
  reager(s, {
    regel: 'R7', competitorId: spillerVandt ? undefined : bedste?.id, marked: a.marked, slutUge: s.uge + a.varighedUger, effekt: {},
    tekst: `${vinderNavn} vinder sponsoratet af ${a.navn}${spillerVandt ? '' : ` med et bud på ${konkBud.toFixed(1).replace('.', ',')} mio. kr. om året`}.`,
  }, false);
  signal(s, { k: 'sponsorResultat', navn: a.navn, marked: a.marked, vinder: vinderNavn, spillerVandt });
}

/** Spillerens sponsorater: CAC-rabat på sponsorat i markedet og løbende hype */
export function sponsorRabat(s: GameState, m: MarketId): number {
  return s.sponsorater.some((x) => x.ejer === 'spiller' && x.marked === m) ? R7.cacRabat : 0;
}

export function sponsorOmkostningPrUge(s: GameState): number {
  return s.sponsorater.filter((sp) => sp.ejer === 'spiller').reduce((a, sp) => a + sp.bud / 52, 0);
}

// ---------- Kvartalsvise regler ----------

function spillerAndel(s: GameState, m: MarketId): number {
  return s.markeder[m].andele.spiller ?? 0;
}

function aggressionsIndeks(s: GameState, m: MarketId): number {
  const aggressiveKanaler = CHANNEL_IDS.filter((k) => CHANNELS[k].aggressiv && (s.marketingMix[k] ?? 0) > 0).length;
  const hoejIntensitet = s.produkter.some((p) => p.aktiv && p.ejer === 'spiller' && p.markeder.includes(m) && p.intensitet > 3) ? 1 : 0;
  const hyper = s.hyperpersonalisering.aktiv && !r12Aktiv(s) ? 2 : 0;
  return effektivBonus(s, m) + effektivVip(s, m) + aggressiveKanaler + hoejIntensitet + hyper;
}

export function kvartalsReaktioner(s: GameState, rng: Rng): void {
  s.reaktioner = s.reaktioner.filter((r) => r.slutUge > s.uge);
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const ms = s.markeder[m];
    if (!ms.aaben) continue;
    const andel = spillerAndel(s, m);
    const hist = (s.andelHistorik[m] ??= []);
    hist.push(andel);
    if (hist.length > 5) hist.shift();
    const aarSiden = hist.length >= 5 ? hist[0] : null;

    // R1: bonuskrig
    if (andel > R1.andel && aarSiden !== null && aarSiden > 0 && andel / aarSiden - 1 > R1.vaekst && !s.reaktioner.some((r) => r.regel === 'R1' && r.marked === m)) {
      const gigant = s.konkurrenter.filter((c) => c.tilstede && c.markeder.includes(m) && c.arketype === 'globalGigant').sort((a, b) => b.styrke - a.styrke)[0];
      if (gigant) {
        reager(s, {
          regel: 'R1', competitorId: gigant.id, marked: m, slutUge: s.uge + R1.uger, effekt: { marketingMult: R1.marketing, cacSpiller: R1.cac },
          tekst: `Bonuskrig! ${gigant.navn} skruer marketingen op i ${MARKETS[m].navn}, fordi jeres andel vokser hurtigt. Jeres CAC +25 % i et år.`,
        });
      }
    }

    // R5: afgiftsstigning ≥ 5 pp
    const afgiftNu = ms.afgift * 100;
    const foer = s.afgiftHistorik[m];
    s.afgiftHistorik[m] = afgiftNu;
    if (foer !== undefined && afgiftNu - foer >= R5.afgiftPp) {
      const svagest = s.konkurrenter
        .filter((c) => c.tilstede && c.markeder.includes(m) && (c.arketype === 'globalGigant' || c.arketype === 'nordiskLicensgruppe'))
        .sort((a, b) => a.styrke - b.styrke)[0];
      if (svagest) {
        const exit = rng.chance(R5.exitChance) && svagest.markeder.length > 1;
        reager(s, {
          regel: 'R5', competitorId: svagest.id, marked: m, slutUge: s.uge + R5.uger, effekt: { marketingMult: R5.marketing },
          tekst: exit
            ? `${svagest.navn} trækker sig ud af ${MARKETS[m].navn} efter afgiftsstigningen.`
            : `${svagest.navn} skærer 30 % af marketingen i ${MARKETS[m].navn} efter afgiftsstigningen.`,
        });
        if (exit) konkurrentExit(s, svagest, m);
      }
    }

    // R8: spillerens aggressivitet
    if (ms.licens === 'aktiv') {
      const idx = aggressionsIndeks(s, m);
      s.aggressionKvartaler[m] = idx >= R8.taerskel ? (s.aggressionKvartaler[m] ?? 0) + 1 : 0;
      if ((s.aggressionKvartaler[m] ?? 0) >= R8.kvartaler) {
        s.aggressionKvartaler[m] = 0;
        const antal = (s.r8Antal[m] = (s.r8Antal[m] ?? 0) + 1);
        ms.tilsynstillid = clamp(ms.tilsynstillid - 6, 0, 100);
        if (ms.sanktion.trin === 0) ms.sanktion.trin = 1;
        if (antal % R8.reglerEfter === 0) {
          aktiverRegel(s, rng, m, rng.chance(0.5) ? 'bonusloft' : 'reklamevindue');
          s.omdoemme = clamp(s.omdoemme + R8.omdoemme, 0, 100); // spec 7.6: branchens omdømme −1
          reager(s, {
            regel: 'R8', marked: m, slutUge: s.uge, effekt: {},
            tekst: `${MARKETS[m].tilsyn} har givet ${s.firmaNavn} påbud for tredje gang. Nu strammes reglerne for hele branchen i ${MARKETS[m].navn}.`,
          });
        } else {
          reager(s, {
            regel: 'R8', marked: m, slutUge: s.uge, effekt: {},
            tekst: `${MARKETS[m].tilsyn} giver ${s.firmaNavn} påbud: bonus, VIP og reklametryk er for aggressivt (tillid −6).`,
          });
        }
      }
    }

    // R9: tilfældige medieskandaler (hyppigere, når tilliden er lav)
    const skandaleChance = (R9.chancePrAar / 4) * (ms.licens === 'aktiv' && ms.tilsynstillid < 50 ? 2 : 1);
    if (rng.chance(skandaleChance)) {
      aendrPres(s, m, 1, 'Medieskandale');
      const egen = ms.licens === 'aktiv' && ms.tilsynstillid < 50 && rng.chance(0.5);
      const syndebuk = egen ? null : rng.pick(s.konkurrenter.filter((c) => c.tilstede && c.markeder.includes(m)).concat([] as Competitor[]));
      if (egen) {
        s.omdoemme = clamp(s.omdoemme - 4, 0, 100);
        ms.tilsynstillid = clamp(ms.tilsynstillid - 3, 0, 100);
      }
      reager(s, {
        regel: 'R9', competitorId: syndebuk?.id, marked: m, slutUge: s.uge, effekt: {},
        tekst: egen
          ? `Medieskandale i ${MARKETS[m].navn}: en avis afslører, hvordan ${s.firmaNavn} behandler storspillere. Presset på politikerne stiger.`
          : `Medieskandale i ${MARKETS[m].navn}${syndebuk ? ` om ${syndebuk.navn}` : ''}. Presset på politikerne stiger.`,
      }, egen);
    }
  }

  // R10: krise → afgiftsstigning (30 %/år)
  const krise = s.trends.some((t) => (t.effekt.afgiftRisiko ?? 0) > 0);
  if (krise && aarFor(s.uge) >= 2026 && rng.chance(R10.chancePrAar / 4)) {
    const kandidater = (Object.keys(s.markeder) as MarketId[]).filter((m) => s.markeder[m].aaben && m !== 'no');
    const m = rng.pick(kandidater);
    const uge = s.uge + rng.int(26, 52);
    annoncer(s, m, 'afgiftsstigning', uge, true, rng);
    const pp = s.planlagteRegler.find((p) => p.marked === m && p.regelId === 'afgiftsstigning' && p.ikrafttraedelseUge === uge)?.pp;
    reager(s, {
      regel: 'R10', marked: m, slutUge: s.uge, effekt: {},
      tekst: `Statskassen i ${MARKETS[m].navn} er presset af krisen. Politikerne vil hæve spilafgiften med ${pp ?? '3-8'} procentpoint fra ${datoTekst(uge)}.`,
    });
  }

  // R12: ansvarlig AI giver lavere påbudsrisiko
  if (r12Aktiv(s)) taelReaktion(s, 'R12');

  // R2: opkøbstilbud
  if (!s.opkoebstilbud) {
    const egenPlatform = (['sportsbook', 'kasinoplatform', 'kontoplatform'] as const).some((k) => s.platforme[k].model === 'hybrid' || s.platforme[k].model === 'egen');
    const stoersteAndel = Math.max(0, ...(Object.keys(s.markeder) as MarketId[]).map((m) => spillerAndel(s, m)));
    if (egenPlatform && stoersteAndel > R2.andel && rng.chance(R2.chance)) {
      const marked = (Object.keys(s.markeder) as MarketId[]).sort((a, b) => spillerAndel(s, b) - spillerAndel(s, a))[0];
      const bydere = s.konkurrenter.filter((c) => c.tilstede && !c.ejetAf && c.opkoebslyst >= R2.minOpkoebslyst && c.markeder.includes(marked));
      const byder = bydere.length ? rng.pick(bydere) : null;
      if (byder) {
        const pris = Math.round(Math.max(5, aarligBsi(s)) * rng.range(R2.multipel[0], R2.multipel[1]) * 10) / 10;
        s.opkoebstilbud = { competitorId: byder.id, pris, udloeberUge: s.uge + R2.udloeb, markedsandel: stoersteAndel };
        reager(s, {
          regel: 'R2', competitorId: byder.id, marked, slutUge: s.uge, effekt: {},
          tekst: `${byder.navn} byder ${Math.round(pris)} mio. kr. for hele ${s.firmaNavn}.`,
        }, false);
        signal(s, { k: 'tilbud', competitorId: byder.id, pris });
      }
    }
  }
}

/** Afvist tilbud (eller udløbet): byderen bliver mere aggressiv i 2 år */
export function afvisTilbud(s: GameState): boolean {
  const t = s.opkoebstilbud;
  if (!t) return afvis(s, 'Der er intet tilbud at afvise.');
  s.opkoebstilbud = null;
  const c = s.konkurrenter.find((x) => x.id === t.competitorId);
  if (c) {
    s.reaktioner.push({
      id: nyId(s, 'r'), regel: 'R2', competitorId: c.id, startUge: s.uge, slutUge: s.uge + R2.uger, effekt: { aggressivitet: R2.aggressivitet },
      tekst: `${c.navn} tog afslaget ilde og bliver mere aggressiv i to år.`,
    });
    c.sidsteHandling = `Fik afslag på sit bud på ${s.firmaNavn}.`;
    nyhed(s, `${s.firmaNavn} siger nej tak til ${c.navn}s bud. ${c.navn} bliver mere aggressiv i to år.`, 'konkurrent');
  }
  return true;
}

export function ugentligeReaktioner(s: GameState, rng: Rng): void {
  ugentligeKopier(s);
  ugentligeSponsorater(s, rng);
  if (s.opkoebstilbud && s.uge >= s.opkoebstilbud.udloeberUge) afvisTilbud(s);
}

/** En konkurrent forlader et marked: produkterne dér lukkes (også dem på hitlisten) */
export function konkurrentExit(s: GameState, c: Competitor, m: MarketId): void {
  c.markeder = c.markeder.filter((x) => x !== m);
  for (const p of s.produkter) {
    if (p.ejer !== c.id || !p.markeder.includes(m)) continue;
    p.markeder = p.markeder.filter((x) => x !== m);
    if (p.markeder.length === 0) {
      p.aktiv = false;
      p.pensioneretUge = s.uge;
      p.bsiPrUge = {};
    }
  }
  if (c.markeder.length === 0) c.tilstede = false;
}
