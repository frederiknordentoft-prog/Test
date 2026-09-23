// Die icon painter for DOM canvases (the niche, card medallions, menu/history icons, the flight).
// The user's die artwork (render/art/dieImage.ts drawDie) is registered via setDiePainter() once its bitmap has
// decoded; the procedural painter below (socket hexagon / isometric cube / glyph) is the decode-failure fallback only.
// 'frozen' = the die sealed in ice (the niche at 0 dice): the art desaturated and frosted (fallback: the socket).
export type DieState = 'socket' | 'die' | 'glyph' | 'frozen';
export type DiePainter = (canvas: HTMLCanvasElement, cssPx: number, o: { state: DieState; ring?: boolean }) => void;

/** Sizes the canvas backing store for the device pixel ratio and returns a context in CSS px. */
export function dprContext(canvas: HTMLCanvasElement, cssPx: number): CanvasRenderingContext2D | null {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const px = Math.max(1, Math.round(cssPx * dpr));
  if (canvas.width !== px || canvas.height !== px) { canvas.width = px; canvas.height = px; }
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cssPx, cssPx);
  return g;
}

/** Isometric-cube hexagon (pointy top) inside a cssPx square. */
function hex(s: number): { c: [number, number]; v: [number, number][] } {
  const cx = s / 2, cy = s / 2, r = s * 0.44;
  const v: [number, number][] = [];
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 3; v.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return { c: [cx, cy], v };
}

/** Procedural painter: the empty socket, the violet glyph and an isometric cube (the art's decode fallback). */
export const fallbackPainter: DiePainter = (canvas, cssPx, o) => {
  const g = dprContext(canvas, cssPx);
  if (!g) return;
  const { c, v } = hex(cssPx);
  const path = () => { g.beginPath(); v.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  if (o.state === 'socket' || o.state === 'frozen') {
    // empty socket: outline at 45 %, the three inner edges at 25 % (the art is saved for the first find)
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(156,201,255,.45)'; path(); g.stroke();
    g.strokeStyle = 'rgba(156,201,255,.25)'; g.beginPath();
    for (const i of [1, 3, 5]) { g.moveTo(c[0], c[1]); g.lineTo(v[i][0], v[i][1]); }
    g.stroke();
    return;
  }
  if (o.state === 'glyph') { g.fillStyle = 'rgba(138,92,255,.5)'; path(); g.fill(); return; }
  // procedural die: three faces teal / violet / magenta at α .7 with a 1 px ice edge
  const face = (a: number, b: number, col: string) => {
    g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(v[a][0], v[a][1]); g.lineTo(v[(a + 1) % 6][0], v[(a + 1) % 6][1]); g.lineTo(v[b][0], v[b][1]); g.closePath();
    g.fillStyle = col; g.fill();
  };
  g.globalAlpha = 0.7;
  face(5, 1, '#19e3d6'); // top
  face(1, 3, '#8a5cff'); // right
  face(3, 5, '#ff2bd6'); // left
  g.globalAlpha = 1;
  g.lineWidth = 1; g.strokeStyle = 'rgba(234,248,255,.85)'; path(); g.stroke();
  g.beginPath(); for (const i of [1, 3, 5]) { g.moveTo(c[0], c[1]); g.lineTo(v[i][0], v[i][1]); } g.strokeStyle = 'rgba(234,248,255,.45)'; g.stroke();
  // pips: one on each face, small and white (reads as a die at 18 px)
  g.fillStyle = 'rgba(255,255,255,.9)';
  for (const [a, b] of [[5, 1], [1, 3], [3, 5]] as const) {
    const x = (c[0] + v[a][0] + v[(a + 1) % 6][0] + v[b][0]) / 4, y = (c[1] + v[a][1] + v[(a + 1) % 6][1] + v[b][1]) / 4;
    g.beginPath(); g.arc(x, y, Math.max(0.8, cssPx * 0.045), 0, Math.PI * 2); g.fill();
  }
};

let painter: DiePainter = fallbackPainter;
const listeners = new Set<() => void>();
export function paintDie(canvas: HTMLCanvasElement, cssPx: number, o: { state: DieState; ring?: boolean }): void {
  try { painter(canvas, cssPx, o); } catch { fallbackPainter(canvas, cssPx, { ...o, state: o.state === 'die' ? 'glyph' : o.state }); }
}
/** The die with a specular band over it (a glint frame): `t` 0..1 moves the band across the die along `angle`
 *  (radians; 0.785 = top-left → bottom-right), drawn 'source-atop' so it lights the art only, never the air around it. */
export function paintDieLit(canvas: HTMLCanvasElement, cssPx: number, o: { state: DieState }, t: number, angle = Math.PI / 4, a = 0.55): void {
  paintDie(canvas, cssPx, o);
  if (t < 0 || t > 1) return;
  const g = canvas.getContext('2d');
  if (!g) return;
  const dpr = canvas.width / cssPx;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = cssPx / 2, r = cssPx * 0.72, dx = Math.cos(angle) * r, dy = Math.sin(angle) * r;
  const gr = g.createLinearGradient(c - dx, c - dy, c + dx, c + dy);
  const at = (x: number) => Math.min(1, Math.max(0, x));
  const p = -0.2 + t * 1.4, w = 0.13;
  gr.addColorStop(at(p - w), 'rgba(255,255,255,0)');
  gr.addColorStop(at(p - w * 0.25), `rgba(255,255,255,${a * 0.8})`);
  gr.addColorStop(at(p), `rgba(255,255,255,${a})`);
  gr.addColorStop(at(p + w), 'rgba(255,255,255,0)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = gr;
  g.fillRect(0, 0, cssPx, cssPx);
  g.globalCompositeOperation = 'source-over';
}
/** Paint every `canvas.die-ico` under `root` with the die art at its CSS size (menu, history, card rows, banner).
 *  `data-state="frozen"` paints the sealed die. Canvases not laid out yet (0 px) are skipped. */
export function paintDieIcons(root: ParentNode): void {
  for (const c of Array.from(root.querySelectorAll<HTMLCanvasElement>('canvas.die-ico'))) {
    const px = c.clientWidth;
    if (px > 0) paintDie(c, px, { state: c.dataset.state === 'frozen' ? 'frozen' : 'die' });
  }
}
/** Swap the painter (e.g. the decoded die artwork); every registered canvas repaints. */
export function setDiePainter(p: DiePainter): void { painter = p; listeners.forEach((f) => f()); }
export function onDiePainterChange(f: () => void): () => void { listeners.add(f); return () => listeners.delete(f); }
