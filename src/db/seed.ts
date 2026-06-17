// ============================================================
// Seed-data: et realistisk dansk mobilspil-studie, "Nordlys Games".
//
// Hierarki: Virksomhed → 3 tribes → 6 teams.
// Alignment-koblinger binder team-KR'er op til tribe-KR'er og videre op til
// company-KR'er, så auto-rollup kan demonstreres hele vejen igennem.
//
// Hvert KR får 8 ugers historiske check-ins, så sparklines og dashboard
// er fyldt med liv fra første sekund.
// ============================================================

import { addDays, addWeeks, formatISO, startOfWeek, subWeeks } from 'date-fns';
import type {
  AlignmentLink,
  CheckIn,
  Cycle,
  Initiative,
  InitiativeStatus,
  KeyResult,
  MetricType,
  Objective,
} from '../types/domain';

const today = new Date();

// ---- Cyklusser ----
const cycleQ1: Cycle = {
  id: 'cycle-q1-2026',
  name: 'Q1 2026',
  startDate: formatISO(new Date(2026, 0, 1), { representation: 'date' }),
  endDate: formatISO(new Date(2026, 2, 31), { representation: 'date' }),
  isActive: false,
};
const cycleQ2: Cycle = {
  id: 'cycle-q2-2026',
  name: 'Q2 2026',
  startDate: formatISO(new Date(2026, 3, 1), { representation: 'date' }),
  endDate: formatISO(new Date(2026, 5, 30), { representation: 'date' }),
  isActive: true,
};

// ---- Builders ----
let krCounter = 0;
let initCounter = 0;

interface KrSpec {
  id: string;
  title: string;
  owner: string;
  metricType: MetricType;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  type: 'committed' | 'aspirational';
  /** Sundhedsprofil styrer den genererede confidence-bane. */
  profile: 'green' | 'yellow' | 'red' | 'fresh';
  initiatives?: { title: string; status: InitiativeStatus; owner: string; dueInDays?: number }[];
}

interface ObjSpec {
  id: string;
  title: string;
  description: string;
  owner: string;
  level: 'company' | 'tribe' | 'team';
  parentObjectiveId?: string;
  krs: KrSpec[];
}

const objectives: Objective[] = [];
const keyResults: KeyResult[] = [];
const initiatives: Initiative[] = [];

function addObjective(spec: ObjSpec, order: number) {
  objectives.push({
    id: spec.id,
    title: spec.title,
    description: spec.description,
    owner: spec.owner,
    level: spec.level,
    parentObjectiveId: spec.parentObjectiveId,
    cycleId: cycleQ2.id,
    status: 'on_track',
    order,
  });
  spec.krs.forEach((kr, i) => {
    keyResults.push({
      id: kr.id,
      objectiveId: spec.id,
      title: kr.title,
      owner: kr.owner,
      metricType: kr.metricType,
      baseline: kr.baseline,
      target: kr.target,
      current: kr.current,
      unit: kr.unit,
      type: kr.type,
      order: i,
    });
    (kr.initiatives ?? []).forEach((ini, j) => {
      initiatives.push({
        id: `ini-${++initCounter}`,
        keyResultId: kr.id,
        title: ini.title,
        status: ini.status,
        owner: ini.owner,
        dueDate:
          ini.dueInDays !== undefined
            ? formatISO(addDays(today, ini.dueInDays), { representation: 'date' })
            : undefined,
        order: j,
      });
    });
  });
}

const kr = (s: Omit<KrSpec, 'id'>): KrSpec => ({ id: `kr-${++krCounter}`, ...s });

// ============================================================
// VIRKSOMHEDSNIVEAU
// ============================================================
const coBeloved = kr({
  title: 'Daglige aktive spillere (DAU)',
  owner: 'Mette Holm (CEO)',
  metricType: 'number',
  baseline: 120000,
  target: 250000,
  current: 168000,
  unit: 'spillere',
  type: 'aspirational',
  profile: 'yellow',
});
const coRetention = kr({
  title: 'D30 retention',
  owner: 'Mette Holm (CEO)',
  metricType: 'percent',
  baseline: 18,
  target: 28,
  current: 21.5,
  unit: '%',
  type: 'committed',
  profile: 'yellow',
});
const coRating = kr({
  title: 'App Store-rating',
  owner: 'Mette Holm (CEO)',
  metricType: 'number',
  baseline: 4.2,
  target: 4.6,
  current: 4.45,
  unit: 'stjerner',
  type: 'committed',
  profile: 'green',
});
const coRevenue = kr({
  title: 'Månedlig omsætning',
  owner: 'Anders Kjær (CFO)',
  metricType: 'currency',
  baseline: 3200000,
  target: 6000000,
  current: 4100000,
  unit: 'kr.',
  type: 'committed',
  profile: 'yellow',
});
const coMargin = kr({
  title: 'Bruttomargin',
  owner: 'Anders Kjær (CFO)',
  metricType: 'percent',
  baseline: 62,
  target: 70,
  current: 63,
  unit: '%',
  type: 'committed',
  profile: 'red',
});

addObjective(
  {
    id: 'obj-co-1',
    title: 'Bliv Nordens mest elskede mobilspilsstudie',
    description:
      'Spillere vælger os, anbefaler os og bliver hængende. Vi måler kærlighed i aktive spillere, fastholdelse og anmeldelser.',
    owner: 'Mette Holm (CEO)',
    level: 'company',
    krs: [coBeloved, coRetention, coRating],
  },
  0,
);
addObjective(
  {
    id: 'obj-co-2',
    title: 'Byg en sund og skalerbar forretning',
    description: 'Vækst må ikke ske på bekostning af økonomien. Vi vokser med en margin der holder.',
    owner: 'Anders Kjær (CFO)',
    level: 'company',
    krs: [coRevenue, coMargin],
  },
  1,
);

// ============================================================
// TRIBE: SPILOPLEVELSE
// ============================================================
const trD1 = kr({
  title: 'D1 retention',
  owner: 'Sofie Bach',
  metricType: 'percent',
  baseline: 42,
  target: 55,
  current: 47,
  unit: '%',
  type: 'committed',
  profile: 'green',
});
const trSession = kr({
  title: 'Gns. sessionslængde',
  owner: 'Sofie Bach',
  metricType: 'number',
  baseline: 8,
  target: 14,
  current: 9.8,
  unit: 'min',
  type: 'aspirational',
  profile: 'yellow',
});
addObjective(
  {
    id: 'obj-tr-so',
    title: 'Spillere bliver hængende fordi spillet er sjovt fra dag 1',
    description: 'Den første dag afgør alt. Vi gør de første minutter uimodståelige.',
    owner: 'Sofie Bach (Tribe Lead)',
    level: 'tribe',
    parentObjectiveId: 'obj-co-1',
    krs: [trD1, trSession],
  },
  0,
);

// ============================================================
// TRIBE: VÆKST
// ============================================================
const trInstalls = kr({
  title: 'Nye installationer pr. måned',
  owner: 'Jonas Riis',
  metricType: 'number',
  baseline: 200000,
  target: 400000,
  current: 268000,
  unit: 'installs',
  type: 'aspirational',
  profile: 'green',
});
const trCac = kr({
  title: 'Kundeanskaffelsesomkostning (CAC)',
  owner: 'Jonas Riis',
  metricType: 'currency',
  baseline: 14,
  target: 9,
  current: 12.2,
  unit: 'kr.',
  type: 'committed',
  profile: 'yellow',
});
const trArpdau = kr({
  title: 'ARPDAU',
  owner: 'Jonas Riis',
  metricType: 'currency',
  baseline: 0.26,
  target: 0.4,
  current: 0.3,
  unit: 'kr.',
  type: 'committed',
  profile: 'yellow',
});
addObjective(
  {
    id: 'obj-tr-v',
    title: 'Effektiv vækst med sund økonomi',
    description: 'Vi skalerer antallet af spillere og indtjeningen pr. spiller — uden at brænde penge af.',
    owner: 'Jonas Riis (Tribe Lead)',
    level: 'tribe',
    parentObjectiveId: 'obj-co-2',
    krs: [trInstalls, trCac, trArpdau],
  },
  1,
);

// ============================================================
// TRIBE: PLATFORM & TEKNIK
// ============================================================
const trCrash = kr({
  title: 'Crash-free sessioner',
  owner: 'Lars Toft',
  metricType: 'percent',
  baseline: 98.5,
  target: 99.7,
  current: 99.2,
  unit: '%',
  type: 'committed',
  profile: 'green',
});
const trLoad = kr({
  title: 'p95 indlæsningstid',
  owner: 'Lars Toft',
  metricType: 'number',
  baseline: 4.2,
  target: 2.0,
  current: 3.4,
  unit: 'sek',
  type: 'committed',
  profile: 'yellow',
});
addObjective(
  {
    id: 'obj-tr-p',
    title: 'En stabil, hurtig platform spillere kan stole på',
    description: 'Ingen elsker et spil der crasher eller loader langsomt. Driften skal være usynlig god.',
    owner: 'Lars Toft (Tribe Lead)',
    level: 'tribe',
    parentObjectiveId: 'obj-co-1',
    krs: [trCrash, trLoad],
  },
  2,
);

// ============================================================
// TEAMS under SPILOPLEVELSE
// ============================================================
const tmTutorial = kr({
  title: 'Tutorial-gennemførsel',
  owner: 'Emil Storm',
  metricType: 'percent',
  baseline: 61,
  target: 80,
  current: 70,
  unit: '%',
  type: 'committed',
  profile: 'green',
  initiatives: [
    { title: 'Redesign af de første 3 tutorial-trin', status: 'færdig', owner: 'Emil Storm', dueInDays: -10 },
    { title: 'A/B-test: skip-knap vs. guidet flow', status: 'i_gang', owner: 'Nina Vad', dueInDays: 12 },
    { title: 'Fjern friktion i konto-oprettelse', status: 'i_gang', owner: 'Emil Storm', dueInDays: 20 },
  ],
});
const tmLevel5 = kr({
  title: 'Spillere der når level 5 i uge 1',
  owner: 'Nina Vad',
  metricType: 'percent',
  baseline: 30,
  target: 50,
  current: 35,
  unit: '%',
  type: 'aspirational',
  profile: 'yellow',
  initiatives: [
    { title: 'Ny progressionskurve for level 1-5', status: 'i_gang', owner: 'Nina Vad', dueInDays: 18 },
    { title: 'Daglige belønninger i uge 1', status: 'ikke_startet', owner: 'Emil Storm', dueInDays: 30 },
  ],
});
addObjective(
  {
    id: 'obj-tm-gameplay',
    title: 'Onboarding der hooker nye spillere',
    description: 'De første minutter skal give en aha-oplevelse, så spilleren vil tilbage i morgen.',
    owner: 'Emil Storm (Team Lead)',
    level: 'team',
    parentObjectiveId: 'obj-tr-so',
    krs: [tmTutorial, tmLevel5],
  },
  0,
);

const tmEvent = kr({
  title: 'Event-deltagelse',
  owner: 'Clara Bisgaard',
  metricType: 'percent',
  baseline: 22,
  target: 40,
  current: 31,
  unit: '%',
  type: 'aspirational',
  profile: 'green',
  initiatives: [
    { title: 'Ugentligt weekend-event-format', status: 'færdig', owner: 'Clara Bisgaard', dueInDays: -5 },
    { title: 'Push-notifikation 1 time før event', status: 'i_gang', owner: 'Mads Friis', dueInDays: 8 },
  ],
});
const tmReturn = kr({
  title: 'Returnerende spillere efter event',
  owner: 'Mads Friis',
  metricType: 'percent',
  baseline: 35,
  target: 50,
  current: 38,
  unit: '%',
  type: 'committed',
  profile: 'yellow',
  initiatives: [
    { title: 'Belønning der kræver login dagen efter', status: 'i_gang', owner: 'Mads Friis', dueInDays: 14 },
    { title: 'Segmenteret re-engagement-kampagne', status: 'blokeret', owner: 'Clara Bisgaard', dueInDays: 25 },
  ],
});
addObjective(
  {
    id: 'obj-tm-liveops',
    title: 'Levende events der får spillere tilbage',
    description: 'Events skaber rytme og grunde til at vende tilbage. Vi gør dem til ugens højdepunkt.',
    owner: 'Clara Bisgaard (Team Lead)',
    level: 'team',
    parentObjectiveId: 'obj-tr-so',
    krs: [tmEvent, tmReturn],
  },
  1,
);

// ============================================================
// TEAMS under VÆKST
// ============================================================
const tmPaidInstalls = kr({
  title: 'Installationer fra betalt markedsføring',
  owner: 'Frederik Holm',
  metricType: 'number',
  baseline: 90000,
  target: 220000,
  current: 132000,
  unit: 'installs',
  type: 'aspirational',
  profile: 'green',
  initiatives: [
    { title: 'Skalér TikTok-kampagner til 3 nye markeder', status: 'i_gang', owner: 'Frederik Holm', dueInDays: 15 },
    { title: 'Ny kreativ-pipeline med 10 varianter/uge', status: 'i_gang', owner: 'Sara Lund', dueInDays: 22 },
  ],
});
const tmBlendedCac = kr({
  title: 'Blended CAC',
  owner: 'Sara Lund',
  metricType: 'currency',
  baseline: 14,
  target: 9,
  current: 12,
  unit: 'kr.',
  type: 'committed',
  profile: 'yellow',
  initiatives: [
    { title: 'Optimér budget-allokering pr. kanal', status: 'i_gang', owner: 'Sara Lund', dueInDays: 10 },
    { title: 'Styrk organisk ASO på 5 nøgleord', status: 'ikke_startet', owner: 'Frederik Holm', dueInDays: 28 },
  ],
});
addObjective(
  {
    id: 'obj-tm-acq',
    title: 'Skalér betalt acquisition uden at sprænge CAC',
    description: 'Vi henter flere spillere ind og holder prisen pr. spiller nede samtidig.',
    owner: 'Frederik Holm (Team Lead)',
    level: 'team',
    parentObjectiveId: 'obj-tr-v',
    krs: [tmPaidInstalls, tmBlendedCac],
  },
  0,
);

const tmPayerRate = kr({
  title: 'Betalerandel',
  owner: 'Ida Krogh',
  metricType: 'percent',
  baseline: 2.1,
  target: 4.0,
  current: 2.6,
  unit: '%',
  type: 'committed',
  profile: 'yellow',
  initiatives: [
    { title: 'Starter-pack til nye spillere dag 3', status: 'færdig', owner: 'Ida Krogh', dueInDays: -3 },
    { title: 'Battle pass for sæson 2', status: 'i_gang', owner: 'Victor Dam', dueInDays: 20 },
  ],
});
const tmPurchaseValue = kr({
  title: 'Gns. købsværdi',
  owner: 'Victor Dam',
  metricType: 'currency',
  baseline: 38,
  target: 55,
  current: 41,
  unit: 'kr.',
  type: 'aspirational',
  profile: 'red',
  initiatives: [
    { title: 'Bundling af populære items', status: 'blokeret', owner: 'Victor Dam', dueInDays: 16 },
    { title: 'Prisstigningstest i to markeder', status: 'ikke_startet', owner: 'Ida Krogh', dueInDays: 35 },
  ],
});
addObjective(
  {
    id: 'obj-tm-mon',
    title: 'Flere spillere betaler, og de betaler mere',
    description: 'Fair monetisering der føles som værdi, ikke pres. Vi øger både andel og værdi.',
    owner: 'Ida Krogh (Team Lead)',
    level: 'team',
    parentObjectiveId: 'obj-tr-v',
    krs: [tmPayerRate, tmPurchaseValue],
  },
  1,
);

// ============================================================
// TEAMS under PLATFORM & TEKNIK
// ============================================================
const tmUptime = kr({
  title: 'Oppetid',
  owner: 'Henrik Aaby',
  metricType: 'percent',
  baseline: 99.6,
  target: 99.95,
  current: 99.88,
  unit: '%',
  type: 'committed',
  profile: 'green',
  initiatives: [
    { title: 'Multi-region failover for spil-API', status: 'færdig', owner: 'Henrik Aaby', dueInDays: -8 },
    { title: 'Automatisk skalering ved event-spids', status: 'i_gang', owner: 'Petra Lind', dueInDays: 11 },
  ],
});
const tmApiLatency = kr({
  title: 'p95 API-svartid',
  owner: 'Petra Lind',
  metricType: 'number',
  baseline: 320,
  target: 150,
  current: 215,
  unit: 'ms',
  type: 'committed',
  profile: 'green',
  initiatives: [
    { title: 'Cache-lag foran matchmaking', status: 'færdig', owner: 'Petra Lind', dueInDays: -2 },
    { title: 'Optimér N+1-queries i inventory', status: 'i_gang', owner: 'Henrik Aaby', dueInDays: 9 },
  ],
});
addObjective(
  {
    id: 'obj-tm-infra',
    title: 'Rock-solid drift',
    description: 'Platformen skal bare virke — også når 200.000 spillere logger på til samme event.',
    owner: 'Henrik Aaby (Team Lead)',
    level: 'team',
    parentObjectiveId: 'obj-tr-p',
    krs: [tmUptime, tmApiLatency],
  },
  0,
);

const tmSelfServe = kr({
  title: 'Selvbetjente dashboards',
  owner: 'Maja Friis',
  metricType: 'percent',
  baseline: 40,
  target: 85,
  current: 58,
  unit: '%',
  type: 'aspirational',
  profile: 'yellow',
  initiatives: [
    { title: 'Selvbetjent metric-katalog', status: 'i_gang', owner: 'Maja Friis', dueInDays: 19 },
    { title: 'Onboarding-workshop for produktteams', status: 'ikke_startet', owner: 'Oscar Bay', dueInDays: 26 },
  ],
});
const tmFreshness = kr({
  title: 'Data-friskhed',
  owner: 'Oscar Bay',
  metricType: 'number',
  baseline: 6,
  target: 1,
  current: 5.2,
  unit: 'timer',
  type: 'committed',
  profile: 'fresh',
  initiatives: [
    { title: 'Streaming-pipeline for hændelsesdata', status: 'ikke_startet', owner: 'Oscar Bay', dueInDays: 40 },
  ],
});
addObjective(
  {
    id: 'obj-tm-data',
    title: 'Selvbetjent data til hele studiet',
    description: 'Beslutninger skal tages på friske, tilgængelige tal — uden at vente på datateamet.',
    owner: 'Maja Friis (Team Lead)',
    level: 'team',
    parentObjectiveId: 'obj-tr-p',
    krs: [tmSelfServe, tmFreshness],
  },
  1,
);

// ============================================================
// ALIGNMENT-KOBLINGER (mange-til-mange)
// child-KR  →  parent-KR
// ============================================================
let linkCounter = 0;
const link = (childKrId: string, parentKrId: string, weight = 1): AlignmentLink => ({
  id: `link-${++linkCounter}`,
  childKrId,
  parentKrId,
  weight,
});

const alignmentLinks: AlignmentLink[] = [
  // Team → Tribe (Spiloplevelse)
  link(tmTutorial.id, trD1.id, 2),
  link(tmLevel5.id, trD1.id, 1),
  link(tmReturn.id, trD1.id, 1),
  link(tmEvent.id, trSession.id, 2),
  link(tmLevel5.id, trSession.id, 1),

  // Team → Tribe (Vækst)
  link(tmPaidInstalls.id, trInstalls.id, 1),
  link(tmBlendedCac.id, trCac.id, 1),
  link(tmPayerRate.id, trArpdau.id, 1),
  link(tmPurchaseValue.id, trArpdau.id, 1),

  // Team → Tribe (Platform)
  link(tmUptime.id, trCrash.id, 1),
  link(tmApiLatency.id, trLoad.id, 2),

  // Tribe → Company
  link(trD1.id, coRetention.id, 2),
  link(trSession.id, coBeloved.id, 1),
  link(trInstalls.id, coBeloved.id, 2),
  link(trArpdau.id, coRevenue.id, 2),
  link(trCac.id, coMargin.id, 1),
  link(trCrash.id, coRating.id, 1),
  link(trLoad.id, coRating.id, 1),
];

// ============================================================
// CHECK-IN-HISTORIK: 8 ugentlige check-ins pr. KR.
// Value interpolerer baseline → current; confidence følger KR'ets profil.
// ============================================================
const WEEKS = 8;

// Deterministisk pseudo-tilfældig støj, så seedet er reproducerbart.
function noise(seedStr: string, i: number): number {
  let h = 2166136261;
  const s = seedStr + ':' + i;
  for (let k = 0; k < s.length; k++) {
    h ^= s.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000 - 0.5; // -0.5..0.5
}

const CONFIDENCE_BANDS: Record<KrSpec['profile'], [number, number]> = {
  green: [0.6, 0.85],
  yellow: [0.45, 0.65],
  red: [0.25, 0.38],
  fresh: [0.4, 0.5],
};

const COMMENTS: Record<KrSpec['profile'], string[]> = {
  green: [
    'God fremgang, initiativerne virker.',
    'På sporet — fortsætter samme kurs.',
    'Tallene følger planen pænt.',
    'Stærk uge, momentum holder.',
  ],
  yellow: [
    'Lidt bagud, men inden for rækkevidde.',
    'Vi holder øje — næste uge er vigtig.',
    'Fremgang, men langsommere end håbet.',
    'Et par initiativer trækker ud.',
  ],
  red: [
    'Bekymret. Vi mangler et gennembrud.',
    'Blokering på det vigtigste initiativ.',
    'Risiko for at vi ikke når target.',
    'Skal genbesøge tilgangen til næste uge.',
  ],
  fresh: ['Kommet sent i gang, pipeline mangler.', 'Afventer afhængighed fra andet team.'],
};

const checkIns: CheckIn[] = [];
const specByKrId = new Map<string, KrSpec>();
[
  coBeloved, coRetention, coRating, coRevenue, coMargin,
  trD1, trSession, trInstalls, trCac, trArpdau, trCrash, trLoad,
  tmTutorial, tmLevel5, tmEvent, tmReturn, tmPaidInstalls, tmBlendedCac,
  tmPayerRate, tmPurchaseValue, tmUptime, tmApiLatency, tmSelfServe, tmFreshness,
].forEach((k) => specByKrId.set(k.id, k));

const firstMonday = startOfWeek(subWeeks(today, WEEKS - 1), { weekStartsOn: 1 });
let ciCounter = 0;

for (const k of keyResults) {
  const spec = specByKrId.get(k.id);
  if (!spec) continue;
  const [confLo, confHi] = CONFIDENCE_BANDS[spec.profile];
  const owner = k.owner;
  // "fresh"-KR'er har kun de seneste 3 check-ins.
  const startWeek = spec.profile === 'fresh' ? WEEKS - 3 : 0;

  for (let w = startWeek; w < WEEKS; w++) {
    const frac = w / (WEEKS - 1); // 0..1
    const date = addDays(addWeeks(firstMonday, w), 1 + Math.round(noise(k.id + 'd', w))); // ~tirsdag
    // Værdi: baseline → current med let støj (sidste check-in rammer current præcist).
    let value: number;
    if (w === WEEKS - 1) {
      value = k.current;
    } else {
      const base = k.baseline + (k.current - k.baseline) * frac;
      const wobble = (k.current - k.baseline) * 0.06 * noise(k.id + 'v', w);
      value = base + wobble;
      value = k.metricType === 'percent' || k.metricType === 'currency'
        ? Math.round(value * 100) / 100
        : Math.round(value);
    }
    const confBase = confLo + (confHi - confLo) * frac;
    const confidence = Math.max(0.1, Math.min(0.95, confBase + 0.06 * noise(k.id + 'c', w)));
    const pool = COMMENTS[spec.profile];
    const comment = pool[(w + Math.abs(Math.round(noise(k.id, w) * 10))) % pool.length];

    checkIns.push({
      id: `ci-${++ciCounter}`,
      keyResultId: k.id,
      date: formatISO(date, { representation: 'date' }),
      value,
      confidence: Math.round(confidence * 100) / 100,
      comment,
      author: owner,
    });
  }
}

export const seedData = {
  cycles: [cycleQ1, cycleQ2],
  objectives,
  keyResults,
  initiatives,
  checkIns,
  alignmentLinks,
};

export type SeedData = typeof seedData;
