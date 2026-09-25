// Konkurrenter med parodinavne (spec 7.4). Rigtige navne findes KUN i src/data/archive.ts.
// Parametre: styrke / aggressivitet / innovation / opkøbslyst / compliance (1-5) [F-baseret vurdering].
import type { CompetitorArchetype, MarketId, ProductTypeId, ThemeId, Vertical } from '../sim/types';
import { ugeFor } from '../sim/time';

export type CompetitorDef = {
  id: string;
  navn: string;
  brands: string[]; // brandnavne til produkter
  arketype: CompetitorArchetype;
  arkivId: string;
  markeder: MarketId[];
  vertikaler: Vertical[];
  /** Styrke kan ændre sig over tid: [uge, styrke] */
  styrke: [number, number][];
  aggressivitet: number;
  innovation: number;
  opkoebslyst: number;
  compliance: number;
  fraUge: number;
  farve: string;
  monogram: string;
  /** Produkter, der er live ved spillets start */
  startProdukter: { navn: string; typeId: ProductTypeId; themeId: ThemeId; kvalitet: number; markeder: MarketId[] }[];
};

export const COMPETITORS: CompetitorDef[] = [
  {
    id: 'danskeLykke', navn: 'Danske Lykke', brands: ['Oddsæt', 'Lykke Kasino', 'Haven Kasino'], arketype: 'statsselskab', arkivId: 'dk-statsselskab',
    markeder: ['dk'], vertikaler: ['betting', 'kasino'], styrke: [[0, 5]], aggressivitet: 2, innovation: 2, opkoebslyst: 2, compliance: 5,
    fraUge: 0, farve: '#c8102e', monogram: 'DL',
    startProdukter: [
      { navn: 'Oddsæt', typeId: 'prematch', themeId: 'fodbold', kvalitet: 0.6, markeder: ['dk'] },
      { navn: 'Lykke Kasino', typeId: 'slotsAggregator', themeId: 'rigdom', kvalitet: 0.52, markeder: ['dk'] },
      { navn: 'Haven Kasino', typeId: 'slotsAggregator', themeId: 'eventyr', kvalitet: 0.56, markeder: ['dk'] },
    ],
  },
  {
    id: 'bet356', navn: 'bet356', brands: ['bet356'], arketype: 'globalGigant', arkivId: 'global-gigant-1',
    markeder: ['dk', 'uk', 'se', 'de', 'nl', 'on', 'us'], vertikaler: ['betting', 'kasino'], styrke: [[0, 4], [ugeFor(2019, 0), 4.3]],
    aggressivitet: 4, innovation: 4, opkoebslyst: 1, compliance: 4, fraUge: 0, farve: '#126e51', monogram: '356',
    startProdukter: [
      { navn: 'bet356 Live', typeId: 'livebetting', themeId: 'fodbold', kvalitet: 0.66, markeder: ['dk'] },
      { navn: 'bet356 Spil', typeId: 'slotsAggregator', themeId: 'retro', kvalitet: 0.5, markeder: ['dk'] },
      { navn: 'bet356 In-Play', typeId: 'livebetting', themeId: 'fodbold', kvalitet: 0.68, markeder: ['uk'] },
      { navn: 'bet356 Games', typeId: 'slotsAggregator', themeId: 'eventyr', kvalitet: 0.54, markeder: ['uk'] },
    ],
  },
  {
    id: 'unibit', navn: 'Unibit', brands: ['Unibit', 'Kinfolk'], arketype: 'nordiskLicensgruppe', arkivId: 'nordisk-gruppe-1',
    markeder: ['dk', 'uk', 'se', 'nl', 'fi'], vertikaler: ['betting', 'kasino'], styrke: [[0, 3.5], [ugeFor(2019, 0), 4], [ugeFor(2024, 9), 3.5]],
    aggressivitet: 3, innovation: 3, opkoebslyst: 3, compliance: 3, fraUge: 0, farve: '#1e8c3a', monogram: 'U',
    startProdukter: [
      { navn: 'Unibit Odds', typeId: 'prematch', themeId: 'fodbold', kvalitet: 0.58, markeder: ['dk'] },
      { navn: 'Unibit Kasino', typeId: 'slotsAggregator', themeId: 'eventyr', kvalitet: 0.5, markeder: ['dk'] },
      { navn: 'Unibit Sport', typeId: 'prematch', themeId: 'tennis', kvalitet: 0.56, markeder: ['uk'] },
    ],
  },
  {
    id: 'betssen', navn: 'Betssen', brands: ['NordikBet', 'Betssen'], arketype: 'nordiskLicensgruppe', arkivId: 'nordisk-gruppe-2',
    markeder: ['dk', 'se', 'fi'], vertikaler: ['betting', 'kasino'], styrke: [[0, 3]], aggressivitet: 3, innovation: 3, opkoebslyst: 4, compliance: 3,
    fraUge: 0, farve: '#f26b1d', monogram: 'NB',
    startProdukter: [{ navn: 'NordikBet', typeId: 'prematch', themeId: 'haandbold', kvalitet: 0.54, markeder: ['dk'] }],
  },
  {
    id: 'lionVegas', navn: 'LionVegas', brands: ['LionVegas'], arketype: 'appFirst', arkivId: 'app-first-1',
    markeder: ['dk', 'se', 'uk'], vertikaler: ['kasino', 'betting'], styrke: [[0, 3]], aggressivitet: 4, innovation: 4, opkoebslyst: 2, compliance: 3,
    fraUge: 0, farve: '#f5a300', monogram: 'LV',
    startProdukter: [
      { navn: 'LionVegas Kasino', typeId: 'slotsAggregator', themeId: 'rigdom', kvalitet: 0.56, markeder: ['dk'] },
      { navn: 'LionVegas Slots', typeId: 'slotsAggregator', themeId: 'mytologi', kvalitet: 0.57, markeder: ['uk'] },
    ],
  },
  {
    id: 'komNu', navn: 'KomNu', brands: ['KomNu', 'Mr Grøn', 'Bet52'], arketype: 'lokalSpecialist', arkivId: 'lokal-specialist-1',
    markeder: ['dk', 'se'], vertikaler: ['betting', 'kasino'], styrke: [[0, 2]], aggressivitet: 3, innovation: 2, opkoebslyst: 1, compliance: 3,
    fraUge: 0, farve: '#2fae66', monogram: 'KN',
    startProdukter: [
      { navn: 'Bet52', typeId: 'prematch', themeId: 'fodbold', kvalitet: 0.5, markeder: ['dk'] },
      { navn: 'Mr Grøn', typeId: 'slotsAggregator', themeId: 'natur', kvalitet: 0.52, markeder: ['dk'] },
    ],
  },
  {
    id: 'betanu', navn: 'Betanu', brands: ['Betanu'], arketype: 'appFirst', arkivId: 'app-first-2',
    markeder: ['dk'], vertikaler: ['betting', 'kasino'], styrke: [[0, 2], [ugeFor(2024, 0), 3], [ugeFor(2026, 0), 4]], aggressivitet: 5, innovation: 3, opkoebslyst: 2, compliance: 3,
    fraUge: ugeFor(2023, 0), farve: '#ff5a1f', monogram: 'BT', startProdukter: [],
  },
  {
    id: 'sveaSpel', navn: 'Svea Spel', brands: ['Svea Spel', 'Svea Kasino'], arketype: 'statsselskab', arkivId: 'se-statsselskab',
    markeder: ['se'], vertikaler: ['betting', 'kasino'], styrke: [[0, 5]], aggressivitet: 2, innovation: 2, opkoebslyst: 1, compliance: 5,
    fraUge: 0, farve: '#0b5aa6', monogram: 'SS', startProdukter: [],
  },
  {
    id: 'ath', navn: 'ATH', brands: ['ATH', 'ATH Trav'], arketype: 'lokalSpecialist', arkivId: 'se-lokal',
    markeder: ['se'], vertikaler: ['betting'], styrke: [[0, 4]], aggressivitet: 2, innovation: 2, opkoebslyst: 1, compliance: 5,
    fraUge: 0, farve: '#2a3f8f', monogram: 'ATH', startProdukter: [],
  },
  {
    id: 'flitter', navn: 'Flitter', brands: ['Paddy Flower', 'Betfare', 'Skye Bet'], arketype: 'globalGigant', arkivId: 'global-gigant-2',
    markeder: ['uk'], vertikaler: ['betting', 'kasino'], styrke: [[0, 4.5], [ugeFor(2020, 4), 5]], aggressivitet: 4, innovation: 5, opkoebslyst: 5, compliance: 3,
    fraUge: 0, farve: '#0e6f4e', monogram: 'FL',
    startProdukter: [
      { navn: 'Paddy Flower', typeId: 'prematch', themeId: 'fodbold', kvalitet: 0.68, markeder: ['uk'] },
      { navn: 'Betfare Exchange', typeId: 'livebetting', themeId: 'tennis', kvalitet: 0.7, markeder: ['uk'] },
      { navn: 'Skye Bet Vegas', typeId: 'slotsAggregator', themeId: 'rigdom', kvalitet: 0.6, markeder: ['uk'] },
    ],
  },
  {
    id: 'entrain', navn: 'Entrain', brands: ['Ladbrooks', 'Koral', 'bwon', 'BetTown'], arketype: 'globalGigant', arkivId: 'global-gigant-3',
    markeder: ['uk', 'de', 'nl'], vertikaler: ['betting', 'kasino'], styrke: [[0, 4]], aggressivitet: 3, innovation: 3, opkoebslyst: 5, compliance: 2,
    fraUge: 0, farve: '#233a73', monogram: 'EN',
    startProdukter: [
      { navn: 'Ladbrooks Sport', typeId: 'prematch', themeId: 'fodbold', kvalitet: 0.62, markeder: ['uk'] },
      { navn: 'Koral Casino', typeId: 'slotsAggregator', themeId: 'retro', kvalitet: 0.56, markeder: ['uk'] },
    ],
  },
  {
    id: 'williamHull', navn: 'William Hull', brands: ['William Hull'], arketype: 'globalGigant', arkivId: 'global-gigant-4',
    markeder: ['uk'], vertikaler: ['betting', 'kasino'], styrke: [[0, 3.5], [ugeFor(2022, 6), 3]], aggressivitet: 3, innovation: 2, opkoebslyst: 2, compliance: 2,
    fraUge: 0, farve: '#1b3b6f', monogram: 'WH',
    startProdukter: [{ navn: 'William Hull Sport', typeId: 'prematch', themeId: 'haandbold', kvalitet: 0.58, markeder: ['uk'] }],
  },
  {
    id: 'betfried', navn: 'Betfried', brands: ['Betfried'], arketype: 'lokalSpecialist', arkivId: 'uk-lokal',
    markeder: ['uk'], vertikaler: ['betting', 'kasino'], styrke: [[0, 3]], aggressivitet: 2, innovation: 2, opkoebslyst: 1, compliance: 3,
    fraUge: 0, farve: '#1f5fad', monogram: 'BF',
    startProdukter: [{ navn: 'Betfried Odds', typeId: 'prematch', themeId: 'fodbold', kvalitet: 0.55, markeder: ['uk'] }],
  },
  {
    id: 'tulipan', navn: 'Tulipan Kasino', brands: ['Tulipan Kasino', 'Totto'], arketype: 'statsselskab', arkivId: 'nl-statsselskab',
    markeder: ['nl'], vertikaler: ['betting', 'kasino'], styrke: [[0, 4]], aggressivitet: 2, innovation: 2, opkoebslyst: 2, compliance: 5,
    fraUge: 0, farve: '#e87722', monogram: 'TK', startProdukter: [],
  },
  {
    id: 'jax', navn: 'Jax', brands: ['Jax'], arketype: 'lokalSpecialist', arkivId: 'nl-lokal',
    markeder: ['nl'], vertikaler: ['kasino', 'betting'], styrke: [[0, 3]], aggressivitet: 3, innovation: 3, opkoebslyst: 2, compliance: 3,
    fraUge: 0, farve: '#b8002e', monogram: 'JX', startProdukter: [],
  },
  {
    id: 'typico', navn: 'Typico', brands: ['Typico'], arketype: 'lokalSpecialist', arkivId: 'de-lokal-1',
    markeder: ['de'], vertikaler: ['betting', 'kasino'], styrke: [[0, 4]], aggressivitet: 4, innovation: 3, opkoebslyst: 2, compliance: 4,
    fraUge: 0, farve: '#c8102e', monogram: 'TY', startProdukter: [],
  },
  {
    id: 'interwette', navn: 'Interwette', brands: ['Interwette'], arketype: 'lokalSpecialist', arkivId: 'de-lokal-2',
    markeder: ['de'], vertikaler: ['betting', 'kasino'], styrke: [[0, 3]], aggressivitet: 3, innovation: 3, opkoebslyst: 2, compliance: 3,
    fraUge: 0, farve: '#f6b800', monogram: 'IW', startProdukter: [],
  },
  {
    id: 'veikko', navn: 'Veikko', brands: ['Veikko'], arketype: 'statsselskab', arkivId: 'fi-statsselskab',
    markeder: ['fi'], vertikaler: ['betting', 'kasino'], styrke: [[0, 5], [ugeFor(2027, 6), 4], [ugeFor(2029, 0), 3]], aggressivitet: 3, innovation: 2, opkoebslyst: 1, compliance: 5,
    fraUge: 0, farve: '#2f4f9f', monogram: 'VK', startProdukter: [],
  },
  {
    id: 'norskTipp', navn: 'Norsk Tipp', brands: ['Norsk Tipp'], arketype: 'statsselskab', arkivId: 'no-statsselskab',
    markeder: ['no'], vertikaler: ['betting', 'kasino'], styrke: [[0, 4]], aggressivitet: 1, innovation: 2, opkoebslyst: 0, compliance: 5,
    fraUge: 0, farve: '#ba0c2f', monogram: 'NT', startProdukter: [],
  },
  {
    id: 'funDuel', navn: 'FunDuel', brands: ['FunDuel'], arketype: 'globalGigant', arkivId: 'us-gigant-1',
    markeder: ['us', 'on'], vertikaler: ['betting', 'kasino'], styrke: [[0, 5]], aggressivitet: 4, innovation: 5, opkoebslyst: 4, compliance: 3,
    fraUge: 0, farve: '#1493ff', monogram: 'FD', startProdukter: [],
  },
  {
    id: 'draftQueens', navn: 'DraftQueens', brands: ['DraftQueens'], arketype: 'appFirst', arkivId: 'us-gigant-2',
    markeder: ['us', 'on'], vertikaler: ['betting', 'kasino'], styrke: [[0, 5]], aggressivitet: 5, innovation: 5, opkoebslyst: 4, compliance: 3,
    fraUge: 0, farve: '#53d337', monogram: 'DQ', startProdukter: [],
  },
  {
    id: 'betMgn', navn: 'BetMGN', brands: ['BetMGN', 'Cæsar', 'Fanatix', 'theScoop'], arketype: 'globalGigant', arkivId: 'us-gruppe',
    markeder: ['us', 'on'], vertikaler: ['betting', 'kasino'], styrke: [[0, 3]], aggressivitet: 4, innovation: 3, opkoebslyst: 4, compliance: 3,
    fraUge: 0, farve: '#b39b5c', monogram: 'MG', startProdukter: [],
  },
  {
    id: 'kalshee', navn: 'Kalshee', brands: ['Kalshee', 'Polymarkt'], arketype: 'predictionMarket', arkivId: 'us-pm',
    markeder: ['us'], vertikaler: ['betting'], styrke: [[0, 2], [ugeFor(2026, 0), 3], [ugeFor(2027, 0), 4]], aggressivitet: 5, innovation: 5, opkoebslyst: 2, compliance: 2,
    fraUge: ugeFor(2025, 0), farve: '#00c2a8', monogram: 'KA', startProdukter: [],
  },
  {
    id: 'agentix', navn: 'Agentix', brands: ['Agentix'], arketype: 'aiNative', arkivId: 'fiktiv-ai',
    markeder: ['dk', 'uk', 'se', 'de', 'nl', 'on', 'us', 'fi'], vertikaler: ['betting', 'kasino'], styrke: [[0, 2], [ugeFor(2030, 0), 3], [ugeFor(2032, 0), 4]],
    aggressivitet: 5, innovation: 5, opkoebslyst: 3, compliance: 2, fraUge: ugeFor(2028, 0), farve: '#9b5cff', monogram: 'AX', startProdukter: [],
  },
];

/** B2B-leverandører (spec 7.4: Kombi, Revo Live) — sælger platform og indhold, deltager ikke i markedsandelene */
export type LeverandoerDef = { id: string; navn: string; arkivId: string; leverer: 'sportsbook' | 'livekasino'; innovation: number; compliance: number; fraUge: number; farve: string; monogram: string };
export const LEVERANDOERER: LeverandoerDef[] = [
  { id: 'kombi', navn: 'Kombi', arkivId: 'b2b-sportsbook', leverer: 'sportsbook', innovation: 4, compliance: 4, fraUge: ugeFor(2014, 5), farve: '#4a6fa5', monogram: 'KB' },
  { id: 'revoLive', navn: 'Revo Live', arkivId: 'b2b-live', leverer: 'livekasino', innovation: 5, compliance: 4, fraUge: 0, farve: '#7a1f3d', monogram: 'RL' },
];

/** Alle konkurrenter fra spec 7.4 (parodinavne). Offshore-aktøren er en grå andel, ikke en produktkonkurrent. */
export const COMPETITOR_IDS = COMPETITORS.map((c) => c.id);

/** Grå offshore-aktør i andelene */
export const OFFSHORE_AKTOER = { id: 'offshore', navn: 'Steak.com & co.', farve: '#6b6b6b', monogram: 'S&' };

/** Produktnavne-suffikser til konkurrenternes nye lanceringer */
export const PRODUKT_SUFFIKS: Record<ProductTypeId, string[]> = {
  prematch: ['Odds', 'Sport', 'Kupon', 'Fodboldodds', 'Weekend'],
  livebetting: ['Live', 'In-Play', 'Live Arena', 'Liveodds'],
  betBuilder: ['Byg Selv', 'Kombi', 'BetBuilder'],
  esport: ['Esport', 'Arena', 'GG Odds'],
  eventKontrakter: ['Udfald', 'Kontrakter', 'Forudsig'],
  slotsAggregator: ['Kasino', 'Spillehal', 'Slots', 'Automater'],
  egneSlots: ['Originals', 'Studio', 'Eksklusiv'],
  livekasino: ['Live Kasino', 'Bordspil', 'Salonen'],
  jackpotNetvaerk: ['Jackpot', 'Mega Pulje', 'Kæmpepotten'],
  aiSlots: ['AI Spil', 'Generativ', 'Auto Slots'],
};
