import Matter from 'matter-js'
import type { PieceType, StaticObstacle, Vec2 } from '../types'
import { PIECE_SPECS, rotationRadians, type PieceSpec } from './constants'

const { Bodies, Body } = Matter

// A piece is always a STATIC deflector whose orientation is set by the rotation
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
 * Build the Matter body for a placed piece at a slot position with a rotation
 * index (0..3 into ROTATION_STEPS). Material properties live on every part so
 * that compound pieces (funnel, spinner) collide with the right restitution.
 */
export function createPieceBody(type: PieceType, position: Vec2, rotationIndex: number): Matter.Body {
  const spec = PIECE_SPECS[type]
  const angle = rotationRadians(rotationIndex)
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
    case 'spinner': {
      // Pinwheel: four blades tilted off their radial spokes so the shape has a
      // consistent chirality — any hit gets a sideways "spin" kick rather than
      // splitting ambiguously like a symmetric cross would. Distinct feel from
      // the straight ramp; orientation (rotation index) changes the kick.
      const hubR = 5
      const bladeLen = 30
      const bladeW = 8
      const tilt = (38 * Math.PI) / 180
      const blades: Matter.Body[] = []
      for (let k = 0; k < 4; k++) {
        const spoke = (k * Math.PI) / 2
        const cx = Math.cos(spoke) * (hubR + bladeLen / 2)
        const cy = Math.sin(spoke) * (hubR + bladeLen / 2)
        blades.push(Bodies.rectangle(cx, cy, bladeLen, bladeW, mat(spec, spoke + tilt)))
      }
      body = Body.create({ parts: blades, isStatic: true })
      break
    }
  }

  Body.setPosition(body, { x: position.x, y: position.y })
  Body.setAngle(body, angle)
  body.label = `piece:${type}`
  return body
}

/** Build the Matter body for a level's static obstacle. */
export function createObstacleBody(o: StaticObstacle): Matter.Body {
  if (o.shape === 'peg') {
    const radius = o.size?.x ?? 8
    return Bodies.circle(o.position.x, o.position.y, radius, {
      isStatic: true,
      restitution: 0.35,
      friction: 0.02,
      label: 'obstacle:peg',
    })
  }
  // 'wall' — size is half-extents.
  const halfX = o.size?.x ?? 40
  const halfY = o.size?.y ?? 8
  return Bodies.rectangle(o.position.x, o.position.y, halfX * 2, halfY * 2, {
    isStatic: true,
    restitution: 0.15,
    friction: 0.06,
    frictionStatic: 0.3,
    angle: o.rotation ?? 0,
    label: 'obstacle:wall',
  })
}
