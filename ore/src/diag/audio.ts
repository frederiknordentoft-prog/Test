/**
 * Web Audio is created inside the gate's click handler (WebKit needs a user gesture).
 * No samples: a two-partial bell is synthesised.
 */
import { setCheck } from './store';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function unlockAudio(): void {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch {
    /* optional WebKit API */
  }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    ctx
      .resume()
      .then(() => {
        setCheck('audio', {
          status: ctx?.state === 'running' ? 'ok' : 'advarsel',
          detail: ctx?.state === 'running' ? `Lyd kører (${ctx.sampleRate} Hz${nav.audioSession ? ', audioSession=playback' : ''})` : `AudioContext: ${ctx?.state}`,
        });
        bell(880, 1320, 1.4, 0.2);
      })
      .catch((err: Error) => setCheck('audio', { status: 'fejl', detail: `Lyd blev afvist: ${err.message}` }));
  } catch (err) {
    setCheck('audio', { status: 'fejl', detail: `Lyd utilgængelig: ${(err as Error).message}` });
  }
}

export function audioContext(): { ctx: AudioContext; out: GainNode } | null {
  if (!ctx || !master) return null;
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  return { ctx, out: master };
}

/** Two sines with an exponential decay. Opening bell 880/1320 Hz, closing bell 660/990 Hz. */
export function bell(f1: number, f2: number, decay: number, level: number): void {
  if (!ctx || !master || muted) return;
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  const t = ctx.currentTime + 0.02;
  for (const [f, l] of [[f1, level], [f2, level * 0.5]] as const) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(l, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

export function setMuted(m: boolean): void {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.01);
}

export function isMuted(): boolean {
  return muted;
}
