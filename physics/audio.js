export class Audio {
  constructor({ volume = 0.4 } = {}) {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = volume;
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

  thud(speed = 1) {
    if (!this.ctx || this.muted) return;
    const v = Math.min(1, speed / 18);
    if (v < 0.05) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t0);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.18);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(v * 0.7, t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.25);
  }

  ping(speed = 1) {
    if (!this.ctx || this.muted) return;
    const v = Math.min(1, speed / 8);
    if (v < 0.05) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 700 + v * 700;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(v * 0.25, t0 + 0.003);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.1);
  }

  jingle() {
    if (!this.ctx || this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const t0 = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = t0 + i * 0.1;
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(0.28, start + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(env).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  }

  click() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1200;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.08, t0 + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.05);
  }
}
