// Trend-events og sportskalender (spec 6.11, 7.9). Hvert event har en synlig effekt og varighed.
import type { AktivTrend, GameState, MarketId, TrendEffect } from './types';
import type { Rng } from './rng';
import { TRENDS, SPORTSKALENDER, FASTE_TRENDS, TILFAELDIGE_TRENDS } from '../data/trends';
import { MARKETS } from '../data/markets';
import { aarFor } from './time';
import { clamp, nyhed, signal } from './util';

export type TrendSum = Required<TrendEffect>;
const TOM: TrendSum = { bettingBsi: 0, kasinoBsi: 0, offshorePp: 0, marketingRoi: 0, afgiftRisiko: 0 };

export function daekker(t: AktivTrend, m: MarketId): boolean {
  return t.markeder === 'alle' || t.markeder.includes(m);
}

/** Summen af aktive trends i et marked */
export function trendEffekt(s: GameState, m: MarketId): TrendSum {
  const e = { ...TOM };
  for (const t of s.trends) {
    if (!daekker(t, m)) continue;
    e.bettingBsi += t.effekt.bettingBsi ?? 0;
    e.kasinoBsi += t.effekt.kasinoBsi ?? 0;
    e.offshorePp += t.effekt.offshorePp ?? 0;
    e.marketingRoi += t.effekt.marketingRoi ?? 0;
    e.afgiftRisiko += t.effekt.afgiftRisiko ?? 0;
  }
  return e;
}

export function startTrend(s: GameState, trendId: string, uger: number, titel?: string, markeder?: MarketId[]): void {
  const def = TRENDS[trendId];
  if (!def) return;
  const t: AktivTrend = {
    id: trendId,
    startUge: s.uge,
    slutUge: s.uge + uger,
    markeder: markeder ?? def.markeder,
    effekt: { ...def.effekt },
    titel: titel ?? def.titel,
  };
  s.trends.push(t);
  if (def.pres) {
    for (const m of Object.keys(s.markeder) as MarketId[]) {
      if (daekker(t, m)) s.markeder[m].politiskPres = clamp(s.markeder[m].politiskPres + def.pres, 0, 5);
    }
  }
  const hvor = t.markeder === 'alle' ? '' : t.markeder.length <= 2 ? ` (${t.markeder.map((m) => MARKETS[m].navn).join(', ')})` : '';
  nyhed(s, `${t.titel}${hvor}: ${def.tekst}`, 'verden');
  signal(s, { k: 'trend', id: trendId, titel: t.titel });
}

export function ugentligeTrends(s: GameState, rng: Rng): void {
  const foer = s.trends.length;
  s.trends = s.trends.filter((t) => t.slutUge > s.uge);
  if (s.trends.length < foer) {
    // Trends, der slutter, nævnes ikke hver gang — kun de store
  }
  for (const f of [...SPORTSKALENDER, ...FASTE_TRENDS]) if (f.uge === s.uge) startTrend(s, f.trendId, f.uger, f.titel);
  const aar = aarFor(s.uge);
  for (const r of TILFAELDIGE_TRENDS) {
    if (aar < r.fraAar || aar > r.tilAar) continue;
    if (s.trends.some((t) => t.id === r.trendId)) continue;
    if (!rng.chance(r.chancePrAar / 52)) continue;
    const def = TRENDS[r.trendId];
    // Dokumentarer rammer ét marked ad gangen
    const markeder = r.trendId === 'dokumentar' && def.markeder !== 'alle' ? [rng.pick(def.markeder)] : undefined;
    startTrend(s, r.trendId, rng.int(r.uger[0], r.uger[1]), undefined, markeder);
  }
}
