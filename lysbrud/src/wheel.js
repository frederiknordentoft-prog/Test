/* LYSBRUD — hjulets geometri og tegning.
   Vinkel 0 = klokken 12, voksende med uret.
   Skærmposition:  x = cx + r·sin(a),  y = cy − r·cos(a)                     */

import { GEOM, PALETTE, RING_COUNT, SYMBOL_BY_ID } from './config.js';
import { buildSymbolAtlas, drawSymbol } from './art/symbols.js';

const TAU = Math.PI * 2;

/* ------------------------------------------------------------- geometri */

export function computeLayout(width, height) {
  // Hjulet må aldrig beskæres: det er YDERRANDEN (outerRim · R), ikke R selv,
  // der skal kunne være i scenen. Der reserveres plads til hint-teksten
  // under hjulet og en smule luft i siderne.
  const padX = width > 900 ? 30 : 12;
  const padTop = 14;
  const padBottom = height > 620 ? 40 : 24;
  const cy = height / 2 - (padBottom - padTop) / 2;
  const rimMax = Math.min(width / 2 - padX, cy - padTop, height - padBottom - cy);
  const R = Math.max(110, rimMax / GEOM.outerRim);
  return {
    cx: width / 2,
    cy,
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

  // Grundflade: dyb, ret ensartet navy — mockuppens celler er flade, ikke vignetterede.
  const base = g.createLinearGradient(0, -rOut, 0, -rIn);
  const outerC = variant ? '#0f1338' : '#111641';
  const midC   = variant ? '#171d4e' : '#1a2158';
  const innerC = variant ? '#0d1130' : '#0f1438';
  base.addColorStop(0.00, outerC);
  base.addColorStop(0.46, midC);
  base.addColorStop(1.00, innerC);
  g.fillStyle = base;
  g.fillRect(-w, -rOut - pad, w * 2, h + pad * 2);

  // Lys ovenfra-venstre, som resten af scenen.
  const key = g.createLinearGradient(-w * 0.5, -rOut, w * 0.5, -rIn);
  key.addColorStop(0, 'rgba(160,160,255,0.10)');
  key.addColorStop(0.55, 'rgba(90,80,200,0.03)');
  key.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = key;
  g.fillRect(-w, -rOut - pad, w * 2, h + pad * 2);

  // Blødt skær ud fra prismen i midten.
  const sheen = g.createRadialGradient(0, 0, rIn * 0.85, 0, 0, rOut * 1.06);
  sheen.addColorStop(0, 'rgba(126,104,255,0.14)');
  sheen.addColorStop(1, 'rgba(10,8,40,0)');
  g.fillStyle = sheen;
  g.fillRect(-w, -rOut - pad, w * 2, h + pad * 2);

  // Let indvendig skygge — nok til at cellen læses som en plade, ikke mere.
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 3.0;
  g.stroke(path);

  g.restore();

  // Guldstreger mellem cellerne — i mockuppen er skillelinjerne tydeligt gyldne.
  const edge = (sign, color, width, inset) => {
    g.beginPath();
    const a0 = -Math.PI / 2 + sign * (half - inset);
    g.moveTo(rIn * Math.cos(a0), rIn * Math.sin(a0));
    g.lineTo(rOut * Math.cos(a0), rOut * Math.sin(a0));
    g.strokeStyle = color; g.lineWidth = width; g.stroke();
  };
  for (const sign of [-1, 1]) {
    edge(sign, 'rgba(10,7,2,0.75)', 3.0, 0);
    edge(sign, 'rgba(222,180,86,0.95)', 1.9, 0);
    edge(sign, 'rgba(255,240,196,0.35)', 0.7, half * 0.035 * -sign);
  }

  // Tynde buer langs cellens inder- og yderkant, så trapezen læses som en plade.
  g.beginPath();
  g.arc(0, 0, rOut - 1.4, -Math.PI / 2 - half * 0.9, -Math.PI / 2 + half * 0.9);
  g.strokeStyle = 'rgba(170,160,255,0.13)'; g.lineWidth = 1.0; g.stroke();

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

/** Én guldskinne: mørk fals, metallisk krop, lys top og mørk underkant.
 *  Det er de fire lag der gør at den læses som støbt metal og ikke som en streg. */
function goldRail(g, cx, cy, radius, weight) {
  const w = weight;
  // fals/skygge udenom
  g.beginPath(); g.arc(cx, cy, radius, 0, TAU);
  g.strokeStyle = 'rgba(4,3,12,0.85)'; g.lineWidth = w + 3.2; g.stroke();
  // metalkroppen
  goldStroke(g, cx, cy, radius, w);
  // lys kant mod lyskilden (øverst til venstre), mørk kant modsat
  g.beginPath(); g.arc(cx, cy, radius - w * 0.34, 0, TAU);
  g.strokeStyle = 'rgba(255,244,206,0.42)'; g.lineWidth = Math.max(0.8, w * 0.24); g.stroke();
  g.beginPath(); g.arc(cx, cy, radius + w * 0.36, 0, TAU);
  g.strokeStyle = 'rgba(38,24,6,0.72)'; g.lineWidth = Math.max(0.8, w * 0.26); g.stroke();
  // højlys-bue øverst til venstre
  g.beginPath(); g.arc(cx, cy, radius, Math.PI * 0.92, Math.PI * 1.62);
  g.strokeStyle = 'rgba(255,250,226,0.5)'; g.lineWidth = Math.max(0.9, w * 0.3); g.stroke();
}

function buildFrame(layout, dpr) {
  const size = Math.ceil(layout.rim * 2 + 30);
  const c = document.createElement('canvas');
  c.width = Math.ceil(size * dpr); c.height = Math.ceil(size * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const cx = size / 2, cy = size / 2;
  const unit = layout.R / 355;                 // skala målt fra mockuppen

  // Ydre dekorationsrand: tyk hovedring, rille, tynd yderring.
  goldRail(g, cx, cy, layout.rim, 9 * unit);
  g.beginPath(); g.arc(cx, cy, layout.rim - 7.5 * unit, 0, TAU);
  g.strokeStyle = 'rgba(10,7,2,0.8)'; g.lineWidth = 2.4 * unit; g.stroke();
  goldRail(g, cx, cy, layout.rim - 11.5 * unit, 3 * unit);

  // Skinner mellem ringene — den yderste er kraftigst.
  const rails = layout.ringIn.concat([layout.ringOut[layout.ringOut.length - 1]]);
  for (let k = 0; k < rails.length; k++) {
    const outer = k === rails.length - 1;
    goldRail(g, cx, cy, rails[k], (outer ? 7.5 : 5.4) * unit);
    // tynd akkompagnerende skinne, som i mockuppen
    goldRail(g, cx, cy, rails[k] + (outer ? 6.5 : 5.0) * unit, 1.6 * unit);
  }

  // Nitter på yderranden.
  const rivets = 56;
  for (let k = 0; k < rivets; k++) {
    const a = (k / rivets) * TAU;
    const x = cx + (layout.rim - 0.4 * unit) * Math.sin(a);
    const y = cy - (layout.rim - 0.4 * unit) * Math.cos(a);
    const rr = 2.1 * unit;
    const gr = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 0, x, y, rr);
    gr.addColorStop(0, 'rgba(255,250,220,0.95)');
    gr.addColorStop(0.6, 'rgba(210,166,70,0.8)');
    gr.addColorStop(1, 'rgba(60,40,10,0.5)');
    g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fillStyle = gr; g.fill();
  }

  return { canvas: c, size, cx, cy };
}

/* ---------------------------------------------------- prismekammer + kerne */

function drawCoreChamber(g, layout, t, energy, tint) {
  const { cx, cy } = layout;
  const rc = layout.core;

  g.save();
  // Kammerets bund — dyb violet, mørkest ved kanten.
  const bg = g.createRadialGradient(cx, cy - rc * 0.12, rc * 0.08, cx, cy, rc);
  bg.addColorStop(0, 'rgba(58,38,124,0.98)');
  bg.addColorStop(0.55, 'rgba(20,14,62,0.99)');
  bg.addColorStop(1, 'rgba(5,4,20,1)');
  g.beginPath(); g.arc(cx, cy, rc, 0, TAU); g.fillStyle = bg; g.fill();

  // Guldfiligran: to modroterende spindelvæv, som i mockuppen.
  g.save();
  g.beginPath(); g.arc(cx, cy, rc * 0.995, 0, TAU); g.clip();
  const webs = [
    { dir:  1, arms: 8,  alpha: 0.72, width: 1.8, from: 0.26, to: 1.02, rings: [0.42, 0.62, 0.84] },
    { dir: -1, arms: 12, alpha: 0.38, width: 1.2, from: 0.40, to: 1.02, rings: [0.54, 0.76] },
  ];
  for (const wcfg of webs) {
    g.save();
    g.translate(cx, cy);
    g.rotate(wcfg.dir * t * 0.00007 * (1 + energy * 2));
    g.strokeStyle = `rgba(226,184,96,${wcfg.alpha})`;
    g.lineWidth = wcfg.width;
    g.lineJoin = 'round';
    for (let k = 0; k < wcfg.arms; k++) {
      const a = (k / wcfg.arms) * TAU;
      g.beginPath();
      g.moveTo(Math.sin(a) * rc * wcfg.from, -Math.cos(a) * rc * wcfg.from);
      g.lineTo(Math.sin(a) * rc * wcfg.to,   -Math.cos(a) * rc * wcfg.to);
      g.stroke();
    }
    // Buede tværtråde, så nettet hænger som spind og ikke som et gitter.
    for (const rr of wcfg.rings) {
      g.beginPath();
      for (let k = 0; k <= wcfg.arms; k++) {
        const a = (k / wcfg.arms) * TAU;
        const an = ((k + 1) / wcfg.arms) * TAU;
        const px = Math.sin(a) * rc * rr, py = -Math.cos(a) * rc * rr;
        const mx = Math.sin((a + an) / 2) * rc * rr * 0.86;
        const my = -Math.cos((a + an) / 2) * rc * rr * 0.86;
        const nx = Math.sin(an) * rc * rr, ny = -Math.cos(an) * rc * rr;
        if (k === 0) g.moveTo(px, py);
        g.quadraticCurveTo(mx, my, nx, ny);
      }
      g.stroke();
    }
    g.restore();
  }
  g.restore();

  // Indvendig skygge langs kammerets kant.
  g.beginPath(); g.arc(cx, cy, rc - 2, 0, TAU);
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 4; g.stroke();
  g.restore();
}

function drawPrismCore(g, layout, t, energy, tint) {
  const { cx, cy } = layout;
  const rc = layout.core;
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.0016);
  const breathe = 1 + 0.022 * Math.sin(t * 0.0011);

  // Oktaeder målt af mockuppen: bredde ≈ 0,72·rc, højde ≈ 0,88·rc pr. halvdel.
  const w = rc * 0.80 * breathe;
  const hTop = rc * 0.90 * breathe;
  const hBot = rc * 0.97 * breathe;
  const shoulder = -hTop * 0.20;              // hvor de øvre facetter mødes
  const inner = w * 0.36;

  g.save();
  g.translate(cx, cy + Math.sin(t * 0.0009) * rc * 0.018);

  // Halo — holdes dæmpet, ellers æder den facetterne.
  g.globalCompositeOperation = 'lighter';
  const hc = tint || '#8fa8ff';
  const hr = rc * (1.15 + energy * 0.5);
  const halo = g.createRadialGradient(0, 0, rc * 0.2, 0, 0, hr);
  halo.addColorStop(0, withAlpha(hc, 0.26 + 0.10 * pulse + energy * 0.22));
  halo.addColorStop(0.5, withAlpha(hc, 0.10 + energy * 0.12));
  halo.addColorStop(1, withAlpha(hc, 0));
  g.beginPath(); g.arc(0, 0, hr, 0, TAU);
  g.fillStyle = halo; g.fill();
  g.globalCompositeOperation = 'source-over';

  // Seks facetter: tre i toppyramiden, tre i bundpyramiden.
  const facets = [
    [[0, -hTop], [-w, 0], [-inner, shoulder], '#b9cdff', '#4a3aa8'],
    [[0, -hTop], [-inner, shoulder], [inner, shoulder], '#dbe8ff', '#7f9dff'],
    [[0, -hTop], [inner, shoulder], [w, 0], '#7f9bff', '#2f2585'],
    [[-w, 0], [-inner, shoulder], [0, hBot], '#7a63f2', '#241a6e'],
    [[-inner, shoulder], [inner, shoulder], [0, hBot], '#9b83ff', '#3a2a9c'],
    [[inner, shoulder], [w, 0], [0, hBot], '#4f3ac6', '#160f4a'],
  ];
  for (const [a, b, c, lo, hi] of facets) {
    const grad = g.createLinearGradient(a[0], a[1], c[0], c[1]);
    grad.addColorStop(0, lo);
    grad.addColorStop(1, hi);
    g.beginPath();
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]);
    g.closePath();
    g.fillStyle = grad; g.fill();
  }

  // Facetkanter — hvide, tynde, tydelige.
  g.lineJoin = 'round';
  g.strokeStyle = `rgba(240,247,255,${0.55 + 0.22 * pulse})`;
  g.lineWidth = Math.max(1, rc * 0.014);
  g.beginPath();
  g.moveTo(0, -hTop); g.lineTo(-w, 0); g.lineTo(0, hBot); g.lineTo(w, 0); g.closePath();
  g.moveTo(-w, 0); g.lineTo(w, 0);
  g.moveTo(0, -hTop); g.lineTo(-inner, shoulder); g.lineTo(0, hBot);
  g.moveTo(0, -hTop); g.lineTo(inner, shoulder); g.lineTo(0, hBot);
  g.moveTo(-inner, shoulder); g.lineTo(inner, shoulder);
  g.stroke();

  // Silhuet.
  g.beginPath();
  g.moveTo(0, -hTop); g.lineTo(-w, 0); g.lineTo(0, hBot); g.lineTo(w, 0); g.closePath();
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = Math.max(1, rc * 0.017);
  g.stroke();

  // Kernelys — kun i den øverste halvdel, så bunden bevarer sin dybde.
  g.save();
  g.beginPath();
  g.moveTo(0, -hTop); g.lineTo(-w, 0); g.lineTo(0, hBot); g.lineTo(w, 0); g.closePath();
  g.clip();
  g.globalCompositeOperation = 'lighter';
  const inr = g.createRadialGradient(-w * 0.20, -hTop * 0.18, 0, 0, 0, hTop * 1.35);
  inr.addColorStop(0, `rgba(226,238,255,${0.16 + 0.10 * pulse + energy * 0.34})`);
  inr.addColorStop(0.42, `rgba(150,175,255,${0.07 + energy * 0.18})`);
  inr.addColorStop(1, 'rgba(110,100,255,0)');
  g.fillStyle = inr;
  g.fillRect(-w, -hTop, w * 2, hTop + hBot);
  g.restore();

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
      symbolSize.push(Math.min(arc, thick) * 1.06);
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
        if (s.dim > 0) g.globalAlpha = 1 - s.dim * 0.28;
        g.drawImage(spr.canvas, -spr.ox, -spr.oy, spr.w, spr.h);
        g.restore();
      }
    }
  }

  /** Tegner symbolerne oven på pladerne. blur = tangential sløring 0..1. */
  function drawSymbols(g, board, offsets, blurPerRing) {
    for (let r = 0; r < RING_COUNT; r++) {
      const n = GEOM.cells[r], step = layout.step[r];
      const rad = layout.ringMid[r];
      const size = symbolSize[r];
      const blur = blurPerRing ? blurPerRing[r] : 0;
      for (let i = 0; i < n; i++) {
        const s = style[r][i];
        if (s.alpha <= 0.01) continue;
        const id = board.grid[r][i];
        const a = offsets[r] + (i + 0.5) * step;
        const drawOne = (aa, alpha) => {
          g.save();
          g.translate(layout.cx, layout.cy);
          g.rotate(aa);
          g.translate(0, -(rad + s.lift));
          if (s.scale !== 1) g.scale(s.scale, s.scale);
          g.globalAlpha = alpha * (s.dim > 0 ? 1 - s.dim * 0.55 : 1);

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
