import type { PieceType } from '../types'

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

/** Ball geometry / material. Restitution is deliberately low so the ball does
 *  not bounce/drift on the flat floor; springy pieces still bounce it because
 *  Matter uses max(ballRestitution, pieceRestitution) at the contact. */
export const BALL_RADIUS = 9
export const BALL_RESTITUTION = 0.16
export const BALL_FRICTION = 0.05
export const BALL_FRICTION_AIR = 0.008
export const BALL_DENSITY = 0.02

/**
 * Fixed rotation step table. A PlacedPiece.rotation is an index into this
 * array (0..3). Values are radians measured from the piece's neutral pose.
 * Four distinct, useful slopes: two left-leaning, two right-leaning.
 */
export const ROTATION_STEPS: readonly number[] = [
  (-45 * Math.PI) / 180,
  (-22.5 * Math.PI) / 180,
  (22.5 * Math.PI) / 180,
  (45 * Math.PI) / 180,
]

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
