// Produkttyper (spec 7.1). Margin = 1 − RTP / hold. Risiko 0-10.
import type { ProductTypeId, Role, Vertical } from '../sim/types';

export type ProductTypeDef = {
  id: ProductTypeId;
  navn: string;
  vertikal: Vertical;
  fraAar: number;
  marginStd: number;
  marginMin: number;
  marginMax: number;
  risiko: number; // 0..10
  halveringstidUger: number;
  /** Planlagt længde af design- og teknikfasen i uger (3-6) [D] */
  designUger: number;
  teknikUger: number;
  /** Minimumsbudget i mio. kr. (2012-niveau) [D] */
  minBudget: number;
  /** Oplåsningskrav [D] */
  krav: { rolle?: { rolle: Role; niveau: number }[]; platform?: 'kasinoHybridEllerEgen'; dataejerskab?: number; lovligMarked?: boolean };
  feature?: string; // feature-tag til kopiregler
  beskrivelse: string;
};

export const PRODUCT_TYPES: Record<ProductTypeId, ProductTypeDef> = {
  prematch: {
    id: 'prematch', navn: 'Prematch', vertikal: 'betting', fraAar: 2012,
    marginStd: 0.07, marginMin: 0.05, marginMax: 0.10, // [F] 1X2 holder 5-6 %
    risiko: 5, halveringstidUger: 260,
    designUger: 3, teknikUger: 3, minBudget: 0.15, krav: {},
    beskrivelse: 'Klassiske odds før kampstart. Enkelt at bygge, lang levetid.',
  },
  livebetting: {
    id: 'livebetting', navn: 'Livebetting', vertikal: 'betting', fraAar: 2012,
    marginStd: 0.09, marginMin: 0.07, marginMax: 0.12, // [A]
    risiko: 8, halveringstidUger: 260,
    designUger: 4, teknikUger: 5, minBudget: 0.3,
    krav: { rolle: [{ rolle: 'oddssaetter', niveau: 2 }] }, // [D]
    feature: 'live',
    beskrivelse: 'Odds der flytter sig under kampen. Kræver en erfaren oddssætter.',
  },
  betBuilder: {
    id: 'betBuilder', navn: 'Bet builder', vertikal: 'betting', fraAar: 2018,
    marginStd: 0.2, marginMin: 0.18, marginMax: 0.25, // [F] kombispil holder 18-25 %
    risiko: 8, halveringstidUger: 156,
    designUger: 5, teknikUger: 5, minBudget: 0.8,
    krav: { rolle: [{ rolle: 'oddssaetter', niveau: 4 }, { rolle: 'analytiker', niveau: 2 }] }, // [D]
    feature: 'betBuilder',
    beskrivelse: 'Byg dit eget kombispil i samme kamp. Høj margin, høj kompleksitet.',
  },
  esport: {
    id: 'esport', navn: 'Esport', vertikal: 'betting', fraAar: 2016,
    marginStd: 0.08, marginMin: 0.06, marginMax: 0.12, // [D]
    risiko: 7, halveringstidUger: 156,
    designUger: 4, teknikUger: 4, minBudget: 0.3, krav: {},
    beskrivelse: 'Odds på turneringer og streams. Yngre publikum.',
  },
  eventKontrakter: {
    id: 'eventKontrakter', navn: 'Event-kontrakter', vertikal: 'betting', fraAar: 2025,
    marginStd: 0.04, marginMin: 0.02, marginMax: 0.05, // [D] kun hvor lovligt
    risiko: 7, halveringstidUger: 104,
    designUger: 4, teknikUger: 4, minBudget: 0.6, krav: { lovligMarked: true },
    feature: 'eventKontrakter',
    beskrivelse: 'Handel med udfald som kontrakter. Kun hvor det er lovligt.',
  },
  slotsAggregator: {
    id: 'slotsAggregator', navn: 'Slots via aggregator', vertikal: 'kasino', fraAar: 2012,
    marginStd: 0.04, marginMin: 0.03, marginMax: 0.06, // [F/A] RTP 94-97 %
    risiko: 9, halveringstidUger: 20,
    designUger: 4, teknikUger: 3, minBudget: 0.15, krav: {},
    beskrivelse: 'Et kurateret udvalg af indkøbte spilleautomater. Hurtigt, men skal fornyes ofte.',
  },
  egneSlots: {
    id: 'egneSlots', navn: 'Egne slots', vertikal: 'kasino', fraAar: 2015,
    marginStd: 0.04, marginMin: 0.03, marginMax: 0.06, // [D]
    risiko: 9, halveringstidUger: 30,
    designUger: 5, teknikUger: 4, minBudget: 0.5,
    krav: { rolle: [{ rolle: 'kasinodesigner', niveau: 3 }], platform: 'kasinoHybridEllerEgen' }, // [D]
    feature: 'egneSlots',
    beskrivelse: 'Egenudviklede automater. Ingen aggregatorafgift, men kræver egen kasinoplatform.',
  },
  livekasino: {
    id: 'livekasino', navn: 'Live-kasino', vertikal: 'kasino', fraAar: 2014,
    marginStd: 0.02, marginMin: 0.01, marginMax: 0.03, // [F] RTP 97-99 %
    risiko: 7, halveringstidUger: 208,
    designUger: 4, teknikUger: 5, minBudget: 0.4, krav: {},
    feature: 'livekasino',
    beskrivelse: 'Rigtige borde og dealere på stream. Lav margin, lang levetid.',
  },
  jackpotNetvaerk: {
    id: 'jackpotNetvaerk', navn: 'Jackpot-netværk', vertikal: 'kasino', fraAar: 2016,
    marginStd: 0.06, marginMin: 0.04, marginMax: 0.08, // [D]
    risiko: 8, halveringstidUger: 104,
    designUger: 5, teknikUger: 6, minBudget: 0.8, krav: {},
    feature: 'jackpot',
    beskrivelse: 'Fælles puljer på tværs af spil. Store præmier trækker nye kunder.',
  },
  aiSlots: {
    id: 'aiSlots', navn: 'AI-slots', vertikal: 'kasino', fraAar: 2026,
    marginStd: 0.04, marginMin: 0.03, marginMax: 0.06, // [D] spekulation
    risiko: 9, halveringstidUger: 8,
    designUger: 3, teknikUger: 3, minBudget: 0.3,
    krav: { rolle: [{ rolle: 'aiIngenioer', niveau: 2 }], dataejerskab: 0.3 }, // [D]
    feature: 'aiSlots',
    beskrivelse: 'Genereret indhold i høj fart. Billigt, men meget kort halveringstid.',
  },
};

export const PRODUCT_TYPE_IDS = Object.keys(PRODUCT_TYPES) as ProductTypeId[];
