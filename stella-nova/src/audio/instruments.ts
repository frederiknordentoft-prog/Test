/**
 * The instrument rack. Each function patches one sound into a Voice and
 * schedules its envelopes; nothing here knows about game events.
 *
 * Every instrument is layered the way a recorded one is heard: a transient
 * (the strike), a body (the pitch) and a tail (what rings on).
 */
import { ahr, hz, perc, sweep, type NoiseKind, type Voice, type Wave } from './engine';
import { mtof } from './theory';

// ───────────────────────────── Tuned ─────────────────────────────

export interface BellOpts {
  gain?: number;
  /** Seconds to −60 dB. */
  decay?: number;
  /** FM index scale: 0 = pure, 1 = bell, 2 = clangorous. */
  bright?: number;
  /** Modulator : carrier. 3.5 is the classic inharmonic bell. */
  ratio?: number;
  /** Stereo spread of the two detuned carriers, 0..1. */
  spread?: number;
  /** Level of the hum an octave below, relative to the body. */
  hum?: number;
}

/**
 * FM bell. Two carriers a few cents apart share one modulator whose index
 * falls faster than the level: the tone starts metallic and rings out pure.
 */
export function bell(v: Voice, dest: AudioNode, t: number, freq: number, o: BellOpts = {}): void {
  const f = hz(freq);
  const decay = o.decay ?? 1.6;
  const gain = o.gain ?? 0.3;
  const bright = o.bright ?? 1;
  const ratio = o.ratio ?? 3.5;
  const spread = o.spread ?? 0.4;
  const stop = t + decay + 0.03;

  const mod = v.osc('sine', f * ratio, t, stop);
  const index = v.gain();
  perc(index.gain, t, f * ratio * 0.9 * bright, 0.001, decay * 0.5);
  mod.connect(index);

  const body = v.gain();
  perc(body.gain, t, gain, 0.002, decay);
  const cents = 3 + 4 * v.e.rng.next();
  for (const side of [-1, 1]) {
    const car = v.osc('sine', f, t, stop, side * cents);
    index.connect(car.frequency);
    car.connect(v.pan(side * spread)).connect(body);
  }
  body.connect(dest);

  // Strike: a high inharmonic partial that is gone in a blink.
  const strike = v.osc('sine', Math.min(f * 5.404, 15000), t, t + 0.2);
  const strikeGain = v.gain();
  perc(strikeGain.gain, t, gain * 0.14 * bright, 0.001, 0.13);
  strike.connect(strikeGain).connect(dest);

  const hum = o.hum ?? 0;
  if (hum > 0) {
    const h = v.osc('sine', f * 0.5, t, stop);
    const hg = v.gain();
    perc(hg.gain, t, gain * hum, 0.006, decay * 0.9);
    h.connect(hg).connect(dest);
  }
}

export interface GlassOpts {
  gain?: number;
  decay?: number;
  bright?: number;
}

/** Glass pluck / celesta: a sine with a short FM "tine" on the attack and a fast-fading octave. */
export function glass(v: Voice, dest: AudioNode, t: number, freq: number, o: GlassOpts = {}): void {
  const f = hz(freq);
  const decay = o.decay ?? 0.8;
  const gain = o.gain ?? 0.25;
  const bright = o.bright ?? 1;
  const stop = t + decay + 0.03;

  const car = v.osc('sine', f, t, stop);
  const tineLen = Math.min(decay * 0.4, 0.2);
  const mod = v.osc('sine', f * 4, t, t + tineLen + 0.03);
  const index = v.gain();
  perc(index.gain, t, f * 2.2 * bright, 0.001, tineLen);
  mod.connect(index).connect(car.frequency);

  const body = v.gain();
  perc(body.gain, t, gain, 0.002, decay);
  car.connect(body).connect(dest);

  const oct = v.osc('sine', Math.min(f * 2.004, 16000), t, t + decay * 0.5 + 0.03);
  const og = v.gain();
  perc(og.gain, t, gain * 0.2 * bright, 0.002, decay * 0.5);
  oct.connect(og).connect(dest);
}

/** Featherweight sine ping (sparkles, glints): one oscillator, one gain. */
export function ping(v: Voice, dest: AudioNode, t: number, freq: number, gain: number, decay: number): void {
  const o = v.osc('sine', freq, t, t + decay + 0.03);
  const g = v.gain();
  perc(g.gain, t, gain, 0.001, decay);
  o.connect(g).connect(dest);
}

export interface SparkleOpts {
  count: number;
  /** Seconds the pings are spread over. */
  span: number;
  /** MIDI notes to draw from. */
  notes: readonly number[];
  gain: number;
  decay?: number;
  /** 0..1 */
  width?: number;
}

/** A scatter of high pings across the stereo field. Two panners serve them all. */
export function sparkle(v: Voice, dest: AudioNode, t: number, o: SparkleOpts): void {
  const rng = v.e.rng;
  const width = o.width ?? 0.8;
  const left = v.pan(-width);
  const right = v.pan(width);
  left.connect(dest);
  right.connect(dest);
  for (let i = 0; i < o.count; i++) {
    const at = t + (o.span * (i + rng.next() * 0.8)) / o.count;
    const note = o.notes[rng.int(o.notes.length)];
    ping(v, i % 2 ? left : right, at, mtof(note), o.gain * (0.55 + 0.45 * rng.next()), (o.decay ?? 0.18) * (0.7 + 0.6 * rng.next()));
  }
}

export interface StabOpts {
  gain: number;
  attack: number;
  hold: number;
  release: number;
  /** Resting filter cutoff, Hz. */
  cutoff: number;
  /** Cutoff at the top of the attack. */
  cutoffPeak?: number;
  wave?: Wave;
  /** Detune of each pair, cents. */
  detune?: number;
  width?: number;
}

/**
 * A chord from detuned oscillator pairs, left and right, through one low-pass
 * whose cutoff swells with the level, as breath does on a brass section.
 */
export function stab(v: Voice, dest: AudioNode, t: number, notes: readonly number[], o: StabOpts): number {
  const wave = o.wave ?? v.e.waves.warm;
  const cents = o.detune ?? 8;
  const width = o.width ?? 0.6;
  const end = t + o.attack + o.hold + o.release + 0.03;
  const lp = v.filter('lowpass', o.cutoff, 0.9);
  const peak = o.cutoffPeak ?? o.cutoff * 2.5;
  lp.frequency.setValueAtTime(o.cutoff, t);
  lp.frequency.exponentialRampToValueAtTime(peak, t + o.attack + 0.02);
  lp.frequency.exponentialRampToValueAtTime(o.cutoff, t + o.attack + o.hold + o.release * 0.7);
  const vca = v.gain();
  ahr(vca.gain, t, o.gain / Math.sqrt(notes.length), o.attack, o.hold, o.release);
  const left = v.pan(-width);
  const right = v.pan(width);
  left.connect(lp);
  right.connect(lp);
  for (const m of notes) {
    const f = mtof(m);
    const jitter = v.e.rng.next() * 3;
    v.osc(wave, f, t, end, -cents - jitter).connect(left);
    v.osc(wave, f, t, end, cents + jitter).connect(right);
  }
  lp.connect(vca).connect(dest);
  return end;
}

// ───────────────────────────── Percussive ─────────────────────────────

export interface KickOpts {
  gain?: number;
  from?: number;
  to?: number;
  /** Seconds of pitch fall. */
  drop?: number;
  decay?: number;
  /** Level of the beater click, relative. */
  click?: number;
}

/** Sine with a falling pitch: kick, thud, sub drop, depending on the numbers. */
export function kick(v: Voice, dest: AudioNode, t: number, o: KickOpts = {}): void {
  const gain = o.gain ?? 0.6;
  const from = o.from ?? 120;
  const to = o.to ?? 46;
  const drop = o.drop ?? 0.09;
  const decay = o.decay ?? 0.3;
  const osc = v.osc('sine', from, t, t + decay + 0.03);
  sweep(osc.frequency, t, from, to, drop);
  const g = v.gain();
  perc(g.gain, t, gain, 0.003, decay);
  osc.connect(g).connect(dest);
  const click = o.click ?? 0;
  if (click > 0) {
    const c = v.osc('triangle', from * 5, t, t + 0.04);
    const cg = v.gain();
    perc(cg.gain, t, gain * click, 0.0008, 0.018);
    c.connect(cg).connect(dest);
  }
}

/** Woodblock-like tick: a sine and one inharmonic overtone, both very short. */
export function wood(v: Voice, dest: AudioNode, t: number, freq: number, gain = 0.2, decay = 0.05): void {
  ping(v, dest, t, freq, gain, decay);
  ping(v, dest, t, freq * 2.42, gain * 0.38, decay * 0.35);
}

/** The pre-rendered ratchet click. `rate` tunes it: below 1 is heavier, above 1 lighter. */
export function click(v: Voice, dest: AudioNode, t: number, gain: number, rate = 1): void {
  const s = v.sample(v.e.buffers.click, t, rate);
  const g = v.gain(gain);
  s.connect(g).connect(dest);
}

/** Short inharmonic FM burst: the sound of metal meeting metal. */
export function metal(v: Voice, dest: AudioNode, t: number, freq: number, gain: number, decay: number): void {
  const car = v.osc('sine', freq, t, t + decay + 0.03);
  const mod = v.osc('sine', freq * 1.451, t, t + decay + 0.03);
  const index = v.gain();
  perc(index.gain, t, freq * 2.4, 0.0006, decay * 0.7);
  mod.connect(index).connect(car.frequency);
  const g = v.gain();
  perc(g.gain, t, gain, 0.0008, decay);
  car.connect(g).connect(dest);
}

// ───────────────────────────── Noise ─────────────────────────────

export interface BurstOpts {
  kind?: NoiseKind;
  type?: BiquadFilterType;
  freq: number;
  /** Sweep the filter to this frequency over the length of the sound. */
  freqTo?: number;
  q?: number;
  gain: number;
  attack?: number;
  /** Percussive when there is no hold; otherwise attack / hold / release. */
  hold?: number;
  decay: number;
}

/** Filtered noise with an envelope: bursts, cracks, breaths and whooshes. Returns the filter for further automation. */
export function burst(v: Voice, dest: AudioNode, t: number, o: BurstOpts): BiquadFilterNode {
  const attack = o.attack ?? 0.001;
  const hold = o.hold ?? 0;
  const len = attack + hold + o.decay;
  const src = v.noise(o.kind ?? 'white', t, t + len + 0.03);
  const f = v.filter(o.type ?? 'bandpass', o.freq, o.q ?? 1);
  if (o.freqTo) sweep(f.frequency, t, o.freq, o.freqTo, len);
  const g = v.gain();
  if (hold > 0) ahr(g.gain, t, o.gain, attack, hold, o.decay);
  else perc(g.gain, t, o.gain, attack, o.decay);
  src.connect(f).connect(g).connect(dest);
  return f;
}
