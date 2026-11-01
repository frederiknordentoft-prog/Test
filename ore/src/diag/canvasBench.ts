/** Cost of drawing 100 additive strands at DPR 2 and 3, and of blitting the cached layer. */
import { mulberry32 } from '../engine/lib/rng';
import { setCheck } from './store';

export async function runCanvasBench(): Promise<void> {
  setCheck('canvas', { status: 'afventer', detail: 'Måler …' });
  await new Promise((r) => setTimeout(r, 50));
  const rnd = mulberry32(7);
  const W = 358;
  const H = 300;
  const strands = Array.from({ length: 100 }, () => {
    let v = 50;
    return Array.from({ length: 240 }, (_, i) => {
      if (rnd() < 0.01) v += rnd() < 0.5 ? 20 : -20;
      v = Math.max(0, Math.min(100, v + (rnd() - 0.5) * 0.6));
      return [(i / 239) * W, H - (v / 100) * H] as const;
    });
  });
  const res: Record<string, number> = {};
  for (const dpr of [2, 3]) {
    const cv = document.createElement('canvas');
    cv.width = W * dpr;
    cv.height = H * dpr;
    const c = cv.getContext('2d');
    if (!c) continue;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t0 = performance.now();
    const reps = 10;
    for (let r = 0; r < reps; r++) {
      c.clearRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(92,225,255,0.1)';
      for (const s of strands) {
        c.beginPath();
        s.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.stroke();
      }
      c.getImageData(0, 0, 1, 1); // force the GPU/raster work to finish
    }
    res[`strands@${dpr}x`] = (performance.now() - t0) / reps;
    const out = document.createElement('canvas');
    out.width = cv.width;
    out.height = cv.height;
    const o = out.getContext('2d');
    if (!o) continue;
    const t1 = performance.now();
    for (let r = 0; r < 60; r++) {
      o.clearRect(0, 0, out.width, out.height);
      o.drawImage(cv, 0, 0);
    }
    o.getImageData(0, 0, 1, 1);
    res[`blit@${dpr}x`] = (performance.now() - t1) / 60;
  }
  const worst = res['strands@3x'] ?? res['strands@2x'] ?? 99;
  setCheck('canvas', {
    status: (res['blit@2x'] ?? 99) < 2 && worst < 40 ? 'ok' : 'advarsel',
    detail: Object.entries(res).map(([k, v]) => `${k} ${v.toFixed(1)} ms`).join(' · '),
    data: res,
  });
}
