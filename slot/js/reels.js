/* =========================================================================
   ReelEngine — Canvas 2D reel renderer + spin choreography.
   Presentation only: it is handed the strips and final stop indices by the
   game (SlotMath) and animates towards them. Nothing here touches outcome.
   ========================================================================= */
(function (root) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  const easeInCubic = (t) => t * t * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (t) => t * t * (3 - 2 * t);

  // Timing profiles (ms). "quick" is used for tap-to-stop.
  const PROFILES = {
    normal: { pull: 150, ramp: 260, vmax: 30, base: 950, stagger: 210, stopDur: 520, overshoot: 0.16, anticipation: 1000 },
    turbo:  { pull: 90,  ramp: 140, vmax: 38, base: 420, stagger: 90,  stopDur: 300, overshoot: 0.12, anticipation: 550 },
    quick:  { stopDur: 240, stagger: 70, overshoot: 0.12 },
  };

  class ReelEngine {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.art = opts.art;               // { symbol(id, px) -> canvas, colors }
      this.audio = opts.audio || null;
      this.reels = opts.reels || 5;
      this.rows = opts.rows || 3;
      this.strips = opts.strips;         // array of arrays of symbol ids
      this.reduced = !!opts.reducedMotion;
      this.onReelStop = opts.onReelStop || (() => {});
      this.onAllStopped = opts.onAllStopped || (() => {});
      this.getTheme = opts.getTheme || (() => 'light');

      this.state = this.strips.map((s, i) => ({
        pos: 0, phase: 'idle', t0: 0, p0: 0, end: 0, stopAt: 0, dur: 0, overshoot: 0, lastIdx: 0, stopped: true, glow: 0, flash: 0,
      }));
      this.layout = null;
      this.dpr = Math.min(2.5, root.devicePixelRatio || 1);
      this.time = 0;
      this.last = performance.now();
      this.spinning = false;
      this.highlight = null;   // { cells: Set<string>, lines: [[{reel,row}...]], activeLine: index|null, dim: bool }
      this.hlTime = 0;
      this.symbolCache = new Map();
      this.profile = PROFILES.normal;
      this._raf = null;
      this._needsDraw = true;
      this._resizeObs = new ResizeObserver(() => this.resize());
      this._resizeObs.observe(canvas.parentElement);
      this.resize();
      this.loop = this.loop.bind(this);
      this._raf = requestAnimationFrame(this.loop);
    }

    setStrips(strips, stops) {
      this.strips = strips;
      if (stops) this.state.forEach((s, i) => { s.pos = stops[i]; s.lastIdx = stops[i]; });
      this.symbolCache.clear();
      this._needsDraw = true;
    }
    setStops(stops) { this.state.forEach((s, i) => { s.pos = stops[i]; s.lastIdx = stops[i]; s.phase = 'idle'; s.stopped = true; }); this._needsDraw = true; }

    resize() {
      const parent = this.canvas.parentElement;
      const w = parent.clientWidth, h = parent.clientHeight;
      if (!w || !h) return;
      this.dpr = Math.min(2.5, root.devicePixelRatio || 1);
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      const gap = Math.round(clamp(w * 0.018, 6, 14));
      const cellW = (w - gap * (this.reels - 1)) / this.reels;
      const cellH = (h - gap * (this.rows - 1)) / this.rows;
      const cell = Math.min(cellW, cellH);
      const gridW = cell * this.reels + gap * (this.reels - 1);
      const gridH = cell * this.rows + gap * (this.rows - 1);
      this.layout = { w, h, gap, cell, gridW, gridH, x0: (w - gridW) / 2, y0: (h - gridH) / 2, radius: Math.round(cell * 0.22) };
      this.symbolCache.clear();
      this._needsDraw = true;
    }

    symbolImage(id, theme) {
      const key = id + '@' + this.layout.cell + '@' + theme;
      let img = this.symbolCache.get(key);
      if (!img) { img = this.art.symbol(id, Math.round(this.layout.cell * this.dpr), this.dpr, theme); this.symbolCache.set(key, img); }
      return img;
    }

    /* Expected wall-clock duration of a spin with the given profile (ms). */
    expectedDuration(turbo, anticipateFrom) {
      const p = turbo ? PROFILES.turbo : PROFILES.normal;
      if (this.reduced) return 260 + 90 * (this.reels - 1) + 220;
      let extra = 0;
      if (anticipateFrom != null && anticipateFrom > 0 && anticipateFrom < this.reels) extra = p.anticipation * Math.min(this.reels - anticipateFrom, 3);
      return p.base + p.stagger * (this.reels - 1) + p.stopDur + extra;
    }
    /* True once the reel before the tease has landed (the glow should only show then). */
    anticipationVisible() { return this.anticipateFrom != null && this.state[this.anticipateFrom - 1].stopped; }

    /* ---------- spin choreography ---------- */
    spin(stops, opts) {
      opts = opts || {};
      const prof = opts.turbo ? PROFILES.turbo : PROFILES.normal;
      this.profile = prof;
      this.spinning = true;
      this.highlight = null;
      this.targetStops = stops;
      this.pendingStrips = opts.strips && opts.strips !== this.strips ? opts.strips : null;
      this.anticipationApplied = false;
      this.anticipateFrom = null;
      const now = performance.now();
      this.spinStart = now;
      this.state.forEach((s, i) => {
        s.phase = 'launch'; s.t0 = now; s.p0 = s.pos; s.stopped = false;
        s.stopAt = now + prof.base + prof.stagger * i;
        s.dur = prof.stopDur; s.overshoot = prof.overshoot; s.glow = 0; s.target = stops[i];
        s.vel = 0;
      });
      if (this.reduced) {
        // Reduced motion: short, no overshoot, short stagger.
        this.state.forEach((s, i) => { s.stopAt = now + 260 + 90 * i; s.dur = 220; s.overshoot = 0; });
      }
      // Scatter tease: reels from `anticipateFrom` spin longer. Decided from the fixed outcome
      // (two scatters already on earlier reels); the visual is identical whether or not a third lands.
      if (opts.anticipateFrom != null && opts.anticipateFrom > 0 && opts.anticipateFrom < this.reels && !this.reduced) {
        this.anticipateFrom = opts.anticipateFrom;
        this.anticipationApplied = true;
        const extra = prof.anticipation;
        let k = 0;
        for (let i = opts.anticipateFrom; i < this.reels; i++) { this.state[i].stopAt += extra * Math.min(k + 1, 3); this.state[i].anticipating = true; k++; }
      }
      this._needsDraw = true;
      return new Promise((resolve) => { this._resolveSpin = resolve; });
    }

    /* Tap-to-stop: every reel still spinning stops now, in order. */
    quickStop() {
      if (!this.spinning) return;
      const now = performance.now();
      let k = 0;
      this.state.forEach((s) => {
        if (s.phase === 'launch' || s.phase === 'spin') {
          s.stopAt = Math.min(s.stopAt, now + PROFILES.quick.stagger * k++);
          s.dur = PROFILES.quick.stopDur; s.overshoot = PROFILES.quick.overshoot;
          s.anticipating = false;
        }
      });
      this.anticipateFrom = null; // no tease shimmer after a quick stop
    }

    /* Extend the remaining reels for a scatter-tease. */
    anticipate(fromReel) {
      if (this.anticipationApplied) return;
      this.anticipationApplied = true;
      const extra = this.reduced ? 0 : this.profile.anticipation;
      let k = 0;
      this.state.forEach((s, i) => {
        if (i >= fromReel && (s.phase === 'launch' || s.phase === 'spin')) { s.stopAt += extra * Math.min(k + 1, 3); s.anticipating = true; k++; }
      });
    }

    isAnticipating() { return this.state.some((s) => s.anticipating && !s.stopped) && this.anticipationVisible(); }

    /* ---------- update ---------- */
    update(now) {
      const L = this.strips;
      let allStopped = true;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.state.forEach((s, i) => {
        const len = L[i].length;
        if (s.phase === 'idle') return;
        allStopped = false;
        const prof = this.profile;
        if (s.phase === 'launch') {
          const t = now - s.t0;
          if (t < prof.pull && !this.reduced) {
            // anticipation pull-back (upwards = pos increases)
            s.pos = s.p0 + 0.18 * Math.sin(Math.PI * (t / prof.pull)) * smooth(clamp(t / prof.pull, 0, 1));
          } else {
            const tr = clamp((t - (this.reduced ? 0 : prof.pull)) / prof.ramp, 0, 1);
            s.vel = prof.vmax * easeInCubic(tr);
            s.pos -= s.vel * dt;
            if (tr >= 1) s.phase = 'spin';
          }
          if (now >= s.stopAt) this._beginStop(s, i, now);
        } else if (s.phase === 'spin') {
          if (this.pendingStrips && this.strips[i] !== this.pendingStrips[i]) {
            // swap strips while fully blurred — invisible to the player
            this.strips[i] = this.pendingStrips[i];
            s.pos = ((s.pos % this.strips[i].length) + this.strips[i].length) % this.strips[i].length;
          }
          s.vel = prof.vmax * (s.anticipating && this.anticipationVisible() ? 1.15 : 1);
          s.pos -= s.vel * dt;
          if (now >= s.stopAt) this._beginStop(s, i, now);
        } else if (s.phase === 'stop') {
          const t = clamp((now - s.t0) / s.dur, 0, 1);
          const dist = s.end - s.p0;
          let p = s.p0 + dist * easeOutQuart(t);
          // settle bounce: dip past the target then return (down = decreasing pos)
          const u = clamp((t - 0.62) / 0.38, 0, 1);
          p -= s.overshoot * Math.pow(Math.sin(Math.PI * u), 2);
          s.vel = (s.pos - p) / Math.max(dt, 1e-3);
          s.pos = p;
          const idx = Math.floor(s.pos);
          if (idx !== s.lastIdx && this.audio && t < 0.6) this.audio.tick(clamp(Math.abs(s.vel) / prof.vmax, 0.2, 1));
          s.lastIdx = idx;
          if (t >= 1) {
            s.pos = s.end; s.phase = 'idle'; s.stopped = true; s.anticipating = false; s.vel = 0; s.flash = 1;
            s.pos = ((s.pos % len) + len) % len;
            s.lastIdx = s.pos;
            this.onReelStop(i, now);
          }
        }
        // keep pos bounded
        if (s.pos < -len * 4 || s.pos > len * 4) s.pos = ((s.pos % len) + len) % len;
      });
      if (this.spinning && allStopped) {
        this.spinning = false;
        if (this.pendingStrips) { this.strips = this.pendingStrips.slice(); this.pendingStrips = null; }
        const r = this._resolveSpin; this._resolveSpin = null;
        this.onAllStopped();
        if (r) r();
      }
      return !allStopped;
    }

    _beginStop(s, i, now) {
      if (this.pendingStrips && this.strips[i] !== this.pendingStrips[i]) {
        this.strips[i] = this.pendingStrips[i];
        s.pos = ((s.pos % this.strips[i].length) + this.strips[i].length) % this.strips[i].length;
      }
      const len = this.strips[i].length;
      s.phase = 'stop'; s.t0 = now; s.p0 = s.pos;
      // end must be <= p0 - minTravel and ≡ target (mod len)
      const minTravel = this.reduced ? 1 : (s.dur >= 500 ? 4.5 : 2.5);
      let end = s.target;
      while (end > s.p0 - minTravel) end -= len;
      s.end = end;
    }

    /* ---------- drawing ---------- */
    loop(now) {
      const moving = this.update(now);
      this.time = now;
      const hl = this.highlight;
      const colors = this.art.colors(this.getTheme());
      if (colors.idleSparkle && !this.spinning && !this.reduced) this._tickSparkles(now);
      const fx = this.state.some((s) => s.flash > 0) || this._wildVisible || (this._sparkles && this._sparkles.length > 0);
      if (moving || this._needsDraw || hl || fx) { this.draw(now); this._needsDraw = false; }
      this.last = now;
      this._raf = requestAnimationFrame(this.loop);
    }

    draw(now) {
      const ctx = this.ctx, L = this.layout, dpr = this.dpr;
      if (!L) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, L.w, L.h);
      const theme = this.getTheme();
      const colors = this.art.colors(theme);
      const { cell, gap, x0, y0, radius } = L;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this._wildVisible = false;

      for (let r = 0; r < this.reels; r++) {
        const s = this.state[r];
        const strip = this.strips[r];
        const len = strip.length;
        const rx = x0 + r * (cell + gap);
        // clip to the reel column
        ctx.save();
        roundRect(ctx, rx, y0, cell, L.gridH, radius);
        ctx.clip();
        // column well
        ctx.fillStyle = colors.well;
        ctx.fillRect(rx, y0, cell, L.gridH);
        // anticipation glow
        if (s.anticipating && !s.stopped && this.anticipationVisible()) {
          const g = ctx.createLinearGradient(rx, y0, rx, y0 + L.gridH);
          const a = 0.18 + 0.1 * Math.sin(now / 160);
          g.addColorStop(0, hexA(colors.accent, 0));
          g.addColorStop(0.5, hexA(colors.accent, a));
          g.addColorStop(1, hexA(colors.accent, 0));
          ctx.fillStyle = g; ctx.fillRect(rx, y0, cell, L.gridH);
        }
        const speed = Math.abs(s.vel || 0);
        const blur = clamp((speed - 8) / 24, 0, 1);
        const base = Math.floor(s.pos);
        const frac = s.pos - base;
        for (let k = -1; k <= this.rows + 1; k++) {
          const idx = ((base + k) % len + len) % len;
          const id = strip[idx];
          const y = y0 + (k - frac) * (cell + gap);
          if (y + cell < y0 - cell || y > y0 + L.gridH + cell) continue;
          this.drawSymbol(ctx, id, rx, y, cell, blur, speed, r, base + k, now, colors, theme);
        }
        // landing flash (skin option): a quick wash of light down the column as it stops
        if (colors.landFlash && s.flash > 0 && !this.reduced) {
          const g = ctx.createLinearGradient(rx, y0, rx, y0 + L.gridH);
          g.addColorStop(0, `rgba(255,255,255,${0.22 * s.flash})`); g.addColorStop(0.5, `rgba(255,255,255,${0.06 * s.flash})`); g.addColorStop(1, `rgba(255,255,255,${0.2 * s.flash})`);
          ctx.fillStyle = g; ctx.fillRect(rx, y0, cell, L.gridH);
          s.flash = Math.max(0, s.flash - dt * 4.5);
        } else if (s.flash > 0) s.flash = 0;
        ctx.restore();
      }

      // win lines & highlights
      if (this.highlight) this.drawHighlight(ctx, now, colors);
      if (colors.idleSparkle && !this.spinning) this._drawSparkles(ctx, now);
    }

    drawSymbol(ctx, id, x, y, cell, blur, speed, reel, absIdx, now, colors, theme) {
      const img = this.symbolImage(id, theme);
      const hl = this.highlight;
      let scale = 1, alpha = 1;
      const s = this.state[reel];
      if (hl && s.stopped) {
        const row = absIdx - Math.round(s.pos);
        const key = reel + ',' + row;
        const inWin = hl.cells.has(key);
        const inActive = hl.activeCells ? hl.activeCells.has(key) : inWin;
        if (inActive) {
          const t = (now - this.hlTime) / 1000;
          scale = 1 + 0.06 * (0.5 + 0.5 * Math.sin(t * 5.2 - 1.2));
        } else if (hl.dim) {
          alpha = inWin ? 0.8 : 0.4;
        }
      }
      // wild pulse (skin option): a slow rainbow breathing behind a landed wild
      if (colors.wildPulse && id === 'WILD' && s.stopped && !this.spinning) {
        const row = absIdx - Math.round(s.pos);
        if (row >= 0 && row < this.rows) {
          this._wildVisible = true;
          const p = 0.5 + 0.5 * Math.sin(now / 420 + reel);
          const g = ctx.createRadialGradient(x + cell / 2, y + cell / 2, cell * 0.1, x + cell / 2, y + cell / 2, cell * 0.62);
          g.addColorStop(0, `rgba(255,255,255,${0.22 + 0.18 * p})`); g.addColorStop(0.5, `rgba(125,249,255,${0.12 + 0.1 * p})`); g.addColorStop(1, 'rgba(255,79,216,0)');
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - cell * 0.2, y - cell * 0.2, cell * 1.4, cell * 1.4); ctx.restore();
        }
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      if (colors.bloom && scale !== 1 && !this.reduced) {
        // bloom behind a winning symbol
        const g = ctx.createRadialGradient(x + cell / 2, y + cell / 2, cell * 0.15, x + cell / 2, y + cell / 2, cell * 0.7);
        g.addColorStop(0, hexA(colors.accent, 0.45)); g.addColorStop(0.6, hexA(colors.accent, 0.12)); g.addColorStop(1, hexA(colors.accent, 0));
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - cell * 0.3, y - cell * 0.3, cell * 1.6, cell * 1.6); ctx.restore();
      }
      if (blur > 0.02 && !this.reduced) {
        // motion streak: stretched ghost copies
        const stretch = 1 + 0.35 * blur;
        const cy = y + cell / 2;
        ctx.globalAlpha = alpha * (1 - 0.45 * blur);
        ctx.drawImage(img, x, cy - (cell * stretch) / 2, cell, cell * stretch);
        ctx.globalAlpha = alpha * 0.28 * blur;
        ctx.drawImage(img, x, cy - (cell * stretch) / 2 + cell * 0.22 * blur, cell, cell * stretch);
        ctx.drawImage(img, x, cy - (cell * stretch) / 2 - cell * 0.22 * blur, cell, cell * stretch);
      } else if (scale !== 1) {
        // winning object: lift out of the tray, subtle scale pulse, one specular band sweeping across it
        const cx = x + cell / 2, cy = y + cell / 2 - cell * 0.035;
        ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
        const tmp = this._tmp(img.width);
        const tctx = tmp.getContext('2d');
        tctx.setTransform(1, 0, 0, 1, 0, 0);
        tctx.globalCompositeOperation = 'source-over';
        tctx.clearRect(0, 0, tmp.width, tmp.height);
        tctx.drawImage(img, 0, 0, tmp.width, tmp.height);
        const period = 2.2, sweepDur = 0.6;
        const tt = ((now - this.hlTime) / 1000 + 0.25 - reel * 0.07) % period;
        if (tt > 0 && tt < sweepDur) {
          const u = tt / sweepDur;
          const W = tmp.width;
          const bx = (u * 1.8 - 0.4) * W;
          const g = tctx.createLinearGradient(bx - W * 0.22, 0, bx + W * 0.22, W * 0.5);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          tctx.globalCompositeOperation = 'source-atop';
          tctx.fillStyle = g; tctx.fillRect(0, 0, W, W);
        }
        ctx.drawImage(tmp, x, y - cell * 0.035, cell, cell);
      } else {
        ctx.drawImage(img, x, y, cell, cell);
      }
      ctx.restore();
    }

    /* Idle sparkles (skin option): a glint blooms on a random visible symbol now and then. */
    _tickSparkles(now) {
      if (!this._sparkles) { this._sparkles = []; this._nextSparkle = now + 600; }
      if (now >= this._nextSparkle && this.layout) {
        const reel = Math.floor(Math.random() * this.reels), row = Math.floor(Math.random() * this.rows);
        const c = this.cellCenter(reel, row);
        const cell = this.layout.cell;
        this._sparkles.push({ x: c.x + (Math.random() - 0.5) * cell * 0.5, y: c.y + (Math.random() - 0.5) * cell * 0.5, t0: now, dur: 650 + Math.random() * 350, size: cell * (0.06 + Math.random() * 0.06) });
        this._nextSparkle = now + 500 + Math.random() * 900;
      }
      this._sparkles = this._sparkles.filter((sp) => now - sp.t0 < sp.dur);
    }
    _drawSparkles(ctx, now) {
      if (!this._sparkles || !this._sparkles.length) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const sp of this._sparkles) {
        const u = (now - sp.t0) / sp.dur; const a = Math.sin(Math.PI * u); const s = sp.size * (0.6 + 0.8 * a);
        ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(u * 0.8);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.2); g.addColorStop(0, `rgba(255,255,255,${0.45 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.22 : s; const ang = (i / 8) * Math.PI * 2 - Math.PI / 2; const px = Math.cos(ang) * r, py = Math.sin(ang) * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      ctx.restore();
    }

    _tmp(px) {
      if (!this._tmpCanvas || this._tmpCanvas.width !== px) { this._tmpCanvas = document.createElement('canvas'); this._tmpCanvas.width = this._tmpCanvas.height = px; }
      return this._tmpCanvas;
    }

    /* highlight = { cells:Set('r,row'), lines:[{positions:[{reel,row}], color}], activeLine, dim, scatter:[{reel,row}] } */
    setHighlight(h) { this.highlight = h; this.hlTime = performance.now(); this._needsDraw = true; }
    clearHighlight() { this.highlight = null; this._needsDraw = true; }

    cellCenter(reel, row) {
      const { cell, gap, x0, y0 } = this.layout;
      return { x: x0 + reel * (cell + gap) + cell / 2, y: y0 + row * (cell + gap) + cell / 2 };
    }

    drawHighlight(ctx, now, colors) {
      const hl = this.highlight;
      const { cell, radius } = this.layout;
      const t = (now - this.hlTime) / 1000;
      const lines = hl.activeLine != null && hl.lines[hl.activeLine] ? [hl.lines[hl.activeLine]] : [];
      for (const line of lines) {
        const pts = line.positions.map((p) => this.cellCenter(p.reel, p.row));
        const reveal = clamp(t / 0.45, 0, 1);
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        let stroke = hexA(colors.accent, 0.9);
        if (colors.line && pts.length > 1) {
          const lg = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
          colors.line.forEach((c, i) => lg.addColorStop(i / (colors.line.length - 1), hexA(c, 0.95)));
          stroke = lg;
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(2.5, cell * (colors.line ? 0.04 : 0.032));
        ctx.shadowColor = hexA(colors.line ? colors.line[0] : colors.accent, colors.line ? 0.7 : 0.45); ctx.shadowBlur = cell * (colors.line ? 0.35 : 0.25);
        // animated draw-on: stroke a path up to `reveal` of total length
        const total = pathLength(pts);
        drawPartialPath(ctx, pts, total * easeOutCubic(reveal));
        ctx.stroke();
        // extend the line through the full 5 reels faintly
        ctx.restore();
        // rings on winning cells
        for (const p of line.positions) {
          const c = this.cellCenter(p.reel, p.row);
          ctx.save();
          ctx.strokeStyle = stroke;
          ctx.lineWidth = Math.max(1.5, cell * 0.024);
          if (colors.line) { ctx.shadowColor = hexA(colors.line[1] || colors.line[0], 0.6); ctx.shadowBlur = cell * 0.2; }
          roundRect(ctx, c.x - cell / 2 + 1, c.y - cell / 2 + 1, cell - 2, cell - 2, radius);
          ctx.stroke();
          ctx.restore();
        }
      }
      if (hl.scatter && hl.scatter.length) {
        for (const p of hl.scatter) {
          const c = this.cellCenter(p.reel, p.row);
          const pulse = 0.5 + 0.5 * Math.sin(t * 4);
          ctx.save();
          ctx.strokeStyle = hexA(colors.scatter, 0.6 + 0.4 * pulse);
          ctx.lineWidth = Math.max(1.5, cell * 0.024);
          ctx.shadowColor = hexA(colors.scatter, 0.5); ctx.shadowBlur = cell * 0.2 * pulse;
          roundRect(ctx, c.x - cell / 2 + 1, c.y - cell / 2 + 1, cell - 2, cell - 2, radius);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    destroy() { cancelAnimationFrame(this._raf); this._resizeObs.disconnect(); }
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function pathLength(pts) { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return l; }
  function drawPartialPath(ctx, pts, len) {
    ctx.beginPath();
    if (!pts.length) return;
    ctx.moveTo(pts[0].x, pts[0].y);
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (acc + seg <= len) { ctx.lineTo(b.x, b.y); acc += seg; }
      else { const f = clamp((len - acc) / seg, 0, 1); ctx.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f); break; }
    }
  }

  root.ReelEngine = ReelEngine;
  root.ReelEngine.PROFILES = PROFILES;
  root.ReelEngine.util = { roundRect, hexA, clamp, easeOutCubic, easeInOut };
})(typeof self !== 'undefined' ? self : this);
