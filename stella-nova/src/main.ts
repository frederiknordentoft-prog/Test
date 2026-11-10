/**
 * Boot: build the frame, create the four modules, hand them to the director
 * and start the loop. The splash stays up until the player presses SPIL,
 * which is also the gesture that lets the browser start audio.
 */
import { createAudio } from './audio/index';
import { SYMBOLS } from './core/config';
import { debug, loop } from './core/loop';
import type { HudCallbacks, Insets, Quality } from './core/types';
import { createDirector, type Director } from './game/director';
import { createEngine } from './math/engine';
import { createSimulator } from './math/sim';
import { createGameView } from './render/view';
import { createHud } from './ui/hud';

const params = new URLSearchParams(location.search);

function fail(app: HTMLElement, message: string): void {
  app.innerHTML = '';
  const box = document.createElement('p');
  box.textContent = message;
  box.style.cssText =
    'margin:auto;max-width:28rem;padding:2rem;text-align:center;font:500 1rem/1.5 Manrope,system-ui,sans-serif;color:#f4ecd8;';
  app.style.display = 'flex';
  app.appendChild(box);
}

async function boot(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  const stageEl = document.createElement('div');
  stageEl.className = 'sn-stage';
  stageEl.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
  const hudEl = document.createElement('div');
  hudEl.className = 'sn-hud-root';
  hudEl.style.cssText = 'position:absolute;inset:0;';
  app.append(stageEl, hudEl);

  const seedParam = params.get('seed');
  const engine = createEngine(seedParam ? { seed: Number(seedParam) >>> 0 } : undefined);
  const audio = createAudio();
  const hud = createHud();
  const view = createGameView();

  // The HUD needs its callbacks before the director exists; forward lazily.
  let director: Director | null = null;
  const callbacks = new Proxy({} as HudCallbacks, {
    get:
      (_target, key: string) =>
      (...args: unknown[]) => {
        const fn = director ? (director.callbacks as unknown as Record<string, (...a: unknown[]) => void>)[key] : undefined;
        return fn?.(...args);
      },
  });
  hud.init(hudEl, callbacks, engine.model);

  const pinned = params.get('q') as Quality | null;
  // Automated browsers render in software: never let the adaptive step-down judge that.
  const fixedQuality: Quality | undefined = pinned ?? (navigator.webdriver ? 'high' : undefined);
  const reducedMotion = params.get('rm') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;

  try {
    await view.init(stageEl, { quality: fixedQuality ?? 'high', reducedMotion });
  } catch (err) {
    console.error('[boot] the view could not start:', err);
    fail(app, 'Stella Nova kræver WebGL 2. Din browser eller enhed kan ikke vise spillet lige nu.');
    return;
  }

  const size = () => ({ width: Math.max(1, stageEl.clientWidth), height: Math.max(1, stageEl.clientHeight) });
  let insets: Insets = hud.getInsets();
  const applyLayout = (next?: Insets): void => {
    if (next) insets = next;
    view.setLayout({ ...size(), insets });
  };
  applyLayout();
  new ResizeObserver(() => applyLayout(hud.getInsets())).observe(stageEl);

  view.setGrid(engine.snapshot().grid);

  director = createDirector({
    engine,
    view,
    audio,
    hud,
    layout: { width: () => size().width, height: () => size().height, apply: applyLayout },
    fixedQuality,
  });

  hud.setSimulator(createSimulator());
  try {
    const icons: Record<number, string> = {};
    for (const s of SYMBOLS) icons[s.id] = view.thumbnail(s.id, 96);
    hud.setSymbolIcons(icons);
  } catch (err) {
    // The HUD keeps its own stand-in icons.
    console.error('[boot] symbol thumbnails failed:', err);
  }

  const d = director;
  loop.onUpdate((dt) => {
    d.update(dt);
    hud.update(dt);
    view.update(dt);
  });
  loop.onRender(() => view.render());
  loop.start();

  hud.showSplash(true);
  view.attract(true);

  debug.director = d;
  debug.engine = engine;
  debug.view = view;
  debug.audio = audio;
  debug.hud = hud;
  debug.game = {
    state: () => d.state,
    balance: () => d.balance,
    start: () => d.start(),
    spin: () => d.spin(),
    rig: (kind: Parameters<Director['rig']>[0]) => d.rig(kind),
    nudge: (choice: Parameters<Director['nudge']>[0]) => d.nudge(choice),
    setTurbo: (on: boolean) => d.setTurbo(on),
    setAutoNudge: (on: boolean) => d.setAutoNudge(on),
    idle: () => d.idle(),
    snapshot: () => engine.snapshot(),
  };
  (window as unknown as { __SN_READY: boolean }).__SN_READY = true;
}

void boot();
