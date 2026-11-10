/**
 * The Director: wallet, flow and the player's move.
 *
 * It asks the engine for Beats and plays them back through view, audio and
 * HUD. The engine is the only source of outcomes; nothing here can change a
 * result, only how and when it is shown.
 */
import { anim } from '../core/anim';
import { BET_LEVELS, BIG_WIN_TIERS, DEFAULT_BET_INDEX, START_BALANCE, TIMING } from '../core/config';
import { formatAmount, formatKr, formatMultiple } from '../core/format';
import { loop } from '../core/loop';
import type {
  Beat,
  BeatAwaitNudge,
  BigWinTier,
  GameMode,
  Grid,
  HudCallbacks,
  IAudio,
  IEngine,
  IGameView,
  IHud,
  Insets,
  NudgeChoice,
  Quality,
  RigKind,
  ViewCue,
} from '../core/types';
import { playCue, type CueContext } from './cues';
import { attachNudgeInput } from './input';

export type DirectorState = 'splash' | 'ready' | 'playing' | 'nudge';

export interface DirectorDeps {
  engine: IEngine;
  view: IGameView;
  audio: IAudio;
  hud: IHud;
  /** Current canvas size and a way to push a new layout to the view. */
  layout: { width(): number; height(): number; apply(insets: Insets): void };
  /** Pin the quality (URL override, automated capture): disables the adaptive step-down. */
  fixedQuality?: Quality;
}

export interface Director {
  readonly callbacks: HudCallbacks;
  readonly state: DirectorState;
  readonly balance: number;
  update(dt: number): void;
  /** Leave the splash (the SPIL button). */
  start(): Promise<void>;
  spin(): void;
  rig(kind: RigKind): void;
  nudge(choice: NudgeChoice | null): void;
  /** Resolves when the director is back in READY. */
  idle(): Promise<void>;
  setTurbo(on: boolean): void;
  setAutoNudge(on: boolean): void;
  dispose(): void;
}

interface Settings {
  muted: boolean;
  music: number;
  sfx: number;
  quality: Quality;
  turbo: boolean;
  autoNudge: boolean;
  haptics: boolean;
}

const SETTINGS_KEY = 'stella-nova:settings:v1';
const DEFAULT_SETTINGS: Settings = { muted: false, music: 0.8, sfx: 0.9, quality: 'high', turbo: false, autoNudge: false, haptics: true };

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // Storage can be blocked; the defaults are fine.
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // A convenience only.
  }
}

function bigWinTier(multiple: number): BigWinTier | null {
  let tier: BigWinTier | null = null;
  for (const t of BIG_WIN_TIERS) if (multiple >= t.min) tier = t.tier;
  return tier;
}

const BIG_WIN_SECONDS: Record<BigWinTier, number> = { 1: 4.2, 2: 6, 3: 8 };
/** A view animation that has not finished after this much animation time is abandoned. */
const WATCHDOG_SECONDS = 14;
/** Autoplay stops by itself after a win this large. */
const AUTO_STOP_MULTIPLE = 25;

export function createDirector(deps: DirectorDeps): Director {
  const { engine, view, audio, hud } = deps;
  const settings = loadSettings();
  if (deps.fixedQuality) settings.quality = deps.fixedQuality;

  let state: DirectorState = 'splash';
  let balance = START_BALANCE;
  let betIndex = DEFAULT_BET_INDEX;
  let autoRemaining: number | null = null;
  let skipping = false;
  let latestGrid: Grid = engine.snapshot().grid;
  let lastInsets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  let insetTimer = 0;
  let slowTime = 0;
  let countTickTimer = 0;
  let countTickIndex = 0;
  let bigWinRunning = false;
  let disposed = false;
  /** Player moves offered so far. The first few get their hint early: nobody has turned a ring before. */
  let nudgesOffered = 0;
  const idleWaiters: (() => void)[] = [];

  /** The pending player move, while the engine waits. */
  let pendingNudge: {
    beat: BeatAwaitNudge;
    resolve: (r: { choice: NudgeChoice | null; shown: boolean }) => void;
    hinted: boolean;
    idleTime: number;
  } | null = null;

  const bet = (): number => BET_LEVELS[betIndex];
  const turbo = (): boolean => settings.turbo;

  const cueCtx: CueContext = {
    audio,
    view,
    width: () => deps.layout.width(),
    haptics: () => settings.haptics,
  };

  // ───────────────────────────── helpers ─────────────────────────────

  const setState = (s: DirectorState): void => {
    state = s;
    if (s === 'ready') {
      hud.setSpinState('ready');
      while (idleWaiters.length) idleWaiters.shift()!();
    }
  };

  const refreshBet = (): void => {
    hud.setBet(bet(), { canDec: betIndex > 0, canInc: betIndex < BET_LEVELS.length - 1 });
  };

  const relayout = (): void => {
    lastInsets = hud.getInsets();
    deps.layout.apply(lastInsets);
  };

  const novaFill = (charge: number, threshold: number): number => Math.max(0, Math.min(1, threshold > 0 ? charge / threshold : 0));

  const showNova = (charge: number, threshold: number, animate = true): void => {
    const v = novaFill(charge, threshold);
    hud.setNovaCharge(v);
    view.setNovaCharge(v, { animate });
  };

  const musicFor = (mode: GameMode): void => audio.music(mode === 'free' ? 'free' : 'base');

  /**
   * Run one piece of presentation. A view that throws, rejects or never
   * finishes must not be able to stall the game: log it, snap the board to
   * the engine's truth and carry on.
   */
  const present = async (what: string, fn: () => Promise<unknown> | unknown, watchdog = true): Promise<void> => {
    try {
      const p = Promise.resolve(fn());
      if (!watchdog) {
        await p;
        return;
      }
      const timer = anim.wait(WATCHDOG_SECONDS);
      const outcome = await Promise.race([p.then(() => 'done' as const), timer.then(() => 'timeout' as const)]);
      timer.cancel();
      if (outcome === 'timeout') throw new Error('presentation timed out');
    } catch (err) {
      console.error(`[director] ${what} failed:`, err);
      try {
        view.setGrid(latestGrid);
      } catch (inner) {
        console.error('[director] could not restore the board:', inner);
      }
    }
  };

  // ───────────────────────────── the nudge ─────────────────────────────

  const endNudge = (choice: NudgeChoice | null, shown: boolean): void => {
    const p = pendingNudge;
    if (!p) return;
    pendingNudge = null;
    view.setHint(null);
    view.previewLines(null);
    view.setNudgeActive(false);
    hud.nudgePrompt({ on: false });
    state = 'playing';
    hud.setSpinState(autoRemaining !== null ? 'auto' : engine.snapshot().mode === 'free' ? 'free' : 'spinning');
    p.resolve({ choice, shown });
  };

  const waitNudge = (beat: BeatAwaitNudge): Promise<{ choice: NudgeChoice | null; shown: boolean }> =>
    new Promise((resolve) => {
      pendingNudge = { beat, resolve, hinted: false, idleTime: 0 };
      nudgesOffered += 1;
      state = 'nudge';
      hud.setSpinState('nudge');
      hud.nudgePrompt({ on: true, bestAmount: beat.best.amount });
      view.setNudgeActive(true);
      audio.sfx('nudgeReady');
      if (settings.autoNudge || autoRemaining !== null) {
        const target = pendingNudge;
        void anim.wait(0.35).then(() => {
          if (pendingNudge === target) endNudge(beat.best, false);
        });
      }
    });

  // ───────────────────────────── beats ─────────────────────────────

  const playBeat = async (b: Beat): Promise<void> => {
    switch (b.type) {
      case 'spinStart': {
        hud.setMultiplier(0, engine.model.ladder[0]);
        audio.music('spin');
        view.spinStart({ turbo: turbo() });
        if (b.mode === 'free') {
          const snap = engine.snapshot();
          hud.setFreeSpins({ remaining: snap.freeSpinsRemaining, total: b.freeSpinsTotal ?? snap.freeSpinsTotal, win: snap.freeSpinsWin });
        }
        break;
      }
      case 'spinStop': {
        latestGrid = b.grid;
        await present('spinStop', () => view.spinStop(b.grid, { turbo: turbo(), anticipation: b.anticipation, scatters: b.scatters }));
        audio.whirl(false);
        audio.tension(false);
        musicFor(engine.snapshot().mode);
        break;
      }
      case 'wins': {
        hud.setMultiplier(b.ladderIndex, b.multiplier);
        const multiple = b.stepAmount / Math.max(1, engine.snapshot().activeBet || bet());
        // Wins below the bet are stated, not celebrated.
        if (multiple < 1) audio.sfx('smallWin');
        else audio.sfx('lineWin', { index: b.ladderIndex, tier: multiple < 5 ? 1 : multiple < 20 ? 2 : 3 });
        for (const line of b.lines) {
          try {
            hud.floatText(view.spokeTipScreen(line.spoke), `+${formatAmount(line.amount)}`, 'line');
          } catch {
            // Decoration only.
          }
        }
        hud.setWin(b.totalAmount, { countSeconds: Math.max(0.25, Math.min(1.2, 0.3 + multiple * 0.08)) });
        await present('showWins', () => view.showWins(b.lines, { multiplier: b.multiplier, ladderIndex: b.ladderIndex, turbo: turbo() }));
        showNova(b.novaChargeAfter, b.novaThreshold);
        if (b.novaChargeAfter >= b.novaThreshold && b.novaChargeBefore < b.novaThreshold) audio.sfx('novaReady');
        break;
      }
      case 'cascade': {
        latestGrid = b.grid;
        await present('cascade', () => view.cascade(b, { turbo: turbo() }));
        hud.setMultiplier(b.nextLadderIndex, b.nextMultiplier, { pulse: true });
        if (b.nextMultiplier > 1) {
          audio.sfx('multiplierUp', { index: b.nextLadderIndex });
          try {
            hud.floatText(view.starScreen(), formatMultiple(b.nextMultiplier), 'mult');
          } catch {
            // Decoration only.
          }
        }
        break;
      }
      case 'nova': {
        latestGrid = b.grid;
        audio.music('nova');
        void hud.novaBanner().catch(() => undefined);
        await present('nova', () => view.nova(b.converted, b.grid, { turbo: turbo() }));
        showNova(0, 1);
        musicFor(engine.snapshot().mode);
        break;
      }
      case 'awaitNudge':
      case 'nudgeSkipped':
        // awaitNudge is handled by the beat loop; a skipped nudge has nothing to show.
        break;
      case 'nudge': {
        latestGrid = b.grid;
        break;
      }
      case 'freeSpinsTrigger': {
        await present('celebrateScatters', () => view.celebrateScatters(b.scatters));
        audio.sfx('freeSpinsTrigger');
        if (!b.retrigger) {
          autoRemaining = null;
          hud.setAuto(null);
          await present('freeSpinsIntro', () => hud.freeSpinsIntro(b.count, false), false);
          audio.sfx('freeSpinsStart');
          hud.setMode('free');
          audio.music('free');
          await present('setMode', () => view.setMode('free', { animate: true }));
        } else {
          await present('freeSpinsIntro', () => hud.freeSpinsIntro(b.count, true), false);
        }
        const snap = engine.snapshot();
        hud.setFreeSpins({ remaining: b.remaining, total: snap.freeSpinsTotal, win: snap.freeSpinsWin });
        relayout();
        break;
      }
      case 'spinEnd': {
        await settle(b.mode, b.totalAmount, b.totalMultiple);
        if (b.mode === 'free') {
          const snap = engine.snapshot();
          const total = b.freeSpinsTotalAmount ?? snap.freeSpinsWin;
          hud.setFreeSpins(b.freeSpinsEnded ? null : { remaining: b.freeSpinsRemaining, total: snap.freeSpinsTotal, win: snap.freeSpinsWin });
          if (b.freeSpinsEnded) {
            audio.sfx('freeSpinsEnd');
            await present('freeSpinsOutro', () => hud.freeSpinsOutro(total), false);
            hud.setMode('base');
            audio.music('base');
            await present('setMode', () => view.setMode('base', { animate: true }));
            hud.setWin(total);
            relayout();
          }
        }
        break;
      }
    }
  };

  /** Credit the spin and present its size honestly. */
  const settle = async (mode: GameMode, amount: number, multiple: number): Promise<void> => {
    if (amount > 0) {
      balance += amount;
      hud.setBalance(balance, { animate: true });
      hud.setWin(amount);
    }
    const tier = bigWinTier(multiple);
    if (tier) {
      bigWinRunning = true;
      countTickIndex = 0;
      audio.music('bigwin');
      audio.sfx('bigWinStart', { tier });
      view.bigWin(tier);
      await present('bigWin', () => hud.bigWin(tier, amount, { seconds: BIG_WIN_SECONDS[tier] }), false);
      bigWinRunning = false;
      view.bigWin(null);
      audio.sfx('countEnd', { tier });
      musicFor(mode === 'free' && engine.snapshot().mode === 'free' ? 'free' : engine.snapshot().mode);
      if (autoRemaining !== null && multiple >= AUTO_STOP_MULTIPLE) {
        autoRemaining = null;
        hud.setAuto(null);
      }
    } else if (amount === 0) {
      audio.sfx('noWin');
    } else if (multiple >= 1) {
      audio.sfx('countEnd', { tier: 0 });
    }
  };

  const playBeats = async (first: Beat[]): Promise<void> => {
    let beats = first;
    for (;;) {
      let wait: BeatAwaitNudge | null = null;
      for (const b of beats) {
        if (b.type === 'awaitNudge') {
          wait = b;
          break;
        }
        await playBeat(b);
      }
      if (!wait) return;
      const { choice, shown } = await waitNudge(wait);
      // A drag has already turned the ring; every other route still has to show it.
      if (choice && !shown) await present('applyNudge', () => view.applyNudge(choice));
      beats = engine.nudge(choice);
    }
  };

  // ───────────────────────────── the spin cycle ─────────────────────────────

  const oneSpin = async (): Promise<boolean> => {
    const mode = engine.snapshot().mode;
    if (mode === 'base') {
      if (balance < bet()) {
        hud.toast('Saldoen er for lav til denne indsats', 'info');
        audio.sfx('error');
        return false;
      }
      balance -= bet();
      hud.setBalance(balance);
      hud.setWin(0);
    }
    hud.setMessage(null);
    let beats: Beat[];
    try {
      beats = engine.spin(bet());
    } catch (err) {
      console.error('[director] the engine refused the spin:', err);
      if (mode === 'base') {
        balance += bet();
        hud.setBalance(balance);
      }
      return false;
    }
    await playBeats(beats);
    return true;
  };

  const cycle = async (): Promise<void> => {
    if (state !== 'ready' || disposed) return;
    state = 'playing';
    try {
      for (;;) {
        hud.setSpinState(autoRemaining !== null ? 'auto' : 'spinning');
        const played = await oneSpin();
        // Any free spins this spin started (or continues) play out by themselves.
        while (played && engine.snapshot().mode === 'free' && engine.snapshot().freeSpinsRemaining > 0 && !disposed) {
          hud.setSpinState('free');
          await anim.wait(turbo() ? 0.3 : 0.6);
          await oneSpin();
        }
        if (skipping) {
          skipping = false;
          anim.speed = 1;
        }
        if (!played || autoRemaining === null || disposed) break;
        autoRemaining -= 1;
        if (autoRemaining <= 0 || balance < bet()) {
          autoRemaining = null;
          hud.setAuto(null);
          break;
        }
        hud.setAuto(autoRemaining);
        await anim.wait(turbo() ? 0.25 : 0.5);
        if (autoRemaining === null) break;
      }
    } catch (err) {
      console.error('[director] the spin cycle failed:', err);
      try {
        view.setGrid(engine.snapshot().grid);
      } catch {
        // Nothing more to do.
      }
    } finally {
      skipping = false;
      anim.speed = 1;
      audio.whirl(false);
      audio.tension(false);
      musicFor(engine.snapshot().mode);
      hud.setAuto(autoRemaining);
      setState('ready');
    }
  };

  const spin = (): void => {
    if (state === 'ready') void cycle();
  };

  // ───────────────────────────── HUD callbacks ─────────────────────────────

  const callbacks: HudCallbacks = {
    onStart: () => void start(),
    onSpin: () => {
      audio.sfx('uiTap');
      spin();
    },
    onSkip: () => {
      if (state !== 'playing') return;
      skipping = true;
      anim.speed = 3;
      hud.skip();
    },
    onBet: (dir) => {
      if (state !== 'ready' || engine.snapshot().mode === 'free') return;
      const next = Math.max(0, Math.min(BET_LEVELS.length - 1, betIndex + dir));
      if (next === betIndex) return;
      betIndex = next;
      audio.sfx(dir > 0 ? 'betUp' : 'betDown', { index: betIndex });
      refreshBet();
    },
    onAuto: (count) => {
      audio.sfx('uiToggle');
      if (count === null) {
        autoRemaining = null;
        hud.setAuto(null);
        return;
      }
      if (state !== 'ready') return;
      autoRemaining = count;
      hud.setAuto(count);
      void cycle();
    },
    onTurbo: (on) => {
      settings.turbo = on;
      saveSettings(settings);
      hud.setTurbo(on);
      audio.sfx('uiToggle');
    },
    onAutoNudge: (on) => {
      settings.autoNudge = on;
      saveSettings(settings);
      hud.setAutoNudge(on);
      audio.sfx('uiToggle');
      if (on && pendingNudge) endNudge(pendingNudge.beat.best, false);
    },
    onNudgePass: () => {
      if (pendingNudge) {
        audio.sfx('uiTap');
        endNudge(null, false);
      }
    },
    onNudgeChoice: (choice) => {
      if (pendingNudge) endNudge(choice, false);
    },
    onMute: (muted) => {
      settings.muted = muted;
      saveSettings(settings);
      audio.setMuted(muted);
      hud.setMuted(muted);
    },
    onVolume: (bus, v) => {
      if (bus === 'music') settings.music = v;
      else settings.sfx = v;
      saveSettings(settings);
      audio.setVolume(bus, v);
    },
    onQuality: (q) => {
      settings.quality = q;
      saveSettings(settings);
      view.setQuality(q);
      hud.setQuality(q);
    },
    onDemo: (action) => {
      if (action === 'addBalance') {
        balance += 100000;
        hud.setBalance(balance, { animate: true });
        hud.toast(`${formatKr(100000)} sat ind på demosaldoen`, 'info');
        return;
      }
      if (action === 'resetBalance') {
        balance = START_BALANCE;
        hud.setBalance(balance, { animate: true });
        return;
      }
      rig(action);
    },
  };

  const rig = (kind: RigKind): void => {
    if (state !== 'ready' || engine.snapshot().mode !== 'base') {
      hud.toast('Vent til spinnet er færdigt', 'info');
      return;
    }
    engine.rig(kind);
    spin();
  };

  // ───────────────────────────── boot and lifecycle ─────────────────────────────

  const start = async (): Promise<void> => {
    if (state !== 'splash') return;
    state = 'playing';
    try {
      await audio.unlock();
    } catch (err) {
      console.error('[director] audio could not start:', err);
    }
    audio.setMuted(settings.muted);
    audio.setVolume('music', settings.music);
    audio.setVolume('sfx', settings.sfx);
    audio.music('base');
    audio.sfx('uiOpen');
    hud.showSplash(false);
    view.attract(false);
    relayout();
    await present('intro', () => view.intro());
    setState('ready');
  };

  const onCue = (cue: ViewCue): void => {
    try {
      playCue(cue, cueCtx);
    } catch (err) {
      console.error('[director] cue failed:', cue.type, err);
    }
  };
  view.onCue(onCue);

  const detachInput = attachNudgeInput(view, engine, {
    isActive: () => pendingNudge !== null,
    onDragStart: () => {
      if (!pendingNudge) return;
      pendingNudge.idleTime = 0;
      view.setHint(null);
    },
    onCommit: (choice) => endNudge(choice, true),
  });

  const onVisibility = (): void => {
    const hidden = document.hidden;
    loop.paused = hidden;
    audio.suspend(hidden);
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  // Initial chrome.
  const snap = engine.snapshot();
  hud.setBalance(balance);
  refreshBet();
  hud.setWin(0);
  hud.setMultiplier(0, engine.model.ladder[0]);
  hud.setTurbo(settings.turbo);
  hud.setAutoNudge(settings.autoNudge);
  hud.setMuted(settings.muted);
  hud.setQuality(settings.quality);
  hud.setAuto(null);
  hud.setFreeSpins(null);
  hud.setMode('base');
  hud.setSpinState('ready');
  showNova(snap.novaCharge, snap.novaThreshold, false);

  const update = (dt: number): void => {
    // The HUD's chrome can change height (free-spins strip, rotation); keep the view fitted.
    insetTimer += dt;
    if (insetTimer > 0.5) {
      insetTimer = 0;
      const i = hud.getInsets();
      if (i.top !== lastInsets.top || i.bottom !== lastInsets.bottom || i.left !== lastInsets.left || i.right !== lastInsets.right) relayout();
    }

    // Hint: after a while without a move, point at the best one. Once.
    const p = pendingNudge;
    if (p && !p.hinted && !settings.autoNudge && autoRemaining === null) {
      p.idleTime += dt;
      if (p.idleTime >= (nudgesOffered <= 3 ? 1.4 : TIMING.hintDelay)) {
        p.hinted = true;
        view.setHint({ ring: p.beat.best.ring, dir: p.beat.best.dir });
        audio.sfx('hint');
      }
    }

    // The count-up's rising tick while a big win is on screen.
    if (bigWinRunning) {
      countTickTimer += dt;
      if (countTickTimer >= 0.075) {
        countTickTimer = 0;
        audio.sfx('countTick', { index: countTickIndex++ });
      }
    }

    // Step the quality down once if the device cannot hold the frame rate.
    if (!deps.fixedQuality && state !== 'splash') {
      if (loop.frameMs > 24) slowTime += dt;
      else slowTime = Math.max(0, slowTime - dt * 2);
      if (slowTime > 3 && settings.quality !== 'low') {
        slowTime = 0;
        settings.quality = settings.quality === 'high' ? 'medium' : 'low';
        view.setQuality(settings.quality);
        hud.setQuality(settings.quality);
      }
    }
  };

  return {
    callbacks,
    get state() {
      return state;
    },
    get balance() {
      return balance;
    },
    update,
    start,
    spin,
    rig,
    nudge: (choice) => {
      if (pendingNudge) endNudge(choice, false);
    },
    idle: () => (state === 'ready' ? Promise.resolve() : new Promise<void>((r) => idleWaiters.push(r))),
    setTurbo: (on) => callbacks.onTurbo(on),
    setAutoNudge: (on) => callbacks.onAutoNudge(on),
    dispose: () => {
      disposed = true;
      detachInput();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
