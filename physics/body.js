import { Vec2 } from './vec2.js';

export class Body {
  constructor({
    position,
    angle = 0,
    shape = 'circle',
    radius = 0.5,
    vertices = null,
    mass = 1,
    inertia = null,
    restitution = 0.5,
    friction = 0.2,
    dragCoefficient = 0.47,
    crossSection = null,
    isStatic = false,
  }) {
    this.position = position.clone();
    this.previous = position.clone();
    this.acceleration = Vec2.zero();
    this.angle = angle;
    this.previousAngle = angle;
    this.angularAcceleration = 0;
    this.shape = shape;
    this.mass = mass;
    this.restitution = restitution;
    this.friction = friction;
    this.dragCoefficient = dragCoefficient;
    this.static = isStatic;

    if (shape === 'polygon') {
      if (!vertices || vertices.length < 3) throw new Error('polygon needs ≥3 vertices');
      this.vertices = vertices.map(v => v.clone());
      this.boundingRadius = Math.max(...this.vertices.map(v => v.length()));
      this.radius = this.boundingRadius;
      this.area = polygonArea(this.vertices);
      this.inertia = inertia ?? polygonInertia(this.vertices, mass);
      this.crossSection = crossSection ?? this.area;
    } else {
      this.vertices = null;
      this.radius = radius;
      this.boundingRadius = radius;
      this.area = Math.PI * radius * radius;
      this.inertia = inertia ?? 0.5 * mass * radius * radius;
      this.crossSection = crossSection ?? this.area;
    }

    this.invMass = isStatic ? 0 : 1 / mass;
    this.invInertia = isStatic ? 0 : 1 / this.inertia;
  }

  velocity(dt) {
    return this.position.sub(this.previous).scale(1 / dt);
  }

  angularVelocity(dt) {
    return (this.angle - this.previousAngle) / dt;
  }

  setVelocity(v, dt) {
    this.previous = this.position.sub(v.scale(dt));
  }

  setAngularVelocity(omega, dt) {
    this.previousAngle = this.angle - omega * dt;
  }

  applyForce(f) {
    if (this.static) return;
    this.acceleration = this.acceleration.add(f.scale(this.invMass));
  }

  applyTorque(tau) {
    if (this.static) return;
    this.angularAcceleration += tau * this.invInertia;
  }

  worldVertices() {
    if (this.shape !== 'polygon') return [];
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    return this.vertices.map(v => new Vec2(
      this.position.x + v.x * c - v.y * s,
      this.position.y + v.x * s + v.y * c,
    ));
  }

  static box(width, height, options = {}) {
    const w = width / 2;
    const h = height / 2;
    return new Body({
      ...options,
      shape: 'polygon',
      vertices: [
        new Vec2(-w, -h),
        new Vec2(w, -h),
        new Vec2(w, h),
        new Vec2(-w, h),
      ],
    });
  }
}

function polygonArea(vertices) {
  let a = 0;
  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    a += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(a) / 2;
}

function polygonInertia(vertices, mass) {
  let num = 0;
  let den = 0;
  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    const cross = Math.abs(p1.x * p2.y - p2.x * p1.y);
    num += cross * (p1.dot(p1) + p1.dot(p2) + p2.dot(p2));
    den += cross;
  }
  return den === 0 ? mass : (mass / 6) * (num / den);
}
