// Grid view: cell backdrops, marks, symbol sprites, glows and mark labels.
// Pure view — the director drives it with GSAP; it never decides outcomes.
import { Container, Sprite, Graphics } from 'pixi.js';
import { softBand } from '../tex.ts';
import { gsap } from 'gsap';
import { SYM, type Sym } from '../../math/types.ts';
import { PAL } from '../../core/palette.ts';
import { IsText, type SymbolSet, type CellFx } from '../modules.ts';

export interface CellNode {
  bg: Sprite;
  mark: Sprite;      // frost overlay (mark = 1) / plasma (storm ≥2)
  ring: Sprite;      // multiplier pill backdrop
  label: IsText;     // ×N
  glow: Sprite;      // additive symbol glow
}

export class GridView extends Container {
  cols = 6;
  rows = 6;
  cell = 56;
  storm = false;
  readonly bgLayer = new Container();
  readonly markLayer = new Container();
  readonly symLayer = new Container();
  readonly glowLayer = new Container();
  readonly labelLayer = new Container();
  readonly scanLayer = new Container();
  private maskG = new Graphics();
  private scan = new Sprite(softBand());
  cells: CellNode[] = [];
  syms: (Sprite | null)[] = [];
  symOf: Sym[] = [];
  marks: number[] = [];
  set: SymbolSet | null = null;
  fx: CellFx | null = null;

  constructor() {
    super();
    this.glowLayer.blendMode = 'add';
    this.scanLayer.blendMode = 'add';
    this.addChild(this.bgLayer, this.markLayer, this.glowLayer, this.symLayer, this.labelLayer, this.scanLayer, this.maskG);
    this.symLayer.mask = this.maskG;
    this.scan.alpha = 0;
    this.scanLayer.addChild(this.scan);
  }

  /** (Re)build the cell nodes for a grid size and cell size in CSS px. */
  configure(cols: number, rows: number, cell: number, set: SymbolSet, fx: CellFx, storm: boolean): void {
    this.cols = cols; this.rows = rows; this.cell = cell; this.set = set; this.fx = fx; this.storm = storm;
    const n = cols * rows;
    for (const c of this.cells) { c.bg.destroy(); c.mark.destroy(); c.ring.destroy(); c.label.destroy(); c.glow.destroy(); }
    for (const s of this.syms) s?.destroy();
    this.cells = []; this.syms = new Array(n).fill(null); this.symOf = new Array(n).fill(SYM.L1); this.marks = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const { x, y } = this.center(i);
      const bg = new Sprite(storm ? fx.stormBg : fx.cellBg); bg.anchor.set(0.5); bg.position.set(x, y); bg.width = bg.height = cell; bg.alpha = storm ? 0.9 : 0.55;
      const mark = new Sprite(storm ? fx.plasmaBg : fx.frost); mark.anchor.set(0.5); mark.position.set(x, y); mark.width = mark.height = cell; mark.alpha = 0;
      const glow = new Sprite(set.glow); glow.anchor.set(0.5); glow.position.set(x, y); glow.width = glow.height = cell * 1.5; glow.alpha = 0;
      const ring = new Sprite(fx.markRing); ring.anchor.set(0.5); ring.width = cell * 0.62; ring.height = cell * 0.3; ring.position.set(x, y + cell * 0.3); ring.alpha = 0;
      const label = new IsText({ text: '×2', size: Math.max(8, cell * 0.16), style: 'ice' });
      label.position.set(x, y + cell * 0.3); label.alpha = 0;
      this.bgLayer.addChild(bg); this.markLayer.addChild(mark); this.glowLayer.addChild(glow); this.markLayer.addChild(ring); this.labelLayer.addChild(label);
      this.cells.push({ bg, mark, ring, label, glow });
    }
    this.maskG.clear().rect(0, 0, cols * cell, rows * cell).fill(0xffffff);
    this.scan.width = cols * cell * 0.5; this.scan.height = rows * cell;
  }

  /** Swap symbol textures (base ↔ storm, or a Kp re-bake) without rebuilding. */
  setSymbolSet(set: SymbolSet): void {
    this.set = set;
    for (let i = 0; i < this.syms.length; i++) {
      const s = this.syms[i];
      if (s) s.texture = set.textures[this.symOf[i]];
      this.cells[i].glow.texture = set.glow;
    }
  }

  get size(): number { return this.cols * this.cell; }
  colOf(i: number): number { return Math.floor(i / this.rows); }
  rowOf(i: number): number { return i % this.rows; }
  center(i: number): { x: number; y: number } {
    return { x: (this.colOf(i) + 0.5) * this.cell, y: (this.rowOf(i) + 0.5) * this.cell };
  }
  /** Global (stage) position of a cell centre. */
  globalCenter(i: number): { x: number; y: number } {
    const c = this.center(i);
    const p = this.toGlobal(c);
    return { x: p.x, y: p.y };
  }

  makeSym(i: number, s: Sym): Sprite {
    const sp = new Sprite(this.set!.textures[s]);
    sp.anchor.set(0.5);
    sp.width = sp.height = this.cell;
    const { x, y } = this.center(i);
    sp.position.set(x, y);
    this.symLayer.addChild(sp);
    this.syms[i]?.destroy();
    this.syms[i] = sp;
    this.symOf[i] = s;
    return sp;
  }

  /** Immediately show a grid (no animation). */
  setGrid(grid: Sym[], marks?: number[]): void {
    for (let i = 0; i < grid.length; i++) this.makeSym(i, grid[i]);
    if (marks) for (let i = 0; i < marks.length; i++) this.setMark(i, marks[i], false);
  }

  clearSyms(): void {
    for (let i = 0; i < this.syms.length; i++) { this.syms[i]?.destroy(); this.syms[i] = null; }
  }

  /** Mark visuals: 0 none, 1 frost, ≥2 multiplier pill. */
  setMark(i: number, v: number, animate: boolean, quiet = false): void {
    const c = this.cells[i];
    const prev = this.marks[i];
    this.marks[i] = v;
    const frostA = v >= 1 ? (this.storm ? (v >= 2 ? 1 : 0.5) : 0.9) : 0;
    const ringA = v >= 2 ? 1 : 0;
    if (v >= 2) {
      c.label.text = '×' + v;
      c.label.style = this.storm ? 'plasma' : 'ice';
    }
    if (!animate) { c.mark.alpha = frostA; c.ring.alpha = ringA; c.label.alpha = ringA; return; }
    gsap.to(c.mark, { alpha: frostA, duration: 0.3, ease: 'power2.out' });
    if (v >= 2 && v !== prev) {
      gsap.to([c.ring, c.label], { alpha: 1, duration: 0.15 });
      if (!quiet) {
        const s0 = c.label.scale.x;
        gsap.fromTo(c.label.scale, { x: s0 * 1.9, y: s0 * 1.9 }, { x: s0, y: s0, duration: 0.45, ease: 'back.out(3)' });
        gsap.fromTo(c.ring.scale, { x: c.ring.scale.x * 1.4, y: c.ring.scale.y * 1.4 }, { x: c.ring.scale.x, y: c.ring.scale.y, duration: 0.4, ease: 'back.out(2.5)' });
      }
    } else if (v < 2) {
      gsap.to([c.ring, c.label], { alpha: 0, duration: 0.2 });
    }
  }

  resetMarks(animate: boolean): void {
    for (let i = 0; i < this.marks.length; i++) if (this.marks[i] !== 0) this.setMark(i, 0, animate);
  }

  /** Glow a set of cells (win highlight). */
  glowCells(tl: gsap.core.Timeline, at: number, cells: number[], color: number, strength = 0.9): void {
    for (const i of cells) {
      const g = this.cells[i].glow;
      tl.set(g, { tint: color }, at);
      tl.to(g, { alpha: strength, duration: 0.14, ease: 'power2.out' }, at);
      tl.to(g, { alpha: 0, duration: 0.35, ease: 'power2.in' }, at + 0.4);
      const s = this.syms[i];
      if (s) {
        const base = this.cell / s.texture.width;
        tl.to(s.scale, { x: base * 1.1, y: base * 1.1, duration: 0.14, ease: 'power2.out' }, at);
        tl.to(s.scale, { x: base, y: base, duration: 0.2, ease: 'power2.in' }, at + 0.22);
      }
    }
  }

  /** Diagonal evaluation glint over the whole grid. */
  sweep(tl: gsap.core.Timeline, at: number, dur: number, color: number = PAL.ice): void {
    const s = this.scan;
    s.skew.x = -0.35;
    tl.set(s, { tint: color, alpha: 0, x: -s.width }, at);
    tl.to(s, { alpha: 0.07, duration: dur * 0.3 }, at);
    tl.to(s, { x: this.size + s.width * 0.3, duration: dur, ease: 'power1.inOut' }, at);
    tl.to(s, { alpha: 0, duration: dur * 0.3 }, at + dur * 0.7);
  }
}
