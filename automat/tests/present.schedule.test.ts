// Presentation schedule rules: 3.0 s floor, WIN/RETURN effect profiles (no LDW celebration), anticipation only when possible.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spinBase } from '../src/math/engine.ts';
import { spinRng } from '../src/math/rng.ts';
import { schedule, profileOf, WIN_ONLY, T, winTier } from '../src/present/schedule.ts';
import { hashOf } from '../src/math/hash.ts';
import { diceFor } from '../src/game/dice.ts';

describe('schedule', () => {
  it('never resolves a spin before 3.0 s and only uses WIN-only effects when T > stake', () => {
    let wins = 0, returns = 0;
    for (let i = 1; i <= 20000; i++) {
      const r = spinBase(spinRng(12345, 'base', i), 200);
      const { beats, resultAt, profile } = schedule(r);
      expect(resultAt).toBeGreaterThanOrEqual(T.floor);
      expect(profile).toBe(profileOf(r.totalOre, r.stakeOre));
      if (r.totalOre <= r.stakeOre) {
        for (const b of beats) {
          expect(WIN_ONLY.includes(b.kind)).toBe(false);
          if (b.warm !== undefined) expect(b.warm).toBe(false);
        }
        if (r.totalOre > 0) returns++;
      } else wins++;
    }
    expect(wins).toBeGreaterThan(1000);
    expect(returns).toBeGreaterThan(100);
  });

  it('anticipation beats appear only when 3 suns are visible with columns remaining', () => {
    for (let i = 1; i <= 30000; i++) {
      const r = spinBase(spinRng(777, 'base', i), 100);
      const { beats } = schedule(r);
      const ant = beats.filter((b) => b.kind === 'anticipation');
      if (!r.anticipation) expect(ant.length).toBe(0);
      else {
        expect(ant.length).toBe(1);
        const before = r.sunCells.filter((s) => Math.floor(s / r.rows) < r.anticipation!.fromCol).length;
        expect(before).toBe(3);
      }
    }
  });

  it('Terningen: a ≥ 10× spin keeps its exact beats and resultAt (stored snapshot; the dice never touch the timing)', () => {
    // seed 12345 at 2,00 kr: base spin 84 (11,3×), base spin 431 (50,6×) and Ladet spin 56 (exactly 10,00× at the locked stake)
    const fixtures = [
      { domain: 'base', i: 84, perk: false, total: 2260, resultAt: 5.99, n: 37, h: '6af5e639d7439559' },
      { domain: 'base', i: 431, perk: false, total: 10120, resultAt: 8.35, n: 57, h: '9d4ccdf681750117' },
      { domain: 'perk', i: 56, perk: true, total: 2000, resultAt: 3.63, n: 18, h: 'a8758a07d6368e51' },
    ] as const;
    for (const f of fixtures) {
      const r = spinBase(spinRng(12345, f.domain, f.i), 200, { perk: f.perk });
      expect(r.totalOre).toBe(f.total);
      expect(diceFor(r.totalOre, r.stakeOre)).toBe(true);
      expect(winTier(r.totalOre, r.stakeOre)).toBeGreaterThanOrEqual(2);
      const s = schedule(r, f.perk ? 0 : r.stakeOre);
      expect(s.profile).toBe('win');
      expect(s.resultAt).toBeCloseTo(f.resultAt, 9);
      expect(s.resultAt).toBeGreaterThanOrEqual(T.floor);
      expect(s.beats.length).toBe(f.n);
      expect(hashOf(s.beats).slice(0, 16)).toBe(f.h);
      expect(s.beats[s.beats.length - 1]).toEqual({ t: s.resultAt, kind: 'result' });
    }
    expect(schedule.length).toBe(1); // (r, paidOre = stake): there is no dice input
  });

  it('presentation layers never import the outcome RNG', () => {
    const dirs = ['src/present', 'src/render', 'src/ui'];
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.ts') ? [join(d, e.name)] : []);
    for (const d of dirs) for (const f of walk(d)) {
      const src = readFileSync(f, 'utf8');
      expect(src.includes('math/rng'), f).toBe(false);
      expect(/Math\.random\(/.test(src) && !f.includes('cosmeticRng'), f).toBe(false);
      // Kvit eller dobbelt: presentation shows a committed face, it never draws or resolves one
      expect(/gambleFace\(|resolveGamble\(/.test(src), f).toBe(false);
    }
  });
});
