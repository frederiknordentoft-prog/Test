// CPU fallback backend: CpuCore physics + Canvas2D rendering (velocity heatmap,
// simple additive particles, obstacle silhouette). Reduced feature set, same physics gates.

import type { Backend, ForceSample, GridSize, PoseState, ProbeResult, ShapeSpec, SimParams, StepInputs } from '../types';
import { ASPECT } from '../types';
import { CpuCore } from './CpuCore';
import { seqLutData, divLutData } from '../../render/colormaps';
import { mulberry32 } from '../determinism';

const N_PARTICLES = 900;
const RAKE_ROWS = 13;

export class CpuBackend implements Backend {
  readonly kind = 'cpu' as const;
  grid: GridSize;
  lastStepCount = 0;

  private core: CpuCore;
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private buffer: HTMLCanvasElement;
  private bufferCtx: CanvasRenderingContext2D;
  private image: ImageData;
  private lutSeq = seqLutData();
  private lutDiv = divLutData();
  private shape: ShapeSpec | null = null;
  private pose: PoseState = { theta: 0, bend: [0, 0] };
  private obstacleDirty = true;
  private probeCell: [number, number] | null = null;
  private lastForce: (ForceSample & { bad: boolean }) | null = null;
  private lastUin = 0.05;
  // particles: x, y (cells), age
  private parts: Float32Array;
  private rand: () => number;

  constructor(canvas: HTMLCanvasElement, grid: GridSize, seed: number) {
    this.canvas = canvas;
    this.grid = grid;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.core = new CpuCore(grid.w, grid.h);
    this.image = new ImageData(grid.w, grid.h);
    this.buffer = document.createElement('canvas');
    this.buffer.width = grid.w;
    this.buffer.height = grid.h;
    this.bufferCtx = this.buffer.getContext('2d')!;
    this.rand = mulberry32(seed);
    this.parts = new Float32Array(N_PARTICLES * 3);
    for (let i = 0; i < N_PARTICLES; i++) this.respawn(i, true);
    this.core.init(0.05);
  }

  private respawn(i: number, scatter = false): void {
    const row = i % RAKE_ROWS;
    this.parts[i * 3] = scatter ? 2 + this.rand() * (this.grid.w - 8) : 1.5 + this.rand() * 4;
    this.parts[i * 3 + 1] = ((row + 0.5 + (this.rand() - 0.5) * 0.3) / RAKE_ROWS) * this.grid.h;
    this.parts[i * 3 + 2] = this.rand() * 50;
  }

  setShape(shape: ShapeSpec | null): void {
    this.shape = shape;
    this.obstacleDirty = true;
  }

  setPose(pose: PoseState): void {
    if (pose.theta !== this.pose.theta || pose.bend[0] !== this.pose.bend[0] || pose.bend[1] !== this.pose.bend[1]) {
      this.pose = { theta: pose.theta, bend: [pose.bend[0], pose.bend[1]] };
      this.obstacleDirty = true;
    }
  }

  setProbe(p: [number, number] | null): void {
    this.probeCell = p ? [Math.round((p[0] / ASPECT) * this.grid.w), Math.round(p[1] * this.grid.h)] : null;
  }

  step(n: number, inputs: StepInputs): void {
    if (this.obstacleDirty) {
      this.core.rasterize(this.shape, this.pose);
      this.obstacleDirty = false;
    }
    this.lastUin = inputs.uIn;
    for (let s = 0; s < n; s++) this.core.step(inputs.uIn, inputs.tau);
    this.lastStepCount = n;
  }

  requestForces(): void {
    this.lastForce = this.core.measureForce();
  }

  pollReadbacks(): { force?: ForceSample; probe?: ProbeResult; bad?: boolean } {
    const out: { force?: ForceSample; probe?: ProbeResult; bad?: boolean } = {};
    if (this.lastForce) {
      out.force = this.lastForce;
      out.bad = this.lastForce.bad;
      this.lastForce = null;
    }
    if (this.probeCell) out.probe = this.core.probeAt(this.probeCell[0], this.probeCell[1]);
    return out;
  }

  readForceSync(): ForceSample & { bad: boolean } {
    return this.core.measureForce();
  }

  reset(uIn: number): void {
    if (this.obstacleDirty) {
      this.core.rasterize(this.shape, this.pose);
      this.obstacleDirty = false;
    }
    this.core.init(uIn);
  }

  resize(grid: GridSize): void {
    if (grid.w === this.grid.w && grid.h === this.grid.h) return;
    this.grid = grid;
    this.core = new CpuCore(grid.w, grid.h);
    this.image = new ImageData(grid.w, grid.h);
    this.buffer.width = grid.w;
    this.buffer.height = grid.h;
    this.obstacleDirty = true;
    this.reset(this.lastUin);
  }

  render(params: SimParams, _pose: PoseState, _timeSec: number): void {
    const { w, h } = this.grid;
    const core = this.core;
    const uin = Math.max(this.lastUin, 1e-4);
    const data = this.image.data;
    const diverging = params.overlay === 'vorticity' || params.overlay === 'pressure';
    const lut = diverging ? this.lutDiv : this.lutSeq;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        // ImageData row 0 is top; sim row 0 is bottom → flip
        const di = ((h - 1 - y) * w + x) * 4;
        if (core.solid[idx]) {
          data[di] = 219; data[di + 1] = 227; data[di + 2] = 238; data[di + 3] = 255;
          continue;
        }
        let t: number;
        if (params.overlay === 'pressure') {
          t = ((core.rho[idx] - 1) / 3 / (uin * uin * 1.2)) * 0.5 + 0.5;
        } else if (params.overlay === 'vorticity') {
          const xm = Math.max(0, x - 1), xp = Math.min(w - 1, x + 1);
          const ym = Math.max(0, y - 1), yp = Math.min(h - 1, y + 1);
          const curl = core.uy[y * w + xp] - core.uy[y * w + xm] - (core.ux[yp * w + x] - core.ux[ym * w + x]);
          t = (curl / (0.35 * uin)) * 0.5 + 0.5;
        } else if (params.overlay === 'none') {
          t = -1;
        } else {
          t = Math.hypot(core.ux[idx], core.uy[idx]) / (1.6 * uin);
        }
        if (t < 0) {
          data[di] = 11; data[di + 1] = 14; data[di + 2] = 20; data[di + 3] = 255;
        } else {
          const li = Math.min(255, Math.max(0, Math.round(t * 255))) * 4;
          // blend 80% field over dark bg
          data[di] = Math.round(lut[li] * 0.82 + 11 * 0.18);
          data[di + 1] = Math.round(lut[li + 1] * 0.82 + 14 * 0.18);
          data[di + 2] = Math.round(lut[li + 2] * 0.82 + 20 * 0.18);
          data[di + 3] = 255;
        }
      }
    }
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    this.bufferCtx.putImageData(this.image, 0, 0);
    ctx.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
    if (params.smoke && !params.reducedMotion) this.drawParticles(params);
  }

  private drawParticles(_params: SimParams): void {
    const { w, h } = this.grid;
    const core = this.core;
    const ctx = this.ctx;
    const sx = this.canvas.width / w;
    const sy = this.canvas.height / h;
    const steps = this.lastStepCount || 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(125, 195, 255, 0.5)';
    for (let i = 0; i < N_PARTICLES; i++) {
      let x = this.parts[i * 3];
      let y = this.parts[i * 3 + 1];
      const cx = Math.min(w - 1, Math.max(0, Math.round(x)));
      const cy = Math.min(h - 1, Math.max(0, Math.round(y)));
      const idx = cy * w + cx;
      x += core.ux[idx] * steps;
      y += core.uy[idx] * steps;
      this.parts[i * 3 + 2] += 1;
      if (x >= w - 2 || x < 0.5 || y < 0.5 || y >= h - 0.5 || core.solid[idx] || this.parts[i * 3 + 2] > 1600) {
        this.respawn(i);
      } else {
        this.parts[i * 3] = x;
        this.parts[i * 3 + 1] = y;
      }
      ctx.fillRect(x * sx, (h - y) * sy, 1.6, 1.6);
    }
    ctx.restore();
  }

  dispose(): void {
    // nothing owned beyond the canvas context
  }
}
