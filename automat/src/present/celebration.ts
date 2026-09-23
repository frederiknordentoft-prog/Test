// Big-win celebration (only when T > stake — the WIN profile). Skippable after 1 s; ≥100× needs "Fortsæt".
import { Container, Sprite, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { IsText, type Particles } from '../render/modules.ts';
import { softDot } from '../render/tex.ts';
import { fmtKr } from '../core/format.ts';
import { PAL } from '../core/palette.ts';
import { crand } from '../core/cosmeticRng.ts';
import { TIER_NAMES, TIER_SECS, dieBirthAt, celebrateEndWithDie } from './schedule.ts';
import type { GameAudio } from '../audio/audio.ts';

export class Celebration extends Container {
  private dim = new Graphics();
  private rays = new Container();
  private halo = new Sprite(softDot());
  private title: IsText;
  private amount: IsText;
  private tl: gsap.core.Timeline | null = null;
  private resolve: (() => void) | null = null;
  private startedAt = 0;
  private needsContinue = false;
  private w = 0; private cy = 0;
  private demoTag: IsText | null = null;
  private amountSize = 30;
  /** Terningen: the die's birth hook (called once — at dieBirthAt, or instantly on a skip before it). */
  private die: { onBirth(instant: boolean): void } | null = null;
  private born = false;
  active = false;

  constructor() {
    super();
    this.visible = false;
    this.halo.anchor.set(0.5); this.halo.blendMode = 'add';
    this.rays.blendMode = 'add';
    this.title = new IsText({ text: 'STOR GEVINST', size: 40, style: 'gold' });
    this.amount = new IsText({ text: '0,00 KR', size: 30, style: 'gold' });
    this.addChild(this.dim, this.rays, this.halo, this.title, this.amount);
    for (let i = 0; i < 14; i++) {
      const r = new Graphics();
      r.poly([0, 0, -18, -900, 18, -900]).fill({ color: 0xffffff, alpha: 0.06 });
      r.rotation = (i / 14) * Math.PI * 2;
      this.rays.addChild(r);
    }
  }

  layout(w: number, h: number, cy: number): void {
    this.w = w; this.cy = cy; void h;
    this.dim.clear().rect(0, 0, w, h).fill({ color: 0x02040c, alpha: 0.55 });
    const s = Math.min(w, 700);
    this.title.position.set(w / 2, cy - this.amountSize * 0.95);
    this.amount.position.set(w / 2, cy + this.amountSize * 0.2);
    this.demoTag?.position.set(w / 2, cy + this.amountSize * 1.15);
    this.rays.position.set(w / 2, cy);
    this.halo.position.set(w / 2, cy);
    this.halo.width = this.halo.height = s * 1.3;
  }

  /** Returns a promise that resolves when the celebration ends (auto, skip or continue). */
  play(tier: number, totalOre: number, stakeOre: number, o: { audio: GameAudio; particles: Particles; storm: boolean; calm: boolean; demo?: boolean; onNeedsContinue: (b: boolean) => void; onCount?: (ore: number) => void; die?: { onBirth(instant: boolean): void } }): Promise<void> {
    this.kill();
    this.die = o.die ?? null;
    this.born = false;
    const s = Math.min(this.w, 700);
    // The amount is the hero; the tier name is the eyebrow.
    const titleSize = Math.max(18, s * (tier >= 4 ? 0.065 : 0.055));
    const amountSize = Math.max(28, s * (tier >= 4 ? 0.12 : 0.1));
    this.amountSize = amountSize;
    this.title.destroy(); this.amount.destroy(); this.demoTag?.destroy(); this.demoTag = null;
    this.title = new IsText({ text: TIER_NAMES[tier], size: titleSize, style: o.storm ? 'molten' : 'gold', tracking: 0.12 });
    this.amount = new IsText({ text: '0,00 KR', size: amountSize, style: o.storm ? 'molten' : 'gold' });
    this.addChild(this.title, this.amount);
    this.title.position.set(this.w / 2, this.cy - amountSize * 0.95);
    this.amount.position.set(this.w / 2, this.cy + amountSize * 0.2);
    if (o.demo) {
      this.demoTag = new IsText({ text: 'DEMO · KREDITERES IKKE', size: Math.max(10, s * 0.024), style: 'muted', tracking: 0.2 });
      this.demoTag.position.set(this.w / 2, this.cy + amountSize * 1.15);
      this.addChild(this.demoTag);
    }
    this.visible = true;
    this.active = true;
    this.alpha = 1;
    this.halo.tint = o.storm ? PAL.molten : PAL.gold;
    // ≥100× needs an explicit "Fortsæt" — except in a storm, whose summary card already asks for it.
    this.needsContinue = tier >= 4 && !o.storm;
    this.startedAt = performance.now();
    const dur = TIER_SECS[tier];
    const counter = { v: 0 };
    o.audio.play(tier >= 3 ? 'bigWin' : 'win', { level: tier });
    const cx = this.w / 2, cy = this.title.y;
    this.tl = gsap.timeline();
    this.tl.fromTo(this.dim, { alpha: 0 }, { alpha: 1, duration: 0.3 }, 0)
      .fromTo(this.halo, { alpha: 0 }, { alpha: 0.35, duration: 0.4 }, 0)
      .fromTo(this.rays, { alpha: 0 }, { alpha: o.calm ? 0.4 : 1, duration: 0.5 }, 0)
      .to(this.rays, { rotation: Math.PI * 0.35, duration: dur + 2, ease: 'none' }, 0)
      .fromTo(this.title, { alpha: 0 }, { alpha: 1, duration: 0.2 }, 0.05)
      .fromTo(this.title.scale, { x: 2.4, y: 2.4 }, { x: 1, y: 1, duration: 0.55, ease: 'back.out(2.2)' }, 0.05)
      .fromTo(this.amount, { alpha: 0 }, { alpha: 1, duration: 0.2 }, 0.3)
      .to(counter, {
        v: totalOre, duration: Math.max(0.6, dur - 0.4), ease: tier >= 3 ? 'expo.out' : 'power2.out',
        onUpdate: () => { this.amount.text = fmtKr(Math.round(counter.v)).toUpperCase(); o.onCount?.(counter.v); },
      }, 0.3)
      .call(() => { o.audio.play('countTick'); }, [], 0.3);
    this.title.reveal = 1;
    let bursts = 0;
    const burst = () => {
      if (!this.active || o.calm) return;
      o.particles.emit('glint', cx + (crand() - 0.5) * s * 0.5, cy, 18, { color: o.storm ? PAL.molten : PAL.gold, speed: 380, spread: Math.PI * 2, life: 1.1 });
      o.particles.emit('ember', cx, cy + s * 0.1, 10, { color: o.storm ? PAL.crimson : PAL.gold, speed: 300, spread: 1.4, angle: -Math.PI / 2, life: 1.4, gravity: 300 });
      if (++bursts < 3 + tier * 2) gsap.delayedCall(0.35, burst);
    };
    burst();
    // A die is born after the count-up and the close moves out to leave room for it (schedule() is untouched).
    const birth = dieBirthAt(tier);
    if (this.die) this.tl.call(() => this.birth(false), [], birth);
    return new Promise<void>((resolve) => {
      this.resolve = resolve;
      if (this.needsContinue) {
        this.tl!.call(() => o.onNeedsContinue(true), [], this.die ? Math.max(dur - 0.5, birth + 0.9) : Math.max(1, dur - 0.5));
      } else {
        this.tl!.call(() => this.finish(), [], this.die ? celebrateEndWithDie(tier) : dur + 0.6);
      }
      void stakeOre;
    });
  }

  private birth(instant: boolean): void {
    if (!this.die || this.born) return;
    this.born = true;
    this.die.onBirth(instant);
  }

  /** Tap/Esc: skip after 1 s (jump the count-up to the end, then close). A die not born yet appears instantly. */
  skip(): boolean {
    if (!this.active || performance.now() - this.startedAt < 1000) return false;
    this.birth(true);
    if (this.needsContinue) { this.tl?.progress(1); return false; }
    this.finish();
    return true;
  }

  continue(): void { if (this.active) this.finish(); }

  private finish(): void {
    if (!this.active) return;
    this.birth(true); // "Fortsæt" before the birth beat: the die still exists before its flight
    this.active = false;
    this.tl?.kill();
    gsap.to(this, { alpha: 0, duration: 0.3, ease: 'sine.inOut', onComplete: () => { this.visible = false; } }); // a gentle ramp (no steep first frame)
    const r = this.resolve; this.resolve = null; r?.();
  }

  private kill(): void { this.tl?.kill(); this.tl = null; }
}
