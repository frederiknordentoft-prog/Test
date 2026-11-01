/**
 * Canvas2D renderer for the future fan (look-dev). One canvas, cached strand layer,
 * live history line and head. No shadowBlur, no filters: glow is a double stroke.
 */
import { END, STEP, type FanFrame } from './model';

export type Variant = 'lyn' | 'langtid' | 'spaghetti';
export const VARIANTS: { id: Variant; label: string }[] = [
  { id: 'lyn', label: 'A · Lyn' },
  { id: 'langtid', label: 'B · Langtid' },
  { id: 'spaghetti', label: 'C · Spaghetti' },
];

const RGB: [number, number, number][] = [[92, 225, 255], [150, 158, 172], [255, 210, 0]];
const FONT_NUM = '"ORE Flex", "Roboto Flex", Arial, sans-serif';
const FONT_UI = '"ORE Tight", "Inter Tight", Arial, sans-serif';

interface Geo { w: number; h: number; left: number; nowX: number; right: number; top: number; bottom: number }

export class FanRenderer {
  private dpr = 1;
  private w = 0;
  private h = 0;
  private frame: FanFrame | null = null;
  private center = 50;
  private tl = 1e6; // left log-warp constant, solved once per render
  variant: Variant = 'lyn';
  nowFrac = 0.34;
  /** Render time of the last full picture in ms (for the HUD). */
  lastBuildMs = 0;

  setSize(w: number, h: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, Math.round(w));
    this.h = Math.max(1, Math.round(h));
  }

  setFrame(frame: FanFrame): void {
    this.frame = frame;
  }

  setVariant(v: Variant): void {
    this.variant = v;
  }

  /** Where the live head sits (CSS px), for the DOM head element. */
  head(): { x: number; y: number } | null {
    if (!this.frame || this.w < 2) return null;
    const g = this.geo();
    this.center = this.frame.asks[0];
    return { x: g.nowX, y: this.y(this.frame.asks[0], g) };
  }

  private geo(): Geo {
    const gutter = 66;
    const left = 10;
    const right = this.w - gutter;
    return { w: this.w, h: this.h, left, nowX: Math.round(left + (right - left) * this.nowFrac), right, top: 28, bottom: this.h - 24 };
  }

  /**
   * Match time to x. Smooth log warp on both sides of NU: the near future and the recent past get
   * the most room, and the slope is the same just left and right of NU (no kinks).
   */
  x(t: number, g: Geo, now: number): number {
    const R = Math.max(0.01, END - now);
    const spanR = g.right - g.nowX;
    const t0 = 6;
    const normR = Math.log(1 + R / t0);
    if (t >= now) return g.nowX + (spanR * Math.log(1 + (t - now) / t0)) / normR;
    const L = Math.max(0.01, now);
    const spanL = g.nowX - g.left;
    const tl = this.tl;
    return g.nowX - (spanL * Math.log(1 + (now - t) / tl)) / Math.log(1 + L / tl);
  }

  /** Solves the left warp so the slope just left of NU equals the slope just right of it. */
  private solveLeftWarp(g: Geo, now: number): void {
    const R = Math.max(0.01, END - now);
    const spanR = g.right - g.nowX;
    const t0 = 6;
    const slope = spanR / (t0 * Math.log(1 + R / t0));
    const L = Math.max(0.01, now);
    const spanL = g.nowX - g.left;
    this.tl = 1e6;
    if (spanL / slope >= L) return;
    let lo = 1e-3;
    let hi = 1e5;
    for (let i = 0; i < 50; i++) {
      const mid = Math.sqrt(lo * hi);
      if (mid * Math.log(1 + L / mid) < spanL / slope) lo = mid;
      else hi = mid;
    }
    this.tl = Math.sqrt(lo * hi);
  }

  /** Price (øre) to y. Smooth fisheye (tanh) centred on the ask: about 3× magnification near the price. */
  y(p: number, g: Geo): number {
    const A = 2.2;
    const sd = 14;
    const gg = (q: number) => q + A * sd * Math.tanh((q - this.center) / sd);
    const F = (gg(p) - gg(0)) / (gg(100) - gg(0));
    return g.bottom - F * (g.bottom - g.top);
  }

  /** Draws the complete static picture into `canvas`. Called only when data, size or variant change. */
  renderTo(canvas: HTMLCanvasElement): void {
    const f = this.frame;
    if (!f || this.w < 2) return;
    const t0 = performance.now();
    const W = Math.round(this.w * this.dpr);
    const H = Math.round(this.h * this.dpr);
    // Re-allocating the backing store is expensive; only do it when the size changes.
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const c = canvas.getContext('2d');
    if (!c) return;
    this.center = f.asks[0];
    const g = this.geo();
    this.solveLeftWarp(g, f.now);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    this.drawGrid(c, f, g);
    if (this.variant === 'langtid') this.buildLongExposure(c, f, g, canvas);
    else this.buildLines(c, f, g, this.variant === 'spaghetti');
    this.drawGutter(c, f, g);
    this.drawHistory(c, f, g);
    this.drawNow(c, f, g);
    this.drawCause(c, f, g, g.nowX, this.y(f.asks[0], g));
    this.lastBuildMs = performance.now() - t0;
  }

  /** Points of one strand, decimated to about one per px but keeping every jump. */
  private points(f: FanFrame, s: FanFrame['strands'][number], g: Geo, smooth: boolean): { x: number; y: number; jump: boolean }[] {
    let v: ArrayLike<number> = s.v;
    if (smooth) {
      // Zero-phase EMA (forward then backward, ~1 game minute): jumps become S-curves.
      const a = STEP / 1.1;
      const fw = new Float32Array(s.v.length);
      fw[0] = s.v[0];
      for (let k = 1; k < fw.length; k++) fw[k] = fw[k - 1] + a * (s.v[k] - fw[k - 1]);
      const bw = new Float32Array(fw.length);
      bw[bw.length - 1] = s.v[s.v.length - 1];
      for (let k = bw.length - 2; k >= 0; k--) bw[k] = bw[k + 1] + a * (fw[k] - bw[k + 1]);
      bw[0] = s.v[0];
      v = bw;
    }
    const out: { x: number; y: number; jump: boolean }[] = [];
    let lastX = -1e9;
    for (let k = 0; k < v.length; k++) {
      const t = f.now + k * STEP;
      const x = this.x(Math.min(t, END), g, f.now);
      const changed = k > 0 && s.d[k] !== s.d[k - 1];
      if (changed && !smooth) {
        const xp = this.x(Math.min(t - STEP, END), g, f.now);
        if (out.length && out[out.length - 1].x !== xp) out.push({ x: xp, y: this.y(v[k - 1], g), jump: false });
        out.push({ x, y: this.y(v[k], g), jump: true });
        lastX = x;
        continue;
      }
      if (x - lastX >= 0.75 || k === v.length - 1) {
        out.push({ x, y: this.y(v[k], g), jump: false });
        lastX = x;
      }
    }
    return out;
  }

  private buildLines(c: CanvasRenderingContext2D, f: FanFrame, g: Geo, smooth: boolean): void {
    c.globalCompositeOperation = 'lighter';
    c.lineJoin = 'round';
    c.lineCap = 'round';
    // Jumps are faint threads: batched into one path per outcome (no per-strand accumulation needed).
    const jumps = [new Path2D(), new Path2D(), new Path2D()];
    for (const s of f.strands) {
      const [r, gg, b] = RGB[s.outcome];
      const pts = this.points(f, s, g, smooth);
      // Plateaus: one stroke per strand, so overlapping futures add up to brighter light.
      c.strokeStyle = smooth ? `rgba(${r},${gg},${b},0.075)` : `rgba(${r},${gg},${b},0.11)`;
      c.lineWidth = smooth ? 1.2 : 1.3;
      c.beginPath();
      let pen = false;
      for (let i = 0; i < pts.length; i++) {
        if (!smooth && pts[i].jump && i > 0) {
          jumps[s.outcome].moveTo(pts[i - 1].x, pts[i - 1].y);
          jumps[s.outcome].lineTo(pts[i].x, pts[i].y);
          c.moveTo(pts[i].x, pts[i].y);
          pen = true;
          continue;
        }
        if (!pen) {
          c.moveTo(pts[i].x, pts[i].y);
          pen = true;
        } else c.lineTo(pts[i].x, pts[i].y);
      }
      c.stroke();
    }
    if (!smooth) {
      c.lineWidth = 1;
      jumps.forEach((p, o) => {
        const [r, gg, b] = RGB[o];
        c.strokeStyle = `rgba(${r},${gg},${b},0.07)`;
        c.stroke(p);
      });
    }
    c.globalCompositeOperation = 'source-over';
  }

  /** Long exposure: count strands per pixel per outcome, then tone-map and add a cheap bloom. */
  private buildLongExposure(c: CanvasRenderingContext2D, f: FanFrame, g: Geo, target: HTMLCanvasElement): void {
    const acc = document.createElement('canvas');
    acc.width = target.width;
    acc.height = target.height;
    const a = acc.getContext('2d', { willReadFrequently: true });
    if (!a) return;
    // Opaque black base: with alpha = 1, getImageData returns the summed counts unchanged.
    a.fillStyle = '#000';
    a.fillRect(0, 0, acc.width, acc.height);
    a.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    a.globalCompositeOperation = 'lighter';
    a.lineWidth = 1.4;
    a.lineJoin = 'round';
    const pure = ['rgba(255,0,0,0.018)', 'rgba(0,255,0,0.018)', 'rgba(0,0,255,0.018)'];
    const thin = ['rgba(255,0,0,0.006)', 'rgba(0,255,0,0.006)', 'rgba(0,0,255,0.006)'];
    for (const s of f.strands) {
      const pts = this.points(f, s, g, false);
      // Plateaus accumulate per strand; jump threads are drawn three times fainter.
      a.strokeStyle = pure[s.outcome];
      a.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0 || pts[i].jump) a.moveTo(pts[i].x, pts[i].y);
        else a.lineTo(pts[i].x, pts[i].y);
      }
      a.stroke();
      a.strokeStyle = thin[s.outcome];
      a.beginPath();
      for (let i = 1; i < pts.length; i++) {
        if (!pts[i].jump) continue;
        a.moveTo(pts[i - 1].x, pts[i - 1].y);
        a.lineTo(pts[i].x, pts[i].y);
      }
      a.stroke();
    }
    const img = a.getImageData(0, 0, acc.width, acc.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const cw = d[i];
      const cd = d[i + 1];
      const cl = d[i + 2];
      const n = cw + cd + cl;
      if (n === 0) {
        d[i + 3] = 0;
        continue;
      }
      const inten = 1 - Math.exp(-n / 26);
      d[i] = (cw * RGB[0][0] + cd * RGB[1][0] + cl * RGB[2][0]) / n;
      d[i + 1] = (cw * RGB[0][1] + cd * RGB[1][1] + cl * RGB[2][1]) / n;
      d[i + 2] = (cw * RGB[0][2] + cd * RGB[1][2] + cl * RGB[2][2]) / n;
      d[i + 3] = Math.min(255, inten * 255);
    }
    a.putImageData(img, 0, 0);
    c.setTransform(1, 0, 0, 1, 0, 0);
    // Bloom: downscale ×1/6, scale back up, add.
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(acc.width / 6));
    small.height = Math.max(1, Math.round(acc.height / 6));
    const sc = small.getContext('2d');
    if (sc) {
      sc.imageSmoothingEnabled = true;
      sc.drawImage(acc, 0, 0, small.width, small.height);
      c.globalAlpha = 0.55;
      c.globalCompositeOperation = 'lighter';
      c.imageSmoothingEnabled = true;
      c.drawImage(small, 0, 0, acc.width, acc.height);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    }
    c.drawImage(acc, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private drawGrid(c: CanvasRenderingContext2D, f: FanFrame, g: Geo): void {
    c.strokeStyle = '#1a2029';
    c.lineWidth = 1;
    c.setLineDash([2, 4]);
    for (const p of [0, 50, 100]) {
      const yy = Math.round(this.y(p, g)) + 0.5;
      c.beginPath();
      c.moveTo(g.left, yy);
      c.lineTo(g.right, yy);
      c.stroke();
    }
    c.setLineDash([]);
    // Pressure tint at NU (mock: FCK pressing before the first goal).
    if (f.now < 31) {
      const grd = c.createLinearGradient(g.nowX - 26, 0, g.nowX + 26, 0);
      grd.addColorStop(0, 'rgba(92,225,255,0)');
      grd.addColorStop(0.5, 'rgba(92,225,255,0.07)');
      grd.addColorStop(1, 'rgba(92,225,255,0)');
      c.fillStyle = grd;
      c.fillRect(g.nowX - 26, g.top, 52, g.bottom - g.top);
    }
  }

  private drawNow(c: CanvasRenderingContext2D, f: FanFrame, g: Geo): void {
    c.strokeStyle = 'rgba(232,237,242,0.32)';
    c.setLineDash([3, 4]);
    c.beginPath();
    c.moveTo(g.nowX + 0.5, g.top - 4);
    c.lineTo(g.nowX + 0.5, g.bottom + 4);
    c.stroke();
    c.setLineDash([]);
    c.font = `600 11px ${FONT_NUM}`;
    c.fillStyle = '#e8edf2';
    c.textAlign = 'center';
    c.fillText(`NU ${Math.floor(f.now)}′`, g.nowX, this.h - 6);
    c.fillStyle = '#8a94a3';
    c.font = `500 10.5px ${FONT_NUM}`;
    c.textAlign = 'left';
    if (f.now > 0) c.fillText('0′', g.left, this.h - 6);
    c.textAlign = 'right';
    c.fillText('90+3′', g.right, this.h - 6);
  }

  private drawHistory(c: CanvasRenderingContext2D, f: FanFrame, g: Geo): void {
    const hist = f.history;
    const path = () => {
      c.beginPath();
      let lastX = -1e9;
      for (let i = 0; i < hist.length; i++) {
        const x = this.x(i * STEP, g, f.now);
        if (x - lastX < 0.6 && i !== hist.length - 1) continue;
        const y = this.y(hist[i], g);
        if (lastX < -1e8) c.moveTo(x, y);
        else c.lineTo(x, y);
        lastX = x;
      }
    };
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(92,225,255,0.16)';
    c.lineWidth = 6;
    path();
    c.stroke();
    c.strokeStyle = '#5ce1ff';
    c.lineWidth = 2;
    path();
    c.stroke();
    // Goal glyphs on the baseline.
    for (const goal of f.goals) {
      const x = this.x(goal.t, g, f.now);
      c.fillStyle = goal.team === 0 ? '#5ce1ff' : '#ffd200';
      c.beginPath();
      c.arc(x, g.bottom + 5, 3, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(232,237,242,0.12)';
      c.beginPath();
      c.moveTo(x + 0.5, g.top);
      c.lineTo(x + 0.5, g.bottom);
      c.stroke();
    }
  }

  private drawGutter(c: CanvasRenderingContext2D, f: FanFrame, g: Geo): void {
    const gx = g.right + 8;
    // Tally at full time: the price, counted.
    c.textAlign = 'left';
    c.fillStyle = '#5ce1ff';
    c.font = `700 20px ${FONT_NUM}`;
    c.fillText(String(f.counts[0]), gx, g.top + 14);
    c.font = `600 10px ${FONT_UI}`;
    c.fillText('FCK', gx + 26, g.top + 13);
    c.font = `700 14px ${FONT_NUM}`;
    c.fillStyle = '#9aa3b2';
    c.fillText(String(f.counts[1]), gx, g.bottom - 14);
    c.font = `600 10px ${FONT_UI}`;
    c.fillText('X', gx + 20, g.bottom - 15);
    c.font = `700 14px ${FONT_NUM}`;
    c.fillStyle = '#ffd200';
    c.fillText(String(f.counts[2]), gx, g.bottom + 2);
    c.font = `600 10px ${FONT_UI}`;
    c.fillText('BIF', gx + 20, g.bottom + 1);

    // Branch tags, collision-resolved between the tallies.
    const tx = this.x(Math.min(END, f.now + f.horizon), g, f.now);
    const maxW = Math.max(...f.branches.map((b) => b.weight));
    const tags = f.branches
      .map((b) => ({ b, src: this.y(b.price, g), y: this.y(b.price, g) }))
      .sort((p, q) => p.src - q.src);
    const minY = g.top + 40;
    const maxY = g.bottom - 54;
    for (let i = 0; i < tags.length; i++) tags[i].y = Math.max(minY, Math.min(maxY, tags[i].y));
    for (let i = 1; i < tags.length; i++) if (tags[i].y - tags[i - 1].y < 30) tags[i].y = tags[i - 1].y + 30;
    for (let i = tags.length - 1; i >= 0; i--) {
      if (tags[i].y > maxY) tags[i].y = maxY;
      if (i > 0 && tags[i].y - tags[i - 1].y < 30) tags[i - 1].y = tags[i].y - 30;
    }
    for (const t of tags) {
      const alpha = 0.4 + 0.6 * (t.b.weight / maxW);
      const col = t.b.team === 0 ? '92,225,255' : t.b.team === 1 ? '255,210,0' : '232,237,242';
      c.strokeStyle = `rgba(${col},${0.35 * alpha})`;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(tx, t.src);
      c.lineTo(g.right + 2, t.y);
      c.stroke();
      c.fillStyle = `rgba(${col},${alpha})`;
      c.beginPath();
      c.arc(tx, t.src, 2.5, 0, Math.PI * 2);
      c.fill();
      c.font = `500 10px ${FONT_UI}`;
      c.fillStyle = `rgba(185,194,206,${alpha})`;
      c.fillText(t.b.label, gx, t.y - 3);
      c.font = `700 13px ${FONT_NUM}`;
      c.fillStyle = `rgba(${col},${alpha})`;
      c.fillText(`→ ${Math.round(t.b.price)}`, gx, t.y + 11);
    }
  }

  private drawCause(c: CanvasRenderingContext2D, f: FanFrame, g: Geo, hx: number, hy: number): void {
    c.font = `500 11.5px ${FONT_UI}`;
    const text = f.cause;
    const w = Math.ceil(c.measureText(text).width) + 20;
    const h = 22;
    const x = g.left;
    const y = g.top - 6;
    c.strokeStyle = 'rgba(185,194,206,0.22)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(Math.min(x + w - 12, hx), y + h);
    c.lineTo(hx, hy - 6);
    c.stroke();
    c.fillStyle = 'rgba(14,18,23,0.94)';
    c.strokeStyle = '#232a35';
    c.beginPath();
    c.roundRect(x, y, w, h, 11);
    c.fill();
    c.stroke();
    c.fillStyle = '#b9c2ce';
    c.textAlign = 'left';
    c.fillText(text, x + 10, y + 15);
  }
}

