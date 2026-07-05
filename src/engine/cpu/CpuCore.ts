// Pure-TS D2Q9 core (no DOM, no GL) — the CPU fallback's physics AND the node test harness.
// Mirrors lbm.frag exactly: deviation storage, pull streaming, halfway bounce-back,
// equilibrium inflow, zero-gradient+sponge outflow, free-slip walls, BGK+Smagorinsky.

import { ASPECT, type ShapeSpec, type PoseState, type ForceSample } from '../types';

const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const EY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
const MIRY = [0, 1, 4, 3, 2, 8, 7, 6, 5];
const CSQ = 0.01;
const SPONGE_FRAC = 0.06;

export class CpuCore {
  readonly w: number;
  readonly h: number;
  g: Float32Array[]; // deviations, 9 planes
  private gNext: Float32Array[];
  rho: Float32Array;
  ux: Float32Array;
  uy: Float32Array;
  solid: Uint8Array;
  boundary: Uint8Array;
  private pivotCells: [number, number];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.g = Array.from({ length: 9 }, () => new Float32Array(n));
    this.gNext = Array.from({ length: 9 }, () => new Float32Array(n));
    this.rho = new Float32Array(n).fill(1);
    this.ux = new Float32Array(n);
    this.uy = new Float32Array(n);
    this.solid = new Uint8Array(n);
    this.boundary = new Uint8Array(n);
    this.pivotCells = [w / 2, h / 2];
  }

  /** Rasterize a posed shape polygon (tunnel coords) into the solid mask. */
  rasterize(shape: ShapeSpec | null, pose: PoseState): void {
    this.solid.fill(0);
    this.boundary.fill(0);
    if (shape) {
      const cos = Math.cos(pose.theta);
      const sin = Math.sin(pose.theta);
      const n = shape.points.length / 2;
      const px: number[] = [];
      const py: number[] = [];
      for (let i = 0; i < n; i++) {
        const x = shape.points[i * 2] - shape.pivot[0];
        const y = shape.points[i * 2 + 1] - shape.pivot[1];
        const wx = shape.pivot[0] + pose.bend[0] + x * cos - y * sin;
        const wy = shape.pivot[1] + pose.bend[1] + x * sin + y * cos;
        px.push((wx / ASPECT) * this.w);
        py.push(wy * this.h);
      }
      this.pivotCells = [((shape.pivot[0] + pose.bend[0]) / ASPECT) * this.w, (shape.pivot[1] + pose.bend[1]) * this.h];
      // even-odd scanline fill at cell centers
      for (let cy = 0; cy < this.h; cy++) {
        const yc = cy + 0.5;
        const xs: number[] = [];
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const y0 = py[i], y1 = py[j];
          if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) {
            xs.push(px[i] + ((yc - y0) / (y1 - y0)) * (px[j] - px[i]));
          }
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const x0 = Math.max(0, Math.ceil(xs[k] - 0.5));
          const x1 = Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5));
          for (let cx = x0; cx <= x1; cx++) this.solid[cy * this.w + cx] = 1;
        }
      }
    }
    // boundary flags
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const idx = y * this.w + x;
        if (this.solid[idx]) continue;
        let b = 0;
        for (let i = 1; i < 9 && !b; i++) {
          const qx = Math.min(this.w - 1, Math.max(0, x + EX[i]));
          const qy = Math.min(this.h - 1, Math.max(0, y + EY[i]));
          if (this.solid[qy * this.w + qx]) b = 1;
        }
        this.boundary[idx] = b;
      }
  }

  init(uIn: number): void {
    const usq = uIn * uIn;
    for (let i = 0; i < 9; i++) {
      const eu = EX[i] * uIn;
      const geq = W[i] * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * usq - 1);
      this.g[i].fill(geq);
      this.gNext[i].fill(geq);
    }
    this.rho.fill(1);
    this.ux.fill(uIn);
    this.uy.fill(0);
  }

  step(uIn: number, tau0: number): void {
    const { w, h, g, gNext, solid } = this;
    const uinUsq = uIn * uIn;
    const gin = new Float64Array(9);
    for (let i = 0; i < 9; i++) {
      const eu = EX[i] * uIn;
      gin[i] = W[i] * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * uinUsq - 1);
    }
    const gl = new Float64Array(9);
    const ge = new Float64Array(9);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (solid[idx]) {
          for (let i = 0; i < 9; i++) gNext[i][idx] = 0;
          this.rho[idx] = 1;
          this.ux[idx] = 0;
          this.uy[idx] = 0;
          continue;
        }
        if (x === 0) {
          for (let i = 0; i < 9; i++) gNext[i][idx] = gin[i];
          this.rho[idx] = 1;
          this.ux[idx] = uIn;
          this.uy[idx] = 0;
          continue;
        }
        // stream (pull)
        for (let i = 0; i < 9; i++) {
          let sx = x - EX[i];
          let sy = y - EY[i];
          let dir = i;
          if (sy < 0) { sy = 0; dir = MIRY[i]; }
          else if (sy >= h) { sy = h - 1; dir = MIRY[i]; }
          if (sx >= w) sx = w - 1;
          if (sx < 0) sx = 0;
          const sidx = sy * w + sx;
          gl[i] = solid[sidx] ? g[OPP[i]][idx] : g[dir][sidx];
        }
        // moments
        let rho = 1, mx = 0, my = 0;
        for (let i = 0; i < 9; i++) {
          rho += gl[i];
          mx += EX[i] * gl[i];
          my += EY[i] * gl[i];
        }
        rho = rho < 0.2 ? 0.2 : rho > 4 ? 4 : rho;
        let ux = mx / rho, uy = my / rho;
        ux = ux < -0.25 ? -0.25 : ux > 0.25 ? 0.25 : ux;
        uy = uy < -0.25 ? -0.25 : uy > 0.25 ? 0.25 : uy;
        const usq = ux * ux + uy * uy;
        // equilibrium + stress
        let pxx = 0, pyy = 0, pxy = 0;
        for (let i = 0; i < 9; i++) {
          const eu = EX[i] * ux + EY[i] * uy;
          ge[i] = W[i] * (rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * usq) - 1);
          const dg = gl[i] - ge[i];
          pxx += EX[i] * EX[i] * dg;
          pyy += EY[i] * EY[i] * dg;
          pxy += EX[i] * EY[i] * dg;
        }
        const qmag = Math.sqrt(pxx * pxx + pyy * pyy + 2 * pxy * pxy);
        let tau = tau0 + 0.5 * (Math.sqrt(tau0 * tau0 + 18 * 1.41421356 * CSQ * qmag / rho) - tau0);
        const xn = x / (w - 1);
        const sEdge = 1 - SPONGE_FRAC;
        if (xn > sEdge) {
          const s = Math.min(1, (xn - sEdge) / SPONGE_FRAC);
          const ss = s * s * (3 - 2 * s);
          tau = tau + ss * (0.5 + 8 * (tau - 0.5) - tau);
        }
        const invTau = 1 / tau;
        for (let i = 0; i < 9; i++) gNext[i][idx] = gl[i] - (gl[i] - ge[i]) * invTau;
        this.rho[idx] = rho;
        this.ux[idx] = ux;
        this.uy[idx] = uy;
      }
    }
    // swap
    const t = this.g;
    this.g = this.gNext;
    this.gNext = t;
  }

  /** Momentum-exchange force + torque about pivot. Also reports blowup. */
  measureForce(): ForceSample & { bad: boolean } {
    const { w, h, g, solid, boundary } = this;
    let fx = 0, fy = 0, tz = 0;
    let bad = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!solid[idx]) {
          const r = this.rho[idx];
          if (!isFinite(r) || r <= 0.21 || r >= 3.99) bad = true;
        }
        if (!boundary[idx]) continue;
        for (let i = 1; i < 9; i++) {
          const qx = x + EX[i];
          const qy = y + EY[i];
          if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
          if (!solid[qy * w + qx]) continue;
          const fi = g[i][idx] + W[i];
          const fo = g[OPP[i]][idx] + W[i];
          const dfx = EX[i] * (fi + fo);
          const dfy = EY[i] * (fi + fo);
          fx += dfx;
          fy += dfy;
          const rx = x + 0.5 + 0.5 * EX[i] - this.pivotCells[0];
          const ry = y + 0.5 + 0.5 * EY[i] - this.pivotCells[1];
          tz += rx * dfy - ry * dfx;
        }
      }
    }
    return { fx, fy, tz, bad };
  }

  probeAt(cx: number, cy: number): { speed: number; rho: number } {
    const idx = Math.min(this.h - 1, Math.max(0, cy)) * this.w + Math.min(this.w - 1, Math.max(0, cx));
    return { speed: Math.hypot(this.ux[idx], this.uy[idx]), rho: this.rho[idx] };
  }
}
