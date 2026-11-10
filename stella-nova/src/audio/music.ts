/**
 * The score. One piece that never restarts: a sixteenth-note clock walks the
 * chord progression, and the seven MusicStates only decide which layers are
 * heard, how bright they are and how fast the clock runs.
 *
 * Scheduling is look-ahead on the context clock: advance(until) lays down
 * every step that starts before `until`. Live, a timer calls it a few times a
 * second; under measurement the offline renderer calls it the same way.
 */
import { Rng } from '../core/rng';
import type { MusicState } from '../core/types';
import { clamp, dB, type Engine, type Voice } from './engine';
import { bell, glass, kick, wood } from './instruments';
import { BASE_PROGRESSION, BIGWIN_PROGRESSION, mtof, NOTE, type Chord } from './theory';

type LayerName = 'pad' | 'sub' | 'celesta' | 'clock' | 'bass' | 'arp' | 'kick' | 'tension' | 'bells' | 'shimmer';

/** Overall level of the score under the effects. Tuned against the audit. */
const MUSIC_LEVEL = dB(-9);

/** Per layer: dry level trim, reverb send, echo send. */
const LAYERS: Record<LayerName, { trim: number; wet: number; echo: number }> = {
  pad: { trim: 0.62, wet: 0.4, echo: 0 },
  sub: { trim: 0.5, wet: 0, echo: 0 },
  celesta: { trim: 0.5, wet: 0.55, echo: 0.42 },
  clock: { trim: 0.34, wet: 0.2, echo: 0.1 },
  bass: { trim: 0.6, wet: 0.05, echo: 0 },
  arp: { trim: 0.36, wet: 0.32, echo: 0.36 },
  kick: { trim: 0.75, wet: 0.05, echo: 0 },
  tension: { trim: 0.5, wet: 0.4, echo: 0 },
  bells: { trim: 0.55, wet: 0.5, echo: 0.3 },
  shimmer: { trim: 0.3, wet: 0.7, echo: 0 },
};

interface StateDef {
  /** 0 = keep the tempo that is running. */
  bpm: number;
  progression: 'base' | 'bigwin';
  level: Record<LayerName, number>;
  /** Low-pass over the pads, Hz. */
  padCutoff: number;
  /** Seconds for a new chord to bloom. */
  padAttack: number;
  /** Chance of a celesta note on any eighth. */
  celesta: number;
  arp: 'off' | 'spin' | 'free' | 'bigwin';
}

const lv = (o: Partial<Record<LayerName, number>>): Record<LayerName, number> => ({
  pad: 0,
  sub: 0,
  celesta: 0,
  clock: 0,
  bass: 0,
  arp: 0,
  kick: 0,
  tension: 0,
  bells: 0,
  shimmer: 0,
  ...o,
});

const STATES: Record<MusicState, StateDef> = {
  splash: { bpm: 72, progression: 'base', level: lv({ pad: 0.9, sub: 0.4, celesta: 0.9, shimmer: 0.5 }), padCutoff: 850, padAttack: 2.2, celesta: 0.13, arp: 'off' },
  base: { bpm: 72, progression: 'base', level: lv({ pad: 1, sub: 1, celesta: 1, clock: 1 }), padCutoff: 1000, padAttack: 1.6, celesta: 0.2, arp: 'off' },
  spin: { bpm: 72, progression: 'base', level: lv({ pad: 0.95, sub: 1, celesta: 0.4, clock: 0.8, bass: 1, arp: 1 }), padCutoff: 2600, padAttack: 1.0, celesta: 0.1, arp: 'spin' },
  tension: { bpm: 0, progression: 'base', level: lv({ pad: 0.22, sub: 0.6, tension: 1 }), padCutoff: 600, padAttack: 1.0, celesta: 0, arp: 'off' },
  free: { bpm: 80, progression: 'base', level: lv({ pad: 1, sub: 1, celesta: 0.6, clock: 0.45, bass: 0.9, arp: 1, kick: 1, shimmer: 1 }), padCutoff: 3200, padAttack: 1.0, celesta: 0.14, arp: 'free' },
  nova: { bpm: 0, progression: 'base', level: lv({ pad: 0.05, sub: 0.03, shimmer: 0.12 }), padCutoff: 500, padAttack: 1.5, celesta: 0, arp: 'off' },
  bigwin: { bpm: 92, progression: 'bigwin', level: lv({ pad: 1, sub: 1, bass: 1, arp: 0.75, kick: 1, bells: 1, shimmer: 0.6 }), padCutoff: 3600, padAttack: 0.09, celesta: 0, arp: 'bigwin' },
};

interface Layer {
  input: GainNode;
  nodes: AudioNode[];
}

interface PadVoice {
  v: Voice;
  vca: GainNode;
}

/** How far ahead of the clock the timer schedules. Longer than the timer's worst-case period. */
export const LOOKAHEAD = 0.18;

export class Music {
  private readonly e: Engine;
  private readonly rng: Rng;
  private state: MusicState = 'splash';
  private started = false;

  private layers!: Record<LayerName, Layer>;
  private padFilter!: BiquadFilterNode;
  private fixed: Voice | null = null;
  private subOscs: OscillatorNode[] = [];
  private bassOscs: OscillatorNode[] = [];
  private bassFilter!: BiquadFilterNode;
  private bassVca!: GainNode;

  private bpm = 72;
  /** Steps since the current progression was (re)entered. */
  private step = 0;
  private nextTime = 0;
  private realign = false;
  private progression: readonly Chord[] = BASE_PROGRESSION;
  private chordIndex = -1;
  private chord: Chord = BASE_PROGRESSION[0];
  private pad: PadVoice | null = null;
  private shimmer: PadVoice | null = null;

  private walk = 3;
  private lastCelesta = -99;
  private cluster: Voice | null = null;
  private thumpAt = 0;
  private thumpGap = 0.5;
  private thumpCount = 0;

  constructor(e: Engine, seed = 0x572a) {
    this.e = e;
    this.rng = new Rng(seed);
  }

  get current(): MusicState {
    return this.state;
  }

  get running(): boolean {
    return this.started;
  }

  /** Build the standing parts of the band and start the clock. */
  start(state: MusicState): void {
    if (this.started) {
      this.setState(state);
      return;
    }
    const e = this.e;
    const ctx = e.ctx;
    const t = e.now + 0.03;
    this.started = true;
    this.state = state;
    const def = STATES[state];
    this.bpm = def.bpm || 72;
    this.progression = def.progression === 'bigwin' ? BIGWIN_PROGRESSION : BASE_PROGRESSION;

    const layers = {} as Record<LayerName, Layer>;
    for (const name of Object.keys(LAYERS) as LayerName[]) {
      const cfg = LAYERS[name];
      const input = ctx.createGain();
      input.gain.value = 0;
      const dry = ctx.createGain();
      dry.gain.value = cfg.trim * MUSIC_LEVEL;
      const nodes: AudioNode[] = [input, dry];
      input.connect(dry).connect(e.musicIn);
      if (cfg.wet > 0) {
        const wet = ctx.createGain();
        wet.gain.value = cfg.trim * cfg.wet * MUSIC_LEVEL;
        input.connect(wet).connect(e.musicSend);
        nodes.push(wet);
      }
      if (cfg.echo > 0) {
        const echo = ctx.createGain();
        echo.gain.value = cfg.trim * cfg.echo * MUSIC_LEVEL;
        input.connect(echo).connect(e.musicEcho);
        nodes.push(echo);
      }
      layers[name] = { input, nodes };
    }
    this.layers = layers;

    // Everything that sounds for the whole session lives in one protected voice.
    const v = e.voice({ at: t, priority: 9, dest: layers.sub.input });
    this.fixed = v;

    // One low-pass over all pad chords, never still: this is the "breathing".
    this.padFilter = v.filter('lowpass', def.padCutoff, 0.8);
    const padLfo = v.osc('sine', 0.071, t, Infinity);
    // In cents, so the sweep is as wide at a dark cutoff as at a bright one.
    const padLfoDepth = v.gain(380);
    padLfo.connect(padLfoDepth).connect(this.padFilter.detune);
    this.padFilter.connect(layers.pad.input);

    // Sub drone: a sine on the root, plus an octave so small speakers can find it.
    const subVca = v.gain(0.85);
    const subLfo = v.osc('sine', 0.093, t, Infinity);
    const subLfoDepth = v.gain(0.12);
    subLfo.connect(subLfoDepth).connect(subVca.gain);
    const root = mtof(this.chord.root);
    const s1 = v.osc('sine', root, t, Infinity);
    const s2 = v.osc('triangle', root * 2, t, Infinity);
    const s2Tone = v.filter('lowpass', 260, 0.7);
    const s2Gain = v.gain(0.3);
    s1.connect(subVca);
    s2.connect(s2Tone).connect(s2Gain).connect(subVca);
    subVca.connect(v.out);
    this.subOscs = [s1, s2];

    // Bass: one monosynth played by automation, so the ostinato costs no nodes per note.
    this.bassFilter = v.filter('lowpass', 300, 3.5);
    this.bassVca = v.gain(0);
    for (const cents of [-6, 6]) {
      const o = v.osc(e.waves.warm, root, t, Infinity, cents);
      o.connect(this.bassFilter);
      this.bassOscs.push(o);
    }
    const bassSub = v.osc('sine', root, t, Infinity);
    const bassSubGain = v.gain(0.7);
    bassSub.connect(bassSubGain).connect(this.bassFilter);
    this.bassOscs.push(bassSub);
    this.bassFilter.connect(this.bassVca).connect(layers.bass.input);

    this.nextTime = t + 0.03;
    this.applyState(t, true);
  }

  setState(state: MusicState): void {
    if (!this.started) {
      this.state = state;
      return;
    }
    if (state === this.state) return;
    const from = STATES[this.state];
    const to = STATES[state];
    this.state = state;
    if (to.bpm) this.bpm = to.bpm;
    // Entering or leaving the big-win loop changes the harmony: land on the next beat.
    if (from.progression !== to.progression) this.realign = true;
    this.applyState(this.e.now, false);
  }

  private applyState(t: number, immediate: boolean): void {
    const def = STATES[this.state];
    // About 0.4 s to cross-fade; the nova gets out of the way faster.
    const tau = this.state === 'nova' ? 0.07 : 0.11;
    for (const name of Object.keys(this.layers) as LayerName[]) {
      const p = this.layers[name].input.gain;
      if (immediate) p.setTargetAtTime(def.level[name], t, 0.5);
      else p.setTargetAtTime(def.level[name], t, tau);
    }
    this.padFilter.frequency.setTargetAtTime(def.padCutoff, t, immediate ? 0.01 : 0.2);
    this.e.setEchoTime((60 / this.bpm / 4) * 3, t);

    if (this.state === 'tension') this.startCluster(t);
    else this.stopCluster(t);
  }

  /** Schedule every step that starts before `until`. */
  advance(until: number): void {
    if (!this.started) return;
    const now = this.e.now;
    const stepDur = () => 60 / this.bpm / 4;
    if (this.nextTime < now) {
      // The timer stalled (throttled tab): skip the missed steps rather than play them late.
      const missed = Math.ceil((now - this.nextTime) / stepDur());
      this.step += missed;
      this.nextTime += missed * stepDur();
    }
    while (this.nextTime < until) {
      this.scheduleStep(this.nextTime);
      this.nextTime += stepDur();
      this.step++;
    }
    if (this.state === 'tension') {
      if (this.thumpAt < now) this.thumpAt = now + 0.02;
      while (this.thumpAt < until) {
        this.thump(this.thumpAt);
        this.thumpAt += this.thumpGap;
        // Accelerates toward a fast heartbeat and holds there.
        this.thumpGap = Math.max(0.17, this.thumpGap * 0.9);
        this.thumpCount++;
      }
    }
  }

  private scheduleStep(t: number): void {
    const def = STATES[this.state];
    if (this.realign && this.step % 4 === 0) {
      this.realign = false;
      this.step = 0;
      this.progression = def.progression === 'bigwin' ? BIGWIN_PROGRESSION : BASE_PROGRESSION;
      this.chordIndex = -1;
    }
    const bigwin = this.progression === BIGWIN_PROGRESSION;
    const stepsPerChord = bigwin ? 16 : 32;
    const index = Math.floor(this.step / stepsPerChord) % this.progression.length;
    if (index !== this.chordIndex) {
      this.chordIndex = index;
      this.chord = this.progression[index];
      this.changeChord(t, def);
    }
    const chord = this.chord;
    const s16 = this.step % 16;
    const beat = s16 % 4 === 0;
    const L = def.level;
    const rng = this.rng;

    if (L.clock > 0 && beat) {
      // Tick on one and three, tock on two and four.
      const tock = (s16 / 4) % 2 === 1;
      this.note('clock', t, (v) => wood(v, v.out, t, mtof(tock ? NOTE.A5 : NOTE.D6), tock ? 0.42 : 0.5, 0.045), tock ? 0.25 : -0.25);
    } else if (L.clock > 0 && s16 % 4 === 3 && rng.next() < 0.35) {
      // The escapement catching just before the beat.
      this.note('clock', t, (v) => wood(v, v.out, t, mtof(NOTE.D7), 0.12, 0.02), 0);
    }

    if (L.celesta > 0 && s16 % 2 === 0) this.celesta(t, def, chord, this.step % stepsPerChord === 0);

    if (L.bass > 0) this.bass(t, def, chord, s16);

    if (def.arp !== 'off' && L.arp > 0) this.arp(t, def, chord, s16);

    if (L.kick > 0 && beat) {
      const strong = s16 === 0 || s16 === 8;
      this.note('kick', t, (v) => kick(v, v.out, t, { gain: strong ? 0.8 : 0.6, from: 112, to: 47, drop: 0.08, decay: 0.26, click: 0.12 }));
    }

    if (L.bells > 0 && chord.bells && s16 % 2 === 0) {
      const m = chord.bells[s16 / 2];
      if (m) {
        const accent = s16 === 0 ? 1 : 0.75;
        this.note('bells', t, (v) => bell(v, v.out, t, mtof(m), { gain: 0.42 * accent, decay: s16 === 0 ? 1.5 : 1.0, bright: 1.0, spread: 0.6 }), (rng.next() - 0.5) * 0.5);
        // A fifth below on the downbeat makes it a peal, not a line.
        if (s16 === 0) this.note('bells', t, (v) => bell(v, v.out, t, mtof(m - 12), { gain: 0.26, decay: 1.6, bright: 0.8, spread: 0.8, hum: 0.2 }));
      }
    }
  }

  /** One short music voice into a layer. Dropped silently when the pool is full of more important things. */
  private note(layer: LayerName, t: number, build: (v: Voice) => void, pan = 0): void {
    const e = this.e;
    if (!e.admit(1, true, 1)) return;
    const v = e.voice({ at: t, priority: 1, dest: this.layers[layer].input, pan });
    build(v);
  }

  private changeChord(t: number, def: StateDef): void {
    const e = this.e;
    const chord = this.chord;
    const attack = def.padAttack;

    // Pads cross-fade: the old chord lets go exactly as the new one blooms.
    const fadeOld = (old: PadVoice | null) => {
      if (!old) return;
      const release = Math.max(attack * 1.5, 0.6);
      old.vca.gain.cancelScheduledValues(t);
      old.vca.gain.setTargetAtTime(0, t, release / 4);
      old.v.stopAt(t + release * 1.8);
    };
    fadeOld(this.pad);
    fadeOld(this.shimmer);
    this.pad = null;
    this.shimmer = null;

    if (e.admit(3, true, 2)) {
      const v = e.voice({ at: t, priority: 3, dest: this.padFilter });
      const vca = v.gain(0);
      vca.gain.setValueAtTime(0, t);
      vca.gain.setTargetAtTime(1, t, attack / 3);
      const left = v.pan(-0.6);
      const right = v.pan(0.6);
      left.connect(vca);
      right.connect(vca);
      const n = chord.pad.length;
      chord.pad.forEach((m, i) => {
        const f = mtof(m);
        // Lower notes carry the chord; the top note is a whisper.
        const g = v.gain((i === n - 1 ? 0.55 : 1) * (0.42 / Math.sqrt(n)));
        const drift = this.rng.next() * 4;
        v.osc(e.waves.warm, f, t, Infinity, -6 - drift).connect(g);
        const g2 = v.gain(g.gain.value);
        v.osc(e.waves.warm, f, t, Infinity, 6 + drift).connect(g2);
        g.connect(left);
        g2.connect(right);
      });
      vca.connect(v.out);
      this.pad = { v, vca };

      // Shimmer: the upper chord tones two octaves up, each trembling at its own rate.
      const s = e.voice({ at: t, priority: 3, dest: this.layers.shimmer.input });
      const svca = s.gain(0);
      svca.gain.setValueAtTime(0, t);
      svca.gain.setTargetAtTime(1, t, Math.max(attack, 0.3) / 2.5);
      chord.pad.slice(-3).forEach((m, i) => {
        const o = s.osc('sine', mtof(m + 24), t, Infinity, (this.rng.next() - 0.5) * 10);
        const trem = s.gain(0.5);
        const lfo = s.osc('sine', 2.5 + this.rng.next() * 4, t, Infinity);
        const depth = s.gain(0.5);
        lfo.connect(depth).connect(trem.gain);
        const g = s.gain(0.16);
        o.connect(g).connect(trem).connect(s.pan(i - 1)).connect(svca);
      });
      svca.connect(s.out);
      this.shimmer = { v: s, vca: svca };
    }

    const root = mtof(chord.root);
    this.subOscs[0].frequency.setTargetAtTime(root, t, 0.22);
    this.subOscs[1].frequency.setTargetAtTime(root * 2, t, 0.22);
  }

  private celesta(t: number, def: StateDef, chord: Chord, chordStart: boolean): void {
    const rng = this.rng;
    const chance = chordStart ? Math.min(0.75, def.celesta * 3) : def.celesta;
    // After a note, leave room: the celesta is punctuation, not a melody line.
    if (this.step - this.lastCelesta < 3 || rng.next() >= chance) return;
    this.lastCelesta = this.step;
    const pool = chord.pool;
    // A random walk over the chord's notes, mostly by step, so it sings rather than scatters.
    const hop = rng.next() < 0.7 ? (rng.next() < 0.5 ? -1 : 1) : rng.int(5) - 2;
    this.walk = clamp(this.walk + hop, 0, pool.length - 1);
    if (rng.next() < 0.12) this.walk = rng.int(pool.length);
    const m = pool[this.walk];
    const vel = 0.5 + rng.next() * 0.5;
    const pan = (rng.next() - 0.5) * 0.9;
    this.note('celesta', t, (v) => glass(v, v.out, t, mtof(m), { gain: 0.5 * vel, decay: 1.7, bright: 0.7 + vel * 0.4 }), pan);
    if (rng.next() < 0.28) {
      // An answering note a third or fourth up the pool, three sixteenths later.
      const up = pool[clamp(this.walk + 1 + rng.int(2), 0, pool.length - 1)];
      const at = t + (60 / this.bpm / 4) * 3;
      this.note('celesta', at, (v) => glass(v, v.out, at, mtof(up), { gain: 0.3 * vel, decay: 1.4, bright: 0.6 }), -pan);
    }
  }

  private bass(t: number, def: StateDef, chord: Chord, s16: number): void {
    // Pulse on the sixteenth grid: x.xx x.xx, with the octave on the "and" of two and four.
    const bigwin = def.arp === 'bigwin';
    const pattern = bigwin ? [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 1] : [1, 0, 1, 1, 1, 0, 2, 1, 1, 0, 1, 1, 1, 0, 2, 3];
    const hit = pattern[s16];
    if (!hit) return;
    const m = chord.root + (hit === 2 ? 12 : hit === 3 ? 7 : 0);
    const f = mtof(m);
    const accent = s16 % 4 === 0 ? 1 : 0.72;
    for (const o of this.bassOscs) o.frequency.setValueAtTime(f, t);
    const stepDur = 60 / this.bpm / 4;
    const g = this.bassVca.gain;
    g.setTargetAtTime(0.9 * accent, t, 0.004);
    g.setTargetAtTime(0, t + 0.02, stepDur * 0.38);
    const fc = this.bassFilter.frequency;
    fc.setTargetAtTime(bigwin ? 1500 : 1100, t, 0.003);
    fc.setTargetAtTime(240, t + 0.015, 0.07);
  }

  private arp(t: number, def: StateDef, chord: Chord, s16: number): void {
    const rng = this.rng;
    const tones = chord.arp;
    const n = tones.length;
    if (def.arp === 'spin') {
      // Eighths, with ghost sixteenths now and then.
      const ghost = s16 % 2 === 1;
      if (ghost && rng.next() > 0.3) return;
      const order = [0, 2, 1, 3, 2, 4, 3, 1];
      const m = tones[order[(s16 >> 1) % order.length]] + (s16 >= 8 ? 12 : 0);
      const pan = s16 % 4 < 2 ? -0.45 : 0.45;
      this.note('arp', t, (v) => glass(v, v.out, t, mtof(m), { gain: ghost ? 0.22 : 0.46, decay: ghost ? 0.25 : 0.45, bright: 1 }), pan);
    } else if (def.arp === 'free') {
      // Shimmering sixteenths in broken thirds, an octave higher, ping-ponging.
      const order = [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 3, 4, 2, 3, 1];
      const k = order[s16];
      const m = tones[k % n] + 12 * Math.floor(k / n) + 12;
      const accent = s16 % 4 === 0 ? 1 : s16 % 2 === 0 ? 0.75 : 0.55;
      const pan = s16 % 2 ? 0.6 : -0.6;
      this.note('arp', t, (v) => glass(v, v.out, t, mtof(m), { gain: 0.44 * accent, decay: 0.42, bright: 1.1 }), pan);
      if (s16 === 0 && rng.next() < 0.6) {
        const top = tones[n - 1] + 24;
        this.note('arp', t, (v) => bell(v, v.out, t, mtof(top), { gain: 0.14, decay: 1.2, bright: 0.7, spread: 0.9 }));
      }
    } else if (def.arp === 'bigwin') {
      const order = [0, 1, 2, 3, 4, 3, 2, 1];
      const m = tones[order[s16 % 8] % n] + 12;
      const accent = s16 % 4 === 0 ? 1 : 0.65;
      this.note('arp', t, (v) => glass(v, v.out, t, mtof(m), { gain: 0.4 * accent, decay: 0.32, bright: 1.2 }), s16 % 2 ? 0.5 : -0.5);
    }
  }

  // ── Tension: a held, rising cluster and a heartbeat that speeds up ──

  private startCluster(t: number): void {
    if (this.cluster) return;
    const e = this.e;
    this.thumpAt = t + 0.05;
    this.thumpGap = 0.52;
    this.thumpCount = 0;
    if (!e.admit(3, true, 1)) return;
    const v = e.voice({ at: t, priority: 3, dest: this.layers.tension.input });
    this.cluster = v;
    const lp = v.filter('lowpass', 500, 1.8);
    lp.frequency.setValueAtTime(450, t);
    lp.frequency.setTargetAtTime(3000, t, 1.4);
    const vca = v.gain(0);
    vca.gain.setTargetAtTime(0.5, t, 0.12);
    // D E F A, a second apart: it wants to resolve and is not allowed to.
    [NOTE.D4, NOTE.D4 + 2, NOTE.F4, NOTE.A4].forEach((m, i) => {
      const o = v.osc(e.waves.warm, mtof(m), t, Infinity, (i - 1.5) * 7);
      // The whole cluster drifts sharp, toward a whole tone up, and never arrives.
      o.detune.setValueAtTime((i - 1.5) * 7, t);
      o.detune.setTargetAtTime(200 + (i - 1.5) * 7, t, 2.2);
      o.connect(v.pan((i - 1.5) * 0.4)).connect(lp);
    });
    const trem = v.gain(0.75);
    const lfo = v.osc('sine', 4, t, Infinity);
    lfo.frequency.setTargetAtTime(11, t, 1.6);
    const depth = v.gain(0.25);
    lfo.connect(depth).connect(trem.gain);
    lp.connect(vca).connect(trem).connect(v.out);
  }

  private stopCluster(t: number): void {
    if (!this.cluster) return;
    this.cluster.release(t, 0.3);
    this.cluster = null;
  }

  private thump(t: number): void {
    const grow = Math.min(1, 0.55 + this.thumpCount * 0.05);
    this.note('tension', t, (v) => kick(v, v.out, t, { gain: 0.9 * grow, from: 84, to: 42, drop: 0.07, decay: 0.2, click: 0.1 }));
  }

  /** Stop the band. */
  dispose(): void {
    if (!this.started) return;
    const now = this.e.now;
    this.started = false;
    for (const p of [this.pad, this.shimmer]) p?.v.release(now, 0.05);
    this.cluster?.release(now, 0.05);
    this.fixed?.release(now, 0.05);
    for (const name of Object.keys(this.layers) as LayerName[]) {
      for (const n of this.layers[name].nodes) {
        try {
          n.disconnect();
        } catch {
          /* not connected */
        }
      }
    }
  }
}
