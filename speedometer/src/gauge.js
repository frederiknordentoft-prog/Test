/*
 * gauge.js — the speedometer renderer (window.Gauge)
 *
 * Pure function: state → standalone SVG string. No DOM access is needed to
 * render, so the same code drives the live preview, the PNG/SVG exports, the
 * GIF frames and (via Gauge.geometry) the native PPTX shapes.
 *
 * Coordinate system: a 1000 × 640 design space. The dial (arc, trail, needle,
 * hub) is drawn around a nominal hub at (500, 500) and the whole dial + text
 * block (big number, delta chip, label below the hub) is then centred
 * vertically in the canvas — the hub lands at y ≈ 481 in the default layout.
 * When the block does not fit (tall text stack, or the 'card' background's
 * clearance) the dial is scaled down slightly — see computeLayout(). If
 * state.width/height differ from 1000 × 640 the whole drawing is letterboxed
 * into that viewBox, never distorted.
 *
 * Angles: "gauge degrees" are measured counter-clockwise from 3 o'clock.
 *   0 %  → 180° (needle points left)
 *   50 % →  90° (straight up)
 *   100 % →  0° (points right)
 * SVG rotate() is clockwise-positive on screen, so a needle drawn pointing to
 * +x is placed with rotate(-angle).
 *
 * The motion-blur trail is a long-exposure streak of the needle's sweep from
 * prev to value: nested annular sectors build a smooth angular density ramp
 * (faint at prev, dense behind the needle), softened by one Gaussian blur and
 * faded by a radial mask towards the hub and again across the coloured band,
 * with a few tightly packed, fused needle echoes just behind the needle
 * (masked the same way). The crisp needle is always drawn last.
 *
 * Classic script, ES2020, no dependencies. Everything user-facing is Danish.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                           */
  /* ------------------------------------------------------------------ */

  /** Brand colours used inside the artwork (identical in light/dark UI). */
  const COLORS = Object.freeze({
    bad: '#DE3E2E',
    warn: '#F0A62E',
    good: '#1D9C4E',
    needle: '#1C1C1E',
    ink: '#10303B',
    ink3: '#6E8289',
    card2: '#F3F3F1',
    line: '#E1E3E0',
    white: '#FFFFFF'
  });

  /** Fonts inside the exported artwork — system fonts only (see spec). */
  const FONT_SANS = '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
  const FONT_SERIF = 'Georgia, "Times New Roman", serif';

  /**
   * Geometry of the dial in design units. Everything else is derived from
   * these numbers so the PPTX exporter can mirror the artwork exactly.
   */
  const GEOMETRY = Object.freeze({
    W: 1000,
    H: 640,
    cx: 500,
    cy: 500,
    rOuter: 420,
    rInner: 296,
    band: 124,
    gapDeg: 2.4,            // radial gap between segments
    needleLen: 372,         // hub centre → tip
    needleBaseHalf: 15,     // half-width at the hub
    needleTipHalf: 3.5,     // half-width at the (rounded) tip
    needleTail: 34,         // counterweight length behind the hub
    needleTailHalf: 11,     // half-width at the end of the tail
    hubR: 44,               // black disc
    ringR: 31,              // white ring radius (stroke centre)
    ringStroke: 9,
    tickLen: 14,            // prev-marker triangle outside the arc
    tickGap: 4,
    wedgeInner: 52,         // hubR + 8   (sweep wedge radii, mirrored by the PPTX export)
    wedgeOuter: 366,        // needleLen − 6
    chipH: 44,
    chipOffset: 96,         // chip centre below the hub centre (default layout)
    chipFontSize: 28,
    numberOffset: 78,       // big-number centre below the hub centre
    numberFontSize: 88,
    labelFontSize: 24,
    cardInset: 20,
    cardRadius: 28,
    cardPad: 24,            // minimum clearance between the artwork and the card's inner edge
    padTop: 20,             // minimum margins used when the layout has to compress
    padBottom: 22,
    /* Trail tuning */
    trailMinDeg: 0.4,        // no trail below this sweep
    wedgeOpacity: 0.07,      // streak density at prev (the swept-area wedge)
    trailDensity: 0.5,      // streak density just behind the needle (× trailStrength)
    trailGamma: 1.5,         // density curve: D(t) ∝ t^gamma (dense near the needle)
    // Needle echoes: [degrees behind the needle, opacity]. Packed ≤ 1.2° apart
    // and blurred hard (trailEchoBlur) so they fuse into one soft shadow of the
    // sweep instead of a comb of separate needles over the coloured band.
    trailEchoes: [[1.1, 0.13], [2.2, 0.11], [3.3, 0.09], [4.4, 0.07], [5.5, 0.055], [6.6, 0.04]],
    trailEchoBlur: 5.5,
    // Radial trail mask: fully faded at the hub, solid through the interior,
    // fading again across the band (from rInner to the needle tip) so the band
    // only picks up a soft shadow of the sweep.
    trailBandFade: 0.22,     // mask opacity at the needle tip
    colors: COLORS
  });

  /** Default state — the full shape app.js persists. */
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
    height: 640,
    /* Extension (used by animationFrames): value the trail starts from. null → prev. */
    trailFrom: null
  });

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /** Clamp to 0–100 and coerce anything non-numeric to 0. */
  function pct(v) {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? clamp(n, 0, 100) : 0;
  }

  /** Compact number formatting for SVG attributes. */
  function num(n) {
    return (Math.round(n * 100) / 100).toString();
  }

  /** Escape text for use inside SVG/XML. */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Mix a hex colour towards white by `amount` (0–1). */
  function lighten(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (shift) => {
      const c = (n >> shift) & 255;
      return Math.round(c + (255 - c) * amount);
    };
    const toHex = (c) => c.toString(16).padStart(2, '0');
    return '#' + toHex(ch(16)) + toHex(ch(8)) + toHex(ch(0));
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
   */
  function formatDelta(value, prev) {
    const d = Math.round((pct(value) - pct(prev)) * 10) / 10;
    if (d > 0) return { delta: d, direction: 'up', text: '▲ +' + formatNumber(d) + ' pp' };
    if (d < 0) return { delta: d, direction: 'down', text: '▼ −' + formatNumber(-d) + ' pp' };
    return { delta: 0, direction: 'flat', text: '● ±0 pp' };
  }

  /* ------------------------------------------------------------------ */
  /* Public maths                                                        */
  /* ------------------------------------------------------------------ */

  /** 0 % → 180°, 100 % → 0° (counter-clockwise from 3 o'clock). */
  function valueToAngle(v) {
    return 180 - pct(v) * 1.8;
  }

  /** Which colour band a value falls into. */
  function segmentFor(v, thresholds) {
    const t = normalizeThresholds(thresholds);
    const x = pct(v);
    if (x < t[0]) return 'bad';
    if (x < t[1]) return 'warn';
    return 'good';
  }

  function normalizeThresholds(thresholds) {
    const src = Array.isArray(thresholds) ? thresholds : DEFAULTS.thresholds;
    let a = pct(src[0]);
    let b = pct(src[1]);
    if (a > b) { const tmp = a; a = b; b = tmp; }
    return [a, b];
  }

  const ease = Object.freeze({
    /** Standard ease-out. */
    outCubic(t) {
      t = clamp(t, 0, 1);
      return 1 - Math.pow(1 - t, 3);
    },
    /**
     * Under-damped spring, at rest at t = 0, one overshoot of ≈ 3 % of the
     * travel peaking around t = 0.55, settled (< 0.1 %) by t = 1.
     */
    spring(t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      const zeta = 0.745;           // damping ratio → e^(−ζπ/√(1−ζ²)) ≈ 0.03 overshoot
      const wd = 5.71;              // damped frequency: first peak at π/wd ≈ 0.55
      const sigma = zeta * wd / Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-sigma * t) * (Math.cos(wd * t) + (sigma / wd) * Math.sin(wd * t));
    }
  });

  /* ------------------------------------------------------------------ */
  /* State + layout                                                      */
  /* ------------------------------------------------------------------ */

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
    s.trailFrom = (s.trailFrom == null || !Number.isFinite(+s.trailFrom)) ? null : pct(+s.trailFrom);
    return s;
  }

  /**
   * Vertical layout in the 1000 × 640 design space.
   *
   * The dial needs 440 px above the hub centre (arc + prev tick) and hubR
   * below it. The text stack below the hub is drawn unscaled. The whole
   * block (dial + stack) is centred vertically in the canvas, so the top and
   * bottom margins are always equal (≈ 41 px in the default chip-only
   * layout, hub at y ≈ 481). If the block does not fit within the minimum
   * margins — padTop / padBottom, or cardInset + cardPad when the 'card'
   * background is drawn — the dial is scaled by `s` (< 1) about its hub.
   *
   * pptx-export.js mirrors this function (and prefers Gauge.layout at
   * runtime) so the native slide lines up with the PNG.
   */
  function computeLayout(st) {
    const G = GEOMETRY;
    const dialAbove = G.rOuter + G.tickGap + G.tickLen + 2; // 440
    const dialBelow = G.hubR;
    const card = st.background === 'card';
    const padTop = card ? G.cardInset + G.cardPad : G.padTop;
    const padBottom = card ? G.cardInset + G.cardPad : G.padBottom;

    // Measure the text stack (independent of scale).
    let cursor = 0; // distance below the hub's bottom edge
    let numberBaseline = null;
    let chipCy = null;
    let labelBaseline = null;
    const hasLabel = st.label.length > 0;
    if (st.showValue) {
      cursor += 4;
      numberBaseline = cursor + 64;             // cap-height of 88 px Georgia ≈ 62
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
    const s = clamp(avail / (dialAbove + dialBelow), 0.5, 1);
    const block = (dialAbove + dialBelow) * s + stack;      // dial + text, scaled
    const top = (G.H - block) / 2;                          // equal margins
    const hubY = top + dialAbove * s;
    const hubBottom = hubY + dialBelow * s;

    return {
      scale: s,
      hubX: G.cx,
      hubY,
      hubBottom,
      top,
      bottom: top + block,
      numberY: numberBaseline == null ? null : hubBottom + numberBaseline,
      chipY: chipCy == null ? null : hubBottom + chipCy,
      labelY: labelBaseline == null ? null : hubBottom + labelBaseline,
      stackHeight: stack
    };
  }

  /* ------------------------------------------------------------------ */
  /* Path builders                                                       */
  /* ------------------------------------------------------------------ */

  /** Point on a circle around the hub at gauge angle `deg`. */
  function polar(r, deg) {
    const a = (deg * Math.PI) / 180;
    return [GEOMETRY.cx + r * Math.cos(a), GEOMETRY.cy - r * Math.sin(a)];
  }

  /**
   * Annular sector between gauge angles aFrom → aTo (either direction),
   * radii rIn..rOut, with straight radial cuts.
   */
  function annularSectorPath(aFrom, aTo, rIn, rOut) {
    const span = Math.abs(aFrom - aTo);
    if (span < 0.01 || rOut <= rIn) return '';
    const sweep = aTo < aFrom ? 1 : 0;        // decreasing gauge angle = clockwise on screen
    const large = span > 180 ? 1 : 0;
    const [ox1, oy1] = polar(rOut, aFrom);
    const [ox2, oy2] = polar(rOut, aTo);
    const [ix1, iy1] = polar(rIn, aFrom);
    const [ix2, iy2] = polar(rIn, aTo);
    return (
      'M' + num(ox1) + ' ' + num(oy1) +
      ' A' + rOut + ' ' + rOut + ' 0 ' + large + ' ' + sweep + ' ' + num(ox2) + ' ' + num(oy2) +
      ' L' + num(ix2) + ' ' + num(iy2) +
      ' A' + rIn + ' ' + rIn + ' 0 ' + large + ' ' + (1 - sweep) + ' ' + num(ix1) + ' ' + num(iy1) +
      ' Z'
    );
  }

  /**
   * Needle silhouette in local coordinates: hub at the origin, tip on +x.
   * Tapered body with a rounded tip and a short counterweight tail.
   */
  function needlePath() {
    const G = GEOMETRY;
    const L = G.needleLen;
    const th = G.needleTipHalf;
    return (
      'M' + (-G.needleTail) + ' ' + (-G.needleTailHalf) +
      ' L0 ' + (-G.needleBaseHalf) +
      ' L' + (L - th) + ' ' + (-th) +
      ' A' + th + ' ' + th + ' 0 0 1 ' + (L - th) + ' ' + th +
      ' L0 ' + G.needleBaseHalf +
      ' L' + (-G.needleTail) + ' ' + G.needleTailHalf +
      ' Z'
    );
  }

  /** Ghost silhouette: the needle body without the counterweight tail. */
  function ghostPath() {
    const G = GEOMETRY;
    const L = G.needleLen;
    const th = G.needleTipHalf;
    return (
      'M0 ' + (-G.needleBaseHalf) +
      ' L' + (L - th) + ' ' + (-th) +
      ' A' + th + ' ' + th + ' 0 0 1 ' + (L - th) + ' ' + th +
      ' L0 ' + G.needleBaseHalf +
      ' Z'
    );
  }

  /** Transform that puts a local (+x pointing) shape at a gauge angle. */
  function atAngle(deg) {
    return 'translate(' + GEOMETRY.cx + ' ' + GEOMETRY.cy + ') rotate(' + num(-deg) + ')';
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  let renderCounter = 0;

  /** Unique id prefix per render so several gauges can share a document. */
  function makeIdPrefix() {
    renderCounter += 1;
    return 'g' + renderCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /**
   * Render the gauge.
   * @param {object} state  partial state, merged over Gauge.defaults
   * @returns {string} standalone <svg> markup
   */
  function render(state) {
    const st = normalizeState(state);
    const G = GEOMETRY;
    const id = makeIdPrefix();
    const classic = st.style === 'classic';
    const L = computeLayout(st);

    const needleD = needlePath();
    const angleNow = valueToAngle(st.value);
    const anglePrev = valueToAngle(st.prev);
    const angleFrom = valueToAngle(st.trailFrom == null ? st.prev : st.trailFrom);

    const defs = [];
    const body = [];

    /* ---- background ---------------------------------------------- */
    if (st.background === 'white') {
      body.push('<rect x="0" y="0" width="' + G.W + '" height="' + G.H + '" fill="' + COLORS.white + '"/>');
    } else if (st.background === 'card') {
      const i = G.cardInset;
      body.push(
        '<rect x="' + (i + 0.5) + '" y="' + (i + 0.5) + '" width="' + (G.W - 2 * i - 1) + '" height="' + (G.H - 2 * i - 1) +
        '" rx="' + G.cardRadius + '" ry="' + G.cardRadius + '" fill="' + COLORS.card2 + '" stroke="' + COLORS.line + '" stroke-width="1"/>'
      );
    }

    /* ---- filters + gradients ------------------------------------- */
    const filterBox = 'x="-50%" y="-50%" width="200%" height="200%"';
    if (classic) {
      defs.push(
        '<filter id="' + id + '-arc-shadow" ' + filterBox + '>' +
        '<feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000000" flood-opacity="0.10"/></filter>',
        '<filter id="' + id + '-needle-shadow" ' + filterBox + '>' +
        '<feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.28"/></filter>',
        '<linearGradient id="' + id + '-needle-grad" gradientUnits="userSpaceOnUse" x1="0" y1="' + (-G.needleBaseHalf) + '" x2="0" y2="' + G.needleBaseHalf + '">' +
        '<stop offset="0" stop-color="#303033"/><stop offset="0.55" stop-color="#1C1C1E"/><stop offset="1" stop-color="#141416"/></linearGradient>'
      );
      for (const key of ['bad', 'warn', 'good']) {
        defs.push(
          '<radialGradient id="' + id + '-grad-' + key + '" gradientUnits="userSpaceOnUse" cx="' + G.cx + '" cy="' + G.cy + '" r="' + G.rOuter + '">' +
          '<stop offset="' + num(G.rInner / G.rOuter) + '" stop-color="' + COLORS[key] + '"/>' +
          '<stop offset="1" stop-color="' + lighten(COLORS[key], 0.08) + '"/></radialGradient>'
        );
      }
    }

    /* ---- dial group (scaled/shifted by the layout) ---------------- */
    const dial = [];
    const dialTransform =
      L.scale === 1 && L.hubY === G.cy && L.hubX === G.cx
        ? ''
        : ' transform="translate(' + num(L.hubX) + ' ' + num(L.hubY) + ') scale(' + num(L.scale) + ') translate(' + (-G.cx) + ' ' + (-G.cy) + ')"';

    /* Arc segments: bad [0,t1) · warn [t1,t2) · good [t2,100] with 2.4° radial gaps. */
    const [t1, t2] = st.thresholds;
    const half = G.gapDeg / 2;
    const segs = [
      { key: 'bad', a: valueToAngle(0), b: valueToAngle(t1), first: true, last: false },
      { key: 'warn', a: valueToAngle(t1), b: valueToAngle(t2), first: false, last: false },
      { key: 'good', a: valueToAngle(t2), b: valueToAngle(100), first: false, last: true }
    ];
    // Gauge angle decreases with value; each interior boundary is shortened by
    // half a gap. A segment without visible extent (threshold at 0/100, or
    // t1 = t2) is skipped – and a boundary only gets its half gap when a drawn
    // segment lies beyond it, so the arc still ends flat at 0 % and 100 %.
    const visible = segs.map((seg) => (seg.first ? seg.a : seg.a - half) - (seg.last ? seg.b : seg.b + half) >= 0.05);
    const arcShapes = [];
    segs.forEach((seg, i) => {
      if (!visible[i]) return;
      const a = visible.slice(0, i).some(Boolean) ? seg.a - half : seg.a;
      const b = visible.slice(i + 1).some(Boolean) ? seg.b + half : seg.b;
      const d = annularSectorPath(a, b, G.rInner, G.rOuter);
      const fill = classic ? 'url(#' + id + '-grad-' + seg.key + ')' : COLORS[seg.key];
      arcShapes.push('<path d="' + d + '" fill="' + fill + '"/>');
    });
    dial.push('<g' + (classic ? ' filter="url(#' + id + '-arc-shadow)"' : '') + '>' + arcShapes.join('') + '</g>');

    /* Motion-blur trail --------------------------------------------- */
    const delta = angleNow - angleFrom;
    const absDelta = Math.abs(delta);
    if (st.showTrail && absDelta >= G.trailMinDeg) {
      const strength = st.trailStrength;
      // Short streaks (a nearly-settled needle) fade so they never read as a doubled needle.
      const fade = clamp(0.3 + 0.7 * (absDelta / 4), 0, 1);
      const tipPxPerDeg = (Math.PI / 180) * G.needleLen;
      // 0 = very short sweep (fast needle mid-animation, or a small move) … 1 = ≥ 12°.
      const short = clamp(absDelta / 12, 0, 1);

      /*
       * The streak is the area the needle swept, shaded like a long exposure:
       * faint where the needle moved fast (near prev), dense where it slowed
       * down (just behind the current needle). SVG has no angular gradient, so
       * the shading is built from K nested annular sectors that all end at the
       * current angle and start progressively later. Each layer adds a small,
       * equal step of density, so the composite follows D(t) exactly at the
       * layer boundaries, with no seams (every layer edge starts from a fully
       * covered region) and no visible steps after a light blur. A radial mask
       * fades the streak out towards the hub, where every sweep would
       * otherwise pile up into a dark blot.
       */
      // Short sweeps get a denser, flatter streak: with the long-sweep curve
      // (base 7 %, t^1.5) the dense part of a 6–8° streak sits within ~1° of
      // the needle, hidden under its body, and the visible remainder is too
      // faint to read as motion. Sweeps ≥ 12° use the long-exposure curve.
      const D0 = lerp(0.2, G.wedgeOpacity, short) * clamp(strength, 0.5, 1.5) * fade;   // density at prev
      const Dmax = clamp(G.trailDensity * strength * fade, D0 + 0.02, 0.85); // density behind the needle
      const gamma = lerp(0.8, G.trailGamma, short);
      const K = clamp(Math.round(absDelta * 0.6), 8, 48);
      const rIn = 0;                                   // under the hub, masked anyway
      const rOut = G.needleLen - G.needleTipHalf;
      const layers = [];
      layers.push('<path d="' + annularSectorPath(angleFrom, angleNow, rIn, rOut) + '" fill="' + COLORS.needle + '" fill-opacity="' + num(D0) + '"/>');
      let prevD = D0;
      let widestPx = 0;
      let prevT = 0;
      for (let k = 1; k <= K; k++) {
        const tStart = Math.pow((k - 1) / K, 1 / gamma);     // where this layer begins
        const targetD = D0 + (Dmax - D0) * (k / K);           // composite density after it
        const alpha = (targetD - prevD) / (1 - prevD);
        prevD = targetD;
        widestPx = Math.max(widestPx, (tStart - prevT) * absDelta * tipPxPerDeg);
        prevT = tStart;
        const a = angleFrom + delta * tStart;
        layers.push('<path d="' + annularSectorPath(a, angleNow, rIn, rOut) + '" fill="' + COLORS.needle + '" fill-opacity="' + num(alpha) + '"/>');
      }
      // Blur just enough to melt the steps between layers (wider steps → softer).
      const blur = clamp(widestPx / 3, 2.5, 9);
      // Radial mask: faded at the hub (every sweep would pile up there),
      // solid through the interior, then fading across the band from rInner
      // to the needle tip so the streak ends softly instead of on a hard arc
      // and the band only carries a light shadow of the sweep.
      defs.push(
        '<filter id="' + id + '-trail-blur" ' + filterBox + '><feGaussianBlur stdDeviation="' + num(blur) + '"/></filter>',
        '<radialGradient id="' + id + '-trail-fade" gradientUnits="userSpaceOnUse" cx="' + G.cx + '" cy="' + G.cy + '" r="' + G.needleLen + '">' +
        '<stop offset="' + num(G.hubR / G.needleLen) + '" stop-color="#FFFFFF" stop-opacity="0.15"/>' +
        '<stop offset="0.55" stop-color="#FFFFFF" stop-opacity="1"/>' +
        '<stop offset="' + num(G.rInner / G.needleLen) + '" stop-color="#FFFFFF" stop-opacity="1"/>' +
        '<stop offset="1" stop-color="#FFFFFF" stop-opacity="' + num(G.trailBandFade) + '"/></radialGradient>',
        '<mask id="' + id + '-trail-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="' + G.W + '" height="' + G.H + '">' +
        '<rect x="0" y="0" width="' + G.W + '" height="' + G.H + '" fill="url(#' + id + '-trail-fade)"/></mask>'
      );
      const trailGroup = ['<g filter="url(#' + id + '-trail-blur)">' + layers.join('') + '</g>'];

      // Needle echoes: a few silhouettes packed tightly behind the needle
      // (fixed angular offsets ≤ 1.2° apart, not sweep fractions) and blurred
      // hard enough to fuse into one soft shadow of the sweep — never a fan of
      // separate needles over the coloured band. They are solid-filled (a
      // gradient fill inside the blur filter leaves blocky raster artefacts in
      // Chromium) and share the radial trail mask for the hub-side fade.
      // Skipped for short sweeps where they would overlap prev.
      if (absDelta >= 9) {
        const ghostD = ghostPath();
        const ghosts = [];
        const dir = delta > 0 ? 1 : -1;
        for (const [behindDeg, op] of G.trailEchoes) {
          if (behindDeg > absDelta * 0.9) continue;   // never reach past prev
          ghosts.push(
            '<path d="' + ghostD + '" fill="' + COLORS.needle + '" fill-opacity="' + num(clamp(op * strength * fade, 0, 1)) +
            '" transform="' + atAngle(angleNow - dir * behindDeg) + '"/>'
          );
        }
        if (ghosts.length) {
          defs.push('<filter id="' + id + '-echo-blur" ' + filterBox + '><feGaussianBlur stdDeviation="' + num(G.trailEchoBlur) + '"/></filter>');
          trailGroup.push('<g filter="url(#' + id + '-echo-blur)">' + ghosts.join('') + '</g>');
        }
      }
      dial.push('<g mask="url(#' + id + '-trail-mask)">' + trailGroup.join('') + '</g>');
    }

    /* Prev marker: dashed outline needle + small tick outside the arc. */
    if (st.showPrevMarker) {
      const tickIn = G.rOuter + G.tickGap;
      const tickOut = tickIn + G.tickLen;
      dial.push(
        '<g transform="' + atAngle(anglePrev) + '">' +
        '<path d="' + needleD + '" fill="none" stroke="' + COLORS.needle + '" stroke-width="2" stroke-opacity="0.35" stroke-dasharray="8 6" stroke-linejoin="round"/>' +
        '<path d="M' + tickIn + ' 0 L' + tickOut + ' -8 L' + tickOut + ' 8 Z" fill="' + COLORS.needle + '" fill-opacity="0.45"/>' +
        '</g>'
      );
    }

    /* The needle — always last, always crisp. */
    const needleFill = classic ? 'url(#' + id + '-needle-grad)' : COLORS.needle;
    dial.push(
      '<g' + (classic ? ' filter="url(#' + id + '-needle-shadow)"' : '') + '>' +
      '<path d="' + needleD + '" fill="' + needleFill + '" transform="' + atAngle(angleNow) + '"/>' +
      '</g>'
    );

    /* Hub: black disc, white ring, black core. */
    dial.push(
      '<circle cx="' + G.cx + '" cy="' + G.cy + '" r="' + G.hubR + '" fill="' + COLORS.needle + '"/>' +
      '<circle cx="' + G.cx + '" cy="' + G.cy + '" r="' + G.ringR + '" fill="none" stroke="' + COLORS.white + '" stroke-width="' + G.ringStroke + '"/>'
    );

    body.push('<g' + dialTransform + '>' + dial.join('') + '</g>');

    /* ---- text stack below the hub -------------------------------- */
    if (st.showValue) {
      body.push(
        '<text x="' + G.cx + '" y="' + num(L.numberY) + '" text-anchor="middle" font-family="' + esc(FONT_SERIF) + '" font-weight="700" font-size="' + G.numberFontSize + '" fill="' + COLORS.ink + '">' +
        esc(formatValue(st.value)) + '</text>'
      );
    }
    if (st.showDelta) {
      const d = formatDelta(st.value, st.prev);
      const colour = d.direction === 'up' ? COLORS.good : d.direction === 'down' ? COLORS.bad : COLORS.ink3;
      const w = chipWidth(d.text, G.chipFontSize);
      const x = G.cx - w / 2;
      const y = L.chipY - G.chipH / 2;
      body.push(
        '<rect x="' + num(x) + '" y="' + num(y) + '" width="' + num(w) + '" height="' + G.chipH + '" rx="' + (G.chipH / 2) + '" ry="' + (G.chipH / 2) +
        '" fill="' + colour + '" fill-opacity="0.12" stroke="' + colour + '" stroke-opacity="0.4" stroke-width="1"/>' +
        '<text x="' + G.cx + '" y="' + num(L.chipY + 10) + '" text-anchor="middle" font-family="' + esc(FONT_SANS) + '" font-weight="600" font-size="' + G.chipFontSize + '" fill="' + colour + '">' +
        esc(d.text) + '</text>'
      );
    }
    if (st.label) {
      body.push(
        '<text x="' + G.cx + '" y="' + num(L.labelY) + '" text-anchor="middle" font-family="' + esc(FONT_SANS) + '" font-weight="500" font-size="' + G.labelFontSize +
        '" letter-spacing="' + num(G.labelFontSize * 0.12) + '" fill="' + COLORS.ink3 + '">' +
        esc(st.label.toLocaleUpperCase('da-DK')) + '</text>'
      );
    }

    /* ---- assemble -------------------------------------------------- */
    // Letterbox the 1000 × 640 design into the requested viewBox (never distort).
    const k = Math.min(st.width / G.W, st.height / G.H);
    const ox = (st.width - G.W * k) / 2;
    const oy = (st.height - G.H * k) / 2;
    const rootTransform = k === 1 && ox === 0 && oy === 0 ? '' : ' transform="translate(' + num(ox) + ' ' + num(oy) + ') scale(' + num(k) + ')"';

    const title = 'Speedometer: ' + formatValue(st.value) + ' (forrige ' + formatValue(st.prev) + ')';
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + num(st.width) + '" height="' + num(st.height) + '" viewBox="0 0 ' + num(st.width) + ' ' + num(st.height) +
      '" role="img" aria-label="' + esc(title) + '">' +
      '<title>' + esc(title) + '</title>' +
      (defs.length ? '<defs>' + defs.join('') + '</defs>' : '') +
      '<g' + rootTransform + '>' + body.join('') + '</g>' +
      '</svg>'
    );
  }

  /** Estimate the pill width for the chip text in a 600-weight system sans. */
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

  /** Cheap live update: replaces the element's content with a fresh render. */
  function mount(el, state) {
    if (!el) return '';
    const svg = render(state);
    el.innerHTML = svg;
    return svg;
  }

  /* ------------------------------------------------------------------ */
  /* Animation                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Per-frame states for the prev → value spring animation.
   *
   * Returns `frames` motion frames followed by `hold` static frames
   * (frames + hold states in total). Defaults: 38 motion + 13 hold frames at
   * 25 fps — a 40 ms frame period, i.e. a whole number of GIF centiseconds,
   * so the exported GIF and the on-screen playback run at exactly the same
   * speed (≈ 2.04 s). During motion the needle follows
   * prev + (value − prev) × ease.spring(t); the trail runs from where the
   * needle was ≈ 0.12 s earlier (velocity streak). As the spring settles the
   * trail origin eases back to `prev`, so the last motion frame is identical
   * to the static render and the hold frames continue seamlessly.
   */
  function animationFrames(state, opts) {
    const o = Object.assign({ frames: 38, fps: 25, hold: 13 }, opts || {});
    const frames = Math.max(1, Math.round(o.frames));
    const hold = Math.max(0, Math.round(o.hold));
    const fps = o.fps > 0 ? o.fps : 25;
    const st = normalizeState(state);
    const out = [];

    const travel = st.value - st.prev;
    const duration = frames / fps;              // seconds of motion
    const lag = duration > 0 ? 0.12 / duration : 0; // 0.12 s in normalised time (3 frames at 25 fps)

    for (let k = 0; k < frames; k++) {
      const t = frames > 1 ? k / (frames - 1) : 1;
      const pos = st.prev + travel * ease.spring(t);
      const tail = st.prev + travel * ease.spring(Math.max(0, t - lag));
      const settle = smoothstep((t - 0.62) / 0.38);  // velocity streak → full prev→value trail
      const from = lerp(tail, st.prev, settle);
      out.push(Object.assign({}, st, {
        value: clamp(pos, 0, 100),
        trailFrom: st.showTrail ? clamp(from, 0, 100) : null
      }));
    }
    for (let k = 0; k < hold; k++) {
      out.push(Object.assign({}, st, { trailFrom: null }));
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                              */
  /* ------------------------------------------------------------------ */

  global.Gauge = {
    defaults: DEFAULTS,
    geometry: GEOMETRY,
    colors: COLORS,
    render,
    mount,
    layout: (state) => computeLayout(normalizeState(state)),
    normalize: normalizeState,
    valueToAngle,
    segmentFor,
    ease,
    animationFrames,
    formatNumber,
    formatValue,
    formatDelta
  };
})(typeof window !== 'undefined' ? window : globalThis);
