/* LYSBRUD — krystalhulen bag hjulet.
   Geometrien (alle krystaller, revner, klynger) lægges ÉN gang af
   layoutCave(width, height, seed) og deles af to bagninger:
     createBackdrop     — selve hulen: grund → fjerne vægge → spir →
                          mellemkrystaller → gulv → gulvklynger →
                          forgrundsametyster → lysskakter → gnister →
                          vignette → filmkorn
     createBackdropLit  — kun højlysene på gennemsigtigt lærred (guld + cyan),
                          som spillet lægger ovenpå med 'lighter' ved gevinst
   Alt er proceduralt og deterministisk ud fra frøet; Math.random bruges
   ingen steder. Værdien holdes lav overalt, så hjulet er det der lyser.
   drawAmbient() er den eneste del der tegnes hver frame.                     */

import { PALETTE, SYMBOL_BY_ID } from '../config.js';
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

/* Hulens egne stenfarver lånes fra de to gems der bor i den. */
const AMETHYST = SYMBOL_BY_ID.purple;
const ICE = SYMBOL_BY_ID.cyan;

/* Afledte hulenuancer. Alt stammer fra PALETTE/SYMBOLS — ingen løse værdier. */
const TINT = {
  wallDeep:    mixHex(PALETTE.ink,     PALETTE.cavern1, 0.22),
  wallMid:     mixHex(PALETTE.cavern0, PALETTE.cavern2, 0.46),
  wallHigh:    mixHex(PALETTE.cavern1, PALETTE.cavern3, 0.55),
  cold:        mixHex(PALETTE.cavern1, PALETTE.teal,    0.34),
  coldRim:     mixHex(PALETTE.cavern3, PALETTE.teal,    0.50),
  floorDark:   mixHex(PALETTE.ink,     PALETTE.cavern2, 0.40),
  floorMid:    mixHex(PALETTE.cavern1, PALETTE.cavern3, 0.40),
  floorLit:    mixHex(PALETTE.cavern2, PALETTE.cavern3, 0.62),
  floorWarm:   mixHex(PALETTE.cavern3, PALETTE.gold1,   0.45),
  floorCool:   mixHex(PALETTE.cavern2, PALETTE.teal,    0.18),
  shardCore:   mixHex(PALETTE.cavern3, PALETTE.haze,    0.55),
  shardTip:    mixHex(PALETTE.haze,    PALETTE.text,    0.62),
  spireCold:   mixHex(PALETTE.cavern2, ICE.glow,        0.30),
  amethyst0:   mixHex(PALETTE.cavern2, AMETHYST.base,   0.28),   // dyb, mættet kerne
  amethyst1:   mixHex(PALETTE.cavern3, AMETHYST.base,   0.55),   // mellemfacet
  amethyst2:   mixHex(AMETHYST.base,   AMETHYST.edge,   0.18),   // lysvendt facet
  amethystRim: mixHex(AMETHYST.edge,   PALETTE.text,    0.50),
  cyanRim:     mixHex(ICE.glow,        ICE.edge,        0.55),   // ≈ #9cf0ff
};

/* Gevinstlysets tre toner: varm hvidguld → guld → cyan modlys. */
const LIT = {
  gold0: PALETTE.gold4,
  gold1: PALETTE.gold3,
  gold2: PALETTE.gold2,
  cyan:  TINT.cyanRim,
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

/** Frø-afledning, så hver bagning har sin egen uafhængige strøm. */
function seedKey(seed, tag) { return String(seed) + ':' + tag; }

/* ------------------------------------------------------------ stihjælpere */

function polyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** Åben kantlinje (spids → fod). Lukkes bevidst ikke — det er en kant. */
function strokePolyline(ctx, pts, style, width) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Gradient lodret hen over én facet. stops: [[t, colour], …] */
function facetGradient(ctx, f, stops) {
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < f.pts.length; i++) {
    const y = f.pts[i][1];
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (y1 - y0 < 0.5) y1 = y0 + 0.5;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  return g;
}

/** Hældning/spejling for væg- og loftkrystaller. Kaldes indenfor save(). */
function applyItemTransform(ctx, it) {
  if (!it.tilt && !it.flip) return;
  ctx.translate(it.cx, it.baseY);
  if (it.tilt) ctx.rotate(it.tilt);
  if (it.flip) ctx.scale(1, -1);
  ctx.translate(-it.cx, -it.baseY);
}

/* -------------------------------------------------------------- krystaller
   Alle krystaller deler samme beskrivelse, så begge bagninger kan tegne dem:
     outline   lukket silhuet
     facets    [{pts, side, top}]  side −1 = venstre, +1 = højre
     edgeL/R   silhuetkanter fra spids til fod
     ridge     den lodrette midterkant
     capEdges  (kun søjler) pyramidens indre kanter                           */

/** Spir: to facetter der mødes i en lodret ryg fra spidsen til basen. */
function makePrism(rng, cx, baseY, height, halfW, lean) {
  const apexX = cx + lean * halfW * 1.5;
  const apexY = baseY - height;
  const sh = 0.24 + rng() * 0.30;                 // skulderens højde
  const sy = baseY - height * sh;
  const lx = cx - halfW;
  const rx = cx + halfW;
  const lsx = cx - halfW * (0.60 + rng() * 0.36);
  const rsx = cx + halfW * (0.60 + rng() * 0.36);
  return {
    kind: 'spire',
    cx: cx, apexX: apexX, apexY: apexY, baseY: baseY, sy: sy,
    lx: lx, rx: rx, lsx: lsx, rsx: rsx, halfW: halfW, height: height,
    outline: [[lx, baseY], [lsx, sy], [apexX, apexY], [rsx, sy], [rx, baseY]],
    edgeL: [[apexX, apexY], [lsx, sy], [lx, baseY]],
    edgeR: [[apexX, apexY], [rsx, sy], [rx, baseY]],
    ridge: [[apexX, apexY], [apexX, baseY]],
    capEdges: null,
    facets: [
      { pts: [[apexX, apexY], [lsx, sy], [lx, baseY], [apexX, baseY]], side: -1, top: false },
      { pts: [[apexX, apexY], [rsx, sy], [rx, baseY], [apexX, baseY]], side: 1, top: false },
    ],
  };
}

/** Søjle: sekskantet prisme med pyramidespids — de tunge ametyster forrest. */
function makeColumn(rng, cx, baseY, height, halfW, lean) {
  const apexX = cx + lean * halfW * 1.2;
  const apexY = baseY - height;
  const cap = 0.22 + rng() * 0.16;                 // pyramidens andel af højden
  const shoulder = baseY - height * (1 - cap);
  const yL = shoulder + (rng() - 0.5) * height * 0.05;
  const yR = shoulder + (rng() - 0.5) * height * 0.05;
  const mx = cx + (rng() - 0.5) * halfW * 0.5;     // forreste lodrette kant
  const yM = Math.max(yL, yR) + height * cap * (0.30 + rng() * 0.22);
  const lx = cx - halfW;
  const rx = cx + halfW;
  return {
    kind: 'column',
    cx: cx, apexX: apexX, apexY: apexY, baseY: baseY, halfW: halfW, height: height,
    outline: [[lx, baseY], [lx, yL], [apexX, apexY], [rx, yR], [rx, baseY]],
    edgeL: [[apexX, apexY], [lx, yL], [lx, baseY]],
    edgeR: [[apexX, apexY], [rx, yR], [rx, baseY]],
    ridge: [[mx, yM], [mx, baseY]],
    capEdges: [[[lx, yL], [mx, yM]], [[mx, yM], [rx, yR]], [[apexX, apexY], [mx, yM]]],
    facets: [
      { pts: [[lx, yL], [apexX, apexY], [mx, yM]], side: -1, top: true },
      { pts: [[mx, yM], [apexX, apexY], [rx, yR]], side: 1, top: true },
      { pts: [[lx, yL], [mx, yM], [mx, baseY], [lx, baseY]], side: -1, top: false },
      { pts: [[mx, yM], [rx, yR], [rx, baseY], [mx, baseY]], side: 1, top: false },
    ],
  };
}

/* ------------------------------------------------------------ gulvprojektion */

function floorY(L, z) { return L.horizon + L.depth / z; }
function floorX(L, u, z) { return L.proj.vpx + L.proj.fx * u / z; }

/* ------------------------------------------------------------------ layout */

/**
 * Lægger hele hulens geometri. Ren funktion af (width, height, seed) —
 * ingen tegning, intet DOM. Begge bagninger tegner ud fra resultatet.
 */
export function layoutCave(width, height, seed) {
  const w = Math.max(2, Math.round(width || 0));
  const h = Math.max(2, Math.round(height || 0));
  const rng = makeRng(seed);
  const horizon = Math.round(h * 0.78);        // stengulvet fylder nederste ~22 %
  const depth = h - horizon;
  const L = {
    w: w, h: h, horizon: horizon, depth: depth,
    wheel: { x: w * 0.5, y: h * 0.47, r: h * 0.44 },   // hvor hjulet sidder
    proj: { vpx: w * 0.5, fx: w * 0.11 },
    far: [], spires: [], mid: [], floorClusters: [], fgClusters: [], cracks: [],
  };

  /* fjerne vægge */
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
      L.far.push({ p: p, side: side });
    }
  }

  /* høje, tynde spir op ad væggene */
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? -1 : 1;
    const n = 3 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const t = (i + rng() * 0.8) / n;
      const cx = side < 0 ? w * (0.015 + t * 0.15) : w * (0.985 - t * 0.15);
      const baseY = horizon + h * (0.03 + rng() * 0.08);
      const height = h * (0.50 + rng() * 0.30) * (1 - t * 0.35);
      const halfW = w * (0.006 + rng() * 0.009);
      const tilt = -side * (0.02 + rng() * 0.09);
      const p = makePrism(rng, cx, baseY, height, Math.max(3, halfW), (rng() - 0.5) * 0.3);
      L.spires.push({ p: p, side: side, tilt: tilt, flip: false, cx: cx, baseY: baseY, cold: true });
    }
  }

  /* mellemkrystaller */
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
      L.mid.push({ p: p, side: side, tilt: tilt, flip: false, cx: cx, baseY: baseY, cold: rng() < 0.28 });
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
      L.mid.push({ p: p, side: side, tilt: tilt, flip: false, cx: cx, baseY: baseY, cold: rng() < 0.28 });
    }

    /* nedhængende krystaller fra loftet */
    const k = 5;
    for (let i = 0; i < k; i++) {
      const cx = side < 0 ? w * (0.02 + rng() * 0.30) : w * (0.98 - rng() * 0.30);
      const rootY = -h * 0.03;
      const height = h * (0.09 + rng() * 0.20);
      const halfW = w * (0.008 + rng() * 0.016);
      const p = makePrism(rng, cx, rootY, height, halfW, (rng() - 0.5) * 0.5);
      L.mid.push({ p: p, side: side, tilt: 0, flip: true, cx: cx, baseY: rootY, cold: rng() < 0.28 });
    }
  }

  /* små gulvklynger */
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const t = rng();
    const x = w * (0.5 + side * (0.19 + t * 0.31));
    const dy = Math.pow(rng(), 0.75);
    const baseY = horizon + depth * (0.06 + dy * 0.78);
    const scale = h * (0.020 + dy * 0.068) * (0.7 + rng() * 0.7);
    const count = 3 + Math.floor(rng() * 3);
    const mid = (count - 1) / 2;
    const prisms = [];
    for (let j = 0; j < count; j++) {
      const off = (j - mid) * scale * (0.32 + rng() * 0.20);
      const shrink = 1 - Math.abs(j - mid) * 0.16;
      const height = scale * (0.78 + rng() * 1.05) * clamp(shrink, 0.35, 1);
      const halfW = scale * (0.12 + rng() * 0.10);
      prisms.push(makePrism(rng, x + off, baseY + scale * 0.06 * rng(), height, halfW, (rng() - 0.5) * 0.8));
    }
    L.floorClusters.push({ x: x, baseY: baseY, scale: scale, litSide: -side, prisms: prisms });
  }

  /* to store ametystklynger, nederst til venstre og højre — den højeste ~28 % */
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? -1 : 1;
    const x = w * (0.5 + side * (0.30 + rng() * 0.05));
    const baseY = h * (0.975 + rng() * 0.03);
    const tall = h * (0.26 + rng() * 0.035);
    const count = 4 + Math.floor(rng() * 3);
    const mid = (count - 1) / 2;
    const tallIdx = Math.floor(mid);
    const crystals = [];
    for (let i = 0; i < count; i++) {
      const off = (i - mid) * tall * (0.20 + rng() * 0.09);
      const rel = Math.abs(i - mid) / Math.max(1, mid);
      const height = i === tallIdx
        ? tall
        : tall * (0.40 + rng() * 0.35) * (1 - rel * 0.25);
      const halfW = Math.max(height * (0.13 + rng() * 0.05), tall * 0.075);   // tunge, ikke spinkle
      const lean = Math.abs(off) < 0.5
        ? (rng() - 0.5) * 0.2
        : (off < 0 ? -1 : 1) * (0.08 + rng() * 0.22);   // spidsen læner udad
      const by = baseY + (rng() - 0.35) * tall * 0.08;
      crystals.push(makeColumn(rng, x + off, by, height, halfW, lean));
    }
    crystals.sort(function (a, b) { return a.baseY - b.baseY; });   // fjernest først
    L.fgClusters.push({ x: x, baseY: baseY, scale: tall, litSide: -side, crystals: crystals });
  }

  /* revner der løber mod horisonten */
  for (let c = 0; c < 8; c++) {
    let u = (rng() - 0.5) * 28;
    let z = 1 + rng() * 1.4;
    const pts = [[floorX(L, u, z), floorY(L, z), z]];
    const segs = 5 + Math.floor(rng() * 5);
    for (let s = 0; s < segs; s++) {
      z += 0.45 + rng() * 1.05;
      u += (rng() - 0.5) * 2.8;
      pts.push([floorX(L, u, z), floorY(L, z), z]);
    }
    L.cracks.push(pts);
  }

  return L;
}

/* --------------------------------------------------------------- 1: grund */

function paintBase(ctx, L) {
  const w = L.w, h = L.h, horizon = L.horizon;
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.00, PALETTE.ink);
  g.addColorStop(0.13, PALETTE.cavern0);
  g.addColorStop(0.44, TINT.wallDeep);
  g.addColorStop(0.74, mixHex(PALETTE.cavern0, PALETTE.cavern1, 0.80));
  g.addColorStop(1.00, mixHex(PALETTE.ink, PALETTE.cavern1, 0.30));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

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

function paintFarWalls(ctx, L) {
  const w = L.w, h = L.h;
  const radius = clamp(Math.min(w, h) * 0.030, 6, 34);
  const layer = blurredLayer(w, h, radius, function (c) {
    for (let i = 0; i < L.far.length; i++) {
      const it = L.far[i];
      const p = it.p;
      const fill = c.createLinearGradient(0, p.apexY, 0, p.baseY);
      fill.addColorStop(0.00, rgba(TINT.wallHigh, 0.52));
      fill.addColorStop(0.38, rgba(TINT.wallMid,  0.62));
      fill.addColorStop(1.00, rgba(PALETTE.ink,   0.78));
      polyPath(c, p.outline);
      c.fillStyle = fill;
      c.fill();
      /* svagt kantlys på den side der vender ind mod midten */
      strokePolyline(c, it.side < 0 ? p.edgeR : p.edgeL, rgba(TINT.cold, 0.24), Math.max(2, p.halfW * 0.14));
    }
  });
  ctx.save();
  ctx.drawImage(layer, 0, 0, w, h);
  ctx.restore();
}

/* ------------------------------------------------------------ 3a: spir */

function paintSpires(ctx, L) {
  for (let i = 0; i < L.spires.length; i++) {
    const it = L.spires[i];
    const p = it.p;
    ctx.save();
    applyItemTransform(ctx, it);

    const fill = ctx.createLinearGradient(0, p.apexY, 0, p.baseY);
    fill.addColorStop(0.00, mixHex(PALETTE.cavern2, TINT.spireCold, 0.55));
    fill.addColorStop(0.30, mixHex(PALETTE.cavern1, PALETTE.cavern2, 0.60));
    fill.addColorStop(1.00, mixHex(PALETTE.ink, PALETTE.cavern1, 0.35));
    polyPath(ctx, p.outline);
    ctx.fillStyle = fill;
    ctx.fill();

    /* facetten mod hjulet er en anelse lysere */
    polyPath(ctx, p.facets[it.side < 0 ? 1 : 0].pts);
    ctx.fillStyle = rgba(TINT.spireCold, 0.18);
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    const edge = it.side < 0 ? p.edgeR : p.edgeL;
    strokePolyline(ctx, edge, rgba(TINT.cyanRim, 0.12), Math.max(2, p.halfW * 0.9));
    strokePolyline(ctx, edge, rgba(TINT.cyanRim, 0.48), Math.max(0.8, p.halfW * 0.22));
    strokePolyline(ctx, p.ridge, rgba(PALETTE.text, 0.10), Math.max(0.5, p.halfW * 0.08));
    const ar = p.halfW * 3.5;
    const g = ctx.createRadialGradient(p.apexX, p.apexY, 0, p.apexX, p.apexY, ar);
    g.addColorStop(0.00, rgba(TINT.cyanRim, 0.30));
    g.addColorStop(1.00, rgba(TINT.cyanRim, 0));
    ctx.fillStyle = g;
    ctx.fillRect(p.apexX - ar, p.apexY - ar, ar * 2, ar * 2);
    ctx.restore();

    polyPath(ctx, p.outline);
    ctx.strokeStyle = rgba(PALETTE.ink, 0.5);
    ctx.lineWidth = Math.max(0.5, p.halfW * 0.10);
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------------------------------------------------- 3b: mellemkrystaller */

function drawWallPrism(ctx, p, litSide, cold) {
  ctx.save();
  const dark = ctx.createLinearGradient(0, p.apexY, 0, p.baseY);
  dark.addColorStop(0.00, mixHex(PALETTE.cavern1, PALETTE.cavern2, 0.45));
  dark.addColorStop(0.50, mixHex(PALETTE.cavern1, PALETTE.ink, 0.42));
  dark.addColorStop(1.00, mixHex(PALETTE.ink, PALETTE.cavern1, 0.16));

  const lit = ctx.createLinearGradient(0, p.apexY, 0, p.baseY);
  lit.addColorStop(0.00, mixHex(PALETTE.cavern1, PALETTE.cavern3, 0.62));
  lit.addColorStop(0.34, mixHex(PALETTE.cavern1, PALETTE.cavern2, 0.72));
  lit.addColorStop(0.78, mixHex(PALETTE.cavern1, PALETTE.ink, 0.30));
  lit.addColorStop(1.00, mixHex(PALETTE.ink, PALETTE.cavern1, 0.20));

  polyPath(ctx, p.facets[0].pts);
  ctx.fillStyle = litSide < 0 ? lit : dark;
  ctx.fill();
  polyPath(ctx, p.facets[1].pts);
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
  strokePolyline(ctx, litSide < 0 ? p.edgeL : p.edgeR,
    rgba(cold ? TINT.coldRim : PALETTE.haze, 0.26), Math.max(0.7, p.halfW * 0.11));
  strokePolyline(ctx, p.ridge, rgba(PALETTE.text, 0.14), Math.max(0.5, p.halfW * 0.06));
  ctx.restore();

  /* nær-sort kontur, så silhuetten holder mod disen */
  polyPath(ctx, p.outline);
  ctx.strokeStyle = rgba(PALETTE.ink, 0.5);
  ctx.lineWidth = Math.max(0.5, p.halfW * 0.07);
  ctx.stroke();
  ctx.restore();
}

function paintMidCrystals(ctx, L) {
  for (let i = 0; i < L.mid.length; i++) {
    const it = L.mid[i];
    ctx.save();
    applyItemTransform(ctx, it);
    drawWallPrism(ctx, it.p, -it.side, it.cold);
    ctx.restore();
  }
}

/* ----------------------------------------------------------------- 4: gulv */

function paintFloor(ctx, L, rng) {
  const w = L.w, h = L.h, horizon = L.horizon, depth = L.depth;
  if (depth < 8) return;
  const vpx = L.proj.vpx;
  const fx = L.proj.fx;

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
    const y0 = floorY(L, z);
    const y1 = floorY(L, z + step);
    const rowH = y0 - y1;
    if (rowH < 0.9) break;
    const cell = fx / z;
    const uMax = Math.min(140, Math.ceil((w * 0.62) / Math.max(cell, 0.5)) + 1);
    const fade = clamp((z - 1) / 5.5, 0, 1);
    const solid = rowH >= 2.0;
    for (let u = -uMax; u < uMax; u++) {
      const xa0 = floorX(L, u, z);
      const xb0 = floorX(L, u + 1, z);
      const xa1 = floorX(L, u, z + step);
      const xb1 = floorX(L, u + 1, z + step);
      const j = rng();
      if (xb0 < -3 && xb1 < -3) continue;
      if (xa0 > w + 3 && xa1 > w + 3) continue;

      const mx = (xa1 + xb1) * 0.5;
      const my = (y0 + y1) * 0.5;
      const d = Math.hypot(mx - vpx, (my - horizon) * 1.4) / lightR;
      const lit = clamp(1 - d, 0, 1);
      let col = mixHex(TINT.floorDark, TINT.floorLit, 0.14 + lit * 0.60 + j * 0.16);
      col = mixHex(col, TINT.floorWarm, lit * lit * 0.45);    // varmt under hjulet
      col = mixHex(col, TINT.floorCool, (1 - lit) * 0.30);    // koldt i siderne
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
        ctx.strokeStyle = rgba(mixHex(TINT.shardCore, PALETTE.gold2, lit * 0.5), 0.30 * lit * (1 - fade * 0.8));
        ctx.lineWidth = clamp(rowH * 0.07, 0.5, 1.4);
        ctx.stroke();
      }
    }
  }

  /* revner der løber mod horisonten */
  for (let c = 0; c < L.cracks.length; c++) {
    const pts = L.cracks[c];
    strokePolyline(ctx, pts, rgba(PALETTE.ink, 0.60), 1.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    strokePolyline(ctx, pts, rgba(TINT.shardCore, 0.10), 0.8);
    ctx.restore();
  }

  /* skygge hvor gulvet møder væggen */
  const far = ctx.createLinearGradient(0, horizon, 0, horizon + depth * 0.34);
  far.addColorStop(0.00, rgba(PALETTE.ink, 0.80));
  far.addColorStop(1.00, rgba(PALETTE.ink, 0));
  ctx.fillStyle = far;
  ctx.fillRect(0, horizon, w, depth * 0.34);

  ctx.globalCompositeOperation = 'lighter';

  /* kold-varm deling: violet-cyan i siderne … */
  const coolL = ctx.createLinearGradient(0, 0, w * 0.34, 0);
  coolL.addColorStop(0.00, rgba(TINT.floorCool, 0.30));
  coolL.addColorStop(1.00, rgba(TINT.floorCool, 0));
  ctx.fillStyle = coolL;
  ctx.fillRect(0, horizon, w * 0.34, depth);
  const coolR = ctx.createLinearGradient(w, 0, w * 0.66, 0);
  coolR.addColorStop(0.00, rgba(TINT.floorCool, 0.30));
  coolR.addColorStop(1.00, rgba(TINT.floorCool, 0));
  ctx.fillStyle = coolR;
  ctx.fillRect(w * 0.66, horizon, w * 0.34, depth);

  /* … og en svag varm pøl der hvor hjulet står */
  const pool = ctx.createRadialGradient(vpx, horizon + depth * 0.10, depth * 0.04,
                                        vpx, horizon + depth * 0.14, w * 0.52);
  pool.addColorStop(0.00, rgba(PALETTE.haze,    0.12));
  pool.addColorStop(0.38, rgba(PALETTE.cavern3, 0.07));
  pool.addColorStop(1.00, rgba(PALETTE.cavern3, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(0, horizon, w, depth);

  ctx.save();
  ctx.translate(vpx, horizon + depth * 0.12);
  ctx.scale(1, 0.36);
  const wr = w * 0.30;
  const warm = ctx.createRadialGradient(0, 0, 0, 0, 0, wr);
  warm.addColorStop(0.00, rgba(PALETTE.gold2, 0.15));
  warm.addColorStop(0.40, rgba(PALETTE.gold1, 0.08));
  warm.addColorStop(1.00, rgba(PALETTE.gold1, 0));
  ctx.fillStyle = warm;
  ctx.fillRect(-wr, -wr, wr * 2, wr * 2);
  ctx.restore();
  ctx.restore();

  /* selve horisontlinjen — tynd, varmest i midten */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const line = ctx.createLinearGradient(0, 0, w, 0);
  line.addColorStop(0.00, rgba(TINT.cold, 0));
  line.addColorStop(0.26, rgba(TINT.cold, 0.09));
  line.addColorStop(0.50, rgba(mixHex(PALETTE.haze, PALETTE.gold2, 0.45), 0.22));
  line.addColorStop(0.74, rgba(TINT.cold, 0.09));
  line.addColorStop(1.00, rgba(TINT.cold, 0));
  ctx.fillStyle = line;
  ctx.fillRect(0, horizon - Math.max(1, h * 0.0030), w, Math.max(2, h * 0.0055));
  ctx.restore();
}

/* ------------------------------------------------------- 5: gulvklynger */

function drawShardPrism(ctx, p, litSide) {
  ctx.save();
  const dark = ctx.createLinearGradient(0, p.apexY, 0, p.baseY);
  dark.addColorStop(0.00, mixHex(TINT.shardCore, PALETTE.cavern2, 0.40));
  dark.addColorStop(0.52, mixHex(PALETTE.cavern2, PALETTE.cavern1, 0.55));
  dark.addColorStop(1.00, mixHex(PALETTE.cavern1, PALETTE.ink, 0.55));

  const lit = ctx.createLinearGradient(0, p.apexY, 0, p.baseY);
  lit.addColorStop(0.00, TINT.shardTip);
  lit.addColorStop(0.28, TINT.shardCore);
  lit.addColorStop(0.72, mixHex(PALETTE.cavern3, PALETTE.cavern1, 0.50));
  lit.addColorStop(1.00, mixHex(PALETTE.cavern1, PALETTE.ink, 0.45));

  polyPath(ctx, p.facets[0].pts);
  ctx.fillStyle = litSide < 0 ? lit : dark;
  ctx.fill();
  polyPath(ctx, p.facets[1].pts);
  ctx.fillStyle = litSide > 0 ? lit : dark;
  ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  strokePolyline(ctx, litSide < 0 ? p.edgeL : p.edgeR, rgba(TINT.shardTip, 0.42), Math.max(0.6, p.halfW * 0.18));
  ctx.restore();

  polyPath(ctx, p.outline);
  ctx.strokeStyle = rgba(PALETTE.ink, 0.55);
  ctx.lineWidth = Math.max(0.5, p.halfW * 0.11);
  ctx.stroke();
  ctx.restore();
}

function paintFloorCrystals(ctx, L) {
  for (let i = 0; i < L.floorClusters.length; i++) {
    const cl = L.floorClusters[i];
    const x = cl.x, baseY = cl.baseY, scale = cl.scale;
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
    ctx.closePath();
    ctx.fillStyle = pool;
    ctx.fill();
    ctx.restore();

    for (let j = 0; j < cl.prisms.length; j++) drawShardPrism(ctx, cl.prisms[j], cl.litSide);
  }
}

/* ------------------------------------------------ 6: forgrundsametyster */

function drawAmethyst(ctx, c, litSide) {
  ctx.save();
  const facets = c.facets;
  for (let i = 0; i < facets.length; i++) {
    const f = facets[i];
    const towards = f.side === litSide;
    let stops;
    if (f.top) {
      stops = towards
        ? [[0, TINT.amethyst2], [0.55, TINT.amethyst1], [1, TINT.amethyst0]]
        : [[0, TINT.amethyst1], [0.60, TINT.amethyst0], [1, mixHex(TINT.amethyst0, PALETTE.cavern1, 0.5)]];
    } else {
      stops = towards
        ? [[0, TINT.amethyst1], [0.45, TINT.amethyst0], [1, mixHex(PALETTE.cavern2, PALETTE.ink, 0.45)]]
        : [[0, TINT.amethyst0], [0.50, mixHex(PALETTE.cavern2, PALETTE.cavern1, 0.5)], [1, mixHex(PALETTE.cavern1, PALETTE.ink, 0.55)]];
    }
    polyPath(ctx, f.pts);
    ctx.fillStyle = facetGradient(ctx, f, stops);
    ctx.fill();
  }

  /* indre glød — violet kerne med et koldt stik mod hjulet, klippet til stenen */
  ctx.save();
  polyPath(ctx, c.outline);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const gy = c.baseY - c.height * 0.58;
  const gr = c.height * 0.50;
  const gv = ctx.createRadialGradient(c.cx, gy, 0, c.cx, gy, gr);
  gv.addColorStop(0.00, rgba(AMETHYST.glow, 0.30));
  gv.addColorStop(0.45, rgba(AMETHYST.glow, 0.10));
  gv.addColorStop(1.00, rgba(AMETHYST.glow, 0));
  ctx.fillStyle = gv;
  ctx.fillRect(c.cx - gr, gy - gr, gr * 2, gr * 2);
  const cx2 = c.cx + litSide * c.halfW * 0.45;
  const cy2 = c.baseY - c.height * 0.36;
  const cr2 = c.height * 0.30;
  const gc = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, cr2);
  gc.addColorStop(0.00, rgba(ICE.glow, 0.16));
  gc.addColorStop(1.00, rgba(ICE.glow, 0));
  ctx.fillStyle = gc;
  ctx.fillRect(cx2 - cr2, cy2 - cr2, cr2 * 2, cr2 * 2);
  ctx.restore();

  /* facetgrænser */
  ctx.lineJoin = 'round';
  const thin = Math.max(0.5, c.halfW * 0.05);
  const caps = c.capEdges || [];
  for (let i = 0; i < caps.length; i++) strokePolyline(ctx, caps[i], rgba(PALETTE.ink, 0.35), thin);
  strokePolyline(ctx, c.ridge, rgba(PALETTE.ink, 0.35), thin);

  /* kantlys: lys rand mod hjulet, cyan på bagkanten, hvidt glimt i spidsen */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  strokePolyline(ctx, c.ridge, rgba(TINT.cyanRim, 0.28), thin);
  const litEdge = litSide < 0 ? c.edgeL : c.edgeR;
  const darkEdge = litSide < 0 ? c.edgeR : c.edgeL;
  strokePolyline(ctx, litEdge, rgba(AMETHYST.glow, 0.22), Math.max(2, c.halfW * 0.40));
  strokePolyline(ctx, litEdge, rgba(TINT.amethystRim, 0.72), Math.max(0.8, c.halfW * 0.10));
  strokePolyline(ctx, darkEdge, rgba(TINT.cyanRim, 0.22), Math.max(0.6, c.halfW * 0.06));
  const ar = c.halfW * 1.1;
  const ag = ctx.createRadialGradient(c.apexX, c.apexY, 0, c.apexX, c.apexY, ar);
  ag.addColorStop(0.00, rgba(PALETTE.text, 0.55));
  ag.addColorStop(0.35, rgba(TINT.amethystRim, 0.25));
  ag.addColorStop(1.00, rgba(TINT.amethystRim, 0));
  ctx.fillStyle = ag;
  ctx.fillRect(c.apexX - ar, c.apexY - ar, ar * 2, ar * 2);
  ctx.restore();

  /* tynd mørk kontur */
  polyPath(ctx, c.outline);
  ctx.strokeStyle = rgba(PALETTE.ink, 0.62);
  ctx.lineWidth = Math.max(0.6, c.halfW * 0.08);
  ctx.stroke();
  ctx.restore();
}

function paintForeground(ctx, L) {
  for (let k = 0; k < L.fgClusters.length; k++) {
    const cl = L.fgClusters[k];
    const s = cl.scale;

    /* glød bag klyngen: violet med et cyan stik på hjulsiden */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cl.x, cl.baseY - s * 0.5, s * 0.05, cl.x, cl.baseY - s * 0.4, s * 1.5);
    glow.addColorStop(0.00, rgba(AMETHYST.glow, 0.22));
    glow.addColorStop(0.40, rgba(PALETTE.haze,  0.10));
    glow.addColorStop(1.00, rgba(PALETTE.haze,  0));
    ctx.fillStyle = glow;
    ctx.fillRect(cl.x - s * 1.6, cl.baseY - s * 2.0, s * 3.2, s * 2.6);
    const ccx = cl.x + cl.litSide * s * 0.5;
    const ccy = cl.baseY - s * 0.30;
    const cool = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, s * 0.9);
    cool.addColorStop(0.00, rgba(ICE.glow, 0.10));
    cool.addColorStop(1.00, rgba(ICE.glow, 0));
    ctx.fillStyle = cool;
    ctx.fillRect(ccx - s, ccy - s, s * 2, s * 2);
    ctx.restore();

    /* mørk fod, så stenene står i gulvet og ikke på det */
    ctx.save();
    const foot = ctx.createRadialGradient(cl.x, cl.baseY, 0, cl.x, cl.baseY, s * 1.0);
    foot.addColorStop(0.00, rgba(PALETTE.ink, 0.55));
    foot.addColorStop(1.00, rgba(PALETTE.ink, 0));
    ctx.beginPath();
    ctx.ellipse(cl.x, cl.baseY, s * 1.0, s * 0.22, 0, 0, TAU);
    ctx.closePath();
    ctx.fillStyle = foot;
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const pool = ctx.createRadialGradient(cl.x, cl.baseY, 0, cl.x, cl.baseY, s * 0.9);
    pool.addColorStop(0.00, rgba(PALETTE.haze, 0.22));
    pool.addColorStop(1.00, rgba(PALETTE.haze, 0));
    ctx.beginPath();
    ctx.ellipse(cl.x, cl.baseY, s * 0.9, s * 0.20, 0, 0, TAU);
    ctx.closePath();
    ctx.fillStyle = pool;
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < cl.crystals.length; i++) drawAmethyst(ctx, cl.crystals[i], cl.litSide);
  }
}

/* --------------------------------------------------------- 7: lysskakter */

function paintShafts(ctx, L, rng) {
  const w = L.w, h = L.h;
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

/* ------------------------------------------------------------- 8: gnister */

function paintSparks(ctx, L, rng) {
  const w = L.w, h = L.h;
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
    starFlare(ctx, x, y, r, r * (2.6 + rng() * 2.2), a, PALETTE.text, PALETTE.haze);
  }

  ctx.restore();
}

/** Lille stjerne: blød kerne + vandret og lodret flare. Additiv. */
function starFlare(ctx, x, y, r, flare, a, core, halo) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0.00, rgba(core, a));
  g.addColorStop(0.34, rgba(halo, a * 0.4));
  g.addColorStop(1.00, rgba(halo, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  const fh = ctx.createLinearGradient(x - flare, y, x + flare, y);
  fh.addColorStop(0.00, rgba(core, 0));
  fh.addColorStop(0.50, rgba(core, a * 0.55));
  fh.addColorStop(1.00, rgba(core, 0));
  ctx.fillStyle = fh;
  ctx.fillRect(x - flare, y - Math.max(0.5, r * 0.09), flare * 2, Math.max(1, r * 0.18));

  const fv = ctx.createLinearGradient(x, y - flare, x, y + flare);
  fv.addColorStop(0.00, rgba(core, 0));
  fv.addColorStop(0.50, rgba(core, a * 0.42));
  fv.addColorStop(1.00, rgba(core, 0));
  ctx.fillStyle = fv;
  ctx.fillRect(x - Math.max(0.5, r * 0.09), y - flare, Math.max(1, r * 0.18), flare * 2);
}

/* ------------------------------------------------------------ 9: vignette */

function paintVignette(ctx, L) {
  const w = L.w, h = L.h;
  ctx.save();
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
  ctx.restore();
}

function edgeFalloff(ctx, grad, alpha, x, y, w, h) {
  grad.addColorStop(0, rgba(PALETTE.ink, alpha));
  grad.addColorStop(1, rgba(PALETTE.ink, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

/* --------------------------------------------------------------- 10: korn */

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
  const L = layoutCave(width, height, seed);
  const scale = renderScale();

  const canvas = makeCanvas(L.w * scale, L.h * scale);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const rng = makeRng(seedKey(seed, 'paint'));   // kun skygge-jitter, aldrig geometri

  paintBase(ctx, L);
  paintFarWalls(ctx, L);
  paintSpires(ctx, L);
  paintMidCrystals(ctx, L);
  paintFloor(ctx, L, rng);
  paintFloorCrystals(ctx, L);
  paintForeground(ctx, L);
  paintShafts(ctx, L, rng);
  paintSparks(ctx, L, rng);
  paintVignette(ctx, L);
  paintGrain(ctx, canvas, rng, 0.55);

  return { canvas: canvas, width: L.w, height: L.h };
}

/* ------------------------------------------------------------ gevinstlys
   Kun højlys på gennemsigtig bund. Spillet lægger laget ovenpå hulen med
   globalCompositeOperation 'lighter' og en globalAlpha 0..1, så lyset
   vokser ud fra hjulet. Ingen mørke pixels — alt er guld, hvidguld og cyan. */

/** Lysstyrke 0.22..1 efter afstand til hjulet — hulen lyser op indefra. */
function lightAt(L, x, y) {
  const d = Math.hypot(x - L.wheel.x, (y - L.wheel.y) * 1.15);
  return clamp(1.18 - d / (L.wheel.r * 2.3), 0.22, 1);
}

function litGlow(ctx, L, rng) {
  const w = L.w, h = L.h, W = L.wheel;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  /* den store varme glød omkring hjulet */
  const r1 = Math.max(w, h) * 0.85;
  const g = ctx.createRadialGradient(W.x, W.y, W.r * 0.45, W.x, W.y, r1);
  g.addColorStop(0.00, rgba(LIT.gold0, 0.42));
  g.addColorStop(0.22, rgba(LIT.gold1, 0.30));
  g.addColorStop(0.50, rgba(LIT.gold2, 0.13));
  g.addColorStop(1.00, rgba(LIT.gold2, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  /* varm pøl på gulvet under hjulet */
  ctx.save();
  ctx.translate(W.x, L.horizon + L.depth * 0.10);
  ctx.scale(1, 0.34);
  const pr = w * 0.55;
  const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, pr);
  pg.addColorStop(0.00, rgba(LIT.gold0, 0.40));
  pg.addColorStop(0.35, rgba(LIT.gold1, 0.20));
  pg.addColorStop(1.00, rgba(LIT.gold2, 0));
  ctx.fillStyle = pg;
  ctx.fillRect(-pr, -pr, pr * 2, pr * 2);
  ctx.restore();

  /* bløde stråler ud fra hjulet */
  const radius = clamp(Math.min(w, h) * 0.035, 6, 40);
  const layer = blurredLayer(w, h, radius, function (c) {
    const n = 18;
    const len = Math.max(w, h) * 1.2;
    for (let i = 0; i < n; i++) {
      const a = (i + rng() * 0.6) / n * TAU;
      const spread = 0.012 + rng() * 0.030;
      const alpha = 0.10 + rng() * 0.16;
      const rg = c.createRadialGradient(W.x, W.y, W.r * 0.6, W.x, W.y, len);
      rg.addColorStop(0.00, rgba(LIT.gold0, alpha));
      rg.addColorStop(0.45, rgba(LIT.gold1, alpha * 0.45));
      rg.addColorStop(1.00, rgba(LIT.gold1, 0));
      c.beginPath();
      c.moveTo(W.x, W.y);
      c.lineTo(W.x + Math.cos(a - spread) * len, W.y + Math.sin(a - spread) * len);
      c.lineTo(W.x + Math.cos(a + spread) * len, W.y + Math.sin(a + spread) * len);
      c.closePath();
      c.fillStyle = rg;
      c.fill();
    }
  });
  ctx.drawImage(layer, 0, 0, w, h);
  ctx.restore();
}

function litFloor(ctx, L) {
  const w = L.w, horizon = L.horizon, depth = L.depth;
  if (depth < 8) return;
  const vpx = L.proj.vpx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, w, depth);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  /* fliserækker: den fjerne kant fanger guldet, stærkest under hjulet */
  const step = 0.55;
  const lightR = w * 0.46;
  for (let z = 1; z < 60; z += step) {
    const y1 = floorY(L, z + step);
    const rowH = floorY(L, z) - y1;
    if (rowH < 1.6) break;
    const fade = clamp((z - 1) / 5.5, 0, 1);
    const a = 0.34 * (1 - fade * 0.85);
    if (a < 0.02) continue;
    const rg = ctx.createLinearGradient(vpx - lightR, 0, vpx + lightR, 0);
    rg.addColorStop(0.00, rgba(LIT.gold1, 0));
    rg.addColorStop(0.50, rgba(LIT.gold1, a));
    rg.addColorStop(1.00, rgba(LIT.gold1, 0));
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(w, y1);
    ctx.strokeStyle = rg;
    ctx.lineWidth = clamp(rowH * 0.08, 0.5, 1.4);
    ctx.stroke();
  }

  /* flisesømme der samles under hjulet */
  for (let u = -14; u <= 14; u += 2) {
    const a = 0.14 * clamp(1 - Math.abs(u) / 16, 0, 1);
    const sg = ctx.createLinearGradient(0, horizon + depth, 0, horizon);
    sg.addColorStop(0.00, rgba(LIT.gold1, a));
    sg.addColorStop(0.55, rgba(LIT.gold1, a * 0.45));
    sg.addColorStop(1.00, rgba(LIT.gold1, 0));
    ctx.beginPath();
    ctx.moveTo(floorX(L, u, 1), floorY(L, 1));
    ctx.lineTo(floorX(L, u, 60), floorY(L, 60));
    ctx.strokeStyle = sg;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  /* revnerne lyser som tynde guldlinjer ind mod hjulet */
  for (let c = 0; c < L.cracks.length; c++) {
    const pts = L.cracks[c];
    strokePolyline(ctx, pts, rgba(LIT.gold1, 0.20), 4.5);
    strokePolyline(ctx, pts, rgba(LIT.gold0, 0.62), 1.3);
  }
  ctx.restore();
}

/** Højlys på én krystal: lysvendte facetter i guld, bagsiden i cyan modlys. */
function litCrystal(ctx, c, litSide, k) {
  ctx.save();
  const facets = c.facets;
  for (let i = 0; i < facets.length; i++) {
    const f = facets[i];
    const towards = f.side === litSide;
    const boost = f.top ? 1.25 : 1;
    const stops = towards
      ? [[0, rgba(LIT.gold0, 0.78 * k * boost)], [0.45, rgba(LIT.gold1, 0.44 * k * boost)], [1, rgba(LIT.gold2, 0.12 * k)]]
      : [[0, rgba(LIT.cyan, 0.26 * k * boost)], [0.60, rgba(LIT.cyan, 0.08 * k)], [1, rgba(LIT.cyan, 0)]];
    polyPath(ctx, f.pts);
    ctx.fillStyle = facetGradient(ctx, f, stops);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const litEdge = litSide < 0 ? c.edgeL : c.edgeR;
  const darkEdge = litSide < 0 ? c.edgeR : c.edgeL;
  strokePolyline(ctx, litEdge, rgba(LIT.gold1, 0.28 * k), Math.max(2, c.halfW * 0.50));
  strokePolyline(ctx, litEdge, rgba(LIT.gold0, 0.72 * k), Math.max(0.8, c.halfW * 0.12));
  strokePolyline(ctx, darkEdge, rgba(LIT.cyan, 0.50 * k), Math.max(0.6, c.halfW * 0.07));
  strokePolyline(ctx, c.ridge, rgba(LIT.gold1, 0.45 * k), Math.max(0.5, c.halfW * 0.06));
  const caps = c.capEdges || [];
  for (let i = 0; i < caps.length; i++) {
    strokePolyline(ctx, caps[i], rgba(LIT.gold0, 0.55 * k), Math.max(0.5, c.halfW * 0.06));
  }

  /* glimt i spidsen */
  const ar = Math.max(2, c.halfW * 1.8);
  const ag = ctx.createRadialGradient(c.apexX, c.apexY, 0, c.apexX, c.apexY, ar);
  ag.addColorStop(0.00, rgba(LIT.gold0, 0.75 * k));
  ag.addColorStop(0.40, rgba(LIT.gold1, 0.25 * k));
  ag.addColorStop(1.00, rgba(LIT.gold1, 0));
  ctx.fillStyle = ag;
  ctx.fillRect(c.apexX - ar, c.apexY - ar, ar * 2, ar * 2);
  ctx.restore();
}

function litFarWalls(ctx, L) {
  const w = L.w, h = L.h;
  const radius = clamp(Math.min(w, h) * 0.030, 6, 34);
  const layer = blurredLayer(w, h, radius, function (c) {
    for (let i = 0; i < L.far.length; i++) {
      const it = L.far[i];
      const p = it.p;
      const k = lightAt(L, p.apexX, (p.apexY + p.baseY) * 0.5);
      const f = p.facets[it.side < 0 ? 1 : 0];
      polyPath(c, f.pts);
      c.fillStyle = facetGradient(c, f, [[0, rgba(LIT.gold0, 0.30 * k)], [0.5, rgba(LIT.gold1, 0.14 * k)], [1, rgba(LIT.gold2, 0)]]);
      c.fill();
      strokePolyline(c, it.side < 0 ? p.edgeR : p.edgeL, rgba(LIT.gold0, 0.45 * k), Math.max(2, p.halfW * 0.16));
    }
  });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(layer, 0, 0, w, h);
  ctx.restore();
}

function litCrystals(ctx, L) {
  /* vægspir og mellemkrystaller — med samme hældning/spejling som hulen */
  const wall = L.spires.concat(L.mid);
  for (let i = 0; i < wall.length; i++) {
    const it = wall[i];
    const p = it.p;
    const k = lightAt(L, it.cx, it.flip ? it.baseY + p.height * 0.5 : it.baseY - p.height * 0.5);
    ctx.save();
    applyItemTransform(ctx, it);
    litCrystal(ctx, p, -it.side, k);
    ctx.restore();
  }

  /* små gulvklynger */
  for (let i = 0; i < L.floorClusters.length; i++) {
    const cl = L.floorClusters[i];
    const k = lightAt(L, cl.x, cl.baseY - cl.scale * 0.5);
    for (let j = 0; j < cl.prisms.length; j++) litCrystal(ctx, cl.prisms[j], cl.litSide, k);
  }

  /* de store ametyster — guld på hjulsiden, cyan bagpå, varm glød omkring */
  for (let i = 0; i < L.fgClusters.length; i++) {
    const cl = L.fgClusters[i];
    const s = cl.scale;
    const k = lightAt(L, cl.x + cl.litSide * s * 0.3, cl.baseY - s * 0.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gx = cl.x + cl.litSide * s * 0.35;
    const gy = cl.baseY - s * 0.55;
    const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, s * 1.4);
    gg.addColorStop(0.00, rgba(LIT.gold1, 0.22 * k));
    gg.addColorStop(0.45, rgba(LIT.gold2, 0.10 * k));
    gg.addColorStop(1.00, rgba(LIT.gold2, 0));
    ctx.fillStyle = gg;
    ctx.fillRect(gx - s * 1.5, gy - s * 1.5, s * 3, s * 3);
    ctx.restore();
    for (let j = 0; j < cl.crystals.length; j++) litCrystal(ctx, cl.crystals[j], cl.litSide, k);
  }
}

function litSparkles(ctx, L, rng) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < L.fgClusters.length; i++) {
    const cl = L.fgClusters[i];
    /* kun den højeste sten får en stjerne — ellers stabler flarerne sig til en klat */
    let c = cl.crystals[0];
    for (let j = 1; j < cl.crystals.length; j++) if (cl.crystals[j].height > c.height) c = cl.crystals[j];
    const r = Math.max(2, c.halfW * (0.6 + rng() * 0.3));
    starFlare(ctx, c.apexX, c.apexY, r, r * (3 + rng() * 2), 0.45, LIT.gold0, LIT.gold1);
  }
  for (let i = 0; i < L.spires.length; i++) {
    const it = L.spires[i];
    const p = it.p;
    ctx.save();
    applyItemTransform(ctx, it);
    const r = Math.max(2, p.halfW * 1.4);
    starFlare(ctx, p.apexX, p.apexY, r, r * (2.5 + rng() * 2), 0.45, LIT.cyan, LIT.gold1);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Bager gevinstlyset: samme geometri som createBackdrop for samme argumenter,
 * men kun højlysene på gennemsigtig bund. Lægges ovenpå med 'lighter'.
 * @param {number} width
 * @param {number} height
 * @param {number|string} seed
 * @returns {{canvas: HTMLCanvasElement, width: number, height: number}}
 */
export function createBackdropLit(width, height, seed) {
  const L = layoutCave(width, height, seed);
  const scale = renderScale();

  const canvas = makeCanvas(L.w * scale, L.h * scale);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const rng = makeRng(seedKey(seed, 'lit'));

  litGlow(ctx, L, rng);
  litFloor(ctx, L);
  litFarWalls(ctx, L);
  litCrystals(ctx, L);
  litSparkles(ctx, L, rng);

  return { canvas: canvas, width: L.w, height: L.h };
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
