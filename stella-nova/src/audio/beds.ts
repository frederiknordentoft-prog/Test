/**
 * Continuous beds: the whirl of the rings and the tension riser. Both are
 * steered with setTargetAtTime only, so any sequence of calls glides and
 * nothing ever has to be cancelled mid-ramp.
 */
import { clamp, dB, LEAD, num, type Engine, type Voice } from './engine';
import { mtof, NOTE } from './theory';

const WHIRL_LEVEL = dB(-11);
const TENSION_LEVEL = dB(-10);

interface WhirlRig {
  v: Voice;
  level: GainNode;
  air: BiquadFilterNode;
  airGain: GainNode;
  hiss: GainNode;
  tones: OscillatorNode[];
  toneFilter: BiquadFilterNode;
  toneGain: GainNode;
  flutter: OscillatorNode;
}

/**
 * Rings in motion: band-passed air plus a tonal whirr an octave wide
 * (D2 at rest → D3 at full speed), both fluttering faster as the rings do.
 */
export class Whirl {
  private rig: WhirlRig | null = null;
  private intensity = 0;
  private lastSet = -1;
  private dirty = false;

  constructor(private readonly e: Engine) {}

  set(on: boolean, intensity: number): void {
    const e = this.e;
    if (!on) {
      if (this.rig) {
        const now = e.now;
        this.rig.level.gain.setTargetAtTime(0, now, 0.06);
        this.rig.v.stopAt(now + 0.6);
        this.rig = null;
      }
      this.dirty = false;
      return;
    }
    this.intensity = clamp(num(intensity, 0.6), 0, 1);
    if (!this.rig) {
      if (!e.admit(3, false, 1)) return;
      this.rig = this.build();
      this.apply(e.now, true);
      return;
    }
    // Called every frame while the rings turn: thin the automation out.
    if (e.now - this.lastSet < 0.03) {
      this.dirty = true;
      return;
    }
    this.apply(e.now, false);
  }

  /** Applies an intensity that arrived inside the rate limit. Driven by the engine pump. */
  flush(): void {
    if (this.dirty && this.rig && this.e.now - this.lastSet >= 0.03) this.apply(this.e.now, false);
  }

  get active(): boolean {
    return this.rig !== null;
  }

  private build(): WhirlRig {
    const e = this.e;
    const t = e.now + LEAD;
    const v = e.voice({ at: t, priority: 3, send: 0.16, gain: WHIRL_LEVEL });
    const level = v.gain(0);
    level.connect(v.out);

    // The flutter of spokes going past: one LFO shared by air and tone.
    const flutter = v.osc('sine', 6, t, Infinity);
    const flutterDepth = v.gain(0.22);
    flutter.connect(flutterDepth);

    const src = v.noise('pink', t, Infinity);
    const air = v.filter('bandpass', 400, 0.9);
    const airGain = v.gain(0.5);
    flutterDepth.connect(airGain.gain);
    src.connect(air).connect(airGain).connect(level);

    const hissSrc = v.noise('white', t, Infinity);
    const hissFilter = v.filter('highpass', 5200, 0.7);
    const hiss = v.gain(0);
    hissSrc.connect(hissFilter).connect(hiss).connect(level);

    const toneFilter = v.filter('lowpass', 400, 1.4);
    const toneGain = v.gain(0.3);
    flutterDepth.connect(toneGain.gain);
    const tones: OscillatorNode[] = [];
    const f0 = mtof(NOTE.D2);
    for (const [mult, cents, pan] of [
      [1, -7, -0.4],
      [1, 7, 0.4],
      [1.4983, 0, 0],
    ]) {
      const o = v.osc(e.waves.warm, f0 * mult, t, Infinity, cents);
      const g = v.gain(mult === 1 ? 1 : 0.4);
      o.connect(g).connect(v.pan(pan)).connect(toneFilter);
      tones.push(o);
    }
    toneFilter.connect(toneGain).connect(level);
    return { v, level, air, airGain, hiss, tones, toneFilter, toneGain, flutter };
  }

  private apply(now: number, first: boolean): void {
    const r = this.rig;
    if (!r) return;
    const i = this.intensity;
    // The first call sets the starting point outright (the level is still at zero); later calls glide.
    const t = first ? r.v.t : now;
    const tau = 0.08;
    const set = (p: AudioParam, value: number) => {
      if (first) p.setValueAtTime(value, t);
      else p.setTargetAtTime(value, t, tau);
    };
    const base = mtof(NOTE.D2) * Math.pow(2, i);
    set(r.tones[0].frequency, base);
    set(r.tones[1].frequency, base);
    set(r.tones[2].frequency, base * 1.4983);
    set(r.toneFilter.frequency, 260 + 2300 * i * i);
    set(r.air.frequency, 330 + 2100 * Math.pow(i, 1.3));
    set(r.hiss.gain, 0.1 * i * i);
    set(r.flutter.frequency, 4 + 15 * i);
    r.level.gain.setTargetAtTime(0.3 + 0.7 * i, t, first ? 0.07 : tau);
    this.lastSet = now;
    this.dirty = false;
  }

  dispose(): void {
    this.set(false, 0);
  }
}

/**
 * Anticipation riser. It climbs toward a ceiling it never quite reaches
 * (a D–A–E stack: suspended, unresolved), so it can be held for as long as the
 * drum-roll lasts, and it lets go in a fifth of a second.
 */
export class Tension {
  private v: Voice | null = null;

  constructor(private readonly e: Engine) {}

  set(on: boolean): void {
    const e = this.e;
    if (!on) {
      if (this.v) {
        this.v.release(e.now, 0.2);
        this.v = null;
      }
      return;
    }
    if (this.v) return;
    if (!e.admit(3, false, 1)) return;
    const t = e.now + LEAD;
    const v = e.voice({ at: t, priority: 3, send: 0.3, gain: TENSION_LEVEL });
    this.v = v;

    // Air that rises and narrows.
    const air = v.gain(0);
    air.gain.setTargetAtTime(0.5, t, 0.7);
    for (const side of [-1, 1]) {
      const src = v.noise('white', t, Infinity);
      const bp = v.filter('bandpass', 500, 1.2);
      bp.frequency.setValueAtTime(480, t);
      bp.frequency.setTargetAtTime(5200, t, 1.0);
      bp.Q.setTargetAtTime(3.5, t, 1.2);
      src.connect(bp).connect(v.pan(side * 0.7)).connect(air);
    }

    // The cluster starts an octave low and climbs toward D5–A5–E6.
    const tone = v.gain(0);
    tone.gain.setTargetAtTime(0.4, t, 0.5);
    const lp = v.filter('lowpass', 600, 2.5);
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.setTargetAtTime(4200, t, 1.1);
    [NOTE.D5, NOTE.A5, NOTE.D6 + 2].forEach((m, k) => {
      const o = v.osc(e.waves.warm, mtof(m), t, Infinity, (k - 1) * 9);
      o.detune.setValueAtTime(-1200 + (k - 1) * 9, t);
      o.detune.setTargetAtTime((k - 1) * 9, t, 0.85);
      o.connect(v.pan((k - 1) * 0.5)).connect(lp);
    });

    // Tremolo that quickens: the thing that keeps a held riser alive.
    const trem = v.gain(0.7);
    const lfo = v.osc('sine', 5, t, Infinity);
    lfo.frequency.setTargetAtTime(15, t, 1.3);
    const depth = v.gain(0.3);
    lfo.connect(depth).connect(trem.gain);
    lp.connect(tone);
    tone.connect(trem);
    air.connect(trem);
    trem.connect(v.out);
  }

  get active(): boolean {
    return this.v !== null;
  }

  dispose(): void {
    this.set(false);
  }
}
