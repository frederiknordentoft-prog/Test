// Tegner spillets app-ikon som procedural pixel-art (garagen med en guldkupon foran) og skriver PNG'erne til public/.
// Ingen eksterne assets og ingen afhængigheder: en lille PNG-encoder med node:zlib.
//   npm run ikoner
// Skriver: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png (180) og favicon.png (32).
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const N = 32; // designet tegnes på et 32×32-gitter og skaleres med nearest-neighbor

// Farver fra paletten i src/index.css (+ garagens varme toner fra akt-chromen)
const F = {
  bg: '#171a2b',
  line: '#0b0c16',
  ink: '#f3efe2',
  dim: '#6d7299',
  cyan: '#4ee6d8',
  gold: '#ffd23f',
  guldLys: '#fff1a8',
  guldSkygge: '#c9921a',
  tag: '#c0563b',
  tagLys: '#e07a4f',
  tagSkygge: '#8a3a2a',
  mur: '#5c4a3e',
  murSkygge: '#4a3a30',
  tagskaeg: '#2e2520',
  port: '#c7cbe0',
  portSkygge: '#8e93b8',
  lys: '#ffb347',
  lysKant: '#ffc56b',
  lysSkygge: '#b86a2a',
  jord: '#252a42',
  jordKant: '#30365a',
  indkoersel: '#3a2f2a',
  spild: '#6b4a32',
  spildSvag: '#4d3a30',
  stjerne: '#b8432f',
};

/** Et lag er et 32×32-gitter af farver (null = gennemsigtigt) */
const nytLag = () => Array.from({ length: N }, () => Array(N).fill(null));
const px = (lag, x, y, c) => {
  if (x >= 0 && y >= 0 && x < N && y < N) lag[y][x] = c;
};
const rekt = (lag, x0, y0, x1, y1, c) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(lag, x, y, c);
};
/** Lille sprite: '#' = farve, alt andet springes over */
const sprite = (lag, x0, y0, rows, c) =>
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && px(lag, x0 + x, y0 + y, c)));

// ---------- Baggrund: nattehimmel og jord (forlænges ud til kanten på de fuldt dækkende ikoner) ----------
const baggrund = nytLag();
rekt(baggrund, 0, 0, N - 1, 25, F.bg);
rekt(baggrund, 0, 26, N - 1, 26, F.jordKant);
rekt(baggrund, 0, 27, N - 1, N - 1, F.jord);

// ---------- Forgrund ----------
const scene = nytLag();
// Stjerner (faste pladser — kosmetisk, ingen tilfældighed)
for (const [x, y, c] of [
  [3, 2, F.ink], [9, 3, F.cyan], [21, 1, F.ink], [27, 3, F.cyan], [1, 8, F.dim], [30, 8, F.ink], [25, 6, F.dim], [6, 6, F.dim], [14, 1, F.dim],
]) px(scene, x, y, c);

// Indkørsel med varmt lys fra porten
for (let y = 26; y < N; y++) {
  const ud = y - 26;
  rekt(scene, 9 - ud, y, 22 + ud, y, F.indkoersel);
}
rekt(scene, 9, 26, 22, 27, F.spild);
rekt(scene, 10, 28, 21, 28, F.spildSvag);

// Murene
rekt(scene, 5, 11, 26, 25, F.mur);
rekt(scene, 23, 11, 25, 25, F.murSkygge);
rekt(scene, 5, 11, 5, 25, F.line);
rekt(scene, 26, 11, 26, 25, F.line);
rekt(scene, 6, 11, 25, 11, F.tagskaeg); // skygge under tagskægget
// Et par mursten, der stikker frem
for (const [x, y] of [[7, 14], [6, 19], [7, 22], [24, 15], [25, 20]]) px(scene, x, y, F.murSkygge);

// Taget: sadeltag i trin på 2 px med mørk kant, lys venstreside og skygget højreside
const tagRaekker = [
  [4, 15, 16],
  [5, 13, 18],
  [6, 11, 20],
  [7, 9, 22],
  [8, 7, 24],
  [9, 5, 26],
];
for (const [y, x0, x1] of tagRaekker) {
  rekt(scene, x0, y, x1, y, F.tag);
  px(scene, x0, y, F.line);
  px(scene, x0 + 1, y, F.line);
  px(scene, x1, y, F.line);
  px(scene, x1 - 1, y, F.line);
  if (x1 - x0 >= 5) {
    px(scene, x0 + 2, y, F.tagLys);
    px(scene, x0 + 3, y, F.tagLys);
    px(scene, x1 - 2, y, F.tagSkygge);
    px(scene, x1 - 3, y, F.tagSkygge);
  }
}
rekt(scene, 3, 10, 28, 10, F.line); // tagskæg
rekt(scene, 9, 8, 22, 8, F.tagSkygge); // tagstensrække
px(scene, 9, 8, F.tagLys);
px(scene, 10, 8, F.tagLys);
rekt(scene, 7, 8, 8, 8, F.line);
rekt(scene, 23, 8, 24, 8, F.line);
// Oplyst gavlvindue
rekt(scene, 14, 5, 17, 8, F.line);
rekt(scene, 15, 6, 16, 7, F.lys);

// Garageporten: halvt oppe, varmt lys og en skærm derinde (her startede det hele)
rekt(scene, 8, 13, 23, 25, F.line);
rekt(scene, 9, 14, 22, 18, F.port);
rekt(scene, 9, 15, 22, 15, F.portSkygge);
rekt(scene, 9, 17, 22, 17, F.portSkygge);
rekt(scene, 15, 18, 16, 18, F.line); // håndtag
rekt(scene, 9, 19, 22, 19, F.lysSkygge);
rekt(scene, 9, 20, 22, 25, F.lys);
rekt(scene, 9, 25, 22, 25, F.lysKant);
rekt(scene, 10, 20, 15, 23, F.line); // skærm
rekt(scene, 11, 21, 14, 22, F.cyan);
px(scene, 11, 21, F.ink);
rekt(scene, 10, 24, 17, 24, F.tagskaeg); // bord
px(scene, 10, 25, F.tagskaeg);
px(scene, 17, 25, F.tagskaeg);

// Guldkuponen foran porten: billet med hakker i siderne, perforering og en stjerne (venstre kant i x = K)
const K = 16;
const kupon = nytLag();
rekt(kupon, K, 21, K + 13, 29, F.line);
rekt(kupon, K + 1, 22, K + 12, 28, F.gold);
rekt(kupon, K + 1, 22, K + 11, 22, F.guldLys);
rekt(kupon, K + 1, 22, K + 1, 24, F.guldLys);
rekt(kupon, K + 12, 22, K + 12, 28, F.guldSkygge);
rekt(kupon, K + 1, 28, K + 12, 28, F.guldSkygge);
for (const y of [23, 25, 27]) px(kupon, K + 4, y, F.guldSkygge); // perforering
sprite(kupon, K + 6, 23, ['..#..', '.###.', '#####', '.###.', '.#.#.'], F.stjerne);
// Hakker: gennemsigtige huller (scenen bag kuponen ses) med ny kant
for (const [x, y] of [[K, 24], [K, 25], [K, 26], [K + 1, 25], [K + 13, 24], [K + 13, 25], [K + 13, 26], [K + 12, 25]]) kupon[y][x] = null;
for (const [x, y] of [[K + 1, 24], [K + 1, 26], [K + 2, 25], [K + 12, 24], [K + 12, 26], [K + 11, 25]]) px(kupon, x, y, F.line);
// Lille slagskygge under og til højre for kuponen
rekt(scene, K + 1, 30, K + 14, 30, F.line);
rekt(scene, K + 14, 22, K + 14, 30, F.line);

// ---------- Sammensætning ----------
function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
/** Farven i designets punkt (x, y); null = gennemsigtigt */
function design(x, y) {
  return kupon[y][x] ?? scene[y][x] ?? baggrund[y][x];
}
/** Afrundede hjørner i trin (kun på "any"-ikonerne og faviconet) */
function iHjoerne(x, y) {
  const trin = [3, 2, 1]; // række 0 mangler 3 px, række 1 mangler 2, række 2 mangler 1
  const rx = Math.min(x, N - 1 - x);
  const ry = Math.min(y, N - 1 - y);
  return ry < trin.length && rx < trin[ry];
}

/**
 * Rendér ikonet i `stoerrelse` px: designet skaleres `skala` gange og centreres.
 * fuld: hele fladen dækkes (himmel og jord forlænges ud til kanten) — til maskable og apple-touch-icon.
 */
function render(stoerrelse, skala, { fuld = false, rund = false } = {}) {
  const off = Math.floor((stoerrelse - N * skala) / 2);
  const data = Buffer.alloc(stoerrelse * stoerrelse * 4);
  for (let py = 0; py < stoerrelse; py++) {
    for (let pxx = 0; pxx < stoerrelse; pxx++) {
      const gx = Math.floor((pxx - off) / skala);
      const gy = Math.floor((py - off) / skala);
      let c = null;
      if (gx >= 0 && gy >= 0 && gx < N && gy < N) {
        if (!(rund && iHjoerne(gx, gy))) c = design(gx, gy);
      } else if (fuld) {
        c = baggrund[Math.max(0, Math.min(N - 1, gy))][Math.max(0, Math.min(N - 1, gx))];
      }
      const i = (py * stoerrelse + pxx) * 4;
      const [r, g, b, a] = c ? hex(c) : [0, 0, 0, 0];
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return png(stoerrelse, stoerrelse, data);
}

// ---------- Minimal PNG-encoder (RGBA, 8 bit, filter 0) ----------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raa = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raa[y * (w * 4 + 1)] = 0; // filter: ingen
    rgba.copy(raa, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raa, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Skriv filerne ----------
const ud = fileURLToPath(new URL('../public/', import.meta.url));
mkdirSync(ud, { recursive: true });
const filer = {
  'icon-192.png': render(192, 6, { rund: true }),
  'icon-512.png': render(512, 16, { rund: true }),
  // Maskable: vigtigt indhold inden for den sikre cirkel (80 % af bredden) — designet fylder 320 af 512 px
  'icon-maskable-512.png': render(512, 10, { fuld: true }),
  // iOS runder selv hjørnerne og kræver en uigennemsigtig flade
  'apple-touch-icon.png': render(180, 5, { fuld: true }),
  'favicon.png': render(32, 1, { rund: true }),
};
for (const [navn, buf] of Object.entries(filer)) {
  writeFileSync(ud + navn, buf);
  console.log(`public/${navn}: ${(buf.length / 1024).toFixed(1)} KB`);
}
