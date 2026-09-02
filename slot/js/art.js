/* =========================================================================
   SlotArt — procedural symbol renderer ("Objekt": physical materials under
   one top-left key light). No image assets: every symbol is drawn with
   gradients, paths and baked shadows into an offscreen canvas, once per size.
   Coordinate space: 100 × 100 units, scaled to the requested pixel size.
   ========================================================================= */
(function (root) {
  'use strict';

  const COLORS = {
    light: { well: '#fbfbfd', accent: '#0071e3', scatter: '#0071e3', ink: '#1d1d1f', sub: '#6e6e73', shadow: 'rgba(0,0,0,0.22)' },
    dark:  { well: '#343438', accent: '#2997ff', scatter: '#2997ff', ink: '#f5f5f7', sub: '#86868b', shadow: 'rgba(0,0,0,0.5)' },
  };
  const ACCENT = '#0071e3';

  const SYMBOLS = {
    WILD: { name: 'Prisme', caption: 'Wild', tier: 'wild' },
    SCAT: { name: 'Ring', caption: 'Bonus', tier: 'scatter' },
    H1: { name: 'Safirlinse', tier: 'high' },
    H2: { name: 'Titanblok', tier: 'high' },
    H3: { name: 'Keramik', tier: 'high' },
    H4: { name: 'Stålkugle', tier: 'high' },
    L1: { name: 'A', sub: 'Midnight', tier: 'low', color: '#2e3440', glyph: 'A' },
    L2: { name: 'K', sub: 'Starlight', tier: 'low', color: '#e6e0d5', glyph: 'K' },
    L3: { name: 'Q', sub: 'Sierra Blue', tier: 'low', color: '#a3bfd9', glyph: 'Q' },
    L4: { name: 'J', sub: 'Graphite', tier: 'low', color: '#5b5b5f', glyph: 'J' },
  };

  /* ---------- helpers ---------- */
  function makeCanvas(px) {
    const c = typeof OffscreenCanvas !== 'undefined' && false ? new OffscreenCanvas(px, px) : document.createElement('canvas');
    c.width = px; c.height = px; return c;
  }
  function squircle(ctx, cx, cy, w, h, n) {
    // superellipse |x/a|^n + |y/b|^n = 1 sampled as a polygon
    n = n || 4.5; const a = w / 2, b = h / 2; const N = 96;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      const ct = Math.cos(t), st = Math.sin(t);
      const x = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n) * a;
      const y = Math.sign(st) * Math.pow(Math.abs(st), 2 / n) * b;
      if (i === 0) ctx.moveTo(cx + x, cy + y); else ctx.lineTo(cx + x, cy + y);
    }
    ctx.closePath();
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function contactShadow(ctx, cx, cy, rx, ry, alpha) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`);
    g.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.45})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function specular(ctx, cx, cy, rx, ry, alpha, rot) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot || 0); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.35})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function brushed(ctx, x, y, w, h, count, alpha, horizontal, seed) {
    let s = seed || 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    ctx.save(); ctx.lineWidth = 0.6;
    for (let i = 0; i < count; i++) {
      const p = r();
      const a = alpha * (0.3 + 0.7 * r());
      ctx.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 0.8})`;
      ctx.beginPath();
      if (horizontal) { const yy = y + p * h; ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
      else { const xx = x + p * w; ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function radialBrush(ctx, cx, cy, r0, r1, count, alpha, seed) {
    let s = seed || 11;
    const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
    ctx.save(); ctx.lineWidth = 0.5;
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2; const al = alpha * (0.2 + 0.8 * rnd());
      ctx.strokeStyle = rnd() > 0.5 ? `rgba(255,255,255,${al})` : `rgba(0,0,0,${al})`;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  function shade(hex, amt) { // amt -1..1
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function caption(ctx, text, y, color) {
    ctx.save();
    ctx.font = '600 9.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    ctx.fillText(text, 50, y);
    ctx.restore();
  }

  /* ---------- symbol painters (100×100 space) ---------- */
  const painters = {
    /* Glass prism cube — Wild */
    WILD(ctx, theme) {
      contactShadow(ctx, 50, 82, 30, 7, theme === 'dark' ? 0.55 : 0.28);
      // isometric cube: top face, left face, right face
      const T = [[50, 22], [78, 36], [50, 50], [22, 36]];
      const L = [[22, 36], [50, 50], [50, 80], [22, 66]];
      const R = [[50, 50], [78, 36], [78, 66], [50, 80]];
      const poly = (p) => { ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); };
      // faces: translucent cool glass
      let g = ctx.createLinearGradient(22, 36, 50, 80);
      g.addColorStop(0, 'rgba(184,214,246,0.95)'); g.addColorStop(1, 'rgba(94,148,214,0.92)');
      poly(L); ctx.fillStyle = g; ctx.fill();
      g = ctx.createLinearGradient(78, 36, 50, 80);
      g.addColorStop(0, 'rgba(214,232,252,0.95)'); g.addColorStop(1, 'rgba(120,170,230,0.92)');
      poly(R); ctx.fillStyle = g; ctx.fill();
      g = ctx.createLinearGradient(22, 22, 78, 50);
      g.addColorStop(0, 'rgba(250,253,255,1)'); g.addColorStop(0.6, 'rgba(226,240,254,1)'); g.addColorStop(1, 'rgba(190,220,250,1)');
      poly(T); ctx.fillStyle = g; ctx.fill();
      // inner light: a soft core glow (light trapped in the glass) + refraction shard
      ctx.save(); poly([[50, 22], [78, 36], [78, 66], [50, 80], [22, 66], [22, 36]]); ctx.clip();
      g = ctx.createRadialGradient(52, 52, 2, 52, 52, 26);
      g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.5, 'rgba(180,215,255,0.25)'); g.addColorStop(1, 'rgba(120,170,230,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
      ctx.globalAlpha = 0.28; ctx.fillStyle = '#ffffff';
      poly([[30, 44], [44, 51], [44, 70], [30, 63]]); ctx.fill();
      ctx.restore();
      // caustic tint on the right face
      ctx.save(); poly(R); ctx.clip();
      g = ctx.createLinearGradient(50, 50, 78, 66);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(0.55, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(40, 30, 50, 60); ctx.restore();
      // bright edges
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.6;
      poly(T); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(50, 50); ctx.lineTo(50, 80); ctx.stroke();
      ctx.strokeStyle = 'rgba(40,90,160,0.35)'; ctx.lineWidth = 1;
      poly(L); ctx.stroke(); poly(R); ctx.stroke();
      // specular on top
      specular(ctx, 42, 30, 9, 4, 0.95, -0.45);
      caption(ctx, 'Wild', 91, theme === 'dark' ? '#f5f5f7' : '#1d1d1f');
    },

    /* Titanium torus — Bonus scatter */
    SCAT(ctx, theme) {
      contactShadow(ctx, 50, 83, 30, 6, theme === 'dark' ? 0.55 : 0.28);
      const cx = 50, cy = 50, R = 32, r = 15.5;
      // ring body: conic brushed if available
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
      ctx.clip('evenodd');
      let g;
      if (ctx.createConicGradient) {
        g = ctx.createConicGradient(-Math.PI / 2, cx, cy);
        const stops = [[0, '#d9d4cc'], [0.12, '#a8a29a'], [0.25, '#cfc9c1'], [0.4, '#8e8a85'], [0.55, '#c9c3bb'], [0.7, '#9b968f'], [0.85, '#e0dbd3'], [1, '#d9d4cc']];
        stops.forEach(([p, c]) => g.addColorStop(p, c));
      } else {
        g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
        g.addColorStop(0, '#d9d4cc'); g.addColorStop(0.5, '#9b968f'); g.addColorStop(1, '#cfc9c1');
      }
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
      radialBrush(ctx, cx, cy, r, R, 420, 0.07, 5);
      // top-left light / bottom-right dark
      g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
      ctx.restore();
      // bevels
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(cx, cy, R - 0.7, Math.PI * 0.9, Math.PI * 1.75); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, R - 0.7, Math.PI * -0.1, Math.PI * 0.75); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(cx, cy, r + 0.7, Math.PI * 0.9, Math.PI * 1.75); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(cx, cy, r + 0.7, Math.PI * -0.1, Math.PI * 0.75); ctx.stroke();
      // index dot in accent
      ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(cx, cy - (R + r) / 2, 3.2, 0, Math.PI * 2); ctx.fill();
      specular(ctx, cx, cy - (R + r) / 2, 4.5, 4.5, 0.5);
      caption(ctx, 'Bonus', 91, theme === 'dark' ? '#f5f5f7' : '#1d1d1f');
    },

    /* Sapphire camera lens */
    H1(ctx, theme) {
      contactShadow(ctx, 50, 84, 31, 6, theme === 'dark' ? 0.55 : 0.3);
      const cx = 50, cy = 49;
      // bezel
      let g = ctx.createLinearGradient(cx - 34, cy - 34, cx + 34, cy + 34);
      g.addColorStop(0, '#6c6c70'); g.addColorStop(0.5, '#2a2a2d'); g.addColorStop(1, '#4a4a4e');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill();
      // stepped rings
      const rings = [[31, '#1c1c1e'], [28.5, '#3a3a3d'], [27, '#141416'], [24.5, '#2c2c2f']];
      rings.forEach(([r, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); });
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(cx, cy, 30, Math.PI * 0.85, Math.PI * 1.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 26, Math.PI * 0.85, Math.PI * 1.7); ctx.stroke();
      // glass
      g = ctx.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, 23);
      g.addColorStop(0, '#2b3f7a'); g.addColorStop(0.45, '#101d45'); g.addColorStop(1, '#070c1c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 23, 0, Math.PI * 2); ctx.fill();
      // lens element reflections
      const refl = [[cx + 3, cy + 4, 14, 'rgba(106,90,205,0.35)'], [cx - 2, cy + 1, 9, 'rgba(58,120,220,0.45)'], [cx + 4, cy - 2, 5, 'rgba(150,120,255,0.5)']];
      refl.forEach(([x, y, r, c]) => { const gg = ctx.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, c); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
      // Fresnel rim
      g = ctx.createRadialGradient(cx, cy, 18, cx, cy, 23);
      g.addColorStop(0, 'rgba(120,160,255,0)'); g.addColorStop(1, 'rgba(120,160,255,0.35)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 23, 0, Math.PI * 2); ctx.fill();
      // specular arc at 10 o'clock
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 23, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, 19, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
      specular(ctx, cx - 9, cy - 10, 5, 3, 0.85, -0.6);
      specular(ctx, cx + 9, cy + 9, 3, 2, 0.35, -0.6);
      ctx.restore();
    },

    /* Titanium slab (squircle) */
    H2(ctx, theme) {
      contactShadow(ctx, 50, 85, 32, 6, theme === 'dark' ? 0.55 : 0.3);
      const x = 15, y = 14, w = 70, h = 70;
      ctx.save(); squircle(ctx, 50, 49, w, h, 4.6); ctx.clip();
      let g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, '#cfc9c1'); g.addColorStop(0.5, '#b9b3ab'); g.addColorStop(1, '#8e8a85');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      brushed(ctx, x, y, w, h, 320, 0.07, true, 3);
      // diagonal sheen
      g = ctx.createLinearGradient(x, y + h, x + w, y);
      g.addColorStop(0.3, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.32)'); g.addColorStop(0.7, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      // chamfers
      g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(255,255,255,0.6)'); g.addColorStop(0.08, 'rgba(255,255,255,0)'); g.addColorStop(0.92, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.restore();
      squircle(ctx, 50, 49, w - 1, h - 1, 4.6);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      squircle(ctx, 50, 49, w, h, 4.6);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8; ctx.stroke();
      specular(ctx, 34, 30, 10, 6, 0.35, -0.5);
    },

    /* Glossy white ceramic pebble */
    H3(ctx, theme) {
      contactShadow(ctx, 50, 84, 34, 7, theme === 'dark' ? 0.6 : 0.32);
      const w = 78, h = 64, cx = 50, cy = 50;
      ctx.save(); squircle(ctx, cx, cy, w, h, 3.6); ctx.clip();
      let g = ctx.createRadialGradient(cx - 18, cy - 22, 4, cx, cy, 52);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#f4f3ef'); g.addColorStop(1, '#d9d6cf');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
      // ambient occlusion at the bottom
      g = ctx.createLinearGradient(0, cy, 0, cy + h / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,80,70,0.28)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
      // broad soft reflection (window)
      g = ctx.createLinearGradient(cx - 30, cy - 30, cx + 10, cy + 20);
      g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(0.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
      // hard specular
      ctx.save(); ctx.translate(cx - 22, cy - 18); ctx.rotate(-0.55);
      g = ctx.createLinearGradient(-10, 0, 10, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; roundRect(ctx, -11, -2.2, 22, 4.4, 2.2); ctx.fill(); ctx.restore();
      // rim light bottom-right
      g = ctx.createRadialGradient(cx + 18, cy + 16, 10, cx + 18, cy + 16, 34);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.85, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.6)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
      ctx.restore();
      squircle(ctx, cx, cy, w, h, 3.6);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 0.8; ctx.stroke();
    },

    /* Polished steel mirror sphere */
    H4(ctx, theme) {
      contactShadow(ctx, 50, 85, 30, 6, theme === 'dark' ? 0.6 : 0.32);
      const cx = 50, cy = 49, r = 34;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      // sky (upper) and floor (lower), curved horizon
      let g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
      g.addColorStop(0, '#f2f4f7'); g.addColorStop(0.42, '#c9cdd3'); g.addColorStop(0.5, '#6e7176'); g.addColorStop(0.52, '#3f4145'); g.addColorStop(0.8, '#2a2b2e'); g.addColorStop(1, '#55585d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
      // curved horizon band
      g = ctx.createLinearGradient(0, cy - 4, 0, cy + 6);
      g.addColorStop(0, 'rgba(201,205,211,0)'); g.addColorStop(0.45, 'rgba(201,205,211,0.9)'); g.addColorStop(0.5, 'rgba(90,93,98,0.9)'); g.addColorStop(1, 'rgba(63,65,69,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy + 1, r + 4, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      // window reflection (soft rectangle)
      ctx.save(); ctx.translate(cx - 12, cy - 16); ctx.rotate(-0.35);
      g = ctx.createLinearGradient(-12, -8, 12, 8); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0.15)');
      ctx.fillStyle = g; roundRect(ctx, -12, -8, 24, 16, 5); ctx.fill(); ctx.restore();
      // Fresnel darkening at the rim
      g = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
      // floor bounce light at the bottom
      g = ctx.createRadialGradient(cx, cy + r, 2, cx, cy + r, r * 0.9);
      g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
      specular(ctx, cx - 14, cy - 15, 5, 3.5, 1, -0.5);
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.8; ctx.stroke();
    },
  };

  /* Anodised aluminium disc with an engraved glyph (four low symbols) */
  function disc(ctx, theme, spec) {
    contactShadow(ctx, 50, 85, 30, 6, theme === 'dark' ? 0.55 : 0.28);
    const cx = 50, cy = 49, r = 33;
    const base = spec.color;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    let g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, shade(base, 0.22)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -0.22));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    radialBrush(ctx, cx, cy, 4, r, 360, spec.color === '#e6e0d5' ? 0.035 : 0.055, 21);
    // subtle anisotropic sheen
    g = ctx.createLinearGradient(cx - r, cy + r, cx + r, cy - r);
    g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(0.65, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    ctx.restore();
    // chamfered edge: light top-left, dark bottom-right
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(cx, cy, r - 1.3, Math.PI * 0.85, Math.PI * 1.75); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(cx, cy, r - 1.3, Math.PI * -0.15, Math.PI * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.8; ctx.stroke();
    // engraved letter: dark cut with a light lower edge (embossed keycap look)
    const lightDisc = spec.color === '#e6e0d5' || spec.color === '#a3bfd9';
    const dark = lightDisc ? 'rgba(60,55,50,0.62)' : 'rgba(0,0,0,0.6)';
    const light = lightDisc ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.32)';
    const glyph = (fill, dy) => {
      ctx.save(); ctx.translate(cx, cy + dy + 1.5); ctx.fillStyle = fill;
      ctx.font = '600 40px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(spec.glyph, 0, 0); ctx.restore();
    };
    glyph(light, 1.1); glyph(dark, 0);
  }
  ['L1', 'L2', 'L3', 'L4'].forEach((id) => { painters[id] = (ctx, theme) => disc(ctx, theme, SYMBOLS[id]); });

  /* ---------- public API ---------- */
  const cache = new Map();
  function symbol(id, px, dpr, theme) {
    theme = theme || 'light';
    const key = id + '|' + px + '|' + theme;
    let c = cache.get(key);
    if (c) return c;
    c = makeCanvas(px);
    const ctx = c.getContext('2d');
    ctx.scale(px / 100, px / 100);
    ctx.lineJoin = 'round';
    const paint = painters[id];
    if (paint) paint(ctx, theme);
    cache.set(key, c);
    return c;
  }
  function colors(theme) { return COLORS[theme] || COLORS.light; }
  function clearCache() { cache.clear(); }

  root.SlotArt = { symbol, colors, clearCache, SYMBOLS, ACCENT, painters, util: { squircle, roundRect, contactShadow, specular } };
})(typeof self !== 'undefined' ? self : this);
