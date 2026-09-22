// Presentation schedule rules: 3.0 s floor, WIN/RETURN effect profiles (no LDW celebration), anticipation only when possible.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spinBase } from '../src/math/engine.ts';
import { spinRng } from '../src/math/rng.ts';
import { schedule, profileOf, WIN_ONLY, T } from '../src/present/schedule.ts';

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

  it('presentation layers never import the outcome RNG', () => {
    const dirs = ['src/present', 'src/render', 'src/ui'];
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.ts') ? [join(d, e.name)] : []);
    for (const d of dirs) for (const f of walk(d)) {
      const src = readFileSync(f, 'utf8');
      expect(src.includes('math/rng'), f).toBe(false);
      expect(/Math\.random\(/.test(src) && !f.includes('cosmeticRng'), f).toBe(false);
    }
  });
});
