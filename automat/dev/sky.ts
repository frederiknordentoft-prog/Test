// Sky harness: #kp=&storm=&glow=&cme=&sun=&t=&anim=1&ui=1&seq=cine
import { Application } from 'pixi.js';
import { SkyLayer, type SkyParams } from '../src/render/sky/SkyLayer.ts';

const q = new URLSearchParams(location.hash.slice(1));
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const ui = num('ui', 0) === 1;
const anim = num('anim', 0) === 1;
const seq = q.get('seq');
const t0 = num('t', 3);

const app = new Application();
await app.init({
  resizeTo: window, resolution: num('res', Math.min(2, devicePixelRatio || 1)), autoDensity: true,
  preference: 'webgl', background: '#000000', antialias: false,
});
document.body.prepend(app.canvas);
const sky = new SkyLayer(app.renderer);
(sky as unknown as { calm: boolean }).calm = num('calm', 0) === 1;
app.stage.addChild(sky);

interface Mock { gridX: number; gridY: number; size: number; hy: number; desktop: boolean; top: number; bottom: number }
function measure(w: number, h: number): Mock {
  const desktop = w >= 1000 && w / h >= 1.25;
  let reg = 26, hdr = 46, arc = 92, win = 50, deck = 104, foot = 26;
  if (h <= 740) { arc = 64; deck = 96; win = 44; hdr = 42; }
  if (h <= 640) { arc = 44; deck = 88; win = 40; hdr = 40; reg = 24; foot = 24; }
  if (desktop) { arc = 104; deck = 112; }
  const top = reg + hdr + arc, bottom = win + deck + foot;
  const gx0 = desktop ? 300 : 0, gw = desktop ? w - 600 : w, gh = h - top - bottom;
  const pad = Math.max(10, Math.min(gw, gh) * 0.035);
  const cell = Math.floor(Math.max(120, Math.min(gw - pad * 2, gh - pad * 2)) / 6);
  const size = cell * 6;
  const gridX = Math.round(gx0 + (gw - size) / 2), gridY = Math.round(top + (gh - size) / 2);
  const portrait = w / h < 1.1;
  return { gridX, gridY, size, hy: portrait ? gridY + size * 0.86 : h * 0.66, desktop, top, bottom };
}

function drawMock(m: Mock, w: number, h: number): void {
  const el = document.getElementById('mock')!;
  el.innerHTML = '';
  if (!ui) return;
  const add = (cls: string, x: number, y: number, ww: number, hh: number) => {
    const d = document.createElement('div'); d.className = cls;
    Object.assign(d.style, { left: x + 'px', top: y + 'px', width: ww + 'px', height: hh + 'px' });
    el.appendChild(d); return d;
  };
  const r = add('bar reg', 0, 0, w, 26); r.style.left = '0';
  if (m.desktop) { add('side', 16, m.top, 268, h - m.top - 26 - 20); add('side', w - 284, m.top, 268, h - m.top - 26 - 20); }
  const pad = Math.max(6, m.size * 0.022);
  add('plate', m.gridX - pad, m.gridY - pad, m.size + pad * 2, m.size + pad * 2);
  const c = m.size / 6;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) add('cell', m.gridX + i * c + 2, m.gridY + j * c + 2, c - 4, c - 4);
  add('spin', w / 2 - 44, h - m.bottom + 50 + (m.bottom - 26 - 50 - 88) / 2, 88, 88);
  add('chip', w / 2 - 110, m.top - 30, 220, 26);
}

const P: SkyParams = { kp: num('kp', 0), storm: num('storm', 0), glow: num('glow', 0), cme: num('cme', 0), sun: num('sun', 0), time: t0 };
const easeIn2 = (x: number) => x * x;
const easeOut2 = (x: number) => 1 - (1 - x) * (1 - x);
const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
function calmCine(t: number): void {
  // mirrors the calm branch of solstorm.ts: 2 s sine crossfade storm 0→1, sun 0→0.55, no CME
  const k = seg(t, 0, 2); const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
  P.kp = num('kp', 7) + (9 - num('kp', 7)) * e; P.storm = e; P.sun = 0.55 * e; P.cme = 0;
}
function cine(t: number): void {
  if (seq === 'calmcine') { calmCine(t); return; }
  // mirrors src/present/cinematics/solstorm.ts
  const kp0 = num('kp', 7);
  P.kp = kp0 + (9 - kp0) * easeIn2(seg(t, 0.18, 1.18));
  P.storm = t < 2.2 ? 0.35 * easeIn2(seg(t, 0.3, 1.2)) : 1;
  P.cme = t >= 1.2 && t < 2.2 ? seg(t, 1.2, 2.2) : 0;
  P.sun = t < 2.45 ? 0 : 0.62 * easeOut2(seg(t, 2.45, 4.05));
}

function layout(): void {
  const w = window.innerWidth, h = window.innerHeight;
  const m = measure(w, h);
  sky.resize(w, h, m.hy);
  drawMock(m, w, h);
  (window as unknown as { __probe: unknown }).__probe = { w, h, hy: m.hy, grid: [m.gridX, m.gridY, m.size], res: app.renderer.resolution, params: P, env: sky.envColors().map((c) => c.map((x) => +x.toFixed(3))) };
}
layout();
window.addEventListener('resize', layout);

const start = performance.now();
if (seq === 'cine' || seq === 'calmcine') cine(t0);
sky.update(P);
layout();
app.ticker.add(() => {
  if (!anim) return;
  const t = t0 + (performance.now() - start) / 1000;
  P.time = t;
  if (seq === 'cine' || seq === 'calmcine') cine(t);
  sky.update(P);
});

// ---------------------------------------------------------------- luminance trace (#trace=1)
// Fixed-step 60 fps, reads back the frame each step, mean relative luminance (full frame + sky band above
// the grid), then counts ≥10 % opposing swings (hysteresis on relative change) in any 1 s window.
if (q.get('trace') === '1') {
  app.stop();
  const frames = num('frames', 180), fps = 60;
  const w = window.innerWidth, h = window.innerHeight;
  const { Rectangle } = await import('pixi.js');
  const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const LUT = new Float32Array(256); for (let i = 0; i < 256; i++) LUT[i] = lin(i);
  const full: number[] = [], band: number[] = [];
  const TN = 4; const tiles: number[][] = []; for (let k = 0; k < TN * TN; k++) tiles.push([]);
  const m = measure(w, h);
  const bandH = Math.max(8, m.gridY);
  for (let i = 0; i < frames; i++) {
    P.time = t0 + i / fps;
    if (seq === 'cine' || seq === 'calmcine') cine(P.time);
    sky.update(P);
    const out = app.renderer.extract.pixels({ target: app.stage, frame: new Rectangle(0, 0, w, h), resolution: 0.25 });
    const px = out.pixels, W = out.width, H = out.height;
    const bandRows = Math.round(H * bandH / h);
    let s = 0, sb = 0, nb = 0;
    const ts = new Float64Array(TN * TN), tc = new Float64Array(TN * TN);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const Y = 0.2126 * LUT[px[o]] + 0.7152 * LUT[px[o + 1]] + 0.0722 * LUT[px[o + 2]];
      s += Y; if (y < bandRows) { sb += Y; nb++; }
      const k = Math.min(TN - 1, Math.floor(y * TN / H)) * TN + Math.min(TN - 1, Math.floor(x * TN / W));
      ts[k] += Y; tc[k]++;
    }
    full.push(s / (W * H)); band.push(sb / Math.max(1, nb));
    for (let k = 0; k < TN * TN; k++) tiles[k].push(ts[k] / Math.max(1, tc[k]));
  }
  const swings = (L: number[]) => {
    const ev: number[] = []; let dir = 0, hi = L[0], lo = L[0];
    for (let i = 1; i < L.length; i++) {
      const v = L[i]; hi = Math.max(hi, v); lo = Math.min(lo, v);
      if (dir !== -1 && v <= hi * 0.9) { ev.push(i); dir = -1; hi = lo = v; }
      else if (dir !== 1 && v >= lo * 1.1) { ev.push(i); dir = 1; hi = lo = v; }
    }
    let maxPerSec = 0;
    for (let a = 0; a < ev.length; a++) { let n = 0; for (let b = a; b < ev.length && ev[b] - ev[a] < fps; b++) n++; maxPerSec = Math.max(maxPerSec, n); }
    const mn = Math.min(...L), mx = Math.max(...L);
    let maxStep = 0; for (let i = 1; i < L.length; i++) maxStep = Math.max(maxStep, Math.abs(L[i] - L[i - 1]) / Math.max(1e-6, L[i - 1]));
    return { swings: ev.length, maxSwingsPerSec: maxPerSec, min: +mn.toFixed(4), max: +mx.toFixed(4), rangePct: +(100 * (mx - mn) / mx).toFixed(1), maxFrameStepPct: +(100 * maxStep).toFixed(2) };
  };
  const tr = tiles.map(swings);
  let wi = 0; if (q.has('tile')) wi = num('tile', 0); else tr.forEach((t, i) => { const w0 = tr[wi]; if (t.maxSwingsPerSec > w0.maxSwingsPerSec || (t.maxSwingsPerSec === w0.maxSwingsPerSec && t.maxFrameStepPct > w0.maxFrameStepPct)) wi = i; });
  const worst = { tile: wi, ...tr[wi], series: num('dump', 0) ? tiles[wi].map((v) => +v.toFixed(3)) : undefined };
  (window as unknown as { __trace: unknown }).__trace = { frames, params: { ...P }, calm: sky.calm, full: swings(full), skyBand: swings(band), worstTile16: worst };
}
