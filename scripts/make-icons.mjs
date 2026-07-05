// Generates public/icons/icon-192.png and icon-512.png (dark tunnel + smoke lines + body).
// Minimal PNG encoder — no image deps needed. Run once: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const put = (x, y, r, g, b, a = 1) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const sa = a, da = px[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / (oa || 1));
    px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / (oa || 1));
    px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / (oa || 1));
    px[i + 3] = Math.round(oa * 255);
  };
  // background with rounded corners
  const rad = size * 0.22;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const cx = Math.max(rad - x, x - (size - 1 - rad), 0);
      const cy = Math.max(rad - y, y - (size - 1 - rad), 0);
      if (Math.hypot(cx, cy) <= rad) put(x, y, 11, 14, 20);
    }
  // smoke streaklines bending around a body
  const body = { x: size * 0.72, y: size * 0.5, r: size * 0.115 };
  const lines = 5;
  for (let l = 0; l < lines; l++) {
    const y0 = size * (0.28 + (0.44 * l) / (lines - 1));
    for (let t = 0; t < 1; t += 0.002) {
      const x = size * 0.1 + t * size * 0.62;
      const dx = x - body.x, dy0 = y0 - body.y;
      const d = Math.hypot(dx, dy0);
      const push = Math.max(0, 1 - d / (body.r * 3.2)) * body.r * 1.5 * Math.sign(dy0 || 1);
      const y = y0 + push * Math.exp(-Math.abs(dx) / (body.r * 2));
      const glow = l === Math.floor(lines / 2) ? [56, 189, 248] : [125, 211, 252];
      const wpx = Math.max(1, Math.round(size * 0.02));
      for (let o = -wpx; o <= wpx; o++) put(Math.round(x), Math.round(y) + o, ...glow, 0.85 * (1 - Math.abs(o) / (wpx + 1)));
    }
  }
  // the body
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - body.x, y - body.y);
      if (d <= body.r) put(x, y, 248, 250, 252);
      else if (d <= body.r + size * 0.008) put(x, y, 125, 211, 252, 0.6);
    }
  return encodePNG(size, size, px);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', drawIcon(192));
writeFileSync('public/icons/icon-512.png', drawIcon(512));
console.log('icons written');
