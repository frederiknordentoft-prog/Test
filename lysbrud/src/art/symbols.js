/* LYSBRUD — procedurel symbolkunst.
   Ingen billedfiler: hvert symbol bygges af en eksplicit vertexliste og
   tegnes i lag (glød → krop → facetter → randbånd → spindelvæv → højlys →
   kontur), så silhuetterne er skarpe og ens ved 34 px såvel som 120 px.
   buildSymbolAtlas() prærenderer alt; drawSymbol() er den direkte vej.      */

import { SYMBOL_BY_ID, ALL_SYMBOL_IDS, PALETTE } from '../config.js';

const TAU = Math.PI * 2;

/** Symbolkroppens diameter som brøkdel af sprite-kanten (~12 % luft rundtom). */
const BODY = 0.75;

/** Fælles mørk kerne alle gems trækkes imod. */
const DEEP = '#05061a';

/** Nær-sort kontur der skiller symbolet fra cellen. */
const INK_HARD = 'rgba(3,4,13,0.88)';
const INK_SOFT = 'rgba(2,3,10,0.50)';

const BADGE_FONT = '700 %spx system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

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

/* -------------------------------------------------------------- geometri
   Alle vertexlister lever i enhedsrum: centrum (0,0), y nedad, |v| ≤ ~1.
   Vinkel −π/2 er "op", så formerne står lodret uanset ringrotation.        */

function ring(n, rot, rad) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + rot + i * TAU / n;
    out.push([Math.cos(a) * rad, Math.sin(a) * rad]);
  }
  return out;
}

/** Stjerne med konkave sider: spidser på enhedscirklen, kontrolpunkter indenfor. */
function star(n, rot, ctrlRad) {
  const tips = ring(n, rot, 1);
  const ctrl = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + rot + (i + 0.5) * TAU / n;
    ctrl.push([Math.cos(a) * ctrlRad, Math.sin(a) * ctrlRad]);
  }
  return { tips: tips, ctrl: ctrl };
}

/* tips     : silhuettens hjørner
   ctrl     : ét kontrolpunkt pr. kant (null = rette kanter)
   scale    : formens radius i forhold til kroppens radius
   webInner : radius for den indre forbindelsespolygon i spindelvævet
   table    : valgfri — radius for en lys "tavle" midt i stenen (brillantslib)
   coreTint : valgfri — hvilken mørk farve kernen trækkes imod (default DEEP)
   coreK    : valgfri — hvor hårdt kernen mørknes, 1 = normal               */
const SHAPES = {
  /* smal sekskantet krystal, spids top og bund */
  shard: {
    tips: [[0, -1], [0.52, -0.42], [0.52, 0.42], [0, 1], [-0.52, 0.42], [-0.52, -0.42]],
    ctrl: null, scale: 1.00, webInner: 0.40,
  },
  /* rombe — smal, høj, fire flader */
  rhomb: {
    tips: [[0, -1], [0.64, 0], [0, 1], [-0.64, 0]],
    ctrl: null, scale: 1.00, webInner: 0.38,
  },
  /* ottekantet slebet sten, flad top */
  octagon: { tips: ring(8, Math.PI / 8, 1), ctrl: null, scale: 0.94, webInner: 0.44 },
  /* liggende sekskant — bredere end høj, tydeligt anderledes end oktogonen */
  hexgem: {
    tips: [[-0.55, -0.72], [0.55, -0.72], [1.02, 0], [0.55, 0.72], [-0.55, 0.72], [-1.02, 0]],
    ctrl: null, scale: 0.95, webInner: 0.46,
  },
  /* rund brillant — den eneste sten med LYS kerne. Det er dét der skiller
     den fra oktogonen ved 34 px, og det markerer den som højest betalende. */
  brilliant: {
    tips: ring(12, Math.PI / 12, 1), ctrl: null, scale: 0.92, webInner: 0.54,
    table: 0.40, coreTint: '#0a1440', coreK: 0.92,
  },
  /* nedadpegende trekantskår */
  triangle: {
    tips: [[0, 1], [-0.866, -0.5], [0.866, -0.5]],
    ctrl: null, scale: 1.02, webInner: 0.38,
  },
  webstar:  Object.assign(star(6, 0, 0.30),           { scale: 1.03, webInner: 0.36 }),
  quadstar: Object.assign(star(4, Math.PI / 4, 0.28), { scale: 1.05, webInner: 0.34 }),
  pentstar: Object.assign(star(5, 0, 0.34),           { scale: 1.03, webInner: 0.36 }),
};

/** Guldstjernen inde i wild-medaljonen — fire spidser, dybe konkave sider. */
const WILD_STAR = {
  tips: [[0, -1.04], [0.60, 0.02], [0, 0.98], [-0.60, 0.02]],
  ctrl: [[0.15, -0.15], [0.15, 0.15], [-0.15, 0.15], [-0.15, -0.15]],
  scale: 1, webInner: 0.4,
};

/** Lægger silhuetten som en lukket sti. */
function tracePath(ctx, S, rr) {
  const t = S.tips;
  ctx.beginPath();
  ctx.moveTo(t[0][0] * rr, t[0][1] * rr);
  for (let i = 0; i < t.length; i++) {
    const nx = t[(i + 1) % t.length];
    if (S.ctrl) {
      const c = S.ctrl[i];
      ctx.quadraticCurveTo(c[0] * rr, c[1] * rr, nx[0] * rr, nx[1] * rr);
    } else {
      ctx.lineTo(nx[0] * rr, nx[1] * rr);
    }
  }
  ctx.closePath();
}

/** Punkter PÅ silhuetten: spidser + kurvernes midtpunkter. Bruges til facetter. */
function shapeVerts(S, rr) {
  const out = [], t = S.tips;
  for (let i = 0; i < t.length; i++) {
    out.push([t[i][0] * rr, t[i][1] * rr]);
    if (S.ctrl) {
      const c = S.ctrl[i], n = t[(i + 1) % t.length];
      out.push([
        (0.25 * t[i][0] + 0.5 * c[0] + 0.25 * n[0]) * rr,
        (0.25 * t[i][1] + 0.5 * c[1] + 0.25 * n[1]) * rr,
      ]);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ lag */

/** Additivt farvet halo. Tegnes først, holder sig indenfor sprite-kanten. */
function drawGlow(ctx, colour, oy, half, k) {
  const a = clamp(0.30 * k, 0, 0.85);
  if (a <= 0.004) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, oy, half * 0.05, 0, oy, half);
  g.addColorStop(0, rgba(colour, a));
  g.addColorStop(0.34, rgba(colour, a * 0.46));
  g.addColorStop(0.70, rgba(colour, a * 0.13));
  g.addColorStop(1, rgba(colour, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, oy, half, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Facetplader: trekant fra centrum til hvert nabopar, lys fra øverst venstre. */
function drawFacets(ctx, verts) {
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const a = verts[i], b = verts[(i + 1) % n];
    const mx = (a[0] + b[0]) / 3, my = (a[1] + b[1]) / 3;
    const len = Math.hypot(mx, my) || 1;
    const lit = -(mx / len) * 0.55 - (my / len) * 0.80;
    const k = lit * 0.5 + (i % 2 === 0 ? 0.055 : -0.055);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.closePath();
    ctx.fillStyle = k >= 0
      ? 'rgba(255,255,255,' + (k * 0.34).toFixed(3) + ')'
      : 'rgba(4,6,20,' + (-k * 0.42).toFixed(3) + ')';
    ctx.fill();
  }
}

/** Spindelvæv: to indre polygoner + egere ud til hver spids. */
function drawWeb(ctx, S, rr, edge) {
  const verts = shapeVerts(S, rr);
  const w = Math.max(0.6, rr * 0.045);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const poly = (k, width, colour) => {
    ctx.beginPath();
    for (let i = 0; i < verts.length; i++) {
      const p = verts[i];
      if (i === 0) ctx.moveTo(p[0] * k, p[1] * k);
      else ctx.lineTo(p[0] * k, p[1] * k);
    }
    ctx.closePath();
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.stroke();
  };

  poly(0.76, w * 0.75, rgba(edge, 0.20));
  poly(S.webInner, w * 0.90, rgba(edge, 0.46));

  ctx.beginPath();
  for (let i = 0; i < S.tips.length; i++) {
    const t = S.tips[i];
    ctx.moveTo(0, 0);
    ctx.lineTo(t[0] * rr * 0.93, t[1] * rr * 0.93);
  }
  ctx.lineWidth = w;
  ctx.strokeStyle = rgba(edge, 0.58);
  ctx.stroke();

  /* lyse spidser på egerne */
  ctx.beginPath();
  for (let i = 0; i < S.tips.length; i++) {
    const t = S.tips[i];
    ctx.moveTo(t[0] * rr * 0.58, t[1] * rr * 0.58);
    ctx.lineTo(t[0] * rr * 0.92, t[1] * rr * 0.92);
  }
  ctx.lineWidth = w * 0.8;
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.stroke();

  /* navet */
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(0.7, rr * 0.075), 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.fill();

  ctx.restore();
}

/** Brillantens tavle: stor lys ottekant i midten + kilefacetter ud til randen. */
function drawTable(ctx, S, rr, base, edge) {
  const tr = rr * S.table;
  const T = { tips: ring(8, Math.PI / 8, 1), ctrl: null };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  /* kronens hovedfacetter: hele kiler fra tavlen ud til hvert andet hjørne */
  ctx.beginPath();
  for (let i = 0; i < S.tips.length; i += 2) {
    const t = S.tips[i];
    const len = Math.hypot(t[0], t[1]) || 1;
    ctx.moveTo(t[0] / len * tr * 0.98, t[1] / len * tr * 0.98);
    ctx.lineTo(t[0] * rr * 0.93, t[1] * rr * 0.93);
  }
  ctx.lineWidth = Math.max(0.55, rr * 0.040);
  ctx.strokeStyle = rgba(edge, 0.58);
  ctx.stroke();

  /* korte rundistfacetter imellem hovedfacetterne */
  ctx.beginPath();
  for (let i = 1; i < S.tips.length; i += 2) {
    const t = S.tips[i];
    ctx.moveTo(t[0] * rr * 0.70, t[1] * rr * 0.70);
    ctx.lineTo(t[0] * rr * 0.93, t[1] * rr * 0.93);
  }
  ctx.lineWidth = Math.max(0.5, rr * 0.028);
  ctx.strokeStyle = rgba(edge, 0.22);
  ctx.stroke();

  /* mørk kant under tavlen */
  tracePath(ctx, T, tr);
  ctx.lineWidth = Math.max(0.8, tr * 0.17);
  ctx.strokeStyle = 'rgba(4,5,16,0.55)';
  ctx.stroke();

  /* selve tavlen — halvgennemsigtig, så kernen stadig anes */
  tracePath(ctx, T, tr);
  const tg = ctx.createLinearGradient(-tr * 0.9, -tr, tr * 0.9, tr);
  tg.addColorStop(0.00, rgba(mixHex(edge, '#ffffff', 0.60), 0.96));
  tg.addColorStop(0.46, rgba(edge, 0.60));
  tg.addColorStop(1.00, rgba(base, 0.20));
  ctx.fillStyle = tg;
  ctx.fill();

  ctx.save();
  tracePath(ctx, T, tr);
  ctx.clip();
  drawFacets(ctx, shapeVerts(T, tr));
  ctx.restore();

  tracePath(ctx, T, tr);
  ctx.lineWidth = Math.max(0.5, tr * 0.07);
  ctx.strokeStyle = rgba(edge, 0.85);
  ctx.stroke();

  ctx.restore();
}

/* ----------------------------------------------------------------- gems */

function drawGem(ctx, def, R, dim) {
  const S = SHAPES[def.shape];
  if (!S) return;
  const rr = R * S.scale;

  const base = dim ? mixHex(def.base, PALETTE.cellDark, 0.45) : def.base;
  const edge = dim ? mixHex(def.edge, PALETTE.cellDark, 0.45) : def.edge;
  const glow = dim ? mixHex(def.glow, PALETTE.cellDark, 0.45) : def.glow;

  const tint = S.coreTint || DEEP;
  const kk = S.coreK == null ? 1 : S.coreK;
  const midc = mixHex(base, tint, 0.34 * kk);
  const core = mixHex(base, tint, 0.72 * kk);
  const deep = mixHex(base, tint, 0.88 * kk);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  /* mørk kontur — tegnes under kroppen så kun yderhalvdelen bliver synlig */
  tracePath(ctx, S, rr);
  ctx.lineWidth = Math.max(1, rr * 0.17);
  ctx.strokeStyle = INK_HARD;
  ctx.stroke();

  /* krop: mørk mættet kerne, løftet mod øverste venstre hjørne */
  tracePath(ctx, S, rr);
  const body = ctx.createRadialGradient(-rr * 0.30, -rr * 0.36, rr * 0.04, 0, 0, rr * 1.32);
  body.addColorStop(0, midc);
  body.addColorStop(0.42, core);
  body.addColorStop(1, deep);
  ctx.fillStyle = body;
  ctx.fill();

  /* facetplader */
  ctx.save();
  tracePath(ctx, S, rr);
  ctx.clip();
  drawFacets(ctx, shapeVerts(S, rr));
  ctx.restore();

  /* indre randbånd: lyst øverst til venstre, mørkt nederst til højre */
  ctx.save();
  tracePath(ctx, S, rr);
  ctx.clip();
  tracePath(ctx, S, rr);
  const rim = ctx.createLinearGradient(-rr * 0.85, -rr * 0.95, rr * 0.80, rr * 0.90);
  rim.addColorStop(0.00, mixHex(edge, '#ffffff', 0.30));
  rim.addColorStop(0.28, mixHex(base, edge, 0.60));
  rim.addColorStop(0.60, base);
  rim.addColorStop(1.00, mixHex(base, tint, 0.52 * kk));
  ctx.strokeStyle = rim;
  ctx.lineWidth = rr * 0.34;
  ctx.stroke();
  ctx.restore();

  /* additivt kantlys så randen gløder som i mockuppen */
  ctx.save();
  tracePath(ctx, S, rr);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  tracePath(ctx, S, rr);
  const el = ctx.createLinearGradient(-rr, -rr, rr, rr);
  el.addColorStop(0.00, rgba(edge, 0.50));
  el.addColorStop(0.50, rgba(base, 0.26));
  el.addColorStop(1.00, rgba(glow, 0.12));
  ctx.strokeStyle = el;
  ctx.lineWidth = rr * 0.13;
  ctx.stroke();
  ctx.restore();

  /* spindelvæv — eller brillantslibning, aldrig begge (det bliver til et hjul) */
  if (S.table) {
    ctx.save();
    tracePath(ctx, S, rr);
    ctx.clip();
    drawTable(ctx, S, rr, base, edge);
    ctx.restore();
  } else {
    drawWeb(ctx, S, rr, edge);
  }

  /* specular: blød hvid klat på facetten øverst til venstre */
  ctx.save();
  tracePath(ctx, S, rr);
  ctx.clip();
  const hx = -rr * 0.34, hy = -rr * 0.42, hr = rr * 0.46;
  const sp = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
  sp.addColorStop(0.00, 'rgba(255,255,255,0.58)');
  sp.addColorStop(0.45, 'rgba(255,255,255,0.16)');
  sp.addColorStop(1.00, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, TAU);
  ctx.fill();
  ctx.restore();

  /* skarp yderkant */
  tracePath(ctx, S, rr);
  ctx.lineWidth = Math.max(0.6, rr * 0.05);
  ctx.strokeStyle = INK_SOFT;
  ctx.stroke();

  ctx.restore();
}

/* -------------------------------------------------------- wild-medaljon */

function drawMedallion(ctx, R, dim) {
  const rr = R * 0.98;
  const rOut = rr, rIn = rr * 0.655;
  const rMid = (rOut + rIn) / 2, band = rOut - rIn;

  const g4 = dim ? mixHex(PALETTE.gold4, PALETTE.cellDark, 0.45) : PALETTE.gold4;
  const g3 = dim ? mixHex(PALETTE.gold3, PALETTE.cellDark, 0.45) : PALETTE.gold3;
  const g2 = dim ? mixHex(PALETTE.gold2, PALETTE.cellDark, 0.45) : PALETTE.gold2;
  const g1 = dim ? mixHex(PALETTE.gold1, PALETTE.cellDark, 0.45) : PALETTE.gold1;
  const g0 = PALETTE.gold0;

  ctx.save();
  ctx.lineJoin = 'round';

  /* mørk kontur udenom ringen */
  ctx.beginPath();
  ctx.arc(0, 0, rOut, 0, TAU);
  ctx.lineWidth = Math.max(1, rr * 0.13);
  ctx.strokeStyle = INK_HARD;
  ctx.stroke();

  /* mørk indre skive */
  ctx.beginPath();
  ctx.arc(0, 0, rIn + rr * 0.02, 0, TAU);
  const disc = ctx.createRadialGradient(-rIn * 0.30, -rIn * 0.34, rIn * 0.04, 0, 0, rIn * 1.18);
  disc.addColorStop(0.00, '#1d1533');
  disc.addColorStop(0.55, '#0b0a1e');
  disc.addColorStop(1.00, '#05040f');
  ctx.fillStyle = disc;
  ctx.fill();

  /* selve guldbåndet */
  ctx.beginPath();
  ctx.arc(0, 0, rMid, 0, TAU);
  ctx.lineWidth = band;
  const bg = ctx.createLinearGradient(-rOut * 0.78, -rOut * 0.88, rOut * 0.82, rOut * 0.92);
  bg.addColorStop(0.00, g4);
  bg.addColorStop(0.20, g3);
  bg.addColorStop(0.46, g2);
  bg.addColorStop(0.74, g1);
  bg.addColorStop(1.00, g0);
  ctx.strokeStyle = bg;
  ctx.stroke();

  /* kannelurer: korte radiale streger tværs over båndet */
  const flutes = 20;
  const r0 = rIn + band * 0.16, r1 = rOut - band * 0.16;
  ctx.lineWidth = Math.max(0.6, band * 0.11);
  ctx.lineCap = 'butt';
  for (let i = 0; i < flutes; i++) {
    const a = i * TAU / flutes;
    const c = Math.cos(a), s = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(c * r0, s * r0);
    ctx.lineTo(c * r1, s * r1);
    ctx.strokeStyle = (i % 2 === 0) ? 'rgba(0,0,0,0.26)' : rgba(g4, 0.18);
    ctx.stroke();
  }

  /* bevel: lys yderkant øverst til venstre, lys inderkant nederst til højre */
  ctx.beginPath();
  ctx.arc(0, 0, rOut - band * 0.09, 0, TAU);
  ctx.lineWidth = Math.max(0.7, band * 0.17);
  const bevOut = ctx.createLinearGradient(-rOut, -rOut, rOut, rOut);
  bevOut.addColorStop(0.00, rgba(g4, 0.90));
  bevOut.addColorStop(0.45, rgba(g3, 0.35));
  bevOut.addColorStop(1.00, 'rgba(0,0,0,0.55)');
  ctx.strokeStyle = bevOut;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, rIn + band * 0.11, 0, TAU);
  ctx.lineWidth = Math.max(0.7, band * 0.15);
  const bevIn = ctx.createLinearGradient(-rIn, -rIn, rIn, rIn);
  bevIn.addColorStop(0.00, 'rgba(0,0,0,0.62)');
  bevIn.addColorStop(0.55, rgba(g2, 0.30));
  bevIn.addColorStop(1.00, rgba(g3, 0.70));
  ctx.strokeStyle = bevIn;
  ctx.stroke();

  /* kort hvidt glimt på ringens øverste venstre bue */
  ctx.beginPath();
  ctx.arc(0, 0, rMid, Math.PI * 1.06, Math.PI * 1.48);
  ctx.lineWidth = band * 0.30;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,252,236,0.40)';
  ctx.stroke();

  /* tynd guldbjælke bag stjernen */
  ctx.beginPath();
  ctx.moveTo(-rIn * 0.88, 0);
  ctx.lineTo(rIn * 0.88, 0);
  ctx.lineWidth = Math.max(0.7, rr * 0.035);
  ctx.strokeStyle = rgba(g2, 0.55);
  ctx.stroke();

  /* firtakket guldstjerne */
  const sr = rIn * 0.94;
  ctx.lineJoin = 'round';

  tracePath(ctx, WILD_STAR, sr);
  ctx.lineWidth = Math.max(0.9, sr * 0.17);
  ctx.strokeStyle = 'rgba(4,3,10,0.80)';
  ctx.stroke();

  tracePath(ctx, WILD_STAR, sr);
  const sg = ctx.createLinearGradient(-sr * 0.7, -sr * 0.9, sr * 0.7, sr * 0.9);
  sg.addColorStop(0.00, g4);
  sg.addColorStop(0.32, g3);
  sg.addColorStop(0.66, g2);
  sg.addColorStop(1.00, g1);
  ctx.fillStyle = sg;
  ctx.fill();

  /* facetdeling i stjernen */
  ctx.save();
  tracePath(ctx, WILD_STAR, sr);
  ctx.clip();
  drawFacets(ctx, shapeVerts(WILD_STAR, sr));
  ctx.beginPath();
  ctx.moveTo(0, -sr * 1.02);
  ctx.lineTo(0, sr * 0.96);
  ctx.moveTo(-sr * 0.58, 0);
  ctx.lineTo(sr * 0.58, 0);
  ctx.lineWidth = Math.max(0.5, sr * 0.05);
  ctx.strokeStyle = rgba(g4, 0.55);
  ctx.stroke();
  ctx.restore();

  tracePath(ctx, WILD_STAR, sr);
  ctx.lineWidth = Math.max(0.5, sr * 0.055);
  ctx.strokeStyle = 'rgba(3,3,9,0.45)';
  ctx.stroke();

  ctx.restore();
}

/* --------------------------------------------------------------- prisme
   Oktaeder: to stablede pyramider set skråt ovenfra. Sekskantet silhuet.
   Det forreste ækvatorpunkt W ligger LANGT under midten — det er dét der
   gør at stenen læses som en høj overpyramide og en forkortet underpyramide
   i stedet for en isometrisk terning.                                       */

const PRISM_T  = [0, -1.00];
const PRISM_B  = [0,  1.00];
const PRISM_UL = [-0.58, -0.26];
const PRISM_UR = [ 0.58, -0.26];
const PRISM_LL = [-0.50,  0.10];
const PRISM_LR = [ 0.50,  0.10];
const PRISM_W  = [0, 0.20];

const PRISM_HULL = { tips: [PRISM_T, PRISM_UR, PRISM_LR, PRISM_B, PRISM_LL, PRISM_UL], ctrl: null };

function fillFace(ctx, pts, colour, rr) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p[0] < minx) minx = p[0];
    if (p[0] > maxx) maxx = p[0];
    if (p[1] < miny) miny = p[1];
    if (p[1] > maxy) maxy = p[1];
  }
  const g = ctx.createLinearGradient(minx * rr, miny * rr, maxx * rr + 0.01, maxy * rr + 0.01);
  g.addColorStop(0, mixHex(colour, '#ffffff', 0.24));
  g.addColorStop(1, mixHex(colour, '#070a2e', 0.26));
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * rr, pts[0][1] * rr);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * rr, pts[i][1] * rr);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
}

function drawPrism(ctx, def, R, dim) {
  const rr = R;
  const base = dim ? mixHex(def.base, PALETTE.cellDark, 0.45) : def.base;
  const edge = dim ? mixHex(def.edge, PALETTE.cellDark, 0.45) : def.edge;
  const halo = dim ? mixHex(def.glow, PALETTE.cellDark, 0.45) : def.glow;

  /* Kontrasten er hele pointen: næsten hvid øverst til venstre, mættet blå
     til venstre, mættet violet til højre, dyb skygge nederst.               */
  const lite   = mixHex(edge, '#ffffff', 0.62);
  const blue   = mixHex(base, '#1a52ff', 0.78);
  const violet = mixHex(base, '#a63cff', 0.46);
  const darkB  = mixHex(blue, '#050a30', 0.62);
  const darkV  = mixHex(violet, '#1a0640', 0.58);

  const faces = [
    { p: [PRISM_T,  PRISM_UL, PRISM_W ], c: mixHex(lite, '#bcd4ff', 0.30) },
    { p: [PRISM_T,  PRISM_W,  PRISM_UR], c: mixHex(blue, lite, 0.62) },
    { p: [PRISM_UL, PRISM_LL, PRISM_W ], c: blue },
    { p: [PRISM_UR, PRISM_W,  PRISM_LR], c: violet },
    { p: [PRISM_LL, PRISM_B,  PRISM_W ], c: darkB },
    { p: [PRISM_W,  PRISM_B,  PRISM_LR], c: darkV },
  ];

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  /* mørk kontur under kroppen */
  tracePath(ctx, PRISM_HULL, rr);
  ctx.lineWidth = Math.max(1, rr * 0.15);
  ctx.strokeStyle = INK_HARD;
  ctx.stroke();

  /* facetter */
  for (let i = 0; i < faces.length; i++) fillFace(ctx, faces[i].p, faces[i].c, rr);

  /* hvide facetkanter */
  ctx.save();
  tracePath(ctx, PRISM_HULL, rr);
  ctx.clip();
  const inner = [PRISM_T, PRISM_UL, PRISM_UR, PRISM_LL, PRISM_LR, PRISM_B];
  const spokes = () => {
    ctx.beginPath();
    for (let i = 0; i < inner.length; i++) {
      ctx.moveTo(inner[i][0] * rr, inner[i][1] * rr);
      ctx.lineTo(PRISM_W[0] * rr, PRISM_W[1] * rr);
    }
  };
  /* mørk understregning giver kanterne bid mod de lyse facetter */
  spokes();
  ctx.lineWidth = Math.max(1, rr * 0.075);
  ctx.strokeStyle = 'rgba(10,14,54,0.34)';
  ctx.stroke();
  spokes();
  ctx.lineWidth = Math.max(0.7, rr * 0.042);
  ctx.strokeStyle = 'rgba(255,255,255,0.80)';
  ctx.stroke();

  /* bagsidens kanter anet gennem den gennemsigtige sten */
  ctx.beginPath();
  ctx.moveTo(PRISM_UL[0] * rr, PRISM_UL[1] * rr);
  ctx.lineTo(0, -rr * 0.10);
  ctx.lineTo(PRISM_UR[0] * rr, PRISM_UR[1] * rr);
  ctx.moveTo(PRISM_T[0] * rr, PRISM_T[1] * rr);
  ctx.lineTo(0, -rr * 0.10);
  ctx.lineTo(PRISM_B[0] * rr, PRISM_B[1] * rr);
  ctx.lineWidth = Math.max(0.5, rr * 0.026);
  ctx.strokeStyle = 'rgba(233,242,255,0.22)';
  ctx.stroke();

  /* indre lysning så stenen ser gennemlyst ud og ikke som papir */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const ig = ctx.createRadialGradient(0, -rr * 0.18, rr * 0.04, 0, -rr * 0.18, rr * 1.05);
  ig.addColorStop(0.00, rgba(halo, 0.30));
  ig.addColorStop(0.55, rgba(halo, 0.10));
  ig.addColorStop(1.00, rgba(halo, 0));
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(0, -rr * 0.18, rr * 1.05, 0, TAU);
  ctx.fill();
  ctx.restore();

  /* bloom holdt stramt på den øverste venstre facet, ellers udvaskes stenen */
  const bx = -rr * 0.30, by = -rr * 0.50, br = rr * 0.44;
  const bl = ctx.createRadialGradient(bx, by, 0, bx, by, br);
  bl.addColorStop(0.00, 'rgba(255,255,255,0.60)');
  bl.addColorStop(0.40, 'rgba(232,240,255,0.15)');
  bl.addColorStop(1.00, 'rgba(232,240,255,0)');
  ctx.fillStyle = bl;
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, TAU);
  ctx.fill();
  ctx.restore();

  /* lysende silhuetkant */
  tracePath(ctx, PRISM_HULL, rr);
  ctx.lineWidth = Math.max(0.8, rr * 0.055);
  const eg = ctx.createLinearGradient(-rr, -rr, rr, rr);
  eg.addColorStop(0.00, 'rgba(255,255,255,0.85)');
  eg.addColorStop(0.50, rgba(edge, 0.55));
  eg.addColorStop(1.00, rgba(base, 0.45));
  ctx.strokeStyle = eg;
  ctx.stroke();

  ctx.restore();
}

/* --------------------------------------------------- wild-multiplikator */

function drawWildBadge(ctx, mult, half) {
  const label = 'x' + mult;
  const fs = half * 0.48;
  const cy = half * 0.60;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = BADGE_FONT.replace('%s', fs.toFixed(2));
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  /* blødt gyldent skær bag teksten */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gr = half * 0.40;   // rammer præcis spritens underkant, hvor alfa er 0
  const gl = ctx.createRadialGradient(0, cy, 0, 0, cy, gr);
  gl.addColorStop(0.00, rgba(PALETTE.gold2, 0.42));
  gl.addColorStop(0.55, rgba(PALETTE.gold2, 0.14));
  gl.addColorStop(1.00, rgba(PALETTE.gold2, 0));
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.arc(0, cy, gr, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = fs * 0.30;
  ctx.strokeStyle = 'rgba(3,4,12,0.94)';
  ctx.strokeText(label, 0, cy);

  const tg = ctx.createLinearGradient(0, cy - fs * 0.46, 0, cy + fs * 0.46);
  tg.addColorStop(0.00, PALETTE.gold4);
  tg.addColorStop(0.42, PALETTE.gold3);
  tg.addColorStop(0.58, PALETTE.gold2);
  tg.addColorStop(1.00, PALETTE.gold1);
  ctx.fillStyle = tg;
  ctx.fillText(label, 0, cy);

  ctx.restore();
}

/* ------------------------------------------------------------ offentligt */

export function drawSymbol(ctx, id, cx, cy, size, opts) {
  const def = SYMBOL_BY_ID[id];
  if (!ctx || !def || !(size > 0)) return;

  const o = opts || {};
  const glowK = o.glow == null ? 1 : o.glow;
  const alpha = o.alpha == null ? 1 : o.alpha;
  const rotation = o.rotation || 0;
  const dim = !!o.dim;
  const mult = o.wildMult > 1 ? Math.round(o.wildMult) : 1;
  const badge = def.shape === 'medallion' && mult > 1;

  const half = size * 0.5;
  const R = half * BODY * (badge ? 0.78 : 1);
  const oy = badge ? -half * 0.20 : 0;

  ctx.save();
  ctx.translate(cx, cy);
  if (rotation) ctx.rotate(rotation);
  ctx.globalAlpha = ctx.globalAlpha * clamp(alpha, 0, 1) * (dim ? 0.52 : 1);

  if (!dim && glowK > 0) drawGlow(ctx, def.glow, oy, half, glowK);

  ctx.save();
  ctx.translate(0, oy);
  if (def.shape === 'medallion') drawMedallion(ctx, R, dim);
  else if (def.shape === 'prism') drawPrism(ctx, def, R, dim);
  else drawGem(ctx, def, R, dim);
  ctx.restore();

  if (badge) drawWildBadge(ctx, mult, half);

  ctx.restore();
}

export function buildSymbolAtlas(sizes, dpr) {
  const list = Array.isArray(sizes) ? sizes.slice() : [Number(sizes) || 0];
  const ratio = dpr && dpr > 0 ? dpr : 1;
  const store = new Map();
  const bySize = new Map();   // genbrug sprites når to ringe har samme størrelse

  for (let r = 0; r < list.length; r++) {
    const size = Math.max(8, list[r] || 0);
    const key = size.toFixed(2);
    let set = bySize.get(key);
    if (!set) {
      set = new Map();
      const px = Math.max(8, Math.round(size * ratio));
      for (let k = 0; k < ALL_SYMBOL_IDS.length; k++) {
        const id = ALL_SYMBOL_IDS[k];
        const c = document.createElement('canvas');
        c.width = px;
        c.height = px;
        const g = c.getContext('2d');
        if (!g) continue;
        g.scale(px / size, px / size);
        drawSymbol(g, id, size * 0.5, size * 0.5, size, { glow: 1 });
        set.set(id, c);
      }
      bySize.set(key, set);
    }
    for (const [id, canvas] of set) store.set(id + '@' + r, canvas);
  }

  return {
    get(id, ringIndex) { return store.get(id + '@' + ringIndex) || null; },
    sizes: list,
    dpr: ratio,
  };
}
