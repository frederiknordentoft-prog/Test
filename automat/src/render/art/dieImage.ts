// Terningen · the die artwork (the user's image, cropped and encoded by scripts/die-asset.mjs: 512 px for Pixi and
// the card medallions, 128 px for the 18–36 px DOM icons).
// Embedding follows the Polar Night pattern (audio/polar.ts): the artifact CSP forbids fetch and data:/blob: URL
// loads, so each WebP is inlined as a data-URI string (Vite `?inline`, via import.meta.glob so a missing file only
// disables the art), turned into bytes with atob and decoded with createImageBitmap(Blob): no URL is ever loaded and
// nothing depends on img-src. Decoded once at World.init; the bitmaps stay referenced by the texture source, so a
// WebGL context restore re-uploads them. Fallbacks: the violet glyph (DOM) and a procedural cube (Pixi).
import { Texture, ImageSource } from 'pixi.js';
import { gsap } from 'gsap';
import { setDiePainter, paintDieLit, fallbackPainter, dprContext, type DiePainter } from '../../ui/diceIcon.ts';

const files = import.meta.glob('./assets/terning-*.webp', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;

let big: ImageBitmap | null = null;
let small: ImageBitmap | null = null;
let loading: Promise<boolean> | null = null;
let artTex: Texture | null = null;
let cubeTex: Texture | null = null;

async function decode(uri: string | undefined): Promise<ImageBitmap | null> {
  if (!uri || typeof createImageBitmap !== 'function') return null;
  const bin = atob(uri.slice(uri.indexOf(',') + 1));
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return createImageBitmap(new Blob([u8], { type: 'image/webp' }), { premultiplyAlpha: 'premultiply' });
}

/** Decode both sizes once. Resolves false when the art is unavailable (the procedural fallbacks stay). */
export function loadDieArt(): Promise<boolean> {
  if (!loading) {
    loading = Promise.all([decode(files['./assets/terning-512.webp']), decode(files['./assets/terning-128.webp'])])
      .then(([b, s]) => {
        big = b; small = s ?? b;
        if (big) setDiePainter(drawDie); // every registered DOM icon repaints with the art
        return !!big;
      })
      .catch(() => false);
  }
  return loading;
}
export const dieArtReady = (): boolean => !!big;

/** Pixi texture of the die: the artwork (mipmapped), else a procedural isometric cube. Sprites use tint 0xe0e0e0. */
export function dieTexture(): Texture {
  if (big) {
    if (!artTex) artTex = new Texture({ source: new ImageSource({ resource: big, autoGenerateMipmaps: true, scaleMode: 'linear' }) });
    return artTex;
  }
  if (!cubeTex) {
    const cv = document.createElement('canvas');
    fallbackPainter(cv, 128, { state: 'die' });
    cubeTex = Texture.from(cv);
  }
  return cubeTex;
}

/** DOM painter (registered via setDiePainter once decoded): the bitmap at DPR with high-quality smoothing and a
 *  0,95 brightness tint; 'frozen' seals it in ice (desaturated, darker, rime and hairline frost). The socket and the
 *  glyph stay procedural. */
export const drawDie: DiePainter = (canvas, cssPx, o) => {
  if ((o.state !== 'die' && o.state !== 'frozen') || !big) { fallbackPainter(canvas, cssPx, o); return; }
  const g = dprContext(canvas, cssPx);
  if (!g) return;
  const dev = cssPx * Math.min(3, window.devicePixelRatio || 1);
  const img = dev <= 160 && small ? small : big;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, cssPx, cssPx);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(0,0,0,.05)';
  g.fillRect(0, 0, cssPx, cssPx);
  if (o.state === 'frozen') frost(g, img, cssPx);
  g.globalCompositeOperation = 'source-over';
};

/** The die sealed in ice: 72 % desaturated (a 'saturation' blend, re-clipped to the art's alpha), pushed toward a deep
 *  ice blue, a cold rime gradient and a few fixed hairline cracks (no randomness: the same die every paint). */
function frost(g: CanvasRenderingContext2D, img: ImageBitmap, s: number): void {
  g.globalCompositeOperation = 'saturation';
  g.globalAlpha = 0.72; // a ghost of its aurora stays under the ice
  g.fillStyle = '#808080';
  g.fillRect(0, 0, s, s);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in'; // the blend painted the transparent air too: clip back to the die
  g.drawImage(img, 0, 0, s, s);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(14,30,62,.46)';
  g.fillRect(0, 0, s, s);
  const rime = g.createLinearGradient(0, 0, s, s);
  rime.addColorStop(0, 'rgba(214,238,255,.34)');
  rime.addColorStop(0.45, 'rgba(214,238,255,.06)');
  rime.addColorStop(1, 'rgba(214,238,255,.22)');
  g.fillStyle = rime;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(234,248,255,.42)';
  g.lineWidth = Math.max(0.6, s / 110);
  g.lineCap = 'round';
  for (const line of CRACKS) {
    g.beginPath();
    line.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)));
    g.stroke();
  }
}
const CRACKS: [number, number][][] = [
  [[0.2, 0.3], [0.34, 0.42], [0.31, 0.55], [0.44, 0.66]],
  [[0.34, 0.42], [0.5, 0.4], [0.62, 0.28]],
  [[0.66, 0.72], [0.58, 0.6], [0.7, 0.5], [0.8, 0.52]],
  [[0.44, 0.66], [0.4, 0.78]],
];

/** One slow specular sweep over a die canvas (card medallion, hello card): a white band, 'source-atop', on the game
 *  clock. Callers skip it in calm mode. */
export function glintOnce(canvas: HTMLCanvasElement, ms = 600): void {
  const css = canvas.clientWidth || canvas.width;
  if (!css) return;
  const p = { t: 0 };
  gsap.to(p, { t: 1, duration: ms / 1000, ease: 'sine.inOut', onUpdate: () => paintDieLit(canvas, css, { state: 'die' }, p.t), onComplete: () => paintDieLit(canvas, css, { state: 'die' }, -1) });
}
