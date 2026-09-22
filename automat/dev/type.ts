// Dev harness for src/render/type (Isfont). Deterministic via URL hash:
//   #view=sheet                 showcase: NORDLYS, SOLSTORM, G5 · EKSTREM, STOR GEVINST, money, ×128, alphabet
//   #view=logo                  NORDLYS intro lockup (world.ts size) + header-size version
//   #view=glyphs&style=ice      every glyph large
//   #view=small                 8–16 px mark labels / popups on cell-like backdrops
//   #view=storm                 Solstorm cinematic frame (SOLSTORM molten + G5 · EKSTREM + KP 9)
//   #view=atlas                 raw SDF atlas (R = distance, G = arc length)
//   #view=perf                  timing probes (text setter, construction)
//   common: &reveal=0.5 &glow=1 &sweep=0.4 &t=2.0 (shader clock) &letter=3 (letter-slam frame)
import { Application, Container, FillGradient, Graphics, Rectangle, Sprite, Texture, type Filter, type Renderer } from 'pixi.js';
import { IsText, installIsfont, isfontStats, setIsfontClock, type IsStyle } from '../src/render/type/isfont.ts';
import { getAtlas } from '../src/render/type/atlas.ts';
import { GLYPHS } from '../src/render/type/glyphs.ts';
import { PAL } from '../src/core/palette.ts';

const hp = new URLSearchParams(location.hash.slice(1));
const view = hp.get('view') ?? 'sheet';
const num = (k: string, d: number) => (hp.has(k) ? Number(hp.get(k)) : d);
const reveal = num('reveal', 1), glow = num('glow', 1), sweep = num('sweep', -0.2), tClock = num('t', 1.3);
setIsfontClock(() => tClock);

const probe: Record<string, unknown> = { view };
(window as unknown as { __probe: unknown }).__probe = probe;

const app = new Application();
await app.init({ resizeTo: window, background: '#050B1A', antialias: true, preference: 'webgl', resolution: window.devicePixelRatio || 1, autoDensity: true });
document.getElementById('host')!.appendChild(app.canvas);
const r = app.renderer as Renderer;
const W = window.innerWidth, H = window.innerHeight;

const t0 = performance.now();
installIsfont(r);
probe.installMs = +(performance.now() - t0).toFixed(1);
probe.atlas = isfontStats(); probe.atlasMs = (window as unknown as { __isfontMs?: unknown }).__isfontMs;

// world container (optionally with the game's bloom, like the real scene graph)
const world = new Container();
app.stage.addChild(world);
if (hp.get('bloom') === '1') {
  try {
    const { createBloom } = await import('../src/render/fx/Bloom.ts');
    world.filters = [createBloom() as unknown as Filter];
    world.filterArea = new Rectangle(0, 0, W, H);
  } catch (e) { console.warn('bloom unavailable', e); }
}
const realSky = hp.get('real') === '1';
let skyLayer: (Container & { update(p: unknown): void }) | null = null;

function sky(storm = false): Container {
  if (realSky) {
    const holder = new Container();
    import('../src/render/sky/SkyLayer.ts').then(({ SkyLayer }) => {
      const sl = new SkyLayer(r) as unknown as Container & { resize(w: number, h: number, hy: number): void; update(p: unknown): void };
      sl.resize(W, H, H * 0.72);
      skyLayer = sl;
      holder.addChild(sl);
      const kp = num('kp', storm ? 9 : 4);
      sl.update({ kp, storm: storm ? 1 : 0, glow: 0, cme: 0, sun: storm ? 0.6 : 0, time: tClock });
    }).catch((e) => console.warn('sky unavailable', e));
    return holder;
  }
  const c = new Container();
  const g = new Graphics();
  const fill = new FillGradient({
    type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
    colorStops: storm
      ? [{ offset: 0, color: PAL.void0 }, { offset: 0.6, color: PAL.void1 }, { offset: 1, color: 0x1a0006 }]
      : [{ offset: 0, color: PAL.night0 }, { offset: 0.55, color: PAL.night1 }, { offset: 1, color: 0x0c2a33 }],
  });
  g.rect(0, 0, W, H).fill(fill);
  c.addChild(g);
  const a = new Graphics();
  for (let i = 0; i < 26; i++) {
    const x = W * (i / 25), y = H * (0.18 + 0.08 * Math.sin(i * 0.7));
    a.ellipse(x, y, W * 0.07, H * 0.16).fill({ color: storm ? PAL.crimson : i % 3 === 2 ? PAL.violet : PAL.green, alpha: 0.03 });
  }
  c.addChild(a);
  const s = new Graphics();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 180; i++) s.circle(rnd() * W, rnd() * H, rnd() < 0.1 ? 1.1 : 0.6).fill({ color: 0xffffff, alpha: 0.2 + rnd() * 0.5 });
  c.addChild(s);
  return c;
}

function T(text: string, size: number, style: IsStyle, x: number, y: number, o: { tracking?: number; align?: 'left' | 'center' | 'right' } = {}): IsText {
  const t = new IsText({ text, size, style, tracking: o.tracking, align: o.align });
  t.position.set(x, y);
  t.reveal = reveal; t.glow = glow; t.sweep = sweep;
  world.addChild(t);
  return t;
}

function pill(x: number, y: number, w: number, h: number, color = 0x0a1630, stroke = 0x3af2ff): void {
  const g = new Graphics();
  g.roundRect(x - w / 2, y - h / 2, w, h, h / 2).fill({ color, alpha: 0.92 }).stroke({ color: stroke, alpha: 0.5, width: 1 });
  world.addChild(g);
}

if (view === 'sheet') {
  world.addChild(sky());
  const m = Math.min(W, 760);
  let y = H * 0.1;
  T('NORDLYS', Math.max(34, m * 0.12), 'ice', W / 2, y, { tracking: 0.14 }); y += m * 0.16;
  T('SOLSTORM', Math.max(34, m * 0.1), 'molten', W / 2, y, { tracking: 0.08 }); y += m * 0.1;
  T('G5 · EKSTREM', Math.max(14, m * 0.035), 'plasma', W / 2, y, { tracking: 0.3 }); y += m * 0.09;
  T('STOR GEVINST', Math.max(22, m * 0.07), 'gold', W / 2, y); y += m * 0.09;
  T('1.234,50 KR', Math.max(18, m * 0.06), 'gold', W / 2, y); y += m * 0.09;
  T('×128', 30, 'plasma', W / 2 - m * 0.18, y); T('×32', 30, 'ice', W / 2 + m * 0.18, y); y += m * 0.09;
  T('3 SOLE · 6,00 KR', 14, 'muted', W / 2, y); y += 30;
  T('ABCDEFGHIJKLMN', 20, 'ice', W / 2, y, { tracking: 0.06 }); y += 34;
  T('OPQRSTUVWXYZÆØÅ', 20, 'ice', W / 2, y, { tracking: 0.06 }); y += 34;
  T('0123456789 .,:%×+−-/·!', 20, 'ice', W / 2, y, { tracking: 0.06 }); y += 34;
  T('MEGA GEVINST  EPISK GEVINST  FLOT GEVINST', 12, 'gold', W / 2, y);
} else if (view === 'logo') {
  world.addChild(sky());
  const size = Math.max(34, Math.min(W, 760) * 0.12);
  T('NORDLYS', size, 'ice', W / 2, H * 0.36, { tracking: 0.14 });
  const hdr = T('NORDLYS', 40, 'ice', W / 2, H * 0.06, { tracking: 0.14 });
  hdr.scale.set(18 / 40);
  probe.logo = { size, width: +(world.children[world.children.length - 2] as IsText).width.toFixed(1) };
} else if (view === 'storm') {
  world.addChild(sky(true));
  const m = Math.min(W, 720);
  const logo = T('SOLSTORM', Math.max(34, m * 0.1), 'molten', W / 2, H * 0.2, { tracking: 0.08 });
  T('G5 · EKSTREM', Math.max(14, m * 0.035), 'plasma', W / 2, H * 0.2 + logo.height * 0.62 + 6, { tracking: 0.3 });
  T('KP 9', Math.max(28, m * 0.09), 'plasma', W / 2, H * 0.42);
  T('MEGA GEVINST', Math.max(22, m * 0.085), 'molten', W / 2, H * 0.6);
  T('412,40 KR', Math.max(18, m * 0.06), 'molten', W / 2, H * 0.7);
  if (hp.has('letter')) {
    // letter-slam frame: letters before `letter` landed, the current one mid-slam
    const li = num('letter', 3);
    logo.letters.forEach((L, i) => {
      if (i > li) L.alpha = 0;
      else if (i === li) { L.scale.set(1.9); L.alpha = 0.85; }
    });
  }
  probe.letters = logo.letters.length;
} else if (view === 'glyphs') {
  world.addChild(sky());
  const style = (hp.get('style') ?? 'ice') as IsStyle;
  const chars = Object.keys(GLYPHS);
  const size = num('size', 34);
  const cols = Math.max(4, Math.floor(W / (size * 1.25)));
  const cw = W / cols, ch = size * 1.9;
  const from = num('from', 0);
  chars.slice(from).forEach((c, i) => T(c, size, style, cw * (i % cols + 0.5), ch * (Math.floor(i / cols) + 0.7)));
} else if (view === 'small') {
  world.addChild(sky());
  let y = 30;
  for (const s of [8, 9, 10, 12, 14]) {
    const cell = s / 0.16;
    for (let i = 0; i < 5; i++) {
      const x = 40 + i * (cell * 0.9);
      pill(x, y, cell * 0.62, cell * 0.3);
      T('×' + [2, 4, 8, 16, 128][i], s, i === 4 ? 'plasma' : 'ice', x, y);
    }
    T(s + 'px', 10, 'muted', W - 30, y, { align: 'right' });
    y += cell * 0.45;
  }
  y += 10;
  T('12,40 KR', 11, 'gold', W * 0.3, y); T('0,60 KR', 11, 'muted', W * 0.7, y); y += 26;
  T('1.234,50 KR', 16, 'gold', W * 0.5, y); y += 30;
  T('3 SOLE · 6,00 KR', 12, 'gold', W * 0.5, y); y += 26;
  T('STOR GEVINST', 22, 'gold', W * 0.5, y); y += 36;
  T('NORDLYS', 14, 'ice', W * 0.5, y, { tracking: 0.14 }); y += 28;
  T('LAD HIMLEN LADE OP', 10, 'muted', W * 0.5, y, { tracking: 0.2 });
} else if (view === 'atlas') {
  const a = getAtlas();
  const cv = document.createElement('canvas');
  cv.width = a.width; cv.height = a.height;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(a.width, a.height);
  const d = a.source.resource as Uint8Array;
  for (let i = 0; i < a.width * a.height; i++) {
    const sd = d[i * 4] / 255 * 6 - 2;
    const inside = sd < 0;
    const band = Math.abs(((sd * 2) % 1 + 1) % 1 - 0.5) < 0.06 ? 60 : 0;
    const arc = d[i * 4 + 1];
    img.data[i * 4] = inside ? 255 : band + 20;
    img.data[i * 4 + 1] = inside ? 255 - arc * 0.6 : band + 20 + Math.max(0, 40 - sd * 10);
    img.data[i * 4 + 2] = inside ? 120 + arc * 0.5 : band + 40;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const sp = new Sprite(Texture.from(cv));
  const k = Math.min(W / a.width, H / a.height);
  sp.scale.set(k);
  app.stage.addChild(sp);
} else if (view === 'perf') {
  world.addChild(sky());
  const t = T('0,00 KR', 30, 'gold', W / 2, H / 2);
  let s = performance.now();
  for (let i = 0; i < 20000; i++) t.text = (i * 137 / 100).toFixed(2).replace('.', ',') + ' KR';
  probe.textSetUs = +((performance.now() - s) / 20000 * 1000).toFixed(2);
  s = performance.now();
  const many: IsText[] = [];
  for (let i = 0; i < 64; i++) many.push(new IsText({ text: '×' + (2 << (i % 6)), size: 9, style: 'ice' }));
  probe.construct64Ms = +(performance.now() - s).toFixed(2);
  s = performance.now();
  for (const m of many) m.destroy();
  probe.destroy64Ms = +(performance.now() - s).toFixed(2);
  const grid = new Container();
  for (let i = 0; i < 64; i++) {
    const m = new IsText({ text: '×' + (2 << (i % 6)), size: 9, style: i % 2 ? 'ice' : 'plasma' });
    m.position.set(30 + (i % 8) * 40, 60 + Math.floor(i / 8) * 30);
    grid.addChild(m);
  }
  app.stage.addChild(grid);
  // frame cost with 64 labels + a count-up
  let frames = 0;
  const f0 = performance.now();
  app.ticker.add(() => { frames++; t.text = (frames * 3.17).toFixed(2).replace('.', ',') + ' KR'; });
  setTimeout(() => { probe.fps = +(frames / ((performance.now() - f0) / 1000)).toFixed(1); }, 1500);
}

void skyLayer;
