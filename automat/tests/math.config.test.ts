// Boundary rules for src/math, the generated config (model hash, paytable hygiene) and the REPORT contract.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CONFIG, REPORT } from '../src/math/config.ts';
import { sha256Hex, stableStringify, hashOf } from '../src/math/hash.ts';

describe('src/math boundary', () => {
  it('src/math/*.ts has no Math.random, pixi, gsap, import.meta or ?raw', () => {
    const files = readdirSync('src/math').filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const f of files) {
      const src = readFileSync(`src/math/${f}`, 'utf8');
      for (const bad of ['Math.random', 'pixi', 'gsap', 'import.meta', '?raw']) expect(src.includes(bad), `${f} contains ${bad}`).toBe(false);
      expect(/\bdocument\b|\bwindow\./.test(src), `${f} touches the DOM`).toBe(false);
      expect(/from '(?!\.{1,2}\/)[^']+'/.test(src), `${f} imports a package`).toBe(false);
      // only relative imports with .ts extensions (Node type stripping)
      for (const m of src.matchAll(/from '([^']+)'/g)) expect(m[1].endsWith('.ts'), `${f}: ${m[1]}`).toBe(true);
    }
  });
});

describe('sha256 (pure TS, isomorphic)', () => {
  it('FIPS 180-4 vectors and agreement with node:crypto', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    for (const s of ['æøå NORDLYS', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'w'.repeat(1000)]) {
      expect(sha256Hex(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
    }
  });
  it('stableStringify sorts keys and drops undefined', () => {
    expect(stableStringify({ b: 1, a: [2, { d: undefined, c: 3 }] })).toBe('{"a":[2,{"c":3}],"b":1}');
    expect(hashOf({ a: 1, b: 2 })).toBe(hashOf({ b: 2, a: 1 }));
  });
});

describe('generated config', () => {
  it('modelHash = SHA-256 of the canonical config JSON without modelHash', () => {
    const { modelHash, ...rest } = CONFIG;
    expect(modelHash).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex(stableStringify(rest))).toBe(modelHash);
    expect(REPORT.modelHash).toBe(modelHash);
  });

  it('fixed structure (PLAN §2–§5)', () => {
    expect(CONFIG).toMatchObject({
      cols: 6, rows: 6, stormCols: 8, stormRows: 8, baseMarkCap: 32, stormMarkCap: 128, stormSpins: 10, stormStartMarks: 6,
      retriggerSpins: 3, maxStormSpins: 20, guaranteeX: 30, maxWinX: 10000, sunPayX: 3, sunCharge: 150,
      stakesOre: [50, 100, 200, 400, 600, 1000, 2000, 5000, 10000], defaultStakeOre: 200,
    });
    expect(CONFIG.weights.length).toBe(8);
    expect(CONFIG.stormWeights.length).toBe(8);
    expect(CONFIG.pSun).toBeGreaterThan(0.05);
    expect(CONFIG.pSun).toBeLessThan(0.09);
    expect(CONFIG.K).toBeGreaterThan(5000);
    expect(Number.isInteger(CONFIG.K)).toBe(true);
  });

  it('paytable: 7 × 8, strictly increasing with size, non-decreasing L1 → H3, multiples of 0.1× (whole øre at every stake)', () => {
    const pt = CONFIG.paytable;
    expect(pt.length).toBe(7);
    for (const row of pt) {
      expect(row.length).toBe(8);
      for (let b = 1; b < 8; b++) expect(row[b]).toBeGreaterThan(row[b - 1]);
    }
    for (let b = 0; b < 8; b++) for (let s = 1; s < 7; s++) expect(pt[s][b]).toBeGreaterThanOrEqual(pt[s - 1][b]);
    expect(CONFIG.payScale).toBe(1);
    for (const row of pt) for (const v of row) {
      expect(Math.abs(v * 10 - Math.round(v * 10))).toBeLessThan(1e-9);
      expect(v).not.toBe(1); // a lone cluster never pays exactly the stake
      for (const st of CONFIG.stakesOre) expect(Number.isInteger(Math.round(v * 10) * st / 10)).toBe(true);
    }
  });

  it('REPORT carries every contract field (CONTRACTS.md §1) with sane values', () => {
    const R = REPORT;
    for (const k of ['rtp', 'rtpMin', 'meterShare', 'hitRate', 'netWinRate', 'ldwShareOfHits', 'stormRate', 'routeARate', 'routeBRate', 'avgSpinsToKp9',
      'stormMeanX', 'stormP10X', 'stormP50X', 'stormP90X', 'stormP99X', 'guaranteeUseRate', 'baseSdX', 'blendedSdX', 'perStormSpinRtp', 'baseSpinRtp',
      'spinsSimulated', 'stormsSimulated'] as const) {
      expect(typeof R[k], k).toBe('number');
      expect(Number.isFinite(R[k]), k).toBe(true);
    }
    expect(R.kpMedianSpins.length).toBe(9);
    for (let t = 1; t < 9; t++) expect(R.kpMedianSpins[t]).toBeGreaterThanOrEqual(R.kpMedianSpins[t - 1]);
    expect(R.variants.map((v) => v.rtp)).toEqual([0.96, 0.94, 0.92]);
    expect(R.rtp).toBeGreaterThan(0.955);
    expect(R.rtp).toBeLessThan(0.965);
    expect(R.stormRate).toBeCloseTo(R.routeARate + R.routeBRate, 9);
    expect(R.meterShare).toBeCloseTo(R.rtp - R.rtpMin, 9);
    expect(R.spinsSimulated).toBeGreaterThan(0);
  });
});
