// Core contracts shared by engine, backends, store wiring and UI.
// Tunnel coordinates: y ∈ [0,1] (height = 1 ≙ 0.5 m), x ∈ [0, ASPECT]. Origin bottom-left.

export const ASPECT = 2;

export type OverlayMode = 'none' | 'speed' | 'vorticity' | 'pressure' | 'streamlines';
export type Quality = 'auto' | 'low' | 'medium' | 'high';
export type ShapeKind = 'freehand' | 'circle' | 'square' | 'plate' | 'teardrop';

export interface ShapeSpec {
  /** Closed CCW polygon, flat [x0,y0,x1,y1,...] in tunnel coords. Not repeated end point. */
  points: Float32Array;
  kind: ShapeKind;
  /** Sting anchor in tunnel coords (defaults to shape centroid). */
  pivot: [number, number];
}

export interface SimParams {
  /** Wind slider 0..1 → mapped to u_in and displayed m/s in units.ts */
  windSpeed: number;
  /** Relative object density 0.1..10 (weight slider). */
  density: number;
  /** Angle of attack: rest angle of the torsion spring, degrees. */
  restAngleDeg: number;
  /** Lock the pivot for clean measurements. */
  pivotLocked: boolean;
  overlay: OverlayMode;
  smoke: boolean;
  paused: boolean;
  quality: Quality;
  /** Probe position in tunnel coords, or null. */
  probe: [number, number] | null;
  reducedMotion: boolean;
}

export interface FlowHints {
  /** Stagnation point in tunnel coords (front of body), if detectable. */
  stagnation?: [number, number];
  /** Vortex shedding frequency in Hz (display time), if oscillation detected. */
  shedFreqHz?: number;
}

export interface Measurements {
  /** Drag/lift in N per meter span (2D!). Rolling-averaged. */
  dragN: number;
  liftN: number;
  cd: number;
  cl: number;
  reynolds: number;
  /** Displayed wind speed, m/s. */
  windMs: number;
  /** Current pivot deflection (deg) relative to rest angle. */
  thetaDeg: number;
  probe: { speed: number; pressure: number } | null;
  fps: number;
  gridW: number;
  gridH: number;
  backend: 'gpu' | 'cpu';
  flowHints: FlowHints;
  /** NaN auto-reset counter (diagnostics). */
  resets: number;
}

/** Raw per-step force sample in lattice units (drag Fx, lift Fy, torque Tz about pivot). */
export interface ForceSample {
  fx: number;
  fy: number;
  tz: number;
}

export interface GridSize {
  w: number;
  h: number;
}

export interface PoseState {
  /** Absolute body angle, radians (rest angle + deflection). */
  theta: number;
  /** Sting-bend translation in tunnel coords. */
  bend: [number, number];
}

export interface StepInputs {
  /** Inflow velocity in lattice units (already ramped/capped). */
  uIn: number;
  /** BGK relaxation time floor. */
  tau: number;
}

export interface ProbeResult {
  /** Local speed in lattice units. */
  speed: number;
  /** Local density (pressure = rho/3 in lattice units). */
  rho: number;
}

export interface Backend {
  readonly kind: 'gpu' | 'cpu';
  readonly grid: GridSize;
  /** Substeps executed in the latest frame — drives smoke/particle advection in render(). */
  lastStepCount: number;
  setShape(shape: ShapeSpec | null): void;
  setPose(pose: PoseState): void;
  /** Advance n LBM substeps. */
  step(n: number, inputs: StepInputs): void;
  /** Draw current state to the canvas. */
  render(params: SimParams, pose: PoseState, timeSec: number): void;
  /** Kick off async force+badness readback (GPU) — poll with pollReadbacks. */
  requestForces(): void;
  pollReadbacks(): { force?: ForceSample; probe?: ProbeResult; bad?: boolean };
  setProbe(p: [number, number] | null): void;
  /** Reinitialize the flow field to equilibrium at uIn, keeping shape/pose. */
  reset(uIn: number): void;
  resize(grid: GridSize): void;
  dispose(): void;
}
