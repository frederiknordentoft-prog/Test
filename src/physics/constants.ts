import type { BallType, PieceType } from '../types'

// ---------------------------------------------------------------------------
// Deterministic simulation tuning. Everything here is a fixed constant — no
// randomness anywhere. The same LevelDef + PlacedPiece[] + BallType must always
// produce the identical trajectory, so these values are the physical "rules" of
// the game and are shared verbatim by the app renderer and the headless solver.
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
 * Booster: on contact the ball's velocity is SET to max(arrivalSpeed,
 * BOOST_SPEED) along the booster's axis. A velocity-set (not an impulse) is
 * what makes the piece read as "fires you THIS way at THIS speed".
 */
export const BOOST_SPEED = 13

/** Ticks after a portal teleport during which the entry cannot re-trigger. */
export const PORTAL_COOLDOWN_TICKS = 10

/** Portal entry sensor disc radius (board px). The exit is drawn the same size. */
export const PORTAL_RADIUS = 16

/**
 * Selectable ball types. In 2.0 the ball is a puzzle tool along TWO axes:
 * bounciness (restitution/friction, as in v1) and now MASS — a breakable plank
 * shatters iff impactSpeed × ball.mass ≥ breakImpulse, so iron smashes through
 * where basketball never can. Densities are ordered iron ≫ wood > basketball;
 * against static bodies mass does not alter the trajectory itself, so the
 * v1-proven feel of each ball is unchanged.
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
    density: 0.05, // mass ≈ 12.7 — smashes any authored plank at ordinary speeds
    label: 'Jern',
    color: '#9aa6b8',
    accent: '#e9eef6',
  },
  wood: {
    radius: 9,
    restitution: 0.34,
    friction: 0.11,
    frictionAir: 0.013,
    density: 0.012, // mass ≈ 3.1 — breaks planks only when arriving fast
    label: 'Trækugle',
    color: '#b4732f',
    accent: '#7c4a17',
  },
  basketball: {
    radius: 10,
    restitution: 0.72,
    friction: 0.045,
    frictionAir: 0.006,
    density: 0.004, // mass ≈ 1.3 — never breaks a plank; bounces over instead
    label: 'Basketball',
    color: '#e2712c',
    accent: '#241a12',
  },
}

export const BALL_TYPES: readonly BallType[] = ['iron', 'wood', 'basketball']
export const DEFAULT_BALL: BallType = 'iron'

/**
 * The single global rotation table: 16 steps of 22.5° (0° … 337.5°).
 * A PlacedPiece.rotation is ALWAYS an index into this table; each piece type
 * has a DOMAIN of valid indices (fewer meaningless choices for the player,
 * smaller search space for the solver). See kravspec §4.1.
 */
export const ROTATION_TABLE: readonly number[] = Array.from(
  { length: 16 },
  (_, i) => (i * 22.5 * Math.PI) / 180,
)

export const ROTATION_DOMAINS: Record<PieceType, readonly number[]> = {
  ramp: [0, 1, 2, 3, 4, 5, 6, 7], // a plank is 180°-symmetric
  bouncer: [0, 1, 2, 3, 4, 5, 6, 7],
  funnel: [0, 1, 2, 14, 15], // only near-upright tilts are meaningful
  booster: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // direction IS the piece
  portal: [0], // a disc — rotation is meaningless
}

/** The angle in degrees for a table index (for UI labels). */
export function rotationDegrees(index: number): number {
  const n = ROTATION_TABLE.length
  const wrapped = ((index % n) + n) % n
  return wrapped * 22.5
}

/** Danish-formatted degree label for a table index ("22,5°", "90°"). */
export function degreeLabel(index: number): string {
  const d = rotationDegrees(index)
  return `${(Number.isInteger(d) ? String(d) : d.toFixed(1)).replace('.', ',')}°`
}

/**
 * The single source of truth mapping (type, rotation index) → radians.
 * Indices outside the piece's domain fall back to the domain's first entry so
 * a stray persisted value can never throw or desync app vs solver — the store
 * and the solver only ever produce in-domain indices.
 */
export function rotationIndexToRadians(type: PieceType, index: number): number {
  const domain = ROTATION_DOMAINS[type]
  const n = ROTATION_TABLE.length
  const wrapped = ((index % n) + n) % n
  const valid = domain.includes(wrapped) ? wrapped : (domain[0] as number)
  return ROTATION_TABLE[valid] as number
}

/** Whether `index` is a valid rotation for `type` (store + solver both check). */
export function isValidRotation(type: PieceType, index: number): boolean {
  return ROTATION_DOMAINS[type].includes(index)
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
  bouncer: {
    restitution: 0.9,
    friction: 0.0,
    frictionStatic: 0.05,
    label: 'Trampolin',
    glyph: '◠',
    color: '#f472b6',
  },
  funnel: {
    restitution: 0.1,
    friction: 0.03,
    frictionStatic: 0.2,
    label: 'Tragt',
    glyph: '∨',
    color: '#a78bfa',
  },
  booster: {
    restitution: 0.05,
    friction: 0.0,
    frictionStatic: 0.05,
    label: 'Booster',
    glyph: '➤',
    color: '#fb923c',
  },
  portal: {
    restitution: 0, // sensor — never physically collides
    friction: 0,
    frictionStatic: 0,
    label: 'Portal',
    glyph: '◎',
    color: '#2dd4bf',
  },
}

export const PIECE_TYPES: readonly PieceType[] = ['ramp', 'bouncer', 'funnel', 'booster', 'portal']
