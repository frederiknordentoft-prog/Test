// Dev harness for src/render/fx (Particles, CellShatter, ScreenShatter, Motes).
// Deterministic: the hash picks a view and a time; the harness advances a fixed 1/60 s step from 0 to t
// (firing the scripted game calls on the way) and renders ONCE. window.__ready / window.__probe for QA.
//
//   #view=cells&t=0.12        warm cluster (8 cells) + cold RETURN cluster (5 cells) on a 6×6 base grid
//   #view=cells64&t=0.2       8×8 storm grid, all 64 cells burst warm in the same frame (stress)
//   #view=screen&t=0.2        captured test scene → ScreenShatter (crackReveal 0→1 over 0.25 s, power2.out)
//   #view=motes&t=0.35        cascade motes (director style) + gold sun motes → Kp-arc head
//   #view=timelapse&t=1.2     demo time-lapse: 90 motes over 2.4 s
//   #view=particles&t=0.3     landing snow, sun glints, win sparks, celebration embers, storm-frame embers
//   #view=atlas               the procedural particle atlas (R = core, G = body)
//   &seed=7  &live (animate in real time after the deterministic prefix)  &dpr=1
import { Application, Container, FillGradient, Graphics, RenderTexture, Sprite, Text, Texture, type Renderer } from 'pixi.js';
import { seedCosmetic, crand } from '../src/core/cosmeticRng.ts';
import { PAL } from '../src/core/palette.ts';
import { Particles } from '../src/render/fx/Particles.ts';
import { CellShatter, ScreenShatter } from '../src/render/fx/Shatter.ts';
import { Motes } from '../src/render/fx/Motes.ts';
import { atlasSourceOnce } from '../src/render/fx/parts/atlas.ts';
import { bakeSymbols, bakeCellFx, STORM_ENV, type SymbolSet, type CellFx } from '../src/render/art/symbols.ts';

const hp = new URLSearchParams(location.hash.slice(1));
const view = hp.get('view') ?? 'cells';
const T = parseFloat(hp.get('t') ?? '0.15');
const seed = parseInt(hp.get('seed') ?? '7', 10);
const live = hp.has('live');
const dprQ = hp.get('dpr');
seedCosmetic(seed);

const probe: Record<string, unknown> = { view, t: T, seed };
const W0 = window as unknown as { __probe: unknown; __ready: boolean };
W0.__probe = probe;
W0.__ready = false;

const app = new Application();
await app.init({
  width: window.innerWidth, height: window.innerHeight, background: '#050B1A', antialias: true, preference: 'webgl', preserveDrawingBuffer: true,
  resolution: dprQ ? parseFloat(dprQ) : Math.min(2, window.devicePixelRatio || 1), autoDensity: true, autoStart: false, sharedTicker: false,
});
document.getElementById('host')!.appendChild(app.canvas);
const renderer = app.renderer as Renderer;
const W = window.innerWidth, H = window.innerHeight;

// ─────────────────────────────── stage like the game: camera → world → scene ───────────────────────────────
const world = new Container();
const scene = new Container();
const shatterLayer = new Container();
world.addChild(scene, shatterLayer);
app.stage.addChild(world);
const L = { sky: new Container(), grid: new Container(), cellFx: new Container(), arc: new Container(), particles: new Container(), motes: new Container(), banners: new Container() };
scene.addChild(L.sky, L.grid, L.cellFx, L.arc, L.particles, L.motes, L.banners);

const SYM_GLOW = [0x5ce1ff, 0x3dffb0, 0xa98cff, 0xff7fb0, 0xdfe8ff, 0xfff1c8, 0xffc062, 0x7dffd0, 0xffd36b];

function sky(storm: boolean): Container {
  const c = new Container();
  const g = new Graphics();
  const fill = new FillGradient({
    type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
    colorStops: storm
      ? [{ offset: 0, color: PAL.void0 }, { offset: 0.6, color: 0x2a000c }, { offset: 1, color: PAL.void1 }]
      : [{ offset: 0, color: PAL.night0 }, { offset: 0.62, color: PAL.night1 }, { offset: 1, color: 0x0f2a3a }],
  });
  g.rect(0, 0, W, H).fill(fill);
  c.addChild(g);
  const a = new Graphics();
  for (let i = 0; i < 14; i++) a.ellipse(W * (0.05 + i * 0.07), H * (0.2 + 0.04 * Math.sin(i)), W * 0.08, H * 0.14).fill({ color: storm ? PAL.crimson : (i % 3 === 0 ? PAL.teal : PAL.green), alpha: storm ? 0.03 : 0.022 });
  c.addChild(a);
  const s = new Graphics();
  for (let i = 0; i < 160; i++) s.circle(crand() * W, crand() * H * 0.7, crand() < 0.9 ? 0.6 : 1.2).fill({ color: 0xeaf8ff, alpha: 0.25 + crand() * 0.6 });
  c.addChild(s);
  if (storm) {
    // plasma sun rising behind the shards (stand-in for the sky module)
    const sun = new Graphics();
    for (let i = 14; i >= 1; i--) sun.circle(W / 2, H * 0.42, Math.min(W, H) * 0.02 * i).fill({ color: i < 4 ? 0xfff4e0 : i < 8 ? PAL.molten : PAL.crimson, alpha: i < 4 ? 0.5 : 0.07 });
    c.addChild(sun);
  }
  return c;
}

// grid geometry (phone-like)
const cols = view === 'cells64' ? 8 : 6;
const gridSize = Math.min(W - 32, H * 0.56);
const cell = Math.floor(gridSize / cols);
const gx = Math.round((W - cell * cols) / 2), gy = Math.round(H * 0.3);
const centerOf = (i: number) => ({ x: gx + (Math.floor(i / cols) + 0.5) * cell, y: gy + ((i % cols) + 0.5) * cell });
const arcHead = { x: W * 0.62, y: gy - Math.max(40, H * 0.1) };

let set: SymbolSet | null = null;
let cfx: CellFx | null = null;
const storm = view === 'cells64';
if (!hp.has('noart')) try {
  const px = [64, 96, 128, 160, 192, 256].find((p) => p >= cell * renderer.resolution * 1.25) ?? 256;
  set = bakeSymbols(renderer, { edition: storm ? 'storm' : 'base', cellPx: px, env: storm ? STORM_ENV : [[0.24, 1.0, 0.69], [0.10, 0.89, 0.84], [0.54, 0.36, 1.0]] });
  cfx = bakeCellFx(renderer, px);
} catch (e) {
  console.warn('art bake failed, using fallback discs', e);
}
function fallbackTex(k: number): Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const col = '#' + SYM_GLOW[k].toString(16).padStart(6, '0');
  const gr = g.createRadialGradient(56, 50, 4, 64, 64, 56);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(64, 8); g.lineTo(120, 64); g.lineTo(64, 120); g.lineTo(8, 64); g.closePath(); g.fill();
  return Texture.from(cv);
}
const symTex = (k: number) => set?.textures[k] ?? fallbackTex(k);

const syms: (Sprite | null)[] = [];
const symOf: number[] = [];
function buildGrid(): void {
  for (let i = 0; i < cols * cols; i++) {
    const { x, y } = centerOf(i);
    if (cfx) {
      const bg = new Sprite(storm ? cfx.stormBg : cfx.cellBg);
      bg.anchor.set(0.5); bg.position.set(x, y); bg.width = bg.height = cell; bg.alpha = storm ? 0.9 : 0.55;
      L.grid.addChild(bg);
    }
    const k = Math.floor(crand() * 8);
    symOf[i] = k;
    const sp = new Sprite(symTex(k));
    sp.anchor.set(0.5); sp.position.set(x, y); sp.width = sp.height = cell;
    L.grid.addChild(sp);
    syms[i] = sp;
  }
  // frame line
  const fr = new Graphics();
  fr.roundRect(gx - 5, gy - 5, cell * cols + 10, cell * cols + 10, 12).stroke({ color: storm ? PAL.molten : PAL.frost, width: 2, alpha: 0.55 });
  L.grid.addChild(fr);
}

function buildArc(): void {
  const g = new Graphics();
  const cx = W / 2, R = W * 1.1, cy = arcHead.y + R;
  const a0 = -Math.PI / 2 - 0.36, a1 = -Math.PI / 2 + 0.36;
  g.arc(cx, cy, R, a0, a1).stroke({ color: 0x1b2d4f, width: 7, cap: 'round' });
  const ah = Math.atan2(arcHead.y - cy, arcHead.x - cx);
  g.arc(cx, cy, R, a0, ah).stroke({ color: PAL.teal, width: 7, cap: 'round', alpha: 0.9 });
  L.arc.addChild(g);
  // snap head to the arc
  arcHead.x = cx + Math.cos(ah) * R; arcHead.y = cy + Math.sin(ah) * R;
  const head = new Graphics();
  head.circle(arcHead.x, arcHead.y, 6).fill({ color: 0xeaf8ff });
  L.arc.addChild(head);
}

// ─────────────────────────────── fx systems exactly as the world constructs them ───────────────────────────────
const particles = new Particles(2400);
const motes = new Motes();
const cellShatter = new CellShatter();
const screenShatter = new ScreenShatter(renderer);
L.cellFx.addChild(cellShatter);
L.particles.addChild(particles);
L.motes.addChild(motes);
shatterLayer.addChild(screenShatter);

// ─────────────────────────────── scripted events ───────────────────────────────
type Ev = { t: number; fn: () => void };
const events: Ev[] = [];
const at = (t: number, fn: () => void) => events.push({ t, fn });
let crackTween: { t0: number; dur: number } | null = null;
let arrivals = 0;

const shatterCell = (i: number, warm: boolean) => {
  const s = syms[i];
  const p = centerOf(i);
  if (s) { cellShatter.burst(s.texture, p.x, p.y, cell, { warm }); s.destroy(); syms[i] = null; }
  if (warm) particles.emit('spark', p.x, p.y, 3, { color: SYM_GLOW[symOf[i]], speed: 220, spread: Math.PI * 2, life: 0.5 });
};

L.sky.addChild(sky(false));
if (view === 'cells' || view === 'cells64' || view === 'motes' || view === 'timelapse' || view === 'particles' || view === 'screen') buildGrid();
if (view === 'motes' || view === 'timelapse' || view === 'screen') buildArc();

if (view === 'cells') {
  const warmCells = [7, 8, 13, 14, 15, 20, 21, 26];
  const coldCells = [4, 5, 10, 11, 17];
  at(0, () => { for (const i of warmCells) shatterCell(i, true); for (const i of coldCells) shatterCell(i, false); });
  probe.warm = warmCells.length; probe.cold = coldCells.length;
} else if (view === 'cells64') {
  L.sky.removeChildren(); L.sky.addChild(sky(true));
  at(0, () => { for (let i = 0; i < 64; i++) shatterCell(i, true); });
} else if (view === 'motes') {
  const cluster = [7, 8, 13, 14, 15, 20, 21, 26];
  at(0.0, () => {
    for (const i of cluster) { const s = syms[i]; if (s) { s.alpha = 0.25; } }
    const n = 5;
    for (let m = 0; m < n; m++) {
      const i = cluster[Math.floor((m / n) * cluster.length)];
      motes.launch(centerOf(i), arcHead, 1, { color: PAL.mote, dur: 0.62 + crand() * 0.18, onArrive: () => { arrivals++; } });
    }
  });
  at(0.12, () => { motes.launch(centerOf(33), arcHead, 3, { color: PAL.gold, dur: 0.7, onArrive: () => { arrivals++; } }); });
} else if (view === 'timelapse') {
  const n = 90, secs = 2.4;
  for (let m = 0; m < n; m++) {
    at((m / n) * secs * 0.92, () => {
      const i = Math.floor(crand() * cols * cols);
      motes.launch(centerOf(i), arcHead, 1, { color: PAL.mote, dur: 0.45 + crand() * 0.25, onArrive: () => { arrivals++; } });
    });
  }
  probe.launched = n;
} else if (view === 'particles') {
  for (let c = 0; c < cols; c++) at(c * 0.05, () => { const p = centerOf(c * cols + cols - 1); particles.emit('snow', p.x, p.y + cell * 0.45, 5, { color: PAL.ice, speed: 60, spread: 1.2, angle: -Math.PI / 2, life: 0.6, size: 0.6 }); });
  at(0.0, () => { const p = centerOf(9); particles.emit('glint', p.x, p.y, 22, { color: PAL.gold, speed: 260, spread: Math.PI * 2, life: 0.8 }); });
  at(0.02, () => { for (const i of [26, 27, 32]) { const p = centerOf(i); particles.emit('spark', p.x, p.y, 3, { color: SYM_GLOW[1], speed: 220, spread: Math.PI * 2, life: 0.5 }); } });
  at(0.0, () => {
    const cx = W / 2, cy = gy + cell * 1.2;
    particles.emit('glint', cx, cy, 18, { color: PAL.gold, speed: 380, spread: Math.PI * 2, life: 1.1 });
    particles.emit('ember', cx, cy + 20, 10, { color: PAL.gold, speed: 300, spread: 1.4, angle: -Math.PI / 2, life: 1.4, gravity: 300 });
  });
  at(0.1, () => {
    const r = { x: gx, y: gy, size: cell * cols };
    for (let k = 0; k < 40; k++) {
      const u = k / 40, side = k % 4;
      const x = side === 0 ? r.x + u * r.size : side === 1 ? r.x + r.size : side === 2 ? r.x + (1 - u) * r.size : r.x;
      const y = side === 0 ? r.y : side === 1 ? r.y + u * r.size : side === 2 ? r.y + r.size : r.y + (1 - u) * r.size;
      particles.emit('ember', x, y, 2, { color: PAL.molten, speed: 90, spread: Math.PI * 2, life: 0.9 });
    }
  });
  at(0.05, () => { particles.emit('dust', W * 0.3, H * 0.2, 12, { speed: 40 }); particles.emit('shardlet', W * 0.75, H * 0.2, 14, { speed: 280 }); });
} else if (view === 'screen') {
  const logo = new Text({ text: 'NORDLYS', style: { fontFamily: 'system-ui, sans-serif', fontSize: Math.min(44, W * 0.1), fontWeight: '800', fill: 0xeaf8ff, letterSpacing: 6 } });
  logo.anchor.set(0.5); logo.position.set(W / 2, H * 0.1);
  L.banners.addChild(logo);
  const impact = { x: W * 0.5, y: gy + cell * cols * 0.45 };
  at(0, () => {
    const rt = RenderTexture.create({ width: W, height: H, resolution: renderer.resolution, antialias: false });
    renderer.render({ container: scene, target: rt, clear: true });
    screenShatter.start(rt, impact, { cells: 48 });
    screenShatter.crackReveal = 0;
    // hideForShatter(true) + sky flips to storm void
    for (const c of [L.grid, L.cellFx, L.arc, L.motes, L.banners]) c.visible = false;
    L.sky.removeChildren(); L.sky.addChild(sky(true));
    crackTween = { t0: 0, dur: 0.25 };
    probe.impact = impact;
  });
}

// ─────────────────────────────── deterministic stepping ───────────────────────────────
const DT = 1 / 60;
let now = 0;
let evi = 0;
events.sort((a, b) => a.t - b.t);
let updMax = 0, updSum = 0, frames = 0;
const tSys = [0, 0, 0, 0];
function step(dt: number): void {
  while (evi < events.length && events[evi].t <= now + 1e-9) events[evi++].fn();
  if (crackTween) {
    const x = Math.min(1, Math.max(0, (now - crackTween.t0) / crackTween.dur));
    screenShatter.crackReveal = 1 - (1 - x) * (1 - x);
  }
  const t0 = performance.now();
  particles.update(dt);
  const t1 = performance.now();
  motes.update(dt);
  const t2 = performance.now();
  cellShatter.update(dt);
  const t3 = performance.now();
  screenShatter.update(dt);
  const ms = performance.now() - t0;
  tSys[0] += t1 - t0; tSys[1] += t2 - t1; tSys[2] += t3 - t2; tSys[3] += performance.now() - t3;
  updMax = Math.max(updMax, ms); updSum += ms; frames++;
  now += dt;
}

if (view === 'qa') {
  const res: Record<string, unknown> = {};
  // 1) onArrive exactly once — normal flight, pool overflow (250 > 192), and flush()
  const counts = new Map<number, number>();
  const cb = (id: number) => () => counts.set(id, (counts.get(id) ?? 0) + 1);
  for (let i = 0; i < 250; i++) motes.launch({ x: 50, y: 700 }, { x: 300, y: 100 }, 1, { dur: 0.5, onArrive: cb(i) });
  motes.launch({ x: 50, y: 700 }, { x: 300, y: 100 }, 3, { dur: 0.5, onArrive: cb(1000) }); // n = 3 → 3 calls
  for (let i = 0; i < 20; i++) motes.update(1 / 60);
  // hit-stop: nothing may arrive while dt = 0
  const before = [...counts.values()].reduce((a, b) => a + b, 0);
  for (let i = 0; i < 60; i++) motes.update(0);
  const during = [...counts.values()].reduce((a, b) => a + b, 0);
  for (let i = 0; i < 90; i++) motes.update(1 / 60);
  let bad = 0;
  for (let i = 0; i < 250; i++) if (counts.get(i) !== 1) bad++;
  res.motesExactlyOnce = bad === 0 && counts.get(1000) === 3;
  res.motesFrozenDuringHitStop = before === during;
  // flush fires pending ones exactly once
  let fl = 0;
  motes.launch({ x: 0, y: 0 }, { x: 10, y: 10 }, 5, { dur: 5, onArrive: () => fl++ });
  motes.update(1 / 60); motes.flush(); motes.update(1 / 60); motes.flush();
  res.flushOnce = fl === 5;
  // 2) particles: hit-stop freeze + budget
  particles.emit('ember', 100, 100, 50, { speed: 200 });
  particles.update(1 / 60);
  const snap = particles.pc.particleChildren.map((q) => q.x + q.y * 1e4 + q.color);
  for (let i = 0; i < 30; i++) particles.update(0);
  const snap2 = particles.pc.particleChildren.map((q) => q.x + q.y * 1e4 + q.color);
  res.particlesFrozen = snap.length === snap2.length && snap.every((v, i) => v === snap2[i]);
  particles.setBudget(10);
  particles.emit('spark', 100, 100, 100);
  res.budgetRespected = particles.count <= 10;
  particles.setBudget(2400);
  for (let i = 0; i < 200; i++) particles.update(1 / 60);
  res.particlesDrain = particles.count === 0;
  // 3) cell shatter: 64 bursts, pieces die, cold emits nothing
  const tex = symTex(1);
  for (let i = 0; i < 64; i++) cellShatter.burst(tex, 100 + (i % 8) * 40, 200 + Math.floor(i / 8) * 40, 40, { warm: true });
  res.cellPieces64 = cellShatter.count;
  const sp0 = cellShatter.sparks.count;
  cellShatter.burst(tex, 100, 100, 40, { warm: false });
  res.coldNoSparks = cellShatter.sparks.count === sp0;
  for (let i = 0; i < 90; i++) cellShatter.update(1 / 60);
  res.cellDrain = cellShatter.count === 0 && cellShatter.sparks.count === 0;
  // 4) screen shatter lifecycle
  const rt = RenderTexture.create({ width: W, height: H });
  res.doneBeforeStart = screenShatter.done;
  screenShatter.start(rt, { x: W / 2, y: H / 2 }, { cells: 48 });
  res.notDoneAfterStart = !screenShatter.done;
  for (let i = 0; i < 30; i++) screenShatter.update(0); // hit-stop at the impact
  for (let i = 0; i <= 15; i++) { screenShatter.crackReveal = i / 15; screenShatter.update(1 / 60); }
  let frames = 0;
  while (!screenShatter.done && frames < 600) { screenShatter.update(1 / 60); frames++; }
  res.flightSeconds = +(frames / 60).toFixed(2);
  res.doneAndCleared = screenShatter.done && screenShatter.children.every((c) => !c.visible || c === screenShatter.children[screenShatter.children.length - 1]);
  res.rtNotDestroyed = !rt.destroyed && !rt.source.destroyed;
  Object.assign(probe, res);
} else if (view === 'kinds') {
  // one static particle per kind, big, mid-life: inspect shapes/colours
  const kinds = ['spark', 'ember', 'snow', 'dust', 'shardlet', 'glint', 'flash', 'ring', 'spike'] as const;
  kinds.forEach((k, i) => {
    const x = W * (0.2 + 0.3 * (i % 3)), y = H * (0.2 + 0.2 * Math.floor(i / 3));
    particles.emitFx(k, x, y, 1, { speed: 0.001, life: 10, gravity: 0, size: parseFloat(hp.get('size') ?? '3'), jitter: 0, drag: 0, color: k === 'glint' ? PAL.gold : k === 'ember' ? PAL.molten : undefined });
  });
  for (let i = 0; i < Math.round(T / DT); i++) step(DT);
} else if (view === 'atlas') {
  const sp = new Sprite(new Texture({ source: atlasSourceOnce() }));
  const s = Math.min(W, H) * 0.9 / 256;
  sp.scale.set(s); sp.position.set((W - 256 * s) / 2, (H - 256 * s) / 2);
  app.stage.removeChildren(); app.stage.addChild(sp);
} else {
  const steps = Math.round(T / DT);
  for (let i = 0; i < steps; i++) step(DT);
}

if (hp.has('bench')) {
  // steady-state cost: 120 extra frames at a tiny dt (everything stays alive), median of the last 100
  const samples: number[] = [];
  for (let i = 0; i < 120; i++) {
    const a = performance.now();
    particles.update(0.0005); motes.update(0.0005); cellShatter.update(0.0005); screenShatter.update(0.0005);
    samples.push(performance.now() - a);
  }
  const tail = samples.slice(20).sort((x, y) => x - y);
  probe.benchMedianMs = +tail[Math.floor(tail.length / 2)].toFixed(3);
  probe.benchP90Ms = +tail[Math.floor(tail.length * 0.9)].toFixed(3);
}
Object.assign(probe, {
  particles: particles.count, cellPieces: cellShatter.count, cellSparks: cellShatter.sparks.count,
  motesInFlight: motes.inFlight, arrivals, shatterDone: screenShatter.done, crackReveal: screenShatter.crackReveal,
  updMsMax: +updMax.toFixed(3), updMsAvg: frames ? +(updSum / frames).toFixed(3) : 0,
  msAvg: { particles: +(tSys[0] / Math.max(1, frames)).toFixed(3), motes: +(tSys[1] / Math.max(1, frames)).toFixed(3), cells: +(tSys[2] / Math.max(1, frames)).toFixed(3), screen: +(tSys[3] / Math.max(1, frames)).toFixed(3) },
  cell, W, H, res: renderer.resolution, art: !!set,
});
// optional inspection zoom: #zoom=3&zx=150&zy=380 (CSS px focus point)
const zoom = parseFloat(hp.get('zoom') ?? '1');
if (zoom !== 1) {
  world.pivot.set(parseFloat(hp.get('zx') ?? String(W / 2)), parseFloat(hp.get('zy') ?? String(H / 2)));
  world.position.set(W / 2, H / 2);
  world.scale.set(zoom);
}
document.getElementById('hud')!.textContent = `${view}  t=${T.toFixed(3)}s  seed=${seed}`;
app.render();
W0.__ready = true;
// a late viewport resize would clear the (single-render) canvas → render again
window.addEventListener('resize', () => { app.renderer.resize(window.innerWidth, window.innerHeight); app.render(); });

if (live) {
  let last = performance.now();
  const loop = () => {
    const n = performance.now();
    step(Math.min(0.05, (n - last) / 1000));
    last = n;
    app.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
