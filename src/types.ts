// ---------------------------------------------------------------------------
// Kuglebanen — core data contracts (source of truth for data shape).
// These match the spec exactly and are shared by the app, the levels, and the
// headless solver.
// ---------------------------------------------------------------------------

export type Vec2 = { x: number; y: number }

export type PieceType = 'ramp' | 'spinner' | 'funnel' | 'bouncer'

/** Selectable ball, each with distinct feel: dense/dead, springy, or in between. */
export type BallType = 'iron' | 'basketball' | 'wood'

export type Slot = {
  id: string
  position: Vec2 // fixed anchor point on the board
  allowedTypes: PieceType[] // empty array = any type fits
}

export type StaticObstacle = {
  position: Vec2
  shape: 'wall' | 'peg'
  /** For 'wall': half-extents as { x, y }. For 'peg': { x } is the radius. */
  size?: { x: number; y?: number }
  rotation?: number
}

export type TargetZone = { position: Vec2; radius: number }

export type LevelDef = {
  id: string
  name: string
  boardWidth: number
  boardHeight: number
  dropPoint: Vec2
  targetZone: TargetZone
  failZones?: TargetZone[]
  staticObstacles: StaticObstacle[]
  slots: Slot[]
  inventory: Partial<Record<PieceType, number>> // how many of each piece allowed
}

export type PlacedPiece = {
  slotId: string
  type: PieceType
  rotation: number // index into ROTATION_STEPS (fixed rotation step table)
}

export type RunResult = 'idle' | 'running' | 'won' | 'failed'

export type GameState = {
  currentLevelId: string
  placements: PlacedPiece[]
  ballType: BallType
  runResult: RunResult
}
