/*
 * pptx-export.js — window.PptxExport
 *
 * Builds a native, fully editable PowerPoint version of the speedometer with
 * PptxGenJS (loaded from a CDN by index.html — optional, the rest of the app
 * works without it). Every element of the SVG artwork becomes a real
 * PowerPoint shape: the three arc segments, the sweep wedge, the ghost
 * needles of the motion trail, the previous-position marker, the needle, the
 * hub rings, the delta chip, the big number and the label. Positions are
 * derived from the same geometry as the SVG (Gauge.geometry when gauge.js is
 * loaded, otherwise the identical constants below), so slide 1 looks like the
 * exported PNG while staying editable — colours, text and fonts can be
 * changed in PowerPoint afterwards. Slide 2 carries the transparent PNG.
 *
 * Public API (see SPEC.md, "PPTX export"):
 *   PptxExport.available() → boolean
 *       true when a PptxGenJS constructor is reachable (window.PptxGenJS).
 *   PptxExport.build(state, {includeNativeSlide = true, includeImageSlide = true, title = ''}) → Promise<Blob>
 *       Resolves with the .pptx as a Blob. Rejects if PptxGenJS is missing.
 *
 * Extra optional options (additions, not deviations from the spec):
 *   opts.PptxGenJS     constructor to use instead of the global (node tests).
 *   opts.imageDataUrl  PNG data URL for slide 2, used instead of asking
 *                      window.Exporters.pngDataUrl (node tests / pre-rendered).
 *
 * Coordinate systems
 *   Design space: 1000 × 640 px, nominal hub at (500, 500), centred by the
 *   layout (hub at y ≈ 481 by default) — identical to gauge.js.
 *   The design is mapped onto a 6.4 in wide box centred on a 16:9 slide
 *   (10 × 5.625 in), i.e. 1 px = 0.0064 in.
 *
 *   Angles: the SVG measures gauge angles counter-clockwise from 3 o'clock
 *   (0 % = 180°, 100 % = 0°). PowerPoint measures clockwise from 3 o'clock,
 *   so a value v maps to the PowerPoint angle 180 + 1.8·v (0 % = 180° =
 *   9 o'clock, 50 % = 270° = 12 o'clock, 100 % = 360° = 3 o'clock). The top
 *   half of a block arc is therefore the range 180 → 360.
 *
 *   Rotation: PowerPoint rotates a shape about its own centre, clockwise.
 *   The needle is an upright isosceles triangle (apex up = 50 %), rotated by
 *   θ = 1.8·v − 90 (0 % → −90 = left, 100 % → +90 = right). To make the base
 *   of the triangle sit on the hub after rotation, the shape centre is placed
 *   at C = H + R(θ)·(0, −h/2) = (hubX + (h/2)·sin θ, hubY − (h/2)·cos θ).
 *   See needleBox().
 *
 * Runs as a classic script in the browser (window.PptxExport) and as a
 * CommonJS module in node (module.exports) so it can be unit-tested with the
 * node build of PptxGenJS.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                           */
  /* ------------------------------------------------------------------ */

  const SLIDE_W = 10;       // LAYOUT_16x9 width, inches
  const SLIDE_H = 5.625;    // LAYOUT_16x9 height, inches
  const BOX_W = 6.4;        // artwork width on the slide, inches
  const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

  /** Fonts inside the slide. PowerPoint substitutes automatically when missing. */
  const FONT_SERIF = 'Georgia';
  const FONT_SANS = 'Segoe UI';

  /** Brand colours (hex without '#', as PptxGenJS wants them). */
  const FALLBACK_COLORS = Object.freeze({
    bad: 'DE3E2E',
    warn: 'F0A62E',
    good: '1D9C4E',
    needle: '1C1C1E',
    ink: '10303B',
    ink3: '6E8289',
    card2: 'F3F3F1',
    line: 'E1E3E0',
    white: 'FFFFFF'
  });

  /**
   * Geometry of the dial in design px. Kept identical to gauge.js so the two
   * renderers agree; Gauge.geometry overrides these when gauge.js is loaded.
   */
  const FALLBACK_GEOMETRY = Object.freeze({
    W: 1000,
    H: 640,
    cx: 500,
    cy: 500,
    rOuter: 420,
    rInner: 296,
    gapDeg: 2.4,            // radial gap between arc segments
    needleLen: 372,         // hub centre → tip
    needleBaseHalf: 15,     // half-width at the hub
    needleTipHalf: 3.5,
    needleTail: 34,
    hubR: 44,               // black disc
    ringR: 31,              // white ring radius (stroke centre)
    ringStroke: 9,
    tickLen: 14,            // prev-marker tick outside the arc
    tickGap: 4,
    wedgeInner: 52,         // hubR + 8
    wedgeOuter: 366,        // needleLen − 6
    chipH: 44,
    chipFontSize: 28,
    numberFontSize: 88,
    labelFontSize: 24,
    cardInset: 20,
    cardRadius: 28,
    cardPad: 24,            // clearance between the artwork and the card's inner edge
    padTop: 20,
    padBottom: 22,
    trailMinDeg: 0.4
  });

  /** Default state (mirrors Gauge.defaults). */
  const DEFAULTS = Object.freeze({
    value: 62,
    prev: 48,
    thresholds: [33.3, 66.7],
    showTrail: true,
    trailStrength: 1,
    showPrevMarker: true,
    showDelta: true,
    showValue: false,
    label: '',
    background: 'transparent',
    style: 'classic',
    width: 1000,
    height: 640
  });

  /* Ghost needles of the trail: count range and opacity ramp (spec). */
  const GHOST_MIN = 8;
  const GHOST_MAX = 14;
  const GHOST_SPACING_DEG = 2.5;
  const GHOST_OPACITY_FAR = 0.03;    // transparency 97 at prev …
  const GHOST_OPACITY_NEAR = 0.28;   // … 72 just behind the needle
  const WEDGE_OPACITY = 0.08;        // transparency 92

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const round = (n, digits = 4) => Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);

  /** Clamp to 0–100; accepts numbers or Danish strings ("62,5"). */
  function pct(v) {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? clamp(n, 0, 100) : 0;
  }

  /** Normalise degrees into [0, 360). */
  function normDeg(d) {
    return ((d % 360) + 360) % 360;
  }

  /** 'DE3E2E' from '#DE3E2E' / 'de3e2e'. */
  function hex(c) {
    return String(c).replace(/^#/, '').toUpperCase();
  }

  /** Danish number formatting: max one decimal, comma as separator. */
  function formatNumber(v) {
    const r = Math.round(v * 10) / 10;
    if (Number.isInteger(r)) return String(r);
    return r.toFixed(1).replace('.', ',');
  }

  /** "62 %" with a non-breaking space (Danish typography). */
  function formatValue(v) {
    return formatNumber(pct(v)) + ' %';
  }

  /**
   * Delta between value and prev in procentpoint.
   * Returns { delta, direction: 'up'|'down'|'flat', text: '▲ +14 pp' }.
   * Uses a true minus sign (U+2212) like the SVG.
   */
  function formatDelta(value, prev) {
    const d = Math.round((pct(value) - pct(prev)) * 10) / 10;
    if (d > 0) return { delta: d, direction: 'up', text: '▲ +' + formatNumber(d) + ' pp' };
    if (d < 0) return { delta: d, direction: 'down', text: '▼ −' + formatNumber(-d) + ' pp' };
    return { delta: 0, direction: 'flat', text: '● ±0 pp' };
  }

  /** Pill width estimate for the chip text (same heuristic as gauge.js). */
  function chipWidth(text, fontSize) {
    let em = 0;
    for (const ch of text) {
      if (ch === '▲' || ch === '▼') em += 0.9;
      else if (ch === '●') em += 0.8;
      else if (ch === ' ' || ch === ',') em += 0.3;
      else if (ch === '+' || ch === '−' || ch === '±') em += 0.62;
      else if (/[0-9]/.test(ch)) em += 0.6;
      else em += 0.62;
    }
    return Math.round(em * fontSize + 2 * 22);
  }

  /* ------------------------------------------------------------------ */
  /* Library / geometry resolution                                       */
  /* ------------------------------------------------------------------ */

  /** The PptxGenJS constructor: explicit option → global (browser) → bare global. */
  function resolveLib(opts) {
    if (opts && typeof opts.PptxGenJS === 'function') return opts.PptxGenJS;
    if (global && typeof global.PptxGenJS === 'function') return global.PptxGenJS;
    /* eslint-disable no-undef */
    if (typeof PptxGenJS === 'function') return PptxGenJS;
    /* eslint-enable no-undef */
    return null;
  }

  /** Geometry + colours: Gauge.geometry when present, otherwise the fallback. */
  function resolveGeometry() {
    const gauge = global && global.Gauge;
    const geo = gauge && gauge.geometry && typeof gauge.geometry === 'object' ? gauge.geometry : null;
    const G = Object.assign({}, FALLBACK_GEOMETRY, geo || {});
    const colors = Object.assign({}, FALLBACK_COLORS);
    if (geo && geo.colors && typeof geo.colors === 'object') {
      for (const key of Object.keys(colors)) {
        if (typeof geo.colors[key] === 'string') colors[key] = hex(geo.colors[key]);
      }
    }
    G.colors = colors;
    return G;
  }

  /* ------------------------------------------------------------------ */
  /* State + layout (mirrors gauge.js)                                   */
  /* ------------------------------------------------------------------ */

  function normalizeThresholds(thresholds) {
    const src = Array.isArray(thresholds) ? thresholds : DEFAULTS.thresholds;
    let a = pct(src[0]);
    let b = pct(src[1]);
    if (a > b) { const tmp = a; a = b; b = tmp; }
    return [a, b];
  }

  /** Fill in defaults and sanitise every field. */
  function normalizeState(state) {
    const s = Object.assign({}, DEFAULTS, state || {});
    s.value = pct(s.value);
    s.prev = pct(s.prev);
    s.thresholds = normalizeThresholds(s.thresholds);
    s.trailStrength = Number.isFinite(+s.trailStrength) ? clamp(+s.trailStrength, 0.25, 2) : 1;
    s.showTrail = !!s.showTrail;
    s.showPrevMarker = !!s.showPrevMarker;
    s.showDelta = !!s.showDelta;
    s.showValue = !!s.showValue;
    s.label = s.label == null ? '' : String(s.label).trim();
    s.background = ['transparent', 'white', 'card'].includes(s.background) ? s.background : 'transparent';
    s.style = s.style === 'flat' ? 'flat' : 'classic';
    s.width = Number.isFinite(+s.width) && +s.width > 0 ? +s.width : DEFAULTS.width;
    s.height = Number.isFinite(+s.height) && +s.height > 0 ? +s.height : DEFAULTS.height;
    return s;
  }

  /**
   * Vertical layout in the 1000 × 640 design space. When gauge.js is loaded
   * the result comes straight from Gauge.layout() so the native slide and
   * the PNG can never drift apart; otherwise this is a faithful copy of
   * gauge.js computeLayout().
   *
   * The dial needs rOuter + tick above the hub and hubR below it; the text
   * stack (number / chip / label) sits below, unscaled. The whole block is
   * centred vertically (equal margins, hub at y ≈ 481 by default). When it
   * does not fit within the minimum margins (padTop/padBottom, or
   * cardInset + cardPad for the 'card' background) the dial is scaled by
   * `scale` about its hub.
   */
  function computeLayout(st, G) {
    const gauge = global && global.Gauge;
    if (gauge && typeof gauge.layout === 'function') {
      try {
        const L = gauge.layout(st);
        if (L && Number.isFinite(L.hubY) && Number.isFinite(L.scale)) {
          return {
            scale: L.scale,
            hubX: Number.isFinite(L.hubX) ? L.hubX : G.cx,
            hubY: L.hubY,
            numberY: L.numberY == null ? null : L.numberY,
            chipY: L.chipY == null ? null : L.chipY,
            labelY: L.labelY == null ? null : L.labelY
          };
        }
      } catch (_) { /* fall back to the local copy */ }
    }
    const dialAbove = G.rOuter + G.tickGap + G.tickLen + 2; // 440
    const dialBelow = G.hubR;
    const card = st.background === 'card';
    const padTop = card ? G.cardInset + G.cardPad : G.padTop;
    const padBottom = card ? G.cardInset + G.cardPad : G.padBottom;

    let cursor = 0; // distance below the hub's bottom edge
    let numberBaseline = null;
    let chipCy = null;
    let labelBaseline = null;
    const hasLabel = st.label.length > 0;
    if (st.showValue) {
      cursor += 4;
      numberBaseline = cursor + 64;
      cursor = numberBaseline + ((st.showDelta || hasLabel) ? 20 : 0);
    }
    if (st.showDelta) {
      if (!st.showValue) cursor += 30;
      chipCy = cursor + G.chipH / 2;
      cursor += G.chipH;
    }
    if (hasLabel) {
      cursor += st.showDelta ? 16 : 12;
      labelBaseline = cursor + 18;
      cursor += 18;
    }
    const stack = cursor;

    const avail = G.H - padTop - padBottom - stack;
    const scale = clamp(avail / (dialAbove + dialBelow), 0.5, 1);
    const block = (dialAbove + dialBelow) * scale + stack;   // dial + text, scaled
    const hubY = (G.H - block) / 2 + dialAbove * scale;       // equal margins
    const hubBottom = hubY + dialBelow * scale;

    return {
      scale,
      hubX: G.cx,
      hubY,
      numberY: numberBaseline == null ? null : hubBottom + numberBaseline,
      chipY: chipCy == null ? null : hubBottom + chipCy,
      labelY: labelBaseline == null ? null : hubBottom + labelBaseline
    };
  }

  /* ------------------------------------------------------------------ */
  /* Slide 1 — native shapes                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Draw the gauge as editable shapes on a new slide.
   * @param {object} pptx   PptxGenJS presentation
   * @param {object} st     normalised state
   * @param {object} G      geometry (+ colours)
   * @param {string} title  optional slide title
   */
  function addNativeSlide(pptx, st, G, title) {
    const C = G.colors;
    const slide = pptx.addSlide();
    slide.background = { color: C.white };

    /* Design px → slide inches. */
    const k = BOX_W / G.W;
    const boxX = (SLIDE_W - BOX_W) / 2;
    const boxY = (SLIDE_H - G.H * k) / 2;
    const X = (px) => round(boxX + px * k);
    const Y = (py) => round(boxY + py * k);
    const S = (px) => round(px * k);
    const PT = (px) => round(px * k * 72, 2);   // px → points (text sizes)

    const L = computeLayout(st, G);
    const s = L.scale;                          // dial scale (1 unless the text stack is tall)
    const hub = { x: L.hubX, y: L.hubY };
    const classic = st.style === 'classic';

    /** PowerPoint angle (clockwise from 3 o'clock) for a value. */
    const pptAngle = (v) => 180 + pct(v) * 1.8;

    /**
     * Bounding box + rotation for an upright triangle whose base midpoint
     * must land on the hub after PowerPoint rotates it about its centre.
     * θ = 1.8·v − 90 (clockwise); direction from hub to tip = (sin θ, −cos θ).
     */
    function needleBox(value, lenPx, halfWidthPx) {
      const theta = pct(value) * 1.8 - 90;
      const rad = (theta * Math.PI) / 180;
      const h = lenPx;
      const w = 2 * halfWidthPx;
      const cxPx = hub.x + (h / 2) * Math.sin(rad);
      const cyPx = hub.y - (h / 2) * Math.cos(rad);
      return { x: X(cxPx - w / 2), y: Y(cyPx - h / 2), w: S(w), h: S(h), rotate: round(normDeg(theta), 2) };
    }

    /** Square bounding box of a circle of radius r (design px) around the hub. */
    function hubSquare(r) {
      return { x: X(hub.x - r), y: Y(hub.y - r), w: S(2 * r), h: S(2 * r) };
    }

    /** Block arc between two PowerPoint angles, outer radius rOut, inner rIn. */
    function addArc(name, aFrom, aTo, rOut, rIn, fill, shadow) {
      if (aTo - aFrom < 0.05 || rOut <= rIn) return;
      const opts = Object.assign(hubSquare(rOut), {
        angleRange: [round(aFrom, 3), round(aTo, 3)],
        arcThicknessRatio: round((rOut - rIn) / rOut, 5),
        fill,
        objectName: name
      });
      if (shadow) opts.shadow = shadow;
      slide.addShape(pptx.ShapeType.blockArc, opts);
    }

    /* ---- optional title ------------------------------------------ */
    if (title) {
      slide.addText(String(title), {
        x: 0.5, y: 0.28, w: SLIDE_W - 1, h: 0.5,
        fontFace: FONT_SERIF, fontSize: 20, color: C.ink,
        align: 'left', valign: 'top', margin: 0, lang: 'da-DK',
        objectName: 'Titel'
      });
    }

    /* ---- card background (mirrors background:'card') --------------- */
    if (st.background === 'card') {
      const i = G.cardInset;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: X(i), y: Y(i), w: S(G.W - 2 * i), h: S(G.H - 2 * i),
        rectRadius: S(G.cardRadius),
        fill: { color: C.card2 },
        line: { color: C.line, width: 0.75 },
        objectName: 'Kort baggrund'
      });
    }

    /* ---- arc segments: red (left) · amber · green (right) ---------- */
    const [t1, t2] = st.thresholds;
    const half = G.gapDeg / 2;
    const rOut = G.rOuter * s;
    const rIn = G.rInner * s;
    // A soft shadow under the arc in the classic style (SVG: dy 4, blur 10, 10 %).
    const arcShadow = () => (classic
      ? { type: 'outer', blur: 5, offset: 1.5, angle: 90, color: '000000', opacity: 0.12 }
      : null);
    // Interior boundaries are shortened by half a gap; the outer ends stay at
    // exactly 180° and 360° so the baseline is flat, like the SVG. A segment
    // without extent (threshold at 0/100, or t1 = t2) is skipped, and a
    // boundary only gets its half gap when a drawn segment lies beyond it.
    const arcs = [
      { name: 'Bue rød (0–' + formatNumber(t1) + ' %)', a: pptAngle(0), b: pptAngle(t1), color: C.bad },
      { name: 'Bue gul (' + formatNumber(t1) + '–' + formatNumber(t2) + ' %)', a: pptAngle(t1), b: pptAngle(t2), color: C.warn },
      { name: 'Bue grøn (' + formatNumber(t2) + '–100 %)', a: pptAngle(t2), b: pptAngle(100), color: C.good }
    ];
    const visible = arcs.map((arc, i) => (i === arcs.length - 1 ? arc.b : arc.b - half) - (i === 0 ? arc.a : arc.a + half) >= 0.05);
    arcs.forEach((arc, i) => {
      if (!visible[i]) return;
      const from = visible.slice(0, i).some(Boolean) ? arc.a + half : arc.a;
      const to = visible.slice(i + 1).some(Boolean) ? arc.b - half : arc.b;
      addArc(arc.name, from, to, rOut, rIn, { color: arc.color }, arcShadow());
    });

    /* ---- motion trail: sweep wedge + ghost needles ----------------- */
    const deltaDeg = (st.value - st.prev) * 1.8;
    const absDelta = Math.abs(deltaDeg);
    if (st.showTrail && absDelta >= G.trailMinDeg) {
      const strength = clamp(st.trailStrength, 0.5, 1.5);

      // Sweep wedge: the swept annulus between the two needle positions.
      const lo = Math.min(st.value, st.prev);
      const hi = Math.max(st.value, st.prev);
      addArc('Bevægelsesspor – flade', pptAngle(lo), pptAngle(hi), G.wedgeOuter * s, G.wedgeInner * s,
        { color: C.needle, transparency: Math.round(100 - WEDGE_OPACITY * 100 * strength) }, null);

      // Ghost needles, dense just behind the current needle (ease-out
      // spacing), faint near prev and increasingly opaque towards the needle.
      const N = clamp(Math.round((absDelta / GHOST_SPACING_DEG) * strength), GHOST_MIN, GHOST_MAX);
      const endFrac = 1 - Math.min(0.06, 1.2 / absDelta);  // last ghost ≈ 1.2° before the needle
      for (let i = 0; i < N; i++) {
        const t = N === 1 ? 1 : i / (N - 1);
        const pos = (1 - Math.pow(1 - t, 1.6)) * endFrac;
        const v = st.prev + (st.value - st.prev) * pos;
        const opacity = clamp(lerp(GHOST_OPACITY_FAR, GHOST_OPACITY_NEAR, t * t) * strength, 0.01, 0.45);
        slide.addShape(pptx.ShapeType.triangle, Object.assign(
          needleBox(v, G.needleLen * s, G.needleBaseHalf * s),
          {
            fill: { color: C.needle, transparency: Math.round(100 - opacity * 100) },
            objectName: 'Bevægelsesspor ' + String(i + 1).padStart(2, '0')
          }
        ));
      }
    }

    /* ---- previous position: dashed outline needle + tick ----------- */
    if (st.showPrevMarker) {
      slide.addShape(pptx.ShapeType.triangle, Object.assign(
        needleBox(st.prev, G.needleLen * s, G.needleBaseHalf * s),
        {
          fill: { color: C.needle, transparency: 100 },
          line: { color: C.needle, width: 1, dashType: 'dash', transparency: 60 },
          objectName: 'Forrige position (' + formatValue(st.prev) + ')'
        }
      ));
      // Small triangle just outside the arc, apex pointing inward at prev.
      const thetaPrev = st.prev * 1.8 - 90;
      const rad = (thetaPrev * Math.PI) / 180;
      const rTick = (G.rOuter + G.tickGap + G.tickLen / 2) * s;
      const tw = 16 * s;
      const th = G.tickLen * s;
      const cxPx = hub.x + rTick * Math.sin(rad);
      const cyPx = hub.y - rTick * Math.cos(rad);
      slide.addShape(pptx.ShapeType.triangle, {
        x: X(cxPx - tw / 2), y: Y(cyPx - th / 2), w: S(tw), h: S(th),
        rotate: round(normDeg(thetaPrev + 180), 2),
        fill: { color: C.needle, transparency: 55 },
        objectName: 'Forrige position – mærke'
      });
    }

    /* ---- the needle ------------------------------------------------ */
    const needleOpts = Object.assign(
      needleBox(st.value, G.needleLen * s, G.needleBaseHalf * s),
      { fill: { color: C.needle }, objectName: 'Nål (' + formatValue(st.value) + ')' }
    );
    if (classic) {
      needleOpts.shadow = { type: 'outer', blur: 4, offset: 2, angle: 90, color: '000000', opacity: 0.3 };
    }
    slide.addShape(pptx.ShapeType.triangle, needleOpts);

    /* ---- hub: black disc, white ring, black core ------------------- */
    const ringOuter = G.ringR + G.ringStroke / 2;   // 35.5
    const ringInner = G.ringR - G.ringStroke / 2;   // 26.5
    slide.addShape(pptx.ShapeType.ellipse, Object.assign(hubSquare(G.hubR * s), { fill: { color: C.needle }, objectName: 'Nav – skive' }));
    slide.addShape(pptx.ShapeType.ellipse, Object.assign(hubSquare(ringOuter * s), { fill: { color: C.white }, objectName: 'Nav – ring' }));
    slide.addShape(pptx.ShapeType.ellipse, Object.assign(hubSquare(ringInner * s), { fill: { color: C.needle }, objectName: 'Nav – kerne' }));

    /* ---- text stack below the hub ---------------------------------- */
    if (st.showValue && L.numberY != null) {
      // Text boxes centre their content; the SVG places the baseline at
      // numberY. For Georgia the line box centre sits ≈ 0.35 em above the baseline.
      const fs = G.numberFontSize;
      const boxH = fs * 1.3;
      slide.addText(formatValue(st.value), {
        x: X(G.cx - 300), y: Y(L.numberY - 0.35 * fs - boxH / 2), w: S(600), h: S(boxH),
        fontFace: FONT_SERIF, fontSize: PT(fs), bold: true, color: C.ink,
        align: 'center', valign: 'middle', margin: 0, lang: 'da-DK',
        objectName: 'Værdi'
      });
    }

    if (st.showDelta && L.chipY != null) {
      const d = formatDelta(st.value, st.prev);
      const colour = d.direction === 'up' ? C.good : d.direction === 'down' ? C.bad : C.ink3;
      const w = chipWidth(d.text, G.chipFontSize) + 6;   // a little slack for font metrics
      const h = G.chipH;
      slide.addText(d.text, {
        shape: pptx.ShapeType.roundRect,
        x: X(G.cx - w / 2), y: Y(L.chipY - h / 2), w: S(w), h: S(h),
        rectRadius: S(h / 2),
        fill: { color: colour, transparency: 88 },
        line: { color: colour, width: 0.75, transparency: 60 },
        fontFace: FONT_SANS, fontSize: PT(G.chipFontSize), bold: true, color: colour,
        align: 'center', valign: 'middle', margin: 0, lang: 'da-DK',
        objectName: 'Ændring (' + d.text + ')'
      });
    }

    if (st.label && L.labelY != null) {
      const fs = G.labelFontSize;
      const boxH = fs * 1.4;
      slide.addText(st.label.toLocaleUpperCase('da-DK'), {
        x: X(G.cx - 400), y: Y(L.labelY - 0.35 * fs - boxH / 2), w: S(800), h: S(boxH),
        fontFace: FONT_SANS, fontSize: PT(fs), color: C.ink3,
        charSpacing: PT(fs * 0.12),
        align: 'center', valign: 'middle', margin: 0, lang: 'da-DK',
        objectName: 'Undertekst'
      });
    }

    slide.addNotes(
      'Speedometer: nu ' + formatValue(st.value) + ', forrige ' + formatValue(st.prev) +
      ' (' + formatDelta(st.value, st.prev).text + '). Alle elementer er redigerbare figurer.'
    );
    return slide;
  }

  /* ------------------------------------------------------------------ */
  /* Slide 2 — the PNG                                                   */
  /* ------------------------------------------------------------------ */

  /** Resolve the PNG data URL for slide 2, or null if none can be produced. */
  async function resolveImage(st, opts) {
    if (opts && typeof opts.imageDataUrl === 'string' && /^data:image\//.test(opts.imageDataUrl)) {
      return opts.imageDataUrl;
    }
    const ex = global && global.Exporters;
    if (!ex || typeof ex.pngDataUrl !== 'function') return null;
    try {
      const url = await ex.pngDataUrl(st, { scale: 3 });
      return typeof url === 'string' && /^data:image\//.test(url) ? url : null;
    } catch (err) {
      // The native slide is the deliverable; a failed rasterisation must not
      // sink the whole export.
      if (global && global.console) global.console.warn('PptxExport: billedslide sprunget over –', err);
      return null;
    }
  }

  function addImageSlide(pptx, st, dataUrl, title) {
    const slide = pptx.addSlide();
    slide.background = { color: FALLBACK_COLORS.white };
    if (title) {
      slide.addText(String(title), {
        x: 0.5, y: 0.28, w: SLIDE_W - 1, h: 0.5,
        fontFace: FONT_SERIF, fontSize: 20, color: FALLBACK_COLORS.ink,
        align: 'left', valign: 'top', margin: 0, lang: 'da-DK',
        objectName: 'Titel'
      });
    }
    const w = BOX_W;
    const h = round(BOX_W * (st.height / st.width));
    slide.addImage({
      data: dataUrl,
      x: round((SLIDE_W - w) / 2), y: round((SLIDE_H - h) / 2), w, h,
      objectName: 'Speedometer (billede)'
    });
    slide.addNotes('Speedometer som gennemsigtigt PNG-billede (3× opløsning). Se forrige slide for den redigerbare udgave.');
    return slide;
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  /** True when PptxGenJS is loaded (window.PptxGenJS in the browser). */
  function available() {
    return typeof resolveLib(null) === 'function';
  }

  /** Make sure we hand back a Blob with the right MIME type. */
  function toBlob(out) {
    if (typeof Blob === 'undefined') return out;              // very old hosts: pass through
    if (out instanceof Blob && out.type === PPTX_MIME) return out;
    return new Blob([out], { type: PPTX_MIME });
  }

  /**
   * Build the presentation.
   * @param {object} state  gauge state (partial, merged over defaults)
   * @param {object} [opts] {includeNativeSlide, includeImageSlide, title, PptxGenJS, imageDataUrl}
   * @returns {Promise<Blob>} the .pptx file
   */
  async function build(state, opts) {
    const o = Object.assign({ includeNativeSlide: true, includeImageSlide: true, title: '' }, opts || {});
    const Lib = resolveLib(o);
    if (typeof Lib !== 'function') {
      throw new Error('PptxGenJS er ikke indlæst – PPTX-eksport kræver internetforbindelse første gang.');
    }
    const G = resolveGeometry();
    const st = normalizeState(state);
    const title = o.title == null ? '' : String(o.title).trim();

    const pptx = new Lib();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = title || 'Speedometer';
    pptx.subject = 'Speedometer ' + formatValue(st.value) + ' (forrige ' + formatValue(st.prev) + ')';
    pptx.author = 'Speedometer til PowerPoint';

    let slides = 0;
    if (o.includeNativeSlide !== false) {
      addNativeSlide(pptx, st, G, title);
      slides += 1;
    }
    if (o.includeImageSlide !== false) {
      const dataUrl = await resolveImage(st, o);
      if (dataUrl) {
        addImageSlide(pptx, st, dataUrl, title);
        slides += 1;
      }
    }
    // Never emit an empty deck: fall back to the native slide.
    if (slides === 0) addNativeSlide(pptx, st, G, title);

    const out = await pptx.write({ outputType: 'blob' });
    return toBlob(out);
  }

  const api = Object.freeze({
    available,
    build,
    /* Exposed for tests / reuse. */
    formatDelta,
    formatValue,
    computeLayout,
    normalizeState,
    geometry: resolveGeometry
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.PptxExport = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
