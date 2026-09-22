// Director: turns a SpinResult + its Beat schedule into GSAP-driven visuals and sound.
// Presentation only: it never touches outcome RNG, balances or the meter model.
import { gsap } from 'gsap';
import type { SpinResult, Sym } from '../math/types.ts';
import { SYM } from '../math/types.ts';
import { PAL } from '../core/palette.ts';
import { fmtKr } from '../core/format.ts';
import { crand, crange } from '../core/cosmeticRng.ts';
import { schedule, T, type Profile } from './schedule.ts';
import { hitStop } from './clock.ts';
import { dropDisplay, type GridView } from '../render/grid/GridView.ts';
import type { KpArc } from '../render/hud/KpArc.ts';
import type { Hud } from '../ui/hud.ts';
import { IsText, type CellShatter, type Particles, type Motes } from '../render/modules.ts';
import type { Container } from 'pixi.js';
import type { GameAudio } from '../audio/audio.ts';

export interface PresentCtx {
  grid: GridView;
  cellShatter: CellShatter;
  particles: Particles;
  motes: Motes;
  arc: KpArc;
  popups: Container;       // layer for floating win amounts (in grid-local coords)
  hud: Hud;
  audio: GameAudio;
  calm: () => boolean;
  shake: (trauma: number) => void;
  glowPulse: () => void;
  onCharge: (amount: number) => void;
  haptic: (p: number | number[]) => void;
}

const SYM_GLOW = [0x5ce1ff, 0x3dffb0, 0xa98cff, 0xff7fb0, 0xdfe8ff, 0xfff1c8, 0xffc062, 0x7dffd0, 0xffd36b];

export interface PresentResult { profile: Profile; resultAt: number }

/**
 * Present one spin. `marksBefore` are shown at the start (perk / storm persistence).
 * Resolves at the result beat (≥ 3.0 s after the press).
 */
export function presentSpin(ctx: PresentCtx, r: SpinResult, opts: { storm: boolean; freshMarks: boolean; paidOre?: number; liveStrip?: boolean }): Promise<PresentResult> {
  const { beats, resultAt, profile } = schedule(r, opts.paidOre ?? r.stakeOre);
  const sc = () => g.scale.x; // grid may be scaled mid-presentation after a resize
  const g = ctx.grid;
  const cell = g.cell;
  const size = g.size;
  const warm = profile === 'win';
  const tl = gsap.timeline({ paused: true });

  // Working copy of which sprite sits where during cascades.
  let running = 0;

  const dropOut = () => {
    ctx.audio.play('spin');
    for (let i = 0; i < g.syms.length; i++) {
      const s = g.syms[i];
      if (!s) continue;
      g.syms[i] = null;
      const c = g.colOf(i), row = g.rowOf(i);
      gsap.to(s, {
        y: s.y + size + cell * 1.5, alpha: 0.2, rotation: crange(-0.25, 0.25),
        duration: T.dropOut * 0.9, delay: c * 0.035 + (g.rows - row) * 0.01, ease: 'power2.in',
        onComplete: () => s.destroy(),
      });
    }
    if (opts.freshMarks) {
      g.resetMarks(true);
      // Perk: marksBefore (4 × x2) appear with a violet charge-up.
      r.marksBefore.forEach((m, i) => { if (m > 0) gsap.delayedCall(0.3, () => g.setMark(i, m, true)); });
    }
  };

  const spawnCol = (c: number) => {
    for (let row = 0; row < g.rows; row++) {
      const i = c * g.rows + row;
      const sp = g.makeSym(i, r.initial[i] as Sym);
      const ty = sp.y;
      sp.y = ty - size - cell * 0.6 - (g.rows - row) * cell * 0.08;
      gsap.to(sp, { y: ty, duration: T.fall, ease: 'power2.in', delay: (g.rows - 1 - row) * 0.012 });
    }
  };

  const impact = (c: number) => {
    ctx.audio.play('land', { col: c, gain: opts.storm ? 0.9 : 0.8 });
    for (let row = 0; row < g.rows; row++) {
      const i = c * g.rows + row;
      const sp = g.syms[i];
      if (!sp) continue;
      const bx = sp.scale.x, by = sp.scale.y;
      gsap.fromTo(sp.scale, { x: bx * 1.1, y: by * 0.84 }, { x: bx, y: by, duration: 0.32, ease: 'back.out(3)', delay: (g.rows - 1 - row) * 0.012 });
    }
    if (!ctx.calm()) {
      const p = g.globalCenter(c * g.rows + g.rows - 1);
      ctx.particles.emit('snow', p.x, p.y + cell * 0.45, 5, { color: opts.storm ? (PAL.molten as number) : (PAL.ice as number), speed: 60, spread: 1.2, angle: -Math.PI / 2, life: 0.6, size: 0.6 });
    }
  };

  const sun = (col: number, level: number) => {
    const i = r.sunCells.find((s) => Math.floor(s / g.rows) === col);
    if (i === undefined) return;
    ctx.audio.play('sun', { level });
    const s = g.syms[i];
    const c = g.cells[i];
    gsap.fromTo(c.glow, { alpha: 1 }, { alpha: 0.35, duration: 1.2, ease: 'power2.out' });
    c.glow.tint = PAL.gold;
    if (s) { const b = s.scale.x; gsap.fromTo(s.scale, { x: b * 1.35, y: b * 1.35 }, { x: b, y: b, duration: 0.5, ease: 'back.out(2)' }); }
    const p = g.globalCenter(i);
    ctx.particles.emit('glint', p.x, p.y, 10 + level * 4, { color: PAL.gold, speed: 140 + level * 40, spread: Math.PI * 2, life: 0.8 });
    if (level >= 3) { ctx.shake(0.2); ctx.haptic(20); }
  };

  const anticipation = (fromCol: number) => {
    ctx.audio.play('anticipation');
    for (let c = fromCol; c < g.cols; c++) {
      for (let row = 0; row < g.rows; row++) {
        const bg = g.cells[c * g.rows + row].bg;
        gsap.fromTo(bg, { alpha: 1 }, { alpha: opts.storm ? 0.9 : 0.55, duration: 0.8, repeat: 1, yoyo: true });
      }
    }
  };

  const highlight = (k: number) => {
    const st = r.steps[k];
    const sub = gsap.timeline();
    st.clusters.forEach((cl) => {
      g.glowCells(sub, 0, cl.cells, warm ? SYM_GLOW[cl.sym] : 0x7f93b2, warm ? 0.95 : 0.3);
    });
    if (warm) {
      // Win focus: everything that is not part of this step's clusters steps back.
      g.dimOthers(sub, 0, new Set(st.removed), 0.4);
      ctx.glowPulse(); ctx.haptic(10);
    }
  };

  const shatter = (k: number) => {
    const st = r.steps[k];
    let big = false;
    for (const cl of st.clusters) if (cl.size >= 8 || cl.mult >= 4) big = true;
    for (const i of st.removed) {
      const s = g.syms[i];
      const p = g.globalCenter(i);
      if (s) {
        ctx.cellShatter.burst(s.texture, p.x, p.y, cell * sc(), { warm });
        dropDisplay(s);
        g.syms[i] = null;
      }
      if (warm && !ctx.calm()) ctx.particles.emit('spark', p.x, p.y, 3, { color: SYM_GLOW[g.symOf[i]], speed: 220, spread: Math.PI * 2, life: 0.5 });
    }
    if (warm) {
      if (big && !ctx.calm()) { hitStop(70); ctx.shake(0.28); }
      else ctx.shake(0.1);
    }
  };

  const winPopup = (k: number, ci: number) => {
    const cl = r.steps[k].clusters[ci];
    let sx = 0, sy = 0;
    for (const i of cl.cells) { const c = g.center(i); sx += c.x; sy += c.y; }
    sx /= cl.cells.length; sy /= cl.cells.length;
    const big = cl.winOre >= r.stakeOre;
    const txt = new IsText({ text: fmtKr(cl.winOre).toUpperCase(), size: Math.max(11, cell * sc() * (warm ? (big ? 0.34 : 0.26) : 0.2)), style: warm ? 'gold' : 'muted' });
    txt.position.set(g.x + sx * sc(), g.y + sy * sc());
    ctx.popups.addChild(txt);
    txt.alpha = 0;
    const s0 = txt.scale.x;
    gsap.timeline({ onComplete: () => txt.destroy() })
      .to(txt, { alpha: 1, duration: 0.12 })
      .fromTo(txt.scale, { x: s0 * 0.6, y: s0 * 0.6 }, { x: s0, y: s0, duration: 0.35, ease: 'back.out(2.5)' }, 0)
      .to(txt, { y: txt.y - cell * 0.55, duration: 1.1, ease: 'power1.out' }, 0)
      .to(txt, { alpha: 0, duration: 0.35 }, 0.8);
    if (warm) txt.glow = 1.2;
    if (cl.mult > 1) {
      const m = new IsText({ text: '×' + cl.mult, size: Math.max(10, cell * sc() * 0.24), style: opts.storm ? 'plasma' : 'ice' });
      m.position.set(g.x + sx * sc(), g.y + (sy - cell * 0.36) * sc());
      ctx.popups.addChild(m);
      gsap.timeline({ onComplete: () => m.destroy() })
        .fromTo(m.scale, { x: 2, y: 2 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(3)' })
        .to(m, { y: m.y - cell * 0.5, alpha: 0, duration: 0.8, ease: 'power1.in' }, 0.5);
    }
  };

  const motes = (k: number) => {
    const st = r.steps[k];
    if (opts.storm || st.charge <= 0) return;
    const n = Math.min(10, Math.max(1, Math.ceil(st.removed.length / 2)));
    const per = st.charge / n;
    const to = ctx.arc.headGlobal();
    for (let m = 0; m < n; m++) {
      const i = st.removed[Math.floor((m / n) * st.removed.length)];
      const from = g.globalCenter(i);
      ctx.motes.launch(from, to, 1, {
        color: PAL.mote, dur: 0.62 + crand() * 0.18,
        onArrive: () => { ctx.onCharge(per); if (m % 3 === 0) ctx.audio.play('mote'); },
      });
    }
  };

  const markUp = (k: number) => {
    const st = r.steps[k];
    let maxTo = 0;
    for (const mc of st.markChanges) { g.setMark(mc.cell, mc.to, true, !warm); if (mc.to > maxTo) maxTo = mc.to; }
    if (warm && maxTo >= 2) ctx.audio.play('markUp', { level: Math.log2(maxTo) });
  };

  const fall = (k: number, runningOre: number) => {
    const st = r.steps[k];
    // Move surviving sprites (process bottom-up so targets are free).
    const next: typeof g.syms = g.syms.slice();
    const nextSym = g.symOf.slice();
    for (const mv of st.moves) { next[mv.from] = null; }
    for (const mv of st.moves) {
      const s = g.syms[mv.from];
      next[mv.to] = s;
      nextSym[mv.to] = g.symOf[mv.from];
      if (s) {
        const ty = g.center(mv.to).y;
        const bx = s.scale.x, by = s.scale.y;
        gsap.to(s, { y: ty, duration: 0.3, ease: 'power2.in', delay: 0.02 * (g.rows - g.rowOf(mv.to)),
          onComplete: () => { gsap.fromTo(s.scale, { x: bx * 1.06, y: by * 0.9 }, { x: bx, y: by, duration: 0.22, ease: 'back.out(3)' }); } });
      }
    }
    g.syms = next;
    g.symOf = nextSym;
    running = runningOre;
    if (warm) { const s2 = gsap.timeline(); g.dimOthers(s2, 0, null); }
    if (warm && opts.liveStrip !== false && !opts.storm) ctx.hud.setWin(running, r.stakeOre, 'live', undefined, opts.paidOre ?? r.stakeOre);
  };

  const refill = (k: number) => {
    const st = r.steps[k];
    const perCol = new Map<number, number>();
    for (const rf of st.refill) perCol.set(g.colOf(rf.cell), (perCol.get(g.colOf(rf.cell)) ?? 0) + 1);
    for (const rf of st.refill) {
      const sp = g.makeSym(rf.cell, rf.sym);
      const ty = sp.y;
      const n = perCol.get(g.colOf(rf.cell)) ?? 1;
      sp.y = ty - n * cell - cell * 0.4;
      const bx = sp.scale.x, by = sp.scale.y;
      gsap.to(sp, { y: ty, duration: 0.34, ease: 'power2.in', delay: 0.03 * (g.rows - g.rowOf(rf.cell)) * 0.5,
        onComplete: () => { gsap.fromTo(sp.scale, { x: bx * 1.08, y: by * 0.86 }, { x: bx, y: by, duration: 0.25, ease: 'back.out(3)' }); } });
    }
    if (st.refill.length) ctx.audio.play('land', { col: (k * 2) % g.cols, gain: 0.35 });
  };

  const sunPay = () => {
    ctx.audio.play('sun', { level: 3 });
    const to = ctx.arc.headGlobal();
    for (const i of r.sunCells) {
      const p = g.globalCenter(i);
      ctx.particles.emit('glint', p.x, p.y, 16, { color: PAL.gold, speed: 200, spread: Math.PI * 2, life: 0.9 });
      if (!opts.storm) ctx.motes.launch(p, to, 1, { color: PAL.gold, dur: 0.7, onArrive: () => ctx.onCharge(150 / Math.max(1, r.sunCells.length)) });
      gsap.fromTo(g.cells[i].glow, { alpha: 1 }, { alpha: 0, duration: 1.2 });
    }
    const c = g.center(r.sunCells[1] ?? r.sunCells[0]);
    const txt = new IsText({ text: '3 SOLE · ' + fmtKr(r.sunPayOre).toUpperCase(), size: Math.max(12, cell * sc() * 0.26), style: warm ? 'gold' : 'muted' });
    txt.position.set(g.x + c.x * sc(), g.y + c.y * sc());
    ctx.popups.addChild(txt);
    gsap.timeline({ onComplete: () => txt.destroy() }).fromTo(txt.scale, { x: 0.5, y: 0.5 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(2)' }).to(txt, { y: txt.y - cell * 0.6, alpha: 0, duration: 1, delay: 0.5 });
  };

  for (const b of beats) {
    switch (b.kind) {
      case 'dropOut': tl.call(dropOut, [], b.t); break;
      case 'land': tl.call(spawnCol, [b.col!], Math.max(0.05, b.t - T.fall)); tl.call(impact, [b.col!], b.t); break;
      case 'sun': tl.call(sun, [b.col!, b.level!], b.t); break;
      case 'anticipation': tl.call(anticipation, [b.col!], Math.max(0, b.t)); break;
      case 'glint': tl.call(() => { const s = gsap.timeline(); g.sweep(s, 0, T.glint, opts.storm ? (PAL.molten as number) : (PAL.ice as number)); }, [], b.t); break;
      case 'highlight': tl.call(highlight, [b.step!], b.t); break;
      case 'chime': tl.call(() => ctx.audio.play('chime', { step: b.step! }), [], b.t); break;
      case 'returnTick': tl.call(() => ctx.audio.play('returnTick'), [], b.t); break;
      case 'shatter': tl.call(shatter, [b.step!], b.t); break;
      case 'ping': tl.call(() => ctx.audio.play('shatter', { step: b.step! }), [], b.t); break;
      case 'winPopup': tl.call(winPopup, [b.step!, b.cluster!], b.t); break;
      case 'motes': tl.call(motes, [b.step!], b.t); break;
      case 'markUp': tl.call(markUp, [b.step!], b.t); break;
      case 'nettoCross': tl.call(() => { ctx.hud.flashNetto(); ctx.audio.play('nettoCross'); }, [], b.t); break;
      case 'fall': tl.call(fall, [b.step!, b.running ?? running], b.t); break;
      case 'refill': tl.call(refill, [b.step!], b.t); break;
      case 'sunPay': tl.call(sunPay, [], b.t); break;
      case 'result': break;
    }
  }
  // HUD 3-second ring
  const ring = { p: 0 };
  tl.to(ring, { p: 1, duration: T.floor, ease: 'none', onUpdate: () => ctx.hud.setRing(ring.p) }, 0);

  return new Promise((resolve) => {
    tl.call(() => {
      ctx.hud.setRing(0);
      // Safety: make sure the view matches the final step grid.
      const last = r.steps[r.steps.length - 1];
      for (let i = 0; i < last.grid.length; i++) {
        if (!g.syms[i] || g.symOf[i] !== last.grid[i]) g.makeSym(i, last.grid[i] as Sym);
        const s = g.syms[i]; if (s) s.alpha = 1;
      }
      ctx.motes.flush?.();
      resolve({ profile, resultAt });
    }, [], resultAt);
    tl.play(0);
  });
}

/** Cosmetic idle grid (no clusters) for the intro — never an outcome. */
export function idleGrid(cols: number, rows: number): Sym[] {
  const pool: Sym[] = [SYM.L1, SYM.L2, SYM.L3, SYM.L4, SYM.H1, SYM.H2, SYM.H3];
  const g: Sym[] = new Array(cols * rows);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      let s: Sym;
      let guard = 0;
      do {
        s = pool[Math.floor(crand() * pool.length)];
        guard++;
      } while (guard < 20 && ((r > 0 && g[c * rows + r - 1] === s) || (c > 0 && g[(c - 1) * rows + r] === s)));
      g[c * rows + r] = s;
    }
  }
  return g;
}
