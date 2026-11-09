/**
 * The single game loop + the window.__SN debug handle.
 *
 * Order per frame: anim → update callbacks (director, hud, view.update) → render.
 * In manual mode (pause) nothing advances until __SN.advance(ms) is called;
 * that is how headless capture steps the show deterministically.
 */
import { anim } from './anim';

export type UpdateFn = (dt: number) => void;

export class Loop {
  private updaters: UpdateFn[] = [];
  private renderers: (() => void)[] = [];
  private raf = 0;
  private last = 0;
  private running = false;
  paused = false;
  /** Smoothed frame time in ms, for adaptive quality. */
  frameMs = 16.7;
  frame = 0;

  onUpdate(fn: UpdateFn): void {
    this.updaters.push(fn);
  }

  onRender(fn: () => void): void {
    this.renderers.push(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      const rawMs = now - this.last;
      this.last = now;
      if (this.paused) return;
      this.frameMs += (Math.min(rawMs, 100) - this.frameMs) * 0.05;
      // Clamp so a background tab or a hitch never fast-forwards the show.
      const dt = Math.min(rawMs, 50) / 1000;
      this.step(dt);
      this.draw();
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Advance simulation only. */
  step(dt: number): void {
    anim.update(dt);
    for (const fn of this.updaters) fn(dt);
    this.frame++;
  }

  draw(): void {
    for (const fn of this.renderers) fn();
  }

  /**
   * Manual stepping: simulate `ms` in `stepMs` slices, yielding to the
   * microtask queue between slices so awaited tweens can chain, then draw once.
   */
  async advance(ms: number, stepMs = 1000 / 60): Promise<void> {
    let left = ms;
    while (left > 1e-6) {
      const s = Math.min(stepMs, left);
      this.step(s / 1000);
      left -= s;
      await Promise.resolve();
      await Promise.resolve();
    }
    this.draw();
  }
}

export const loop = new Loop();

export interface DebugHandle {
  loop: Loop;
  anim: typeof anim;
  pause(): void;
  resume(): void;
  advance(ms: number, stepMs?: number): Promise<void>;
  render(): void;
  [key: string]: unknown;
}

/** window.__SN — feature modules may attach their own entries. */
export const debug: DebugHandle = {
  loop,
  anim,
  pause: () => {
    loop.paused = true;
  },
  resume: () => {
    loop.paused = false;
  },
  advance: (ms, stepMs) => loop.advance(ms, stepMs),
  render: () => loop.draw(),
};

if (typeof window !== 'undefined') {
  (window as unknown as { __SN: DebugHandle }).__SN = debug;
}
