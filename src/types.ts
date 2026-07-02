// ---------------------------------------------------------------------------
// Kuglebanen 2.0 — core data contracts (source of truth for data shape).
// Shared by the app, the level pack, the headless solver and the tests.
// See docs/kravspec-v2.md §4 for the mechanic semantics behind these shapes.
// ---------------------------------------------------------------------------

export type Vec2 = { x: number; y: number }

export type PieceType = 'ramp' | 'bouncer' | 'funnel' | 'booster' | 'portal'

/** Selectable ball. Mass is mechanical in 2.0: only heavy/fast balls break planks. */
export type BallType = 'iron' | 'wood' | 'basketball'

export type Slot = {
  id: string
  position: Vec2 // fixed anchor point on the board
  allowedTypes: PieceType[] // empty array = any type fits
}

export type Zone = { position: Vec2; radius: number }

export type StaticObstacle = {
  position: Vec2
  shape: 'wall' | 'peg'
  /** For 'wall': half-extents as { x, y }. For 'peg': { x } is the radius. */
  size?: { x: number; y?: number }
  rotation?: number // radians
}

/**
 * Author-placed plank that shatters when hit hard enough: it breaks (is removed
 * mid-simulation) iff impactSpeed × ball.mass ≥ breakImpulse, otherwise it acts
 * as a wall. This is what makes the ball choice a puzzle key.
 */
export type Breakable = {
  id: string
  position: Vec2
  /** Half-extents, like walls. */
  size: { x: number; y: number }
  rotation?: number // radians
  breakImpulse: number
}

/** Sensor disc collected when the ball's centre path passes within radius. */
export type StarCoin = { id: string; position: Vec2; radius: number }

export type LevelDef = {
  id: string
  world: 1 | 2 | 3
  name: string
  /** Designer note: the ONE thing this level teaches/tests (kravspec §6). */
  intent: string
  boardWidth: number
  boardHeight: number
  dropPoint: Vec2
  targetZone: Zone
  failZones?: Zone[]
  staticObstacles: StaticObstacle[]
  breakables?: Breakable[]
  coins?: StarCoin[]
  /** Authored portal exit — required iff inventory includes 'portal'. */
  portalExit?: { position: Vec2; rotation: number }
  slots: Slot[] // ≤ 5 per level
  inventory: Partial<Record<PieceType, number>> // total ≤ 4 per level
  balls: BallType[] // 1–3 balls the player may choose between
}

export type PlacedPiece = {
  slotId: string
  type: PieceType
  rotation: number // index into the global 16-step rotation table (22.5°)
}

export type Stars = 0 | 1 | 2 | 3

export type RunResult = 'idle' | 'running' | 'won' | 'failed'
