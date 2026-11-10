/**
 * HUD sandbox: the real HUD over a stand-in for the instrument, with a fake
 * model, a fake simulator and a state driver for screenshots.
 *
 *   window.__SN.hud                 the HUD
 *   window.__SN.hudDemo('nudge')    splash | idle | nudge | win | free | menu-regler |
 *                                   menu-matematik | menu-demo | bigwin3 | outro
 *   ?state=<name>                   start in that state
 *
 * The dashed box is the free rectangle from getInsets(); the disc is where the
 * view would fit the orrery.
 */
import { BET_LEVELS, DEFAULT_BET_INDEX, START_BALANCE, SYM } from '../core/config';
import { debug, loop } from '../core/loop';
import type { HudCallbacks, ModelInfo, Simulator } from '../core/types';
import { createHud } from '../ui/hud';

document.documentElement.style.cssText = 'height:100%;background:#03050d;';
document.body.style.cssText =
  'margin:0;height:100%;overflow:hidden;background:radial-gradient(ellipse at 50% 44%,#16245a 0%,#0d1433 30%,#070b1c 60%,#03050d 100%);';
const container = document.createElement('div');
container.style.cssText = 'position:fixed;inset:0;';
document.body.append(container);

const free = document.createElement('div');
free.style.cssText = 'position:absolute;border:1px dashed rgba(244,236,216,.16);pointer-events:none;';
const board = document.createElement('div');
// Bands at the real proportions: hub, four enamel rings in brass, the bezel at 91–98 % of FIT_RADIUS.
board.style.cssText =
  'position:absolute;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side,' +
  '#fff8e6 0 3%,#ffc46b 5%,#ff8a3c 8%,#5a3f17 9% 14%,#b8923f 14.4% 15%,' +
  '#0a1230 15% 33%,#b8923f 33% 34%,#101b47 34% 52%,#b8923f 52% 53%,#0a1230 53% 71%,#b8923f 71% 72.4%,#101b47 72.4% 90.4%,' +
  '#5a3f17 90.4% 91.2%,#b8923f 91.2%,#f2d488 94.5%,#b8923f 98%,rgba(184,146,63,0) 98.4%);' +
  'box-shadow:0 0 60px rgba(255,196,107,.12);';
container.append(free, board);

const model: ModelInfo = {
  name: 'Stella Nova (sandbox)',
  version: '0.0',
  paytable: [
    { symbol: SYM.SAPPHIRE, pay3: 0.2, pay4: 0.6 },
    { symbol: SYM.EMERALD, pay3: 0.3, pay4: 0.8 },
    { symbol: SYM.AMETHYST, pay3: 0.4, pay4: 1 },
    { symbol: SYM.RUBY, pay3: 0.5, pay4: 1.5 },
    { symbol: SYM.MOON, pay3: 1, pay4: 3 },
    { symbol: SYM.JUPITER, pay3: 1.5, pay4: 5 },
    { symbol: SYM.SATURN, pay3: 2.5, pay4: 10 },
    { symbol: SYM.SUN, pay3: 5, pay4: 25 },
  ],
  ladder: [1, 2, 3, 5, 8, 12, 20],
  freeSpinsAward: { 3: 8, 4: 12 },
  retriggerAward: { 2: 2, 3: 5 },
  maxWinMultiple: 5000,
  novaThreshold: 40,
  stats: {
    rtp: 0.9602,
    rtpNoNudge: 0.8715,
    hitFrequency: 0.446,
    hitFrequencyAtLeastBet: 0.213,
    stdDev: 5.6,
    freeSpinsEvery: 152,
    novaEvery: 68,
    breakdown: { base: 0.5412, nudge: 0.0887, nova: 0.0911, freeSpins: 0.2392 },
    sampleSize: 50_000_000,
    maxObservedMultiple: 3180.4,
  },
};

// Fake Monte Carlo: a made-up return distribution with the model's mean, stepped by the loop.
const jobs = new Set<() => void>();
const simulator: Simulator = (spins, onProgress) => {
  let done = 0;
  let sum = 0;
  let hits = 0;
  let fs = 0;
  let nova = 0;
  let max = 0;
  let seed = (0x9e3779b9 ^ spins) | 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const scale = model.stats.rtp / 0.98;
  const chunk = Math.ceil(spins / 160);
  const step = () => {
    const n = Math.min(chunk, spins - done);
    for (let i = 0; i < n; i++) {
      const u = rnd();
      let pay = 0;
      if (u >= 0.999) pay = 120 + rnd() * 60;
      else if (u >= 0.99) pay = 30;
      else if (u >= 0.96) pay = 8;
      else if (u >= 0.86) pay = 2;
      else if (u >= 0.56) pay = 0.4;
      else if (u < 1 / 152) fs++;
      else if (u > 0.3 && u < 0.3 + 1 / 68) nova++;
      if (pay > 0) {
        pay *= scale;
        hits++;
        sum += pay;
        if (pay > max) max = pay;
      }
    }
    done += n;
    const finished = done >= spins;
    if (finished) jobs.delete(step);
    onProgress({ spins: done, target: spins, rtp: sum / done, hitFrequency: hits / done, freeSpinsTriggers: fs, novaTriggers: nova, maxMultiple: max, done: finished });
  };
  jobs.add(step);
  return { cancel: () => void jobs.delete(step) };
};

const hud = createHud();
const log: string[] = [];
let betIndex: number = DEFAULT_BET_INDEX;
let balance: number = START_BALANCE;
const timers: { at: number; fn: () => void }[] = [];
let clock = 0;
const after = (seconds: number, fn: () => void) => timers.push({ at: clock + seconds, fn });
const showBet = () => hud.setBet(BET_LEVELS[betIndex], { canDec: betIndex > 0, canInc: betIndex < BET_LEVELS.length - 1 });

const cb: HudCallbacks = {
  onStart: () => {
    log.push('start');
    demo('idle');
  },
  onSpin: () => {
    log.push('spin');
    balance -= BET_LEVELS[betIndex];
    hud.setBalance(balance);
    hud.setWin(0);
    hud.setSpinState('spinning');
    after(1.1, () => {
      const win = BET_LEVELS[betIndex] * 3;
      balance += win;
      hud.setWin(win, { countSeconds: 0.6 });
      hud.setBalance(balance, { animate: true });
      hud.setSpinState('ready');
    });
  },
  onSkip: () => log.push('skip'),
  onBet: (dir) => {
    betIndex = Math.min(BET_LEVELS.length - 1, Math.max(0, betIndex + dir));
    showBet();
  },
  onAuto: (n) => {
    log.push(`auto ${n}`);
    hud.setAuto(n);
    hud.setSpinState(n === null ? 'ready' : 'auto');
  },
  onTurbo: (on) => log.push(`turbo ${on}`),
  onAutoNudge: (on) => log.push(`autoNudge ${on}`),
  onNudgePass: () => {
    log.push('pass');
    hud.nudgePrompt({ on: false });
    hud.setSpinState('ready');
  },
  onNudgeChoice: (c) => log.push(`nudge ring ${c.ring} dir ${c.dir}`),
  onMute: (m) => log.push(`mute ${m}`),
  onVolume: (bus, v) => log.push(`volume ${bus} ${v.toFixed(2)}`),
  onQuality: (q) => log.push(`quality ${q}`),
  onDemo: (a) => log.push(`demo ${a}`),
};

hud.init(container, cb, model);
hud.setSimulator(simulator);
hud.setQuality('high');

function demo(name: string): void {
  hud.skip();
  hud.closeMenu();
  hud.showSplash(false);
  hud.setMode('base');
  hud.setFreeSpins(null);
  hud.setAuto(null);
  hud.nudgePrompt({ on: false });
  hud.setMessage(null);
  hud.setSpinState('ready');
  hud.setMultiplier(0, 1);
  hud.setNovaCharge(0.4);
  hud.setBalance(balance);
  hud.setWin(0);
  showBet();
  const w = container.clientWidth;
  const h = container.clientHeight;
  switch (name) {
    case 'splash':
      hud.showSplash(true);
      break;
    case 'nudge':
      hud.setWin(1200);
      hud.setSpinState('nudge');
      hud.nudgePrompt({ on: true, bestAmount: 4500 });
      break;
    case 'win':
      hud.setSpinState('spinning');
      hud.setMultiplier(3, 5, { pulse: true });
      hud.setNovaCharge(1);
      hud.setWin(48000);
      hud.setMessage('Kædereaktion: ×5', 'win');
      hud.toast('Stella Nova er ladet', 'feature');
      hud.floatText({ x: w * 0.5, y: h * 0.4 }, '+45,00 kr.');
      hud.floatText({ x: w * 0.66, y: h * 0.3 }, '×5', 'mult');
      break;
    case 'free':
      // The longest amounts the meters must hold.
      hud.setMode('free');
      hud.setFreeSpins({ remaining: 6, total: 8, win: 123456789 });
      hud.setSpinState('free');
      hud.setMultiplier(1, 2);
      hud.setBalance(123456789);
      hud.setWin(123456789);
      hud.setMessage('Kometnat: 6 gratisspil tilbage', 'feature');
      break;
    case 'menu-regler':
      hud.openMenu('rules');
      break;
    case 'menu-matematik':
      hud.openMenu('math');
      document.querySelector<HTMLButtonElement>('.sn-act')?.click();
      break;
    case 'menu-demo':
      hud.openMenu('demo');
      break;
    case 'bigwin3':
      hud.setSpinState('disabled');
      void hud.bigWin(3, 123456789, { seconds: 2 });
      break;
    case 'outro':
      hud.setMode('free');
      hud.setSpinState('disabled');
      void hud.freeSpinsOutro(245000);
      break;
    default:
      break;
  }
}

let placed = '';
function placeBoard(): void {
  const i = hud.getInsets();
  const fw = Math.max(0, container.clientWidth - i.left - i.right);
  const fh = Math.max(0, container.clientHeight - i.top - i.bottom);
  const key = `${i.left},${i.top},${fw},${fh}`;
  if (key === placed) return;
  placed = key;
  const d = Math.min(fw, fh);
  free.style.cssText += `left:${i.left}px;top:${i.top}px;width:${fw}px;height:${fh}px;`;
  board.style.left = `${i.left + (fw - d) / 2}px`;
  board.style.top = `${i.top + (fh - d) / 2}px`;
  board.style.width = board.style.height = `${d}px`;
}

loop.onUpdate((dt) => {
  clock += dt;
  for (let i = timers.length - 1; i >= 0; i--) {
    if (timers[i].at <= clock) timers.splice(i, 1)[0].fn();
  }
  for (const job of [...jobs]) job();
  hud.update(dt);
  placeBoard();
});
loop.start();

debug.hud = hud;
debug.hudDemo = demo;
debug.hudLog = log;

demo(new URLSearchParams(location.search).get('state') || 'splash');
placeBoard();
const ready = () => {
  (window as unknown as { __SN_READY: boolean }).__SN_READY = true;
};
// Wait for the web fonts (or their failure) so screenshots measure the real metrics.
document.fonts.ready.then(ready, ready);
