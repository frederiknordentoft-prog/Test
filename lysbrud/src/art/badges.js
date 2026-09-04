/* LYSBRUD — procedurelle badges til gevinstpræsentationen.
   drawWildBadge: den blå, ottetakkede wild-sten med guld-W og multiplikator
   (mockup-crop m-wild1). drawGlint: firtakket glimt til partikelsystemet.
   Ingen billedfiler. Al geometri er eksplicitte vertexlister, og al
   variation kommer fra ../rng.js, så prærendering er deterministisk.       */

import { PALETTE, WILD } from '../config.js';
import { makeRng } from '../rng.js';

const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- farver
   Safirblå er badge-specifik og ligger tæt op ad kobolt-gemmen i paletten.
   Guld hentes fra paletten, så W'et matcher medaljonen i symbols.js.       */

const SAPPHIRE_LITE = '#1d4fd6';
const SAPPHIRE_DEEP = '#0b1f6b';
const SAPPHIRE_DARK = '#071243';
const HALO_CORE     = '#4f7dff';
const HALO_EDGE     = '#9cc3ff';

const GOLD_HI  = WILD.edge;       // #fff2c0
const GOLD_MID = PALETTE.gold2;   // #d5a63f
const GOLD_LO  = PALETTE.gold1;   // #8a6520

const INK_UNDER = 'rgba(3,4,13,0.88)';       // bred underkontur, som gems
const INK_LINE  = 'rgba(2,4,20,0.9)';        // tynd kontur ovenpå
const RIM_LINE  = 'rgba(205,228,255,0.78)';  // hvidblå indre randlinje

const W_FONT    = 'bold %spx "Times New Roman", Georgia, serif';
const MULT_FONT = '900 %spx system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/* lysretning: øverst til venstre, samme som symbols.js */
const LIGHT = [-0.566, -0.824];

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function hexToRgb(h) {
  if (typeof h !== 'string' || h[0] !== '#') return [255, 255, 255];
  let s = h.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  if (!Number.isFinite(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(h, a) {
  const c = hexToRgb(h);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')';
}

/* ------------------------------------------------------------- geometri
   Kompasrose: 8 lange spidser på enhedscirklen med 8 dale imellem — 16
   hjørner i alt. Vinkel −π/2 er "op". Listen løber med uret på skærmen.    */

const POINTS = 8;
const VALLEY = 0.56;

const STAR = (() => {
  const v = [];
  for (let i = 0; i < POINTS; i++) {
    const a = -Math.PI / 2 + i * TAU / POINTS;
    const b = a + Math.PI / POINTS;
    v.push([Math.cos(a), Math.sin(a)]);
    v.push([Math.cos(b) * VALLEY, Math.sin(b) * VALLEY]);
  }
  return v;
})();

/* Deterministisk uro i facetternes lysstyrke, så pladerne ikke er
   matematisk ens. Fast frø → samme sten ved hver prærendering.            */
const FACET_JITTER = (() => {
  const rng = makeRng('lysbrud-badge-facets');
  const out = [];
  for (let i = 0; i < STAR.length; i++) out.push((rng() - 0.5) * 0.10);
  return out;
})();

function traceStar(ctx, R) {
  ctx.beginPath();
  ctx.moveTo(STAR[0][0] * R, STAR[0][1] * R);
  for (let i = 1; i < STAR.length; i++) ctx.lineTo(STAR[i][0] * R, STAR[i][1] * R);
  ctx.closePath();
}

/* ------------------------------------------------------------- lag: halo */

function drawHalo(ctx, R, glow, lit) {
  const a = clamp(0.32 * glow + 0.28 * lit, 0, 0.9);
  if (a <= 0.004) return;
  const rad = R * (1.55 + 0.45 * Math.min(lit, 1));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const g = ctx.createRadialGradient(0, 0, R * 0.12, 0, 0, rad);
  g.addColorStop(0.00, rgba(HALO_EDGE, a * 0.80));
  g.addColorStop(0.28, rgba(HALO_CORE, a * 0.50));
  g.addColorStop(0.62, rgba(HALO_CORE, a * 0.15));
  g.addColorStop(1.00, rgba(HALO_CORE, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, TAU);
  ctx.closePath();
  ctx.fill();

  if (lit > 0) {
    /* hvidblå kerne når stenen tændes */
    const cr = R * 1.05;
    const c = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
    c.addColorStop(0.00, 'rgba(236,244,255,' + clamp(0.40 * lit, 0, 1).toFixed(3) + ')');
    c.addColorStop(0.50, rgba(HALO_EDGE, 0.16 * lit));
    c.addColorStop(1.00, rgba(HALO_EDGE, 0));
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(0, 0, cr, 0, TAU);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/* ---------------------------------------------------------- lag: facetter */

/** Trekantplader fra centrum til hvert hjørnepar, skiftevis lys/mørk. */
function drawFacets(ctx, R) {
  const n = STAR.length;
  for (let i = 0; i < n; i++) {
    const a = STAR[i], b = STAR[(i + 1) % n];
    const mx = (a[0] + b[0]) / 3, my = (a[1] + b[1]) / 3;
    const len = Math.hypot(mx, my) || 1;
    const lit = (mx / len) * LIGHT[0] + (my / len) * LIGHT[1];
    const k = lit * 0.5 + (i % 2 === 0 ? 0.09 : -0.09) + FACET_JITTER[i];

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(a[0] * R, a[1] * R);
    ctx.lineTo(b[0] * R, b[1] * R);
    ctx.closePath();
    ctx.fillStyle = k >= 0
      ? 'rgba(200,225,255,' + (k * 0.40).toFixed(3) + ')'
      : 'rgba(3,5,28,' + (-k * 0.52).toFixed(3) + ')';
    ctx.fill();

    /* pladerne der vender mod lyset får en lysere blå overflade */
    if (lit > 0.85) {
      ctx.fillStyle = rgba(HALO_EDGE, (lit - 0.85) / 0.15 * 0.36);
      ctx.fill();
    }
  }
}

/** Facetsømme: tynde egere fra centrum til hvert hjørne, lysere ude ved spidserne. */
function drawSeams(ctx, R) {
  ctx.beginPath();
  for (let i = 0; i < STAR.length; i++) {
    ctx.moveTo(0, 0);
    ctx.lineTo(STAR[i][0] * R * 0.96, STAR[i][1] * R * 0.96);
    ctx.closePath();
  }
  ctx.lineWidth = Math.max(0.5, R * 0.028);
  ctx.strokeStyle = rgba(HALO_EDGE, 0.26);
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < STAR.length; i += 2) {
    ctx.moveTo(STAR[i][0] * R * 0.62, STAR[i][1] * R * 0.62);
    ctx.lineTo(STAR[i][0] * R * 0.94, STAR[i][1] * R * 0.94);
    ctx.closePath();
  }
  ctx.lineWidth = Math.max(0.5, R * 0.024);
  ctx.strokeStyle = 'rgba(255,255,255,0.34)';
  ctx.stroke();
}

/** Næsten-hvide kanthøjlys på de kanter der vender mod lyset (øverst til venstre). */
function drawEdgeLights(ctx, R) {
  const n = STAR.length;
  const w = Math.max(0.8, R * 0.05);
  for (let i = 0; i < n; i++) {
    const a = STAR[i], b = STAR[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    /* udadvendt normal for en sti der løber med uret på skærmen */
    const f = (dy / len) * LIGHT[0] + (-dx / len) * LIGHT[1];
    if (f <= 0.30) continue;
    ctx.beginPath();
    ctx.moveTo(a[0] * R, a[1] * R);
    ctx.lineTo(b[0] * R, b[1] * R);
    ctx.closePath();
    ctx.lineWidth = w * 2;   // klippet: kun inderhalvdelen ses
    ctx.strokeStyle = 'rgba(232,242,255,' + ((f - 0.30) / 0.70 * 0.75).toFixed(3) + ')';
    ctx.stroke();
  }
}

/* --------------------------------------------------------------- lag: krop */

function drawStarBody(ctx, R, lit) {
  const outlineW = Math.max(1, R * 0.05);
  const rimW = Math.max(1, R * 0.018);

  ctx.save();

  /* bred mørk underkontur — kroppen dækker inderhalvdelen */
  traceStar(ctx, R);
  ctx.lineWidth = Math.max(1.5, R * 0.14);
  ctx.strokeStyle = INK_UNDER;
  ctx.stroke();

  /* krop: dyb safir, løftet mod øverste venstre */
  traceStar(ctx, R);
  const body = ctx.createRadialGradient(-R * 0.32, -R * 0.38, R * 0.05, 0, 0, R * 1.25);
  body.addColorStop(0.00, SAPPHIRE_LITE);
  body.addColorStop(0.48, SAPPHIRE_DEEP);
  body.addColorStop(1.00, SAPPHIRE_DARK);
  ctx.fillStyle = body;
  ctx.fill();

  /* alt der skal holde sig indenfor silhuetten */
  ctx.save();
  traceStar(ctx, R);
  ctx.clip();

  drawFacets(ctx, R);
  drawSeams(ctx, R);
  drawEdgeLights(ctx, R);

  /* specular: blød klat på facetten øverst til venstre */
  const hx = -R * 0.30, hy = -R * 0.36, hr = R * 0.52;
  const sp = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
  sp.addColorStop(0.00, 'rgba(255,255,255,0.50)');
  sp.addColorStop(0.45, 'rgba(210,230,255,0.14)');
  sp.addColorStop(1.00, 'rgba(210,230,255,0)');
  ctx.fillStyle = sp;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, TAU);
  ctx.closePath();
  ctx.fill();

  /* tændt: additivt lys indefra */
  if (lit > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    lg.addColorStop(0.00, rgba(HALO_EDGE, 0.42 * lit));
    lg.addColorStop(0.60, rgba(HALO_CORE, 0.18 * lit));
    lg.addColorStop(1.00, rgba(HALO_CORE, 0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* indre randlinje: bred streg, klippet, så præcis rimW ses indenfor konturen */
  traceStar(ctx, R);
  ctx.lineWidth = outlineW + rimW * 2;
  ctx.strokeStyle = RIM_LINE;
  ctx.stroke();

  ctx.restore();

  /* tynd mørk kontur ovenpå */
  traceStar(ctx, R);
  ctx.lineWidth = outlineW;
  ctx.strokeStyle = INK_LINE;
  ctx.stroke();

  ctx.restore();
}

/* -------------------------------------------------------------- lag: tekst */

/** Glyfboks for den aktuelle font. Falder tilbage til em-brøker uden måling. */
function glyphBox(ctx, text, fs) {
  const mt = ctx.measureText(text);
  const asc = mt && mt.actualBoundingBoxAscent > 0 ? mt.actualBoundingBoxAscent : fs * 0.70;
  const desc = mt && mt.actualBoundingBoxDescent > 0 ? mt.actualBoundingBoxDescent : 0;
  return { asc: asc, desc: desc };
}

/** Guldtekst: skygge → mørk kontur → lodret guldgradient → bevel-højlys. */
function drawGoldText(ctx, text, x, baseY, asc, desc, outlineW) {
  const bevel = Math.max(1, outlineW * 0.30);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  ctx.fillStyle = 'rgba(2,3,12,0.45)';
  ctx.fillText(text, x + outlineW * 0.35, baseY + outlineW * 0.75);

  ctx.lineWidth = outlineW;
  ctx.strokeStyle = INK_LINE;
  ctx.strokeText(text, x, baseY);

  const gr = ctx.createLinearGradient(0, baseY - asc, 0, baseY + desc + 0.01);
  gr.addColorStop(0.00, GOLD_HI);
  gr.addColorStop(0.50, GOLD_MID);
  gr.addColorStop(1.00, GOLD_LO);
  ctx.fillStyle = gr;
  ctx.fillText(text, x, baseY);

  /* bevel: samme glyf forskudt op/venstre i næsten-hvid, lav alfa */
  ctx.fillStyle = 'rgba(255,250,232,0.22)';
  ctx.fillText(text, x - bevel, baseY - bevel);

  ctx.restore();
}

function drawW(ctx, size) {
  const fs = size * 0.62;
  ctx.save();
  ctx.font = W_FONT.replace('%s', fs.toFixed(2));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const g = glyphBox(ctx, 'W', fs);
  const baseY = (g.asc - g.desc) / 2;   // glyffen visuelt centreret om (0,0)
  drawGoldText(ctx, 'W', 0, baseY, g.asc, g.desc, Math.max(1.5, fs * 0.075));
  ctx.restore();
}

function drawMult(ctx, m, size, R) {
  const fs = size * 0.34;
  const label = 'x' + m;
  ctx.save();
  ctx.font = MULT_FONT.replace('%s', fs.toFixed(2));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const g = glyphBox(ctx, label, fs);
  /* glyffernes top overlapper stjernens nederste spids en anelse */
  const baseY = R - fs * 0.12 + g.asc;
  drawGoldText(ctx, label, 0, baseY, g.asc, g.desc, Math.max(1.5, fs * 0.14));
  ctx.restore();
}

/* ------------------------------------------------------------ offentligt */

/**
 * Wild-badge centreret i (cx, cy). size = badgets bredde i CSS-px.
 * opts = { glow = 1, alpha = 1, rotation = 0, lit = 0 }.
 * Ved mult > 1 tegnes 'x' + mult under stjernen (badget bliver højere end size).
 */
export function drawWildBadge(ctx, cx, cy, size, mult, opts) {
  if (!ctx || !(size > 0)) return;
  const o = opts || {};
  const glow = o.glow == null ? 1 : Math.max(0, o.glow);
  const alpha = o.alpha == null ? 1 : o.alpha;
  const rotation = o.rotation || 0;
  const lit = clamp(o.lit == null ? 0 : o.lit, 0, 1.5);
  const m = mult > 1 ? Math.round(mult) : 1;
  const R = size * 0.47;   // spids-til-spids ≈ size inkl. kontur

  ctx.save();
  ctx.translate(cx, cy);
  if (rotation) ctx.rotate(rotation);
  ctx.globalAlpha = ctx.globalAlpha * clamp(alpha, 0, 1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  drawHalo(ctx, R, glow, lit);
  drawStarBody(ctx, R, lit);
  drawW(ctx, size);
  if (m > 1) drawMult(ctx, m, size, R);

  ctx.restore();
}

/* Glimtets farve parses én gang pr. farveskift — partikelsystemet kalder
   med samme farve hundredvis af gange pr. frame.                           */
let glintHex = '#ffffff';
let glintRgb = '255,255,255';

function glintColour(hex) {
  const h = hex || '#ffffff';
  if (h !== glintHex) {
    glintHex = h;
    glintRgb = hexToRgb(h).join(',');
  }
  return glintRgb;
}

/**
 * Firtakket glimt: to tynde, spidse rombespidser (lang lodret, kortere vandret)
 * over en blød radial kerne. Tegnes additivt. size = lodret spids-til-spids.
 */
export function drawGlint(ctx, x, y, size, alpha, rotation, color) {
  if (!ctx || !(size > 0)) return;
  const a = alpha == null ? 1 : alpha;
  if (a <= 0.003) return;
  const rgb = glintColour(color);

  const hv = size * 0.50;                     // lodret halvlængde
  const hh = size * 0.31;                     // vandret halvlængde
  const tv = Math.max(0.5, size * 0.055);     // halv bredde ved kernen
  const th = Math.max(0.5, size * 0.045);

  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = ctx.globalAlpha * clamp(a, 0, 1);

  ctx.beginPath();
  ctx.moveTo(0, -hv);
  ctx.lineTo(tv, 0);
  ctx.lineTo(0, hv);
  ctx.lineTo(-tv, 0);
  ctx.closePath();
  ctx.moveTo(-hh, 0);
  ctx.lineTo(0, -th);
  ctx.lineTo(hh, 0);
  ctx.lineTo(0, th);
  ctx.closePath();
  ctx.fillStyle = 'rgba(' + rgb + ',0.85)';
  ctx.fill();

  const cr = size * 0.17;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
  g.addColorStop(0.00, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(' + rgb + ',0.55)');
  g.addColorStop(1.00, 'rgba(' + rgb + ',0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, cr, 0, TAU);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
