// R4 clusters: orthogonal flood fill over s|WILD, ≥1 real s, size ≥ 5, wilds shared, pure wilds never pay.
import { describe, it, expect } from 'vitest';
import { listClusters } from '../src/math/cluster.ts';
import { bucketOf } from '../src/math/grid.ts';
import { SYM } from '../src/math/types.ts';
import { spinBase } from '../src/math/engine.ts';
import { spinRng } from '../src/math/rng.ts';

const { L1, L2, L3, L4, H1, H2, H3, WILD: W, SUN } = SYM;
const C = 6, R = 6;

/** Builds a column-major grid from a row-major picture (rows[r][c]); '.' cells get fillers that never cluster. */
function gridFrom(rows: number[][]): number[] {
  const g: number[] = new Array(C * R);
  for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) g[c * R + r] = rows[r][c];
  return g;
}
const idx = (c: number, r: number) => c * R + r;
const sorted = (a: number[]) => a.slice().sort((x, y) => x - y);

/** Independent reference: naive BFS per symbol (no stamps, no pruning). */
function reference(grid: number[], cols: number, rows: number): { sym: number; cells: number[] }[] {
  const out: { sym: number; cells: number[] }[] = [];
  for (let s = 0; s < 7; s++) {
    const seen = new Set<number>();
    for (let i = 0; i < cols * rows; i++) {
      if (grid[i] !== s || seen.has(i)) continue;
      const comp: number[] = [];
      const q = [i];
      seen.add(i);
      while (q.length) {
        const x = q.shift()!;
        comp.push(x);
        const c = Math.floor(x / rows), r = x % rows;
        for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
          const j = nc * rows + nr;
          if (!seen.has(j) && (grid[j] === s || grid[j] === SYM.WILD)) { seen.add(j); q.push(j); }
        }
      }
      if (comp.length >= 5) out.push({ sym: s, cells: sorted(comp) });
    }
  }
  return out;
}

// H1/L4 checkerboard background: no two equal neighbours, so it never forms a cluster on its own
function blank(): number[][] {
  return Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => ((c + r) % 2 ? L4 : H1)));
}

describe('cluster flood fill (R4)', () => {
  it('filler background has no clusters', () => {
    expect(listClusters(gridFrom(blank()), C, R)).toEqual([]);
  });

  it('finds a plain 5-cluster and ignores a 4-group', () => {
    const b = blank();
    for (const [c, r] of [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]) b[r][c] = L1;
    for (const [c, r] of [[5, 5], [4, 5], [3, 5], [3, 4]]) b[r][c] = L2;
    const cl = listClusters(gridFrom(b), C, R);
    expect(cl.length).toBe(1);
    expect(cl[0].sym).toBe(L1);
    expect(cl[0].cells).toEqual(sorted([idx(0, 0), idx(1, 0), idx(2, 0), idx(2, 1), idx(2, 2)]));
  });

  it('a WILD counts in two clusters of different symbols', () => {
    const b = blank();
    // L1 arm: (0,2)(1,2) + wild (2,2) + (2,1)(2,0) → 5 with the wild
    for (const [c, r] of [[0, 2], [1, 2], [2, 1], [2, 0]]) b[r][c] = L1;
    b[2][2] = W;
    // L3 arm: (3,2)(4,2)(5,2)(2,3) + wild (2,2) → 5 with the wild
    for (const [c, r] of [[3, 2], [4, 2], [5, 2], [2, 3]]) b[r][c] = L3;
    const g = gridFrom(b);
    const cl = listClusters(g, C, R);
    expect(cl.map((x) => x.sym)).toEqual([L1, L3]);
    expect(cl[0].cells).toContain(idx(2, 2));
    expect(cl[1].cells).toContain(idx(2, 2));
    expect(cl[0].cells.length).toBe(5);
    expect(cl[1].cells.length).toBe(5);
    expect(cl).toEqual(reference(g, C, R));
  });

  it('pure-wild groups never pay; wilds only extend a symbol that is present', () => {
    const b = blank();
    for (let c = 0; c < C; c++) { b[0][c] = W; b[1][c] = SUN; } // wild row, sealed off by suns
    expect(listClusters(gridFrom(b), C, R)).toEqual([]);
    b[1][0] = L2; // one L2 under the wild row → 7-cluster of L2 (6 wilds + 1)
    const cl = listClusters(gridFrom(b), C, R);
    expect(cl.length).toBe(1);
    expect(cl[0].sym).toBe(L2);
    expect(cl[0].cells.length).toBe(7);
  });

  it('SUN never joins a cluster and blocks connectivity', () => {
    const b = blank();
    for (const [c, r] of [[0, 4], [1, 4], [3, 4], [4, 4], [5, 4]]) b[r][c] = H2;
    b[4][2] = SUN;
    expect(listClusters(gridFrom(b), C, R)).toEqual([]);
    b[4][2] = W;
    expect(listClusters(gridFrom(b), C, R)[0].cells.length).toBe(6);
  });

  it('two separate components of the same symbol are two clusters', () => {
    const b = blank();
    for (let c = 0; c < 5; c++) b[0][c] = H3;
    for (let c = 1; c < 6; c++) b[5][c] = H3;
    const cl = listClusters(gridFrom(b), C, R);
    expect(cl.length).toBe(2);
    expect(cl.every((x) => x.sym === H3 && x.cells.length === 5)).toBe(true);
  });

  it('size buckets 5,6,7,8,9-10,11-12,13-15,16+', () => {
    const want: [number, number][] = [[4, -1], [5, 0], [6, 1], [7, 2], [8, 3], [9, 4], [10, 4], [11, 5], [12, 5], [13, 6], [15, 6], [16, 7], [36, 7], [64, 7]];
    for (const [s, b] of want) expect(bucketOf(s)).toBe(b);
  });

  it('matches an independent naive flood fill on 3 000 real engine grids (incl. 8×8 storm-sized)', () => {
    let checked = 0;
    for (let i = 0; i < 3000; i++) {
      const r = spinBase(spinRng(424242, 'demo', i), 100);
      for (const st of r.steps) {
        const got = listClusters(st.grid, r.cols, r.rows);
        expect(got).toEqual(reference(st.grid, r.cols, r.rows));
        // the engine's Step.clusters are the same set (cells in BFS order there)
        expect(st.clusters.map((c) => ({ sym: c.sym, cells: sorted(c.cells) }))).toEqual(got);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(3000);
    // 8×8 random grids
    let x = 12345;
    for (let k = 0; k < 500; k++) {
      const g: number[] = [];
      for (let i = 0; i < 64; i++) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; g.push((x >>> 16) % 9); }
      expect(listClusters(g, 8, 8)).toEqual(reference(g, 8, 8));
    }
  });
});
