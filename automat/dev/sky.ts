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
function cine(t: number): void {
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
if (seq === 'cine') cine(t0);
sky.update(P);
layout();
app.ticker.add(() => {
  if (!anim) return;
  const t = t0 + (performance.now() - start) / 1000;
  P.time = t;
  if (seq === 'cine') cine(t);
  sky.update(P);
});
