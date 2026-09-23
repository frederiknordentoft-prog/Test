// Terningen · presentation boundary. The Game commits every die BEFORE presentation and then only calls this
// interface; nothing here can change a count (the chip only moves through host.land()).
// DomDicePresenter is the minimal working default: DOM dice on the game clock (deterministic under advance()),
// a DOM stand-in for the gate and a timed ceremony skeleton on the spec's storyboard. The Pixi award (DieAward),
// GateView and the bar-anchored ceremony replace its internals behind the same interface.
import { gsap } from 'gsap';
import type { Hud } from '../ui/hud.ts';
import type { World } from '../game/world.ts';
import type { DiceView } from '../game/dice.ts';
import { paintDie } from '../ui/diceIcon.ts';
import { awardCaption, DEMO_CAPTION, heldOverflow, ceremonyEyebrow, type CeremonyKind, type RibbonKind } from '../ui/diceCopy.ts';
import { wait } from './clock.ts';

export interface DiceHost {
  hud: Hud;
  w: World;
  calm(): boolean;
  /** A die (or a merged bunch of released storm dice) touches the chip: the Game rolls shownDice by `add`
   *  (fromHeld: released storm dice) and calls hud.landDice. The ONLY way the chip number moves. */
  land(add: number, fromHeld: boolean): void;
  haptic(p: number | number[]): void;
}
export interface Pt { x: number; y: number }
export interface ChamberOpts { ribbon: { kind: RibbonKind; text: string } | null; realN: number }
export interface CeremonyHandle { done: Promise<void>; canSkip(): boolean; skip(): void }

export interface DicePresenter {
  /** Base / Ladet spin, from Celebration's birth beat (dieBirthAt). instant = a skip before the beat (no tumble, no glint). */
  awardBirth(n: number, o: { instant: boolean; tier: number }): void;
  /** After the celebration closed: the flight to hud.diceTarget(); resolves after host.land(1, false). */
  awardFly(): Promise<void>;
  /** Tap/Esc: the flight starts at once / finishes within 300 ms (contract: done ≤ skip + 300 ms + 1 frame). */
  awardSkip(): void;
  /** Real storm die: pop at the winning cluster, then hold it in slot `slot` on the frame. Resolves when it sits (≈ 0,75 s). */
  stormPop(n: number, at: Pt, slot: number): Promise<void>;
  /** Demo storm spin that would have qualified: a labelled ghost pop that dissolves in place; nothing is held. */
  stormGhost(at: Pt): Promise<void>;
  /** Rebuild the held row (resume after a reload). */
  restoreHeld(k: number): void;
  /** Storm outro: release the held dice to the chip (host.land(…, true) per landing). Ends ≤ 2,6 s into the outro. */
  releaseHeld(k: number): Promise<void>;
  clearHeld(): void;
  /** Drawer "Vis en terning": award-only demo die; dissolves at the chip with the "+1 demo" tag. */
  demoAward(): Promise<void>;
  /** Anything of the award still in motion (never true when the next spin may start). */
  inFlight(): boolean;
  held(): number;
  openChamber(view: DiceView, o: ChamberOpts): Promise<void>;
  setChamberView(view: DiceView, o: ChamberOpts): void;
  closeChamber(): Promise<void>;
  chamberOpen(): boolean;
  /** The gate ceremony over the open chamber. onSeal fires at the seal-break beat (the Game writes only for 'real'). */
  ceremony(kind: CeremonyKind, o: { n: number; onSeal(): void }): CeremonyHandle;
  /** Demo exit: the leaves close again (reverse 1,2 s; calm 0,5 s). */
  closeGate(): Promise<void>;
  /** A Terningen card entered the DOM (medallion paint; glint in the art module). */
  cardShown(kind: 'hello' | 'firstDie' | 'unlock' | 'placard', el: HTMLElement): void;
}

// ------------------------------------------------------------------------------------------------
const clamp = (a: number, v: number, b: number) => Math.max(a, Math.min(b, v));
const desk = () => innerWidth >= 1000 && innerWidth / innerHeight >= 1.25;

/** One DOM die: canvas + optional caption, absolutely positioned in #overlays at stage px. */
class DomDie {
  el = document.createElement('div');
  cv = document.createElement('canvas');
  cap: HTMLElement | null = null;
  s = { x: 0, y: 0, size: 60, a: 0, rot: 0, sc: 1, capA: 0 };
  constructor(host: HTMLElement, size: number, caption?: string, cls = '') {
    this.el.className = 'die-fly ' + cls;
    this.el.setAttribute('aria-hidden', 'true');
    this.el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:4;will-change:transform,opacity';
    this.cv.style.cssText = 'display:block';
    this.el.appendChild(this.cv);
    if (caption) {
      this.cap = document.createElement('span');
      this.cap.textContent = caption;
      this.cap.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;font:700 11px/1 system-ui,sans-serif;letter-spacing:.2em;color:#eaf8ff;text-shadow:0 1px 8px rgba(5,11,26,.9)';
      this.el.appendChild(this.cap);
    }
    this.s.size = size;
    paintDie(this.cv, Math.round(size), { state: 'die' });
    host.appendChild(this.el);
    this.apply();
  }
  apply = (): void => {
    const s = this.s, px = Math.max(1, s.size * s.sc);
    this.cv.style.width = this.cv.style.height = px + 'px';
    this.el.style.transform = `translate(${s.x - px / 2}px, ${s.y - px / 2}px) rotate(${s.rot}turn)`;
    this.el.style.opacity = String(s.a);
    if (this.cap) { this.cap.style.top = px * 1.12 + 'px'; this.cap.style.opacity = String(s.capA); }
  };
  remove(): void { gsap.killTweensOf(this.s); this.el.remove(); }
}

export class DomDicePresenter implements DicePresenter {
  private h: DiceHost;
  private layer: HTMLElement;
  private award: { n: number; die: DomDie | null; fast: boolean; fly: gsap.core.Tween | null } | null = null;
  private heldDice: DomDie[] = [];
  private heldMore: HTMLElement | null = null;
  private moving = 0;
  private chamberShown = false;

  constructor(h: DiceHost) {
    this.h = h;
    this.layer = document.getElementById('overlays')!;
  }
  inFlight(): boolean { return !!this.award || this.moving > 0; }
  held(): number { return this.heldDice.length + (this.heldMore ? Number(this.heldMore.dataset.m) : 0); }

  // ---------------------------------------------------------------- base / Ladet spin
  awardBirth(n: number, o: { instant: boolean; tier: number }): void {
    const w = this.h.w, W = w.stage.w, s = Math.min(W, 700);
    const amountSize = Math.max(28, s * (o.tier >= 4 ? 0.12 : 0.1));
    const size = clamp(56, 0.16 * s, 104);
    const d = new DomDie(this.layer, size, awardCaption(n));
    d.s.x = W / 2;
    d.s.y = w.gridCenterY() + amountSize * 0.2 + amountSize * 0.55 + size * 0.6;
    this.award = { n, die: d, fast: o.instant, fly: null };
    const calm = this.h.calm();
    if (o.instant || calm) {
      Object.assign(d.s, { a: calm && !o.instant ? 0 : 1, sc: 1, rot: 0, capA: o.instant ? 0.85 : 0 });
      d.apply();
      if (calm && !o.instant) gsap.to(d.s, { a: 1, capA: 0.85, duration: 0.3, onUpdate: d.apply });
    } else {
      Object.assign(d.s, { a: 0, sc: 0.25, rot: -1.2 });
      gsap.to(d.s, { sc: 1, rot: 0, duration: 0.52, ease: 'back.out(1.6)', onUpdate: d.apply });
      gsap.to(d.s, { a: 1, duration: 0.16, onUpdate: d.apply });
      gsap.to(d.s, { capA: 0.85, duration: 0.25, delay: 0.45, onUpdate: d.apply });
    }
    // sound: Game.dieBirth plays 'dieBirth' at birth + 50 ms (not on an instant birth); presenters stay silent
  }

  awardSkip(): void {
    const a = this.award;
    if (!a) return;
    a.fast = true;
    const tw = a.fly;
    if (tw && tw.isActive()) { const left = tw.duration() - tw.time(); if (left > 0.3) tw.timeScale(left / 0.3); }
  }

  awardFly(): Promise<void> {
    const a = this.award;
    if (!a || !a.die) { this.award = null; this.h.land(1, false); return Promise.resolve(); }
    const d = a.die, calm = this.h.calm();
    return new Promise<void>((res) => {
      const done = () => { d.remove(); this.award = null; this.h.land(1, false); res(); };
      if (calm) {
        // calm: the die fades out in place (250 ms); the chip crossfades its number
        a.fly = gsap.to(d.s, { a: 0, capA: 0, duration: 0.25, onUpdate: d.apply, onComplete: done });
        return;
      }
      gsap.to(d.s, { capA: 0, duration: 0.15, onUpdate: d.apply });
      const from = { x: d.s.x, y: d.s.y, size: d.s.size * d.s.sc };
      const p = { t: 0 };
      a.fly = gsap.to(p, {
        t: 1, duration: a.fast ? 0.3 : 0.6, ease: 'power2.inOut',
        onUpdate: () => {
          const to = this.h.hud.diceTarget(); // re-measured every frame: a resize mid-flight is safe
          const mx = (from.x + to.x) / 2, dist = Math.hypot(to.x - from.x, to.y - from.y), my = (from.y + to.y) / 2 - dist * 0.18;
          const t = p.t, u = 1 - t;
          d.s.x = u * u * from.x + 2 * u * t * mx + t * t * to.x;
          d.s.y = u * u * from.y + 2 * u * t * my + t * t * to.y;
          d.s.sc = (from.size + (to.size - from.size) * t) / d.s.size;
          d.s.rot = 1.25 * (1 - t);
          d.apply();
          // TODO(visuals): aurora trail (a Pixi glint every 40 ms, teal → violet → magenta; off on quality 2 / calm)
        },
        onComplete: done,
      });
    });
  }

  // ---------------------------------------------------------------- storm
  private slotPos(k: number): Pt {
    const r = this.h.w.gridRect;
    return { x: r.x + r.size - 12 - k * 16, y: r.y - 9 };
  }
  private heldSize = () => (desk() ? 20 : 14);

  stormPop(n: number, at: Pt, slot: number): Promise<void> {
    void n;
    const w = this.h.w, cell = w.gridRect.size / 8, calm = this.h.calm();
    const d = new DomDie(this.layer, clamp(40, cell * 1.1, 72));
    Object.assign(d.s, { x: at.x, y: at.y, a: calm ? 0 : 1, sc: calm ? 1 : 0 });
    d.apply();
    this.moving++;
    // sound: Game plays 'dieQuench' when it calls stormPop and 'dieHold' (constant pitch) when this promise resolves
    return new Promise<void>((res) => {
      const sit = () => { this.moving--; this.hold(d, slot); res(); };
      const to = this.slotPos(Math.min(slot, 8));
      const small = this.heldSize() / d.s.size;
      if (calm) {
        const tl = gsap.timeline({ onComplete: sit });
        tl.to(d.s, { a: 1, duration: 0.2, onUpdate: d.apply }, 0)
          .to(d.s, { a: 0, duration: 0.2, onUpdate: d.apply }, 0.4)
          .set(d.s, { x: to.x, y: to.y, sc: small, onUpdate: d.apply }, 0.6)
          .to(d.s, { a: 1, duration: 0.2, onUpdate: d.apply }, 0.6);
        return;
      }
      const tl = gsap.timeline({ onComplete: sit });
      tl.to(d.s, { sc: 1, duration: 0.22, ease: 'back.out(2)', onUpdate: d.apply }, 0)
        .to(d.s, { x: to.x, y: to.y, sc: small, duration: 0.45, ease: 'power2.in', onUpdate: d.apply }, 0.3);
    });
  }
  /** Slots 0–7 hold dice; slot 8 shows "+m" for the rest. */
  private hold(d: DomDie, slot: number): void {
    if (slot < 8) { this.heldDice.push(d); return; }
    d.remove();
    if (!this.heldMore) {
      const t = document.createElement('span');
      t.className = 'die-held-more';
      t.setAttribute('aria-hidden', 'true');
      const p = this.slotPos(8);
      t.style.cssText = `position:absolute;left:${p.x - 10}px;top:${p.y - 7}px;z-index:4;font:700 11px/14px system-ui,sans-serif;color:#cdb8ff;pointer-events:none`;
      t.dataset.m = '0';
      this.layer.appendChild(t);
      this.heldMore = t;
    }
    const m = Number(this.heldMore.dataset.m) + 1;
    this.heldMore.dataset.m = String(m);
    this.heldMore.textContent = heldOverflow(m);
  }

  stormGhost(at: Pt): Promise<void> {
    const w = this.h.w, cell = w.gridRect.size / 8;
    const d = new DomDie(this.layer, clamp(40, cell * 1.1, 72), DEMO_CAPTION, 'ghost');
    if (d.cap) { d.cap.style.color = '#7f93b2'; d.cap.style.fontSize = '10px'; }
    Object.assign(d.s, { x: at.x, y: at.y, a: 0, sc: 1, capA: 0 });
    d.apply();
    gsap.timeline({ onComplete: () => d.remove() })
      .to(d.s, { a: 0.6, capA: 1, duration: 0.22, onUpdate: d.apply }, 0)
      .to(d.s, { a: 0, capA: 0, duration: 0.4, onUpdate: d.apply }, 0.6);
    return wait(0.6);
  }

  restoreHeld(k: number): void {
    this.clearHeld();
    for (let i = 0; i < k; i++) {
      if (i >= 8) { this.hold(new DomDie(this.layer, 20), i); continue; }
      const d = new DomDie(this.layer, 20);
      const p = this.slotPos(i);
      Object.assign(d.s, { x: p.x, y: p.y, a: 1, sc: this.heldSize() / 20 });
      d.apply();
      this.heldDice.push(d);
    }
  }

  clearHeld(): void {
    for (const d of this.heldDice) d.remove();
    this.heldDice = [];
    this.heldMore?.remove();
    this.heldMore = null;
  }

  releaseHeld(k: number): Promise<void> {
    const dice = this.heldDice.slice();
    const more = this.heldMore ? Number(this.heldMore.dataset.m) : 0;
    this.heldDice = [];
    this.heldMore?.remove();
    this.heldMore = null;
    const total = Math.max(k, dice.length + more);
    if (total <= 0) return Promise.resolve();
    this.moving++;
    const calm = this.h.calm();
    return new Promise<void>((res) => {
      const finish = () => { this.moving--; res(); };
      if (calm) {
        // calm: the held dice fade out together at +1,2 s; the chip crossfades to the total at +1,6 s
        const tl = gsap.timeline({ onComplete: finish });
        for (const d of dice) tl.to(d.s, { a: 0, duration: 0.3, onUpdate: d.apply, onComplete: () => d.remove() }, 1.2);
        tl.call(() => this.h.land(total, true), [], 1.6);
        return;
      }
      // at +1,2 s (the crimson has cleared) the dice rise one by one, 220 ms apart, each a 700 ms flight;
      // at most 4 flights — the last one carries the remainder (a brighter merged die) so all ends ≤ 2,6 s
      const flights = Math.min(4, total);
      const tl = gsap.timeline({ onComplete: finish });
      for (let f = 0; f < flights; f++) {
        const add = f === flights - 1 ? total - (flights - 1) : 1;
        const d = dice[f] ?? new DomDie(this.layer, 20);
        for (const extra of f === flights - 1 ? dice.slice(flights) : []) tl.to(extra.s, { a: 0, duration: 0.2, onUpdate: extra.apply, onComplete: () => extra.remove() }, 1.2 + f * 0.22);
        if (!dice[f]) { const p = this.slotPos(0); Object.assign(d.s, { x: p.x, y: p.y, a: 1, sc: this.heldSize() / 20 }); d.apply(); }
        if (add > 1) d.el.style.filter = 'brightness(1.35) drop-shadow(0 0 6px rgba(138,92,255,.8))';
        const from = { x: d.s.x, y: d.s.y, sc: d.s.sc };
        const p = { t: 0 };
        tl.to(p, {
          t: 1, duration: 0.7, ease: 'power2.inOut',
          onUpdate: () => {
            const to = this.h.hud.diceTarget(), t = p.t, u = 1 - t;
            const dist = Math.hypot(to.x - from.x, to.y - from.y), mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2 - dist * 0.18;
            d.s.x = u * u * from.x + 2 * u * t * mx + t * t * to.x;
            d.s.y = u * u * from.y + 2 * u * t * my + t * t * to.y;
            d.s.sc = from.sc + ((to.size / d.s.size) - from.sc) * t;
            d.apply();
          },
          onComplete: () => { d.remove(); this.h.land(add, true); }, // host.land plays 'dieLand' (−3 dB for held dice)
        }, 1.2 + f * 0.22);
      }
    });
  }

  // ---------------------------------------------------------------- demo award
  demoAward(): Promise<void> {
    const w = this.h.w, W = w.stage.w, s = Math.min(W, 700), calm = this.h.calm();
    const size = clamp(56, 0.16 * s, 104);
    const d = new DomDie(this.layer, size, DEMO_CAPTION);
    Object.assign(d.s, { x: W / 2, y: w.gridCenterY(), a: 0, sc: calm ? 1 : 0.25, rot: calm ? 0 : -1.2 });
    d.apply();
    this.moving++;
    // TODO(visuals): soft local dim (softDot vignette, α .35) over the grid (Game plays 'dieBirth' when it calls demoAward)
    return new Promise<void>((res) => {
      const tl = gsap.timeline({ onComplete: () => { d.remove(); this.moving--; res(); } });
      if (calm) tl.to(d.s, { a: 1, capA: 0.85, duration: 0.3, onUpdate: d.apply }, 0);
      else tl.to(d.s, { sc: 1, rot: 0, duration: 0.52, ease: 'back.out(1.6)', onUpdate: d.apply }, 0)
        .to(d.s, { a: 1, duration: 0.16, onUpdate: d.apply }, 0)
        .to(d.s, { capA: 0.85, duration: 0.25, onUpdate: d.apply }, 0.45);
      const from = { x: d.s.x, y: d.s.y };
      const p = { t: 0 };
      tl.to(d.s, { capA: 0, duration: 0.15, onUpdate: d.apply }, 1.3 + 0.52);
      tl.to(p, {
        t: 1, duration: 0.6, ease: 'power2.inOut',
        onUpdate: () => {
          const to = this.h.hud.diceTarget(), t = p.t, u = 1 - t;
          const dist = Math.hypot(to.x - from.x, to.y - from.y), mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2 - dist * 0.18;
          d.s.x = u * u * from.x + 2 * u * t * mx + t * t * to.x;
          d.s.y = u * u * from.y + 2 * u * t * my + t * t * to.y;
          d.s.sc = 1 + (to.size / size - 1) * t;
          d.apply();
        },
      }, 1.3 + 0.52);
      // at the chip it dissolves (scale 1 → .6, α → 0, 400 ms); the number never changes
      tl.call(() => this.h.hud.demoDiceTag(), [], 2.42);
      tl.to(d.s, { sc: `*=0.6`, a: 0, duration: 0.4, onUpdate: d.apply }, 2.42);
    });
  }

  // ---------------------------------------------------------------- chamber (DOM + a DOM stand-in for GateView)
  chamberOpen(): boolean { return this.chamberShown; }
  async openChamber(view: DiceView, o: ChamberOpts): Promise<void> {
    const hud = this.h.hud, w = this.h.w;
    hud.chamber.render(view, o.realN, o.ribbon);
    hud.chamber.show(true);
    hud.chamber.place();
    this.chamberShown = true;
    // TODO(visuals): 900 ms open — machine layers fade (w.setMachineAlpha), camera 1.00 → 1.03, GateView α/y in
    w.hideForShatter(true);
    w.logo.visible = false;
    await wait(this.h.calm() ? 0.4 : 0.9);
  }
  setChamberView(view: DiceView, o: ChamberOpts): void {
    this.h.hud.chamber.render(view, o.realN, o.ribbon);
    this.h.hud.chamber.place();
  }
  async closeChamber(): Promise<void> {
    const hud = this.h.hud, w = this.h.w;
    await wait(this.h.calm() ? 0.25 : 0.5);
    hud.chamber.show(false);
    this.chamberShown = false;
    w.hideForShatter(false);
    w.placeLogo();
  }

  // ---------------------------------------------------------------- ceremony skeleton (spec storyboard times)
  ceremony(kind: CeremonyKind, o: { n: number; onSeal(): void }): CeremonyHandle {
    const calm = this.h.calm();
    const stub = this.h.hud.chamber.gateSlot().querySelector('.gate-stub') as HTMLElement | null;
    const eb = document.createElement('span');
    eb.className = 'g-eb';
    eb.textContent = ceremonyEyebrow(kind, o.n);
    eb.style.cssText = 'font-size:11px;letter-spacing:.3em;color:#7f93b2;opacity:0;transition:opacity .6s';
    stub?.prepend(eb);
    // TODO(visuals+audio): T0 = the next base-bed bar line ≥ now + 0,9 s (audio.grid()), anchorToAudio and the bar-anchored
    // SFX / filter / duck schedule (Game has already raced audio.prepareGate() against 2 s and does the skip audio + releaseGate)
    const B = 2.817, T0 = 0.9;
    const at = calm ? { seal: 5.6, name: 6.8, end: 8.0 } : { seal: T0 + 4 * B, name: T0 + 5 * B, end: T0 + 6 * B };
    let sealed = false;
    const setOpen = () => { this.h.hud.chamber.el.dataset.state = 'open'; };
    let resolve!: () => void;
    const done = new Promise<void>((r) => { resolve = r; });
    const t0 = { v: 0 };
    const tl = gsap.timeline({ onComplete: () => { eb.remove(); resolve(); } });
    tl.to(t0, { v: 1, duration: at.end }, 0)
      .call(() => { eb.style.opacity = '1'; }, [], calm ? 0 : T0)
      .call(() => { sealed = true; o.onSeal(); setOpen(); }, [], at.seal)
      .call(() => { eb.style.opacity = '0'; }, [], at.name);
    const startAt = gsap.globalTimeline.time();
    return {
      done,
      canSkip: () => gsap.globalTimeline.time() - startAt >= (calm ? 0 : T0) + 2.0,
      skip: () => {
        if (!tl.isActive()) return;
        tl.progress(1, true);
        if (!sealed) { sealed = true; setOpen(); }
        eb.remove();
        resolve();
      },
    };
  }
  closeGate(): Promise<void> { return wait(this.h.calm() ? 0.5 : 1.2); }

  cardShown(kind: 'hello' | 'firstDie' | 'unlock' | 'placard', el: HTMLElement): void {
    const c = el.querySelector('canvas.medal') as HTMLCanvasElement | null;
    if (c) paintDie(c, kind === 'hello' ? 44 : 88, { state: 'die' });
    // TODO(visuals): one slow glint (glintOnce) 600 ms after the card lands / 500 ms after the hello entry; none in calm
  }
}
