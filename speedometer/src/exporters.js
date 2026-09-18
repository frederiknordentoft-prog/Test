/**
 * exporters.js — window.Exporters
 *
 * Turns a gauge state (see window.Gauge) into things you can put into a
 * PowerPoint: an SVG string, a PNG blob, a data URL, an animated GIF, and
 * the plumbing to download or copy them.
 *
 * Runtime contract (all classic-script globals, no modules):
 *   - window.Gauge   (src/gauge.js)     — Gauge.render / Gauge.animationFrames / Gauge.defaults
 *   - window.gifenc  (vendor/gifenc.js) — GIFEncoder / quantize / applyPalette
 *
 * Public API (spec "Exporters" section):
 *   Exporters.svgString(state)                          → string
 *   Exporters.svgToPngBlob(svg, {scale, background})    → Promise<Blob>
 *   Exporters.pngDataUrl(state, {scale, background})    → Promise<string>
 *   Exporters.saveFile(filename, blob)                  → Promise<void>
 *   Exporters.copyPng(blob | Promise<Blob>)             → Promise<boolean>
 *   Exporters.filename(state, ext)                      → string
 *   Exporters.gifBlob(state, {...})                     → Promise<Blob>
 *   Exporters.svgBlob(state)                            → Blob   (small convenience extra)
 *
 * All user-facing strings (error messages that the UI may surface) are in
 * Danish; every error carries a machine-readable `code` property.
 */
(function (global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SVG_MIME = 'image/svg+xml;charset=utf-8';
  const DEFAULT_VIEWBOX = { width: 1000, height: 640 };

  /** Palette-key format handed to gifenc. rgb565 keeps more tonal steps than
   *  rgb444, which matters for the soft blur/shadow gradients in the trail. */
  const GIF_FORMAT = 'rgb565';
  const GIF_MAX_COLORS = 256;
  /** Card fill token (--card-2) used when a GIF background of 'card' is requested. */
  const CARD_FILL = '#F3F3F1';

  // ---------------------------------------------------------------------------
  // Small utilities
  // ---------------------------------------------------------------------------

  /** Error with a stable `code` so app.js can branch without parsing text. */
  function makeError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
  }

  function clamp(n, lo, hi) {
    return n < lo ? lo : n > hi ? hi : n;
  }

  /** Finite number or fallback (accepts numeric strings with ',' or '.'). */
  function num(v, fallback) {
    if (typeof v === 'string') v = parseFloat(v.replace(',', '.'));
    return Number.isFinite(v) ? v : fallback;
  }

  /** The gauge renderer, or a clear error when gauge.js has not loaded. */
  function gauge() {
    const G = global.Gauge;
    if (!G || typeof G.render !== 'function') {
      throw makeError('gauge-missing', 'Speedometeret (Gauge) er ikke indlæst.');
    }
    return G;
  }

  /** State merged over Gauge.defaults so partial states are always complete. */
  function fullState(state) {
    const G = gauge();
    return Object.assign({}, G.defaults || {}, state || {});
  }

  /** One macrotask of breathing room so the UI can paint a progress bar. */
  function yieldToEventLoop() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  // ---------------------------------------------------------------------------
  // SVG string handling
  // ---------------------------------------------------------------------------

  /** Locate the root <svg …> opening tag; returns {index, tag} or null. */
  function rootTag(svg) {
    const m = /<svg\b[^>]*>/i.exec(svg);
    return m ? { index: m.index, tag: m[0] } : null;
  }

  /** Read one attribute from an opening tag (double or single quoted). */
  function attrOf(tag, name) {
    const re = new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i');
    const m = re.exec(tag);
    return m ? (m[1] !== undefined ? m[1] : m[2]) : null;
  }

  /**
   * Intrinsic size of an SVG string: the viewBox if present, else its
   * width/height attributes, else the gauge default (1000 × 640).
   */
  function svgSize(svg) {
    const root = rootTag(svg);
    if (root) {
      const vb = attrOf(root.tag, 'viewBox');
      if (vb) {
        const parts = vb.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          return { width: parts[2], height: parts[3] };
        }
      }
      const w = parseFloat(attrOf(root.tag, 'width'));
      const h = parseFloat(attrOf(root.tag, 'height'));
      if (w > 0 && h > 0) return { width: w, height: h };
    }
    return { width: DEFAULT_VIEWBOX.width, height: DEFAULT_VIEWBOX.height };
  }

  /**
   * Return the SVG with explicit px width/height on the root element (and an
   * xmlns if it is missing). Browsers rasterise an <img> SVG at its
   * *intrinsic* size — Safari in particular ignores drawImage scaling for the
   * vector pass and would give a blurry upscale — so the exporters always set
   * the root size to the exact pixel size they are about to draw.
   */
  function withRootSize(svg, width, height) {
    const root = rootTag(svg);
    if (!root) throw makeError('svg-invalid', 'SVG-markup mangler et <svg>-element.');
    let tag = root.tag.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
    if (!/\sxmlns\s*=/i.test(tag)) tag = tag.replace(/^<svg/i, '<svg xmlns="' + SVG_NS + '"');
    tag = tag.replace(/\s*\/?>$/, (end) => ' width="' + width + '" height="' + height + '"' + end.trim());
    return svg.slice(0, root.index) + tag + svg.slice(root.index + root.tag.length);
  }

  // ---------------------------------------------------------------------------
  // Rasterisation (SVG → canvas)
  // ---------------------------------------------------------------------------

  /** Load an image from a URL, resolving once it is fully decoded. */
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(makeError('svg-render', 'Kunne ikke tegne speedometeret som billede.'));
      img.src = url;
    }).then(async (img) => {
      // Safari can fire `load` before the SVG is actually decodable; decode()
      // guarantees the bitmap is ready for drawImage. Failures are harmless
      // here (the image did load), so we swallow them.
      if (typeof img.decode === 'function') {
        try { await img.decode(); } catch (_) { /* ignore */ }
      }
      return img;
    });
  }

  /**
   * Draw an SVG string onto a canvas at exactly width × height px.
   * `background` (CSS colour) is filled first when given; null keeps alpha.
   * The canvas is created unless one is supplied (the GIF path reuses one).
   * A Blob URL (not a data URL) keeps the canvas untainted in every browser.
   */
  async function drawSvg(svg, { width, height, background = null, canvas = null }) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const sized = withRootSize(svg, w, h);
    const blob = new Blob([sized], { type: SVG_MIME });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const target = canvas || document.createElement('canvas');
      if (target.width !== w) target.width = w;
      if (target.height !== h) target.height = h;
      const ctx = target.getContext('2d', canvas ? { willReadFrequently: true } : undefined);
      if (!ctx) throw makeError('canvas', 'Din browser understøtter ikke canvas-tegning.');
      ctx.clearRect(0, 0, w, h);
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      return target;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** canvas.toBlob as a promise (rejects if the browser returns null). */
  function canvasToBlob(canvas, type = 'image/png') {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(makeError('png-encode', 'Kunne ikke danne PNG-billedet.'));
      }, type);
    });
  }

  /** Blob → data URL. */
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(makeError('read', 'Kunne ikke læse billeddata.'));
      reader.readAsDataURL(blob);
    });
  }

  // ---------------------------------------------------------------------------
  // Public: SVG / PNG
  // ---------------------------------------------------------------------------

  /**
   * Standalone SVG markup for the state, with width/height in px on the root
   * (PowerPoint and image viewers need them; the viewBox stays as rendered).
   * @param {object} state  gauge state (partial states are merged over defaults)
   * @param {{width?:number, height?:number}} [opts]  optional px size override
   * @returns {string}
   */
  function svgString(state, opts = {}) {
    const svg = gauge().render(fullState(state));
    const size = svgSize(svg);
    const w = Math.round(num(opts.width, size.width));
    const h = Math.round(num(opts.height, w * size.height / size.width));
    return withRootSize(svg, w, h);
  }

  /** Convenience: the SVG as a downloadable Blob. */
  function svgBlob(state, opts) {
    return new Blob([svgString(state, opts)], { type: SVG_MIME });
  }

  /**
   * Rasterise an SVG string to a PNG blob. Canvas size = viewBox × scale.
   * @param {string} svg
   * @param {{scale?:number, background?:string|null}} [opts]
   *        background null → transparent; otherwise a CSS colour filled first
   * @returns {Promise<Blob>}
   */
  async function svgToPngBlob(svg, { scale = 3, background = null } = {}) {
    if (typeof svg !== 'string' || !svg) throw makeError('svg-invalid', 'Der er ingen SVG at eksportere.');
    const s = clamp(num(scale, 3), 0.1, 8);
    const size = svgSize(svg);
    const canvas = await drawSvg(svg, {
      width: size.width * s,
      height: size.height * s,
      background: background || null,
    });
    return canvasToBlob(canvas, 'image/png');
  }

  /**
   * PNG data URL of the state — used by the PPTX exporter's image slide.
   * @param {object} state
   * @param {{scale?:number, background?:string|null}} [opts]
   * @returns {Promise<string>}
   */
  async function pngDataUrl(state, { scale = 3, background = null } = {}) {
    const blob = await svgToPngBlob(svgString(state), { scale, background });
    return blobToDataUrl(blob);
  }

  // ---------------------------------------------------------------------------
  // Public: file naming, saving, clipboard
  // ---------------------------------------------------------------------------

  /** 62 → "62", 62.5 → "62-5", 33.33 → "33-3" (ASCII-safe, one decimal). */
  function fileNumber(v) {
    const n = clamp(num(v, 0), 0, 100);
    const rounded = Math.round(n * 10) / 10;
    return String(rounded).replace('.', '-');
  }

  /**
   * ASCII-safe file name, e.g. 'speedometer_62pct_fra_48.png'.
   * @param {object} state  uses state.value and state.prev
   * @param {string} ext    'png' or '.png'
   */
  function filename(state, ext) {
    const s = state || {};
    const cleanExt = String(ext || '').replace(/^\.+/, '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    return 'speedometer_' + fileNumber(s.value) + 'pct_fra_' + fileNumber(s.prev) + '.' + cleanExt;
  }

  /** Classic download: object URL + <a download> click, revoked after 1 s. */
  function downloadViaAnchor(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Save a blob to the user's machine.
   * On claude.ai (window.claude.use available) the "downloads" capability is
   * used; a user who declines the save is not an error. Anywhere else, or if
   * the capability is unavailable, a normal browser download is triggered.
   * @param {string} name
   * @param {Blob} blob
   * @returns {Promise<boolean>} true when saved, false when the user declined
   */
  async function saveFile(name, blob) {
    if (!(blob instanceof Blob)) throw makeError('no-data', 'Der er ingen fil at gemme.');
    const safeName = String(name || 'speedometer.bin');
    const host = global.claude;
    if (host && typeof host.use === 'function') {
      let downloads = null;
      try {
        downloads = await host.use('downloads');
      } catch (_) {
        downloads = null; // capability not granted → fall through to the anchor path
      }
      if (downloads && typeof downloads.save === 'function') {
        try {
          await downloads.save({ filename: safeName, data: blob });
        } catch (err) {
          if (err && err.code === 'declined') return false; // user said no — not an error
          throw err;
        }
        return true;
      }
    }
    downloadViaAnchor(safeName, blob);
    return true;
  }

  /**
   * Copy a PNG to the clipboard. Resolves false when the browser cannot do
   * it (no async clipboard / ClipboardItem — e.g. Firefox without the flag,
   * or a rejected write), so the caller can show the "Download PNG" hint.
   * Accepts a Blob or a Promise<Blob>: passing the promise directly keeps
   * Safari's user-gesture window open while the PNG is still rasterising.
   * @param {Blob|Promise<Blob>} blobOrPromise
   * @returns {Promise<boolean>}
   */
  async function copyPng(blobOrPromise) {
    const nav = global.navigator;
    const Item = global.ClipboardItem;
    if (!nav || !nav.clipboard || typeof nav.clipboard.write !== 'function' || typeof Item !== 'function') {
      return false;
    }
    if (typeof Item.supports === 'function' && !Item.supports('image/png')) return false;
    try {
      const item = new Item({ 'image/png': blobOrPromise });
      await nav.clipboard.write([item]);
      return true;
    } catch (err) {
      if (global.console) console.warn('[Exporters] Clipboard write failed:', err);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Public: animated GIF
  // ---------------------------------------------------------------------------

  /** GIF frames have no alpha, so map "transparent"/named backgrounds to a solid. */
  function solidColor(background) {
    if (!background || background === 'transparent') return '#FFFFFF';
    if (background === 'white') return '#FFFFFF';
    if (background === 'card') return CARD_FILL;
    return String(background);
  }

  /** '#RRGGBB' → [r, g, b] or null (used to pin exact brand colours in the palette). */
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  /** Indices of the frames used to build the shared palette: start, mid-sweep, final. */
  function paletteSampleIndices(count, hold) {
    const animated = Math.max(1, count - Math.max(0, hold));
    const picks = [0, Math.floor(animated * 0.45), count - 1];
    return picks.filter((v, i, arr) => v >= 0 && v < count && arr.indexOf(v) === i);
  }

  /**
   * Encode the prev → value spring animation as an animated GIF.
   * @param {object} state
   * @param {object} [opts]
   * @param {number}  [opts.width=900]        pixel width (height follows the viewBox ratio)
   * @param {number}  [opts.fps=25]          25 fps = 40 ms frames, exactly representable in GIF (10 ms units)
   * @param {number}  [opts.frames=38]        animated frames (spring)
   * @param {number}  [opts.hold=13]          static frames appended at the end (38 + 13 frames ≈ 2.04 s)
   * @param {string}  [opts.background='#FFFFFF']  solid colour ('card' → card fill)
   * @param {'once'|'forever'} [opts.loop='once']
   * @param {(done:number, total:number)=>void} [opts.onProgress]  called as work steps
   *        complete (palette sampling + every frame); done === total at the end
   * @returns {Promise<Blob>}  image/gif
   */
  async function gifBlob(state, opts = {}) {
    const G = gauge();
    const enc = global.gifenc;
    if (!enc || typeof enc.GIFEncoder !== 'function' || typeof enc.quantize !== 'function') {
      throw makeError('gifenc-missing', 'GIF-koderen (gifenc) er ikke indlæst.');
    }
    if (typeof G.animationFrames !== 'function') {
      throw makeError('gauge-missing', 'Speedometeret understøtter ikke animation.');
    }

    const {
      width = 900,
      fps = 25,
      frames = 38,
      hold = 13,
      background = '#FFFFFF',
      loop = 'once',
      onProgress = null,
    } = opts;

    const merged = fullState(state);
    const safeFps = clamp(num(fps, 25), 1, 60);
    const safeFrames = Math.max(2, Math.round(num(frames, 38)));
    const safeHold = Math.max(0, Math.round(num(hold, 13)));

    const frameStates = G.animationFrames(merged, { frames: safeFrames, fps: safeFps, hold: safeHold });
    if (!Array.isArray(frameStates) || frameStates.length === 0) {
      throw makeError('no-frames', 'Der er ingen animationsbilleder at eksportere.');
    }

    // Output geometry from the state's viewBox so exports match the preview.
    const vbW = num(merged.width, DEFAULT_VIEWBOX.width);
    const vbH = num(merged.height, DEFAULT_VIEWBOX.height);
    const w = clamp(Math.round(num(width, 900)), 16, 4000);
    const h = Math.max(16, Math.round(w * vbH / vbW));
    const bg = solidColor(background);
    // Browsers treat GIF delays of ≤ 10 ms as 100 ms; 20 ms is the safe floor.
    // GIF stores delays in whole centiseconds, so round to 10 ms here (the
    // default 25 fps → exactly 40 ms) and hand the same value to every frame.
    const delay = Math.max(20, Math.round(1000 / safeFps / 10) * 10);
    const repeat = loop === 'forever' ? 0 : -1; // -1 = no NETSCAPE loop block = play once

    const total = frameStates.length;
    const sampleIdx = paletteSampleIndices(total, safeHold);
    const totalSteps = sampleIdx.length + total;
    let done = 0;
    const report = () => {
      if (typeof onProgress === 'function') {
        try { onProgress(done, totalSteps); } catch (_) { /* never let UI errors abort encoding */ }
      }
    };

    // One reusable canvas for every frame.
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw makeError('canvas', 'Din browser understøtter ikke canvas-tegning.');

    const rgbaOf = async (i) => {
      await drawSvg(G.render(frameStates[i]), { width: w, height: h, background: bg, canvas });
      // Copy: getImageData returns a fresh buffer, but be explicit that we own it.
      return new Uint8Array(ctx.getImageData(0, 0, w, h).data.buffer);
    };

    // Frames with identical state (the hold frames, and the last animated
    // frame once the spring has settled) are rasterised only once. Gauge
    // output itself is not comparable (ids are unique per render), so the
    // key is the frame state.
    const keys = frameStates.map((s) => JSON.stringify(s));

    // 1) Shared palette from a few representative frames (start, mid-sweep with
    //    the long blurred streak, and the final frame with the full trail +
    //    delta chip) so every frame uses the same global colour table — the
    //    thing that prevents flicker between frames.
    report();
    const cached = new Map(); // state key → RGBA of the sample frames, reused below
    const sampleLen = w * h * 4;
    const sample = new Uint8Array(sampleLen * sampleIdx.length);
    for (let k = 0; k < sampleIdx.length; k++) {
      const i = sampleIdx[k];
      const rgba = cached.get(keys[i]) || await rgbaOf(i);
      cached.set(keys[i], rgba);
      sample.set(rgba, k * sampleLen);
      done++;
      report();
      await yieldToEventLoop();
    }
    const palette = enc.quantize(sample, GIF_MAX_COLORS, { format: GIF_FORMAT, oneBitAlpha: false, clearAlpha: false });
    if (typeof enc.snapColorsToPalette === 'function') {
      // Keep the flat brand colours and the background exact (no drift from averaging).
      const known = [bg, '#FFFFFF', '#DE3E2E', '#F0A62E', '#1D9C4E', '#1C1C1E'].map(hexToRgb).filter(Boolean);
      try { enc.snapColorsToPalette(palette, known, 6); } catch (_) { /* optional nicety */ }
    }

    // 2) Encode every frame with the shared palette. The palette is written
    //    once, on the first frame, as the global colour table; later frames
    //    omit it so gifenc does not emit local tables. `repeat` also only
    //    matters on the first frame (NETSCAPE extension).
    const gif = enc.GIFEncoder();
    let lastKey = null;
    let lastIndex = null;
    for (let i = 0; i < total; i++) {
      const key = keys[i];
      let index;
      if (lastIndex && key === lastKey) {
        index = lastIndex; // same state as the previous frame → reuse its pixels
      } else {
        const rgba = cached.get(key) || await rgbaOf(i);
        cached.delete(key);
        index = enc.applyPalette(rgba, palette, GIF_FORMAT);
      }
      gif.writeFrame(index, w, h, i === 0 ? { palette, delay, repeat } : { delay });
      lastKey = key;
      lastIndex = index;
      done++;
      report();
      if (i % 2 === 1) await yieldToEventLoop();
    }
    gif.finish();
    return new Blob([gif.bytesView()], { type: 'image/gif' });
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  global.Exporters = {
    svgString,
    svgBlob,
    svgToPngBlob,
    pngDataUrl,
    saveFile,
    copyPng,
    filename,
    gifBlob,
  };
})(window);
