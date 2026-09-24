// Markeder som konsoller (spec 6.7). Fase 1-2: kun dk er åbent; de øvrige kort findes, men åbner i fase 3.
import type { GameState, MarketId, MarketState, Vertical } from './types';
import type { Rng } from './rng';
import { MARKETS, MARKET_IDS } from '../data/markets';
import { VERTICALS } from '../data/verticals';
import { VERTIKAL_LICENS, LICENS_AARSGEBYR } from '../data/costs';
import { TRUST } from '../data/trust';
import { trin } from './time';
import { afvis, betal, clamp, nyhed, signal } from './util';
import { markedsBsiBasis, VERTIKALER } from './customers';

/** Fase 1-2: markeder, som spilleren kan søge licens i */
export const SPILBARE_MARKEDER: MarketId[] = ['dk'];

export function nytMarked(id: MarketId, uge: number): MarketState {
  const def = MARKETS[id];
  const afgiftPrVertikal = { betting: trin(def.afgift.betting, uge), kasino: trin(def.afgift.kasino, uge) };
  return {
    id,
    aaben: def.aabnerUge !== null && uge >= def.aabnerUge && SPILBARE_MARKEDER.includes(id),
    licens: 'ingen',
    afgift: (afgiftPrVertikal.betting + afgiftPrVertikal.kasino) / 2,
    afgiftPrVertikal,
    strenghed: trin(def.strenghed, uge),
    kanalisering: 1 - (def.basisOffshore.betting + def.basisOffshore.kasino) / 2,
    offshore: { ...def.basisOffshore },
    tilsynstillid: TRUST.start,
    politiskPres: 1,
    andele: {},
    kunder: 0,
    top10: [],
    vertikaler: { betting: { status: 'ingen', klarUge: null }, kasino: { status: 'ingen', klarUge: null } },
    spillerKunder: { betting: 0, kasino: 0 },
    markedsBsiPrUge: { betting: 0, kasino: 0 },
    spillerBsiPrUge: { betting: 0, kasino: 0 },
  };
}

export function initMarkeder(uge: number): Record<MarketId, MarketState> {
  return Object.fromEntries(MARKET_IDS.map((id) => [id, nytMarked(id, uge)])) as Record<MarketId, MarketState>;
}

export function licensPris(s: GameState, m: MarketId): { gebyr: number; uger: number } {
  const ms = s.markeder[m];
  const harMarkedslicens = VERTIKALER.some((v) => ms.vertikaler[v].status !== 'ingen');
  if (harMarkedslicens) return { gebyr: VERTIKAL_LICENS.gebyr, uger: VERTIKAL_LICENS.uger };
  return { gebyr: MARKETS[m].licensGebyr, uger: MARKETS[m].licensUger };
}

export function applyLicense(s: GameState, m: MarketId, v: Vertical): boolean {
  const ms = s.markeder[m];
  if (!ms) return afvis(s, 'Ukendt marked.');
  if (!SPILBARE_MARKEDER.includes(m)) return afvis(s, `${MARKETS[m].navn} åbner for jer senere i spillet.`);
  if (!ms.aaben) return afvis(s, `${MARKETS[m].navn} er ikke åbent for licenser.`);
  if (ms.licens === 'inddraget' || ms.licens === 'suspenderet') return afvis(s, 'Licensen er inddraget eller suspenderet.');
  if (ms.vertikaler[v].status !== 'ingen') return afvis(s, 'Der er allerede søgt licens til den vertikal.');
  const pris = licensPris(s, m);
  if (!betal(s, pris.gebyr, 'licensgebyret')) return false;
  ms.vertikaler[v] = { status: 'ansoegt', klarUge: s.uge + pris.uger };
  if (ms.licens === 'ingen') ms.licens = 'ansoegt';
  nyhed(s, `${s.firmaNavn} søger ${VERTICALS[v].kort.toLowerCase()}-licens i ${MARKETS[m].navn}. Behandlingstid ${pris.uger} uger.`, 'firma');
  return true;
}

/** Ugentlig opdatering: afgift, strenghed, markedsstørrelse, hold-varians, licenser */
export function ugentligeMarkeder(s: GameState, rng: Rng): void {
  for (const id of MARKET_IDS) {
    const def = MARKETS[id];
    const ms = s.markeder[id];
    ms.aaben = def.aabnerUge !== null && s.uge >= def.aabnerUge && SPILBARE_MARKEDER.includes(id);
    ms.afgiftPrVertikal = { betting: trin(def.afgift.betting, s.uge), kasino: trin(def.afgift.kasino, s.uge) };
    ms.afgift = (ms.afgiftPrVertikal.betting + ms.afgiftPrVertikal.kasino) / 2;
    ms.strenghed = trin(def.strenghed, s.uge);
    if (!ms.aaben) {
      ms.markedsBsiPrUge = { betting: 0, kasino: 0 };
      continue;
    }
    // Hold-varians: fælles for hele markedet (favoritsejre rammer alle)
    const hold: Record<Vertical, number> = { betting: 1, kasino: 1 };
    for (const v of VERTIKALER) {
      const vd = VERTICALS[v];
      let h = clamp(1 + vd.holdVarians * rng.gauss(), 0.45, 1.6);
      if (vd.favoritsejrChance > 0 && rng.chance(vd.favoritsejrChance)) {
        h *= rng.range(0.55, 0.8);
        if (id === 'dk') nyhed(s, 'Favoritterne vandt det hele i weekenden. Bookmakerne sukker.', 'marked');
      }
      hold[v] = h;
    }
    s.holdFaktor[id] = hold;
    ms.offshore = { ...def.basisOffshore };
    const bsiB = markedsBsiBasis(id, 'betting', s.uge);
    const bsiK = markedsBsiBasis(id, 'kasino', s.uge);
    ms.markedsBsiPrUge = { betting: bsiB * hold.betting, kasino: bsiK * hold.kasino };
    const tot = bsiB + bsiK || 1;
    ms.kanalisering = 1 - (ms.offshore.betting * bsiB + ms.offshore.kasino * bsiK) / tot;

    // Licenser
    for (const v of VERTIKALER) {
      const vl = ms.vertikaler[v];
      if (vl.status === 'ansoegt' && vl.klarUge !== null && s.uge >= vl.klarUge) {
        vl.status = 'aktiv';
        vl.klarUge = s.uge; // aktiveringsuge (bruges til årsgebyr)
        if (ms.licens === 'ansoegt' || ms.licens === 'ingen') ms.licens = 'aktiv';
        signal(s, { k: 'licens', marked: id, vertikal: v });
        nyhed(s, `${def.tilsyn} har godkendt ${s.firmaNavn}s ${VERTICALS[v].kort.toLowerCase()}-licens i ${def.navn}.`, 'marked');
      }
    }
  }
}

/** Årlige licensgebyrer (på årsdagen for aktivering) */
export function licensAarsgebyr(s: GameState): number {
  let sum = 0;
  for (const id of MARKET_IDS) {
    const ms = s.markeder[id];
    for (const v of VERTIKALER) {
      const vl = ms.vertikaler[v];
      if (vl.status === 'aktiv' && vl.klarUge !== null && s.uge > vl.klarUge && (s.uge - vl.klarUge) % 52 === 0) sum += LICENS_AARSGEBYR;
    }
  }
  return sum;
}
