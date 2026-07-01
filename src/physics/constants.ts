import type { BallType, PieceType } from '../types'

// ---------------------------------------------------------------------------
// Deterministic simulation tuning. Everything here is a fixed constant — no
// randomness anywhere. The same LevelDef + PlacedPiece[] must always produce
// the identical trajectory, so these values are the physical "rules" of the
// game and are shared verbatim by the app renderer and the headless solver.
// ---------------------------------------------------------------------------

/** Physics ticks per simulated second. Physics step is decoupled from render. */
export const PHYSICS_HZ = 60

/** Fixed timestep in ms fed to Engine.update on every tick (never a wall clock). */
export const FIXED_DELTA_MS = 1000 / PHYSICS_HZ

/** Hard cap on simulated ticks (~12 s). If not won by then → failed:timeout. */
export const MAX_STEPS = 720

/** Gravity strength (Matter's gravity.scale stays at its default 0.001). */
export const GRAVITY_Y = 1

/** Speed below which the ball is considered momentarily still (px/tick·scale). */
export const SETTLE_SPEED = 0.18

/** Consecutive still ticks before we declare the ball settled → failed:settled. */
export const SETTLE_STEPS = 45

/**
 * Selectable ball types. Each is a distinct puzzle tool. `iron` matches the
 * original tuning (dense, barely bounces) and is the default, so every shipped
 * level stays solvable with it; `wood` is a controlled middle ground; and
 * `basketball` is large and springy. Springy *pieces* still bounce any ball
 * because Matter uses max(ballRestitution, pieceRestitution) at the contact.
 */
export type BallSpec = {
  radius: number
  restitution: number
  friction: number
  frictionAir: number
  density: number
  label: string
  /** Base + accent colours the renderer uses to paint each ball's texture. */
  color: string
  accent: string
}

export const BALL_SPECS: Record<BallType, BallSpec> = {
  iron: {
    radius: 9,
    restitution: 0.16,
    friction: 0.05,
    frictionAir: 0.008,
    density: 0.05,
    label: 'Jern',
    color: '#9aa6b8',
    accent: '#e9eef6',
  },
  wood: {
    radius: 9,
    restitution: 0.34,
    friction: 0.11,
    frictionAir: 0.013,
    density: 0.012,
    label: 'Trækugle',
    color: '#b4732f',
    accent: '#7c4a17',
  },
  basketball: {
    radius: 10,
    restitution: 0.72,
    friction: 0.045,
    frictionAir: 0.006,
    density: 0.02,
    label: 'Basketball',
    color: '#e2712c',
    accent: '#241a12',
  },
}

export const BALL_TYPES: readonly BallType[] = ['iron', 'wood', 'basketball']
export const DEFAULT_BALL: BallType = 'iron'

/**
 * Fixed rotation step table. A PlacedPiece.rotation is an index into this array.
 * Angles are offered in 22.5° increments starting at 0° (0, 22.5, 45, 67.5, 90,
 * 112.5, 135, 157.5) — eight distinct orientations over a half turn, which for a
 * bar covers every angle and for the shaped pieces gives fine control.
 */
export const ROTATION_STEPS: readonly number[] = Array.from(
  { length: 8 },
  (_, i) => (i * 22.5 * Math.PI) / 180,
)

/** The angle in degrees for a rotation index (for UI labels). */
export function rotationDegrees(index: number): number {
  const n = ROTATION_STEPS.length
  const wrapped = ((index % n) + n) % n
  return wrapped * 22.5
}

export function rotationRadians(index: number): number {
  const n = ROTATION_STEPS.length
  // Wrap defensively so a stray index can never throw / desync app vs solver.
  const wrapped = ((index % n) + n) % n
  return ROTATION_STEPS[wrapped] as number
}

/** Material + geometry spec per piece type. Geometry is in board pixels. */
export type PieceSpec = {
  restitution: number
  friction: number
  frictionStatic: number
  /** Human-facing Danish label + short glyph for the UI. */
  label: string
  glyph: string
  color: string
}

export const PIECE_SPECS: Record<PieceType, PieceSpec> = {
  ramp: {
    restitution: 0.12,
    friction: 0.04,
    frictionStatic: 0.2,
    label: 'Rampe',
    glyph: '／',
    color: '#38bdf8',
  },
  funnel: {
    restitution: 0.1,
    friction: 0.03,
    frictionStatic: 0.2,
    label: 'Tragt',
    glyph: '∨',
    color: '#a78bfa',
  },
  bouncer: {
    restitution: 0.9,
    friction: 0.0,
    frictionStatic: 0.05,
    label: 'Trampolin',
    glyph: '◠',
    color: '#f472b6',
  },
  spinner: {
    restitution: 0.42,
    friction: 0.02,
    frictionStatic: 0.1,
    label: 'Kryds',
    glyph: '✳',
    color: '#fbbf24',
  },
}

export const PIECE_TYPES: readonly PieceType[] = ['ramp', 'funnel', 'bouncer', 'spinner']
