// Terningen · GateView: "Porten under klinten", a gate of chalk and ice set into Møns Klint, drawn over the LIVE sky
// (stage layer 'chamber'). Shared by the chamber and the ceremony. It renders a DiceView (never the store) plus the
// player's fill-order seed. Geometry in stage px from the DOM slot #chGate; build() on open and on resize.
//
// Layers (back → front): light behind the opening · the two leaves (baked half-arch + 974 tile particles each) ·
// leaf edge strips · the seam · the chalk wall (one Canvas2D bake with the opening cut out: ridge, streaks, flint,
// 3 archivolts (inner 19 stones, outer 48), keystone socket, lintel plaque, threshold, 6 niches with cabinets,
// grooves) · the lit NORDLYS groove · groove light · lantern · keystone ghost / key die · lintel digits · labels.
// About a dozen draw calls; update() runs only while visible. Nothing changes between 1 and 1947 dice except that
// one more tile is lit. Automat 1948 is never drawn: only light, its name and the concept label under it.
import { gsap } from 'gsap';
import { Container, Sprite, Graphics, ParticleContainer, Particle, Texture } from 'pixi.js';
import { IsText } from '../modules.ts';
import { softDot, softBand } from '../tex.ts';
import { PAL, css } from '../../core/palette.ts';
import { dieTexture } from '../art/dieImage.ts';
import { gateLattice, gateOrder, hash01, GATE_H, TILES, PER_LEAF } from './gateLattice.ts';
import { GATE_LABELS, gateState, type GateState } from '../../ui/diceCopy.ts';
import type { DiceView } from '../../game/dice.ts';

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
/** Everything the ceremony needs to know about the current layout (stage px). */
export interface GateGeom {
  cx: number; oy: number; W: number; H: number; stageW: number;
  keystone: Pt; keySize: number;
  nordlys: Rect & { screen: Pt };
  keyPath: Pt[];         // NORDLYS niche → its jamb → up the outer archivolt → the keystone
  keyLen: number[];      // cumulative length along keyPath
  lintelY: number;
}

const WALL_TOP = 0x3b4557, WALL_MID = 0x2b3345, WALL_BOT = 0x1a2030;
const clamp = (a: number, v: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixHex = (a: number, b: number, t: number) => {
  const c = (s: number) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t));
  return (c(16) << 16) | (c(8) << 8) | c(0);
};
const rgba = (hex: number, a: number) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
/** Deterministic bake noise (the cliff looks the same on every visit). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Aurora colour at a tile's height (0 = top, 1 = bottom): #3dffb0 bottom → #19e3d6 middle → #8a5cff top;
 *  the top 10 % blended 30 % toward #ff2bd6 (magenta only on small sprites). */
function auroraAt(v: number): number {
  const c = v >= 0.5 ? mixHex(PAL.teal, PAL.green, (v - 0.5) / 0.5) : mixHex(PAL.violet, PAL.teal, v / 0.5);
  return v < 0.1 ? mixHex(c, PAL.magenta, 0.3 * (1 - v / 0.1)) : c;
}
/** Rise (sine.out) then fall (sine.inOut) envelope, 0 outside. */
function envelope(tau: number, rise: number, fall: number): number {
  if (tau <= 0 || tau >= rise + fall) return 0;
  if (tau < rise) return Math.sin((tau / rise) * Math.PI / 2);
  return 0.5 + 0.5 * Math.cos(((tau - rise) / fall) * Math.PI);
}

/** Niche contents: left column top → bottom, then the right column. NORDLYS is the LEFT column, MIDDLE row. */
const CABINETS = ['arch', 'nordlys', 'low', 'porthole', 'twin', 'slant'] as const;
/** Rounded rectangle path (no reliance on CanvasRenderingContext2D.roundRect). */
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  g.moveTo(x + q, y); g.arcTo(x + w, y, x + w, y + h, q); g.arcTo(x + w, y + h, x, y + h, q); g.arcTo(x, y + h, x, y, q); g.arcTo(x, y, x + w, y, q); g.closePath();
}

let tileTex: Texture | null = null;
/** 8 px rounded rhombus with a soft core (baked once, 16 px for crisp scaling). */
function tileTexture(): Texture {
  if (tileTex) return tileTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const g = cv.getContext('2d')!;
  g.beginPath();
  g.moveTo(8, 1); g.quadraticCurveTo(8.8, 1.8, 15, 8); g.quadraticCurveTo(8.8, 14.2, 8, 15); g.quadraticCurveTo(7.2, 14.2, 1, 8); g.quadraticCurveTo(7.2, 1.8, 8, 1);
  g.closePath();
  const gr = g.createRadialGradient(8, 8, 0, 8, 8, 7.5);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,.75)');
  gr.addColorStop(1, 'rgba(255,255,255,.35)');
  g.fillStyle = gr;
  g.fill();
  return (tileTex = Texture.from(cv));
}

class Leaf extends Container {
  sprite = new Sprite();
  tiles: ParticleContainer;
  parts: Particle[] = [];
  readonly right: boolean;
  constructor(right: boolean) {
    super();
    this.right = right;
    this.tiles = new ParticleContainer({ dynamicProperties: { position: false, vertex: false, rotation: false, uvs: false, color: true }, texture: tileTexture() });
    this.tiles.blendMode = 'add';
    for (let i = 0; i < PER_LEAF; i++) {
      const p = new Particle({ texture: tileTexture(), anchorX: 0.5, anchorY: 0.5 });
      this.parts.push(p);
      this.tiles.addParticle(p);
    }
    this.addChild(this.sprite, this.tiles);
  }
}

export class GateView extends Container {
  geom: GateGeom | null = null;
  state: GateState = 'sealed';
  // ---- ceremony controls (tweened by the gate cinematic; applied in update) ----
  twinkleAmp = 1;       // lit tiles' ±12 % twinkle (0 = the gate holds its breath)
  openT = 0;            // leaves: 0 closed … 1 open (scale.x 1 → .14, skewY ±.05, dim, edge strip 0 → 6 px)
  lightLevel = 0;       // light behind the leaves: core α (band α = ⅝ of it)
  breathe = false;      // open state: ±.03 at 0,1 Hz (static in calm)
  warm = 0;             // wall tint 25 % toward #fff4e0
  lantern = 0.3;        // NORDLYS lantern α
  groove = 0.5;         // NORDLYS lit groove α
  seamT = 0;            // bar 5 seam of cold light: bottom → top (0..1)
  seamA = 0;
  leafFade = 1;         // the leaves' alpha (calm crossfades between the poses)
  keySeated = false;    // the key die sits in the keystone (re-seated on a rebuild)
  calm = false;
  // ---- display objects ----
  private light = new Container();
  private core = new Sprite(softDot());
  private band = new Sprite(softBand());
  private leafL = new Leaf(false);
  private leafR = new Leaf(true);
  private edges = new Graphics();
  private seamCore = new Sprite(Texture.WHITE);
  private seamHalo = new Sprite(softBand());
  private wall = new Sprite();
  private grooveLit = new Sprite();
  private grooveDot = new Sprite(softDot());
  private lanternDot = new Sprite(softDot());
  readonly ghost = new Sprite();
  readonly keyDie = new Sprite();
  readonly digits: IsText[] = [];
  private nicheLabel: IsText;
  readonly title: IsText;
  readonly concept: IsText;
  readonly eyebrow: IsText;
  // ---- per-tile state ----
  private lit = new Uint8Array(TILES);
  private col = new Uint32Array(TILES);
  private freq = new Float32Array(TILES);
  private phase = new Float32Array(TILES);
  private waveD = new Float32Array(TILES); // distance from the keystone, 0..1 (resonance waves)
  private shimmers: number[] = [];
  private waves: number[] = [];
  private time = 0;
  private seed = -1;
  private count = -1;
  private dirtyTint = true;

  constructor() {
    super();
    this.label = 'gate';
    this.visible = false;
    this.core.anchor.set(0.5); this.core.tint = PAL.whiteHot; this.core.blendMode = 'add';
    this.band.anchor.set(0.5); this.band.tint = 0xcfe6ff; this.band.blendMode = 'add';
    this.light.addChild(this.core, this.band);
    this.seamCore.anchor.set(0.5, 1); this.seamCore.tint = 0xeaf8ff; this.seamCore.blendMode = 'add';
    this.seamHalo.anchor.set(0.5, 1); this.seamHalo.tint = PAL.teal; this.seamHalo.blendMode = 'add';
    this.grooveDot.anchor.set(0.5); this.grooveDot.tint = PAL.teal; this.grooveDot.blendMode = 'add'; this.grooveDot.alpha = 0;
    this.lanternDot.anchor.set(0.5); this.lanternDot.tint = PAL.teal; this.lanternDot.blendMode = 'add';
    this.ghost.anchor.set(0.5); this.keyDie.anchor.set(0.5);
    for (const ch of GATE_LABELS.lintel) this.digits.push(new IsText({ text: ch, size: 20, style: 'ice', decor: false }));
    this.nicheLabel = new IsText({ text: GATE_LABELS.niche, size: 9, style: 'muted', tracking: 0.16, decor: false });
    this.title = new IsText({ text: GATE_LABELS.title, size: 24, style: 'ice', tracking: 0.14, decor: false });
    this.concept = new IsText({ text: GATE_LABELS.concept, size: 9, style: 'muted', tracking: 0.3, decor: false });
    this.eyebrow = new IsText({ text: ' ', size: 10, style: 'muted', tracking: 0.3, decor: false });
    this.addChild(this.light, this.leafL, this.leafR, this.edges, this.seamHalo, this.seamCore, this.wall, this.grooveLit, this.grooveDot,
      this.lanternDot, this.ghost, this.keyDie, ...this.digits, this.nicheLabel, this.title, this.concept, this.eyebrow);
    const L = gateLattice();
    for (let i = 0; i < TILES; i++) {
      this.freq[i] = 0.1 + 0.2 * hash01(0x7157, i);
      this.phase[i] = Math.PI * 2 * hash01(0x9a5e, i);
    }
    // the keystone sits above the crown: distance in gate units from (0.5, −0.09)
    let max = 0;
    for (let i = 0; i < TILES; i++) { this.waveD[i] = Math.hypot(L.x[i] - 0.5, L.y[i] + 0.09); max = Math.max(max, this.waveD[i]); }
    for (let i = 0; i < TILES; i++) this.waveD[i] /= max;
  }

  // ================================================================ layout + bakes
  /** Geometry from the slot S (stage px). Opening H = min(0.74·S.h, 0.60·viewportH, 607), W = H / 1.32 (≤ 0.62·S.w). */
  build(S: Rect, stage: { w: number; h: number; dpr: number }): void {
    let H = Math.min(0.74 * S.h, 0.6 * stage.h, 607), W = H / GATE_H;
    if (W > 0.62 * S.w) { W = 0.62 * S.w; H = GATE_H * W; }
    W = Math.max(40, W); H = GATE_H * W;
    const cx = S.x + S.w / 2;
    const oy = S.y + 0.32 * W + (S.h - H - 0.37 * W) / 2;
    const Rout = 0.68 * W, acy = oy + W / 2;
    // niches: nw × 1.55 nw; columns beside the outer archivolt, kept inside the slot (desktop: off the text columns)
    const nw = clamp(28, 0.15 * W, 72), nh = 1.55 * nw;
    const sideRoom = Math.max(0, S.w / 2 - Rout - 16);
    const off = Rout + Math.max(0.9 * nw, Math.min(0.5 * sideRoom, 0.35 * W));
    const rows = [0.3, 0.55, 0.8].map((f) => oy + f * H);
    const niches: (Rect & { side: -1 | 1; row: number })[] = [];
    for (const side of [-1, 1] as const) rows.forEach((y, row) => niches.push({ x: cx + side * off - nw / 2, y: y - nh / 2, w: nw, h: nh, side, row }));
    const nord = niches.find((n) => n.side === -1 && n.row === 1)!;
    const cab = { w: 0.8 * nw, h: 0.85 * nh };
    const screen = { x: nord.x + nw / 2, y: nord.y + nh - (nh - cab.h) / 2 - cab.h * 0.62 };
    // keyPath: niche screen → niche inner edge → the outer archivolt (+3 px) → up the jamb → along the arch → keystone
    const gx = cx - Rout - 3, keystone = { x: cx, y: oy - 0.09 * W };
    const path: Pt[] = [screen, { x: nord.x + nw, y: nord.y + nh / 2 }, { x: gx, y: nord.y + nh / 2 }, { x: gx, y: acy }];
    for (let k = 1; k <= 24; k++) { const a = Math.PI + (k / 24) * (Math.PI / 2); path.push({ x: cx + (Rout + 3) * Math.cos(a), y: acy + (Rout + 3) * Math.sin(a) }); }
    path.push(keystone);
    const len = [0];
    for (let i = 1; i < path.length; i++) len.push(len[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
    this.geom = {
      cx, oy, W, H, stageW: stage.w, keystone, keySize: 0.11 * W,
      nordlys: { x: nord.x, y: nord.y, w: nw, h: nh, screen }, keyPath: path, keyLen: len, lintelY: oy - 0.26 * W,
    };
    const r = Math.min(stage.dpr, 1.5) * 0.75;
    this.bakeWall(stage.w, niches, r);
    this.bakeGroove(r);
    this.bakeLeaves(Math.min(stage.dpr, 2));
    this.placeTiles();
    // light, lantern, keystone, texts
    const g = this.geom;
    this.core.position.set(cx, oy + H / 2); this.core.width = 0.9 * W; this.core.height = 0.9 * H;
    this.band.position.set(cx, oy + H / 2); this.band.width = 0.35 * W; this.band.height = H;
    this.lanternDot.position.set(screen.x, screen.y); this.lanternDot.width = this.lanternDot.height = 2.2 * nw;
    this.grooveDot.width = this.grooveDot.height = Math.max(10, 0.5 * nw);
    const tex = dieTexture();
    this.ghost.texture = tex; this.keyDie.texture = tex;
    this.ghost.position.set(keystone.x, keystone.y); this.ghost.width = this.ghost.height = g.keySize;
    if (this.keySeated) { this.keyDie.position.set(keystone.x, keystone.y); this.keyDie.width = this.keyDie.height = g.keySize; }
    this.seamCore.position.set(cx, oy + H); this.seamHalo.position.set(cx, oy + H);
    const ds = Math.min(0.085 * W, 48);
    let adv = 0;
    for (const d of this.digits) { d.size = ds; adv = Math.max(adv, d.textWidth); }
    adv += 0.45 * ds;
    this.digits.forEach((d, i) => d.position.set(cx + (i - 1.5) * adv, g.lintelY));
    const s = Math.min(stage.w, 720);
    this.nicheLabel.size = Math.max(9, 0.3 * nw); // IsText sizes are cap heights
    this.nicheLabel.position.set(nord.x + nw / 2, nord.y + nh + this.nicheLabel.size * 1.3 + 3);
    this.title.size = clamp(16, 0.075 * s, 54);
    this.concept.size = Math.max(9, 0.022 * s);
    this.title.position.set(cx, oy + 0.3 * H);
    this.concept.position.set(cx, oy + 0.3 * H + this.title.size * 1.25 + this.concept.size);
    this.eyebrow.size = Math.max(10, 0.026 * s);
    this.eyebrow.position.set(cx, oy - 0.32 * W - this.eyebrow.size * 1.6);
    this.dirtyTint = true;
    this.applyOpen();
  }

  private swap(sp: Sprite, cv: HTMLCanvasElement): void {
    const old = sp.texture;
    sp.texture = Texture.from(cv); // the canvas stays referenced for a context-restore re-upload
    if (old && old !== Texture.EMPTY && old !== Texture.WHITE) old.destroy(true);
  }

  /** The chalk wall with the portal (one bake per layout; see the file header). */
  private bakeWall(stageW: number, niches: (Rect & { side: -1 | 1; row: number })[], res: number): void {
    const g0 = this.geom!, { cx, oy, W, H } = g0;
    const ridgeY = oy - 0.42 * W, top = ridgeY - 0.1 * W - 12, bottom = oy + H + 0.05 * W + 40;
    let r = res;
    if (stageW * r > 2048) r = 2048 / stageW;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(stageW * r));
    cv.height = Math.max(1, Math.ceil((bottom - top) * r));
    const g = cv.getContext('2d')!;
    g.setTransform(r, 0, 0, r, 0, -top * r);
    const R = rng(1948);
    // ---- ridge (a slight hump over the portal) + chalk body ----
    const ridge: Pt[] = [];
    let walk = 0;
    for (let x = -6; x <= stageW + 6; x += 6) {
      walk = clamp(-1, walk + (R() - 0.5) * 0.5, 1);
      const hump = 0.08 * W * Math.exp(-(((x - cx) / (1.1 * W)) ** 2));
      ridge.push({ x, y: ridgeY - hump + walk * 0.035 * W + Math.sin(x * 0.045) * 2 });
    }
    const ridgePath = () => { g.beginPath(); ridge.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); };
    ridgePath();
    g.lineTo(stageW + 6, bottom); g.lineTo(-6, bottom); g.closePath();
    const body = g.createLinearGradient(0, ridgeY, 0, bottom);
    body.addColorStop(0, css(WALL_TOP)); body.addColorStop(0.65, css(WALL_MID)); body.addColorStop(1, css(WALL_BOT));
    g.fillStyle = body;
    g.fill();
    g.save();
    ridgePath(); g.lineTo(stageW + 6, bottom); g.lineTo(-6, bottom); g.closePath(); g.clip();
    // erosion streaks (180): light chalk runs and dark cracks
    for (let i = 0; i < 180; i++) {
      const x = R() * stageW, y = ridgeY + R() * (bottom - ridgeY) * 0.5, l = (0.2 + R() * 0.6) * (bottom - ridgeY);
      const dark = i % 3 === 2;
      g.strokeStyle = dark ? rgba(0x151a28, 0.15) : rgba(0x56617a, 0.1 + R() * 0.12);
      g.lineWidth = 0.6 + R() * 1.2;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (R() - 0.5) * 6, y + l * 0.33, x + (R() - 0.5) * 6, y + l * 0.66, x + (R() - 0.5) * 8, y + l); g.stroke();
    }
    // six flint bands, interrupted by the portal and the niches
    const inPortal = (x: number, y: number) => Math.abs(x - cx) < 0.68 * W + 8 && y > oy - 0.36 * W;
    const inNiche = (x: number, y: number) => niches.some((n) => x > n.x - 6 && x < n.x + n.w + 6 && y > n.y - 6 && y < n.y + n.h + 6);
    for (const f of [0.18, 0.31, 0.44, 0.57, 0.7, 0.83]) {
      const by = ridgeY + f * (bottom - 40 - ridgeY);
      for (let x = R() * 9; x < stageW; x += 9 + R() * 7) {
        const y = by + (R() - 0.5) * 4;
        if (inPortal(x, y) || inNiche(x, y)) continue;
        g.fillStyle = rgba(0x0b1022, 0.75);
        g.beginPath(); g.ellipse(x, y, 2 + R() * 3, 1.5 + R() * 1.5, (R() - 0.5) * 0.5, 0, Math.PI * 2); g.fill();
      }
    }
    // ---- three stepped archivolts (widths 0.07W / 0.06W / 0.05W; inner 19 stones, outer 48) ----
    const acy = oy + W / 2, foot = oy + H;
    const outline = (rad: number) => { g.moveTo(cx - rad, foot); g.lineTo(cx - rad, acy); g.arc(cx, acy, rad, Math.PI, 0); g.lineTo(cx + rad, foot); };
    const rings: [number, number, number, number][] = [[0.5 * W, 0.57 * W, 0x4a5569, 19], [0.57 * W, 0.63 * W, 0x434d61, 31], [0.63 * W, 0.68 * W, 0x3c4558, 48]];
    for (const [ri, ro, fill, stones] of rings) {
      g.beginPath(); outline(ro); g.lineTo(cx + ri, foot); g.lineTo(cx + ri, acy); g.arc(cx, acy, ri, 0, Math.PI, true); g.lineTo(cx - ri, foot); g.closePath();
      g.fillStyle = css(fill); g.fill();
      g.strokeStyle = rgba(0x1a2030, 0.6); g.lineWidth = 1;
      g.beginPath();
      for (let k = 1; k < stones; k++) { const a = Math.PI + (k / stones) * Math.PI; g.moveTo(cx + ri * Math.cos(a), acy + ri * Math.sin(a)); g.lineTo(cx + ro * Math.cos(a), acy + ro * Math.sin(a)); }
      const step = (ro - ri) * 1.7;
      for (let y = acy + step; y < foot - 2; y += step) { g.moveTo(cx - ro, y); g.lineTo(cx - ri, y); g.moveTo(cx + ri, y); g.lineTo(cx + ro, y); }
      g.stroke();
      g.strokeStyle = rgba(0x9cc9ff, 0.12); g.beginPath(); outline(ro - 0.5); g.stroke(); // top light on each step
    }
    // ice crust on the inner edge: a teal glow and a thin frost line
    g.strokeStyle = rgba(PAL.teal, 0.12); g.lineWidth = 3; g.beginPath(); outline(0.5 * W + 1.5); g.stroke();
    g.strokeStyle = rgba(0xcfefff, 0.45); g.lineWidth = 1.5; g.beginPath(); outline(0.5 * W + 0.75); g.stroke();
    // keystone socket (0.13W square at the crown, recessed)
    const ks = 0.13 * W;
    g.fillStyle = css(0x141a28); g.fillRect(cx - ks / 2, g0.keystone.y - ks / 2, ks, ks);
    g.strokeStyle = rgba(0x9cc9ff, 0.25); g.lineWidth = 1; g.strokeRect(cx - ks / 2 + 0.5, g0.keystone.y - ks / 2 + 0.5, ks - 1, ks - 1);
    // lintel plaque (0.62W × 0.12W, chiselled: shadow above, highlight below)
    const pw = 0.62 * W, ph = 0.12 * W, py = g0.lintelY - ph / 2;
    g.fillStyle = css(0x353e52); g.fillRect(cx - pw / 2, py, pw, ph);
    g.fillStyle = rgba(0x050810, 0.6); g.fillRect(cx - pw / 2, py, pw, 1);
    g.fillStyle = rgba(0x9cc9ff, 0.22); g.fillRect(cx - pw / 2, py + ph - 1, pw, 1);
    // threshold step
    g.fillStyle = css(0x464f63); g.fillRect(cx - 0.62 * W, foot, 1.24 * W, 0.05 * W);
    g.fillStyle = rgba(0x9cc9ff, 0.18); g.fillRect(cx - 0.62 * W, foot, 1.24 * W, 1);
    // ---- grooves (2 px carved + 1 px highlight): each niche to its jamb; NORDLYS continues to the keystone ----
    const carve = (pts: Pt[]) => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = rgba(0x9cc9ff, 0.12); g.lineWidth = 1; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y + 1.5) : g.moveTo(p.x, p.y + 1.5))); g.stroke();
      g.strokeStyle = css(0x141a28); g.lineWidth = 2; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
    };
    const archX = (y: number) => (y >= acy ? 0.68 * W : Math.sqrt(Math.max(0, (0.68 * W) ** 2 - (y - acy) ** 2)));
    for (const n of niches) {
      const y = n.y + n.h / 2, from = n.side < 0 ? n.x + n.w : n.x;
      carve([{ x: from, y }, { x: cx + n.side * archX(y), y }]);
    }
    carve(g0.keyPath.slice(2, -1));
    // ---- niches (rounded-top recesses with an inner shadow) and the six cabinet silhouettes ----
    const nichePath = (n: Rect) => { g.beginPath(); g.moveTo(n.x, n.y + n.h); g.lineTo(n.x, n.y + n.w / 2); g.arc(n.x + n.w / 2, n.y + n.w / 2, n.w / 2, Math.PI, 0); g.lineTo(n.x + n.w, n.y + n.h); g.closePath(); };
    for (const n of niches) {
      nichePath(n); g.fillStyle = css(0x0a0f1c); g.fill();
      const sh = g.createLinearGradient(0, n.y, 0, n.y + n.h);
      sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(0.35, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.25)');
      nichePath(n); g.fillStyle = sh; g.fill();
      g.strokeStyle = rgba(0x9cc9ff, 0.1); g.lineWidth = 1; nichePath(n); g.stroke();
      this.cabinet(g, n, CABINETS[n.side < 0 ? n.row : 3 + n.row]);
    }
    g.restore();
    // ---- ridge: tree line on the outer thirds, the rim, a 12 px feather into the live sky ----
    g.fillStyle = css(PAL.night0);
    for (const p of ridge) {
      if (p.x > stageW / 3 && p.x < (2 * stageW) / 3) continue;
      if (R() < 0.45) { const h = 3 + R() * 7; g.beginPath(); g.ellipse(p.x, p.y + 1, 2 + R() * 3, h, 0, Math.PI, 0); g.fill(); }
    }
    g.strokeStyle = rgba(0x9cc9ff, 0.35); g.lineWidth = 1; ridgePath(); g.stroke();
    g.globalCompositeOperation = 'destination-out';
    for (const [w, a] of [[26, 0.12], [16, 0.16], [8, 0.2]] as const) { g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = w; ridgePath(); g.stroke(); }
    // bottom: 40 px fade to transparent
    const fade = g.createLinearGradient(0, bottom - 40, 0, bottom);
    fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = fade; g.fillRect(-6, bottom - 40, stageW + 12, 41);
    // the opening is cut out (the leaves and the light show through)
    g.fillStyle = '#000'; g.beginPath(); outline(0.5 * W); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    this.swap(this.wall, cv);
    this.wall.position.set(0, top);
    this.wall.scale.set(1 / r);
  }

  /** Cabinet silhouette at 0.8 nw × 0.85 nh. Five nameless dark shapes; NORDLYS is a lit upright cabinet. */
  private cabinet(g: CanvasRenderingContext2D, n: Rect, kind: (typeof CABINETS)[number]): void {
    const w = 0.8 * n.w * (kind === 'low' ? 1.1 : 1), h = 0.85 * n.h * (kind === 'low' ? 0.66 : 1);
    const x = n.x + (n.w - w) / 2, y = n.y + n.h - (n.h - 0.85 * n.h) / 2 - h, rr = Math.min(w, h) * 0.12;
    const round = (x0: number, y0: number, ww: number, hh: number, r0: number) => { g.beginPath(); rrect(g, x0, y0, ww, hh, r0); };
    if (kind === 'nordlys') {
      round(x, y, w, h, rr); g.fillStyle = css(PAL.night1); g.fill();
      g.strokeStyle = rgba(PAL.teal, 0.5); g.lineWidth = 1; g.stroke();
      const top = g.createLinearGradient(x, 0, x + w, 0);
      top.addColorStop(0, css(PAL.green)); top.addColorStop(0.5, css(PAL.teal)); top.addColorStop(1, css(PAL.violet));
      g.fillStyle = top; g.fillRect(x + w * 0.14, y + h * 0.06, w * 0.72, Math.max(1, h * 0.025));
      const sx = x + w * 0.16, sy = y + h * 0.14, sw = w * 0.68, shh = w * 0.68;
      g.fillStyle = '#06101f'; g.fillRect(sx, sy, sw, shh);
      const c = sw / 3;
      for (let i = 0; i < 9; i++) { g.fillStyle = css(PAL.sym[i]); g.globalAlpha = 0.9; g.beginPath(); g.arc(sx + c * (i % 3) + c / 2, sy + c * Math.floor(i / 3) + c / 2, c * 0.3, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
      g.fillStyle = rgba(PAL.teal, 0.35); g.fillRect(x + w * 0.2, y + h * 0.7, w * 0.6, Math.max(1, h * 0.03));
      return;
    }
    g.fillStyle = css(PAL.night0);
    g.strokeStyle = 'rgba(156,201,255,.25)';
    g.lineWidth = 1;
    g.beginPath();
    if (kind === 'arch') { g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); }
    else if (kind === 'slant') { g.moveTo(x, y + h); g.lineTo(x, y + h * 0.16); g.lineTo(x + w, y); g.lineTo(x + w, y + h); g.closePath(); }
    else rrect(g, x, y, w, h, kind === 'low' ? rr * 0.6 : rr);
    g.fill(); g.stroke();
    // screens (#0b1428) with one diagonal reflection at α .12; no names, numbers, symbols or games
    const scr: Rect[] = kind === 'twin' ? [{ x: x + w * 0.18, y: y + h * 0.12, w: w * 0.64, h: h * 0.26 }, { x: x + w * 0.18, y: y + h * 0.44, w: w * 0.64, h: h * 0.26 }]
      : kind === 'low' ? [{ x: x + w * 0.12, y: y + h * 0.16, w: w * 0.76, h: h * 0.42 }]
        : [{ x: x + w * 0.18, y: y + (kind === 'arch' ? w * 0.42 : h * 0.2), w: w * 0.64, h: w * 0.6 }];
    for (const s of scr) {
      g.fillStyle = css(0x0b1428);
      if (kind === 'porthole') { g.beginPath(); g.arc(s.x + s.w / 2, s.y + s.h / 2, Math.min(s.w, s.h) / 2, 0, Math.PI * 2); g.fill(); }
      else g.fillRect(s.x, s.y, s.w, s.h);
      g.strokeStyle = 'rgba(234,248,255,.12)';
      g.beginPath(); g.moveTo(s.x + s.w * 0.15, s.y + s.h * 0.85); g.lineTo(s.x + s.w * 0.55, s.y + s.h * 0.15); g.stroke();
    }
  }

  /** The NORDLYS groove overlay: the keyPath stroked teal → violet (sprite α .5, .9 in the ceremony). */
  private bakeGroove(res: number): void {
    const p = this.geom!.keyPath.slice(1);
    const x0 = Math.min(...p.map((q) => q.x)) - 4, y0 = Math.min(...p.map((q) => q.y)) - 4;
    const x1 = Math.max(...p.map((q) => q.x)) + 4, y1 = Math.max(...p.map((q) => q.y)) + 4;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil((x1 - x0) * res)); cv.height = Math.max(1, Math.ceil((y1 - y0) * res));
    const g = cv.getContext('2d')!;
    g.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
    const gr = g.createLinearGradient(p[0].x, p[0].y, p[p.length - 1].x, p[p.length - 1].y);
    gr.addColorStop(0, css(PAL.teal)); gr.addColorStop(1, css(PAL.violet));
    g.strokeStyle = gr; g.lineWidth = 1.6; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); p.slice(0, -1).forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke();
    this.swap(this.grooveLit, cv);
    this.grooveLit.position.set(x0, y0);
    this.grooveLit.scale.set(1 / res);
    this.grooveLit.blendMode = 'add';
  }

  /** Two half-arch leaves of dark ice (caustics, teal fresnel edge, a frost seam); pivots at the outer jambs. */
  private bakeLeaves(res: number): void {
    const { cx, oy, W, H } = this.geom!;
    const hw = W / 2;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(hw * res)); cv.height = Math.max(1, Math.ceil(H * res));
    const g = cv.getContext('2d')!;
    g.setTransform(res, 0, 0, res, 0, 0);
    const shape = () => { g.beginPath(); g.moveTo(0, H); g.lineTo(0, hw); g.arc(hw, hw, hw, Math.PI, Math.PI * 1.5); g.lineTo(hw, H); g.closePath(); };
    shape();
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(11,27,58,.92)'); gr.addColorStop(1, 'rgba(6,14,34,.95)');
    g.fillStyle = gr; g.fill();
    g.save(); shape(); g.clip();
    const R = rng(0x1ea7);
    g.fillStyle = rgba(PAL.teal, 0.03);
    for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(R() * hw, R() * H, 3 + R() * hw * 0.35, 2 + R() * hw * 0.12, R() * Math.PI, 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.strokeStyle = rgba(PAL.teal, 0.5); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0.75, H); g.lineTo(0.75, hw); g.arc(hw, hw, hw - 0.75, Math.PI, Math.PI * 1.5); g.stroke();
    g.strokeStyle = rgba(0xcfefff, 0.25); g.lineWidth = 1;
    g.beginPath(); g.moveTo(hw - 0.5, 0); g.lineTo(hw - 0.5, H); g.stroke();
    this.swap(this.leafL.sprite, cv);
    this.leafR.sprite.texture = this.leafL.sprite.texture; // mirrored below (one texture, both leaves)
    this.leafL.sprite.scale.set(1 / res);
    this.leafR.sprite.scale.set(-1 / res, 1 / res);
    this.leafL.position.set(cx - hw, oy);
    this.leafR.position.set(cx + hw, oy);
  }

  /** Tile particles at 0.68 × pitch in leaf-local px (the right leaf is local x ≤ 0 from its hinge). */
  private placeTiles(): void {
    const { W } = this.geom!;
    const L = gateLattice();
    const sc = (0.68 * L.spacing * W) / 16;
    for (const leaf of [this.leafL, this.leafR]) {
      for (let k = 0; k < PER_LEAF; k++) {
        const i = k + (leaf.right ? PER_LEAF : 0), p = leaf.parts[k];
        p.x = (leaf.right ? L.x[i] - 1 : L.x[i]) * W;
        p.y = L.y[i] * W;
        p.scaleX = p.scaleY = sc;
      }
      leaf.tiles.update();
    }
  }

  // ================================================================ state
  /** Sealed (lit = count, closed, ghost key, no light, engraved lintel) · pending (all lit, closed) · open (all lit,
   *  leaves open, key seated, light .6, lit lintel, "AUTOMAT 1948" + the concept label). A hard cut. */
  setView(v: DiceView, seed: number): void {
    this.state = gateState(v);
    const n = this.state === 'sealed' ? Math.min(v.count, TILES) : TILES;
    if (seed !== this.seed || n !== this.count) {
      this.seed = seed; this.count = n;
      this.lit.fill(0);
      if (n >= TILES) this.lit.fill(1);
      else if (n > 0) { const o = gateOrder(seed); for (let k = 0; k < n; k++) this.lit[o[k]] = 1; }
      this.dirtyTint = true;
    }
    this.resetCeremony();
    this.setOpenPose(this.state === 'open');
  }
  /** The static end poses (no motion): the closed, all-lit gate or the open gate. */
  setOpenPose(open: boolean): void {
    this.openT = open ? 1 : 0;
    this.leafFade = 1;
    this.lightLevel = open ? 0.6 : 0;
    this.warm = open ? 0.5 : 0;
    this.breathe = open;
    this.keySeated = open;
    this.ghost.visible = !open;
    this.ghost.alpha = 0.14; this.ghost.tint = PAL.frost;
    this.keyDie.visible = open;
    if (open && this.geom) { this.keyDie.position.set(this.geom.keystone.x, this.geom.keystone.y); this.keyDie.width = this.keyDie.height = this.geom.keySize; }
    this.keyDie.alpha = 1; this.keyDie.tint = 0xe0e0e0; this.keyDie.rotation = 0;
    for (let i = 0; i < 4; i++) this.setDigit(i, open ? 1 : 0);
    this.title.visible = this.concept.visible = open;
    this.title.alpha = 0.9; this.title.reveal = 1; this.title.sweep = -0.2; this.concept.alpha = 1;
    this.applyOpen();
  }
  /** From the current pose back to the closed, all-lit pose: the replay reset (400 ms) and the demo exit (1,2 s;
   *  calm: a crossfade). The light dims, the key and the name fade, the digits go back to engraved. */
  closeTo(dur: number, calm: boolean): gsap.core.Timeline {
    const tl = gsap.timeline({ onComplete: () => this.setOpenPose(false) });
    if (calm) tl.to(this, { leafFade: 0, duration: dur / 2 }, 0).call(() => { this.openT = 0; }, [], dur / 2).to(this, { leafFade: 1, duration: dur / 2 }, dur / 2);
    else tl.to(this, { openT: 0, duration: dur, ease: 'power2.inOut' }, 0);
    const lit = { v: 1 };
    tl.to(this, { lightLevel: 0, warm: 0, duration: dur }, 0)
      .to([this.title, this.concept, this.keyDie], { alpha: 0, duration: Math.min(dur, 0.4) }, 0)
      .to(lit, { v: 0, duration: dur, onUpdate: () => { for (let i = 0; i < 4; i++) this.setDigit(i, Math.min(this.digits[i].alpha > 0.55 ? 1 : 0, lit.v)); } }, 0)
      .call(() => { this.breathe = false; this.ghost.visible = true; this.ghost.alpha = 0; }, [], 0)
      .to(this.ghost, { alpha: 0.14, duration: dur }, 0);
    return tl;
  }
  /** Lintel digit i: engraved (α .55, glow .6) → lit (α 1, glow 2). */
  setDigit(i: number, t: number): void {
    const d = this.digits[i];
    d.alpha = lerp(0.55, 1, t);
    d.glow = lerp(0.6, 2, t);
  }
  private resetCeremony(): void {
    this.twinkleAmp = 1; this.warm = 0; this.lantern = 0.3; this.groove = 0.5; this.seamT = 0; this.seamA = 0;
    this.shimmers.length = 0; this.waves.length = 0;
    this.eyebrow.alpha = 0;
  }
  /** Bar 2: a shimmer wave climbs bottom → top through both leaves in 1,6 s (×1.25 max, rise ≥ 500 ms). */
  shimmer(): void { this.shimmers.push(this.time); }
  /** Bar 4: a resonance wave inside-out from the keystone (×1.15, rise 500 ms, fall 800 ms, front 700 ms). */
  wave(): void { this.waves.push(this.time); }

  private applyOpen(): void {
    const t = this.openT, g = this.geom;
    const s = lerp(1, 0.14, t);
    this.leafL.scale.x = s; this.leafR.scale.x = s;
    this.leafL.skew.y = 0.05 * t; this.leafR.skew.y = -0.05 * t;
    const dim = mixHex(0xffffff, 0x5a6a8a, t);
    this.leafL.tint = dim; this.leafR.tint = dim;
    this.leafL.alpha = this.leafR.alpha = this.edges.alpha = this.leafFade;
    this.edges.clear();
    if (g && t > 0.01) {
      const w = 6 * t, hw = g.W / 2, ex = hw * s, dy = Math.sin(0.05 * t) * ex;
      this.edges.rect(g.cx - hw + ex, g.oy + dy, w, g.H).fill({ color: 0x0e2a4a, alpha: 0.9 });
      this.edges.rect(g.cx - hw + ex, g.oy + dy, 1, g.H).fill({ color: PAL.teal, alpha: 0.35 });
      this.edges.rect(g.cx + hw - ex - w, g.oy + dy, w, g.H).fill({ color: 0x0e2a4a, alpha: 0.9 });
      this.edges.rect(g.cx + hw - ex - 1, g.oy + dy, 1, g.H).fill({ color: PAL.teal, alpha: 0.35 });
    }
  }

  // ================================================================ frame
  /** Per frame while visible: tiles (twinkle, shimmer, waves), light breathing, wall tint from the live aurora. */
  update(dt: number, env0: [number, number, number]): void {
    if (!this.visible || !this.geom) return;
    this.time += dt;
    const t = this.time, calm = this.calm;
    this.applyOpen();
    // light
    const br = this.breathe && !calm ? 0.03 * Math.sin(t * Math.PI * 2 * 0.1) : 0;
    const lv = Math.max(0, this.lightLevel + (this.lightLevel > 0 ? br : 0));
    this.core.alpha = lv; this.band.alpha = lv * 0.625;
    this.light.visible = lv > 0.001;
    // wall: the live aurora lights the chalk (25 %), the gate light warms it (25 % toward #fff4e0)
    const env = ((Math.round(env0[0] * 255) << 16) | (Math.round(env0[1] * 255) << 8) | Math.round(env0[2] * 255)) >>> 0;
    this.wall.tint = mixHex(mixHex(0xffffff, env, 0.25), PAL.whiteHot, 0.25 * this.warm);
    this.lanternDot.alpha = this.lantern;
    this.grooveLit.alpha = this.groove;
    // the light that travels the NORDLYS groove every 6 s over 1,8 s (a static glow in calm)
    const g = this.geom;
    if (calm) { this.grooveDot.alpha = 0; }
    else {
      const u = (t % 6) / 1.8;
      if (u < 1) {
        const p = this.pathAt(u);
        this.grooveDot.position.set(p.x, p.y);
        this.grooveDot.alpha = 0.55 * Math.sin(u * Math.PI);
      } else this.grooveDot.alpha = 0;
    }
    // seam of cold light (bar 5)
    this.seamCore.visible = this.seamHalo.visible = this.seamA > 0.001;
    if (this.seamCore.visible) {
      const h = g.H * this.seamT;
      this.seamCore.height = h; this.seamCore.width = lerp(2, 5, this.seamT); this.seamCore.alpha = this.seamA;
      this.seamHalo.height = h; this.seamHalo.width = 16; this.seamHalo.alpha = 0.5 * this.seamA;
    }
    this.updateTiles(t);
  }

  /** Point at fraction u (0..1) along keyPath. */
  pathAt(u: number): Pt {
    const { keyPath: p, keyLen: L } = this.geom!;
    const d = clamp(0, u, 1) * L[L.length - 1];
    let i = 1;
    while (i < L.length - 1 && L[i] < d) i++;
    const f = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
    return { x: lerp(p[i - 1].x, p[i].x, f), y: lerp(p[i - 1].y, p[i].y, f) };
  }

  private updateTiles(t: number): void {
    const L = gateLattice();
    if (this.dirtyTint) {
      this.dirtyTint = false;
      for (let i = 0; i < TILES; i++) this.col[i] = this.lit[i] ? auroraAt(L.y[i] / GATE_H) : PAL.frost;
      for (const leaf of [this.leafL, this.leafR]) for (let k = 0; k < PER_LEAF; k++) leaf.parts[k].tint = this.col[k + (leaf.right ? PER_LEAF : 0)];
    }
    const tw = this.calm ? 0 : 0.12 * this.twinkleAmp;
    this.shimmers = this.shimmers.filter((s) => t - s < 1.6 + 1.2 + 0.1);
    this.waves = this.waves.filter((s) => t - s < 0.7 + 1.3 + 0.1);
    for (const leaf of [this.leafL, this.leafR]) {
      for (let k = 0; k < PER_LEAF; k++) {
        const i = k + (leaf.right ? PER_LEAF : 0);
        if (!this.lit[i]) { leaf.parts[k].alpha = 0.1; continue; }
        let b = 1;
        for (const s of this.shimmers) b += 0.25 * envelope(t - s - (1 - L.y[i] / GATE_H) * 1.6, 0.5, 0.7); // bottom first
        for (const s of this.waves) b += 0.15 * envelope(t - s - this.waveD[i] * 0.7, 0.5, 0.8);
        b = Math.min(1.25, b);
        const a = 0.85 * b * (1 + tw * Math.sin(Math.PI * 2 * this.freq[i] * t + this.phase[i]));
        leaf.parts[k].alpha = Math.min(1, a);
      }
    }
  }
}
