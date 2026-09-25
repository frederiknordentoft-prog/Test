// Trend-events og sportskalender (spec 7.9). [F-mønster], [D]-størrelser.
import type { MarketId, TrendEffect } from '../sim/types';
import { ugeFor } from '../sim/time';

export type TrendDef = {
  id: string;
  titel: string;
  tekst: string;
  effekt: TrendEffect;
  markeder: MarketId[] | 'alle';
  /** Politisk pres ved start (i de berørte markeder) */
  pres?: number;
  kilde: string;
};

const EUROPA: MarketId[] = ['dk', 'uk', 'se', 'de', 'nl', 'fi', 'no'];

/** Faste trends: [trendId, startuge, varighed i uger] */
export type FastTrend = { trendId: string; uge: number; uger: number; titel?: string };

export const TRENDS: Record<string, TrendDef> = {
  em: {
    id: 'em', titel: 'EM i fodbold', tekst: 'EM-slutrunden sætter gang i bettingen.', markeder: EUROPA,
    effekt: { bettingBsi: 0.2, kasinoBsi: 0.03 }, kilde: '[F-mønster] +15-30 % betting i måneden',
  },
  vm: {
    id: 'vm', titel: 'VM i fodbold', tekst: 'VM-slutrunden sætter gang i bettingen.', markeder: 'alle',
    effekt: { bettingBsi: 0.25, kasinoBsi: 0.03 }, kilde: '[F-mønster] +15-30 % betting i måneden',
  },
  covid: {
    id: 'covid', titel: 'Covid-19 lukker sporten', tekst: 'Næsten al sport er aflyst. Bettingen styrtdykker, kasino stiger.', markeder: 'alle',
    effekt: { bettingBsi: -0.6, kasinoBsi: 0.2 }, kilde: '[F] 2020-03: betting −60 %, kasino +20 %',
  },
  covidEfter: {
    id: 'covidEfter', titel: 'Sporten vender langsomt tilbage', tekst: 'Kampe uden tilskuere og et presset kampprogram.', markeder: 'alle',
    effekt: { bettingBsi: -0.15, kasinoBsi: 0.08 }, kilde: '[D]',
  },
  inflation: {
    id: 'inflation', titel: 'Inflation og krise', tekst: 'Høje priser presser forbruget, og statsbudgetterne strammes.', markeder: 'alle',
    effekt: { bettingBsi: -0.05, kasinoBsi: -0.05, afgiftRisiko: 0.3 }, kilde: '[F-mønster] 2022-23',
  },
  kryptoBoom: {
    id: 'kryptoBoom', titel: 'Krypto-boom', tekst: 'Kryptokasinoer lokker med anonyme indbetalinger.', markeder: 'alle',
    effekt: { offshorePp: 5 }, kilde: '[F-mønster] +5 pp offshore i 12 mdr.',
  },
  kryptoKrak: {
    id: 'kryptoKrak', titel: 'Krypto-krak', tekst: 'Kryptokursen falder, og offshore mister spillere.', markeder: 'alle',
    effekt: { offshorePp: -3 }, kilde: '[F-mønster] −3 pp i 6-12 mdr.',
  },
  streamere: {
    id: 'streamere', titel: 'Streamer-gambling', tekst: 'Kendte streamere spiller på offshore-kasinoer for unge seere.', markeder: EUROPA,
    effekt: { offshorePp: 3 }, pres: 1, kilde: '[F-mønster] 2021-23: +3 pp (unge), pres +1',
  },
  sweeps: {
    id: 'sweeps', titel: 'Sweeps-boom', tekst: 'Sweeps-kasinoer udnytter et hul i lovgivningen.', markeder: ['us'],
    effekt: { offshorePp: 8 }, kilde: '[F-mønster] 2022-25',
  },
  afgiftsvinter: {
    id: 'afgiftsvinter', titel: 'Afgiftsvinteren', tekst: 'Højere afgifter over hele Europa sender spillere offshore.', markeder: ['dk', 'uk', 'se', 'de', 'nl', 'fi'],
    effekt: { offshorePp: 3, afgiftRisiko: 0.2 }, kilde: '[D] spec 7.14: kanalisering −3 til −8 pp',
  },
  agentBoelge: {
    id: 'agentBoelge', titel: 'Kundernes AI-agenter', tekst: 'Kunderne lader deres egne AI-agenter finde de bedste odds og bonusser.', markeder: 'alle',
    effekt: { marketingRoi: -0.05 }, kilde: '[D] spec 6.16',
  },
  predictionMarkets: {
    id: 'predictionMarkets', titel: 'Prediction markets', tekst: 'Event-kontrakter på sport tager omsætning fra sportsbetting.', markeder: ['us'],
    effekt: { bettingBsi: -0.08 }, kilde: '[F] $44-50 mia. i volumen i 2025; [D] −5 til −15 %',
  },
  dokumentar: {
    id: 'dokumentar', titel: 'Dokumentar om ludomani', tekst: 'En dokumentar sætter spilproblemer på dagsordenen.', markeder: EUROPA,
    effekt: { marketingRoi: -0.1 }, pres: 1, kilde: '[D] pres +1, marketing-ROI −10 % i 6 mdr.',
  },
  mobilBoelge: {
    id: 'mobilBoelge', titel: 'Mobil- og livekasino-bølgen', tekst: 'Spillerne flytter til telefonen og live-borde.', markeder: 'alle',
    effekt: {}, kilde: '[F-mønster] 2013-2025, ligger i markedskurverne',
  },
};

/** VM/EM-år med startuge (juni; VM 2022 i nov.-dec.) [F] */
export const SPORTSKALENDER: FastTrend[] = [
  { trendId: 'em', uge: ugeFor(2012, 5) + 1, uger: 4, titel: 'EM 2012' },
  { trendId: 'vm', uge: ugeFor(2014, 5) + 2, uger: 5, titel: 'VM 2014' },
  { trendId: 'em', uge: ugeFor(2016, 5) + 2, uger: 5, titel: 'EM 2016' },
  { trendId: 'vm', uge: ugeFor(2018, 5) + 2, uger: 5, titel: 'VM 2018' },
  { trendId: 'em', uge: ugeFor(2021, 5) + 2, uger: 5, titel: 'EM 2020 (spillet 2021)' },
  { trendId: 'vm', uge: ugeFor(2022, 10) + 3, uger: 5, titel: 'VM 2022' },
  { trendId: 'em', uge: ugeFor(2024, 5) + 2, uger: 5, titel: 'EM 2024' },
  { trendId: 'vm', uge: ugeFor(2026, 5) + 2, uger: 6, titel: 'VM 2026' },
  { trendId: 'em', uge: ugeFor(2028, 5) + 2, uger: 5, titel: 'EM 2028' },
  { trendId: 'vm', uge: ugeFor(2030, 5) + 2, uger: 6, titel: 'VM 2030' },
  { trendId: 'em', uge: ugeFor(2032, 5) + 2, uger: 5, titel: 'EM 2032' },
  { trendId: 'vm', uge: ugeFor(2034, 5) + 2, uger: 6, titel: 'VM 2034' },
];

/** Historiske trends med faste datoer [F-mønster] */
export const FASTE_TRENDS: FastTrend[] = [
  { trendId: 'mobilBoelge', uge: ugeFor(2013, 3), uger: 4 },
  { trendId: 'kryptoBoom', uge: ugeFor(2017, 3), uger: 52 },
  { trendId: 'kryptoKrak', uge: ugeFor(2018, 3), uger: 36 },
  { trendId: 'covid', uge: ugeFor(2020, 2) + 2, uger: 14 },
  { trendId: 'covidEfter', uge: ugeFor(2020, 5) + 3, uger: 24 },
  { trendId: 'kryptoBoom', uge: ugeFor(2021, 0), uger: 52 },
  { trendId: 'streamere', uge: ugeFor(2021, 3), uger: 104 },
  { trendId: 'sweeps', uge: ugeFor(2022, 0), uger: 182 },
  { trendId: 'inflation', uge: ugeFor(2022, 3), uger: 78 },
  { trendId: 'kryptoKrak', uge: ugeFor(2022, 5), uger: 40 },
  { trendId: 'kryptoBoom', uge: ugeFor(2024, 3), uger: 60 },
  { trendId: 'predictionMarkets', uge: ugeFor(2025, 0), uger: 156 },
];

/** Tilfældige trends pr. år [D] */
export const TILFAELDIGE_TRENDS: { trendId: string; chancePrAar: number; uger: [number, number]; fraAar: number; tilAar: number }[] = [
  { trendId: 'dokumentar', chancePrAar: 1.2, uger: [20, 30], fraAar: 2013, tilAar: 2035 },
  { trendId: 'inflation', chancePrAar: 0.1, uger: [52, 104], fraAar: 2026, tilAar: 2035 },
];
