import Matter from 'matter-js'
import type { LevelDef, PieceType, PlacedPiece, Vec2 } from '../types'
import { createObstacleBody, createPieceBody } from './pieces'
import {
  BALL_DENSITY,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_RADIUS,
  BALL_RESTITUTION,
  FIXED_DELTA_MS,
  GRAVITY_Y,
  MAX_STEPS,
  SETTLE_SPEED,
  SETTLE_STEPS,
} from './constants'

const { Engine, Bodies, Composite, Common } = Matter

const WALL_THICKNESS = 60

export type FailReason = 'target' | 'failzone' | 'settled' | 'timeout'

export type SimResult = {
  result: 'won' | 'failed'
  reason: FailReason
  steps: number
  /** Ball centre per tick, index 0 = drop position. Bit-identical across runs. */
  trajectory: Vec2[]
}

export type PieceBody = { body: Matter.Body; type: PieceType; slotId: string }

export type World = {
  engine: Matter.Engine
  ball: Matter.Body
  pieces: PieceBody[]
  obstacles: Matter.Body[]
  boundaries: Matter.Body[]
}

/**
 * Reset Matter's module-global id/seed counters so two runs create bodies with
 * identical ids and any (unused) internal RNG starts from the same seed. This
 * is belt-and-braces: it makes the simulation bit-identical regardless of how
 * many worlds were built earlier in the session.
 */
function resetMatterGlobals(): void {
  const c = Common as unknown as { _nextId: number; _seed: number }
  c._nextId = 0
  c._seed = 0
}

function makeBoundaries(w: number, h: number): Matter.Body[] {
  const t = WALL_THICKNESS
  const wallOpts = { isStatic: true, restitution: 0.2, friction: 0.1, label: 'boundary' as const }
  // The floor grips harder so a landed ball settles near where it lands instead
  // of drifting far along the bottom.
  const floorOpts = { isStatic: true, restitution: 0.1, friction: 0.6, frictionStatic: 1, label: 'boundary' as const }
  return [
    Bodies.rectangle(-t / 2, h / 2, t, h + 2 * t, wallOpts), // left
    Bodies.rectangle(w + t / 2, h / 2, t, h + 2 * t, wallOpts), // right
    Bodies.rectangle(w / 2, -t / 2, w + 2 * t, t, wallOpts), // ceiling
    Bodies.rectangle(w / 2, h + t / 2, w + 2 * t, t, floorOpts), // floor
  ]
}

/**
 * Build a fresh, fully-deterministic Matter world for a level + placements.
 * Bodies are created in a fixed order (boundaries → obstacles → pieces → ball)
 * so ids are stable. No stepping happens here; both the headless simulator and
 * the on-screen renderer use this to get the exact same bodies.
 */
export function buildWorld(level: LevelDef, placements: PlacedPiece[]): World {
  resetMatterGlobals()

  const engine = Engine.create()
  engine.gravity.x = 0
  engine.gravity.y = GRAVITY_Y
  engine.enableSleeping = false
  engine.timing.timeScale = 1

  const boundaries = makeBoundaries(level.boardWidth, level.boardHeight)
  const obstacles = level.staticObstacles.map(createObstacleBody)

  // Placements are sorted by slotId so body-creation order never depends on the
  // (possibly reordered) placements array — another determinism guard.
  const slotById = new Map(level.slots.map((s) => [s.id, s]))
  const pieces: PieceBody[] = [...placements]
    .sort((a, b) => a.slotId.localeCompare(b.slotId))
    .flatMap((p) => {
      const slot = slotById.get(p.slotId)
      if (!slot) return []
      return [{ body: createPieceBody(p.type, slot.position, p.rotation), type: p.type, slotId: p.slotId }]
    })

  const ball = Bodies.circle(level.dropPoint.x, level.dropPoint.y, BALL_RADIUS, {
    restitution: BALL_RESTITUTION,
    friction: BALL_FRICTION,
    frictionAir: BALL_FRICTION_AIR,
    density: BALL_DENSITY,
    label: 'ball',
  })

  Composite.add(engine.world, [...boundaries, ...obstacles, ...pieces.map((p) => p.body), ball])

  return { engine, ball, pieces, obstacles, boundaries }
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Run the deterministic simulation headlessly. Pure: no DOM, no canvas, no
 * wall-clock. Used identically by the browser (to get the ball's path to
 * animate) and by the Node solver. Same inputs ⇒ bit-identical trajectory.
 */
export function simulate(level: LevelDef, placements: PlacedPiece[]): SimResult {
  const { engine, ball } = buildWorld(level, placements)
  const target = level.targetZone
  const failZones = level.failZones ?? []

  const trajectory: Vec2[] = [{ x: ball.position.x, y: ball.position.y }]
  let stillCount = 0

  for (let i = 0; i < MAX_STEPS; i++) {
    Engine.update(engine, FIXED_DELTA_MS)
    const p: Vec2 = { x: ball.position.x, y: ball.position.y }
    trajectory.push(p)

    if (dist(p, target.position) <= target.radius) {
      return { result: 'won', reason: 'target', steps: i + 1, trajectory }
    }
    for (const fz of failZones) {
      if (dist(p, fz.position) <= fz.radius) {
        return { result: 'failed', reason: 'failzone', steps: i + 1, trajectory }
      }
    }

    const speed = Math.hypot(ball.velocity.x, ball.velocity.y)
    if (speed < SETTLE_SPEED) {
      stillCount++
      if (stillCount >= SETTLE_STEPS) {
        return { result: 'failed', reason: 'settled', steps: i + 1, trajectory }
      }
    } else {
      stillCount = 0
    }
  }

  return { result: 'failed', reason: 'timeout', steps: MAX_STEPS, trajectory }
}
