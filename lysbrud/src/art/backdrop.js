/* LYSBRUD — krystalhulen bag hjulet.
   Baggrunden bages én gang i klart adskilte lag: grund → fjerne vægge →
   mellemkrystaller → gulv → forgrundskrystaller → lysskakter → gnister →
   vignette → filmkorn. Alt er proceduralt og deterministisk ud fra frøet;
   Math.random bruges ingen steder. Værdien holdes meget lav overalt, så
   hjulets guldskinner og symboler er det eneste der reelt lyser.
   drawAmbient() er den eneste del der tegnes hver frame.                     */

import { PALETTE } from '../config.js';
import { makeRng } from '../rng.js';

const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- farver */

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Lineær blanding af to #rrggbb-farver. */
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b), k = clamp(t, 0, 1);
  const r = Math.round(A[0] + (B[0] - A[0]) * k);
  const g = Math.round(A[1] + (B[1] - A[1]) * k);
  const c = Math.round(A[2] + (B[2] - A[2]) * k);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | c).toString(16).slice(1);
}

function rgba(h, a) {
  const c = hexToRgb(h);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a, 0, 1) + ')';
}

/* Afledte hulenuancer. Alt stammer fra PALETTE — ingen løse paletteværdier. */
const TINT = {
  wallDeep:  mixHex(PALETTE.ink,     PALETTE.cavern1, 0.22),
  wallMid:   mixHex(PALETTE.cavern0, PALETTE.cavern2, 0.46),
  wallHigh:  mixHex(PALETTE.cavern1, PALETTE.cavern3, 0.55),
  cold:      mixHex(PALETTE.cavern1, PALETTE.teal,    0.34),
  coldRim:   mixHex(PALETTE.cavern3, PALETTE.teal,    0.50),
  floorDark: mixHex(PALETTE.ink,     PALETTE.cavern2, 0.40),
  floorMid:  mixHex(PALETTE.cavern1, PALETTE.cavern3, 0.40),
  floorLit:  mixHex(PALETTE.cavern2, PALETTE.cavern3, 0.62),
  shardCore: mixHex(PALETTE.cavern3, PALETTE.haze,    0.55),
  shardTip:  mixHex(PALETTE.haze,    PALETTE.text,    0.62),
};

/* --------------------------------------------------------------- lærreder */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width  = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Fysisk opløsning. Følger main.js' dpr-loft, så blittet bliver 1:1. */
function renderScale() {
  const d = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  return clamp(d, 1, 2);
}

let filterOk = null;
/** ctx.filter findes i alle måltbrowsere, men vi har en reserve alligevel. */
function supportsFilter() {
  if (filterOk === null) {
    try {
      const c = makeCanvas(1, 1).getContext('2d');
      c.filter = 'blur(2px)';
      filterOk = c.filter === 'blur(2px)';
    } catch (err) {
      filterOk = false;
    }
  }
  return filterOk;
}

/** Tegner et lag i logisk opløsning og returnerer det sløret. */
function blurredLayer(w, h, radius, paint) {
  const src = makeCanvas(w, h);
  paint(src.getContext('2d'), w, h);
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  if (supportsFilter()) {
    octx.filter = 'blur(' + Math.max(1, Math.round(radius)) + 'px)';
    octx.drawImage(src, 0, 0);
    octx.filter = 'none';
  } else {
    /* reserve: ned- og opskalering giver rigeligt blødhed til silhuetter */
    const div = Math.max(2, Math.round(radius * 0.8));
    const tw = Math.max(2, Math.round(w / div));
    const th = Math.max(2, Math.round(h / div));
    const tiny = makeCanvas(tw, th);
    const tctx = tiny.getContext('2d');
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(src, 0, 0, tw, th);
    octx.drawImage(tiny, 0, 0, w, h);
  }
  return out;
}

/* -------------------------------------------------------------- krystaller
   Et spir er to facetter der mødes i en lodret ryg fra spidsen til basen.
   Det giver en ægte slebet flade i stedet for en flad trekant.               */

function makePrism(rng, cx, baseY, height, halfW, lean) {
  const apexX = cx + lean * halfW * 1.5;
  const apexY = baseY - height;
  const sh = 0.24 + rng() * 0.30;                 // skulderens højde
  return {
    apexX: apexX,
    apexY: apexY,
    baseY: baseY,
    sy: baseY - height * sh,
    lx: cx - halfW,
    rx: cx + halfW,
    lsx: cx - halfW * (0.60 + rng() * 0.36),
    rsx: cx + halfW * (0.60 + rng() * 0.36),
    halfW: halfW,
    height: height,
  };
}

function prismPath(ctx, p) {
  ctx.beginPath();
  ctx.moveTo(p.lx, p.baseY);
  ctx.lineTo(p.lsx, p.sy);
  ctx.lineTo(p.apexX, p.apexY);
  ctx.lineTo(p.rsx, p.sy);
  ctx.lineTo(p.rx, p.baseY);
  ctx.closePath();
}

/** side < 0 = venstre facet, side > 0 = højre facet. Deles af ryggen. */
function facetPath(ctx, p, side) {
  ctx.beginPath();
  ctx.moveTo(p.apexX, p.apexY);
  if (side < 0) {
    ctx.lineTo(p.lsx, p.sy);
    ctx.lineTo(p.lx, p.baseY);
  } else {
    ctx.lineTo(p.rsx, p.sy);
    ctx.lineTo(p.rx, p.baseY);
  }
  ctx.lineTo(p.apexX, p.baseY);
  ctx.closePath();
}

/* --------------------------------------------------------------- 1: grund */

function paintBase(ctx, w, h, horizon) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.00, PALETTE.ink);
  g.addColorStop(0.13, PALETTE.cavern0);
  g.addColorStop(0.44, TINT.wallDeep);
  g.addColorStop(0.74, mixHex(PALETTE.cavern0, PALETTE.cavern1, 0.80));
  g.addColorStop(1.00, mixHex(PALETTE.ink, PALETTE.cavern1, 0.30));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  /* violet dis lige bag hjulet — kammerets eget lys */
  const cx = w * 0.5;
  const cy = horizon - h * 0.30;
  const r = Math.max(w, h) * 0.60;
  const haze = ctx.createRadialGradient(cx, cy, r * 0.03, cx, cy, r);
  haze.addColorStop(0.00, rgba(PALETTE.haze,    0.24));
  haze.addColorStop(0.26, rgba(PALETTE.cavern3, 0.14));
  haze.addColorStop(0.58, rgba(PALETTE.cavern2, 0.06));
  haze.addColorStop(1.00, rgba(PALETTE.cavern2, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);

  /* to kolde lommer højt oppe i siderne: hulen fortsætter ud af billedet */
  pocket(ctx, w * 0.31, h * 0.27, Math.max(w, h) * 0.26, TINT.cold, 0.13);
  pocket(ctx, w * 0.75, h * 0.20, Math.max(w, h) * 0.22, TINT.cold, 0.10);
  pocket(ctx, w * 0.50, h * 0.06, Math.max(w, h) * 0.30, PALETTE.cavern3, 0.09);

  ctx.restore();
}

function pocket(ctx, x, y, r, colour, alpha) {
  const g = ctx.createRadialGradient(x, y, r * 0.02, x, y, r);
  g.addColorStop(0.00, rgba(colour, alpha));
  g.addColorStop(0.45, rgba(colour, alpha * 0.34));
  g.addColorStop(1.00, rgba(colour, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/* --------------------------------------------------------- 2: fjerne vægge */

function paintFarWalls(ctx, w, h, horizon, rng) {
  const radius = clamp(Math.min(w, h) * 0.030, 6, 34);
  const layer = blurredLayer(w, h, radius, function (c) {
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? -1 : 1;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const t = (i + rng() * 0.7) / n;
        const cx = side < 0 ? w * (-0.06 + t * 0.46) : w * (1.06 - t * 0.46);
        const height = h * (0.66 - t * 0.30) * (0.75 + rng() * 0.5);
        const halfW = w * (0.105 - t * 0.048) * (0.7 + rng() * 0.7);
        const baseY = horizon + h * (0.02 + rng() * 0.06);
        const p = makePrism(rng, cx, baseY, height, Math.max(6, halfW), (rng() - 0.5) * 0.5);

        const fill = c.createLinearGradient(0, p.apexY, 0, p.baseY);
        fill.addColorStop(0.00, rgba(TINT.wallHigh, 0.52));
        fill.addColorStop(0.38, rgba(TINT.wallMid,  0.62));
        fill.addColorStop(1.00, rgba(PALETTE.ink,   0.78));
        prismPath(c, p);
        c.fillStyle = fill;
        c.fill();

        /* svagt kantlys på den side der vender ind mod midten */
        c.beginPath();
        c.moveTo(p.apexX, p.apexY);
        c.lineTo(side < 0 ? p.rsx : p.lsx, p.sy);
        c.lineTo(side < 0 ? p.rx : p.lx, p.baseY);
        c.strokeStyle = rgba(TINT.cold, 0.24);
        c.lineWidth = Math.max(2, p.halfW * 0.14);
        c.stroke();
      }
    }
  });
  ctx.drawImage(layer, 0, 0, w, h);
}

/* ---------------------------------------------------- 3: mellemkrystaller */

function drawWallPrism(ctx, p, litSide, rng) {
  const dark = ctx.createLinearGradient(0, p.apexY, 0, p.baseY);
  dark.addColorStop(0.00, mixHex(PALETTE.cavern1, PALETTE.cavern2, 0.45));
  dark.addColorStop(0.50, mixHex(PALETTE.cavern1, PALETTE.ink, 0.42));
  dark.addColorStop(1.00, mixHex(PALETTE.ink, PALETTE.cavern1, 0.16));

  const lit = ctx.createLinearGradient(0, p.apexY, 0, p.baseY);
  lit.addColorStop(0.00, mixHex(PALETTE.cavern1, PALETTE.cavern3, 0.62));
  lit.addColorStop(0.34, mixHex(PALETTE.cavern1, PALETTE.cavern2, 0.72));
  lit.addColorStop(0.78, mixHex(PALETTE.cavern1, PALETTE.ink, 0.30));
  lit.addColorStop(1.00, mixHex(PALETTE.ink, PALETTE.cavern1, 0.20));

  facetPath(ctx, p, -1);
  ctx.fillStyle = litSide < 0 ? lit : dark;
  ctx.fill();
  facetPath(ctx, p, 1);
  ctx.fillStyle = litSide > 0 ? lit : dark;
  ctx.fill();

  /* indre facetlinjer, parallelt med ryggen */
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = rgba(TINT.wallHigh, 0.5);
  ctx.lineWidth = Math.max(0.5, p.halfW * 0.045);
  const lines = 2;
  for (let i = 1; i <= lines; i++) {
    const k = i / (lines + 1);
    ctx.beginPath();
    ctx.moveTo(p.apexX, p.apexY + p.height * 0.10 * k);
    ctx.lineTo(p.apexX + (litSide > 0 ? p.rx - p.apexX : p.lx - p.apexX) * k, p.baseY);
    ctx.stroke();
  }
  ctx.restore();

  /* kantlys langs ryggen og den oplyste yderkant */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(rng() < 0.28 ? TINT.coldRim : PALETTE.haze, 0.26);
  ctx.lineWidth = Math.max(0.7, p.halfW * 0.11);
  ctx.beginPath();
  ctx.moveTo(p.apexX, p.apexY);
  ctx.lineTo(litSide < 0 ? p.lsx : p.rsx, p.sy);
  ctx.lineTo(litSide < 0 ? p.lx : p.rx, p.baseY);
  ctx.stroke();

  ctx.strokeStyle = rgba(PALETTE.text, 0.14);
  ctx.lineWidth = Math.max(0.5, p.halfW * 0.06);
  ctx.beginPath();
  ctx.moveTo(p.apexX, p.apexY);
  ctx.lineTo(p.apexX, p.baseY);
  ctx.stroke();
  ctx.restore();

  /* nær-sort kontur, så silhuetten holder mod disen */
  prismPath(ctx, p);
  ctx.strokeStyle = rgba(PALETTE.ink, 0.5);
  ctx.lineWidth = Math.max(0.5, p.halfW * 0.07);
  ctx.stroke();
}

function paintMidCrystals(ctx, w, h, horizon, rng) {
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? -1 : 1;

    /* spir der vokser op fra vægfoden */
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = (i + rng() * 0.8) / n;
      const cx = side < 0 ? w * (0.01 + t * 0.29) : w * (0.99 - t * 0.29);
      const baseY = horizon + h * (0.005 + rng() * 0.045);
      const height = h * (0.40 - t * 0.22) * (0.55 + rng() * 0.85);
      const halfW = w * (0.030 - t * 0.013) * (0.6 + rng() * 0.9);
      const tilt = -side * (0.03 + rng() * 0.20);
      const p = makePrism(rng, cx, baseY, Math.max(18, height), Math.max(4, halfW), (rng() - 0.5) * 0.6);
      ctx.save();
      ctx.translate(cx, baseY);
      ctx.rotate(tilt);
      ctx.translate(-cx, -baseY);
      drawWallPrism(ctx, p, -side, rng);
      ctx.restore();
    }

    /* små spir der stikker ud af væggen i forskellige højder */
    const m = 7;
    for (let i = 0; i < m; i++) {
      const cx = side < 0 ? w * (0.005 + rng() * 0.27) : w * (0.995 - rng() * 0.27);
      const baseY = h * (0.20 + rng() * 0.54);
      const height = h * (0.05 + rng() * 0.13);
      const halfW = w * (0.007 + rng() * 0.013);
      const tilt = -side * (0.35 + rng() * 0.55);
      const p = makePrism(rng, cx, baseY, height, halfW, (rng() - 0.5) * 0.8);
      ctx.save();
      ctx.translate(cx, baseY);
      ctx.rotate(tilt);
      ctx.translate(-cx, -baseY);
      drawWallPrism(ctx, p, -side, rng);
      ctx.restore();
    }

    /* nedhængende krystaller fra loftet */
    const k = 5;
    for (let i = 0; i < k; i++) {
      const cx = side < 0 ? w * (0.02 + rng() * 0.30) : w * (0.98 - rng() * 0.30);
      const rootY = -h * 0.03;
      const height = h * (0.09 + rng() * 0.20);
      const halfW = w * (0.008 + rng() * 0.016);
      const p = makePrism(rng, cx, rootY, height, halfW, (rng() - 0.5) * 0.5);
      ctx.save();
      ctx.translate(cx, rootY);
      ctx.scale(1, -1);                        // vend spidsen nedad
      ctx.translate(-cx, -rootY);
      drawWallPrism(ctx, p, -side, rng);
      ctx.restore();
    }
  }
}

/* ----------------------------------------------------------------- 4: gulv */

function paintFloor(ctx, w, h, horizon, rng) {
  const depth = h - horizon;
  if (depth < 8) return;

  const vpx = w * 0.5;
  const fx = w * 0.11;
  const yOf = function (z) { return horizon + depth / z; };
  const xOf = function (u, z) { return vpx + fx * u / z; };

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, w, depth);
  ctx.clip();

  /* stengrund */
  const base = ctx.createLinearGradient(0, horizon, 0, h);
  base.addColorStop(0.00, mixHex(PALETTE.ink, PALETTE.cavern1, 0.22));
  base.addColorStop(0.26, TINT.floorDark);
  base.addColorStop(0.64, TINT.floorMid);
  base.addColorStop(1.00, mixHex(PALETTE.ink, PALETTE.cavern1, 0.38));
  ctx.fillStyle = base;
  ctx.fillRect(0, horizon, w, depth);

  /* fliser: ens verdensceller projiceret mod horisonten */
  const step = 0.55;
  const lightR = w * 0.46;
  for (let z = 1; z < 60; z += step) {
    const y0 = yOf(z);
    const y1 = yOf(z + step);
    const rowH = y0 - y1;
    if (rowH < 0.9) break;
    const cell = fx / z;
    const uMax = Math.min(140, Math.ceil((w * 0.62) / Math.max(cell, 0.5)) + 1);
    const fade = clamp((z - 1) / 5.5, 0, 1);
    const solid = rowH >= 2.0;
    for (let u = -uMax; u < uMax; u++) {
      const xa0 = xOf(u, z);
      const xb0 = xOf(u + 1, z);
      const xa1 = xOf(u, z + step);
      const xb1 = xOf(u + 1, z + step);
      const j = rng();
      if (xb0 < -3 && xb1 < -3) continue;
      if (xa0 > w + 3 && xa1 > w + 3) continue;

      const mx = (xa1 + xb1) * 0.5;
      const my = (y0 + y1) * 0.5;
      const d = Math.hypot(mx - vpx, (my - horizon) * 1.4) / lightR;
      const lit = clamp(1 - d, 0, 1);
      let col = mixHex(TINT.floorDark, TINT.floorLit, 0.14 + lit * 0.60 + j * 0.16);
      col = mixHex(col, PALETTE.ink, fade * 0.60);

      ctx.beginPath();
      ctx.moveTo(xa0, y0);
      ctx.lineTo(xb0, y0);
      ctx.lineTo(xb1, y1);
      ctx.lineTo(xa1, y1);
      ctx.closePath();
      if (solid) {
        ctx.fillStyle = col;
        ctx.fill();
      }
      ctx.strokeStyle = rgba(PALETTE.ink, 0.55 * (1 - fade * 0.45));
      ctx.lineWidth = clamp(rowH * 0.11, 0.5, 1.8);
      ctx.stroke();

      /* flisens fjerne kant fanger lyset fra hjulets fod */
      if (solid && lit > 0.05) {
        ctx.beginPath();
        ctx.moveTo(xa1, y1);
        ctx.lineTo(xb1, y1);
        ctx.strokeStyle = rgba(TINT.shardCore, 0.30 * lit * (1 - fade * 0.8));
        ctx.lineWidth = clamp(rowH * 0.07, 0.5, 1.4);
        ctx.stroke();
      }
    }
  }

  /* revner der løber mod horisonten */
  for (let c = 0; c < 8; c++) {
    let u = (rng() - 0.5) * 28;
    let z = 1 + rng() * 1.4;
    ctx.beginPath();
    ctx.moveTo(xOf(u, z), yOf(z));
    const segs = 5 + Math.floor(rng() * 5);
    for (let s = 0; s < segs; s++) {
      z += 0.45 + rng() * 1.05;
      u += (rng() - 0.5) * 2.8;
      ctx.lineTo(xOf(u, z), yOf(z));
    }
    ctx.strokeStyle = rgba(PALETTE.ink, 0.60);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(TINT.shardCore, 0.10);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  /* skygge hvor gulvet møder væggen */
  const far = ctx.createLinearGradient(0, horizon, 0, horizon + depth * 0.34);
  far.addColorStop(0.00, rgba(PALETTE.ink, 0.80));
  far.addColorStop(1.00, rgba(PALETTE.ink, 0));
  ctx.fillStyle = far;
  ctx.fillRect(0, horizon, w, depth * 0.34);

  /* lyspøl under hjulet */
  ctx.globalCompositeOperation = 'lighter';
  const pool = ctx.createRadialGradient(vpx, horizon + depth * 0.10, depth * 0.04,
                                        vpx, horizon + depth * 0.14, w * 0.52);
  pool.addColorStop(0.00, rgba(PALETTE.haze,    0.16));
  pool.addColorStop(0.38, rgba(PALETTE.cavern3, 0.08));
  pool.addColorStop(1.00, rgba(PALETTE.cavern3, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(0, horizon, w, depth);
  ctx.restore();

  /* selve horisontlinjen — tynd, lysest i midten */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const line = ctx.createLinearGradient(0, 0, w, 0);
  line.addColorStop(0.00, rgba(TINT.cold, 0));
  line.addColorStop(0.26, rgba(TINT.cold, 0.09));
  line.addColorStop(0.50, rgba(PALETTE.haze, 0.20));
  line.addColorStop(0.74, rgba(TINT.cold, 0.09));
  line.addColorStop(1.00, rgba(TINT.cold, 0));
  ctx.fillStyle = line;
  ctx.fillRect(0, horizon - Math.max(1, h * 0.0030), w, Math.max(2, h * 0.0055));
  ctx.restore();
}

/* ------------------------------------------------- 5: forgrundskrystaller */

function drawShardPrism(ctx, p, litSide) {
  const dark = ctx.createLinearGradient(0, p.apexY, 0, p.baseY);
  dark.addColorStop(0.00, mixHex(TINT.shardCore, PALETTE.cavern2, 0.40));
  dark.addColorStop(0.52, mixHex(PALETTE.cavern2, PALETTE.cavern1, 0.55));
  dark.addColorStop(1.00, mixHex(PALETTE.cavern1, PALETTE.ink, 0.55));

  const lit = ctx.createLinearGradient(0, p.apexY, 0, p.baseY);
  lit.addColorStop(0.00, TINT.shardTip);
  lit.addColorStop(0.28, TINT.shardCore);
  lit.addColorStop(0.72, mixHex(PALETTE.cavern3, PALETTE.cavern1, 0.50));
  lit.addColorStop(1.00, mixHex(PALETTE.cavern1, PALETTE.ink, 0.45));

  facetPath(ctx, p, -1);
  ctx.fillStyle = litSide < 0 ? lit : dark;
  ctx.fill();
  facetPath(ctx, p, 1);
  ctx.fillStyle = litSide > 0 ? lit : dark;
  ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(TINT.shardTip, 0.42);
  ctx.lineWidth = Math.max(0.6, p.halfW * 0.18);
  ctx.beginPath();
  ctx.moveTo(p.apexX, p.apexY);
  ctx.lineTo(litSide < 0 ? p.lsx : p.rsx, p.sy);
  ctx.lineTo(litSide < 0 ? p.lx : p.rx, p.baseY);
  ctx.stroke();
  ctx.restore();

  prismPath(ctx, p);
  ctx.strokeStyle = rgba(PALETTE.ink, 0.55);
  ctx.lineWidth = Math.max(0.5, p.halfW * 0.11);
  ctx.stroke();
}

function drawShardCluster(ctx, rng, x, baseY, scale, litSide) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, baseY - scale * 0.55, scale * 0.06,
                                        x, baseY - scale * 0.45, scale * 2.4);
  glow.addColorStop(0.00, rgba(PALETTE.haze,    0.24));
  glow.addColorStop(0.34, rgba(PALETTE.cavern3, 0.11));
  glow.addColorStop(1.00, rgba(PALETTE.cavern3, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - scale * 2.5, baseY - scale * 3.0, scale * 5, scale * 4.4);

  const pool = ctx.createRadialGradient(x, baseY, scale * 0.04, x, baseY, scale * 1.3);
  pool.addColorStop(0.00, rgba(PALETTE.haze, 0.20));
  pool.addColorStop(1.00, rgba(PALETTE.haze, 0));
  ctx.beginPath();
  ctx.ellipse(x, baseY, scale * 1.3, scale * 0.32, 0, 0, TAU);
  ctx.fillStyle = pool;
  ctx.fill();
  ctx.restore();

  const count = 3 + Math.floor(rng() * 3);
  const mid = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const off = (i - mid) * scale * (0.32 + rng() * 0.20);
    const shrink = 1 - Math.abs(i - mid) * 0.16;
    const height = scale * (0.78 + rng() * 1.05) * clamp(shrink, 0.35, 1);
    const halfW = scale * (0.12 + rng() * 0.10);
    const p = makePrism(rng, x + off, baseY + scale * 0.06 * rng(), height, halfW, (rng() - 0.5) * 0.8);
    drawShardPrism(ctx, p, litSide);
  }
}

function paintFloorCrystals(ctx, w, h, horizon, rng) {
  const depth = h - horizon;
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const t = rng();
    const x = w * (0.5 + side * (0.19 + t * 0.31));
    const dy = Math.pow(rng(), 0.75);
    const baseY = horizon + depth * (0.06 + dy * 0.78);
    const scale = h * (0.020 + dy * 0.068) * (0.7 + rng() * 0.7);
    drawShardCluster(ctx, rng, x, baseY, scale, -side);
  }
}

/* --------------------------------------------------------- 6: lysskakter */

function paintShafts(ctx, w, h, rng) {
  const radius = clamp(Math.min(w, h) * 0.045, 8, 46);
  const layer = blurredLayer(w, h, radius, function (c) {
    for (let i = 0; i < 3; i++) {
      const ox = w * (0.40 + i * 0.10) + (rng() - 0.5) * w * 0.05;
      const oy = -h * 0.12;
      const endY = h * (0.55 + rng() * 0.32);
      const spread = w * (0.09 + rng() * 0.11);
      const drift = (rng() - 0.5) * w * 0.18;
      const g = c.createLinearGradient(0, oy, 0, endY);
      g.addColorStop(0.00, rgba(PALETTE.haze, 0.16));
      g.addColorStop(0.35, rgba(PALETTE.haze, 0.08));
      g.addColorStop(1.00, rgba(PALETTE.haze, 0));
      c.beginPath();
      c.moveTo(ox - w * 0.012, oy);
      c.lineTo(ox + w * 0.012, oy);
      c.lineTo(ox + drift + spread, endY);
      c.lineTo(ox + drift - spread, endY);
      c.closePath();
      c.fillStyle = g;
      c.fill();
    }
  });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(layer, 0, 0, w, h);
  ctx.restore();
}

/* ------------------------------------------------------------- 7: gnister */

function paintSparks(ctx, w, h, rng) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const n = clamp(Math.round(w * h / 7600), 90, 320);
  for (let i = 0; i < n; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const bias = Math.pow(rng(), 1.6);
    const x = w * (0.5 + side * (0.18 + bias * 0.34));
    const y = h * (0.02 + Math.pow(rng(), 0.9) * 0.86);
    const r = 0.6 + Math.pow(rng(), 2.2) * 3.2;
    const cold = rng() < 0.42;
    const colour = cold ? TINT.coldRim : mixHex(PALETTE.haze, PALETTE.text, rng() * 0.5);
    const a = 0.10 + Math.pow(rng(), 1.8) * 0.55;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0.00, rgba(PALETTE.text, a));
    g.addColorStop(0.30, rgba(colour, a * 0.7));
    g.addColorStop(1.00, rgba(colour, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* nogle få stjerneglimt med korsflare */
  for (let i = 0; i < 9; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = w * (0.5 + side * (0.20 + rng() * 0.30));
    const y = h * (0.06 + rng() * 0.66);
    const r = h * (0.006 + rng() * 0.016);
    const a = 0.24 + rng() * 0.34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0.00, rgba(PALETTE.text, a));
    g.addColorStop(0.34, rgba(PALETTE.haze, a * 0.4));
    g.addColorStop(1.00, rgba(PALETTE.haze, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    const flare = r * (2.6 + rng() * 2.2);
    const fh = ctx.createLinearGradient(x - flare, y, x + flare, y);
    fh.addColorStop(0.00, rgba(PALETTE.text, 0));
    fh.addColorStop(0.50, rgba(PALETTE.text, a * 0.55));
    fh.addColorStop(1.00, rgba(PALETTE.text, 0));
    ctx.fillStyle = fh;
    ctx.fillRect(x - flare, y - Math.max(0.5, r * 0.09), flare * 2, Math.max(1, r * 0.18));

    const fv = ctx.createLinearGradient(x, y - flare, x, y + flare);
    fv.addColorStop(0.00, rgba(PALETTE.text, 0));
    fv.addColorStop(0.50, rgba(PALETTE.text, a * 0.42));
    fv.addColorStop(1.00, rgba(PALETTE.text, 0));
    ctx.fillStyle = fv;
    ctx.fillRect(x - Math.max(0.5, r * 0.09), y - flare, Math.max(1, r * 0.18), flare * 2);
  }

  ctx.restore();
}

/* ------------------------------------------------------------ 8: vignette */

function paintVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.16,
                                     w * 0.5, h * 0.52, Math.max(w, h) * 0.80);
  g.addColorStop(0.00, rgba(PALETTE.ink, 0));
  g.addColorStop(0.42, rgba(PALETTE.ink, 0.12));
  g.addColorStop(0.74, rgba(PALETTE.ink, 0.46));
  g.addColorStop(1.00, rgba(PALETTE.ink, 0.86));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  edgeFalloff(ctx, ctx.createLinearGradient(0, 0, w * 0.17, 0), 0.58, 0, 0, w * 0.17, h);
  edgeFalloff(ctx, ctx.createLinearGradient(w, 0, w * 0.83, 0), 0.58, w * 0.83, 0, w * 0.17, h);
  edgeFalloff(ctx, ctx.createLinearGradient(0, 0, 0, h * 0.14), 0.52, 0, 0, w, h * 0.14);
  edgeFalloff(ctx, ctx.createLinearGradient(0, h, 0, h * 0.86), 0.50, 0, h * 0.86, w, h * 0.14);
}

function edgeFalloff(ctx, grad, alpha, x, y, w, h) {
  grad.addColorStop(0, rgba(PALETTE.ink, alpha));
  grad.addColorStop(1, rgba(PALETTE.ink, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

/* ---------------------------------------------------------------- 9: korn */

function paintGrain(ctx, canvas, rng, amount) {
  const size = 128;
  const tile = makeCanvas(size, size);
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = rng();
    const up = v > 0.5;
    const k = Math.abs(v - 0.5) * 2;
    d[i]     = up ? 255 : 0;
    d[i + 1] = up ? 250 : 1;
    d[i + 2] = up ? 255 : 10;
    d[i + 3] = Math.round(k * k * (up ? 30 : 26));
  }
  tctx.putImageData(img, 0, 0);

  const pat = ctx.createPattern(tile, 'repeat');
  if (!pat) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);          // korn i fysiske pixels
  ctx.globalAlpha = clamp(amount, 0, 1);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

/* ------------------------------------------------------------------ API */

/**
 * Bager hele hulen til ét offscreen-lærred.
 * @param {number} width  logisk bredde i CSS-px
 * @param {number} height logisk højde i CSS-px
 * @param {number|string} seed
 * @returns {{canvas: HTMLCanvasElement, width: number, height: number}}
 */
export function createBackdrop(width, height, seed) {
  const w = Math.max(2, Math.round(width || 0));
  const h = Math.max(2, Math.round(height || 0));
  const scale = renderScale();

  const canvas = makeCanvas(w * scale, h * scale);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const rng = makeRng(seed);
  const horizon = Math.round(h * 0.78);        // stengulvet fylder nederste ~22 %

  paintBase(ctx, w, h, horizon);
  paintFarWalls(ctx, w, h, horizon, rng);
  paintMidCrystals(ctx, w, h, horizon, rng);
  paintFloor(ctx, w, h, horizon, rng);
  paintFloorCrystals(ctx, w, h, horizon, rng);
  paintShafts(ctx, w, h, rng);
  paintSparks(ctx, w, h, rng);
  paintVignette(ctx, w, h);
  paintGrain(ctx, canvas, rng, 0.55);

  return { canvas: canvas, width: w, height: h };
}

/* ------------------------------------------------------- levende partikler
   Tabellen bygges én gang pr. lærredsstørrelse. Positioner udledes analytisk
   af t, så der hverken gemmes tilstand eller allokeres i den varme løkke.   */

const AMB = {
  ready: false,
  w: 0,
  h: 0,
  dpr: 1,
  motion: 1,
  motes: null,
  splinters: null,
  dotWarm: null,
  dotCold: null,
  splinter: null,
};

function motionScale() {
  try {
    if (typeof window !== 'undefined' && window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0.25;
  } catch (err) {
    /* ingen matchMedia — kør med fuld bevægelse */
  }
  return 1;
}

function buildDotSprite(px, colour) {
  const c = makeCanvas(px, px);
  const g2 = c.getContext('2d');
  const r = px / 2;
  const g = g2.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0.00, rgba(PALETTE.text, 0.95));
  g.addColorStop(0.14, rgba(colour, 0.70));
  g.addColorStop(0.40, rgba(colour, 0.17));
  g.addColorStop(1.00, rgba(colour, 0));
  g2.fillStyle = g;
  g2.fillRect(0, 0, px, px);
  return c;
}

function buildSplinterSprite(px) {
  const c = makeCanvas(px, px);
  const g2 = c.getContext('2d');
  const m = px / 2;
  const hh = px * 0.40;
  const hw = px * 0.085;

  const gl = g2.createRadialGradient(m, m, 0, m, m, m);
  gl.addColorStop(0.00, rgba(PALETTE.haze, 0.30));
  gl.addColorStop(0.45, rgba(PALETTE.haze, 0.07));
  gl.addColorStop(1.00, rgba(PALETTE.haze, 0));
  g2.fillStyle = gl;
  g2.fillRect(0, 0, px, px);

  g2.beginPath();
  g2.moveTo(m, m - hh);
  g2.lineTo(m + hw, m - hh * 0.42);
  g2.lineTo(m + hw * 0.70, m + hh * 0.62);
  g2.lineTo(m, m + hh);
  g2.lineTo(m - hw * 0.70, m + hh * 0.62);
  g2.lineTo(m - hw, m - hh * 0.42);
  g2.closePath();
  const body = g2.createLinearGradient(m - hw, m - hh, m + hw, m + hh);
  body.addColorStop(0.00, rgba(PALETTE.text, 0.80));
  body.addColorStop(0.34, rgba(TINT.shardTip, 0.62));
  body.addColorStop(0.72, rgba(PALETTE.haze, 0.28));
  body.addColorStop(1.00, rgba(PALETTE.cavern3, 0.10));
  g2.fillStyle = body;
  g2.fill();

  g2.beginPath();
  g2.moveTo(m, m - hh);
  g2.lineTo(m, m + hh);
  g2.strokeStyle = rgba(PALETTE.text, 0.32);
  g2.lineWidth = Math.max(1, px * 0.012);
  g2.stroke();
  return c;
}

function buildAmbient(w, h, dpr) {
  const rng = makeRng('lysbrud-ambient');
  const moteCount = Math.round(clamp(w * h / 13000, 46, 170));
  const motes = new Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motes[i] = {
      x: rng(),
      y: rng(),
      vx: (rng() - 0.5) * 0.0070,              // normaliserede enheder pr. sekund
      vy: -(0.0035 + rng() * 0.0105),
      amp: 0.003 + rng() * 0.013,
      fr: 0.14 + rng() * 0.34,
      ph: rng() * TAU,
      tf: 0.5 + rng() * 1.5,                   // blinkefrekvens
      tp: rng() * TAU,
      r: 0.7 + Math.pow(rng(), 2.1) * 2.7,
      a: 0.10 + Math.pow(rng(), 1.5) * 0.45,
      cold: rng() < 0.38,
    };
  }

  const splinterCount = Math.round(clamp(w / 130, 6, 14));
  const splinters = new Array(splinterCount);
  for (let i = 0; i < splinterCount; i++) {
    splinters[i] = {
      x: rng(),
      y: rng(),
      vx: (rng() - 0.5) * 0.0050,
      vy: -(0.0020 + rng() * 0.0055),
      spin: (rng() - 0.5) * 0.34,
      ph: rng() * TAU,
      tf: 0.25 + rng() * 0.55,
      size: 7 + rng() * 13,
      a: 0.10 + rng() * 0.26,
    };
  }

  const px = Math.round(clamp(28 * dpr, 16, 64));
  AMB.dotWarm = buildDotSprite(px, PALETTE.haze);
  AMB.dotCold = buildDotSprite(px, TINT.coldRim);
  AMB.splinter = buildSplinterSprite(Math.round(clamp(72 * dpr, 48, 160)));
  AMB.motes = motes;
  AMB.splinters = splinters;
  AMB.motion = motionScale();
  AMB.w = w;
  AMB.h = h;
  AMB.dpr = dpr;
  AMB.ready = true;
}

/** Blødt ud/ind ved kanterne, så ombrydningen aldrig ses poppe. */
function edgeFade(v) {
  const e = v < 0.5 ? v : 1 - v;
  return e < 0.07 ? e * 14.2857 : 1;
}

/**
 * Animeret støv- og splintlag. Kaldes hver frame oven på den bagte hule.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w logisk bredde
 * @param {number} h logisk højde
 * @param {number} t tid i millisekunder
 * @param {number} dpr
 */
export function drawAmbient(ctx, w, h, t, dpr) {
  if (!ctx || !(w > 0) || !(h > 0)) return;
  const d = dpr > 0 ? dpr : 1;
  if (!AMB.ready || Math.abs(AMB.w - w) > 6 || Math.abs(AMB.h - h) > 6 || AMB.dpr !== d) {
    buildAmbient(w, h, d);
  }

  const ts = t * 0.001 * AMB.motion;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const motes = AMB.motes;
  for (let i = 0; i < motes.length; i++) {
    const m = motes[i];
    let x = m.x + m.vx * ts + Math.sin(ts * m.fr + m.ph) * m.amp;
    let y = m.y + m.vy * ts;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const a = m.a * edgeFade(x) * edgeFade(y) * (0.62 + 0.38 * Math.sin(ts * m.tf + m.tp));
    if (a <= 0.004) continue;
    const s = m.r * 5;
    ctx.globalAlpha = a;
    ctx.drawImage(m.cold ? AMB.dotCold : AMB.dotWarm, x * w - s * 0.5, y * h - s * 0.5, s, s);
  }

  const splinters = AMB.splinters;
  const sprite = AMB.splinter;
  for (let i = 0; i < splinters.length; i++) {
    const s = splinters[i];
    let x = s.x + s.vx * ts;
    let y = s.y + s.vy * ts;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const a = s.a * edgeFade(x) * edgeFade(y) * (0.55 + 0.45 * Math.sin(ts * s.tf + s.ph));
    if (a <= 0.004) continue;
    ctx.globalAlpha = a;
    ctx.save();
    ctx.translate(x * w, y * h);
    ctx.rotate(s.ph + s.spin * ts);
    ctx.drawImage(sprite, -s.size * 0.5, -s.size * 0.5, s.size, s.size);
    ctx.restore();
  }

  ctx.restore();
}
