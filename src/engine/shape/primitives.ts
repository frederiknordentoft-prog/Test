// Shape primitives generated as closed CCW polygons in tunnel coords, centered on a point.

import type { ShapeKind, ShapeSpec } from '../types';

const DEFAULT_CENTER: [number, number] = [0.7, 0.5];
// Half-height-ish scale in tunnel units. Kept small enough that primitives block
// ~15-21% of the tunnel height — large blockage squeezes the flow and inflates Cd.
const SIZE = 0.11;

export function makePrimitive(kind: Exclude<ShapeKind, 'freehand'>, center: [number, number] = DEFAULT_CENTER): ShapeSpec {
  const pts: number[] = [];
  const [cx, cy] = center;
  switch (kind) {
    case 'circle': {
      const r = SIZE * 0.75;
      const n = 48;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      break;
    }
    case 'square': {
      const h = SIZE * 0.7;
      pts.push(cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h);
      break;
    }
    case 'plate': {
      // Flat plate facing the wind: tall and thin, built-in thickness.
      const halfH = SIZE * 0.95;
      const halfT = 0.022;
      pts.push(cx - halfT, cy - halfH, cx + halfT, cy - halfH, cx + halfT, cy + halfH, cx - halfT, cy + halfH);
      break;
    }
    case 'teardrop': {
      // Streamlined symmetric teardrop: round nose left, tapering tail right.
      // Same frontal height as the plate (2*SIZE*0.95 ≈ plate) for honest comparison.
      const halfH = SIZE * 0.95;
      const len = halfH * 7.5; // slender (~3.75:1 chord/height) — real streamlined bodies are ~4:1
      const n = 36;
      // top surface nose→tail, then bottom tail→nose (CCW with y up: go bottom first)
      const upper: number[] = [];
      const lower: number[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n; // 0 nose, 1 tail
        const x = cx - len * 0.35 + len * t;
        // NACA 4-digit half-thickness profile (max 0.5 at t≈0.3), normalized so max = halfH
        const poly = 1.4845 * Math.sqrt(t) - 0.63 * t - 1.758 * t * t + 1.4215 * t * t * t - 0.5075 * t * t * t * t;
        const y = halfH * Math.max(0, poly) / 0.5;
        upper.push(x, cy + y);
        lower.push(x, cy - y);
      }
      // CCW: lower nose→tail, then upper tail→nose (skip duplicated nose/tail points)
      for (let i = 0; i <= n; i++) pts.push(lower[i * 2], lower[i * 2 + 1]);
      for (let i = n - 1; i >= 1; i--) pts.push(upper[i * 2], upper[i * 2 + 1]);
      break;
    }
  }
  return { points: new Float32Array(pts), kind, pivot: center };
}
