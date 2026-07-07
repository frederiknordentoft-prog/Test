// Engine facade: owns the rAF loop, backend selection (GPU → CPU fallback), wind ramping,
// pivot dynamics, adaptive quality ladder, rolling force averages and 10 Hz measurement
// publishing. Pure TS — no React, no store.

import type { Backend, FlowHints, GridSize, Measurements, PoseState, ShapeSpec, SimParams } from './types';
import { ASPECT } from './types';
import { createGl } from './gpu/gl';
import { GpuBackend } from './gpu/GpuBackend';
import { CpuBackend } from './cpu/CpuBackend';
import { PivotDynamics } from './pivot';
import { frontalHeight, massProperties } from './shape/polygon';
import { DEFAULT_SEED } from './determinism';
import { dragCoefficient, forceToNewtonPerM, reynolds, TAU0, windMsToULat, windSliderToMs } from './units';

export interface EngineOptions {
  onMeasure: (m: Measurements) => void;
  onToast?: (key: 'flow-reset') => void;
  seed?: number;
  /** Force CPU backend (debug/testing). */
  forceCpu?: boolean;
}

interface QualityPreset {
  grid: GridSize;
  substeps: number;
}

const GPU_LADDER: QualityPreset[] = [
  { grid: { w: 256, h: 128 }, substeps: 3 },
  { grid: { w: 384, h: 192 }, substeps: 4 },
  { grid: { w: 512, h: 256 }, substeps: 5 },
];
const CPU_GRID: GridSize = { w: 192, h: 96 };

const DEFAULT_PARAMS: SimParams = {
  windSpeed: 0.4,
  density: 1,
  restAngleDeg: 0,
  pivotLocked: true,
  timeScale: 1,
  overlay: 'none',
  smoke: true,
  paused: false,
  quality: 'auto',
  probe: null,
  reducedMotion: false,
};

export class Engine {
  readonly backendKind: 'gpu' | 'cpu';

  private backend: Backend;
  private canvas: HTMLCanvasElement;
  private params: SimParams = { ...DEFAULT_PARAMS };
  private shape: ShapeSpec | null = null;
  private pivot = new PivotDynamics();
  private pose: PoseState = { theta: 0, bend: [0, 0] };
  private opts: EngineOptions;

  private raf = 0;
  private running = false;
  private uInCurrent = 0;
  private lastTime = 0;
  private fpsEma = 60;
  private ladderIdx = 2;
  private ladderTimer = 0;
  private resets = 0;

  // rolling force window (real-time seconds, lattice forces)
  private forceWindow: { t: number; fx: number; fy: number; tz: number }[] = [];
  private lastForce = { fx: 0, fy: 0, tz: 0 };
  /** Lift sign flips stamped in cumulative LATTICE steps → tempo-invariant Strouhal. */
  private liftSignSteps: number[] = [];
  private latticeSteps = 0;
  private lastLiftSign = 0;
  /** Rolling lift mean/amplitude (lattice) — hysteresis so noise flips don't inflate St. */
  private fyMeanLat = 0;
  private fyAmpLat = 0;
  private lastProbe: { speed: number; rho: number } | null = null;
  private measureTimer = 0;
  private stepAcc = 0;
  private polarMomentLat = 1e5;
  private dLatCells = 1;
  private startTime = 0;

  constructor(container: HTMLElement, opts: EngineOptions) {
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.appendChild(this.canvas);

    let backend: Backend | null = null;
    if (!opts.forceCpu) {
      try {
        const caps = createGl(this.canvas);
        if (caps) {
          this.ladderIdx = isProbablyMobile() ? 1 : 2;
          backend = new GpuBackend(caps, this.canvas, GPU_LADDER[this.ladderIdx].grid, opts.seed ?? DEFAULT_SEED);
        }
      } catch (e) {
        console.warn('GPU backend failed, falling back to CPU:', e);
        backend = null;
      }
    }
    if (!backend) {
      // A canvas that returned a webgl2 context can't switch to 2d — replace it.
      this.canvas.remove();
      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      container.appendChild(this.canvas);
      backend = new CpuBackend(this.canvas, CPU_GRID, opts.seed ?? DEFAULT_SEED);
    }
    this.backend = backend;
    this.backendKind = backend.kind;
    this.resizeCanvas(container);
    this.uInCurrent = windMsToULat(windSliderToMs(this.params.windSpeed));
    this.backend.reset(this.uInCurrent);
    this.warmUp();
  }

  /** Short burst of substeps after (re)init so the impulsive-start pressure wave
   *  and its negative-drag phase are mostly over before the user sees the flow. */
  private warmUp(): void {
    this.backend.step(240, { uIn: this.uInCurrent, tau: TAU0 });
    this.latticeSteps += 240;
  }

  resizeCanvas(container: HTMLElement): void {
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.backend?.kind === 'cpu' ? 1.5 : 2);
    const w = Math.max(2, Math.round(rect.width * dpr));
    const h = Math.max(2, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  setParams(p: SimParams): void {
    const prev = this.params;
    this.params = { ...p };
    if (p.probe !== prev.probe) this.backend.setProbe(p.probe);
    if (p.density !== prev.density) this.updateMassProps();
    if (p.pivotLocked && !prev.pivotLocked) this.pivot.snapTo(deg2rad(p.restAngleDeg));
    if (p.restAngleDeg !== prev.restAngleDeg && p.pivotLocked) this.pivot.snapTo(deg2rad(p.restAngleDeg));
    if (p.quality !== prev.quality && p.quality !== 'auto') {
      const idx = p.quality === 'low' ? 0 : p.quality === 'medium' ? 1 : 2;
      this.applyLadder(idx);
    }
  }

  setShape(s: ShapeSpec | null): void {
    this.shape = s;
    this.backend.setShape(s);
    this.updateMassProps();
    this.pivot.snapTo(deg2rad(this.params.restAngleDeg));
    this.pose = { theta: this.pivot.theta, bend: [0, 0] };
    this.backend.setPose(this.pose);
    this.forceWindow = [];
    this.liftSignSteps = [];
  }

  private updateMassProps(): void {
    if (!this.shape) return;
    const mp = massProperties(this.shape.points, this.shape.pivot);
    const cellsPerUnit = this.backend.grid.h; // tunnel height = 1 unit = h cells
    this.polarMomentLat = mp.polarMoment * Math.pow(cellsPerUnit, 4);
    this.pivot.setMassProperties(this.polarMomentLat, this.params.density);
    this.dLatCells = Math.max(1, frontalHeight(this.shape.points, this.shape.pivot, this.pose.theta) * cellsPerUnit);
  }

  reset(): void {
    this.backend.reset(this.uInCurrent);
    this.forceWindow = [];
    this.liftSignSteps = [];
    this.pivot.snapTo(deg2rad(this.params.restAngleDeg));
    this.warmUp();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.startTime = this.lastTime;
    const tick = (t: number) => {
      if (!this.running) return;
      this.frame(t);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.stop();
    this.backend.dispose();
    this.canvas.remove();
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const fps = dt > 0 ? 1 / dt : 60;
    this.fpsEma += (fps - this.fpsEma) * 0.05;

    // Wind ramp (~0.35 s time constant) — step changes in inflow cause pressure shocks.
    const uTarget = windMsToULat(windSliderToMs(this.params.windSpeed));
    this.uInCurrent += (uTarget - this.uInCurrent) * Math.min(1, dt / 0.35);

    const preset = this.backend.kind === 'gpu' ? GPU_LADDER[this.ladderIdx] : { grid: CPU_GRID, substeps: 2 };

    // Tempo: skalér substeps pr. frame; fraktions-akkumulator så fx 0.25× stadig skrider jævnt frem.
    const timeScale = Math.min(4, Math.max(0.25, this.params.timeScale || 1));
    let stepsThisFrame = 0;
    if (!this.params.paused) {
      this.stepAcc += preset.substeps * timeScale;
      stepsThisFrame = Math.floor(this.stepAcc);
      this.stepAcc -= stepsThisFrame;
    }

    if (stepsThisFrame > 0) {
      this.backend.step(stepsThisFrame, { uIn: this.uInCurrent, tau: TAU0 });
      this.backend.requestForces();
      this.latticeSteps += stepsThisFrame;
    } else {
      this.backend.lastStepCount = 0;
    }

    // Readbacks → pivot dynamics + rolling window
    const rb = this.backend.pollReadbacks();
    const tSec = (now - this.startTime) / 1000;
    if (rb.force && isFinite(rb.force.fx)) {
      this.lastForce = rb.force;
      this.forceWindow.push({ t: tSec, ...rb.force });
      while (this.forceWindow.length > 2 && this.forceWindow[0].t < tSec - 2) this.forceWindow.shift();
      // Hysteresis zero-crossing of the mean-removed lift: a crossing only counts
      // once the signal has swung past half the typical amplitude.
      const dev = rb.force.fy - this.fyMeanLat;
      const h = 0.5 * this.fyAmpLat;
      if (this.lastLiftSign >= 0 && dev < -h) {
        if (this.lastLiftSign === 1) {
          this.liftSignSteps.push(this.latticeSteps);
          while (this.liftSignSteps.length > 24) this.liftSignSteps.shift();
        }
        this.lastLiftSign = -1;
      } else if (this.lastLiftSign <= 0 && dev > h) {
        if (this.lastLiftSign === -1) {
          this.liftSignSteps.push(this.latticeSteps);
          while (this.liftSignSteps.length > 24) this.liftSignSteps.shift();
        }
        this.lastLiftSign = 1;
      }
    }
    if (rb.probe) this.lastProbe = rb.probe;
    if (rb.bad) {
      this.resets++;
      this.backend.reset(this.uInCurrent);
      this.forceWindow = [];
      this.opts.onToast?.('flow-reset');
    }

    // Pivot dynamics (uses latest torque; tolerates 1-2 frame readback latency).
    if (this.shape && !this.params.paused && stepsThisFrame > 0) {
      this.pivot.step(this.lastForce.tz, this.lastForce.fx, this.lastForce.fy, deg2rad(this.params.restAngleDeg), this.params.pivotLocked, stepsThisFrame);
      const newTheta = this.pivot.theta;
      if (Math.abs(newTheta - this.pose.theta) > 0.002 || Math.abs(this.pivot.bend[0] - this.pose.bend[0]) > 0.0015 || Math.abs(this.pivot.bend[1] - this.pose.bend[1]) > 0.0015) {
        this.pose = { theta: newTheta, bend: [this.pivot.bend[0], this.pivot.bend[1]] };
        this.backend.setPose(this.pose);
        this.dLatCells = this.shape ? Math.max(1, frontalHeight(this.shape.points, this.shape.pivot, newTheta) * this.backend.grid.h) : 1;
      }
    }

    this.backend.render(this.params, this.pose, tSec);

    // Adaptive quality (auto mode, GPU only)
    if (this.params.quality === 'auto' && this.backend.kind === 'gpu') {
      this.ladderTimer += dt;
      if (this.fpsEma < 27 && this.ladderTimer > 2 && this.ladderIdx > 0) {
        this.applyLadder(this.ladderIdx - 1);
        this.ladderTimer = 0;
      } else if (this.fpsEma > 55 && this.ladderTimer > 6 && this.ladderIdx < GPU_LADDER.length - 1) {
        this.applyLadder(this.ladderIdx + 1);
        this.ladderTimer = 0;
      }
    }

    // Publish measurements at ~10 Hz
    this.measureTimer += dt;
    if (this.measureTimer >= 0.1) {
      this.measureTimer = 0;
      this.opts.onMeasure(this.computeMeasurements(tSec));
    }
  }

  private applyLadder(idx: number): void {
    this.ladderIdx = idx;
    this.backend.resize(GPU_LADDER[idx].grid);
    this.updateMassProps();
  }

  private computeMeasurements(tSec: number): Measurements {
    const windMs = windSliderToMs(this.params.windSpeed);
    const uLat = this.uInCurrent;
    const gridH = this.backend.grid.h;
    let fx = 0, fy = 0;
    let fxMin = Infinity, fxMax = -Infinity, fyMin = Infinity, fyMax = -Infinity;
    if (this.forceWindow.length > 0) {
      for (const s of this.forceWindow) {
        fx += s.fx;
        fy += s.fy;
        if (s.fx < fxMin) fxMin = s.fx;
        if (s.fx > fxMax) fxMax = s.fx;
        if (s.fy < fyMin) fyMin = s.fy;
        if (s.fy > fyMax) fyMax = s.fy;
      }
      fx /= this.forceWindow.length;
      fy /= this.forceWindow.length;
    } else {
      fxMin = fxMax = fyMin = fyMax = 0;
    }
    this.fyMeanLat = fy;
    this.fyAmpLat = (fyMax - fyMin) / 2;
    const hints: FlowHints = {};
    if (this.liftSignSteps.length >= 6) {
      const dSteps = this.liftSignSteps[this.liftSignSteps.length - 1] - this.liftSignSteps[0];
      if (dSteps > 100) {
        const halfPeriods = this.liftSignSteps.length - 1;
        const fLat = halfPeriods / (2 * dSteps); // per lattice step
        const st = (fLat * this.dLatCells) / Math.max(uLat, 1e-5);
        if (st > 0.03 && st < 1) {
          hints.strouhal = st;
          // Real-world frequency for the displayed size and wind: f = St·U/D
          const dM = this.dLatCells * (0.5 / gridH); // TUNNEL_HEIGHT_M / gridH
          hints.shedHzReal = (st * windMs) / Math.max(dM, 1e-4);
        }
      }
    }
    if (this.shape) {
      hints.stagnation = this.stagnationPoint();
    }
    const uLatSafe = Math.max(uLat, 1e-5);
    const probe = this.lastProbe && this.params.probe
      ? {
          speed: (this.lastProbe.speed / uLatSafe) * windMs,
          pressure: ((this.lastProbe.rho - 1) / 3) * 1.225 * Math.pow(windMs / uLatSafe, 2),
          uRatio: this.lastProbe.speed / uLatSafe,
          cp: ((this.lastProbe.rho - 1) / 3) / (0.5 * uLatSafe * uLatSafe),
        }
      : null;
    // Displayed Re is normalized to a nominal grid height so the adaptive
    // quality ladder can't silently change the number mid-session.
    const NOMINAL_GRID_H = 256;
    const dNominal = this.dLatCells * (NOMINAL_GRID_H / gridH);
    const fluctScale = (f: number) => (this.shape ? forceToNewtonPerM(f, uLat, this.dLatCells, gridH, windMs) : 0);
    return {
      dragN: fluctScale(fx),
      liftN: fluctScale(fy),
      dragFluctN: Math.abs(fluctScale((fxMax - fxMin) / 2)),
      liftFluctN: Math.abs(fluctScale((fyMax - fyMin) / 2)),
      cd: this.shape ? dragCoefficient(fx, uLat, this.dLatCells) : 0,
      cl: this.shape ? dragCoefficient(fy, uLat, this.dLatCells) : 0,
      reynolds: this.shape ? reynolds(uLat, dNominal) : 0,
      blockagePct: this.shape ? (this.dLatCells / gridH) * 100 : 0,
      windMs,
      thetaDeg: rad2deg(this.pose.theta - deg2rad(this.params.restAngleDeg)),
      probe,
      fps: Math.round(this.fpsEma),
      gridW: this.backend.grid.w,
      gridH: this.backend.grid.h,
      backend: this.backend.kind,
      flowHints: hints,
      resets: this.resets,
    };
    void tSec;
  }

  /** Windward-most point of the posed shape at pivot height — geometric stagnation hint. */
  private stagnationPoint(): [number, number] | undefined {
    if (!this.shape) return undefined;
    const { points, pivot } = this.shape;
    const c = Math.cos(this.pose.theta);
    const s = Math.sin(this.pose.theta);
    let minX = Infinity;
    let best: [number, number] | undefined;
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i] - pivot[0];
      const y = points[i + 1] - pivot[1];
      const wx = pivot[0] + this.pose.bend[0] + x * c - y * s;
      const wy = pivot[1] + this.pose.bend[1] + x * s + y * c;
      if (Math.abs(wy - pivot[1]) < 0.06 && wx < minX) {
        minX = wx;
        best = [wx, wy];
      }
    }
    return best;
  }

  // ---------- Harness API (synchronous, blocking — test use only) ----------

  runStepsSync(n: number): void {
    const preset = this.backend.kind === 'gpu' ? GPU_LADDER[this.ladderIdx] : { grid: CPU_GRID, substeps: 2 };
    void preset;
    const batch = 40;
    for (let done = 0; done < n; done += batch) {
      this.backend.step(Math.min(batch, n - done), { uIn: this.uInCurrent, tau: TAU0 });
    }
  }

  setWindImmediate(slider: number): void {
    this.params.windSpeed = slider;
    this.uInCurrent = windMsToULat(windSliderToMs(slider));
  }

  readForceSync(): { fx: number; fy: number; tz: number; bad: boolean } {
    const b = this.backend as unknown as { readForceSync?: () => { fx: number; fy: number; tz: number; bad: boolean } };
    if (b.readForceSync) return b.readForceSync();
    return { fx: 0, fy: 0, tz: 0, bad: false };
  }

  /** Debug: force-texture ground truth vs reduce chain (GPU only). */
  debugForceInfo(): string {
    const b = this.backend as unknown as { debugForceInfo?: () => Record<string, number> };
    if (!b.debugForceInfo) return 'cpu';
    const d = b.debugForceInfo();
    return `direct=(${d.directFx.toFixed(4)},${d.directFy.toFixed(4)}) reduced=(${d.reducedFx.toFixed(4)},${d.reducedFy.toFixed(4)}) boundary=${d.boundaryCells}`;
  }

  /** Debug/harness: solid pixels in the current obstacle raster. */
  debugSolidCount(): number {
    const b = this.backend as unknown as { countSolidPixels?: () => number };
    if (b.countSolidPixels) return b.countSolidPixels();
    const cpu = this.backend as unknown as { core?: { solid: Uint8Array } };
    if (cpu.core) return cpu.core.solid.reduce((a, v) => a + v, 0);
    return -1;
  }

  get grid(): GridSize {
    return this.backend.grid;
  }

  get currentULat(): number {
    return this.uInCurrent;
  }

  get frontalCells(): number {
    return this.dLatCells;
  }
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

function rad2deg(r: number): number {
  return (r * 180) / Math.PI;
}

function isProbablyMobile(): boolean {
  return typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 1 || /Mobi|Android/i.test(navigator.userAgent)) && Math.min(screen.width, screen.height) < 800;
}

export { ASPECT };
