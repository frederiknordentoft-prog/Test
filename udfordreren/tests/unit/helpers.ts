import { newGame } from '../../src/sim/init';
import { stepMut } from '../../src/sim/step';
import type { Action, GameState, Vertical } from '../../src/sim/types';

export function nyt(seed = 42, v: Vertical = 'betting'): GameState {
  return newGame({
    seed,
    firmaNavn: 'Testfirma',
    stiftere: v === 'betting' ? ['oddssaetteren', 'udvikleren'] : ['kasinodesigneren', 'udvikleren'],
    startVertikal: v,
    tutorial: false,
  });
}

/** Kør n uger med en handlingsfunktion (default: vælg første valg i events) */
export function koer(s: GameState, uger: number, beslut?: (s: GameState) => Action[]): GameState {
  for (let i = 0; i < uger && !s.slut; i++) {
    const a: Action[] = s.ventendeEvents.map((e) => ({ t: 'eventChoice', eventId: e.eventId, valg: 0 }) as Action);
    stepMut(s, [...a, ...(beslut ? beslut(s) : [])]);
  }
  return s;
}

export function fejl(s: GameState): string[] {
  return s.signaler.filter((x) => x.k === 'fejl').map((x) => (x as { tekst: string }).tekst);
}
