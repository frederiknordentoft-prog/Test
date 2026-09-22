// Voronoi fracture helpers (CPU, run once per pattern / per screen-shatter start — never per frame).
//
//   voronoiCells(seeds, x0, y0, x1, y1)  → convex cell polygons clipped to a rect (half-plane clipping, O(n²))
//   buildFracture(...)                    → planar shard graph with shared, jagged interior edges,
//                                           crack segments and per-node crack arrival (Dijkstra from impact)

/** Flat polygon: [x0, y0, x1, y1, ...], counter-clockwise in y-down screen space (i.e. visually clockwise). */
export type Poly = number[];

function clipHalfPlane(poly: Poly, nx: number, ny: number, c: number): Poly {
  // keep points with nx*x + ny*y <= c
  const out: Poly = [];
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const ax = poly[i * 2], ay = poly[i * 2 + 1];
    const j = (i + 1) % n;
    const bx = poly[j * 2], by = poly[j * 2 + 1];
    const da = nx * ax + ny * ay - c;
    const db = nx * bx + ny * by - c;
    if (da <= 0) out.push(ax, ay);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
  return out;
}

export function voronoiCells(seeds: ArrayLike<number>, x0: number, y0: number, x1: number, y1: number): Poly[] {
  const n = seeds.length / 2;
  const cells: Poly[] = [];
  for (let i = 0; i < n; i++) {
    const sx = seeds[i * 2], sy = seeds[i * 2 + 1];
    let poly: Poly = [x0, y0, x1, y0, x1, y1, x0, y1];
    for (let j = 0; j < n && poly.length >= 6; j++) {
      if (j === i) continue;
      const tx = seeds[j * 2], ty = seeds[j * 2 + 1];
      const nx = tx - sx, ny = ty - sy;
      if (nx === 0 && ny === 0) continue;
      const mx = (sx + tx) / 2, my = (sy + ty) / 2;
      poly = clipHalfPlane(poly, nx, ny, nx * mx + ny * my);
    }
    cells.push(poly);
  }
  return cells;
}

export function polyCentroid(p: Poly): [number, number, number] {
  let a = 0, cx = 0, cy = 0;
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cr = p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1];
    a += cr;
    cx += (p[i * 2] + p[j * 2]) * cr;
    cy += (p[i * 2 + 1] + p[j * 2 + 1]) * cr;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += p[i * 2]; sy += p[i * 2 + 1]; }
    return [sx / n, sy / n, 0];
  }
  return [cx / (6 * a), cy / (6 * a), Math.abs(a)];
}

// ─────────────────────────────────────────── fracture graph ───────────────────────────────────────────

export interface Fracture {
  /** node positions (px) */
  nx: number[]; ny: number[];
  /** crack arrival per node, normalised 0..1 (Infinity-free) */
  arrive: number[];
  /** shard polygons as node-index rings */
  shards: number[][];
  /** crack segments: node pairs (interior edges only, subdivided) */
  segA: number[]; segB: number[];
  /** crack chains: one node list per interior Voronoi edge (a → jag nodes → b) */
  chains: number[][];
  /** impact node */
  impact: number;
}

export interface FractureOptions {
  cells: number;
  impactX: number; impactY: number;
  w: number; h: number;
  rand: () => number;
  /** jag amplitude as a fraction of edge length */
  jag?: number;
  /** target sub-segment length in px */
  segLen?: number;
}

/**
 * Seeds denser near the impact (best-candidate sampling against a spacing that grows with distance),
 * Voronoi, the impact cell split into a radial star of triangles, interior edges subdivided with
 * perpendicular jitter (shared by both neighbours → no gaps), crack arrival via Dijkstra from the impact.
 */
export function buildFracture(o: FractureOptions): Fracture {
  const { w, h, rand } = o;
  const ix = Math.min(w - 1, Math.max(1, o.impactX)), iy = Math.min(h - 1, Math.max(1, o.impactY));
  const diag = Math.hypot(w, h);
  const n = Math.max(8, o.cells);
  const seeds: number[] = [ix, iy];
  const far = Math.max(Math.hypot(ix, iy), Math.hypot(w - ix, iy), Math.hypot(ix, h - iy), Math.hypot(w - ix, h - iy));
  // Polar-jittered layout → radial cracks + concentric rings, like impacted glass. Rays get their own angle,
  // ring radii grow geometrically (dense at the impact), every seed is jittered so nothing looks gridded.
  const rays = 7 + Math.floor(rand() * 3);
  const base = rand() * Math.PI * 2;
  const rayA: number[] = [];
  for (let j = 0; j < rays; j++) rayA.push(base + (j + (rand() - 0.5) * 0.55) * (Math.PI * 2 / rays));
  const step = (Math.PI * 2) / rays;
  const polar: number[] = [];
  const ringOf: number[] = [];
  let r = diag * 0.034;
  for (let ring = 0; r < far * 1.08 && ring < 12; ring++) {
    for (let j = 0; j < rays; j++) {
      const a = rayA[j] + (ring % 2) * step * 0.22 + (rand() - 0.5) * step * 0.34;
      const rr = r * (1 + (rand() - 0.5) * 0.34);
      const x = ix + Math.cos(a) * rr, y = iy + Math.sin(a) * rr;
      if (x > -w * 0.02 && x < w * 1.02 && y > -h * 0.02 && y < h * 1.02) { polar.push(x, y); ringOf.push(ring); }
    }
    r *= 1.52 + rand() * 0.2;
  }
  // too many → drop random seeds from the outer rings (keeps the dense core intact)
  const want = n - 1;
  const keep = ringOf.map(() => true);
  let count = ringOf.length;
  for (let guard = 0; count > want && guard < 10000; guard++) {
    const i = Math.floor(rand() * ringOf.length);
    if (keep[i] && ringOf[i] >= 2) { keep[i] = false; count--; }
  }
  for (let i = 0; i < ringOf.length; i++) if (keep[i]) seeds.push(polar[i * 2], polar[i * 2 + 1]);
  // too few → best-candidate fill against a spacing that grows with distance from the impact
  const spacing = (x: number, y: number) => 10 + Math.hypot(x - ix, y - iy) * 0.55;
  while (seeds.length / 2 < n) {
    let bx = 0, by = 0, best = -1;
    for (let c = 0; c < 14; c++) {
      const x = rand() * w, y = rand() * h;
      let dmin = 1e9;
      for (let q = 0; q < seeds.length; q += 2) dmin = Math.min(dmin, Math.hypot(seeds[q] - x, seeds[q + 1] - y));
      const score = dmin / spacing(x, y);
      if (score > best) { best = score; bx = x; by = y; }
    }
    seeds.push(bx, by);
  }
  const cells = voronoiCells(seeds, 0, 0, w, h);

  // ── unique nodes (merge within eps) ──
  const nx: number[] = [], ny: number[] = [];
  const eps = Math.max(0.5, diag * 0.0008);
  const nodeOf = (x: number, y: number): number => {
    for (let i = 0; i < nx.length; i++) if (Math.abs(nx[i] - x) < eps && Math.abs(ny[i] - y) < eps) return i;
    nx.push(x); ny.push(y);
    return nx.length - 1;
  };
  let rings: number[][] = [];
  for (const c of cells) {
    const ring: number[] = [];
    for (let i = 0; i < c.length; i += 2) {
      const id = nodeOf(c[i], c[i + 1]);
      if (ring.length === 0 || ring[ring.length - 1] !== id) ring.push(id);
    }
    if (ring.length > 1 && ring[0] === ring[ring.length - 1]) ring.pop();
    rings.push(ring);
  }
  // ── impact star: split cell 0 into triangles around the impact point ──
  const impact = nx.length;
  nx.push(ix); ny.push(iy);
  const c0 = rings[0];
  const star: number[][] = [];
  for (let i = 0; i < c0.length; i++) star.push([impact, c0[i], c0[(i + 1) % c0.length]]);
  rings = star.concat(rings.slice(1)).filter((r) => r.length >= 3);

  // ── edges: count usage; interior = used twice ──
  const key = (a: number, b: number) => (a < b ? a * 65536 + b : b * 65536 + a);
  const uses = new Map<number, number>();
  for (const r of rings) for (let i = 0; i < r.length; i++) {
    const k = key(r[i], r[(i + 1) % r.length]);
    uses.set(k, (uses.get(k) ?? 0) + 1);
  }
  // ── subdivide interior edges with jitter (inner nodes stored in a→b order for a<b) ──
  const jag = o.jag ?? 0.06;
  const segLen = o.segLen ?? Math.max(18, diag * 0.028);
  const inner = new Map<number, number[]>();
  for (const [k, u] of uses) {
    if (u < 2) continue;
    const a = Math.floor(k / 65536), b = k % 65536;
    const L = Math.hypot(nx[b] - nx[a], ny[b] - ny[a]);
    const m = Math.min(7, Math.floor(L / segLen));
    const list: number[] = [];
    const dx = (nx[b] - nx[a]) / L, dy = (ny[b] - ny[a]) / L;
    for (let s = 1; s <= m; s++) {
      const t = s / (m + 1) + (rand() - 0.5) * (0.5 / (m + 1));
      const off = (rand() - 0.5) * 2 * jag * L / Math.sqrt(m + 1);
      nx.push(nx[a] + (nx[b] - nx[a]) * t - dy * off);
      ny.push(ny[a] + (ny[b] - ny[a]) * t + dx * off);
      list.push(nx.length - 1);
    }
    inner.set(k, list);
  }
  // ── expand rings with the inner nodes ──
  const shards: number[][] = [];
  for (const r of rings) {
    const out: number[] = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      out.push(a);
      const list = inner.get(key(a, b));
      if (list) {
        if (a < b) for (let s = 0; s < list.length; s++) out.push(list[s]);
        else for (let s = list.length - 1; s >= 0; s--) out.push(list[s]);
      }
    }
    shards.push(out);
  }
  // ── crack segments + adjacency ──
  const segA: number[] = [], segB: number[] = [];
  const chains: number[][] = [];
  const adj: number[][] = nx.map(() => []);
  for (const [k, u] of uses) {
    if (u < 2) continue;
    const a = Math.floor(k / 65536), b = k % 65536;
    const chain = [a, ...(inner.get(k) ?? []), b];
    chains.push(chain);
    // organic propagation: some cracks run fast, some lag
    const speed = 0.75 + rand() * 0.7;
    for (let s = 0; s + 1 < chain.length; s++) {
      const p = chain[s], q = chain[s + 1];
      segA.push(p); segB.push(q);
      const wgt = Math.hypot(nx[q] - nx[p], ny[q] - ny[p]) / speed;
      adj[p].push(q, wgt); adj[q].push(p, wgt);
    }
  }
  // ── Dijkstra from the impact node (O(V²), V ≈ 300) ──
  const V = nx.length;
  const dist = new Array<number>(V).fill(Infinity);
  const done = new Array<boolean>(V).fill(false);
  dist[impact] = 0;
  for (let it = 0; it < V; it++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < V; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = true;
    const L = adj[u];
    for (let e = 0; e < L.length; e += 2) {
      const v = L[e], nd = best + L[e + 1];
      if (nd < dist[v]) dist[v] = nd;
    }
  }
  let maxD = 0;
  for (let i = 0; i < V; i++) if (dist[i] < Infinity && dist[i] > maxD) maxD = dist[i];
  const arrive = dist.map((d) => (d < Infinity ? d / Math.max(1e-6, maxD) : 1));
  return { nx, ny, arrive, shards, segA, segB, chains, impact };
}
