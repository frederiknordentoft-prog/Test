// Statisk kulisse pr. kontortrin: vægge, gulv, rekvisitter, borde og vægpynt (pokaler, kuponer, plaketter, licens).
// Tegnes kun, når kontor/akt/pynt ændrer sig — aldrig pr. frame.
import type { OfficeTier } from '../sim/types';
import type { AktChrome } from './actChrome';
import { BORD_W, LICENS_W, MONITOR, PERSON_DX, hyldeKapacitet, type Felt, type Layout } from './layout';
import { T, bland, prng, rgba, skygge } from './palette';
import { IKON, licensSprite, prisIkon } from './sprites';
import { afkort, tegnTekst, tekstBredde } from './font';

type Ctx = CanvasRenderingContext2D;

function r(c: Ctx, x: number, y: number, w: number, h: number, f: string): void {
  if (w <= 0 || h <= 0) return;
  c.fillStyle = f;
  c.fillRect(x, y, w, h);
}

/** Ternet dither (hver anden pixel) — klassisk pixel-halvtone */
function dither(c: Ctx, x: number, y: number, w: number, h: number, f: string, fase = 0): void {
  c.fillStyle = f;
  for (let yy = 0; yy < h; yy++) for (let xx = (yy + fase) & 1; xx < w; xx += 2) c.fillRect(x + xx, y + yy, 1, 1);
}

// ---------- Materialer pr. trin ----------
export type Materialer = {
  bordTop: string;
  bordFront: string;
  bordKant: string;
  monitor: string;
  monitorSkygge: string;
  stol: string;
  tastatur: string;
};

export function materialerFor(tier: OfficeTier, akt: AktChrome): Materialer {
  const ai = akt.id === 'ai';
  // AI-akten: mørke borde i sort glas og antracit (kanterne får neon i glødlaget)
  if (ai && tier !== 'garage' && tier !== 'kaelder') {
    return tier === 'hovedkontor'
      ? { bordTop: '#4a4f66', bordFront: '#2a2e40', bordKant: '#141724', monitor: '#0c0e16', monitorSkygge: '#07080d', stol: '#1c1f2e', tastatur: '#7d86a3' }
      : { bordTop: '#454b62', bordFront: '#282d40', bordKant: '#131623', monitor: '#0c0e16', monitorSkygge: '#07080d', stol: '#1e2233', tastatur: '#7d86a3' };
  }
  switch (tier) {
    case 'garage':
      return { bordTop: '#c29460', bordFront: '#8a6440', bordKant: '#5e4229', monitor: '#cfc6ae', monitorSkygge: '#9c937c', stol: '#3d3b44', tastatur: '#e4dccb' };
    case 'kaelder':
      return { bordTop: '#8f9a88', bordFront: '#66705f', bordKant: '#454c40', monitor: '#cfc6ae', monitorSkygge: '#9c937c', stol: '#4a3f52', tastatur: '#e4dccb' };
    case 'kontor':
      return { bordTop: '#d4b17e', bordFront: '#a88256', bordKant: '#6f5334', monitor: ai ? '#1a1d2a' : '#2b2f3d', monitorSkygge: '#1b1e28', stol: '#3b4a6b', tastatur: '#c7ccd6' };
    case 'etage':
      return { bordTop: '#e3e6ea', bordFront: '#b4bac3', bordKant: '#7d848f', monitor: '#23262f', monitorSkygge: '#15171d', stol: '#2f3a55', tastatur: '#aab1bd' };
    default:
      return { bordTop: '#7a5438', bordFront: '#58391f', bordKant: '#3a2414', monitor: '#1f222b', monitorSkygge: '#121419', stol: '#252838', tastatur: '#9aa1ad' };
  }
}

// ---------- Små rekvisitter ----------
function plante(c: Ctx, x: number, y: number, stor: boolean, rnd: () => number): void {
  // x,y = potte øverst venstre
  const pw = stor ? 10 : 6;
  const ph = stor ? 8 : 5;
  r(c, x, y, pw, ph, '#b0613a');
  r(c, x, y, pw, 1, '#c8794f');
  r(c, x + pw - 2, y + 1, 2, ph - 1, '#8a4a2b');
  const blade = stor ? 16 : 7;
  const hoej = stor ? 18 : 8;
  for (let i = 0; i < blade; i++) {
    const bx = x + pw / 2 + Math.round((rnd() - 0.5) * pw * 1.6);
    const by = y - 1 - Math.round(rnd() * hoej);
    const g = rnd() < 0.5 ? '#3f8a4a' : rnd() < 0.5 ? '#56a85a' : '#2f6b3a';
    r(c, bx, by, 2, 2, g);
    r(c, bx, by + 2, 1, Math.max(1, y - by - 2), '#2f6b3a');
  }
}

function kasse(c: Ctx, x: number, y: number, w: number, h: number): void {
  r(c, x, y, w, h, '#b98a52');
  r(c, x, y, w, 1, '#d4a86e');
  r(c, x + w - 1, y, 1, h, '#8f6a3c');
  r(c, x, y + h - 1, w, 1, '#8f6a3c');
  r(c, x + Math.floor(w / 2) - 1, y, 2, h, '#d9bb88');
}

function skyline(c: Ctx, x: number, y: number, w: number, h: number, akt: AktChrome, rnd: () => number): void {
  const ai = akt.id === 'ai';
  const himmel = ai ? ['#101532', '#151c44', '#1c2556'] : akt.id === 'garage' ? ['#f2b36b', '#f6c98a', '#f9dcaa'] : ['#8ec5e8', '#a7d3ee', '#c4e3f4'];
  const band = Math.ceil(h / himmel.length);
  himmel.forEach((f, i) => r(c, x, y + i * band, w, Math.min(band, h - i * band), f));
  // bygninger
  let bx = x;
  while (bx < x + w) {
    const bw = 5 + Math.floor(rnd() * 9);
    const bh = Math.floor(h * (0.25 + rnd() * 0.5));
    const farve = ai ? (rnd() < 0.5 ? '#1e2340' : '#252b4d') : rnd() < 0.5 ? '#7d93a8' : '#6b8096';
    const ww = Math.min(bw, x + w - bx);
    r(c, bx, y + h - bh, ww, bh, farve);
    // vinduer
    for (let yy = y + h - bh + 2; yy < y + h - 1; yy += 3)
      for (let xx = bx + 1; xx < bx + ww - 1; xx += 2) if (rnd() < (ai ? 0.35 : 0.2)) r(c, xx, yy, 1, 1, ai ? T.cyan : '#e8f1f7');
    bx += bw + (rnd() < 0.3 ? 1 : 0);
  }
}

function vindue(c: Ctx, x: number, y: number, w: number, h: number, akt: AktChrome, rnd: () => number, ramme = '#8d8676', sprosser = 2): void {
  r(c, x - 2, y - 2, w + 4, h + 4, ramme);
  skyline(c, x, y, w, h, akt, rnd);
  // sprosser
  for (let i = 1; i < sprosser; i++) r(c, x + Math.round((w * i) / sprosser), y, 1, h, ramme);
  r(c, x, y + Math.round(h * 0.55), w, 1, ramme);
  // refleks
  for (let i = 0; i < 4; i++) r(c, x + 3 + i, y + 2 + i * 2, 1, 2, rgba('#ffffff', 0.35));
  r(c, x - 3, y + h + 2, w + 6, 2, skygge(ramme, -0.25)); // vindueskarm
}

// ---------- Baggrund pr. trin ----------
function garage(c: Ctx, l: Layout, akt: AktChrome, rnd: () => number): void {
  const W = l.w;
  const ai = akt.id === 'ai';
  // loftbjælke
  r(c, 0, 0, W, 4, '#2e2119');
  r(c, 0, 3, W, 1, '#1f1611');
  // væg af betonblokke
  r(c, 0, 4, W, l.vaegH - 4, '#7a6552');
  for (let y = 4, row = 0; y < l.vaegH; y += 6, row++) {
    r(c, 0, y + 5, W, 1, '#665342');
    for (let x = (row & 1) * 6; x < W; x += 12) r(c, x, y, 1, 5, '#665342');
  }
  for (let i = 0; i < 90; i++) r(c, Math.floor(rnd() * W), 4 + Math.floor(rnd() * (l.vaegH - 4)), 1, 1, rnd() < 0.5 ? '#6f5b49' : '#86705c');
  // gulv (beton)
  r(c, 0, l.vaegH, W, l.h - l.vaegH, '#6b635a');
  r(c, 0, l.vaegH, W, 2, '#4f4943');
  for (let i = 0; i < 60; i++) r(c, Math.floor(rnd() * W), l.vaegH + 2 + Math.floor(rnd() * (l.h - l.vaegH)), 1, 1, rnd() < 0.5 ? '#645c53' : '#756d63');
  r(c, 20, 84, 14, 1, '#5a534b');
  r(c, 33, 85, 6, 1, '#5a534b');
  // garageport
  r(c, 103, 7, 57, l.vaegH - 7, '#3b2f26');
  for (let y = 9; y < l.vaegH; y += 3) {
    r(c, 105, y, 55, 2, '#9a8f80');
    r(c, 105, y + 2, 55, 1, '#7c7266');
  }
  for (let i = 0; i < 4; i++) r(c, 110 + i * 12, 12, 8, 3, ai ? '#1c2556' : '#bcd0dc');
  // pløkbræt med værktøj
  r(c, 4, 10, 31, 21, '#a88455');
  r(c, 4, 30, 31, 1, '#7d6140');
  for (let y = 12; y < 30; y += 3) for (let x = 6; x < 34; x += 3) r(c, x, y, 1, 1, '#8a6a40');
  r(c, 9, 13, 1, 12, '#6b4222'); // hammer
  r(c, 7, 12, 5, 2, '#8a8f99');
  r(c, 15, 13, 2, 2, '#9aa0aa'); // skruenøgle
  r(c, 16, 15, 1, 8, '#9aa0aa');
  r(c, 15, 23, 3, 2, '#9aa0aa');
  r(c, 21, 14, 9, 4, '#b8bdc6'); // sav
  r(c, 21, 17, 9, 1, '#8a8f99');
  r(c, 29, 13, 3, 6, '#7a3b22');
  r(c, 22, 21, 1, 6, '#c0392b'); // skruetrækkere
  r(c, 22, 20, 1, 1, '#9aa0aa');
  r(c, 25, 21, 1, 6, '#2f6fb0');
  r(c, 25, 20, 1, 1, '#9aa0aa');
  r(c, 28, 22, 4, 5, '#c9a64a'); // tape
  r(c, 29, 23, 2, 3, '#a88455');
  // lille hylde med malerbøtter under pløkbrættet
  r(c, 4, 38, 30, 2, '#6f5033');
  r(c, 6, 33, 5, 5, '#d0d4da');
  r(c, 6, 33, 5, 1, '#7a8aa8');
  r(c, 13, 34, 4, 4, '#c0392b');
  r(c, 19, 33, 6, 5, '#e4c35a');
  if (!ai) {
    // bil (sidebillede, næsen mod venstre), delvis beskåret af højre kant
    const bil = '#8c3b2e';
    const bilLys = skygge(bil, 0.2);
    const bilMoerk = skygge(bil, -0.35);
    r(c, 98, 62, 62, 13, bil);
    r(c, 98, 62, 62, 1, bilLys);
    r(c, 100, 60, 12, 2, bil);
    r(c, 111, 52, 36, 10, bil);
    r(c, 111, 52, 36, 1, bilLys);
    r(c, 108, 56, 3, 6, bil);
    r(c, 109, 54, 2, 2, bil);
    r(c, 113, 54, 14, 7, '#9ec3d6');
    r(c, 129, 54, 15, 7, '#9ec3d6');
    r(c, 114, 55, 2, 3, '#d6ecf5');
    r(c, 127, 54, 2, 8, bil);
    r(c, 98, 70, 62, 5, bilMoerk);
    r(c, 98, 64, 2, 3, '#ffe9a0');
    r(c, 96, 71, 4, 3, '#55585f');
    r(c, 132, 64, 4, 1, bilMoerk); // dørhåndtag
    for (const hx of [104, 144]) {
      r(c, hx - 1, 70, 13, 5, bilMoerk);
      r(c, hx, 71, 11, 11, '#1d1d1d');
      r(c, hx - 1, 73, 13, 7, '#1d1d1d');
      r(c, hx + 3, 74, 5, 5, '#8a8a8a');
      r(c, hx + 4, 75, 3, 3, '#5a5a5a');
    }
    r(c, 100, 82, 60, 1, '#4f4943');
    // olieplet
    r(c, 118, 84, 20, 3, '#524b44');
    r(c, 122, 83, 12, 5, '#4a443e');
  } else {
    // AI-akten: bilen er kørt ud — serverskabene står, hvor den holdt. Tilbage er olieplet, kabler og en stikdåse.
    r(c, 118, 84, 20, 3, '#524b44');
    r(c, 100, 82, 60, 1, '#4f4943');
    r(c, 96, 60, 1, 24, '#15151a');
    r(c, 70, 83, 27, 1, '#15151a');
    r(c, 88, 80, 8, 3, '#d8d4c8');
    r(c, 89, 81, 1, 1, '#c0392b');
    r(c, 91, 81, 1, 1, '#2f6fb0');
  }
  // flyttekasser til venstre
  kasse(c, 0, 58, 13, 10);
  kasse(c, 1, 68, 12, 12);
  kasse(c, 2, 48, 10, 10);
  // ølkasse under tv
  r(c, 73, 64, 20, 14, '#b0322b');
  r(c, 73, 64, 20, 1, '#cf4a3f');
  for (let x = 75; x < 92; x += 4) r(c, x, 67, 2, 8, '#7d1f1a');
  r(c, 73, 77, 20, 1, '#6d1813');
}

function kaelder(c: Ctx, l: Layout, akt: AktChrome, rnd: () => number): void {
  const W = l.w;
  const ai = akt.id === 'ai';
  // væg: malet mursten
  r(c, 0, 4, W, l.vaegH - 4, '#5b6b5e');
  for (let y = 4, row = 0; y < l.vaegH; y += 4, row++) {
    r(c, 0, y + 3, W, 1, '#51604f');
    for (let x = (row & 1) * 4; x < W; x += 8) r(c, x, y, 1, 3, '#51604f');
  }
  for (let i = 0; i < 4; i++) dither(c, Math.floor(rnd() * (W - 12)), 14 + Math.floor(rnd() * 20), 8 + Math.floor(rnd() * 8), 4 + Math.floor(rnd() * 6), '#4e5c50');
  // loft og rør
  r(c, 0, 0, W, 4, '#2c2e35');
  r(c, 0, 3, W, 1, '#1f2126');
  r(c, 0, 5, W, 2, '#7f8792');
  r(c, 0, 5, W, 1, '#a4acb6');
  r(c, 0, 8, W, 1, '#c08050');
  for (let x = 10; x < W; x += 30) r(c, x, 4, 1, 5, '#44474f');
  // ventilhjul
  r(c, 127, 2, 3, 5, '#c0392b');
  r(c, 126, 3, 5, 3, '#c0392b');
  r(c, 128, 4, 1, 1, '#5c636d');
  r(c, 128, 7, 1, 1, '#44474f');
  r(c, 155, 7, 2, l.vaegH - 7, '#7f8792');
  r(c, 155, 7, 1, l.vaegH - 7, '#a4acb6');
  // lille vindue højt oppe (græsset udenfor i øjenhøjde)
  r(c, 5, 11, 24, 12, '#2f3338');
  r(c, 6, 12, 22, 10, ai ? '#1c2556' : '#b9d4e2');
  r(c, 6, 12, 22, 3, ai ? '#151c44' : '#d4e6ef');
  r(c, 6, 18, 22, 4, '#4f7a3a');
  for (let x = 6; x < 28; x += 2) r(c, x, 17 + Math.floor(rnd() * 2), 1, 1, '#6a9a4a');
  for (let x = 11; x < 28; x += 6) r(c, x, 12, 1, 10, '#3b3f45');
  // lysstribe ned på gulvet
  c.fillStyle = rgba('#fff3d0', ai ? 0.04 : 0.11);
  for (let y = 23; y < 66; y++) {
    const k = (y - 23) / 43;
    const x0 = Math.round(6 + k * 10);
    const x1 = Math.round(28 + k * 20);
    for (let x = x0 + (y & 1); x < x1; x += 2) c.fillRect(x, y, 1, 1);
  }
  // radiator under vinduet
  r(c, 7, 30, 20, 11, '#c9c3b5');
  for (let x = 8; x < 27; x += 2) r(c, x, 31, 1, 9, '#a39d90');
  r(c, 7, 30, 20, 1, '#e0dbcf');
  // vandvarmer (AI-akten: skabene står her)
  if (!ai) {
    r(c, 138, 12, 14, 30, '#b8b2a4');
    r(c, 138, 12, 14, 1, '#d6d0c2');
    r(c, 149, 13, 3, 29, '#9c9689');
    r(c, 143, 9, 2, 3, '#9a6440');
    r(c, 141, 24, 5, 3, '#d9443a');
    r(c, 142, 25, 3, 1, '#f3efe2');
  }
  // gulv: slidt linoleum
  r(c, 0, l.vaegH, W, l.h - l.vaegH, '#4d4a46');
  for (let y = l.vaegH; y < l.h; y += 6) for (let x = ((y / 6) & 1) * 6; x < W; x += 12) r(c, x, y, 6, 6, '#55514c');
  r(c, 0, l.vaegH, W, 2, '#2f2d2a');
  // kasser og kabler (AI-akten: to hologrammer har taget kassernes plads)
  if (!ai) {
    kasse(c, 146, 58, 12, 10);
    kasse(c, 145, 68, 14, 12);
  } else {
    r(c, 132, 50, 1, 36, '#15151a');
    r(c, 60, 86, 73, 1, '#15151a');
  }
  r(c, 2, 84, 50, 1, '#1f1f24');
  r(c, 51, 80, 1, 5, '#1f1f24');
}

function kontor(c: Ctx, l: Layout, akt: AktChrome, rnd: () => number): void {
  const W = l.w;
  r(c, 0, 0, W, l.vaegH, '#d9d2c2');
  for (let i = 0; i < 70; i++) r(c, Math.floor(rnd() * W), 4 + Math.floor(rnd() * 46), 1, 1, '#d1c9b8');
  r(c, 0, 0, W, 4, '#bdb6a6');
  for (const x of [40, 120, 200, 280]) r(c, x, 1, 24, 2, '#fffbe8');
  r(c, 0, 52, W, l.vaegH - 52, '#b9ae98');
  r(c, 0, 52, W, 1, '#9f947e');
  vindue(c, 10, 11, 58, 34, akt, rnd, '#8d8676', 2);
  vindue(c, 266, 11, 44, 34, akt, rnd, '#8d8676', 2);
  // whiteboard
  r(c, 80, 12, 54, 30, '#9aa0a8');
  r(c, 82, 14, 50, 26, '#f4f4f0');
  r(c, 84, 17, 18, 1, T.sky);
  r(c, 84, 20, 12, 1, T.sky);
  r(c, 84, 25, 20, 1, '#555a66');
  r(c, 84, 28, 14, 1, '#555a66');
  r(c, 110, 32, 3, 5, T.pink);
  r(c, 115, 28, 3, 9, T.violet);
  r(c, 120, 24, 3, 13, T.good);
  r(c, 125, 19, 3, 18, T.gold);
  r(c, 108, 37, 22, 1, '#555a66');
  r(c, 94, 42, 26, 2, '#7d838c');
  r(c, 98, 41, 4, 1, T.bad);
  r(c, 104, 41, 4, 1, T.sky);
  // gulv: træplanker
  r(c, 0, l.vaegH, W, l.h - l.vaegH, '#a87a50');
  for (let y = l.vaegH + 6, row = 0; y < l.h; y += 7, row++) {
    r(c, 0, y, W, 1, '#946b45');
    for (let x = (row % 3) * 17; x < W; x += 52) r(c, x, y - 6, 1, 6, '#946b45');
  }
  r(c, 0, l.vaegH, W, 2, '#6f5334');
  // tæppe under arbejdspladserne
  r(c, 22, 86, 276, 90, '#4f6285');
  r(c, 22, 86, 276, 1, '#6479a0');
  r(c, 24, 88, 272, 86, '#566b90');
  dither(c, 24, 88, 272, 2, '#4f6285');
  // planter
  plante(c, 4, 158, true, rnd);
  if (akt.id !== 'ai') {
    plante(c, 300, 116, true, rnd);
    // kaffehjørne (AI-akten: serverhjørne)
    r(c, 290, 60, 30, 20, '#8d6b4a');
    r(c, 290, 60, 30, 2, '#a8835e');
    r(c, 296, 48, 12, 12, '#2b2f3d');
    r(c, 298, 50, 8, 4, '#4a5282');
    r(c, 300, 56, 4, 3, '#f4efe4');
  }
}

function etage(c: Ctx, l: Layout, akt: AktChrome, rnd: () => number): void {
  const W = l.w;
  r(c, 0, 0, W, l.vaegH, '#cfd6de');
  r(c, 0, 0, W, 3, '#aab3bd');
  // glasfacade til venstre og højre
  r(c, 0, 3, 118, l.vaegH - 11, '#8d96a3');
  skyline(c, 2, 5, 114, l.vaegH - 15, akt, rnd);
  for (let x = 2; x < 118; x += 19) r(c, x, 5, 1, l.vaegH - 15, '#8d96a3');
  r(c, 0, l.vaegH - 10, 118, 2, '#7d8693');
  r(c, 262, 3, 58, l.vaegH - 11, '#8d96a3');
  skyline(c, 264, 5, 56, l.vaegH - 15, akt, rnd);
  for (let x = 264; x < W; x += 19) r(c, x, 5, 1, l.vaegH - 15, '#8d96a3');
  r(c, 262, l.vaegH - 10, 58, 2, '#7d8693');
  // accentvæg i midten
  r(c, 120, 3, 140, l.vaegH - 3, '#39456a');
  r(c, 120, 3, 140, 1, '#4b5a86');
  r(c, 120, l.vaegH - 2, 140, 2, '#2c3654');
  // gulv: tæppefliser
  r(c, 0, l.vaegH, W, l.h - l.vaegH, '#5d6679');
  for (let y = l.vaegH; y < l.h; y += 16) for (let x = ((y / 16) & 1) * 16; x < W; x += 32) r(c, x, y, 16, 16, '#646d80');
  r(c, 0, l.vaegH, W, 2, '#3d4454');
  // planter og vandkøler (AI-akten: hologrammerne står, hvor planterne stod)
  if (akt.id !== 'ai') {
    plante(c, 300, 76, true, rnd);
    plante(c, 300, 112, true, rnd);
    plante(c, 300, 148, true, rnd);
  }
  r(c, 4, 66, 10, 14, '#d8dde3');
  r(c, 5, 58, 8, 8, '#8fc4e8');
  r(c, 5, 58, 8, 2, '#b8dcf2');
  r(c, 3, 80, 12, 2, '#9aa1ad');
}

function hovedkontor(c: Ctx, l: Layout, akt: AktChrome, rnd: () => number): void {
  const W = l.w;
  const ai = akt.id === 'ai';
  r(c, 0, 0, W, l.vaegH, '#e6e1d6');
  // høje vinduer
  vindue(c, 4, 5, 66, l.vaegH - 14, akt, rnd, '#9a948a', 3);
  vindue(c, 250, 5, 66, l.vaegH - 14, akt, rnd, '#9a948a', 3);
  // træpanelvæg i midten med messinglister og pendellamper
  r(c, 76, 0, 168, l.vaegH, '#4a3426');
  for (let x = 78; x < 244; x += 6) r(c, x, 0, 1, l.vaegH, '#553c2c');
  r(c, 76, 0, 2, l.vaegH, '#3a281c');
  r(c, 242, 0, 2, l.vaegH, '#3a281c');
  r(c, 76, l.vaegH - 2, 168, 2, '#2e2016');
  r(c, 78, 19, 164, 1, '#b8913e');
  r(c, 78, l.vaegH - 3, 164, 1, '#b8913e');
  // gulv: lys marmor i skaktern med årer (et helt andet gulv end etagens tæppefliser)
  r(c, 0, l.vaegH, W, l.h - l.vaegH, '#d3cab8');
  for (let y = l.vaegH, row = 0; y < l.h; y += 18, row++) for (let x = (row & 1) * 20; x < W; x += 40) r(c, x, y, 20, 18, '#c4baa5');
  for (let i = 0; i < 26; i++) {
    let x = Math.floor(rnd() * W);
    let y = l.vaegH + 2 + Math.floor(rnd() * (l.h - l.vaegH - 4));
    const n = 4 + Math.floor(rnd() * 8);
    for (let k = 0; k < n; k++) {
      r(c, x, y, 1, 1, '#b3a78f');
      x += rnd() < 0.6 ? 1 : 0;
      y += rnd() < 0.5 ? 1 : -1;
    }
  }
  // spejling af vinduerne i det polerede gulv
  dither(c, 8, l.vaegH + 2, 58, 5, rgba('#ffffff', 0.35));
  dither(c, 254, l.vaegH + 2, 58, 5, rgba('#ffffff', 0.35));
  r(c, 0, l.vaegH, W, 2, '#7d735f');
  // bordeauxrøde løbere i gangene mellem rækkerne
  for (const y of [98, 134]) {
    r(c, 2, y, W - 4, 7, '#7a2233');
    r(c, 2, y, W - 4, 1, '#c9a64a');
    r(c, 2, y + 6, W - 4, 1, '#c9a64a');
    dither(c, 2, y + 2, W - 4, 3, '#6a1d2c');
  }
  if (!ai) {
    plante(c, 2, 64, true, rnd);
    plante(c, 308, 64, false, rnd);
  }
}

// ---------- Rod (garage-akten er rodet) ----------
function rod(c: Ctx, l: Layout, akt: AktChrome, rnd: () => number): void {
  const n = Math.round(akt.rod * (l.zoom === 2 ? 5 : 8));
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rnd() * (l.tier === 'garage' ? 84 : l.zoom === 2 ? 128 : l.w - 20)) + 4;
    const y = l.zoom === 2 ? 80 + Math.floor(rnd() * 7) : l.vaegH + 8 + Math.floor(rnd() * (l.h - l.vaegH - 14));
    const valg = rnd();
    if (valg < 0.35) {
      // pizzabakke
      r(c, x, y, 11, 3, '#c9a36b');
      r(c, x, y, 11, 1, '#dcbb86');
      r(c, x + 4, y + 1, 3, 1, '#c0392b');
    } else if (valg < 0.7) {
      // papirer
      r(c, x, y, 5, 3, '#ece6d6');
      r(c, x + 3, y + 1, 5, 3, '#f6f2e8');
      r(c, x + 4, y + 2, 3, 1, '#9a9486');
    } else {
      // sodavandsdåse
      r(c, x, y, 2, 3, rnd() < 0.5 ? '#c0392b' : '#2f6fb0');
      r(c, x, y, 2, 1, '#c9ccd2');
    }
  }
}

/** Tegn hele baggrunden (uden borde) for et trin */
export function tegnBaggrund(c: Ctx, l: Layout, akt: AktChrome, seed: number): void {
  const rnd = prng(seed);
  c.clearRect(0, 0, l.w, l.h);
  switch (l.tier) {
    case 'garage':
      garage(c, l, akt, rnd);
      break;
    case 'kaelder':
      kaelder(c, l, akt, rnd);
      break;
    case 'kontor':
      kontor(c, l, akt, rnd);
      break;
    case 'etage':
      etage(c, l, akt, rnd);
      break;
    default:
      hovedkontor(c, l, akt, rnd);
  }
  if (akt.rod > 0) rod(c, l, akt, rnd);
}

// ---------- Stole og borde ----------
/** Stoleryg (bag personen) — tegnes i baggrundslaget */
export function tegnStol(c: Ctx, x: number, y: number, m: Materialer, tom: boolean): void {
  const sx = x + PERSON_DX + 1;
  const top = tom ? y - 9 : y - 7;
  r(c, sx, top, 10, y - top, m.stol);
  r(c, sx, top, 10, 1, skygge(m.stol, 0.25));
  r(c, sx + 1, top + 1, 1, y - top - 1, skygge(m.stol, 0.15));
}

/** Bord med skærmramme og tastatur (forgrundslaget; skærmfladen tegnes dynamisk) */
export function tegnBord(c: Ctx, x: number, y: number, m: Materialer, tier: OfficeTier, rnd: () => number, akt: AktChrome): void {
  // bordplade + front
  r(c, x, y, BORD_W, 3, m.bordTop);
  r(c, x, y, BORD_W, 1, skygge(m.bordTop, 0.18));
  r(c, x, y + 3, BORD_W, 6, m.bordFront);
  r(c, x, y + 8, BORD_W, 1, m.bordKant);
  if (tier === 'garage') {
    // bukke-ben
    r(c, x + 2, y + 3, 2, 7, m.bordKant);
    r(c, x + BORD_W - 4, y + 3, 2, 7, m.bordKant);
    r(c, x, y + 3, BORD_W, 1, m.bordKant);
  } else {
    r(c, x + 1, y + 4, BORD_W - 2, 1, skygge(m.bordFront, 0.12));
    r(c, x + BORD_W - 7, y + 5, 4, 1, m.bordKant); // skuffegreb
  }
  // skærm
  const mx = x + MONITOR.x;
  const my = y + MONITOR.y;
  const crt = tier === 'garage' || tier === 'kaelder';
  if (crt) {
    r(c, mx - 1, my - 1, MONITOR.w + 2, MONITOR.h + 1, m.monitor);
    r(c, mx - 1, my + MONITOR.h - 1, MONITOR.w + 2, 1, m.monitorSkygge);
    r(c, mx + MONITOR.w - 1, my, 2, MONITOR.h, m.monitorSkygge);
    r(c, mx + 2, y - 1, 5, 1, m.monitorSkygge);
  } else {
    r(c, mx, my, MONITOR.w, MONITOR.h, m.monitor);
    r(c, mx + 4, y - 2, 1, 2, m.monitorSkygge);
    r(c, mx + 3, y, 3, 1, m.monitorSkygge);
  }
  // tastatur
  r(c, x + PERSON_DX + 2, y + 1, 8, 1, m.tastatur);
  r(c, x + PERSON_DX + 2, y + 2, 8, 1, skygge(m.tastatur, -0.25));
  // lidt personlighed på bordet
  const v = rnd();
  if (v < 0.3) {
    r(c, x + BORD_W - 2, y - 2, 2, 2, akt.id === 'garage' ? '#c0392b' : '#f4efe4'); // kop/dåse
  } else if (v < 0.5 && tier !== 'garage') {
    r(c, x + BORD_W - 3, y - 3, 2, 2, '#3f8a4a'); // lille plante
    r(c, x + BORD_W - 3, y - 1, 2, 1, '#b0613a');
  } else if (v < 0.7) {
    r(c, x + BORD_W - 4, y, 3, 1, '#ece6d6'); // papirer
  }
}

// ---------- Vægpynt ----------
export type LicensPynt = { farver: readonly string[]; status: 'aktiv' | 'ansoegt' | 'suspenderet' };

export type Pynt = {
  /** Vundne gallapriser (kategori-id), ældste først */
  priser: string[];
  kuponer: number;
  hof: number;
  /** Licensbeviser på væggen: ét pr. marked med aktiv, ansøgt eller suspenderet licens */
  licenser: LicensPynt[];
  firmaNavn: string;
};

function korkplade(c: Ctx, f: Felt): void {
  r(c, f.x, f.y, f.w, f.h, '#7a5836');
  r(c, f.x + 1, f.y + 1, f.w - 2, f.h - 2, '#b08654');
  dither(c, f.x + 1, f.y + 1, f.w - 2, f.h - 2, '#a57b4a');
}

/** Oplyst glasvitrine om pokalhylden (etage og hovedkontor) */
function vitrine(c: Ctx, h: Felt): void {
  const x0 = h.x - 3;
  const y0 = h.y - 14;
  const w = h.w + 6;
  const hh = 16;
  r(c, x0, y0, w, hh, '#2b2a33');
  r(c, x0 + 1, y0 + 1, w - 2, hh - 2, '#3b3f52');
  dither(c, x0 + 1, y0 + 2, w - 2, hh - 4, rgba('#9fd4ff', 0.12));
  r(c, x0 + 1, y0 + 1, w - 2, 1, '#fff3c4'); // lys i loftet
  dither(c, x0 + 2, y0 + 2, w - 4, 2, rgba('#fff3c4', 0.35));
  r(c, x0, y0, w, 1, '#c9ccd4');
  r(c, x0, y0, 1, hh, '#c9ccd4');
  r(c, x0 + w - 1, y0, 1, hh, '#8d909c');
  // refleks i glasset
  for (let i = 0; i < 4; i++) r(c, x0 + 4 + i, y0 + 10 - i * 2, 1, 2, rgba('#ffffff', 0.3));
  for (let i = 0; i < 3; i++) r(c, x0 + w - 12 + i, y0 + 8 - i * 2, 1, 2, rgba('#ffffff', 0.22));
}

export function tegnVaegpynt(c: Ctx, l: Layout, p: Pynt): void {
  // pokalhylde (i vitrine på de største trin)
  const h = l.hylde;
  if (l.vitrine) vitrine(c, h);
  r(c, h.x, h.y, h.w, 2, '#8a6440');
  r(c, h.x, h.y, h.w, 1, '#a88155');
  r(c, h.x + 2, h.y + 2, 2, 2, '#5e4229');
  r(c, h.x + h.w - 4, h.y + 2, 2, 2, '#5e4229');
  const kap = hyldeKapacitet(l);
  const n = p.priser.length;
  // Fuld hylde: de nyeste står fremme, resten tælles som +N
  const vis = n > kap ? kap - 1 : n;
  const fra = n - vis;
  for (let i = 0; i < vis; i++) {
    const ik = prisIkon(p.priser[fra + i]);
    c.drawImage(ik, h.x + 1 + i * 8 - Math.floor((ik.width - 9) / 2), h.y - ik.height + 1);
  }
  if (n > kap) tegnTekst(c, `+${n - vis}`, h.x + 2 + vis * 8, h.y - 6, T.gold);
  if (n === 0) {
    // støvet, tom hylde — noget at se frem til
    dither(c, h.x + 3, h.y - 1, h.w - 6, 1, rgba('#ffffff', 0.18));
  }
  // guldkuponer på korkplade
  const k = l.kuponer;
  korkplade(c, k);
  const kup = IKON.kupon();
  const kolonner = Math.max(1, Math.floor((k.w - 2) / (kup.width - 1)));
  const raekker = Math.max(1, Math.floor((k.h - 2) / (kup.height - 1)));
  const kupKap = kolonner * raekker;
  const kupVis = p.kuponer > kupKap ? kupKap - 1 : p.kuponer;
  for (let i = 0; i < kupVis; i++) {
    const cx = k.x + 1 + (i % kolonner) * (kup.width - 1);
    const cy = k.y + 1 + Math.floor(i / kolonner) * (kup.height - 1);
    c.drawImage(kup, cx, cy);
  }
  if (p.kuponer > kupKap) {
    const t = `+${p.kuponer - kupVis}`;
    r(c, k.x + k.w - tekstBredde(t) - 3, k.y + k.h - 8, tekstBredde(t) + 2, 7, T.line);
    tegnTekst(c, t, k.x + k.w - tekstBredde(t) - 2, k.y + k.h - 7, T.gold);
  }
  if (p.kuponer === 0) {
    r(c, k.x + Math.floor(k.w / 2), k.y + 3, 2, 2, T.bad); // nål
  }
  // Hall of Fame-plaketter
  const pl = l.plaketter;
  const plk = IKON.plakette();
  const plKap = Math.max(1, Math.floor(pl.w / (plk.width + 1)));
  const plVis = p.hof > plKap ? plKap - 1 : p.hof;
  for (let i = 0; i < plVis; i++) c.drawImage(plk, pl.x + i * (plk.width + 1), pl.y + Math.max(0, Math.floor((pl.h - plk.height) / 2)));
  if (p.hof > plKap) tegnTekst(c, `+${p.hof - plVis}`, pl.x + plVis * (plk.width + 1) + 1, pl.y + Math.floor((pl.h - 5) / 2), T.violet);
  // licensbeviser: ét pr. marked, i den rækkefølge licenserne kom
  const lic = p.licenser;
  const lk = l.licenser.length;
  const licVis = lic.length > lk ? lk - 1 : lic.length;
  for (let i = 0; i < licVis; i++) c.drawImage(licensSprite(lic[i].farver, lic[i].status), l.licenser[i].x, l.licenser[i].y);
  if (lic.length > lk && lk > 0) {
    const sidst = l.licenser[lk - 1];
    const t = `+${lic.length - licVis}`;
    tegnTekst(c, t, sidst.x + Math.floor((LICENS_W - tekstBredde(t)) / 2), sidst.y + 1, T.gold);
  }
  // firmaskilt
  if (l.skilt) {
    const s = l.skilt;
    const skala = s.h >= 14 ? 2 : 1;
    const navn = afkort(p.firmaNavn.toUpperCase(), s.w - 6, skala);
    const tw = tekstBredde(navn, skala);
    const tx = s.x + Math.floor((s.w - tw) / 2);
    const ty = s.y + Math.floor((s.h - 5 * skala) / 2);
    if (l.tier === 'kontor') {
      r(c, tx - 3, s.y, tw + 6, s.h, '#2b2f3d');
      r(c, tx - 3, s.y, tw + 6, 1, '#4a5282');
    }
    tegnTekst(c, navn, tx + 1, ty + 1, rgba('#000000', 0.35), skala);
    tegnTekst(c, navn, tx, ty, l.tier === 'kontor' ? T.ink : T.gold, skala);
  }
}

/** Vægur (skive); viseren tegnes dynamisk */
export function tegnUrSkive(c: Ctx, l: Layout): void {
  if (!l.ur) return;
  const { x, y } = l.ur;
  r(c, x + 1, y, 5, 7, T.line);
  r(c, x, y + 1, 7, 5, T.line);
  r(c, x + 1, y + 1, 5, 5, '#f4efe4');
  r(c, x + 3, y + 1, 1, 1, '#9a9486');
  r(c, x + 5, y + 3, 1, 1, '#9a9486');
  r(c, x + 3, y + 5, 1, 1, '#9a9486');
  r(c, x + 1, y + 3, 1, 1, '#9a9486');
}

/** Tv-rammen (skærmindholdet tegnes dynamisk) */
export function tegnTvRamme(c: Ctx, l: Layout): void {
  const t = l.tv;
  if (l.tier === 'garage') {
    // gammelt billedrør på en ølkasse
    r(c, t.x, t.y, t.w, t.h, '#3a3a3a');
    r(c, t.x, t.y, t.w, 1, '#5a5a5a');
    r(c, t.x + t.w - 4, t.y + 3, 2, 2, '#c0392b');
    r(c, t.x + t.w - 4, t.y + 7, 2, 1, '#8a8a8a');
    r(c, t.x + t.w - 4, t.y + 9, 2, 1, '#8a8a8a');
    r(c, t.x + 6, t.y - 3, 1, 3, '#8a8a8a'); // antenne
    r(c, t.x + 12, t.y - 4, 1, 4, '#8a8a8a');
    return;
  }
  r(c, t.x - 1, t.y - 1, t.w + 2, t.h + 2, T.line);
  r(c, t.x, t.y, t.w, t.h, '#23262f');
  r(c, t.x + Math.floor(t.w / 2) - 1, t.y + t.h + 1, 2, 2, '#3a3d48');
}

/** Tv-skærmens indre felt */
export function tvSkaerm(l: Layout): Felt {
  const t = l.tv;
  if (l.tier === 'garage') return { x: t.x + 2, y: t.y + 2, w: t.w - 8, h: t.h - 4 };
  return { x: t.x + 2, y: t.y + 2, w: t.w - 4, h: t.h - 4 };
}

/** Lys/stemnings-overlay (tone, vignet, mørke) — forudtegnet */
export function tegnLysOverlay(c: Ctx, l: Layout, akt: AktChrome): void {
  c.clearRect(0, 0, l.w, l.h);
  if (akt.moerk > 0) {
    c.fillStyle = rgba(akt.moerkFarve, akt.moerk);
    c.fillRect(0, 0, l.w, l.h);
  }
  if (akt.lysAlpha > 0) {
    c.fillStyle = rgba(akt.lys, akt.lysAlpha);
    c.fillRect(0, 0, l.w, l.h);
  }
  if (akt.vignette > 0) {
    const g = c.createRadialGradient(l.w / 2, l.h * 0.55, Math.min(l.w, l.h) * 0.35, l.w / 2, l.h * 0.55, Math.max(l.w, l.h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${akt.vignette})`);
    c.fillStyle = g;
    c.fillRect(0, 0, l.w, l.h);
  }
  if (akt.moerk > 0) {
    // Mørket skæres væk, hvor lyset kommer fra: byens lys i vinduerne og spotlyset på trofæerne
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = 'rgba(0,0,0,0.72)';
    for (const v of l.vinduer) c.fillRect(v.x, v.y, v.w, v.h);
    const h = l.hylde;
    const top = l.vitrine ? h.y - 14 : h.y - 11;
    // Spotlyset på pokalhylden som en blød kegle (en skarp firkant lignede et spøgelseslag, når hylden er tom)
    const hx = h.x + h.w / 2;
    const hy = (top + h.y + 3) / 2;
    const rx = h.w / 2 + 4;
    const ry = (h.y - top + 3) / 2 + 2;
    c.save();
    c.translate(hx, hy);
    c.scale(1, ry / rx);
    const spot = c.createRadialGradient(0, 0, 1, 0, 0, rx);
    spot.addColorStop(0, 'rgba(0,0,0,0.45)');
    spot.addColorStop(0.7, 'rgba(0,0,0,0.3)');
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = spot;
    c.fillRect(-rx, -rx, rx * 2, rx * 2);
    c.restore();
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(l.kuponer.x - 1, l.kuponer.y - 1, l.kuponer.w + 2, l.kuponer.h + 2);
    c.fillRect(l.plaketter.x - 1, l.plaketter.y - 1, l.plaketter.w + 2, l.plaketter.h + 2);
    // Skærmlyset på holdet: ved hver plads lysnes mørket, så folkene kan ses (også på en lille telefonskærm)
    const rad = l.zoom === 2 ? 11 : 9;
    for (const p of l.pladser) {
      const cx = p.x + PERSON_DX + 6;
      const cy = p.y - 9;
      const g = c.createRadialGradient(cx, cy, 1, cx, cy, rad);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    c.restore();
  }
}

/** Glødende lag (neon i AI-akten) — tegnes efter mørke-overlayet. Borde, gulvgitter, lister og firmaskiltet i neon. */
export function tegnGloedLag(c: Ctx, l: Layout, akt: AktChrome, firmaNavn = ''): void {
  c.clearRect(0, 0, l.w, l.h);
  if (!akt.neon) return;
  const n = akt.neon;
  const n2 = akt.neon2 ?? n;
  // gulvgitter (svagt, som et blueprint)
  c.fillStyle = rgba(n, 0.06);
  const gy = l.zoom === 2 ? 8 : 12;
  const gx = l.zoom === 2 ? 16 : 24;
  for (let y = l.vaegH + gy; y < l.h; y += gy) c.fillRect(0, y, l.w, 1);
  for (let x = gx / 2; x < l.w; x += gx) c.fillRect(x, l.vaegH + 2, 1, l.h - l.vaegH - 2);
  // lister: loft og overgangen mellem væg og gulv
  r(c, 0, l.vaegH - 1, l.w, 1, n);
  c.fillStyle = rgba(n, 0.25);
  c.fillRect(0, l.vaegH - 3, l.w, 2);
  c.fillRect(0, l.vaegH, l.w, 2);
  r(c, 0, 2, l.w, 1, bland(n, '#ffffff', 0.2));
  c.fillStyle = rgba(n, 0.2);
  c.fillRect(0, 3, l.w, 2);
  // lodrette lister i den anden neonfarve ved vinduerne
  for (const v of l.vinduer) {
    if (v.h < 8) continue;
    for (const x of [v.x - 3, v.x + v.w + 2]) {
      if (x < 0 || x >= l.w) continue;
      r(c, x, 4, 1, l.vaegH - 6, n2);
      c.fillStyle = rgba(n2, 0.22);
      c.fillRect(x - 1, 4, 3, l.vaegH - 6);
    }
  }
  // bordkanter i neon
  c.fillStyle = rgba(n, 0.55);
  for (const p of l.pladser) c.fillRect(p.x, p.y + 8, BORD_W, 1);
  c.fillStyle = rgba(n, 0.14);
  for (const p of l.pladser) c.fillRect(p.x, p.y + 9, BORD_W, 1);
  // firmaskiltet lyser i neon
  if (l.skilt && firmaNavn) {
    const s = l.skilt;
    const skala = s.h >= 14 ? 2 : 1;
    const navn = afkort(firmaNavn.toUpperCase(), s.w - 6, skala);
    const tw = tekstBredde(navn, skala);
    const tx = s.x + Math.floor((s.w - tw) / 2);
    const ty = s.y + Math.floor((s.h - 5 * skala) / 2);
    const halo = rgba(n2, 0.28);
    tegnTekst(c, navn, tx - 1, ty, halo, skala);
    tegnTekst(c, navn, tx + 1, ty, halo, skala);
    tegnTekst(c, navn, tx, ty - 1, halo, skala);
    tegnTekst(c, navn, tx, ty + 1, halo, skala);
    tegnTekst(c, navn, tx, ty, bland(n2, '#ffffff', 0.35), skala);
  }
}

/** Scanlines (AI-akten): hver anden række en anelse mørkere — forudtegnet, ét drawImage pr. frame */
export function tegnScanlines(c: Ctx, l: Layout): void {
  c.clearRect(0, 0, l.w, l.h);
  c.fillStyle = 'rgba(0,0,0,0.13)';
  for (let y = 1; y < l.h; y += 2) c.fillRect(0, y, l.w, 1);
}

/** Glød omkring den bare pære i garagen */
export function lavPaereGloed(radius: number, farve: string): HTMLCanvasElement {
  const d = radius * 2;
  const cv = document.createElement('canvas');
  cv.width = d;
  cv.height = d;
  const c = cv.getContext('2d')!;
  // trinvise ringe (pixel-agtigt, ikke blødt)
  for (let k = 0; k < 4; k++) {
    const rr = Math.round(radius * (1 - k * 0.24));
    c.fillStyle = rgba(farve, 0.035 + k * 0.022);
    for (let y = -rr; y <= rr; y++) {
      const hw = Math.floor(Math.sqrt(rr * rr - y * y));
      if (k === 0) {
        // yderste ring dithered, så kanten opløses
        for (let x = -hw + ((y & 1) ? 1 : 0); x < hw; x += 2) c.fillRect(radius + x, radius + y, 1, 1);
      } else c.fillRect(radius - hw, radius + y, hw * 2, 1);
    }
  }
  return cv;
}
