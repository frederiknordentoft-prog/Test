/**
 * Loop-driven animation clock. ALL game/render timing goes through this:
 * no setTimeout, no requestAnimationFrame, no performance.now() in feature
 * code. That keeps the whole show pausable, skippable and steppable frame by
 * frame (window.__SN.advance) for deterministic capture and tests.
 */
import { linear, type Ease } from './ease';

export interface TweenOptions {
  /** Seconds. */
  duration: number;
  /** Seconds before the tween starts. */
  delay?: number;
  ease?: Ease;
  /** Called every update with eased progress (and raw 0..1 progress). */
  onUpdate?: (k: number, t: number) => void;
  onComplete?: () => void;
  /** Tweens in the same group can be cancelled / finished together. */
  group?: string;
}

export interface TweenHandle extends Promise<void> {
  /** Stop without completing. The promise still resolves. */
  cancel(): void;
  /** Jump to the end state now. */
  finish(): void;
}

interface Active {
  elapsed: number;
  opts: TweenOptions;
  resolve: () => void;
  done: boolean;
}

export class AnimClock {
  /** Global speed multiplier (turbo / slow motion). */
  speed = 1;
  /** Seconds of animation time since boot. */
  time = 0;
  private active: Active[] = [];
  private incoming: Active[] = [];

  tween(opts: TweenOptions): TweenHandle {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r)) as TweenHandle;
    const a: Active = { elapsed: -(opts.delay ?? 0), opts, resolve, done: false };
    this.incoming.push(a);
    promise.cancel = () => {
      if (a.done) return;
      a.done = true;
      resolve();
    };
    promise.finish = () => {
      if (a.done) return;
      a.done = true;
      opts.onUpdate?.((opts.ease ?? linear)(1), 1);
      opts.onComplete?.();
      resolve();
    };
    return promise;
  }

  /** Resolves after `seconds` of animation time. */
  wait(seconds: number, group?: string): TweenHandle {
    return this.tween({ duration: Math.max(0, seconds), group });
  }

  /** Resolves on the next update. */
  nextFrame(): TweenHandle {
    return this.tween({ duration: 0 });
  }

  /** Jump every tween in a group to its end state. */
  finishGroup(group: string): void {
    for (const a of [...this.active, ...this.incoming]) {
      if (!a.done && a.opts.group === group) {
        a.done = true;
        a.opts.onUpdate?.((a.opts.ease ?? linear)(1), 1);
        a.opts.onComplete?.();
        a.resolve();
      }
    }
  }

  cancelGroup(group: string): void {
    for (const a of [...this.active, ...this.incoming]) {
      if (!a.done && a.opts.group === group) {
        a.done = true;
        a.resolve();
      }
    }
  }

  update(dtRaw: number): void {
    const dt = dtRaw * this.speed;
    this.time += dt;
    if (this.incoming.length) {
      this.active.push(...this.incoming);
      this.incoming.length = 0;
    }
    let write = 0;
    for (let i = 0; i < this.active.length; i++) {
      const a = this.active[i];
      if (a.done) continue;
      a.elapsed += dt;
      if (a.elapsed >= 0) {
        const d = a.opts.duration;
        const t = d <= 0 ? 1 : Math.min(1, a.elapsed / d);
        a.opts.onUpdate?.((a.opts.ease ?? linear)(t), t);
        if (t >= 1) {
          a.done = true;
          a.opts.onComplete?.();
          a.resolve();
          continue;
        }
      }
      this.active[write++] = a;
    }
    this.active.length = write;
  }

  get count(): number {
    return this.active.length + this.incoming.length;
  }
}

/** The one clock everything animates on. */
export const anim = new AnimClock();
