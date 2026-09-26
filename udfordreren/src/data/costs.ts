// Omkostninger (spec 7.11) og kontortrin (6.5). [D] medmindre andet er angivet.
import type { OfficeTier } from '../sim/types';

export const START_KAPITAL = 2; // [D] mio. kr.
/** Betalinger: 2 % af indbetalinger [D]; indbetalinger ≈ 2 × BSI [D] */
export const BETALINGER_PCT = 0.02;
export const INDBETALING_PR_BSI = 2.0;
/** Bonus i % af BSI pr. niveau (0-3) [D] */
export const BONUS_PCT = [0, 0.05, 0.1, 0.18] as const;
/** Bonus' effekt på tilgang og churn [D] */
export const BONUS_TILGANG = [0, 0.18, 0.42, 1.4] as const;
export const BONUS_CHURN = [0, -0.05, -0.1, -0.15] as const;
/** VIP-program: ARPU-løft og omkostning i % af BSI [D] */
export const VIP_ARPU = [0, 0.06, 0.13, 0.38] as const;
export const VIP_PCT = [0, 0.01, 0.02, 0.04] as const;
/** Kasino-content via aggregator: 12 % af kasino-BSI [D] */
export const AGGREGATOR_PCT = 0.12;
/** Årligt licensgebyr pr. marked efter første år [D] */
export const LICENS_AARSGEBYR = 0.1;
/** Fratrædelse i uger løn [D] */
export const FRATRAEDELSE_UGER = 4;
/** Ugentlig drift pr. kontortrin (husleje m.m.) [D] */
export type OfficeDef = { id: OfficeTier; navn: string; pladser: number; pris: number; husleje: number; projekter: number; krav: string };
export const OFFICES: OfficeDef[] = [
  { id: 'garage', navn: 'Garage', pladser: 2, pris: 0, husleje: 0.001, projekter: 1, krav: '–' },
  { id: 'kaelder', navn: 'Kælder', pladser: 5, pris: 1.2, husleje: 0.006, projekter: 1, krav: 'Kapital' },
  { id: 'kontor', navn: 'Kontor', pladser: 10, pris: 6, husleje: 0.02, projekter: 1, krav: 'Kapital og en Guldkupon' },
  { id: 'etage', navn: 'Etage', pladser: 18, pris: 30, husleje: 0.06, projekter: 2, krav: 'Kapital og en licens uden for Danmark' },
  { id: 'hovedkontor', navn: 'Hovedkontor', pladser: 30, pris: 120, husleje: 0.15, projekter: 2, krav: 'Kapital' },
];
export const OFFICE_BY_ID = Object.fromEntries(OFFICES.map((o) => [o.id, o])) as Record<OfficeTier, OfficeDef>;

/** Jobannoncer i tre niveauer [D] */
export const JOB_ADS = [
  { niveau: 1 as const, navn: 'Billig jobportal', pris: 0.02, antal: 3, statMin: 8, statMax: 24, niveauMin: 1, niveauMax: 1 },
  { niveau: 2 as const, navn: 'Branchenetværk', pris: 0.1, antal: 3, statMin: 16, statMax: 36, niveauMin: 1, niveauMax: 3 },
  { niveau: 3 as const, navn: 'Headhunter', pris: 0.35, antal: 3, statMin: 28, statMax: 52, niveauMin: 3, niveauMax: 5 },
];

/** Træning: pris = 0,03 × niveau mio. + indsigt; +4..7 i stat; −15 energi [D] */
export const TRAINING = { prisPrNiveau: 0.03, indsigt: 3, minGevinst: 4, maxGevinst: 7, energi: 15, statLoft: 100 };

/** Boost [D] */
export const BOOST = { max: 3, indsigt: [5, 8, 12] as const, andelAfStandard: 0.08 };

/** Licens pr. vertikal i et marked, hvor man allerede har licens [D] */
export const VERTIKAL_LICENS = { gebyr: 0.3, uger: 12 };

/** Konkurs: antal uger i træk med negativ kapital [D] */
export const KONKURS_UGER = 8;
