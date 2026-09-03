/* =========================================================================
   Starfield — full-window space background for the Nova skin.
   Radial star drift that turns into hyperspace streaks while the reels spin,
   a slowly breathing nebula, and a flash on wins. Cheap: one canvas, capped DPR.
   ========================================================================= */
(function (root) {
  'use strict';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TINTS = ['255,255,255', '125,249,255', '255,150,235', '255,225,160'];

  class Starfield {
    constructor(canvas, opts) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.reduced = !!(opts && opts.reducedMotion);
      this.dpr = Math.min(1.5, root.devicePixelRatio || 1);
      this.warp = 0; this.warpTarget = 0; this.glow = 0; this.mode = 0; this.modeTarget = 0; // 0 base, 1 free
      this.stars = [];
      this.last = performance.now();
      this.resize();
      this._onResize = () => this.resize();
      root.addEventListener('resize', this._onResize);
      this._raf = requestAnimationFrame((t) => this.loop(t));
    }
    resize() {
      this.w = root.innerWidth; this.h = root.innerHeight;
      this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
      this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
      const n = Math.round(Math.min(320, Math.max(140, (this.w * this.h) / 5200)));
      if (this.stars.length !== n) { this.stars = []; for (let i = 0; i < n; i++) this.stars.push(this.spawn(true)); }
      this.nebula = [this.bakeNebula(false), this.bakeNebula(true)];
      this.dirty = true;
    }
    spawn(anywhere) {
      return { a: rnd(0, Math.PI * 2), r: anywhere ? Math.pow(Math.random(), 0.6) : rnd(0.01, 0.06), z: rnd(0.25, 1), tw: rnd(0, Math.PI * 2), tint: TINTS[Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * 3)] };
    }
    bakeNebula(free) {
      const c = document.createElement('canvas'); const W = 512, H = 320; c.width = W; c.height = H;
      const x = c.getContext('2d');
      const blobs = free
        ? [[0.25, 0.15, 0.55, '255,170,60', 0.55], [0.75, 0.7, 0.6, '255,79,216', 0.5], [0.5, 0.45, 0.45, '255,225,120', 0.35]]
        : [[0.2, 0.1, 0.55, '120,60,220', 0.6], [0.8, 0.75, 0.6, '30,140,255', 0.45], [0.55, 0.4, 0.45, '255,79,216', 0.28]];
      blobs.forEach(([bx, by, br, col, a]) => {
        const g = x.createRadialGradient(bx * W, by * H, 0, bx * W, by * H, br * W);
        g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.5, `rgba(${col},${a * 0.35})`); g.addColorStop(1, `rgba(${col},0)`);
        x.fillStyle = g; x.fillRect(0, 0, W, H);
      });
      return c;
    }
    setWarp(v) { this.warpTarget = Math.max(0, Math.min(1, v)); }
    flash(strength) { this.glow = Math.max(this.glow, strength || 1); }
    setMode(m) { this.modeTarget = m === 'free' ? 1 : 0; }
    loop(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.warp += (this.warpTarget - this.warp) * Math.min(1, dt * (this.warpTarget > this.warp ? 3.2 : 2.2));
      this.mode += (this.modeTarget - this.mode) * Math.min(1, dt * 1.5);
      this.glow = Math.max(0, this.glow - dt * 1.4);
      if (!this.reduced || this.dirty) { this.draw(now, dt); this.dirty = false; }
      this._raf = requestAnimationFrame((t) => this.loop(t));
    }
    draw(now, dt) {
      const ctx = this.ctx, dpr = this.dpr, w = this.w, h = this.h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // ground
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0b0626'); bg.addColorStop(0.5, '#08041c'); bg.addColorStop(1, '#03020c');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      // nebula (two bakes crossfaded by mode), breathing
      const breath = 0.85 + 0.15 * Math.sin(now / 4000) + this.glow * 0.6;
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.min(1, breath * (1 - this.mode)); ctx.drawImage(this.nebula[0], -w * 0.1, -h * 0.15, w * 1.2, h * 1.3);
      ctx.globalAlpha = Math.min(1, breath * this.mode); if (this.mode > 0.01) ctx.drawImage(this.nebula[1], -w * 0.1, -h * 0.15, w * 1.2, h * 1.3);
      ctx.restore();
      // stars
      const cx = w * 0.5, cy = h * 0.42, R = Math.max(w, h) * 0.78;
      const warp = this.warp, speed = (0.012 + warp * 1.1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const s of this.stars) {
        if (!this.reduced) { s.r += speed * (0.4 + s.z) * dt * (0.3 + s.r * 1.4); s.tw += dt * 2; }
        if (s.r > 1.15) Object.assign(s, this.spawn(false));
        const x = cx + Math.cos(s.a) * s.r * R, y = cy + Math.sin(s.a) * s.r * R;
        const twinkle = 0.55 + 0.45 * Math.sin(s.tw * (1 + s.z));
        const size = (0.5 + s.z * 1.5) * (0.7 + s.r * 0.6);
        const alpha = Math.min(1, (0.35 + 0.65 * twinkle) * (0.5 + s.z * 0.6) * (0.6 + this.glow * 0.5));
        if (warp > 0.04) {
          const len = warp * (8 + 70 * s.r * s.z);
          const x0 = cx + Math.cos(s.a) * Math.max(0, s.r * R - len), y0 = cy + Math.sin(s.a) * Math.max(0, s.r * R - len);
          const g = ctx.createLinearGradient(x0, y0, x, y);
          g.addColorStop(0, `rgba(${s.tint},0)`); g.addColorStop(1, `rgba(${s.tint},${alpha})`);
          ctx.strokeStyle = g; ctx.lineWidth = size * (1 + warp * 0.6); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${s.tint},${alpha})`;
          ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
          if (s.z > 0.85 && twinkle > 0.8) { // cross sparkle on the brightest
            ctx.strokeStyle = `rgba(${s.tint},${(twinkle - 0.8) * 2.5 * 0.6})`; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(x - size * 4, y); ctx.lineTo(x + size * 4, y); ctx.moveTo(x, y - size * 4); ctx.lineTo(x, y + size * 4); ctx.stroke();
          }
        }
      }
      ctx.restore();
      // win flash: soft white-cyan wash from the centre
      if (this.glow > 0.02) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.7);
        g.addColorStop(0, `rgba(125,249,255,${this.glow * 0.16})`); g.addColorStop(1, 'rgba(125,249,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
    }
    destroy() { cancelAnimationFrame(this._raf); root.removeEventListener('resize', this._onResize); }
  }
  root.Starfield = Starfield;
})(typeof self !== 'undefined' ? self : this);
