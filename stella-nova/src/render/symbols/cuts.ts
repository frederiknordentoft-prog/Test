/**
 * Procedural cut stones. Everything is built in "unit space": the symbol's
 * footprint is a circle of diameter 1 in the XZ plane, +Y is up, −Z points
 * away from the orrery's centre and +X is the clockwise tangent.
 *
 * Geometry is non-indexed with one flat normal per facet. `aEdge` carries
 * barycentric distances with the internal diagonals of quads and fans
 * removed, so the shader can draw a hairline on real facet junctions only.
 */
import * as THREE from 'three';

type V3 = readonly [number, number, number];
type V2 = readonly [number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A point well below (or above) everything: "outward" then simply means up (or down). */
const UP: V3 = [0, -1e4, 0];
const DOWN: V3 = [0, 1e4, 0];

class FacetBuilder {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];
  private readonly edge: number[] = [];

  /**
   * One flat triangle. `inside` is any point on the inner side of the facet;
   * the winding is fixed up so the normal points away from it.
   * eab / ebc / eca say which sides are real facet edges.
   */
  tri(a: V3, b: V3, c: V3, inside: V3, eab = true, ebc = true, eca = true, shared?: V3): void {
    let n = norm(cross(sub(b, a), sub(c, a)));
    const centroid: V3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const area = Math.hypot(...cross(sub(b, a), sub(c, a)));
    if (area < 1e-7) return;
    if (dot(n, sub(centroid, inside)) < 0) {
      [b, c] = [c, b];
      [eab, eca] = [eca, eab];
      n = [-n[0], -n[1], -n[2]];
    }
    if (shared) n = dot(shared, n) < 0 ? [-shared[0], -shared[1], -shared[2]] : shared;
    this.pos.push(...a, ...b, ...c);
    this.nrm.push(...n, ...n, ...n);
    // Component i is the distance to the side opposite vertex i. A side that
    // is not a facet edge gets 1 at both of its ends, so it never reaches 0.
    const ha = ebc ? 0 : 1;
    const hb = eca ? 0 : 1;
    const hc = eab ? 0 : 1;
    this.edge.push(1, hb, hc, ha, 1, hc, ha, hb, 1);
  }

  /** A four-sided facet a→b→c→d. One normal for both halves, diagonal hidden. */
  quad(a: V3, b: V3, c: V3, d: V3, inside: V3): void {
    const n = norm(cross(sub(c, a), sub(d, b)));
    this.tri(a, b, c, inside, true, true, false, n);
    this.tri(a, c, d, inside, false, true, true, n);
  }

  /** A flat polygon as a fan, outer edges only. */
  poly(pts: readonly V3[], inside: V3): void {
    let n: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      n[0] += (p[1] - q[1]) * (p[2] + q[2]);
      n[1] += (p[2] - q[2]) * (p[0] + q[0]);
      n[2] += (p[0] - q[0]) * (p[1] + q[1]);
    }
    const nn = norm(n);
    for (let i = 1; i < pts.length - 1; i++) {
      this.tri(pts[0], pts[i], pts[i + 1], inside, i === 1, true, i === pts.length - 2, nn);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('aEdge', new THREE.Float32BufferAttribute(this.edge, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

const ring = (outline: readonly V2[], y: number, scale = 1): V3[] => outline.map((p) => [p[0] * scale, y, p[1] * scale]);

/** Girdle band plus a plain pavilion down to a culet. Never seen from above, but the stone must be closed when it tumbles. */
function closeBelow(fb: FacetBuilder, outline: readonly V2[], yTop: number, thickness: number, depth: number, inside: V3, keel = 0): void {
  const top = ring(outline, yTop);
  const bot = ring(outline, yTop - thickness);
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    fb.quad(top[i], top[j], bot[j], bot[i], inside);
    // A keel (a short ridge instead of a point) suits the long stones.
    const cx = Math.max(-keel, Math.min(keel, (bot[i][0] + bot[j][0]) / 2));
    const cxi = Math.max(-keel, Math.min(keel, bot[i][0]));
    const cxj = Math.max(-keel, Math.min(keel, bot[j][0]));
    const yc = yTop - thickness - depth;
    if (keel > 0 && Math.abs(cxi - cxj) > 1e-4) fb.quad(bot[i], bot[j], [cxj, yc, 0], [cxi, yc, 0], inside);
    else fb.tri(bot[i], bot[j], [cx, yc, 0], inside);
  }
}

/** Sapphire: a round brilliant. Table, 8 stars, 8 bezel kites, 16 upper-girdle facets. */
export function brilliantGeometry(): THREE.BufferGeometry {
  const fb = new FacetBuilder();
  const R = 0.47;
  const Rt = 0.262;
  const Rs = 0.368;
  const yG = -0.035;
  const hc = 0.155;
  const yT = yG + hc;
  const inside: V3 = [0, yG - 0.02, 0];
  const pt = (r: number, k: number, y: number): V3 => {
    const a = (k * Math.PI) / 8;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  // The star tips sit on the bezel planes, which keeps every kite flat.
  const yS = yT - ((Rs * Math.cos(Math.PI / 8) - Rt) / (R - Rt)) * hc;
  const T: V3[] = [];
  const S: V3[] = [];
  const G: V3[] = [];
  for (let j = 0; j < 8; j++) {
    T.push(pt(Rt, j * 2, yT));
    S.push(pt(Rs, j * 2 + 1, yS));
  }
  for (let k = 0; k < 16; k++) G.push(pt(R, k, yG));
  fb.poly(T, inside);
  for (let j = 0; j < 8; j++) {
    const jn = (j + 1) % 8;
    const jp = (j + 7) % 8;
    fb.tri(T[j], T[jn], S[j], inside);
    fb.quad(T[j], S[jp], G[j * 2], S[j], inside);
    fb.tri(S[j], G[j * 2], G[j * 2 + 1], inside);
    fb.tri(S[j], G[j * 2 + 1], G[(j * 2 + 2) % 16], inside);
  }
  closeBelow(fb, G.map((g) => [g[0], g[2]] as V2), yG, 0.028, 0.14, inside);
  return fb.build();
}

function octagon(a: number, b: number, c: number): V2[] {
  c = Math.max(0, Math.min(c, a, b));
  return [
    [a - c, -b],
    [a, -(b - c)],
    [a, b - c],
    [a - c, b],
    [-(a - c), b],
    [-a, b - c],
    [-a, -(b - c)],
    [-(a - c), -b],
  ];
}

/** Emerald: a step cut. Three tiers of long parallel facets around a wide table, long axis tangential. */
export function emeraldGeometry(): THREE.BufferGeometry {
  const fb = new FacetBuilder();
  const a = 0.455;
  const b = 0.335;
  const c = 0.135;
  const yG = -0.03;
  const inside: V3 = [0, yG - 0.02, 0];
  // Each tier moves every side inward by the same distance, as a lapidary would.
  const inset = (d: number) => octagon(a - d, b - d, c - d * (2 - Math.SQRT2));
  const tiers: [number, number][] = [
    [0, 0],
    [0.058, 0.05],
    [0.116, 0.09],
    [0.174, 0.118],
  ];
  let prev = ring(inset(0), yG);
  for (let t = 1; t < tiers.length; t++) {
    const next = ring(inset(tiers[t][0]), yG + tiers[t][1]);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      fb.quad(prev[i], prev[j], next[j], next[i], inside);
    }
    prev = next;
  }
  fb.poly(prev, inside);
  closeBelow(fb, inset(0), yG, 0.026, 0.14, inside, a - b);
  return fb.build();
}

/**
 * A brilliant-style crown for any convex outline: two tiers of triangles that
 * zigzag between the girdle, a ring of mid points and the table.
 */
function zigzagCrown(fb: FacetBuilder, outline: readonly V2[], yG: number, mid: [number, number], table: [number, number], inside: V3): void {
  const n = outline.length;
  const G = ring(outline, yG);
  const M: V3[] = [];
  for (let i = 0; i < n; i++) {
    const p = outline[i];
    const q = outline[(i + 1) % n];
    M.push([((p[0] + q[0]) / 2) * mid[0], yG + mid[1], ((p[1] + q[1]) / 2) * mid[0]]);
  }
  const T = ring(outline, yG + table[1], table[0]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    fb.tri(G[i], G[j], M[i], inside);
    fb.tri(G[j], M[j], M[i], inside);
    fb.tri(M[i], M[j], T[j], inside);
    fb.tri(M[i], T[j], T[i], inside);
  }
  fb.poly(T, inside);
}

/** Amethyst: a trillion. Curved sides, blunted corners, the apex pointing outward (−Z). */
export function trillionGeometry(): THREE.BufferGeometry {
  const fb = new FacetBuilder();
  const Rc = 0.54;
  const bulge = 0.085;
  const perSide = 4;
  const blunt = 0.07;
  const corners: V2[] = [-90, 30, 150].map((deg) => {
    const r = (deg * Math.PI) / 180;
    return [Math.cos(r) * Rc, Math.sin(r) * Rc] as V2;
  });
  const outline: V2[] = [];
  for (let s = 0; s < 3; s++) {
    const c0 = corners[s];
    const c1 = corners[(s + 1) % 3];
    const mx = (c0[0] + c1[0]) / 2;
    const mz = (c0[1] + c1[1]) / 2;
    const ml = Math.hypot(mx, mz);
    for (let k = 0; k <= perSide; k++) {
      const t = blunt + ((1 - 2 * blunt) * k) / perSide;
      const out = bulge * 4 * t * (1 - t);
      outline.push([c0[0] + (c1[0] - c0[0]) * t + (mx / ml) * out, c0[1] + (c1[1] - c0[1]) * t + (mz / ml) * out]);
    }
  }
  const yG = -0.03;
  const inside: V3 = [0, yG - 0.02, 0];
  zigzagCrown(fb, outline, yG, [0.8, 0.075], [0.5, 0.135], inside);
  closeBelow(fb, outline, yG, 0.026, 0.13, inside);
  const g = fb.build();
  // A triangle's centroid is not the middle of its bounding box: slide it so the stone sits centred in its cell.
  g.translate(0, 0, TRILLION_SHIFT_Z);
  return g;
}
export const TRILLION_SHIFT_Z = 0.075;

/**
 * Ruby: a lozenge, long axis radial. A bevelled frame, then a French-cut top:
 * four long facets run from the table out to the points like a cross.
 */
export function lozengeGeometry(): THREE.BufferGeometry {
  const fb = new FacetBuilder();
  const a = 0.5;
  const b = 0.375;
  const yG = -0.03;
  const y1 = yG + 0.064;
  const yT = yG + 0.128;
  const inside: V3 = [0, yG - 0.02, 0];
  const corners: V2[] = [
    [0, -a],
    [b, 0],
    [0, a],
    [-b, 0],
  ];
  const G = ring(corners, yG);
  const I = ring(corners, y1, 0.74);
  // The table is a rectangle turned against the girdle: its corners face the sides.
  const T: V3[] = I.map((p, i) => {
    const q = I[(i + 1) % 4];
    return [((p[0] + q[0]) / 2) * 0.6, yT, ((p[2] + q[2]) / 2) * 0.6] as V3;
  });
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const p = (i + 3) % 4;
    fb.quad(G[i], G[j], I[j], I[i], inside);
    fb.tri(I[i], T[p], T[i], inside);
    fb.tri(I[i], I[j], T[i], inside);
  }
  fb.poly(T, inside);
  closeBelow(fb, corners, yG, 0.026, 0.13, inside);
  return fb.build();
}

/**
 * Wild: an eight-pointed star. Four long and four short rays, each a ridge
 * with two facets, around a raised octagonal boss.
 */
export function starGeometry(): THREE.BufferGeometry {
  const fb = new FacetBuilder();
  const RL = 0.5;
  const RS = 0.335;
  const rv = 0.15;
  const rc = 0.115;
  const y0 = -0.03;
  const yA = 0.075;
  const yP = 0.17;
  const yB = -0.12;
  const pt = (r: number, k: number, y: number): V3 => {
    const a = (k * Math.PI) / 8 - Math.PI / 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  const T: V3[] = [];
  const V: V3[] = [];
  const A: V3[] = [];
  for (let i = 0; i < 8; i++) {
    T.push(pt(i % 2 === 0 ? RL : RS, i * 2, y0));
    V.push(pt(rv, i * 2 + 1, y0));
    A.push(pt(i % 2 === 0 ? rc : rc * 0.92, i * 2, yA));
  }
  const P: V3 = [0, yP, 0];
  const B: V3 = [0, yB, 0];
  for (let i = 0; i < 8; i++) {
    const n = (i + 1) % 8;
    const p = (i + 7) % 8;
    fb.tri(T[i], V[i], A[i], UP);
    fb.tri(T[i], A[i], V[p], UP);
    fb.tri(A[i], V[i], A[n], UP);
    fb.tri(A[i], A[n], P, UP);
    fb.tri(T[i], V[i], B, DOWN);
    fb.tri(V[i], T[n], B, DOWN);
  }
  return fb.build();
}

/** Comet nucleus: a rough shard of ice. */
export function nucleusGeometry(): THREE.BufferGeometry {
  const fb = new FacetBuilder();
  const src = new THREE.IcosahedronGeometry(1, 1);
  const p = src.getAttribute('position');
  const jitter = (x: number, y: number, z: number): V3 => {
    // The same corner must move the same way in every face that shares it.
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const k = 0.8 + 0.34 * (h - Math.floor(h));
    return [x * k * 0.16, y * k * 0.12, z * k * 0.14];
  };
  for (let i = 0; i < p.count; i += 3) {
    fb.tri(
      jitter(p.getX(i), p.getY(i), p.getZ(i)),
      jitter(p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)),
      jitter(p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)),
      [0, 0, 0],
    );
  }
  src.dispose();
  return fb.build();
}
