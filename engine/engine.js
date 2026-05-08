import { Vec2 } from './vec2.js';
import { polygonPolygon, circlePolygon } from './sat.js';

export class Engine {
  constructor({
    gravity = new Vec2(0, 9.82),
    airDensity = 1.225,
    bounds = null,
    subSteps = 4,
    iterations = 8,
    restitutionThreshold = 1.0,
    penetrationSlop = 0.005,
    penetrationPercent = 0.8,
    sleeping = true,
    sleepLinearVelocity = 0.05,
    sleepAngularVelocity = 0.1,
    sleepFrames = 30,
  } = {}) {
    this.gravity = gravity;
    this.airDensity = airDensity;
    this.bounds = bounds;
    this.subSteps = Math.max(1, subSteps);
    this.iterations = Math.max(1, iterations);
    this.restitutionThreshold = restitutionThreshold;
    this.penetrationSlop = penetrationSlop;
    this.penetrationPercent = penetrationPercent;
    this.sleeping = sleeping;
    this.sleepLinearVelocity = sleepLinearVelocity;
    this.sleepAngularVelocity = sleepAngularVelocity;
    this.sleepFrames = sleepFrames;
    this.bodies = [];
    this.onCollision = null;
    this._h = 0;
  }

  add(body) {
    this.bodies.push(body);
    return body;
  }

  remove(body) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  step(dt) {
    const h = dt / this.subSteps;
    this._h = h;
    for (let i = 0; i < this.subSteps; i++) {
      this.#accumulateForces(h);
      this.#integrate(h);
      for (let k = 0; k < this.iterations; k++) {
        this.#resolveCollisions();
        this.#applyBounds();
      }
    }
    if (this.sleeping) this.#updateSleep(h);
  }

  #accumulateForces(dt) {
    for (const body of this.bodies) {
      if (body.static || body.sleeping) continue;
      body.acceleration = this.gravity.clone();
      body.angularAcceleration = 0;

      const v = body.velocity(dt);
      const speed = v.length();
      if (speed > 1e-9 && this.airDensity > 0) {
        const dragForce = 0.5 * this.airDensity * body.dragCoefficient * body.crossSection * speed * speed;
        const dragAcc = v.normalize().scale(-dragForce / body.mass);
        body.acceleration = body.acceleration.add(dragAcc);
      }
    }
  }

  #integrate(dt) {
    const dt2 = dt * dt;
    for (const body of this.bodies) {
      if (body.static || body.sleeping) continue;

      const current = body.position.clone();
      body.position = body.position.scale(2).sub(body.previous).add(body.acceleration.scale(dt2));
      body.previous = current;

      const currentAngle = body.angle;
      body.angle = 2 * body.angle - body.previousAngle + body.angularAcceleration * dt2;
      body.previousAngle = currentAngle;
    }
  }

  #updateSleep(h) {
    const linSqLimit = (this.sleepLinearVelocity * h) ** 2;
    const angLimit = this.sleepAngularVelocity * h;
    for (const body of this.bodies) {
      if (body.static) continue;
      if (body.sleeping) continue;
      const dispSq = body.position.sub(body.previous).lengthSq();
      const angDisp = Math.abs(body.angle - body.previousAngle);
      if (dispSq < linSqLimit && angDisp < angLimit) {
        body._idleFrames++;
        if (body._idleFrames >= this.sleepFrames) {
          body.sleeping = true;
          body.previous = body.position.clone();
          body.previousAngle = body.angle;
        }
      } else {
        body._idleFrames = 0;
      }
    }
  }

  #resolveCollisions() {
    const n = this.bodies.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        this.#resolvePair(this.bodies[i], this.bodies[j]);
      }
    }
  }

  #resolvePair(a, b) {
    if (a.static && b.static) return;
    if (a.sleeping && b.sleeping) return;

    // Broad-phase: bounding circles
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    const r = a.boundingRadius + b.boundingRadius;
    if (dx * dx + dy * dy > r * r) return;

    let bodyA = a;
    let bodyB = b;
    if (a.shape === 'polygon' && b.shape === 'circle') {
      bodyA = b;
      bodyB = a;
    }

    let result = null;
    if (bodyA.shape === 'circle' && bodyB.shape === 'circle') {
      result = circleCircle(bodyA, bodyB);
    } else if (bodyA.shape === 'circle' && bodyB.shape === 'polygon') {
      result = circlePolygon(bodyA.position, bodyA.radius, bodyB.worldVertices(), bodyB.position);
    } else if (bodyA.shape === 'polygon' && bodyB.shape === 'polygon') {
      result = polygonPolygon(bodyA.worldVertices(), bodyA.position, bodyB.worldVertices(), bodyB.position);
    }

    if (result) {
      this.#applyContactImpulse(bodyA, bodyB, result.contact, result.normal, result.depth);
    }
  }

  #applyContactImpulse(a, b, contact, normal, depth) {
    const invSum = a.invMass + b.invMass;
    if (invSum === 0) return;

    const corrDepth = Math.max(depth - this.penetrationSlop, 0) * this.penetrationPercent;
    if (corrDepth > 0) {
      const corrA = normal.scale(corrDepth * a.invMass / invSum);
      const corrB = normal.scale(corrDepth * b.invMass / invSum);
      a.position = a.position.sub(corrA);
      a.previous = a.previous.sub(corrA);
      b.position = b.position.add(corrB);
      b.previous = b.previous.add(corrB);
    }

    const rA = contact.sub(a.position);
    const rB = contact.sub(b.position);

    const dispA = a.position.sub(a.previous);
    const dispB = b.position.sub(b.previous);
    const angDispA = a.angle - a.previousAngle;
    const angDispB = b.angle - b.previousAngle;

    const dispAtA = new Vec2(dispA.x - rA.y * angDispA, dispA.y + rA.x * angDispA);
    const dispAtB = new Vec2(dispB.x - rB.y * angDispB, dispB.y + rB.x * angDispB);
    const relDisp = dispAtB.sub(dispAtA);

    const vn = relDisp.dot(normal);
    if (vn >= 0) return;

    const tangent = new Vec2(-normal.y, normal.x);
    const vt = relDisp.dot(tangent);

    const rACrossN = rA.x * normal.y - rA.y * normal.x;
    const rBCrossN = rB.x * normal.y - rB.y * normal.x;
    const rACrossT = rA.x * tangent.y - rA.y * tangent.x;
    const rBCrossT = rB.x * tangent.y - rB.y * tangent.x;

    const kn = invSum + rACrossN * rACrossN * a.invInertia + rBCrossN * rBCrossN * b.invInertia;
    const kt = invSum + rACrossT * rACrossT * a.invInertia + rBCrossT * rBCrossT * b.invInertia;

    const e = Math.min(a.restitution, b.restitution);
    const f = (a.friction + b.friction) * 0.5;

    const restitutionThresh = this.restitutionThreshold * this._h;
    const useE = -vn < restitutionThresh ? 0 : e;

    const jn = -(1 + useE) * vn / kn;
    let jt = -vt * f / kt;
    const maxJt = Math.abs(jn) * f;
    if (jt > maxJt) jt = maxJt;
    else if (jt < -maxJt) jt = -maxJt;

    const impulse = normal.scale(jn).add(tangent.scale(jt));

    a.previous = a.previous.add(impulse.scale(a.invMass));
    b.previous = b.previous.sub(impulse.scale(b.invMass));

    const crossAImp = rA.x * impulse.y - rA.y * impulse.x;
    const crossBImp = rB.x * impulse.y - rB.y * impulse.x;
    a.previousAngle += crossAImp * a.invInertia;
    b.previousAngle -= crossBImp * b.invInertia;

    a.wake();
    b.wake();

    if (this.onCollision) {
      this.onCollision({ a, b, contact, normal, speed: -vn / this._h });
    }
  }

  #applyBounds() {
    if (!this.bounds) return;
    for (const body of this.bodies) {
      if (body.static) continue;
      if (body.shape === 'polygon') this.#polygonBounds(body);
      else this.#circleBounds(body);
    }
  }

  #circleBounds(body) {
    const { minX, minY, maxX, maxY } = this.bounds;
    const r = body.radius;

    const slop = this.penetrationSlop;
    const pct = this.penetrationPercent;
    const correct = (depth) => Math.max(depth - slop, 0) * pct;

    if (body.position.x - r < minX) {
      const o = correct(minX - (body.position.x - r));
      body.position.x += o;
      body.previous.x += o;
      this.#staticContactImpulse(body, new Vec2(-r, 0), new Vec2(1, 0));
    } else if (body.position.x + r > maxX) {
      const o = correct((body.position.x + r) - maxX);
      body.position.x -= o;
      body.previous.x -= o;
      this.#staticContactImpulse(body, new Vec2(r, 0), new Vec2(-1, 0));
    }

    if (body.position.y - r < minY) {
      const o = correct(minY - (body.position.y - r));
      body.position.y += o;
      body.previous.y += o;
      this.#staticContactImpulse(body, new Vec2(0, -r), new Vec2(0, 1));
    } else if (body.position.y + r > maxY) {
      const o = correct((body.position.y + r) - maxY);
      body.position.y -= o;
      body.previous.y -= o;
      this.#staticContactImpulse(body, new Vec2(0, r), new Vec2(0, -1));
    }
  }

  #polygonBounds(body) {
    const { minX, minY, maxX, maxY } = this.bounds;
    const walls = [
      { n: new Vec2(1, 0), depth: (v) => minX - v.x },
      { n: new Vec2(-1, 0), depth: (v) => v.x - maxX },
      { n: new Vec2(0, 1), depth: (v) => minY - v.y },
      { n: new Vec2(0, -1), depth: (v) => v.y - maxY },
    ];

    for (const wall of walls) {
      const verts = body.worldVertices();
      let maxDepth = 0;
      let sumX = 0, sumY = 0, count = 0;
      for (const v of verts) {
        const d = wall.depth(v);
        if (d > 0) {
          if (d > maxDepth) maxDepth = d;
          sumX += v.x; sumY += v.y; count++;
        }
      }
      if (count === 0) continue;

      // Centroid of penetrating vertices: stable face-flat contact (no spurious rotation).
      const contact = new Vec2(sumX / count, sumY / count);
      const origPos = body.position;
      const corr = Math.max(maxDepth - this.penetrationSlop, 0) * this.penetrationPercent;
      if (corr > 0) {
        body.position = body.position.add(wall.n.scale(corr));
        body.previous = body.previous.add(wall.n.scale(corr));
      }
      this.#staticContactImpulse(body, contact.sub(origPos), wall.n);
    }
  }

  #staticContactImpulse(body, r, n) {
    const disp = body.position.sub(body.previous);
    const angDisp = body.angle - body.previousAngle;
    const dispAt = new Vec2(disp.x - r.y * angDisp, disp.y + r.x * angDisp);

    const vn = -dispAt.dot(n);
    if (vn <= 0) return;

    const t = new Vec2(-n.y, n.x);
    const vt = dispAt.dot(t);

    const rCrossN = r.x * n.y - r.y * n.x;
    const rCrossT = r.x * t.y - r.y * t.x;

    const kn = body.invMass + rCrossN * rCrossN * body.invInertia;
    const kt = body.invMass + rCrossT * rCrossT * body.invInertia;

    const useE = vn < this.restitutionThreshold * this._h ? 0 : body.restitution;
    const jn = (1 + useE) * vn / kn;
    let jt = -vt * body.friction / kt;
    const maxJt = Math.abs(jn) * body.friction;
    if (jt > maxJt) jt = maxJt;
    else if (jt < -maxJt) jt = -maxJt;

    const impulse = n.scale(jn).add(t.scale(jt));
    body.previous = body.previous.sub(impulse.scale(body.invMass));
    const crossImp = r.x * impulse.y - r.y * impulse.x;
    body.previousAngle -= crossImp * body.invInertia;

    if (this.onCollision) {
      this.onCollision({ a: body, b: null, contact: body.position.add(r), normal: n, speed: vn / this._h });
    }
  }
}

function circleCircle(a, b) {
  const delta = b.position.sub(a.position);
  const distSq = delta.lengthSq();
  const minDist = a.radius + b.radius;
  if (distSq >= minDist * minDist || distSq < 1e-12) return null;
  const dist = Math.sqrt(distSq);
  const normal = delta.scale(1 / dist);
  return {
    normal,
    depth: minDist - dist,
    contact: a.position.add(normal.scale(a.radius)),
  };
}
