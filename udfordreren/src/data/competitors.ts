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
    ],
  },
  {
    id: 'unibit', navn: 'Unibit', brands: ['Unibit', 'Kinfolk'], arketype: 'nordiskLicensgruppe', arkivId: 'nordisk-gruppe-1',
    markeder: ['dk', 'uk', 'se', 'nl', 'fi'], vertikaler: ['betting', 'kasino'], styrke: [[0, 3.5], [ugeFor(2019, 0), 4], [ugeFor(2024, 9), 3.5]],
    aggressivitet: 3, innovation: 3, opkoebslyst: 3, compliance: 3, fraUge: 0, farve: '#1e8c3a', monogram: 'U',
    startProdukter: [
      { navn: 'Unibit Odds', typeId: 'prematch', themeId: 'fodbold', kvalitet: 0.58, markeder: ['dk'] },
      { navn: 'Unibit Kasino', typeId: 'slotsAggregator', themeId: 'eventyr', kvalitet: 0.5, markeder: ['dk'] },
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
    startProdukter: [{ navn: 'LionVegas Kasino', typeId: 'slotsAggregator', themeId: 'rigdom', kvalitet: 0.56, markeder: ['dk'] }],
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
];

/** Fase 1-2: Danske Lykke + 5 konkurrenter i dk (spec 9 kræver mindst 3). Resten af 7.4 kommer i fase 4. */
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
