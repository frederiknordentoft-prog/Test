import { Vec2 } from './vec2.js';

export class Engine {
  constructor({
    gravity = new Vec2(0, 9.82),
    airDensity = 1.225,
    bounds = null,
    subSteps = 4,
  } = {}) {
    this.gravity = gravity;
    this.airDensity = airDensity;
    this.bounds = bounds;
    this.subSteps = Math.max(1, subSteps);
    this.bodies = [];
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
    for (let i = 0; i < this.subSteps; i++) {
      this.#accumulateForces(h);
      this.#integrate(h);
      this.#resolveCollisions();
      this.#applyBounds();
    }
  }

  #accumulateForces(dt) {
    for (const body of this.bodies) {
      if (body.static) continue;
      body.acceleration = this.gravity.clone();

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
      if (body.static) continue;
      const current = body.position.clone();
      const next = body.position.scale(2).sub(body.previous).add(body.acceleration.scale(dt2));
      body.previous = current;
      body.position = next;
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

    const delta = b.position.sub(a.position);
    const distSq = delta.lengthSq();
    const minDist = a.radius + b.radius;
    if (distSq >= minDist * minDist || distSq < 1e-12) return;

    const dist = Math.sqrt(distSq);
    const normal = delta.scale(1 / dist);
    const overlap = minDist - dist;

    const invA = a.static ? 0 : 1 / a.mass;
    const invB = b.static ? 0 : 1 / b.mass;
    const invSum = invA + invB;

    // Shift both position and previous so the implicit velocity is preserved.
    const corrA = normal.scale(overlap * invA / invSum);
    const corrB = normal.scale(overlap * invB / invSum);
    a.position = a.position.sub(corrA);
    a.previous = a.previous.sub(corrA);
    b.position = b.position.add(corrB);
    b.previous = b.previous.add(corrB);

    const dispA = a.position.sub(a.previous);
    const dispB = b.position.sub(b.previous);
    const relV = dispB.sub(dispA);

    const vn = relV.dot(normal);
    if (vn >= 0) return;

    const tangent = new Vec2(-normal.y, normal.x);
    const vt = relV.dot(tangent);

    const e = Math.min(a.restitution, b.restitution);
    const f = (a.friction + b.friction) * 0.5;

    const jn = -(1 + e) * vn / invSum;
    const jt = -vt * f / invSum;
    const impulse = normal.scale(jn).add(tangent.scale(jt));

    a.previous = a.previous.add(impulse.scale(invA));
    b.previous = b.previous.sub(impulse.scale(invB));
  }

  #applyBounds() {
    if (!this.bounds) return;
    const { minX, minY, maxX, maxY } = this.bounds;
    for (const body of this.bodies) {
      if (body.static) continue;
      const r = body.radius;
      const v = body.position.sub(body.previous);

      if (body.position.x - r < minX) {
        body.position.x = minX + r;
        body.previous.x = body.position.x + v.x * body.restitution;
        body.previous.y = body.position.y - v.y * (1 - body.friction);
      } else if (body.position.x + r > maxX) {
        body.position.x = maxX - r;
        body.previous.x = body.position.x + v.x * body.restitution;
        body.previous.y = body.position.y - v.y * (1 - body.friction);
      }

      if (body.position.y - r < minY) {
        body.position.y = minY + r;
        body.previous.y = body.position.y + v.y * body.restitution;
        body.previous.x = body.position.x - v.x * (1 - body.friction);
      } else if (body.position.y + r > maxY) {
        body.position.y = maxY - r;
        body.previous.y = body.position.y + v.y * body.restitution;
        body.previous.x = body.position.x - v.x * (1 - body.friction);
      }
    }
  }
}
