// Markeder som konsoller (spec 6.7): licens pr. marked og vertikal, afgifter og strenghed over tid,
// markedsstørrelse med offshore-andel, trends og hold-varians. Norge er lukket (kun gråt via offshore-brand).
import type { GameState, MarketId, MarketState, Vertical } from './types';
import type { Rng } from './rng';
import { MARKETS, MARKET_IDS } from '../data/markets';
import { VERTICALS } from '../data/verticals';
import { VERTIKAL_LICENS, LICENS_AARSGEBYR } from '../data/costs';
import { TRUST } from '../data/trust';
import { SELVUDELUKKEDE, START_BLOKERING } from '../data/offshore';
import { aarDecimal, datoTekst, kurve, trin } from './time';
import { afvis, betal, clamp, nyhed, signal } from './util';
import { VERTIKALER } from './customers';
import { markedStoerrelse, norgeAaben, norgeOffshore, offshoreAndele, offshoreDynPp, offshoreRefPp, offshoreTrendPp } from './offshore';
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
  if (harMarkedslicens) {
    // En vertikal-tilføjelse kan ikke blive godkendt før selve markedslicensen
    const venter = VERTIKALER.filter((v) => ms.vertikaler[v].status === 'ansoegt').map((v) => (ms.vertikaler[v].klarUge ?? s.uge) - s.uge);
    return { gebyr: VERTIKAL_LICENS.gebyr, uger: Math.max(VERTIKAL_LICENS.uger, ...venter) };
  }
  return { gebyr: MARKETS[m].licensGebyr, uger: MARKETS[m].licensUger };
}

export function licensStatus(s: GameState, m: MarketId): { ok: boolean; grund?: string } {
  const ms = s.markeder[m];
  const def = MARKETS[m];
  if (def.aabnerUge === null && !ms.aaben) return { ok: false, grund: `${def.navn} har monopol og giver ikke licenser.` };
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

/** Varsel om faste afgiftstrin (så mange uger før, de træder i kraft) */
export const AFGIFT_VARSEL_UGER = 39;

const pct = (x: number) => `${Math.round(x * 1000) / 10} %`.replace('.', ',');

/** Faste afgiftstrin fra markedsdata: nyhed ni måneder før og igen, når trinnet træder i kraft */
function afgiftsTrin(s: GameState, id: MarketId): void {
  const def = MARKETS[id];
  const fund = new Map<string, { uge: number; fra: number; til: number; varsel: boolean; vertikaler: Vertical[] }>();
  for (const v of VERTIKALER) {
    const punkter = def.afgift[v];
    for (let i = 1; i < punkter.length; i++) {
      const [u, til] = punkter[i];
      const varsel = u === s.uge + AFGIFT_VARSEL_UGER;
      if (!varsel && u !== s.uge) continue;
      if (!markedAabent(id, u)) continue;
      const fra = punkter[i - 1][1];
      const noegle = `${u}|${fra}|${til}|${varsel}`;
      const f = fund.get(noegle);
      if (f) f.vertikaler.push(v);
      else fund.set(noegle, { uge: u, fra, til, varsel, vertikaler: [v] });
    }
  }
  for (const f of fund.values()) {
    const hvad = f.vertikaler.length === VERTIKALER.length ? 'afgiften' : `afgiften på ${f.vertikaler.map((v) => VERTICALS[v].kort.toLowerCase()).join(' og ')}`;
    const retning = f.til > f.fra ? 'stiger' : 'falder';
    const tekst = f.varsel
      ? `${def.navn}: ${hvad} ${retning} fra ${pct(f.fra)} til ${pct(f.til)} i ${datoTekst(f.uge)}. Vedtaget og varslet.`
      : `${def.navn}: ${hvad} er nu ${pct(f.til)} (før ${pct(f.fra)}).`;
    nyhed(s, tekst.charAt(0).toUpperCase() + tekst.slice(1), 'marked');
    if (s.markeder[id].licens !== 'ingen') signal(s, { k: 'afgift', marked: id, vertikaler: f.vertikaler, fra: f.fra, til: f.til, varsel: f.varsel, uge: f.uge });
  }
}

/** Ugentlig opdatering: åbning, afgift, strenghed, offshore, markedsstørrelse, hold-varians, licenser */
export function ugentligeMarkeder(s: GameState, rng: Rng): void {
  for (const id of MARKET_IDS) {
    const def = MARKETS[id];
    const ms = s.markeder[id];
    const varAaben = ms.aaben;
    ms.aaben = markedAabent(id, s.uge) || (id === 'no' && norgeAaben(s));
    if (ms.aaben && !varAaben) {
      ms.aabnetUge = s.uge;
      signal(s, { k: 'markedAabner', marked: id });
      nyhed(s, `${def.navn} åbner for licenser! ${def.beskrivelse}`, 'marked');
    }
    afgiftsTrin(s, id);
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
    if (id === 'no') {
      const o = norgeOffshore(s);
      ms.offshore = { betting: clamp(o * 0.85, 0, 1), kasino: o };
    } else {
      ms.offshore = offshoreAndele(offshoreDynPp(s, id), offshoreTrendPp(s, id));
    }
    const tr = trendEffekt(s, id);
    const totB = markedStoerrelse(s, id, 'betting') * Math.max(0.1, 1 + tr.bettingBsi);
    const totK = markedStoerrelse(s, id, 'kasino') * Math.max(0.1, 1 + tr.kasinoBsi);
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
