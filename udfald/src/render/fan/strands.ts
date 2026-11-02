/**
 * Strand layer: the 100 simulated futures (Lyn style: plateaus accumulate light, goal jumps are
 * faint threads) plus the tally at full time. Drawn only when a new Monte Carlo result arrives.
 */
import type { McResult } from '../../engine/mc/paths';
import type { FocusSpec } from '../../state/focus';
import { xOf, yOf, type Geo } from './geometry';

/** Strands are coloured by the stratum they were drawn for (final result, or Over / Under). */
export interface StrandOpts { burnTeam?: 0 | 1 | null; dim?: boolean; spec: FocusSpec }

export function drawStrands(canvas: HTMLCanvasElement, dpr: number, g: Geo, r: McResult | null, opts: StrandOpts): number {
  const t0 = performance.now();
  const W = Math.round(g.w * dpr);
  const H = Math.round(g.h * dpr);
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const c = canvas.getContext('2d');
  if (!c) return 0;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, g.w, g.h);
  // Grid: 0, 50, 100.
  c.strokeStyle = '#1a2029';
  c.lineWidth = 1;
  c.setLineDash([2, 4]);
  for (const p of [0, 50, 100]) {
    const yy = Math.round(yOf(g, p)) + 0.5;
    c.beginPath();
    c.moveTo(g.left, yy);
    c.lineTo(g.right, yy);
    c.stroke();
  }
  c.setLineDash([]);
  if (!r) return performance.now() - t0;

  c.globalCompositeOperation = 'lighter';
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const RGB = opts.spec.strata.map((st) => st.rgb.split(',').map(Number) as [number, number, number]);
  const jumps = RGB.map(() => new Path2D());
  const xs = new Float32Array(r.tPts.length);
  for (let k = 0; k < r.tPts.length; k++) xs[k] = xOf(g, r.tPts[k]);
  for (const s of r.strands) {
    let [cr, cg, cb] = RGB[s.stratum] ?? RGB[0];
    let alpha = opts.dim ? 0.035 : 0.11;
    if (opts.burnTeam !== undefined && opts.burnTeam !== null) {
      // Goal moment: futures whose next goal was this team's light up, the rest turn to ash.
      const saw = s.goalTeam.length > 0 && s.goalTeam[0] === opts.burnTeam;
      if (saw) {
        [cr, cg, cb] = opts.burnTeam === 0 ? [140, 236, 255] : [255, 222, 90];
        alpha = 0.3;
      } else {
        [cr, cg, cb] = [120, 120, 120];
        alpha = 0.03;
      }
    }
    c.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    c.lineWidth = 1.3;
    c.beginPath();
    let lastX = -1e9;
    for (let k = 0; k < s.v.length; k++) {
      const x = xs[k];
      const y = yOf(g, s.v[k]);
      if (k > 0 && s.d[k] !== s.d[k - 1]) {
        (jumps[s.stratum] ?? jumps[0]).moveTo(xs[k - 1], yOf(g, s.v[k - 1]));
        (jumps[s.stratum] ?? jumps[0]).lineTo(x, y);
        c.moveTo(x, y);
        lastX = x;
        continue;
      }
      if (k === 0) c.moveTo(x, y);
      else if (x - lastX >= 0.75 || k === s.v.length - 1) {
        c.lineTo(x, y);
        lastX = x;
      }
    }
    c.stroke();
  }
  c.lineWidth = 1;
  jumps.forEach((p, o) => {
    const [cr, cg, cb] = RGB[o];
    c.strokeStyle = `rgba(${cr},${cg},${cb},${opts.dim ? 0.02 : 0.07})`;
    c.stroke(p);
  });
  c.globalCompositeOperation = 'source-over';

  return performance.now() - t0;
}
