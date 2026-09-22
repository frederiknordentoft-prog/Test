// NORDLYS · shatter (CONTRACTS.md §7, PLAN.md §4 IMPACT/FRACTURE + §6 "Knusning").
//
// CellShatter — one call per removed cell (up to 64 in the same frame).
//   warm  (WIN):    the real symbol texture split into 9 Voronoi pieces (3 precomputed patterns, crand pick),
//                   50 ms crack-glint hold, then the pieces burst outward: spin, fake 3-D flip (foreshortening +
//                   back-face shade + sweeping specular stripe), gravity, shrink, fade, crisp fracture rim lit in
//                   the crystal's own colour, a soft flash + a few glass shardlets.
//   cold  (RETURN): no shards, no sparks — the symbol desaturates, dims and dissolves in place (noise erosion
//                   with a faint slate ash edge), sinking a hair and shrinking 8 %.
//   Rendering: one dynamic fan mesh per symbol texture source (≤ 9–18 draws), pieces written on the CPU.
//
// ScreenShatter — IMPACT → FRACTURE of the captured frame.
//   start(frame, impact, {cells}) builds ~48 Voronoi shards (denser near the impact; the impact cell becomes a
//   radial star of slivers; interior edges are jagged and shared → no gaps). The game tweens `crackReveal` 0→1:
//   cracks light up outward along the shard edges (graph distance from the impact, white-hot front cooling to
//   #FF2BD6) and the panes shift ~1 px apart. When crackReveal reaches 1 the shards separate on their own and
//   fly for ~1 s (scale 1 → ~1.8 fake z about the impact, ±4 rad/s spin, 3-D flip, gravity, additive rim +
//   radial chromatic edge, 300 debris), then `done` = true and the container clears itself.
//   Geometry is stored normalised (0..1) and re-projected with renderer.screen every frame → resize-safe.
//   The captured texture is only sampled (never destroyed); if its source is destroyed mid-flight we stop.
import { Container, RenderTexture, Texture, type Renderer, type TextureSource } from 'pixi.js';
import { crand } from '../../core/cosmeticRng.ts';
import { PAL } from '../../core/palette.ts';
import { Particles } from './Particles.ts';
import { ShardBatch } from './parts/shards.ts';
import { CrackMesh } from './parts/cracks.ts';
import { buildFracture, polyCentroid, voronoiCells } from './parts/voronoi.ts';
import { prewarmMotes } from './Motes.ts';

// ═══════════════════════════════════════════ cell patterns ═══════════════════════════════════════════

interface Piece { ring: Float32Array; cx: number; cy: number; rad: number }
type Pattern = Piece[];

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** 3 precomputed 9-seed Voronoi patterns of the unit cell [-0.5, 0.5]², seeds concentrated on the crystal. */
const PATTERNS: Pattern[] = [11, 29, 47].map((seed) => {
  const r = lcg(seed * 7919);
  const seeds: number[] = [(r() - 0.5) * 0.12, (r() - 0.5) * 0.12];
  const rot = r() * Math.PI * 2;
  for (let k = 0; k < 8; k++) {
    const a = rot + (k / 8) * Math.PI * 2 + (r() - 0.5) * 0.55;
    const d = 0.2 + r() * 0.17;
    seeds.push(Math.cos(a) * d, Math.sin(a) * d);
  }
  return voronoiCells(seeds, -0.5, -0.5, 0.5, 0.5).map((p) => {
    const [cx, cy] = polyCentroid(p);
    let rad = 0;
    for (let i = 0; i < p.length; i += 2) rad = Math.max(rad, Math.hypot(p[i] - cx, p[i + 1] - cy));
    return { ring: new Float32Array(p), cx, cy, rad };
  });
});
/** Single full-cell piece for the cold dissolve. */
const QUAD: Piece = { ring: new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]), cx: 0, cy: 0, rad: 0.7071 };

class CellPiece {
  batch: ShardBatch | null = null;
  piece: Piece = QUAD;
  warm = true;
  size = 64;
  // uv affine of the texture frame: uv = o + a·s + b·t  (s, t ∈ 0..1)
  uo = 0; vo = 0; ua = 1; va = 0; ub = 0; vb = 1;
  x = 0; y = 0; vx = 0; vy = 0;
  rot = 0; vrot = 0;
  fa = 0; fp = 0; fr = 0;    // flip axis angle, phase, rate
  age = 0; life = 0.6; hold = 0.05;
  seed = 0;
  mx = 1; my = 1;            // pattern mirror (geometry only — the symbol itself is never mirrored)
  sw = false;                // pattern transposed (x↔y): with the mirrors, 8 symmetries × 3 patterns
}

const CELL_MAX = 2048;

export class CellShatter extends Container {
  private batches: ShardBatch[] = [];
  private all: CellPiece[] = [];
  private n = 0;
  private steal = 0;
  private batchLayer = new Container();
  /** Internal flash + shardlet particles (warm only). */
  readonly sparks: Particles;
  private frameBursts = 0;

  constructor() {
    super();
    this.label = 'fx-cell-shatter';
    for (let i = 0; i < CELL_MAX; i++) this.all.push(new CellPiece());
    this.sparks = new Particles(1400);
    this.addChild(this.batchLayer, this.sparks);
  }

  /** Live piece count (for QA probes). */
  get count(): number { return this.n; }

  burst(tex: Texture, cx: number, cy: number, size: number, o: { warm: boolean }): void {
    const src = tex.source;
    if (!src || src.destroyed) return;
    const batch = this.batchFor(src);
    const uv = tex.uvs;
    const warm = !!o?.warm;
    const pat = warm ? PATTERNS[Math.floor(crand() * PATTERNS.length) % PATTERNS.length] : null;
    const flip = crand() < 0.5 ? 1 : -1;
    const flop = crand() < 0.5 ? 1 : -1;
    const swap = crand() < 0.5;
    // per-burst crack-hold jitter: simultaneous bursts ripple instead of moving in lockstep
    const hold = 0.035 + crand() * 0.05;
    const kick = 0.8 + 0.4 * crand();
    const pieces = pat;
    const count = pieces ? pieces.length : 1;
    const s = size / 64; // speeds are authored for a 64 px cell
    for (let k = 0; k < count; k++) {
      const p = this.alloc();
      const pc = pieces ? pieces[k] : QUAD;
      p.batch = batch;
      p.piece = pc;
      p.warm = warm;
      p.size = size;
      p.uo = uv.x0; p.vo = uv.y0; p.ua = uv.x1 - uv.x0; p.va = uv.y1 - uv.y0; p.ub = uv.x3 - uv.x0; p.vb = uv.y3 - uv.y0;
      // dihedral symmetry of the pattern (geometry only — UVs follow the cell-space position)
      const qx = swap ? pc.cy : pc.cx, qy = swap ? pc.cx : pc.cy;
      const pcx = qx * flip, pcy = qy * flop;
      p.x = cx + pcx * size;
      p.y = cy + pcy * size;
      p.age = 0;
      p.seed = crand();
      if (warm) {
        const d = Math.hypot(pcx, pcy) || 1e-3;
        const dx = pcx / d, dy = pcy / d;
        const sp = (95 + 115 * crand()) * s * kick * (0.55 + 0.75 * Math.min(1, d / 0.3));
        p.vx = dx * sp + (crand() - 0.5) * 36 * s;
        p.vy = dy * sp - (55 + 75 * crand()) * s;
        p.rot = 0;
        p.vrot = (crand() * 2 - 1) * 6;
        p.fa = crand() * Math.PI;
        p.fp = 0;
        p.fr = (crand() < 0.5 ? -1 : 1) * (2 + crand() * 3.5);
        p.life = 0.55 + crand() * 0.2;
        p.hold = hold;
      } else {
        p.vx = 0; p.vy = 4 * s;
        p.rot = 0; p.vrot = 0; p.fa = 0; p.fp = 0; p.fr = 0;
        p.life = 0.42;
        p.hold = 0;
      }
      p.mx = flip; p.my = flop; p.sw = swap;
    }
    if (warm) {
      const k = this.frameBursts++;
      const damp = 1 / (1 + k * 0.09);
      this.sparks.emitFx('flash', cx, cy, 1, { size: (size * 1.5) / 90, intensity: 0.55 * damp, heat: 0.8 * damp, life: 0.16 });
      this.sparks.emitFx('shardlet', cx, cy, 4, { speed: 230 * s, size: Math.max(0.6, s * 0.9), gravity: 900 * s, life: 0.6, jitter: size * 0.25 });
    }
  }

  private batchFor(src: TextureSource): ShardBatch {
    for (const b of this.batches) if (b.source === src) return b;
    const b = new ShardBatch(src, 1024, 3072, { cold: 0xeaf8ff, hot: 0xffffff, fromTexture: 1 });
    this.batches.push(b);
    this.batchLayer.addChild(b.mesh);
    src.once('destroy', () => this.dropBatch(b));
    return b;
  }

  private dropBatch(b: ShardBatch): void {
    for (let i = this.n - 1; i >= 0; i--) if (this.all[i].batch === b) this.kill(i);
    const i = this.batches.indexOf(b);
    if (i >= 0) this.batches.splice(i, 1);
    b.destroy();
  }

  private alloc(): CellPiece {
    if (this.n < CELL_MAX) return this.all[this.n++];
    return this.all[this.steal++ % CELL_MAX];
  }

  private kill(i: number): void {
    const last = this.n - 1;
    if (i !== last) { const t = this.all[i]; this.all[i] = this.all[last]; this.all[last] = t; }
    this.n = last;
  }

  update(dt: number): void {
    this.frameBursts = 0;
    this.sparks.update(dt);
    if (this.n === 0) {
      for (const b of this.batches) if (b.mesh.visible) b.mesh.visible = false;
      return;
    }
    if (dt > 0) {
      let i = 0;
      while (i < this.n) {
        const p = this.all[i];
        p.age += dt;
        if (p.age >= p.hold + p.life) { this.kill(i); continue; }
        if (p.warm && p.age > p.hold) {
          const g = 1500 * (p.size / 64);
          p.vx *= 1 - Math.min(1, 0.6 * dt);
          p.vy += g * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vrot * dt;
          p.fp += p.fr * dt;
        } else if (!p.warm) {
          p.y += p.vy * dt;
        }
        i++;
      }
    }
    // ── write geometry ──
    for (const b of this.batches) b.begin();
    for (let i = 0; i < this.n; i++) this.writePiece(this.all[i]);
    for (const b of this.batches) b.end();
  }

  private writePiece(p: CellPiece): void {
    const b = p.batch!;
    const pc = p.piece;
    const ring = pc.ring;
    const nr = ring.length >> 1;
    b.reserve(nr + 1, nr * 3);
    const mx = p.mx, my = p.my, sw = p.sw;
    let alpha: number, rim: number, shade: number, spec: number, phase: number, dissolve: number, cold: number, scale: number;
    let cosF = 1;
    const ca = Math.cos(p.fa), sa = Math.sin(p.fa);
    if (p.warm) {
      const t = Math.max(0, p.age - p.hold);
      const a = t / p.life;
      const holdK = Math.min(1, p.age / Math.max(1e-3, p.hold));
      scale = 1 - 0.18 * a;
      alpha = a < 0.5 ? 1 : Math.max(0, 1 - (a - 0.5) / 0.5);
      rim = (p.age <= p.hold ? 1.5 * holdK : 0.35 + 0.95 * Math.exp(-t * 10)) * (0.4 + 0.6 * alpha);
      cosF = Math.cos(p.fp);
      shade = cosF >= 0 ? 0.84 + 0.16 * cosF : 0.52 + 0.12 * -cosF;
      spec = 0.5 * Math.min(1, t * 8) * alpha;
      phase = Math.sin(p.fp + p.seed * 6) * 1.5;
      dissolve = 0; cold = 0;
    } else {
      const a = p.age / p.life;
      scale = 1 - 0.08 * a;
      alpha = 1 - a * a * 0.6;
      rim = 0;
      shade = 0.66 - 0.16 * a;
      spec = 0;
      phase = p.seed * 10;
      // grey out first (≈ 70 ms), then erode
      dissolve = Math.max(0, Math.min(1, (a - 0.12) / 0.88));
      cold = Math.min(1, a * 6);
    }
    const S = p.size * scale;
    const cr = Math.cos(p.rot), sr = Math.sin(p.rot);
    const pcx = (sw ? pc.cy : pc.cx) * mx, pcy = (sw ? pc.cx : pc.cy) * my;
    const invRad = 1 / pc.rad;
    // centroid vertex
    const c0 = b.vert(p.x, p.y, p.uo + (pcx + 0.5) * p.ua + (pcy + 0.5) * p.ub, p.vo + (pcx + 0.5) * p.va + (pcy + 0.5) * p.vb,
      0, 0, 0, alpha, rim, shade, spec, phase, 0, dissolve, cold);
    for (let k = 0; k < nr; k++) {
      const rx = ring[k * 2], ry = ring[k * 2 + 1];
      const lx = (sw ? ry : rx) * mx, ly = (sw ? rx : ry) * my; // transformed cell-space vertex
      let dx = (lx - pcx), dy = (ly - pcy);
      const lxn = dx * invRad, lyn = dy * invRad;
      if (cosF !== 1) {
        // foreshorten across the flip axis
        const al = dx * ca + dy * sa, pe = -dx * sa + dy * ca;
        const pf = pe * cosF;
        dx = al * ca - pf * sa; dy = al * sa + pf * ca;
      }
      dx *= S; dy *= S;
      const x = p.x + dx * cr - dy * sr, y = p.y + dx * sr + dy * cr;
      // UVs from the (mirrored) cell-space position: the texture stays upright, only the cut pattern mirrors
      const us = lx + 0.5, vt = ly + 0.5;
      b.vert(x, y, p.uo + us * p.ua + vt * p.ub, p.vo + us * p.va + vt * p.vb, lxn, lyn, 1, alpha, rim, shade, spec, phase, 0, dissolve, cold);
    }
    for (let k = 0; k < nr; k++) b.tri(c0, c0 + 1 + k, c0 + 1 + ((k + 1) % nr));
  }
}

// ═══════════════════════════════════════════ screen shatter ═══════════════════════════════════════════

const FLY_T = 1.0;

export class ScreenShatter extends Container {
  /** 0..1 — glowing cracks propagate outward; at 1 the shards separate automatically. */
  crackReveal = 0;
  private renderer: Renderer;
  private shards: ShardBatch | null = null;
  private cracks: CrackMesh;
  private debris: Particles;
  private running = false;
  private separated = false;
  private t = 0;
  private time = 0;
  private src: TextureSource | null = null;
  private uvo = [0, 0, 1, 0, 0, 1]; // uv = (o.x + s·a.x + t·b.x, …)
  // normalised fracture
  private nX = new Float32Array(0); private nY = new Float32Array(0); private nArr = new Float32Array(0);
  private ringStart = new Int32Array(0); private ringLen = new Int32Array(0); private ringNodes = new Int32Array(0);
  private segA = new Int32Array(0); private segB = new Int32Array(0);
  private chStart = new Int32Array(0); private chLen = new Int32Array(0); private chNodes = new Int32Array(0); private chSeed = new Float32Array(0);
  private sx = new Float32Array(16); private sy = new Float32Array(16); private sa = new Float32Array(16);
  // per shard
  private sCx = new Float32Array(0); private sCy = new Float32Array(0); private sRad = new Float32Array(0);
  private sArr = new Float32Array(0); private sVx = new Float32Array(0); private sVy = new Float32Array(0);
  private sRot = new Float32Array(0); private sFa = new Float32Array(0); private sFr = new Float32Array(0);
  private sZ = new Float32Array(0); private sT = new Float32Array(0); private sLum = new Float32Array(0);
  private sDelay = new Float32Array(0); private sSeed = new Float32Array(0);
  private ns = 0;
  private impX = 0.5; private impY = 0.5;
  private srcDestroyed = () => this.finish();

  constructor(renderer: Renderer) {
    super();
    this.label = 'fx-screen-shatter';
    this.renderer = renderer;
    this.cracks = new CrackMesh(512);
    this.debris = new Particles(420);
    this.addChild(this.cracks.mesh, this.debris);
    this.prewarm();
  }

  get done(): boolean { return !this.running; }

  start(frame: Texture, impact: { x: number; y: number }, o?: { cells?: number }): void {
    this.finish();
    const W = frame.width || this.renderer.screen.width, H = frame.height || this.renderer.screen.height;
    const fr = buildFracture({ cells: o?.cells ?? 48, impactX: impact.x, impactY: impact.y, w: W, h: H, rand: crand });
    const V = fr.nx.length;
    this.nX = new Float32Array(V); this.nY = new Float32Array(V); this.nArr = new Float32Array(V);
    for (let i = 0; i < V; i++) { this.nX[i] = fr.nx[i] / W; this.nY[i] = fr.ny[i] / H; this.nArr[i] = fr.arrive[i]; }
    const S = fr.shards.length;
    let total = 0;
    for (const r of fr.shards) total += r.length;
    this.ringStart = new Int32Array(S); this.ringLen = new Int32Array(S); this.ringNodes = new Int32Array(total);
    const alloc = () => new Float32Array(S);
    this.sCx = alloc(); this.sCy = alloc(); this.sRad = alloc(); this.sArr = alloc(); this.sVx = alloc(); this.sVy = alloc();
    this.sRot = alloc(); this.sFa = alloc(); this.sFr = alloc(); this.sZ = alloc(); this.sT = alloc(); this.sLum = alloc();
    this.sDelay = alloc(); this.sSeed = alloc();
    const diag = Math.hypot(W, H);
    let off = 0;
    for (let s = 0; s < S; s++) {
      const ring = fr.shards[s];
      this.ringStart[s] = off; this.ringLen[s] = ring.length;
      const poly: number[] = [];
      let amin = 1;
      for (const id of ring) { this.ringNodes[off++] = id; poly.push(fr.nx[id], fr.ny[id]); amin = Math.min(amin, fr.arrive[id]); }
      const [cx, cy] = polyCentroid(poly);
      let rad = 0;
      for (let i = 0; i < poly.length; i += 2) rad = Math.max(rad, Math.hypot(poly[i] - cx, poly[i + 1] - cy));
      this.sCx[s] = cx / W; this.sCy[s] = cy / H; this.sRad[s] = rad / diag; this.sArr[s] = amin;
      // flight: outward from the impact, near shards faster; stored in diag-units/s
      const dx = cx - impact.x, dy = cy - impact.y;
      const d = Math.hypot(dx, dy) || 1;
      const near = Math.exp(-d / (0.3 * diag));
      const sp = (0.07 + 0.36 * near) * (0.8 + 0.4 * crand());
      this.sVx[s] = (dx / d) * sp + (crand() - 0.5) * 0.05;
      this.sVy[s] = (dy / d) * sp - (0.05 + 0.1 * crand());
      this.sRot[s] = (crand() < 0.5 ? -1 : 1) * (0.8 + 3.2 * crand());     // ±4 rad/s
      this.sFa[s] = crand() * Math.PI;
      this.sFr[s] = (crand() < 0.5 ? -1 : 1) * (1.6 + 3.2 * crand());
      this.sZ[s] = 1.5 + 0.45 * crand() + 0.3 * near;                       // fake-z peak scale (avg ≈ 1.8)
      this.sT[s] = FLY_T * (0.85 + 0.15 * crand()) * (1 - 0.15 * near);
      this.sLum[s] = 0.94 + 0.1 * crand();
      this.sDelay[s] = amin * 0.07;
      this.sSeed[s] = crand();
    }
    this.ns = S;
    this.segA = new Int32Array(fr.segA); this.segB = new Int32Array(fr.segB);
    const C = fr.chains.length;
    let cn = 0, cmax = 2;
    for (const ch of fr.chains) { cn += ch.length; cmax = Math.max(cmax, ch.length); }
    this.chStart = new Int32Array(C); this.chLen = new Int32Array(C); this.chNodes = new Int32Array(cn); this.chSeed = new Float32Array(C);
    cn = 0;
    for (let c = 0; c < C; c++) {
      const ch = fr.chains[c];
      this.chStart[c] = cn; this.chLen[c] = ch.length; this.chSeed[c] = crand();
      for (const id of ch) this.chNodes[cn++] = id;
    }
    if (this.sx.length < cmax) { this.sx = new Float32Array(cmax); this.sy = new Float32Array(cmax); this.sa = new Float32Array(cmax); }
    this.impX = impact.x / W; this.impY = impact.y / H;
    // texture mapping
    this.src = frame.source;
    const uv = frame.uvs;
    this.uvo[0] = uv.x0; this.uvo[1] = uv.y0; this.uvo[2] = uv.x1 - uv.x0; this.uvo[3] = uv.y1 - uv.y0; this.uvo[4] = uv.x3 - uv.x0; this.uvo[5] = uv.y3 - uv.y0;
    if (!this.shards) {
      this.shards = new ShardBatch(frame.source, 2048, 6144, { cold: PAL.magenta, hot: 0xffffff, fromTexture: 0 });
      this.addChildAt(this.shards.mesh, 0);
    } else this.shards.setSource(frame.source);
    frame.source.once('destroy', this.srcDestroyed);
    this.crackReveal = 0;
    this.separated = false;
    this.t = 0;
    this.running = true;
    this.visible = true;
    // impact point: a hot local pop (the fullscreen flash belongs to the game's FlashBudget)
    this.debris.emitFx('flash', impact.x, impact.y, 1, { size: diag * 0.22 / 90, intensity: 0.7, heat: 0.9, life: 0.3, color: 0xfff4e0 });
    this.debris.emitFx('spike', impact.x, impact.y, 1, { size: diag * 0.6 / 120, intensity: 0.55, life: 0.3, color: 0xffc8f0 });
    this.debris.emitFx('spark', impact.x, impact.y, 26, { speed: diag * 0.9, color: 0xfff4e0, life: 0.35, size: 1.2, gravity: 0 });
    this.build();
  }

  private finish(): void {
    if (this.src && !this.src.destroyed) this.src.off('destroy', this.srcDestroyed);
    this.src = null;
    this.running = false;
    this.separated = false;
    this.ns = 0;
    if (this.shards) this.shards.mesh.visible = false;
    this.cracks.mesh.visible = false;
    this.debris.clear();
  }

  update(dt: number): void {
    if (!this.running) return;
    this.time += dt;
    if (!this.separated && this.crackReveal >= 0.999) this.separate();
    if (this.separated && dt > 0) {
      this.t += dt;
      if (this.t >= FLY_T + 0.1 && this.debris.count === 0) { this.finish(); return; }
    }
    this.debris.update(dt);
    this.build();
  }

  private separate(): void {
    this.separated = true;
    this.t = 0;
    const scr = this.renderer.screen;
    const W = scr.width, H = scr.height;
    const diag = Math.hypot(W, H);
    const ix = this.impX * W, iy = this.impY * H;
    const E = this.segA.length;
    // 300 debris from the crack lines: glass slivers, hot sparks, a few embers
    for (let k = 0; k < 300; k++) {
      const e = Math.floor(crand() * E);
      const a = this.segA[e], b = this.segB[e];
      const u = crand();
      const x = (this.nX[a] + (this.nX[b] - this.nX[a]) * u) * W;
      const y = (this.nY[a] + (this.nY[b] - this.nY[a]) * u) * H;
      const dx = x - ix, dy = y - iy;
      const d = Math.hypot(dx, dy) || 1;
      const sp = diag * (0.18 + 0.5 * Math.exp(-d / (0.3 * diag))) * (0.5 + crand());
      const vx = (dx / d) * sp, vy = (dy / d) * sp - diag * 0.08 * crand();
      const r = crand();
      if (r < 0.56) this.debris.emitFx('shardlet', x, y, 1, { vx, vy, speed: 60, size: 0.7 + crand() * 0.9, gravity: diag * 0.9, life: 0.95, color: crand() < 0.3 ? 0xffc8f0 : 0xeaf8ff, jitter: 0 });
      else if (r < 0.86) this.debris.emitFx('spark', x, y, 1, { vx, vy, speed: 80, size: 0.8 + crand() * 0.6, gravity: diag * 0.3, life: 0.6, color: crand() < 0.5 ? PAL.magenta : 0xfff4e0, jitter: 0 });
      else this.debris.emitFx('ember', x, y, 1, { vx: vx * 0.6, vy: vy * 0.6, speed: 40, size: 1.1, gravity: diag * 0.25, life: 0.9, color: PAL.molten, jitter: 0 });
    }
    this.debris.emitFx('ring', ix, iy, 1, { size: diag * 0.5 / 70, intensity: 0.5, heat: 0.5, life: 0.45, color: 0xffc8f0 });
  }

  private build(): void {
    const b = this.shards;
    if (!b || this.ns === 0) return;
    const scr = this.renderer.screen;
    const W = scr.width, H = scr.height;
    const diag = Math.hypot(W, H);
    const ix = this.impX * W, iy = this.impY * H;
    const reveal = Math.min(1, Math.max(0, this.crackReveal)) * 1.12;
    const uo = this.uvo;
    b.begin();
    for (let s = 0; s < this.ns; s++) {
      const n0 = this.ringStart[s], nr = this.ringLen[s];
      b.reserve(nr + 1, nr * 3);
      const cx0 = this.sCx[s] * W, cy0 = this.sCy[s] * H;
      let px = cx0, py = cy0, scale = 1, rot = 0, cosF = 1, alpha = 1, rim = 0, shade = 1, spec = 0, phase = 0, ca = 0;
      const fa = this.sFa[s], cfa = Math.cos(fa), sfa = Math.sin(fa);
      const rad = this.sRad[s] * diag;
      if (!this.separated) {
        // stress: panes shift apart ~1 px as the crack reaches them, edges light up
        const k = Math.min(1, Math.max(0, (reveal - this.sArr[s]) / 0.12));
        const dx = cx0 - ix, dy = cy0 - iy;
        const d = Math.hypot(dx, dy) || 1;
        const push = k * Math.min(2.2, 0.8 + rad * 0.012);
        px += (dx / d) * push; py += (dy / d) * push;
        rim = 0.95 * k;
        shade = 1 + (this.sLum[s] - 1) * k;
      } else {
        const t = Math.max(0, this.t - this.sDelay[s]);
        const T = this.sT[s];
        const a = Math.min(1, t / T);
        // fake z: quick pop off the pane, then accelerating toward the camera
        const e = 0.45 * (1 - (1 - a) * (1 - a)) + 0.55 * a * a;
        scale = 1 + (this.sZ[s] - 1) * e;
        // centroid ballistic (diag-units), then perspective push away from the impact
        const vx = this.sVx[s] * diag, vy = this.sVy[s] * diag;
        let cx = cx0 + vx * t, cy = cy0 + vy * t + 0.5 * diag * 0.42 * t * t;
        const persp = 1 + (scale - 1) * 0.42;
        cx = ix + (cx - ix) * persp; cy = iy + (cy - iy) * persp;
        px = cx; py = cy;
        rot = this.sRot[s] * t;
        const fp = this.sFr[s] * t;
        cosF = Math.cos(fp);
        shade = this.sLum[s] * (cosF >= 0 ? 0.8 + 0.2 * cosF : 0.5 + 0.1 * -cosF) * (1 - 0.18 * e);
        spec = 0.5 * Math.min(1, t * 10);
        phase = Math.sin(fp + this.sSeed[s] * 6) * 1.6;
        rim = 0.6 + 1.2 * Math.exp(-t * 7);
        alpha = a < 0.62 ? 1 : Math.max(0, 1 - (a - 0.62) / 0.38);
        ca = (1.5 + 3 * e) / W;   // ≤ ~4.5 px radial split at the rim: a slight prism edge, not a rainbow
      }
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const invR = 1 / Math.max(1e-3, rad);
      const cu = this.sCx[s], cv = this.sCy[s];
      const c0 = b.vert(px, py, uo[0] + cu * uo[2] + cv * uo[4], uo[1] + cu * uo[3] + cv * uo[5], 0, 0, 0, alpha, rim, shade, spec, phase, ca, 0, 0);
      for (let k = 0; k < nr; k++) {
        const id = this.ringNodes[n0 + k];
        const nu = this.nX[id], nv = this.nY[id];
        let dx = nu * W - cx0, dy = nv * H - cy0;
        const lx = dx * invR, ly = dy * invR;
        if (cosF !== 1) {
          const al = dx * cfa + dy * sfa, pe = (-dx * sfa + dy * cfa) * cosF;
          dx = al * cfa - pe * sfa; dy = al * sfa + pe * cfa;
        }
        dx *= scale; dy *= scale;
        b.vert(px + dx * cr - dy * sr, py + dx * sr + dy * cr, uo[0] + nu * uo[2] + nv * uo[4], uo[1] + nu * uo[3] + nv * uo[5],
          lx, ly, 1, alpha, rim, shade, spec, phase, ca, 0, 0);
      }
      for (let k = 0; k < nr; k++) b.tri(c0, c0 + 1 + k, c0 + 1 + ((k + 1) % nr));
    }
    b.end();
    // ── cracks ──
    const cm = this.cracks;
    const fade = this.separated ? Math.max(0, 1 - this.t / 0.14) : 1;
    if (fade <= 0) { cm.mesh.visible = false; return; }
    cm.u.uReveal = reveal;
    cm.u.uFade = fade;
    cm.u.uTime = this.time;
    if (this.separated) { cm.mesh.visible = fade > 0; return; } // geometry frozen, fading out
    cm.begin();
    const hw = Math.max(4, diag * 0.0065);
    const xs = this.sx, ys = this.sy, as = this.sa;
    for (let c = 0; c < this.chStart.length; c++) {
      const c0 = this.chStart[c], n = this.chLen[c];
      let am = 0;
      for (let i = 0; i < n; i++) {
        const id = this.chNodes[c0 + i];
        xs[i] = this.nX[id] * W; ys[i] = this.nY[id] * H; as[i] = this.nArr[id];
        am += as[i];
      }
      const k = 1.3 - 0.65 * (am / n);       // thinner away from the impact
      cm.chain(xs, ys, as, n, hw * k, hw * k * 0.3, this.chSeed[c]);
    }
    cm.end();
  }

  /** Compile every fx program once (1×1 target) so the IMPACT frame never hitches on a shader link. */
  private prewarm(): void {
    try {
      const rt = RenderTexture.create({ width: 2, height: 2 });
      const root = new Container();
      const b = new ShardBatch(Texture.WHITE.source, 8, 8, { cold: 0xffffff, hot: 0xffffff, fromTexture: 0 });
      b.begin();
      const v = b.vert(0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0);
      b.vert(1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0);
      b.vert(0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0);
      b.tri(v, v + 1, v + 2);
      b.end();
      const c = new CrackMesh(1);
      c.begin(); c.chain(new Float32Array([0, 1]), new Float32Array([0, 1]), new Float32Array([0, 0]), 2, 1, 0, 0); c.end();
      const p = new Particles(4);
      p.emitFx('flash', 1, 1, 1);
      p.update(0.01);
      root.addChild(b.mesh, c.mesh, p);
      this.renderer.render({ container: root, target: rt, clear: true });
      prewarmMotes(this.renderer, rt);
      root.removeChildren();
      b.destroy(); c.destroy(); p.destroy({ children: true });
      rt.destroy(true);
    } catch (e) {
      console.warn('[fx] prewarm skipped', e);
    }
  }
}
