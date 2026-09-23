// Game controller: state machine, money, meter, storms, demo. Presentation is delegated.
import { gsap } from 'gsap';
import { Container, Graphics, Text } from 'pixi.js';
import { spinRng, newSessionSeed } from '../math/rng.ts';
import { spinBase } from '../math/engine.ts';
import { createStorm, stormSpin, finishStorm, type StormState } from '../math/storm.ts';
import { kpOf, lockedStakeOre, addCharge, resetMeter } from '../math/meter.ts';
import { CONFIG, REPORT } from '../math/config.ts';
import type { SpinResult, Sym } from '../math/types.ts';
import { TIERS, kpFromCharge } from './tiers.ts';
import { bus } from './bus.ts';
import { welcomeCopy } from '../ui/welcome.ts';
import { DICE_GOAL, diceFor, addDie, diceDefaults, realDiceView, previewDiceView, type DiceStore, type DiceView, type PreviewStep } from './dice.ts';
import { loadDice, saveDice, wipeDice, load, save, defaults, wipe, setPersistenceEnabled, storageOk, expiredOnLoad, START_BALANCE_ORE, type SaveData, type HistoryEntry } from './store.ts';
import { presentSpin, idleGrid, type PresentCtx } from '../present/director.ts';
import { profileOf, winTier } from '../present/schedule.ts';
import { Celebration } from '../present/celebration.ts';
import { playSolstormIntro, type CineWorld, type CineHandle } from '../present/cinematics/solstorm.ts';
import { PixiDicePresenter, type DicePresenter, type CeremonyHandle, type Pt } from '../present/dicePresenter.ts';
import { wait, clock } from '../present/clock.ts';
import {
  MENU, DRAWER, DEMO_STORM_NOTE, DEMO_DIE_BANNER, SR_CEREMONY_END, srAward, srStormPop, srStormOutro, stormSummaryRow, helloHtml, helloCopy,
  firstDieHtml, firstDieCopy, unlockCardHtml, placardHtml, chamberRibbon, srCeremonyStart, demoGateBanner, type CeremonyKind, type RibbonKind,
} from '../ui/diceCopy.ts';
import { fmtKr, fmtSignedKr, fmt1, fmtX, fmtInt } from '../core/format.ts';
import { PAL } from '../core/palette.ts';
import { crand, crange } from '../core/cosmeticRng.ts';
import type { Hud, Intent } from '../ui/hud.ts';
import type { World } from './world.ts';

export type GameState =
  | 'boot' | 'splash' | 'intro' | 'idle' | 'spinning' | 'celebrating'
  | 'stormTransition' | 'stormReady' | 'stormSpinning' | 'stormSummary' | 'stormOutro' | 'demoLapse'
  // Terningen: the chamber is a resting state; the others lock the stake and ignore 'spin' (see dispatch)
  | 'chamber' | 'ceremony' | 'diceCard' | 'demoDie';

type StormSource = 'A' | 'B' | 'AB' | 'demo';
/** The open Terningen card (#summary): the real first-die card, its demo twin, or the real 1948 card. */
type DiceCard = { kind: 'firstDie' | 'firstDemo' | 'unlock'; at: number };

export class Game {
  state: GameState = 'boot';
  s: SaveData;
  /** Terningen: a separate, never-expiring store ('terningen.v1'). Only the award rule (awardDie) adds a die. */
  private dice: DiceStore;
  /** What the chip shows (lags the model until a die lands) and the storm dice waiting on the molten frame. */
  private shownDice = 0;
  private heldDice = 0;
  private award: DicePresenter;
  hud: Hud;
  w: World;
  /** Charge shown on the arc (animated by motes); the model is s.meter. */
  displayCharge = 0;
  private lastTier = 0;
  private sessionStart = Date.now();
  private sessionNet = 0;
  private celebration: Celebration;
  private cine: CineHandle | null = null;
  private waiters: Partial<Record<'startStorm' | 'continue', () => void>> = {};
  private demoPending = false;
  private fullFx = false;
  private watermark: Container;
  private lastModalClose = 0;
  /** Active storm (kept for QA / debug inspection). */
  stormState: StormState | null = null;
  stormMeta: { source: StormSource; stakeOre: number } | null = null;
  private rebakeTier = -1;

  constructor(hud: Hud, w: World) {
    this.hud = hud;
    this.w = w;
    this.s = load(newSessionSeed(), CONFIG.defaultStakeOre);
    this.dice = loadDice(newSessionSeed());
    // An interrupted storm's dice are still held on its frame (rebuilt on resume); the chip shows the rest.
    this.heldDice = this.s.activeStorm?.diceAwarded ?? 0;
    this.shownDice = Math.max(0, this.dice.count - this.heldDice);
    this.award = new PixiDicePresenter({
      hud, w, calm: () => this.calm(), haptic: (p) => this.haptic(p),
      land: (add, fromHeld) => this.landDice(add, fromHeld), seed: () => this.dice.seed,
    });
    if (!CONFIG.stakesOre.includes(this.s.stakeOre)) this.s.stakeOre = CONFIG.defaultStakeOre;
    this.displayCharge = this.s.meter.charge;
    this.lastTier = Math.floor(this.kp());
    this.celebration = new Celebration();
    w.stage.layers.banners.addChild(this.celebration);
    const wmText = new Text({ text: 'DEMO · Solstorm udløst manuelt · krediteres ikke', style: { fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: '700', fill: 0xffd79a, letterSpacing: 0.6 } });
    wmText.anchor.set(0.5);
    this.watermark = new Container();
    this.watermark.addChild(new Graphics(), wmText);
    this.watermark.visible = false;
    w.stage.layers.hud.addChild(this.watermark);
    w.onLayout = () => {
      this.layoutWatermark();
      if (this.state === 'splash') hud.placeWelcome(w.splashLogoBottom());
      if (this.celebration.active) this.celebration.layout(w.stage.w, w.stage.h, w.gridCenterY());
    };
    hud.bindRefs({ history: () => this.s.history, settings: () => this.s.settings, kp: () => this.kp(), dice: () => realDiceView(this.dice) });
    this.applySettings();
    this.refreshHud();
    if (!storageOk) hud.notice(`<span class="chip warn">${MENU.storage}</span>`);
    // An expired meter is told by the splash welcome (the single notice); #autostart skips the splash and uses noticeExpired().
    setInterval(() => this.tickClock(), 1000);
    this.tickClock();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) w.audio.suspend(); else w.audio.resume();
    });
  }
  /** Expiry notice for flows that skip the splash welcome. */
  noticeExpired(): void {
    if (storageOk && expiredOnLoad) this.hud.notice('<span class="chip warn">Din ladning er udløbet (365 dage efter dit sidste spin) og er nulstillet</span>');
  }

  // ---------------------------------------------------------------- helpers
  kp(): number { return kpFromCharge(this.displayCharge, CONFIG.K); }
  calm(): boolean {
    if (this.fullFx) return false;
    const c = this.s.settings.calm;
    return c === 'on' || (c === 'auto' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  private setState(to: GameState): void {
    const from = this.state;
    this.state = to;
    bus.emit('state', { from, to });
    const idle = to === 'idle';
    this.hud.setDemoEnabled(idle || to === 'spinning' || to === 'celebrating', this.demoPending);
    const lockStake = to !== 'idle';
    this.hud.setStake(this.s.stakeOre, this.stakeIndex() > 0, this.stakeIndex() < CONFIG.stakesOre.length - 1, lockStake || this.s.perksPending > 0);
    // Resting states may rebuild the grid after a resize; presentations only scale it.
    const resting = to === 'idle' || to === 'splash' || to === 'stormReady' || to === 'stormSummary' || to === 'chamber';
    if (resting) this.w.flushLayout(); else this.w.busy = true;
    if (idle) this.refreshSpinButton();
    else if (to === 'stormReady') this.hud.setSpin('storm', 'START');
    else if (to === 'stormSpinning') this.hud.setSpin('busy', 'STORM');
    else this.hud.setSpin('busy');
    this.refreshDice(); // the chip opens the chamber from idle only (aria-disabled otherwise)
  }
  private stakeIndex(): number { return CONFIG.stakesOre.indexOf(this.s.stakeOre); }
  private refreshSpinButton(): void {
    if (this.s.perksPending > 0) this.hud.setSpin('perk');
    else if (this.s.balanceOre < this.s.stakeOre) this.hud.setSpin('disabled');
    else this.hud.setSpin('idle');
  }
  /** Both stores in the same synchronous task: a reload can never land between them. */
  private persist(): void { this.s.lastPlayed = Date.now(); save(this.s); saveDice(this.dice); }
  haptic(p: number | number[]): void {
    if (!this.s.settings.haptics || this.calm()) return;
    try { navigator.vibrate?.(p); } catch { /* ignore */ }
  }
  /** Neutral expected distance to a Kp: mean spins from Kp 0 (report) minus where you are now. */
  private avgSpinsTo(targetKp: number): number | null {
    const target = TIERS[targetKp];
    if (!target) return null;
    const cbar = REPORT.avgChargePerSpin > 0 ? REPORT.avgChargePerSpin : CONFIG.K / REPORT.avgSpinsToKp9;
    const need = Math.max(0, target.frac * CONFIG.K - this.displayCharge);
    return Math.max(1, Math.round(need / cbar));
  }
  refreshHud(): void {
    const h = this.hud;
    h.setBalance(this.s.balanceOre);
    h.setStake(this.s.stakeOre, this.stakeIndex() > 0, this.stakeIndex() < CONFIG.stakesOre.length - 1, this.state !== 'idle' && this.state !== 'splash' || this.s.perksPending > 0);
    const locked = this.s.meter.charge > 0 ? lockedStakeOre(this.s.meter) : this.s.stakeOre;
    h.setLock(this.s.meter.charge > 0 ? `Låst indsats ${fmtKr(locked)}` : '');
    h.setGoal(this.kp(), this.displayCharge, CONFIG.K, (k) => this.avgSpinsTo(k));
    h.setMuted(this.s.settings.muted);
    h.refreshSide(this.stormMeta?.stakeOre ?? this.s.stakeOre, !!this.stormMeta);
    h.setDemoKp(this.kp());
    this.refreshDice();
  }
  /** The chip shows shownDice (never ahead of a landing); "pending" only once die nr. 1948 has landed. */
  private refreshDice(): void {
    const u = this.dice.unlock === 'pending' && this.shownDice < DICE_GOAL ? 'none' : this.dice.unlock;
    this.hud.setDice(this.shownDice, { show: this.s.settings.dice !== false, unlock: u, enabled: this.state === 'idle' });
  }
  private tickClock(): void {
    this.hud.setClock(new Date());
    this.hud.setSession(Math.floor((Date.now() - this.sessionStart) / 60000), this.sessionNet);
  }
  applySettings(): void {
    const st = this.s.settings;
    this.w.audio.setMuted(st.muted);
    this.w.audio.setVolumes(st.music, st.sfx);
    this.w.audio.setMusicSource(st.musicSource);
    document.documentElement.classList.toggle('calm', this.calm());
    const fromOs = st.calm === 'auto' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.hud.showFullFxOption(fromOs && !this.fullFx);
    this.hud.setCalmChip(fromOs && !this.fullFx);
    this.w.setCalm(this.calm());
    this.w.audio.setCalm(this.calm()); // dice and gate sounds −3 dB
    // "Vis terninger i spillet" off: :root.nodice hides the chip and panel; the dice still count
    document.documentElement.classList.toggle('nodice', st.dice === false);
    if (st.dice === false) this.hud.hideHello();
    this.refreshDice();
  }

  // ---------------------------------------------------------------- intents
  dispatch(i: Intent): void {
    if (performance.now() - this.lastModalClose < 250 && (i.t === 'spin' || i.t === 'continue' || i.t === 'startStorm')) return;
    switch (i.t) {
      case 'unlock': if (this.state === 'splash') void this.intro(); break;
      case 'spin':
        if (this.hud.menuOpen()) return;
        // Terningen: SPIN skips the ceremony, means "Forstået" on the first-die card (≥ 1,5 s), else nothing.
        if (this.state === 'ceremony') { this.skipCeremony(); break; }
        if (this.state === 'diceCard') { this.cardKey('spin'); break; }
        if (this.state === 'chamber' || this.state === 'demoDie') break;
        // The thumb goes to the big button: it starts the storm / continues where that is the only action.
        if (this.state === 'stormReady') { this.resolveWaiter('startStorm'); break; }
        if (this.hud.isShown('summary') || this.hud.isShown('bigwin')) { this.dispatch({ t: 'continue' }); break; }
        void this.spin(); break;
      case 'stakeUp': this.changeStake(1); break;
      case 'stakeDown': this.changeStake(-1); break;
      case 'demo': this.requestDemo(); break;
      case 'demoSuns': if (this.state === 'idle') void this.demoSuns(); else this.toolsBusy(); break;
      case 'demoKp': if (this.state === 'idle') this.demoSetKp(i.kp); else this.toolsBusy(); break;
      case 'demoReset': if (this.state === 'idle' || this.state === 'splash') this.demoReset(); else this.toolsBusy(); break;
      case 'startStorm': this.resolveWaiter('startStorm'); break;
      case 'continue':
        if (this.state === 'diceCard') { this.cardKey('key'); break; }
        if (this.state === 'ceremony') break; // the placard needs an explicit button
        this.hud.show('bigwin', false); if (this.celebration.active) this.celebration.continue(); else this.resolveWaiter('continue'); this.lastModalClose = performance.now(); break;
      case 'skip':
        if (this.hud.menuOpen()) return;
        if (this.state === 'ceremony') { this.skipCeremony(); break; }
        if (this.state === 'diceCard') { this.cardKey('esc'); break; }
        // A skip lands a die within 300 ms (born instantly if the celebration had not reached its birth beat).
        if (this.celebration.active) { if (this.celebration.skip()) this.w.audio.stopCount(); this.award.awardSkip(); }
        else if (this.award.inFlight()) this.award.awardSkip();
        else if (this.cine?.canSkip()) this.cine.skip();
        break;
      case 'mute': this.s.settings.muted = !this.s.settings.muted; this.applySettings(); this.hud.setMuted(this.s.settings.muted); this.persist(); break;
      case 'refill': this.refill(); break;
      case 'settings': Object.assign(this.s.settings, i.s); this.applySettings(); this.persist(); break;
      case 'fullFx': this.fullFx = true; this.applySettings(); break;
      case 'menu': if (!i.open) this.lastModalClose = performance.now(); break;
      // ---- Terningen
      case 'chamber':
        if (i.open) { if (this.state === 'idle') void this.openChamber(); }
        else if (this.state === 'chamber') void this.closeChamber(!!i.key);
        break;
      case 'gateOpen': if (this.state === 'chamber' && this.dice.unlock === 'pending' && this.chamberView.mode === 'real') void this.runCeremony('real'); break;
      case 'gateReplay': if (this.state === 'chamber' && this.dice.unlock === 'seen' && this.chamberView.mode === 'real') void this.runCeremony('replay'); break;
      case 'diceCard': this.cardAct(i.act); break;
      case 'hello':
        this.hideHello();
        if (i.act === 'chamber' && this.state === 'idle') void this.openChamber();
        break;
      case 'placard': void this.placardAct(i.act); break;
      case 'demoDie': if (this.state === 'idle') void this.demoDie(); else this.toolsBusy(); break;
      case 'demoFirstDie': if (this.state === 'idle') this.demoFirstDie(); else this.toolsBusy(); break;
      case 'demoGate': if (this.state === 'idle') void this.runCeremony('demo'); else this.toolsBusy(); break;
      case 'demoChamber': if (this.state === 'idle') void this.openChamber(i.n); else this.toolsBusy(); break;
    }
  }
  private toolsBusy(): void { this.hud.banner('DEMO-VÆRKTØJER', 'Virker mellem spin – prøv igen, når spinnet er færdigt'); }
  private resolveWaiter(k: 'startStorm' | 'continue'): void { const f = this.waiters[k]; if (f) { delete this.waiters[k]; f(); } }
  private waitFor(k: 'startStorm' | 'continue'): Promise<void> { return new Promise((r) => { this.waiters[k] = r; }); }

  private changeStake(d: number): void {
    if (this.state !== 'idle' || this.s.perksPending > 0) return;
    const i = Math.max(0, Math.min(CONFIG.stakesOre.length - 1, this.stakeIndex() + d));
    if (CONFIG.stakesOre[i] === this.s.stakeOre) return;
    this.s.stakeOre = CONFIG.stakesOre[i];
    this.w.audio.play(d > 0 ? 'stakeUp' : 'stakeDown');
    this.refreshHud();
    this.refreshSpinButton();
    this.persist();
  }
  private refill(): void {
    if (this.state !== 'idle' && this.state !== 'splash') return;
    this.s.balanceOre = Math.max(this.s.balanceOre, START_BALANCE_ORE);
    this.hud.banner('SALDO FYLDT OP', 'Legepenge · ' + fmtKr(this.s.balanceOre));
    this.refreshHud(); this.refreshSpinButton(); this.persist();
  }

  // ---------------------------------------------------------------- boot / intro
  boot(): void {
    this.setState('splash');
    this.hud.setSplash(true);
    this.hud.show('splash', true);
    this.w.showSplash();
    this.renderWelcome(!this.calm(), expiredOnLoad);
  }
  /** Splash welcome from the saved state (see ui/welcome.ts for the copy rules). */
  private welcomeExpired = false;
  private renderWelcome(reveal: boolean, expired: boolean): void {
    this.welcomeExpired = expired;
    const st = this.s.activeStorm;
    this.hud.showWelcome(welcomeCopy({
      spins: this.s.stats.spins, storms: this.s.stats.storms, kp: this.kp(), perksPending: this.s.perksPending, expired,
      storm: st ? { spinIndex: st.spinIndex, spinsTotal: st.spinsTotal, maxMark: st.maxMark } : null,
    }), reveal);
    this.hud.placeWelcome(this.w.splashLogoBottom());
  }

  async intro(): Promise<void> {
    // The expiry must be seen: keep the chip when the welcome could not show it (no room, an earlier tap, or a storm resume on top).
    if (this.welcomeExpired && !this.hud.welcomeShowing('expired')) this.noticeExpired();
    this.hud.show('splash', false);
    this.hud.setSplash(false);
    this.setState('intro');
    await this.w.audio.unlock();
    this.w.audio.startBase();
    this.w.audio.setBaseLayers(TIERS[Math.floor(this.kp())].music);
    await this.w.ignite(this.kp());
    const g = this.w.grid;
    const grid = idleGrid(g.cols, g.rows);
    await this.w.assembleGrid(grid);
    this.hud.pulseDemo();
    // Any deep link (#solstorm/#1948/#kammer/#terning) or a resumed storm suppresses the one-time hello card.
    if (this.w.demoOnLoad || this.w.diceOnLoad || this.s.activeStorm) this.helloBlocked = true;
    if (this.s.activeStorm) { await this.resumeStorm(); return; }
    this.setState('idle');
    if (this.s.perksPending > 0) this.hud.banner('LADET SPIN KLAR', `Gratis spin ved låst indsats ${fmtKr(lockedStakeOre(this.s.meter))}`);
    if (this.w.demoOnLoad) { this.w.demoOnLoad = false; setTimeout(() => this.requestDemo(), 2000); return; }
    this.afterIdle();
  }

  // ---------------------------------------------------------------- base spin
  private presentCtx(storm: boolean, inertCharge = false): PresentCtx {
    const w = this.w;
    return {
      grid: w.grid, cellShatter: w.cellShatter, particles: w.particles, motes: w.motes, arc: w.arc, popups: w.popups,
      hud: this.hud, audio: w.audio, calm: () => this.calm(), shake: (t) => w.shake(t), glowPulse: () => w.glowPulse(storm),
      onCharge: inertCharge ? () => {} : (a) => this.addDisplayCharge(a), haptic: (p) => this.haptic(p),
    };
  }

  /** The model is committed before presentation; the arc may never run ahead of it. */
  private chargeCap = 0;
  private deferLevelUps = false;
  private addDisplayCharge(a: number): void {
    this.displayCharge = Math.min(CONFIG.K, this.chargeCap, this.displayCharge + a);
    this.w.arc.pulse = Math.min(1, this.w.arc.pulse + 0.35);
    this.onKpDisplayChanged();
  }
  private onKpDisplayChanged(): void {
    const kp = this.kp();
    this.w.arc.setKp(kp);
    const tier = Math.floor(kp);
    // LDW rule: no level-up fanfare in the middle of a sub-stake result — they fire after the result.
    if (this.deferLevelUps || this.preview || this.state === 'demoLapse') return;
    if (tier > this.lastTier) for (let t = this.lastTier + 1; t <= Math.min(8, tier); t++) this.levelUp(t);
    this.lastTier = tier;
  }
  private levelUp(t: number): void {
    const T = TIERS[t];
    this.w.audio.play('levelUp', { level: t });
    this.w.audio.setBaseLayers(T.music);
    this.w.breathe();
    const title = T.gName ? `GEOMAGNETISK STORM · ${T.gName}` : `KP ${t} · ${T.name.toUpperCase()}`;
    this.hud.banner(title, `Kp ${t} · ${T.change}${T.perk ? ' · gratis ved låst indsats' : ''}`);
    if (!this.demoMode) this.s.stats.highestKp = Math.max(this.s.stats.highestKp, t);
    if (t >= 6) this.prepareStorm();
    this.maybeRebake(t);
  }
  private maybeRebake(tier: number): void {
    if (tier === this.rebakeTier) return;
    this.rebakeTier = tier;
    void this.w.rebakeBase();
  }
  private prepareStorm(): Promise<void> { return this.w.audio.prepareStorm(); }

  async spin(): Promise<void> {
    if (this.state !== 'idle') return;
    this.endPreview();
    this.hideHello(); // the hello card is not a disclosure gate: SPIN dismisses it and the spin proceeds
    const perk = this.s.perksPending > 0;
    const stake = perk ? lockedStakeOre(this.s.meter) : this.s.stakeOre;
    if (!perk && this.s.balanceOre < stake) { this.refill(); return; }
    this.setState('spinning');
    const pre = { charge: this.s.meter.charge, stakeSumOre: this.s.meter.stakeSumOre, perksPending: this.s.perksPending };
    if (perk) this.s.perksPending--;
    else { this.s.balanceOre -= stake; this.sessionNet -= stake; }
    const paid = perk ? 0 : stake;
    const domain = perk ? 'perk' : 'base';
    const idx = ++this.s.counters[domain];
    const r = spinBase(spinRng(this.s.sessionSeed, domain, idx), stake, { perk });
    const shownBalance = this.s.balanceOre;
    // ---- commit the WHOLE outcome before presentation (a reload mid-spin loses nothing) ----
    const m = addCharge(this.s.meter, r.chargeGained, stake);
    this.s.balanceOre += r.totalOre;
    const dieNo = this.awardDie(r); // r.stakeOre is the locked stake for a Ladet spin
    this.record(r, perk ? 'perk' : 'base', stake, r.totalOre - paid, pre, dieNo > 0);
    const perks = m.tiersCrossed.filter((t) => TIERS[t]?.perk).length;
    this.s.perksPending += perks;
    this.chargeCap = m.stormA ? CONFIG.K : this.s.meter.charge;
    let storm: { source: StormSource; stake: number; idx: number } | null = null;
    if (m.stormA || r.triggers.stormB) {
      const source: StormSource = m.stormA && r.triggers.stormB ? 'AB' : m.stormA ? 'A' : 'B';
      const stormStake = source === 'A' ? lockedStakeOre(this.s.meter) : stake;
      if (m.stormA) resetMeter(this.s.meter);
      const sidx = ++this.s.counters.storm;
      this.s.activeStorm = { source: source as 'A' | 'B' | 'AB', stakeOre: stormStake, seedIdx: sidx, spinIndex: 0, spinsTotal: CONFIG.stormSpins, marks: [], winOre: 0, maxMark: 2 };
      this.s.stats.storms++;
      storm = { source, stake: stormStake, idx: sidx };
    }
    this.s.lastSpinAt = Date.now();
    this.persist();
    // ---- presentation ----
    this.hud.setBalance(shownBalance);
    this.hud.clearWin(perk ? `Ladet spin · gratis · ${fmtKr(stake)} · 4 felter ×2` : '');
    const profile = profileOf(r.totalOre, paid);
    this.deferLevelUps = profile !== 'win';
    if (r.anticipation || this.kp() >= 6) this.prepareStorm();
    await presentSpin(this.presentCtx(false), r, { storm: false, freshMarks: true, paidOre: paid });
    this.displayCharge = Math.min(CONFIG.K, this.chargeCap);
    this.deferLevelUps = false;
    this.onKpDisplayChanged();
    const tier = winTier(r.totalOre, stake);
    if (tier >= 2) {
      this.setState('celebrating');
      await this.celebrate(tier, r.totalOre, stake, false, paid, dieNo);
    } else if (tier === 1 || (profile === 'win' && perk)) this.w.audio.play('win', { level: 1 });
    this.finishSpinHud(r, profile, paid, dieNo);
    // The die lands before idle and before a triggered storm: none is ever in the air when the next spin starts.
    if (dieNo) await this.flyDie();
    if (storm) {
      await this.runStorm(storm.source, storm.stake, { resume: { idx: storm.idx, spinIndex: 0 } });
      return;
    }
    this.refreshHud();
    this.setState('idle');
    if (perks > 0) this.hud.banner('LADET SPIN', `Gratis spin med 4 felter ×2 ved låst indsats ${fmtKr(lockedStakeOre(this.s.meter))}`);
    this.afterIdle();
  }

  private finishSpinHud(r: SpinResult, profile: ReturnType<typeof profileOf>, paid: number, dieNo = 0): void {
    // Session net only moves when the result is shown (never reveal an outcome early in the footer).
    this.sessionNet += r.totalOre;
    this.tickClock();
    this.hud.setWin(r.totalOre, r.stakeOre, profile, undefined, paid);
    this.hud.setBalance(this.s.balanceOre);
    const net = fmtSignedKr(r.totalOre - paid);
    const a = profile === 'win' ? `Gevinst ${fmtKr(r.totalOre)}. Netto ${net}.` : profile === 'return' ? `Retur ${fmtKr(r.totalOre)}, netto ${net}.` : profile === 'push' ? 'Indsats retur.' : 'Ingen gevinst.';
    bus.emit('win:final', { totalOre: r.totalOre, stakeOre: r.stakeOre, profile });
    this.w.announce(`${a} Kp ${fmt1(this.kp())}.${dieNo && this.s.settings.dice ? ' ' + srAward(dieNo) : ''}`);
  }

  // ---------------------------------------------------------------- Terningen: award
  /** THE only caller of the mutator addDie. Never in demo mode; one die for a spin whose own total is ≥ 10× its own stake. */
  private awardDie(r: { totalOre: number; stakeOre: number }): number {
    if (this.demoMode || !diceFor(r.totalOre, r.stakeOre)) return 0;
    const n = addDie(this.dice, Date.now());
    if (!this.s.settings.dice) { this.dice.introSeen = true; this.dice.helloSeen = true; } // opted out: no cards later
    return n;
  }
  /** Celebration birth beat (or instantly on a skip before it). */
  private dieBirth(n: number, tier: number, instant: boolean): void {
    this.award.awardBirth(n, { instant, tier });
    if (!instant) this.w.audio.play('dieBirth', { when: this.w.audio.now() + 0.05 });
  }
  /** After the celebration: the flight to the chip (landDice rolls the number). Opted out: the count moves silently. */
  private async flyDie(): Promise<void> {
    if (this.s.settings.dice) { await this.award.awardFly(); return; }
    this.shownDice = Math.max(0, this.dice.count - this.heldDice);
    this.refreshDice();
  }
  /** DiceHost.land: the ONLY way the chip number moves (a base die, or released storm dice). */
  private landDice(add: number, fromHeld: boolean): void {
    if (fromHeld) this.heldDice = Math.max(0, this.heldDice - add);
    this.shownDice = Math.max(0, this.dice.count - this.heldDice);
    this.hud.landDice(this.shownDice, this.calm());
    this.refreshDice();
    this.w.audio.play('dieLand', { gain: fromHeld ? 0.7 : 1 });
    if (!fromHeld) this.haptic(12);
  }

  private record(r: { spinId: string; totalOre: number }, mode: HistoryEntry['mode'], stakeOre: number, netOre: number, pre: HistoryEntry['pre'], die = false): void {
    if (mode === 'demo' || this.demoMode) return;
    this.s.history.push({ spinId: r.spinId, mode, stakeOre, winOre: r.totalOre, netOre, pre, at: Date.now(), ...(die ? { die: true as const } : {}) });
    if (this.s.history.length > 100) this.s.history.splice(0, this.s.history.length - 100);
    this.s.stats.spins++;
    this.s.stats.bestWinX = Math.max(this.s.stats.bestWinX, r.totalOre / stakeOre);
  }

  private async celebrate(tier: number, totalOre: number, stakeOre: number, storm: boolean, paid: number, dieNo = 0): Promise<void> {
    const w = this.w;
    this.celebration.layout(w.stage.w, w.stage.h, w.gridCenterY());
    await this.celebration.play(tier, totalOre, stakeOre, {
      audio: w.audio, particles: w.particles, storm, calm: this.calm(), demo: this.demoMode,
      onNeedsContinue: (b) => this.hud.show('bigwin', b),
      onCount: (v) => { if (!storm) this.hud.setWin(Math.round(v), stakeOre, 'win', undefined, paid); },
      // the die lives inside the celebration (born after the count-up; the result beat is untouched)
      die: dieNo && this.s.settings.dice ? { onBirth: (instant) => this.dieBirth(dieNo, tier, instant) } : undefined,
    });
    this.hud.show('bigwin', false);
  }

  private afterIdle(): void {
    if (this.demoPending) { this.demoPending = false; void this.demo(); return; }
    if (this.diceDeepLink()) return;
    this.maybeDiceMoments();
  }

  // ---------------------------------------------------------------- Terningen: deep links, one-time moments, cards
  /** #1948 (demo ceremony, 2 s), #kammer (chamber, 600 ms), #terning (demo die, 2 s): once, from the first idle. */
  private diceDeepLink(): boolean {
    const k = this.w.diceOnLoad;
    if (!k) return false;
    this.w.diceOnLoad = null;
    if (k === 'chamber') setTimeout(() => this.dispatch({ t: 'chamber', open: true }), 600);
    else setTimeout(() => this.dispatch(k === 'gate' ? { t: 'demoGate' } : { t: 'demoDie' }), 2000);
    return true;
  }
  private helloBlocked = false;
  private momentGen = 0;
  /** At idle, real play only: the first-die card, else the 1948 card (each once, 250 ms later), else the
   *  one-time hello card 1,2 s later. None of them carries a call to play. */
  private maybeDiceMoments(): void {
    if (!this.s.settings.dice || this.demoMode) return;
    const d = this.dice, gen = ++this.momentGen;
    const later = (s: number, f: () => void) => { gsap.delayedCall(s, () => { if (gen === this.momentGen && this.quietIdle()) f(); }); };
    if (d.count >= 1 && !d.introSeen) later(0.25, () => this.showFirstDieCard(false));
    else if (d.unlock === 'pending' && !d.offered) later(0.25, () => this.showUnlockCard());
    else if (!d.helloSeen && !this.helloBlocked && !this.s.activeStorm && !this.demoPending) later(1.2, () => this.showHello());
  }
  /** Idle with nothing else on screen (a menu, the drawer, a card or the chamber). */
  private quietIdle(): boolean {
    return this.state === 'idle' && !this.demoMode && !this.hud.menuOpen() && !this.hud.isShown('summary') && !this.award.chamberOpen();
  }
  private showHello(): void {
    if (this.dice.helloSeen || !this.s.settings.dice) return;
    const el = this.hud.showHello(helloHtml());
    this.award.cardShown('hello', el);
    this.w.announce(helloCopy().sr);
    this.dice.helloSeen = true;
    this.persist();
  }
  private hideHello(): void { if (this.hud.helloShown()) this.hud.hideHello(); }

  private card: DiceCard | null = null;
  private cardSnap: { snap: ReturnType<Game['snapshot']>; before: string } | null = null;
  /** The first-die card (modal, relic). Real: introSeen is written once. Demo: the amber note first, nothing written. */
  private showFirstDieCard(demo: boolean): void {
    this.hideHello();
    this.setState('diceCard');
    this.card = { kind: demo ? 'firstDemo' : 'firstDie', at: clock.time };
    this.hud.showSummary(firstDieHtml(demo ? this.dice.count : null), 'relic');
    this.award.cardShown('firstDie', this.hud.summaryEl());
    // the first two notes of the 1-9-4-8 motif (the full motif is kept for the gate)
    const t = this.w.audio.now();
    this.w.audio.play('bell1948', { level: 1, gain: 0.5, when: t });
    this.w.audio.play('bell1948', { level: 2, gain: 0.5, when: t + 0.704 });
    this.w.announce(firstDieCopy().sr);
    if (!demo) { this.dice.introSeen = true; this.dice.helloSeen = true; this.persist(); }
  }
  /** Die nr. 1948: shown once (offered), at the next idle. "Ikke nu" keeps 'pending'; there is never a reminder. */
  private showUnlockCard(): void {
    this.hideHello();
    this.setState('diceCard');
    this.card = { kind: 'unlock', at: clock.time };
    this.hud.showSummary(unlockCardHtml(this.dice.count), 'relic');
    this.award.cardShown('unlock', this.hud.summaryEl());
    this.w.audio.play('bell1948', { level: 1, gain: 0.7 });
    this.dice.offered = true;
    this.persist();
  }
  /** SPIN / Space / Enter / Esc on a card: "Forstået" on the first-die card, but only after 1,5 s (never by habit);
   *  the 1948 card is inert to them except Esc = "Ikke nu". */
  private cardKey(src: 'spin' | 'key' | 'esc'): void {
    const c = this.card;
    if (!c) return;
    if (c.kind === 'unlock') { if (src === 'esc') this.cardAct('later'); return; }
    this.cardAct('ok');
  }
  private cardAct(act: 'ok' | 'chamber' | 'gate' | 'later'): void {
    const c = this.card;
    if (!c || this.state !== 'diceCard') return;
    const first = c.kind !== 'unlock';
    if (first && act === 'ok' && clock.time - c.at < 1.5) return;
    if (first ? act !== 'ok' && act !== 'chamber' : act !== 'gate' && act !== 'later') return;
    this.card = null;
    this.hud.show('summary', false);
    this.lastModalClose = performance.now();
    if (c.kind === 'firstDemo') this.endDiceDemo();
    this.setState('idle');
    if (act === 'chamber') void this.openChamber();
    else if (act === 'gate') void this.runCeremony('real');
  }

  // ---------------------------------------------------------------- Terningen: demo isolation
  /** Every dice demo tool runs on a snapshot with persistence off; the real store is never read by its renderers. */
  private beginDiceDemo(): { snap: ReturnType<Game['snapshot']>; before: string } {
    setPersistenceEnabled(false);
    this.demoMode = true;
    return { snap: this.snapshot(), before: JSON.stringify(this.dice) };
  }
  private finishDiceDemo(t: { snap: ReturnType<Game['snapshot']>; before: string }): void {
    this.diceGuard(t.before);
    this.restore(t.snap);
    this.demoMode = false;
    setPersistenceEnabled(true);
  }
  private endDiceDemo(): void {
    const t = this.cardSnap;
    this.cardSnap = null;
    if (t) this.finishDiceDemo(t);
  }

  /** Drawer "Vis en terning": award-only (no win, no celebration, no searched spin); the number never changes. */
  private async demoDie(): Promise<void> {
    this.hideHello();
    const t = this.beginDiceDemo();
    this.setState('demoDie');
    this.hud.banner(DEMO_DIE_BANNER.t, DEMO_DIE_BANNER.s);
    this.w.audio.play('dieBirth', { when: this.w.audio.now() + 0.05 });
    await this.award.demoAward();
    this.finishDiceDemo(t);
    this.setState('idle');
  }
  /** Drawer "Vis første terning": the same card with the amber demo note first; introSeen is never written. */
  private demoFirstDie(): void {
    this.cardSnap = this.beginDiceDemo();
    this.showFirstDieCard(true);
  }

  // ---------------------------------------------------------------- Terningen: the chamber
  /** What the chamber and the gate currently show (renderers read a DiceView, never the store). */
  private chamberView: DiceView = { count: 0, unlock: 'none', mode: 'real' };
  private chamberDemo: { snap: ReturnType<Game['snapshot']>; before: string } | null = null;
  private chamberClosing = false;
  private ribbonFor(v: DiceView, kind: RibbonKind | null): { kind: RibbonKind; text: string } | null {
    return kind ? { kind, text: chamberRibbon(kind, v.count, this.dice.count) } : null;
  }
  /** Music heard inside the cliff (low-pass + −3 dB); unfiltered in the open state after a real unlock. */
  private chamberAudio(open: boolean): void {
    const a = this.w.audio;
    const sealed = open && !(this.chamberView.mode === 'real' && this.dice.unlock === 'seen');
    a.setMusicFilter(sealed ? 4500 : 20000, open ? 0.8 : 0.6);
    a.duck(open ? -3 : 0, open ? 0.8 : 0.6);
    if (open) void a.prepareGate();
  }
  /** Opens from idle only. `preview` = the drawer's fixed steps (0 · 25 · 250 · 1000 · 1948 åben): view only. */
  private async openChamber(preview?: PreviewStep): Promise<void> {
    if (this.state !== 'idle') return;
    this.hideHello();
    if (preview !== undefined) this.chamberDemo = this.beginDiceDemo();
    const view = preview === undefined ? realDiceView(this.dice) : previewDiceView(preview);
    this.chamberView = view;
    this.setState('chamber');
    this.hud.setChamberMode(true);
    this.chamberAudio(true);
    await this.award.openChamber(view, { ribbon: this.ribbonFor(view, preview === undefined ? null : 'preview'), realN: this.dice.count });
  }
  /** Esc / ✕ / "Luk". A preview ends here and the real view is restored. Focus returns to the chip for Esc only. */
  private async closeChamber(key = false): Promise<void> {
    if (this.state !== 'chamber' || this.chamberClosing) return;
    this.chamberClosing = true;
    this.chamberAudio(false);
    await this.award.closeChamber();
    this.hud.setChamberMode(false);
    this.w.audio.releaseGate();
    if (this.chamberDemo) { const t = this.chamberDemo; this.chamberDemo = null; this.finishDiceDemo(t); }
    this.chamberView = realDiceView(this.dice);
    this.chamberClosing = false;
    this.lastModalClose = performance.now();
    this.setState('idle');
    if (key) this.hud.focusDiceChip(); else (document.activeElement as HTMLElement | null)?.blur?.();
  }

  // ---------------------------------------------------------------- Terningen: the gate ceremony
  private ceremonyRun: { kind: CeremonyKind; handle: CeremonyHandle | null; placard: boolean; demo: { snap: ReturnType<Game['snapshot']>; before: string } | null } | null = null;
  /** 'real' (die nr. 1948, pending: writes 'seen' at the seal beat or on skip), 'replay' (no writes), 'demo' (drawer / #1948:
   *  a hard cut to 1948 on a snapshot with persistence off, the amber ribbon pinned throughout, never writes). */
  private async runCeremony(kind: CeremonyKind): Promise<void> {
    if (this.ceremonyRun || (kind === 'real' && this.dice.unlock !== 'pending')) return;
    if (this.state !== 'idle' && this.state !== 'chamber') return;
    this.hideHello();
    const demo = kind === 'demo' ? this.beginDiceDemo() : null;
    const run: NonNullable<Game['ceremonyRun']> = { kind, handle: null, placard: false, demo };
    this.ceremonyRun = run;
    this.setState('ceremony');
    const n = this.dice.count;
    // before the seal the gate is all lit and closed (replay: the leaves reset to that pose)
    const view: DiceView = kind === 'demo' ? { count: DICE_GOAL, unlock: 'pending', mode: 'demo' } : { count: n, unlock: 'pending', mode: 'real' };
    this.chamberView = view;
    const opts = { ribbon: this.ribbonFor(view, kind === 'real' ? null : kind), realN: n };
    this.hud.setChamberMode(true);
    this.hud.setCeremonyMode(true);
    const ready = Promise.race([this.w.audio.prepareGate(), new Promise<void>((r) => setTimeout(r, 2000))]);
    if (this.award.chamberOpen()) this.award.setChamberView(view, opts);
    else { this.chamberAudio(true); await this.award.openChamber(view, opts); }
    await ready;
    this.w.announce(srCeremonyStart(kind, n));
    run.handle = this.award.ceremony(kind, { n, onSeal: () => { if (kind === 'real') this.sealGate(); } });
    await run.handle.done;
    if (kind === 'real') this.sealGate(); // a skip before the seal beat persists 'seen' here (idempotent)
    this.w.audio.releaseGate();
    this.w.announce(SR_CEREMONY_END);
    run.placard = true;
    this.hud.showSummary(placardHtml(kind, n), 'placard');
    this.award.cardShown('placard', this.hud.summaryEl());
  }
  /** The seal-break beat of a REAL ceremony: the only place unlock becomes 'seen' (a reload before it keeps 'pending'). */
  private sealGate(): void {
    if (this.demoMode || this.dice.unlock !== 'pending') return;
    this.dice.unlock = 'seen';
    this.dice.unlockedAt = Date.now();
    this.persist();
    this.refreshDice();
  }
  /** Tap / Esc / Space from 2,0 s after T0: jump to the end state; the placard follows at once. */
  private skipCeremony(): void {
    const run = this.ceremonyRun;
    if (!run || run.placard || !run.handle?.canSkip()) return; // the placard itself needs an explicit button
    run.handle.skip();
    const a = this.w.audio;
    a.cancelScheduled();
    a.fadeOut('gateDrone', 0.3);
    a.fadeOut('lightPad', 0.3);
    a.setMusicFilter(20000, 0.3);
    a.duck(0, 0.3);
  }
  private async placardAct(act: 'chamber' | 'back' | 'endDemo' | 'close'): Promise<void> {
    const run = this.ceremonyRun;
    if (!run || !run.placard || this.state !== 'ceremony') return;
    const ok = run.kind === 'real' ? act === 'chamber' || act === 'back' : run.kind === 'replay' ? act === 'close' : act === 'endDemo';
    if (!ok) return;
    run.placard = false;
    this.hud.show('summary', false);
    this.lastModalClose = performance.now();
    // "Se kammeret" / replay "Luk" stay in the chamber (open state); "Tilbage til NORDLYS" / "Afslut demo" close it
    const stay = !run.demo && act !== 'back';
    if (stay) this.hud.setCeremonyMode(false);
    if (run.demo) await this.award.closeGate(); // the demo leaves close again before the real view returns
    this.ceremonyRun = null;
    if (run.demo) this.finishDiceDemo(run.demo);
    const real = realDiceView(this.dice);
    this.chamberView = real;
    this.award.setChamberView(real, { ribbon: null, realN: this.dice.count });
    this.setState('chamber');
    if (stay) { this.chamberAudio(true); return; } // after a real unlock the music is unfiltered
    await this.closeChamber();
    this.hud.setCeremonyMode(false);
    if (run.demo) { const b = demoGateBanner(this.dice.count); this.hud.banner(b.t, b.s); }
  }

  // ---------------------------------------------------------------- storm
  private async runStorm(source: StormSource, stakeOre: number, opts: { resume?: { idx: number; spinIndex: number } } = {}): Promise<void> {
    const demo = source === 'demo';
    const w = this.w;
    const D = demo ? 'DEMO · ' : '';
    this.setState('stormTransition');
    const idx = demo ? ++this.s.counters.demo : opts.resume!.idx;
    const rng = spinRng(this.s.sessionSeed, demo ? 'demo' : 'storm', 100000 + idx);
    const st = createStorm(rng, stakeOre);
    // Resume: replay silently to reconstruct the exact state.
    if (opts.resume) for (let k = 0; k < opts.resume.spinIndex; k++) stormSpin(st, rng, this.stormId(idx, k));
    this.stormState = st;
    this.stormMeta = { source, stakeOre };
    if (!demo && this.s.activeStorm) { Object.assign(this.s.activeStorm, { spinIndex: st.spinIndex, spinsTotal: st.spinsTotal, marks: st.marks.slice(), winOre: st.winOre, maxMark: st.maxMark }); this.persist(); }
    // Storm sound + art must be ready before the cinematic's first beat (resumed storms prepare here).
    await Promise.race([this.prepareStorm(), new Promise<void>((r) => setTimeout(r, 2000))]);
    await w.ensureExtremeAssets();
    this.watermark.visible = demo;
    this.layoutWatermark();
    this.w.logo.visible = false; // the SOLSTORM title owns the band above the grid now
    const finishedAlready = !!opts.resume && st.spinIndex >= st.spinsTotal;
    if (finishedAlready) {
      // Reloaded after the last stormspin was committed: go straight to the payout.
      w.buildStormStage(st.marks);
      w.revealStormFrame(gsap.timeline(), 0);
      w.skyP.storm = 1; w.skyP.sun = 0.62;
      this.hud.setMode('storm', 'SOLSTORM');
    } else {
      this.setCine(true);
      this.cine = playSolstormIntro(this.cineWorld(st));
      await this.cine.done;
      this.cine = null;
    }
    // Terningen: dice committed before a reload wait on the frame again (never re-awarded: the replay above never awards).
    if (!demo) {
      this.heldDice = this.s.activeStorm?.diceAwarded ?? 0;
      this.shownDice = Math.max(0, this.dice.count - this.heldDice);
      if (this.heldDice > 0 && this.s.settings.dice) this.award.restoreHeld(this.heldDice);
      this.refreshDice();
    }
    let ghostDice = 0;
    // Status only after the reveal (no spoiler during the cinematic).
    this.hud.clearWin(`${D}Solstorm · ${st.spinsTotal - st.spinIndex} stormspin${demo ? ' · krediteres ikke' : ''}`);
    this.hud.setStormGoal(st.spinIndex, st.spinsTotal, Math.max(2, st.maxMark), st.winOre, stakeOre, demo);
    this.setState('stormReady');
    this.hud.setStormInfo(`${D}${st.spinsTotal - st.spinIndex} stormspin · ${source === 'A' ? 'låst indsats' : 'indsats'} ${fmtKr(stakeOre)}`);
    this.hud.setMode('storm', `${D}SOLSTORM ${st.spinIndex}/${st.spinsTotal}`);
    this.hud.refreshSide(stakeOre, true);
    if (!finishedAlready) {
      this.hud.show('stormReady', true);
      await this.waitFor('startStorm');
      this.hud.show('stormReady', false);
    }
    this.setCine(false);
    this.setState('stormSpinning');
    const ctx = this.presentCtx(true);
    while (st.spinIndex < st.spinsTotal) {
      const k = st.spinIndex;
      const before = st.winOre;
      const { result, meta } = stormSpin(st, rng, this.stormId(idx, k));
      let dieNo = 0;
      if (!demo) {
        // Each storm spin is judged at the storm stake. Never gated on opts.resume: this loop only plays unplayed spins.
        dieNo = this.awardDie(result);
        this.record(result, 'storm', stakeOre, result.totalOre, { charge: this.s.meter.charge, stakeSumOre: this.s.meter.stakeSumOre, perksPending: this.s.perksPending }, dieNo > 0);
        // full live state (the splash welcome reads maxMark on reload; resume itself replays from the seed)
        if (this.s.activeStorm) Object.assign(this.s.activeStorm, { spinIndex: st.spinIndex, spinsTotal: st.spinsTotal, marks: st.marks.slice(), winOre: st.winOre, maxMark: st.maxMark, diceAwarded: (this.s.activeStorm.diceAwarded ?? 0) + (dieNo ? 1 : 0) });
        this.persist();
      }
      // a demo storm spin that would have qualified shows a labelled ghost only (presentation, never counted)
      const ghost = demo && diceFor(result.totalOre, result.stakeOre);
      if (ghost) ghostDice++;
      this.hud.setMode('storm', `${D}SOLSTORM ${meta.index + 1}/${meta.total}`);
      this.hud.setStormGoal(meta.index + 1, meta.total, Math.max(2, st.maxMark), before, stakeOre, demo);
      if (meta.wave) await w.stormWave(meta.wave.before, meta.wave.after);
      this.hud.setWin(before, stakeOre, 'live', `${D}Solstorm ${meta.index + 1}/${meta.total} · ${fmtKr(before)}`);
      await presentSpin(ctx, result, { storm: true, freshMarks: false, paidOre: 0, liveStrip: false });
      this.hud.setWin(st.winOre, stakeOre, 'live', `${D}Solstorm ${meta.index + 1}/${st.spinsTotal} · ${fmtKr(st.winOre)} (${fmtX(st.winOre / stakeOre)})`);
      w.audio.stormLevel(st.maxMark);
      this.hud.setStormGoal(meta.index + 1, st.spinsTotal, st.maxMark, st.winOre, stakeOre, demo);
      // S+0: the die pops at the biggest cluster and is held on the frame; the next storm spin waits for it
      let pop: Promise<void> = Promise.resolve();
      if (dieNo) pop = this.stormDie(dieNo, this.dieSpot(result));
      else if (ghost && this.s.settings.dice) pop = this.award.stormGhost(this.dieSpot(result));
      if (result.triggers.retriggerSpins > 0) {
        this.hud.banner(`+${result.triggers.retriggerSpins} STORMSPIN`, `${st.spinsTotal} stormspin i alt`, 'storm');
        w.audio.play('sun', { level: 3 });
        await wait(0.8);
      }
      await Promise.all([wait(0.25), pop]);
    }
    // Captured before activeStorm is cleared (the summary row survives a reload through diceAwarded).
    const stormDice = demo ? ghostDice : (this.s.activeStorm?.diceAwarded ?? 0);
    const sum = finishStorm(st);
    const total = sum.winOre + sum.guaranteeOre;
    if (!demo) {
      if (sum.guaranteeOre > 0) this.record({ spinId: this.stormId(idx, 99) + '-G', totalOre: sum.guaranteeOre }, 'storm', stakeOre, sum.guaranteeOre, { charge: this.s.meter.charge, stakeSumOre: this.s.meter.stakeSumOre, perksPending: this.s.perksPending });
      this.s.balanceOre += total; this.s.activeStorm = null; this.s.lastSpinAt = Date.now(); this.persist();
    }
    this.setState('stormSummary');
    const tier = winTier(total, stakeOre);
    if (tier >= 2) await this.celebrate(tier, total, stakeOre, true, 0);
    if (!demo) { this.sessionNet += total; this.tickClock(); }
    this.hud.setBalance(this.s.balanceOre);
    const dieRow = stormDice > 0 && this.s.settings.dice ? stormSummaryRow(stormDice, demo) : null;
    this.hud.showSummary(`
      <h2>${demo ? 'DEMO-RESULTAT' : 'SOLSTORM'}</h2>
      ${demo ? `<div class="demo-note">${DEMO_STORM_NOTE}</div>` : ''}
      <div class="big num">${fmtKr(total)}</div>
      <div class="sub num">${fmtX(total / stakeOre)} indsats · ${sum.spins} stormspin</div>
      <div class="rows num">
        <div><span>Stormgevinst</span><b>${fmtKr(sum.winOre)}</b></div>
        ${sum.guaranteeOre > 0 ? `<div><span>Stormgaranti (min. ${CONFIG.guaranteeX}×)</span><b>+${fmtKr(sum.guaranteeOre)}</b></div>` : ''}
        <div><span>Højeste mærke</span><b>×${sum.maxMark}</b></div>
        <div><span>${source === 'A' ? 'Låst indsats' : 'Indsats'}</span><b>${fmtKr(stakeOre)}</b></div>
        ${dieRow ? `<div class="dice-row"><span>${dieRow.label}</span><b>${dieRow.value}</b></div>` : ''}
        ${demo ? '' : `<div><span>Session netto</span><b>${fmtSignedKr(this.sessionNet)}</b></div>`}
      </div>
      <button class="btn storm" data-act="continue">Fortsæt</button>`);
    this.w.audio.play('summary');
    await this.waitFor('continue');
    this.hud.show('summary', false);
    this.setState('stormOutro');
    this.watermark.visible = false;
    // The meter may have been reset (route A): let the sky/arc settle to the real Kp during the outro.
    this.displayCharge = this.s.meter.charge;
    this.chargeCap = this.s.meter.charge;
    this.lastTier = Math.floor(this.kp());
    this.w.arc.setKp(this.kp());
    // the held dice rise into the returning night during the outro (all landed ≤ 2,6 s into it)
    await Promise.all([w.stormOutro(), this.releaseStormDice(demo)]);
    w.placeLogo();
    w.audio.releaseStorm();
    this.hud.setMode('base');
    this.stormState = null;
    this.stormMeta = null;
    this.hud.clearWin(demo ? 'Demo-storm afsluttet · krediteres ikke' : `Solstorm gav ${fmtKr(total)}`);
    this.w.audio.setBaseLayers(TIERS[Math.floor(this.kp())].music);
    this.rebakeTier = -1;
    this.maybeRebake(Math.floor(this.kp()));
    this.refreshHud();
    this.setState('idle');
    this.afterIdle();
  }

  /** Storm die (committed above): pop at the cluster, held in the next slot; the chip does not move until the outro. */
  private stormDie(n: number, at: Pt): Promise<void> {
    const slot = this.heldDice++;
    if (!this.s.settings.dice) return Promise.resolve();
    this.w.audio.play('dieQuench');
    this.w.announce(srStormPop(n));
    return this.award.stormPop(n, at, slot).then(() => this.w.audio.play('dieHold')); // constant pitch, never escalating
  }
  /** Centroid of the spin's biggest-winning cluster (fallback: the grid centre), in stage px. */
  private dieSpot(r: SpinResult): Pt {
    let best: { winOre: number; cells: number[] } | null = null;
    for (const st of r.steps) for (const c of st.clusters) if (!best || c.winOre > best.winOre) best = c;
    const g = this.w.grid;
    if (!best || !best.cells.length) return { x: this.w.gridRect.x + this.w.gridRect.size / 2, y: this.w.gridCenterY() };
    let x = 0, y = 0;
    for (const i of best.cells) { const p = g.globalCenter(i); x += p.x; y += p.y; }
    return { x: x / best.cells.length, y: y / best.cells.length };
  }
  /** Storm outro: release the held dice to the chip (each landing rolls shownDice); opted out, the count just catches up. */
  private async releaseStormDice(demo: boolean): Promise<void> {
    const k = demo ? 0 : this.heldDice;
    if (k > 0 && this.s.settings.dice) {
      await this.award.releaseHeld(k);
      this.w.announce(srStormOutro(k));
    }
    this.award.clearHeld();
    if (!demo) this.heldDice = 0;
    this.shownDice = Math.max(0, this.dice.count - this.heldDice);
    this.refreshDice();
  }

  private stormId(idx: number, k: number): string {
    return `NL-${(this.s.sessionSeed >>> 0).toString(16).padStart(8, '0')}-S${String(idx).padStart(4, '0')}${String(k).padStart(2, '0')}`;
  }

  private async resumeStorm(): Promise<void> {
    const a = this.s.activeStorm!;
    this.hud.banner('STORMEN FORTSÆTTER', `${a.spinsTotal - a.spinIndex} stormspin tilbage`, 'storm');
    await this.runStorm(a.source, a.stakeOre, { resume: { idx: a.seedIdx, spinIndex: a.spinIndex } });
  }

  private setCine(b: boolean): void { document.documentElement.classList.toggle('cine', b); }

  private cineWorld(st: StormState): CineWorld {
    const w = this.w;
    return {
      audio: w.audio, uber: w.uber, bloom: w.bloomCtl, camera: w.cam, sky: w.skyP,
      arcKp: (k) => w.arc.setKp(k),
      scene: w.stage.scene,
      hideForShatter: (b) => w.hideForShatter(b),
      capture: () => w.capture(),
      shatter: w.screenShatter,
      particles: w.particles,
      banners: w.stage.layers.banners,
      impactPoint: () => ({ x: w.gridRect.x + w.gridRect.size / 2, y: w.gridRect.y + w.gridRect.size / 2 }),
      gridTop: () => w.gridRect.y,
      titleBand: () => w.arcBand(),
      screen: () => ({ w: w.stage.w, h: w.stage.h }),
      buildStormStage: () => w.buildStormStage(st.marks),
      revealFrame: (tl, at) => w.revealStormFrame(tl, at),
      dropStormSymbols: (tl, at) => w.dropStormSymbols(tl, at, st.marks),
      onModeStorm: () => { this.hud.setMode('storm', `${this.demoMode ? 'DEMO · ' : ''}SOLSTORM`); },
      calm: this.calm(),
      haptic: (p) => this.haptic(p),
      flash: (a, ms) => w.flash(a, ms),
    };
  }

  private layoutWatermark(): void {
    // A dark pill centred on the frame's top border; drawn in the canvas so #clean can't hide it.
    const r = this.w.gridRect;
    const txt = this.watermark.getChildAt(1) as Text;
    const bg = this.watermark.getChildAt(0) as Graphics;
    const pw = txt.width + 18, ph = txt.height + 6;
    bg.clear().roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill({ color: 0x140a02, alpha: 0.82 }).stroke({ width: 1, color: 0xffb547, alpha: 0.8 });
    this.watermark.position.set(r.x + r.size / 2, r.y - Math.max(6, r.size * 0.022));
  }

  // ---------------------------------------------------------------- demo tools
  private demoMode = false;
  requestDemo(): void {
    if (this.demoMode) return; // a demo is already running (e.g. "Udløs via 4 sole")
    if (this.state === 'idle') { void this.demo(); return; }
    if (this.state === 'spinning' || this.state === 'celebrating') { this.demoPending = true; this.hud.setDemoEnabled(true, true); }
  }

  private snapshot() {
    return { meter: { ...this.s.meter }, perks: this.s.perksPending, display: this.displayCharge, lastTier: this.lastTier, cap: this.chargeCap,
      dice: { ...this.dice }, shown: this.shownDice, held: this.heldDice };
  }
  private restore(snap: ReturnType<Game['snapshot']>): void {
    this.s.meter = snap.meter; this.s.perksPending = snap.perks; this.displayCharge = snap.display; this.lastTier = snap.lastTier; this.chargeCap = snap.cap;
    this.dice = snap.dice; this.shownDice = snap.shown; this.heldDice = snap.held;
    this.w.arc.setKp(this.kp());
    this.w.skyP.kp = this.kp();
    this.refreshHud();
  }
  /** Dev builds: a demo entry point must leave the real dice byte-identical (defence in depth; restore() puts them back anyway). */
  private diceGuard(before: string): void {
    if (import.meta.env.DEV && JSON.stringify(this.dice) !== before) console.error('dice changed by demo');
  }

  private async demo(): Promise<void> {
    if (this.state !== 'idle') return;
    this.endPreview();
    setPersistenceEnabled(false);
    this.demoMode = true;
    const snap = this.snapshot(), before = JSON.stringify(this.dice);
    this.setState('demoLapse');
    this.setCine(true);
    this.prepareStorm();
    this.hud.banner('DEMO · SOLSTORM', 'Progressionen spoles frem · krediteres ikke', 'storm', 2400);
    await this.w.timeLapse(this.kp(), 2.4);
    await this.runStorm('demo', this.s.stakeOre);
    this.diceGuard(before);
    this.restore(snap);
    this.demoMode = false;
    setPersistenceEnabled(true);
    this.refreshHud();
    this.hud.banner('DIT FREMSKRIDT ER GENDANNET', `Kp ${fmt1(this.kp())} · demo-stormen talte ikke med`);
    this.afterIdle();
  }

  /** Demo: find a real base spin with 4+ suns in the demo domain, present it, then run a (demo) storm. */
  private async demoSuns(): Promise<void> {
    this.endPreview();
    let r: SpinResult | null = null;
    for (let k = 0; k < 40000 && !r; k++) {
      const idx = ++this.s.counters.demo;
      const cand = spinBase(spinRng(this.s.sessionSeed, 'demo', idx), this.s.stakeOre, {});
      if (cand.triggers.stormB) r = cand;
    }
    if (!r) return;
    setPersistenceEnabled(false);
    this.demoMode = true;
    const snap = this.snapshot(), before = JSON.stringify(this.dice);
    this.setState('spinning');
    this.watermark.visible = true; this.layoutWatermark();
    this.hud.clearWin('DEMO · spin med 4+ sole (søgt frem) · krediteres ikke');
    this.prepareStorm();
    await presentSpin(this.presentCtx(false, true), r, { storm: false, freshMarks: true, liveStrip: false });
    await this.runStorm('demo', this.s.stakeOre);
    this.diceGuard(before);
    this.restore(snap);
    this.demoMode = false;
    setPersistenceEnabled(true);
    this.refreshHud();
    this.afterIdle();
  }

  /** "Vis Kp": a visual preview only — the real meter is never touched. Ends at the next spin. */
  private preview: { display: number; lastTier: number } | null = null;
  private demoSetKp(kp: number): void {
    if (!this.preview) this.preview = { display: this.displayCharge, lastTier: this.lastTier };
    const i = Math.floor(kp);
    const f = TIERS[i].frac + (TIERS[Math.min(9, i + 1)].frac - TIERS[i].frac) * (kp - i);
    this.displayCharge = Math.floor(f * CONFIG.K);
    this.w.arc.setKp(this.kp());
    this.w.audio.setBaseLayers(TIERS[i].music);
    this.maybeRebake(i);
    this.refreshHud();
    this.hud.banner(`FORHÅNDSVISNING · KP ${fmt1(this.kp())}`, 'Kun visning · din måler er uændret · slutter ved næste spin');
  }
  private endPreview(): void {
    if (!this.preview) return;
    this.displayCharge = this.preview.display;
    this.lastTier = this.preview.lastTier;
    this.preview = null;
    this.w.arc.setKp(this.kp());
    this.w.audio.setBaseLayers(TIERS[Math.floor(this.kp())].music);
    this.maybeRebake(Math.floor(this.kp()));
    this.refreshHud();
  }

  private demoReset(): void {
    this.preview = null;
    wipe();
    const seed = newSessionSeed();
    this.s = defaults(seed, CONFIG.defaultStakeOre);
    this.sessionNet = 0;
    this.sessionStart = Date.now();
    this.displayCharge = 0;
    this.chargeCap = 0;
    this.lastTier = 0;
    this.w.arc.setKp(0);
    this.w.audio.setBaseLayers(1);
    this.maybeRebake(0);
    // "Nulstil demo" is the ONLY action that changes the real collection
    wipeDice();
    this.dice = diceDefaults(newSessionSeed());
    this.shownDice = this.heldDice = 0;
    this.award.clearHeld();
    this.applySettings();
    this.refreshHud();
    this.refreshSpinButton();
    this.persist();
    const b = DRAWER.resetBanner(fmtKr(START_BALANCE_ORE));
    this.hud.banner(b.t, b.s);
    if (this.state === 'splash') this.renderWelcome(false, false);
  }

  /** Debug/QA hooks. */
  debug() {
    return {
      state: () => this.state,
      kp: () => this.kp(),
      save: () => this.s,
      spin: () => this.spin(),
      demo: () => this.requestDemo(),
      unlock: () => this.dispatch({ t: 'unlock' }),
      startStorm: () => this.dispatch({ t: 'startStorm' }),
      cont: () => this.dispatch({ t: 'continue' }),
      setKp: (k: number) => this.demoSetKp(k),
      grid: () => this.w.grid.symOf.slice() as Sym[],
      /** QA only: fast-forward the base counter to the next spin matching a predicate (for deterministic screenshots).
       *  Terningen: 'die' = next base spin with 10 ≤ x < 20, 'sun4' = next 4+ suns (Solstorm), 'diePerk' = next Ladet spin
       *  with x ≥ 10 at the locked stake (perk counter; the Ladet spin itself must be pending). It only moves counters. */
      qaNext: (kind: 'bigwin' | 'megawin' | 'cascade' | 'sun3' | 'return' | 'nowin' | 'marks' | 'die' | 'diePerk' | 'sun4') => {
        const perk = kind === 'diePerk', domain = perk ? 'perk' : 'base';
        const stake = perk ? lockedStakeOre(this.s.meter) : this.s.stakeOre;
        for (let idx = this.s.counters[domain] + 1; idx < this.s.counters[domain] + 200000; idx++) {
          const r = spinBase(spinRng(this.s.sessionSeed, domain, idx), stake, { perk });
          const x = r.totalOre / r.stakeOre;
          const steps = r.steps.filter((st) => st.clusters.length).length;
          const ok = kind === 'bigwin' ? x >= 20 && x < 100 : kind === 'megawin' ? x >= 100 : kind === 'cascade' ? steps >= 3 && x > 1 && x < 5
            : kind === 'sun3' ? r.sunPayOre > 0 : kind === 'return' ? r.totalOre > 0 && r.totalOre < r.stakeOre && steps >= 1
            : kind === 'marks' ? r.marksAfter.some((m) => m >= 4) && x < 20
            : kind === 'die' ? x >= 10 && x < 20 && !r.triggers.stormB : kind === 'diePerk' ? diceFor(r.totalOre, r.stakeOre)
            : kind === 'sun4' ? r.triggers.stormB : r.totalOre === 0;
          if (ok) { this.s.counters[domain] = idx - 1; return { idx, x, steps }; }
        }
        return null;
      },
      /** Terningen QA (not reachable from the UI). */
      dice: () => ({ ...this.dice }),
      /** Sets the REAL count, for the unlock tests only (a veteran: the first-contact cards count as seen). */
      qaDice: (n: number) => {
        this.dice.count = Math.max(0, Math.floor(n));
        if (this.dice.count >= 1) { this.dice.introSeen = true; this.dice.helloSeen = true; this.dice.firstAt ??= Date.now(); }
        if (this.dice.count < DICE_GOAL) { this.dice.unlock = 'none'; this.dice.offered = false; this.dice.unlockedAt = null; }
        else if (this.dice.unlock === 'none') this.dice.unlock = 'pending';
        this.shownDice = Math.max(0, this.dice.count - this.heldDice);
        this.persist();
        this.refreshDice();
        return { ...this.dice };
      },
      award: () => ({ inFlight: this.award.inFlight(), held: this.award.held(), shown: this.shownDice, heldDice: this.heldDice, phase: this.award.phase() }),
      ceremony: (kind: CeremonyKind) => { void this.runCeremony(kind); },
      /** The running ceremony: started = past the pre-roll (skippable 2,0 s after T0), placard = waiting for a button. */
      gate: () => { const r = this.ceremonyRun; return r ? { kind: r.kind, started: !!r.handle, canSkip: !!r.handle?.canSkip(), placard: r.placard } : null; },
      chamber: (open: boolean) => this.dispatch({ t: 'chamber', open }),
      setSeed: (n: number) => { this.s.sessionSeed = n >>> 0; this.s.counters = { base: 0, storm: 0, perk: 0, demo: 0 }; },
      rand: () => crand(),
      _unused: [gsap, PAL, crange, fmtInt, kpOf, profileOf] as unknown,
    };
  }
}
