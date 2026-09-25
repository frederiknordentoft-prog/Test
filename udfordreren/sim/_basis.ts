// Beregner den strukturelle offshore-basis, der rammer målene (hjælpescript til kalibrering).
import { newGame } from '../src/sim/init';
import { stepMut } from '../src/sim/step';
import type { MarketId } from '../src/sim/types';
import { passivBot } from './bots/passive';
import { aarFor, kurve, aarDecimal } from '../src/sim/time';
import { offshoreDynPp, offshoreTrendPp } from '../src/sim/offshore';
import { OFFSHORE_BASIS } from '../src/data/offshore';
import { markedTotalBsi } from '../src/sim/offshore';

// Mål for samlet offshore-andel (af BSI) pr. marked og år
const MAAL: Record<string, [number, number][]> = {
  dk: [[2012, 9], [2016, 9], [2020, 9], [2024, 8.5], [2030, 9], [2035, 9]],
  se: [[2019, 14], [2023, 14], [2025, 15.5], [2030, 15]],
  nl: [[2021, 42], [2023, 45], [2025, 49], [2030, 48]],
  de: [[2021, 30], [2025, 28], [2030, 25]],
  on: [[2022, 16], [2024, 14], [2025, 12], [2030, 10]],
  uk: [[2012, 5], [2020, 5], [2025, 5], [2030, 8]],
  us: [[2018, 25], [2022, 25], [2025, 20], [2030, 15]],
  fi: [[2027, 40], [2030, 30], [2035, 25]],
};
const res: Record<string, number[]> = {};
for (let seed = 1; seed <= 6; seed++) {
  const s = newGame({ seed, firmaNavn: 'P', stiftere: ['oddssaetteren', 'udvikleren'], startVertikal: 'betting', tutorial: false });
  s.kapital = 1e6;
  while (s.uge < 52 * 23 + 26) {
    stepMut(s, passivBot.beslut(s));
    if (s.uge % 52 !== 26) continue;
    const aar = aarFor(s.uge);
    for (const m of Object.keys(MAAL) as MarketId[]) {
      const ms = s.markeder[m];
      if (!ms.aaben) continue;
      const pts = MAAL[m].map(([a]) => a);
      if (!pts.includes(aar)) continue;
      const maal = kurve(MAAL[m], aar);
      const bK = markedTotalBsi(m, 'kasino', s.uge), bB = markedTotalBsi(m, 'betting', s.uge);
      const kAndel = bK / (bK + bB);
      const trend = offshoreTrendPp(s, m);
      // maal = kAndel*(1.5p + trend) + (1-kAndel)*(0.5p + trend)
      const pNeeded = (maal - trend) / (1.5 * kAndel + 0.5 * (1 - kAndel));
      const uden = offshoreDynPp(s, m) - kurve(OFFSHORE_BASIS[m], aarDecimal(s.uge));
      (res[`${m} ${aar}`] ??= []).push(pNeeded - uden);
    }
  }
}
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ud: Record<string, string[]> = {};
for (const k of Object.keys(res).sort()) { const [m, a] = k.split(' '); (ud[m] ??= []).push(`[${a}, ${med(res[k]).toFixed(1)}]`); }
for (const [m, v] of Object.entries(ud)) console.log(`${m}: [${v.join(', ')}],`);
