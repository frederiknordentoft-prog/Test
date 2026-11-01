/**
 * Sound palette, synthesised with Web Audio (no samples). Audio starts only after the gate tap.
 * Trade ticks are throttled to at most 8 per second.
 */
import { audioContext, isMuted } from '../diag/audio';

function tone(f: number, start: number, dur: number, level: number, type: OscillatorType = 'sine', glideTo?: number): void {
  const a = audioContext();
  if (!a || isMuted()) return;
  const { ctx, out } = a;
  const t = ctx.currentTime + 0.03 + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseTick(bright: boolean): void {
  const a = audioContext();
  if (!a || isMuted()) return;
  const { ctx, out } = a;
  const len = Math.floor(ctx.sampleRate * 0.008);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = bright ? 4800 : 3000;
  const g = ctx.createGain();
  g.gain.value = 0.035;
  src.connect(bp).connect(g).connect(out);
  src.start(ctx.currentTime + 0.02);
}

let lastTick = 0;
export const sound = {
  bell(open: boolean): void {
    const [a, b] = open ? [880, 1320] : [660, 990];
    tone(a, 0, 1.4, 0.16);
    tone(b, 0, 1.2, 0.08);
  },
  trade(fck: boolean): void {
    const now = performance.now();
    if (now - lastTick < 125) return;
    lastTick = now;
    noiseTick(fck);
  },
  goal(team: 0 | 1): void {
    tone(4000, 0, 0.4, 0.05, 'sawtooth', 200);
    if (team === 0) {
      tone(659, 0.08, 1.6, 0.12);
      tone(988, 0.08, 1.4, 0.08);
    } else {
      tone(220, 0.08, 1.6, 0.1, 'sawtooth');
      tone(330, 0.08, 1.4, 0.07, 'sawtooth');
    }
  },
  halt(): void {
    tone(660, 0, 0.12, 0.09);
    tone(440, 0.13, 0.12, 0.09);
  },
  whale(): void {
    tone(48, 0, 0.35, 0.3);
  },
  fill(): void {
    tone(990, 0, 0.18, 0.08);
    tone(1320, 0.07, 0.2, 0.07);
  },
  settle(): void {
    tone(528, 0, 1.8, 0.12);
  },
};
