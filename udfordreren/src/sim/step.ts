// step(state, actions): GameState — ren og deterministisk. UI sender Actions og læser snapshots.
import type { Action, GameState } from './types';
import { makeRng, type Rng } from './rng';
import { SIDSTE_UGE, aarFor, ugeIAar } from './time';
import { applyActionMut } from './actions';
import { ugentligeMarkeder } from './markets';
import { ugentligForskning, passivIndsigt } from './insight';
import { ugentligeKontrakter, opfyldTilbud } from './contracts';
import { ugentligtProjekt } from './projects';
import { ugentligStaff, passiveEffekter } from './staff';
import { ugentligeKunder, spillerKunderTotal } from './customers';
import { ugentligOekonomi } from './economy';
import { ugentligeKonkurrenter } from './competitors';
import { ugentligHitliste } from './charts';
import { ugentligeMesser } from './expos';
import { ugentligGalla } from './gala';
import { kvartalsmoede } from './investors';
import { kvartalsTillid, sanktioner } from './trust';
import { ugentligeTrends } from './trends';
import { ugentligRegulering, kvartalsPres } from './regulation';
import { ugentligtOffshoreBrand } from './offshore';
import { ugentligeEvents } from './events';
import { CHANNELS, CHANNEL_IDS } from '../data/acquisition';
import { BALANCE } from '../data/balance';
import { clamp, signal } from './util';

export function cloneState(s: GameState): GameState {
  return structuredClone(s);
}

/** Anvend én handling på en kopi (bruges af UI mellem ticks). Signaler nulstilles. */
export function applyAction(state: GameState, action: Action): GameState {
  const s = cloneState(state);
  s.signaler = [];
  const rng = makeRng(s.rngState);
  applyActionMut(s, rng, action);
  return s;
}

/** Ren step-funktion: anvender handlinger og simulerer én uge. */
export function step(state: GameState, actions: readonly Action[] = []): GameState {
  const s = cloneState(state);
  stepMut(s, actions);
  return s;
}

/** Muterende variant (bruges af sim-harness for fart). Deterministisk givet samme input. */
export function stepMut(s: GameState, actions: readonly Action[] = []): void {
  s.signaler = [];
  const rng = makeRng(s.rngState);
  for (const a of actions) applyActionMut(s, rng, a);
  if (s.slut) return;
  simulerUge(s, rng);
}

function simulerUge(s: GameState, rng: Rng): void {
  s.uge += 1;
  const aar = aarFor(s.uge);
  if (s.aarAkk.aar !== aar) {
    s.aarAkk = { aar, nyeKombinationer: 0, nyeFeatures: 0, lanceringer: 0, bedsteTotal40: 0, startKunder: spillerKunderTotal(s), tillidSum: 0, tillidUger: 0 };
  }

  ugentligeTrends(s, rng);
  ugentligRegulering(s, rng);
  ugentligeMarkeder(s, rng);
  ugentligForskning(s);

  // Arbejde: kontrakter først, derefter projekter (en person arbejder ét sted pr. uge)
  const arbejdet: Record<string, 'projekt' | 'kontrakt'> = {};
  const k = ugentligeKontrakter(s);
  for (const id of k.arbejdede) arbejdet[id] = 'kontrakt';
  const optaget = new Set<string>(k.arbejdede);
  for (const p of [...s.projekter]) {
    const r = ugentligtProjekt(s, rng, p, optaget);
    for (const id of r.arbejdede) {
      arbejdet[id] = 'projekt';
      optaget.add(id);
    }
  }
  ugentligStaff(s, rng, arbejdet);
  passivIndsigt(s, passiveEffekter(s).analytikere);

  // Kunder, økonomi, konkurrenter og hitliste
  const kunder = ugentligeKunder(s, rng);
  const graa = ugentligtOffshoreBrand(s, rng);
  ugentligOekonomi(s, kunder, k.indtaegt, graa);
  ugentligeKonkurrenter(s, rng);
  ugentligHitliste(s);

  // Hype: forfald + brandkendskab fra kanaler
  let kanalHype = 0;
  for (const c of CHANNEL_IDS) kanalHype += (s.marketingMix[c] ?? 0) * CHANNELS[c].hype;
  s.hype = clamp(s.hype * BALANCE.hypeForfald + Math.min(4, kanalHype), 0, 100);

  // Tillid registreres ugentligt til gallaen
  s.aarAkk.tillidSum += s.markeder.dk.tilsynstillid;
  s.aarAkk.tillidUger += 1;

  // Kalender
  ugentligeMesser(s, rng);
  ugentligGalla(s, rng);
  if (s.uge > 0 && ugeIAar(s.uge) % 13 === 0) {
    kvartalsTillid(s);
    sanktioner(s, rng);
    kvartalsPres(s);
    kvartalsmoede(s, rng);
  }
  ugentligeEvents(s, rng);
  opfyldTilbud(s, rng);

  if (s.uge >= SIDSTE_UGE && !s.slut) {
    s.slut = { id: 'tiden', vaerdi: s.investorer.vaerdiansaettelse, eftermaele: 0 };
    signal(s, { k: 'slut', id: 'tiden' });
  }
}
