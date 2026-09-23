// Terningenichen: the ONLY dice home. The user's die floats over an ice ledge in a small niche of frosted ice glass
// (phones: right above SPIN, in the band between the grid frame and the deck; desktop ≥ 1000 px and 5/4: the last block
// of #sideR). Its idle life (bob, glint, rattle) runs only while :root.vault-active (idle and quiet, driven by the Game
// through Hud.setVaultActive), the tab is visible and the niche is on screen, and never in calm. Only transform and
// opacity animate (CSS + WAAPI); a glint repaints the die canvas for ~450 ms. Timings draw from a local stream seeded
// once from cosmeticRng, so the shared cosmetic stream stays deterministic under the tests' stepped clock.
// The ids #diceBtn, #diceIco, #diceN, #diceW and #diceLink are kept: diceTarget(), the hello card, dice-check.
import { crand } from '../core/cosmeticRng.ts';
import { CONFIG } from '../math/config.ts';
import { bus } from '../game/bus.ts';
import { fmtDice, diceWord, type DiceView } from '../game/dice.ts';
import { chipAria, demoTag, PANEL, TIPS } from './diceCopy.ts';
import { paintDie, paintDieLit, onDiePainterChange, type DieState } from './diceIcon.ts';

export const vaultMarkup = (): string => `<div id="vault" class="vault zero" data-unlock="none">
  <h4 class="v-h">${PANEL.h}</h4>
  <button class="v-btn" id="diceBtn" aria-label="${chipAria(0, 'none')}" title="${TIPS.vault}">
    <span class="v-niche" aria-hidden="true">
      <span class="v-aura"><i></i></span>
      <span class="v-rim"><i></i></span>
      <span class="v-glass"></span>
      <span class="v-glow"></span>
      <span class="v-ledge"></span>
      <span class="v-shadow"></span>
      <span class="v-bob"><span class="v-dip"><span class="v-rat"><span class="v-tilt">
        <canvas class="ico" id="diceIco"></canvas>
        <canvas class="ico v-frozen"></canvas>
        <span class="v-ice"></span>
        <span class="v-spec"></span>
        <i class="v-star"></i><i class="v-star"></i>
      </span></span></span></span>
      <span class="v-catch"></span>
      <span class="v-puff"></span>
    </span>
    <span class="v-count"><span class="n num" id="diceN"><span class="cur">0</span></span><span class="w" id="diceW"> terninger</span></span>
  </button>
  <button class="linkbtn v-link" id="diceLink" title="${TIPS.link}">${PANEL.link}</button>
</div>`;

const DESK = '(min-width: 1000px) and (min-aspect-ratio: 5/4)';
const HOVER = '(hover: hover) and (pointer: fine)';
/** Where the stars twinkle (fractions of the die box): near its corners. */
const STAR_AT: [number, number][] = [[0.16, 0.2], [0.84, 0.18], [0.86, 0.8], [0.14, 0.78], [0.5, 0.06]];
/** The niche hides on the splash, in the chamber and the ceremony and through the storm's molten phases (from
 *  stormOutro it is back, so the released dice land on it). */
const AWAY = new Set(['boot', 'splash', 'chamber', 'ceremony', 'demoLapse', 'stormTransition', 'stormReady', 'stormSpinning', 'stormSummary']);
/** The grid frame's rim beyond the grid square (px). */
const RIM = 7;

const easeInOut = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2; // sine: the band never lingers at the edges
const clamp = (a: number, v: number, b: number) => Math.max(a, Math.min(b, v));

export class Vault {
  readonly el: HTMLElement;
  readonly btn: HTMLElement;
  readonly ico: HTMLCanvasElement;
  readonly link: HTMLElement;
  private niche: HTMLElement;
  private frozen: HTMLCanvasElement;
  private n: HTMLElement;
  private w: HTMLElement;
  private tilt: HTMLElement;
  private dip: HTMLElement;
  private rat: HTMLElement;
  private ice: HTMLElement;
  private catchEl: HTMLElement;
  private puff: HTMLElement;
  private stars: HTMLElement[];
  private shown = -1;
  private unlock: DiceView['unlock'] = 'none';
  private active = false;
  private glintT = 0;
  private rattleT = 0;
  private raf = 0;
  private px = 0;
  private angle = Math.PI / 4;
  private hoverGlintAt = 0;
  private rnd: (() => number) | null = null;

  constructor(root: ParentNode) {
    this.el = root.querySelector('#vault') as HTMLElement;
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector(s) as T;
    this.btn = q('#diceBtn');
    this.ico = q<HTMLCanvasElement>('#diceIco');
    this.link = q('#diceLink');
    this.niche = q('.v-niche');
    this.frozen = q<HTMLCanvasElement>('.v-frozen');
    this.n = q('#diceN');
    this.w = q('#diceW');
    this.tilt = q('.v-tilt');
    this.dip = q('.v-dip');
    this.rat = q('.v-rat');
    this.ice = q('.v-ice');
    this.catchEl = q('.v-catch');
    this.puff = q('.v-puff');
    this.stars = Array.from(this.el.querySelectorAll<HTMLElement>('.v-star'));
    onDiePainterChange(() => this.repaint(true));
    matchMedia(DESK).addEventListener('change', () => this.mount());
    window.addEventListener('resize', () => { this.repaint(); this.fit(); });
    document.addEventListener('visibilitychange', () => this.schedule());
    // the storm's one choice (after its summary, the frame still molten) is a molten phase too: the fan holds the dice
    // and the outro releases them, so the niche comes back with stormOutro
    bus.on('state', ({ to }) => {
      const stormChoice = (to === 'gambleOffer' || to === 'gambleReveal') && document.documentElement.dataset.mode === 'storm';
      document.documentElement.classList.toggle('vault-away', AWAY.has(to) || stormChoice);
    });
    this.wireHover();
  }

  // ---------------------------------------------------------------- placement
  /** Phones: inside SPIN's column (absolute, right above it); desktop: the last block of #sideR. */
  mount(): void {
    const desk = matchMedia(DESK).matches;
    const host = desk ? document.getElementById('sideR') : document.querySelector<HTMLElement>('#deck .spin-col');
    if (host && (this.el.parentElement !== host || host.lastElementChild !== this.el)) host.appendChild(this.el);
    this.el.classList.toggle('desk', desk);
    this.repaint(true);
    this.fit();
  }
  /** Phones: the Netto line ends before the niche, and #slot-grid gives up just enough height at its bottom that the
   *  grid frame (a square centred in it, 3,5 % pad, like World.layout) clears the niche by 4 px. Desktop: nothing. */
  fit(): void {
    const slot = document.getElementById('slot-grid'), win = document.getElementById('winstrip');
    if (!slot || !win) return;
    slot.style.marginBottom = '';
    win.style.marginRight = '';
    if (this.el.classList.contains('desk') || document.documentElement.classList.contains('nodice')) return;
    const n = this.niche.getBoundingClientRect();
    if (n.width < 1) return;
    const wr = win.getBoundingClientRect();
    // the Netto line ends 10 px before the niche and before SPIN's column (its 3 s ring reaches 4 px past the button)
    const spin = document.getElementById('spinBtn')?.getBoundingClientRect();
    const left = Math.min(n.left, spin && spin.width > 0 ? spin.left - 4 : n.left);
    if (n.top < wr.bottom && n.bottom > wr.top) win.style.marginRight = Math.ceil(wr.right - left + 10) + 'px';
    const s = slot.getBoundingClientRect(), cols = CONFIG.cols;
    let m = 0;
    for (; m < 200; m++) {
      const h = s.height - m, pad = Math.max(10, Math.min(s.width, h) * 0.035);
      const size = Math.floor(Math.max(120, Math.min(s.width - pad * 2, h - pad * 2)) / cols) * cols;
      const x0 = s.left + (s.width - size) / 2 - RIM, x1 = x0 + size + 2 * RIM, y1 = s.top + (h - size) / 2 + size + RIM;
      if (y1 <= n.top - 4 || x1 <= n.left - 4 || x0 >= n.right + 4) break;
    }
    if (m) slot.style.marginBottom = m + 'px';
  }
  /** The niche box (layout, without the die's bob): for the hello card and the tour. */
  nicheRect(): DOMRect { return this.niche.getBoundingClientRect(); }
  /** The die's centre and size in `host` px (the flights land here, re-measured every frame). */
  target(host: DOMRect): { x: number; y: number; size: number } | null {
    const r = this.ico.getBoundingClientRect();
    if (r.width <= 0) return null;
    return { x: r.left + r.width / 2 - host.left, y: r.top + r.height / 2 - host.top, size: r.width };
  }

  // ---------------------------------------------------------------- state
  /** Status only: a count, never a fraction. `enabled` = idle (a tap opens the chamber); otherwise aria-disabled. */
  set(shown: number, o: { unlock: DiceView['unlock']; enabled: boolean }): void {
    this.btn.setAttribute('aria-label', chipAria(shown, o.unlock));
    this.btn.setAttribute('aria-disabled', String(!o.enabled));
    this.link.setAttribute('aria-disabled', String(!o.enabled));
    if (o.unlock !== this.unlock) { this.unlock = o.unlock; this.el.dataset.unlock = o.unlock; }
    if (shown === this.shown) return;
    const first = this.shown < 0;
    this.shown = shown;
    this.el.classList.toggle('zero', shown === 0);
    this.n.innerHTML = `<span class="cur">${fmtDice(shown)}</span>`;
    this.w.textContent = ' ' + diceWord(shown);
    if (first) this.repaint(true);
  }
  /** A landing: the catch (a ring pulse, the count rolls, a small aurora puff, the die dips 3 px); the first landing
   *  thaws the frozen die. Calm: a static ring and a crossfade, nothing moves. */
  land(n: number, calm: boolean): void {
    const was = this.shown;
    const old = this.n.querySelector('.cur');
    this.shown = n;
    this.el.classList.toggle('zero', n === 0);
    this.w.textContent = ' ' + diceWord(n);
    const nxt = document.createElement('span');
    nxt.className = 'cur in';
    nxt.textContent = fmtDice(n);
    this.n.querySelectorAll('.old').forEach((e) => e.remove());
    if (old) { old.className = 'old out'; setTimeout(() => old.remove(), 260); }
    this.n.appendChild(nxt);
    void nxt.offsetWidth;
    nxt.classList.remove('in');
    if (was === 0 && n > 0) this.thaw(calm);
    if (calm) {
      this.catchEl.animate([{ opacity: 0 }, { opacity: 0.8, offset: 0.34 }, { opacity: 0 }], { duration: 900, easing: 'linear' });
      return;
    }
    // every brightening is a ramp of ≥ 300 ms (photosensitivity), also on this small ring
    this.catchEl.animate([
      { opacity: 0, transform: 'scale(.72)' }, { opacity: 0.85, transform: 'scale(.95)', offset: 0.32 }, { opacity: 0, transform: 'scale(1.5)' },
    ], { duration: 940, easing: 'linear' });
    this.puff.animate([
      { opacity: 0, transform: 'translate(-50%, 6px) scale(.55)' }, { opacity: 0.7, transform: 'translate(-50%, -4px) scale(.9)', offset: 0.3 },
      { opacity: 0, transform: 'translate(-50%, -30px) scale(1.4)' },
    ], { duration: 1000, easing: 'cubic-bezier(.2,.7,.3,1)' });
    this.dip.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(3px)', offset: 0.3 }, { transform: 'translateY(0)' }], { duration: 440, easing: 'cubic-bezier(.2,.7,.3,1)' });
  }
  /** The first landing: the ice lets go of the die (a crossfade to full colour and a burst of ice glints). */
  private thaw(calm: boolean): void {
    const d = calm ? 500 : 900;
    this.frozen.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d, easing: 'ease-out' });
    this.ice.animate([{ opacity: 1, transform: 'rotate(-6deg) scale(1)' }, { opacity: 0, transform: calm ? 'rotate(-6deg) scale(1)' : 'rotate(-6deg) scale(1.1)' }], { duration: d, easing: 'ease-out' });
    if (calm) return;
    const host = this.tilt;
    for (let i = 0; i < 7; i++) {
      const s = document.createElement('i');
      s.className = 'v-shard';
      host.appendChild(s);
      const a = (i / 7) * Math.PI * 2 + this.r() * 0.6, dist = 0.55 + this.r() * 0.35;
      const x = Math.cos(a) * dist * this.px, y = Math.sin(a) * dist * this.px;
      s.animate([
        { opacity: 0.95, transform: 'translate(-50%, -50%) rotate(0deg) scale(1)' },
        { opacity: 0, transform: `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px)) rotate(${Math.round(this.r() * 240 - 120)}deg) scale(.4)` },
      ], { duration: 700 + this.r() * 300, easing: 'cubic-bezier(.15,.7,.3,1)' }).onfinish = () => s.remove();
    }
    this.twinkle(2, 250);
  }
  /** The demo landing: the amber "+n demo" beside the niche for 1,5 s; the number never changes. */
  demoTag(n = 1): void {
    const t = document.createElement('span');
    t.className = 'dice-demo-tag';
    t.textContent = demoTag(n);
    this.btn.appendChild(t);
    setTimeout(() => t.remove(), 1500);
  }
  focus(): void { this.btn.focus({ preventScroll: true }); }

  // ---------------------------------------------------------------- idle life
  /** Idle and quiet (Hud.setVaultActive): the only time the niche bobs, glints and rattles. */
  setActive(b: boolean): void {
    if (b === this.active) return;
    this.active = b;
    this.schedule();
  }
  private r(): number {
    if (!this.rnd) {
      let s = Math.floor(crand() * 4294967296) >>> 0 || 1; // one draw, then a local mulberry32
      this.rnd = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    return this.rnd();
  }
  private schedule(): void {
    clearTimeout(this.glintT); clearTimeout(this.rattleT);
    this.glintT = this.rattleT = 0;
    if (!this.active || document.hidden) return;
    this.glintT = window.setTimeout(() => this.onGlint(), 4000 + this.r() * 3000);
    this.rattleT = window.setTimeout(() => this.onRattle(), 20000 + this.r() * 20000);
  }
  private calm(): boolean { return document.documentElement.classList.contains('calm'); }
  /** Idle life may run now: active, the tab visible, not calm, and the niche on screen. */
  private live(): boolean {
    if (!this.active || document.hidden || this.calm() || !this.el.isConnected) return false;
    const c = getComputedStyle(this.el);
    return c.display !== 'none' && c.visibility !== 'hidden' && +c.opacity > 0.5 && this.niche.getBoundingClientRect().width > 0;
  }
  private onGlint(): void {
    this.glintT = 0;
    if (this.live()) this.glint();
    if (this.active && !document.hidden) this.glintT = window.setTimeout(() => this.onGlint(), 4000 + this.r() * 3000);
  }
  private onRattle(): void {
    this.rattleT = 0;
    if (this.live()) this.rattle();
    if (this.active && !document.hidden) this.rattleT = window.setTimeout(() => this.onRattle(), 20000 + this.r() * 20000);
  }
  private state(): DieState { return this.shown === 0 ? 'frozen' : 'die'; }
  /** A specular band sweeps the die (~450 ms, 'source-atop' on its canvas) and 1–2 tiny stars twinkle at its corners. */
  private glint(ms = 450): void {
    const cv = this.shown === 0 ? this.frozen : this.ico, px = this.px, st = this.state(), ang = this.angle;
    if (px <= 0) return;
    cancelAnimationFrame(this.raf);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = (now - t0) / ms;
      if (t >= 1) { paintDie(cv, px, { state: st }); this.raf = 0; return; }
      paintDieLit(cv, px, { state: st }, easeInOut(Math.max(0, t)), ang, st === 'frozen' ? 0.5 : 0.62);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
    this.twinkle(this.r() < 0.45 ? 2 : 1, 120);
  }
  private twinkle(k: number, delay: number): void {
    const used = new Set<number>();
    for (let i = 0; i < Math.min(k, this.stars.length); i++) {
      let at = Math.floor(this.r() * STAR_AT.length);
      while (used.has(at)) at = (at + 1) % STAR_AT.length;
      used.add(at);
      const s = this.stars[i], [x, y] = STAR_AT[at];
      s.style.left = x * 100 + '%';
      s.style.top = y * 100 + '%';
      s.animate([
        { opacity: 0, transform: 'translate(-50%, -50%) scale(.2) rotate(0deg)' },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(45deg)', offset: 0.4 },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(.3) rotate(90deg)' },
      ], { duration: 760, delay: delay + i * 170, easing: 'ease-out', fill: 'backwards' });
    }
  }
  /** 0,5 s: a small rotate/translate jitter (±4°, ±2 px) with an ease-out tail. Frozen (0 dice): a shiver in the ice. */
  private rattle(): void {
    const a = this.shown === 0 ? 0.35 : 1, sgn = this.r() < 0.5 ? 1 : -1;
    const amp = [1, 0.85, 0.62, 0.38, 0.16, 0], offs = [0.08, 0.2, 0.34, 0.5, 0.7, 1];
    const frames: Keyframe[] = [{ offset: 0, transform: 'translate(0px, 0px) rotate(0deg)' }];
    offs.forEach((o, i) => {
      const s = (i % 2 ? -1 : 1) * sgn * amp[i] * a, jx = (this.r() - 0.5) * 0.6 * amp[i];
      frames.push({ offset: o, transform: `translate(${(2 * s + jx).toFixed(2)}px, ${(-Math.abs(s)).toFixed(2)}px) rotate(${(4 * s).toFixed(2)}deg)` });
    });
    this.rat.animate(frames, { duration: 500, easing: 'linear' });
  }

  /** Desktop hover: the die tilts up to 8° toward the pointer, the specular spot and the next glint follow it. */
  private wireHover(): void {
    const set = (rx: number, ry: number, sx: number, sy: number) => {
      this.tilt.style.setProperty('--rx', rx.toFixed(2) + 'deg');
      this.tilt.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      this.tilt.style.setProperty('--sx', sx.toFixed(1) + '%');
      this.tilt.style.setProperty('--sy', sy.toFixed(1) + '%');
    };
    this.btn.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !matchMedia(HOVER).matches || this.calm()) return;
      const r = this.niche.getBoundingClientRect();
      if (r.width < 1) return;
      const dx = clamp(-1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2), 1), dy = clamp(-1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2), 1);
      set(-dy * 8, dx * 8, dx * 18, dy * 18);
      this.angle = Math.atan2(dy, dx) + Math.PI; // the light comes from the pointer's side
      this.el.classList.add('hover');
      const now = performance.now();
      if (now - this.hoverGlintAt > 1600 && !this.raf) { this.hoverGlintAt = now; this.glint(520); }
    });
    this.btn.addEventListener('pointerleave', () => { set(0, 0, 0, 0); this.angle = Math.PI / 4; this.el.classList.remove('hover'); });
  }

  // ---------------------------------------------------------------- paint
  /** Both canvases at the die's CSS size: #diceIco (the die) and the frozen twin over it (shown at 0 dice). */
  repaint(force = false): void {
    const px = this.ico.clientWidth;
    if (px <= 0 || (px === this.px && !force)) return;
    this.px = px;
    cancelAnimationFrame(this.raf); this.raf = 0;
    paintDie(this.ico, px, { state: 'die' });
    paintDie(this.frozen, px, { state: 'frozen' });
  }
}
