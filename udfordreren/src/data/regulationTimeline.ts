// Regler: historiske tidslinjer (spec 7.2, 7.5) og puljen til dynamisk regulering (spec 7.7).
// [F] = fakta, [D] = designestimat for effektstørrelser.
import type { AcqChannel, MarketId, Vertical } from '../sim/types';
import { ugeFor } from '../sim/time';

export type RegelEffekt = {
  /** Tillæg på CAC pr. kanal (0,4 = +40 %) */
  cac?: Partial<Record<AcqChannel, number>>;
  lukKanal?: AcqChannel[];
  bonusMax?: 0 | 1 | 2 | 3;
  vipMax?: 0 | 1 | 2 | 3;
  /** Ændring i BSI pr. kunde pr. vertikal (−0,15 = −15 %) */
  arpu?: Partial<Record<Vertical, number>>;
  afgiftPp?: number;
  offshorePp?: number;
  kraeverRisikoAgent?: boolean;
  marketingEffekt?: number;
  blokering?: 'dns' | 'betaling' | 'leverandoer';
};

export type RegelDef = { id: string; navn: string; beskrivelse: string; effekt: RegelEffekt; kilde: string };

export const REGLER: Record<string, RegelDef> = {
  // --- Historiske regler ---
  dkSpilpakke1: {
    id: 'dkSpilpakke1', navn: 'Spilpakke 1', kilde: '[F] aftalt okt. 2025, i kraft 1. juli 2026',
    beskrivelse: 'Udvidet whistle-to-whistle-forbud, forbud mod omsætningsbaseret affiliate-provision og mod free-to-play-velkomstbonusser.',
    effekt: { cac: { tv: 0.4, affiliate: 0.3 }, bonusMax: 1 },
  },
  dkSpilpakke1b: {
    id: 'dkSpilpakke1b', navn: 'Spilpakke 1, del 2', kilde: '[F] dele fra 1. januar 2027',
    beskrivelse: 'Forbud mod brand-ambassadører under 25 år.',
    effekt: { cac: { sponsorat: 0.2, streamere: 0.3, sociale: 0.1 } },
  },
  ukSlotgraenser: {
    id: 'ukSlotgraenser', navn: 'Indsatsgrænser på slots', kilde: '[F] £5/£2 i 2025',
    beskrivelse: 'Online slots får indsatsgrænser på £5 (voksne) og £2 (18-24 år).',
    effekt: { arpu: { kasino: -0.08 } },
  },
  ukBonus10x: {
    id: 'ukBonus10x', navn: 'Bonuskrav loftet til 10x', kilde: '[F] 2026',
    beskrivelse: 'Gennemspilskrav på bonusser må højst være 10x.',
    effekt: { bonusMax: 1 },
  },
  ukAffordability: {
    id: 'ukAffordability', navn: 'Affordability-tjek', kilde: '[F] 2026',
    beskrivelse: 'Økonomiske tjek af kunder med højt forbrug.',
    effekt: { arpu: { kasino: -0.06, betting: -0.04 } },
  },
  ukSponsorForbud: {
    id: 'ukSponsorForbud', navn: 'Ingen spilsponsor på brystet', kilde: '[F] Premier League fra 2026/27',
    beskrivelse: 'Klubberne fjerner spilsponsorer fra trøjernes front.',
    effekt: { cac: { sponsorat: 0.5 }, marketingEffekt: -0.1 },
  },
  seKreditforbud: {
    id: 'seKreditforbud', navn: 'Kreditforbud', kilde: '[F] 2026',
    beskrivelse: 'Forbud mod spil på kredit.',
    effekt: { arpu: { kasino: -0.03, betting: -0.03 } },
  },
  nlReklameforbud: {
    id: 'nlReklameforbud', navn: 'Reklameforbud', kilde: '[F] 2023',
    beskrivelse: 'Forbud mod ikke-målrettet reklame og rollemodeller.',
    effekt: { cac: { tv: 0.5, sponsorat: 0.5, sociale: 0.3 }, lukKanal: ['streamere'] },
  },
  nlGraenser: {
    id: 'nlGraenser', navn: 'Indbetalingsgrænser', kilde: '[F] oktober 2024',
    beskrivelse: 'Standardgrænser for indbetaling, strengere for unge.',
    effekt: { arpu: { kasino: -0.15, betting: -0.05 } },
  },
  deGraenser: {
    id: 'deGraenser', navn: 'Månedsgrænse og spin-regler', kilde: '[F] 2021: €1.000/md., €1/spin, 5-sek.-pause',
    beskrivelse: 'Fælles månedsgrænse, indsatsgrænse og pause mellem spins.',
    effekt: { arpu: { kasino: -0.25, betting: -0.05 }, bonusMax: 1 },
  },
  fiAffiliateForbud: {
    id: 'fiAffiliateForbud', navn: 'Affiliate-forbud', kilde: '[F] fra åbningen i 2027',
    beskrivelse: 'Markedsføring via affiliates er forbudt.',
    effekt: { lukKanal: ['affiliate'] },
  },
  noDns: {
    id: 'noDns', navn: 'DNS-blokering', kilde: '[F] 2025',
    beskrivelse: 'Norge blokerer ulovlige spilsider via DNS.',
    effekt: { blokering: 'dns' },
  },
  usSweepsForbud: {
    id: 'usSweepsForbud', navn: 'Sweepstakes-forbud', kilde: '[F] flere delstater i 2025',
    beskrivelse: 'Flere delstater forbyder sweepstakes-kasinoer.',
    effekt: { offshorePp: -5 },
  },
  // --- Dynamisk pulje (spec 7.7) ---
  reklamevindue: {
    id: 'reklamevindue', navn: 'Reklamevindue', kilde: '[D] spec 7.7',
    beskrivelse: 'Spilreklamer kun i bestemte tidsrum.',
    effekt: { cac: { tv: 0.4, sponsorat: 0.4 } },
  },
  bonusloft: {
    id: 'bonusloft', navn: 'Bonusloft', kilde: '[D] spec 7.7',
    beskrivelse: 'Bonusser loftes til et beskedent niveau.',
    effekt: { bonusMax: 1 },
  },
  indsatsgraenseKasino: {
    id: 'indsatsgraenseKasino', navn: 'Indsatsgrænse på kasino', kilde: '[D] spec 7.7',
    beskrivelse: 'Maksimal indsats pr. spin på kasinospil.',
    effekt: { arpu: { kasino: -0.15 } },
  },
  affordability: {
    id: 'affordability', navn: 'Affordability', kilde: '[D] spec 7.7',
    beskrivelse: 'Økonomiske tjek af kunder med højt forbrug.',
    effekt: { arpu: { kasino: -0.08, betting: -0.05 }, vipMax: 1 },
  },
  afgiftsstigning: {
    id: 'afgiftsstigning', navn: 'Afgiftsstigning', kilde: '[D] spec 7.7: +3-8 pp',
    beskrivelse: 'Spilafgiften hæves.',
    effekt: { afgiftPp: 5 },
  },
  streamerForbud: {
    id: 'streamerForbud', navn: 'Streamer-forbud', kilde: '[D] spec 7.7',
    beskrivelse: 'Markedsføring via streamere og gamefluencere forbydes.',
    effekt: { lukKanal: ['streamere'] },
  },
  aiRisikokrav: {
    id: 'aiRisikokrav', navn: 'AI-risikokrav', kilde: '[D] spec 7.7',
    beskrivelse: 'Operatører skal bruge AI-baseret risikodetektion.',
    effekt: { kraeverRisikoAgent: true },
  },
  // --- R11 ---
  dnsBlokering: {
    id: 'dnsBlokering', navn: 'DNS-blokering', kilde: '[D] R11',
    beskrivelse: 'Myndighederne blokerer ulovlige spilsider.',
    effekt: { blokering: 'dns' },
  },
  betalingsblokering: {
    id: 'betalingsblokering', navn: 'Betalingsblokering', kilde: '[D] R11',
    beskrivelse: 'Banker må ikke gennemføre betalinger til ulovlige spilsider.',
    effekt: { blokering: 'betaling' },
  },
  lempelse: {
    id: 'lempelse', navn: 'Lempelse', kilde: '[D] R11',
    beskrivelse: 'Reglerne lempes for at trække spillerne tilbage fra offshore.',
    effekt: { afgiftPp: -3, offshorePp: -2 },
  },
};

/** Historisk tidslinje: træder i kraft `uge`, annonceres `varsel` uger før (6-12 mdr.) */
export const HISTORISKE_REGLER: { marked: MarketId; regelId: string; uge: number; varsel: number }[] = [
  { marked: 'de', regelId: 'deGraenser', uge: ugeFor(2021, 6), varsel: 0 },
  { marked: 'nl', regelId: 'nlReklameforbud', uge: ugeFor(2023, 6), varsel: 30 },
  { marked: 'nl', regelId: 'nlGraenser', uge: ugeFor(2024, 9), varsel: 30 },
  { marked: 'uk', regelId: 'ukSlotgraenser', uge: ugeFor(2025, 3), varsel: 40 },
  { marked: 'no', regelId: 'noDns', uge: ugeFor(2025, 0), varsel: 30 },
  { marked: 'us', regelId: 'usSweepsForbud', uge: ugeFor(2025, 6), varsel: 26 },
  { marked: 'uk', regelId: 'ukBonus10x', uge: ugeFor(2026, 0), varsel: 40 },
  { marked: 'se', regelId: 'seKreditforbud', uge: ugeFor(2026, 0), varsel: 30 },
  { marked: 'uk', regelId: 'ukAffordability', uge: ugeFor(2026, 3), varsel: 40 },
  { marked: 'dk', regelId: 'dkSpilpakke1', uge: ugeFor(2026, 6), varsel: 38 },
  { marked: 'uk', regelId: 'ukSponsorForbud', uge: ugeFor(2026, 7), varsel: 50 },
  { marked: 'dk', regelId: 'dkSpilpakke1b', uge: ugeFor(2027, 0), varsel: 30 },
  { marked: 'fi', regelId: 'fiAffiliateForbud', uge: ugeFor(2027, 6), varsel: 40 },
];

/** Pulje til dynamisk regulering (spec 7.7). AI-risikokrav kun fra 2028 [D]. */
export const DYNAMISK_PULJE: { regelId: string; vaegt: number; fraAar: number }[] = [
  { regelId: 'reklamevindue', vaegt: 3, fraAar: 2012 },
  { regelId: 'bonusloft', vaegt: 3, fraAar: 2012 },
  { regelId: 'indsatsgraenseKasino', vaegt: 2, fraAar: 2012 },
  { regelId: 'affordability', vaegt: 2, fraAar: 2016 },
  { regelId: 'afgiftsstigning', vaegt: 2, fraAar: 2012 },
  { regelId: 'streamerForbud', vaegt: 2, fraAar: 2018 },
  { regelId: 'aiRisikokrav', vaegt: 2, fraAar: 2028 },
];

/** Dynamisk regulering: ved pres ≥ 3 planlægges en regel, der træder i kraft efter 52-104 uger (spec 7.7) */
export const DYNAMISK = { presTaerskel: 3, forsinkelse: [52, 104] as const, presEfter: 1, varselMin: 26 };

/** Prævalensmålinger, der hæver presset (spec 7.7) */
export const PRAEVALENSMAALINGER: { aar: number; markeder: MarketId[] }[] = [
  { aar: 2021, markeder: ['dk', 'se'] },
  { aar: 2026, markeder: ['dk', 'se', 'uk'] },
  { aar: 2031, markeder: ['dk', 'se', 'uk', 'nl'] },
];

/** R11: kanaliseringsmål (spec 7.6) */
export const KANALISERINGSMAAL: Partial<Record<MarketId, number>> = { dk: 0.9, se: 0.9, nl: 0.8 };
