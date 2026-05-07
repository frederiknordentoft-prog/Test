import { Vec2 } from './vec2.js';

export class Body {
  constructor({
    position,
    angle = 0,
    radius = 0.5,
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
    this.radius = radius;
    this.mass = mass;
    this.inertia = inertia ?? 0.5 * mass * radius * radius;
    this.invMass = isStatic ? 0 : 1 / mass;
    this.invInertia = isStatic ? 0 : 1 / this.inertia;
    this.restitution = restitution;
    this.friction = friction;
    this.dragCoefficient = dragCoefficient;
    this.crossSection = crossSection ?? Math.PI * radius * radius;
    this.static = isStatic;
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
}
