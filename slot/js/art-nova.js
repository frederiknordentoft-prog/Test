/* =========================================================================
   SlotArtNova — "Nova" skin: cosmic gem symbols, drawn procedurally.
   Same API as SlotArt: symbol(id, px, dpr, theme) → canvas, colors(theme).
   Faceted gems with bloom, a gold BAR, a ruby 7, a rainbow star (Wild)
   and a ringed planet (Bonus). Coordinate space 100 × 100.
   ========================================================================= */
(function (root) {
  'use strict';

  const COLORS = {
    dark: { well: '#0c0826', accent: '#3ee6ff', accent2: '#ff4fd8', gold: '#ffd166', scatter: '#7df9ff', ink: '#f4f2ff', sub: '#b8b0e0',
            line: ['#3ee6ff', '#ff4fd8', '#ffd166'], bloom: true, landFlash: true, wildPulse: true, idleSparkle: true },
  };
  COLORS.light = COLORS.dark;

  const SYMBOLS = {
    WILD: { name: 'Stjerne', caption: 'Wild', tier: 'wild' },
    SCAT: { name: 'Planet', caption: 'Bonus', tier: 'scatter' },
    H1: { name: 'BAR', tier: 'high', color: '#ffd166' },
    H2: { name: 'Syver', tier: 'high', color: '#ff3b5c' },
    H3: { name: 'Gul sten', tier: 'high', color: '#ffe14d', shape: 'diamond' },
    H4: { name: 'Grøn sten', tier: 'high', color: '#2ee59d', shape: 'hex' },
    L1: { name: 'Orange sten', tier: 'low', color: '#ff8c2a', shape: 'octagon' },
    L2: { name: 'Blå sten', tier: 'low', color: '#3b8bff', shape: 'oval' },
    L3: { name: 'Lilla sten', tier: 'low', color: '#b04cff', shape: 'triangle' },
    L4: { name: 'Pink sten', tier: 'low', color: '#ff4fa3', shape: 'pentagon' },
  };

  /* ---------- colour helpers ---------- */
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(hex, to, t) { const a = rgb(hex), b = typeof to === 'string' ? rgb(to) : to; return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(',')})`; }
  const light = (hex, t) => mix(hex, [255, 255, 255], t);
  const dark = (hex, t) => mix(hex, [0, 0, 0], t);
  function rgba(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }

  /* ---------- geometry ---------- */
  function polygon(n, cx, cy, r, rot) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return pts;
  }
  const SHAPES = {
    diamond: () => [[50, 10], [86, 50], [50, 90], [14, 50]],
    hex: () => polygon(6, 50, 50, 40, Math.PI / 6),
    octagon: () => polygon(8, 50, 50, 40, Math.PI / 8),
    pentagon: () => polygon(5, 50, 52, 40, -Math.PI / 2),
    triangle: () => [[50, 12], [88, 80], [12, 80]],
    oval: () => polygon(24, 50, 50, 40, 0),
  };
  function path(ctx, pts, round) {
    ctx.beginPath();
    if (!round) { pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); return; }
    // rounded polygon via arcTo
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[i], p1 = pts[(i + 1) % n], p2 = pts[(i + 2) % n];
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      ctx.arcTo(p1[0], p1[1], p2[0], p2[1], round);
    }
    ctx.closePath();
  }
  function scalePts(pts, k, cx, cy) { return pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]); }
  function centroid(pts) { let x = 0, y = 0; pts.forEach((p) => { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; }

  function bloom(ctx, cx, cy, r, hex, a) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, rgba(hex, a)); g.addColorStop(0.6, rgba(hex, a * 0.35)); g.addColorStop(1, rgba(hex, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  function glint(ctx, x, y, s, a) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.22 : s; const ang = (i / 8) * Math.PI * 2 - Math.PI / 2; const px = Math.cos(ang) * r, py = Math.sin(ang) * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /* ---------- faceted gem ---------- */
  function gem(ctx, spec) {
    const hex = spec.color, oval = spec.shape === 'oval';
    const pts = SHAPES[spec.shape]();
    const [cx, cy] = centroid(pts);
    const round = spec.shape === 'triangle' ? 6 : spec.shape === 'diamond' ? 3 : 0;
    // bloom behind
    bloom(ctx, cx, cy + 2, 52, hex, 0.5);
    // body
    ctx.save(); path(ctx, pts, round); ctx.clip();
    let g = ctx.createLinearGradient(15, 10, 85, 90);
    g.addColorStop(0, light(hex, 0.45)); g.addColorStop(0.45, hex); g.addColorStop(1, dark(hex, 0.55));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    if (oval) {
      // cabochon: smooth dome
      g = ctx.createRadialGradient(cx - 12, cy - 14, 2, cx, cy, 44);
      g.addColorStop(0, light(hex, 0.7)); g.addColorStop(0.35, light(hex, 0.15)); g.addColorStop(0.8, hex); g.addColorStop(1, dark(hex, 0.6));
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    } else {
      // crown facets: triangles from outer vertices to the table
      const table = scalePts(pts, 0.52, cx, cy - 2);
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n], c = table[(i + 1) % n], d = table[i];
        const ang = Math.atan2((a[1] + b[1]) / 2 - cy, (a[0] + b[0]) / 2 - cx);
        const lit = 0.5 + 0.5 * Math.cos(ang + Math.PI * 0.75); // key light from top-left
        ctx.fillStyle = lit > 0.5 ? `rgba(255,255,255,${(lit - 0.5) * 0.55})` : `rgba(0,0,0,${(0.5 - lit) * 0.45})`;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
        // facet edge lines
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
      }
      // table
      g = ctx.createLinearGradient(cx - 20, cy - 24, cx + 20, cy + 16);
      g.addColorStop(0, light(hex, 0.75)); g.addColorStop(0.5, light(hex, 0.25)); g.addColorStop(1, hex);
      ctx.fillStyle = g; path(ctx, table); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.9; ctx.stroke();
      // inner light
      g = ctx.createRadialGradient(cx - 10, cy - 12, 1, cx, cy, 30);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    }
    // bottom-right depth
    g = ctx.createLinearGradient(cx, cy, 90, 95);
    g.addColorStop(0.3, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    ctx.restore();
    // outline: light inner, dark outer
    path(ctx, pts, round); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'destination-over'; path(ctx, scalePts(pts, 1.04, cx, cy), round); ctx.fillStyle = dark(hex, 0.7); ctx.fill(); ctx.restore();
    // speculars
    ctx.save(); ctx.translate(cx - 14, cy - 18); ctx.rotate(-0.6);
    g = ctx.createLinearGradient(-9, 0, 9, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 10, 3.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    glint(ctx, cx + 16, cy + 14, 4.5, 0.85);
    glint(ctx, cx - 22, cy - 6, 2.5, 0.7);
  }

  /* ---------- BAR ---------- */
  function bar(ctx) {
    bloom(ctx, 50, 52, 54, '#ffd166', 0.45);
    const x = 10, y = 30, w = 80, h = 40, r = 9;
    const rr = (xx, yy, ww, hh, rad) => { ctx.beginPath(); ctx.moveTo(xx + rad, yy); ctx.arcTo(xx + ww, yy, xx + ww, yy + hh, rad); ctx.arcTo(xx + ww, yy + hh, xx, yy + hh, rad); ctx.arcTo(xx, yy + hh, xx, yy, rad); ctx.arcTo(xx, yy, xx + ww, yy, rad); ctx.closePath(); };
    // depth
    rr(x, y + 3, w, h, r); ctx.fillStyle = '#7a4c08'; ctx.fill();
    // gold body
    let g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#fff6c2'); g.addColorStop(0.28, '#ffd75e'); g.addColorStop(0.55, '#f0a800'); g.addColorStop(0.8, '#ffcd3c'); g.addColorStop(1, '#b57a10');
    rr(x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
    ctx.save(); rr(x, y, w, h, r); ctx.clip();
    g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0.5)'); g.addColorStop(0.55, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.restore();
    rr(x + 1, y + 1, w - 2, h - 2, r - 1); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    rr(x, y, w, h, r); ctx.strokeStyle = 'rgba(90,50,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    // text
    ctx.font = '900 27px "Rubik", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillText('BAR', 50, y + h / 2 + 2.2);
    g = ctx.createLinearGradient(0, y + 8, 0, y + h - 8); g.addColorStop(0, '#3a1f6e'); g.addColorStop(1, '#1b0f3d');
    ctx.fillStyle = g; ctx.fillText('BAR', 50, y + h / 2 + 1);
    glint(ctx, x + 12, y + 6, 4, 0.9);
  }

  /* ---------- Ruby seven ---------- */
  function seven(ctx) {
    bloom(ctx, 52, 52, 52, '#ff3b5c', 0.5);
    ctx.font = '900 78px "Rubik", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // extrusion
    for (let i = 6; i >= 1; i--) { ctx.fillStyle = i > 3 ? '#5a0016' : '#8a0024'; ctx.fillText('7', 50 + i * 0.7, 54 + i * 0.9); }
    // face
    let g = ctx.createLinearGradient(0, 18, 0, 92);
    g.addColorStop(0, '#ff8fa3'); g.addColorStop(0.35, '#ff3b5c'); g.addColorStop(0.7, '#d1163a'); g.addColorStop(1, '#8f0a26');
    ctx.fillStyle = g; ctx.fillText('7', 50, 54);
    // glass highlight (upper half)
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 100, 50); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fillText('7', 50, 54); ctx.restore();
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.strokeText('7', 50, 54);
    glint(ctx, 35, 24, 5, 0.95); glint(ctx, 60, 70, 3, 0.7);
  }

  /* ---------- Rainbow star (Wild) ---------- */
  function star(ctx) {
    const cx = 50, cy = 46;
    ['#3ee6ff', '#ff4fd8', '#ffd166'].forEach((c, i) => bloom(ctx, cx + (i - 1) * 6, cy, 54, c, 0.28));
    const pts = [];
    for (let i = 0; i < 16; i++) { const r = i % 2 ? 19 : 40; const a = (i / 16) * Math.PI * 2 - Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    ctx.save(); path(ctx, pts, 2); ctx.clip();
    let g;
    if (ctx.createConicGradient) {
      g = ctx.createConicGradient(-Math.PI / 2, cx, cy);
      [['#ff4fd8', 0], ['#ff8c2a', 0.16], ['#ffe14d', 0.33], ['#2ee59d', 0.5], ['#3ee6ff', 0.66], ['#7b61ff', 0.83], ['#ff4fd8', 1]].forEach(([c, p]) => g.addColorStop(p, c));
    } else { g = ctx.createLinearGradient(10, 10, 90, 90); g.addColorStop(0, '#ff4fd8'); g.addColorStop(0.5, '#ffe14d'); g.addColorStop(1, '#3ee6ff'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    // facets: alternate light/dark wedges
    for (let i = 0; i < 16; i++) {
      const a = pts[i], b = pts[(i + 1) % 16];
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill();
    }
    // white core
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    ctx.restore();
    path(ctx, pts, 2); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.3; ctx.stroke();
    glint(ctx, cx - 12, cy - 14, 5, 1);
    captionPill(ctx, 'WILD', 88);
  }

  /* ---------- Ringed planet (Bonus) ---------- */
  function planet(ctx) {
    const cx = 50, cy = 46;
    bloom(ctx, cx, cy, 54, '#7df9ff', 0.4);
    // back half of the ring
    const ring = (front) => {
      ctx.save(); ctx.translate(cx, cy + 2); ctx.rotate(-0.42);
      ctx.beginPath(); ctx.ellipse(0, 0, 46, 13, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      const g = ctx.createLinearGradient(-46, 0, 46, 0);
      g.addColorStop(0, 'rgba(125,249,255,0)'); g.addColorStop(0.2, 'rgba(125,249,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(0.8, 'rgba(255,79,216,0.9)'); g.addColorStop(1, 'rgba(255,79,216,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 46, 13, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    };
    ring(false);
    // sphere
    let g = ctx.createRadialGradient(cx - 9, cy - 10, 2, cx, cy, 27);
    g.addColorStop(0, '#dffcff'); g.addColorStop(0.3, '#6fd6ff'); g.addColorStop(0.7, '#5a3bff'); g.addColorStop(1, '#1a0b4a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
    // bands
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.clip();
    for (let i = -2; i <= 2; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(cx, cy + i * 9, 30, 3.2, -0.42, 0, Math.PI * 2); ctx.fill(); }
    g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 26); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    ctx.restore();
    ring(true);
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    glint(ctx, cx - 10, cy - 12, 4.5, 0.95);
    captionPill(ctx, 'BONUS', 88);
  }

  function captionPill(ctx, text, y) {
    ctx.save();
    ctx.font = '800 9.5px "Rubik", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(8,4,28,0.82)';
    ctx.beginPath(); ctx.moveTo(50 - w / 2 + 6, y - 7); ctx.arcTo(50 + w / 2, y - 7, 50 + w / 2, y + 7, 7); ctx.arcTo(50 + w / 2, y + 7, 50 - w / 2, y + 7, 7); ctx.arcTo(50 - w / 2, y + 7, 50 - w / 2, y - 7, 7); ctx.arcTo(50 - w / 2, y - 7, 50 + w / 2, y - 7, 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillText(text, 50, y + 0.5);
    ctx.restore();
  }

  const painters = {
    WILD: (ctx) => star(ctx),
    SCAT: (ctx) => planet(ctx),
    H1: (ctx) => bar(ctx),
    H2: (ctx) => seven(ctx),
  };
  ['H3', 'H4', 'L1', 'L2', 'L3', 'L4'].forEach((id) => { painters[id] = (ctx) => gem(ctx, SYMBOLS[id]); });

  /* ---------- public API ---------- */
  const cache = new Map();
  function symbol(id, px, dpr, theme) {
    const key = id + '|' + px;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = px; c.height = px;
    const ctx = c.getContext('2d');
    ctx.scale(px / 100, px / 100);
    ctx.lineJoin = 'round';
    const paint = painters[id];
    if (paint) paint(ctx);
    cache.set(key, c);
    return c;
  }
  function colors(theme) { return COLORS.dark; }
  function clearCache() { cache.clear(); }

  root.SlotArtNova = { symbol, colors, clearCache, SYMBOLS, ACCENT: '#3ee6ff', painters };
})(typeof self !== 'undefined' ? self : this);
