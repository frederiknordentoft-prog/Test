// Dev harness for src/render/art (symbols + cell fx). Deterministic views via URL hash:
//   #view=sheet                     all symbols at 64 px: base/green env, base/red env, storm; + cell fx row
//   #view=big&ed=base&env=green&px=192  9 symbols large (ed=base|storm, env=green|red|storm, px = texture size)
//   #view=grid&ed=base&cell=60      phone grid composited like GridView (cellBg, frost, rings, glows)
//   #view=one&sym=0&ed=base&px=256&zoom=3&fx=0&fy=0  one symbol, magnified around a focus point
//   #view=fx&px=192                 cell fx textures large
//   #view=ctx                       bake → forced context loss → auto re-bake via onArtContextRestored
//   #view=async&ed=storm            bakeSymbolsAsync (one symbol per frame)
import { Application, Container, FillGradient, Graphics, Sprite, Text, type Renderer, type Texture } from 'pixi.js';
import { bakeSymbols, bakeSymbolsAsync, bakeCellFx, onArtContextRestored, destroySymbolSet, STORM_ENV, type SymbolSet, type EnvColors } from '../src/render/art/symbols.ts';
import { PAL } from '../src/core/palette.ts';

const hp = new URLSearchParams(location.hash.slice(1));
const view = hp.get('view') ?? 'sheet';
const ed = (hp.get('ed') ?? 'base') as 'base' | 'storm';
const envName = hp.get('env') ?? (ed === 'storm' ? 'storm' : 'green');

const ENVS: Record<string, EnvColors> = {
  // Kp ≈ 2: soft green/teal aurora, faint violet
  green: [[0.18, 0.85, 0.56], [0.08, 0.66, 0.64], [0.30, 0.22, 0.62]],
  // Kp ≈ 8: bright green, violet, red tops
  red: [[0.24, 1.0, 0.69], [0.62, 0.30, 1.0], [1.0, 0.24, 0.43]],
  storm: STORM_ENV,
};
const env = ENVS[envName] ?? ENVS.green;

const probe: Record<string, unknown> = { view, ed, env: envName };
(window as unknown as { __probe: unknown }).__probe = probe;

const app = new Application();
await app.init({ resizeTo: window, background: '#050B1A', antialias: true, preference: 'webgl', resolution: window.devicePixelRatio || 1, autoDensity: true });
document.getElementById('host')!.appendChild(app.canvas);
const r = app.renderer as Renderer;
const W = window.innerWidth, H = window.innerHeight;
const dpr = window.devicePixelRatio || 1;

function backdrop(storm: boolean): Container {
  const c = new Container();
  const g = new Graphics();
  const fill = new FillGradient({
    type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
    colorStops: storm
      ? [{ offset: 0, color: PAL.void0 }, { offset: 0.7, color: PAL.void1 }, { offset: 1, color: 0x1a0006 }]
      : [{ offset: 0, color: PAL.night0 }, { offset: 0.65, color: PAL.night1 }, { offset: 1, color: 0x0f2a3a }],
  });
  g.rect(0, 0, W, H).fill(fill);
  c.addChild(g);
  // faint aurora wash + stars
  const a = new Graphics();
  for (let i = 0; i < 12; i++) a.ellipse(W * (0.1 + i * 0.08), H * 0.22, W * 0.09, H * 0.13).fill({ color: storm ? PAL.crimson : PAL.green, alpha: 0.018 });
  c.addChild(a);
  const s = new Graphics();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 160; i++) s.circle(rnd() * W, rnd() * H, rnd() < 0.1 ? 1.2 : 0.6).fill({ color: 0xffffff, alpha: 0.25 + rnd() * 0.5 });
  c.addChild(s);
  return c;
}

function label(text: string, x: number, y: number, size = 12, color = 0x7f93b2): Text {
  const t = new Text({ text, style: { fontFamily: 'system-ui, sans-serif', fontSize: size, fill: color, fontWeight: '600', letterSpacing: 1 } });
  t.position.set(x, y);
  t.resolution = dpr;
  return t;
}

function sprite(tex: Texture, x: number, y: number, size: number, alpha = 1): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.position.set(x, y);
  s.width = s.height = size;
  s.alpha = alpha;
  return s;
}

const t0 = performance.now();
const stage = app.stage;

if (view === 'sheet') {
  stage.addChild(backdrop(false));
  const px = Math.round(64 * Math.min(dpr, 2));
  const fx = bakeCellFx(r, px);
  const sets: [string, SymbolSet, boolean][] = [
    ['BASE · env Kp2 (green)', bakeSymbols(r, { edition: 'base', cellPx: px, env: ENVS.green }), false],
    ['BASE · env Kp8 (red tops)', bakeSymbols(r, { edition: 'base', cellPx: px, env: ENVS.red }), false],
    ['STORM · crimson/molten/magenta', bakeSymbols(r, { edition: 'storm', cellPx: px, env: STORM_ENV }), true],
  ];
  const cell = 64, gap = 8, x0 = 40;
  let y = 28;
  for (const [name, set, storm] of sets) {
    stage.addChild(label(name, x0, y));
    y += 20;
    for (let i = 0; i < 9; i++) {
      const cx = x0 + i * (cell + gap) + cell / 2, cy = y + cell / 2;
      stage.addChild(sprite(storm ? fx.stormBg : fx.cellBg, cx, cy, cell, storm ? 0.9 : 0.55));
      stage.addChild(sprite(set.textures[i], cx, cy, cell));
    }
    // 44 px (storm 8x8 on a phone) and 56 px versions to the right
    const xs = x0 + 9 * (cell + gap) + 30;
    const small = storm ? 44 : 56;
    for (let i = 0; i < 9; i++) {
      const cx = xs + i * (small + 2) + small / 2, cy = y + cell / 2;
      stage.addChild(sprite(storm ? fx.stormBg : fx.cellBg, cx, cy, small, storm ? 0.9 : 0.55));
      stage.addChild(sprite(set.textures[i], cx, cy, small));
    }
    y += cell + 22;
  }
  stage.addChild(label('CELL FX · cellBg · frost · markRing · plasmaBg · stormBg · glow(tinted)', x0, y));
  y += 20;
  const big = 96;
  const fxs: [Texture, number][] = [[fx.cellBg, 0.55], [fx.frost, 0.9], [fx.plasmaBg, 1], [fx.stormBg, 0.9]];
  fxs.forEach(([t, a], i) => stage.addChild(sprite(t, x0 + i * (big + 12) + big / 2, y + big / 2, big, a)));
  const rx = x0 + 4 * (big + 12) + big / 2;
  const ring = new Sprite(fx.markRing); ring.anchor.set(0.5); ring.width = big * 0.62; ring.height = big * 0.3; ring.position.set(rx, y + big / 2);
  stage.addChild(sprite(fx.cellBg, rx, y + big / 2, big, 0.55), ring);
  const lt = label('×8', 0, 0, big * 0.16, 0xeaf8ff); lt.anchor.set(0.5); lt.position.set(rx, y + big / 2); stage.addChild(lt);
  const gx = x0 + 5 * (big + 12) + big / 2;
  const glowC = new Container(); glowC.blendMode = 'add';
  glowC.addChild(sprite(sets[0][1].glow, gx, y + big / 2, big * 1.5, 0.9)); (glowC.children[0] as Sprite).tint = PAL.green;
  stage.addChild(glowC);
  stage.addChild(sprite(sets[0][1].textures[5], gx, y + big / 2, big));
  // frost + ring composite (a marked cell) and storm plasma + ring
  const mx = x0 + 6 * (big + 12) + big / 2;
  stage.addChild(sprite(fx.cellBg, mx, y + big / 2, big, 0.55), sprite(fx.frost, mx, y + big / 2, big, 0.9), sprite(sets[0][1].textures[2], mx, y + big / 2, big));
  const px2 = x0 + 7 * (big + 12) + big / 2;
  stage.addChild(sprite(fx.stormBg, px2, y + big / 2, big, 0.9), sprite(fx.plasmaBg, px2, y + big / 2, big, 1), sprite(sets[2][1].textures[0], px2, y + big / 2, big));
  const ring2 = new Sprite(fx.markRing); ring2.anchor.set(0.5); ring2.width = big * 0.62; ring2.height = big * 0.3; ring2.position.set(px2, y + big / 2 + big * 0.3);
  const lt2 = label('×32', 0, 0, big * 0.16, 0xffc23d); lt2.anchor.set(0.5); lt2.position.set(px2, y + big / 2 + big * 0.3);
  stage.addChild(ring2, lt2);
} else if (view === 'big') {
  const storm = ed === 'storm';
  stage.addChild(backdrop(storm));
  const cell = Number(hp.get('cell') ?? 200);
  const px = Number(hp.get('px') ?? (cell * Math.min(dpr, 2) * 1.25 > 192 ? 256 : 192));
  const fx = bakeCellFx(r, px);
  const set = bakeSymbols(r, { edition: ed, cellPx: px, env });
  probe.px = px;
  const cols = 5, gap = 16;
  const x0 = (W - (cols * cell + (cols - 1) * gap)) / 2;
  for (let i = 0; i < 9; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = x0 + col * (cell + gap) + cell / 2, cy = 24 + row * (cell + gap) + cell / 2;
    stage.addChild(sprite(storm ? fx.stormBg : fx.cellBg, cx, cy, cell, storm ? 0.9 : 0.55));
    stage.addChild(sprite(set.textures[i], cx, cy, cell));
  }
} else if (view === 'grid') {
  const storm = ed === 'storm';
  stage.addChild(backdrop(storm));
  const n = storm ? 8 : 6;
  const cell = Number(hp.get('cell') ?? (storm ? 45 : 60));
  const want = cell * dpr * 1.25;
  const px = [64, 96, 128, 160, 192, 256].find((p) => p >= want) ?? 256;
  probe.px = px;
  const fx = bakeCellFx(r, px);
  const set = bakeSymbols(r, { edition: ed, cellPx: px, env });
  const size = n * cell;
  const gx = (W - size) / 2, gy = 150;
  let seed = storm ? 99 : 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const glowL = new Container(); glowL.blendMode = 'add';
  const bgL = new Container(), markL = new Container(), symL = new Container(), lblL = new Container();
  stage.addChild(bgL, markL, glowL, symL, lblL);
  const frame = new Graphics().roundRect(gx - 6, gy - 6, size + 12, size + 12, 10).stroke({ color: storm ? PAL.crimson : PAL.frost, width: 2, alpha: 0.6 });
  stage.addChild(frame);
  const weights = [18, 17, 16, 15, 9, 8, 7, 4, 2];
  const tot = weights.reduce((a, b) => a + b, 0);
  for (let c = 0; c < n; c++) for (let rr = 0; rr < n; rr++) {
    const x = gx + (c + 0.5) * cell, y = gy + (rr + 0.5) * cell;
    let u = rnd() * tot, s = 0;
    while (u > weights[s]) { u -= weights[s]; s++; }
    bgL.addChild(sprite(storm ? fx.stormBg : fx.cellBg, x, y, cell, storm ? 0.9 : 0.55));
    const m = rnd();
    if (!storm && m < 0.12) markL.addChild(sprite(fx.frost, x, y, cell, 0.9));
    if ((storm && m < 0.25) || (!storm && m > 0.93)) {
      if (storm) markL.addChild(sprite(fx.plasmaBg, x, y, cell, 1));
      const ring = new Sprite(fx.markRing); ring.anchor.set(0.5); ring.width = cell * 0.62; ring.height = cell * 0.3; ring.position.set(x, y + cell * 0.3);
      markL.addChild(ring);
      const lt = label('×' + [2, 4, 8, 16][Math.floor(rnd() * 4)], 0, 0, Math.max(8, cell * 0.16) * 1.35, storm ? 0xffc23d : 0xeaf8ff); lt.anchor.set(0.5); lt.position.set(x, y + cell * 0.3);
      lblL.addChild(lt);
    }
    if (s === 7 || s === 8) { const g = sprite(set.glow, x, y, cell * 1.5, 0.7); g.tint = s === 8 ? PAL.gold : PAL.green; glowL.addChild(g); }
    symL.addChild(sprite(set.textures[s], x, y, cell));
  }
  stage.addChild(label(`${ed.toUpperCase()} ${n}×${n} · cell ${cell} css px · tex ${px}px · dpr ${dpr}`, 12, 12, 12));
} else if (view === 'one') {
  const storm = ed === 'storm';
  stage.addChild(backdrop(storm));
  const px = Number(hp.get('px') ?? 256);
  const sym = Number(hp.get('sym') ?? 0);
  const set = bakeSymbols(r, { edition: ed, cellPx: px, env });
  const fx = bakeCellFx(r, px);
  // zoom: magnification; fx/fy: focus point in cell units (-1..1, y up)
  const zoom = Number(hp.get('zoom') ?? 1);
  const fxp = Number(hp.get('fx') ?? 0), fyp = Number(hp.get('fy') ?? 0);
  const show = (Math.min(W, H) - 40) * zoom;
  const cx = W / 2 - (fxp * show) / 2, cy = H / 2 + (fyp * show) / 2;
  stage.addChild(sprite(storm ? fx.stormBg : fx.cellBg, cx, cy, show, storm ? 0.9 : 0.55));
  const sp = sprite(set.textures[sym], cx, cy, show);
  stage.addChild(sp);
} else if (view === 'fx') {
  stage.addChild(backdrop(false));
  const px = Number(hp.get('px') ?? 192);
  const fx = bakeCellFx(r, px);
  const cell = 200, gap = 20;
  const items: [string, Texture, number, boolean][] = [['cellBg @0.55', fx.cellBg, 0.55, false], ['frost @0.9', fx.frost, 0.9, false], ['stormBg @0.9', fx.stormBg, 0.9, true], ['plasmaBg', fx.plasmaBg, 1, true]];
  items.forEach(([n, t, a], i) => {
    const cx = 30 + i * (cell + gap) + cell / 2;
    stage.addChild(label(n, cx - cell / 2, 20));
    stage.addChild(sprite(t, cx, 50 + cell / 2, cell, a));
  });
  const ring = new Sprite(fx.markRing); ring.anchor.set(0.5); ring.width = cell * 0.62 * 2; ring.height = cell * 0.3 * 2; ring.position.set(W / 2, 50 + cell + 120);
  stage.addChild(ring);
  const lt = label('×16', 0, 0, cell * 0.16 * 2, 0xeaf8ff); lt.anchor.set(0.5); lt.position.copyFrom(ring.position); stage.addChild(lt);
} else if (view === 'ctx') {
  // bake → lose the WebGL context → restore → re-bake via onArtContextRestored → show
  stage.addChild(backdrop(false));
  const row = new Container(); stage.addChild(row);
  const show = (set: SymbolSet) => { row.removeChildren(); for (let i = 0; i < 9; i++) row.addChild(sprite(set.textures[i], 60 + i * 110, 120, 100)); };
  let set = bakeSymbols(r, { edition: 'base', cellPx: 128, env });
  show(set);
  probe.restored = false;
  onArtContextRestored(r, () => { const old = set; set = bakeSymbols(r, { edition: 'base', cellPx: 128, env }); show(set); destroySymbolSet(old); probe.restored = true; });
  const ctx = (r as unknown as { context: { forceContextLoss(): void } }).context;
  setTimeout(() => ctx.forceContextLoss(), 300);   // Pixi restores automatically
} else if (view === 'async') {
  stage.addChild(backdrop(ed === 'storm'));
  const set = await bakeSymbolsAsync(r, { edition: ed, cellPx: 128, env });
  for (let i = 0; i < 9; i++) stage.addChild(sprite(set.textures[i], 60 + i * 110, 120, 100));
  probe.asyncDone = true;
}
probe.bakeMs = Math.round(performance.now() - t0);
document.getElementById('hud')!.textContent = `art harness · ${view} · ${ed} · env ${envName} · bake ${probe.bakeMs} ms`;
