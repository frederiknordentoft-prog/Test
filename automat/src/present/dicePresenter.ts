// Terningen · presentation boundary. The Game commits every die BEFORE presentation and then only calls this
// interface; nothing here can change a count (the chip only moves through host.land()).
// PixiDicePresenter: the award in Pixi (DieAward, with the DOM flight to the chip), the gate (GateView in the stage's
// 'chamber' layer) under the chamber DOM, and the bar-anchored ceremony (cinematics/gate.ts, which owns its sounds).
// Everything runs on the game clock (deterministic under advance()). The award's birth and landing sounds are the
// Game's; the big die moment (dieMoment.ts) plays its own arrival chord, the throw's rattle and the result's tones.
import { gsap } from 'gsap';
import type { Hud } from '../ui/hud.ts';
import type { World } from '../game/world.ts';
import type { DiceView } from '../game/dice.ts';
import type { GambleBet } from '../math/gamble.ts';
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
/** Kvit eller dobbelt: where the staged dice come from. 'award' = the die just born in the celebration, 'held' = the
 *  storm's dice still on the molten frame, 'restore' = a choice (or its settled result) brought back after a reload. */
export type GambleFrom = 'award' | 'held' | 'restore';
export interface GambleShow { k: number; from: GambleFrom; demo: boolean }
/** A COMMITTED outcome (the Game wrote it at the choice press): presentation only. */
export interface GambleThrow { bet: GambleBet; pip: number; k: number; payout: number; demo: boolean }
/** at(): QA only, seconds since T0 (the ceremony's first bar line; negative in the pre-roll). */
export interface CeremonyHandle { done: Promise<void>; canSkip(): boolean; skip(): void; at?(): number }

export interface DicePresenter {
  /** Base / Ladet spin, from Celebration's birth beat (dieBirthAt). instant = a skip before the beat (no tumble, no glint). */
  awardBirth(n: number, o: { instant: boolean; tier: number }): void;
  /** After the celebration closed, no choice offered: the big die moment (the die lifts to stage centre and grows,
   *  holds 0,9 s) and the flight to hud.diceTarget(); resolves after host.land(add, false). A skip flies at once. */
  awardFly(add?: number): Promise<void>;
  /** "Vis terninger i spillet" turned off mid-award: a born die fades where it is (no flight, no landing). */
  awardDrop(): void;
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
  /** Drawer "Vis en terning": award-only demo die; dissolves at the chip with the "+1 demo" tag.
   *  hold: the die stays centre stage after its birth (the demo choice follows; gambleSettle ends it). */
  demoAward(o?: { hold?: boolean }): Promise<void>;
  // ---- Kvit eller dobbelt (the Game shows the card; these only stage the dice around it)
  /** The k dice wait centre stage above the card. No timer, no countdown, no motion that pulls toward a bet. */
  gambleStage(o: GambleShow): void;
  /** Presentation of a committed outcome (the Game shows the result at max(this, T.floor)). No near-miss: never rest
   *  on, pass or slow past a winning face before a losing one or the reverse; no red, no escalating pitch, flashes only
   *  through world.allowFlash(); calm: a crossfade. */
  gambleThrow(o: GambleThrow): Promise<void>;
  /** 'award'/'restore': flights home (≤ 4, the rest merged) calling host.land(add, false); payout 0 → the die dissolves
   *  in place (no burst, no sting). 'held': the fan becomes `payout` dice and the outro's releaseHeld flies them
   *  (payout 0 → the fan fades out). demo → dissolve at the home + the "+N demo" tag. */
  gambleSettle(payout: number, o: { from: GambleFrom; demo: boolean }): Promise<void>;
  /** The result hold and the flights finish in ≤ 300 ms (never shortens the throw). */
  gambleSkip(): void;
  /** Anything of the award still in motion, gamble staging included (never true when the next spin may start). */
  inFlight(): boolean;
  held(): number;
  /** QA: 'born' (the Pixi die under the amount), 'hero' (the big die moment's lift and hold), 'flight' (the DOM
   *  flight), 'stage' (a Kvit eller dobbelt staging: the offer, the throw, the result, the settle), 'none'. */
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
  cardShown(kind: 'hello' | 'firstDie' | 'unlock' | 'placard' | 'gamble', el: HTMLElement): void;
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
  /** The running open/close transition (interruptible: a close during the open takes over from where it is). */
  private tl: gsap.core.Timeline | null = null;
  private tlEnd: (() => void) | null = null;
  /** Bumped by every open and close: a continuation that finds a newer one does nothing. */
  private gen = 0;
  /** The slot (and stage) the gate was last baked for: one bake per open, and on a real resize only. */
  private built = { x: 0, y: 0, w: 0, h: 0, sw: 0, sh: 0 };
  /** The placard's pending lift (cardShown → clearName). */
  private lift: gsap.core.Tween | null = null;

  constructor(h: DiceHost) {
    this.h = h;
    this.award = new DieAward({ hud: h.hud, w: h.w, calm: () => h.calm(), land: (add, fromHeld) => h.land(add, fromHeld) });
    h.w.stage.layers.chamber.addChild(this.gate);
    // update() only while the gate is visible, on the game clock (in step with the audio-anchored ceremony)
    h.w.onFrame(() => {
      if (this.gate.visible) { this.gate.calm = h.calm(); this.gate.update(clock.dt, h.w.sky.envColors()[0]); }
      // the stage resizes on a frame after the window: a bake that ran before it (a slow frame) is redone
      if (this.chamberShown && !this.rebuildTimer && (h.w.stage.w !== this.built.sw || h.w.stage.h !== this.built.sh)) this.rebuildSoon();
    });
    // rebuild on resize while open (debounced 150 ms): the slot is measured like #slot-grid. Un-hiding the chamber
    // (0×0 → its size) fires this too; openChamber has already baked for that size, so only a change rebuilds.
    new ResizeObserver(() => { if (this.chamberShown && this.slotMoved()) this.rebuildSoon(); }).observe(h.hud.chamber.gateSlot());
  }
  private rebuildSoon(): void {
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = window.setTimeout(() => { this.rebuildTimer = 0; if (this.chamberShown && this.slotMoved()) this.buildGate(); }, 150);
  }
  inFlight(): boolean { return this.award.inFlight(); }
  held(): number { return this.award.held(); }
  phase(): string { return this.award.phase(); }

  // ---------------------------------------------------------------- award (DieAward)
  awardBirth(n: number, o: { instant: boolean; tier: number }): void { this.award.birth(n, o); }
  awardSkip(): void { this.award.skip(); }
  awardFly(add = 1): Promise<void> { return this.award.fly(add); }
  awardDrop(): void { this.award.drop(); }
  stormPop(n: number, at: Pt, slot: number): Promise<void> { void n; return this.award.stormPop(at, slot); }
  stormGhost(at: Pt): Promise<void> { return this.award.stormGhost(at); }
  restoreHeld(k: number): void { this.award.restoreHeld(k); }
  releaseHeld(k: number): Promise<void> { return this.award.releaseHeld(k); }
  clearHeld(): void { this.award.clearHeld(); }
  demoAward(o: { hold?: boolean } = {}): Promise<void> { return this.award.demo(o); }

  // ---------------------------------------------------------------- Kvit eller dobbelt: the big die moment and the throw
  // (DieAward + dieMoment.ts; the DOM card carries the words, these stage the dice around it)
  gambleStage(o: GambleShow): void { this.award.stage(o); }
  gambleThrow(o: GambleThrow): Promise<void> { return this.award.throwIt(o); }
  gambleSettle(payout: number, o: { from: GambleFrom; demo: boolean }): Promise<void> { return this.award.settle(payout, o); }
  gambleSkip(): void { this.award.gambleSkip(); }

  // ---------------------------------------------------------------- chamber
  chamberOpen(): boolean { return this.chamberShown; }
  /** The slot as seen (stage px): clipped to the chamber box (landscape phones scroll the text column; the gate stays put). */
  private slotRect(): { x: number; y: number; w: number; h: number } | null {
    const hud = this.h.hud;
    const host = hud.root.getBoundingClientRect(), s = hud.chamber.gateSlot().getBoundingClientRect(), box = hud.chamber.el.getBoundingClientRect();
    const top = Math.max(s.top, box.top), bottom = Math.min(s.bottom, box.bottom);
    if (s.width < 10 || bottom - top < 10) return null;
    return { x: s.left - host.left, y: top - host.top, w: s.width, h: bottom - top };
  }
  private buildGate(): void {
    const w = this.h.w, r = this.slotRect();
    if (!r) return;
    this.built = { ...r, sw: w.stage.w, sh: w.stage.h };
    this.gate.build(r, { w: w.stage.w, h: w.stage.h, dpr: window.devicePixelRatio || 1 });
  }
  /** Does the slot (or the stage) differ from the last bake (±0,5 px)? */
  private slotMoved(): boolean {
    const r = this.slotRect(), b = this.built, w = this.h.w;
    if (!r) return false;
    return Math.abs(r.x - b.x) > 0.5 || Math.abs(r.y - b.y) > 0.5 || Math.abs(r.w - b.w) > 0.5 || Math.abs(r.h - b.h) > 0.5 || w.stage.w !== b.sw || w.stage.h !== b.sh;
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
  /** The machine's DOM (#hdr, #slot-arc, #winstrip, #deck, .side: what :root.chamber hides; `inert` is set at once)
   *  follows machine.a through a transition, over the class's visibility:hidden, so the HUD never cuts out or back in
   *  in one frame. null hands it back to the stylesheet (open: at α 0, under :root.chamber; close: at α 1). */
  private machineDom(a: number | null): void {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('#hdr, #slot-arc, #winstrip, #deck, .side'))) {
      el.style.visibility = a === null ? '' : 'visible';
      el.style.opacity = a === null ? '' : String(a);
      el.style.transition = a === null ? '' : 'none'; // their 0,6 s opacity transition would trail the tween
    }
  }
  /** Open 900 ms: the machine fades (0–600 ms, then hidden), camera 1.00 → 1.03, the gate α 0 → 1 and y +24 → 0
   *  (200–900 ms), the DOM (400–900 ms). Calm: a 400 ms crossfade, no zoom, no move. Close 500 ms: the reverse.
   *  Interruptible: a new transition stops the running one where it is (its promise resolves; the caller's gen check
   *  skips its continuation) and tweens on from there. */
  private transition(open: boolean): Promise<void> {
    const w = this.h.w, g = this.gate, calm = this.h.calm();
    this.tl?.kill(); this.tlEnd?.();
    this.lift?.kill(); this.lift = null;
    gsap.killTweensOf(g, 'y');
    gsap.killTweensOf(w.cam, 'zoom'); // also a ceremony's 3 s settle back to 1.03 (else it outlives the close)
    gsap.killTweensOf(w.logo, 'alpha');
    const logo = w.logo.visible; // the header logo fades with the machine (no one-frame pop: FlashBudget)
    const mach = () => { w.setMachineAlpha(this.machine.a); if (logo) w.logo.alpha = this.machine.a; this.machineDom(this.machine.a); };
    const dom = () => this.domAlpha(this.dom.v);
    mach(); // in this frame: :root.chamber is already set (open) or still set (close)
    return new Promise<void>((res) => {
      const end = () => { if (this.tlEnd === end) { this.tl = null; this.tlEnd = null; } res(); };
      this.tlEnd = end;
      const tl = this.tl = gsap.timeline({ onComplete: end });
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
          .to(g, { alpha: 0, y: g.y + 24, duration: 0.35, ease: 'power2.in' }, 0.05) // from where it is (a placard lift)
          .to(this.machine, { a: 1, duration: 0.4, onUpdate: mach }, 0.1)
          .to(w.cam, { zoom: 1, duration: 0.5, ease: 'power2.inOut' }, 0);
      }
    });
  }
  async openChamber(view: DiceView, o: ChamberOpts): Promise<void> {
    const hud = this.h.hud, w = this.h.w, el = hud.chamber.el, gen = ++this.gen;
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
    if (gen !== this.gen) return; // closed during the open: the close restores everything
    this.machineDom(null);
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
    this.unlift(0.5);
  }
  /** Back from the placard lift (a lift still waiting for the card's entry never starts). */
  private unlift(dur: number): void {
    this.lift?.kill(); this.lift = null;
    gsap.killTweensOf(this.gate, 'y');
    if (this.gate.y !== 0) gsap.to(this.gate, { y: 0, duration: dur, ease: 'power2.inOut' });
  }
  async closeChamber(): Promise<void> {
    const hud = this.h.hud, w = this.h.w, gen = ++this.gen;
    await this.transition(false);
    if (gen !== this.gen) return;
    hud.chamber.show(false);
    this.machineDom(null); // at α 1; the Game drops :root.chamber next (same task, before any paint)
    this.domAlpha(1);
    hud.chamber.el.style.animation = '';
    this.gate.visible = false;
    this.chamberShown = false;
    this.machine.a = 1;
    w.setMachineAlpha(1);
    w.cam.zoom = 1;
    w.logoHold = false;
    const a = w.logo.visible ? w.logo.alpha : 0; // closed during the open: the logo faded back with the machine
    w.placeLogo();
    if (w.logo.visible && a < 1) { w.logo.alpha = a; gsap.to(w.logo, { alpha: 1, duration: 0.3 }); }
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
    this.unlift(calm ? 0.5 : 0.6); // the wall settles back from the placard lift while the leaves close
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
    // never out of view: a card too tall to clear (landscape phones) leaves the gate where it is
    const room = Math.min(t.minY, c.minY) - (this.h.hud.chamber.el.getBoundingClientRect().top - host.top) - 8;
    if (over > 0 && over <= room) gsap.to(g, { y: g.y - over, duration: 0.6, ease: 'power2.inOut' });
  }
  cardShown(kind: 'hello' | 'firstDie' | 'unlock' | 'placard' | 'gamble', el: HTMLElement): void {
    if (kind === 'placard') { this.lift?.kill(); this.lift = gsap.delayedCall(0.45, () => { this.lift = null; this.clearName(el); }); } // after the card's 0,4 s entry
    const c = el.querySelector('canvas.medal') as HTMLCanvasElement | null;
    if (!c) return;
    paintDie(c, kind === 'hello' ? 44 : 88, { state: 'die' });
    // one slow glint: 500 ms after the hello entry, 600 ms after a card has landed (its 0,4 s entry); none in calm
    if (!this.h.calm()) gsap.delayedCall(kind === 'hello' ? 0.5 : 1.0, () => { if (c.isConnected) glintOnce(c, 600); });
  }
}
