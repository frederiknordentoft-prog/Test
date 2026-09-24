import type { Action, GameState } from '../../src/sim/types';
export type Bot = { navn: string; beslut(s: GameState): Action[] };
