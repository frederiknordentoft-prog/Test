// Kontraktopgaver (spec 6.6). Beløb i mio. kr. [D]. Efter 2016 færre og dårligere betalt.
import type { Role, StatKey } from '../sim/types';

export type ContractTemplate = {
  id: string;
  navn: string;
  kunder: string[];
  rolle: Role;
  stat: StatKey;
  uger: [number, number];
  maxStaff: number;
  betaling: [number, number];
  indsigt: [number, number];
  fraAar: number;
  tilAar: number;
};

export const CONTRACTS: ContractTemplate[] = [
  { id: 'oddsfeed', navn: 'Odds-feed til lokal håndboldklub', kunder: ['Vestegnens HK', 'Aarhus Øst Håndbold', 'Fyns Stjerner'], rolle: 'oddssaetter', stat: 'matematik', uger: [2, 4], maxStaff: 1, betaling: [0.06, 0.1], indsigt: [2, 3], fraAar: 2012, tilAar: 2035 },
  { id: 'bannere', navn: 'Bannere til affiliate-side', kunder: ['Bonusjægeren.dk', 'OddsOversigt', 'Spilleguiden'], rolle: 'marketing', stat: 'kreativitet', uger: [2, 3], maxStaff: 2, betaling: [0.04, 0.08], indsigt: [1, 2], fraAar: 2012, tilAar: 2035 },
  { id: 'slotmatematik', navn: 'Slot-matematik til udenlandsk studio', kunder: ['Malta-studiet', 'Et studie i Tallinn', 'Et studie i Gibraltar'], rolle: 'kasinodesigner', stat: 'matematik', uger: [3, 6], maxStaff: 2, betaling: [0.12, 0.22], indsigt: [3, 5], fraAar: 2012, tilAar: 2035 },
  { id: 'qatest', navn: 'QA-test for platformleverandør', kunder: ['En platformleverandør', 'En betalingsudbyder'], rolle: 'udvikler', stat: 'teknik', uger: [2, 5], maxStaff: 2, betaling: [0.08, 0.16], indsigt: [2, 4], fraAar: 2012, tilAar: 2035 },
  { id: 'hjemmeside', navn: 'Hjemmeside til sportsbar', kunder: ['Sportsbaren på hjørnet', 'Pubben ved stadion'], rolle: 'udvikler', stat: 'teknik', uger: [2, 3], maxStaff: 1, betaling: [0.03, 0.06], indsigt: [1, 1], fraAar: 2012, tilAar: 2018 },
  { id: 'statistik', navn: 'Kampstatistik til lokalavis', kunder: ['Lokalavisen', 'Et sportsmagasin'], rolle: 'analytiker', stat: 'matematik', uger: [2, 4], maxStaff: 1, betaling: [0.05, 0.09], indsigt: [2, 3], fraAar: 2012, tilAar: 2035 },
  { id: 'kampagne', navn: 'Kampagne for et bryggeri', kunder: ['Et bryggeri på Fyn', 'Et mikrobryggeri'], rolle: 'marketing', stat: 'salg', uger: [3, 4], maxStaff: 2, betaling: [0.08, 0.14], indsigt: [1, 2], fraAar: 2012, tilAar: 2035 },
  { id: 'kyc', navn: 'KYC-gennemgang for en bank', kunder: ['En regional bank', 'En betalingsformidler'], rolle: 'compliance', stat: 'ansvar', uger: [3, 5], maxStaff: 2, betaling: [0.1, 0.18], indsigt: [2, 4], fraAar: 2012, tilAar: 2035 },
  { id: 'support', navn: 'Support-vagt for et spilstudie', kunder: ['Et indie-spilstudie', 'En app-udvikler'], rolle: 'kundeservice', stat: 'ansvar', uger: [2, 4], maxStaff: 2, betaling: [0.04, 0.08], indsigt: [1, 2], fraAar: 2012, tilAar: 2035 },
  { id: 'risikomodel', navn: 'Risikomodel til en bookmaker', kunder: ['En udenlandsk bookmaker', 'En tradingdesk'], rolle: 'oddssaetter', stat: 'matematik', uger: [4, 6], maxStaff: 2, betaling: [0.16, 0.28], indsigt: [4, 6], fraAar: 2013, tilAar: 2035 },
  { id: 'lobbydesign', navn: 'Lobby-redesign for en operatør', kunder: ['En maltesisk operatør', 'En svensk operatør'], rolle: 'kasinodesigner', stat: 'kreativitet', uger: [3, 5], maxStaff: 2, betaling: [0.1, 0.2], indsigt: [3, 4], fraAar: 2013, tilAar: 2035 },
  { id: 'datavask', navn: 'Datavask for et analysebureau', kunder: ['Et analysebureau', 'Et konsulenthus'], rolle: 'analytiker', stat: 'teknik', uger: [2, 4], maxStaff: 2, betaling: [0.06, 0.12], indsigt: [3, 4], fraAar: 2012, tilAar: 2035 },
];

/** Efter 2016 færre og dårligere betalte opgaver (spec 6.6) [D] */
export const KONTRAKT_EFTER_2016 = { betaling: 0.6, antalMax: 2 };
/** Antal tilbud ad gangen og levetid [D] */
export const KONTRAKT_TILBUD = { min: 2, max: 3, levetid: [3, 5] as const };
/** Kvalitetsbonus: betaling ganges med 0,7 + stat/60 (maks 1,6) og ×1,15 ved foretrukken rolle [D] */
export const KONTRAKT_ROLLE_BONUS = 1.15;
