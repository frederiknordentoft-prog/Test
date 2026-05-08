import { Vec2 } from './vec2.js';

export class Particles {
  constructor() {
    this.list = [];
  }

  burst(position, options = {}) {
    const count = options.count ?? 12;
    const speedMin = options.speedMin ?? 1;
    const speedMax = options.speedMax ?? 4;
    const lifetime = options.lifetime ?? 0.6;
    const lifetimeVariance = options.lifetimeVariance ?? 0.3;
    const color = options.color ?? '#fff';
    const radius = options.radius ?? 0.05;
    const radiusVariance = options.radiusVariance ?? 0.5;
    const gravity = options.gravity ?? new Vec2(0, 9.82);
    const drag = options.drag ?? 1.5;
    const angleStart = options.angleStart ?? 0;
    const angleEnd = options.angleEnd ?? Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const angle = angleStart + Math.random() * (angleEnd - angleStart);
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const r = radius * (1 - radiusVariance + Math.random() * radiusVariance * 2);
      const life = lifetime * (1 - lifetimeVariance + Math.random() * lifetimeVariance * 2);
      this.list.push({
        position: position.clone(),
        velocity: new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        radius: Math.max(0.005, r),
        lifetime: Math.max(0.05, life),
        age: 0,
        color,
        gravity,
        drag,
      });
    }
  }

  step(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.lifetime) {
        this.list.splice(i, 1);
        continue;
      }
      p.velocity = p.velocity.add(p.gravity.scale(dt));
      const damp = Math.max(0, 1 - p.drag * dt);
      p.velocity = p.velocity.scale(damp);
      p.position = p.position.add(p.velocity.scale(dt));
    }
  }

  render(ctx, scale) {
    const prevAlpha = ctx.globalAlpha;
    for (const p of this.list) {
      const t = p.age / p.lifetime;
      const fade = (1 - t) * (1 - t);
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.position.x * scale, p.position.y * scale, p.radius * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = prevAlpha;
  }

  clear() {
    this.list.length = 0;
  }
}
