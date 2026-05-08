export class Audio {
  constructor({ volume = 0.4 } = {}) {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = volume;
    this._noiseBuffer = null;
  }

  // Must be called from a user gesture on iOS Safari before any sound plays.
  resume() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.master && !this.muted) this.master.gain.value = volume;
  }

  // Primitive: oscillator with envelope and optional frequency sweep.
  tone({
    freq,
    freqEnd,
    duration = 0.1,
    type = 'sine',
    gain = 0.3,
    attack = 0.005,
    decay,
    delay = 0,
  }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const dec = decay ?? Math.max(0.005, duration - attack);
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null && freqEnd !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(0.01, freqEnd), t0 + duration);
    }
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + attack + dec);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + attack + dec + 0.05);
  }

  // Primitive: white noise with envelope and optional bandpass filter.
  noise({
    duration = 0.1,
    gain = 0.3,
    attack = 0.005,
    decay,
    filterFreq,
    filterQ = 1,
    delay = 0,
  } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const dec = decay ?? Math.max(0.005, duration - attack);
    const buffer = this._noiseBuffer ?? this._makeNoiseBuffer();
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + attack + dec);
    let last = src;
    if (filterFreq != null) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      filter.Q.value = filterQ;
      src.connect(filter);
      last = filter;
    }
    last.connect(env).connect(this.master);
    src.start(t0);
    src.stop(t0 + attack + dec + 0.05);
  }

  // Convenience: melody via repeated tone() calls.
  melody(freqs, { type = 'triangle', gain = 0.25, gap = 0.1, duration = 0.25 } = {}) {
    freqs.forEach((freq, i) => {
      this.tone({ freq, type, gain, duration, delay: i * gap });
    });
  }

  _makeNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, sr, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buffer;
    return buffer;
  }

  // Presets — examples built on top of the primitives.
  thud(speed = 1) {
    const v = Math.min(1, speed / 18);
    if (v < 0.05) return;
    this.tone({ freq: 160, freqEnd: 45, duration: 0.2, type: 'sine', gain: v * 0.7, attack: 0.005, decay: 0.18 });
  }

  ping(speed = 1) {
    const v = Math.min(1, speed / 8);
    if (v < 0.05) return;
    this.tone({ freq: 700 + v * 700, duration: 0.08, type: 'triangle', gain: v * 0.25, attack: 0.003, decay: 0.077 });
  }

  jingle() {
    this.melody([523.25, 659.25, 783.99, 1046.5], { type: 'triangle', gain: 0.28, gap: 0.1, duration: 0.28 });
  }

  click() {
    this.tone({ freq: 1200, duration: 0.04, type: 'square', gain: 0.08, attack: 0.002, decay: 0.038 });
  }
}
