// Markedsstørrelse: licenseret online BSI i mia. kr. pr. år i 2025-priser (spec 7.3).
// Interpoleres lineært mellem ankerpunkterne. [F] dk 2025 kasino 4,31; [A]/[D] resten.
import type { MarketId, Vertical } from '../sim/types';

export const MARKET_CURVES: Record<MarketId, Record<Vertical, [number, number][]>> = {
  dk: {
    kasino: [[2012, 1.8], [2020, 3.2], [2025, 4.3], [2030, 5.0], [2035, 5.5]], // [F] 2025; [A] resten
    betting: [[2012, 0.9], [2020, 1.5], [2025, 1.7], [2030, 1.7], [2035, 1.6]], // [A]
  },
  uk: {
    // [D] total 30 → 45 → 55; fordelt 60/40 kasino/betting [D]
    kasino: [[2012, 18], [2020, 27], [2025, 33], [2030, 33], [2035, 33]],
    betting: [[2012, 12], [2020, 18], [2025, 22], [2030, 22], [2035, 22]],
  },
  se: {
    // [A] ~18 mia. SEK kommerciel online; fordelt 65/35 [D]
    kasino: [[2019, 6.2], [2020, 6.5], [2025, 7.8], [2030, 8.45], [2035, 8.45]],
    betting: [[2019, 3.3], [2020, 3.5], [2025, 4.2], [2030, 4.55], [2035, 4.55]],
  },
  de: {
    // [D] 15 → 17 → 18; fordelt 45/55 [D]
    kasino: [[2021, 5.9], [2025, 6.75], [2030, 7.65], [2035, 8.1]],
    betting: [[2021, 7.2], [2025, 8.25], [2030, 9.35], [2035, 9.9]],
  },
  nl: {
    // [A] €600 mio./halvår legalt; fordelt 75/25 [D]
    kasino: [[2021, 5.2], [2025, 6.75], [2030, 6.75], [2035, 7.5]],
    betting: [[2021, 1.7], [2025, 2.25], [2030, 2.25], [2035, 2.5]],
  },
  on: {
    // [A] C$4,0 mia. 2025; fordelt 75/25 [D]
    kasino: [[2022, 6], [2025, 15], [2030, 19.5], [2035, 22.5]],
    betting: [[2022, 2], [2025, 5], [2030, 6.5], [2035, 7.5]],
  },
  us: {
    // [A] $16,8 mia. sport 2025; [D] iCasino
    betting: [[2018, 3], [2020, 28], [2025, 116], [2030, 170], [2035, 200]],
    kasino: [[2018, 3], [2020, 12], [2025, 40], [2030, 70], [2035, 90]],
  },
  fi: {
    // [A] samlet ~€1,5 mia.; online-andel [D]
    kasino: [[2027, 4.2], [2030, 4.9], [2035, 5.6]],
    betting: [[2027, 1.8], [2030, 2.1], [2035, 2.4]],
  },
  no: {
    kasino: [[2012, 0]],
    betting: [[2012, 0]],
  },
};
