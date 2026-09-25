// Tilsynstillid (spec 6.9 og 7.12). Fase 1-2: kvartalsvis drift; sanktionstrappen kommer i fase 3.
import type { GameState, MarketId } from './types';
import { TRUST } from '../data/trust';
import { CHANNELS, CHANNEL_IDS } from '../data/acquisition';
import { clamp, nyhed, signal } from './util';
import type { Rng } from './rng';
import { MARKETS } from '../data/markets';
import { forskningsEffekt } from './insight';
import { passiveEffekter } from './staff';

export type TillidsPost = { tekst: string; vaerdi: number };

/** Kvartalets tillidsposter for et marked — synlige, så spilleren kan se hvorfor */
export function tillidsPoster(s: GameState, m: MarketId): TillidsPost[] {
  const ms = s.markeder[m];
  const poster: TillidsPost[] = [];
  if (s.bonusNiveau > 0) poster.push({ tekst: `Bonusniveau ${s.bonusNiveau}`, vaerdi: TRUST.bonusNiveau * s.bonusNiveau });
  if (s.vipProgram > 0) poster.push({ tekst: `VIP-program ${s.vipProgram}`, vaerdi: TRUST.vipProgram * s.vipProgram });
  const hoejIntensitet = s.produkter.some((p) => p.aktiv && p.ejer === 'spiller' && p.markeder.includes(m) && p.intensitet > 3);
  if (hoejIntensitet) poster.push({ tekst: 'Produkter med intensitet over 3', vaerdi: TRUST.intensitetOver3 });
  const aggressiv = CHANNEL_IDS.some((k) => CHANNELS[k].aggressiv && (s.marketingMix[k] ?? 0) > 0);
  if (aggressiv) poster.push({ tekst: 'Aggressive kanaler (tv/streamere)', vaerdi: TRUST.aggressivKanal });
  const comp = passiveEffekter(s).compliance;
  if (comp > 0) poster.push({ tekst: `Compliance-medarbejdere (${comp})`, vaerdi: Math.min(3, TRUST.complianceNiveau * comp) });
  const eff = forskningsEffekt(s);
  if (eff.ansvarNoder > 0) poster.push({ tekst: 'Ansvarsforskning', vaerdi: Math.min(2, eff.tillid) });
  if (s.offshoreBrand) poster.push({ tekst: 'Offshore-brand', vaerdi: TRUST.offshoreBrand });
  const sum = poster.reduce((a, p) => a + p.vaerdi, 0);
  // Langsom tilbagevenden mod startniveau, når intet andet trækker
  if (sum === 0 && ms.tilsynstillid !== TRUST.start) {
    poster.push({ tekst: 'Normalisering', vaerdi: ms.tilsynstillid < TRUST.start ? TRUST.genopretning : -TRUST.genopretning });
  }
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
    if (!rng.chance(SANKTION_RISIKO * risikoFaktor)) continue;
    ms.sanktion.trin = naeste;
    ms.sanktion.sidsteUge = s.uge;
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
