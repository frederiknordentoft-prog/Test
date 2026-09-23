// Terningen · die artwork → the two embedded WebP files (no new dependencies: the repo's playwright-core drives
// headless Chromium, whose Canvas2D does the crop, the resample and the WebP encode).
// Usage: node scripts/die-asset.mjs   (source: assets-src/terning.png, the user's artwork, committed for provenance)
// 1. createImageBitmap from the PNG bytes · 2. alpha > 8 bounds · 3. square crop, side = max(w, h) × 1.04 around the
// bounds' centre (the 4 % pad keeps the neon edge glow) · 4. resample (imageSmoothingQuality 'high') ·
// 5. OffscreenCanvas.convertToBlob('image/webp', 0.85) → src/render/art/assets/terning-512.webp (Pixi sprites, the
// 88 px card medallion at DPR 3) and terning-128.webp (the 18–36 px DOM icons at DPR ≤ 3).
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'assets-src/terning.png';
const OUT = 'src/render/art/assets';
const SIZES = [{ px: 512, max: 110 }, { px: 128, max: 16 }]; // KB limits: the script fails above them

const png = readFileSync(SRC).toString('base64');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
const out = await page.evaluate(async ([b64, sizes]) => {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const bmp = await createImageBitmap(new Blob([u8], { type: 'image/png' }));
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext('2d');
  g.drawImage(bmp, 0, 0);
  const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < bmp.height; y++) for (let x = 0; x < bmp.width; x++) {
    if (d[(y * bmp.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const side = Math.round(Math.max(bw, bh) * 1.04);
  const sx = (x0 + x1 + 1) / 2 - side / 2, sy = (y0 + y1 + 1) / 2 - side / 2;
  const files = [];
  for (const { px } of sizes) {
    const o = new OffscreenCanvas(px, px);
    const q = o.getContext('2d');
    q.imageSmoothingEnabled = true;
    q.imageSmoothingQuality = 'high';
    q.drawImage(bmp, sx, sy, side, side, 0, 0, px, px);
    const blob = await o.convertToBlob({ type: 'image/webp', quality: 0.85 });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    files.push({ px, b64: btoa(s), bytes: buf.length });
  }
  return { w: bmp.width, h: bmp.height, bounds: [x0, y0, x1, y1], bw, bh, side, files };
}, [png, SIZES]);
await browser.close();

mkdirSync(OUT, { recursive: true });
console.log(`source ${out.w}×${out.h} · alpha>8 bounds (${out.bounds[0]},${out.bounds[1]}) → (${out.bounds[2]},${out.bounds[3]}) = ${out.bw}×${out.bh} · square crop ${out.side}`);
let bad = false;
for (const f of out.files) {
  const file = `${OUT}/terning-${f.px}.webp`;
  writeFileSync(file, Buffer.from(f.b64, 'base64'));
  const kb = f.bytes / 1024, max = SIZES.find((s) => s.px === f.px).max;
  console.log(`${file}: ${kb.toFixed(1)} KB (≈ ${((f.b64.length) / 1024).toFixed(1)} KB as base64)${kb > max ? ` — OVER ${max} KB` : ''}`);
  if (kb > max) bad = true;
}
process.exit(bad ? 1 : 0);
