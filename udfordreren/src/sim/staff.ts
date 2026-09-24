// Medarbejdere: jobannoncer, ansættelse, træning, energi, erfaring og rolleskift (spec 6.5).
import type { GameState, Role, Staff, StatKey, Stats } from './types';
import type { Rng } from './rng';
import { ROLES, ROLE_CHANGES, NIVEAU_VAEKST, xpTilNaeste, MAX_NIVEAU, LOEN_PR_NIVEAU } from '../data/roles';
import { FORNAVNE, EFTERNAVNE } from '../data/names';
import { JOB_ADS, OFFICE_BY_ID, TRAINING, FRATRAEDELSE_UGER } from '../data/costs';
import { FOUNDERS, FOUNDER_LOEN } from '../data/founders';
import { BALANCE } from '../data/balance';
import { aarFor } from './time';
import { afvis, betal, clamp, nyId, signal } from './util';

export const STAT_KEYS: StatKey[] = ['kreativitet', 'teknik', 'matematik', 'salg', 'ansvar', 'udholdenhed'];

export function beregnLoen(rolle: Role, niveau: number, stats: Stats, stifter = false): number {
  if (stifter) return FOUNDER_LOEN * (1 + LOEN_PR_NIVEAU * (niveau - 1));
  const statSum = STAT_KEYS.reduce((a, k) => a + stats[k], 0);
  return ROLES[rolle].basisLoen * (1 + LOEN_PR_NIVEAU * (niveau - 1)) * (0.8 + statSum / 300);
}

export function lavStifter(s: GameState, founderId: string): Staff {
  const f = FOUNDERS.find((x) => x.id === founderId) ?? FOUNDERS[0];
  return {
    id: nyId(s, 's'),
    navn: f.navn,
    rolle: f.rolle,
    niveau: 1,
    erfaring: 0,
    stats: { ...f.stats },
    loenPrUge: FOUNDER_LOEN,
    energi: 100,
    ansatUge: 0,
    stifter: true,
    udseende: f.udseende,
  };
}

/** Roller, der kan søges i det givne år */
export function tilgaengeligeRoller(aar: number): Role[] {
  return (Object.keys(ROLES) as Role[]).filter((r) => ROLES[r].fraAar <= aar);
}

export function lavKandidat(s: GameState, rng: Rng, statMin: number, statMax: number, niveauMin: number, niveauMax: number, rolle?: Role): Staff {
  const aar = aarFor(s.uge);
  const r = rolle ?? rng.pick(tilgaengeligeRoller(aar));
  const def = ROLES[r];
  const niveau = rng.int(niveauMin, niveauMax);
  const stats = {} as Stats;
  for (const k of STAT_KEYS) {
    let v = rng.int(statMin, statMax);
    if (k === def.primaer) v += 10;
    else if (def.sekundaer.includes(k)) v += 5;
    v += (niveau - 1) * 3;
    stats[k] = clamp(v, 1, TRAINING.statLoft);
  }
  return {
    id: nyId(s, 'k'),
    navn: `${rng.pick(FORNAVNE)} ${rng.pick(EFTERNAVNE)}`,
    rolle: r,
    niveau,
    erfaring: 0,
    stats,
    loenPrUge: beregnLoen(r, niveau, stats),
    energi: 100,
    ansatUge: s.uge,
    udseende: rng.int(0, 15),
  };
}

export function postJobAd(s: GameState, rng: Rng, niveau: 1 | 2 | 3): boolean {
  const ad = JOB_ADS.find((a) => a.niveau === niveau);
  if (!ad) return afvis(s, 'Ukendt annonce.');
  if (!betal(s, ad.pris, ad.navn)) return false;
  s.kandidater = [];
  for (let i = 0; i < ad.antal; i++) s.kandidater.push(lavKandidat(s, rng, ad.statMin, ad.statMax, ad.niveauMin, ad.niveauMax));
  return true;
}

export function pladser(s: GameState): number {
  return OFFICE_BY_ID[s.kontor].pladser;
}

export function hire(s: GameState, kandidatId: string): boolean {
  const k = s.kandidater.find((c) => c.id === kandidatId);
  if (!k) return afvis(s, 'Kandidaten findes ikke længere.');
  if (s.staff.length >= pladser(s)) return afvis(s, 'Der er ikke flere pladser i kontoret. Opgradér kontoret først.');
  s.kandidater = s.kandidater.filter((c) => c.id !== kandidatId);
  s.staff.push({ ...k, id: nyId(s, 's'), ansatUge: s.uge, energi: 100 });
  return true;
}

/** Fjern en medarbejder fra alle tildelinger og kontrakter */
export function fjernFraOpgaver(s: GameState, staffId: string): void {
  for (const p of s.projekter) {
    for (const f of Object.keys(p.faseTildeling) as (keyof typeof p.faseTildeling)[]) {
      p.faseTildeling[f] = p.faseTildeling[f].filter((id) => id !== staffId);
    }
  }
  for (const c of s.kontraktopgaver) c.staff = c.staff.filter((id) => id !== staffId);
}

export function fire(s: GameState, staffId: string): boolean {
  const m = s.staff.find((x) => x.id === staffId);
  if (!m) return afvis(s, 'Medarbejderen findes ikke.');
  if (m.stifter) return afvis(s, 'En stifter kan ikke fyres.');
  const fratraedelse = m.loenPrUge * FRATRAEDELSE_UGER;
  s.kapital -= fratraedelse;
  s.engangsUge += fratraedelse;
  fjernFraOpgaver(s, staffId);
  s.staff = s.staff.filter((x) => x.id !== staffId);
  return true;
}

export function traeningPris(m: Staff): { penge: number; indsigt: number } {
  return { penge: TRAINING.prisPrNiveau * m.niveau, indsigt: TRAINING.indsigt };
}

export function train(s: GameState, rng: Rng, staffId: string, stat: StatKey): boolean {
  const m = s.staff.find((x) => x.id === staffId);
  if (!m) return afvis(s, 'Medarbejderen findes ikke.');
  if (m.energi < 20) return afvis(s, `${m.navn} er for træt til træning.`);
  if (m.stats[stat] >= TRAINING.statLoft) return afvis(s, `${m.navn} er allerede på toppen i den stat.`);
  const pris = traeningPris(m);
  if (s.indsigt < pris.indsigt) return afvis(s, `Træning kræver ${pris.indsigt} indsigt.`);
  if (!betal(s, pris.penge, 'træning')) return false;
  s.indsigt -= pris.indsigt;
  let gevinst = rng.int(TRAINING.minGevinst, TRAINING.maxGevinst);
  if (m.stats[stat] > 70) gevinst = Math.ceil(gevinst / 2);
  m.stats[stat] = clamp(m.stats[stat] + gevinst, 0, TRAINING.statLoft);
  m.energi = clamp(m.energi - TRAINING.energi, 0, 100);
  m.loenPrUge = beregnLoen(m.rolle, m.niveau, m.stats, m.stifter);
  return true;
}

export function rolleskiftFor(s: GameState, m: Staff) {
  const aar = aarFor(s.uge);
  return ROLE_CHANGES.filter(
    (c) => c.fra === m.rolle && !(c.specialisering && m.specialisering === c.specialisering) && !(c.til === m.rolle && !c.specialisering),
  ).map((c) => ({ ...c, mulig: m.niveau >= c.niveau && aar >= c.fraAar }));
}

export const ROLLESKIFT_PRIS = { penge: 0.05, indsigt: 5 };

export function changeRole(s: GameState, staffId: string, nyRolle: Role): boolean {
  const m = s.staff.find((x) => x.id === staffId);
  if (!m) return afvis(s, 'Medarbejderen findes ikke.');
  const aar = aarFor(s.uge);
  const skift = ROLE_CHANGES.find((c) => c.fra === m.rolle && c.til === nyRolle && !(c.specialisering && m.specialisering === c.specialisering));
  if (!skift) return afvis(s, 'Det rolleskift findes ikke.');
  if (aar < skift.fraAar) return afvis(s, `Rolleskiftet åbner først i ${skift.fraAar}.`);
  if (m.niveau < skift.niveau) return afvis(s, `Kræver niveau ${skift.niveau}.`);
  if (s.indsigt < ROLLESKIFT_PRIS.indsigt) return afvis(s, `Rolleskift kræver ${ROLLESKIFT_PRIS.indsigt} indsigt.`);
  if (!betal(s, ROLLESKIFT_PRIS.penge, 'omskoling')) return false;
  s.indsigt -= ROLLESKIFT_PRIS.indsigt;
  if (skift.specialisering) {
    m.specialisering = skift.specialisering;
    m.stats.salg = clamp(m.stats.salg + 8, 0, TRAINING.statLoft);
    m.stats.ansvar = clamp(m.stats.ansvar + 6, 0, TRAINING.statLoft);
  } else {
    m.rolle = nyRolle;
    const def = ROLES[nyRolle];
    m.stats[def.primaer] = clamp(m.stats[def.primaer] + 5, 0, TRAINING.statLoft);
  }
  m.loenPrUge = beregnLoen(m.rolle, m.niveau, m.stats, m.stifter);
  return true;
}

/** Hvem er optaget hvor? Kontrakter vinder over projekter; første projekt vinder. */
export type Opgave = { type: 'projekt'; projectId: string } | { type: 'kontrakt'; contractId: string } | { type: 'ledig' };

export function opgaverFor(s: GameState): Record<string, Opgave> {
  const res: Record<string, Opgave> = {};
  for (const c of s.kontraktopgaver) for (const id of c.staff) if (!res[id]) res[id] = { type: 'kontrakt', contractId: c.id };
  for (const p of s.projekter) {
    if (p.klar) continue;
    for (const id of p.faseTildeling[p.fase]) if (!res[id]) res[id] = { type: 'projekt', projectId: p.id };
  }
  for (const m of s.staff) if (!res[m.id]) res[m.id] = { type: 'ledig' };
  return res;
}

function levelOp(s: GameState, rng: Rng, m: Staff): void {
  const def = ROLES[m.rolle];
  m.niveau += 1;
  for (const k of STAT_KEYS) {
    let [lo, hi]: readonly [number, number] = NIVEAU_VAEKST.oevrige;
    if (k === def.primaer) [lo, hi] = NIVEAU_VAEKST.primaer;
    else if (def.sekundaer.includes(k)) [lo, hi] = NIVEAU_VAEKST.sekundaer;
    m.stats[k] = clamp(m.stats[k] + rng.int(lo, hi), 0, TRAINING.statLoft);
  }
  m.loenPrUge = beregnLoen(m.rolle, m.niveau, m.stats, m.stifter);
  signal(s, { k: 'niveauOp', staffId: m.id, niveau: m.niveau });
}

/** Ugentlig opdatering af energi og erfaring. `arbejdet` = staff-id → 'projekt' | 'kontrakt'. */
export function ugentligStaff(s: GameState, rng: Rng, arbejdet: Record<string, 'projekt' | 'kontrakt'>): void {
  const hvile = BALANCE.energiHvile + (s.flags.includes('espresso') ? 3 : 0);
  for (const m of s.staff) {
    const a = arbejdet[m.id];
    const udh = 1.4 - m.stats.udholdenhed / 100;
    if (a === 'projekt') {
      m.energi = clamp(m.energi - BALANCE.energiTabProjekt * udh, 0, 100);
      m.erfaring += BALANCE.xpProjekt;
    } else if (a === 'kontrakt') {
      m.energi = clamp(m.energi - BALANCE.energiTabKontrakt * udh, 0, 100);
      m.erfaring += BALANCE.xpKontrakt;
    } else {
      m.energi = clamp(m.energi + hvile, 0, 100);
    }
    while (m.niveau < MAX_NIVEAU && m.erfaring >= xpTilNaeste(m.niveau)) {
      m.erfaring -= xpTilNaeste(m.niveau);
      levelOp(s, rng, m);
    }
    if (m.niveau >= MAX_NIVEAU) m.erfaring = Math.min(m.erfaring, xpTilNaeste(m.niveau));
  }
  // 'ledig'-signal: dem, der arbejdede sidste uge, men nu er ledige
  const nuTravle = Object.keys(arbejdet);
  const blevLedige = s.travleSidst.filter((id) => !arbejdet[id] && s.staff.some((m) => m.id === id));
  if (blevLedige.length > 0) {
    const aktivtProjekt = s.projekter.some((p) => !p.klar);
    signal(s, { k: 'ledig', staffIds: blevLedige, ingenOpgaver: !aktivtProjekt });
  }
  s.travleSidst = nuTravle.sort();
}

/** Passive rolle-effekter (tæller energivægtet antal i hver rolle) */
export function rolleAntal(s: GameState, rolle: Role): number {
  let n = 0;
  for (const m of s.staff) if (m.rolle === rolle) n += 0.5 + 0.5 * (m.energi / 100);
  return n;
}

export function passiveEffekter(s: GameState) {
  const odds = rolleAntal(s, 'oddssaetter');
  const kasino = rolleAntal(s, 'kasinodesigner');
  const dev = rolleAntal(s, 'udvikler');
  const mkt = rolleAntal(s, 'marketing');
  const ks = rolleAntal(s, 'kundeservice');
  const crm = s.staff.filter((m) => m.specialisering === 'crm').length;
  return {
    bettingBsi: Math.min(0.1, 0.02 * odds),
    kasinoBsi: Math.min(0.1, 0.02 * kasino),
    fejl: -Math.min(0.25, 0.05 * dev),
    cac: -Math.min(0.2, 0.04 * mkt),
    churn: -Math.min(0.15, 0.03 * ks) - Math.min(0.1, 0.04 * crm),
    compliance: s.staff.filter((m) => m.rolle === 'compliance').length,
    analytikere: s.staff.filter((m) => m.rolle === 'analytiker').length,
  };
}
