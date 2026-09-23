// Terningen · the award in Pixi: a DieAward container in stage.layers.banners, kept ABOVE the Celebration, with the
// DOM flight hand-off (in the same frame the Pixi die hides and a DPR canvas appears at its bounds; stage px = CSS px
// through autoDensity and #stagehost at inset 0). Everything runs on the game clock (deterministic under advance()).
// No w.flash(), no exposure: the glint, halo and chip ring are local (< 1 % of the screen); magenta only on small
// sprites, storm dice are quenched to white. Presenters stay silent: the Game plays every award sound.
import { gsap } from 'gsap';
import { Container, Sprite } from 'pixi.js';
import { IsText } from '../render/modules.ts';
import { softDot, softBand } from '../render/tex.ts';
import { dieTexture } from '../render/art/dieImage.ts';
import { PAL } from '../core/palette.ts';
import { paintDie } from '../ui/diceIcon.ts';
import { awardCaption, DEMO_CAPTION, heldOverflow } from '../ui/diceCopy.ts';
import type { Hud } from '../ui/hud.ts';
import type { World } from '../game/world.ts';

export interface AwardHost {
  hud: Hud;
  w: World;
  calm(): boolean;
  land(add: number, fromHeld: boolean): void;
}
export interface Pt { x: number; y: number }

const clamp = (a: number, v: number, b: number) => Math.max(a, Math.min(b, v));
const desk = () => innerWidth >= 1000 && innerWidth / innerHeight >= 1.25;
const TRAIL = [PAL.teal, PAL.violet, PAL.magenta];
const SPRITE_TINT = 0xe0e0e0; // the baked neon must not over-bloom
const AMBER = 0xffb547;

/** One Pixi die: sprite, halo (softDot, additive), a glint (softBand, additive) masked by a second die sprite, and an
 *  optional caption. State in `st` (rot in turns); apply() writes it (fake 3D: scale.x × (0.55 + 0.45·|cos φ|)). */
class DieUnit extends Container {
  readonly sp = new Sprite(dieTexture());
  readonly halo = new Sprite(softDot());
  private glint: Sprite | null = null;
  private maskSp: Sprite | null = null;
  cap: IsText | null = null;
  size: number;
  st = { sc: 1, rot: 0, halo: 0, cap: 0, glint: -1 };
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
    if (o.glint) {
      this.maskSp = new Sprite(this.sp.texture);
      this.maskSp.anchor.set(0.5);
      this.glint = new Sprite(softBand());
      this.glint.anchor.set(0.5);
      this.glint.blendMode = 'add';
      this.glint.alpha = 0.35;
      this.glint.rotation = -Math.PI / 4;
      this.glint.width = size * 0.34;
      this.glint.height = size * 1.8;
      this.glint.mask = this.maskSp;
      this.glint.visible = false;
      this.addChild(this.maskSp, this.glint);
    }
    if (o.caption) {
      this.cap = new IsText({ text: o.caption, size: o.capSize ?? 10, style: o.muted ? 'muted' : 'ice', tracking: 0.2, decor: false });
      this.cap.position.set(0, size * 0.62 + (o.capSize ?? 10));
      this.addChild(this.cap);
    }
    this.apply();
  }
  apply = (): void => {
    const s = this.st, k = this.size / Math.max(1, this.sp.texture.width), phi = s.rot * Math.PI * 2;
    this.sp.rotation = phi;
    this.sp.scale.set(k * s.sc * (0.55 + 0.45 * Math.abs(Math.cos(phi))), k * s.sc);
    this.halo.alpha = s.halo;
    this.halo.width = this.halo.height = this.size * 1.7 * s.sc;
    if (this.cap) this.cap.alpha = s.cap;
    if (this.glint && this.maskSp) {
      this.maskSp.rotation = this.sp.rotation;
      this.maskSp.scale.copyFrom(this.sp.scale);
      this.glint.visible = s.glint >= 0 && s.glint <= 1;
      const d = (s.glint - 0.5) * this.size * 1.3; // top-left → bottom-right
      this.glint.position.set(d, d);
    }
  };
  /** Size on screen (px), for the DOM hand-off. */
  shown(): number { return this.size * this.st.sc; }
  kill(): void { gsap.killTweensOf([this.st, this]); if (!this.destroyed) this.destroy({ children: true }); }
}

/** A DOM die canvas in #overlays (pointer-events none), drawn at DPR by the registered die painter. */
class DomFlyer {
  el = document.createElement('canvas');
  s = { x: 0, y: 0, size: 60, a: 1, rot: 0 };
  private px = 0;
  constructor(host: HTMLElement, bright = false) {
    this.el.className = 'die-fly';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:4;will-change:transform,opacity' + (bright ? ';filter:brightness(1.35) drop-shadow(0 0 6px rgba(138,92,255,.8))' : '');
    host.appendChild(this.el);
  }
  apply = (): void => {
    const s = this.s, px = Math.max(2, Math.round(s.size));
    if (px !== this.px) { this.px = px; paintDie(this.el, px, { state: 'die' }); }
    this.el.style.width = this.el.style.height = px + 'px';
    this.el.style.transform = `translate(${s.x - px / 2}px, ${s.y - px / 2}px) rotate(${s.rot}turn)`;
    this.el.style.opacity = String(s.a);
  };
  remove(): void { gsap.killTweensOf(this.s); this.el.remove(); }
}

export class DieAward extends Container {
  private h: AwardHost;
  private overlays: HTMLElement;
  private cur: { n: number; die: DieUnit | null; fast: boolean; fly: gsap.core.Tween | null; flying: boolean; go: (() => void) | null } | null = null;
  private heldDice: DieUnit[] = [];
  private more: IsText | null = null;
  private moreN = 0;
  private moving = 0;
  private dim = new Sprite(softDot());

  constructor(h: AwardHost) {
    super();
    this.label = 'dieAward';
    this.h = h;
    this.overlays = document.getElementById('overlays')!;
    this.dim.anchor.set(0.5);
    this.dim.tint = 0x02040c;
    this.dim.alpha = 0;
    this.addChild(this.dim);
  }
  /** Keep the award above the Celebration (added to banners after it). */
  private front(): void { this.h.w.stage.layers.banners.addChild(this); }
  inFlight(): boolean { return !!this.cur || this.moving > 0; }
  held(): number { return this.heldDice.length + this.moreN; }
  /** QA: 'born' (Pixi die on screen), 'flight' (DOM flight), 'none'. */
  phase(): string { return !this.cur ? 'none' : this.cur.flying ? 'flight' : this.cur.die ? 'born' : 'none'; }

  // ---------------------------------------------------------------- base / Ladet spin
  /** Birth at the celebration's beat: under the counting amount; tumble, halo, glint, caption (calm: a fade). */
  birth(n: number, o: { instant: boolean; tier: number }): void {
    this.front();
    const w = this.h.w, W = w.stage.w, s = Math.min(W, 700), calm = this.h.calm();
    const amountSize = Math.max(28, s * (o.tier >= 4 ? 0.12 : 0.1));
    const size = clamp(56, 0.16 * s, 104);
    const d = new DieUnit(size, { caption: awardCaption(n), capSize: Math.max(10, 0.024 * s), glint: !calm && !o.instant });
    d.position.set(W / 2, w.gridCenterY() + amountSize * 0.2 + amountSize * 0.55 + size * 0.6);
    this.addChild(d);
    this.cur?.die?.kill();
    this.cur = { n, die: d, fast: o.instant, fly: null, flying: false, go: null };
    if (o.instant) { Object.assign(d.st, { sc: 1, rot: 0, halo: calm ? 0 : 0.35, cap: 0.85 }); d.apply(); return; }
    if (calm) {
      d.alpha = 0; Object.assign(d.st, { sc: 1, rot: 0, halo: 0, cap: 0.85 }); d.apply();
      gsap.to(d, { alpha: 1, duration: 0.3 });
      return;
    }
    d.alpha = 0; Object.assign(d.st, { sc: 0.25, rot: -1.2, halo: 0, cap: 0 }); d.apply();
    this.tumble(d).to(d.st, { cap: 0.85, duration: 0.25, onUpdate: d.apply }, 0.45); // caption at birth + 0,45 s
    this.sparkle(d.x, d.y, 8);
  }
  /** Scale .25 → 1 (520 ms, back.out 1.6) with −1,2 turn → the native ¾ pose; halo → .35 (400 ms); the glint sweeps
   *  top-left → bottom-right at +0,35 s in 300 ms (a specular on a small object: never exposure, never w.flash()). */
  private tumble(d: DieUnit): gsap.core.Timeline {
    return gsap.timeline()
      .to(d, { alpha: 1, duration: 0.16 }, 0)
      .to(d.st, { sc: 1, rot: 0, duration: 0.52, ease: 'back.out(1.6)', onUpdate: d.apply }, 0)
      .to(d.st, { halo: 0.35, duration: 0.4, onUpdate: d.apply }, 0)
      .call(() => { d.st.glint = 0; }, [], 0.35)
      .to(d.st, { glint: 1, duration: 0.3, ease: 'power1.inOut', onUpdate: d.apply }, 0.35)
      .call(() => { d.st.glint = -1; d.apply(); }, [], 0.66);
  }
  private sparkle(x: number, y: number, n: number): void {
    const p = this.h.w.particles;
    for (let i = 0; i < n; i++) p.emit('glint', x, y, 1, { color: TRAIL[i % 3], speed: 160, life: 0.5, size: 0.5 }); // size is × the kind's 34 px
  }

  /** Tap/Esc: the flight starts at once and lasts 300 ms (done ≤ skip + 300 ms + 1 frame). */
  skip(): void {
    const a = this.cur;
    if (!a) return;
    a.fast = true;
    a.go?.(); // a flight waiting for its beat starts at once
    const tw = a.fly;
    if (tw && tw.isActive()) { const left = tw.duration() - tw.time(); if (left > 0.3) tw.timeScale(left / 0.3); }
  }

  /** After the celebration: the flight to hud.diceTarget(); resolves after host.land(1, false). */
  fly(): Promise<void> {
    const a = this.cur;
    if (!a || !a.die) { this.cur = null; this.h.land(1, false); return Promise.resolve(); }
    const d = a.die, calm = this.h.calm();
    return new Promise<void>((res) => {
      const done = () => { this.cur = null; this.h.land(1, false); res(); };
      if (calm) {
        // calm: the die fades out in place (250 ms) while the chip crossfades its number
        a.fly = gsap.to(d, { alpha: 0, duration: a.fast ? 0.2 : 0.25, onComplete: () => { d.kill(); done(); } });
        return;
      }
      // R+2,70 close → R+2,75 the flight (the caption fades meanwhile); after a skip it starts at once, 300 ms
      const wait = a.fast ? null : gsap.delayedCall(0.05, () => a.go?.());
      a.go = () => {
        a.go = null;
        wait?.kill();
        a.flying = true;
        a.fly = this.flight(d, { dur: a.fast ? 0.3 : 0.6, spin: 1.25, onDone: done });
      };
      if (!wait) a.go();
    });
  }

  /** The DOM flight: hand-off from a Pixi die (hidden in the same frame), a lob on a quadratic Bézier (control = the
   *  midpoint lifted by 18 % of the distance) to hud.diceTarget(), re-measured every frame; size → chip icon, +spin
   *  turns landing at 0; an aurora trail (a Pixi glint every 40 ms, teal → violet → magenta; off on quality 2 / calm). */
  private flight(d: DieUnit | Pt & { size: number }, o: { dur: number; spin: number; bright?: boolean; onDone: () => void; dissolve?: boolean }): gsap.core.Tween {
    const from = d instanceof DieUnit ? { x: d.x, y: d.y, size: d.shown() } : { x: d.x, y: d.y, size: d.size };
    if (d instanceof DieUnit) {
      // the caption stays behind and fades (150 ms) while the die leaves
      const cap = d.cap;
      if (cap && cap.alpha > 0.01) {
        d.removeChild(cap);
        cap.position.set(d.x + cap.x, d.y + cap.y);
        this.addChild(cap);
        gsap.to(cap, { alpha: 0, duration: 0.15, onComplete: () => cap.destroy() });
      }
      d.kill();
    }
    const f = new DomFlyer(this.overlays, o.bright);
    Object.assign(f.s, { x: from.x, y: from.y, size: from.size, rot: o.spin, a: 1 });
    f.apply();
    const trail = !this.h.calm() && this.h.w.quality < 2;
    const p = { t: 0 };
    let lastTrail = -1, k = 0;
    this.moving++;
    return gsap.to(p, {
      t: 1, duration: o.dur, ease: 'power2.inOut',
      onUpdate: () => {
        const to = this.h.hud.diceTarget(), t = p.t, u = 1 - t;
        const dist = Math.hypot(to.x - from.x, to.y - from.y), mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2 - dist * 0.18;
        f.s.x = u * u * from.x + 2 * u * t * mx + t * t * to.x;
        f.s.y = u * u * from.y + 2 * u * t * my + t * t * to.y;
        f.s.size = from.size + (to.size - from.size) * t;
        f.s.rot = o.spin * (1 - t);
        f.apply();
        const now = gsap.globalTimeline.time();
        if (trail && t < 0.97 && (lastTrail < 0 || now - lastTrail >= 0.04)) {
          lastTrail = now;
          this.h.w.particles.emit('glint', f.s.x, f.s.y, 1, { color: TRAIL[k++ % 3], speed: 12, life: 0.45, size: clamp(0.25, f.s.size / 110, 0.5) });
        }
      },
      onComplete: () => {
        this.moving--;
        if (!o.dissolve) { f.remove(); o.onDone(); return; }
        // the demo die dissolves at the chip (scale 1 → .6, α → 0, 400 ms); the number never changes
        o.onDone();
        gsap.to(f.s, { size: f.s.size * 0.6, a: 0, duration: 0.4, onUpdate: f.apply, onComplete: () => f.remove() });
      },
    });
  }

  // ---------------------------------------------------------------- storm
  private slotPos(k: number): Pt {
    const r = this.h.w.gridRect;
    return { x: r.x + r.size - 12 - k * 16, y: r.y - 9 };
  }
  private heldSize = () => (desk() ? 20 : 14);

  /** S+0: pop at the cluster (scale 0 → 1, 220 ms), quench 0xff6a00 → white in 300 ms, a white-hot halo, 6 embers;
   *  S+300 → S+750: shrink and zip to held slot k on the molten frame's top edge. Resolves when it sits. */
  stormPop(at: Pt, slot: number): Promise<void> {
    this.front();
    const w = this.h.w, calm = this.h.calm();
    const d = new DieUnit(clamp(40, (w.gridRect.size / 8) * 1.1, 72), { halo: PAL.whiteHot });
    d.position.set(at.x, at.y);
    this.addChild(d);
    this.moving++;
    const to = this.slotPos(Math.min(slot, 8)), small = this.heldSize() / d.size;
    return new Promise<void>((res) => {
      const sit = () => { this.moving--; this.hold(d, slot); res(); };
      if (calm) {
        // calm: a 200 ms fade-in at the cluster, then a crossfade (200 out, 200 in) to the slot after 400 ms
        d.alpha = 0; d.apply();
        gsap.timeline({ onComplete: sit })
          .to(d, { alpha: 1, duration: 0.2 }, 0)
          .to(d, { alpha: 0, duration: 0.2 }, 0.4)
          .call(() => { d.position.set(to.x, to.y); d.st.sc = small; d.apply(); }, [], 0.6)
          .to(d, { alpha: 1, duration: 0.2 }, 0.6);
        return;
      }
      Object.assign(d.st, { sc: 0, halo: 0.3 }); d.sp.tint = PAL.molten; d.apply();
      const q = { t: 0 };
      w.particles.emit('ember', at.x, at.y, 3, { color: AMBER, speed: 120, life: 0.6 });
      w.particles.emit('ember', at.x, at.y, 3, { color: PAL.whiteHot, speed: 120, life: 0.6 });
      gsap.timeline({ onComplete: sit })
        .to(d.st, { sc: 1, duration: 0.22, ease: 'back.out(2)', onUpdate: d.apply }, 0)
        .to(q, { t: 1, duration: 0.3, onUpdate: () => { d.sp.tint = mixHex(PAL.molten, SPRITE_TINT, q.t); } }, 0)
        .to(d.st, { halo: 0, duration: 0.3, onUpdate: d.apply }, 0.3)
        .to(d, { x: to.x, y: to.y, duration: 0.45, ease: 'power2.in' }, 0.3)
        .to(d.st, { sc: small, duration: 0.45, ease: 'power2.in', onUpdate: d.apply }, 0.3);
    });
  }
  /** Slots 0–7 hold dice; slot 8 shows "+m" for the rest. */
  private hold(d: DieUnit, slot: number): void {
    if (slot < 8) { this.heldDice.push(d); return; }
    d.kill();
    this.moreN++;
    if (!this.more) {
      this.more = new IsText({ text: heldOverflow(1), size: 9, style: 'ice', decor: false });
      const p = this.slotPos(8);
      this.more.position.set(p.x, p.y);
      this.addChild(this.more);
    }
    this.more.text = heldOverflow(this.moreN);
  }

  /** Demo storm spin that would have qualified: a labelled ghost at the cluster; dissolves in place after 600 ms. */
  stormGhost(at: Pt): Promise<void> {
    this.front();
    const w = this.h.w;
    const d = new DieUnit(clamp(40, (w.gridRect.size / 8) * 1.1, 72), { caption: DEMO_CAPTION, muted: true, capSize: 10 });
    d.position.set(at.x, at.y);
    d.alpha = 0;
    Object.assign(d.st, { sc: 1, cap: 1 }); d.apply();
    this.addChild(d);
    gsap.timeline({ onComplete: () => d.kill() }).to(d, { alpha: 0.6, duration: 0.22 }, 0).to(d, { alpha: 0, duration: 0.4 }, 0.6);
    return new Promise<void>((r) => gsap.delayedCall(0.6, r));
  }

  /** Rebuild the held row (resume after a reload). */
  restoreHeld(k: number): void {
    this.clearHeld();
    this.front();
    for (let i = 0; i < k; i++) {
      const d = new DieUnit(20);
      const p = this.slotPos(Math.min(i, 8));
      d.position.set(p.x, p.y);
      d.st.sc = this.heldSize() / 20; d.apply();
      this.addChild(d);
      this.hold(d, i);
    }
  }
  clearHeld(): void {
    for (const d of this.heldDice) d.kill();
    this.heldDice = [];
    this.more?.destroy();
    this.more = null;
    this.moreN = 0;
  }

  /** Storm outro: at +1,2 s (the crimson has cleared) the held dice rise one by one, 220 ms apart, each a 700 ms DOM
   *  flight; after 4 flights the rest merge into one brighter die that rolls the remainder. All ends ≤ 2,6 s.
   *  Calm: they fade out together at +1,2 s (300 ms) and the chip crossfades to the total at +1,6 s. */
  releaseHeld(k: number): Promise<void> {
    const dice = this.heldDice.slice(), more = this.moreN;
    this.heldDice = [];
    this.more?.destroy(); this.more = null; this.moreN = 0;
    const total = Math.max(k, dice.length + more);
    if (total <= 0) return Promise.resolve();
    this.moving++;
    const calm = this.h.calm();
    return new Promise<void>((res) => {
      const finish = () => { this.moving--; res(); };
      if (calm) {
        const tl = gsap.timeline({ onComplete: finish });
        for (const d of dice) tl.to(d, { alpha: 0, duration: 0.3, onComplete: () => d.kill() }, 1.2);
        tl.call(() => this.h.land(total, true), [], 1.6);
        return;
      }
      const tl = gsap.timeline();
      const flights = Math.min(4, total);
      let left = flights;
      for (let f = 0; f < flights; f++) {
        const add = f === flights - 1 ? total - (flights - 1) : 1;
        const at = 1.2 + f * 0.22;
        for (const extra of f === flights - 1 ? dice.slice(flights) : []) tl.to(extra, { alpha: 0, duration: 0.2, onComplete: () => extra.kill() }, at);
        tl.call(() => {
          const src = dice[f] ?? { ...this.slotPos(0), size: this.heldSize() };
          this.flight(src, { dur: 0.7, spin: 0.5, bright: add > 1, onDone: () => { this.h.land(add, true); if (--left === 0) finish(); } });
        }, [], at);
      }
    });
  }

  // ---------------------------------------------------------------- demo award ("Vis en terning")
  /** Award-only: a soft local dim, the die born at the grid centre (same size, tumble, glint), "DEMO · TÆLLER IKKE",
   *  hold 1,3 s, the 600 ms flight; at the chip it dissolves and the amber "+1 demo" tag shows. Never counts. */
  demo(): Promise<void> {
    this.front();
    const w = this.h.w, W = w.stage.w, s = Math.min(W, 700), calm = this.h.calm();
    const size = clamp(56, 0.16 * s, 104);
    const r = w.gridRect;
    this.dim.position.set(r.x + r.size / 2, r.y + r.size / 2);
    this.dim.width = this.dim.height = r.size * 1.5;
    gsap.to(this.dim, { alpha: 0.35, duration: 0.3 });
    const d = new DieUnit(size, { caption: DEMO_CAPTION, capSize: Math.max(10, 0.024 * s), glint: !calm });
    d.position.set(W / 2, w.gridCenterY());
    this.addChild(d);
    this.moving++;
    return new Promise<void>((res) => {
      const tl = gsap.timeline();
      if (calm) {
        d.alpha = 0; Object.assign(d.st, { sc: 1, rot: 0, cap: 0.85 }); d.apply();
        tl.to(d, { alpha: 1, duration: 0.3 }, 0);
      } else {
        d.alpha = 0; Object.assign(d.st, { sc: 0.25, rot: -1.2, cap: 0 }); d.apply();
        tl.add(this.tumble(d), 0).to(d.st, { cap: 0.85, duration: 0.25, onUpdate: d.apply }, 0.45);
        this.sparkle(d.x, d.y, 8);
      }
      const go = 0.52 + 1.3;
      tl.to(d.st, { cap: 0, duration: 0.15, onUpdate: d.apply }, go);
      tl.to(this.dim, { alpha: 0, duration: 0.5 }, go);
      if (calm) {
        // calm: no flight — the die fades out in place (250 ms) and the tag shows at the chip
        tl.to(d, { alpha: 0, duration: 0.25, onComplete: () => d.kill() }, go)
          .call(() => { this.h.hud.demoDiceTag(); this.moving--; res(); }, [], go + 0.25);
        return;
      }
      tl.call(() => {
        this.flight(d, { dur: 0.6, spin: 1.25, dissolve: true, onDone: () => { this.h.hud.demoDiceTag(); gsap.delayedCall(0.4, () => { this.moving--; res(); }); } });
      }, [], go);
    });
  }
}

function mixHex(a: number, b: number, t: number): number {
  const c = (s: number) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
  return (c(16) << 16) | (c(8) << 8) | c(0);
}
