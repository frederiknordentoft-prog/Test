/**
 * Canvas textures for the orrery, all drawn once at init.
 *
 * Engraving is laid out in polar space: texture u runs clockwise along the
 * ring, v runs outward across the band. Shapes are plotted through a polar
 * mapping, so a circle around a socket is still a circle on the ring.
 *
 * Enamel texture (data, not colour):  R = gold inlay mask and bump height,
 * G = enamel tone (0 deep .. 1 light). It covers two sockets (90°) and repeats
 * four times, so neighbouring gaps can carry different glyphs.
 */
import * as THREE from 'three';
import { RING_RADII, RING_WIDTH, STEP_ANGLE, SYMBOL_DIAMETER } from '../../core/config';

/** Radial width of each brass rim. */
export const RIM_W = 0.07;
/** Half width of the enamel channel between the rims. */
export const CHANNEL_HALF = RING_WIDTH / 2 - RIM_W;
/** Radial span of the textured part of the base plate. */
export const PLATE_R0 = 5.1;
export const PLATE_R1 = 8.25;
/** Knurl periods across the brass texture (u = 1). */
export const MILL_PERIODS = 64;

const DEG = Math.PI / 180;

/** Local seeded stream: texture layout must not disturb the shared cosmetic stream. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return { cv, ctx: cv.getContext('2d')! };
}

/** Pen that plots ring-local shapes (x = clockwise tangent, y = outward, world units) into a polar-unwrapped canvas. */
class Polar {
  private a0 = 0;
  private ox = 0;
  private oy = 0;
  private s = 1;

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly W: number,
    readonly H: number,
    readonly period: number,
    readonly r0: number,
    readonly r1: number,
    readonly R: number,
  ) {}

  /** Pixels per world unit, radially. */
  get u(): number {
    return this.H / (this.r1 - this.r0);
  }

  /** Canvas y of the circle at radius R + d. */
  yOf(d: number): number {
    return (1 - (this.R + d - this.r0) / (this.r1 - this.r0)) * this.H;
  }

  at(angle: number, ox = 0, oy = 0, s = 1): this {
    this.a0 = angle;
    this.ox = ox;
    this.oy = oy;
    this.s = s;
    return this;
  }

  private trace(pts: readonly number[], close: boolean): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const lx = this.ox + pts[i] * this.s;
      const ly = this.R + this.oy + pts[i + 1] * this.s;
      const X = ((this.a0 + Math.atan2(lx, ly)) / this.period) * this.W;
      const Y = (1 - (Math.hypot(lx, ly) - this.r0) / (this.r1 - this.r0)) * this.H;
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    if (close) ctx.closePath();
  }

  line(pts: readonly number[], close = false): void {
    this.trace(pts, close);
    this.ctx.stroke();
  }

  fill(pts: readonly number[]): void {
    this.trace(pts, true);
    this.ctx.fill();
  }

  arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, fill = false): void {
    const n = Math.max(6, Math.ceil(Math.abs(toDeg - fromDeg) / 9));
    const pts: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (fromDeg + ((toDeg - fromDeg) * i) / n) * DEG;
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    if (fill) this.fill(pts);
    else this.line(pts);
  }

  hairline(d: number): void {
    const y = this.yOf(d);
    this.ctx.beginPath();
    this.ctx.moveTo(0, y);
    this.ctx.lineTo(this.W, y);
    this.ctx.stroke();
  }
}

type Glyph = (p: Polar) => void;

/** Planetary and alchemical signs as plain strokes in a unit box (y up). */
const G: Record<string, Glyph> = {
  sun: (p) => {
    p.arc(0, 0, 0.42, 0, 360);
    p.arc(0, 0, 0.08, 0, 360, true);
  },
  moon: (p) => {
    p.arc(0, 0, 0.45, 50, 310);
    p.arc(0.27, 0, 0.3455, 87, 273);
  },
  venus: (p) => {
    p.arc(0, 0.17, 0.26, 0, 360);
    p.line([0, -0.09, 0, -0.5]);
    p.line([-0.17, -0.31, 0.17, -0.31]);
  },
  mercury: (p) => {
    p.arc(0, 0.1, 0.23, 0, 360);
    p.arc(0, 0.5, 0.17, 200, 340);
    p.line([0, -0.13, 0, -0.5]);
    p.line([-0.16, -0.33, 0.16, -0.33]);
  },
  mars: (p) => {
    p.arc(-0.1, -0.1, 0.3, 0, 360);
    p.line([0.11, 0.11, 0.45, 0.45]);
    p.line([0.2, 0.45, 0.45, 0.45, 0.45, 0.2]);
  },
  jupiter: (p) => {
    p.arc(-0.2, 0.22, 0.2, 160, -70);
    p.line([-0.13, 0.03, -0.42, -0.14, 0.42, -0.14]);
    p.line([0.2, 0.45, 0.2, -0.5]);
  },
  saturn: (p) => {
    p.line([-0.18, 0.5, -0.18, -0.25]);
    p.line([-0.38, 0.3, 0.02, 0.3]);
    p.arc(0.02, -0.03, 0.2, 180, -50);
    p.line([0.15, -0.18, 0.1, -0.38, 0.3, -0.45]);
  },
  fire: (p) => p.line([0, 0.45, 0.42, -0.35, -0.42, -0.35], true),
  water: (p) => p.line([0, -0.45, 0.42, 0.35, -0.42, 0.35], true),
  air: (p) => {
    p.line([0, 0.45, 0.42, -0.35, -0.42, -0.35], true);
    p.line([-0.32, 0.05, 0.32, 0.05]);
  },
  earth: (p) => {
    p.line([0, -0.45, 0.42, 0.35, -0.42, 0.35], true);
    p.line([-0.32, -0.05, 0.32, -0.05]);
  },
  star: (p) => p.fill([0, 0.5, 0.08, 0.08, 0.5, 0, 0.08, -0.08, 0, -0.5, -0.08, -0.08, -0.5, 0, -0.08, 0.08]),
  dot: (p) => p.arc(0, 0, 0.5, 0, 360, true),
};

/** Run a drawing three times, shifted by one period, so anything crossing the seam wraps. */
function wrapped(ctx: CanvasRenderingContext2D, W: number, draw: () => void): void {
  for (const k of [-1, 0, 1]) {
    ctx.save();
    ctx.translate(k * W, 0);
    draw();
    ctx.restore();
  }
}

function finish(cv: HTMLCanvasElement, aniso: number, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = aniso;
  return t;
}

export function buildEnamelTexture(ring: number, aniso: number): THREE.CanvasTexture {
  const R = RING_RADII[ring];
  const D = SYMBOL_DIAMETER[ring];
  const W = ring < 2 ? 1024 : 2048;
  const H = 256;
  const { cv, ctx } = makeCanvas(W, H);
  const p = new Polar(ctx, W, H, STEP_ANGLE * 2, R - CHANNEL_HALF, R + CHANNEL_HALF, R);
  const u = p.u;

  // Tone: engine-turned waves under the glass (flinqué), darker toward the rims.
  ctx.fillStyle = 'rgb(0,92,0)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,255,0,0.36)';
  ctx.lineWidth = 1.2;
  const waves = [16, 28, 40, 52][ring];
  const rows = 34;
  for (let k = 0; k <= rows; k++) {
    const y0 = (k / rows) * H;
    const ph = (k % 2) * Math.PI;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 3) {
      const y = y0 + Math.sin((x / W) * waves * Math.PI * 2 + ph) * (H / rows) * 0.42;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.6)');
  shade.addColorStop(0.15, 'rgba(0,0,0,0)');
  shade.addColorStop(0.85, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  wrapped(ctx, W, () => {
    const gold = (): void => {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgb(255,0,0)';
      ctx.fillStyle = 'rgb(255,0,0)';
    };
    gold();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Degree scale along both rims.
    const stepDeg = [3, 1.5, 1, 1][ring];
    const n = Math.round(90 / stepDeg);
    ctx.lineCap = 'butt';
    for (let i = 0; i < n; i++) {
      const x = (i / n) * W;
      const major = i % 5 === 0;
      const len = (major ? 0.062 : 0.034) * u;
      ctx.lineWidth = (major ? 0.008 : 0.0055) * u;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, len);
      ctx.moveTo(x, H);
      ctx.lineTo(x, H - len);
      ctx.stroke();
    }
    ctx.lineWidth = 0.0055 * u;
    p.hairline(CHANNEL_HALF - 0.078);
    p.hairline(-(CHANNEL_HALF - 0.078));
    ctx.lineCap = 'round';

    // Tiny stars scattered over the open enamel (the glyph gaps stay clear).
    const rnd = seeded(101 + ring * 17);
    const half = (R * STEP_ANGLE) / 2;
    for (let i = 0; i < 26 + ring * 14; i++) {
      const ang = rnd() * STEP_ANGLE * 2;
      const d = (rnd() - 0.5) * 0.52;
      const size = 0.012 + rnd() * 0.02;
      const t = Math.abs(((ang / STEP_ANGLE) % 1) - 0.5) * 2 * half; // arc distance to the nearest socket spoke
      if (half - t < [0.1, 0.24, 0.34, 0.36][ring]) continue;
      G.dot(p.at(ang, 0, d, size));
    }

    // Signs between the sockets: alternate so neighbouring gaps differ.
    for (let m = 0; m < 2; m++) {
      const ang = m * STEP_ANGLE;
      if (ring === 0) {
        G.star(p.at(ang, 0, 0.265, 0.13));
        G.dot(p.at(ang, 0, -0.275, 0.045));
      } else if (ring === 1) {
        ctx.lineWidth = 0.013 * u;
        (m ? G.mercury : G.moon)(p.at(ang, 0, 0, 0.34));
        G.star(p.at(ang, 0, 0.275, 0.1));
        G.star(p.at(ang, 0, -0.275, 0.1));
      } else if (ring === 2) {
        ctx.lineWidth = 0.014 * u;
        (m ? G.venus : G.sun)(p.at(ang, 0, 0, 0.38));
        ctx.lineWidth = 0.009 * u;
        (m ? G.air : G.fire)(p.at(ang, -0.5, 0, 0.2));
        (m ? G.earth : G.water)(p.at(ang, 0.5, 0, 0.2));
        G.star(p.at(ang, 0, 0.28, 0.1));
        G.star(p.at(ang, 0, -0.28, 0.1));
      } else {
        ctx.lineWidth = 0.015 * u;
        (m ? G.saturn : G.jupiter)(p.at(ang, 0, 0, 0.42));
        ctx.lineWidth = 0.01 * u;
        (m ? G.water : G.mars)(p.at(ang, -0.56, 0, 0.24));
        (m ? G.mercury : G.fire)(p.at(ang, 0.56, 0, 0.24));
        // A small constellation on either side.
        ctx.lineWidth = 0.0045 * u;
        for (const sx of [-1, 1]) {
          const c = [0.9 * sx, 0.12, 1.02 * sx, -0.06, 0.86 * sx, -0.16];
          p.at(ang).line(c);
          G.star(p.at(ang, c[0], c[1], 0.11));
          G.dot(p.at(ang, c[2], c[3], 0.04));
          G.dot(p.at(ang, c[4], c[5], 0.05));
        }
        G.star(p.at(ang, 0, 0.285, 0.1));
        G.star(p.at(ang, 0, -0.285, 0.1));
      }
    }

    // Calm, dark dish under each symbol so the symbol pops; then a fine gold seat line.
    for (let m = 0; m < 2; m++) {
      p.at((m + 0.5) * STEP_ANGLE);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      const layers = 14;
      for (let i = 0; i < layers; i++) p.arc(0, 0, D / 2 + 0.17 - (i / (layers - 1)) * 0.14, 0, 360, true);
      gold();
      ctx.lineWidth = 0.006 * u;
      p.arc(0, 0, D / 2 + 0.012, 0, 360);
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  return finish(cv, aniso, false);
}

/**
 * Brass detail (albedo multiplier and bump in one): white = untouched metal.
 * v 0..0.2 blank (every plain vertex samples v = 0), v 0.27..0.43 knurling,
 * v 0.55..0.95 the bezel face scale for one 45° sector.
 */
export function buildBrassTexture(aniso: number): THREE.CanvasTexture {
  const W = 1024;
  const H = 256;
  const { cv, ctx } = makeCanvas(W, H);
  const Y = (v: number): number => (1 - v) * H;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  const pw = W / MILL_PERIODS;
  for (let i = 0; i < MILL_PERIODS; i++) {
    const g = ctx.createLinearGradient(i * pw, 0, (i + 1) * pw, 0);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.5, '#5e5e5e');
    g.addColorStop(1, '#fff');
    ctx.fillStyle = g;
    ctx.fillRect(i * pw, Y(0.47), pw, Y(0.23) - Y(0.47));
  }

  const ink = '#3d2f1a';
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  wrapped(ctx, W, () => {
    for (let i = 0; i < 45; i++) {
      const x = (i / 45) * W;
      const major = i % 5 === 0;
      ctx.lineWidth = major ? 3.2 : 2;
      ctx.beginPath();
      ctx.moveTo(x, Y(0.565));
      ctx.lineTo(x, Y(major ? 0.7 : 0.64));
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    for (const v of [0.725, 0.935]) {
      ctx.beginPath();
      ctx.moveTo(0, Y(v));
      ctx.lineTo(W, Y(v));
      ctx.stroke();
    }
    // Pips between the numerals; the texture is 1.55x finer radially than along the arc.
    for (let i = 4; i <= 41; i++) {
      if (i === 22 || i === 23) continue;
      const big = i % 3 === 1;
      ctx.beginPath();
      ctx.ellipse((i / 45) * W, Y(0.83), (big ? 4.2 : 2.4) * 0.64, big ? 4.2 : 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const cx = W / 2;
    const cy = Y(0.83);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 13);
    ctx.lineTo(cx + 9, cy);
    ctx.lineTo(cx, cy + 13);
    ctx.lineTo(cx - 9, cy);
    ctx.closePath();
    ctx.fill();
  });

  return finish(cv, aniso, true);
}

/** Star chart for the base plate beyond the bezel: one 45° sector, dim so the clockwork stays background. */
export function buildPlateTexture(aniso: number): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const { cv, ctx } = makeCanvas(W, H);
  const R = (PLATE_R0 + PLATE_R1) / 2;
  const p = new Polar(ctx, W, H, STEP_ANGLE, PLATE_R0, PLATE_R1, R);
  const u = p.u;
  const bg = ctx.createLinearGradient(0, H, 0, 0);
  bg.addColorStop(0, '#0b1230');
  bg.addColorStop(0.6, '#070b1c');
  bg.addColorStop(1, '#03050d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  wrapped(ctx, W, () => {
    ctx.strokeStyle = 'rgba(184,146,63,0.5)';
    ctx.fillStyle = 'rgba(242,212,136,0.75)';
    ctx.lineWidth = 0.012 * u;
    for (const r of [5.62, 5.68, 6.9, 7.58]) p.hairline(r - R);
    ctx.lineWidth = 0.008 * u;
    for (let i = 0; i < 30; i++) {
      const x = (i / 30) * W;
      ctx.beginPath();
      ctx.moveTo(x, p.yOf(7.58 - R));
      ctx.lineTo(x, p.yOf(7.58 + (i % 5 === 0 ? 0.16 : 0.09) - R));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(184,146,63,0.28)';
    for (const x of [0, W / 2]) {
      ctx.beginPath();
      ctx.moveTo(x, p.yOf(5.68 - R));
      ctx.lineTo(x, p.yOf(7.58 - R));
      ctx.stroke();
    }
    const rnd = seeded(7);
    for (let c = 0; c < 6; c++) {
      let x = 0;
      let y = 5.85 + rnd() * 1.5 - R;
      const ang = rnd() * STEP_ANGLE;
      const pts: number[] = [];
      const n = 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        pts.push(x, y);
        x += (rnd() - 0.3) * 0.6;
        y = Math.max(5.8 - R, Math.min(7.45 - R, y + (rnd() - 0.5) * 0.6));
      }
      ctx.lineWidth = 0.006 * u;
      p.at(ang).line(pts);
      for (let i = 0; i < pts.length; i += 2) G.dot(p.at(ang, pts[i], pts[i + 1], 0.03 + rnd() * 0.035));
    }
    for (let i = 0; i < 70; i++) G.dot(p.at(rnd() * STEP_ANGLE, 0, 5.72 + rnd() * 1.82 - R, 0.01 + rnd() * 0.018));
  });

  // Let the plate sink into the night toward its edge.
  const fade = ctx.createLinearGradient(0, H * 0.4, 0, 0);
  fade.addColorStop(0, 'rgba(3,5,13,0)');
  fade.addColorStop(1, 'rgba(3,5,13,0.9)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  return finish(cv, aniso, true);
}
