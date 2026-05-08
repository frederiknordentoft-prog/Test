export const easings = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outElastic: t => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
  },
  outBounce: t => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
    if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
    t -= 2.625 / d1;
    return n1 * t * t + 0.984375;
  },
};

export class Tweens {
  constructor() {
    this.list = [];
  }

  add(duration, onUpdate, options = {}) {
    const tween = {
      duration,
      elapsed: 0,
      easing: options.easing ?? easings.outQuad,
      onUpdate,
      onComplete: options.onComplete ?? null,
      done: false,
    };
    this.list.push(tween);
    return tween;
  }

  to(from, to, duration, onUpdate, options = {}) {
    return this.add(duration, (eased) => {
      let v;
      if (typeof from === 'number') {
        v = from + (to - from) * eased;
      } else if (from && typeof from.add === 'function' && typeof from.scale === 'function' && typeof from.sub === 'function') {
        v = from.add(to.sub(from).scale(eased));
      } else {
        v = eased < 1 ? from : to;
      }
      onUpdate(v);
    }, options);
  }

  step(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      if (t.done) {
        this.list.splice(i, 1);
        continue;
      }
      t.elapsed += dt;
      const u = Math.min(1, t.elapsed / t.duration);
      t.onUpdate(t.easing(u));
      if (u >= 1) {
        t.done = true;
        if (t.onComplete) t.onComplete();
      }
    }
  }

  cancel(tween) {
    if (tween) tween.done = true;
  }

  cancelAll() {
    for (const t of this.list) t.done = true;
  }
}
