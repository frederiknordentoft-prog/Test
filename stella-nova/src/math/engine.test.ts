import { describe, expect, it } from 'vitest';
import { BET_LEVELS, RING_DIR, SYM } from '../core/config.ts';
import type { Beat, BeatSpinEnd, Cell, Grid, IEngine, RigKind } from '../core/types.ts';
import { createEngine, evaluateGrid, INITIAL_GRID, rotatedGrid } from './engine.ts';
import { PARAMS } from './model.ts';
import type { ModelParams } from './model.ts';
import { simulate } from './sim.ts';

const W = SYM.WILD;
const C = SYM.SCATTER;
const { SAPPHIRE, RUBY, MOON, SUN } = SYM;

type Policy = 'greedy' | 'none' | 'mixed';

/** One whole spin: spin() and the answer to the nudge, if one is offered. */
function play(engine: IEngine, bet: number, policy: Policy = 'greedy', n = 0, checkPreview = false): Beat[] {
  const beats = engine.spin(bet);
  const last = beats[beats.length - 1];
  if (last.type === 'awaitNudge') {
    if (checkPreview) for (const o of last.options) expect(engine.previewNudge({ ring: o.ring, dir: o.dir })).toEqual(o);
    const choice = policy === 'greedy' ? last.best : policy === 'none' ? null : n % 3 === 0 ? null : n % 3 === 1 ? last.best : last.options[n % 8];
    beats.push(...engine.nudge(choice));
  }
  return beats;
}

const endOf = (beats: Beat[]): BeatSpinEnd => beats[beats.length - 1] as BeatSpinEnd;
const count = (beats: Beat[], type: Beat['type']): number => beats.filter((b) => b.type === type).length;
const LETTER: Record<Beat['type'], string> = {
  spinStart: 'S',
  spinStop: 'T',
  wins: 'W',
  cascade: 'C',
  nova: 'N',
  awaitNudge: 'A',
  nudge: 'G',
  nudgeSkipped: 'K',
  freeSpinsTrigger: 'F',
  spinEnd: 'E',
};
const shape = (beats: Beat[]): string => beats.map((b) => LETTER[b.type]).join('');
const GRAMMAR = /^ST(WC)*(N(WC)*)?(A(K|G(WC)*(N(WC)*)?)|K)?F?E$/;
const key = (cells: Cell[]): string => cells.map((c) => `${c.ring}:${c.spoke}`).join(' ');

function withSpoke(spoke: number, column: number[]): number[][] {
  const grid = INITIAL_GRID.map((row) => [...row]);
  column.forEach((sym, ring) => (grid[ring][spoke] = sym));
  return grid;
}

/** Every rule a spin's beats must obey, checked against the pure evaluator. */
function inspect(beats: Beat[], model: ModelParams, chargeBefore: number): number {
  expect(shape(beats)).toMatch(GRAMMAR);
  expect(count(beats, 'nova')).toBeLessThanOrEqual(1);
  const start = beats[0];
  const end = endOf(beats);
  if (start.type !== 'spinStart') throw new Error('no spinStart');
  const bet = start.bet;
  const free = start.mode === 'free';
  const last = model.ladder.length - 1;
  let grid: Grid = [];
  let ladder = 0;
  let total = 0;
  let charge = chargeBefore;
  let lineSum = 0;
  beats.forEach((b, i) => {
    switch (b.type) {
      case 'spinStop':
        grid = b.grid;
        b.grid.forEach((row, r) => expect(row.filter((x) => x === C).length).toBeLessThanOrEqual(1));
        expect(b.scatters.every((c) => grid[c.ring][c.spoke] === C)).toBe(true);
        expect(b.scatters.length).toBe(grid.flat().filter((x) => x === C).length);
        expect(b.anticipation.slice(0, 2)).toEqual([false, false]);
        if (free) expect(grid[0].every((x) => x === W)).toBe(true);
        break;
      case 'wins': {
        expect(b.ladderIndex).toBe(ladder);
        expect(b.multiplier).toBe(model.ladder[ladder]);
        if (!end.capped) expect(b.lines).toEqual(evaluateGrid(grid, { multiplier: b.multiplier, bet, model }));
        expect(b.lines.length).toBeGreaterThan(0);
        const step = b.lines.reduce((sum, l) => sum + l.amount, 0);
        b.lines.forEach((l) => expect(Number.isInteger(l.amount) && l.cells.length === l.count).toBe(true));
        expect(b.stepAmount).toBe(step);
        total += step;
        lineSum += step;
        expect(b.totalAmount).toBe(total);
        expect(b.novaChargeBefore).toBe(charge);
        charge = b.novaChargeAfter;
        expect(b.novaThreshold).toBe(model.novaThreshold);
        break;
      }
      case 'cascade': {
        const wins = beats[i - 1];
        if (wins.type !== 'wins') throw new Error('cascade without wins');
        const burst = wins.lines.flatMap((l) => l.cells).filter((c) => !(free && c.ring === 0));
        expect(key(b.removed)).toBe(key(burst));
        expect(wins.novaChargeAfter - wins.novaChargeBefore).toBe(burst.length);
        expect(key(b.refills.map((r) => r.cell))).toBe(key(b.removed));
        expect(b.refills.every((r) => r.symbol !== C)).toBe(true);
        expect(b.removed.every((c) => grid[c.ring][c.spoke] !== C)).toBe(true);
        const refilled = grid.map((row) => [...row]);
        for (const r of b.refills) refilled[r.cell.ring][r.cell.spoke] = r.symbol;
        expect(b.gridAfterRefill).toEqual(refilled);
        expect(b.tick).toEqual([...RING_DIR]);
        for (let r = 0; r < 4; r++) for (let s = 0; s < 8; s++) expect(b.grid[r][s]).toBe(b.gridAfterRefill[r][(s - RING_DIR[r] + 8) % 8]);
        ladder = Math.min(ladder + 1, last);
        expect(b.nextLadderIndex).toBe(ladder);
        expect(b.nextMultiplier).toBe(model.ladder[ladder]);
        grid = b.grid;
        break;
      }
      case 'nova': {
        expect(charge).toBeGreaterThanOrEqual(model.novaThreshold);
        charge = 0;
        const before = grid;
        expect(b.converted.every((c) => c.ring < 2 && before[c.ring][c.spoke] !== W && before[c.ring][c.spoke] !== C)).toBe(true);
        for (let r = 0; r < 4; r++) {
          for (let s = 0; s < 8; s++) expect(b.grid[r][s]).toBe(r < 2 && before[r][s] !== C ? W : before[r][s]);
        }
        expect(b.converted.length).toBe(before[0].concat(before[1]).filter((x) => x !== W && x !== C).length);
        grid = b.grid;
        break;
      }
      case 'awaitNudge': {
        expect(b.options.map((o) => `${o.ring}${o.dir}`).join()).toBe('01,0-1,11,1-1,21,2-1,31,3-1');
        for (const o of b.options) {
          expect(o.lines).toEqual(evaluateGrid(rotatedGrid(grid, o.ring, o.dir), { multiplier: model.ladder[ladder], bet, model }));
          expect(o.amount).toBe(o.lines.reduce((sum, l) => sum + l.amount, 0));
        }
        const top = Math.max(...b.options.map((o) => o.amount));
        expect(top).toBeGreaterThan(0);
        expect(b.best).toBe(b.options.find((o) => o.amount === top));
        const next = beats[i + 1];
        if (next.type === 'nudgeSkipped') expect(next.reason).toBe('passed');
        break;
      }
      case 'nudge': {
        expect(b.grid).toEqual(rotatedGrid(grid, b.choice.ring, b.choice.dir));
        for (let s = 0; s < 8; s++) expect(b.grid[b.choice.ring][s]).toBe(grid[b.choice.ring][(s - b.choice.dir + 8) % 8]);
        grid = b.grid;
        break;
      }
      case 'nudgeSkipped':
        if (beats[i - 1].type !== 'awaitNudge') {
          expect(b.reason).toBe('noWinningMove');
          for (const dir of [1, -1] as const) for (let r = 0; r < 4; r++) expect(evaluateGrid(rotatedGrid(grid, r, dir), { model })).toEqual([]);
        }
        break;
      case 'spinEnd':
        expect(b.totalAmount).toBe(lineSum);
        expect(b.totalMultiple).toBe(lineSum / bet);
        expect(Number.isInteger(b.totalAmount)).toBe(true);
        expect(b.mode).toBe(start.mode);
        if (!b.capped && !free) expect(evaluateGrid(grid, { model })).toEqual([]);
        break;
      default:
        break;
    }
  });
  return charge;
}

describe('line evaluation', () => {
  const one = (column: number[]) => evaluateGrid(withSpoke(5, column));
  it('pays three or four of a kind from the centre outward', () => {
    expect(evaluateGrid(INITIAL_GRID)).toEqual([]);
    expect(one([RUBY, RUBY, RUBY, MOON])).toEqual([
      { spoke: 5, symbol: RUBY, count: 3, cells: [0, 1, 2].map((ring) => ({ ring, spoke: 5 })), pay: PARAMS.pay3[RUBY] / 10, amount: PARAMS.pay3[RUBY] * 10 },
    ]);
    expect(one([RUBY, RUBY, RUBY, RUBY])[0]).toMatchObject({ symbol: RUBY, count: 4, pay: PARAMS.pay4[RUBY] / 10 });
    expect(one([MOON, SUN, SUN, SUN])).toEqual([]);
    expect(one([SUN, SUN, MOON, SUN])).toEqual([]);
  });
  it('lets wilds stand in, and names the line after its first non-wild symbol', () => {
    expect(one([W, SUN, W, SUN])[0]).toMatchObject({ symbol: SUN, count: 4, pay: PARAMS.pay4[SUN] / 10 });
    expect(one([W, W, SAPPHIRE, MOON])[0]).toMatchObject({ symbol: SAPPHIRE, count: 3 });
    expect(one([SAPPHIRE, W, W, W])[0]).toMatchObject({ symbol: SAPPHIRE, count: 4 });
    expect(one([W, W, W, MOON])[0]).toMatchObject({ symbol: MOON, count: 4, pay: PARAMS.pay4[MOON] / 10 });
  });
  it('pays wild-only lines as the Sun', () => {
    expect(one([W, W, W, W])[0]).toMatchObject({ symbol: W, count: 4, pay: PARAMS.pay4[SUN] / 10 });
    expect(one([W, W, W, C])[0]).toMatchObject({ symbol: W, count: 3, pay: PARAMS.pay3[SUN] / 10 });
  });
  it('lets a comet break the line', () => {
    expect(one([C, SUN, SUN, SUN])).toEqual([]);
    expect(one([SUN, C, SUN, SUN])).toEqual([]);
    expect(one([SUN, W, C, SUN])).toEqual([]);
    expect(one([SUN, W, SUN, C])[0]).toMatchObject({ symbol: SUN, count: 3 });
  });
  it('scales amounts by multiplier and bet in whole øre', () => {
    const [line] = evaluateGrid(withSpoke(2, [SAPPHIRE, SAPPHIRE, W, MOON]), { multiplier: 5, bet: 500 });
    expect(line.amount).toBe(PARAMS.pay3[SAPPHIRE] * 5 * 50);
  });
  it('turns a ring so the symbol at spoke s moves to s + dir', () => {
    const turned = rotatedGrid(INITIAL_GRID, 2, 1);
    for (let s = 0; s < 8; s++) expect(turned[2][s]).toBe(INITIAL_GRID[2][(s + 7) % 8]);
    expect(rotatedGrid(turned, 2, -1)).toEqual(INITIAL_GRID.map((row) => [...row]));
  });
});

describe('engine', () => {
  it('opens on a dead board and guards its calls', () => {
    const engine = createEngine({ seed: 1 });
    const snap = engine.snapshot();
    expect(snap).toMatchObject({ mode: 'base', novaCharge: 0, awaitingNudge: false, freeSpinsRemaining: 0, ladderIndex: 0, multiplier: 1 });
    expect(snap.grid).toEqual(INITIAL_GRID.map((row) => [...row]));
    expect(engine.model.novaThreshold).toBe(PARAMS.novaThreshold);
    expect(() => engine.spin(150)).toThrow();
    expect(() => engine.nudge(null)).toThrow();
    engine.rig('nudgeWin');
    const beats = engine.spin(100);
    expect(beats[beats.length - 1].type).toBe('awaitNudge');
    expect(engine.snapshot().awaitingNudge).toBe(true);
    expect(() => engine.spin(100)).toThrow();
    expect(() => engine.nudge({ ring: 4, dir: 1 })).toThrow();
    expect(endOf(engine.nudge(null)).totalAmount).toBe(0);
    expect(engine.snapshot().awaitingNudge).toBe(false);
  });

  it('is deterministic for a seed', () => {
    const run = (seed: number): string => {
      const engine = createEngine({ seed });
      const all: Beat[][] = [];
      for (let i = 0; i < 300; i++) all.push(play(engine, 200, 'mixed', i));
      return JSON.stringify(all);
    };
    expect(run(42)).toBe(run(42));
    expect(run(42)).not.toBe(run(43));
  });

  it('keeps every rule over thousands of spins, in whole øre at every bet', () => {
    const engine = createEngine({ seed: 2026 });
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const before = engine.snapshot().novaCharge;
      const beats = play(engine, BET_LEVELS[i % BET_LEVELS.length], 'mixed', i, i < 400);
      expect(engine.snapshot().novaCharge).toBe(inspect(beats, PARAMS, before));
      for (const b of beats) seen.add(b.type);
    }
    expect([...seen].sort()).toEqual(Object.keys(LETTER).sort());
  });

  it('fires the Nova once per spin at the dead point and plays Kometnat to its end', () => {
    const model: ModelParams = { ...PARAMS, novaThreshold: 12, cometChance: [4000, 4000, 4000, 4000], freeCometChance: [0, 3000, 3000, 3000] };
    const engine = createEngine({ seed: 9, model });
    let novas = 0;
    let rounds = 0;
    let retriggers = 0;
    let expectIndex = 0;
    let expectTotal = 0;
    let roundWin = 0;
    for (let i = 0; i < 1500; i++) {
      const snap = engine.snapshot();
      // A free spin ignores the bet it is handed and plays at the round's bet.
      const beats = play(engine, snap.mode === 'free' ? 12345 : 500, 'mixed', i);
      inspect(beats, model, snap.novaCharge);
      novas += count(beats, 'nova');
      const start = beats[0];
      const end = endOf(beats);
      const trigger = beats.find((b) => b.type === 'freeSpinsTrigger');
      if (start.type !== 'spinStart') throw new Error('no spinStart');
      expect(start.bet).toBe(500);
      if (snap.mode === 'free') {
        expectIndex++;
        expect(start).toMatchObject({ mode: 'free', freeSpinIndex: expectIndex, freeSpinsTotal: expectTotal });
        roundWin += end.totalAmount;
        for (const b of beats) if (b.type === 'cascade') expect(b.removed.every((c) => c.ring > 0)).toBe(true);
        if (trigger?.type === 'freeSpinsTrigger') {
          retriggers++;
          expect(trigger.retrigger).toBe(true);
          expect(trigger.scatters.every((c) => c.ring > 0)).toBe(true);
          expect(trigger.count).toBe(trigger.scatters.length === 2 ? 2 : 5);
          expectTotal += trigger.count;
        } else {
          expect(count(beats, 'spinStop') === 1 && (beats[1].type === 'spinStop' ? beats[1].scatters.length : 9) < 2).toBe(true);
        }
        expect(end.freeSpinsRemaining).toBe(expectTotal - expectIndex);
        if (end.freeSpinsRemaining === 0) {
          rounds++;
          expect(end).toMatchObject({ freeSpinsEnded: true, freeSpinsTotalAmount: roundWin });
          expect(engine.snapshot()).toMatchObject({ mode: 'base', freeSpinsWin: roundWin });
        } else {
          expect(end.freeSpinsEnded).toBeUndefined();
          expect(engine.snapshot().mode).toBe('free');
        }
      } else if (trigger?.type === 'freeSpinsTrigger') {
        expect(beats[beats.length - 2]).toBe(trigger);
        expect(trigger.retrigger).toBe(false);
        expect(trigger.count).toBe(trigger.scatters.length === 3 ? 8 : 12);
        expect(trigger.remaining).toBe(trigger.count);
        expect(end).toMatchObject({ mode: 'base', freeSpinsRemaining: trigger.count });
        expect(engine.snapshot()).toMatchObject({ mode: 'free', freeSpinsTotal: trigger.count, activeBet: 500 });
        expectIndex = 0;
        expectTotal = trigger.count;
        roundWin = 0;
      } else {
        expect(beats[1].type === 'spinStop' && beats[1].scatters.length < 3).toBe(true);
        expect(engine.snapshot().mode).toBe('base');
      }
    }
    expect(novas).toBeGreaterThan(50);
    expect(rounds).toBeGreaterThan(5);
    expect(retriggers).toBeGreaterThan(5);
  });

  it('clamps at the cap and ends the spin', () => {
    const only = [1, 0, 0, 0, 0, 0, 0, 0, 0];
    const rows = [only, only, only, only];
    const model: ModelParams = {
      ...PARAMS,
      initWeights: rows,
      refillWeights: rows,
      freeInitWeights: rows,
      freeRefillWeights: rows,
      cometChance: [0, 0, 0, 0],
      freeCometChance: [0, 0, 0, 0],
      pay3: new Array<number>(8).fill(10000),
      pay4: new Array<number>(8).fill(20000),
    };
    const engine = createEngine({ seed: 3, model });
    const beats = engine.spin(2000);
    expect(shape(beats)).toBe('STWCE');
    inspect(beats, model, 0);
    expect(endOf(beats)).toMatchObject({ capped: true, totalMultiple: PARAMS.maxWinMultiple, totalAmount: PARAMS.maxWinMultiple * 2000 });
    expect(engine.snapshot().awaitingNudge).toBe(false);
  });
});

describe('demo rigs', () => {
  const promises: Record<RigKind, (beats: Beat[], engine: IEngine) => void> = {
    dead: (beats) => {
      expect(shape(beats)).toBe('STKE');
      expect(endOf(beats).totalAmount).toBe(0);
    },
    nudgeWin: (beats) => {
      expect(shape(beats)).toMatch(/^STAGWC/);
      expect(endOf(beats).totalMultiple).toBeGreaterThanOrEqual(2);
    },
    chain: (beats) => expect(shape(beats)).toMatch(/^STWCWCWC/),
    bigWin: (beats) => {
      expect(endOf(beats).totalMultiple).toBeGreaterThanOrEqual(10);
      expect(endOf(beats).totalMultiple).toBeLessThan(25);
      expect(count(beats, 'awaitNudge') + count(beats, 'freeSpinsTrigger')).toBe(0);
    },
    megaWin: (beats) => {
      expect(endOf(beats).totalMultiple).toBeGreaterThanOrEqual(25);
      expect(endOf(beats).totalMultiple).toBeLessThan(60);
      expect(count(beats, 'awaitNudge') + count(beats, 'freeSpinsTrigger')).toBe(0);
    },
    supernovaWin: (beats) => {
      expect(endOf(beats).totalMultiple).toBeGreaterThanOrEqual(60);
      expect(count(beats, 'awaitNudge') + count(beats, 'freeSpinsTrigger')).toBe(0);
    },
    freeSpins: (beats, engine) => {
      expect(count(beats, 'freeSpinsTrigger')).toBe(1);
      expect(engine.snapshot().mode).toBe('free');
    },
    nova: (beats) => {
      expect(shape(beats)).toMatch(/^ST(WC)+NWC/);
      expect(count(beats, 'nova')).toBe(1);
    },
  };

  for (const kind of Object.keys(promises) as RigKind[]) {
    it(`${kind} delivers, once, without disturbing the outcome stream`, () => {
      for (const seed of [1, 2, 3]) {
        const rigged = createEngine({ seed });
        const plain = createEngine({ seed });
        // Some play first, so the rig meets a star that is already partly charged.
        for (let i = 0; i < 40; i++) {
          play(rigged, 1000, 'greedy');
          play(plain, 1000, 'greedy');
        }
        while (rigged.snapshot().mode === 'free') {
          play(rigged, 1000, 'greedy');
          play(plain, 1000, 'greedy');
        }
        // The nova rig tops the star up to one short of full as the spin starts.
        const before = kind === 'nova' ? Math.max(rigged.snapshot().novaCharge, PARAMS.novaThreshold - 1) : rigged.snapshot().novaCharge;
        rigged.rig(kind);
        const beats = play(rigged, 1000, 'greedy');
        inspect(beats, PARAMS, before);
        promises[kind](beats, rigged);
        if (kind === 'freeSpins') continue;
        // The next spin is the one the unrigged engine would have had: same first stop.
        expect(play(rigged, 1000, 'greedy')[1]).toEqual(play(plain, 1000, 'greedy')[1]);
      }
    });
  }

  it('waits out Kometnat and never reaches the simulator', () => {
    const reference = simulate({ spins: 3000, seed: 77, policy: 'greedy' }).totals;
    const engine = createEngine({ seed: 5 });
    engine.rig('freeSpins');
    play(engine, 100);
    engine.rig('dead');
    while (engine.snapshot().mode === 'free') expect(shape(play(engine, 100))).not.toBe('');
    promises.dead(play(engine, 100), engine);
    let wins = 0;
    for (let i = 0; i < 200; i++) wins += endOf(play(engine, 100)).totalAmount > 0 ? 1 : 0;
    expect(wins).toBeGreaterThan(50);
    const again = simulate({ spins: 3000, seed: 77, policy: 'greedy' }).totals;
    expect({ ...again, elapsedMs: 0 }).toEqual({ ...reference, elapsedMs: 0 });
  });
});

describe('engine and simulator', () => {
  for (const policy of ['greedy', 'none'] as const) {
    it(`pay the same for the same seed (${policy})`, () => {
      for (const seed of [11, 2026]) {
        const spins = 3000;
        const engine = createEngine({ seed });
        let total = 0;
        let triggers = 0;
        let novas = 0;
        for (let i = 0; i < spins; i++) {
          do {
            const beats = play(engine, 100, policy);
            total += endOf(beats).totalAmount;
            novas += count(beats, 'nova');
            triggers += beats.some((b) => b.type === 'freeSpinsTrigger' && !b.retrigger) ? 1 : 0;
          } while (engine.snapshot().mode === 'free');
        }
        const sim = simulate({ spins, seed, policy, bet: 100 });
        expect(total).toBe(sim.totalWin);
        expect(triggers).toBe(sim.freeSpins.triggers);
        expect(novas).toBe(sim.nova.count + sim.nova.inFreeSpins);
      }
    });
  }
});
