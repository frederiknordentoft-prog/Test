// Small canvas-generated helper textures (made once).
import { Texture } from 'pixi.js';

const cache = new Map<string, Texture>();
function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const c = cache.get(key);
  if (c) return c;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = Texture.from(cv);
  cache.set(key, t);
  return t;
}

/** Soft vertical band (for glints / sweeps), white, transparent edges. */
export const softBand = () => make('band', 128, 8, (g) => {
  const gr = g.createLinearGradient(0, 0, 128, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.5, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 8);
});

/** Radial soft glow, white centre. */
export const softDot = () => make('dot', 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});

/** Horizontal soft gradient fading downwards (vignette strips, beams). */
export const softFadeV = () => make('fadeV', 8, 128, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
});
