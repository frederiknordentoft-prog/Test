/**
 * Small procedural-geometry kit for the orrery. Everything the instrument is
 * made of is either a turned profile (lathe) or a faceted solid (flat faces),
 * so two primitives cover it. Each vertex carries, besides the usual
 * position / normal / uv:
 *   color  linear albedo (the brass material is white and tinted per vertex)
 *   aFx    x = emissive hairline, y = gap-facing wall, z = rim top, w = ring-local angle
 *   aGear  centre x, centre z, angular speed, phase (clockwork only)
 */
import * as THREE from 'three';

export type RGB = readonly [number, number, number];

export interface ProfilePoint {
  r: number;
  y: number;
  /** Texture v. Defaults to the running arc length times vScale. */
  v?: number;
  c?: RGB;
  fx?: RGB;
}

export type P3 = readonly number[];

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();

export class GeoBuilder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uvs: number[] = [];
  private readonly col: number[] = [];
  private readonly fxs: number[] = [];
  private readonly gears: number[] = [];
  private readonly idx: number[] = [];
  private matrix: THREE.Matrix4 | null = null;
  private readonly normalMatrix = new THREE.Matrix3();

  /** Current vertex colour (linear). */
  color: RGB = [1, 1, 1];
  /** Current fx.xyz. */
  fx: RGB = [0, 0, 0];
  /** Current fx.w. */
  fxW = 0;
  /** Current gear reference: centre x, centre z, speed, phase. */
  gear: readonly [number, number, number, number] = [0, 0, 0, 0];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  get triangleCount(): number {
    return this.idx.length / 3;
  }

  /** Transform applied to everything added from now on. Must not mirror. */
  setMatrix(m: THREE.Matrix4 | null): void {
    this.matrix = m;
    if (m) this.normalMatrix.getNormalMatrix(m);
  }

  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, u = 0, v = 0, c: RGB = this.color, fx: RGB = this.fx, w = this.fxW): number {
    if (this.matrix) {
      _v.set(x, y, z).applyMatrix4(this.matrix);
      _n.set(nx, ny, nz).applyMatrix3(this.normalMatrix).normalize();
      x = _v.x;
      y = _v.y;
      z = _v.z;
      nx = _n.x;
      ny = _n.y;
      nz = _n.z;
    }
    const i = this.pos.length / 3;
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.uvs.push(u, v);
    this.col.push(c[0], c[1], c[2]);
    this.fxs.push(fx[0], fx[1], fx[2], w);
    const g = this.gear;
    this.gears.push(g[0], g[1], g[2], g[3]);
    return i;
  }

  /**
   * Flat convex polygon. The winding is fixed up so the face normal points
   * along the hint, which removes a whole class of inside-out mistakes.
   */
  face(pts: readonly P3[], hx: number, hy: number, hz: number): void {
    let nx = 0;
    let ny = 0;
    let nz = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) return;
    nx /= l;
    ny /= l;
    nz /= l;
    const flip = nx * hx + ny * hy + nz * hz < 0;
    if (flip) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const base = this.vertexCount;
    for (const p of pts) this.vertex(p[0], p[1], p[2], nx, ny, nz, p[3] ?? 0, p[4] ?? 0);
    for (let i = 1; i < n - 1; i++) {
      if (flip) this.idx.push(base, base + i + 1, base + i);
      else this.idx.push(base, base + i, base + i + 1);
    }
  }

  /** Faceted skin over a stack of cross-sections (same point count each). */
  loft(sections: readonly (readonly P3[])[], capEnd = true, capStart = false): void {
    const centroid = (s: readonly P3[]): number[] => {
      const c = [0, 0, 0];
      for (const p of s) {
        c[0] += p[0];
        c[1] += p[1];
        c[2] += p[2];
      }
      return [c[0] / s.length, c[1] / s.length, c[2] / s.length];
    };
    for (let k = 0; k < sections.length - 1; k++) {
      const A = sections[k];
      const B = sections[k + 1];
      const ca = centroid(A);
      const cb = centroid(B);
      const mx = (ca[0] + cb[0]) / 2;
      const my = (ca[1] + cb[1]) / 2;
      const mz = (ca[2] + cb[2]) / 2;
      for (let i = 0; i < A.length; i++) {
        const j = (i + 1) % A.length;
        const q = [A[i], A[j], B[j], B[i]];
        const qc = centroid(q);
        this.face(q, qc[0] - mx, qc[1] - my, qc[2] - mz);
      }
    }
    const last = sections.length - 1;
    if (capEnd) {
      const a = centroid(sections[last]);
      const b = centroid(sections[last - 1]);
      this.face(sections[last], a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    }
    if (capStart) {
      const a = centroid(sections[0]);
      const b = centroid(sections[1]);
      this.face(sections[0], a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    }
  }

  /**
   * Surface of revolution about the local Y axis. Angles run clockwise seen
   * from above, starting at −Z (the spoke convention). `runs` is a list of
   * polylines in (r, y): points inside a run are smooth-shaded, separate runs
   * meet in a crease. Walk each run so the outside is on the left: inner wall
   * upward, top faces outward, outer wall downward.
   */
  lathe(
    runs: readonly (readonly ProfilePoint[])[],
    segments: number,
    o: { u0?: number; u1?: number; vScale?: number; angleInFx?: boolean; a0?: number; a1?: number; caps?: boolean } = {},
  ): void {
    const u0 = o.u0 ?? 0;
    const u1 = o.u1 ?? 1;
    const vScale = o.vScale ?? 1;
    // Partial sweeps (a0..a1) make arcs; `caps` closes their two ends (convex profiles only).
    const a0 = o.a0 ?? 0;
    const a1 = o.a1 ?? Math.PI * 2;
    if (o.caps) {
      for (const [a, sign] of [[a0, -1], [a1, 1]] as const) {
        const s = Math.sin(a);
        const c = Math.cos(a);
        const pts: number[][] = [];
        for (const run of runs) for (const p of run) pts.push([s * p.r, p.y, -c * p.r]);
        this.face(pts, sign * c, 0, sign * s);
      }
    }
    let arc = 0;
    for (const run of runs) {
      const n = run.length;
      const nr: number[] = [];
      const ny: number[] = [];
      const vs: number[] = [];
      for (let i = 0; i < n; i++) {
        let ax = 0;
        let ay = 0;
        if (i > 0) {
          const dr = run[i].r - run[i - 1].r;
          const dy = run[i].y - run[i - 1].y;
          const l = Math.hypot(dr, dy) || 1;
          ax += -dy / l;
          ay += dr / l;
          arc += Math.hypot(dr, dy);
        }
        if (i < n - 1) {
          const dr = run[i + 1].r - run[i].r;
          const dy = run[i + 1].y - run[i].y;
          const l = Math.hypot(dr, dy) || 1;
          ax += -dy / l;
          ay += dr / l;
        }
        const l = Math.hypot(ax, ay) || 1;
        nr.push(ax / l);
        ny.push(ay / l);
        vs.push(run[i].v ?? arc * vScale);
      }
      const base = this.vertexCount;
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const a = a0 + t * (a1 - a0);
        const s = Math.sin(a);
        const c = Math.cos(a);
        for (let i = 0; i < n; i++) {
          const p = run[i];
          this.vertex(s * p.r, p.y, -c * p.r, s * nr[i], ny[i], -c * nr[i], u0 + (u1 - u0) * t, vs[i], p.c, p.fx, o.angleInFx ? a : this.fxW);
        }
      }
      for (let j = 0; j < segments; j++) {
        for (let i = 0; i < n - 1; i++) {
          const A = base + j * n + i;
          const B = A + 1;
          const D = A + n;
          const C = D + 1;
          this.idx.push(A, D, B, B, D, C);
        }
      }
    }
  }

  build(o: { color?: boolean; fx?: boolean; gear?: boolean } = {}): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    if (o.color !== false) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (o.fx) g.setAttribute('aFx', new THREE.Float32BufferAttribute(this.fxs, 4));
    if (o.gear) g.setAttribute('aGear', new THREE.Float32BufferAttribute(this.gears, 4));
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Quarter-turn style arc of profile points, for beads and coves. */
export function arcPoints(cx: number, cy: number, radius: number, fromDeg: number, toDeg: number, steps: number, extra: Partial<ProfilePoint> = {}): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = THREE.MathUtils.degToRad(fromDeg + ((toDeg - fromDeg) * i) / steps);
    out.push({ r: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius, ...extra });
  }
  return out;
}
