/**
 * STELLA NOVA audio: all music and every sound effect, synthesised live with
 * the Web Audio API. No files, no libraries.
 *
 *   createAudio()            the IAudio the game uses (owns an AudioContext)
 *   buildAudioCore(ctx)      the same instrument on any BaseAudioContext,
 *                            which is how the audit renders it offline
 */
import type { IAudio, MusicState, SfxName, SfxParams } from '../core/types';
import { Tension, Whirl } from './beds';
import { clamp, Engine, num, type EngineOptions } from './engine';
import { LOOKAHEAD, Music } from './music';
import { SFX_NAMES, SfxPlayer } from './sfx';

export { Engine, type EngineStats } from './engine';
export { SFX_NAMES } from './sfx';

export const MUSIC_STATES: readonly MusicState[] = ['splash', 'base', 'spin', 'tension', 'free', 'nova', 'bigwin'];

type Bus = 'master' | 'music' | 'sfx';

/** Everything that makes sound, on one context. No timers: the owner calls pump(). */
export class AudioCore {
  readonly engine: Engine;
  private readonly player: SfxPlayer;
  private readonly score: Music;
  private readonly whirlBed: Whirl;
  private readonly tensionBed: Tension;

  constructor(ctx: BaseAudioContext, opts: EngineOptions = {}) {
    this.engine = new Engine(ctx, opts);
    this.player = new SfxPlayer(this.engine);
    this.score = new Music(this.engine);
    this.whirlBed = new Whirl(this.engine);
    this.tensionBed = new Tension(this.engine);
  }

  /** Start the score (first call) or change its state. */
  music(state: MusicState): void {
    if (!MUSIC_STATES.includes(state)) return;
    if (!this.score.running) {
      this.score.start(state);
      this.pump();
    } else {
      this.score.setState(state);
    }
  }

  get musicState(): MusicState {
    return this.score.current;
  }

  sfx(name: SfxName, p?: SfxParams): void {
    this.player.play(name, p ?? {});
  }

  whirl(on: boolean, intensity?: number): void {
    this.whirlBed.set(!!on, num(intensity, 0.6));
  }

  tension(on: boolean): void {
    this.tensionBed.set(!!on);
  }

  setMuted(muted: boolean): void {
    this.engine.setMuted(!!muted);
  }

  setVolume(bus: Bus, v01: number): void {
    this.engine.setVolume(bus, v01);
  }

  /** Schedule the next stretch of music and tidy up finished voices. Call every 40–100 ms. */
  pump(): void {
    const now = this.engine.now;
    this.score.advance(now + LOOKAHEAD);
    this.whirlBed.flush();
    this.engine.sweep(now);
  }

  dispose(): void {
    this.whirlBed.dispose();
    this.tensionBed.dispose();
    this.score.dispose();
    this.engine.dispose();
  }
}

/** The whole instrument on a context you supply (an OfflineAudioContext, for instance). */
export function buildAudioCore(ctx: BaseAudioContext, opts?: EngineOptions): AudioCore {
  return new AudioCore(ctx, opts);
}

const PUMP_MS = 40;

/**
 * The game's audio facade. Every method is safe before unlock() and never
 * throws into the game: sound is a garnish, the spin must go on without it.
 * Volume, mute and the music state set before unlock() are remembered and
 * applied when the context exists.
 */
export function createAudio(): IAudio & { readonly core: AudioCore | null } {
  let ctx: AudioContext | null = null;
  let core: AudioCore | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let heldByHost = false;
  let failed = false;

  let muted = false;
  const volume: Record<Bus, number> = { master: 1, music: 1, sfx: 1 };
  let musicState: MusicState = 'splash';

  const guard = (fn: () => void): void => {
    try {
      fn();
    } catch (err) {
      // A broken cue is not worth a broken game.
      if (typeof console !== 'undefined') console.warn('[audio]', err);
    }
  };

  const startTimer = (): void => {
    if (timer === null) timer = setInterval(() => guard(() => core?.pump()), PUMP_MS);
  };
  const stopTimer = (): void => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };

  /** Resume, but never hang: outside a user gesture the promise may stay pending forever. */
  const resume = async (c: AudioContext): Promise<void> => {
    if (c.state === 'running') return;
    await Promise.race([c.resume().catch(() => undefined), new Promise<void>((r) => setTimeout(r, 400))]);
  };

  return {
    get ready(): boolean {
      return !!ctx && !!core && ctx.state === 'running';
    },
    get core(): AudioCore | null {
      return core;
    },

    async unlock(): Promise<void> {
      if (failed) return;
      try {
        if (!ctx) {
          const w = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
          const Ctor = w.AudioContext ?? w.webkitAudioContext;
          if (!Ctor) {
            failed = true;
            return;
          }
          ctx = new Ctor({ latencyHint: 'interactive' });
          core = new AudioCore(ctx, { analyser: true });
          core.setMuted(muted);
          for (const bus of ['master', 'music', 'sfx'] as const) core.setVolume(bus, volume[bus]);
          core.music(musicState);
          if (!heldByHost) startTimer();
        }
        if (!heldByHost) await resume(ctx);
      } catch (err) {
        if (typeof console !== 'undefined') console.warn('[audio] unlock failed', err);
        if (!core) {
          failed = true;
          ctx = null;
        }
      }
    },

    setMuted(m: boolean): void {
      muted = !!m;
      guard(() => core?.setMuted(muted));
    },

    setVolume(bus: Bus, v01: number): void {
      if (bus !== 'master' && bus !== 'music' && bus !== 'sfx') return;
      volume[bus] = clamp(num(v01, 1), 0, 1);
      guard(() => core?.setVolume(bus, volume[bus]));
    },

    music(state: MusicState): void {
      if (!MUSIC_STATES.includes(state)) return;
      musicState = state;
      guard(() => core?.music(state));
    },

    sfx(name: SfxName, p?: SfxParams): void {
      if (!core || !ctx || ctx.state !== 'running') return;
      guard(() => core?.sfx(name, p));
    },

    whirl(on: boolean, intensity?: number): void {
      if (!core) return;
      guard(() => core?.whirl(on, intensity));
    },

    tension(on: boolean): void {
      if (!core) return;
      guard(() => core?.tension(on));
    },

    suspend(on: boolean): void {
      heldByHost = !!on;
      const c = ctx;
      if (!c) return;
      guard(() => {
        if (on) {
          stopTimer();
          void c.suspend().catch(() => undefined);
        } else {
          startTimer();
          void c.resume().catch(() => undefined);
        }
      });
    },
  };
}

/** Names the sandbox and the audit iterate over. */
export const ALL_SFX: readonly SfxName[] = SFX_NAMES;
