/* LYSBRUD — hjulets geometri og tegning.
   Vinkel 0 = klokken 12, voksende med uret.
   Skærmposition:  x = cx + r·sin(a),  y = cy − r·cos(a)                     */

import { GEOM, PALETTE, RING_COUNT, SYMBOL_BY_ID } from './config.js';
import { buildSymbolAtlas, drawSymbol } from './art/symbols.js';

const TAU = Math.PI * 2;

/* ------------------------------------------------------------- geometri */

export function computeLayout(width, height) {
  // Hjulet skal have luft til sidepanelerne og hint-teksten.
  const R = Math.max(120, Math.min(width * 0.44, height * 0.485));
  return {
    cx: width / 2,
    cy: height * 0.5,
    R,
    ringIn:  GEOM.rails.slice(0, RING_COUNT).map(f => f * R),
    ringOut: GEOM.rails.slice(1).map(f => f * R),
    ringMid: GEOM.rails.slice(0, RING_COUNT).map((f, i) => (f + GEOM.rails[i + 1]) / 2 * R),
    step:    GEOM.cells.map(n => TAU / n),
    core:    GEOM.coreRadius * R,
    rim:     GEOM.outerRim * R,
  };
}

/** Cellens midtpunkt i skærmkoordinater. */
export function cellPoint(layout, offsets, r, i) {
  const a = offsets[r] + (i + 0.5) * layout.step[r];
  const rad = layout.ringMid[r];
  return { x: layout.cx + rad * Math.sin(a), y: layout.cy - rad * Math.cos(a), a, rad };
}

/** Punkt på vilkårlig radius/vinkel. */
export function polar(layout, a, rad) {
  return { x: layout.cx + rad * Math.sin(a), y: layout.cy - rad * Math.cos(a) };
}

/* --------------------------------------------------------- celle-sprites
   Én trapez-plade pr. ring, tegnet opret (klokken 12) og stemplet n gange. */

function buildCellSprite(ring, layout, dpr, variant) {
  const rIn = layout.ringIn[ring], rOut = layout.ringOut[ring];
  const half = layout.step[ring] / 2;
  const pad = 3;
  const w = 2 * rOut * Math.sin(half) + pad * 2;
  const h = rOut - rIn * Math.cos(half) + pad * 2;

  const c = document.createElement('canvas');
  c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  // Lokal oprindelse = hjulets centrum, forskudt så sektoren ligger i lærredet.
  const ox = w / 2, oy = rOut + pad;
  g.translate(ox, oy);

  const path = new Path2D();
  path.arc(0, 0, rOut, -Math.PI / 2 - half, -Math.PI / 2 + half);
  path.arc(0, 0, rIn, -Math.PI / 2 + half, -Math.PI / 2 - half, true);
  path.closePath();

  g.save();
  g.clip(path);

  // Grundflade: mørk navy, en anelse lysere mod centrum.
  const base = g.createLinearGradient(0, -rOut, 0, -rIn);
  const dark = variant ? '#0b0e2a' : PALETTE.cellDark;
  const lite = variant ? '#141943' : PALETTE.cellLight;
  base.addColorStop(0, dark);
  base.addColorStop(0.55, lite);
  base.addColorStop(1, dark);
  g.fillStyle = base;
  g.fillRect(-w, -rOut - pad, w * 2, h + pad * 2);

  // Blødt skær fra hjulets midte.
  const sheen = g.createRadialGradient(0, 0, rIn * 0.9, 0, 0, rOut * 1.05);
  sheen.addColorStop(0, 'rgba(120,110,255,0.16)');
  sheen.addColorStop(1, 'rgba(10,8,40,0)');
  g.fillStyle = sheen;
  g.fillRect(-w, -rOut - pad, w * 2, h + pad * 2);

  // Indvendig skygge langs alle fire kanter.
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 3.2;
  g.stroke(path);

  g.restore();

  // Guldkant: lys på den ene side, mørk på den anden — giver facet.
  const edge = (sign, color, width) => {
    g.beginPath();
    const a0 = -Math.PI / 2 + sign * half;
    g.moveTo(rIn * Math.cos(a0), rIn * Math.sin(a0));
    g.lineTo(rOut * Math.cos(a0), rOut * Math.sin(a0));
    g.strokeStyle = color; g.lineWidth = width; g.stroke();
  };
  edge(-1, 'rgba(212,170,80,0.55)', 1.5);
  edge( 1, 'rgba(24,16,6,0.75)', 1.5);

  return { canvas: c, w, h, ox, oy, rOut };
}

/* ---------------------------------------------------------- statisk ramme
   Guldskinner, ydre rand og prismekammerets kant. Roterer ikke.            */

function goldStroke(g, cx, cy, radius, width, bright = 1) {
  const grad = g.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0.00, shade(PALETTE.gold1, bright));
  grad.addColorStop(0.22, shade(PALETTE.gold3, bright));
  grad.addColorStop(0.45, shade(PALETTE.gold2, bright));
  grad.addColorStop(0.62, shade(PALETTE.gold4, bright));
  grad.addColorStop(0.80, shade(PALETTE.gold1, bright));
  grad.addColorStop(1.00, shade(PALETTE.gold2, bright));
  g.beginPath(); g.arc(cx, cy, radius, 0, TAU);
  g.strokeStyle = grad; g.lineWidth = width; g.stroke();
}

function shade(hex, k) {
  if (k === 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const gg = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${gg},${b})`;
}

function buildFrame(layout, dpr) {
  const size = Math.ceil(layout.rim * 2 + 24);
  const c = document.createElement('canvas');
  c.width = Math.ceil(size * dpr); c.height = Math.ceil(size * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const cx = size / 2, cy = size / 2;

  // Ydre dekorationsrand med rille.
  goldStroke(g, cx, cy, layout.rim, 7);
  g.beginPath(); g.arc(cx, cy, layout.rim, 0, TAU);
  g.strokeStyle = 'rgba(20,12,4,0.7)'; g.lineWidth = 1.6; g.stroke();
  goldStroke(g, cx, cy, layout.rim - 6.5, 2.2, 0.8);

  // Skinner mellem ringene.
  for (let k = 0; k < layout.ringIn.length + 1; k++) {
    const rad = k < layout.ringIn.length ? layout.ringIn[k] : layout.ringOut[layout.ringOut.length - 1];
    const outer = k === layout.ringIn.length;
    goldStroke(g, cx, cy, rad, outer ? 6 : 4.5);
    g.beginPath(); g.arc(cx, cy, rad + (outer ? 3.6 : 2.8), 0, TAU);
    g.strokeStyle = 'rgba(18,12,4,0.66)'; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.arc(cx, cy, rad - (outer ? 3.6 : 2.8), 0, TAU);
    g.strokeStyle = 'rgba(255,238,190,0.20)'; g.lineWidth = 1; g.stroke();
  }

  // Nitter på yderranden.
  const rivets = 48;
  for (let k = 0; k < rivets; k++) {
    const a = (k / rivets) * TAU;
    const x = cx + (layout.rim - 3.2) * Math.sin(a);
    const y = cy - (layout.rim - 3.2) * Math.cos(a);
    g.beginPath(); g.arc(x, y, 1.5, 0, TAU);
    g.fillStyle = 'rgba(255,240,200,0.55)'; g.fill();
  }

  return { canvas: c, size, cx, cy };
}

/* ---------------------------------------------------- prismekammer + kerne */

function drawCoreChamber(g, layout, t, energy, tint) {
  const { cx, cy } = layout;
  const rc = layout.core;

  g.save();
  // Kammerets bund.
  const bg = g.createRadialGradient(cx, cy, rc * 0.1, cx, cy, rc);
  bg.addColorStop(0, 'rgba(40,26,96,0.95)');
  bg.addColorStop(0.7, 'rgba(12,10,44,0.98)');
  bg.addColorStop(1, 'rgba(6,5,24,1)');
  g.beginPath(); g.arc(cx, cy, rc, 0, TAU); g.fillStyle = bg; g.fill();

  // Guldfiligran: to modroterende spindelvæv.
  for (const [dir, alpha, arms] of [[1, 0.42, 8], [-1, 0.24, 12]]) {
    g.save();
    g.translate(cx, cy); g.rotate(dir * t * 0.00006 * (1 + energy));
    g.strokeStyle = `rgba(214,172,86,${alpha})`;
    g.lineWidth = 1.1;
    for (let k = 0; k < arms; k++) {
      const a = (k / arms) * TAU;
      g.beginPath();
      g.moveTo(Math.sin(a) * rc * 0.32, -Math.cos(a) * rc * 0.32);
      g.lineTo(Math.sin(a) * rc * 0.99, -Math.cos(a) * rc * 0.99);
      g.stroke();
    }
    for (let ringK = 1; ringK <= 3; ringK++) {
      const rr = rc * (0.42 + ringK * 0.19);
      g.beginPath();
      for (let k = 0; k <= arms; k++) {
        const a = (k / arms) * TAU;
        const px = Math.sin(a) * rr, py = -Math.cos(a) * rr;
        if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    }
    g.restore();
  }
  g.restore();
}

function drawPrismCore(g, layout, t, energy, tint) {
  const { cx, cy } = layout;
  const s = layout.core * 0.78;
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.0016);
  const lift = 1 + 0.03 * Math.sin(t * 0.0011);

  g.save();
  g.translate(cx, cy + Math.sin(t * 0.0009) * s * 0.02);
  g.scale(lift, lift);

  // Halo.
  g.globalCompositeOperation = 'lighter';
  const halo = g.createRadialGradient(0, 0, s * 0.15, 0, 0, s * (1.7 + energy * 0.8));
  const hc = tint || '#8fa8ff';
  halo.addColorStop(0, withAlpha(hc, 0.55 + 0.2 * pulse + energy * 0.25));
  halo.addColorStop(0.45, withAlpha(hc, 0.16 + energy * 0.14));
  halo.addColorStop(1, withAlpha(hc, 0));
  g.beginPath(); g.arc(0, 0, s * (1.7 + energy * 0.8), 0, TAU);
  g.fillStyle = halo; g.fill();
  g.globalCompositeOperation = 'source-over';

  // Oktaeder: øvre og nedre pyramide, seks facetter.
  const w = s * 0.82, hTop = s * 0.98, hBot = s * 1.06;
  const facets = [
    // [x0,y0, x1,y1, x2,y2, farve]
    [0, -hTop,  -w, 0,  -w * 0.34, -hTop * 0.18, '#cfe0ff'],
    [0, -hTop,  -w * 0.34, -hTop * 0.18,  w * 0.34, -hTop * 0.18, '#eaf2ff'],
    [0, -hTop,   w * 0.34, -hTop * 0.18,  w, 0, '#9db6ff'],
    [-w, 0,     -w * 0.34, -hTop * 0.18,  0, hBot, '#6f5cf0'],
    [-w * 0.34, -hTop * 0.18,  w * 0.34, -hTop * 0.18, 0, hBot, '#8b74ff'],
    [w * 0.34,  -hTop * 0.18,  w, 0,      0, hBot, '#4e39c8'],
  ];
  for (const [x0, y0, x1, y1, x2, y2, col] of facets) {
    const grad = g.createLinearGradient(x0, y0, x2, y2);
    grad.addColorStop(0, col);
    grad.addColorStop(1, mix(col, '#1b1350', 0.55));
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath();
    g.fillStyle = grad; g.fill();
  }

  // Facetkanter.
  g.strokeStyle = `rgba(233,242,255,${0.5 + 0.25 * pulse})`;
  g.lineWidth = 1.15;
  g.beginPath();
  g.moveTo(0, -hTop); g.lineTo(-w, 0); g.lineTo(0, hBot); g.lineTo(w, 0); g.closePath();
  g.moveTo(-w, 0); g.lineTo(w, 0);
  g.moveTo(0, -hTop); g.lineTo(-w * 0.34, -hTop * 0.18); g.lineTo(0, hBot);
  g.moveTo(0, -hTop); g.lineTo(w * 0.34, -hTop * 0.18); g.lineTo(0, hBot);
  g.stroke();

  // Indre glød.
  g.globalCompositeOperation = 'lighter';
  const inner = g.createRadialGradient(0, -s * 0.1, 0, 0, -s * 0.1, s * 0.9);
  inner.addColorStop(0, `rgba(255,255,255,${0.35 + 0.3 * pulse + energy * 0.3})`);
  inner.addColorStop(1, 'rgba(255,255,255,0)');
  g.beginPath(); g.arc(0, -s * 0.1, s * 0.9, 0, TAU);
  g.fillStyle = inner; g.fill();
  g.restore();
}

/* ----------------------------------------------------------- farvehjælp */

export function withAlpha(hex, a) {
  if (hex.startsWith('rgb')) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mix(a, b, k) {
  const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
  const r = Math.round(((na >> 16) & 255) * (1 - k) + ((nb >> 16) & 255) * k);
  const g = Math.round(((na >> 8) & 255) * (1 - k) + ((nb >> 8) & 255) * k);
  const bl = Math.round((na & 255) * (1 - k) + (nb & 255) * k);
  return `rgb(${r},${g},${bl})`;
}

/* -------------------------------------------------------------- renderer */

export function createWheelRenderer() {
  let layout = null, dpr = 1;
  let cellSprites = [];       // [ring] → {a, b} to varianter for skiftende celler
  let frame = null;
  let atlas = null;
  let symbolSize = [];

  /* Per-celle visuel tilstand — forudallokeret, muteres af spillogikken. */
  const style = GEOM.cells.map(n => Array.from({ length: n }, () => ({
    alpha: 1, scale: 1, glow: 0, dim: 0, spin: 0, lift: 0,
  })));

  function resize(w, h, ratio) {
    dpr = ratio;
    layout = computeLayout(w, h);
    frame = buildFrame(layout, dpr);
    cellSprites = [];
    symbolSize = [];
    for (let r = 0; r < RING_COUNT; r++) {
      cellSprites.push({
        a: buildCellSprite(r, layout, dpr, false),
        b: buildCellSprite(r, layout, dpr, true),
      });
      const arc = layout.ringMid[r] * layout.step[r];
      const thick = layout.ringOut[r] - layout.ringIn[r];
      symbolSize.push(Math.min(arc, thick) * 0.96);
    }
    atlas = buildSymbolAtlas(symbolSize, dpr);
    return layout;
  }

  function resetStyles() {
    for (const ring of style) {
      for (const s of ring) { s.alpha = 1; s.scale = 1; s.glow = 0; s.dim = 0; s.lift = 0; }
    }
  }

  function styleAt(r, i) { return style[r][i]; }

  /** Tegner ringenes plader. Kaldes før symbolerne. */
  function drawPlates(g, offsets) {
    for (let r = 0; r < RING_COUNT; r++) {
      const n = GEOM.cells[r], step = layout.step[r];
      const sp = cellSprites[r];
      for (let i = 0; i < n; i++) {
        const a = offsets[r] + (i + 0.5) * step;
        const s = style[r][i];
        const spr = (i % 2 === 0) ? sp.a : sp.b;
        g.save();
        g.translate(layout.cx, layout.cy);
        g.rotate(a);
        if (s.dim > 0) g.globalAlpha = 1 - s.dim * 0.45;
        g.drawImage(spr.canvas, -spr.ox, -spr.oy, spr.w, spr.h);
        g.restore();
      }
    }
  }

  /** Tegner symbolerne oven på pladerne. blur = tangential sløring 0..1. */
  function drawSymbols(g, board, blurPerRing) {
    for (let r = 0; r < RING_COUNT; r++) {
      const n = GEOM.cells[r], step = layout.step[r];
      const rad = layout.ringMid[r];
      const size = symbolSize[r];
      const blur = blurPerRing ? blurPerRing[r] : 0;
      for (let i = 0; i < n; i++) {
        const s = style[r][i];
        if (s.alpha <= 0.01) continue;
        const id = board.grid[r][i];
        const a = board.offsets[r] + (i + 0.5) * step;
        const drawOne = (aa, alpha) => {
          g.save();
          g.translate(layout.cx, layout.cy);
          g.rotate(aa);
          g.translate(0, -(rad + s.lift));
          if (s.scale !== 1) g.scale(s.scale, s.scale);
          g.globalAlpha = alpha * (s.dim > 0 ? 1 - s.dim * 0.72 : 1);

          const mult = board.wildMult[r][i];
          if (id === 'wild' && mult > 1) {
            drawSymbol(g, 'wild', 0, 0, size, { glow: 1 + s.glow, wildMult: mult });
          } else {
            const spr = atlas.get(id, r);
            if (spr) g.drawImage(spr, -size / 2, -size / 2, size, size);
            else drawSymbol(g, id, 0, 0, size, { glow: 1 + s.glow });
          }

          if (s.glow > 0) {
            g.globalCompositeOperation = 'lighter';
            const def = SYMBOL_BY_ID[id];
            const halo = g.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 0.85);
            halo.addColorStop(0, withAlpha(def ? def.glow : '#ffffff', 0.55 * s.glow));
            halo.addColorStop(1, withAlpha(def ? def.glow : '#ffffff', 0));
            g.beginPath(); g.arc(0, 0, size * 0.85, 0, TAU);
            g.fillStyle = halo; g.fill();
          }
          g.restore();
        };

        if (blur > 0.02) {
          const spread = blur * step * 0.42;
          drawOne(a - spread, s.alpha * 0.30);
          drawOne(a + spread, s.alpha * 0.30);
          drawOne(a, s.alpha * 0.72);
        } else {
          drawOne(a, s.alpha);
        }
      }
    }
  }

  function drawFrame(g) {
    g.drawImage(frame.canvas, layout.cx - frame.cx, layout.cy - frame.cy, frame.size, frame.size);
  }

  function drawCore(g, t, energy, tint) {
    drawCoreChamber(g, layout, t, energy, tint);
    drawPrismCore(g, layout, t, energy, tint);
  }

  return {
    resize, resetStyles, styleAt,
    drawPlates, drawSymbols, drawFrame, drawCore,
    get layout() { return layout; },
    get symbolSize() { return symbolSize; },
    point: (offsets, r, i) => cellPoint(layout, offsets, r, i),
    polarPoint: (a, rad) => polar(layout, a, rad),
  };
}
