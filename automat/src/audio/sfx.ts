// One-shot SFX recipes, rendered once through OfflineAudioContext (dry — the live convolver adds space).
// Each asset is peak-normalised by the renderer; mix levels live in one table in audio.ts.
// Design notes: glassy/Nordic palette (FM bells at ratio 3.5, glass-bar chimes, inharmonic gongs),
// sparse and soft for anything that repeats per spin, cinematic weight only for the storm set.
// No coin sounds anywhere.
import {
  type Ctx, mtof, osc, gain, filt, pan, noise, perc, swell, lin, glide, shaper, bell, chimeVoice, gong, brass, aah, prng, noiseSeed,
} from './dsp.ts';

export interface SfxAsset {
  ch: 1 | 2; dur: number;
  div?: 1 | 2 | 4;   // bandwidth hint: render at hw/div everywhere
  minRate?: number;  // floor for the hinted rate (default 11 kHz)
  liteRate?: number; // lite devices: render rate for unhinted one-shots (default 32 kHz, audited)
  build(ctx: Ctx, out: AudioNode): void;
}

/** Bell zones (MIDI) for 'land': any target pitch is ≤ 2.5 semitones from a zone. */
export const LAND_ZONES = [69, 74, 79, 84, 89, 94];
/** Chime ladder (win cascade steps): D5 F5 A5 C6 D6 F6 A6 C7. */
export const CHIME_LADDER = [74, 77, 81, 84, 86, 89, 93, 96];
export const CHIME_ZONES = [74, 81, 86, 93];
/** levelUp gong zones (MIDI roots) and per-level offsets from D4 (D-dorian pentatonic climb). */
export const LEVEL_ZONES = [62, 74];
export const LEVEL_SEMIS = [0, 0, 2, 3, 7, 10, 12, 14, 15, 17, 19];

export const nearestZone = (m: number, zones: readonly number[]): number => {
  let best = zones[0];
  for (const z of zones) if (Math.abs(m - z) < Math.abs(m - best) || (Math.abs(m - z) === Math.abs(m - best) && z < best)) best = z;
  return best;
};

const A: Record<string, SfxAsset> = {};

// ------------------------------------------------------------------ base
for (const z of LAND_ZONES) {
  for (const rr of [0, 1]) {
    A[`land${z}${rr ? 'b' : 'a'}`] = {
      ch: 1, dur: 2.0, liteRate: z >= 89 ? 48000 : 32000, // top zones: FM sidebands near 16 kHz (audit)
      build(ctx, out) {
        const tau = 0.56 * Math.pow(2, -(z - 74) / 26);
        bell(ctx, out, 0.002, mtof(z), 0.8, {
          ratio: rr ? 3.5 : 3.502, index: rr ? 1.25 : 1.6, itau: rr ? 0.13 : 0.17, tau: tau * (rr ? 0.94 : 1),
          body: 0.55, tine: rr ? 0.09 : 0.13, strike: 0.045, lp: 8200, seed: z * 3 + rr, detune: rr ? 1.5 : -1.5,
        });
      },
    };
  }
}

for (const z of CHIME_ZONES) {
  A[`chime${z}`] = {
    ch: 1, dur: 2.8,
    build(ctx, out) { chimeVoice(ctx, out, 0.002, mtof(z), 0.8, 0.95 * Math.pow(2, -(z - 74) / 28)); },
  };
}

for (const v of [0, 1, 2]) {
  A[`shatter${v}`] = {
    ch: 1, dur: 1.1, liteRate: 48000, // glass air above 14 kHz (audit)
    build(ctx, out) {
      const r = prng(500 + v * 17);
      const bus = filt(ctx, 'highpass', 300, 0.6);
      bus.connect(out);
      for (let k = 0; k < 6; k++) {
        const t = k === 0 ? 0.001 : r() * 0.06;
        const f = 2300 + r() * 4200;
        const a = 0.22 + r() * 0.25;
        for (const [ratio, amp, d] of [[1, 1, 1], [1.506, 0.35, 0.6], [2.37, 0.15, 0.35]] as const) {
          const o = osc(ctx, 'sine', f * ratio, t, t + 0.8);
          const g = gain(ctx, 0);
          perc(g.gain, t, a * amp, 0.0006, (0.05 + r() * 0.12) * d);
          o.connect(g).connect(bus);
        }
      }
      const n = noise(ctx, 0, 0.5, 520 + v);
      const hp = filt(ctx, 'highpass', 1900, 0.7);
      const pk = filt(ctx, 'peaking', 5200, 1, 6);
      const ng = gain(ctx, 0);
      perc(ng.gain, 0.001, 0.32, 0.0005, 0.032);
      n.connect(hp).connect(pk).connect(ng).connect(bus);
      // crumble grains
      const cn = noise(ctx, 0.03, 0.4, 540 + v);
      const cb = filt(ctx, 'bandpass', 3800, 1.4);
      const cg = gain(ctx, 0);
      cg.gain.setValueAtTime(0, 0);
      for (let k = 0; k < 7; k++) {
        const t = 0.04 + k * 0.028 + r() * 0.012;
        cg.gain.setValueAtTime(0, t);
        cg.gain.linearRampToValueAtTime(0.12 * (1 - k / 8), t + 0.002);
        cg.gain.setTargetAtTime(0, t + 0.002, 0.006);
      }
      cn.connect(cb).connect(cg).connect(bus);
      const tk = osc(ctx, 'sine', 430, 0, 0.1);
      tk.frequency.setTargetAtTime(260, 0, 0.02);
      const tg = gain(ctx, 0);
      perc(tg.gain, 0.001, 0.12, 0.001, 0.018);
      tk.connect(tg).connect(out);
    },
  };
}

for (const v of [0, 1, 2]) {
  A[`spin${v}`] = {
    ch: 1, dur: 0.8, liteRate: 48000, // swept low-pass loses ~4 dB of air near a 16 kHz Nyquist (audit)
    build(ctx, out) {
      const n = noise(ctx, 0, 0.8, 600 + v);
      const lp = filt(ctx, 'lowpass', 4000, 0.9);
      glide(lp.frequency, 0, 3800 + v * 700, 480, 0.42 + v * 0.04);
      const bp = filt(ctx, 'peaking', 1200, 0.7, 3);
      const g = gain(ctx, 0);
      g.gain.setValueAtTime(0, 0);
      g.gain.linearRampToValueAtTime(0.5, 0.05 + v * 0.01);
      g.gain.setTargetAtTime(0, 0.07, 0.11);
      n.connect(lp).connect(bp).connect(g).connect(out);
      const o = osc(ctx, 'sine', 140, 0, 0.5);
      glide(o.frequency, 0, 150 - v * 8, 68, 0.2);
      const og = gain(ctx, 0);
      perc(og.gain, 0.005, 0.16, 0.01, 0.07);
      o.connect(og).connect(out);
    },
  };
}

A.tap = {
  ch: 1, dur: 0.15,
  build(ctx, out) {
    const a = osc(ctx, 'sine', 1850, 0, 0.1);
    const ag = gain(ctx, 0);
    perc(ag.gain, 0.001, 0.5, 0.001, 0.011);
    a.connect(ag).connect(out);
    const b = osc(ctx, 'sine', 3700 * 1.02, 0, 0.1);
    const bg = gain(ctx, 0);
    perc(bg.gain, 0.001, 0.12, 0.001, 0.006);
    b.connect(bg).connect(out);
    const n = noise(ctx, 0, 0.05, 700);
    const bp = filt(ctx, 'bandpass', 4200, 1);
    const ng = gain(ctx, 0);
    perc(ng.gain, 0.001, 0.22, 0.0004, 0.003);
    n.connect(bp).connect(ng).connect(out);
  },
};

for (const [id, notes] of [['stakeUp', [81, 86]], ['stakeDown', [86, 81]]] as const) {
  A[id] = {
    ch: 1, dur: 0.9,
    build(ctx, out) {
      notes.forEach((m, i) => bell(ctx, out, 0.002 + i * 0.055, mtof(m), i ? 0.5 : 0.42, { index: 0.8, itau: 0.06, tau: i ? 0.17 : 0.12, body: 0.5, tine: 0.06, strike: 0.02 }));
    },
  };
}

// RETURN: dry, neutral, quiet. No pitch contour, no chord, no reverb (routed dry in the mixer).
for (const v of [0, 1]) {
  A[`returnTick${v}`] = {
    ch: 1, dur: 0.1,
    build(ctx, out) {
      const n = noise(ctx, 0, 0.06, 800 + v);
      const bp = filt(ctx, 'bandpass', v ? 1650 : 1500, 1.3);
      const ng = gain(ctx, 0);
      perc(ng.gain, 0.001, 0.6, 0.0006, 0.0055);
      n.connect(bp).connect(ng).connect(out);
      for (const [f, a] of [[640, 0.2], [1013, 0.1]] as const) {
        const o = osc(ctx, 'sine', f * (v ? 1.04 : 1), 0, 0.08);
        const og = gain(ctx, 0);
        perc(og.gain, 0.001, a, 0.0008, 0.009);
        o.connect(og).connect(out);
      }
    },
  };
}

// Upward fifth D6 → A6 + D7 glint: fits both D dorian (base) and D phrygian (storm).
A.nettoCross = {
  ch: 1, dur: 1.6,
  build(ctx, out) {
    chimeVoice(ctx, out, 0.002, mtof(86), 0.5, 0.32);   // D6
    chimeVoice(ctx, out, 0.062, mtof(93), 0.62, 0.42);  // A6
    const o = osc(ctx, 'sine', mtof(98), 0.062, 0.6);   // D7 glint
    const g = gain(ctx, 0);
    perc(g.gain, 0.062, 0.1, 0.001, 0.07);
    o.connect(g).connect(out);
  },
};

A.markUp = {
  ch: 1, dur: 0.8,
  build(ctx, out) {
    const f0 = mtof(79), f1 = mtof(81);
    const car = osc(ctx, 'sine', f1, 0, 0.8);
    glide(car.frequency, 0.001, f0, f1, 0.035);
    const mod = osc(ctx, 'sine', f1 * 2, 0, 0.8);
    glide(mod.frequency, 0.001, f0 * 2, f1 * 2, 0.035);
    const mg = gain(ctx, 0);
    mg.gain.setValueAtTime(f1 * 2 * 1.3, 0);
    mg.gain.setTargetAtTime(f1 * 0.2, 0.004, 0.05);
    mod.connect(mg).connect(car.frequency);
    const g = gain(ctx, 0);
    perc(g.gain, 0.001, 0.6, 0.002, 0.13);
    car.connect(g).connect(out);
    const t = osc(ctx, 'sine', f1 * 2.756, 0.03, 0.4);
    const tg = gain(ctx, 0);
    perc(tg.gain, 0.03, 0.1, 0.001, 0.05);
    t.connect(tg).connect(out);
  },
};

for (const v of [0, 1]) {
  A[`mote${v}`] = {
    ch: 1, dur: 0.35, liteRate: 48000, // zip skirt near 8 kHz (audit)
    build(ctx, out) {
      const n = noise(ctx, 0, 0.3, 900 + v);
      const bp = filt(ctx, 'bandpass', 1500, 4.5);
      glide(bp.frequency, 0, 1300 + v * 300, 6200 + v * 800, 0.15);
      const g = gain(ctx, 0);
      lin(g.gain, [[0, 0], [0.035, 0.5], [0.15, 0.12], [0.2, 0]]);
      n.connect(bp).connect(g).connect(out);
      const o = osc(ctx, 'sine', 900, 0, 0.25);
      glide(o.frequency, 0, 950 + v * 150, 2500 + v * 300, 0.14);
      const og = gain(ctx, 0);
      lin(og.gain, [[0, 0], [0.03, 0.05], [0.16, 0]]);
      o.connect(og).connect(out);
    },
  };
}

A.anticipation = {
  ch: 2, dur: 3.1, div: 2, minRate: 22000,
  build(ctx, out) {
    const lpL = filt(ctx, 'lowpass', 350, 3.2), lpR = filt(ctx, 'lowpass', 350, 3.2);
    for (const lp of [lpL, lpR]) glide(lp.frequency, 0, 320, 2300, 2.3);
    const trem = gain(ctx, 1);
    const lfo = osc(ctx, 'sine', 5, 0, 3.1);
    lfo.frequency.setValueAtTime(4.5, 0);
    lfo.frequency.linearRampToValueAtTime(11, 2.4);
    const lg = gain(ctx, 0.3);
    lfo.connect(lg).connect(trem.gain);
    const env = gain(ctx, 0);
    swell(env.gain, 0, 2.3, 0.7, 0.14, 0.16);
    lpL.connect(pan(ctx, -0.45)).connect(trem);
    lpR.connect(pan(ctx, 0.45)).connect(trem);
    trem.connect(env).connect(out);
    // open fifths D3 A3 D4 A4: tension from motion (filter + tremolo), not from a mode-specific 9th
    [50, 57, 62, 69].forEach((m, i) => {
      for (const d of [-8, 8]) {
        const o = osc(ctx, 'sawtooth', mtof(m), 0, 3.1, d);
        const g = gain(ctx, i === 3 ? 0.06 : 0.12);
        o.connect(g).connect(d < 0 ? lpL : lpR);
      }
    });
    for (const [m, p] of [[81, -0.5], [86, 0.5]] as const) {
      const o = osc(ctx, 'sine', mtof(m), 0, 3.1);
      const g = gain(ctx, 0);
      lin(g.gain, [[0, 0], [2.0, 0.05], [2.35, 0.06], [2.8, 0]]);
      o.connect(g).connect(pan(ctx, p)).connect(out);
    }
  },
};

A.countTick = {
  ch: 1, dur: 0.07,
  build(ctx, out) {
    const o = osc(ctx, 'sine', 3100, 0, 0.06);
    const g = gain(ctx, 0);
    perc(g.gain, 0.001, 0.6, 0.0008, 0.008);
    o.connect(g).connect(out);
    const n = noise(ctx, 0, 0.03, 950);
    const hp = filt(ctx, 'highpass', 6000, 0.7);
    const ng = gain(ctx, 0);
    perc(ng.gain, 0.001, 0.2, 0.0004, 0.003);
    n.connect(hp).connect(ng).connect(out);
  },
};

for (const root of LEVEL_ZONES) {
  A[`levelUp${root}`] = {
    ch: 1, dur: 4.0,
    build(ctx, out) {
      const hit = 0.32;
      // quick upward riser into the hit
      const n = noise(ctx, 0, hit + 0.01, 1000 + root);
      const bp = filt(ctx, 'bandpass', 500, 2);
      glide(bp.frequency, 0, 450, 5200, hit);
      const ng = gain(ctx, 0);
      lin(ng.gain, [[0, 0], [hit - 0.01, 0.3], [hit, 0]]);
      n.connect(bp).connect(ng).connect(out);
      const s = osc(ctx, 'sine', mtof(root) / 2, 0, hit + 0.01);
      glide(s.frequency, 0, mtof(root - 12), mtof(root), hit);
      const sg = gain(ctx, 0);
      lin(sg.gain, [[0, 0], [hit - 0.01, 0.16], [hit, 0]]);
      s.connect(sg).connect(out);
      gong(ctx, out, hit, mtof(root), 0.85, { tau: 1.35, bright: 0.9, strike: 0.3, sub: 0.3, seed: root });
      bell(ctx, out, hit + 0.004, mtof(root + 24), 0.22, { index: 1.1, tau: 0.5, body: 0.4 });
      bell(ctx, out, hit + 0.05, mtof(root + 31), 0.16, { index: 1.0, tau: 0.45, body: 0.4 });
    },
  };
}

const SUN_ROOT = [0, 62, 69, 74];
for (const l of [1, 2, 3]) {
  A[`sun${l}`] = {
    ch: 1, dur: 3.0,
    build(ctx, out) {
      const f = mtof(SUN_ROOT[l]);
      gong(ctx, out, 0.002, f, 0.75, { tau: 0.75 + 0.2 * l, bright: 0.65 + 0.15 * l, strike: 0.2, sub: 0.22, seed: 40 + l });
      bell(ctx, out, 0.004, f * 2, 0.35, { index: 1.1, tau: 0.5 + 0.1 * l, body: 0.45 });
      if (l >= 2) chimeVoice(ctx, out, 0.07, f * 3, 0.18, 0.5);
      if (l >= 3) {
        chimeVoice(ctx, out, 0.12, f * 4, 0.2, 0.6);
        const sw = osc(ctx, 'sine', f * 2, 0, 2.5);
        const sg = gain(ctx, 0);
        lin(sg.gain, [[0, 0], [0.15, 0.06], [1.8, 0]]);
        sw.connect(sg).connect(out);
      }
    },
  };
}

// WIN stingers — brass-like saw stacks + formant "aah". F-major colour over the D-dorian bed.
type Chord = { t: number; d: number; notes: number[]; amp: number; bright?: number };
function stinger(ctx: Ctx, out: AudioNode, chords: Chord[], choir: [number, number, number, number][], sparkle: [number, number][], boom: number[]): void {
  const bus = gain(ctx, 1);
  const sat = shaper(ctx, 1.2);
  bus.connect(sat).connect(out);
  for (const c of chords) {
    c.notes.forEach((m, i) => brass(ctx, bus, c.t, c.d, mtof(m), c.amp * (i === 0 ? 1 : 0.8), { a: 0.045, r: 0.4, bright: c.bright ?? 1, pan: (i / Math.max(1, c.notes.length - 1) - 0.5) * 0.6 }));
  }
  for (const [t, d, m, a] of choir) aah(ctx, bus, t, d, mtof(m), a, 0, 0.16, 0.5);
  for (const [t, m] of sparkle) bell(ctx, out, t, mtof(m), 0.16, { index: 1.2, tau: 0.45, body: 0.45, tine: 0.1 });
  for (const t of boom) {
    const o = osc(ctx, 'sine', 90, t, t + 1.6);
    glide(o.frequency, t, 95, 52, 0.25);
    const g = gain(ctx, 0);
    perc(g.gain, t, 0.55, 0.004, 0.35);
    o.connect(g).connect(out);
    const n = noise(ctx, t, t + 0.3, 1100);
    const lp = filt(ctx, 'lowpass', 900, 0.7);
    const ng = gain(ctx, 0);
    perc(ng.gain, t, 0.18, 0.001, 0.05);
    n.connect(lp).connect(ng).connect(out);
  }
}
const Bb9 = [46, 53, 57, 62, 72], C69 = [48, 55, 62, 64, 69], F9 = [53, 60, 64, 67, 69];
// Tier-1 wins are frequent: bell-led and soft (brass only as a warm bed), two voicings round-robin.
for (const [v, notes, bells] of [[0, [53, 60, 64, 69], [84, 89]], [1, [57, 60, 64, 67], [81, 88]]] as const) {
  A[`win1${v ? 'b' : 'a'}`] = {
    ch: 1, dur: 2.2,
    build(ctx, out) {
      const bed = gain(ctx, 1);
      bed.connect(out);
      notes.forEach((m, i) => brass(ctx, bed, 0.02, 0.42, mtof(m), 0.05 * (i === 0 ? 1 : 0.8), { a: 0.09, r: 0.45, bright: 0.75, pan: (i / 3 - 0.5) * 0.6 }));
      aah(ctx, out, 0.05, 0.5, mtof(72), 0.03, 0, 0.14, 0.5);
      bells.forEach((m, i) => bell(ctx, out, 0.012 + i * 0.07, mtof(m), 0.3, { index: 1.2, tau: 0.5, body: 0.5, tine: 0.1 }));
    },
  };
}
A.win2 = {
  ch: 1, dur: 3.0,
  build(ctx, out) {
    stinger(ctx, out, [{ t: 0.01, d: 0.26, notes: Bb9, amp: 0.08 }, { t: 0.3, d: 0.9, notes: F9, amp: 0.09 }],
      [[0.3, 1.0, 72, 0.05], [0.3, 1.0, 69, 0.04]], [[0.3, 77], [0.36, 81], [0.42, 84], [0.48, 89]], []);
  },
};
const BIG: Record<number, { hold: number; voices: number }> = {
  3: { hold: 1.6, voices: 2 },
  4: { hold: 2.3, voices: 3 },
  5: { hold: 3.0, voices: 4 },
};
for (const l of [3, 4, 5]) {
  A[`bigWin${l}`] = {
    ch: 1, dur: 1.9 + BIG[l].hold + 1.4,
    build(ctx, out) {
      const b = BIG[l];
      const amp = 0.075 + 0.01 * (l - 3);
      const chords: Chord[] = [
        { t: 0.01, d: 0.28, notes: Bb9, amp, bright: 0.9 },
        { t: 0.32, d: 0.28, notes: C69, amp, bright: 1 },
        { t: 0.64, d: b.hold, notes: l >= 4 ? [41, ...F9, 77] : F9, amp: amp * 1.1, bright: 1.15 },
      ];
      if (l === 5) chords.push({ t: 0.64, d: b.hold, notes: [81, 84], amp: amp * 0.5, bright: 1.2 });
      const choir: [number, number, number, number][] = [];
      const top = [72, 69, 77, 81];
      for (let v = 0; v < b.voices; v++) choir.push([0.62, b.hold + 0.1, top[v], 0.05]);
      const sp: [number, number][] = [];
      [77, 81, 84, 88, 89, 93].forEach((m, i) => sp.push([0.66 + i * 0.07, m]));
      if (l >= 4) [96, 93, 89, 88].forEach((m, i) => sp.push([1.2 + i * 0.09, m]));
      stinger(ctx, out, chords, choir, sp, [0.64]);
      if (l >= 4) {
        // shimmer swell under the hold
        const o = osc(ctx, 'sine', mtof(89), 0.6, 0.6 + b.hold + 1);
        const g = gain(ctx, 0);
        lin(g.gain, [[0.6, 0], [1.2, 0.03], [0.6 + b.hold, 0.02], [0.6 + b.hold + 0.9, 0]]);
        o.connect(g).connect(out);
      }
    },
  };
}

// Storm stinger: IV–V–I in B♭ major (E♭maj9 → F6/9 → B♭add9), diatonic to D phrygian, so it sits on
// top of the running storm loop without clashes (the F-major base stingers would rub E against E♭).
A.stormWin = {
  ch: 1, dur: 5.6,
  build(ctx, out) {
    const amp = 0.08;
    stinger(ctx, out, [
      { t: 0.01, d: 0.28, notes: [51, 58, 62, 67, 77], amp, bright: 0.9 },
      { t: 0.32, d: 0.28, notes: [53, 60, 67, 69, 74], amp, bright: 1 },
      { t: 0.64, d: 2.6, notes: [46, 53, 60, 62, 65, 70], amp: amp * 1.1, bright: 1.15 },
    ], [[0.62, 2.7, 70, 0.05], [0.62, 2.7, 74, 0.045], [0.62, 2.7, 77, 0.04]],
    [77, 82, 84, 86, 89, 94].map((m, i) => [0.66 + i * 0.07, m] as [number, number]), [0.64]);
  },
};

// ------------------------------------------------------------------ storm set
A.stormSwell = {
  ch: 1, dur: 2.7, liteRate: 48000, // saturated noise hiss is shaped near Nyquist at any lower rate (audit)
  build(ctx, out) {
    const env = gain(ctx, 0);
    env.gain.setValueAtTime(0.0008, 0);
    env.gain.exponentialRampToValueAtTime(1, 2.05);
    env.gain.linearRampToValueAtTime(0.35, 2.3);
    env.gain.linearRampToValueAtTime(0, 2.6);
    const trem = gain(ctx, 1);
    const lfo = osc(ctx, 'sine', 1.5, 0, 2.7);
    lfo.frequency.linearRampToValueAtTime(7, 2.2);
    const lg = gain(ctx, 0.22);
    lfo.connect(lg).connect(trem.gain);
    const sat = shaper(ctx, 1.6);
    env.connect(trem).connect(sat).connect(out);
    // 40 Hz sub + body tuned to D (D2, A2) so the swell sits in the key on small speakers
    for (const [f, a] of [[40, 0.7], [mtof(38), 0.22], [mtof(45), 0.07]] as const) {
      const o = osc(ctx, 'sine', f, 0, 2.7);
      const g = gain(ctx, a);
      o.connect(g).connect(env);
    }
    const n = noise(ctx, 0, 2.7, 1200, 4);
    const lp = filt(ctx, 'lowpass', 140, 0.8);
    const ng = gain(ctx, 0.5);
    n.connect(lp).connect(ng).connect(env);
    // what a phone speaker can reproduce: rising air-pressure band + a dark D/A drone (≥ 150 Hz)
    const pn = noise(ctx, 0, 2.7, 1210, 4);
    const pb = filt(ctx, 'bandpass', 600, 1.1);
    glide(pb.frequency, 0, 320, 1500, 2.2);
    pn.connect(pb).connect(gain(ctx, 1.6)).connect(env);
    const dl = filt(ctx, 'lowpass', 700, 0.7);
    dl.connect(gain(ctx, 0.6)).connect(env);
    for (const m of [50, 57]) for (const d of [-7, 7]) osc(ctx, 'sawtooth', mtof(m), 0, 2.7, d).connect(gain(ctx, 0.25)).connect(dl);
  },
};

A.stormRiser = {
  ch: 2, dur: 1.05, liteRate: 48000, // reverse-cymbal air above 14 kHz (audit)
  build(ctx, out) {
    const T = 1.0;
    // reverse cymbal (stereo noise)
    const n = noise(ctx, 0, T + 0.01, 1300, 3, 2);
    const hp = filt(ctx, 'highpass', 2600, 0.7);
    const pk = filt(ctx, 'lowpass', 9000, 0.6);
    const e = gain(ctx, 0);
    e.gain.setValueAtTime(0.001, 0);
    e.gain.exponentialRampToValueAtTime(0.22, T - 0.015);
    e.gain.linearRampToValueAtTime(0, T);
    n.connect(hp).connect(pk).connect(e).connect(out);
    // roar riser
    const src = gain(ctx, 1);
    const rn = noise(ctx, 0, T + 0.01, 1310);
    const rg = gain(ctx, 0.6);
    rn.connect(rg).connect(src);
    for (const d of [-9, 9]) osc(ctx, 'sawtooth', mtof(38), 0, T + 0.01, d).connect(gain(ctx, 0.25)).connect(src);
    // tonal scream: a rising saw pair that the band-pass tracks
    for (const d of [-12, 12]) {
      const x = osc(ctx, 'sawtooth', mtof(50), 0, T + 0.01, d);
      glide(x.frequency, 0, mtof(50), mtof(74), T);
      x.connect(gain(ctx, 0.18)).connect(src);
    }
    const bp = filt(ctx, 'bandpass', 200, 2.2);
    glide(bp.frequency, 0, 200, 6000, T);
    const sat = shaper(ctx, 3);
    const re = gain(ctx, 0);
    re.gain.setValueAtTime(0.004, 0);
    re.gain.exponentialRampToValueAtTime(0.6, T - 0.015);
    re.gain.linearRampToValueAtTime(0, T);
    src.connect(bp).connect(sat).connect(re);
    re.connect(pan(ctx, -0.25)).connect(out);
    re.connect(pan(ctx, 0.25)).connect(out);
  },
};

A.impact = {
  ch: 2, dur: 3.0,
  build(ctx, out) {
    const sub = osc(ctx, 'sine', 90, 0, 2);
    glide(sub.frequency, 0.001, 92, 32, 0.38);
    const sg = gain(ctx, 0);
    perc(sg.gain, 0.001, 0.8, 0.002, 0.5);
    const sat = shaper(ctx, 2.2);
    sub.connect(sg).connect(sat).connect(out);
    // punch + crack
    const n = noise(ctx, 0, 0.4, 1400, 3, 2);
    const lp = filt(ctx, 'lowpass', 3200, 0.7);
    const ng = gain(ctx, 0);
    perc(ng.gain, 0.001, 0.75, 0.0005, 0.08);
    n.connect(lp).connect(ng).connect(out);
    const c = noise(ctx, 0, 0.1, 1410, 3, 2);
    const hp = filt(ctx, 'highpass', 2200, 0.7);
    const cg = gain(ctx, 0);
    perc(cg.gain, 0.001, 0.45, 0.0003, 0.018);
    c.connect(hp).connect(cg).connect(out);
    // mid "thwack" body (what phone speakers actually reproduce)
    const mb = noise(ctx, 0, 0.6, 1430);
    const mbp = filt(ctx, 'bandpass', 700, 0.7);
    const mbs = shaper(ctx, 2);
    const mbg = gain(ctx, 0);
    perc(mbg.gain, 0.001, 1.5, 0.001, 0.12);
    mb.connect(mbp).connect(mbg).connect(mbs).connect(out);
    // metallic ring (inharmonic FM)
    const r = pan(ctx, 0);
    r.connect(out);
    bell(ctx, r, 0.002, 176, 0.6, { ratio: 1.414, index: 4.5, itau: 0.12, tau: 0.7, body: 0.3, tine: 0.1, strike: 0 });
    // stereo tail
    for (const side of [-1, 1]) {
      const tn = noise(ctx, 0, 3, 1420 + side, 4);
      const tl = filt(ctx, 'lowpass', 700, 0.6);
      glide(tl.frequency, 0.05, 1400, 220, 2.2);
      const tg = gain(ctx, 0);
      perc(tg.gain, 0.02, 0.22, 0.02, 0.55);
      tn.connect(tl).connect(tg).connect(pan(ctx, side * 0.85)).connect(out);
    }
  },
};

A.drop808 = {
  ch: 1, dur: 2.5, div: 4,
  build(ctx, out) {
    const o = osc(ctx, 'sine', 55, 0, 2.5);
    glide(o.frequency, 0.001, 55, 30, 1.4);
    const g = gain(ctx, 0);
    perc(g.gain, 0.001, 0.9, 0.004, 0.72);
    const sat = shaper(ctx, 2.4);
    const lp = filt(ctx, 'lowpass', 900, 0.6);
    o.connect(g).connect(sat).connect(lp).connect(out);
    const c = osc(ctx, 'sine', 180, 0, 0.1);
    glide(c.frequency, 0.001, 200, 80, 0.04);
    const cg = gain(ctx, 0);
    perc(cg.gain, 0.001, 0.25, 0.001, 0.02);
    c.connect(cg).connect(out);
  },
};

A.glassXL = {
  ch: 2, dur: 2.8,
  build(ctx, out) {
    const r = prng(1500);
    for (let k = 0; k < 42; k++) {
      const t = 0.002 + Math.pow(r(), 2.2) * 0.9;
      const f = 1100 + r() * 5200;
      const a = (0.1 + r() * 0.18) * (1 - t * 0.7);
      const p = pan(ctx, (r() - 0.5) * 1.6);
      p.connect(out);
      for (const [ratio, amp] of [[1, 1], [1.506, 0.35]] as const) {
        const o = osc(ctx, 'sine', f * ratio, t, t + 1);
        const g = gain(ctx, 0);
        perc(g.gain, t, a * amp, 0.0005, 0.04 + r() * 0.18);
        o.connect(g).connect(p);
      }
    }
    for (let k = 0; k < 16; k++) { // debris tinkles
      const t = 0.5 + r() * 1.5;
      const p = pan(ctx, (r() - 0.5) * 1.8);
      p.connect(out);
      const o = osc(ctx, 'sine', 3000 + r() * 5000, t, t + 0.3);
      const g = gain(ctx, 0);
      perc(g.gain, t, 0.04 + r() * 0.05, 0.0005, 0.03);
      o.connect(g).connect(p);
    }
    const n = noise(ctx, 0, 1.2, 1510, 3, 2);
    const hp = filt(ctx, 'bandpass', 2600, 0.5);
    const ng = gain(ctx, 0);
    perc(ng.gain, 0.001, 0.45, 0.0005, 0.2);
    n.connect(hp).connect(ng).connect(out);
    const cr = noise(ctx, 0, 0.3, 1520);
    const bp = filt(ctx, 'bandpass', 480, 0.9);
    const cg = gain(ctx, 0);
    perc(cg.gain, 0.001, 0.7, 0.001, 0.06);
    cr.connect(bp).connect(cg).connect(out);
  },
};

for (const v of [0, 1]) {
  A[`letterSlam${v}`] = {
    ch: 1, dur: 0.55,
    build(ctx, out) {
      const src = gain(ctx, 1);
      osc(ctx, 'sawtooth', v ? 196 : 174, 0, 0.5).connect(gain(ctx, 0.6)).connect(src);
      noise(ctx, 0, 0.5, 1600 + v).connect(gain(ctx, 0.3)).connect(src);
      const ring = gain(ctx, 0);
      const car = osc(ctx, 'sine', v ? 517 : 431, 0, 0.5);
      car.connect(ring.gain);
      const bp = filt(ctx, 'bandpass', 1400, 1.1);
      const e = gain(ctx, 0);
      perc(e.gain, 0.001, 0.9, 0.0008, 0.07);
      src.connect(ring).connect(bp).connect(e).connect(out);
      const th = osc(ctx, 'sine', 130, 0, 0.3);
      glide(th.frequency, 0.001, 140, 60, 0.07);
      const tg = gain(ctx, 0);
      perc(tg.gain, 0.001, 0.55, 0.002, 0.045);
      th.connect(tg).connect(out);
      bell(ctx, out, 0.002, v ? 910 : 820, 0.2, { ratio: 1.41, index: 3, itau: 0.05, tau: 0.14, body: 0.2, tine: 0.05, strike: 0 });
    },
  };
}

A.waveBoom = {
  ch: 2, dur: 3.0,
  build(ctx, out) {
    const o = osc(ctx, 'sine', 70, 0, 2.5);
    glide(o.frequency, 0.001, 72, 34, 0.9);
    const g = gain(ctx, 0);
    perc(g.gain, 0.001, 0.42, 0.005, 0.45);
    const sat = shaper(ctx, 2);
    o.connect(g).connect(sat).connect(out);
    const th = noise(ctx, 0, 0.5, 1730);
    const thb = filt(ctx, 'bandpass', 520, 0.8);
    const thg = gain(ctx, 0);
    perc(thg.gain, 0.001, 0.9, 0.002, 0.1);
    th.connect(thb).connect(thg).connect(out);
    // whoosh sweeping left → right like the band crossing the grid
    const n = noise(ctx, 0, 1.6, 1700, 3);
    const bp = filt(ctx, 'bandpass', 2800, 1.4);
    glide(bp.frequency, 0, 2800, 330, 0.95);
    const ng = gain(ctx, 0);
    lin(ng.gain, [[0, 0], [0.14, 1.6], [0.8, 0.7], [1.3, 0]]);
    const p = pan(ctx, -0.9);
    p.pan.linearRampToValueAtTime(0.9, 0.95);
    n.connect(bp).connect(ng).connect(p).connect(out);
    const c = noise(ctx, 0, 0.1, 1710, 3, 2);
    const hp = filt(ctx, 'highpass', 1600, 0.7);
    const cg = gain(ctx, 0);
    perc(cg.gain, 0.001, 0.4, 0.0004, 0.028);
    c.connect(hp).connect(cg).connect(out);
    // domino flips of the x-tags, one per column (matches stormWave 0.1 + c·0.1)
    for (let c2 = 0; c2 < 8; c2++) {
      const t = 0.1 + c2 * 0.1;
      const pp = pan(ctx, -0.8 + (c2 / 7) * 1.6);
      pp.connect(out);
      const tn = noise(ctx, t, t + 0.05, 1720 + c2);
      const tb = filt(ctx, 'bandpass', 3000 + c2 * 120, 2);
      const tg = gain(ctx, 0);
      perc(tg.gain, t, 0.35, 0.0005, 0.012);
      tn.connect(tb).connect(tg).connect(pp);
      const to = osc(ctx, 'sine', mtof(81 + [0, 1, 3, 5, 6, 8, 10, 12][c2]), t, t + 0.2); // A B♭ C D E♭ F G A (D phrygian)
      const tog = gain(ctx, 0);
      perc(tog.gain, t, 0.06, 0.001, 0.03);
      to.connect(tog).connect(pp);
    }
  },
};

/** JS micro-crackle (stereo) used by 'reform'. */
function crackle(ctx: Ctx, out: AudioNode, t0: number, dur: number, rate: number, amp: number, seed: number): void {
  const sr = ctx.sampleRate;
  const n = Math.floor(dur * sr);
  const b = ctx.createBuffer(2, n, sr);
  const L = b.getChannelData(0), R = b.getChannelData(1);
  const r = prng(noiseSeed(seed));
  let t = 0;
  while (true) {
    t += -Math.log(1 - r()) / rate;
    const i0 = Math.floor(t * sr);
    if (i0 >= n) break;
    const f = 1200 + r() * 4000, w = 2 * Math.PI * f / sr, len = Math.floor((0.002 + r() * 0.005) * sr);
    const a = amp * (0.2 + r() * 0.8), p = r();
    for (let k = 0; k < len && i0 + k < n; k++) {
      const v = Math.sin(w * k) * Math.exp(-k / (len * 0.25)) * a;
      L[i0 + k] += v * (1 - p); R[i0 + k] += v * p;
    }
  }
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(out);
  s.start(t0);
}

A.reform = {
  ch: 2, dur: 2.0, div: 2, minRate: 22000,
  build(ctx, out) {
    const lp = filt(ctx, 'lowpass', 250, 1.5);
    glide(lp.frequency, 0, 240, 1500, 1.2);
    const sat = shaper(ctx, 2);
    const e = gain(ctx, 0);
    swell(e.gain, 0, 1.25, 0.5, 0.12, 0.16);
    lp.connect(sat).connect(e).connect(out);
    [38, 45, 50].forEach((m, i) => {
      for (const d of [-10, 10]) {
        const o = osc(ctx, 'sawtooth', mtof(m), 0, 2, d);
        o.connect(gain(ctx, 0.14)).connect(pan(ctx, d < 0 ? -0.3 - i * 0.1 : 0.3 + i * 0.1)).connect(lp);
      }
    });
    const s = osc(ctx, 'sine', mtof(62), 0, 1.9);
    glide(s.frequency, 0.05, mtof(62), mtof(69), 1.1);
    const sg = gain(ctx, 0);
    lin(sg.gain, [[0, 0], [0.4, 0.06], [1.2, 0.05], [1.7, 0]]);
    s.connect(sg).connect(out);
    crackle(ctx, out, 0, 1.6, 22, 0.08, 1800);
  },
};

A.summary = {
  ch: 2, dur: 3.8,
  build(ctx, out) {
    [62, 69, 74, 79, 81].forEach((m, i) => {
      const p = pan(ctx, (i / 4 - 0.5) * 0.9);
      p.connect(out);
      bell(ctx, p, 0.004 + i * 0.045, mtof(m), 0.3, { index: 1.0, tau: 1.0 - i * 0.08, body: 0.6, tine: 0.08, strike: 0.03 });
    });
    aah(ctx, out, 0.05, 1.8, mtof(62), 0.035, -0.3, 0.3, 0.8, 'o');
    aah(ctx, out, 0.05, 1.8, mtof(69), 0.03, 0.3, 0.3, 0.8, 'o');
    const s = osc(ctx, 'sine', mtof(38), 0, 3.5);
    const sg = gain(ctx, 0);
    swell(sg.gain, 0, 1.6, 0.2, 0.2, 0.5);
    s.connect(sg).connect(out);
  },
};

A.fade = {
  ch: 2, dur: 4.0,
  build(ctx, out) {
    [86, 84, 81, 77, 74, 69].forEach((m, i) => {
      const p = pan(ctx, 0.6 - i * 0.24);
      p.connect(out);
      bell(ctx, p, 0.01 + i * 0.22, mtof(m), 0.3 - i * 0.025, { index: 1.0, tau: 0.65, body: 0.55, tine: 0.07 });
    });
    const n = noise(ctx, 0, 4, 1900, 4, 2);
    const bp = filt(ctx, 'bandpass', 1800, 0.9);
    glide(bp.frequency, 0, 1800, 450, 3.2);
    const ng = gain(ctx, 0);
    lin(ng.gain, [[0, 0], [0.8, 0.22], [3.6, 0]]);
    n.connect(bp).connect(ng).connect(out);
    for (const m of [38, 45]) {
      const o = osc(ctx, 'sine', mtof(m), 0, 4);
      const g = gain(ctx, 0);
      lin(g.gain, [[0, 0], [0.5, 0.12], [3.8, 0]]);
      o.connect(g).connect(out);
    }
  },
};

export const SFX_ASSETS: Readonly<Record<string, SfxAsset>> = A;
