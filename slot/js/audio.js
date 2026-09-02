/* =========================================================================
   SlotAudio — fully synthesized sound palette (no files).
   Aesthetic: Apple Pay chime / iOS system sounds — soft sine/triangle bells,
   short filtered-noise transients, a generated plate-style reverb.
   ========================================================================= */
(function (root) {
  'use strict';

  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

  class SlotAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.master = null;
      this.reverb = null;
      this._unlocked = false;
      this._lastTick = 0;
    }

    /* Lazily create the context on first user gesture (iOS requirement). */
    unlock() {
      if (this._unlocked) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 6;
      comp.attack.value = 0.003; comp.release.value = 0.25;
      const master = this.master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(comp).connect(ctx.destination);

      // Generated reverb impulse: exponentially decaying stereo noise.
      const len = Math.floor(ctx.sampleRate * 1.6);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (1 - 0.3 * c * Math.sin(i * 0.001));
        }
      }
      const conv = ctx.createConvolver(); conv.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.22;
      conv.connect(wet).connect(master);
      this.reverb = conv;
      this._unlocked = true;
      if (ctx.state === 'suspended') ctx.resume();
    }

    setEnabled(on) { this.enabled = !!on; if (this.master) this.master.gain.setTargetAtTime(on ? 0.55 : 0.0001, this.ctx.currentTime, 0.02); }
    get ready() { return this._unlocked && this.enabled && this.ctx && this.ctx.state === 'running'; }
    now() { return this.ctx.currentTime; }

    /* ---------- primitives ---------- */
    tone({ freq, type = 'sine', t = 0, dur = 0.3, gain = 0.2, attack = 0.005, decay, release, detune = 0, reverb = 0.5, pan = 0, glideTo, glideTime }) {
      const ctx = this.ctx; const start = ctx.currentTime + t;
      const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + (glideTime || dur));
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + attack);
      const rel = release != null ? release : dur;
      g.gain.setTargetAtTime(0.0001, start + attack + (decay || 0), rel / 4);
      let last = g;
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); last = p; }
      last.connect(this.master);
      if (reverb > 0 && this.reverb) { const rg = ctx.createGain(); rg.gain.value = reverb; last.connect(rg).connect(this.reverb); }
      osc.connect(g);
      osc.start(start); osc.stop(start + attack + (decay || 0) + rel + 0.5);
    }

    noise({ t = 0, dur = 0.08, gain = 0.15, hp = 800, lp = 6000, q = 0.7, sweepTo, reverb = 0.15 }) {
      const ctx = this.ctx; const start = ctx.currentTime + t;
      const len = Math.max(1, Math.floor(ctx.sampleRate * (dur + 0.05)));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
      const l = ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp; l.Q.value = q;
      if (sweepTo) l.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(h).connect(l).connect(g).connect(this.master);
      if (reverb > 0 && this.reverb) { const rg = ctx.createGain(); rg.gain.value = reverb; g.connect(rg).connect(this.reverb); }
      src.start(start); src.stop(start + dur + 0.05);
    }

    /* Bell: sine fundamental + quiet triangle octave — the "Apple chime" timbre. */
    bell(midi, { t = 0, gain = 0.22, dur = 0.9, pan = 0, reverb = 0.6 } = {}) {
      const f = NOTE(midi);
      this.tone({ freq: f, type: 'sine', t, dur, gain, attack: 0.004, pan, reverb });
      this.tone({ freq: f * 2, type: 'triangle', t, dur: dur * 0.6, gain: gain * 0.18, attack: 0.004, pan, reverb });
      this.tone({ freq: f * 3.01, type: 'sine', t, dur: dur * 0.35, gain: gain * 0.06, attack: 0.002, pan, reverb: 0.3 });
    }

    /* ---------- vocabulary ---------- */
    click() {
      if (!this.ready) return;
      this.noise({ dur: 0.03, gain: 0.08, hp: 1500, lp: 9000, reverb: 0 });
      this.tone({ freq: 1900, type: 'sine', dur: 0.04, gain: 0.05, reverb: 0.1 });
    }
    toggle(on) {
      if (!this.ready) return;
      this.tone({ freq: on ? 880 : 660, type: 'sine', dur: 0.09, gain: 0.07, reverb: 0.2 });
    }
    spinStart() {
      if (!this.ready) return;
      this.noise({ dur: 0.32, gain: 0.07, hp: 200, lp: 500, sweepTo: 3200, q: 1.2, reverb: 0.1 });
      this.tone({ freq: 140, type: 'sine', dur: 0.25, gain: 0.08, glideTo: 90, reverb: 0.1 });
    }
    tick(speed) {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      if (t - this._lastTick < 0.03) return;
      this._lastTick = t;
      this.tone({ freq: 1400 + Math.random() * 300, type: 'triangle', dur: 0.012, gain: 0.018 * Math.min(1, speed), reverb: 0 });
    }
    reelStop(i) {
      if (!this.ready) return;
      const pan = (i - 2) * 0.25;
      this.tone({ freq: 160 + i * 10, type: 'sine', dur: 0.16, gain: 0.16, glideTo: 70, glideTime: 0.12, pan, reverb: 0.15 });
      this.noise({ dur: 0.035, gain: 0.09, hp: 900, lp: 5000, reverb: 0.1 });
      this.tone({ freq: 2400 + i * 120, type: 'sine', dur: 0.05, gain: 0.03, pan, reverb: 0.2 });
    }
    anticipation() {
      if (!this.ready) return;
      // slow rising shimmer
      for (let i = 0; i < 6; i++) this.tone({ freq: NOTE(76 + i * 2), type: 'sine', t: i * 0.11, dur: 0.5, gain: 0.05, reverb: 0.8 });
      this.tone({ freq: 55, type: 'sine', dur: 1.1, gain: 0.08, glideTo: 110, glideTime: 1.0, reverb: 0.3 });
    }
    scatterLand(n) {
      if (!this.ready) return;
      this.bell(84 + n * 3, { gain: 0.14, dur: 0.7 });
      this.noise({ dur: 0.12, gain: 0.05, hp: 3000, lp: 12000, reverb: 0.4 });
    }
    win(tier) {
      if (!this.ready) return;
      const seq = {
        win: [[76, 0], [83, 0.09]],
        big: [[72, 0], [76, 0.1], [79, 0.2], [84, 0.32]],
        mega: [[67, 0], [71, 0.09], [74, 0.18], [79, 0.27], [83, 0.36], [86, 0.5], [91, 0.66]],
        epic: [[60, 0], [64, 0.1], [67, 0.2], [72, 0.3], [76, 0.4], [79, 0.5], [84, 0.6], [88, 0.75], [91, 0.9], [96, 1.1]],
      }[tier] || [[76, 0], [83, 0.09]];
      seq.forEach(([m, t], i) => this.bell(m, { t, gain: 0.2, dur: tier === 'win' ? 0.8 : 1.2, pan: (i % 2 ? 0.25 : -0.25) }));
      if (tier === 'mega' || tier === 'epic') {
        this.tone({ freq: NOTE(43), type: 'sine', dur: 2.2, gain: 0.12, attack: 0.3, reverb: 0.5 });
        this.tone({ freq: NOTE(55), type: 'triangle', dur: 2.0, gain: 0.05, attack: 0.4, reverb: 0.8 });
      }
    }
    rollTick(progress) {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      if (t - this._lastTick < 0.045) return;
      this._lastTick = t;
      this.tone({ freq: 1200 + progress * 900, type: 'sine', dur: 0.03, gain: 0.03, reverb: 0.1 });
    }
    rollEnd() {
      if (!this.ready) return;
      this.bell(88, { gain: 0.12, dur: 0.6 });
    }
    bonusEnter() {
      if (!this.ready) return;
      for (let i = 0; i < 12; i++) this.tone({ freq: NOTE(64 + i * 2), type: 'sine', t: i * 0.05, dur: 0.6, gain: 0.05, reverb: 0.9 });
      [[60, 0.65], [67, 0.65], [72, 0.7], [76, 0.72], [79, 0.78]].forEach(([m, t], i) => this.bell(m, { t, gain: 0.18, dur: 1.8, pan: (i - 2) * 0.15 }));
      this.tone({ freq: NOTE(36), type: 'sine', t: 0.65, dur: 2.5, gain: 0.14, attack: 0.15, reverb: 0.5 });
    }
    bonusExit(total) {
      if (!this.ready) return;
      [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36]].forEach(([m, t]) => this.bell(m, { t, gain: 0.18, dur: 1.5 }));
      this.tone({ freq: NOTE(43), type: 'sine', t: 0.36, dur: 2.0, gain: 0.12, attack: 0.2, reverb: 0.5 });
    }
    freeSpinStart() {
      if (!this.ready) return;
      this.tone({ freq: NOTE(88), type: 'sine', dur: 0.12, gain: 0.05, reverb: 0.4 });
    }
    error() {
      if (!this.ready) return;
      this.tone({ freq: 330, type: 'triangle', dur: 0.12, gain: 0.08, reverb: 0.1 });
      this.tone({ freq: 262, type: 'triangle', t: 0.1, dur: 0.16, gain: 0.08, reverb: 0.1 });
    }
  }

  root.SlotAudio = SlotAudio;
})(typeof self !== 'undefined' ? self : this);
