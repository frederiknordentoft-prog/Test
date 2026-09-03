/* =========================================================================
   FX — celebration particles on an overlay canvas.
   Restrained "Messages screen effect" flavour: soft confetti slips, glints,
   and bokeh dots in the palette; additive-free, no neon.
   ========================================================================= */
(function (root) {
  'use strict';
  const rnd = (a, b) => a + Math.random() * (b - a);

  class FX {
    constructor(canvas, opts) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.parts = [];
      this.reduced = !!(opts && opts.reducedMotion);
      this.dpr = Math.min(2, root.devicePixelRatio || 1);
      this.w = 0; this.h = 0;
      this.resize();
      this._obs = new ResizeObserver(() => this.resize());
      this._obs.observe(canvas.parentElement);
      this.last = performance.now();
      this._raf = requestAnimationFrame((t) => this.loop(t));
    }
    resize() {
      const p = this.canvas.parentElement;
      this.w = p.clientWidth; this.h = p.clientHeight;
      this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
      this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
    }
    /* Burst from a point (x,y in CSS px of the overlay) */
    burst(x, y, { count = 24, colors, spread = 1, power = 1, kind = 'confetti' } = {}) {
      if (this.reduced) count = Math.ceil(count / 3);
      for (let i = 0; i < count; i++) {
        const a = rnd(-Math.PI, Math.PI) ;
        const sp = rnd(120, 420) * power;
        this.parts.push({
          kind, x, y, vx: Math.cos(a) * sp * spread, vy: Math.sin(a) * sp - 180 * power,
          life: 0, ttl: rnd(0.9, 1.7), rot: rnd(0, Math.PI * 2), vr: rnd(-6, 6),
          size: kind === 'glint' ? rnd(6, 12) : rnd(5, 9), color: colors[i % colors.length], w: rnd(0.55, 1),
        });
      }
    }
    /* Gentle rain from the top edge across a width */
    rain(x0, x1, { count = 40, colors, kind = 'confetti', duration = 1.4 } = {}) {
      if (this.reduced) count = Math.ceil(count / 3);
      for (let i = 0; i < count; i++) {
        this.parts.push({
          kind, x: rnd(x0, x1), y: -20 - rnd(0, 200), vx: rnd(-25, 25), vy: rnd(70, 190),
          life: -rnd(0, duration), ttl: rnd(2.2, 3.4), rot: rnd(0, Math.PI * 2), vr: rnd(-4, 4),
          size: kind === 'glint' ? rnd(6, 14) : rnd(6, 10), color: colors[i % colors.length], w: rnd(0.5, 1), drift: rnd(0.8, 2.2), sides: 3 + Math.floor(Math.random() * 4),
        });
      }
    }
    /* Gem shards: small glowing polygons thrown from a point (Nova skin). */
    shards(x, y, { count = 26, colors, power = 1 } = {}) {
      if (this.reduced) count = Math.ceil(count / 3);
      for (let i = 0; i < count; i++) {
        const a = rnd(-Math.PI, 0) - rnd(0, 0.4) + rnd(0, 0.8); // mostly upwards
        const sp = rnd(160, 460) * power;
        this.parts.push({
          kind: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120 * power,
          life: 0, ttl: rnd(1.1, 2.0), rot: rnd(0, Math.PI * 2), vr: rnd(-9, 9),
          size: rnd(5, 11), color: colors[i % colors.length], sides: 3 + Math.floor(Math.random() * 4), w: 1,
        });
      }
    }
    /* Soft light discs rising slowly from the bottom of an area — the Stor gevinst effect. */
    rise(x0, x1, y0, y1, { count = 26, colors, duration = 1.2 } = {}) {
      if (this.reduced) count = Math.ceil(count / 3);
      for (let i = 0; i < count; i++) {
        this.parts.push({
          kind: 'bokeh', x: rnd(x0, x1), y: rnd(y0 + (y1 - y0) * 0.55, y1), vx: 0, vy: -rnd(28, 70),
          life: -rnd(0, duration), ttl: rnd(1.8, 3.0), rot: rnd(0, Math.PI * 2), vr: 0,
          size: rnd(4, 16), color: colors[i % colors.length], w: 1,
        });
      }
    }
    loop(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      if (this.parts.length) { this.update(dt); this.draw(); }
      else if (this._dirty) { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this._dirty = false; }
      this._raf = requestAnimationFrame((t) => this.loop(t));
    }
    update(dt) {
      const g = 520;
      for (const p of this.parts) {
        p.life += dt;
        if (p.life < 0) continue;
        if (p.kind === 'confetti' || p.kind === 'glint' || p.kind === 'shard') {
          p.vy += g * dt * (p.drift ? 0.12 : 1);
          p.vx *= (1 - 1.6 * dt); p.vy *= (1 - (p.drift ? 0.2 : 0.9) * dt);
          p.x += p.vx * dt + (p.drift ? Math.sin(p.life * p.drift * 3) * 30 * dt : 0);
          p.y += p.vy * dt; p.rot += p.vr * dt;
        } else if (p.kind === 'bokeh') {
          p.y += p.vy * dt; p.x += Math.sin(p.life * 1.6 + p.rot) * 14 * dt;
        }
      }
      this.parts = this.parts.filter((p) => p.life < p.ttl && p.y < this.h + 40);
      this._dirty = true;
    }
    draw() {
      const ctx = this.ctx, dpr = this.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      for (const p of this.parts) {
        if (p.life < 0) continue;
        const f = p.life / p.ttl;
        const alpha = f < 0.1 ? f / 0.1 : (f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1);
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color;
        if (p.kind === 'confetti') {
          ctx.rotate(p.rot);
          const w = p.size * p.w, h = p.size * 1.6;
          // fake 3D flip via width modulation
          const flip = Math.cos(p.life * 7 + p.rot);
          roundRect(ctx, -w * flip / 2, -h / 2, w * Math.abs(flip) + 0.5, h, 2);
          ctx.fill();
        } else if (p.kind === 'glint') {
          ctx.rotate(p.rot * 0.3);
          const s = p.size * (0.6 + 0.4 * Math.sin(p.life * 9));
          star4(ctx, s); ctx.fill();
        } else if (p.kind === 'shard') {
          ctx.rotate(p.rot);
          const s = p.size, sides = p.sides || 4;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.2);
          glow.addColorStop(0, p.color); glow.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha *= 0.35; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, s * 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          ctx.beginPath();
          for (let i = 0; i < sides; i++) { const a = (i / sides) * Math.PI * 2; const rr = i % 2 ? s * 0.75 : s; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
          ctx.closePath();
          ctx.fillStyle = p.color; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-s * 0.25, -s * 0.3, s * 0.35, s * 0.18, -0.6, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'bokeh') {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha *= 0.45; ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    }
    clear() { this.parts.length = 0; this._dirty = true; }
    destroy() { cancelAnimationFrame(this._raf); this._obs.disconnect(); }
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function star4(ctx, s) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? s : s * 0.28;
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  root.FX = FX;
})(typeof self !== 'undefined' ? self : this);
