// Tilsynstillid (spec 6.9 og 7.12). Fase 1-2: kvartalsvis drift; sanktionstrappen kommer i fase 3.
import type { GameState, MarketId } from './types';
import { TRUST } from '../data/trust';
import { CHANNELS, CHANNEL_IDS } from '../data/acquisition';
import { clamp, nyhed, signal } from './util';
import type { Rng } from './rng';
import { MARKETS } from '../data/markets';
import { forskningsEffekt } from './insight';
import { passiveEffekter } from './staff';
import { byTillid, risikoAndel } from './town';
import { agentEffekt } from './agents';
import { regelEffekt, effektivBonus, effektivVip } from './regulation';
import { AI_EFFEKT } from '../data/ai';

export type TillidsPost = { tekst: string; vaerdi: number };

/** Kvartalets tillidsposter for et marked — synlige, så spilleren kan se hvorfor */
export function tillidsPoster(s: GameState, m: MarketId): TillidsPost[] {
  const ms = s.markeder[m];
  const poster: TillidsPost[] = [];
  // Spec 7.12's tal er effekten ved fuldt niveau (3); lavere niveauer koster forholdsmæssigt.
  // Tilsynet ser mest på de store: adfærdsposterne vejer 30 % for en lille udbyder og fuldt ved 5 % markedsandel [D]
  const synlighed = TRUST.synlighedMin + (1 - TRUST.synlighedMin) * clamp((ms.andele.spiller ?? 0) / TRUST.synlighedAndel, 0, 1);
  const vaegt = (v: number) => Math.round(v * synlighed * 10) / 10;
  const bonus = effektivBonus(s, m);
  const vip = effektivVip(s, m);
  if (bonus > 0) poster.push({ tekst: `Bonusniveau ${bonus}`, vaerdi: vaegt((TRUST.bonusNiveau * bonus) / 3) });
  if (vip > 0) poster.push({ tekst: `VIP-program ${vip}`, vaerdi: vaegt((TRUST.vipProgram * vip) / 3) });
  const hoejIntensitet = s.produkter.some((p) => p.aktiv && p.ejer === 'spiller' && p.markeder.includes(m) && p.intensitet > 3);
  if (hoejIntensitet) poster.push({ tekst: 'Produkter med intensitet over 3', vaerdi: vaegt(TRUST.intensitetOver3) });
  const aggressiv = CHANNEL_IDS.some((k) => CHANNELS[k].aggressiv && (s.marketingMix[k] ?? 0) > 0);
  if (aggressiv) poster.push({ tekst: 'Aggressive kanaler (tv/streamere)', vaerdi: vaegt(TRUST.aggressivKanal) });
  const comp = passiveEffekter(s).compliance;
  if (comp > 0) poster.push({ tekst: `Compliance-medarbejdere (${comp})`, vaerdi: Math.min(3, TRUST.complianceNiveau * comp) });
  const eff = forskningsEffekt(s);
  if (eff.ansvarNoder > 0) poster.push({ tekst: 'Ansvarsforskning', vaerdi: Math.min(2, eff.tillid) });
  if (s.offshoreBrand) poster.push({ tekst: 'Offshore-brand', vaerdi: TRUST.offshoreBrand });
  // Spillerbyen: kunder i risiko og problem (spec 7.12)
  const by = byTillid(s, m);
  if (by < 0) poster.push({ tekst: `Kunder i risiko eller problem (${Math.round((risikoAndel(s, m) ?? 0) * 100)} %)`, vaerdi: Math.round(by * 10) / 10 });
  // AI-akten
  if (s.agenter.length) {
    const ae = agentEffekt(s);
    if (ae.risikoOk) poster.push({ tekst: 'AI-risikodetektion med overvågning', vaerdi: TRUST.aiRisikoMedOvervaagning });
    if (ae.tillidPrKvartal > 0) poster.push({ tekst: 'Compliance-agenter', vaerdi: Math.round(ae.tillidPrKvartal * 10) / 10 });
  }
  if (s.hyperpersonalisering.aktiv && !agentEffekt(s).risikoOk) poster.push({ tekst: 'Hyperpersonalisering uden AI-risikodetektion', vaerdi: vaegt(TRUST.hyperUdenRisiko) });
  if (regelEffekt(s, m).kraeverRisikoAgent && !agentEffekt(s).risikoOk) poster.push({ tekst: 'AI-risikokrav ikke opfyldt', vaerdi: AI_EFFEKT.ansvarligAiTillid });
  const sum = poster.reduce((a, p) => a + p.vaerdi, 0);
  // Tilsynet ser frisk på jer hvert kvartal: tilliden trækkes en tiendedel tilbage mod 70 [D]
  const regression = Math.round(-TRUST.genopretning * (ms.tilsynstillid - TRUST.start) * 10) / 10;
  if (regression !== 0) poster.push({ tekst: regression > 0 ? 'Tilsynet giver jer en ny chance' : 'Tilsynet ser frisk på jer', vaerdi: regression });
  void sum;
  return poster;
}

export function kvartalsTillid(s: GameState): void {
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const ms = s.markeder[m];
    if (ms.licens !== 'aktiv') continue;
    const delta = tillidsPoster(s, m).reduce((a, p) => a + p.vaerdi, 0);
    ms.tilsynstillid = clamp(ms.tilsynstillid + delta, 0, 100);
  }
}

// ---------- Sanktionstrappe (spec 6.9 og 7.12): påbud → bøde → gennemgang → inddragelse ----------

export const SANKTION_NAVN = ['Ingen', 'Påbud', 'Bøde', 'Gennemgang', 'Inddragelse'] as const;
/** Grænser for næste trin (tillid under grænsen) */
export function sanktionsGraense(trin: 1 | 2 | 3 | 4): number {
  const t = TRUST.sanktioner;
  return trin === 1 ? t.paabud : trin === 2 ? t.boede : trin === 3 ? t.gennemgang : t.inddragelse;
}

/** Sandsynlighed pr. kvartal for at gå et trin op, når tilliden er under grænsen [D] (AI-risikodetektion halverer, fase 5) */
export const SANKTION_RISIKO = 0.6;

export function inddragLicens(s: GameState, m: MarketId, grund: string): void {
  const ms = s.markeder[m];
  ms.licens = 'inddraget';
  ms.vertikaler = { betting: { status: 'ingen', klarUge: null }, kasino: { status: 'ingen', klarUge: null } };
  ms.spillerKunder = { betting: 0, kasino: 0 };
  ms.sanktion = { trin: 4, sidsteUge: s.uge, roligeKvartaler: 0 };
  ms.suspenderetTil = null;
  for (const p of s.produkter) if (p.ejer === 'spiller') p.markeder = p.markeder.filter((x) => x !== m);
  for (const p of s.produkter) if (p.ejer === 'spiller' && p.aktiv && p.markeder.length === 0) {
    p.aktiv = false;
    p.pensioneretUge = s.uge;
  }
  nyhed(s, `${MARKETS[m].tilsyn} inddrager ${s.firmaNavn}s licens i ${MARKETS[m].navn}. ${grund}`, 'marked');
  if (m === 'dk') {
    // Tabt dansk licens smitter: −15 i tilsynstillid i alle andre markeder
    for (const x of Object.keys(s.markeder) as MarketId[]) {
      if (x !== 'dk') s.markeder[x].tilsynstillid = clamp(s.markeder[x].tilsynstillid + TRUST.dkLicensTabSmitte, 0, 100);
    }
  }
}

export function sanktioner(s: GameState, rng: Rng, risikoFaktor = 1): void {
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const ms = s.markeder[m];
    if (ms.licens !== 'aktiv' && ms.licens !== 'suspenderet') continue;
    // Rolige kvartaler over 60 i tillid bringer trappen ét trin ned
    if (ms.tilsynstillid >= 60) {
      ms.sanktion.roligeKvartaler += 1;
      if (ms.sanktion.roligeKvartaler >= 4 && ms.sanktion.trin > 0 && ms.sanktion.trin < 4) {
        ms.sanktion.trin = (ms.sanktion.trin - 1) as 0 | 1 | 2 | 3;
        ms.sanktion.roligeKvartaler = 0;
      }
      continue;
    }
    ms.sanktion.roligeKvartaler = 0;
    const naeste = (ms.sanktion.trin + 1) as 1 | 2 | 3 | 4;
    if (naeste > 4) continue;
    if (ms.tilsynstillid >= sanktionsGraense(naeste)) continue;
    if (ms.sanktion.sidsteUge !== null && s.uge - ms.sanktion.sidsteUge < TRUST.sanktionPause) continue;
    if (!rng.chance(SANKTION_RISIKO * risikoFaktor)) continue;
    ms.sanktion.trin = naeste;
    ms.sanktion.sidsteUge = s.uge;
    if (naeste < 4) ms.tilsynstillid = clamp(ms.tilsynstillid + TRUST.sanktionLoeft[naeste as 1 | 2 | 3], 0, 100);
    const tilsyn = MARKETS[m].tilsyn;
    if (naeste === 1) {
      s.kapital -= 0.05;
      s.engangsUge += 0.05;
      nyhed(s, `${tilsyn} giver ${s.firmaNavn} et påbud om at stramme op.`, 'marked');
      signal(s, { k: 'sanktion', marked: m, trin: 1 });
    } else if (naeste === 2) {
      const aarBsi = (ms.spillerBsiPrUge.betting + ms.spillerBsiPrUge.kasino) * 52;
      const boede = Math.round(Math.max(0.2, 0.04 * aarBsi) * 100) / 100;
      s.kapital -= boede;
      s.engangsUge += boede;
      s.omdoemme = clamp(s.omdoemme - 3, 0, 100);
      nyhed(s, `${tilsyn} giver ${s.firmaNavn} en bøde på ${boede.toFixed(1).replace('.', ',')} mio. kr.`, 'marked');
      signal(s, { k: 'sanktion', marked: m, trin: 2, boede });
    } else if (naeste === 3) {
      ms.licens = 'suspenderet';
      ms.suspenderetTil = s.uge + 8;
      s.omdoemme = clamp(s.omdoemme - 5, 0, 100);
      nyhed(s, `${tilsyn} suspenderer ${s.firmaNavn}s licens i ${MARKETS[m].navn} i 8 uger under en gennemgang.`, 'marked');
      signal(s, { k: 'sanktion', marked: m, trin: 3 });
    } else {
      inddragLicens(s, m, 'Tilliden er brugt op.');
      signal(s, { k: 'sanktion', marked: m, trin: 4 });
    }
  }
}
