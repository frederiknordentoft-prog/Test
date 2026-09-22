// Dev harness for src/render/fx/UberPost.ts + Bloom.ts. Deterministic via URL hash (all optional):
//   fx=none|base|cine      post variant (default base)          bloom=1|0     scene=base|storm
//   storm=0..1 (grade)     ca= vig= grain= exp= str= thr= knee= scatter=
//   zoom= glitch= heat= zc=x,y   ring=x,y,r,s  ring2=…  ring3=…      t=seconds (time uniform)
//   check=1   sharpness pixel check (no-post vs base vs bloom+base vs a res-1 reference) + frame-cost timing
//   lose=1    WebGL context loss → restore → re-render and verify
//   loupe=x,y,w,h,s        nearest-neighbour magnified crop (css rect, s = scale) in the bottom-right corner
//   lbl=0     hide the config label
import { Application, Container, FillGradient, Filter, Graphics, Rectangle, Sprite, Text, Texture, type Renderer } from 'pixi.js';
import { UberPost } from '../src/render/fx/UberPost.ts';
import { createBloom } from '../src/render/fx/Bloom.ts';
import { PAL, css } from '../src/core/palette.ts';

Filter.defaultOptions.resolution = 'inherit'; // same as src/render/app.ts

const hp = new URLSearchParams(location.hash.slice(1));
const num = (k: string, d: number) => (hp.has(k) ? Number(hp.get(k)) : d);
const vec = (k: string): number[] | null => (hp.has(k) ? hp.get(k)!.split(',').map(Number) : null);
const seqT = hp.has('seq') ? Number(hp.get('seq')) : null; // emulate src/present/cinematics/solstorm.ts at time t
const fx = seqT !== null ? 'cine' : hp.get('fx') ?? 'base';
const sceneKind = seqT !== null ? (seqT >= 2.45 ? 'storm' : 'base') : hp.get('scene') ?? 'base';
const stormScene = sceneKind === 'storm';
const ease2in = (x: number) => Math.min(1, Math.max(0, x)) ** 2;
const ease2out = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 2;
const storm = seqT !== null ? (seqT < 0.3 ? 0 : seqT < 2.2 ? 0.35 * ease2in((seqT - 0.3) / 0.9) : 1) : num('storm', stormScene ? 1 : 0);
const probe: Record<string, unknown> = { fx, scene: sceneKind, storm };
const W = window.innerWidth, H = window.innerHeight, dpr = window.devicePixelRatio || 1;
(window as unknown as { __probe: unknown }).__probe = probe;

const app = new Application();
await app.init({
  width: W, height: H, resolution: dpr, autoDensity: true, antialias: true, background: '#050B1A',
  preference: 'webgl', autoStart: false, preserveDrawingBuffer: true, sharedTicker: false,
});
document.getElementById('host')!.appendChild(app.canvas);
const renderer = app.renderer as Renderer;
const gl = (renderer as unknown as { gl: WebGL2RenderingContext }).gl;
// count program links / shader compiles (pre-warm + no-recompile proof, see warm=1)
const glStats = { link: 0, compile: 0 };
{
  const L = gl.linkProgram.bind(gl), C = gl.compileShader.bind(gl);
  gl.linkProgram = (p: WebGLProgram) => { glStats.link++; L(p); };
  gl.compileShader = (sh: WebGLShader) => { glStats.compile++; C(sh); };
}

// ------------------------------------------------------------------ deterministic rng
let seed = 1234567;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

// ------------------------------------------------------------------ sky (canvas 2D, device res)
function paintSky(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d')!;
  g.scale(dpr, dpr);
  const lg = g.createLinearGradient(0, 0, 0, H);
  if (stormScene) { lg.addColorStop(0, css(PAL.void0)); lg.addColorStop(0.55, css(PAL.void1)); lg.addColorStop(1, '#12020a'); }
  else { lg.addColorStop(0, css(PAL.night0)); lg.addColorStop(0.55, css(PAL.night1)); lg.addColorStop(1, '#07142a'); }
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  // airglow band
  const ag = g.createLinearGradient(0, H * 0.18, 0, H * 0.42);
  const agc = stormScene ? '255,60,20' : '15,90,70';
  ag.addColorStop(0, `rgba(${agc},0)`); ag.addColorStop(0.6, `rgba(${agc},0.22)`); ag.addColorStop(1, `rgba(${agc},0)`);
  g.fillStyle = ag; g.fillRect(0, H * 0.18, W, H * 0.24);
  // aurora curtains, drawn on their own canvas then blurred in
  const ac = document.createElement('canvas'); ac.width = cv.width; ac.height = cv.height;
  const a = ac.getContext('2d')!; a.scale(dpr, dpr); a.globalCompositeOperation = 'lighter';
  const cols = stormScene
    ? [['255,30,60', '255,43,214', '255,106,0']]
    : [['61,255,176', '25,227,214', '138,92,255']];
  for (let c = 0; c < 3; c++) {
    const base = H * (0.12 + c * 0.045), amp = H * 0.035, x0 = -W * 0.1, x1 = W * 1.1;
    const ph = rnd() * 6, fr = 1.2 + rnd() * 1.4, hgt = H * (0.1 + rnd() * 0.08);
    for (let x = x0; x < x1; x += 1.5) {
      const u = x / W;
      const y = base + Math.sin(u * fr * 6.28 + ph) * amp + Math.sin(u * 17 + ph * 2) * amp * 0.25;
      const flick = 0.55 + 0.45 * Math.sin(u * 53 + ph * 3) * Math.sin(u * 23 + c);
      const [c0, c1, c2] = cols[0];
      const grd = a.createLinearGradient(0, y - hgt, 0, y + 6);
      grd.addColorStop(0, `rgba(${c2},0)`);
      grd.addColorStop(0.45, `rgba(${c2},${0.05 * flick})`);
      grd.addColorStop(0.8, `rgba(${c1},${0.12 * flick})`);
      grd.addColorStop(0.97, `rgba(${c0},${0.5 * flick})`);
      grd.addColorStop(1, `rgba(${c0},0)`);
      a.fillStyle = grd; a.fillRect(x, y - hgt, 1.6, hgt + 6);
    }
  }
  g.save(); g.globalCompositeOperation = 'lighter'; g.filter = `blur(${1.5 * dpr}px)`;
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(ac, 0, 0); g.restore();
  // stars
  for (let i = 0; i < 160; i++) {
    const x = rnd() * W, y = rnd() * H * 0.62, m = rnd();
    g.fillStyle = `rgba(230,245,255,${0.25 + m * 0.6})`;
    const s = m > 0.93 ? 1.6 : m > 0.6 ? 1 : 0.6;
    g.fillRect(x, y, s, s);
  }
  // klint silhouette
  g.fillStyle = stormScene ? '#0a0204' : css(PAL.klint);
  g.beginPath(); g.moveTo(0, H * 0.3);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, H * (0.285 - 0.02 * Math.sin(x * 0.02) - 0.012 * Math.sin(x * 0.071)));
  g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  return cv;
}

// ------------------------------------------------------------------ scene
const world = new Container();
world.filterArea = new Rectangle(0, 0, W, H);
app.stage.addChild(world);
world.addChild(new Sprite(Texture.from(paintSky())));

// sun (white-hot core, gold / crimson corona)
{
  const sun = new Graphics();
  const sx = W * 0.8, sy = H * 0.08, sr = Math.min(W, H) * 0.06;
  const corona = new FillGradient({
    type: 'radial', center: { x: 0.5, y: 0.5 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5, textureSpace: 'local',
    colorStops: stormScene
      ? [{ offset: 0, color: 'rgba(255,106,0,0.9)' }, { offset: 0.35, color: 'rgba(255,30,60,0.45)' }, { offset: 1, color: 'rgba(255,30,60,0)' }]
      : [{ offset: 0, color: 'rgba(255,211,107,0.8)' }, { offset: 0.35, color: 'rgba(255,181,71,0.25)' }, { offset: 1, color: 'rgba(255,181,71,0)' }],
  });
  sun.circle(sx, sy, sr * 3).fill(corona);
  sun.circle(sx, sy, sr).fill(stormScene ? 0xff6a00 : 0xffe6a8);
  sun.circle(sx, sy, sr * 0.72).fill(0xfff4e0);
  world.addChild(sun);
}

// glass panel ("grid frame") + symbols
const panel = new Container();
world.addChild(panel);
const px = 12, py = Math.round(H * 0.31), pw = W - 24, cols = 5, rows = 4;
const cell = Math.floor((pw - 16) / cols), ph = cell * rows + 16;
{
  const g = new Graphics();
  g.roundRect(px, py, pw, ph, 14).fill({ color: stormScene ? 0x14040a : 0x08101f, alpha: 0.84 });
  g.roundRect(px + 0.5, py + 0.5, pw - 1, ph - 1, 14).stroke({ width: 1, color: stormScene ? 0xff6a50 : PAL.ice, alpha: 0.22 });
  const hl = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
    colorStops: [{ offset: 0, color: 'rgba(234,248,255,0.07)' }, { offset: 1, color: 'rgba(234,248,255,0)' }] });
  g.roundRect(px + 2, py + 2, pw - 4, 40, 12).fill(hl);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    g.roundRect(px + 8 + c * cell + 2, py + 8 + r * cell + 2, cell - 4, cell - 4, 8).fill({ color: stormScene ? 0x1e0610 : 0x0e1a33, alpha: 0.7 });
  panel.addChild(g);
}

async function addSymbols(): Promise<boolean> {
  try {
    const mod = await import('../src/render/art/symbols.ts');
    const set = mod.bakeSymbols(renderer, { edition: stormScene ? 'storm' : 'base', cellPx: Math.round(cell * dpr), env: stormScene ? mod.STORM_ENV : mod.DEFAULT_ENV });
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const s = (r * cols + c * 3 + r) % 9;
      const cx = px + 8 + c * cell + cell / 2, cy = py + 8 + r * cell + cell / 2;
      if ((r === 1 && c < 3) || (r === 2 && c === 4)) {
        const gl2 = new Sprite(set.glow); gl2.anchor.set(0.5); gl2.width = gl2.height = cell * 1.25;
        gl2.position.set(cx, cy); gl2.blendMode = 'add'; gl2.tint = PAL.sym[s]; gl2.alpha = 0.8; panel.addChild(gl2);
      }
      const sp = new Sprite(set.textures[s]); sp.anchor.set(0.5); sp.width = sp.height = cell * 0.92; sp.position.set(cx, cy);
      panel.addChild(sp);
    }
    return true;
  } catch (e) {
    probe.symbolsError = String(e);
    return false;
  }
}
function addFallbackGems(): void {
  const g = new Graphics();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const col = PAL.sym[(r * cols + c) % 9];
    const cx = px + 8 + c * cell + cell / 2, cy = py + 8 + r * cell + cell / 2, R = cell * 0.36;
    const n = 4 + ((r + c) % 4);
    const pts: number[] = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; pts.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
    const fill = new FillGradient({ type: 'linear', start: { x: 0.2, y: 0 }, end: { x: 0.8, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: 0xffffff }, { offset: 0.3, color: col }, { offset: 1, color: 0x101830 }] });
    g.poly(pts).fill(fill);
    g.circle(cx - R * 0.3, cy - R * 0.35, R * 0.1).fill(0xffffff);
  }
  panel.addChild(g);
}
probe.realSymbols = await addSymbols();
if (!probe.realSymbols) addFallbackGems();

// sparks (small bright emitters: bloom must not flicker / must not vanish)
{
  const g = new Graphics();
  for (let i = 0; i < 26; i++) {
    const x = px + rnd() * pw, y = py - 30 + rnd() * 40, s = 0.8 + rnd() * 1.8;
    g.circle(x, y, s).fill(stormScene ? (rnd() > 0.5 ? PAL.molten : PAL.stormGold) : (rnd() > 0.5 ? PAL.mote : PAL.teal));
  }
  world.addChild(g);
}

// multiplier pill (cyan on dark, reserved colour must survive the storm grade)
{
  const g = new Graphics();
  const x = px + pw - 70, y = py + ph + 12;
  g.roundRect(x, y, 58, 26, 13).fill({ color: 0x05070d, alpha: 0.9 }).stroke({ width: 1, color: PAL.cyan, alpha: 0.5 });
  world.addChild(g);
  const t = new Text({ text: stormScene ? 'x64' : 'x8', style: { fontFamily: 'system-ui, sans-serif', fontSize: 15, fontWeight: '800', fill: PAL.cyan } });
  t.anchor.set(0.5); t.position.set(x + 29, y + 13); world.addChild(t);
}

// type: centre readout (zero-CA zone) + small HUD rows near the bottom
const textSpecs: { text: string; size: number; color: number; x: number; y: number; weight?: string; anchor?: number; id?: string }[] = [
  { text: stormScene ? 'SOLSTORM · 412,40 kr' : 'GEVINST 412,40 kr', size: 22, color: stormScene ? PAL.stormGold : PAL.gold, x: W / 2, y: py + ph + 44, weight: '800', anchor: 0.5 },
  { text: 'Kp 5 · 12 spin · Låst indsats 3,40 kr', size: 11, color: PAL.ice, x: W / 2, y: py + ph + 66, anchor: 0.5, id: 'small' },
  { text: 'SALDO 1.234,56 kr', size: 11, color: PAL.chalk, x: 16, y: H - 40, weight: '600' },
  { text: 'INDSATS 3,40 kr', size: 11, color: PAL.chalk, x: W - 16, y: H - 40, weight: '600', anchor: 1 },
  { text: 'Spil ansvarligt · 18+ · legepenge', size: 9, color: PAL.muted, x: W / 2, y: H - 20, anchor: 0.5 },
];
for (const s of textSpecs) {
  const t = new Text({ text: s.text, style: { fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: s.size, fontWeight: (s.weight ?? '500') as '500', fill: s.color, letterSpacing: s.size < 12 ? 0.4 : 1 } });
  t.anchor.set(s.anchor ?? 0, 0.5);
  t.position.set(Math.round(s.x), Math.round(s.y));
  world.addChild(t);
}

// 1-device-pixel gratings at the exact screen centre (sharpness probe)
const grate = { x: Math.round(W / 2 - 24), y: Math.round(H / 2 - 30), w: 48, h: 12 };
{
  const g = new Graphics();
  g.rect(grate.x - 4, grate.y - 4, grate.w + 8, grate.h * 2 + 12).fill(0x05070d);
  const step = 1 / dpr;
  for (let i = 0; i < grate.w * dpr; i += 2) g.rect(grate.x + i * step, grate.y, step, grate.h).fill(0xeaf8ff);
  for (let j = 0; j < grate.h * dpr; j += 2) g.rect(grate.x, grate.y + grate.h + 4 + j * step, grate.w, step).fill(0xeaf8ff);
  world.addChild(g);
}

// rotated square (MSAA probe: with antialias 'inherit' its edges must have partial-coverage pixels)
const aaBox = { x: Math.round(W / 2 + 34), y: Math.round(H / 2 - 32), w: 30, h: 30 };
{
  const g = new Graphics();
  g.rect(aaBox.x, aaBox.y, aaBox.w, aaBox.h).fill(0x05070d);
  const sq = new Graphics().rect(-8, -8, 16, 16).fill(0xeaf8ff);
  sq.position.set(aaBox.x + aaBox.w / 2, aaBox.y + aaBox.h / 2); sq.rotation = 0.5;
  world.addChild(g, sq);
}

// ------------------------------------------------------------------ post
const uber = new UberPost();
const bloom = createBloom();
function applyParams(u: UberPost, grainOverride?: number): void {
  u.storm = storm;
  u.cinematic = fx === 'cine';
  u.ca = num('ca', fx === 'cine' ? 8 : 0.5 + 2 * storm);
  u.vignette = num('vig', u.vignette);
  u.grain = grainOverride ?? num('grain', u.grain);
  u.exposure = num('exp', 0);
  u.zoom = num('zoom', 0);
  u.glitch = num('glitch', 0);
  u.heat = num('heat', 0);
  u.time = num('t', 3.3);
  const zc = vec('zc'); if (zc) { u.zoomCenter[0] = zc[0]; u.zoomCenter[1] = zc[1]; }
  u.rings.fill(0);
  ['ring', 'ring2', 'ring3'].forEach((k, i) => { const r = vec(k); if (r) u.rings.set(r.slice(0, 4), i * 4); });
  if (seqT !== null) {
    const t = seqT;
    u.glitch = [0.3, 0.55, 0.8].some((g) => t >= g && t < g + 0.06) ? 0.7 : 0;
    u.zoom = t >= 1.2 && t < 2.2 ? 0.3 * ease2in(t - 1.2) : 0;
    const ca0 = 0.5 + storm * 2;
    u.ca = t < 1.2 ? ca0 : t < 2.3 ? 1.2 + (8 - 1.2) * ease2in(t - 1.2) : 8 + (2.5 - 8) * ease2out((t - 2.3) / 1.2);
    u.exposure = t >= 2.2 && t < 2.24 ? 0.85 : 0;
    if (t >= 2.2 && t < 3.1) { const p = ease2out((t - 2.2) / 0.9); u.rings.set([0.5, 0.52, p * 1.2, 1 - p], 0); }
    u.heat = t < 2.6 ? 0 : t < 3.6 ? 0.6 * (t - 2.6) : t < 4.6 ? 0.6 : t < 5.6 ? 0.6 - 0.35 * (t - 4.6) : 0.25;
    u.time = 10 + t;
  }
}
applyParams(uber);
bloom.strength = num('str', seqT !== null ? (seqT < 1.2 ? 1 : seqT < 2.2 ? 1 + 0.8 * (seqT - 1.2) : 1.8) * (seqT >= 2.5 ? 1.6 : 1) : 1 + 0.6 * storm);
bloom.threshold = num('thr', bloom.threshold);
bloom.knee = num('knee', bloom.knee);
bloom.scatter = num('scatter', bloom.scatter);
bloom.protect = num('protect', bloom.protect);
const useBloom = hp.get('bloom') !== '0';
const setFilters = () => { world.filters = fx === 'none' ? [] : useBloom ? [bloom, uber] : [uber]; };
setFilters();

// ------------------------------------------------------------------ pixel metrics
const grabCv = document.createElement('canvas');
const grabCtx = grabCv.getContext('2d', { willReadFrequently: true })!;
function grab(x: number, y: number, w: number, h: number): { d: Uint8ClampedArray; w: number; h: number } {
  const X = Math.round(x * dpr), Y = Math.round(y * dpr), Wd = Math.round(w * dpr), Hd = Math.round(h * dpr);
  grabCv.width = Wd; grabCv.height = Hd;
  grabCtx.clearRect(0, 0, Wd, Hd);
  grabCtx.drawImage(app.canvas, X, Y, Wd, Hd, 0, 0, Wd, Hd);
  return { d: grabCtx.getImageData(0, 0, Wd, Hd).data, w: Wd, h: Hd };
}
const lum = (d: Uint8ClampedArray, i: number) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
/** mean |ΔL| between neighbouring device pixels along x (axis 0) or y (axis 1). */
function modulation(g: { d: Uint8ClampedArray; w: number; h: number }, axis: 0 | 1): number {
  let s = 0, n = 0;
  for (let y = 0; y < g.h - axis; y++) for (let x = 0; x < g.w - (1 - axis); x++) {
    const i = (y * g.w + x) * 4, j = axis ? i + g.w * 4 : i + 4;
    s += Math.abs(lum(g.d, i) - lum(g.d, j)); n++;
  }
  return s / Math.max(1, n);
}
function gradEnergy(g: { d: Uint8ClampedArray; w: number; h: number }): number { return modulation(g, 0) + modulation(g, 1); }
function meanLum(g: { d: Uint8ClampedArray; w: number; h: number }): number {
  let s = 0; for (let i = 0; i < g.d.length; i += 4) s += lum(g.d, i); return s / (g.d.length / 4);
}
const smallText = { x: W / 2 - 100, y: py + ph + 58, w: 200, h: 16 };
function measure() {
  app.render();
  return {
    gv: modulation(grab(grate.x + 2, grate.y + 2, grate.w - 4, grate.h - 4), 0),
    gh: modulation(grab(grate.x + 2, grate.y + grate.h + 6, grate.w - 4, grate.h - 4), 1),
    text: gradEnergy(grab(smallText.x, smallText.y, smallText.w, smallText.h)),
    glass: meanLum(grab(px + 8 + 2, py + 8 + 3 * cell + 2, 14, 14)),
    panelMean: meanLum(grab(px, py, pw, ph)),
  };
}
const ratio = (a: number, b: number) => +(a / Math.max(1e-6, b)).toFixed(3);

async function runCheck(): Promise<void> {
  const keep = { cine: uber.cinematic, grain: uber.grain };
  world.filters = [];
  const m0 = measure();
  uber.cinematic = false; uber.grain = 0;
  world.filters = [uber];
  const m1 = measure();
  world.filters = [bloom, uber];
  const m2 = measure();
  const soft = new UberPost(); applyParams(soft, 0); soft.cinematic = false; soft.resolution = 1; soft.antialias = 'inherit';
  world.filters = [soft];
  const m3 = measure();
  // MSAA inheritance: count partially covered pixels on the rotated square's edges
  const partial = () => {
    app.render();
    const g = grab(aaBox.x + 1, aaBox.y + 1, aaBox.w - 2, aaBox.h - 2);
    let n = 0; for (let i = 0; i < g.d.length; i += 4) { const l = lum(g.d, i); if (l > 0.15 && l < 0.75) n++; }
    return n;
  };
  world.filters = [];
  const aaNone = partial();
  world.filters = [uber];
  const aaInherit = partial();
  uber.antialias = 'off';
  const aaOff = partial();
  uber.antialias = 'inherit';
  probe.msaa = { partialEdgePx: { noPost: aaNone, uberInherit: aaInherit, uberOff: aaOff }, note: 'inherit ≈ noPost → world keeps the canvas MSAA inside the filter RT' };
  const thr0 = bloom.threshold; bloom.threshold = 1.5; // nothing passes → composite pass must be bit-exact
  world.filters = [bloom, uber];
  const m5 = measure();
  bloom.threshold = thr0;
  uber.grain = keep.grain;
  world.filters = [bloom, uber];
  const m4 = measure();
  probe.sharp = {
    note: 'ratios vs no-post; 1.0 = no softening. resolution-1 reference shows what softening looks like.',
    grateV: { uber: ratio(m1.gv, m0.gv), bloomUber: ratio(m2.gv, m0.gv), bloomPassNoGlow: ratio(m5.gv, m0.gv), res1Ref: ratio(m3.gv, m0.gv), withGrain: ratio(m4.gv, m0.gv) },
    grateH: { uber: ratio(m1.gh, m0.gh), bloomUber: ratio(m2.gh, m0.gh), res1Ref: ratio(m3.gh, m0.gh) },
    smallText: { uber: ratio(m1.text, m0.text), bloomUber: ratio(m2.text, m0.text), res1Ref: ratio(m3.text, m0.text) },
    glassLum: { none: +m0.glass.toFixed(4), bloomUber: +m2.glass.toFixed(4) },
    panelMean: { none: +m0.panelMean.toFixed(4), bloomUber: +m2.panelMean.toFixed(4) },
  };
  soft.destroy();
  // frame cost (SwiftShader = CPU raster: only relative numbers mean anything)
  const px1 = new Uint8Array(4);
  const cfgs: [string, Filter[], boolean][] = [
    ['scene only', [], false],
    ['uber base', [uber], false],
    ['bloom + uber base', [bloom, uber], false],
    ['bloom + uber cinematic (all fx on)', [bloom, uber], true],
  ];
  const best: Record<string, number> = {};
  const frame = (filters: Filter[], cine: boolean) => {
    world.filters = filters; uber.cinematic = cine;
    if (cine) { uber.zoom = 0.3; uber.glitch = 0.7; uber.heat = 0.6; uber.ca = 8; uber.rings.set([0.5, 0.5, 0.4, 0.7], 0); }
    else { uber.zoom = 0; uber.glitch = 0; uber.heat = 0; uber.ca = 0.5; uber.rings.fill(0); }
    uber.time += 1 / 60;
    const t0 = performance.now();
    app.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1);
    return performance.now() - t0;
  };
  for (const [, f, c] of cfgs) frame(f, c); // warm
  for (let round = 0; round < 5; round++) for (const [label, f, c] of cfgs) {
    const ms = frame(f, c);
    best[label] = Math.min(best[label] ?? Infinity, ms);
  }
  for (const k in best) best[k] = +best[k].toFixed(1);
  probe.costMs = best;
  probe.costNote = `SwiftShader CPU raster, ${Math.round(W * dpr)}×${Math.round(H * dpr)} px; post delta = row − "scene only"`;
  applyParams(uber); uber.cinematic = keep.cine; setFilters();
}

async function runLose(): Promise<void> {
  const before = measure();
  const skyBefore = meanLum(grab(0, 0, W, py - 40));
  const restored = new Promise<void>((res) => app.canvas.addEventListener('webglcontextrestored', () => res(), { once: true }));
  const timeout = new Promise<void>((res) => setTimeout(res, 20000));
  (renderer as unknown as { context: { forceContextLoss(): void } }).context.forceContextLoss(); // Pixi auto-restores
  await Promise.race([restored, timeout]);
  probe.loseRestoredEvent = !gl.isContextLost();
  await new Promise((r) => setTimeout(r, 100));
  uber.cinematic = true; app.render(); uber.cinematic = false; // both variants must come back after restore
  const after = measure();
  const skyAfter = meanLum(grab(0, 0, W, py - 40));
  probe.lose = {
    note: 'panel symbols are baked RTs owned by the art module (re-bake on contextChange is theirs); sky + grating go through the post stack',
    skyBefore: +skyBefore.toFixed(4), skyAfter: +skyAfter.toFixed(4),
    grateBefore: +before.gv.toFixed(4), grateAfter: +after.gv.toFixed(4),
    ok: Math.abs(skyAfter - skyBefore) < 0.01 && after.gv > before.gv * 0.95, // gems gone → less halo on the grating
  };
}

async function runWarm(): Promise<void> {
  world.filters = [];
  app.render(); app.render();
  const l0 = glStats.link;
  uber.cinematic = false; world.filters = [bloom, uber];
  app.render();
  const l1 = glStats.link;
  uber.cinematic = true; app.render();
  const l2 = glStats.link;
  for (let i = 0; i < 10; i++) { uber.cinematic = i % 2 === 0; uber.time += 0.016; app.render(); }
  const l3 = glStats.link;
  probe.warm = {
    linksFirstPostFrame: l1 - l0, expect: '6 = uber base + uber cinematic (pre-warm) + bloom prefilter/down/up/composite',
    linksFirstCinematicFrame: l2 - l1, linksDuring10Toggles: l3 - l2,
  };
  applyParams(uber); setFilters();
}

// ------------------------------------------------------------------ go
if (hp.get('warm') === '1') await runWarm();
for (let i = 0; i < 2; i++) app.render();
if (hp.get('check') === '1') await runCheck();
if (hp.get('lose') === '1') await runLose();
app.render();
probe.bloomLevels = bloom.levels;
probe.canvas = [app.canvas.width, app.canvas.height];

const lp = vec('loupe');
if (lp) {
  const [x, y, w, h, s] = lp;
  const lc = document.getElementById('loupe') as HTMLCanvasElement;
  lc.width = Math.round(w * dpr * s); lc.height = Math.round(h * dpr * s);
  lc.style.width = `${lc.width / dpr}px`; lc.style.height = `${lc.height / dpr}px`; lc.style.display = 'block';
  const c2 = lc.getContext('2d')!; c2.imageSmoothingEnabled = false;
  c2.drawImage(app.canvas, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, lc.width, lc.height);
}
const lbl = document.getElementById('lbl')!;
if (hp.get('lbl') === '0') lbl.style.display = 'none';
else lbl.textContent = location.hash.slice(1) || 'fx=base';
(window as unknown as { __ready: boolean }).__ready = true;
