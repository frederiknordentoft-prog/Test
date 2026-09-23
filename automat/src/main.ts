// NORDLYS · SOLSTORM G5 — boot.
import { Hud, type Intent } from './ui/hud.ts';
import { World } from './game/world.ts';
import { Game } from './game/Game.ts';
import { seedCosmetic } from './core/cosmeticRng.ts';
import { kpFromCharge } from './game/tiers.ts';
import { CONFIG } from './math/config.ts';

// Deep links: artifacts only receive a bare #anchor, so flags are plain tokens joined by '_' or '-':
//   #solstorm  #clean  #fullfx  #fps  #autostart   (e.g. #solstorm_clean). Dev also accepts ?seed=123.
const tokens = new Set(location.hash.replace(/^#/, '').toLowerCase().split(/[-_.~]+/).filter(Boolean));
const query = new URLSearchParams(location.search);
const flag = (t: string) => tokens.has(t) || query.get(t) === '1';
if (query.has('seed')) seedCosmetic(Number(query.get('seed')) || 1);
if (flag('clean')) document.documentElement.classList.add('clean');

let game: Game | null = null;
const queue: Intent[] = [];
const hud = new Hud(document.getElementById('app')!, (i) => { if (game) game.dispatch(i); else queue.push(i); });
const world = new World(hud);

function poster(msg: string): void {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;text-align:center;padding:24px;background:radial-gradient(ellipse at 50% 30%,#0f3b2e,#050b1a 60%);color:#eaf8ff;font:600 15px system-ui;z-index:99';
  d.innerHTML = `<div><div style="font-size:34px;letter-spacing:.3em;font-weight:800;margin-bottom:10px">NORDLYS</div><div style="opacity:.8">${msg}</div></div>`;
  document.body.appendChild(d);
}

async function boot(): Promise<void> {
  let charge = 0;
  try {
    const raw = localStorage.getItem('nordlys.v1');
    if (raw) charge = JSON.parse(raw).meter?.charge ?? 0;
  } catch { /* ignore */ }
  try {
    await world.init(() => (game ? game.kp() : kpFromCharge(charge, CONFIG.K)));
  } catch (e) {
    console.error(e);
    poster('Denne demo kræver WebGL 2. Prøv en nyere browser eller en anden enhed.');
    return;
  }
  game = new Game(hud, world);
  world.demoOnLoad = flag('solstorm');
  if (flag('fullfx')) game.dispatch({ t: 'fullFx' });
  game.boot();
  for (const i of queue.splice(0)) game.dispatch(i);
  const dbg = { ...game.debug(), advance: (ms: number, render = true) => world.advance(ms, render), world, game };
  (window as unknown as { __slot: typeof dbg }).__slot = dbg;
  if (flag('fps')) fpsOverlay();
  if (flag('autostart')) { game.noticeExpired(); game.dispatch({ t: 'unlock' }); }
}

function fpsOverlay(): void {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:6px;bottom:40px;z-index:50;font:600 11px ui-monospace,monospace;color:#3dffb0;background:rgba(0,0,0,.6);padding:3px 6px;border-radius:6px;pointer-events:none';
  document.body.appendChild(d);
  let last = performance.now(), frames = 0, worst = 0;
  const loop = (t: number) => {
    frames++;
    worst = Math.max(worst, t - last);
    last = t;
    if (frames % 30 === 0) { d.textContent = `${(1000 / ((t - (loop as unknown as { s?: number }).s!) / 30)).toFixed(0)} fps · worst ${worst.toFixed(1)} ms`; worst = 0; (loop as unknown as { s?: number }).s = t; }
    requestAnimationFrame(loop);
  };
  (loop as unknown as { s?: number }).s = performance.now();
  requestAnimationFrame(loop);
}

void boot();
