// Terningen · "Terningens øjeblik" (brief §7.2): the big die moment around the staged dice, and the throw.
//
// A DieMoment lives from the die's lift (or the storm fan's rise) to its settle, then is disposed (no growth across
// awards: every display object is its own, every texture comes from the fixed dieFx / tex caches). It puts two
// containers into the DieAward layer: `back` (a soft dim, two aurora ribbons, the corona of 18 additive ray wedges, the
// ice ring, the far motes) under the dice, and `front` (the near motes, TERNING / NR. n, the six ice tablets, the pip
// plate, the DEMO band) over them. It positions the staged dice every frame from its layout: centred horizontally and,
// vertically, in the band between the bottom of the header / Kp arc and hud.gambleCardTop() (re-read every frame: the
// card is a bottom sheet on phones), camera-zoom compensated, eased so that a card change never makes the die jump.
//
// Honesty (hard rules): the throw only presents a result committed at the choice press. The winning tablets are lit
// statically from their first frame; the die tumbles at ONE constant tempo (4 turns and 11 hops in 2,75 s on the game
// clock, the rattle's ticks at one pitch) and comes to rest exactly at the reveal: nothing slows, rests on or passes a
// face. The drawn tablet lights once, at the reveal, never before. A loss is neutral: frost, fine cracks and snow in ice
// blue; no red, no burst, no sting. Photosensitivity: every bright change is a ramp ≥ 300 ms (corona α ≤ .22, sky glow
// floor, bloom), no w.flash(), no exposure. Calm: no tumble, rays, ribbons, ring, motes, bob, glint, shake, zoom or
// particles: crossfades and static tablets.
import { gsap } from 'gsap';
import { Container, Sprite, Texture } from 'pixi.js';
import { IsText } from '../render/modules.ts';
import { softDot } from '../render/tex.ts';
import { rayTex, ringTex, ribbonTex, starTex, tabletTex, plateTex, bandTex, vignetteTex } from '../render/fx/dieFx.ts';
import { PAL } from '../core/palette.ts';
import { crand } from '../core/cosmeticRng.ts';
import { winPips, GAMBLE_SIDES, type GambleBet } from '../math/gamble.ts';
import { DEMO_CAPTION, heldOverflow } from '../ui/diceCopy.ts';
import { hitStop, clock } from './clock.ts';
import { DieUnit } from './dieUnit.ts';
import { Celebration } from './celebration.ts';
import type { Hud } from '../ui/hud.ts';
import type { World } from '../game/world.ts';

import { MOMENT_COPY } from './momentCopy.ts';
export { MOMENT_COPY } from './momentCopy.ts';

export const MOMENT_T = {
  lift: 0.7,        // birth spot → stage centre, expo.out, a 1,25-turn tumble
  holdNoOffer: 0.9, // no offer: the hero holds this long after its arrival, then flies home
  fly: 0.7,         // one flight home (aurora trail)
  gap: 0.16,        // between the flights of a payout (≤ 4, the rest merged)
  throwIn: 0.25,    // the tablets fade in (the winning ones lit from their first frame) before the tumble starts
  throwEnd: 3.0,    // = T.floor: the die rests, the drawn tablet lights, the plate (the Game's reveal)
  hop: 0.25,        // one hop of the rattle: 11 hops from throwIn to throwEnd, two ticks each
};
const AMBER = 0xffb547;
const AURORA = [PAL.teal, PAL.violet, PAL.magenta];
const clamp = (a: number, v: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const backOut = (t: number) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

export interface MomentHost { hud: Hud; w: World; calm(): boolean }
export interface FanTo { dx: number; dy: number; size: number; rot: number }
/** One staged die: where it came from (layer px), where it goes (relative to the anchor, in units of the live die size
 *  S, so the fan follows the band when the card changes), the blend `p` (0 → 1; at 1 it tracks the layout), its own
 *  fade `a` and scale factor `k`. */
interface Slot { d: DieUnit; from: { x: number; y: number; size: number; rot: number }; to: FanTo; p: number; ease: (t: number) => number; a: number; k: number }
interface Tab { pip: number; lit: boolean; drawn: boolean; root: Container; sp: Sprite; glow: Sprite; ring: Sprite; hi: { v: number } }
interface Mote { sp: Sprite; th: number; w: number; r: number; tw: number; base: number; front: boolean; star: boolean }

export class DieMoment {
  readonly back = new Container();
  readonly front = new Container();
  /** QA: 'lift' → 'wait' → 'throw' → 'result' → 'settle' (dice-check reads it through the stage tree). */
  phase: 'lift' | 'wait' | 'throw' | 'result' | 'settle' = 'lift';
  readonly demo: boolean;
  readonly calm: boolean;
  /** Screen px: the anchor (die centre) and the die size, eased toward the layout. */
  ax = 0; ay = 0; S = 120;
  /** QA: the band the die sits in (screen px). */
  zoneTop = 0; zoneBottom = 0;
  private tx = 0; private ty = 0; private tS = 120; private placed = false;
  private h: MomentHost;
  private layer: Container;
  private worldFx: boolean;
  private slots: Slot[] = [];
  /** The thrown die: a fan's own die in front of it, or (one staged die) the staged die itself. */
  private thrower: DieUnit | null = null;
  private ownThrower = false;
  private moreText: IsText | null = null;
  private moreN = 0;
  private moreDx = 0;
  private dim = new Sprite(vignetteTex());
  /** The stage dim (0.55 at full, like the celebration's): it takes over from a closing celebration's own dim so the
   *  combined light stays constant (no dip, no pop), else it ramps in over 600 ms. */
  private shade = new Sprite(Texture.WHITE);
  private cel: Celebration | null = null;
  private ribbons: Sprite[] = [];
  /** The aurora nebula right behind the die: a teal and a violet-magenta glow, slowly orbiting each other. */
  private neb: Sprite[] = [];
  private corona = new Container();
  private rays: { sp: Sprite; len: number; wid: number; a: number; ph: number }[] = [];
  private ring = new Sprite(ringTex());
  private ringS = { r: 0.5, a: 0 };
  private motes: Mote[] = [];
  private title: IsText;
  private nr: IsText | null = null;
  private band: Container | null = null;
  private tabs: Tab[] = [];
  private tabRoot = new Container();
  private plate = new Container();
  private plateText: IsText | null = null;
  /** Ramped levels (0..1): the FX, the corona (win: → 1), the words, the tablets, the plate, the world ramps, the fan. */
  lv = { fx: 0, cor: 0.75, title: 0, nr: 0, tabs: 0, plate: 0, world: 0, fan: 1, shade: 0 };
  private base = { sky: 0, bloom: 1, zoom: 1 };
  private t = 0;
  private bobOn = false;
  private sweepAt = 0;
  /** The throw's motion clock on the GAME clock (a gsap tween): u = seconds of tumble, 0 … throwEnd − throwIn. */
  private hop = { u: 0, on: false };
  private readonly off: () => void;
  private tweens: (gsap.core.Tween | gsap.core.Timeline)[] = [];
  destroyed = false;

  constructor(h: MomentHost, layer: Container, o: { demo: boolean; n: number; world: boolean }) {
    this.h = h;
    this.layer = layer;
    this.demo = o.demo;
    this.calm = h.calm();
    this.worldFx = o.world;
    this.back.label = 'dieMomentBack';
    this.front.label = 'dieMoment';
    this.shade.tint = 0x02040c;
    this.shade.alpha = 0;
    this.dim.anchor.set(0.5);
    this.dim.tint = 0x02040c;
    this.dim.alpha = 0;
    this.back.addChild(this.shade, this.dim);
    this.cel = (h.w.stage.layers.banners.children.find((c) => c instanceof Celebration && c.visible && c.alpha > 0.01) as Celebration | undefined) ?? null;
    if (!this.calm) {
      for (const [i, tint] of [PAL.teal, PAL.violet].entries()) {
        const r = new Sprite(ribbonTex());
        r.anchor.set(0.5);
        r.tint = tint;
        r.blendMode = 'add';
        r.alpha = 0;
        r.rotation = i ? 0.16 : -0.2;
        this.ribbons.push(r);
        this.back.addChild(r);
      }
      for (const tint of [PAL.teal, PAL.violet, PAL.magenta]) {
        const n = new Sprite(softDot());
        n.anchor.set(0.5); n.tint = tint; n.blendMode = 'add'; n.alpha = 0;
        this.neb.push(n);
        this.back.addChild(n);
      }
      for (let i = 0; i < 18; i++) {
        const sp = new Sprite(rayTex());
        sp.anchor.set(0.5, 1);
        sp.tint = AURORA[i % 3];
        sp.blendMode = 'add';
        sp.alpha = 0;
        sp.rotation = (i / 18) * Math.PI * 2 + (crand() - 0.5) * 0.12;
        this.rays.push({ sp, len: 1.9 + crand() * 1.1, wid: 0.3 + crand() * 0.26, a: 0.13 + crand() * 0.09, ph: crand() * 6.28 });
        this.corona.addChild(sp);
      }
      this.back.addChild(this.corona);
      this.ring.anchor.set(0.5);
      this.ring.tint = PAL.ice;
      this.ring.blendMode = 'add';
      this.ring.alpha = 0;
      this.back.addChild(this.ring);
      for (let i = 0; i < 26; i++) {
        const front = i % 2 === 1, star = i % 5 === 0;
        const sp = new Sprite(star ? starTex() : softDot());
        sp.anchor.set(0.5);
        sp.tint = star ? PAL.ice : [PAL.teal, PAL.violet, PAL.mote][i % 3];
        sp.blendMode = 'add';
        sp.alpha = 0;
        this.motes.push({ sp, th: crand() * Math.PI * 2, w: 0.35 + crand() * 0.35, r: front ? 1.1 + crand() * 0.3 : 0.8 + crand() * 0.25, tw: crand() * 6.28, base: star ? 0.26 : 0.1 + crand() * 0.07, front, star });
        (front ? this.front : this.back).addChild(sp);
      }
    } else this.ring.visible = false;
    this.title = new IsText({ text: MOMENT_COPY.title, size: 20, style: 'ice', tracking: 0.34, decor: false });
    this.title.alpha = 0;
    this.front.addChild(this.title);
    if (o.n > 0 && !o.demo) {
      this.nr = new IsText({ text: MOMENT_COPY.nr(o.n), size: 12, style: 'ice', tracking: 0.28, decor: false });
      this.nr.alpha = 0;
      this.front.addChild(this.nr);
    }
    this.tabRoot.visible = false;
    this.front.addChild(this.tabRoot);
    this.plate.visible = false;
    this.front.addChild(this.plate);
    if (o.demo) {
      // the demo stays labelled from the first frame to the last
      this.band = new Container();
      const strip = new Sprite(bandTex());
      strip.anchor.set(0.5);
      const l1 = new Sprite(Texture.WHITE), l2 = new Sprite(Texture.WHITE);
      for (const l of [l1, l2]) { l.anchor.set(0.5); l.tint = AMBER; l.alpha = 0.55; }
      const tx = new IsText({ text: DEMO_CAPTION, size: 11, style: 'gold', tracking: 0.24, decor: false });
      this.band.addChild(strip, l1, l2, tx);
      this.front.addChild(this.band);
    }
    // back just above the layer's own dim (index 0), front on top
    layer.addChildAt(this.back, Math.min(1, layer.children.length));
    layer.addChild(this.front);
    this.base = { sky: h.w.skyGlowFloor, bloom: h.w.bloomCtl.strength, zoom: h.w.cam.zoom };
    this.measure();
    this.off = h.w.onFrame((dt) => this.frame(dt));
  }

  // ---------------------------------------------------------------- layout
  /** The die's band on screen: from the bottom of the header / Kp arc to the top of the card (stage px). */
  private zone(): { top: number; bottom: number } {
    const hud = this.h.hud, host = hud.root.getBoundingClientRect(), H = this.h.w.stage.h;
    let top = 0;
    for (const id of ['hdr', 'slot-arc']) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.width > 0 && r.bottom - host.top < H * 0.5) top = Math.max(top, r.bottom - host.top);
    }
    // the gamble card's top (a bottom sheet on phones); no card (the no-offer hero beat): the grid's bottom edge
    const card = hud.isShown('summary') && hud.summaryEl().classList.contains('gamble');
    const g = this.h.w.gridRect;
    const bottom = clamp(Math.min(H, top + 80), card ? hud.gambleCardTop() : Math.min(H * 0.8, g.y + g.size), H);
    return { top: Math.min(top, bottom - 80), bottom };
  }
  /** The largest die that fits: clamp(120, 0.34·min(W,H), 260), with the whole block (the title over it, NR or the
   *  tablets under it) inside the band at the camera's 1.04 push. */
  private measure(): void {
    const w = this.h.w, W = w.stage.w, H = w.stage.h, z = this.calm ? 1 : 1.04;
    const { top, bottom } = this.zone();
    this.zoneTop = top; this.zoneBottom = bottom;
    const want = clamp(120, 0.34 * Math.min(W, H), 260);
    const fit = (bottom - top - 16) / (1.92 * z);
    this.tS = Math.max(48, Math.min(want, fit, (W - 32) / 1.25));
    this.tx = W / 2;
    this.ty = (top + bottom) / 2;
    if (!this.placed) { this.placed = true; this.ax = this.tx; this.ay = this.ty; this.S = this.tS; }
  }
  /** Screen → layer px (the banners layer sits under the camera: zoom about the screen centre). */
  private loc(x: number, y: number): { x: number; y: number } {
    const w = this.h.w, z = w.cam.zoom || 1, cx = w.stage.w / 2, cy = w.stage.h / 2;
    return { x: cx + (x - cx) / z, y: cy + (y - cy) / z };
  }
  /** The anchor in layer px (where a die lands at p = 1). */
  anchor(): { x: number; y: number } { return this.loc(this.ax, this.ay); }

  // ---------------------------------------------------------------- the dice
  /** Insert a die under the front container (the plate and the words stay over the dice). */
  private put(d: DieUnit): void { if (d.parent !== this.layer) this.layer.addChildAt(d, this.layer.getChildIndex(this.front)); }
  /** Take a die into the moment: it blends from where it is now to its slot (screen px from the anchor) over `dur` s. */
  adopt(d: DieUnit, to: FanTo, dur: number, o: { ease?: (t: number) => number; delay?: number } = {}): void {
    this.put(d);
    const s: Slot = { d, from: { x: d.x, y: d.y, size: d.shown(), rot: d.st.rot }, to, p: dur > 0 ? 0 : 1, ease: o.ease ?? expoOut, a: d.alpha, k: 1 };
    this.slots.push(s);
    if (dur > 0) this.track(gsap.to(s, { p: 1, a: 1, duration: dur, delay: o.delay ?? 0, ease: 'none' }));
    else s.a = 1;
  }
  /** A die fading in at its slot (a restore): no travel. */
  place(d: DieUnit, to: FanTo, fade: number): void {
    this.put(d);
    const A = this.anchor(), z = this.h.w.cam.zoom || 1, S = this.S;
    const s: Slot = { d, from: { x: A.x + (to.dx * S) / z, y: A.y + (to.dy * S) / z, size: (to.size * S) / z, rot: to.rot }, to, p: 1, ease: expoOut, a: 0, k: 1 };
    this.slots.push(s);
    this.track(gsap.to(s, { a: 1, duration: fade, ease: 'sine.out' }));
  }
  /** Fan slots for c dice (from the anchor, in units of S): one = the hero; 2–3 = a payout split; more = a fan (≤ 8). */
  fanSlots(c: number): FanTo[] {
    const S = this.S, W = this.h.w.stage.w;
    if (c <= 1) return [{ dx: 0, dy: 0, size: 1, rot: 0 }];
    const f = c <= 3 ? 0.72 : Math.max(0.42, 0.62 - (c - 4) * 0.03);
    const sp = Math.min(c <= 3 ? 0.84 * f : 0.62 * f, (W - 48 - f * S) / (c - 1) / S);
    const mid = (c - 1) / 2;
    return Array.from({ length: c }, (_, i) => ({ dx: (i - mid) * sp, dy: Math.pow((i - mid) / Math.max(1, mid), 2) * f * 0.12, size: f, rot: (i - mid) * 0.018 }));
  }
  /** Draw order: the outer dice first, the centre on top. */
  private order(): void {
    const mid = (this.slots.length - 1) / 2;
    const sorted = this.slots.slice().sort((a, b) => Math.abs(this.slots.indexOf(b) - mid) - Math.abs(this.slots.indexOf(a) - mid));
    for (const s of sorted) { this.layer.removeChild(s.d); this.put(s.d); }
    if (this.thrower && this.ownThrower) { this.layer.removeChild(this.thrower); this.put(this.thrower); }
  }
  /** "+m" at the fan's right end (dice beyond the eighth). */
  setMore(m: number): void {
    this.moreN = Math.max(0, m);
    if (this.moreN <= 0) { this.moreText?.destroy(); this.moreText = null; return; }
    if (!this.moreText) { this.moreText = new IsText({ text: heldOverflow(this.moreN), size: 16, style: 'ice', tracking: 0.1, decor: false }); this.front.addChild(this.moreText); }
    this.moreText.text = heldOverflow(this.moreN);
    const last = this.slots[this.slots.length - 1];
    this.moreDx = last ? last.to.dx + last.to.size * 0.62 + 10 / this.S : 0;
  }
  /** The staged dice (layer order of their slots) and the "+m" beyond them. */
  dice(): DieUnit[] { return this.slots.map((s) => s.d); }
  count(): number { return this.slots.length + this.moreN; }
  /** Hand the staged dice over (flights take them): they leave the layout, at their current pose. */
  release(): { dice: DieUnit[]; more: number } {
    const dice = this.slots.map((s) => s.d), more = this.moreN;
    for (const s of this.slots) { gsap.killTweensOf(s); s.d.alpha = s.a; }
    this.slots = [];
    this.setMore(0);
    return { dice, more };
  }

  // ---------------------------------------------------------------- beats
  /** The FX and the words ramp in; world: the sky glow floor / bloom / camera ramps (not for a storm's fan). */
  open(): void {
    const calm = this.calm;
    this.phase = 'lift';
    if (this.cel) this.lv.shade = 1; // the celebration's dim hands over (constant light)
    else this.track(gsap.to(this.lv, { shade: 1, duration: calm ? 0.4 : 0.6, ease: 'sine.inOut' }));
    this.track(gsap.to(this.lv, { fx: 1, duration: calm ? 0.35 : 0.6, ease: 'sine.inOut' }));
    this.track(gsap.to(this.lv, { title: 1, duration: 0.45, delay: calm ? 0.1 : 0.4, ease: 'sine.out' }));
    if (this.nr) this.track(gsap.to(this.lv, { nr: 1, duration: 0.4, delay: calm ? 0.2 : 0.6 }));
    if (!calm) { this.title.reveal = 0; this.track(gsap.to(this.title, { reveal: 1, duration: 0.7, delay: 0.35, ease: 'power1.inOut' })); }
    if (this.worldFx) this.track(gsap.to(this.lv, { world: 1, duration: 0.6, ease: 'sine.inOut' }));
  }
  /** The die sits: the ice ring, hit-stop + shake (not calm), the layered chord (dieBirth + a year-bell dyad + the low
   *  pulse); the waiting bob and the glints begin. */
  arrive(sound: boolean): void {
    if (this.destroyed || this.phase !== 'lift') return; // a keep before the arrival: no ring, hit-stop or chord in flight
    const w = this.h.w, a = w.audio, calm = this.calm;
    this.phase = 'wait';
    this.bobOn = !calm && this.slots.length === 1;
    this.sweepAt = this.t + 0.3;
    if (!calm) {
      this.ringS.r = 0.55; this.ringS.a = 0.6;
      this.track(gsap.to(this.ringS, { r: 3.3, a: 0, duration: 1.2, ease: 'expo.out' }));
      this.track(gsap.fromTo(this.title, { sweep: -0.2 }, { sweep: 1.2, duration: 1.1, delay: 0.15, ease: 'sine.inOut' }));
      if (this.worldFx) { hitStop(70); w.shake(0.12); }
    }
    if (sound) {
      const now = a.now();
      a.play('dieBirth', { gain: 0.7 });
      a.play('diePulse');
      a.play('bell1948', { level: 1, gain: 0.5, when: now + 0.02 });
      a.play('bell1948', { level: 4, gain: 0.38, when: now + 0.14 });
    }
  }
  /** The throw of a committed result: the tablets appear (the winning ones lit from their first frame) and the die
   *  tumbles at a constant tempo from throwIn to throwEnd, where it rests. Nothing is revealed here. */
  throwStart(bet: GambleBet): void {
    const calm = this.calm, a = this.h.w.audio;
    this.phase = 'throw';
    this.bobOn = false;
    if (this.nr) this.track(gsap.to(this.lv, { nr: 0, duration: 0.2 }));
    this.buildTabs(new Set(winPips(bet)));
    this.tabRoot.visible = true;
    this.track(gsap.to(this.lv, { tabs: 1, duration: MOMENT_T.throwIn, ease: 'sine.out' }));
    if (this.slots.length > 1) {
      // a fan: one die is thrown for all of them, in front of the fan, which steps back
      const d = new DieUnit(this.S * 0.86, { halo: PAL.violet });
      d.st.halo = 0.2;
      d.alpha = 0;
      const A = this.anchor();
      d.position.set(A.x, A.y);
      this.thrower = d; this.ownThrower = true;
      this.put(d);
      this.track(gsap.to(d, { alpha: 1, duration: 0.25 }));
      this.track(gsap.to(this.lv, { fan: 0.35, duration: 0.3 }));
    } else this.thrower = this.slots[0]?.d ?? null;
    if (calm) { a.play('dieHold', { gain: 0.6 }); return; }
    const span = MOMENT_T.throwEnd - MOMENT_T.throwIn;
    this.hop.u = 0; this.hop.on = true;
    this.track(gsap.to(this.hop, { u: span, duration: span, delay: MOMENT_T.throwIn, ease: 'none' }));
    // two ticks per hop on one grid, one pitch: dieLand on each landing, dieHold at each apex; the grid's next beat
    // (the rest at throwEnd) is reveal()'s dieLand
    a.rattle(a.now() + MOMENT_T.throwIn + MOMENT_T.hop, Math.round(span / MOMENT_T.hop) * 2 - 2, MOMENT_T.hop / 2);
  }
  /** At throwEnd (the Game's reveal): the die rests, the drawn tablet lights once, the pip plate appears. */
  reveal(pip: number): void {
    const calm = this.calm;
    this.phase = 'result';
    this.hop.on = false;
    const d = this.thrower;
    if (d && !d.destroyed) { Object.assign(d.st, { rot: 0, flipX: 0, flipY: 0 }); d.apply(); }
    this.h.w.audio.play('dieLand');
    const t = this.tabs.find((x) => x.pip === pip);
    if (t) {
      t.drawn = true;
      this.track(gsap.to(t.hi, { v: 1, duration: 0.3, ease: 'sine.out' }));
      if (!calm) this.track(gsap.fromTo(t.root.scale, { x: 1, y: 1 }, { x: 1.14, y: 1.14, duration: 0.28, ease: 'back.out(2)' }));
    }
    const pl = new Sprite(plateTex());
    pl.anchor.set(0.5);
    this.plateText = new IsText({ text: String(pip), size: 30, style: 'ice', decor: false });
    this.plate.addChild(pl, this.plateText);
    this.plate.visible = true;
    this.track(gsap.to(this.lv, { plate: 1, duration: calm ? 0.3 : 0.18 }));
    if (!calm) this.track(gsap.fromTo(this.plate.scale, { x: 0.6, y: 0.6 }, { x: 1, y: 1, duration: 0.32, ease: 'back.out(1.8)' }));
  }
  /** Win: the plate gives way and the staged dice become `n` (≤ 8 shown, "+m" beyond): clones fan out from the centre
   *  with a glint burst, the corona brightens (a ramp), a second ice ring, the year-bell sting. `fast`: ≤ 300 ms. */
  split(n: number, fast: boolean): void {
    const a = this.h.w.audio, calm = this.calm, w = this.h.w;
    this.phase = 'settle';
    this.track(gsap.to(this.lv, { plate: 0, duration: fast ? 0.12 : 0.25 }));
    this.dropThrower(fast ? 0.12 : 0.25);
    const c = Math.min(8, Math.max(1, n)), to = this.fanSlots(c), A = this.anchor(), z = w.cam.zoom || 1;
    const dur = fast || calm ? 0.25 : 0.55;
    const ease = calm ? expoOut : backOut;
    for (let i = 0; i < c; i++) {
      let s = this.slots[i];
      if (!s) {
        const d = new DieUnit(to[i].size * this.S, { halo: PAL.violet });
        d.st.halo = 0.25;
        d.position.set(A.x, A.y);
        d.st.sc = 0.4; d.st.rot = calm ? 0 : -0.25 * Math.sign(i - (c - 1) / 2 || 1);
        d.alpha = 0;
        this.put(d);
        s = { d, from: { x: A.x, y: A.y, size: (0.4 * to[i].size * this.S) / z, rot: d.st.rot }, to: to[i], p: 0, ease, a: 0, k: 1 };
        this.slots.push(s);
      } else {
        s.from = { x: s.d.x, y: s.d.y, size: s.d.shown(), rot: s.d.st.rot };
        s.to = to[i]; s.p = 0; s.ease = ease;
      }
      this.track(gsap.to(s, { p: 1, a: 1, duration: dur, delay: calm || fast ? 0 : 0.05 * Math.abs(i - (c - 1) / 2), ease: 'none' }));
    }
    for (const s of this.slots.splice(c)) s.d.kill(); // (a fan never shrinks on a win: defensive)
    this.order();
    this.setMore(n - c);
    if (!calm && !fast) {
      for (let i = 0; i < 16; i++) w.particles.emit('glint', A.x, A.y, 1, { color: [PAL.ice, PAL.teal, PAL.violet][i % 3], speed: 220, life: 0.7, size: 0.55 });
      this.track(gsap.to(this.lv, { cor: 1, duration: 0.6, ease: 'sine.inOut' }));
      this.ringS.r = 0.6; this.ringS.a = 0.5;
      this.track(gsap.to(this.ringS, { r: 3.0, a: 0, duration: 1.1, ease: 'expo.out' }));
    }
    const now = a.now();
    a.play('bell1948', { level: 5, gain: 0.42, when: now });
    a.play('bell1948', { level: 8, gain: 0.32, when: now + 0.12 });
  }
  /** A fan's thrown die gives way (the fan comes back to the front). */
  private dropThrower(dur: number): void {
    const d = this.thrower;
    this.thrower = null;
    this.hop.on = false;
    if (!d || !this.ownThrower) return;
    this.ownThrower = false;
    this.track(gsap.to(d, { alpha: 0, duration: dur, onComplete: () => d.kill() }));
    this.track(gsap.to(this.lv, { fan: 1, duration: dur }));
  }
  /** Loss: the neutral returnTick; every staged die (and a fan's thrown die) frosts over, cracks and dissolves into
   *  drifting snow while the FX ramp out. Resolves when all of it is gone. `fast`: ≤ 300 ms. */
  frostOut(fast: boolean): Promise<void> {
    const a = this.h.w.audio, calm = this.calm, w = this.h.w;
    this.phase = 'settle';
    a.play('returnTick', { gain: calm ? 0.55 : 0.8 });
    const own = this.thrower && this.ownThrower ? this.thrower : null;
    this.thrower = null; this.ownThrower = false; this.hop.on = false;
    const k = fast ? 0.3 / 1.6 : 1;
    return new Promise<void>((res) => {
      const tl = this.track(gsap.timeline({ onComplete: () => res() }));
      tl.to(this.lv, { plate: 0, duration: 0.3 * k }, 0.45 * k);
      const units: { d: DieUnit; fade: object; key: 'a' | 'alpha'; grow: object | null }[] = [
        ...this.slots.map((s) => ({ d: s.d, fade: s, key: 'a' as const, grow: s })),
        ...(own ? [{ d: own, fade: own, key: 'alpha' as const, grow: null }] : []),
      ];
      for (const u of units) {
        const d = u.d;
        if (d.destroyed) continue;
        d.enableFrost();
        tl.to(d.st, { frost: 1, halo: 0, duration: 0.45 * k, ease: 'sine.inOut', onUpdate: d.apply }, 0)
          .to(d.st, { crack: 1, duration: 0.25 * k, onUpdate: d.apply }, 0.35 * k)
          .to(u.fade, { [u.key]: 0, duration: 0.7 * k, ease: 'sine.in' }, 0.75 * k);
        if (u.grow && !calm && !fast) tl.to(u.grow, { k: 1.05, duration: 0.7, ease: 'sine.out' }, 0.75);
      }
      if (own) tl.call(() => own.kill(), [], 1.46 * k);
      if (!calm && !fast) {
        const snow = () => {
          for (const u of units) {
            const d = u.d;
            if (d.destroyed) continue;
            const g = d.getGlobalPosition(), s = d.shown();
            w.particles.emit('snow', g.x, g.y, Math.round(clamp(6, s / 12, 14)), { color: PAL.ice, speed: 30, spread: Math.PI * 2, angle: Math.PI / 2, gravity: 24, life: 2.4, size: clamp(0.35, s / 110, 0.8) });
          }
        };
        tl.call(snow, [], 0.75).call(snow, [], 0.95).call(snow, [], 1.15);
      }
      // the light comes back as a ramp ≥ 300 ms, also when hurried
      tl.to(this.lv, { fx: 0, world: 0, cor: 0.5, title: 0, nr: 0, tabs: 0, shade: 0, duration: fast ? 0.3 : 0.6, ease: 'sine.inOut' }, fast ? 0 : 0.9);
    });
  }
  /** The FX, the words and the world ramps out (the dice stay for their flights); never faster than 300 ms. */
  fadeFx(dur: number): Promise<void> {
    dur = Math.max(0.3, dur);
    this.phase = 'settle';
    this.bobOn = false;
    return new Promise<void>((res) => { this.track(gsap.to(this.lv, { fx: 0, world: 0, title: 0, nr: 0, tabs: 0, plate: 0, shade: 0, duration: dur, ease: 'sine.inOut', onComplete: () => res() })); });
  }
  /** Every running tween of the moment ends within `s` seconds (a skip; never used on the throw). */
  hurry(s = 0.3): void {
    for (const tw of this.tweens) if (tw.isActive() || (tw.progress() === 0 && !tw.paused())) { const left = tw.totalDuration() - tw.totalTime() + Math.max(0, (tw as gsap.core.Tween).delay?.() ?? 0); if (left > s) tw.timeScale(left / s); }
  }
  private track<T extends gsap.core.Tween | gsap.core.Timeline>(t: T): T {
    this.tweens.push(t);
    if (this.tweens.length > 64) this.tweens = this.tweens.filter((x) => x.progress() < 1);
    return t;
  }

  // ---------------------------------------------------------------- tablets
  private buildTabs(win: Set<number>): void {
    for (const t of this.tabs) t.root.destroy({ children: true });
    this.tabs = [];
    for (let pip = 1; pip <= GAMBLE_SIDES; pip++) {
      const root = new Container();
      const glow = new Sprite(softDot());
      glow.anchor.set(0.5); glow.blendMode = 'add';
      glow.tint = pip % 2 ? PAL.teal : PAL.violet;
      const sp = new Sprite(tabletTex(pip));
      sp.anchor.set(0.5);
      const ring = new Sprite(ringTex());
      ring.anchor.set(0.5); ring.blendMode = 'add'; ring.tint = PAL.ice;
      root.addChild(glow, sp, ring);
      // lit statically from the first frame: the state never changes before the reveal
      this.tabs.push({ pip, lit: win.has(pip), drawn: false, root, sp, glow, ring, hi: { v: 0 } });
      this.tabRoot.addChild(root);
    }
  }
  /** QA: the tablets (pip, lit, drawn, visible) and their bounds on screen. */
  qaTabs(): { pip: number; lit: boolean; drawn: boolean; shown: boolean; x: number; y: number; w: number; h: number }[] {
    return this.tabs.map((t) => { const b = t.sp.getBounds(); return { pip: t.pip, lit: t.lit, drawn: t.drawn, shown: this.tabRoot.visible && t.sp.alpha > 0.01, x: b.minX, y: b.minY, w: b.width, h: b.height }; });
  }

  // ---------------------------------------------------------------- per frame
  private frame(dt: number): void {
    if (this.destroyed) return;
    const w = this.h.w, calm = this.calm, fdt = clock.fxDt; // ambient motion freezes in a hit-stop
    this.t += fdt;
    this.measure();
    const k = 1 - Math.exp(-dt / 0.12);
    this.ax += (this.tx - this.ax) * k; this.ay += (this.ty - this.ay) * k; this.S += (this.tS - this.S) * k;
    const lv = this.lv, S = this.S;
    // world ramps: sky glow floor, bloom, camera push (ramps both ways; restored exactly at dispose)
    if (this.worldFx) {
      w.skyGlowFloor = Math.max(this.base.sky, lerp(this.base.sky, 0.42, lv.world));
      w.bloomCtl.strength = this.base.bloom + 0.25 * lv.world;
      if (!calm) w.cam.zoom = this.base.zoom + 0.04 * lv.world;
    }
    const z = w.cam.zoom || 1, sl = S / z;
    const A = this.loc(this.ax, this.ay);
    // the staged dice
    const bob = this.bobOn ? Math.sin(this.t * ((Math.PI * 2) / 2.4)) * 4 : 0;
    for (const s of this.slots) {
      const d = s.d;
      if (d.destroyed) continue;
      const e = s.ease(clamp(0, s.p, 1));
      d.x = lerp(s.from.x, A.x + (s.to.dx * S) / z, e);
      d.y = lerp(s.from.y, A.y + (s.to.dy * S) / z, e) + bob / z;
      d.st.sc = (lerp(s.from.size, (s.to.size * S) / z, e) * s.k) / d.size;
      d.st.rot = lerp(s.from.rot, s.to.rot, e);
      d.alpha = s.a * (this.ownThrower ? lv.fan : 1);
      d.apply();
    }
    // the throw: a constant tempo on the game clock (4 turns, 11 hops, two flip axes), resting exactly at throwEnd
    const thr = this.thrower;
    if (thr && !thr.destroyed) {
      if (this.ownThrower) { thr.x = A.x; thr.y = A.y; thr.st.sc = (S * 0.86) / z / thr.size; }
      if (this.hop.on && !calm) {
        const span = MOMENT_T.throwEnd - MOMENT_T.throwIn, u = clamp(0, this.hop.u, span);
        thr.st.rot = (4 * u) / span;
        thr.st.flipX = u / (MOMENT_T.hop * 2);
        thr.st.flipY = (3 * u) / span;
        thr.x += (Math.sin(u * 37.7) * 0.012 * S) / z;
        thr.y -= (Math.abs(Math.sin((Math.PI * u) / MOMENT_T.hop)) * 0.1 * S) / z;
      }
      thr.apply();
    }
    // waiting: a specular sweep every 1,4 s
    if (this.phase === 'wait' && !calm && this.t >= this.sweepAt) {
      this.sweepAt = this.t + 1.4;
      for (const s of this.slots) { s.d.enableGlint(); s.d.sweep(0.5); }
    }
    // FX
    const fx = lv.fx;
    // the stage dim: 0.55 × shade, less whatever a closing celebration still darkens (its dim is 0.55 × its alpha)
    const L = 0.55 * lv.shade, cel = this.cel && !this.cel.destroyed && this.cel.visible ? 0.55 * this.cel.alpha : 0;
    this.shade.alpha = clamp(0, 1 - (1 - L) / Math.max(0.05, 1 - cel), 1);
    this.shade.position.set(0, 0);
    this.shade.width = w.stage.w; this.shade.height = w.stage.h;
    this.dim.position.set(A.x, A.y);
    this.dim.width = this.dim.height = sl * 4.4;
    this.dim.alpha = 0.58 * fx;
    for (const [i, r] of this.ribbons.entries()) {
      r.width = sl * 4.2; r.height = sl * 1.25;
      r.position.set(A.x + Math.sin(this.t * 0.33 + i * 2.1) * sl * 0.2, A.y + (i ? 0.34 : -0.42) * sl);
      r.rotation = (i ? 0.16 : -0.2) + Math.sin(this.t * 0.21 + i) * 0.05;
      r.alpha = fx * (0.26 + 0.07 * Math.sin(this.t * 0.7 + i * 1.7));
    }
    for (const [i, n] of this.neb.entries()) {
      const a = this.t * 0.4 + (i * Math.PI * 2) / 3;
      n.position.set(A.x + Math.cos(a) * sl * 0.16, A.y + Math.sin(a) * sl * 0.1);
      n.width = n.height = sl * (i === 2 ? 1.7 : 2.3);
      n.alpha = fx * (i === 2 ? 0.16 : 0.26) * (0.85 + 0.15 * Math.sin(this.t * 0.8 + i * 2));
    }
    if (this.rays.length) {
      this.corona.position.set(A.x, A.y);
      this.corona.rotation += fdt * 0.055;
      const cs = 1 + 0.2 * clamp(0, (lv.cor - 0.75) / 0.25, 1);
      for (const r of this.rays) {
        r.sp.width = sl * r.wid;
        r.sp.height = sl * r.len * cs * (1 + 0.06 * Math.sin(this.t * 0.9 + r.ph));
        r.sp.alpha = Math.min(0.22, r.a * fx * (0.62 + 0.5 * lv.cor));
      }
      this.ring.position.set(A.x, A.y);
      this.ring.width = this.ring.height = sl * this.ringS.r;
      this.ring.alpha = this.ringS.a;
      for (const m of this.motes) {
        m.th += fdt * m.w;
        const ea = sl * m.r * 0.95, eb = sl * m.r * 0.34, tilt = -0.2;
        const ex = Math.cos(m.th) * ea, ey = Math.sin(m.th) * eb, depth = Math.sin(m.th); // +1: nearest
        m.sp.position.set(A.x + ex * Math.cos(tilt) - ey * Math.sin(tilt), A.y + ex * Math.sin(tilt) + ey * Math.cos(tilt));
        const vis = m.front ? clamp(0, depth * 1.4 + 0.2, 1) : clamp(0, 1 - depth, 1);
        m.sp.width = m.sp.height = sl * m.base * (0.7 + 0.25 * (depth + 1)) * (m.star ? 1.5 : 1);
        m.sp.alpha = fx * vis * (0.55 + 0.35 * Math.sin(this.t * 2.3 + m.tw)) * 0.9;
      }
    }
    // the words
    const ts = Math.round(clamp(16, 0.16 * S, 34));
    if (this.title.size !== ts) this.title.size = ts;
    this.title.scale.set(1 / z);
    this.title.position.set(A.x, A.y - (S / 2 + 0.22 * S) / z);
    this.title.alpha = lv.title;
    if (this.nr) {
      const ns = Math.round(clamp(11, 0.085 * S, 19));
      if (this.nr.size !== ns) this.nr.size = ns;
      this.nr.scale.set(1 / z);
      this.nr.position.set(A.x, A.y + (S / 2 + 0.15 * S) / z);
      this.nr.alpha = 0.85 * lv.nr;
    }
    if (this.moreText) {
      const ms = Math.round(clamp(12, 0.12 * S, 22));
      if (this.moreText.size !== ms) this.moreText.size = ms;
      this.moreText.scale.set(1 / z);
      this.moreText.position.set(A.x + (this.moreDx * S) / z, A.y);
      this.moreText.alpha = this.slots.length ? Math.max(lv.fan, 0.4) * Math.max(...this.slots.map((s) => s.a)) : 0;
    }
    if (this.band) {
      const W = w.stage.w, bh = 26, p = this.loc(W / 2, this.zoneTop + bh / 2 + 4);
      const [strip, l1, l2] = this.band.children as Sprite[];
      strip.width = W; strip.height = bh * 1.35;
      l1.width = l2.width = Math.min(W, 520); l1.height = l2.height = 1;
      l1.position.set(0, -bh / 2); l2.position.set(0, bh / 2);
      this.band.scale.set(1 / z);
      this.band.position.set(p.x, p.y);
    }
    // the tablets: a shallow arc under the die
    if (this.tabRoot.visible) {
      const tb = Math.max(24, Math.min(0.28 * S, 56, (w.stage.w - 32) / 6.9)), gap = tb * 0.18, y = S / 2 + 0.1 * S + tb / 2;
      const n = this.tabs.length, mid = (n - 1) / 2, span = tb + gap;
      for (const [i, t] of this.tabs.entries()) {
        const u = (i - mid) / mid;
        t.root.position.set(A.x + ((i - mid) * span) / z, A.y + (y - u * u * tb * 0.3) / z);
        t.root.rotation = u * 0.08;
        t.sp.width = t.sp.height = tb / z;
        t.glow.width = t.glow.height = (tb * 2.1) / z;
        t.ring.width = t.ring.height = (tb * 1.55) / z;
        // dim ice → lit aurora (static from the first frame) → drawn (a white ring and a raise, once, at the reveal)
        t.sp.tint = t.lit ? (t.pip % 2 ? 0xc8fff6 : 0xe4d8ff) : PAL.frost;
        t.sp.alpha = lv.tabs * (t.lit ? 1 : 0.5 + 0.45 * t.hi.v);
        t.glow.alpha = lv.tabs * ((t.lit ? 0.7 : 0) + t.hi.v * 0.25);
        t.ring.alpha = lv.tabs * t.hi.v * 0.85;
      }
    }
    // the pip plate in front of the thrown die
    if (this.plate.visible) {
      const ps = 0.56 * S, [pl] = this.plate.children as Sprite[];
      this.plate.position.set(A.x, A.y);
      if (pl) pl.width = pl.height = ps / z;
      if (this.plateText) { const s = Math.round(ps * 0.46); if (this.plateText.size !== s) this.plateText.size = s; this.plateText.scale.set(1 / z); }
      this.plate.alpha = lv.plate;
    }
  }

  /** Everything off: the world ramps restored exactly, the frame hook removed, every object destroyed (dice still
   *  staged are killed too; released dice belong to their flights). */
  dispose(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.off();
    for (const tw of this.tweens) tw.kill();
    this.tweens = [];
    const w = this.h.w;
    if (this.worldFx) {
      w.skyGlowFloor = this.base.sky;
      w.bloomCtl.strength = this.base.bloom;
      if (!this.calm) w.cam.zoom = this.base.zoom;
    }
    w.audio.stopRattle();
    for (const s of this.slots) { gsap.killTweensOf(s); s.d.kill(); }
    this.slots = [];
    if (this.thrower && this.ownThrower) this.thrower.kill();
    this.thrower = null;
    this.back.destroy({ children: true });
    this.front.destroy({ children: true });
  }
}
