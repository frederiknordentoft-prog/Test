import Matter from 'matter-js'
import type { Breakable, PieceType, StaticObstacle, Vec2 } from '../types'
import { PIECE_SPECS, PORTAL_RADIUS, rotationIndexToRadians, type PieceSpec } from './constants'

const { Bodies, Body } = Matter

// A piece is always a STATIC body whose orientation is set by the rotation
// index. Making the ball the only dynamic body is what keeps the whole
// simulation trivially deterministic and the solver's search space bounded.
// (See DECISIONS.md.)

type MaterialOpts = {
  isStatic: true
  restitution: number
  friction: number
  frictionStatic: number
  angle?: number
}

function mat(spec: PieceSpec, angle = 0): MaterialOpts {
  return {
    isStatic: true,
    restitution: spec.restitution,
    friction: spec.friction,
    frictionStatic: spec.frictionStatic,
    angle,
  }
}

/**
 * Matter's Body.setStatic (run for every `isStatic: true` body) zeroes
 * restitution and forces friction to 1, silently killing authored materials —
 * the collision pair combines the PARENTS' live values (max restitution, min
 * friction). Restore the intended material on every part after creation so a
 * springy piece actually bounces the ball. Plain property writes → still
 * fully deterministic.
 */
export function restoreStaticMaterial(body: Matter.Body, restitution: number, friction: number): void {
  for (const part of body.parts) {
    part.restitution = restitution
    part.friction = friction
  }
}

/**
 * Build the Matter body for a placed piece at a slot position with a rotation
 * index into the global 16-step table (validated against the piece's domain).
 * Material properties live on every part so compound pieces (funnel) collide
 * with the right restitution.
 */
export function createPieceBody(type: PieceType, position: Vec2, rotationIndex: number): Matter.Body {
  const spec = PIECE_SPECS[type]
  const angle = rotationIndexToRadians(type, rotationIndex)
  let body: Matter.Body

  switch (type) {
    case 'ramp':
      // A single long plank — the workhorse deflector.
      body = Bodies.rectangle(position.x, position.y, 92, 11, mat(spec))
      break
    case 'bouncer':
      // Short, very springy pad.
      body = Bodies.rectangle(position.x, position.y, 66, 13, mat(spec))
      break
    case 'funnel': {
      // ∨ shape: two inward-sloping planks with a wide bottom-centre gap (34px,
      // ~2× ball diameter) so the ball never wedges. A centred ball passes
      // straight through; an off-centre or tilted approach is deflected off a
      // plank face like a ramp.
      const halfGap = 17
      const topHalfWidth = 40
      const height = 28
      const cx = (halfGap + topHalfWidth) / 2
      const dx = topHalfWidth - halfGap
      const len = Math.hypot(dx, height)
      const leftAngle = Math.atan2(height, dx)
      const left = Bodies.rectangle(-cx, 0, len, 9, mat(spec, leftAngle))
      const right = Bodies.rectangle(cx, 0, len, 9, mat(spec, Math.PI - leftAngle))
      body = Body.create({ parts: [left, right], isStatic: true })
      break
    }
    case 'booster':
      // Solid pad; on contact the sim SETS the ball's velocity along the pad's
      // axis (see simulate.ts). The renderer draws the arrow.
      body = Bodies.rectangle(position.x, position.y, 46, 16, mat(spec))
      break
    case 'portal':
      // Sensor disc — never physically collides. The teleport trigger is a
      // centre-within-radius check in simulate.ts (reads as the portal
      // "swallowing" the ball rather than firing on a rim graze).
      body = Bodies.circle(position.x, position.y, PORTAL_RADIUS, {
        isStatic: true,
        isSensor: true,
        label: 'piece:portal',
      })
      break
  }

  Body.setPosition(body, { x: position.x, y: position.y })
  Body.setAngle(body, angle)
  if (type !== 'portal') restoreStaticMaterial(body, spec.restitution, spec.friction)
  body.label = `piece:${type}`
  return body
}

/** Build the Matter body for a level's static obstacle. */
export function createObstacleBody(o: StaticObstacle): Matter.Body {
  if (o.shape === 'peg') {
    const radius = o.size?.x ?? 8
    const peg = Bodies.circle(o.position.x, o.position.y, radius, {
      isStatic: true,
      restitution: 0.35,
      friction: 0.02,
      label: 'obstacle:peg',
    })
    restoreStaticMaterial(peg, 0.35, 0.02)
    return peg
  }
  // 'wall' — size is half-extents.
  const halfX = o.size?.x ?? 40
  const halfY = o.size?.y ?? 8
  const wall = Bodies.rectangle(o.position.x, o.position.y, halfX * 2, halfY * 2, {
    isStatic: true,
    restitution: 0.15,
    friction: 0.06,
    frictionStatic: 0.3,
    angle: o.rotation ?? 0,
    label: 'obstacle:wall',
  })
  restoreStaticMaterial(wall, 0.15, 0.06)
  return wall
}

/**
 * Build the Matter body for a breakable plank. Behaves exactly like a wall
 * until the simulation removes it on a hard enough impact
 * (impactSpeed × ball.mass ≥ breakImpulse).
 */
export function createBreakableBody(b: Breakable): Matter.Body {
  const body = Bodies.rectangle(b.position.x, b.position.y, b.size.x * 2, b.size.y * 2, {
    isStatic: true,
    restitution: 0.15,
    friction: 0.06,
    frictionStatic: 0.3,
    angle: b.rotation ?? 0,
    label: `breakable:${b.id}`,
  })
  restoreStaticMaterial(body, 0.15, 0.06)
  return body
}
