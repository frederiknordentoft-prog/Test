// Terningen · the die artwork (the user's image, cropped and encoded by scripts/die-asset.mjs: 512 px for Pixi and
// the card medallions, 128 px for the 18–36 px DOM icons).
// Embedding follows the Polar Night pattern (audio/polar.ts): the artifact CSP forbids fetch and data:/blob: URL
// loads, so each WebP is inlined as a data-URI string (Vite `?inline`, via import.meta.glob so a missing file only
// disables the art), turned into bytes with atob and decoded with createImageBitmap(Blob): no URL is ever loaded and
// nothing depends on img-src. Decoded once at World.init; the bitmaps stay referenced by the texture source, so a
// WebGL context restore re-uploads them. Fallbacks: the violet glyph (DOM) and a procedural cube (Pixi).
import { Texture, ImageSource } from 'pixi.js';
import { gsap } from 'gsap';
import { setDiePainter, paintDie, fallbackPainter, dprContext, type DiePainter } from '../../ui/diceIcon.ts';

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
 *  0,95 brightness tint; the empty socket and the glyph stay procedural. */
export const drawDie: DiePainter = (canvas, cssPx, o) => {
  if (o.state !== 'die' || !big) { fallbackPainter(canvas, cssPx, o); return; }
  const g = dprContext(canvas, cssPx);
  if (!g) return;
  const dev = cssPx * Math.min(3, window.devicePixelRatio || 1);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(dev <= 160 && small ? small : big, 0, 0, cssPx, cssPx);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(0,0,0,.05)';
  g.fillRect(0, 0, cssPx, cssPx);
  g.globalCompositeOperation = 'source-over';
};

/** One slow specular sweep over a die canvas (card medallion, hello card): a white band, 'source-atop', on the game
 *  clock. Callers skip it in calm mode. */
export function glintOnce(canvas: HTMLCanvasElement, ms = 600): void {
  const css = canvas.clientWidth || canvas.width;
  if (!css) return;
  const paint = (t: number) => {
    paintDie(canvas, css, { state: 'die' });
    if (t < 0) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const dpr = canvas.width / css;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = -0.35 + t * 1.7; // band centre along the top-left → bottom-right diagonal
    const gr = g.createLinearGradient(0, 0, css, css);
    const at = (x: number) => Math.min(1, Math.max(0, x));
    gr.addColorStop(at(c - 0.18), 'rgba(255,255,255,0)');
    gr.addColorStop(at(c), 'rgba(255,255,255,.55)');
    gr.addColorStop(at(c + 0.18), 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = gr;
    g.fillRect(0, 0, css, css);
    g.globalCompositeOperation = 'source-over';
  };
  const p = { t: 0 };
  gsap.to(p, { t: 1, duration: ms / 1000, ease: 'sine.inOut', onUpdate: () => paint(p.t), onComplete: () => paint(-1) });
}
