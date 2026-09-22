// ============================================================
// NORDLYS · cluster detection (orthogonal flood fill).
//
// For each paying symbol s = 0..6 (L1..H3): connected components over cells that are s OR WILD,
// seeded only from cells that are exactly s (so every cluster holds ≥1 real s; pure-wild groups
// never pay). Size ≥ 5 pays. A WILD may belong to clusters of several symbols. SUN never joins.
// Clusters are reported in (sym ascending, lowest seed cell ascending) order; cells in BFS order.
// ============================================================
import { SYM } from './types.ts';
import { MAX_CELLS, type Geometry, geometry } from './grid.ts';

const WILD = SYM.WILD;
export const MIN_CLUSTER = 5;
export const PAYING_SYMS = 7;

/** Preallocated scratch; one per thread is enough (JS is single threaded per isolate). */
export interface ClusterScratch {
  vis: Int32Array;      // visit stamps
  stamp: number;
  stack: Int16Array;
  cells: Int16Array;    // flat cell list of all clusters
  clSym: Int8Array;
  clStart: Int16Array;
  clSize: Int16Array;
  count: number;        // number of clusters found
  cnt: Int32Array;      // symbol counts of the evaluated grid (0..8)
}

export function newClusterScratch(): ClusterScratch {
  return {
    vis: new Int32Array(MAX_CELLS),
    stamp: 0,
    stack: new Int16Array(MAX_CELLS),
    cells: new Int16Array(MAX_CELLS * PAYING_SYMS),
    clSym: new Int8Array(MAX_CELLS),
    clStart: new Int16Array(MAX_CELLS),
    clSize: new Int16Array(MAX_CELLS),
    count: 0,
    cnt: new Int32Array(9),
  };
}

/** Finds all paying clusters (size ≥ 5). Allocation-free. Returns the cluster count. */
export function findClusters(grid: Uint8Array | number[], geo: Geometry, scr: ClusterScratch): number {
  const n = geo.n, nb = geo.nb, vis = scr.vis, stack = scr.stack, cells = scr.cells, cnt = scr.cnt;
  cnt.fill(0);
  for (let i = 0; i < n; i++) cnt[grid[i]]++;
  const wilds = cnt[WILD];
  let count = 0, used = 0;
  if (scr.stamp > 0x3fffffff) {
    vis.fill(0);
    scr.stamp = 0;
  }
  for (let s = 0; s < PAYING_SYMS; s++) {
    if (cnt[s] === 0 || cnt[s] + wilds < MIN_CLUSTER) continue;
    const stamp = ++scr.stamp;
    for (let i = 0; i < n; i++) {
      if (grid[i] !== s || vis[i] === stamp) continue;
      let top = 0;
      stack[top++] = i;
      vis[i] = stamp;
      const start = used;
      while (top > 0) {
        const c = stack[--top];
        cells[used++] = c;
        const b = c * 4;
        for (let k = 0; k < 4; k++) {
          const j = nb[b + k];
          if (j < 0 || vis[j] === stamp) continue;
          const g = grid[j];
          if (g === s || g === WILD) {
            vis[j] = stamp;
            stack[top++] = j;
          }
        }
      }
      const size = used - start;
      if (size >= MIN_CLUSTER) {
        scr.clSym[count] = s;
        scr.clStart[count] = start;
        scr.clSize[count] = size;
        count++;
      } else {
        used = start; // discard (its wilds stay stamped for this s: they cannot join another s-component)
      }
    }
  }
  scr.count = count;
  return count;
}

/** Convenience (allocating) wrapper for tests/tools: list of { sym, cells } with cells sorted ascending. */
export function listClusters(grid: readonly number[], cols: number, rows: number): { sym: number; cells: number[] }[] {
  const scr = newClusterScratch();
  const g = Uint8Array.from(grid);
  const k = findClusters(g, geometry(cols, rows), scr);
  const out: { sym: number; cells: number[] }[] = [];
  for (let c = 0; c < k; c++) {
    const a: number[] = [];
    for (let j = 0; j < scr.clSize[c]; j++) a.push(scr.cells[scr.clStart[c] + j]);
    a.sort((x, y) => x - y);
    out.push({ sym: scr.clSym[c], cells: a });
  }
  return out;
}
