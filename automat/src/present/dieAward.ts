// Terningen · the award in Pixi: a DieAward container in stage.layers.banners, kept ABOVE the Celebration, with the
// DOM flight hand-off (in the same frame the Pixi die hides and a DPR canvas appears at its bounds; stage px = CSS px
// through autoDensity and #stagehost at inset 0). Everything runs on the game clock (deterministic under advance()).
// The big die moment ("Terningens øjeblik", dieMoment.ts) stages every real award from a base / Ladet spin: after the
// money celebration the die lifts to stage centre and grows (no offer: it holds 0,9 s, then flies home); with Kvit eller
// dobbelt it waits there over the card, and the throw, the win split or the frost-and-snow loss play around it.
// No w.flash(), no exposure; magenta only on small sprites, storm dice are quenched to white. The Game plays the award's
// own sounds (birth, landing); the moment plays its layered arrival chord, the throw's rattle and the result's tones.
import { gsap } from 'gsap';
import { Container, Sprite } from 'pixi.js';
import { IsText } from '../render/modules.ts';
import { softDot } from '../render/tex.ts';
import { PAL } from '../core/palette.ts';
import { paintDie } from '../ui/diceIcon.ts';
import { awardCaption, DEMO_CAPTION, heldOverflow } from '../ui/diceCopy.ts';
import type { GambleBet } from '../math/gamble.ts';
import type { Hud } from '../ui/hud.ts';
import type { World } from '../game/world.ts';
import { DieUnit, SPRITE_TINT } from './dieUnit.ts';
import { DieMoment, MOMENT_T } from './dieMoment.ts';

export { DieUnit } from './dieUnit.ts';

export interface AwardHost {
  hud: Hud;
  w: World;
  calm(): boolean;
  land(add: number, fromHeld: boolean): void;
}
export interface Pt { x: number; y: number }
type From = 'award' | 'held' | 'restore';

const clamp = (a: number, v: number, b: number) => Math.max(a, Math.min(b, v));
const desk = () => innerWidth >= 1000 && innerWidth / innerHeight >= 1.25;
const TRAIL = [PAL.teal, PAL.violet, PAL.magenta];
const AMBER = 0xffb547;

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

/** The award under way (born in the celebration, then the hero beat and its flight when there is no offer). */
interface Cur { n: number; die: DieUnit | null; fast: boolean; fly: gsap.core.Tween | null; flying: boolean; go: (() => void) | null; hero: boolean; hold: gsap.core.Tween | null }
/** A Kvit eller dobbelt staging: the moment around the staged dice, from gambleStage to the end of gambleSettle. */
interface Run {
  from: From; demo: boolean; k: number; m: DieMoment; fast: boolean;
  /** The result's own beat (split / frost), scheduled after the reveal; settle waits for it. */
  outcome: { timer: gsap.core.Tween | null; run: (fast: boolean) => void; done: Promise<void>; finished: boolean } | null;
  seq: gsap.core.Timeline | null; flights: gsap.core.Tween[]; payout: number;
}

export class DieAward extends Container {
  private h: AwardHost;
  private overlays: HTMLElement;
  private cur: Cur | null = null;
  private heldDice: DieUnit[] = [];
  private more: IsText | null = null;
  private moreN = 0;
  private moving = 0;
  private dim = new Sprite(softDot());
  /** The demo die held centre stage for the demo choice (demoHold → gambleStage). */
  private demoDie: DieUnit | null = null;
  /** The running staging (public for QA: dice-check reads moment.phase / qaTabs() through the stage tree). */
  run: Run | null = null;

  constructor(h: AwardHost) {
    super();
    this.label = 'dieAward';
    this.h = h;
    this.overlays = document.getElementById('overlays')!;
    this.dim.anchor.set(0.5);
    this.dim.tint = 0x02040c;
    this.dim.alpha = 0;
    this.addChild(this.dim);
    // "Vis terninger i spillet" switched off under a staged real choice: the moment fades where it is
    h.w.onFrame(() => { const r = this.run; if (r && !r.demo && document.documentElement.classList.contains('nodice')) this.drop(); });
  }
  /** Keep the award above the Celebration (added to banners after it). */
  private front(): void { this.h.w.stage.layers.banners.addChild(this); }
  get moment(): DieMoment | null { return this.run?.m ?? null; }
  inFlight(): boolean { return !!this.cur || this.moving > 0 || !!this.run || !!this.demoDie; }
  held(): number { return this.heldDice.length + this.moreN; }
  /** QA: 'born' (the Pixi die under the amount), 'hero' (lifting / holding centre stage), 'flight' (the DOM flight),
   *  'stage' (a Kvit eller dobbelt staging), 'none'. */
  phase(): string {
    const a = this.cur;
    if (a) return a.flying ? 'flight' : a.hero ? 'hero' : a.die ? 'born' : 'none';
    return this.run ? 'stage' : 'none';
  }

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
    this.cur = { n, die: d, fast: o.instant, fly: null, flying: false, go: null, hero: false, hold: null };
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
    return (d.tl = gsap.timeline()
      .to(d, { alpha: 1, duration: 0.16 }, 0)
      .to(d.st, { sc: 1, rot: 0, duration: 0.52, ease: 'back.out(1.6)', onUpdate: d.apply }, 0)
      .to(d.st, { halo: 0.35, duration: 0.4, onUpdate: d.apply }, 0)
      .call(() => { d.st.glint = 0; }, [], 0.35)
      .to(d.st, { glint: 1, duration: 0.3, ease: 'power1.inOut', onUpdate: d.apply }, 0.35)
      .call(() => { d.st.glint = -1; d.apply(); }, [], 0.66));
  }
  private sparkle(x: number, y: number, n: number): void {
    const p = this.h.w.particles;
    for (let i = 0; i < n; i++) p.emit('glint', x, y, 1, { color: TRAIL[i % 3], speed: 160, life: 0.5, size: 0.5 }); // size is × the kind's 34 px
  }
  /** The caption under a born die stays behind and fades (150 ms) while the die leaves. */
  private dropCaption(d: DieUnit): void {
    const cap = d.cap;
    if (!cap || cap.destroyed) return;
    d.cap = null;
    if (cap.alpha <= 0.01) { cap.destroy(); return; }
    d.removeChild(cap);
    cap.position.set(d.x + cap.x * d.scale.x, d.y + cap.y * d.scale.y);
    this.addChild(cap);
    gsap.to(cap, { alpha: 0, duration: 0.15, onComplete: () => cap.destroy() });
  }

  /** Tap/Esc: the flight starts at once and lasts 300 ms (done ≤ skip + 300 ms + 1 frame); the hero beat is cut short. */
  skip(): void {
    const a = this.cur;
    if (a) {
      a.fast = true;
      a.go?.(); // a flight waiting for its beat (or the hero lift / hold) starts at once
      const tw = a.fly;
      if (tw && tw.isActive()) { const left = tw.duration() - tw.time(); if (left > 0.3) tw.timeScale(left / 0.3); }
    }
    if (this.run) this.gambleSkip();
  }

  /** "Vis terninger i spillet" turned off mid-award: the born (or staged) die fades where it is in 250 ms and the award
   *  ends here (no flight, no landing: the Game moves the hidden count itself). A flight already under way lands. */
  drop(): void {
    const r = this.run;
    if (r) {
      this.run = null;
      for (const f of r.flights) f.progress(1);
      r.seq?.kill(); r.outcome?.timer?.kill();
      const { dice } = r.m.release();
      for (const d of dice) gsap.to(d, { alpha: 0, duration: 0.25, onComplete: () => d.kill() });
      void r.m.fadeFx(0.25).then(() => r.m.dispose());
    }
    const a = this.cur;
    if (!a || a.flying) return;
    this.cur = null;
    a.hold?.kill();
    a.go = null;
    const d = a.die;
    const m = this.heroMoment;
    this.heroMoment = null;
    if (m) { const { dice } = m.release(); for (const x of dice) if (x !== d) gsap.to(x, { alpha: 0, duration: 0.25, onComplete: () => x.kill() }); void m.fadeFx(0.25).then(() => m.dispose()); }
    if (!d || d.destroyed) return;
    d.tl?.kill(); d.tl = null;
    gsap.killTweensOf([d.st, d]);
    gsap.to(d, { alpha: 0, duration: 0.25, onComplete: () => d.kill() });
  }

  /** The hero beat's moment while no choice is offered (awardFly). */
  private heroMoment: DieMoment | null = null;
  /** Open a moment and lift the die into it: 700 ms (expo.out) to the anchor, growing to the hero size with a
   *  1,25-turn tumble; the arrival (ring, hit-stop + shake, the chord) at 700 ms. Calm: a crossfade (out 200 ms at
   *  the birth spot, in 300 ms at the centre). */
  private lift(d: DieUnit, o: { demo: boolean; n: number; world: boolean }): { m: DieMoment; arrive: gsap.core.Tween; die: DieUnit } {
    this.front();
    const m = new DieMoment({ hud: this.h.hud, w: this.h.w, calm: () => this.h.calm() }, this, { demo: o.demo, n: o.n, world: o.world });
    const calm = m.calm;
    d.tl?.kill(); d.tl = null;
    gsap.killTweensOf([d.st, d]);
    this.dropCaption(d);
    m.open();
    const to = m.fanSlots(1)[0];
    let die = d;
    if (calm) {
      // a crossfade: the born die fades where it is while the staged one fades in at the centre
      gsap.to(d, { alpha: 0, duration: 0.2, onComplete: () => d.kill() });
      die = new DieUnit(to.size * m.S, { halo: PAL.violet });
      m.place(die, to, 0.3);
    } else {
      d.enableGlint();
      d.st.glint = -1;
      d.st.halo = 0.22;
      d.alpha = 1;
      d.st.rot = -1.25;
      m.adopt(d, to, MOMENT_T.lift);
    }
    const arrive = gsap.delayedCall(calm ? 0.3 : MOMENT_T.lift, () => { if (!m.destroyed) m.arrive(true); });
    return { m, arrive, die };
  }

  /** After the celebration (no choice offered): the hero beat — lift, hold 0,9 s — then the 700 ms flight to
   *  hud.diceTarget(); resolves after host.land(add, false). A skip (or a skip before the birth) flies at once, 300 ms.
   *  Calm: the crossfade, the hold, then the die fades out where it is (250 ms) while the chip crossfades. */
  fly(add = 1): Promise<void> {
    const a = this.cur;
    if (!a || !a.die) { this.cur = null; this.h.land(add, false); return Promise.resolve(); }
    let d = a.die;
    const calm = this.h.calm();
    return new Promise<void>((res) => {
      const done = () => { this.cur = null; this.h.land(add, false); res(); };
      let lifted: { m: DieMoment; arrive: gsap.core.Tween; die: DieUnit } | null = null;
      a.go = () => {
        a.go = null;
        a.hold?.kill(); a.hold = null;
        lifted?.arrive.kill();
        const m = lifted?.m ?? null;
        if (m) { m.release(); this.heroMoment = null; this.moving++; void m.fadeFx(a.fast ? 0.3 : 0.5).then(() => { m.dispose(); this.moving--; }); }
        a.flying = true;
        if (calm) {
          this.dropCaption(d);
          a.fly = gsap.to(d, { alpha: 0, duration: a.fast ? 0.2 : 0.25, onComplete: () => { d.kill(); done(); } });
          return;
        }
        a.fly = this.flight(d, { dur: a.fast ? 0.3 : MOMENT_T.fly, spin: 1.25, bright: add > 1, onDone: done });
      };
      if (a.fast) { a.go(); return; }
      a.hero = true;
      lifted = this.lift(d, { demo: false, n: a.n, world: true });
      d = a.die = lifted.die;
      this.heroMoment = lifted.m;
      a.hold = gsap.delayedCall(MOMENT_T.lift + MOMENT_T.holdNoOffer, () => a.go?.());
    });
  }

  /** The DOM flight: hand-off from a Pixi die (hidden in the same frame, at its on-screen position and size), a lob on
   *  a quadratic Bézier (control = the midpoint lifted by 18 % of the distance) to hud.diceTarget(), re-measured every
   *  frame; size → the home's icon, +spin turns landing at 0; an aurora trail (a Pixi glint every 40 ms, teal → violet
   *  → magenta; off on quality 2 / calm). */
  private flight(d: DieUnit | (Pt & { size: number }), o: { dur: number; spin: number; bright?: boolean; onDone: () => void; dissolve?: boolean }): gsap.core.Tween {
    let from: { x: number; y: number; size: number };
    if (d instanceof DieUnit) {
      this.dropCaption(d);
      const g = d.getGlobalPosition(), wt = d.worldTransform, z = Math.hypot(wt.a, wt.b) || 1;
      from = { x: g.x, y: g.y, size: d.shown() * z };
      d.kill();
    } else from = { x: d.x, y: d.y, size: d.size };
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
        // a demo die dissolves at the home (scale 1 → .6, α → 0, 400 ms); the number never changes
        o.onDone();
        this.moving++;
        gsap.to(f.s, { size: f.s.size * 0.6, a: 0, duration: 0.4, onUpdate: f.apply, onComplete: () => { f.remove(); this.moving--; } });
      },
    });
  }

  // ---------------------------------------------------------------- Kvit eller dobbelt: the staging, the throw, the settle
  /** The k dice wait centre stage above the card. 'award': the born die (or the demo die) lifts into the moment (the
   *  hero beat); 'held': the storm's held dice rise from the molten frame into a fan (≤ 8, "+m"); 'restore': k dice
   *  fade in at the centre. No timer, no countdown, no motion that pulls toward a bet. */
  stage(o: { k: number; from: From; demo: boolean }): void {
    this.endRun(); // (a stale staging never stacks)
    this.front();
    const host = { hud: this.h.hud, w: this.h.w, calm: () => this.h.calm() };
    if (o.from === 'award') {
      const a = this.cur, src = o.demo ? this.demoDie : a?.die ?? null;
      if (o.demo) this.demoDie = null;
      else { if (a) { a.hold?.kill(); a.go = null; } this.cur = null; }
      if (src && !src.destroyed) {
        const { m } = this.lift(src, { demo: o.demo, n: o.demo ? 0 : a?.n ?? 0, world: true });
        if (o.demo) { this.dim.position.set(m.anchor().x, m.anchor().y); }
        this.run = { from: o.from, demo: o.demo, k: o.k, m, fast: false, outcome: null, seq: null, flights: [], payout: o.k };
        gsap.to(this.dim, { alpha: 0, duration: 0.4 });
        return;
      }
    }
    const held = o.from === 'held';
    const m = new DieMoment(host, this, { demo: o.demo, n: 0, world: !held });
    this.run = { from: o.from, demo: o.demo, k: o.k, m, fast: false, outcome: null, seq: null, flights: [], payout: o.k };
    m.open();
    const c = Math.min(8, Math.max(1, o.k)), to = m.fanSlots(c);
    if (held) {
      const dice = this.heldDice.slice(0, c);
      for (const extra of this.heldDice.slice(c)) extra.kill();
      this.heldDice = [];
      this.more?.destroy(); this.more = null; this.moreN = 0;
      for (let i = 0; i < c; i++) {
        const d = dice[i];
        if (d && !d.destroyed) { d.enableGlint(); d.st.halo = 0.2; m.adopt(d, to[i], m.calm ? 0.35 : 0.7, { delay: m.calm ? 0 : 0.07 * i }); }
        else m.place(new DieUnit(to[i].size * m.S, { halo: PAL.violet }), to[i], 0.35);
      }
    } else {
      for (let i = 0; i < c; i++) m.place(new DieUnit(to[i].size * m.S, { halo: PAL.violet }), to[i], 0.4);
    }
    m.setMore(o.k - c);
    gsap.delayedCall(held && !m.calm ? 0.7 + 0.07 * (c - 1) : 0.4, () => { if (this.run?.m === m) m.arrive(true); });
  }

  /** The throw of a committed result; resolves at MOMENT_T.throwEnd (= T.floor), the reveal: the die rests, the drawn
   *  tablet lights, the plate. The win split / the loss's frost follow during the Game's result hold. */
  throwIt(o: { bet: GambleBet; pip: number; k: number; payout: number; demo: boolean }): Promise<void> {
    if (!this.run) this.stage({ k: o.k, from: 'restore', demo: o.demo });
    const r = this.run!;
    r.payout = o.payout;
    r.m.throwStart(o.bet);
    return new Promise<void>((res) => {
      gsap.delayedCall(MOMENT_T.throwEnd, () => {
        if (this.run !== r) { res(); return; }
        r.m.reveal(o.pip);
        this.schedule(r, o.payout > 0 ? 0.35 : 0.25);
        res();
      });
    });
  }
  /** The result's own beat after the reveal: the split into `payout` dice (a win), or the frost (a loss). */
  private schedule(r: Run, delay: number): void {
    let resolve!: () => void;
    const oc: NonNullable<Run['outcome']> = {
      timer: null, finished: false,
      done: new Promise<void>((x) => { resolve = () => { oc.finished = true; x(); }; }),
      run: (fast: boolean) => {
        oc.timer?.kill(); oc.timer = null; oc.run = () => {};
        if (r.payout > 0) {
          if (r.payout !== r.m.count() || r.m.phase === 'result') r.m.split(r.payout, fast);
          gsap.delayedCall(fast ? 0.3 : 0.6, resolve);
        } else void r.m.frostOut(fast).then(resolve);
      },
    };
    oc.timer = gsap.delayedCall(delay, () => oc.run(r.fast));
    r.outcome = oc;
  }

  /** 'award' / 'restore': the flights home, one by one (≤ 4, the rest merged into a brighter die), each calling
   *  host.land(add, false); 0 → the frost has taken the die, nothing flies. 'held': the fan becomes the payout dice
   *  and stays for the outro's releaseHeld (0: it has dissolved). demo: the dice dissolve at the home + "+N demo".
   *  Resolves when the last die has landed and the moment is gone (nothing of it is in motion at the next idle). */
  async settle(payout: number, o: { from: From; demo: boolean }): Promise<void> {
    if (!this.run) {
      // the choice switched off since the award: the no-offer hero beat and its flight
      if (o.from === 'award' && this.cur && !o.demo) return this.fly(payout);
      // a settled choice restored after a reload (no staging yet): the payout dice fade in at the centre first
      if (payout <= 0) return;
      this.stage({ k: payout, from: 'restore', demo: o.demo });
      await new Promise<void>((x) => gsap.delayedCall(0.45, x));
      if (!this.run) return;
    }
    const r = this.run!;
    r.payout = payout;
    // a result made elsewhere (another tab) gets its beat here; a beat still to come (the hold was cut short) runs
    // now and hurried, one under way is hurried: all of it within 300 ms
    if (!r.outcome && payout !== r.m.count()) this.schedule(r, 0);
    if (r.outcome && !r.outcome.finished) {
      if (r.outcome.timer) r.outcome.run(true);
      r.m.hurry(0.3);
      await r.outcome.done;
    }
    if (this.run !== r) return; // dropped meanwhile
    const m = r.m;
    if (payout <= 0) { await m.fadeFx(0.3); this.endRun(); return; }
    if (o.from === 'held' && !r.demo) {
      // the fan stays on stage as the held row; the outro flies it home
      const { dice, more } = m.release();
      this.heldDice = dice;
      this.moreN = more;
      if (more > 0) {
        const last = dice[dice.length - 1];
        this.more = new IsText({ text: heldOverflow(more), size: 14, style: 'ice', decor: false });
        this.more.position.set(last ? last.x + last.shown() * 0.7 + 10 : m.anchor().x, last ? last.y : m.anchor().y);
        this.addChild(this.more);
      }
      await m.fadeFx(r.fast ? 0.3 : 0.5);
      this.endRun();
      return;
    }
    const { dice } = m.release();
    const fade = m.fadeFx(r.fast ? 0.3 : 0.5);
    await this.flyAll(r, dice, payout);
    await fade;
    this.endRun();
  }
  /** Flights home one by one, MOMENT_T.gap apart (≤ 4; the last carries the rest as a brighter die). */
  private flyAll(r: Run, dice: DieUnit[], total: number): Promise<void> {
    const flights = Math.min(4, total);
    const calm = this.h.calm();
    return new Promise<void>((res) => {
      let left = flights;
      const landed = () => { if (--left === 0) { if (r.demo) this.h.hud.demoDiceTag(total); res(); } };
      const seq = (r.seq = gsap.timeline());
      for (let f = 0; f < flights; f++) {
        const add = f === flights - 1 ? total - (flights - 1) : 1;
        const at = calm ? 0 : f * MOMENT_T.gap;
        if (f === flights - 1) for (const extra of dice.slice(flights)) seq.to(extra, { alpha: 0, duration: 0.2, onComplete: () => extra.kill() }, at);
        seq.call(() => {
          const src = dice[f];
          const onDone = () => { if (!r.demo) this.h.land(add, false); landed(); };
          if (calm) {
            // calm: the dice fade out where they are (250 ms) while the home crossfades its number
            if (src && !src.destroyed) { this.moving++; r.flights.push(gsap.to(src, { alpha: 0, duration: r.fast ? 0.2 : 0.25, onComplete: () => { src.kill(); this.moving--; onDone(); } })); }
            else onDone();
            return;
          }
          const from = src && !src.destroyed ? src : { ...this.moment?.anchor() ?? { x: this.h.w.stage.w / 2, y: this.h.w.stage.h / 2 }, size: 60 };
          r.flights.push(this.flight(from, { dur: r.fast ? 0.3 : MOMENT_T.fly, spin: 0.75, bright: add > 1, dissolve: r.demo, onDone }));
        }, [], at);
      }
      if (r.fast) seq.progress(1);
    });
  }
  /** The result hold and the flights finish in ≤ 300 ms (never the throw: the reveal keeps its time). */
  gambleSkip(): void {
    const r = this.run;
    if (!r || r.m.phase === 'throw' || r.m.phase === 'lift' || r.m.phase === 'wait') return;
    r.fast = true;
    if (r.outcome?.timer) r.outcome.run(true);
    r.m.hurry(0.3);
    r.seq?.progress(1);
    for (const tw of r.flights) if (tw.isActive()) { const left = tw.duration() - tw.time(); if (left > 0.3) tw.timeScale(left / 0.3); }
  }
  private endRun(): void {
    const r = this.run;
    if (!r) return;
    this.run = null;
    r.outcome?.timer?.kill();
    r.seq?.kill();
    r.m.dispose();
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
    this.demoDie?.kill(); this.demoDie = null; // (a demo hold never staged)
    for (const d of this.heldDice) d.kill();
    this.heldDice = [];
    this.more?.destroy();
    this.more = null;
    this.moreN = 0;
    this.endRun(); // (a demo reset under a staging: nothing of it survives)
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
  demo(o: { hold?: boolean } = {}): Promise<void> {
    if (o.hold) return this.demoHold();
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

  // ---------------------------------------------------------------- demo award with the choice ("Vis en terning med valg")
  /** Birth like demo() (soft dim, tumble), but the die stays: gambleStage lifts it into the moment (with its DEMO band).
   *  Resolves once it sits in its pose (≈ 0,55 s; calm 0,3 s). */
  private demoHold(): Promise<void> {
    this.front();
    const w = this.h.w, W = w.stage.w, s = Math.min(W, 700), calm = this.h.calm();
    const size = clamp(56, 0.16 * s, 104);
    const r = w.gridRect;
    this.dim.position.set(r.x + r.size / 2, r.y + r.size / 2);
    this.dim.width = this.dim.height = r.size * 1.5;
    gsap.to(this.dim, { alpha: 0.35, duration: 0.3 });
    this.demoDie?.kill(); // (a hold never staged)
    const d = new DieUnit(size, { caption: DEMO_CAPTION, capSize: Math.max(10, 0.024 * s), glint: !calm });
    d.position.set(W / 2, w.gridCenterY());
    this.addChild(d);
    this.demoDie = d;
    return new Promise<void>((res) => {
      if (calm) {
        d.alpha = 0; Object.assign(d.st, { sc: 1, rot: 0, cap: 0.85 }); d.apply();
        gsap.timeline().to(d, { alpha: 1, duration: 0.3 }, 0).call(res, [], 0.3);
        return;
      }
      d.alpha = 0; Object.assign(d.st, { sc: 0.25, rot: -1.2, cap: 0 }); d.apply();
      gsap.timeline().add(this.tumble(d), 0).to(d.st, { cap: 0.85, duration: 0.25, onUpdate: d.apply }, 0.45).call(res, [], 0.55);
      this.sparkle(d.x, d.y, 8);
    });
  }
}

function mixHex(a: number, b: number, t: number): number {
  const c = (s: number) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
  return (c(16) << 16) | (c(8) << 8) | c(0);
}
