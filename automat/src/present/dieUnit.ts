// Terningen · one Pixi die: the artwork sprite, an additive halo, an optional specular glint (a softBand masked by a
// second die sprite), an optional caption and, for a Kvit eller dobbelt loss, a frost + crack overlay. State in `st`
// (rot, flipX, flipY in turns); apply() writes it. Fake 3D: the in-plane turn φ squashes x by 0.55 + 0.45·|cos φ|
// (the birth tumble), and the throw's two extra flip axes squash x and y on their own phases.
import { gsap } from 'gsap';
import { Container, Sprite } from 'pixi.js';
import { IsText } from '../render/modules.ts';
import { softDot, softBand } from '../render/tex.ts';
import { dieTexture } from '../render/art/dieImage.ts';
import { frozenDieTex, crackTex } from '../render/fx/dieFx.ts';
import { PAL } from '../core/palette.ts';

export const SPRITE_TINT = 0xe0e0e0; // the baked neon must not over-bloom

export class DieUnit extends Container {
  readonly sp = new Sprite(dieTexture());
  readonly halo = new Sprite(softDot());
  private glint: Sprite | null = null;
  private maskSp: Sprite | null = null;
  private frost: Sprite | null = null;
  private crack: Sprite | null = null;
  cap: IsText | null = null;
  size: number;
  st = { sc: 1, rot: 0, halo: 0, cap: 0, glint: -1, flipX: 0, flipY: 0, frost: 0, crack: 0 };
  /** The birth tumble: killed with the unit (its .call steps target the callback, not st, so killTweensOf misses them). */
  tl: gsap.core.Timeline | null = null;
  constructor(size: number, o: { caption?: string; muted?: boolean; capSize?: number; halo?: number; glint?: boolean } = {}) {
    super();
    this.size = size;
    this.sp.anchor.set(0.5);
    this.sp.tint = SPRITE_TINT;
    this.halo.anchor.set(0.5);
    this.halo.blendMode = 'add';
    this.halo.tint = o.halo ?? PAL.violet;
    this.halo.width = this.halo.height = size * 1.7;
    this.addChild(this.halo, this.sp);
    if (o.glint) this.enableGlint();
    if (o.caption) {
      this.cap = new IsText({ text: o.caption, size: o.capSize ?? 10, style: o.muted ? 'muted' : 'ice', tracking: 0.2, decor: false });
      this.cap.position.set(0, size * 0.62 + (o.capSize ?? 10));
      this.addChild(this.cap);
    }
    this.apply();
  }
  /** The specular sweep (created on demand: a die born instantly has none until the big moment asks for it). */
  enableGlint(): void {
    if (this.glint || this.destroyed) return;
    this.maskSp = new Sprite(this.sp.texture);
    this.maskSp.anchor.set(0.5);
    this.glint = new Sprite(softBand());
    this.glint.anchor.set(0.5);
    this.glint.blendMode = 'add';
    this.glint.alpha = 0.35;
    this.glint.rotation = -Math.PI / 4;
    this.glint.mask = this.maskSp;
    this.glint.visible = false;
    this.addChildAt(this.maskSp, this.getChildIndex(this.sp) + 1);
    this.addChildAt(this.glint, this.getChildIndex(this.maskSp) + 1);
    this.apply();
  }
  /** The loss: frost (the frozen, desaturated artwork) and crack lines over the die, driven by st.frost / st.crack. */
  enableFrost(): void {
    if (this.frost || this.destroyed) return;
    const tex = this.sp.texture;
    this.frost = new Sprite(frozenDieTex(tex));
    this.frost.anchor.set(0.5);
    this.frost.alpha = 0;
    this.crack = new Sprite(crackTex(tex));
    this.crack.anchor.set(0.5);
    this.crack.alpha = 0;
    this.crack.tint = PAL.ice;
    const at = this.getChildIndex(this.sp) + 1;
    this.addChildAt(this.frost, at);
    this.addChildAt(this.crack, at + 1);
    this.apply();
  }
  apply = (): void => {
    if (this.destroyed) return;
    const s = this.st, k = this.size / Math.max(1, this.sp.texture.width), phi = s.rot * Math.PI * 2;
    const fx = s.flipX ? 0.62 + 0.38 * Math.abs(Math.cos(s.flipX * Math.PI * 2)) : 1;
    const fy = s.flipY ? 0.74 + 0.26 * Math.abs(Math.cos(s.flipY * Math.PI * 2)) : 1;
    this.sp.rotation = phi;
    this.sp.scale.set(k * s.sc * (0.55 + 0.45 * Math.abs(Math.cos(phi))) * fx, k * s.sc * fy);
    this.halo.alpha = s.halo;
    this.halo.width = this.halo.height = this.size * 1.7 * s.sc;
    if (this.cap) this.cap.alpha = s.cap;
    if (this.glint && this.maskSp) {
      this.maskSp.rotation = this.sp.rotation;
      this.maskSp.scale.copyFrom(this.sp.scale);
      this.glint.visible = s.glint >= 0 && s.glint <= 1;
      const g = this.size * s.sc;
      this.glint.width = g * 0.34;
      this.glint.height = g * 1.8;
      const d = (s.glint - 0.5) * g * 1.3; // top-left → bottom-right
      this.glint.position.set(d, d);
    }
    if (this.frost && this.crack) {
      for (const o of [this.frost, this.crack]) {
        o.rotation = this.sp.rotation;
        const kk = (this.size * s.sc) / Math.max(1, o.texture.width);
        o.scale.set(kk * (this.sp.scale.x / Math.max(1e-6, k * s.sc)), kk * (this.sp.scale.y / Math.max(1e-6, k * s.sc)));
      }
      this.frost.alpha = s.frost;
      this.crack.alpha = s.crack;
      this.sp.alpha = 1 - 0.65 * s.frost;
    }
  };
  /** One specular sweep (top-left → bottom-right, `dur` s); needs enableGlint(). */
  sweep(dur = 0.45): void {
    if (!this.glint || this.destroyed) return;
    gsap.killTweensOf(this.st, 'glint');
    this.st.glint = 0;
    gsap.to(this.st, { glint: 1, duration: dur, ease: 'power1.inOut', onUpdate: this.apply, onComplete: () => { this.st.glint = -1; this.apply(); } });
  }
  /** Size on screen (px), for the DOM hand-off. */
  shown(): number { return this.size * this.st.sc; }
  kill(): void { this.tl?.kill(); this.tl = null; gsap.killTweensOf([this.st, this, this.scale]); if (!this.destroyed) this.destroy({ children: true }); }
}
