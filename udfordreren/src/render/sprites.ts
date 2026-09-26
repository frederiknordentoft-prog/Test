// Procedurale pixelfolk (ca. 10×16 synlige pixels) og små ikoner. Alt tegnes én gang til offscreen-canvas og genbruges.
import type { ParamKey, Staff } from '../sim/types';
import { ROLES } from '../data/roles';
import { HAAR, HUD, OEJNE, TROEJE, T, hashTekst, rgba, skygge } from './palette';

// ---------- Person-atlas ----------
/** Ramme: 12×22. Bordpladen ligger ved y = BORD_Y i rammen. */
export const RAMME_W = 12;
export const RAMME_H = 22;
export const BORD_Y = 18;

export const POSE = {
  arbejd: 0, // kigger mod skærmen (venstre)
  squash: 1, // tryk: hoved 1 ned, bredere skuldre
  stretch: 2, // stræk: hoved 1 op
  idle: 3, // kigger frem, lille smil
  blink: 4,
  armeOp: 5, // strækker sig
  kaffe: 6,
  sover: 7, // hovedet på bordet
  jubel: 8, // arme op, åben mund
  landing: 9, // squash efter hop (kigger frem)
} as const;
export const ANTAL_POSER = 10;

export type Udseende = {
  hud: string;
  hudSkygge: string;
  haar: string;
  haarLys: string;
  frisure: number; // 0 kort, 1 lang, 2 knold, 3 pjusket, 4 tyndhåret, 5 kasket
  troeje: string;
  troejeSkygge: string;
  accent: string;
  briller: boolean;
  skaeg: boolean;
  kasket: string;
};

export function udseendeFor(m: Pick<Staff, 'navn' | 'udseende' | 'rolle'>): Udseende {
  const u = m.udseende | 0;
  const h = hashTekst(m.navn);
  const hud = HUD[(u + (h & 7)) % HUD.length];
  const haar = HAAR[(u * 3 + ((h >>> 3) & 15)) % HAAR.length];
  const troeje = TROEJE[((h >>> 8) + u * 5) % TROEJE.length];
  const frisure = ((h >>> 12) + u) % 6;
  return {
    hud,
    hudSkygge: skygge(hud, -0.18),
    haar,
    haarLys: skygge(haar, 0.18),
    frisure,
    troeje,
    troejeSkygge: skygge(troeje, -0.28),
    accent: ROLES[m.rolle]?.farve ?? T.gold,
    briller: ((h >>> 17) & 7) === 0 || ((h >>> 17) & 7) === 5,
    skaeg: frisure !== 1 && ((h >>> 21) & 7) === 3,
    kasket: TROEJE[((h >>> 24) + 3) % TROEJE.length],
  };
}

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

function tegnHoved(p: Px, u: Udseende, dy: number, oejne: 'venstre' | 'frem' | 'lukket' | 'glad', mund: 'ingen' | 'smil' | 'aaben') {
  const y = 3 + dy;
  // ansigt
  p(3, y + 1, 6, 7, u.hud);
  p(2, y + 2, 8, 4, u.hud);
  p(4, y + 7, 4, 1, u.hudSkygge); // hage-skygge
  // hår
  const H = u.haar;
  switch (u.frisure) {
    case 0: // kort
      p(3, y, 6, 1, H);
      p(2, y + 1, 8, 1, H);
      p(2, y + 2, 2, 1, H);
      p(8, y + 2, 2, 1, H);
      p(2, y + 3, 1, 1, H);
      p(9, y + 3, 1, 1, H);
      break;
    case 1: // langt
      p(3, y, 6, 1, H);
      p(2, y + 1, 8, 1, H);
      p(2, y + 2, 3, 1, H);
      p(7, y + 2, 3, 1, H);
      p(1, y + 2, 2, 8, H);
      p(9, y + 2, 2, 8, H);
      break;
    case 2: // knold
      p(4, y - 2, 4, 2, H);
      p(5, y - 3, 2, 1, H);
      p(3, y, 6, 1, H);
      p(2, y + 1, 8, 1, H);
      p(2, y + 2, 1, 2, H);
      p(9, y + 2, 1, 2, H);
      p(3, y + 2, 1, 1, H);
      break;
    case 3: // pjusket
      p(3, y - 1, 1, 1, H);
      p(5, y - 1, 1, 1, H);
      p(8, y - 1, 1, 1, H);
      p(2, y, 8, 1, H);
      p(2, y + 1, 8, 1, H);
      p(2, y + 2, 1, 2, H);
      p(9, y + 2, 1, 2, H);
      p(4, y + 2, 2, 1, H);
      p(7, y + 2, 1, 1, H);
      break;
    case 4: // tyndhåret
      p(3, y, 6, 1, u.hud);
      p(4, y, 3, 1, skygge(u.hud, 0.12));
      p(2, y + 2, 1, 3, H);
      p(9, y + 2, 1, 3, H);
      p(2, y + 1, 1, 1, H);
      p(9, y + 1, 1, 1, H);
      break;
    default: {
      // kasket
      const k = u.kasket;
      p(3, y - 1, 6, 1, k);
      p(2, y, 8, 2, k);
      p(1, y + 2, 7, 1, skygge(k, -0.3)); // skygge/skærm
      p(9, y + 2, 1, 2, H);
      p(5, y, 2, 1, skygge(k, 0.3));
    }
  }
  if (u.frisure !== 4) p(4, y, 2, 1, u.haarLys); // glans
  // øjne
  const ey = y + 4;
  if (oejne === 'venstre') {
    p(3, ey, 1, 2, OEJNE);
    p(6, ey, 1, 2, OEJNE);
  } else if (oejne === 'frem') {
    p(4, ey, 1, 2, OEJNE);
    p(7, ey, 1, 2, OEJNE);
  } else if (oejne === 'lukket') {
    p(4, ey + 1, 1, 1, OEJNE);
    p(7, ey + 1, 1, 1, OEJNE);
  } else {
    // glad ^ ^
    p(3, ey + 1, 1, 1, OEJNE);
    p(4, ey, 1, 1, OEJNE);
    p(5, ey + 1, 1, 1, OEJNE);
    p(6, ey + 1, 1, 1, OEJNE);
    p(7, ey, 1, 1, OEJNE);
    p(8, ey + 1, 1, 1, OEJNE);
  }
  if (u.briller && oejne !== 'glad') {
    p(3, ey, 2, 1, '#2b2b3a');
    p(6, ey, 2, 1, '#2b2b3a');
    p(5, ey, 1, 1, '#2b2b3a');
  }
  // kinder
  if (oejne !== 'venstre') {
    p(3, ey + 2, 1, 1, skygge(u.hud, -0.08));
    p(8, ey + 2, 1, 1, skygge(u.hud, -0.08));
  }
  if (u.skaeg) {
    p(3, y + 6, 6, 2, u.haar);
    p(4, y + 8, 4, 1, u.haar);
  }
  if (mund === 'smil') p(5, y + 6, 2, 1, u.skaeg ? skygge(u.haar, -0.4) : skygge(u.hud, -0.35));
  else if (mund === 'aaben') {
    p(5, y + 6, 2, 2, '#5a1f2a');
  }
}

function tegnKrop(p: Px, u: Udseende, dy: number, bred: boolean, arme: 'nede' | 'op' | 'kaffe') {
  const y = 12 + dy;
  // hals
  p(5, 11 + dy, 2, 1, u.hudSkygge);
  // torso (går ned under bordkanten, så et hop ikke afslører et hul)
  p(3, y, 6, 1, u.troeje);
  p(bred ? 1 : 2, y + 1, bred ? 10 : 8, 22 - y - 1, u.troeje);
  p(2, y + 4, 8, 22 - y - 4, u.troejeSkygge);
  // accent i rollefarve: krave + slips/snor
  p(4, y, 1, 1, u.accent);
  p(7, y, 1, 1, u.accent);
  p(5, y + 1, 2, 4, u.accent);
  p(5, y + 5, 2, 1, skygge(u.accent, -0.3));
  // arme
  if (arme === 'nede') {
    p(bred ? 0 : 1, y + 1, 1, 18 - y - 1, u.troejeSkygge);
    p(bred ? 11 : 10, y + 1, 1, 18 - y - 1, u.troejeSkygge);
  } else if (arme === 'op') {
    p(1, 1, 1, y - 1, u.troejeSkygge);
    p(10, 1, 1, y - 1, u.troejeSkygge);
    p(0, 0, 2, 2, u.hud);
    p(10, 0, 2, 2, u.hud);
  } else {
    // venstre arm nede, højre arm løfter koppen
    p(1, y + 1, 1, 18 - y - 1, u.troejeSkygge);
    p(9, y - 1, 2, 3, u.troejeSkygge);
    p(8, y - 2, 2, 1, u.hud);
    // kop
    p(9, y - 5, 3, 3, '#f4efe4');
    p(9, y - 5, 3, 1, '#c9b8a0');
    p(11, y - 4, 1, 1, '#c9b8a0');
  }
}

function tegnSover(p: Px, u: Udseende) {
  // sammensunket krop
  p(2, 14, 8, 8, u.troeje);
  p(2, 18, 8, 4, u.troejeSkygge);
  p(5, 14, 2, 3, u.accent);
  // foldede arme på bordet
  p(1, 16, 10, 2, u.troejeSkygge);
  // hoved lagt ned (mest hår set ovenfra)
  p(3, 10, 6, 6, u.frisure === 4 ? u.hud : u.haar);
  p(2, 11, 8, 4, u.frisure === 4 ? u.hud : u.haar);
  p(4, 10, 2, 1, u.frisure === 4 ? skygge(u.hud, 0.12) : u.haarLys);
  p(3, 15, 6, 1, u.hud); // pande mod armene
  p(4, 15, 1, 1, OEJNE);
  p(7, 15, 1, 1, OEJNE);
}

/** Tegn alle poser for én person i et vandret atlas (ANTAL_POSER × RAMME_W). */
export function lavPersonAtlas(u: Udseende): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = RAMME_W * ANTAL_POSER;
  c.height = RAMME_H;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < ANTAL_POSER; i++) {
    const ox = i * RAMME_W;
    const p: Px = (x, y, w, h, col) => {
      if (w <= 0 || h <= 0) return;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x, y, w, h);
    };
    switch (i) {
      case POSE.arbejd:
        tegnKrop(p, u, 0, false, 'nede');
        tegnHoved(p, u, 0, 'venstre', 'ingen');
        break;
      case POSE.squash:
        tegnKrop(p, u, 1, true, 'nede');
        tegnHoved(p, u, 1, 'venstre', 'ingen');
        break;
      case POSE.stretch:
        tegnKrop(p, u, 0, false, 'nede');
        p(5, 10, 2, 1, u.hudSkygge);
        tegnHoved(p, u, -1, 'venstre', 'ingen');
        break;
      case POSE.idle:
        tegnKrop(p, u, 0, false, 'nede');
        tegnHoved(p, u, 0, 'frem', 'smil');
        break;
      case POSE.blink:
        tegnKrop(p, u, 0, false, 'nede');
        tegnHoved(p, u, 0, 'lukket', 'smil');
        break;
      case POSE.armeOp:
        tegnKrop(p, u, 0, false, 'op');
        tegnHoved(p, u, 0, 'glad', 'aaben');
        break;
      case POSE.kaffe:
        tegnKrop(p, u, 0, false, 'kaffe');
        tegnHoved(p, u, 0, 'frem', 'ingen');
        break;
      case POSE.sover:
        tegnSover(p, u);
        break;
      case POSE.jubel:
        tegnKrop(p, u, 0, false, 'op');
        tegnHoved(p, u, 0, 'frem', 'aaben');
        break;
      case POSE.landing:
        tegnKrop(p, u, 1, true, 'nede');
        tegnHoved(p, u, 1, 'glad', 'smil');
        break;
    }
  }
  return c;
}

/** Har posen hænder på bordet (tegnes separat efter bordet)? */
export function haenderPaaBord(pose: number): 0 | 1 | 2 {
  if (pose === POSE.armeOp || pose === POSE.jubel || pose === POSE.sover) return 0;
  if (pose === POSE.kaffe) return 1;
  return 2;
}

// ---------- Små pixelikoner med automatisk mørk kant ----------
type Kort = { rows: string[]; farver: Record<string, string>; kant?: string };

function lavIkon({ rows, farver, kant }: Kort): HTMLCanvasElement {
  const k = kant ? 1 : 0;
  const w = rows[0].length + k * 2;
  const h = rows.length + k * 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  if (kant) {
    ctx.fillStyle = kant;
    rows.forEach((r, y) =>
      [...r].forEach((ch, x) => {
        if (ch !== '.') {
          ctx.fillRect(x, y + 1, 3, 1);
          ctx.fillRect(x + 1, y, 1, 3);
        }
      }),
    );
  }
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      const f = farver[ch];
      if (f) {
        ctx.fillStyle = f;
        ctx.fillRect(x + k, y + k, 1, 1);
      }
    }),
  );
  return c;
}

const ikonCache = new Map<string, HTMLCanvasElement>();
function ikon(navn: string, def: () => Kort): HTMLCanvasElement {
  let c = ikonCache.get(navn);
  if (!c) {
    c = lavIkon(def());
    ikonCache.set(navn, c);
  }
  return c;
}

export const IKON = {
  kuffert: () =>
    ikon('kuffert', () => ({
      rows: ['..bbb..', '.b...b.', 'BBBBBBB', 'BBBgBBB', 'bbbbbbb'],
      farver: { b: '#6b4222', B: '#9a6433', g: T.gold },
      kant: T.line,
    })),
  pokal: () =>
    ikon('pokal', () => ({
      rows: ['y.yyy.y', 'yyYyyyy', '.yYyyy.', '..yyy..', '...y...', '..ddd..', '.ddddd.'],
      farver: { y: T.gold, Y: '#fff3b0', d: '#b8860b' },
      kant: T.line,
    })),
  kupon: () =>
    ikon('kupon', () => ({
      rows: ['yyyyyyyy', 'yykyyYyy', '.ykyYYYy', 'yykyyYyy', 'yyyyyyyy'],
      farver: { y: T.gold, Y: '#fff3b0', k: '#b8860b' },
      kant: T.line,
    })),
  plakette: () =>
    ikon('plakette', () => ({
      rows: ['wwwwww', 'wvvvvw', 'wvyyvw', 'wyyyyw', 'wvyyvw', 'wvyvyw', 'wvvvvw', 'wwwwww'],
      farver: { w: '#5a3a24', v: '#6b4fb8', y: T.gold },
      kant: T.line,
    })),
  certifikat: () =>
    ikon('certifikat', () => ({
      rows: [
        'yyyyyyyyyyy',
        'ypppppppppy',
        'ypllllllppy',
        'ypppppppppy',
        'yplllllpppy',
        'yplllpppppy',
        'ypppppprrpy',
        'yppppprrrpy',
        'yyyyyyyyyyy',
      ],
      farver: { y: '#b8860b', p: '#f0ead6', l: '#8f8a7c', r: '#d9443a' },
      kant: T.line,
    })),
  kuvert: () =>
    ikon('kuvert', () => ({
      rows: ['ppppppp', 'lpppppl', 'plppplp', 'pplplpp', 'ppplppp'],
      farver: { p: '#e8e0c8', l: '#a39a82' },
      kant: T.line,
    })),
};

// ---------- Parameter-ikoner (5×5, tegnes i boblens tekstfarve) ----------
const PARAM_IKON: Record<ParamKey | 'fejl' | 'fjernet' | 'stjerne', string[]> = {
  spaending: ['..##.', '.##..', '#####', '..##.', '.##..'],
  originalitet: ['..#..', '.###.', '#####', '.###.', '.#.#.'],
  teknik: ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'],
  tryghed: ['#####', '#####', '#####', '.###.', '..#..'],
  fejl: ['#...#', '.###.', '#####', '.###.', '#.#.#'],
  fjernet: ['....#', '...##', '#.##.', '###..', '.#...'],
  stjerne: ['..#..', '..#..', '#####', '.###.', '.#.#.'],
};
export type BobleIkon = keyof typeof PARAM_IKON;

/** Tegner et 5×5-ikon; returnerer brugt bredde (inkl. mellemrum) */
export function tegnBobleIkon(ctx: CanvasRenderingContext2D, navn: BobleIkon, x: number, y: number, s: number, farve: string): number {
  ctx.fillStyle = farve;
  const rows = PARAM_IKON[navn];
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) if (rows[r][c] === '#') ctx.fillRect(x + c * s, y + r * s, s, s);
  return 6 * s;
}

// ---------- Gallapriser: én statuette pr. kategori (kategori-id → ikon) ----------
const PRIS_KORT: Record<string, () => Kort> = {
  innovation: () => ({
    rows: ['...v...', '..vVv..', 'vvvVvvv', '.vvVvv.', '..v.v..', '...y...', '...y...', '..ddd..', '.ddddd.'],
    farver: { v: T.violet, V: '#e2d8ff', y: T.gold, d: '#b8860b' },
    kant: T.line,
  }),
  ansvarlig: () => ({
    rows: ['ggggggg', 'gGgggGg', 'gggGggg', '.ggGgg.', '..ggg..', '...d...', '..ddd..', '.ddddd.'],
    farver: { g: T.good, G: '#d4ffd9', d: '#b8860b' },
    kant: T.line,
  }),
  udfordrer: () => ({
    rows: ['...pp..', '..pP...', '.ppppp.', '...pp..', '..pp...', '.pp....', '...d...', '..ddd..', '.ddddd.'],
    farver: { p: T.pink, P: '#ffd0e6', d: '#b8860b' },
    kant: T.line,
  }),
  platform: () => ({
    rows: ['...s...', '..sSs..', '..sSs..', '..sSs..', '..sSs..', '..sSs..', '.sssss.', '..ddd..', '.ddddd.'],
    farver: { s: T.sky, S: '#d6eeff', d: '#b8860b' },
    kant: T.line,
  }),
};

/** Statuette for en gallakategori (ukendte kategorier får den klassiske guldpokal) */
export function prisIkon(kategori: string): HTMLCanvasElement {
  const def = PRIS_KORT[kategori];
  return def ? ikon(`pris-${kategori}`, def) : IKON.pokal();
}

// ---------- Licensbevis (9×8) med markedets flagfarver ----------
const licensCache = new Map<string, HTMLCanvasElement>();

/** Lille indrammet licensbevis. status: aktiv, ansøgt (kuvert) eller suspenderet (rødt bånd hen over) */
export function licensSprite(farver: readonly string[], status: 'aktiv' | 'ansoegt' | 'suspenderet'): HTMLCanvasElement {
  const noegle = `${farver.join(',')}|${status}`;
  const hit = licensCache.get(noegle);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 9;
  c.height = 8;
  const x = c.getContext('2d')!;
  const p = (px: number, py: number, w: number, h: number, f: string) => {
    x.fillStyle = f;
    x.fillRect(px, py, w, h);
  };
  if (status === 'ansoegt') {
    // kuvert med rødt segl: ansøgningen ligger hos tilsynet
    p(0, 1, 9, 7, T.line);
    p(1, 2, 7, 5, '#e8e0c8');
    p(1, 2, 1, 1, '#a39a82');
    p(2, 3, 1, 1, '#a39a82');
    p(3, 4, 3, 1, '#a39a82');
    p(6, 3, 1, 1, '#a39a82');
    p(7, 2, 1, 1, '#a39a82');
    p(4, 5, 1, 1, T.bad);
    p(1, 0, 3, 1, farver[0] ?? T.gold);
    p(4, 0, 2, 1, farver[1] ?? T.ink);
  } else {
    p(0, 0, 9, 8, T.line);
    p(1, 1, 7, 6, '#9a7428');
    p(2, 2, 5, 4, '#efe8d4');
    // flag (tre striber) øverst til venstre
    p(2, 2, 1, 2, farver[0] ?? T.gold);
    p(3, 2, 1, 2, farver[1] ?? T.ink);
    p(4, 2, 1, 2, farver[2] ?? T.gold);
    p(2, 5, 3, 1, '#9a947f');
    p(5, 2, 2, 1, '#9a947f');
    p(6, 4, 1, 2, '#d9443a');
    if (status === 'suspenderet') {
      p(1, 3, 7, 2, T.bad);
      p(2, 3, 5, 1, '#ff9b9b');
    }
  }
  licensCache.set(noegle, c);
  return c;
}

// ---------- AI-akten: hologram-agenter ----------
/** Hologrammets ramme: 11×18. Fødderne (midten af puden) ligger ved (HOLO_FOD_X, HOLO_FOD_Y) i rammen. */
export const HOLO_W = 11;
export const HOLO_H = 18;
export const HOLO_FOD_X = 5;
export const HOLO_FOD_Y = 16;
/** Frames: 0-1 = står (to scanline-faser), 2-3 = arbejder (med et lille svævende datavindue) */
export const HOLO_FRAMES = 4;

// Et lille menneske af lys: hoved med visir, hals, arme fri af kroppen og tynde ben
const HOLO_FIGUR = [
  '..lll..',
  '.lcccl.',
  '.lvvvl.',
  '..lcl..',
  '...c...',
  '.lllll.',
  'l.ccc.l',
  'l.c.c.l',
  'l.ccc.l',
  '..ccc..',
  '..c.c..',
  '..c.c..',
  '..l.l..',
];

let holoAtlas: HTMLCanvasElement | null = null;

/**
 * Cyan hologram-figur (monokrom, gennemsigtig, med scanlines og projektorpude) — skal altid kunne skelnes fra
 * pixelfolkene, som har hud, hår og tøj i farver.
 */
export function holoSprite(): HTMLCanvasElement {
  if (holoAtlas) return holoAtlas;
  const c = document.createElement('canvas');
  c.width = HOLO_W * HOLO_FRAMES;
  c.height = HOLO_H;
  const x = c.getContext('2d')!;
  const farve: Record<string, string> = { c: T.cyan, l: '#b9fff8', v: '#ffffff' };
  for (let f = 0; f < HOLO_FRAMES; f++) {
    const ox = f * HOLO_W;
    const fase = f & 1;
    // lyskegle fra puden
    x.fillStyle = rgba(T.cyan, 0.13);
    for (let y = 6; y <= 14; y++) {
      const hw = Math.round(1 + ((y - 6) / 8) * 3);
      x.fillRect(ox + HOLO_FOD_X - hw, y, hw * 2 + 1, 1);
    }
    // figuren, række for række — hver anden række svagere (scanlines, faseforskudt mellem frames)
    HOLO_FIGUR.forEach((row, ry) => {
      const y = 2 + ry;
      x.globalAlpha = (ry + fase) & 1 ? 0.58 : 1;
      [...row].forEach((ch, rx) => {
        const f2 = farve[ch];
        if (!f2) return;
        x.fillStyle = f2;
        x.fillRect(ox + 2 + rx, y, 1, 1);
      });
    });
    x.globalAlpha = 1;
    // projektorpude
    x.fillStyle = '#b9fff8';
    x.fillRect(ox + 2, 15, 7, 1);
    x.fillStyle = T.cyan;
    x.fillRect(ox + 1, 16, 9, 1);
    x.fillStyle = '#1d7c80';
    x.fillRect(ox + 2, 17, 7, 1);
    // arbejder: lille svævende datavindue over skulderen
    if (f >= 2) {
      x.fillStyle = rgba(T.cyan, 0.35);
      x.fillRect(ox + 7, 0, 4, 4);
      x.fillStyle = '#b9fff8';
      x.fillRect(ox + 8, 1, fase ? 2 : 1, 1);
      x.fillRect(ox + 8, 2, fase ? 1 : 2, 1);
    }
  }
  holoAtlas = c;
  return c;
}

// ---------- AI-akten: serverskabe ----------
/** Frames pr. udfyldning (LED-blink) */
export const SKAB_FASER = 4;
/** Udfyldning: 0 = standby, 1 = halvt, 2 = fuldt (to agenter) */
export const SKAB_NIVEAUER = 3;
const skabCache = new Map<number, HTMLCanvasElement>();

/**
 * Serverskab-ark for en given højde: SKAB_NIVEAUER × SKAB_FASER frames à 8 px bredde. Rammen er h + 3 høj
 * (de tre nederste rækker er skabets cyan glød på gulvet). Tegnes selvlysende oven på mørket.
 */
export function skabSprite(h: number): HTMLCanvasElement {
  const hit = skabCache.get(h);
  if (hit) return hit;
  const W = 8;
  const c = document.createElement('canvas');
  c.width = W * SKAB_NIVEAUER * SKAB_FASER;
  c.height = h + 3;
  const x = c.getContext('2d')!;
  const units = Math.max(2, Math.floor((h - 5) / 3));
  let s = 0x9e3779b9 ^ h;
  const rnd = () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
    return (s % 1000) / 1000;
  };
  for (let niv = 0; niv < SKAB_NIVEAUER; niv++) {
    for (let fa = 0; fa < SKAB_FASER; fa++) {
      const ox = (niv * SKAB_FASER + fa) * W;
      const p = (px: number, py: number, w: number, hh: number, f: string) => {
        x.fillStyle = f;
        x.fillRect(ox + px, py, w, hh);
      };
      // kabinet
      p(0, 0, W, h, '#05070f');
      p(1, 1, W - 2, 2, '#1b2440');
      p(2, 1, 1, 1, '#0b0f1c');
      p(4, 1, 1, 1, '#0b0f1c');
      p(1, 3, W - 2, h - 4, '#101629');
      // neonkant i venstre side
      p(0, 1, 1, h - 2, T.cyan);
      const taendt = niv === 0 ? 0 : niv === 1 ? Math.ceil(units / 2) : units;
      for (let u = 0; u < units; u++) {
        const y = 3 + u * 3;
        p(1, y, W - 2, 2, '#172036');
        p(2, y, 3, 1, '#0a0e1a'); // drevskakt
        p(1, y + 2, W - 2, 1, '#0b1020');
        if (u < taendt) {
          const r1 = rnd();
          const r2 = rnd();
          p(5, y, 1, 1, r1 < 0.25 ? '#1a2a2e' : T.good);
          p(6, y, 1, 1, r2 < 0.3 ? '#1a2a2e' : T.cyan);
          if (rnd() < 0.5) p(2, y + 1, 2, 1, rgba(T.cyan, 0.5));
        } else {
          p(5, y, 1, 1, '#1a2a2e');
          p(6, y, 1, 1, u === 0 && niv === 0 && fa % 2 === 0 ? T.warn : '#1a2a2e');
        }
      }
      // glød på gulvet
      x.fillStyle = rgba(T.cyan, niv === 0 ? 0.12 : 0.3);
      x.fillRect(ox + 1, h, W - 2, 1);
      x.fillStyle = rgba(T.cyan, niv === 0 ? 0.06 : 0.15);
      x.fillRect(ox + 2, h + 1, W - 4, 2);
    }
  }
  skabCache.set(h, c);
  return c;
}

// ---------- Skærmlys (blødt, trinvist) ----------
const lysCache = new Map<string, HTMLCanvasElement>();
export const SKAERMLYS_W = 22;
export const SKAERMLYS_H = 16;

/** Blødt lys fra en skærm — lyser personens ansigt og bordet op i mørket. Trinvise ringe, ikke en glat gradient. */
export function skaermLysSprite(farve: string, styrke: number): HTMLCanvasElement {
  const noegle = `${farve}|${styrke}`;
  const hit = lysCache.get(noegle);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = SKAERMLYS_W;
  c.height = SKAERMLYS_H;
  const x = c.getContext('2d')!;
  const cx = SKAERMLYS_W / 2;
  const cy = SKAERMLYS_H / 2;
  for (let k = 0; k < 3; k++) {
    const rx = (SKAERMLYS_W / 2) * (1 - k * 0.28);
    const ry = (SKAERMLYS_H / 2) * (1 - k * 0.28);
    x.fillStyle = rgba(farve, styrke * (0.05 + k * 0.05));
    for (let y = -Math.floor(ry); y <= Math.floor(ry); y++) {
      const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (k === 0) for (let xx = -hw + ((y & 1) ? 1 : 0); xx < hw; xx += 2) x.fillRect(cx + xx, cy + y, 1, 1);
      else x.fillRect(cx - hw, cy + y, hw * 2, 1);
    }
  }
  lysCache.set(noegle, c);
  return c;
}
