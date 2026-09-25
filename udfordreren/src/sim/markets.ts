// Markeder som konsoller (spec 6.7): licens pr. marked og vertikal, afgifter og strenghed over tid,
// markedsstørrelse med offshore-andel, trends og hold-varians. Norge er lukket (kun gråt via offshore-brand).
import type { GameState, MarketId, MarketState, Vertical } from './types';
import type { Rng } from './rng';
import { MARKETS, MARKET_IDS } from '../data/markets';
import { VERTICALS } from '../data/verticals';
import { VERTIKAL_LICENS, LICENS_AARSGEBYR } from '../data/costs';
import { TRUST } from '../data/trust';
import { SELVUDELUKKEDE, START_BLOKERING } from '../data/offshore';
import { aarDecimal, kurve, trin } from './time';
import { afvis, betal, clamp, nyhed, signal } from './util';
import { VERTIKALER } from './customers';
import { markedTotalBsi, offshoreAndele, offshoreDynPp, offshoreRefPp, offshoreTrendPp } from './offshore';
import { trendEffekt } from './trends';

/** Markeder, spilleren kan søge licens i (Norge er lukket) */
export const SPILBARE_MARKEDER: MarketId[] = MARKET_IDS.filter((m) => MARKETS[m].aabnerUge !== null);

export function markedAabent(m: MarketId, uge: number): boolean {
  const a = MARKETS[m].aabnerUge;
  return a !== null && uge >= a;
}

export function nytMarked(id: MarketId, uge: number): MarketState {
  const def = MARKETS[id];
  const afgiftPrVertikal = { betting: trin(def.afgift.betting, uge), kasino: trin(def.afgift.kasino, uge) };
  const off = offshoreAndele(offshoreRefPp(id, uge));
  const sb = START_BLOKERING[id];
  const aaben = markedAabent(id, uge);
  return {
    id,
    aaben,
    licens: 'ingen',
    afgift: (afgiftPrVertikal.betting + afgiftPrVertikal.kasino) / 2,
    afgiftPrVertikal,
    strenghed: trin(def.strenghed, uge),
    kanalisering: 1 - (off.betting + off.kasino) / 2,
    offshore: off,
    tilsynstillid: TRUST.start,
    politiskPres: 1,
    andele: {},
    kunder: 0,
    top10: [],
    vertikaler: { betting: { status: 'ingen', klarUge: null }, kasino: { status: 'ingen', klarUge: null } },
    spillerKunder: { betting: 0, kasino: 0 },
    markedsBsiPrUge: { betting: 0, kasino: 0 },
    spillerBsiPrUge: { betting: 0, kasino: 0 },
    regler: [],
    blokering: { dns: sb?.dns !== undefined && sb.dns <= uge ? sb.dns : null, betaling: sb?.betaling !== undefined && sb.betaling <= uge ? sb.betaling : null, leverandoer: !!sb?.leverandoer },
    selvudelukkede: SELVUDELUKKEDE[id] ? kurve(SELVUDELUKKEDE[id]!, aarDecimal(uge)) : 0,
    sanktion: { trin: 0, sidsteUge: null, roligeKvartaler: 0 },
    suspenderetTil: null,
    lavKanaliseringUger: 0,
    offshoreBrandBsiPrUge: 0,
    afgiftTillaeg: 0,
    aabnetUge: aaben ? uge : null,
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

export function licensStatus(s: GameState, m: MarketId): { ok: boolean; grund?: string } {
  const ms = s.markeder[m];
  const def = MARKETS[m];
  if (def.aabnerUge === null) return { ok: false, grund: `${def.navn} har monopol og giver ikke licenser.` };
  if (!ms.aaben) return { ok: false, grund: `${def.navn} åbner for licenser senere.` };
  if (ms.licens === 'inddraget') return { ok: false, grund: 'Licensen er inddraget.' };
  if (ms.licens === 'suspenderet') return { ok: false, grund: 'Licensen er suspenderet.' };
  return { ok: true };
}

export function applyLicense(s: GameState, m: MarketId, v: Vertical): boolean {
  const ms = s.markeder[m];
  if (!ms) return afvis(s, 'Ukendt marked.');
  const st = licensStatus(s, m);
  if (!st.ok) return afvis(s, st.grund ?? 'Kan ikke søge licens.');
  if (ms.vertikaler[v].status !== 'ingen') return afvis(s, 'Der er allerede søgt licens til den vertikal.');
  const pris = licensPris(s, m);
  if (!betal(s, pris.gebyr, 'licensgebyret')) return false;
  ms.vertikaler[v] = { status: 'ansoegt', klarUge: s.uge + pris.uger };
  if (ms.licens === 'ingen') ms.licens = 'ansoegt';
  nyhed(s, `${s.firmaNavn} søger ${VERTICALS[v].kort.toLowerCase()}-licens i ${MARKETS[m].navn}. Behandlingstid ${pris.uger} uger.`, 'firma');
  return true;
}

/** Ugentlig opdatering: åbning, afgift, strenghed, offshore, markedsstørrelse, hold-varians, licenser */
export function ugentligeMarkeder(s: GameState, rng: Rng): void {
  for (const id of MARKET_IDS) {
    const def = MARKETS[id];
    const ms = s.markeder[id];
    const varAaben = ms.aaben;
    ms.aaben = markedAabent(id, s.uge);
    if (ms.aaben && !varAaben) {
      ms.aabnetUge = s.uge;
      signal(s, { k: 'markedAabner', marked: id });
      nyhed(s, `${def.navn} åbner for licenser! ${def.beskrivelse}`, 'marked');
    }
    ms.afgiftPrVertikal = { betting: trin(def.afgift.betting, s.uge), kasino: trin(def.afgift.kasino, s.uge) };
    ms.afgift = (ms.afgiftPrVertikal.betting + ms.afgiftPrVertikal.kasino) / 2 + ms.afgiftTillaeg / 100;
    ms.strenghed = trin(def.strenghed, s.uge);
    ms.selvudelukkede = SELVUDELUKKEDE[id] ? kurve(SELVUDELUKKEDE[id]!, aarDecimal(s.uge)) : 0;
    const sb = START_BLOKERING[id];
    if (sb?.betaling !== undefined && ms.blokering.betaling === null && s.uge >= sb.betaling) ms.blokering.betaling = sb.betaling;
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
    ms.offshore = offshoreAndele(offshoreDynPp(s, id), offshoreTrendPp(s, id));
    const tr = trendEffekt(s, id);
    const totB = markedTotalBsi(id, 'betting', s.uge) * Math.max(0.1, 1 + tr.bettingBsi);
    const totK = markedTotalBsi(id, 'kasino', s.uge) * Math.max(0.1, 1 + tr.kasinoBsi);
    ms.markedsBsiPrUge = { betting: totB * hold.betting, kasino: totK * hold.kasino };
    const tot = totB + totK || 1;
    ms.kanalisering = 1 - (ms.offshore.betting * totB + ms.offshore.kasino * totK) / tot;

    // Suspension ophører
    if (ms.licens === 'suspenderet' && ms.suspenderetTil !== null && s.uge >= ms.suspenderetTil) {
      ms.licens = 'aktiv';
      ms.suspenderetTil = null;
      nyhed(s, `${def.tilsyn} ophæver suspensionen af ${s.firmaNavn}s licens i ${def.navn}.`, 'marked');
    }

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
    if (ms.licens !== 'aktiv') continue;
    for (const v of VERTIKALER) {
      const vl = ms.vertikaler[v];
      if (vl.status === 'aktiv' && vl.klarUge !== null && s.uge > vl.klarUge && (s.uge - vl.klarUge) % 52 === 0) sum += LICENS_AARSGEBYR;
    }
  }
  return sum;
}
