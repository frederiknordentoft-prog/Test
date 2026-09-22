// Game controller: state machine, money, meter, storms, demo. Presentation is delegated.
import { gsap } from 'gsap';
import { Text } from 'pixi.js';
import { spinRng, newSessionSeed } from '../math/rng.ts';
import { spinBase } from '../math/engine.ts';
import { createStorm, stormSpin, finishStorm, type StormState } from '../math/storm.ts';
import { kpOf, lockedStakeOre, addCharge, resetMeter } from '../math/meter.ts';
import { CONFIG, REPORT } from '../math/config.ts';
import type { SpinResult, Sym } from '../math/types.ts';
import { TIERS, kpFromCharge } from './tiers.ts';
import { bus } from './bus.ts';
import { load, save, defaults, wipe, setPersistenceEnabled, storageOk, START_BALANCE_ORE, type SaveData, type HistoryEntry } from './store.ts';
import { presentSpin, idleGrid, type PresentCtx } from '../present/director.ts';
import { profileOf, winTier } from '../present/schedule.ts';
import { Celebration } from '../present/celebration.ts';
import { playSolstormIntro, type CineWorld, type CineHandle } from '../present/cinematics/solstorm.ts';
import { wait } from '../present/clock.ts';
import { fmtKr, fmtSignedKr, fmt1, fmtX, fmtInt } from '../core/format.ts';
import { PAL } from '../core/palette.ts';
import { crand, crange } from '../core/cosmeticRng.ts';
import type { Hud, Intent } from '../ui/hud.ts';
import type { World } from './world.ts';

export type GameState =
  | 'boot' | 'splash' | 'intro' | 'idle' | 'spinning' | 'celebrating'
  | 'stormTransition' | 'stormReady' | 'stormSpinning' | 'stormSummary' | 'stormOutro' | 'demoLapse';

type StormSource = 'A' | 'B' | 'AB' | 'demo';

export class Game {
  state: GameState = 'boot';
  s: SaveData;
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
  private watermark: Text;
  private lastModalClose = 0;
  /** Active storm (kept for QA / debug inspection). */
  stormState: StormState | null = null;
  stormMeta: { source: StormSource; stakeOre: number } | null = null;
  private rebakeTier = -1;

  constructor(hud: Hud, w: World) {
    this.hud = hud;
    this.w = w;
    this.s = load(newSessionSeed(), CONFIG.defaultStakeOre);
    if (!CONFIG.stakesOre.includes(this.s.stakeOre)) this.s.stakeOre = CONFIG.defaultStakeOre;
    this.displayCharge = this.s.meter.charge;
    this.lastTier = Math.floor(this.kp());
    this.celebration = new Celebration();
    w.stage.layers.banners.addChild(this.celebration);
    this.watermark = new Text({ text: 'DEMO · Solstorm udløst manuelt', style: { fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: '700', fill: 0xffd79a, letterSpacing: 1 } });
    this.watermark.anchor.set(0.5, 1); this.watermark.alpha = 0.85; this.watermark.visible = false;
    w.stage.layers.hud.addChild(this.watermark);
    hud.bindRefs({ history: () => this.s.history, settings: () => this.s.settings, kp: () => this.kp() });
    this.applySettings();
    this.refreshHud();
    if (!storageOk) hud.notice('<span class="chip warn">Lagring er ikke tilgængelig · fremskridt gemmes kun i denne fane</span>');
    setInterval(() => this.tickClock(), 1000);
    this.tickClock();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) w.audio.suspend(); else w.audio.resume();
    });
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
    if (idle) this.refreshSpinButton();
    else if (to === 'spinning' || to === 'stormSpinning') this.hud.setSpin('busy', to === 'stormSpinning' ? 'STORM' : undefined);
  }
  private stakeIndex(): number { return CONFIG.stakesOre.indexOf(this.s.stakeOre); }
  private refreshSpinButton(): void {
    if (this.s.perksPending > 0) this.hud.setSpin('perk');
    else if (this.s.balanceOre < this.s.stakeOre) this.hud.setSpin('disabled');
    else this.hud.setSpin('idle');
  }
  private persist(): void { this.s.lastPlayed = Date.now(); save(this.s); }
  haptic(p: number | number[]): void {
    if (!this.s.settings.haptics || this.calm()) return;
    try { navigator.vibrate?.(p); } catch { /* ignore */ }
  }
  private avgSpinsLeft(): number | null {
    const next = TIERS.find((t) => t.kp === Math.floor(this.kp()) + 1);
    if (!next) return null;
    const cbar = REPORT.avgChargePerSpin > 0 ? REPORT.avgChargePerSpin : CONFIG.K / REPORT.avgSpinsToKp9;
    const need = Math.max(0, next.frac * CONFIG.K - this.displayCharge);
    return Math.max(1, Math.round(need / cbar));
  }
  refreshHud(): void {
    const h = this.hud;
    h.setBalance(this.s.balanceOre);
    h.setStake(this.s.stakeOre, this.stakeIndex() > 0, this.stakeIndex() < CONFIG.stakesOre.length - 1, this.state !== 'idle' && this.state !== 'splash' || this.s.perksPending > 0);
    const locked = this.s.meter.charge > 0 ? lockedStakeOre(this.s.meter) : this.s.stakeOre;
    h.setLock(this.s.meter.charge > 0 ? `Låst stormindsats ${fmtKr(locked)}` : '');
    h.setGoal(this.kp(), this.displayCharge, CONFIG.K, this.avgSpinsLeft());
    h.setMuted(this.s.settings.muted);
    h.refreshSide(this.s.stakeOre);
    h.setDemoKp(this.kp());
  }
  private tickClock(): void {
    this.hud.setClock(new Date());
    this.hud.setSession(Math.floor((Date.now() - this.sessionStart) / 60000), this.sessionNet);
  }
  applySettings(): void {
    const st = this.s.settings;
    this.w.audio.setMuted(st.muted);
    this.w.audio.setVolumes(st.music, st.sfx);
    document.documentElement.classList.toggle('calm', this.calm());
    const fromOs = st.calm === 'auto' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.hud.showFullFxOption(fromOs && !this.fullFx);
    this.w.setCalm(this.calm());
  }

  // ---------------------------------------------------------------- intents
  dispatch(i: Intent): void {
    if (performance.now() - this.lastModalClose < 250 && (i.t === 'spin' || i.t === 'continue' || i.t === 'startStorm')) return;
    switch (i.t) {
      case 'unlock': if (this.state === 'splash') void this.intro(); break;
      case 'spin': if (this.hud.menuOpen()) return; void this.spin(); break;
      case 'stakeUp': this.changeStake(1); break;
      case 'stakeDown': this.changeStake(-1); break;
      case 'demo': this.requestDemo(); break;
      case 'demoSuns': if (this.state === 'idle') void this.demoSuns(); break;
      case 'demoKp': if (this.state === 'idle') this.demoSetKp(i.kp); break;
      case 'demoReset': if (this.state === 'idle' || this.state === 'splash') this.demoReset(); break;
      case 'startStorm': this.resolveWaiter('startStorm'); break;
      case 'continue': this.hud.show('bigwin', false); if (this.celebration.active) this.celebration.continue(); else this.resolveWaiter('continue'); this.lastModalClose = performance.now(); break;
      case 'skip': if (this.hud.menuOpen()) return; if (this.celebration.active) this.celebration.skip(); else if (this.cine?.canSkip()) this.cine.skip(); break;
      case 'mute': this.s.settings.muted = !this.s.settings.muted; this.applySettings(); this.hud.setMuted(this.s.settings.muted); this.persist(); break;
      case 'refill': this.refill(); break;
      case 'settings': Object.assign(this.s.settings, i.s); this.applySettings(); this.persist(); break;
      case 'fullFx': this.fullFx = true; this.applySettings(); break;
      case 'menu': if (!i.open) this.lastModalClose = performance.now(); break;
    }
  }
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
    this.hud.show('splash', true);
    this.w.showSplash();
  }

  async intro(): Promise<void> {
    this.hud.show('splash', false);
    this.setState('intro');
    await this.w.audio.unlock();
    this.w.audio.startBase();
    this.w.audio.setBaseLayers(TIERS[Math.floor(this.kp())].music);
    await this.w.ignite(this.kp());
    const g = this.w.grid;
    const grid = idleGrid(g.cols, g.rows);
    await this.w.assembleGrid(grid);
    this.hud.pulseDemo();
    if (this.s.activeStorm) { await this.resumeStorm(); return; }
    this.setState('idle');
    if (this.s.perksPending > 0) this.hud.banner('LADET SPIN KLAR', `Gratis spil ved låst indsats ${fmtKr(lockedStakeOre(this.s.meter))}`);
    if (this.w.demoOnLoad) { this.w.demoOnLoad = false; setTimeout(() => this.requestDemo(), 2000); }
  }

  // ---------------------------------------------------------------- base spin
  private presentCtx(storm: boolean): PresentCtx {
    const w = this.w;
    return {
      grid: w.grid, cellShatter: w.cellShatter, particles: w.particles, motes: w.motes, arc: w.arc, popups: w.popups,
      hud: this.hud, audio: w.audio, calm: () => this.calm(), shake: (t) => w.shake(t), glowPulse: () => w.glowPulse(storm),
      onCharge: (a) => this.addDisplayCharge(a), haptic: (p) => this.haptic(p),
    };
  }

  private addDisplayCharge(a: number): void {
    this.displayCharge = Math.min(CONFIG.K, this.displayCharge + a);
    this.w.arc.pulse = Math.min(1, this.w.arc.pulse + 0.35);
    this.onKpDisplayChanged();
  }
  private onKpDisplayChanged(): void {
    const kp = this.kp();
    this.w.arc.setKp(kp);
    const tier = Math.floor(kp);
    if (tier > this.lastTier && this.state !== 'demoLapse') {
      for (let t = this.lastTier + 1; t <= Math.min(8, tier); t++) this.levelUp(t);
    }
    this.lastTier = Math.max(this.lastTier, tier);
    if (tier < this.lastTier) this.lastTier = tier;
  }
  private levelUp(t: number): void {
    const T = TIERS[t];
    this.w.audio.play('levelUp', { level: t });
    this.w.audio.setBaseLayers(T.music);
    this.w.breathe();
    const title = T.gName ? `GEOMAGNETISK STORM · ${T.gName} ${T.name.replace(' storm', '').toUpperCase()}` : `KP ${t} · ${T.name.toUpperCase()}`;
    this.hud.banner(title, T.change + (T.perk ? ' · gratis ved låst indsats' : ''));
    this.s.stats.highestKp = Math.max(this.s.stats.highestKp, t);
    this.maybeRebake(t);
  }
  private maybeRebake(tier: number): void {
    if (tier === this.rebakeTier) return;
    this.rebakeTier = tier;
    void this.w.rebakeBase();
  }

  async spin(): Promise<void> {
    if (this.state !== 'idle') return;
    const perk = this.s.perksPending > 0;
    const stake = perk ? lockedStakeOre(this.s.meter) : this.s.stakeOre;
    if (!perk && this.s.balanceOre < stake) {
      if (this.s.balanceOre < this.s.stakeOre) this.refill();
      return;
    }
    this.setState('spinning');
    const pre = { charge: this.s.meter.charge, stakeSumOre: this.s.meter.stakeSumOre, perksPending: this.s.perksPending };
    if (perk) this.s.perksPending--;
    else { this.s.balanceOre -= stake; this.sessionNet -= stake; }
    const domain = perk ? 'perk' : 'base';
    const idx = ++this.s.counters[domain];
    const rng = spinRng(this.s.sessionSeed, domain, idx);
    const r = spinBase(rng, stake, { perk });
    this.hud.setBalance(this.s.balanceOre);
    this.hud.clearWin(perk ? `Ladet spin · ${fmtKr(stake)} · 4 felter ×2` : '');
    const m = addCharge(this.s.meter, r.chargeGained, stake);
    this.persist(); // outcome committed before presentation
    const pr = await presentSpin(this.presentCtx(false), r, { storm: false, freshMarks: true });
    // settle
    this.s.balanceOre += r.totalOre;
    this.sessionNet += r.totalOre;
    this.displayCharge = Math.min(CONFIG.K, this.s.meter.charge);
    this.onKpDisplayChanged();
    this.finishSpinHud(r, pr.profile);
    this.record(r, perk ? 'perk' : 'base', stake, perk ? r.totalOre : r.totalOre - stake, pre);
    const perks = m.tiersCrossed.filter((t) => TIERS[t]?.perk).length;
    this.s.perksPending += perks;
    this.persist();
    const tier = winTier(r.totalOre, stake);
    if (tier >= 2) {
      this.setState('celebrating');
      await this.celebrate(tier, r.totalOre, stake, false);
    } else if (tier === 1) this.w.audio.play('win', { level: 1 });
    const A = m.stormA, B = r.triggers.stormB;
    if (A || B) {
      const source: StormSource = A && B ? 'AB' : A ? 'A' : 'B';
      const stormStake = source === 'A' ? lockedStakeOre(this.s.meter) : stake;
      if (A) { resetMeter(this.s.meter); }
      this.persist();
      await this.runStorm(source, stormStake);
      return;
    }
    this.refreshHud();
    this.setState('idle');
    if (perks > 0) this.hud.banner('LADET SPIN', `Gratis spil med 4 felter ×2 ved låst indsats ${fmtKr(lockedStakeOre(this.s.meter))}`);
    this.afterIdle();
  }

  private finishSpinHud(r: SpinResult, profile: ReturnType<typeof profileOf>): void {
    this.hud.setWin(r.totalOre, r.stakeOre, profile);
    this.hud.setBalance(this.s.balanceOre);
    const a = profile === 'win' ? `Gevinst ${fmtKr(r.totalOre)}. Netto ${fmtSignedKr(r.totalOre - r.stakeOre)}.` : profile === 'return' ? `Retur ${fmtKr(r.totalOre)}, netto ${fmtSignedKr(r.totalOre - r.stakeOre)}.` : profile === 'push' ? 'Indsats retur.' : 'Ingen gevinst.';
    bus.emit('win:final', { totalOre: r.totalOre, stakeOre: r.stakeOre, profile });
    this.w.announce(`${a} Kp ${fmt1(this.kp())}.`);
  }

  private record(r: SpinResult, mode: HistoryEntry['mode'], stakeOre: number, netOre: number, pre: HistoryEntry['pre']): void {
    if (mode === 'demo') return;
    this.s.history.push({ spinId: r.spinId, mode, stakeOre, winOre: r.totalOre, netOre, pre, at: Date.now() });
    if (this.s.history.length > 100) this.s.history.splice(0, this.s.history.length - 100);
    this.s.stats.spins++;
    this.s.stats.bestWinX = Math.max(this.s.stats.bestWinX, r.totalOre / stakeOre);
  }

  private async celebrate(tier: number, totalOre: number, stakeOre: number, storm: boolean): Promise<void> {
    const w = this.w;
    this.celebration.layout(w.stage.w, w.stage.h, w.gridCenterY());
    await this.celebration.play(tier, totalOre, stakeOre, {
      audio: w.audio, particles: w.particles, storm, calm: this.calm(),
      onNeedsContinue: (b) => this.hud.show('bigwin', b),
    });
    this.hud.show('bigwin', false);
  }

  private afterIdle(): void {
    if (this.demoPending) { this.demoPending = false; void this.demo(); }
  }

  // ---------------------------------------------------------------- storm
  private async runStorm(source: StormSource, stakeOre: number, opts: { resume?: { idx: number; spinIndex: number }; demo?: boolean } = {}): Promise<void> {
    const demo = source === 'demo';
    const w = this.w;
    this.setState('stormTransition');
    const domain = demo ? 'demo' : 'storm';
    const idx = opts.resume ? opts.resume.idx : ++this.s.counters[domain];
    const rng = spinRng(this.s.sessionSeed, domain, 100000 + idx);
    const st = createStorm(rng, stakeOre);
    // Resume: replay silently to reconstruct the exact state.
    if (opts.resume) for (let k = 0; k < opts.resume.spinIndex; k++) stormSpin(st, rng, this.stormId(idx, k));
    this.stormState = st;
    this.stormMeta = { source, stakeOre };
    if (!demo) { this.s.activeStorm = { source: source as 'A' | 'B' | 'AB', stakeOre, seedIdx: idx, spinIndex: st.spinIndex, spinsTotal: st.spinsTotal, marks: st.marks.slice(), winOre: st.winOre, maxMark: st.maxMark }; this.s.stats.storms++; this.persist(); }
    await w.ensureExtremeAssets();
    this.watermark.visible = demo;
    this.layoutWatermark();
    this.cine = playSolstormIntro(this.cineWorld(st));
    await this.cine.done;
    this.cine = null;
    this.setState('stormReady');
    this.hud.setStormInfo(`${st.spinsTotal - st.spinIndex} SOLSTORM-SPIN · ${source === 'A' ? 'Låst indsats' : 'Indsats'} ${fmtKr(stakeOre)}${demo ? ' · DEMO' : ''}`);
    this.hud.show('stormReady', true);
    this.hud.setMode('storm', `SOLSTORM ${st.spinIndex}/${st.spinsTotal}`);
    await this.waitFor('startStorm');
    this.hud.show('stormReady', false);
    this.setState('stormSpinning');
    const ctx = this.presentCtx(true);
    while (st.spinIndex < st.spinsTotal) {
      const k = st.spinIndex;
      const { result, meta } = stormSpin(st, rng, this.stormId(idx, k));
      this.hud.setMode('storm', `SOLSTORM ${meta.index + 1}/${meta.total}`);
      if (meta.wave) await w.stormWave(meta.wave.before, meta.wave.after);
      this.hud.setWin(st.winOre - result.totalOre, stakeOre, 'live', `Solstorm ${meta.index + 1}/${meta.total}`);
      await presentSpin(ctx, result, { storm: true, freshMarks: false });
      this.hud.setWin(st.winOre, stakeOre, 'live', `Solstorm ${meta.index + 1}/${st.spinsTotal} · ${fmtKr(st.winOre)} (${fmtX(st.winOre / stakeOre)})`);
      w.audio.stormLevel(st.maxMark);
      if (result.triggers.retriggerSpins > 0) {
        this.hud.banner(`+${result.triggers.retriggerSpins} SOLSTORM-SPIN`, `${st.spinsTotal} i alt`, 'storm');
        w.audio.play('sun', { level: 3 });
        await wait(0.8);
      }
      if (!demo && this.s.activeStorm) { this.s.activeStorm.spinIndex = st.spinIndex; this.s.activeStorm.spinsTotal = st.spinsTotal; this.persist(); }
      if (!demo) this.record(result, 'storm', stakeOre, result.totalOre, { charge: this.s.meter.charge, stakeSumOre: this.s.meter.stakeSumOre, perksPending: this.s.perksPending });
      await wait(0.25);
    }
    const sum = finishStorm(st);
    const total = sum.winOre + sum.guaranteeOre;
    this.setState('stormSummary');
    const tier = winTier(total, stakeOre);
    if (tier >= 2) await this.celebrate(tier, total, stakeOre, true);
    if (!demo) { this.s.balanceOre += total; this.sessionNet += total; this.s.activeStorm = null; this.persist(); }
    this.hud.setBalance(this.s.balanceOre);
    this.hud.showSummary(`
      <h2>${demo ? 'DEMO-RESULTAT' : 'SOLSTORM'}</h2>
      ${demo ? '<div class="demo-note">Demo-udløst storm · krediteres ikke saldoen · tæller ikke i statistikken</div>' : ''}
      <div class="big num">${fmtKr(total)}</div>
      <div class="sub num">${fmtX(total / stakeOre)} indsats · ${sum.spins} stormspin</div>
      <div class="rows num">
        <div><span>Stormgevinst</span><b>${fmtKr(sum.winOre)}</b></div>
        ${sum.guaranteeOre > 0 ? `<div><span>Stormgaranti</span><b>+${fmtKr(sum.guaranteeOre)}</b></div>` : ''}
        <div><span>Højeste mærke</span><b>×${sum.maxMark}</b></div>
        <div><span>${source === 'A' ? 'Låst indsats' : 'Indsats'}</span><b>${fmtKr(stakeOre)}</b></div>
        ${demo ? '' : `<div><span>Session netto</span><b>${fmtSignedKr(this.sessionNet)}</b></div>`}
      </div>
      <button class="btn storm" data-act="continue">Fortsæt</button>`);
    this.w.audio.play('summary');
    await this.waitFor('continue');
    this.hud.show('summary', false);
    this.setState('stormOutro');
    this.watermark.visible = false;
    await w.stormOutro();
    this.hud.setMode('base');
    this.stormState = null;
    this.stormMeta = null;
    this.hud.clearWin(demo ? 'Demo-storm afsluttet' : `Solstorm gav ${fmtKr(total)}`);
    this.displayCharge = this.s.meter.charge;
    this.lastTier = Math.floor(this.kp());
    this.w.arc.setKp(this.kp());
    this.w.audio.setBaseLayers(TIERS[Math.floor(this.kp())].music);
    this.refreshHud();
    this.setState('idle');
    this.afterIdle();
  }

  private stormId(idx: number, k: number): string {
    return `NL-${(this.s.sessionSeed >>> 0).toString(16).padStart(8, '0')}-S${String(idx).padStart(4, '0')}${String(k).padStart(2, '0')}`;
  }

  private async resumeStorm(): Promise<void> {
    const a = this.s.activeStorm!;
    this.hud.banner('STORMEN FORTSÆTTER', `${a.spinsTotal - a.spinIndex} stormspil tilbage`, 'storm');
    await this.runStorm(a.source, a.stakeOre, { resume: { idx: a.seedIdx, spinIndex: a.spinIndex } });
  }

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
      screen: () => ({ w: w.stage.w, h: w.stage.h }),
      buildStormStage: () => w.buildStormStage(st.marks),
      revealFrame: (tl, at) => w.revealStormFrame(tl, at),
      dropStormSymbols: (tl, at) => w.dropStormSymbols(tl, at, st.marks),
      onModeStorm: () => { this.hud.setMode('storm', `SOLSTORM 0/${st.spinsTotal}`); },
      calm: this.calm(),
      haptic: (p) => this.haptic(p),
      flash: (a, ms) => w.flash(a, ms),
    };
  }

  private layoutWatermark(): void {
    this.watermark.position.set(this.w.stage.w / 2, this.w.gridRect.y - 6);
  }

  // ---------------------------------------------------------------- demo tools
  requestDemo(): void {
    if (this.state === 'idle') { void this.demo(); return; }
    if (this.state === 'spinning' || this.state === 'celebrating') { this.demoPending = true; this.hud.setDemoEnabled(true, true); }
  }

  private async demo(): Promise<void> {
    if (this.state !== 'idle') return;
    setPersistenceEnabled(false);
    const snap = { meter: { ...this.s.meter }, perks: this.s.perksPending, display: this.displayCharge, lastTier: this.lastTier };
    this.setState('demoLapse');
    this.hud.banner('DEMO · SOLSTORM', 'Progressionen spoles frem · krediteres ikke', 'storm', 2400);
    await this.w.timeLapse(this.kp(), 2.4);
    await this.runStorm('demo', this.s.stakeOre);
    // restore the real meter
    this.s.meter = snap.meter;
    this.s.perksPending = snap.perks;
    this.displayCharge = snap.display;
    this.lastTier = snap.lastTier;
    this.w.arc.setKp(this.kp());
    this.w.skyP.kp = this.kp();
    setPersistenceEnabled(true);
    this.refreshHud();
    this.hud.banner('DIT FREMSKRIDT ER GENDANNET', `Kp ${fmt1(this.kp())} · demo-stormen talte ikke med`);
  }

  /** Demo: find a real base spin with 4+ suns in the demo domain, present it, then run a (demo) storm. */
  private async demoSuns(): Promise<void> {
    setPersistenceEnabled(false);
    const snap = { meter: { ...this.s.meter }, perks: this.s.perksPending, display: this.displayCharge, lastTier: this.lastTier };
    let r: SpinResult | null = null;
    for (let k = 0; k < 40000 && !r; k++) {
      const idx = ++this.s.counters.demo;
      const cand = spinBase(spinRng(this.s.sessionSeed, 'demo', idx), this.s.stakeOre, {});
      if (cand.triggers.stormB) r = cand;
    }
    if (!r) { setPersistenceEnabled(true); return; }
    this.setState('spinning');
    this.watermark.visible = true; this.layoutWatermark();
    this.hud.clearWin('DEMO · spil med 4+ sole (søgt frem, krediteres ikke)');
    await presentSpin(this.presentCtx(false), r, { storm: false, freshMarks: true });
    await this.runStorm('demo', this.s.stakeOre);
    this.s.meter = snap.meter; this.s.perksPending = snap.perks; this.displayCharge = snap.display; this.lastTier = snap.lastTier;
    this.w.arc.setKp(this.kp());
    setPersistenceEnabled(true);
    this.refreshHud();
  }

  private demoSetKp(kp: number): void {
    const f = TIERS[Math.floor(kp)].frac + (TIERS[Math.min(9, Math.floor(kp) + 1)].frac - TIERS[Math.floor(kp)].frac) * (kp - Math.floor(kp));
    const charge = Math.floor(f * CONFIG.K);
    this.s.meter.charge = charge;
    this.s.meter.stakeSumOre = charge * this.s.stakeOre;
    this.displayCharge = charge;
    this.lastTier = Math.floor(this.kp());
    this.w.arc.setKp(this.kp());
    this.w.audio.setBaseLayers(TIERS[this.lastTier].music);
    this.maybeRebake(this.lastTier);
    this.refreshHud();
    this.persist();
    this.hud.banner(`SANDKASSE · KP ${fmt1(this.kp())}`, 'Måleren er sat manuelt (demo)');
  }

  private demoReset(): void {
    wipe();
    const seed = newSessionSeed();
    this.s = defaults(seed, CONFIG.defaultStakeOre);
    this.sessionNet = 0;
    this.sessionStart = Date.now();
    this.displayCharge = 0;
    this.lastTier = 0;
    this.w.arc.setKp(0);
    this.w.audio.setBaseLayers(1);
    this.maybeRebake(0);
    this.applySettings();
    this.refreshHud();
    this.refreshSpinButton();
    this.persist();
    this.hud.banner('DEMO NULSTILLET', 'Saldo 1.000,00 kr · Kp 0');
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
      /** QA only: fast-forward the base counter to the next spin matching a predicate (for deterministic screenshots). */
      qaNext: (kind: 'bigwin' | 'megawin' | 'cascade' | 'sun3' | 'return' | 'nowin' | 'marks') => {
        for (let idx = this.s.counters.base + 1; idx < this.s.counters.base + 200000; idx++) {
          const r = spinBase(spinRng(this.s.sessionSeed, 'base', idx), this.s.stakeOre);
          const x = r.totalOre / r.stakeOre;
          const steps = r.steps.filter((st) => st.clusters.length).length;
          const ok = kind === 'bigwin' ? x >= 20 && x < 100 : kind === 'megawin' ? x >= 100 : kind === 'cascade' ? steps >= 3 && x > 1 && x < 5
            : kind === 'sun3' ? r.sunPayOre > 0 : kind === 'return' ? r.totalOre > 0 && r.totalOre < r.stakeOre && steps >= 1
            : kind === 'marks' ? r.marksAfter.some((m) => m >= 4) && x < 20 : r.totalOre === 0;
          if (ok) { this.s.counters.base = idx - 1; return { idx, x, steps }; }
        }
        return null;
      },
      setSeed: (n: number) => { this.s.sessionSeed = n >>> 0; this.s.counters = { base: 0, storm: 0, perk: 0, demo: 0 }; },
      rand: () => crand(),
      _unused: [gsap, PAL, crange, fmtInt, kpOf, profileOf] as unknown,
    };
  }
}
