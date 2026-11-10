/**
 * STELLA NOVA — the HUD: all DOM chrome over the WebGL canvas.
 *
 *   const hud = createHud();
 *   hud.init(root, callbacks, engine.model);   // root covers the canvas container
 *   loop.onUpdate((dt) => hud.update(dt));
 *
 * Everything that waits or counts runs on update(dt), so the show pauses,
 * skips and steps with the game loop. CSS animation is used for looks only.
 * The root lets the pointer through wherever there is no control, because the
 * player drags the rings underneath.
 */
import './hud.css';
import { BIG_WIN_TIERS, RINGS } from '../core/config';
import { formatAmount, formatKr, formatKrShort } from '../core/format';
import type {
  BigWinTier,
  GameMode,
  HudCallbacks,
  IHud,
  Insets,
  ModelInfo,
  Quality,
  ScreenPoint,
  Simulator,
  SpinButtonState,
} from '../core/types';
import { attr, button, clamp, el, retrigger, setText, svg, toggleAttr } from './dom';
import { ICON, SYMBOL_DEFS, ringPickerSvg } from './icons';
import { createMenu } from './menu';
import type { Menu, MenuTab } from './menu';

export type { MenuTab } from './menu';

/** IHud plus the few extras a host page may want (deep links, tests). */
export interface HudApi extends IHud {
  openMenu(tab?: MenuTab): void;
  closeMenu(): void;
  readonly menuOpen: boolean;
}

export function createHud(): HudApi {
  return new Hud();
}

const STORE_KEY = 'stella-nova.hud.v1';
const AUTO_COUNTS = [10, 25, 50, 100] as const;
const SPIN_LABEL: Record<SpinButtonState, string> = {
  ready: 'Spin',
  spinning: 'Spring animationen over',
  nudge: 'Spring trækket over',
  auto: 'Stop autospil',
  free: 'Gratisspil i gang. Spring animationen over',
  disabled: 'Spin',
};

const easeOut = (k: number) => 1 - (1 - k) * (1 - k) * (1 - k);

/** A number that counts toward its target on the game clock. */
class Counter {
  value = 0;
  active = false;
  private from = 0;
  private to = 0;
  private time = 0;
  private duration = 0;

  constructor(private readonly apply: (v: number) => void) {}

  get target(): number {
    return this.active ? this.to : this.value;
  }

  set(v: number, seconds = 0): void {
    if (seconds > 0 && v !== this.value) {
      this.from = this.value;
      this.to = v;
      this.time = 0;
      this.duration = seconds;
      this.active = true;
      return;
    }
    this.active = false;
    this.value = v;
    this.apply(v);
  }

  /** True on the frame the count lands. */
  update(dt: number): boolean {
    if (!this.active) return false;
    this.time += dt;
    const k = Math.min(1, this.time / this.duration);
    this.value = k >= 1 ? this.to : Math.round(this.from + (this.to - this.from) * easeOut(k));
    this.apply(this.value);
    if (k < 1) return false;
    this.active = false;
    return true;
  }

  finish(): boolean {
    if (!this.active) return false;
    this.active = false;
    this.value = this.to;
    this.apply(this.to);
    return true;
  }
}

/** A timed overlay whose promise resolves when it ends, however it ends. */
interface Show {
  layer: HTMLElement;
  time: number;
  duration: number;
  resolve: () => void;
}

interface ToastItem {
  node: HTMLElement;
  life: number;
  out: boolean;
}

interface FloatItem {
  node: HTMLElement;
  x: number;
  y: number;
  time: number;
  life: number;
  rise: number;
}

type MessageKind = 'info' | 'win' | 'feature';

class Hud implements HudApi {
  private cb!: HudCallbacks;
  private model!: ModelInfo;
  private menu!: Menu;
  private ready = false;

  private hud!: HTMLElement;
  private frame!: HTMLElement;
  private topBar!: HTMLElement;
  private feat!: HTMLElement;
  private ladder!: HTMLElement;
  private gauges!: HTMLElement;
  private plateL!: HTMLElement;
  private plateR!: HTMLElement;
  private status!: HTMLElement;
  private statusText!: HTMLElement;
  private ringPick!: HTMLElement;
  private ringLabel!: HTMLElement;
  private steps: HTMLElement[] = [];
  private stepNums: HTMLElement[] = [];
  private nova!: HTMLElement;
  private novaFill!: SVGElement;
  private novaStar!: HTMLElement;
  private novaVal!: HTMLElement;
  private fs!: HTMLElement;
  private fsLeft!: HTMLElement;
  private fsTotal!: HTMLElement;
  private fsWin!: HTMLElement;
  private balVal!: HTMLElement;
  private balNum!: HTMLElement;
  private winMeter!: HTMLElement;
  private winVal!: HTMLElement;
  private winNum!: HTMLElement;
  private winSr!: HTMLElement;
  private betNum!: HTMLElement;
  private betDec!: HTMLButtonElement;
  private betInc!: HTMLButtonElement;
  private autoBtn!: HTMLButtonElement;
  private autoCount!: HTMLElement;
  private turboBtn!: HTMLButtonElement;
  private autoNudgeBtn!: HTMLButtonElement;
  private spinBtn!: HTMLButtonElement;
  private spinAutoNum!: HTMLElement;
  private spinFreeNum!: HTMLElement;
  private soundBtn!: HTMLButtonElement;
  private menuBtn!: HTMLButtonElement;
  private pop!: HTMLElement;
  private floatBox!: HTMLElement;
  private toastBox!: HTMLElement;
  private bw!: HTMLElement;
  private bwTitle!: HTMLElement;
  private bwNum!: HTMLElement;
  private fsi!: HTMLElement;
  private fsiCount!: HTMLElement;
  private fso!: HTMLElement;
  private fsoNum!: HTMLElement;
  private banner!: HTMLElement;

  private balance!: Counter;
  private win!: Counter;
  private bwCount!: Counter;
  private fsoCount!: Counter;

  private spinState: SpinButtonState = 'ready';
  private splashOn = false;
  private muted = false;
  private turbo = false;
  private autoNudge = false;
  private autoLeft: number | null = null;
  private popOpen = false;
  private mq: MediaQueryList | null = null;
  private volumes = { music: 0.7, sfx: 0.8 };
  /** Seconds until the stored volumes are sent once more (audio may not have been ready at the first push). */
  private volumeResend = -1;

  private message: { text: string; kind: MessageKind } | null = null;
  private nudgeOn = false;
  private nudgeBest = 0;
  private kbd = false;
  private ring = 0;
  private statusShown = '';
  private spaceHandled = false;
  private menuByKey = false;
  private tabbing = false;

  private readonly shows = new Map<string, Show>();
  private readonly toasts: ToastItem[] = [];
  private readonly floats: FloatItem[] = [];
  private readonly floatPool: HTMLElement[] = [];

  private insets: Insets = { top: 100, right: 0, bottom: 190, left: 0 };
  private insetsDirty = true;
  private sizeW = -1;
  private sizeH = -1;

  /** Read live, so a change of the system setting applies to the very next count-up. */
  private get reduced(): boolean {
    return !!this.mq && this.mq.matches;
  }

  // ───────────────────────────── Build ─────────────────────────────

  init(root: HTMLElement, cb: HudCallbacks, model: ModelInfo): void {
    if (this.ready) return;
    this.ready = true;
    this.cb = cb;
    this.model = model;
    this.loadStore();

    const mq = (this.mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null);

    this.balance = new Counter((v) => this.writeAmount(this.balVal, this.balNum, v));
    this.win = new Counter((v) => this.writeAmount(this.winVal, this.winNum, v));
    this.bwCount = new Counter((v) => setText(this.bwNum, formatAmount(v)));
    this.fsoCount = new Counter((v) => setText(this.fsoNum, formatAmount(v)));

    const defs = el('div');
    defs.innerHTML = SYMBOL_DEFS;

    this.menu = createMenu({
      model,
      volumes: this.volumes,
      onDemo: (action, label) => {
        cb.onDemo(action);
        if (action !== 'addBalance' && action !== 'resetBalance') this.toast(`Demo: ${label.replace(/^Udløs /, '')} i næste spin`, 'info');
      },
      onVolume: (bus, v) => {
        this.volumes[bus] = v;
        this.saveStore();
        cb.onVolume(bus, v);
      },
      onQuality: (q) => cb.onQuality(q),
      onTurbo: (on) => this.toggleTurbo(on),
      onAutoNudge: (on) => this.toggleAutoNudge(on),
      onClosed: () => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || !this.hud.contains(active)) return;
        if (this.menuByKey) this.menuBtn.focus({ preventScroll: true });
        else active.blur();
      },
    });

    this.hud = el(
      'div',
      'sn-hud',
      defs.firstElementChild,
      this.buildFrame(),
      (this.floatBox = el('div', 'sn-floats')),
      (this.toastBox = el('div', 'sn-toasts')),
      this.buildPop(),
      this.buildOverlays(),
      this.buildSplash(),
      this.menu.root,
    );
    attr(this.hud, { 'data-splash': 'off', 'data-rm': this.reduced });
    attr(this.toastBox, { role: 'status', 'aria-live': 'polite' });
    attr(this.floatBox, { 'aria-hidden': 'true' });

    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
    root.append(this.hud);

    this.balance.set(0);
    this.win.set(0);
    this.setMultiplier(0, model.ladder[0] ?? 1);
    this.setNovaCharge(0);
    this.setSpinState('ready');
    this.setMuted(false);
    this.renderStatus();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerdown', this.onPointerDown, true);
    mq?.addEventListener?.('change', (e) => toggleAttr(this.hud, 'data-rm', e.matches));
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.onResize()).observe(this.hud);
    else window.addEventListener('resize', () => this.onResize());
    // Web fonts change the text metrics the layout was measured with.
    document.fonts?.ready.then(() => this.onResize()).catch(() => {});
    this.measure();
  }

  private buildFrame(): HTMLElement {
    // Top bar
    this.soundBtn = button('sn-ibtn', 'Slå lyden fra', svg(ICON.soundOn), svg(ICON.soundOff));
    attr(this.soundBtn.children[0], { 'data-when': 'off' });
    attr(this.soundBtn.children[1], { 'data-when': 'on' });
    this.soundBtn.addEventListener('click', () => this.toggleMute());
    this.menuBtn = button('sn-ibtn', 'Menu: regler, matematik og indstillinger', svg(ICON.menu));
    attr(this.menuBtn, { 'aria-haspopup': 'dialog' });
    this.menuBtn.addEventListener('click', (e) => {
      this.openMenu();
      // detail 0 = activated from the keyboard: only then does focus need to come back here.
      this.menuByKey = e.detail === 0;
    });
    this.topBar = el(
      'header',
      'sn-top',
      el('div', 'sn-brand', el('span', 'sn-gold', 'STELLA'), svg(ICON.star), el('span', 'sn-gold', 'NOVA')),
      el('div', 'sn-icons', this.soundBtn, this.menuBtn),
    );

    // Feature strip
    const rail = el('div', 'sn-ladder__rail');
    for (const v of this.model.ladder) {
      const num = el('span', '', String(v));
      const step = el('div', 'sn-step', el('b', '', el('i', '', '×'), num));
      this.steps.push(step);
      this.stepNums.push(num);
      rail.append(step);
    }
    attr(rail, { 'aria-hidden': 'true' });
    this.ladder = el('div', 'sn-ladder', rail, el('span', 'sn-cap', 'Multiplikator'));
    attr(this.ladder, { role: 'group' });

    this.fs = el(
      'div',
      'sn-fs',
      el('div', 'sn-fs__val', (this.fsLeft = el('b', '', '0')), (this.fsTotal = el('span', '', '/ 0'))),
      el('span', 'sn-cap', 'Gratisspil'),
      (this.fsWin = el('span', 'sn-fs__win')),
    );

    let ticks = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const s = Math.sin(a);
      const c = -Math.cos(a);
      ticks += `M${(20 + s * 15.4).toFixed(2)} ${(20 + c * 15.4).toFixed(2)}L${(20 + s * 18.6).toFixed(2)} ${(20 + c * 18.6).toFixed(2)}`;
    }
    const dial = el('div', 'sn-nova__dial');
    dial.innerHTML =
      '<svg viewBox="0 0 40 40" fill="none" focusable="false" aria-hidden="true">' +
      '<circle class="sn-nova__well" cx="20" cy="20" r="14.6"/>' +
      '<circle class="sn-nova__track" cx="20" cy="20" r="17" stroke-width="2.6"/>' +
      '<circle class="sn-nova__fill" cx="20" cy="20" r="17" stroke-width="2.6" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="100" transform="rotate(-90 20 20)"/>' +
      `<path class="sn-nova__ticks" d="${ticks}" stroke-width="0.8"/>` +
      '</svg>';
    this.novaFill = dial.querySelector('.sn-nova__fill') as SVGElement;
    dial.append((this.novaStar = el('div', 'sn-nova__star', svg(ICON.star))));
    this.nova = el('div', 'sn-nova', dial, el('div', 'sn-nova__txt', (this.novaVal = el('span', 'sn-nova__val')), el('span', 'sn-cap', 'Nova')));
    attr(this.nova, { role: 'group' });

    this.gauges = el('div', 'sn-gauges', this.fs, this.nova);
    this.feat = el('div', 'sn-feat', this.ladder, this.gauges);

    // Status line
    const prev = button('sn-ringsel__btn', 'Drej ringen ét hak mod uret', svg(ICON.chevLeft));
    const next = button('sn-ringsel__btn', 'Drej ringen ét hak med uret', svg(ICON.chevRight));
    const pick = button('sn-ringsel__pick', 'Vælg en anden ring', (this.ringPick = svg(ringPickerSvg())), (this.ringLabel = el('span')));
    prev.addEventListener('click', () => this.nudgeBy(-1));
    next.addEventListener('click', () => this.nudgeBy(1));
    pick.addEventListener('click', () => this.selectRing((this.ring + 1) % RINGS));
    this.statusText = el('p', 'sn-status__text');
    attr(this.statusText, { role: 'status', 'aria-live': 'polite' });
    this.status = el('div', 'sn-status', el('span', 'sn-status__rule'), this.statusText, el('div', 'sn-ringsel', prev, pick, next), el('span', 'sn-status__rule'));

    // Console: meters
    const unit = () => el('small', '', 'kr.');
    this.balVal = el('span', 'sn-val', (this.balNum = el('span')), unit());
    this.winVal = el('span', 'sn-val', (this.winNum = el('span')), unit());
    attr(this.winVal, { 'aria-hidden': 'true' });
    this.winSr = el('span', 'sn-sr');
    this.winMeter = el('div', 'sn-meter sn-meter--win', el('span', 'sn-cap', 'Gevinst'), this.winVal, this.winSr);
    // Only the final amount is announced: the visible count-up would flood a screen reader.
    attr(this.winMeter, { 'aria-live': 'polite', 'aria-atomic': 'true' });

    this.betDec = button('sn-knob', 'Sænk indsatsen', svg(ICON.minus));
    this.betInc = button('sn-knob', 'Hæv indsatsen', svg(ICON.plus));
    this.betDec.addEventListener('click', () => this.cb.onBet(-1));
    this.betInc.addEventListener('click', () => this.cb.onBet(1));
    const betMid = el('div', 'sn-bet__mid', el('span', 'sn-cap', 'Indsats'), el('span', 'sn-val', (this.betNum = el('span')), unit()));
    attr(betMid, { 'aria-live': 'polite' });

    const meters = el(
      'div',
      'sn-meters',
      el('div', 'sn-meter sn-meter--bal', el('span', 'sn-cap', 'Saldo'), this.balVal),
      this.winMeter,
      el('div', 'sn-meter sn-meter--bet', this.betDec, betMid, this.betInc),
    );

    // Console: controls
    this.autoBtn = button('sn-btn sn-plq', 'Autospil', svg(ICON.auto), (this.autoCount = el('span', 'sn-btn__count')), el('span', 'sn-cap', 'Auto'));
    attr(this.autoBtn, { 'aria-haspopup': 'true', 'aria-expanded': 'false' });
    this.autoBtn.addEventListener('click', () => {
      if (this.autoLeft !== null) this.cb.onAuto(null);
      else this.setPop(!this.popOpen);
    });
    this.turboBtn = button('sn-btn sn-plq', 'Turbo', el('span', 'sn-btn__lamp'), svg(ICON.turbo), el('span', 'sn-cap', 'Turbo'));
    this.turboBtn.addEventListener('click', () => this.toggleTurbo(!this.turbo));
    this.autoNudgeBtn = button('sn-btn sn-btn--wide sn-plq', 'Auto-juster: maskinen vælger det bedste træk', el('span', 'sn-btn__lamp'), svg(ICON.autoNudge), el('span', 'sn-cap', 'Auto-juster'));
    this.autoNudgeBtn.addEventListener('click', () => this.toggleAutoNudge(!this.autoNudge));
    attr(this.turboBtn, { 'aria-pressed': 'false' });
    attr(this.autoNudgeBtn, { 'aria-pressed': 'false' });

    const face = (name: string, ...children: (Node | string)[]) => el('span', `sn-spin__face sn-spin__face--${name}`, ...children);
    this.spinBtn = button(
      'sn-spin',
      SPIN_LABEL.ready,
      el('span', 'sn-spin__halo'),
      el('span', 'sn-spin__bezel'),
      el('span', 'sn-spin__knurl'),
      el(
        'span',
        'sn-spin__dome',
        face('spin', svg(ICON.spin), el('span', 'sn-spin__tag', 'SPIN')),
        face('skip', svg(ICON.skip)),
        face('pass', el('span', 'sn-spin__words', 'SPRING', el('br'), 'OVER')),
        face('auto', (this.spinAutoNum = el('span', 'sn-spin__num')), el('span', 'sn-spin__tag', 'STOP')),
        face('free', (this.spinFreeNum = el('span', 'sn-spin__num')), el('span', 'sn-spin__tag', 'GRATIS')),
      ),
    );
    this.spinBtn.addEventListener('click', () => this.primary(false));

    const consoleEl = el(
      'footer',
      'sn-console',
      meters,
      el('div', 'sn-controls', el('div', 'sn-controls__l', this.autoBtn, this.turboBtn), this.spinBtn, el('div', 'sn-controls__r', this.autoNudgeBtn)),
    );

    this.plateL = el('div', 'sn-plate sn-plate--l');
    this.plateR = el('div', 'sn-plate sn-plate--r');
    this.frame = el('div', 'sn-frame', this.plateL, this.plateR, this.topBar, this.feat, this.status, consoleEl);
    return this.frame;
  }

  private buildPop(): HTMLElement {
    const row = el('div', 'sn-pop__row');
    for (const n of AUTO_COUNTS) {
      const b = button('sn-pop__opt sn-plq', `${n} autospil`, String(n));
      b.addEventListener('click', () => {
        this.setPop(false);
        this.cb.onAuto(n);
      });
      row.append(b);
    }
    this.pop = el('div', 'sn-pop sn-plq', el('span', 'sn-cap', 'Antal autospil'), row);
    attr(this.pop, { role: 'group', 'aria-label': 'Autospil' });
    return this.pop;
  }

  private buildOverlays(): HTMLElement {
    const amount = (num: HTMLElement) => el('div', 'sn-bw__amount', num, el('small', '', 'kr.'));

    this.bw = el(
      'div',
      'sn-ovl__layer sn-bw',
      el('div', 'sn-ovl__box', (this.bwTitle = el('div', 'sn-bw__title sn-gold sn-gold--sweep')), el('div', 'sn-orn', svg(ICON.diamond)), amount((this.bwNum = el('span')))),
    );
    attr(this.bw, { 'data-tap': true, 'data-tier': 1 });
    this.bw.addEventListener('click', () => this.tapBigWin());

    this.fsi = el(
      'div',
      'sn-ovl__layer sn-fsi',
      el('div', 'sn-fsi__streak'),
      el(
        'div',
        'sn-ovl__box',
        el('div', 'sn-fsi__title sn-ice', 'KOMETNAT'),
        (this.fsiCount = el('div', 'sn-fsi__count')),
        el('p', 'sn-fsi__note', 'Den inderste ring er en krans af wilds hele natten.'),
      ),
    );
    attr(this.fsi, { 'data-tap': true });
    this.fsi.addEventListener('click', () => this.endShow('fsIntro'));

    const go = el('button', 'sn-ghost sn-plq', 'Fortsæt');
    go.type = 'button';
    this.fso = el(
      'div',
      'sn-ovl__layer sn-fso',
      el('div', 'sn-ovl__box', el('div', 'sn-fso__title', 'Kometnatten er slut'), el('span', 'sn-cap', 'Samlet gevinst'), amount((this.fsoNum = el('span'))), go),
    );
    attr(this.fso, { 'data-tap': true });
    // The button sits inside the layer, so one listener covers both.
    this.fso.addEventListener('click', () => this.endShow('fsOutro'));

    this.banner = el('div', 'sn-ovl__layer sn-banner', el('div', 'sn-banner__band', el('div', 'sn-banner__text', 'STELLA NOVA')));

    return el('div', 'sn-ovl', this.banner, this.fsi, this.fso, this.bw);
  }

  private buildSplash(): HTMLElement {
    const cta = button('sn-cta sn-plq', 'Spil', 'SPIL', el('span', 'sn-cta__in'), el('span', 'sn-cta__glint'));
    cta.addEventListener('click', () => this.start());
    return el(
      'div',
      'sn-splash',
      el(
        'div',
        'sn-splash__head',
        el('div', 'sn-orn', svg(ICON.diamond)),
        el('h1', 'sn-wordmark', el('span', 'sn-gold sn-gold--sweep', 'STELLA'), el('span', 'sn-gold sn-gold--sweep', 'NOVA')),
        el('p', 'sn-splash__sub', 'Tycho Brahes himmelmaskine'),
      ),
      el(
        'div',
        'sn-splash__foot',
        el('p', 'sn-splash__story', '11. november 1572 tændes en ny stjerne på himlen.'),
        cta,
        el('p', 'sn-splash__fine', 'Demo · ingen rigtige penge · 18+'),
      ),
    );
  }

  // ───────────────────────────── Layout ─────────────────────────────

  getInsets(): Insets {
    if (this.ready && (this.insetsDirty || this.hud.clientWidth !== this.sizeW || this.hud.clientHeight !== this.sizeH)) this.measure();
    return { ...this.insets };
  }

  /** Where the chrome ends on each side, read from the laid-out boxes so every layout answers for itself. */
  private measure(): void {
    const w = this.hud.clientWidth;
    const h = this.hud.clientHeight;
    this.sizeW = w;
    this.sizeH = h;
    this.insetsDirty = false;
    if (!w || !h) return;
    const base = this.hud.getBoundingClientRect();
    const layout = getComputedStyle(this.frame).getPropertyValue('--sn-layout').trim();
    const bottom = base.bottom - this.status.getBoundingClientRect().top;
    let top = 0;
    let left = 0;
    let right = 0;
    if (layout === 'side') {
      left = this.plateL.getBoundingClientRect().width;
      right = this.plateR.getBoundingClientRect().width;
    } else if (layout === 'docks') {
      top = this.topBar.getBoundingClientRect().bottom - base.top;
      left = this.ladder.getBoundingClientRect().right - base.left;
      right = base.right - this.gauges.getBoundingClientRect().left;
    } else {
      top = this.feat.getBoundingClientRect().bottom - base.top;
    }
    const next: Insets = {
      top: clamp(Math.round(top), 0, h),
      right: clamp(Math.round(right), 0, w),
      bottom: clamp(Math.round(bottom), 0, h),
      left: clamp(Math.round(left), 0, w),
    };
    const cur = this.insets;
    if (next.top === cur.top && next.right === cur.right && next.bottom === cur.bottom && next.left === cur.left) return;
    this.insets = next;
    const style = this.hud.style;
    style.setProperty('--it', `${next.top}px`);
    style.setProperty('--ir', `${next.right}px`);
    style.setProperty('--ib', `${next.bottom}px`);
    style.setProperty('--il', `${next.left}px`);
  }

  private onResize(): void {
    this.insetsDirty = true;
    this.measure();
    this.fit(this.balVal);
    this.fit(this.winVal);
    if (this.popOpen) this.placePop();
    this.menu.relayout();
  }

  /** Amount text plus the size step for long values; the pixel fit only runs when the length changes. */
  private writeAmount(val: HTMLElement, num: HTMLElement, amount: number): void {
    const text = formatAmount(amount);
    if (num.textContent === text) return;
    num.textContent = text;
    const len = text.length >= 12 ? 'l' : text.length >= 10 ? 'm' : '';
    if ((val.getAttribute('data-len') ?? '') === len && val.dataset.n === String(text.length)) return;
    attr(val, { 'data-len': len || null });
    val.dataset.n = String(text.length);
    this.fit(val);
  }

  /** Last resort after the CSS size steps: scale a value down until it fits its meter. */
  private fit(val: HTMLElement): void {
    const box = val.parentElement;
    if (!box || !this.hud.isConnected) return;
    val.style.fontSize = '';
    const cs = getComputedStyle(box);
    const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const need = val.scrollWidth;
    if (avail <= 0 || need <= avail + 0.5) return;
    const size = parseFloat(getComputedStyle(val).fontSize);
    val.style.fontSize = `${Math.max(8, Math.floor(((size * avail) / need) * 10) / 10)}px`;
  }

  // ───────────────────────────── Simple setters ─────────────────────────────

  setSymbolIcons(icons: Record<number, string>): void {
    this.menu.setSymbolIcons(icons);
  }

  setSimulator(sim: Simulator): void {
    this.menu.setSimulator(sim);
  }

  setMode(mode: GameMode): void {
    attr(this.hud, { 'data-mode': mode === 'free' ? 'free' : null });
  }

  setQuality(q: Quality): void {
    this.menu.setQuality(q);
  }

  showSplash(on: boolean): void {
    this.splashOn = on;
    attr(this.hud, { 'data-splash': on ? 'on' : 'off' });
    if (on) {
      this.setPop(false);
      this.menu.close();
    }
  }

  setBalance(amount: number, opts?: { animate?: boolean }): void {
    this.balance.set(amount, opts?.animate && !this.reduced ? 0.6 : 0);
  }

  setBet(amount: number, limits: { canDec: boolean; canInc: boolean }): void {
    setText(this.betNum, formatKrShort(amount).replace(/\s*kr\.$/, ''));
    this.betDec.disabled = !limits.canDec;
    this.betInc.disabled = !limits.canInc;
    this.menu.setBet(amount);
  }

  setWin(amount: number, opts?: { countSeconds?: number }): void {
    const seconds = this.reduced ? 0 : opts?.countSeconds ?? 0;
    const before = this.win.target;
    toggleAttr(this.winMeter, 'data-has', amount > 0);
    setText(this.winSr, amount > 0 ? `Gevinst ${formatKr(amount)}` : '');
    this.win.set(amount, seconds);
    if (!this.win.active && amount > 0 && amount !== before) retrigger(this.winMeter, 'is-pop');
  }

  setSpinState(state: SpinButtonState): void {
    this.spinState = state;
    attr(this.spinBtn, { 'data-state': state, 'aria-label': SPIN_LABEL[state] });
    this.spinBtn.disabled = state === 'disabled';
    if (state !== 'ready') this.setPop(false);
  }

  setMultiplier(ladderIndex: number, value: number, opts?: { pulse?: boolean }): void {
    const n = this.steps.length;
    if (!n) return;
    const at = clamp(Math.floor(ladderIndex), 0, n - 1);
    for (let i = 0; i < n; i++) {
      this.steps[i].classList.toggle('is-past', i < at);
      this.steps[i].classList.toggle('is-on', i === at);
      // The last rung repeats; if the engine is past it, the rung shows the real value.
      setText(this.stepNums[i], String(i === at ? value : this.model.ladder[i]));
    }
    attr(this.ladder, { 'aria-label': `Multiplikator ×${value}` });
    if (opts?.pulse) retrigger(this.steps[at], 'is-pulse');
  }

  private novaShown = -1;

  setNovaCharge(v01: number): void {
    const q = clamp(v01, 0, 1);
    if (q === this.novaShown) return;
    const rose = q > this.novaShown + 1e-4 && this.novaShown >= 0;
    this.novaShown = q;
    const full = q >= 1;
    const threshold = Math.max(1, this.model.novaThreshold);
    this.novaFill.setAttribute('stroke-dashoffset', (100 - q * 100).toFixed(2));
    this.novaStar.style.setProperty('--q', q.toFixed(3));
    this.nova.classList.toggle('is-ready', full);
    setText(this.novaVal, full ? 'KLAR' : `${Math.round(q * threshold)}/${threshold}`);
    attr(this.nova, { 'aria-label': full ? 'Stella Nova er klar' : `Nova-ladning ${Math.round(q * 100)} procent` });
    if (rose) retrigger(this.nova, 'is-pulse');
  }

  setFreeSpins(info: { remaining: number; total: number; win: number } | null): void {
    const was = this.hud.hasAttribute('data-fs');
    toggleAttr(this.hud, 'data-fs', !!info);
    if (was !== !!info) this.insetsDirty = true;
    if (!info) return;
    const left = String(info.remaining);
    if (this.fsLeft.textContent !== left) {
      this.fsLeft.textContent = left;
      if (was) retrigger(this.fs, 'is-pulse');
    }
    setText(this.fsTotal, `/ ${info.total}`);
    setText(this.fsWin, formatKr(info.win));
    setText(this.spinFreeNum, left);
    attr(this.spinFreeNum, { 'data-len': left.length >= 3 ? 3 : null });
    attr(this.fs, { role: 'group', 'aria-label': `${info.remaining} gratisspil tilbage af ${info.total}` });
  }

  setAuto(remaining: number | null): void {
    this.autoLeft = remaining;
    toggleAttr(this.autoBtn, 'data-active', remaining !== null);
    const text = remaining === null ? '' : String(remaining);
    setText(this.autoCount, text);
    setText(this.spinAutoNum, text);
    attr(this.spinAutoNum, { 'data-len': text.length >= 3 ? 3 : null });
    attr(this.autoBtn, { 'aria-label': remaining === null ? 'Autospil' : `Stop autospil. ${remaining} spin tilbage` });
    if (remaining !== null) this.setPop(false);
  }

  setTurbo(on: boolean): void {
    this.turbo = on;
    attr(this.turboBtn, { 'aria-pressed': on ? 'true' : 'false' });
    this.menu.setTurbo(on);
  }

  setAutoNudge(on: boolean): void {
    this.autoNudge = on;
    attr(this.autoNudgeBtn, { 'aria-pressed': on ? 'true' : 'false' });
    this.menu.setAutoNudge(on);
  }

  setMuted(on: boolean): void {
    this.muted = on;
    attr(this.soundBtn, { 'aria-pressed': on ? 'true' : 'false', 'aria-label': on ? 'Slå lyden til' : 'Slå lyden fra' });
  }

  // ───────────────────────────── Status line ─────────────────────────────

  setMessage(text: string | null, kind: MessageKind = 'info'): void {
    this.message = text ? { text, kind } : null;
    this.renderStatus();
  }

  nudgePrompt(info: { on: boolean; bestAmount?: number }): void {
    this.nudgeOn = info.on;
    this.nudgeBest = info.on ? info.bestAmount ?? 0 : 0;
    toggleAttr(this.hud, 'data-nudge', info.on);
    if (info.on) this.selectRing(this.ring);
    this.renderStatus();
  }

  private renderStatus(): void {
    let key = '';
    let kind = 'info';
    if (this.nudgeOn) {
      kind = 'nudge';
      // With the ring picker out, the line only has room for the heading.
      key = this.kbd ? 'n:k' : `n:${this.nudgeBest}`;
    } else if (this.message) {
      kind = this.message.kind;
      key = `m:${kind}:${this.message.text}`;
    }
    if (key === this.statusShown) return;
    this.statusShown = key;
    toggleAttr(this.status, 'data-on', key !== '');
    attr(this.status, { 'data-kind': kind });
    if (this.nudgeOn) {
      const rest = this.kbd ? '' : ` drej en ring ét hak${this.nudgeBest > 0 ? ` · op til ${formatKr(this.nudgeBest)}` : ''}`;
      this.statusText.replaceChildren(el('em', '', this.kbd ? 'Dit træk' : 'Dit træk:'), rest);
    } else {
      this.statusText.textContent = this.message ? this.message.text : '';
    }
    if (key) retrigger(this.status, 'is-swap');
  }

  private selectRing(ring: number): void {
    this.ring = clamp(ring, 0, RINGS - 1);
    setText(this.ringLabel, `Ring ${this.ring + 1}`);
    this.ringPick.querySelectorAll('circle').forEach((c, i) => c.classList.toggle('is-on', i === this.ring));
  }

  private setKbd(on: boolean): void {
    if (this.kbd === on) return;
    this.kbd = on;
    toggleAttr(this.hud, 'data-kbd', on);
    this.renderStatus();
  }

  private nudgeBy(dir: 1 | -1): void {
    if (this.nudgeOn) this.cb.onNudgeChoice({ ring: this.ring, dir });
  }

  // ───────────────────────────── Input ─────────────────────────────

  private start(): void {
    if (!this.splashOn) return;
    this.showSplash(false);
    this.cb.onStart();
    this.pushVolumes();
    this.volumeResend = 1.5;
  }

  /** The sliders are the only volume state there is, so the audio is told what they show. */
  private pushVolumes(): void {
    try {
      this.cb.onVolume('music', this.volumes.music);
      this.cb.onVolume('sfx', this.volumes.sfx);
    } catch {
      // Audio that is not unlocked yet may refuse; the resend covers it.
    }
  }

  /** The one big action: the spin button, and Space. */
  private primary(fromKey: boolean): void {
    if (this.splashOn) {
      this.start();
      return;
    }
    if (this.shows.has('bigWin')) {
      this.tapBigWin();
      return;
    }
    if (this.shows.has('fsIntro') || this.shows.has('fsOutro')) {
      this.endShow('fsIntro');
      this.endShow('fsOutro');
      return;
    }
    switch (this.spinState) {
      case 'ready':
        this.cb.onSpin();
        break;
      case 'spinning':
      case 'free':
        this.cb.onSkip();
        break;
      case 'nudge':
        // Space never gives the move away: a player tapping it to spin again would lose their turn.
        if (fromKey) retrigger(this.status, 'is-swap');
        else this.cb.onNudgePass();
        break;
      case 'auto':
        this.cb.onAuto(null);
        break;
      default:
        break;
    }
  }

  private toggleMute(): void {
    this.setMuted(!this.muted);
    this.cb.onMute(this.muted);
  }

  private toggleTurbo(on: boolean): void {
    this.setTurbo(on);
    this.cb.onTurbo(on);
  }

  private toggleAutoNudge(on: boolean): void {
    this.setAutoNudge(on);
    this.cb.onAutoNudge(on);
  }

  /**
   * True when Space / Enter belong to the focused control: the player is
   * moving with Tab. A button that was merely clicked keeps focus too, and
   * there Space must still spin. (:focus-visible cannot tell the two apart,
   * it turns on with the key press itself.)
   */
  private ownsKey(target: EventTarget | null): boolean {
    return this.tabbing && this.isHudButton(target);
  }

  private isHudButton(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.tagName === 'BUTTON' || target.tagName === 'A') && this.hud.contains(target);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key;
    if (key === 'Tab') {
      this.tabbing = true;
      return;
    }
    if (key === 'Escape') {
      if (this.menu.isOpen) {
        e.preventDefault();
        this.closeMenu();
      } else if (this.popOpen) this.setPop(false);
      return;
    }
    const target = e.target;
    if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
    if (key === 'm' || key === 'M') {
      if (!e.repeat) this.toggleMute();
      return;
    }
    if (this.menu.isOpen) return;
    const owned = this.ownsKey(target);
    if (key === ' ' || key === 'Spacebar') {
      if (owned) return;
      e.preventDefault();
      this.spaceHandled = true;
      if (!e.repeat) this.primary(true);
      return;
    }
    if (key === 'Enter') {
      if (owned) return;
      const live = this.splashOn || this.shows.has('bigWin') || this.shows.has('fsIntro') || this.shows.has('fsOutro');
      // Also swallowed on a button that only has focus from a click, so Enter never presses it by accident.
      if (live || this.nudgeOn || this.isHudButton(target)) e.preventDefault();
      if (e.repeat) return;
      if (live) this.primary(true);
      else if (this.nudgeOn) this.cb.onNudgePass();
      return;
    }
    if (!this.nudgeOn || this.splashOn) return;
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault();
      // The first press only brings the picker out, on the ring it already shows.
      if (this.kbd) this.selectRing(this.ring + (key === 'ArrowUp' ? 1 : -1));
      this.setKbd(true);
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      this.setKbd(true);
      if (!e.repeat) this.nudgeBy(key === 'ArrowRight' ? 1 : -1);
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (e.key !== ' ' && e.key !== 'Spacebar') return;
    // A button that was clicked with the mouse still has focus: do not let Space press it as well.
    if (this.spaceHandled) e.preventDefault();
    this.spaceHandled = false;
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    const target = e.target instanceof Node ? e.target : null;
    this.tabbing = false;
    if (this.popOpen && !(target && (this.pop.contains(target) || this.autoBtn.contains(target)))) this.setPop(false);
    if (this.kbd && !(target instanceof Element && target.closest('.sn-ringsel'))) this.setKbd(false);
  };

  // ───────────────────────────── Menu and popover ─────────────────────────────

  get menuOpen(): boolean {
    return this.ready && this.menu.isOpen;
  }

  openMenu(tab?: MenuTab): void {
    this.menuByKey = false;
    this.setPop(false);
    this.menu.open(tab);
  }

  closeMenu(): void {
    this.menu.close();
  }

  private setPop(open: boolean): void {
    if (this.popOpen === open) return;
    this.popOpen = open;
    if (open) this.placePop();
    this.pop.classList.toggle('is-open', open);
    attr(this.autoBtn, { 'aria-expanded': open ? 'true' : 'false' });
  }

  private placePop(): void {
    const base = this.hud.getBoundingClientRect();
    const b = this.autoBtn.getBoundingClientRect();
    const pw = this.pop.offsetWidth;
    const ph = this.pop.offsetHeight;
    const x = clamp(b.left - base.left + b.width / 2 - pw / 2, 8, Math.max(8, base.width - pw - 8));
    let y = b.top - base.top - ph - 10;
    if (y < 8) y = b.bottom - base.top + 10;
    this.pop.style.left = `${Math.round(x)}px`;
    this.pop.style.top = `${Math.round(y)}px`;
  }

  // ───────────────────────────── Toasts and floats ─────────────────────────────

  toast(text: string, kind: MessageKind = 'info'): void {
    const node = el('div', 'sn-toast sn-plq', text);
    attr(node, { 'data-kind': kind });
    this.toastBox.append(node);
    this.toasts.push({ node, life: 2.8, out: false });
    // Never a pile: the oldest leaves when a fourth arrives.
    if (this.toasts.length > 3) this.toasts[0].life = Math.min(this.toasts[0].life, 0.3);
  }

  floatText(at: ScreenPoint, text: string, kind: 'line' | 'mult' | 'feature' = 'line'): void {
    if (this.floats.length >= 24) this.dropFloat(0);
    const node = this.floatPool.pop() ?? el('div', 'sn-float');
    node.textContent = text;
    attr(node, { 'data-kind': kind });
    const item: FloatItem = { node, x: at.x, y: at.y, time: 0, life: kind === 'mult' ? 1.3 : 1.1, rise: this.reduced ? 0 : kind === 'mult' ? 48 : 34 };
    this.floats.push(item);
    this.poseFloat(item);
    this.floatBox.append(node);
  }

  private poseFloat(f: FloatItem): void {
    const k = f.time / f.life;
    const y = f.y - f.rise * easeOut(k);
    const pop = f.rise === 0 || k >= 0.14 ? 1 : 0.55 + 0.45 * easeOut(k / 0.14);
    f.node.style.transform = `translate(${f.x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${pop.toFixed(3)})`;
    f.node.style.opacity = k > 0.68 ? ((1 - k) / 0.32).toFixed(3) : '1';
  }

  private dropFloat(i: number): void {
    const [f] = this.floats.splice(i, 1);
    f.node.remove();
    this.floatPool.push(f.node);
  }

  // ───────────────────────────── Overlays ─────────────────────────────

  private startShow(key: string, layer: HTMLElement, duration: number): Promise<void> {
    // A second call takes over: the first one's promise resolves now.
    this.endShow(key);
    return new Promise<void>((resolve) => {
      this.shows.set(key, { layer, time: 0, duration, resolve });
      retrigger(layer, 'is-on');
    });
  }

  private endShow(key: string): void {
    const show = this.shows.get(key);
    if (!show) return;
    this.shows.delete(key);
    show.layer.classList.remove('is-on');
    show.resolve();
  }

  bigWin(tier: BigWinTier, amount: number, opts: { seconds: number }): Promise<void> {
    this.endShow('bigWin');
    const seconds = this.reduced ? 0 : Math.max(0, opts.seconds);
    const label = BIG_WIN_TIERS.find((t) => t.tier === tier)?.label ?? BIG_WIN_TIERS[0].label;
    setText(this.bwTitle, label);
    attr(this.bw, { 'data-tier': tier, 'aria-label': `${label}: ${formatKr(amount)}` });
    this.bwCount.set(0);
    this.bwCount.set(amount, seconds);
    this.bw.classList.toggle('is-final', !this.bwCount.active);
    return this.startShow('bigWin', this.bw, seconds + 1.1 + tier * 0.25);
  }

  /** First tap lands the count, the next one closes. */
  private tapBigWin(): void {
    const show = this.shows.get('bigWin');
    if (!show) return;
    if (this.bwCount.finish()) {
      this.bw.classList.add('is-final');
      show.duration = show.time + 0.9;
    } else this.endShow('bigWin');
  }

  freeSpinsIntro(count: number, isRetrigger: boolean): Promise<void> {
    setText(this.fsiCount, isRetrigger ? `+${count} gratisspil` : `${count} gratisspil`);
    toggleAttr(this.fsi, 'data-retrigger', isRetrigger);
    return this.startShow('fsIntro', this.fsi, isRetrigger ? 1.5 : 2.2);
  }

  freeSpinsOutro(totalAmount: number): Promise<void> {
    this.endShow('fsOutro');
    this.fsoCount.set(0);
    this.fsoCount.set(totalAmount, this.reduced ? 0 : 1.2);
    return this.startShow('fsOutro', this.fso, 6);
  }

  novaBanner(): Promise<void> {
    return this.startShow('nova', this.banner, 1.2);
  }

  skip(): void {
    this.bwCount.finish();
    this.fsoCount.finish();
    for (const key of [...this.shows.keys()]) this.endShow(key);
  }

  // ───────────────────────────── Clock ─────────────────────────────

  update(dt: number): void {
    if (!this.ready || !(dt > 0)) return;
    this.balance.update(dt);
    if (this.win.update(dt)) retrigger(this.winMeter, 'is-pop');
    if (this.bwCount.update(dt)) this.bw.classList.add('is-final');
    this.fsoCount.update(dt);

    if (this.shows.size) {
      for (const [key, show] of this.shows) {
        show.time += dt;
        if (show.time >= show.duration) this.endShow(key);
      }
    }

    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.life -= dt;
      if (!t.out && t.life <= 0.3) {
        t.out = true;
        t.node.classList.add('is-out');
      }
      if (t.life <= 0) {
        t.node.remove();
        this.toasts.splice(i, 1);
      }
    }

    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.time += dt;
      if (f.time >= f.life) this.dropFloat(i);
      else this.poseFloat(f);
    }

    if (this.volumeResend > 0) {
      this.volumeResend -= dt;
      if (this.volumeResend <= 0) this.pushVolumes();
    }
  }

  // ───────────────────────────── Storage ─────────────────────────────

  private loadStore(): void {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { music?: unknown; sfx?: unknown };
      if (typeof data.music === 'number') this.volumes.music = clamp(data.music, 0, 1);
      if (typeof data.sfx === 'number') this.volumes.sfx = clamp(data.sfx, 0, 1);
    } catch {
      // Private mode or blocked storage: the defaults stand.
    }
  }

  private saveStore(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.volumes));
    } catch {
      // Not being able to remember a volume is not worth a message.
    }
  }
}
