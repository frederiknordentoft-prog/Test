// Branchemesser (spec 6.15). Stande 0,2 / 0,6 / 1,5 mio. (7.11) [D]
export type ExpoDef = {
  id: string;
  navn: string;
  by: string;
  ugeIAar: number; // 0-baseret uge i året
  varselUger: number;
  standPris: [number, number, number];
  hype: [number, number, number];
  indsigt: [number, number, number];
  kandidater: [number, number, number];
  b2bChance: [number, number, number];
  omdoemme: [number, number, number];
};

export const EXPOS: ExpoDef[] = [
  {
    id: 'london', navn: 'London-messen', by: 'London', ugeIAar: 5, varselUger: 5,
    standPris: [0.2, 0.6, 1.5], hype: [6, 14, 28], indsigt: [4, 9, 18], kandidater: [1, 2, 3], b2bChance: [0.05, 0.15, 0.35], omdoemme: [1, 2, 4],
  },
  {
    id: 'sportsmessen', navn: 'Sportsmessen', by: 'København', ugeIAar: 37, varselUger: 5,
    standPris: [0.2, 0.6, 1.5], hype: [8, 16, 30], indsigt: [3, 8, 15], kandidater: [1, 2, 3], b2bChance: [0.04, 0.12, 0.3], omdoemme: [1, 2, 3],
  },
];

export const EXPO_BY_ID = Object.fromEntries(EXPOS.map((e) => [e.id, e])) as Record<string, ExpoDef>;
export const STAND_NAVN = ['Ingen stand', 'Lille stand', 'Mellem stand', 'Stor stand'] as const;
