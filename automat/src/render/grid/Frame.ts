// Ice-glass cabinet frame (base) / molten obsidian frame (storm). Back plate + front rim.
import { Container, Graphics, FillGradient, Sprite } from 'pixi.js';
import { PAL } from '../../core/palette.ts';
import { softDot } from '../tex.ts';

export class Frame {
  readonly back = new Container();
  readonly front = new Container();
  private plate = new Graphics();
  private glowG = new Graphics();
  private rim = new Graphics();
  private orn = new Graphics();
  private cracks = new Graphics();
  private corners: Sprite[] = [];
  private x = 0; private y = 0; private s = 300; private r = 22;
  storm = false;
  crackle = 0;
  private crackSeed: number[] = [];

  constructor() {
    this.glowG.blendMode = 'add';
    this.cracks.blendMode = 'add';
    this.back.addChild(this.glowG, this.plate);
    this.front.addChild(this.rim, this.cracks, this.orn);
    for (let i = 0; i < 4; i++) {
      const c = new Sprite(softDot()); c.anchor.set(0.5); c.blendMode = 'add'; c.alpha = 0.5;
      this.corners.push(c); this.front.addChild(c);
    }
    for (let i = 0; i < 64; i++) this.crackSeed.push(((i * 2654435761) >>> 0) / 4294967296);
  }

  layout(x: number, y: number, size: number, storm: boolean): void {
    this.x = x; this.y = y; this.s = size; this.storm = storm;
    this.r = Math.max(10, Math.min(26, size * 0.055));
    this.draw();
  }

  setStorm(b: boolean): void { this.storm = b; this.draw(); }

  private draw(): void {
    const { x, y, s, r } = this;
    const pad = Math.max(6, s * 0.022);
    const X = x - pad, Y = y - pad, S = s + pad * 2;
    const st = this.storm;
    // glow (tinted per Kp at runtime)
    this.glowG.clear();
    for (const [w, a] of [[26, 0.035], [16, 0.06], [9, 0.1], [4, 0.2]] as const) {
      this.glowG.roundRect(X, Y, S, S, r + 2).stroke({ width: w, color: 0xffffff, alpha: a });
    }
    // plate
    const plateGrad = new FillGradient({
      type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: st
        ? [{ offset: 0, color: 'rgba(40,6,10,0.78)' }, { offset: 1, color: 'rgba(14,2,4,0.86)' }]
        : [{ offset: 0, color: 'rgba(12,28,60,0.60)' }, { offset: 0.55, color: 'rgba(6,14,32,0.62)' }, { offset: 1, color: 'rgba(4,9,22,0.74)' }],
    });
    this.plate.clear().roundRect(X, Y, S, S, r).fill(plateGrad);
    // rim
    const rimGrad = new FillGradient({
      type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, textureSpace: 'local',
      colorStops: st
        ? [{ offset: 0, color: '#FFF4E0' }, { offset: 0.25, color: '#FF6A00' }, { offset: 0.6, color: '#FF1E3C' }, { offset: 1, color: '#5A0012' }]
        : [{ offset: 0, color: '#FFFFFF' }, { offset: 0.2, color: '#CFEFFF' }, { offset: 0.55, color: '#5E8FC8' }, { offset: 1, color: '#9CC9FF' }],
    });
    this.rim.clear()
      .roundRect(X, Y, S, S, r).stroke({ width: st ? 3 : 2, fill: rimGrad, alpha: 0.95 })
      .roundRect(X + 4, Y + 4, S - 8, S - 8, Math.max(4, r - 4)).stroke({ width: 1, color: st ? 0xffb08a : 0xeaf8ff, alpha: 0.22 });
    // top sheen
    this.rim.moveTo(X + r, Y + 1.5).lineTo(X + S * 0.55, Y + 1.5).stroke({ width: 1.5, color: 0xffffff, alpha: st ? 0.3 : 0.55, cap: 'round' });
    // corner ornaments: small cut-crystal diamonds
    this.orn.clear();
    const d = Math.max(4, pad * 0.9);
    const pts: [number, number][] = [[X + r * 0.3, Y + r * 0.3], [X + S - r * 0.3, Y + r * 0.3], [X + r * 0.3, Y + S - r * 0.3], [X + S - r * 0.3, Y + S - r * 0.3]];
    pts.forEach(([cx, cy], i) => {
      this.orn.poly([cx, cy - d, cx + d * 0.62, cy, cx, cy + d, cx - d * 0.62, cy]).fill({ color: st ? PAL.whiteHot : 0xeaf8ff, alpha: 0.9 });
      this.orn.poly([cx, cy - d, cx + d * 0.62, cy, cx, cy]).fill({ color: 0xffffff, alpha: 0.6 });
      const c = this.corners[i]; c.position.set(cx, cy); c.width = c.height = d * 7; c.tint = st ? PAL.molten : PAL.frost;
    });
    this.drawCracks();
  }

  private drawCracks(): void {
    this.cracks.clear();
    if (this.crackle <= 0.01) return;
    const { x, y, s } = this;
    const n = Math.floor(6 + this.crackle * 18);
    for (let i = 0; i < n; i++) {
      const u = this.crackSeed[i % 64], v = this.crackSeed[(i * 7 + 3) % 64];
      const side = i % 4;
      let px = side === 0 ? x + u * s : side === 1 ? x + s : side === 2 ? x + u * s : x;
      let py = side === 0 ? y : side === 1 ? y + u * s : side === 2 ? y + s : y + u * s;
      this.cracks.moveTo(px, py);
      const segs = 3 + Math.floor(v * 4);
      for (let k = 0; k < segs; k++) {
        const ang = (side * Math.PI) / 2 + Math.PI / 2 + (this.crackSeed[(i + k * 13) % 64] - 0.5) * 1.6;
        const len = (6 + v * 14) * (1 - k / segs);
        px += Math.cos(ang) * len; py += Math.sin(ang) * len;
        this.cracks.lineTo(px, py);
      }
      this.cracks.stroke({ width: 1, color: this.storm ? 0xffd0a0 : 0xff2bd6, alpha: 0.35 + 0.5 * this.crackle });
    }
  }

  setCrackle(c: number): void {
    if (Math.abs(c - this.crackle) < 0.02) return;
    this.crackle = c;
    this.drawCracks();
  }

  /** Per frame: tint glow to the aurora, breathe. */
  update(time: number, tint: number, energy: number): void {
    this.glowG.tint = tint;
    this.glowG.alpha = 0.55 + 0.25 * energy + 0.08 * Math.sin(time * 1.3);
    for (let i = 0; i < 4; i++) this.corners[i].alpha = 0.35 + 0.25 * Math.sin(time * 2 + i * 1.7) + energy * 0.2;
    this.cracks.alpha = 0.6 + 0.4 * Math.sin(time * 23) * this.crackle;
  }

  set visible(b: boolean) { this.back.visible = b; this.front.visible = b; }
  set alpha(a: number) { this.back.alpha = a; this.front.alpha = a; }
  get alpha(): number { return this.back.alpha; }
}
