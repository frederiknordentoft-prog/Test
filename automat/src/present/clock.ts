// Game clock. We drive GSAP ourselves so hit-stop / slow-mo / headless stepping are deterministic,
// and so cinematics can be slaved to the audio clock (no A/V drift on the downbeat).
import { gsap } from 'gsap';

gsap.ticker.remove(gsap.updateRoot); // before any tween exists
gsap.ticker.lagSmoothing(0);

export const clock = {
  /** Game time in seconds (drives the GSAP root). Monotonic. */
  time: gsap.ticker.time,
  /** Real (wall) time accumulated by ticks, seconds. */
  real: 0,
  /** Local time scale for particles / shake / motes (hit-stop sets 0). */
  fx: 1,
  /** Global slow-mo factor for game time (not used while audio-anchored). */
  scale: 1,
  /** Last fx dt (seconds) — read by fx systems each frame. */
  fxDt: 0,
  /** Last game dt (seconds). */
  dt: 0,
};

let freezeGameUntil = 0; // real time
let freezeFxUntil = 0;
let anchor: { game: number; audio: number; now: () => number; latency: () => number } | null = null;
/** Headless/QA stepping: never slave to the (real-time) audio clock. */
let manual = false;
export function setManualClock(b: boolean): void { manual = b; if (b) anchor = null; }

/** Visual hit-stop. `game` also freezes the GSAP timeline (base-game hits); fx always freezes. */
export function hitStop(ms: number, game = true): void {
  const until = clock.real + ms / 1000;
  freezeFxUntil = Math.max(freezeFxUntil, until);
  if (game && !anchor) freezeGameUntil = Math.max(freezeGameUntil, until);
}

/** Slave game time to an audio clock from now on (cinematics / storm music). */
export function anchorToAudio(now: () => number, latency: () => number): void {
  if (manual) return;
  anchor = { game: clock.time, audio: now() - latency(), now, latency };
  freezeGameUntil = 0;
}
export function releaseAudioAnchor(): void { anchor = null; }
export const isAnchored = () => anchor !== null;

/** Advance all clocks by a real dt (seconds, already clamped by the caller). */
export function tick(realDt: number): void {
  clock.real += realDt;
  let gdt = 0;
  if (anchor) {
    const a = anchor.now() - anchor.latency();
    const target = anchor.game + (a - anchor.audio);
    gdt = Math.max(0, Math.min(0.1, target - clock.time));
    // If audio is stalled/locked (no progress), fall back to real time so nothing hangs.
    if (target <= clock.time && realDt > 0) {
      anchor.game += realDt; // shift anchor so time keeps flowing
      gdt = realDt;
    }
  } else if (clock.real >= freezeGameUntil) {
    gdt = realDt * clock.scale;
  }
  clock.dt = gdt;
  clock.time += gdt;
  clock.fxDt = clock.real >= freezeFxUntil ? realDt * clock.fx * (anchor ? 1 : clock.scale) : 0;
  gsap.updateRoot(clock.time);
}

/** Promise that resolves after `sec` of GAME time. */
export function wait(sec: number): Promise<void> {
  return new Promise((res) => { gsap.delayedCall(sec, res); });
}
