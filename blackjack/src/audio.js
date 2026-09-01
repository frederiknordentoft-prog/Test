/* ============================================================================
   Synthesised sound kit — Web Audio only, no samples.
   Quiet, glassy, short. Every cue sits at a similar loudness; nothing clips.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sound = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  class Sound {
    constructor() {
      this.ctx = null; this.master = null; this.noise = null;
      this.enabled = true; this.unlocked = false;
      this._last = new Map();
    }
    /** Create the context on the first user gesture (iOS requirement). */
    unlock() {
      if (this.unlocked) return;
      const g = typeof window !== 'undefined' ? window : globalThis;
      const AC = g.AudioContext || g.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.4;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12;
        this.master.connect(comp).connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noise = buf;
        this.unlocked = true;
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { /* audio unavailable */ }
    }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    setEnabled(v) { this.enabled = !!v; }
    _ok(name, cooldown = 30) {
      if (!this.enabled || !this.unlocked || !this.ctx) return false;
      const now = this.ctx.currentTime;
      const last = this._last.get(name) || -1;
      if (now - last < cooldown / 1000) return false;
      this._last.set(name, now);
      return true;
    }
    _env(node, t, a, d, peak = 1, s = 0.0001) {
      const g = node.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0.0001, t);
      g.linearRampToValueAtTime(peak, t + a);
      g.exponentialRampToValueAtTime(s, t + a + d);
    }
    _tone(type, f0, f1, t, a, d, gain, opts = {}) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
      const g = ctx.createGain(); this._env(g, t, a, d, gain);
      let n = o;
      if (opts.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; n.connect(f); n = f; }
      n.connect(g).connect(this.master);
      o.start(t); o.stop(t + a + d + 0.05);
    }
    _noiseBurst(t, dur, gain, { type = 'bandpass', f0 = 1500, f1 = null, q = 1, a = 0.004 } = {}) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource(); src.buffer = this.noise;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain(); this._env(g, t, a, dur, gain);
      src.connect(f).connect(g).connect(this.master);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    }
    _rand(v, pct) { return v * (1 + (Math.random() * 2 - 1) * pct); }

    /* ---- cues ---- */
    deal() {
      if (!this._ok('deal', 40)) return;
      const t = this.ctx.currentTime;
      this._noiseBurst(t, 0.11, 0.32, { f0: this._rand(2200, 0.1), f1: 700, q: 0.8 });
      this._noiseBurst(t + 0.09, 0.03, 0.18, { type: 'highpass', f0: 3500, a: 0.001 });
    }
    flip() {
      if (!this._ok('flip', 60)) return;
      const t = this.ctx.currentTime;
      this._noiseBurst(t, 0.06, 0.3, { type: 'highpass', f0: 2500, a: 0.002 });
      this._tone('sine', 1200, 700, t, 0.002, 0.05, 0.08);
    }
    chip() {
      if (!this._ok('chip', 25)) return;
      const t = this.ctx.currentTime;
      const f = this._rand(2600, 0.08);
      this._tone('sine', f, f * 0.98, t, 0.001, 0.07, 0.16);
      this._tone('sine', f * 1.5, f * 1.5, t, 0.001, 0.045, 0.07);
      this._noiseBurst(t, 0.015, 0.12, { type: 'highpass', f0: 4000, a: 0.001 });
    }
    chips(n = 3) {
      if (!this._ok('chips', 120)) return;
      for (let i = 0; i < Math.min(n, 5); i++) setTimeout(() => { this._last.delete('chip'); this.chip(); }, i * 45);
    }
    tap() {
      if (!this._ok('tap', 30)) return;
      const t = this.ctx.currentTime;
      this._noiseBurst(t, 0.012, 0.09, { type: 'bandpass', f0: 1800, q: 2, a: 0.001 });
    }
    win() {
      if (!this._ok('win', 200)) return;
      const t = this.ctx.currentTime;
      this._tone('triangle', 659.25, 659.25, t, 0.01, 0.18, 0.2, { lp: 3200 });
      this._tone('triangle', 987.77, 987.77, t + 0.11, 0.01, 0.3, 0.2, { lp: 3200 });
      this._tone('sine', 1975.5, 1975.5, t + 0.11, 0.01, 0.2, 0.04);
    }
    blackjack() {
      if (!this._ok('blackjack', 300)) return;
      const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this._tone('triangle', f, f, t + i * 0.09, 0.008, 0.32, 0.18, { lp: 3500 });
        this._tone('sine', f * 2, f * 2, t + i * 0.09, 0.008, 0.25, 0.04);
      });
    }
    lose() {
      if (!this._ok('lose', 200)) return;
      const t = this.ctx.currentTime;
      this._tone('sine', 160, 95, t, 0.01, 0.22, 0.22, { lp: 600 });
    }
    bust() {
      if (!this._ok('bust', 200)) return;
      const t = this.ctx.currentTime;
      this._tone('triangle', 783.99, 783.99, t, 0.005, 0.1, 0.12, { lp: 2400 });
      this._tone('triangle', 587.33, 570, t + 0.09, 0.005, 0.2, 0.12, { lp: 2400 });
    }
    push() {
      if (!this._ok('push', 200)) return;
      const t = this.ctx.currentTime;
      this._tone('triangle', 523.25, 523.25, t, 0.01, 0.18, 0.16, { lp: 2500 });
    }
    notify() {
      if (!this._ok('notify', 200)) return;
      const t = this.ctx.currentTime;
      this._tone('sine', 783.99, 783.99, t, 0.01, 0.14, 0.12);
      this._tone('sine', 1046.5, 1046.5, t + 0.1, 0.01, 0.22, 0.12);
    }
    shuffle() {
      if (!this._ok('shuffle', 500)) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 14; i++) this._noiseBurst(t + i * 0.038, 0.03, 0.1, { f0: 1500 + i * 60, q: 1.5, a: 0.002 });
      this._noiseBurst(t + 0.55, 0.16, 0.2, { f0: 2400, f1: 500, q: 0.7 });
    }
    counter() { // tiny tick used while a number counts up
      if (!this._ok('counter', 45)) return;
      const t = this.ctx.currentTime;
      this._tone('sine', 2400, 2400, t, 0.001, 0.02, 0.03);
    }
  }
  return Sound;
});
