import { Vec2 } from './vec2.js';

export class Body {
  constructor({
    position,
    radius = 0.5,
    mass = 1,
    restitution = 0.5,
    friction = 0.2,
    dragCoefficient = 0.47,
    crossSection = null,
    isStatic = false,
  }) {
    this.position = position.clone();
    this.previous = position.clone();
    this.acceleration = Vec2.zero();
    this.radius = radius;
    this.mass = mass;
    this.restitution = restitution;
    this.friction = friction;
    this.dragCoefficient = dragCoefficient;
    this.crossSection = crossSection ?? Math.PI * radius * radius;
    this.static = isStatic;
  }

  velocity(dt) {
    return this.position.sub(this.previous).scale(1 / dt);
  }

  setVelocity(v, dt) {
    this.previous = this.position.sub(v.scale(dt));
  }

  applyForce(f) {
    if (this.static) return;
    this.acceleration = this.acceleration.add(f.scale(1 / this.mass));
  }
}
