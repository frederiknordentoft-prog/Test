// World: owns every render object + the frame loop. Game calls into it for presentation beats.
import { gsap } from 'gsap';
import { Container, Sprite, type Texture } from 'pixi.js';
import { createStage, resizeStage, captureScene, type Stage } from '../render/app.ts';
import { GridView } from '../render/grid/GridView.ts';
import { Frame } from '../render/grid/Frame.ts';
import { KpArc } from '../render/hud/KpArc.ts';
import { softBand } from '../render/tex.ts';
import {
  IsText, installIsfont, bakeSymbols, bakeSymbolsAsync, bakeCellFx, SkyLayer, UberPost, createBloom,
  Particles, CellShatter, ScreenShatter, Motes, type SymbolSet, type CellFx, type SkyParams,
  destroySymbolSet, destroyCellFx, onArtContextRestored, STORM_ENV,
} from '../render/modules.ts';
import { audio, type GameAudio } from '../audio/audio.ts';
import { tick, clock, setManualClock } from '../present/clock.ts';
import { crand, crange } from '../core/cosmeticRng.ts';
import { PAL } from '../core/palette.ts';
import { CONFIG } from '../math/config.ts';
import { TIERS } from './tiers.ts';
import type { Sym } from '../math/types.ts';
import { idleGrid } from '../present/director.ts';
import type { Hud } from '../ui/hud.ts';

const toHex = (c: [number, number, number]) => ((Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255)) >>> 0;

export class World {
  stage!: Stage;
  hud: Hud;
  audio: GameAudio = audio;
  sky!: SkyLayer;
  grid = new GridView();
  frame = new Frame();
  arc = new KpArc();
  particles!: Particles;
  motes!: Motes;
  cellShatter!: CellShatter;
  screenShatter!: ScreenShatter;
  popups = new Container();
  uber!: UberPost;
  bloom!: ReturnType<typeof createBloom>;
  bloomCtl = { strength: 1 };
  logo!: IsText;
  baseSet!: SymbolSet;
  stormSet: SymbolSet | null = null;
  private stormBaking: Promise<SymbolSet> | null = null;
  cellFx!: CellFx;
  skyP: SkyParams = { kp: 0, storm: 0, glow: 0, cme: 0, sun: 0, time: 0 };
  /** When true, Game/cinematics drive skyP.kp directly (no smoothing to the meter). */
  skyManual = false;
  skyKpTarget = 0;
  cam = { zoom: 1, trauma: 0 };
  gridRect = { x: 0, y: 0, size: 300, cell: 50 };
  private cellPx = 128;
  private stormCellPx = 96;
  private calm = false;
  private flashUntil = 0;
  private flashTimes: number[] = [];
  private sr: HTMLElement;
  private layoutDirty = true;
  private storm = false;
  demoOnLoad = false;
  manual = false; // headless stepping
  /** Adaptive quality: 0 = high, 1 = medium, 2 = low. */
  quality = 0;
  private perfAcc = 0;
  private perfN = 0;
  private perfSlow = 0;
  private perfFast = 0;
  private kpDisplay: () => number = () => 0;

  constructor(hud: Hud) {
    this.hud = hud;
    this.sr = document.createElement('div');
    this.sr.className = 'sr';
    this.sr.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.sr);
  }

  async init(kpDisplay: () => number): Promise<void> {
    this.kpDisplay = kpDisplay;
    const st = await createStage(this.hud.canvasHost);
    this.stage = st;
    installIsfont(st.renderer);
    this.sky = new SkyLayer(st.renderer);
    st.layers.sky.addChild(this.sky);
    st.layers.frameBack.addChild(this.frame.back);
    st.layers.grid.addChild(this.grid, this.popups);
    st.layers.frameFront.addChild(this.frame.front);
    st.layers.arc.addChild(this.arc);
    this.particles = new Particles(2400);
    this.motes = new Motes();
    this.cellShatter = new CellShatter();
    this.screenShatter = new ScreenShatter(st.renderer);
    st.layers.cellFx.addChild(this.cellShatter);
    st.layers.particles.addChild(this.particles);
    st.layers.motes.addChild(this.motes);
    st.layers.shatter.addChild(this.screenShatter);
    this.uber = new UberPost();
    this.bloom = createBloom();
    st.world.filters = [this.bloom, this.uber];
    this.logo = new IsText({ text: 'NORDLYS', size: 40, style: 'ice', tracking: 0.14 });
    st.layers.banners.addChild(this.logo);
    this.skyP.kp = this.skyKpTarget = kpDisplay();
    this.arc.setKp(kpDisplay());
    this.layout();
    this.cellFx = bakeCellFx(st.renderer, this.cellPx);
    this.baseSet = bakeSymbols(st.renderer, { edition: 'base', cellPx: this.cellPx, env: this.sky.envColors() });
    this.grid.configure(CONFIG.cols, CONFIG.rows, this.gridRect.cell, this.baseSet, this.cellFx, false);
    this.placeGrid();
    // WebGL context loss (common when iOS backgrounds a tab): re-bake every GPU-baked texture.
    onArtContextRestored(st.renderer, () => {
      this.cellFx = bakeCellFx(st.renderer, this.cellPx);
      this.baseSet = bakeSymbols(st.renderer, { edition: 'base', cellPx: this.cellPx, env: this.sky.envColors() });
      if (this.stormSet || this.storm) this.stormSet = bakeSymbols(st.renderer, { edition: 'storm', cellPx: this.stormCellPx, env: STORM_ENV });
      const grid = this.grid.symOf.slice(), marks = this.grid.marks.slice();
      this.grid.configure(this.grid.cols, this.grid.rows, this.grid.cell, this.storm && this.stormSet ? this.stormSet : this.baseSet, this.cellFx, this.storm);
      if (grid.length === this.grid.cols * this.grid.rows) this.grid.setGrid(grid, marks);
    });
    const ro = new ResizeObserver(() => { this.layoutDirty = true; });
    ro.observe(this.hud.root);
    ro.observe(this.hud.slotGrid);
    st.app.ticker.add((tk) => {
      if (this.manual) return;
      this.watchPerf(tk.deltaMS);
      this.frameStep(Math.min(0.05, tk.deltaMS / 1000));
    });
  }

  // ------------------------------------------------------------ layout
  private measure(el: HTMLElement): DOMRect { return el.getBoundingClientRect(); }

  layout(): void {
    const st = this.stage;
    const host = this.hud.root.getBoundingClientRect();
    const w = Math.round(host.width), h = Math.round(host.height);
    if (w !== st.w || h !== st.h) resizeStage(st, w, h);
    const gs = this.measure(this.hud.slotGrid);
    const pad = Math.max(10, Math.min(gs.width, gs.height) * 0.035);
    const cols = this.storm ? CONFIG.stormCols : CONFIG.cols;
    const avail = Math.max(120, Math.min(gs.width - pad * 2, gs.height - pad * 2));
    const cell = Math.floor(avail / cols);
    const size = cell * cols;
    this.gridRect = { x: Math.round(gs.left - host.left + (gs.width - size) / 2), y: Math.round(gs.top - host.top + (gs.height - size) / 2), size, cell };
    const as = this.measure(this.hud.slotArc);
    this.arc.layout(as.left - host.left, as.top - host.top, as.width, as.height);
    const portrait = w / h < 1.1;
    const horizonY = portrait ? this.gridRect.y + size * 0.86 : h * 0.66;
    this.sky.resize(w, h, horizonY);
    this.sky.setFocus(this.gridRect.x, this.gridRect.y, size);
    this.frame.layout(this.gridRect.x, this.gridRect.y, size, this.storm);
    // symbol texture size for this cell size
    const want = cell * st.res * 1.25;
    const steps = [64, 96, 128, 160, 192, 256];
    const px = steps.find((p) => p >= want) ?? 256;
    if (!this.storm && px !== this.cellPx && this.baseSet) {
      this.cellPx = px;
      const oldFx = this.cellFx, oldSet = this.baseSet;
      this.cellFx = bakeCellFx(st.renderer, px);
      this.baseSet = bakeSymbols(st.renderer, { edition: 'base', cellPx: px, env: this.sky.envColors() });
      gsap.delayedCall(4, () => { destroyCellFx(oldFx); destroySymbolSet(oldSet); });
      if (this.grid.cells.length) { this.grid.setSymbolSet(this.baseSet); this.grid.configure(this.grid.cols, this.grid.rows, this.grid.cell, this.baseSet, this.cellFx, false); }
    } else if (!this.baseSet) this.cellPx = px;
    this.stormCellPx = steps.find((p) => p >= (size / CONFIG.stormCols) * st.res * 1.25) ?? 192;
    this.layoutDirty = false;
    // logo placement (header centre) unless intro owns it
    if (!this.logoIntro) this.placeLogo();
  }

  private logoIntro = true;
  private placeLogo(): void {
    const hdr = document.getElementById('hdr')!.getBoundingClientRect();
    const host = this.hud.root.getBoundingClientRect();
    const target = Math.min(22, Math.max(12, hdr.height * 0.34));
    this.logo.scale.set(target / 40);
    this.logo.position.set(this.stage.w / 2, hdr.top - host.top + hdr.height / 2);
  }

  private placeGrid(): void {
    const r = this.gridRect;
    const cols = this.grid.cols;
    const cell = Math.floor(r.size / cols);
    if (cell !== this.grid.cell) {
      const grid = this.grid.symOf.slice();
      const marks = this.grid.marks.slice();
      const had = this.grid.syms.some((s) => s);
      this.grid.configure(cols, this.grid.rows, cell, this.storm && this.stormSet ? this.stormSet : this.baseSet, this.cellFx, this.storm);
      if (had) this.grid.setGrid(grid, marks);
    }
    this.grid.position.set(r.x + (r.size - cols * cell) / 2, r.y + (r.size - cols * cell) / 2);
    this.popups.position.set(0, 0);
  }

  gridCenterY(): number { return this.gridRect.y + this.gridRect.size / 2; }

  // ------------------------------------------------------------ frame loop
  frameStep(dt: number): void {
    if (this.layoutDirty) { this.layout(); this.placeGrid(); }
    tick(dt);
    const fx = clock.fxDt;
    const t = clock.real;
    // sky
    if (!this.skyManual) {
      this.skyKpTarget = this.kpDisplay();
      this.skyP.kp += (this.skyKpTarget - this.skyP.kp) * Math.min(1, dt * 2.5);
    }
    this.skyP.glow = Math.max(0, this.skyP.glow - dt * 1.4);
    this.skyP.time = t;
    this.sky.update(this.skyP);
    // arc / frame
    this.arc.storm = this.skyP.storm;
    this.arc.update(dt, t);
    const env = this.sky.envColors();
    this.frame.update(t, toHex(env[0]), this.skyP.glow + (this.storm ? 0.5 : 0));
    const tier = TIERS[Math.min(9, Math.floor(this.skyP.kp))];
    this.frame.setCrackle(this.storm ? 0.25 : tier.sky.crackle);
    // fx
    this.particles.update(fx);
    this.motes.update(fx);
    this.cellShatter.update(fx);
    this.screenShatter.update(fx);
    // camera
    const cam = this.stage.camera;
    this.cam.trauma = Math.max(0, this.cam.trauma - dt * 1.1);
    const tr = this.calm ? 0 : this.cam.trauma * this.cam.trauma;
    const amp = 9;
    cam.scale.set(this.cam.zoom);
    cam.position.set(this.stage.w / 2 + (crand() * 2 - 1) * amp * tr, this.stage.h / 2 + (crand() * 2 - 1) * amp * tr);
    cam.rotation = (crand() * 2 - 1) * 0.004 * tr;
    // post
    this.uber.time = t;
    this.uber.storm = this.skyP.storm;
    if (this.calm) { this.uber.ca = 0; this.uber.glitch = 0; this.uber.zoom = 0; }
    else if (!this.uber.cinematic) this.uber.ca = 0.5 + this.skyP.storm * 2;
    this.uber.exposure = t < this.flashUntil ? this.uber.exposure : 0;
    this.bloom.strength = this.bloomCtl.strength * (this.storm ? 1.6 : 1) * (this.calm ? 0.8 : 1);
  }

  /** Down a tier after 1.5 s averaging > 19 ms/frame, up after 5 s < 12 ms. */
  private watchPerf(ms: number): void {
    if (document.hidden) return;
    this.perfAcc += ms; this.perfN++;
    if (this.perfAcc < 500) return;
    const avg = this.perfAcc / this.perfN;
    this.perfAcc = 0; this.perfN = 0;
    if (avg > 19) { this.perfSlow++; this.perfFast = 0; } else if (avg < 12) { this.perfFast++; this.perfSlow = 0; } else { this.perfSlow = 0; this.perfFast = 0; }
    if (this.perfSlow >= 3 && this.quality < 2) { this.setQuality(this.quality + 1); this.perfSlow = 0; }
    else if (this.perfFast >= 10 && this.quality > 0) { this.setQuality(this.quality - 1); this.perfFast = 0; }
  }
  setQuality(q: number): void {
    this.quality = q;
    const st = this.stage;
    const cap = [2, 1.5, 1][q];
    const res = Math.min(cap, Math.max(1, window.devicePixelRatio || 1));
    if (Math.abs(st.renderer.resolution - res) > 0.01) { st.renderer.resolution = res; st.res = res; st.renderer.resize(st.w, st.h); }
    this.particles.setBudget([2400, 1400, 600][q]);
    this.bloom.enabled = q < 2;
    this.sky.auroraEvery = q >= 1 ? 2 : 1;
  }

  /** Headless deterministic stepping for screenshots / QA. */
  advance(ms: number, render = true): void {
    if (!this.manual) { this.manual = true; setManualClock(true); }
    const steps = Math.round(ms / (1000 / 60));
    for (let i = 0; i < steps; i++) this.frameStep(1 / 60);
    if (render) this.stage.app.render();
  }

  // ------------------------------------------------------------ small effects
  shake(trauma: number): void { if (!this.calm) this.cam.trauma = Math.min(1, this.cam.trauma + trauma); }
  glowPulse(storm: boolean): void { this.skyP.glow = Math.max(this.skyP.glow, storm ? 0.8 : 0.55); }
  breathe(): void { this.skyP.glow = 1; }
  flash(amount: number, ms: number): void {
    if (this.calm) return;
    const now = clock.real;
    this.flashTimes = this.flashTimes.filter((x) => now - x < 1);
    if (this.flashTimes.length >= 3) return; // FlashBudget: ≤ 3 luminance flashes / s
    this.flashTimes.push(now);
    this.uber.exposure = Math.min(0.9, amount);
    this.flashUntil = now + Math.max(0.033, ms / 1000);
  }
  announce(text: string): void { this.sr.textContent = text; }
  setCalm(b: boolean): void { this.calm = b; if (this.cellShatter) this.cellShatter.calm = b; }
  capture(): Texture { return captureScene(this.stage); }
  hideForShatter(b: boolean): void {
    const L = this.stage.layers;
    for (const c of [L.frameBack, L.grid, L.cellFx, L.frameFront, L.arc, L.motes]) c.visible = !b;
  }

  // ------------------------------------------------------------ intro
  showSplash(): void {
    this.grid.alpha = 0;
    this.frame.alpha = 0.18;
    this.arc.alpha = 0;
    this.skyP.kp = Math.min(this.kpDisplay(), 1);
    const W = this.stage.w, H = this.stage.h;
    const size = Math.max(34, Math.min(W, 760) * 0.12);
    this.logo.destroy();
    this.logo = new IsText({ text: 'NORDLYS', size, style: 'ice', tracking: 0.14 });
    this.stage.layers.banners.addChild(this.logo);
    this.logo.position.set(W / 2, H * 0.36);
    this.logo.reveal = 0;
    gsap.to(this.logo, { reveal: 1, duration: 1.3, ease: 'power2.inOut', delay: 0.3 });
    gsap.fromTo(this.logo, { sweep: -0.2 }, { sweep: 1.2, duration: 1.4, delay: 1.5, ease: 'power1.inOut' });
  }

  async ignite(kp: number): Promise<void> {
    this.skyP.glow = 1;
    this.skyManual = true;
    const o = { k: 0 };
    gsap.to(o, { k: kp, duration: 1.2, ease: 'power2.out', onUpdate: () => { this.skyP.kp = o.k; } });
    gsap.to(this.frame, { alpha: 1, duration: 0.9, delay: 0.2 });
    gsap.to(this.arc, { alpha: 1, duration: 0.8, delay: 0.5 });
    // logo flies to the header
    const hdr = document.getElementById('hdr')!.getBoundingClientRect();
    const host = this.hud.root.getBoundingClientRect();
    const target = Math.min(22, Math.max(12, hdr.height * 0.34));
    const s = target / (this.logo.height / (this.logo.scale.y || 1) * 0.72 || 40);
    await new Promise<void>((res) => gsap.to(this.logo, { y: hdr.top - host.top + hdr.height / 2, duration: 1.0, delay: 0.5, ease: 'power3.inOut', onComplete: res }));
    gsap.to(this.logo.scale, { x: Math.min(1, s), y: Math.min(1, s), duration: 0.001 });
    this.logoIntro = false;
    this.logo.destroy();
    this.logo = new IsText({ text: 'NORDLYS', size: 40, style: 'ice', tracking: 0.14 });
    this.stage.layers.banners.addChild(this.logo);
    this.placeLogo();
    this.skyManual = false;
  }

  async assembleGrid(grid: Sym[]): Promise<void> {
    const g = this.grid;
    g.alpha = 1;
    g.clearSyms();
    for (let c = 0; c < g.cols; c++) {
      gsap.delayedCall(c * 0.11, () => {
        for (let r = 0; r < g.rows; r++) {
          const i = c * g.rows + r;
          const sp = g.makeSym(i, grid[i]);
          const ty = sp.y;
          sp.y = ty - g.size - g.cell;
          sp.alpha = 0;
          gsap.to(sp, { y: ty, alpha: 1, duration: 0.42, ease: 'power3.out', delay: (g.rows - r) * 0.02 });
        }
        this.audio.play('land', { col: c, gain: 0.55 });
      });
    }
    await new Promise<void>((r) => gsap.delayedCall(g.cols * 0.11 + 0.5, r));
    void this.prebakeStorm();
  }

  // ------------------------------------------------------------ symbol baking
  async rebakeBase(): Promise<void> {
    const set = await bakeSymbolsAsync(this.stage.renderer, { edition: 'base', cellPx: this.cellPx, env: this.sky.envColors() });
    const old = this.baseSet;
    this.baseSet = set;
    if (!this.storm) this.grid.setSymbolSet(set);
    gsap.delayedCall(4, () => destroySymbolSet(old));
  }
  private prebakeStorm(): Promise<SymbolSet> {
    if (this.stormSet) return Promise.resolve(this.stormSet);
    if (!this.stormBaking) {
      this.stormBaking = bakeSymbolsAsync(this.stage.renderer, { edition: 'storm', cellPx: this.stormCellPx, env: STORM_ENV })
        .then((s: SymbolSet) => (this.stormSet = s));
    }
    return this.stormBaking!;
  }
  async ensureExtremeAssets(): Promise<void> {
    if (this.stormSet) return;
    // Fallback: synchronous bake if the async one has not started/finished.
    if (!this.stormBaking) this.stormSet = bakeSymbols(this.stage.renderer, { edition: 'storm', cellPx: this.stormCellPx, env: STORM_ENV });
    else await this.stormBaking;
  }

  // ------------------------------------------------------------ demo time-lapse
  async timeLapse(fromKp: number, secs: number): Promise<void> {
    this.skyManual = true;
    const o = { k: fromKp };
    const to = this.arc.headGlobal();
    const n = this.calm ? 20 : 90;
    for (let m = 0; m < n; m++) {
      gsap.delayedCall((m / n) * secs * 0.92, () => {
        const i = Math.floor(crand() * this.grid.cells.length);
        const p = this.grid.globalCenter(i);
        this.motes.launch(p, this.arc.headGlobal(), 1, { color: PAL.mote, dur: crange(0.45, 0.7) });
        if (m % 8 === 0) this.audio.play('mote');
      });
    }
    void to;
    let lastLayer = 0;
    await new Promise<void>((res) => gsap.to(o, {
      k: 9, duration: secs, ease: 'sine.in',
      onUpdate: () => {
        this.skyP.kp = o.k; this.arc.setKp(o.k);
        const layer = TIERS[Math.min(9, Math.floor(o.k))].music;
        if (layer !== lastLayer) { lastLayer = layer; this.audio.setBaseLayers(layer); }
      },
      onComplete: res,
    }));
    this.breathe();
  }

  // ------------------------------------------------------------ storm stage
  buildStormStage(marks: number[]): void {
    this.storm = true;
    this.layout();
    const cell = Math.floor(this.gridRect.size / CONFIG.stormCols);
    this.grid.configure(CONFIG.stormCols, CONFIG.stormRows, cell, this.stormSet!, this.cellFx, true);
    this.placeGrid();
    this.grid.clearSyms();
    this.grid.alpha = 1;
    this.frame.layout(this.gridRect.x, this.gridRect.y, this.gridRect.size, true);
    this.frame.alpha = 0;
    for (let i = 0; i < marks.length; i++) this.grid.setMark(i, 0, false);
    this.grid.bgLayer.alpha = 0;
  }
  revealStormFrame(tl: gsap.core.Timeline, at: number): void {
    tl.to(this.frame, { alpha: 1, duration: 0.6, ease: 'power2.out' }, at);
    tl.to(this.grid.bgLayer, { alpha: 1, duration: 0.8 }, at + 0.2);
    const r = this.gridRect;
    tl.call(() => {
      if (this.calm) return;
      for (let k = 0; k < 40; k++) {
        const u = k / 40;
        const side = k % 4;
        const x = side === 0 ? r.x + u * r.size : side === 1 ? r.x + r.size : side === 2 ? r.x + (1 - u) * r.size : r.x;
        const y = side === 0 ? r.y : side === 1 ? r.y + u * r.size : side === 2 ? r.y + r.size : r.y + (1 - u) * r.size;
        this.particles.emit('ember', x, y, 2, { color: PAL.molten, speed: 90, spread: Math.PI * 2, life: 0.9 });
      }
    }, [], at + 0.1);
  }
  dropStormSymbols(tl: gsap.core.Timeline, at: number, marks: number[]): void {
    const g = this.grid;
    const grid = idleGrid(g.cols, g.rows);
    for (let c = 0; c < g.cols; c++) {
      for (let r = 0; r < g.rows; r++) {
        const i = c * g.rows + r;
        tl.call(() => {
          const sp = g.makeSym(i, grid[i]);
          const ty = sp.y;
          sp.y = ty - g.cell * 3;
          sp.alpha = 0;
          gsap.to(sp, { y: ty, alpha: 1, duration: 0.3, ease: 'power2.in' });
          if (r === g.rows - 1) this.audio.play('land', { col: c, gain: 0.5 });
        }, [], at + c * 0.04 + r * 0.025);
      }
    }
    tl.call(() => {
      marks.forEach((m, i) => { if (m > 0) { g.setMark(i, m, true); const p = g.globalCenter(i); this.particles.emit('ember', p.x, p.y, 8, { color: PAL.magenta, speed: 120, spread: Math.PI * 2, life: 0.7 }); } });
      this.audio.play('markUp', { level: 1 });
    }, [], at + 0.75);
  }

  async stormWave(before: number[], after: number[]): Promise<void> {
    const g = this.grid;
    this.hud.banner('STORMBØLGE', 'Alle mærker på ×2 eller mere fordobles', 'storm', 1800);
    this.audio.play('waveBoom');
    this.shake(0.4);
    this.skyP.glow = 1;
    const band = new Sprite(softBand());
    band.tint = PAL.crimson; band.blendMode = 'add'; band.alpha = 0.9;
    band.width = g.cell * 1.6; band.height = g.size * 1.1; band.anchor.set(0.5, 0.5);
    band.position.set(-g.cell, g.size / 2);
    g.addChild(band);
    await new Promise<void>((res) => {
      const tl = gsap.timeline({ onComplete: () => { band.destroy(); res(); } });
      tl.to(band, { x: g.size + g.cell, duration: 0.9, ease: 'power1.inOut' }, 0);
      for (let c = 0; c < g.cols; c++) {
        tl.call(() => {
          for (let r = 0; r < g.rows; r++) {
            const i = c * g.rows + r;
            if (after[i] !== before[i]) {
              const lab = g.cells[i].label;
              gsap.timeline().to(lab.scale, { x: 0, duration: 0.08 }).call(() => g.setMark(i, after[i], false)).to(lab.scale, { x: 1, duration: 0.14, ease: 'back.out(3)' });
            }
          }
        }, [], 0.1 + c * 0.1);
      }
      tl.to({}, { duration: 0.35 });
    });
  }

  async stormOutro(): Promise<void> {
    this.audio.stopStorm();
    this.audio.play('fade');
    this.skyManual = true;
    const g = this.grid;
    await new Promise<void>((res) => {
      const tl = gsap.timeline({ onComplete: res });
      tl.to(this.skyP, { storm: 0, sun: 0, duration: 3, ease: 'sine.inOut' }, 0)
        .to(this.skyP, { kp: this.kpDisplay(), duration: 3 }, 0)
        .to(g, { alpha: 0, duration: 0.8 }, 0.3)
        .to(this.frame, { alpha: 0, duration: 0.8 }, 0.3)
        .call(() => {
          this.storm = false;
          this.layout();
          this.frame.layout(this.gridRect.x, this.gridRect.y, this.gridRect.size, false);
          const cell = Math.floor(this.gridRect.size / CONFIG.cols);
          g.configure(CONFIG.cols, CONFIG.rows, cell, this.baseSet, this.cellFx, false);
          this.placeGrid();
          g.setGrid(idleGrid(CONFIG.cols, CONFIG.rows));
        }, [], 1.2)
        .to(this.frame, { alpha: 1, duration: 1 }, 1.4)
        .to(g, { alpha: 1, duration: 1 }, 1.6);
    });
    this.skyManual = false;
    this.audio.startBase();
  }
}
