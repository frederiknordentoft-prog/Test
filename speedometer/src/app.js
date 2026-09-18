/* ==========================================================================
   Speedometer til PowerPoint – app.js
   --------------------------------------------------------------------------
   UI wiring: state, controls, persistence (localStorage + URL params),
   animation playback and export buttons. Depends on the globals
   window.Gauge, window.Exporters and window.PptxExport (classic scripts,
   loaded before this file). Everything user-facing is in Danish.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                           */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'ds-speedometer:v1';
  const LAST_EXPORT_KEY = 'ds-speedometer:last-export';
  const THEME_KEY = 'ds-speedometer:theme';

  /** Colour of the "Kort" gauge background (light --card-2, the exported artwork is theme independent). */
  const CARD_COLOR = '#F3F3F1';

  /** Animation parameters – must match what the GIF exporter uses so both look identical. */
  const ANIM = { frames: 45, fps: 30, hold: 15 };

  /** UI-only state on top of Gauge.defaults. */
  const UI_DEFAULTS = {
    pngScale: 3,             // 2 | 3 | 4  → 2000 / 3000 / 4000 px wide
    gifLoop: 'once',         // 'once' | 'forever'
    gifBackground: 'white',  // 'white' | 'card' | 'custom'
    gifCustomColor: '#F4F4F2',
    previewTitle: 'Resultater'
  };

  const NBSP = ' ';
  const MINUS = '−';

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round1 = (v) => Math.round(v * 10) / 10;

  /** Parse a Danish or English decimal string. Returns NaN when not a number. */
  function parseDecimal(str) {
    if (typeof str !== 'string') return Number(str);
    const cleaned = str.trim().replace(/\s/g, '').replace(/%/g, '').replace(',', '.');
    if (cleaned === '' || cleaned === '-' || cleaned === '.' ) return NaN;
    if (!/^-?\d*(\.\d*)?$/.test(cleaned)) return NaN;
    return Number(cleaned);
  }

  /** Format a number in Danish with at most one decimal: 62 → "62", 62.5 → "62,5". */
  function fmt(v) {
    const r = round1(v);
    return String(r).replace('.', ',');
  }

  /** "62 %" with a non-breaking space. */
  const fmtPct = (v) => fmt(v) + NBSP + '%';

  /** Always one decimal: 1 → "1,0" (used for the trail strength readout). */
  const fmt1 = (v) => round1(v).toFixed(1).replace('.', ',');

  function readStorage(key) {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  }
  function writeStorage(key, value) {
    try {
      if (value === null || value === undefined) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (_) { /* private mode / blocked storage – the app still works */ }
  }

  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  const Gauge = window.Gauge;
  const Exporters = window.Exporters;
  const PptxExport = window.PptxExport;

  if (!Gauge) {
    console.error('Gauge er ikke indlæst – kontroller at src/gauge.js loader før src/app.js');
    return;
  }

  let state = Object.assign({}, Gauge.defaults, UI_DEFAULTS);
  delete state.trailFrom;   // per-frame animation field (Gauge extension) – the static render never sets it

  /** Whitelisted keys that may come from storage / setState. */
  const STATE_KEYS = Object.keys(state);

  /** Merge only known keys with basic type sanitising. */
  function sanitize(partial) {
    const out = {};
    if (!partial || typeof partial !== 'object') return out;
    for (const key of STATE_KEYS) {
      if (!(key in partial)) continue;
      let v = partial[key];
      switch (key) {
        case 'value':
        case 'prev': {
          const n = typeof v === 'string' ? parseDecimal(v) : Number(v);
          if (!Number.isFinite(n)) continue;
          v = round1(clamp(n, 0, 100));
          break;
        }
        case 'thresholds': {
          if (!Array.isArray(v) || v.length !== 2) continue;
          const a = Number(v[0]), b = Number(v[1]);
          if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
          v = normalizeThresholds(a, b);
          break;
        }
        case 'trailStrength': {
          const n = Number(v);
          if (!Number.isFinite(n)) continue;
          v = Math.round(clamp(n, 0.5, 1.5) * 10) / 10;
          break;
        }
        case 'pngScale': {
          const n = Number(v);
          if (![2, 3, 4].includes(n)) continue;
          v = n;
          break;
        }
        case 'showTrail': case 'showPrevMarker': case 'showDelta': case 'showValue':
          v = Boolean(v);
          break;
        case 'background':
          if (!['transparent', 'white', 'card'].includes(v)) continue;
          break;
        case 'style':
          if (!['classic', 'flat'].includes(v)) continue;
          break;
        case 'gifLoop':
          if (!['once', 'forever'].includes(v)) continue;
          break;
        case 'gifBackground':
          if (!['white', 'card', 'custom'].includes(v)) continue;
          break;
        case 'gifCustomColor':
          if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) continue;
          v = v.toUpperCase();
          break;
        case 'label':
        case 'previewTitle':
          v = String(v == null ? '' : v).slice(0, 60);
          break;
        case 'width': case 'height':
          continue; // fixed viewBox – never user editable
        case 'trailFrom':
          continue; // animation-internal Gauge field – never part of the app state
        default:
          break;
      }
      out[key] = v;
    }
    return out;
  }

  /** Keep 0 ≤ t1 < t2 ≤ 100 with at least 0.5 pp between them. */
  function normalizeThresholds(t1, t2) {
    t1 = round1(clamp(t1, 0, 99.5));
    t2 = round1(clamp(t2, 0.5, 100));
    if (t2 <= t1) t2 = round1(Math.min(100, t1 + 0.5));
    if (t2 <= t1) t1 = round1(Math.max(0, t2 - 0.5));
    return [t1, t2];
  }

  function loadPersistedState() {
    const raw = readStorage(STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return sanitize(parsed);
    } catch (_) {
      return {};
    }
  }

  /** ?value=62&prev=48 (comma or dot decimals accepted). */
  function loadUrlState() {
    const out = {};
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('value')) {
        const n = parseDecimal(params.get('value'));
        if (Number.isFinite(n)) out.value = round1(clamp(n, 0, 100));
      }
      if (params.has('prev')) {
        const n = parseDecimal(params.get('prev'));
        if (Number.isFinite(n)) out.prev = round1(clamp(n, 0, 100));
      }
    } catch (_) { /* ignore malformed URLs */ }
    return out;
  }

  let persistTimer = 0;
  function persist() {
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      const toSave = {};
      for (const key of STATE_KEYS) toSave[key] = state[key];
      writeStorage(STORAGE_KEY, JSON.stringify(toSave));
    }, 120);
  }

  /* ------------------------------------------------------------------ */
  /* Elements                                                            */
  /* ------------------------------------------------------------------ */

  const el = {
    valueInput: $('value-input'),
    valueSlider: $('value-slider'),
    valueReadout: $('value-readout'),
    prevInput: $('prev-input'),
    prevSlider: $('prev-slider'),
    prevReadout: $('prev-readout'),
    useLastExport: $('use-last-export'),
    delta: $('delta-readout'),

    toggleTrail: $('toggle-trail'),
    togglePrev: $('toggle-prev'),
    toggleDelta: $('toggle-delta'),
    toggleValue: $('toggle-value'),
    backgroundSeg: $('background-seg'),
    styleSeg: $('style-seg'),

    t1Input: $('t1-input'),
    t2Input: $('t2-input'),
    trailStrength: $('trail-strength'),
    trailStrengthReadout: $('trail-strength-readout'),
    labelInput: $('label-input'),

    btnCopy: $('btn-copy'),
    btnPng: $('btn-png'),
    pngScaleSeg: $('png-scale-seg'),
    btnSvg: $('btn-svg'),
    btnGif: $('btn-gif'),
    gifLoopSeg: $('gif-loop-seg'),
    gifBgSeg: $('gif-bg-seg'),
    gifColorWrap: $('gif-color-wrap'),
    gifColor: $('gif-color'),
    btnPptx: $('btn-pptx'),
    pptxNote: $('pptx-note'),

    progress: $('progress'),
    progressLabel: $('progress-label'),
    progressPct: $('progress-pct'),
    progressBar: $('progress-bar'),

    previewTitle: $('preview-title'),
    stage: $('gauge-stage'),
    caption: $('preview-caption'),
    btnPlay: $('btn-play'),
    btnPlayLabel: $('btn-play-label'),

    toast: $('toast'),
    toastText: $('toast-text'),
    themeSwitch: $('theme-switch')
  };

  const exportButtons = [el.btnCopy, el.btnPng, el.btnSvg, el.btnGif, el.btnPptx];

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  let playing = false;
  let rafId = 0;

  /** Gauge state only (strip UI fields) – what the exporters receive. */
  function gaugeState() {
    const s = {};
    for (const key of Object.keys(Gauge.defaults)) {
      if (key in state) s[key] = state[key];
    }
    return s;
  }

  /** Render the live SVG preview. Cancels a running animation first. */
  function renderGauge() {
    stopPlayback();
    Gauge.mount(el.stage, gaugeState());
  }

  /** Update the delta line and caption. */
  function renderReadouts() {
    const { value, prev } = state;
    el.valueReadout.textContent = fmtPct(value);
    el.prevReadout.textContent = fmtPct(prev);
    el.caption.textContent = `Forrige ${fmtPct(prev)} → Nu ${fmtPct(value)}`;

    const delta = round1(value - prev);
    let glyph, sign, dir;
    if (delta > 0) { glyph = '▲'; sign = '+'; dir = 'up'; }
    else if (delta < 0) { glyph = '▼'; sign = MINUS; dir = 'down'; }
    else { glyph = '●'; sign = '±'; dir = 'zero'; }
    el.delta.textContent = `${glyph} ${sign}${fmt(Math.abs(delta))} procentpoint`;
    el.delta.dataset.direction = dir;
    el.delta.setAttribute('aria-label',
      dir === 'up' ? `Stigning på ${fmt(delta)} procentpoint`
        : dir === 'down' ? `Fald på ${fmt(Math.abs(delta))} procentpoint`
          : 'Ingen ændring');
  }

  /** Paint the filled part of a WebKit range track. */
  function paintSlider(slider) {
    const min = Number(slider.min), max = Number(slider.max);
    const pct = ((Number(slider.value) - min) / (max - min)) * 100;
    slider.style.setProperty('--fill', pct.toFixed(2) + '%');
  }

  function setRadio(fieldset, value) {
    const inputs = fieldset.querySelectorAll('input[type="radio"]');
    inputs.forEach((input) => { input.checked = String(input.value) === String(value); });
  }

  function setSwitch(button, on) {
    button.setAttribute('aria-checked', on ? 'true' : 'false');
  }

  /**
   * Push state into every control. `skip` names an element whose value
   * should be left alone (the one the user is typing in right now).
   */
  function syncControls(skip) {
    if (skip !== el.valueInput) { el.valueInput.value = fmt(state.value); el.valueInput.removeAttribute('aria-invalid'); }
    if (skip !== el.prevInput) { el.prevInput.value = fmt(state.prev); el.prevInput.removeAttribute('aria-invalid'); }
    el.valueSlider.value = state.value;
    el.prevSlider.value = state.prev;
    paintSlider(el.valueSlider);
    paintSlider(el.prevSlider);

    setSwitch(el.toggleTrail, state.showTrail);
    setSwitch(el.togglePrev, state.showPrevMarker);
    setSwitch(el.toggleDelta, state.showDelta);
    setSwitch(el.toggleValue, state.showValue);
    setRadio(el.backgroundSeg, state.background);
    setRadio(el.styleSeg, state.style);

    if (skip !== el.t1Input) { el.t1Input.value = fmt(state.thresholds[0]); el.t1Input.removeAttribute('aria-invalid'); }
    if (skip !== el.t2Input) { el.t2Input.value = fmt(state.thresholds[1]); el.t2Input.removeAttribute('aria-invalid'); }
    el.trailStrength.value = state.trailStrength;
    el.trailStrengthReadout.textContent = fmt1(state.trailStrength);
    paintSlider(el.trailStrength);
    if (skip !== el.labelInput) el.labelInput.value = state.label;

    setRadio(el.pngScaleSeg, state.pngScale);
    setRadio(el.gifLoopSeg, state.gifLoop);
    setRadio(el.gifBgSeg, state.gifBackground);
    el.gifColor.value = state.gifCustomColor;
    el.gifColorWrap.hidden = state.gifBackground !== 'custom';

    if (skip !== el.previewTitle) el.previewTitle.value = state.previewTitle;

    renderReadouts();
    renderLastExportButton();
  }

  /** Full render: controls + preview + persistence. */
  function render(skip) {
    syncControls(skip);
    renderGauge();
    persist();
  }

  /** Public-ish update path used by every control handler. */
  function update(partial, skip) {
    Object.assign(state, sanitize(partial));
    render(skip);
  }

  /* ------------------------------------------------------------------ */
  /* Last export → "Brug sidste eksport som forrige"                    */
  /* ------------------------------------------------------------------ */

  function readLastExport() {
    const n = Number(readStorage(LAST_EXPORT_KEY));
    return Number.isFinite(n) && readStorage(LAST_EXPORT_KEY) !== null ? n : null;
  }

  function rememberExport() {
    writeStorage(LAST_EXPORT_KEY, String(state.value));
    renderLastExportButton();
  }

  function renderLastExportButton() {
    const last = readLastExport();
    if (last === null) {
      el.useLastExport.hidden = true;
      return;
    }
    el.useLastExport.hidden = false;
    el.useLastExport.textContent = `Brug sidste eksport som forrige (${fmtPct(last)})`;
  }

  el.useLastExport.addEventListener('click', () => {
    const last = readLastExport();
    if (last !== null) update({ prev: last });
  });

  /* ------------------------------------------------------------------ */
  /* Number inputs + sliders                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Wire a text input (Danish decimals) and a slider to one numeric key.
   * Empty / invalid text keeps the last valid value and marks the field.
   */
  function bindNumber(input, slider, key) {
    input.addEventListener('input', () => {
      const n = parseDecimal(input.value);
      if (!Number.isFinite(n)) {
        input.setAttribute('aria-invalid', 'true');
        return;
      }
      input.removeAttribute('aria-invalid');
      update({ [key]: n }, input);
    });

    // Normalise the text on blur ("62." → "62", "150" → "100", "" → last valid).
    input.addEventListener('change', () => { syncControls(); });
    input.addEventListener('blur', () => { syncControls(); });

    // Arrow keys nudge the number: 0.5, Shift = 5.
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const step = (e.shiftKey ? 5 : 0.5) * (e.key === 'ArrowUp' ? 1 : -1);
      update({ [key]: state[key] + step });
    });

    slider.addEventListener('input', () => {
      update({ [key]: Number(slider.value) });
    });

    // Shift + arrows = 5 pp on the slider (native step is 0.5).
    slider.addEventListener('keydown', (e) => {
      if (!e.shiftKey) return;
      let dir = 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') dir = 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') dir = -1;
      if (!dir) return;
      e.preventDefault();
      update({ [key]: state[key] + 5 * dir });
    });
  }

  bindNumber(el.valueInput, el.valueSlider, 'value');
  bindNumber(el.prevInput, el.prevSlider, 'prev');

  /* ------------------------------------------------------------------ */
  /* Toggles & segmented controls                                        */
  /* ------------------------------------------------------------------ */

  function bindSwitch(button, key) {
    button.addEventListener('click', () => update({ [key]: !state[key] }));
  }
  bindSwitch(el.toggleTrail, 'showTrail');
  bindSwitch(el.togglePrev, 'showPrevMarker');
  bindSwitch(el.toggleDelta, 'showDelta');
  bindSwitch(el.toggleValue, 'showValue');

  function bindRadioGroup(fieldset, key, coerce) {
    fieldset.addEventListener('change', (e) => {
      if (e.target && e.target.checked) update({ [key]: coerce ? coerce(e.target.value) : e.target.value });
    });
  }
  bindRadioGroup(el.backgroundSeg, 'background');
  bindRadioGroup(el.styleSeg, 'style');
  bindRadioGroup(el.pngScaleSeg, 'pngScale', Number);
  bindRadioGroup(el.gifLoopSeg, 'gifLoop');
  bindRadioGroup(el.gifBgSeg, 'gifBackground');

  el.gifColor.addEventListener('input', () => {
    update({ gifCustomColor: el.gifColor.value, gifBackground: 'custom' });
  });

  /* ------------------------------------------------------------------ */
  /* Advanced                                                            */
  /* ------------------------------------------------------------------ */

  function bindThreshold(input, index) {
    input.addEventListener('input', () => {
      const n = parseDecimal(input.value);
      if (!Number.isFinite(n)) { input.setAttribute('aria-invalid', 'true'); return; }
      input.removeAttribute('aria-invalid');
      const t = state.thresholds.slice();
      t[index] = n;
      update({ thresholds: t }, input);
    });
    input.addEventListener('blur', () => syncControls());
  }
  bindThreshold(el.t1Input, 0);
  bindThreshold(el.t2Input, 1);

  el.trailStrength.addEventListener('input', () => {
    update({ trailStrength: Number(el.trailStrength.value) });
  });

  el.labelInput.addEventListener('input', () => {
    update({ label: el.labelInput.value }, el.labelInput);
  });

  el.previewTitle.addEventListener('input', () => {
    Object.assign(state, sanitize({ previewTitle: el.previewTitle.value }));
    persist();
  });
  el.previewTitle.addEventListener('blur', () => {
    if (!el.previewTitle.value.trim()) update({ previewTitle: UI_DEFAULTS.previewTitle });
  });

  /* ------------------------------------------------------------------ */
  /* Toast + progress                                                    */
  /* ------------------------------------------------------------------ */

  let toastTimer = 0;

  /** Show a toast. kind: 'ok' | 'error' | 'info'. */
  function showToast(message, kind = 'ok') {
    window.clearTimeout(toastTimer);
    el.toast.hidden = true;                     // restart the entrance animation
    el.toast.dataset.kind = kind;
    el.toastText.textContent = message;
    // Force a reflow so the animation replays for consecutive toasts.
    void el.toast.offsetWidth;
    el.toast.hidden = false;
    toastTimer = window.setTimeout(() => { el.toast.hidden = true; }, kind === 'error' ? 8000 : 4200);
  }

  function showProgress(label, ratio) {
    el.progress.hidden = false;
    el.progressLabel.textContent = label;
    if (ratio === null || ratio === undefined) {
      el.progress.dataset.indeterminate = 'true';
      el.progress.removeAttribute('aria-valuenow');
      el.progressPct.textContent = '';
    } else {
      delete el.progress.dataset.indeterminate;
      const pct = Math.round(clamp(ratio, 0, 1) * 100);
      el.progressBar.style.width = pct + '%';
      el.progressPct.textContent = pct + NBSP + '%';
      el.progress.setAttribute('aria-valuenow', String(pct));
    }
  }

  function hideProgress() {
    el.progress.hidden = true;
    el.progressBar.style.width = '0%';
    delete el.progress.dataset.indeterminate;
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                              */
  /* ------------------------------------------------------------------ */

  let exporting = false;

  function setBusy(button, busy) {
    exporting = busy;
    exportButtons.forEach((b) => {
      if (b === button) b.setAttribute('aria-busy', busy ? 'true' : 'false');
      else b.disabled = busy || (b === el.btnPptx && !pptxAvailable());
    });
  }

  /** Human readable error for the toast – never leaks a stack trace. */
  function errorMessage(err, fallback) {
    const msg = err && err.message ? String(err.message) : '';
    return msg ? `${fallback}: ${msg}` : fallback;
  }

  /** Wrap an export action with busy state, progress cleanup and error toast. */
  async function runExport(button, fn, failText) {
    if (exporting) return;
    if (!Exporters) { showToast('Eksport er ikke tilgængelig – src/exporters.js mangler', 'error'); return; }
    stopPlayback();
    setBusy(button, true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      hideProgress();
      showToast(errorMessage(err, failText), 'error');
    } finally {
      setBusy(button, false);
    }
  }

  /** The GIF background colour resolved from state. */
  function gifBackgroundColor() {
    switch (state.gifBackground) {
      case 'card': return CARD_COLOR;
      case 'custom': return state.gifCustomColor;
      default: return '#FFFFFF';
    }
  }

  // Copy as image (PNG on the clipboard)
  el.btnCopy.addEventListener('click', () => runExport(el.btnCopy, async () => {
    const s = gaugeState();
    const svg = Exporters.svgString(s);
    // Hand the *pending* rasterisation to the clipboard synchronously inside the
    // click handler: Safari only allows clipboard writes within the user gesture,
    // and ClipboardItem accepts a Promise<Blob> for exactly this reason.
    const pending = Exporters.svgToPngBlob(svg, { scale: state.pngScale, background: null });
    pending.catch(() => { /* surfaced below if the copy fails */ });
    const ok = await Exporters.copyPng(pending);
    if (!ok) {
      await pending;   // a rasterisation error is more useful than the generic clipboard hint
      showToast('Din browser tillader ikke at kopiere billeder – brug Download PNG i stedet', 'error');
      return;
    }
    rememberExport();
    showToast('Kopieret – indsæt i PowerPoint med Ctrl+V / ⌘V');
  }, 'Kunne ikke kopiere billedet'));

  // Download PNG
  el.btnPng.addEventListener('click', () => runExport(el.btnPng, async () => {
    const s = gaugeState();
    const svg = Exporters.svgString(s);
    const blob = await Exporters.svgToPngBlob(svg, { scale: state.pngScale, background: null });
    await Exporters.saveFile(Exporters.filename(s, 'png'), blob);
    rememberExport();
    showToast(`PNG gemt (${state.pngScale * 1000} px bred)`);
  }, 'Kunne ikke gemme PNG'));

  // Download SVG
  el.btnSvg.addEventListener('click', () => runExport(el.btnSvg, async () => {
    const s = gaugeState();
    const svg = Exporters.svgString(s);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    await Exporters.saveFile(Exporters.filename(s, 'svg'), blob);
    rememberExport();
    showToast('SVG gemt');
  }, 'Kunne ikke gemme SVG'));

  // Download GIF (animated)
  el.btnGif.addEventListener('click', () => runExport(el.btnGif, async () => {
    const s = gaugeState();
    showProgress('Genererer GIF…', 0);
    const blob = await Exporters.gifBlob(s, {
      width: 900,
      fps: ANIM.fps,
      frames: ANIM.frames,
      hold: ANIM.hold,
      background: gifBackgroundColor(),
      loop: state.gifLoop,
      onProgress: (i, total) => showProgress(`Genererer GIF… ${i}/${total}`, total ? i / total : 0)
    });
    showProgress('Gemmer GIF…', 1);
    await Exporters.saveFile(Exporters.filename(s, 'gif'), blob);
    hideProgress();
    rememberExport();
    showToast(state.gifLoop === 'forever' ? 'GIF gemt (afspilles uendeligt)' : 'GIF gemt (afspilles én gang)');
  }, 'Kunne ikke gemme GIF'));

  // Download PPTX
  el.btnPptx.addEventListener('click', () => runExport(el.btnPptx, async () => {
    if (!pptxAvailable()) {
      showToast('PPTX-eksport kræver internetforbindelse første gang – prøv igen når du er online', 'error');
      return;
    }
    const s = gaugeState();
    showProgress('Bygger PPTX…', null);
    const blob = await PptxExport.build(s, { includeNativeSlide: true, includeImageSlide: true, title: '' });
    await Exporters.saveFile(Exporters.filename(s, 'pptx'), blob);
    hideProgress();
    rememberExport();
    showToast('PPTX gemt – slide 1 er redigerbare figurer, slide 2 er et billede');
  }, 'Kunne ikke bygge PPTX'));

  /* PptxGenJS loads from a CDN with `defer`; poll a little for it. */
  function pptxAvailable() {
    return Boolean(PptxExport && typeof PptxExport.available === 'function' && PptxExport.available());
  }

  function refreshPptxButton() {
    const ok = pptxAvailable();
    el.btnPptx.disabled = !ok || exporting;
    if (ok) {
      el.btnPptx.removeAttribute('title');
      el.pptxNote.textContent = 'PPTX indeholder både redigerbare figurer (slide 1) og et billede (slide 2).';
    } else {
      el.btnPptx.title = 'Kræver internetforbindelse første gang';
      el.pptxNote.textContent = 'PPTX indeholder både redigerbare figurer og et billede. Kræver internetforbindelse første gang.';
    }
    return ok;
  }

  (function pollPptx() {
    let tries = 0;
    const tick = () => {
      if (refreshPptxButton() || ++tries > 40) return;   // give the CDN ≈ 10 s
      window.setTimeout(tick, 250);
    };
    tick();
    window.addEventListener('load', refreshPptxButton);
  })();

  /* ------------------------------------------------------------------ */
  /* Animation playback                                                  */
  /* ------------------------------------------------------------------ */

  function stopPlayback() {
    if (!playing) return;
    playing = false;
    window.cancelAnimationFrame(rafId);
    el.btnPlay.disabled = false;
    el.btnPlayLabel.textContent = 'Afspil bevægelse';
  }

  function play() {
    if (playing) return;
    const s = gaugeState();

    // Reduced motion: jump straight to the settled frame.
    if (prefersReducedMotion() || typeof Gauge.animationFrames !== 'function') {
      Gauge.mount(el.stage, s);
      showToast('Bevægelse er slået fra i dine systemindstillinger – viser slutbilledet', 'info');
      return;
    }

    let frames;
    try {
      frames = Gauge.animationFrames(s, ANIM);
    } catch (err) {
      console.error(err);
      Gauge.mount(el.stage, s);
      return;
    }
    if (!frames || !frames.length) { Gauge.mount(el.stage, s); return; }

    playing = true;
    el.btnPlay.disabled = true;
    el.btnPlayLabel.textContent = 'Afspiller…';

    const frameMs = 1000 / ANIM.fps;
    let start = 0;
    let lastIndex = -1;

    const step = (now) => {
      if (!playing) return;
      if (!start) start = now;
      const index = Math.min(frames.length - 1, Math.floor((now - start) / frameMs));
      if (index !== lastIndex) {
        Gauge.mount(el.stage, frames[index]);
        lastIndex = index;
      }
      if (index >= frames.length - 1) {
        playing = false;
        el.btnPlay.disabled = false;
        el.btnPlayLabel.textContent = 'Afspil bevægelse';
        Gauge.mount(el.stage, s);      // ensure the final static render
        return;
      }
      rafId = window.requestAnimationFrame(step);
    };
    rafId = window.requestAnimationFrame(step);
  }

  el.btnPlay.addEventListener('click', play);

  /* ------------------------------------------------------------------ */
  /* Theme                                                               */
  /* ------------------------------------------------------------------ */

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    setRadio(el.themeSwitch, theme === 'light' || theme === 'dark' ? theme : 'auto');
  }

  el.themeSwitch.addEventListener('change', (e) => {
    if (!e.target || !e.target.checked) return;
    const theme = e.target.value;
    applyTheme(theme);
    writeStorage(THEME_KEY, theme === 'auto' ? null : theme);
  });

  applyTheme(readStorage(THEME_KEY) || 'auto');

  /* ------------------------------------------------------------------ */
  /* Keyboard shortcuts                                                  */
  /* ------------------------------------------------------------------ */

  document.addEventListener('keydown', (e) => {
    // Escape closes the toast
    if (e.key === 'Escape' && !el.toast.hidden) el.toast.hidden = true;
  });

  /* ------------------------------------------------------------------ */
  /* Public hook for tests and other agents                              */
  /* ------------------------------------------------------------------ */

  window.App = {
    /** A copy of the full state (gauge + UI fields). */
    getState() { return JSON.parse(JSON.stringify(state)); },
    /** Merge a partial state, sync every control and re-render. */
    setState(partial) { update(partial); return window.App.getState(); },
    /** Re-render everything from the current state. */
    render() { render(); },
    /** Play the spring animation (respects reduced motion). */
    play,
    /** Show a toast – handy for smoke tests. */
    toast: showToast,
    /** Show / hide the progress bar. */
    progress: showProgress,
    hideProgress,
    /** Gauge-only state as handed to the exporters. */
    gaugeState
  };

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  Object.assign(state, loadPersistedState(), loadUrlState());
  render();
})();
