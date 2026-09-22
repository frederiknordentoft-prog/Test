// Kp arc: the charge meter drawn as a gently curved aurora band above the grid.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { softDot } from '../tex.ts';
import { PAL } from '../../core/palette.ts';

const SEG_COLORS = [PAL.green, PAL.green, PAL.teal, PAL.teal, PAL.violet, PAL.violet, PAL.redTop, PAL.redTop, PAL.crimson];

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export class KpArc extends Container {
  private track = new Graphics();
  private fill = new Graphics();
  private glow = new Graphics();
  private head = new Sprite(softDot());
  private halo = new Sprite(softDot());
  private labels: Text[] = [];
  private lockLabel: Text;
  private cx = 0;
  private cy = 0;
  private R = 400;
  private a0 = 0;
  private a1 = 0;
  private thick = 8;
  kp = 0;
  private drawnKp = -1;
  pulse = 0;
  storm = 0;

  constructor() {
    super();
    this.glow.blendMode = 'add';
    this.head.anchor.set(0.5); this.head.blendMode = 'add';
    this.halo.anchor.set(0.5); this.halo.blendMode = 'add'; this.halo.alpha = 0.25;
    this.addChild(this.track, this.glow, this.fill, this.halo, this.head);
    for (let g = 1; g <= 5; g++) {
      const t = new Text({ text: 'G' + g, style: { fontFamily: 'system-ui, sans-serif', fontSize: 10, fontWeight: '700', fill: 0x9cc9ff, letterSpacing: 1 } });
      t.anchor.set(0.5); t.alpha = 0.55;
      this.labels.push(t); this.addChild(t);
    }
    this.lockLabel = new Text({ text: 'SOLSTORM', style: { fontFamily: 'system-ui, sans-serif', fontSize: 10, fontWeight: '800', fill: 0xff6a7a, letterSpacing: 2 } });
    this.lockLabel.anchor.set(1, 0.5); this.lockLabel.alpha = 0.6;
    this.addChild(this.lockLabel);
  }

  layout(x: number, y: number, w: number, h: number): void {
    this.position.set(x, y);
    const span = Math.min(w * 0.86, 560);
    const compact = h < 60;
    this.thick = compact ? 5 : 8;
    // Circle through the endpoints with a sagitta that gives a gentle curve.
    const sag = compact ? 4 : Math.min(h * 0.42, 34);
    const half = span / 2;
    this.R = (half * half + sag * sag) / (2 * sag);
    this.cx = w / 2;
    const top = compact ? h * 0.45 : h * 0.3;
    this.cy = top + this.R;
    const ang = Math.asin(half / this.R);
    this.a0 = -Math.PI / 2 - ang;
    this.a1 = -Math.PI / 2 + ang;
    this.head.width = this.head.height = this.thick * 5;
    this.halo.width = this.halo.height = this.thick * 12;
    const fs = compact ? 9 : 10;
    for (let g = 0; g < 5; g++) {
      const segMid = this.segAngle(4 + g + 0.5);
      const r = this.R + this.thick * 1.6 + (compact ? 3 : 6);
      this.labels[g].style.fontSize = fs;
      this.labels[g].position.set(this.cx + Math.cos(segMid) * r, this.cy + Math.sin(segMid) * r);
      this.labels[g].visible = !compact;
    }
    const endA = this.a1;
    this.lockLabel.style.fontSize = fs;
    this.lockLabel.position.set(this.cx + Math.cos(endA) * this.R, this.cy + Math.sin(endA) * this.R - this.thick * 2.2 - (compact ? 0 : 8));
    this.lockLabel.visible = !compact;
    this.drawnKp = -1;
    this.redraw();
  }

  private segAngle(s: number): number { return this.a0 + (this.a1 - this.a0) * (s / 9); }

  /** Global position of the fill head (mote target). */
  headGlobal(): { x: number; y: number } {
    const p = this.toGlobal(this.head.position);
    return { x: p.x, y: p.y };
  }

  setKp(kp: number): void {
    this.kp = Math.max(0, Math.min(9, kp));
    if (Math.abs(this.kp - this.drawnKp) > 0.002) this.redraw();
  }

  private arcPath(g: Graphics, from: number, to: number, r: number): void {
    const a = this.segAngle(from), b = this.segAngle(to);
    g.moveTo(this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r);
    g.arc(this.cx, this.cy, r, a, b);
  }

  private redraw(): void {
    this.drawnKp = this.kp;
    const gap = 0.045;
    const t = this.thick;
    this.track.clear();
    for (let s = 0; s < 9; s++) {
      this.arcPath(this.track, s + gap, s + 1 - gap, this.R);
      this.track.stroke({ width: t, color: s === 8 ? 0x5a1020 : 0x9cc9ff, alpha: s === 8 ? 0.55 : 0.13, cap: 'round' });
    }
    this.fill.clear();
    this.glow.clear();
    const k = this.kp;
    for (let s = 0; s < 9; s++) {
      const f = Math.max(0, Math.min(1, k - s));
      if (f <= 0) break;
      const c = lerpColor(SEG_COLORS[s], PAL.crimson, this.storm);
      this.arcPath(this.fill, s + gap, s + gap + (1 - 2 * gap) * f, this.R);
      this.fill.stroke({ width: t, color: c, alpha: 1, cap: 'round' });
      this.arcPath(this.glow, s + gap, s + gap + (1 - 2 * gap) * f, this.R);
      this.glow.stroke({ width: t * 3.2, color: c, alpha: 0.22, cap: 'round' });
    }
    const ha = this.segAngle(Math.min(9, k));
    this.head.position.set(this.cx + Math.cos(ha) * this.R, this.cy + Math.sin(ha) * this.R);
    this.halo.position.copyFrom(this.head.position);
    const seg = Math.min(8, Math.floor(k));
    this.head.tint = lerpColor(SEG_COLORS[seg], 0xffffff, 0.45);
    this.halo.tint = SEG_COLORS[seg];
    this.head.visible = this.halo.visible = k > 0.01;
    for (let g = 0; g < 5; g++) this.labels[g].alpha = k >= 5 + g ? 1 : 0.45;
    this.lockLabel.alpha = k >= 8 ? 1 : 0.55;
  }

  /** Per-frame: breathing head + pulse decay. */
  update(dt: number, time: number): void {
    this.pulse = Math.max(0, this.pulse - dt * 2.5);
    const b = 0.85 + 0.15 * Math.sin(time * 3.1) + this.pulse * 0.8;
    this.head.alpha = Math.min(1, b);
    this.halo.alpha = 0.18 + 0.12 * Math.sin(time * 1.7) + this.pulse * 0.5;
    this.lockLabel.alpha = this.kp >= 8 ? 0.75 + 0.25 * Math.sin(time * 6) : this.lockLabel.alpha;
  }
}
