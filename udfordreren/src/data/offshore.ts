// Offshore-model (spec 7.8). Formlen er [D]; basis er kalibreret mod målene i 7.8 og assertion 8 [F-kalibreret].
import type { MarketId } from '../sim/types';
import { ugeFor } from '../sim/time';

export const OFFSHORE_FORMEL = {
  afgift: 0.6, // pp pr. pp afgift over 20 %
  strenghed: 4, // pp pr. strenghedstrin over 2
  bonusloft: 5,
  selvudelukkede: 3,
  kvalitet: 8, // pp pr. kvalitet over 0,5
  kasino: 1.5,
  betting: 0.5,
  dns: 4, // halveres efter 2 år
  betaling: 5,
  leverandoer: 5,
  min: 0.5,
  max: 95,
};

/** Strukturel basis (pp) pr. marked over tid [D-kalibreret] */
export const OFFSHORE_BASIS: Record<MarketId, [number, number][]> = {
  // dk: afgiften stiger til 28 % og strengheden til 3 i 2021 uden at kanaliseringen falder [F: 91,5 % i 2024]
  dk: [[2012, 12.5], [2016, 11], [2020.95, 11.3], [2021.05, -1], [2024, -0.7], [2030, -1.5], [2035, 2]],
  uk: [[2012, 8.6], [2020, 3.8], [2025, -0.2], [2030, -8], [2035, -8]],
  se: [[2019, 11.3], [2023, 12.2], [2025, 13.4], [2030, 12.4], [2035, 11.2]],
  de: [[2021, -12], [2023, -2], [2025, -0.6], [2030, -3.8], [2035, -4]],
  nl: [[2021, 23], [2025, 24.2], [2030, 26], [2035, 26]],
  on: [[2022, 15.9], [2024, 8.2], [2025, 10.5], [2030, 9.5], [2035, 9]],
  us: [[2018, 37.5], [2022, 31.8], [2025, 30.2], [2030, 20], [2035, 18]],
  fi: [[2027, 27], [2030, 19], [2035, 15]],
  no: [[2012, 100]],
};

/** Effektiv afgift til formlen for indsatsmodellen i Tyskland (5,3 % af indsats ≈ 50 % af BSI) [A] */
export const OFFSHORE_AFGIFT_OVERRIDE: Partial<Record<MarketId, number>> = { de: 50 };

/** Selvudelukkede (0..1), fx ROFUS i dk [F-mønster: 68.026 registrerede ved udgangen af 2025] */
export const SELVUDELUKKEDE: Partial<Record<MarketId, [number, number][]>> = {
  dk: [[2012, 0.15], [2020, 0.4], [2025, 0.6], [2035, 0.75]],
  se: [[2019, 0.3], [2025, 0.55], [2035, 0.7]],
  uk: [[2012, 0.1], [2020, 0.35], [2035, 0.6]],
  nl: [[2021, 0.2], [2035, 0.6]],
  de: [[2021, 0.3], [2035, 0.6]],
  fi: [[2027, 0.3], [2035, 0.6]],
};

/** Blokering ved start [F]: dk blokerer ulovlige sider (DNS); no har betalingsblokering fra 2010 */
export const START_BLOKERING: Partial<Record<MarketId, { dns?: number; betaling?: number; leverandoer?: boolean }>> = {
  dk: { dns: 0 },
  no: { betaling: -104 },
  de: { betaling: ugeFor(2023, 0) },
};

/** Grå markeder, som kun kan nås via offshore-brand (mia. kr./år) [D] */
export const GRAA_MARKED: Partial<Record<MarketId, { kasino: [number, number][]; betting: [number, number][] }>> = {
  no: { kasino: [[2012, 1.4], [2025, 2.4], [2035, 2.8]], betting: [[2012, 0.9], [2025, 1.1], [2035, 1.2]] },
};

/** Offshore-brand (spec 6.10) [D] */
export const OFFSHORE_BRAND = {
  opstart: 2, // mio. kr.
  andel: 0.04, // andel af offshore-puljen ved middel kvalitet
  andelGraa: 0.08, // andel af grå markeder (no)
  fuldRaekkeviddeKunder: 300000, // brandet når sin fulde andel, når firmaet har så mange kunder
  omkostning: 0.15, // licens, betalinger og hosting i % af BSI
  tabRisikoPrAar: 0.1, // risiko for licenstab i alle regulerede markeder
};
