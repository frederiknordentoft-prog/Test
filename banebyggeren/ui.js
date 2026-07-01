/* ============================================================
   Banebyggeren · UI-lag (canvas-render + input + panels)
   Importerer kernen fra game.js (window.Banebyggeren).
   ============================================================ */

'use strict';

(function () {
  const B = window.Banebyggeren;
  const CELL = B.CELL;
  const SEED = 12345; // fast seed -> deterministisk visning

  /* ---------- state ---------- */
  let hole = loadHole() || B.makeEmptyHole();
  let tool = 'fairway';           // aktivt værktøj
  let painting = false;
  let lastCell = null;            // undgå dobbelt-maling (iOS quirk)
  let previewStrokes = null;      // foreslået rute (trajektorier)

  /* ---------- DOM ---------- */
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  canvas.width = hole.width * CELL;
  canvas.height = hole.height * CELL;

  /* ---------- tema ---------- */
  const savedTheme = localStorage.getItem('bane.theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  $('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('bane.theme', next);
    draw();
  });

  /* ---------- værktøjs-knapper ---------- */
  const toolDefs = [
    { id: 'tee', label: 'Tee' },
    { id: 'pin', label: 'Flag' },
    { id: 'green', label: 'Green' },
    { id: 'fairway', label: 'Fairway' },
    { id: 'rough', label: 'Rough' },
    { id: 'bunker', label: 'Bunker' },
    { id: 'water', label: 'Vand' },
    { id: 'trees', label: 'Træer' },
    { id: 'erase', label: 'Viskelæder' },
  ];
  const toolbar = $('tools');
  toolDefs.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'tool';
    btn.dataset.tool = t.id;
    const sw = document.createElement('span');
    sw.className = 'swatch';
    if (B.TILE[t.id]) sw.style.background = B.TILE[t.id].color;
    else if (t.id === 'tee') sw.style.background = '#ffffff';
    else if (t.id === 'pin') sw.style.background = '#ff453a';
    else sw.style.background = 'transparent';
    btn.appendChild(sw);
    btn.appendChild(document.createTextNode(' ' + t.label));
    if (t.id === tool) btn.classList.add('active');
    btn.addEventListener('click', () => {
      tool = t.id;
      [...toolbar.children].forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
    });
    toolbar.appendChild(btn);
  });

  /* ---------- input (pointer events => ingen touch-dobbeltfyring) ---------- */
  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / CELL);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / CELL);
    return { x, y };
  }

  function applyTool(cx, cy) {
    if (!B.inBounds(hole, cx, cy)) return;
    if (lastCell && lastCell.x === cx && lastCell.y === cy) return; // dobbelt-maling-guard
    lastCell = { x: cx, y: cy };

    if (tool === 'tee') { hole.tee = { x: cx, y: cy }; }
    else if (tool === 'pin') { hole.pin = { x: cx, y: cy }; }
    else if (tool === 'erase') { hole.tiles[B.cellIndex(hole, cx, cy)] = B.TILE.rough.idx; }
    else if (B.TILE[tool]) { hole.tiles[B.cellIndex(hole, cx, cy)] = B.TILE[tool].idx; }

    previewStrokes = null;
    scheduleRecompute();
    draw();
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    painting = true;
    lastCell = null;
    canvas.setPointerCapture(e.pointerId);
    const c = cellFromEvent(e);
    applyTool(c.x, c.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!painting) return;
    e.preventDefault();
    // for tee/pin: kun ét klik ad gangen, ikke slæbning
    if (tool === 'tee' || tool === 'pin') return;
    const c = cellFromEvent(e);
    applyTool(c.x, c.y);
  });
  const stop = (e) => { painting = false; lastCell = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------- knapper ---------- */
  $('saveBtn').addEventListener('click', () => { saveHole(); toast('Hul gemt'); });
  $('loadBtn').addEventListener('click', () => {
    const h = loadHole();
    if (h) { hole = h; canvas.width = hole.width * CELL; canvas.height = hole.height * CELL; recompute(); draw(); toast('Hul indlæst'); }
    else toast('Intet gemt hul');
  });
  $('clearBtn').addEventListener('click', () => {
    hole = B.makeEmptyHole();
    previewStrokes = null;
    recompute();
    draw();
    toast('Ryddet');
  });
  $('playBtn').addEventListener('click', () => {
    if (!hole.tee || !hole.pin) { toast('Placér tee og flag først'); return; }
    // vis "alle skills"-golferens rute
    const r = B.playHole(hole, B.PANEL[0], SEED);
    previewStrokes = r.perStroke;
    draw();
    toast(r.holed ? `AI hullede på ${r.strokes} slag` : 'AI kunne ikke hulle — juster banen');
  });

  /* ---------- rating (debounced) ---------- */
  let recomputeTimer = null;
  function scheduleRecompute() {
    clearTimeout(recomputeTimer);
    recomputeTimer = setTimeout(recompute, 120);
  }

  function recompute() {
    const par = B.autoPar(hole);
    const dp = B.designPar(hole);
    const rating = B.rateHole(hole, SEED);
    $('par').textContent = hole.tee && hole.pin ? par : '–';
    $('designPar').textContent = dp;
    $('ratingTotal').textContent = rating.valid ? rating.total.toFixed(1) : '–';
    $('rLength').style.width = bar(rating.length);
    $('rAccuracy').style.width = bar(rating.accuracy);
    $('rImagination').style.width = bar(rating.imagination);
    $('rLengthVal').textContent = rating.length.toFixed(1);
    $('rAccuracyVal').textContent = rating.accuracy.toFixed(1);
    $('rImaginationVal').textContent = rating.imagination.toFixed(1);

    // beat design-par?
    const badge = $('beatBadge');
    if (rating.valid && rating.total >= dp) {
      badge.textContent = '★ Slår design-par!';
      badge.className = 'badge pass';
    } else if (rating.valid) {
      badge.textContent = `Mangler ${(dp - rating.total).toFixed(1)} til design-par`;
      badge.className = 'badge';
    } else {
      badge.textContent = 'Placér tee + flag';
      badge.className = 'badge';
    }

    checkChallenge(rating, par);
  }

  function bar(v) {
    const pct = Math.min(100, (v / 5) * 100);
    return pct.toFixed(0) + '%';
  }

  /* ---------- dagens udfordring ---------- */
  const today = new Date().toISOString().slice(0, 10);
  const challenge = B.dailyChallenge(today);
  $('chPar').textContent = challenge.parTarget;
  $('chBunkers').textContent = challenge.maxBunkers;
  $('chRating').textContent = challenge.minRating.toFixed(1);
  $('chSkill').textContent = { length: 'længde', accuracy: 'præcision', imagination: 'fantasi' }[challenge.focusSkill];
  $('chDate').textContent = today;

  function checkChallenge(rating, par) {
    if (!rating.valid) { setCh('Byg et hul…', false); return; }
    const bunkers = B.countTiles(hole, 'bunker');
    const okPar = par === challenge.parTarget;
    const okBunkers = bunkers <= challenge.maxBunkers;
    const okRating = rating[challenge.focusSkill] >= challenge.minRating || rating.total >= challenge.minRating;
    const passed = okPar && okBunkers && okRating;
    const parts = [
      `Par ${par}/${challenge.parTarget} ${okPar ? '✓' : '✗'}`,
      `Bunkers ${bunkers}/${challenge.maxBunkers} ${okBunkers ? '✓' : '✗'}`,
      `${challenge.focusSkill}-rating ${okRating ? '✓' : '✗'}`,
    ];
    setCh(parts.join(' · '), passed);
  }
  function setCh(txt, passed) {
    const el = $('chStatus');
    el.textContent = passed ? '✓ Bestået! ' + txt : txt;
    el.className = 'ch-status' + (passed ? ' pass' : '');
  }

  /* ---------- persistens (egen nøgle-prefix; kolliderer ikke med elpris) ---------- */
  const KEY = 'banebyggeren.hole.v1';
  function saveHole() {
    const data = {
      id: hole.id, name: hole.name, width: hole.width, height: hole.height,
      tiles: Array.from(hole.tiles), tee: hole.tee, pin: hole.pin,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  }
  function loadHole() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return {
        id: d.id, name: d.name, width: d.width, height: d.height,
        tiles: Uint8Array.from(d.tiles), tee: d.tee, pin: d.pin,
      };
    } catch (e) { return null; }
  }

  /* ---------- rendering ---------- */
  function draw() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // tiles
    for (let y = 0; y < hole.height; y++) {
      for (let x = 0; x < hole.width; x++) {
        const t = B.TILE_BY_IDX[hole.tiles[B.cellIndex(hole, x, y)]];
        ctx.fillStyle = t.color;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    // grid-linjer
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= hole.width; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= hole.height; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke();
    }

    // foreslået rute
    if (previewStrokes) {
      previewStrokes.forEach((traj, i) => {
        ctx.strokeStyle = i % 2 ? '#ff8c42' : '#0071e3';
        ctx.lineWidth = 3;
        ctx.beginPath();
        traj.points.forEach((p, k) => {
          const px = p.x * CELL, py = p.y * CELL;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
        const last = traj.points[traj.points.length - 1];
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#1d1d1f';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(last.x * CELL, last.y * CELL, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    }

    // tee
    if (hole.tee) drawMarker(hole.tee, '#ffffff', '#1d1d1f', 'T');
    // pin
    if (hole.pin) drawFlag(hole.pin);
  }

  function drawMarker(cell, fill, stroke, label) {
    const cx = (cell.x + 0.5) * CELL, cy = (cell.y + 0.5) * CELL;
    ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
    ctx.fillStyle = stroke; ctx.font = `${CELL * 0.4}px -apple-system, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
  }

  function drawFlag(cell) {
    const cx = (cell.x + 0.5) * CELL, cy = (cell.y + 0.5) * CELL;
    // hul
    ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#111'; ctx.fill();
    // stang
    ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - CELL * 0.9); ctx.stroke();
    // flag
    ctx.fillStyle = '#ff453a';
    ctx.beginPath();
    ctx.moveTo(cx, cy - CELL * 0.9);
    ctx.lineTo(cx + CELL * 0.5, cy - CELL * 0.72);
    ctx.lineTo(cx, cy - CELL * 0.54);
    ctx.closePath(); ctx.fill();
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  /* ---------- seed en demo-bane hvis tomt ---------- */
  function seedDemoIfEmpty() {
    if (hole.tee && hole.pin) return;
    // et lille dogleg: fairway-bane fra venstre til øverst-højre, med bunker og vand
    const set = (x, y, tp) => { if (B.inBounds(hole, x, y)) hole.tiles[B.cellIndex(hole, x, y)] = B.TILE[tp].idx; };
    for (let x = 2; x <= 10; x++) for (let y = 10; y <= 12; y++) set(x, y, 'fairway');
    for (let x = 9; x <= 12; x++) for (let y = 5; y <= 12; y++) set(x, y, 'fairway');
    for (let x = 12; x <= 18; x++) for (let y = 4; y <= 7; y++) set(x, y, 'fairway');
    for (let x = 16; x <= 19; x++) for (let y = 3; y <= 6; y++) set(x, y, 'green');
    set(11, 9, 'bunker'); set(12, 9, 'bunker'); set(13, 6, 'bunker');
    for (let y = 12; y <= 14; y++) { set(13, y, 'water'); set(14, y, 'water'); }
    set(8, 8, 'trees'); set(8, 9, 'trees');
    hole.tee = { x: 3, y: 11 };
    hole.pin = { x: 18, y: 4 };
  }

  seedDemoIfEmpty();
  recompute();
  draw();

  // eksponér til hurtig konsol-determinisme-tjek
  window.__bane = { hole, play: (g, s) => B.playHole(hole, g || B.PANEL[0], s || SEED) };
})();
