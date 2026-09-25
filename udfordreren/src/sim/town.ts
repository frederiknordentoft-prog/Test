// Spillerbyen (spec 6.14): 200 pixelpersoner repræsenterer spillerens kunder. Guldkunderne (VIP) er de mest
// profitable, og mange glider over i gul (risiko) og rød (problem), når intensitet, VIP og bonus er høje.
// Beskyttelsesværktøjer flytter folk tilbage; selvudelukkede forsvinder stille.
import type { GameState, MarketId, TownPerson, TownProfile } from './types';
import type { Rng } from './rng';
import { BY, BYHISTORIER } from '../data/town';
import { FORNAVNE } from '../data/names';
import { CHANNELS, CHANNEL_IDS } from '../data/acquisition';
import { MARKETS } from '../data/markets';
import { forskningsEffekt } from './insight';
import { effektivBonus, effektivVip } from './regulation';
import { agentEffekt } from './agents';
import { aendrPres, clamp, saetFlag, signal, tidslinje } from './util';

export const AKTIVE_PROFILER: TownProfile[] = ['rekreativ', 'engageret', 'vip', 'risiko', 'problem'];

const frac = (x: number) => x - Math.floor(x);

function nyPerson(id: number): TownPerson {
  // Kvasi-tilfældig placering (deterministisk): byen ser organisk ud uden at bruge RNG
  return { id, x: frac(0.5 + id * 0.6180339887), y: frac(0.5 + id * 0.7548776662), profil: 'churnet', vaerdi: 0, eksponering: 0, marked: 'dk' };
}

export function initBy(): TownPerson[] {
  return Array.from({ length: BY.antal }, (_, i) => nyPerson(i));
}

// ---------- Aflæsning ----------

export type ByTal = Record<TownProfile, number> & { aktive: number };

export function byTal(s: GameState, m?: MarketId): ByTal {
  const t: ByTal = { rekreativ: 0, engageret: 0, vip: 0, risiko: 0, problem: 0, churnet: 0, aktive: 0 };
  for (const p of s.by) {
    if (m && p.marked !== m && p.profil !== 'churnet') continue;
    t[p.profil] += 1;
    if (p.profil !== 'churnet') t.aktive += 1;
  }
  return t;
}

/** Andel af aktive kunder i risiko eller problem (null, hvis der er for få kunder at sige noget om) */
export function risikoAndel(s: GameState, m?: MarketId): number | null {
  const t = byTal(s, m);
  if (t.aktive < (m ? 8 : 1)) return m ? risikoAndel(s) : null;
  return (t.risiko + t.problem) / t.aktive;
}

/** BSI-effekt af byens sammensætning (1 ved neutral ligevægt) */
export function byArpuFaktor(s: GameState, m: MarketId): number {
  let sum = 0;
  let n = 0;
  for (const p of s.by) {
    if (p.profil === 'churnet' || p.marked !== m) continue;
    sum += BY.vaerdi[p.profil];
    n += 1;
  }
  if (n < 8) return 1;
  return 1 - BY.arpuVaegt + BY.arpuVaegt * (sum / n / BY.neutralVaerdi);
}

/** Tillidspost for et marked: −0,8 pr. procentpoint risiko+problem over 8 % */
export function byTillid(s: GameState, m: MarketId): number {
  const a = risikoAndel(s, m);
  if (a === null || a <= BY.tillidTaerskel) return 0;
  return Math.max(BY.tillidMaks, BY.tillidPrPp * (a - BY.tillidTaerskel) * 100);
}

// ---------- Drivere ----------

export type ByDrivere = { skade: number; beskyttelse: number; vip: number; hyper: boolean; bedring: number };

export function byDrivere(s: GameState, m: MarketId): ByDrivere {
  const prods = s.produkter.filter((p) => p.aktiv && p.ejer === 'spiller' && p.markeder.includes(m));
  const intensitet = prods.length ? prods.reduce((a, p) => a + p.intensitet, 0) / prods.length : 3;
  const bonus = effektivBonus(s, m);
  const vip = effektivVip(s, m);
  const aggressiv = CHANNEL_IDS.some((k) => CHANNELS[k].aggressiv && (s.marketingMix[k] ?? 0) > 0);
  const ae = agentEffekt(s);
  const hyper = s.hyperpersonalisering.aktiv;
  const skade =
    Math.max(0.4, 1 + BY.intensitet * (intensitet - 3)) *
    (1 + BY.bonus * bonus) *
    (hyper ? 1 + (ae.risikoOk ? BY.hyperMedRisiko : BY.hyper) : 1) *
    (aggressiv ? 1 + BY.aggressiv : 1);
  const comp = Math.min(BY.beskyttelse.complianceMaks, BY.beskyttelse.compliancePrPerson * s.staff.filter((x) => x.rolle === 'compliance').length);
  const affordRegel = s.markeder[m].regler.some((id) => id === 'affordability' || id === 'ukAffordability') ? BY.beskyttelse.affordabilityRegel : 0;
  const beskyttelse = 1 + forskningsEffekt(s).by + comp + affordRegel + ae.byBeskyttelse;
  const bedring = hyper && !ae.risikoOk ? BY.hyperBedring : 1;
  return { skade, beskyttelse, vip, hyper, bedring };
}

// ---------- Ugentlig opdatering (hver 4. uge) ----------

type HistorieKandidat = { kind: keyof typeof BYHISTORIER; p: TownPerson };

export function ugentligBy(s: GameState, rng: Rng): void {
  if (s.uge % BY.interval !== 0) return;
  const kunderPrMarked: Partial<Record<MarketId, number>> = {};
  let kunder = 0;
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const k = s.markeder[m].spillerKunder.betting + s.markeder[m].spillerKunder.kasino;
    if (k > 0.5) kunderPrMarked[m] = k;
    kunder += k;
  }
  const maal = kunder < 1 ? 0 : clamp(Math.round(BY.aktivePrDekade * Math.log10(kunder)), 1, BY.antal);
  const drivere: Partial<Record<MarketId, ByDrivere>> = {};
  const kandidater: HistorieKandidat[] = [];

  for (const p of s.by) {
    if (p.profil === 'churnet') continue;
    // Markedet er væk (licens tabt eller ingen kunder): kunden forsvinder
    if (!kunderPrMarked[p.marked]) {
      saetProfil(p, 'churnet');
      continue;
    }
    const d = (drivere[p.marked] ??= byDrivere(s, p.marked));
    const H = d.skade / d.beskyttelse;
    const selv = 1 + s.markeder[p.marked].selvudelukkede;
    const op = BY.op;
    const ned = BY.ned;
    const x = rng.next();
    let ny: TownProfile = p.profil;
    let stille = false;
    switch (p.profil) {
      case 'rekreativ': {
        const c = BY.churn.rekreativ;
        if (x < c) ny = 'churnet';
        else if (x < c + op.rekreativEngageret) ny = 'engageret';
        else if (x < c + op.rekreativEngageret + op.rekreativRisiko * H) ny = 'risiko';
        break;
      }
      case 'engageret': {
        const c = BY.churn.engageret;
        const tilVip = op.engageretVip * (1 + BY.vipKonvertering * d.vip);
        if (x < c) ny = 'churnet';
        else if (x < c + ned.engageretRekreativ) ny = 'rekreativ';
        else if (x < c + ned.engageretRekreativ + tilVip) ny = 'vip';
        else if (x < c + ned.engageretRekreativ + tilVip + op.engageretRisiko * H) ny = 'risiko';
        break;
      }
      case 'vip': {
        const c = BY.churn.vip;
        if (x < c) ny = 'churnet';
        else if (x < c + ned.vipEngageret) ny = 'engageret';
        else if (x < c + ned.vipEngageret + op.vipRisiko * (1 + BY.vipRisiko * d.vip) * H) ny = 'risiko';
        break;
      }
      case 'risiko': {
        const c = BY.churn.risiko;
        const su = BY.selvudelukkelse.risiko * selv;
        const bedring = ned.risikoEngageret * d.beskyttelse * d.bedring;
        if (x < c) ny = 'churnet';
        else if (x < c + su) { ny = 'churnet'; stille = true; }
        else if (x < c + su + bedring) ny = 'engageret';
        else if (x < c + su + bedring + op.risikoProblem * H) ny = 'problem';
        break;
      }
      case 'problem': {
        const c = BY.churn.problem;
        const su = BY.selvudelukkelse.problem * selv;
        const bedring = ned.problemRisiko * d.beskyttelse * d.bedring;
        if (x < c) ny = 'churnet';
        else if (x < c + su) { ny = 'churnet'; stille = true; }
        else if (x < c + su + bedring) ny = 'risiko';
        break;
      }
    }
    if (ny === p.profil) continue;
    if (ny === 'vip') kandidater.push({ kind: 'vip', p });
    else if (ny === 'risiko' && p.profil !== 'problem') kandidater.push({ kind: 'risiko', p });
    else if (ny === 'problem') kandidater.push({ kind: 'problem', p });
    else if (ny === 'engageret' && p.profil === 'risiko') kandidater.push({ kind: 'bedring', p });
    else if (stille) kandidater.push({ kind: 'selvudelukket', p });
    saetProfil(p, ny);
    if (stille) p.eksponering = -1; // markeret: forsvandt stille (UI tegner den ikke)
  }

  // Tilpas antallet af aktive kunder til firmaets størrelse
  let aktive = s.by.filter((p) => p.profil !== 'churnet').length;
  const markeder = Object.keys(kunderPrMarked) as MarketId[];
  if (aktive < maal && markeder.length) {
    for (const p of s.by) {
      if (aktive >= maal) break;
      if (p.profil !== 'churnet') continue;
      p.marked = rng.weighted(markeder, (m) => kunderPrMarked[m] ?? 0);
      saetProfil(p, 'rekreativ');
      p.eksponering = 0;
      aktive += 1;
    }
  } else if (aktive > maal) {
    for (const p of s.by) {
      if (aktive <= maal) break;
      if (p.profil !== 'rekreativ') continue;
      saetProfil(p, 'churnet');
      aktive -= 1;
    }
  }
  // Eksponering: hvor længe personen har været kunde (til UI og historier)
  for (const p of s.by) if (p.profil !== 'churnet') p.eksponering += BY.interval;

  byHistorie(s, rng, kandidater);
}

function saetProfil(p: TownPerson, profil: TownProfile): void {
  p.profil = profil;
  p.vaerdi = BY.vaerdi[profil];
}

function byHistorie(s: GameState, rng: Rng, kandidater: HistorieKandidat[]): void {
  if (!kandidater.length) return;
  const sidste = s.byHistorier[0]?.uge ?? -99;
  if (s.uge - sidste < BY.historieMellemrum) return;
  const vaegt: Record<HistorieKandidat['kind'], number> = { vip: 2, risiko: 2, problem: 3, bedring: 3, selvudelukket: 2 };
  const k = rng.weighted(kandidater, (c) => vaegt[c.kind]);
  const navn = FORNAVNE[(k.p.id * 7 + s.uge) % FORNAVNE.length];
  const alder = 21 + ((k.p.id * 13) % 45);
  const skabelon = rng.pick(BYHISTORIER[k.kind]);
  const tekst = skabelon.replace('{navn}', navn).replace('{alder}', String(alder));
  const profil: TownProfile = k.kind === 'bedring' ? 'engageret' : k.kind === 'selvudelukket' ? 'churnet' : k.kind;
  s.byHistorier.unshift({ uge: s.uge, tekst: `${tekst} (${MARKETS[k.p.marked].navn})`, profil, marked: k.p.marked });
  if (s.byHistorier.length > 12) s.byHistorier.length = 12;
  signal(s, { k: 'byhistorie', tekst, profil });
}

/** Kvartalsvis: en rød by hos en stor udbyder giver politisk pres */
export function kvartalsBy(s: GameState): void {
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const ms = s.markeder[m];
    if (ms.licens !== 'aktiv') continue;
    const a = risikoAndel(s, m);
    if (a !== null && a > BY.presTaerskel && (ms.andele.spiller ?? 0) > BY.presAndel) aendrPres(s, m, BY.presPrKvartal, 'Jeres kunder i risiko og problem');
    if (a !== null && a > BY.presTaerskel && !s.flags.includes('byRoed')) {
      saetFlag(s, 'byRoed');
      tidslinje(s, `Byen blev rød: ${Math.round(a * 100)} % af kunderne i ${MARKETS[m].navn} i risiko eller problem.`, 'krise');
    }
  }
}
