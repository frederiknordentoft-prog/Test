// "Porten under klinten åbner" — the 6-bar gate ceremony, anchored to the base bed's bar grid (Polar Night, 85,2 BPM,
// D aeolian: bar 2,817 s, beat 0,704 s). T0 = the first bar line ≥ now + 0,9 s (audio.nextBar); every SFX is
// scheduled with `when: T0 + t` and the timeline is slaved to the audio clock (anchorToAudio, as the Solstorm
// cinematic). This module owns the ceremony's whole sound schedule, the bar-1 filter/duck and its release in bar 5.
// FlashBudget: no w.flash(); the seam and the four resonance waves ask world.allowFlash() first; every large-area rise
// takes ≥ 500 ms (tiles, ×1,25 max) or ≥ 1 s (light, bloom); nothing is red. The sky stays at the player's own Kp
// (skyGlowFloor ≤ 0,6: ≤ 6 % luminance lift). Calm: ~8 s, not bar-anchored, sounds kept, motion removed.
// Skip (from 2,0 s after T0): jump to the end state; the Game cancels the scheduled audio and releases filter/duck.
import { gsap } from 'gsap';
import { anchorToAudio, releaseAudioAnchor } from '../clock.ts';
import { PAL } from '../../core/palette.ts';
import { crand } from '../../core/cosmeticRng.ts';
import type { GameAudio, Sfx } from '../../audio/audio.ts';
import type { Particles } from '../../render/modules.ts';
import type { GateView } from '../../render/chamber/GateView.ts';

export interface GateWorld {
  gate: GateView;
  audio: GameAudio;
  bloom: { strength: number };
  camera: { zoom: number };
  /** world.skyGlowFloor (the gate light's floor under the sky glow). */
  sky: { skyGlowFloor: number };
  particles: Particles;
  allowFlash(): boolean;
  haptic(p: number | number[]): void;
  calm: boolean;
}
export interface GateHandle { done: Promise<void>; canSkip(): boolean; skip(): void; at(): number }

const B = 2.817, b = B / 4;
/** Ceremony times (s from T0). */
export const GATE_T = {
  shimmer: B, lantern: B + 2 * b, key: 2 * B, travel: 2 * B + 0.2, seat: 2 * B + 0.2 + 1.8,
  digits: [3 * B, 3 * B + b, 3 * B + 2 * b, 3 * B + 3 * b], seal: 4 * B, swing: 4 * B + 0.232, name: 5 * B, end: 6 * B,
};
const CALM_T = { key: 1.2, keyIn: 1.5, seat: 1.8, digits: [2.4, 3.2, 4.0, 4.8], seal: 5.6, name: 6.8, end: 8.0 };

export function playGateCeremony(w: GateWorld, o: { eyebrow: string; onSeal(): void }): GateHandle {
  const A = w.audio, g = w.gate, calm = w.calm;
  const G = () => g.geom!; // re-read in every callback: a resize mid-ceremony rebuilds the geometry
  // Pre-roll: T0 on the next bar line ≥ now + 0,9 s (calm: the pre-roll end, 0,6 s — the chamber text fade)
  const now = A.now();
  const T0 = calm ? now + 0.6 : A.nextBar(now + 0.9);
  const lead = Math.max(0.6, Math.min(0.9 + B + 0.05, T0 - now));
  const at = (name: Sfx, t: number, p: { level?: number; gain?: number } = {}) => A.play(name, { ...p, when: T0 + t });
  const P = (t: number) => lead + t;
  const tl = gsap.timeline({ paused: true });
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  let sealed = false, finished = false;
  const seal = () => { if (!sealed) { sealed = true; o.onSeal(); } };
  const kd = g.keyDie;

  g.eyebrow.text = o.eyebrow;
  g.eyebrow.alpha = 0;
  g.title.visible = g.concept.visible = false;
  g.keySeated = false;

  if (calm) {
    const T = CALM_T;
    tl.to(g.eyebrow, { alpha: 1, duration: 0.6 }, P(0))
      .call(() => { A.setMusicFilter(900, 1.0); A.duck(-6, 1.0); }, [], P(0))
      // the key crossfades niche → keystone (300 ms out, 300 ms in)
      .call(() => { kd.visible = true; kd.alpha = 0; kd.position.set(G().nordlys.screen.x, G().nordlys.screen.y); kd.width = kd.height = 0.16 * G().W; }, [], P(T.key - 0.3))
      .to(kd, { alpha: 1, duration: 0.3 }, P(T.key - 0.3))
      .to(kd, { alpha: 0, duration: 0.3 }, P(T.key))
      .call(() => { kd.position.set(G().keystone.x, G().keystone.y); kd.width = kd.height = G().keySize; g.ghost.visible = false; g.keySeated = true; }, [], P(T.keyIn))
      .to(kd, { alpha: 1, duration: 0.3 }, P(T.keyIn));
    T.digits.forEach((t, i) => { tl.to({ v: 0 }, { v: 1, duration: 0.3, onUpdate(this: gsap.core.Tween) { g.setDigit(i, (this.targets()[0] as { v: number }).v); } }, P(t)); at('bell1948', t, { level: i + 1 }); });
    // seal: no seam; the leaves crossfade to the open pose over 1,0 s; light → .5; bloom → 1.15; glow floor ≤ .3
    tl.call(() => { seal(); A.fadeOut('gateDrone', 1.2); A.setMusicFilter(20000, 1.0); A.duck(0, 1.0); }, [], P(T.seal))
      .to(g, { leafFade: 0, duration: 0.5 }, P(T.seal))
      .call(() => { g.openT = 1; }, [], P(T.seal + 0.5))
      .to(g, { leafFade: 1, duration: 0.5 }, P(T.seal + 0.5))
      .to(g, { lightLevel: 0.5, warm: 0.6, duration: 1.0 }, P(T.seal))
      .to(w.bloom, { strength: 1.15, duration: 1.0 }, P(T.seal))
      .to(w.sky, { skyGlowFloor: 0.3, duration: 1.0 }, P(T.seal))
      .call(() => { g.title.visible = g.concept.visible = true; g.title.reveal = 1; g.title.sweep = -0.2; g.title.alpha = 0; g.concept.alpha = 0; }, [], P(T.name))
      .to(g.title, { alpha: 0.9, duration: 0.6 }, P(T.name))
      .to(g.concept, { alpha: 1, duration: 0.6 }, P(T.name))
      .to(g.eyebrow, { alpha: 0, duration: 0.6 }, P(T.name));
    at('gateDrone', 0); at('tileShimmer', 1.0); at('dieBirth', T.key, { gain: 0.5 }); at('keystone', T.seat);
    at('sealCrack', T.seal); at('lightPad', T.seal); at('gateBreath', T.seal + 0.2);
    for (let k = 0; k < 4; k++) at('bell1948', T.name + k * b, { level: 5 + k, gain: 0.4 });
    tl.call(() => finish(false), [], P(T.end));
  } else {
    // BAR 1 · "Stilheden": the eyebrow, the music heard through stone, the drone; the gate holds its breath
    tl.to(g.eyebrow, { alpha: 1, duration: 0.6 }, P(0))
      .call(() => { A.setMusicFilter(900, 2.0); A.duck(-6, 2.0); }, [], P(0))
      .to(g, { twinkleAmp: 0, duration: 2.0, ease: 'sine.inOut' }, P(0.6))
      .to(w.camera, { zoom: 1.06, duration: 2 * B, ease: 'sine.inOut' }, P(0));
    at('gateDrone', 0);
    // BAR 2 · "De 1948 lys": a shimmer climbs the leaves; the NORDLYS lantern wakes (the five dark niches stay dark)
    tl.call(() => g.shimmer(), [], P(GATE_T.shimmer))
      .to(g, { lantern: 0.65, groove: 0.9, duration: 0.8 }, P(GATE_T.lantern));
    at('tileShimmer', GATE_T.shimmer);
    // BAR 3 · "Nøglen": NORDLYS brings the key along its groove to the keystone
    tl.call(() => { kd.visible = true; kd.alpha = 0; kd.rotation = 0; kd.tint = 0xe0e0e0; const p = g.pathAt(0); kd.position.set(p.x, p.y); kd.width = kd.height = 0.16 * G().W; }, [], P(GATE_T.key))
      .to(kd, { alpha: 1, duration: 0.4 }, P(GATE_T.key));
    const trip = { u: 0 };
    let lastGlint = -1, gi = 0;
    tl.to(trip, {
      u: 1, duration: 1.8, ease: 'sine.inOut',
      onUpdate: () => {
        const p = g.pathAt(trip.u), size = 0.16 * G().W + (G().keySize - 0.16 * G().W) * trip.u;
        kd.position.set(p.x, p.y);
        const base = size / Math.max(1, kd.texture.width);
        kd.scale.set(base * Math.max(0.08, Math.abs(Math.cos(Math.PI * trip.u))), base); // one fake-3D half-flip at the midpoint
        const k = Math.floor(trip.u * 16.4);
        if (k > lastGlint && gi < 16) { lastGlint = k; gi++; w.particles.emit('glint', p.x, p.y, 1, { color: gi % 2 ? PAL.teal : PAL.violet, speed: 18, life: 0.5, size: Math.min(0.6, Math.max(0.3, size / 110)) }); }
      },
    }, P(GATE_T.travel));
    tl.call(() => { g.ghost.visible = false; g.keySeated = true; kd.position.set(G().keystone.x, G().keystone.y); w.haptic(25); }, [], P(GATE_T.seat))
      .fromTo(kd, { width: G().keySize * 1.08, height: G().keySize * 1.08 }, { width: G().keySize, height: G().keySize, duration: 0.2, ease: 'back.out(2)', immediateRender: false }, P(GATE_T.seat))
      .to(w.camera, { zoom: 1.075, duration: 0.12, ease: 'power2.out' }, P(GATE_T.seat))
      .to(w.camera, { zoom: 1.065, duration: 0.18, ease: 'power2.inOut' }, P(GATE_T.seat + 0.12));
    at('dieBirth', GATE_T.key, { gain: 0.5 });
    at('keystone', GATE_T.seat);
    // BAR 4 · "Årstallet": one digit per beat, 1-9-4-8 = root, 9th, 4th, octave; each sends a resonance wave
    GATE_T.digits.forEach((t, i) => {
      tl.to({ v: 0 }, { v: 1, duration: 0.3, onUpdate(this: gsap.core.Tween) { g.setDigit(i, (this.targets()[0] as { v: number }).v); } }, P(t))
        .call(() => { if (w.allowFlash()) g.wave(); }, [], P(t));
      at('bell1948', t, { level: i + 1 });
    });
    // BAR 5 · "Seglet brister": the seam, the seal (REAL writes here), the leaves swing open, the light pours out
    tl.call(() => {
      seal();
      A.fadeOut('gateDrone', 1.2); // the drone crossfades into the light pad
      A.setMusicFilter(20000, 2.3); A.duck(0, 2.3); // the player's own music swells back
      w.haptic([20, 40, 20]);
      if (w.allowFlash()) { g.seamA = 1; gsap.fromTo(g, { seamT: 0 }, { seamT: 1, duration: 0.45, ease: 'power2.out' }); }
    }, [], P(GATE_T.seal))
      .to(g, { seamA: 0, duration: 1.0 }, P(GATE_T.seal + 0.5))
      .to(g, { openT: 1, duration: 2.3, ease: 'power2.inOut' }, P(GATE_T.swing))
      .to(g, { lightLevel: 0.8, duration: 2.3, ease: 'power1.in' }, P(GATE_T.swing))
      .to(g, { warm: 1, duration: 2.3, ease: 'power1.inOut' }, P(GATE_T.swing))
      .to(w.bloom, { strength: 1.35, duration: 2.3, ease: 'power1.inOut' }, P(GATE_T.swing))
      .to(w.sky, { skyGlowFloor: 0.6, duration: 2.3, ease: 'power1.in' }, P(GATE_T.swing));
    for (let k = 0; k < 8; k++) {
      tl.call(() => {
        const x = G().cx + (crand() - 0.5) * 0.62 * G().W, y = G().lintelY + 0.06 * G().W;
        w.particles.emit('snow', x, y, 5, { color: 0xeaf8ff, speed: 30, angle: Math.PI / 2, spread: 1.2, gravity: 40, life: 1.4 });
        w.particles.emit('dust', x, y, 3, { color: PAL.frost, speed: 20, angle: Math.PI / 2, spread: 1.6, life: 1.6 });
      }, [], P(GATE_T.swing + k * 0.15));
    }
    at('sealCrack', GATE_T.seal); at('lightPad', GATE_T.seal); at('gateBreath', GATE_T.swing);
    // BAR 6 · "Automat 1948": the name rises inside the light WITH its concept label; the motif echoes an octave up
    tl.call(() => {
      g.title.visible = g.concept.visible = true;
      g.title.alpha = 0.9; g.title.reveal = 0; g.title.sweep = -0.2; g.concept.alpha = 0;
    }, [], P(GATE_T.name))
      .to(g.title, { reveal: 1, duration: 1.2, ease: 'power2.inOut' }, P(GATE_T.name))
      .to(g.title, { sweep: 1.2, duration: 1.2, ease: 'power1.inOut' }, P(GATE_T.name))
      .fromTo(g.title, { y: G().oy + 0.3 * G().H + 10 }, { y: G().oy + 0.3 * G().H, duration: 1.2, ease: 'power2.out', immediateRender: false }, P(GATE_T.name))
      .to(g.concept, { alpha: 1, duration: 0.4 }, P(GATE_T.name))
      .to(g.eyebrow, { alpha: 0, duration: 0.6 }, P(GATE_T.name));
    for (let k = 0; k < 4; k++) at('bell1948', GATE_T.name + k * b, { level: 5 + k, gain: 0.4 });
    tl.call(() => finish(false), [], P(GATE_T.end));
  }

  /** End (or skip): the explicit end state, the 3 s settle (light .6, glow floor → 0, bloom → 1), the audio anchor
   *  released and the drone/pad faded over 4 s (on a skip the Game fades them in 0,3 s). */
  function finish(skipped: boolean): void {
    if (finished) return;
    finished = true;
    tl.kill();
    releaseAudioAnchor();
    const light = g.lightLevel, warm = g.warm;
    g.setOpenPose(true); // leaves open, key seated, digits lit, the name and its label shown
    if (!skipped) { g.lightLevel = light; g.warm = warm; }
    g.eyebrow.alpha = 0;
    g.twinkleAmp = 1;
    g.seamA = 0;
    const settle = skipped ? 1 : 3;
    gsap.to(g, { lightLevel: 0.6, warm: 0.5, lantern: 0.3, groove: 0.5, duration: settle, ease: 'sine.inOut' });
    gsap.to(w.sky, { skyGlowFloor: 0, duration: settle, ease: 'sine.inOut' });
    gsap.to(w.bloom, { strength: 1, duration: settle, ease: 'sine.inOut' });
    gsap.to(w.camera, { zoom: 1.03, duration: settle, ease: 'sine.inOut' });
    if (!skipped) { A.fadeOut('gateDrone', 4); A.fadeOut('lightPad', 4); }
    resolveDone();
  }

  anchorToAudio(() => A.now(), () => A.latency());
  tl.play(0);
  return {
    done,
    canSkip: () => !finished && tl.time() >= lead + 2.0,
    at: () => (finished ? (calm ? CALM_T.end : GATE_T.end) : tl.time() - lead),
    skip: () => { if (!finished && tl.time() >= lead + 2.0) finish(true); },
  };
}
