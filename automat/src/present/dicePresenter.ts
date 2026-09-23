// Terningen · presentation boundary. The Game commits every die BEFORE presentation and then only calls this
// interface; nothing here can change a count (the chip only moves through host.land()).
// PixiDicePresenter: the award in Pixi (DieAward, with the DOM flight to the chip), the gate (GateView in the stage's
// 'chamber' layer) under the chamber DOM, and the bar-anchored ceremony (cinematics/gate.ts, which owns its sounds).
// Everything runs on the game clock (deterministic under advance()). The award sounds are the Game's.
import { gsap } from 'gsap';
import type { Hud } from '../ui/hud.ts';
import type { World } from '../game/world.ts';
import type { DiceView } from '../game/dice.ts';
import { paintDie } from '../ui/diceIcon.ts';
import { ceremonyEyebrow, gateState, type CeremonyKind, type RibbonKind } from '../ui/diceCopy.ts';
import { GateView } from '../render/chamber/GateView.ts';
import { glintOnce } from '../render/art/dieImage.ts';
import { DieAward } from './dieAward.ts';
import { playGateCeremony } from './cinematics/gate.ts';
import { clock } from './clock.ts';

export interface DiceHost {
  hud: Hud;
  w: World;
  calm(): boolean;
  /** A die (or a merged bunch of released storm dice) touches the chip: the Game rolls shownDice by `add`
   *  (fromHeld: released storm dice) and calls hud.landDice. The ONLY way the chip number moves. */
  land(add: number, fromHeld: boolean): void;
  haptic(p: number | number[]): void;
  /** The player's gate fill-order seed (a number, never the store). */
  seed(): number;
}
export interface Pt { x: number; y: number }
export interface ChamberOpts { ribbon: { kind: RibbonKind; text: string } | null; realN: number }
/** at(): QA only, seconds since T0 (the ceremony's first bar line; negative in the pre-roll). */
export interface CeremonyHandle { done: Promise<void>; canSkip(): boolean; skip(): void; at?(): number }

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
  /** QA: 'born' (the Pixi die is on screen), 'flight' (the DOM flight), 'none'. */
  phase(): string;
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
export class PixiDicePresenter implements DicePresenter {
  private h: DiceHost;
  private award: DieAward;
  private gate = new GateView();
  private chamberShown = false;
  private ceremonyOn = false;
  private rebuildTimer = 0;
  private machine = { a: 1 };
  private dom = { v: 1 };

  constructor(h: DiceHost) {
    this.h = h;
    this.award = new DieAward({ hud: h.hud, w: h.w, calm: () => h.calm(), land: (add, fromHeld) => h.land(add, fromHeld) });
    h.w.stage.layers.chamber.addChild(this.gate);
    // update() only while the gate is visible, on the game clock (in step with the audio-anchored ceremony)
    h.w.onFrame(() => { if (this.gate.visible) { this.gate.calm = h.calm(); this.gate.update(clock.dt, h.w.sky.envColors()[0]); } });
    // rebuild on resize while open (debounced 150 ms): the slot is measured like #slot-grid
    new ResizeObserver(() => {
      if (!this.chamberShown) return;
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = window.setTimeout(() => { if (this.chamberShown) this.buildGate(); }, 150);
    }).observe(h.hud.chamber.gateSlot());
  }
  inFlight(): boolean { return this.award.inFlight(); }
  held(): number { return this.award.held(); }
  phase(): string { return this.award.phase(); }

  // ---------------------------------------------------------------- award (DieAward)
  awardBirth(n: number, o: { instant: boolean; tier: number }): void { this.award.birth(n, o); }
  awardSkip(): void { this.award.skip(); }
  awardFly(): Promise<void> { return this.award.fly(); }
  stormPop(n: number, at: Pt, slot: number): Promise<void> { void n; return this.award.stormPop(at, slot); }
  stormGhost(at: Pt): Promise<void> { return this.award.stormGhost(at); }
  restoreHeld(k: number): void { this.award.restoreHeld(k); }
  releaseHeld(k: number): Promise<void> { return this.award.releaseHeld(k); }
  clearHeld(): void { this.award.clearHeld(); }
  demoAward(): Promise<void> { return this.award.demo(); }

  // ---------------------------------------------------------------- chamber
  chamberOpen(): boolean { return this.chamberShown; }
  private buildGate(): void {
    const hud = this.h.hud, w = this.h.w;
    const host = hud.root.getBoundingClientRect(), s = hud.chamber.gateSlot().getBoundingClientRect(), box = hud.chamber.el.getBoundingClientRect();
    // the slot as seen: clipped to the chamber box (landscape phones scroll the text column; the gate stays put)
    const top = Math.max(s.top, box.top), bottom = Math.min(s.bottom, box.bottom);
    if (s.width < 10 || bottom - top < 10) return;
    this.gate.build({ x: s.left - host.left, y: top - host.top, w: s.width, h: bottom - top }, { w: w.stage.w, h: w.stage.h, dpr: window.devicePixelRatio || 1 });
  }
  /** The chamber DOM fades in/out (the ribbon never: it is pinned from the first frame; in a ceremony the text stays
   *  hidden by :root.ceremony). */
  private domAlpha(v: number): void {
    this.dom.v = v;
    const cer = document.documentElement.classList.contains('ceremony');
    for (const c of Array.from(this.h.hud.chamber.el.children) as HTMLElement[]) {
      if (c.classList.contains('ch-ribbon')) continue;
      c.style.opacity = cer || v >= 1 ? '' : String(v);
    }
  }
  /** Open 900 ms: the machine fades (0–600 ms, then hidden), camera 1.00 → 1.03, the gate α 0 → 1 and y +24 → 0
   *  (200–900 ms), the DOM (400–900 ms). Calm: a 400 ms crossfade, no zoom, no move. Close 500 ms: the reverse. */
  private transition(open: boolean): Promise<void> {
    const w = this.h.w, g = this.gate, calm = this.h.calm();
    const logo = w.logo.visible; // the header logo fades with the machine (no one-frame pop: FlashBudget)
    const mach = () => { w.setMachineAlpha(this.machine.a); if (logo) w.logo.alpha = this.machine.a; };
    const dom = () => this.domAlpha(this.dom.v);
    return new Promise<void>((res) => {
      const tl = gsap.timeline({ onComplete: () => res() });
      if (open && calm) {
        g.alpha = 0; g.y = 0;
        tl.to(this.machine, { a: 0, duration: 0.4, ease: 'sine.inOut', onUpdate: mach }, 0).to(g, { alpha: 1, duration: 0.4, ease: 'sine.inOut' }, 0).to(this.dom, { v: 1, duration: 0.4, onUpdate: dom }, 0);
      } else if (open) {
        g.alpha = 0; g.y = 24;
        tl.to(this.machine, { a: 0, duration: 0.6, ease: 'sine.inOut', onUpdate: mach }, 0) // the bright machine gives way gently (no large one-frame steps)
          .to(w.cam, { zoom: 1.03, duration: 0.9, ease: 'power2.inOut' }, 0)
          .to(g, { alpha: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.2)
          .to(this.dom, { v: 1, duration: 0.5, onUpdate: dom }, 0.4);
      } else if (calm) {
        tl.to(this.dom, { v: 0, duration: 0.25, onUpdate: dom }, 0).to(g, { alpha: 0, duration: 0.25 }, 0).to(this.machine, { a: 1, duration: 0.25, onUpdate: mach }, 0);
      } else {
        tl.to(this.dom, { v: 0, duration: 0.25, onUpdate: dom }, 0)
          .to(g, { alpha: 0, y: 24, duration: 0.35, ease: 'power2.in' }, 0.05)
          .to(this.machine, { a: 1, duration: 0.4, onUpdate: mach }, 0.1)
          .to(w.cam, { zoom: 1, duration: 0.5, ease: 'power2.inOut' }, 0);
      }
    });
  }
  async openChamber(view: DiceView, o: ChamberOpts): Promise<void> {
    const hud = this.h.hud, w = this.h.w, el = hud.chamber.el;
    hud.chamber.render(view, o.realN, o.ribbon);
    el.style.animation = 'none';
    this.domAlpha(0);
    hud.chamber.show(true);
    hud.chamber.place();
    this.chamberShown = true;
    this.buildGate();
    this.gate.setView(view, this.h.seed());
    this.gate.calm = this.h.calm();
    this.gate.visible = true;
    w.logoHold = true;
    await this.transition(true);
    w.logo.visible = false;
    this.domAlpha(1);
  }
  setChamberView(view: DiceView, o: ChamberOpts): void {
    this.h.hud.chamber.render(view, o.realN, o.ribbon);
    this.h.hud.chamber.place();
    const from = this.gate.state, to = gateState(view);
    if (this.ceremonyOn) return;
    if (from === 'open' && to === 'pending') { this.gate.state = 'pending'; this.gate.closeTo(0.4, this.h.calm()); } // the replay: back to the closed, all-lit pose
    else if (!(from === 'open' && to === 'open')) this.gate.setView(view, this.h.seed()); // the open gate keeps settling
    if (this.gate.y !== 0) gsap.to(this.gate, { y: 0, duration: 0.5, ease: 'power2.inOut' }); // back from the placard lift
  }
  async closeChamber(): Promise<void> {
    const hud = this.h.hud, w = this.h.w;
    await this.transition(false);
    hud.chamber.show(false);
    this.domAlpha(1);
    hud.chamber.el.style.animation = '';
    this.gate.visible = false;
    this.chamberShown = false;
    this.machine.a = 1;
    w.setMachineAlpha(1);
    w.cam.zoom = 1;
    w.logoHold = false;
    w.placeLogo();
    if (w.logo.visible) { w.logo.alpha = 0; gsap.to(w.logo, { alpha: 1, duration: 0.3 }); }
  }

  // ---------------------------------------------------------------- ceremony (cinematics/gate.ts)
  ceremony(kind: CeremonyKind, o: { n: number; onSeal(): void }): CeremonyHandle {
    const w = this.h.w, calm = this.h.calm();
    this.gate.calm = calm;
    this.ceremonyOn = true;
    const hd = playGateCeremony({
      gate: this.gate, audio: w.audio, bloom: w.bloomCtl, camera: w.cam, sky: w, particles: w.particles,
      allowFlash: () => w.allowFlash(), haptic: (p) => this.h.haptic(p), calm,
    }, { eyebrow: ceremonyEyebrow(kind, o.n), onSeal: o.onSeal });
    void hd.done.then(() => { this.ceremonyOn = false; this.gate.state = 'open'; });
    return hd;
  }
  closeGate(): Promise<void> {
    const calm = this.h.calm();
    return new Promise<void>((res) => { void this.gate.closeTo(calm ? 0.5 : 1.2, calm).then(() => { this.gate.state = 'pending'; res(); }); });
  }

  /** Phones: the bottom-anchored placard must never cover "AUTOMAT 1948" and its concept label: the gate rises until
   *  both clear the card (desktop: the card sits in the right column and nothing moves). */
  private clearName(card: HTMLElement): void {
    const g = this.gate;
    if (!this.chamberShown || !g.title.visible || !card.isConnected) return;
    const host = this.h.hud.root.getBoundingClientRect(), r = card.getBoundingClientRect();
    const t = g.title.getBounds(), c = g.concept.getBounds();
    const left = Math.min(t.minX, c.minX), right = Math.max(t.maxX, c.maxX);
    if (r.left - host.left > right || r.right - host.left < left) return;
    const over = Math.max(t.maxY, c.maxY) + 10 - (r.top - host.top);
    if (over > 0) gsap.to(g, { y: g.y - over, duration: 0.6, ease: 'power2.inOut' });
  }
  cardShown(kind: 'hello' | 'firstDie' | 'unlock' | 'placard', el: HTMLElement): void {
    if (kind === 'placard') gsap.delayedCall(0.45, () => this.clearName(el)); // after the card's 0,4 s entry
    const c = el.querySelector('canvas.medal') as HTMLCanvasElement | null;
    if (!c) return;
    paintDie(c, kind === 'hello' ? 44 : 88, { state: 'die' });
    // one slow glint: 500 ms after the hello entry, 600 ms after a card has landed (its 0,4 s entry); none in calm
    if (!this.h.calm()) gsap.delayedCall(kind === 'hello' ? 0.5 : 1.0, () => { if (c.isConnected) glintOnce(c, 600); });
  }
}
