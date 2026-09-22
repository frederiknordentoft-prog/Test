// "Stormen rammer" — the 7.2 s Solstorm cinematic. Audio-clock slaved; hit-stops are fx-only.
import { gsap } from 'gsap';
import type { Container } from 'pixi.js';
import { anchorToAudio, releaseAudioAnchor, hitStop } from '../clock.ts';
import { crand } from '../../core/cosmeticRng.ts';
import { PAL } from '../../core/palette.ts';
import { IsText, type ScreenShatter, type Particles, type UberPost } from '../../render/modules.ts';
import type { GameAudio, Sfx } from '../../audio/audio.ts';

export interface CineWorld {
  audio: GameAudio;
  uber: UberPost;
  bloom: { strength: number };
  camera: { zoom: number; trauma: number };
  sky: { kp: number; storm: number; cme: number; sun: number; glow: number };
  arcKp: (kp: number) => void;
  scene: Container;                 // captured + hidden for the shatter
  hideForShatter: (b: boolean) => void; // hide everything in scene except the sky
  capture: () => import('pixi.js').Texture;
  shatter: ScreenShatter;
  particles: Particles;
  banners: Container;
  impactPoint: () => { x: number; y: number }; // grid centre (screen px)
  gridTop: () => number;            // y of the grid's top edge (screen px)
  titleBand: () => { top: number; height: number }; // free band above the grid (the Kp-arc slot, hidden in cine mode)
  screen: () => { w: number; h: number };
  buildStormStage: () => void;      // configure 8×8 storm grid + storm frame (hidden)
  revealFrame: (tl: gsap.core.Timeline, at: number) => void; // molten frame draw-in
  dropStormSymbols: (tl: gsap.core.Timeline, at: number) => void; // 64 obsidian symbols + 6 start marks
  onModeStorm: () => void;          // DOM badge etc.
  calm: boolean;
  haptic: (p: number | number[]) => void;
  flash: (amount: number, ms: number) => void; // FlashBudget-routed exposure flash
}

export interface CineHandle { done: Promise<void>; skip: () => void; canSkip: () => boolean }

let viewedOnce = false;

export function playSolstormIntro(w: CineWorld): CineHandle {
  const tl = gsap.timeline({ paused: true });
  const A = w.audio;
  const t0 = A.now() + 0.06;
  const at = (name: Sfx, t: number, o: { gain?: number; level?: number } = {}) => A.play(name, { ...o, when: t0 + t });
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  const startedWall = performance.now();
  let skipped = false;
  // Skippable from the 2nd viewing, after 1.5 s, and only before the reform (never seek backwards).
  const canSkip = () => !skipped && viewedOnce && performance.now() - startedWall > 1500 && tl.time() < 3.4;

  const { w: W, h: H } = w.screen();
  const logoSize = Math.max(30, Math.min(W, 720) * 0.1);
  const subSize = Math.max(12, Math.min(W, 720) * 0.032);
  const logo = new IsText({ text: 'SOLSTORM', size: logoSize, style: 'molten', tracking: 0.08 });
  const sub = new IsText({ text: 'G5 · EKSTREM', size: subSize, style: 'plasma', tracking: 0.3 });
  const kpTxt = new IsText({ text: 'KP 9', size: Math.max(28, Math.min(W, 720) * 0.09), style: 'plasma' });
  for (const t of [logo, sub, kpTxt]) { t.alpha = 0; w.banners.addChild(t); }
  // Title lives in the Kp-arc band (the DOM chip is hidden in cine mode), subtitle just under it.
  const band = w.titleBand();
  const logoY = band.top + Math.max(logoSize * 0.62, band.height * 0.42);
  logo.position.set(W / 2, logoY);
  sub.position.set(W / 2, Math.min(logoY + logoSize * 0.82 + subSize * 0.4, w.gridTop() - subSize * 0.9 - 10));
  kpTxt.position.set(W / 2, H * 0.42);

  const cleanup = () => {
    releaseAudioAnchor();
    w.uber.cinematic = false;
    w.uber.zoom = 0; w.uber.glitch = 0; w.uber.exposure = 0; w.uber.heat = 0;
    w.uber.rings.fill(0);
    w.sky.cme = 0;
    if (!kpTxt.destroyed) kpTxt.destroy();
    gsap.to([logo, sub], { alpha: 0, duration: 0.8, delay: 1.4, onComplete: () => { logo.destroy(); sub.destroy(); } });
  };

  if (w.calm) {
    // Calm variant: 2 s crossfade, no flash, no shake, no shards.
    tl.to(w.sky, { storm: 1, sun: 0.55, duration: 2, ease: 'sine.inOut' }, 0)
      .call(() => { at('stormSwell', 0, { gain: 0.5 }); w.arcKp(9); }, [], 0)
      .to(w.scene, { alpha: 0, duration: 0.8 }, 0)
      .call(() => { w.buildStormStage(); w.onModeStorm(); }, [], 0.8)
      .to(w.scene, { alpha: 1, duration: 0.8 }, 0.85)
      .call(() => { const sub2 = gsap.timeline(); w.revealFrame(sub2, 0); w.dropStormSymbols(sub2, 0.2); }, [], 0.9)
      .to([logo, sub], { alpha: 1, duration: 0.6 }, 1.2)
      .call(() => A.startStorm(t0 + 2.2), [], 2.0);
    tl.call(() => { cleanup(); viewedOnce = true; resolveDone(); }, [], 2.4);
    anchorToAudio(() => A.now(), () => A.latency());
    tl.play(0);
    return { done, skip: () => {}, canSkip: () => false };
  }

  // ---------------- 0.00 hit-stop ----------------
  tl.addLabel('start', 0)
    .call(() => {
      w.uber.cinematic = true;
      hitStop(180, false);
      A.duck(-40, 0.06);
      w.haptic(30);
    }, [], 0);
  at('stormSwell', 0);

  // ---------------- 0.18 – 1.20 Kp 9 → G5 · EKSTREM ----------------
  const needle = { k: w.sky.kp };
  tl.to(needle, { k: 9, duration: 0.5, ease: 'power3.out', onUpdate: () => w.arcKp(needle.k) }, 0.18)
    .to(w.sky, { kp: 9, duration: 1.0, ease: 'power2.in' }, 0.18)
    .to(w.sky, { storm: 0.35, duration: 0.9, ease: 'power2.in' }, 0.3)
    .to(w.camera, { zoom: 1.06, duration: 2.0, ease: 'power2.in' }, 0.18)
    .to(w.camera, { trauma: 0.45, duration: 1.8, ease: 'power1.in' }, 0.2)
    .fromTo(kpTxt, { alpha: 0 }, { alpha: 1, duration: 0.08 }, 0.2)
    .fromTo(kpTxt.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2)' }, 0.2);
  for (const [i, gt] of [0.3, 0.55, 0.8].entries()) {
    tl.call(() => { w.uber.glitch = 0.7; if (i === 2) kpTxt.text = 'G5 · EKSTREM'; else kpTxt.text = i === 0 ? 'KP 9' : 'G5'; }, [], gt)
      .call(() => { w.uber.glitch = 0; }, [], gt + 0.06);
  }
  tl.to(kpTxt, { alpha: 0, duration: 0.2 }, 1.12);

  // ---------------- 1.20 – 2.20 CME front ----------------
  tl.addLabel('cme', 1.2)
    .to(w.sky, { cme: 1, duration: 1.0, ease: 'power1.in' }, 1.2)
    .to(w.uber, { zoom: 0.3, duration: 1.0, ease: 'power2.in' }, 1.2)
    .to(w.uber, { ca: 8, duration: 1.0, ease: 'power2.in' }, 1.2)
    .to(w.bloom, { strength: 1.8, duration: 1.0 }, 1.2);
  at('stormRiser', 1.2);

  // ---------------- 2.20 IMPACT ----------------
  tl.addLabel('impact', 2.2)
    .call(() => {
      w.flash(0.6, 40); // kept below the WCAG general-flash margin (see scripts/luminance.mjs)
      hitStop(120, false);
      const p = w.impactPoint();
      const { w: sw, h: sh } = w.screen();
      w.uber.rings.set([p.x / sw, p.y / sh, 0.0, 1.0], 0);
      w.haptic([30, 40, 60]);
      // FRACTURE: capture the pre-post scene and hand it to the shatter.
      const tex = w.capture();
      w.shatter.start(tex, p, { cells: 48 });
      w.shatter.crackReveal = 0;
      w.hideForShatter(true);
      w.sky.cme = 0;
      w.sky.storm = 1;
      w.sky.kp = 9;
      w.uber.zoom = 0;
    }, [], 2.2)
    .to(w.shatter, { crackReveal: 1, duration: 0.25, ease: 'power2.out' }, 2.2)
    .to({ r: 0 }, { r: 1, duration: 0.9, ease: 'power2.out', onUpdate: function (this: gsap.core.Tween) { const r = (this.targets()[0] as { r: number }).r; w.uber.rings[2] = r * 1.2; w.uber.rings[3] = 1 - r; } }, 2.2)
    .to(w.uber, { ca: 2.5, duration: 1.2, ease: 'power2.out' }, 2.3)
    .to(w.camera, { trauma: 0.9, duration: 0.05 }, 2.2)
    .to(w.camera, { trauma: 0, duration: 1.1, ease: 'power2.out' }, 2.3);
  at('impact', 2.2); at('drop808', 2.2); at('glassXL', 2.24);

  // ---------------- 2.45 – 3.40 SHATTER → void + plasma sun ----------------
  tl.addLabel('shatter', 2.45)
    .call(() => { w.buildStormStage(); w.onModeStorm(); }, [], 2.5)
    .to(w.sky, { sun: 0.62, duration: 1.6, ease: 'power2.out' }, 2.45)
    .to(w.uber, { heat: 0.6, duration: 1.0 }, 2.6)
    .call(() => {
      const p = w.impactPoint();
      if (!w.calm) w.particles.emit('ember', p.x, p.y, 120, { color: PAL.molten, speed: 520, spread: Math.PI * 2, life: 1.6, gravity: 140 });
    }, [], 2.46);

  // ---------------- 3.40 – 4.60 REFORM + logo slam ----------------
  tl.addLabel('reform', 3.4)
    .call(() => w.hideForShatter(false), [], 3.4)
    .call(() => { const sub2 = gsap.timeline(); w.revealFrame(sub2, 0); }, [], 3.4);
  at('reform', 3.4);
  logo.alpha = 1;
  logo.letters.forEach((L: Container) => { L.alpha = 0; });
  logo.letters.forEach((L: Container, i: number) => {
    const t = 3.75 + i * 0.07;
    tl.set(L, { alpha: 1 }, t)
      .fromTo(L.scale, { x: 3, y: 3 }, { x: 1, y: 1, duration: 0.32, ease: 'back.out(2.2)' }, t)
      .call(() => { w.camera.trauma = Math.max(w.camera.trauma, 0.25); }, [], t + 0.05);
    at('letterSlam', t, { gain: 0.8 });
  });
  tl.fromTo(sub, { alpha: 0 }, { alpha: 1, duration: 0.4 }, 4.35)
    .fromTo(logo, { glow: 2 }, { glow: 1, duration: 1.2 }, 3.75);

  // ---------------- 4.60 – 5.60 symbols rain in + start marks ----------------
  tl.addLabel('symbols', 4.6)
    .call(() => { const sub2 = gsap.timeline(); w.dropStormSymbols(sub2, 0); }, [], 4.6)
    .to(w.uber, { heat: 0.25, duration: 1 }, 4.6);

  // ---------------- 5.60 downbeat ----------------
  tl.addLabel('beat', 5.6)
    .to(w.camera, { zoom: 1.0, duration: 0.7, ease: 'back.out(1.6)' }, 5.6)
    .to(w.bloom, { strength: 1.6, duration: 0.6 }, 5.6)
    .call(() => { w.camera.trauma = Math.max(w.camera.trauma, 0.3); w.haptic(40); }, [], 5.6);
  A.startStorm(t0 + 5.6);

  tl.call(() => { cleanup(); viewedOnce = true; resolveDone(); }, [], 6.2);

  anchorToAudio(() => A.now(), () => A.latency());
  tl.play(0);

  const skip = () => {
    if (!canSkip()) return;
    skipped = true;
    // Seek FIRST (suppressing callbacks), then applyState('reform') explicitly so no tween overwrites it.
    tl.seek('reform', true);
    w.shatter.stop();
    w.hideForShatter(false);
    w.buildStormStage();
    w.onModeStorm();
    w.sky.storm = 1; w.sky.cme = 0; w.sky.sun = 0.62; w.sky.kp = 9;
    w.uber.zoom = 0; w.uber.glitch = 0; w.uber.exposure = 0; w.uber.rings.fill(0);
    w.camera.trauma = 0;
    kpTxt.alpha = 0;
    // Audio was pre-scheduled on the original timeline: cancel it and re-schedule from the reform label.
    A.cancelScheduled();
    const t0s = A.now() + 0.03 - 3.4;
    A.play('reform', { when: t0s + 3.4 });
    logo.letters.forEach((_L: Container, i: number) => A.play('letterSlam', { when: t0s + 3.75 + i * 0.07, gain: 0.8 }));
    A.startStorm(t0s + 5.6);
  };
  void crand;
  return { done, skip, canSkip };
}
