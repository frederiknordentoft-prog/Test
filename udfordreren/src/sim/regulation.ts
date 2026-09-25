// Regulering (spec 6.9, 7.7): faste historiske tidslinjer, dynamisk regulering drevet af politisk pres,
// og R11 (lav kanalisering i 2 år → blokering eller lempelse). Alt annonceres i nyhederne, før det træder i kraft.
import type { AcqChannel, GameState, MarketId, Vertical } from './types';
import type { Rng } from './rng';
import { REGLER, HISTORISKE_REGLER, DYNAMISK_PULJE, DYNAMISK, PRAEVALENSMAALINGER, KANALISERINGSMAAL, type RegelDef } from '../data/regulationTimeline';
import { MARKETS } from '../data/markets';
import { CHANNELS, CHANNEL_IDS } from '../data/acquisition';
import { aarFor, datoTekst, ugeIAar } from './time';
import { aendrPres, clamp, nyhed, signal } from './util';

export type RegelSum = {
  cac: Record<AcqChannel, number>;
  lukket: AcqChannel[];
  bonusMax: 0 | 1 | 2 | 3;
  vipMax: 0 | 1 | 2 | 3;
  arpu: Record<Vertical, number>;
  offshorePp: number;
  marketingEffekt: number;
  kraeverRisikoAgent: boolean;
};

// Cache pr. spil og marked: reglerne ændres sjældent, men effekten slås op mange gange pr. uge
const regelCache = new WeakMap<GameState, Map<MarketId, { noegle: string; e: RegelSum }>>();

/** Samlet effekt af de aktive regler i et marked (må ikke muteres af kalderen) */
export function regelEffekt(s: GameState, m: MarketId): RegelSum {
  const regler = s.markeder[m].regler;
  const noegle = regler.join(',');
  let c = regelCache.get(s);
  if (!c) regelCache.set(s, (c = new Map()));
  const hit = c.get(m);
  if (hit && hit.noegle === noegle) return hit.e;
  const e = beregnRegelEffekt(s, m);
  c.set(m, { noegle, e });
  return e;
}

function beregnRegelEffekt(s: GameState, m: MarketId): RegelSum {
  const e: RegelSum = {
    cac: Object.fromEntries(CHANNEL_IDS.map((k) => [k, 0])) as Record<AcqChannel, number>,
    lukket: [],
    bonusMax: 3,
    vipMax: 3,
    arpu: { betting: 0, kasino: 0 },
    offshorePp: 0,
    marketingEffekt: 0,
    kraeverRisikoAgent: false,
  };
  for (const id of s.markeder[m].regler) {
    const r = REGLER[id];
    if (!r) continue;
    const f = r.effekt;
    for (const [k, v] of Object.entries(f.cac ?? {})) e.cac[k as AcqChannel] += v ?? 0;
    for (const k of f.lukKanal ?? []) if (!e.lukket.includes(k)) e.lukket.push(k);
    if (f.bonusMax !== undefined) e.bonusMax = Math.min(e.bonusMax, f.bonusMax) as 0 | 1 | 2 | 3;
    if (f.vipMax !== undefined) e.vipMax = Math.min(e.vipMax, f.vipMax) as 0 | 1 | 2 | 3;
    e.arpu.betting += f.arpu?.betting ?? 0;
    e.arpu.kasino += f.arpu?.kasino ?? 0;
    e.offshorePp += f.offshorePp ?? 0;
    e.marketingEffekt += f.marketingEffekt ?? 0;
    if (f.kraeverRisikoAgent) e.kraeverRisikoAgent = true;
  }
  return e;
}

/** Spillerens effektive bonus- og VIP-niveau i et marked (loftet af regler) */
export function effektivBonus(s: GameState, m: MarketId): 0 | 1 | 2 | 3 {
  return Math.min(s.bonusNiveau, regelEffekt(s, m).bonusMax) as 0 | 1 | 2 | 3;
}
export function effektivVip(s: GameState, m: MarketId): 0 | 1 | 2 | 3 {
  return Math.min(s.vipProgram, regelEffekt(s, m).vipMax) as 0 | 1 | 2 | 3;
}

function regelTekst(r: RegelDef): string {
  const dele: string[] = [];
  const f = r.effekt;
  if (f.cac) for (const [k, v] of Object.entries(f.cac)) dele.push(`${CHANNELS[k as AcqChannel].navn} ${v && v > 0 ? '+' : ''}${Math.round((v ?? 0) * 100)} % CAC`);
  if (f.lukKanal) dele.push(`${f.lukKanal.map((k) => CHANNELS[k].navn).join(', ')} lukkes`);
  if (f.bonusMax !== undefined) dele.push(`bonus højst niveau ${f.bonusMax}`);
  if (f.vipMax !== undefined) dele.push(`VIP højst niveau ${f.vipMax}`);
  if (f.arpu?.kasino) dele.push(`kasino-BSI pr. kunde ${Math.round(f.arpu.kasino * 100)} %`);
  if (f.arpu?.betting) dele.push(`betting-BSI pr. kunde ${Math.round(f.arpu.betting * 100)} %`);
  if (f.afgiftPp) dele.push(`afgift ${f.afgiftPp > 0 ? '+' : ''}${f.afgiftPp} pp`);
  if (f.offshorePp) dele.push(`offshore ${f.offshorePp > 0 ? '+' : ''}${f.offshorePp} pp`);
  if (f.blokering) dele.push(f.blokering === 'dns' ? 'DNS-blokering' : f.blokering === 'betaling' ? 'betalingsblokering' : 'leverandøransvar');
  if (f.kraeverRisikoAgent) dele.push('uden AI-risikodetektion: påbud');
  if (f.marketingEffekt) dele.push(`marketingeffekt ${Math.round(f.marketingEffekt * 100)} %`);
  return dele.join(', ');
}

export function regelBeskrivelse(regelId: string): string {
  const r = REGLER[regelId];
  return r ? `${r.beskrivelse} (${regelTekst(r)})` : regelId;
}

function spillerAktiv(s: GameState, m: MarketId): boolean {
  const ms = s.markeder[m];
  return ms.licens !== 'ingen' || (m === 'no' && s.offshoreBrand);
}

/** Aktivér en regel i et marked (også sideeffekter som blokering og afgift) */
export function aktiverRegel(s: GameState, rng: Rng, m: MarketId, regelId: string, ppPlanlagt?: number): void {
  const ms = s.markeder[m];
  const r = REGLER[regelId];
  if (!r) return;
  // Kun afgiftsstigninger kan gentages; andre regler (også lempelser) virker én gang pr. marked
  if (ms.regler.includes(regelId) && regelId !== 'afgiftsstigning') return;
  if (!ms.regler.includes(regelId)) ms.regler.push(regelId);
  let pp: number | undefined;
  if (r.effekt.afgiftPp) {
    pp = regelId === 'afgiftsstigning' ? (ppPlanlagt ?? rng.int(3, 8)) : r.effekt.afgiftPp;
    ms.afgiftTillaeg = clamp(ms.afgiftTillaeg + pp, -10, 40);
  }
  if (r.effekt.blokering === 'dns' && ms.blokering.dns === null) ms.blokering.dns = s.uge;
  if (r.effekt.blokering === 'betaling' && ms.blokering.betaling === null) ms.blokering.betaling = s.uge;
  if (r.effekt.blokering === 'leverandoer') ms.blokering.leverandoer = true;
  const tekst = regelId === 'afgiftsstigning' && pp !== undefined ? `afgiften stiger ${pp} procentpoint` : regelTekst(r);
  nyhed(s, `${MARKETS[m].navn}: ${r.navn} træder i kraft: ${tekst}.`, 'marked', regelId.startsWith('dkSpilpakke') ? 'a5' : undefined);
  if (spillerAktiv(s, m)) signal(s, { k: 'regel', marked: m, regelId, varsel: false, ...(pp !== undefined && regelId === 'afgiftsstigning' ? { pp } : {}) });
}

/** Regelkategorier (så der ikke vedtages to regler, der gør det samme) */
export function regelKategorier(regelId: string): string[] {
  const f = REGLER[regelId]?.effekt;
  if (!f) return [];
  const k: string[] = [];
  if (f.bonusMax !== undefined) k.push('bonus');
  if (f.vipMax !== undefined) k.push('vip');
  if (f.arpu?.kasino && f.arpu.kasino < 0 && f.vipMax === undefined) k.push('indsats');
  if (f.lukKanal?.length || f.cac) k.push('reklame');
  if (f.afgiftPp) k.push('afgift');
  if (f.blokering) k.push('blokering');
  if (f.kraeverRisikoAgent) k.push('ai');
  return k;
}

/** Annoncér en regel (varsel). En afgiftsstigning får sin størrelse trukket her, så varslet og virkningen stemmer. */
export function annoncer(s: GameState, m: MarketId, regelId: string, uge: number, dynamisk: boolean, rng?: Rng): void {
  const ms = s.markeder[m];
  if (regelId !== 'afgiftsstigning' && (ms.regler.includes(regelId) || s.planlagteRegler.some((p) => p.marked === m && p.regelId === regelId))) return;
  const pp = regelId === 'afgiftsstigning' ? (rng ? rng.int(3, 8) : 5) : undefined;
  s.planlagteRegler.push({ marked: m, regelId, ikrafttraedelseUge: uge, annonceret: true, dynamisk, ...(pp !== undefined ? { pp } : {}) });
  const r = REGLER[regelId];
  const tekst = pp !== undefined ? `Afgiften stiger ${pp} procentpoint` : r ? regelTekst(r) : '';
  nyhed(s, `${MARKETS[m].navn} vedtager ${r?.navn.toLowerCase() ?? regelId} fra ${datoTekst(uge)}. ${tekst}.`, 'marked');
  if (spillerAktiv(s, m)) signal(s, { k: 'regel', marked: m, regelId, varsel: true, ...(pp !== undefined ? { pp } : {}) });
}

/** Ugentlig regulering: historiske tidslinjer, planlagte dynamiske regler og R11 */
export function ugentligRegulering(s: GameState, rng: Rng): void {
  // Historiske regler: annoncér og aktivér (robust over for hop i tid)
  for (const h of HISTORISKE_REGLER) {
    const aKey = `${h.marked}:${h.regelId}:a`;
    const iKey = `${h.marked}:${h.regelId}:i`;
    if (h.varsel > 0 && s.uge >= h.uge - h.varsel && s.uge < h.uge && !s.historiskeRegler.includes(aKey)) {
      s.historiskeRegler.push(aKey);
      annoncer(s, h.marked, h.regelId, h.uge, false);
    }
    if (s.uge >= h.uge && !s.historiskeRegler.includes(iKey)) {
      s.historiskeRegler.push(iKey);
      s.planlagteRegler = s.planlagteRegler.filter((p) => !(p.marked === h.marked && p.regelId === h.regelId && !p.dynamisk));
      aktiverRegel(s, rng, h.marked, h.regelId);
    }
  }
  // Dynamiske regler, der træder i kraft
  const klar = s.planlagteRegler.filter((p) => p.dynamisk && s.uge >= p.ikrafttraedelseUge);
  if (klar.length) {
    s.planlagteRegler = s.planlagteRegler.filter((p) => !(p.dynamisk && s.uge >= p.ikrafttraedelseUge));
    for (const p of klar) aktiverRegel(s, rng, p.marked, p.regelId, p.pp);
  }

  const aar = aarFor(s.uge);
  // Prævalensmålinger (spec 7.7) — offentliggøres i uge 20
  if (ugeIAar(s.uge) === 20) {
    for (const p of PRAEVALENSMAALINGER) {
      if (p.aar !== aar) continue;
      for (const m of p.markeder) aendrPres(s, m, 1, `Prævalensmåling ${aar}`);
      nyhed(s, `Ny prævalensmåling: flere med spilproblemer. Politikerne i ${p.markeder.map((m) => MARKETS[m].navn).join(', ')} vil handle.`, 'verden', 'a17');
    }
  }

  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const ms = s.markeder[m];
    if (!ms.aaben) continue;
    // Pres ≥ 3 → ny regel efter 52-104 uger, presset nulstilles til 1
    if (ms.politiskPres >= DYNAMISK.presTaerskel) {
      // Kategorier, der allerede er dækket af aktive eller planlagte regler i markedet, springes over
      const daekket = new Set([...ms.regler, ...s.planlagteRegler.filter((p) => p.marked === m).map((p) => p.regelId)].flatMap(regelKategorier));
      const planlagtAfgift = s.planlagteRegler.some((p) => p.marked === m && regelKategorier(p.regelId).includes('afgift'));
      const mulige = DYNAMISK_PULJE.filter((d) => {
        if (aar < d.fraAar) return false;
        if (d.regelId === 'afgiftsstigning') return !planlagtAfgift;
        return !ms.regler.includes(d.regelId) && !regelKategorier(d.regelId).some((k) => daekket.has(k));
      });
      if (mulige.length) {
        const valgt = rng.weighted(mulige, (d) => d.vaegt);
        annoncer(s, m, valgt.regelId, s.uge + rng.int(DYNAMISK.forsinkelse[0], DYNAMISK.forsinkelse[1]), true, rng);
      }
      ms.politiskPres = DYNAMISK.presEfter;
    }
    // R11: kanalisering under målet i 2 år → 40 % blokering, 20 % lempelse (fra 2026: indtil da følger reguleringen virkeligheden)
    const maal = KANALISERINGSMAAL[m];
    if (maal !== undefined && aar >= 2026) {
      ms.lavKanaliseringUger = ms.kanalisering < maal ? ms.lavKanaliseringUger + 1 : 0;
      if (ms.lavKanaliseringUger >= 104) {
        ms.lavKanaliseringUger = 0;
        s.reaktionsTaeller.R11 = (s.reaktionsTaeller.R11 ?? 0) + 1;
        const x = rng.next();
        if (x < 0.4) {
          const regel = ms.blokering.dns === null ? 'dnsBlokering' : ms.blokering.betaling === null ? 'betalingsblokering' : null;
          if (regel) annoncer(s, m, regel, s.uge + 26, true);
        } else if (x < 0.6) {
          annoncer(s, m, 'lempelse', s.uge + 26, true);
        }
      }
    }
  }
}

/** Kvartalsvis: langsomt fald i presset mod 1, og pres fra en aggressiv spiller (forløber for R8) */
export function kvartalsPres(s: GameState): void {
  const aggressiv = s.bonusNiveau + s.vipProgram + CHANNEL_IDS.filter((k) => CHANNELS[k].aggressiv && (s.marketingMix[k] ?? 0) > 0).length;
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const ms = s.markeder[m];
    if (ms.politiskPres > 1) ms.politiskPres = Math.max(1, ms.politiskPres - 0.1);
    if (ms.licens === 'aktiv' && aggressiv >= 4) aendrPres(s, m, 0.25, 'Jeres aggressive bonus, VIP og reklame');
  }
}
