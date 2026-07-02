import Matter from 'matter-js'
import type { BallType, LevelDef, PieceType, PlacedPiece, Vec2 } from '../types'
import { createBreakableBody, createObstacleBody, createPieceBody, restoreStaticMaterial } from './pieces'
import {
  BALL_SPECS,
  BOOST_SPEED,
  DEFAULT_BALL,
  FIXED_DELTA_MS,
  GRAVITY_Y,
  MAX_STEPS,
  PORTAL_COOLDOWN_TICKS,
  PORTAL_RADIUS,
  SETTLE_SPEED,
  SETTLE_STEPS,
} from './constants'

const { Engine, Bodies, Body, Composite, Common } = Matter

const WALL_THICKNESS = 60

export type FailReason = 'target' | 'failzone' | 'settled' | 'timeout'

/** One recorded tick of the ball: centre + spin angle. Bit-identical across runs. */
export type BallFrame = { x: number; y: number; a: number }

/**
 * Result of a deterministic run. All tick values are indices into `trajectory`
 * (index 0 = the drop pose before the first physics step).
 */
export type SimResult = {
  result: 'won' | 'failed'
  reason: FailReason
  steps: number
  /** Ball frame per tick, index 0 = drop position. */
  trajectory: BallFrame[]
  /** Coin ids in pickup order + the trajectory index each was collected at. */
  coinsCollected: string[]
  coinTicks: number[]
  /** Breakable ids in break order + the trajectory index each shattered at. */
  breakablesBroken: string[]
  breakTicks: number[]
  /**
   * Trajectory index of the ball's first interaction with a PLAYER-placed
   * piece (physical contact with ramp/bouncer/funnel/booster, or a portal
   * teleport). null if the run never touches a player piece. This is the
   * ghost-preview cut point (kravspec §4.5).
   */
  firstPlayerContactTick: number | null
}

export type PieceBody = { body: Matter.Body; type: PieceType; slotId: string; rotation: number }
export type BreakableBody = { id: string; body: Matter.Body; breakImpulse: number }

export type World = {
  engine: Matter.Engine
  ball: Matter.Body
  ballType: BallType
  pieces: PieceBody[]
  obstacles: Matter.Body[]
  boundaries: Matter.Body[]
  breakables: BreakableBody[]
  /** The placed portal entry, if the player has placed one. */
  portalEntry: PieceBody | null
}

/**
 * Reset Matter's module-global id/seed counters so two runs create bodies with
 * identical ids and any (unused) internal RNG starts from the same seed. This
 * is belt-and-braces: it makes the simulation bit-identical regardless of how
 * many worlds were built earlier in the session. Any NEW module-level state
 * must get the same treatment — which is why broken-plank bookkeeping lives in
 * simulate() locals, never at module level.
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
  const bodies = [
    Bodies.rectangle(-t / 2, h / 2, t, h + 2 * t, wallOpts), // left
    Bodies.rectangle(w + t / 2, h / 2, t, h + 2 * t, wallOpts), // right
    Bodies.rectangle(w / 2, -t / 2, w + 2 * t, t, wallOpts), // ceiling
    Bodies.rectangle(w / 2, h + t / 2, w + 2 * t, t, floorOpts), // floor
  ]
  for (let i = 0; i < 3; i++) restoreStaticMaterial(bodies[i]!, wallOpts.restitution, wallOpts.friction)
  restoreStaticMaterial(bodies[3]!, floorOpts.restitution, floorOpts.friction)
  return bodies
}

/**
 * Build a fresh, fully-deterministic Matter world for a level + placements.
 * Bodies are created in a fixed order (boundaries → obstacles → breakables →
 * pieces → ball) so ids are stable. No stepping happens here; both the
 * headless simulator and the on-screen renderer use this to get the exact
 * same bodies.
 */
export function buildWorld(
  level: LevelDef,
  placements: PlacedPiece[],
  ballType: BallType = DEFAULT_BALL,
): World {
  resetMatterGlobals()

  const engine = Engine.create()
  engine.gravity.x = 0
  engine.gravity.y = GRAVITY_Y
  engine.enableSleeping = false
  engine.timing.timeScale = 1

  const boundaries = makeBoundaries(level.boardWidth, level.boardHeight)
  const obstacles = level.staticObstacles.map(createObstacleBody)
  const breakables: BreakableBody[] = (level.breakables ?? []).map((b) => ({
    id: b.id,
    body: createBreakableBody(b),
    breakImpulse: b.breakImpulse,
  }))

  // Placements are sorted by slotId so body-creation order never depends on the
  // (possibly reordered) placements array — another determinism guard.
  const slotById = new Map(level.slots.map((s) => [s.id, s]))
  const pieces: PieceBody[] = [...placements]
    .sort((a, b) => a.slotId.localeCompare(b.slotId))
    .flatMap((p) => {
      const slot = slotById.get(p.slotId)
      if (!slot) return []
      return [
        {
          body: createPieceBody(p.type, slot.position, p.rotation),
          type: p.type,
          slotId: p.slotId,
          rotation: p.rotation,
        },
      ]
    })

  const spec = BALL_SPECS[ballType]
  const ball = Bodies.circle(level.dropPoint.x, level.dropPoint.y, spec.radius, {
    restitution: spec.restitution,
    friction: spec.friction,
    frictionAir: spec.frictionAir,
    density: spec.density,
    label: 'ball',
  })

  Composite.add(engine.world, [
    ...boundaries,
    ...obstacles,
    ...breakables.map((b) => b.body),
    ...pieces.map((p) => p.body),
    ball,
  ])

  return {
    engine,
    ball,
    ballType,
    pieces,
    obstacles,
    boundaries,
    breakables,
    portalEntry: pieces.find((p) => p.type === 'portal') ?? null,
  }
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Distance from point p to the segment a→b (for coin sweeps — no tunnelling). */
function segmentDist(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 === 0) return dist(p, a)
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby))
}

type MatterPair = { bodyA: Matter.Body; bodyB: Matter.Body; isActive: boolean }

/**
 * Top-level bodies in active physical contact with the ball after a step.
 * Reads the pairs the engine itself computed (no second collision pass).
 * Sensors (the portal entry) never appear — their trigger is a distance check.
 */
function activeBallContacts(engine: Matter.Engine, ball: Matter.Body): Matter.Body[] {
  const pairs = (engine.pairs as unknown as { list: MatterPair[] }).list
  const out: Matter.Body[] = []
  for (const pair of pairs) {
    if (!pair.isActive) continue
    const a = pair.bodyA.parent ?? pair.bodyA
    const b = pair.bodyB.parent ?? pair.bodyB
    let other: Matter.Body | null = null
    if (a === ball) other = b
    else if (b === ball) other = a
    if (other && !other.isSensor && !out.includes(other)) out.push(other)
  }
  return out
}

/**
 * Run the deterministic simulation headlessly. Pure: no DOM, no canvas, no
 * wall-clock, no RNG. Used identically by the browser (to get the ball's path
 * to animate), the ghost preview, the Node solver and the tests. Same inputs ⇒
 * bit-identical SimResult.
 *
 * Per-tick mechanic order (fixed — part of the determinism contract):
 * step → breakables (new contacts) → boosters (active contacts) → win/fail &
 * coins on the post-step pose → portal teleport (takes effect next tick).
 */
export function simulate(
  level: LevelDef,
  placements: PlacedPiece[],
  ballType: BallType = DEFAULT_BALL,
): SimResult {
  const world = buildWorld(level, placements, ballType)
  const { engine, ball } = world
  const target = level.targetZone
  const failZones = level.failZones ?? []
  const coins = level.coins ?? []
  const portalExit = level.portalExit ?? null

  // Solid player pieces (portal is a sensor — its "contact" is the teleport).
  const solidPieceIds = new Set(world.pieces.filter((p) => p.type !== 'portal').map((p) => p.body.id))
  const boosters = world.pieces.filter((p) => p.type === 'booster')

  const trajectory: BallFrame[] = [{ x: ball.position.x, y: ball.position.y, a: ball.angle }]
  const coinsCollected: string[] = []
  const coinTicks: number[] = []
  const breakablesBroken: string[] = []
  const breakTicks: number[] = []
  let firstPlayerContactTick: number | null = null

  const unbroken = new Map(world.breakables.map((b) => [b.body.id, b]))
  const collectedCoinIds = new Set<string>()
  let prevContactIds = new Set<number>()
  let portalCooldownUntil = -1
  // Start of the ball's actual path segment this tick (differs from the last
  // frame right after a teleport — the ball never travelled entry→exit).
  let sweepFrom: Vec2 = { x: ball.position.x, y: ball.position.y }
  let stillCount = 0

  const finish = (result: 'won' | 'failed', reason: FailReason, steps: number): SimResult => ({
    result,
    reason,
    steps,
    trajectory,
    coinsCollected,
    coinTicks,
    breakablesBroken,
    breakTicks,
    firstPlayerContactTick,
  })

  for (let i = 0; i < MAX_STEPS; i++) {
    const preVel = { x: ball.velocity.x, y: ball.velocity.y }
    const preSpeed = Math.hypot(preVel.x, preVel.y)

    Engine.update(engine, FIXED_DELTA_MS)

    const contacts = activeBallContacts(engine, ball)
    const contactIds = new Set(contacts.map((c) => c.id))
    const frameIndex = i + 1

    // Breakables: a plank shatters iff the ball STARTS a contact with impulse
    // impactSpeed × mass ≥ breakImpulse. On break the plank is removed and the
    // ball's pre-impact velocity is restored, so it smashes THROUGH instead of
    // bouncing off a plank that is no longer there.
    for (const b of world.breakables) {
      if (!unbroken.has(b.body.id)) continue
      if (!contactIds.has(b.body.id) || prevContactIds.has(b.body.id)) continue
      if (preSpeed * ball.mass >= b.breakImpulse) {
        Composite.remove(engine.world, b.body)
        unbroken.delete(b.body.id)
        breakablesBroken.push(b.id)
        breakTicks.push(frameIndex)
        Body.setVelocity(ball, preVel)
      }
    }

    // Boosters: while in contact, SET the ball's velocity along the pad's axis
    // at max(arrival speed, BOOST_SPEED). A velocity-set, not an impulse.
    for (const p of boosters) {
      if (!contactIds.has(p.body.id)) continue
      const speed = Math.max(preSpeed, BOOST_SPEED)
      const angle = p.body.angle
      Body.setVelocity(ball, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed })
    }

    const frame: BallFrame = { x: ball.position.x, y: ball.position.y, a: ball.angle }
    trajectory.push(frame)

    // First interaction with a player-placed piece → ghost-preview cut point.
    if (firstPlayerContactTick === null && contacts.some((c) => solidPieceIds.has(c.id))) {
      firstPlayerContactTick = frameIndex
    }

    // Coins: swept along the ball's actual path segment this tick, so a fast
    // ball cannot tunnel past a pickup between two samples.
    for (const coin of coins) {
      if (collectedCoinIds.has(coin.id)) continue
      if (segmentDist(coin.position, sweepFrom, frame) <= coin.radius) {
        collectedCoinIds.add(coin.id)
        coinsCollected.push(coin.id)
        coinTicks.push(frameIndex)
      }
    }

    if (dist(frame, target.position) <= target.radius) {
      return finish('won', 'target', frameIndex)
    }
    for (const fz of failZones) {
      if (dist(frame, fz.position) <= fz.radius) {
        return finish('failed', 'failzone', frameIndex)
      }
    }

    // Portal: the placed entry swallows the ball once its CENTRE is inside the
    // disc, teleporting it to the authored exit with speed preserved and
    // direction set by the exit's angle. The recorded frame keeps the
    // pre-teleport pose — the jump happens between frames, which is exactly how
    // the replay draws it. 10-tick cooldown prevents immediate re-triggering.
    let teleported = false
    if (
      world.portalEntry &&
      portalExit &&
      i >= portalCooldownUntil &&
      dist(frame, world.portalEntry.body.position) <= PORTAL_RADIUS
    ) {
      if (firstPlayerContactTick === null) firstPlayerContactTick = frameIndex
      const speed = Math.hypot(ball.velocity.x, ball.velocity.y)
      Body.setPosition(ball, { x: portalExit.position.x, y: portalExit.position.y })
      Body.setVelocity(ball, {
        x: Math.cos(portalExit.rotation) * speed,
        y: Math.sin(portalExit.rotation) * speed,
      })
      portalCooldownUntil = i + PORTAL_COOLDOWN_TICKS
      teleported = true
    }
    sweepFrom = teleported ? { x: ball.position.x, y: ball.position.y } : frame

    const speed = Math.hypot(ball.velocity.x, ball.velocity.y)
    if (speed < SETTLE_SPEED) {
      stillCount++
      if (stillCount >= SETTLE_STEPS) {
        return finish('failed', 'settled', frameIndex)
      }
    } else {
      stillCount = 0
    }

    prevContactIds = contactIds
  }

  return finish('failed', 'timeout', MAX_STEPS)
}

export type PreviewResult = {
  /** The dashed ghost path: the run's trajectory up to and including the first
   *  player-piece interaction — or the whole run if no piece is ever touched. */
  frames: BallFrame[]
  /** True when the path was cut at a player piece (arrival preview). */
  cut: boolean
  sim: SimResult
}

/**
 * The ghost preview (kravspec §4.5): simulate the CURRENT placements + ball,
 * then truncate at the first player-piece interaction. Because pieces are
 * static, the ball's path before its first touch is unaffected by them — so
 * these frames are by construction an exact prefix of the real run.
 */
export function previewRun(
  level: LevelDef,
  placements: PlacedPiece[],
  ballType: BallType = DEFAULT_BALL,
): PreviewResult {
  const sim = simulate(level, placements, ballType)
  const cutAt = sim.firstPlayerContactTick
  if (cutAt === null) return { frames: sim.trajectory, cut: false, sim }
  return { frames: sim.trajectory.slice(0, cutAt + 1), cut: true, sim }
}
