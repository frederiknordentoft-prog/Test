// Finansieringsrunder (spec 7.11) og kvartalsmål (6.13).
import type { FundingRound } from '../sim/types';

export type RoundDef = {
  id: Exclude<FundingRound, 'ingen'>;
  navn: string;
  kapital: number; // mio.
  udvanding: number; // andel
  /** Krav: annualiseret BSI (mio.) eller antal lanceringer [D] */
  kravBsiAar: number;
  kravLanceringer: number;
  /** Mindste antal uger siden forrige runde [D] */
  minUgerSiden: number;
  /** Vækstkrav i kvartalsmål efter denne runde [D] */
  vaekstkrav: number;
};

export const ROUNDS: RoundDef[] = [
  { id: 'angel', navn: 'Angel', kapital: 5, udvanding: 0.15, kravBsiAar: 1.5, kravLanceringer: 2, minUgerSiden: 0, vaekstkrav: 0.05 },
  { id: 'seed', navn: 'Seed', kapital: 20, udvanding: 0.15, kravBsiAar: 10, kravLanceringer: 4, minUgerSiden: 52, vaekstkrav: 0.08 },
  { id: 'serieA', navn: 'Serie A', kapital: 80, udvanding: 0.2, kravBsiAar: 50, kravLanceringer: 6, minUgerSiden: 52, vaekstkrav: 0.1 },
  { id: 'serieB', navn: 'Serie B', kapital: 250, udvanding: 0.15, kravBsiAar: 200, kravLanceringer: 10, minUgerSiden: 78, vaekstkrav: 0.12 },
  { id: 'vaekst', navn: 'Vækst', kapital: 800, udvanding: 0.1, kravBsiAar: 600, kravLanceringer: 15, minUgerSiden: 104, vaekstkrav: 0.12 },
];

export const RUNDE_NAVN: Record<FundingRound, string> = {
  ingen: 'Bootstrappet', angel: 'Angel', seed: 'Seed', serieA: 'Serie A', serieB: 'Serie B', vaekst: 'Vækst',
};

/** Værdiansættelse ≈ multipel × annualiseret BSI + kapital [D] */
export const VAERDI_MULTIPEL = 3;
/** Stjerner: hver opfyldt mål giver en stjerne; +2 % værdi pr. stjerne (maks 30 %) [D] */
export const STJERNE_VAERDI = 0.02;
/** Investorpres: +1 pr. manglende mål, −0,5 pr. opfyldt kvartal. Pres ≥ 3 udløser pres-event [D] */
export const PRES_EVENT_TAERSKEL = 3;
