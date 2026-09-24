// Procedurale pixelfolk (ca. 10×16 synlige pixels) og små ikoner. Alt tegnes én gang til offscreen-canvas og genbruges.
import type { ParamKey, Staff } from '../sim/types';
import { ROLES } from '../data/roles';
import { HAAR, HUD, OEJNE, TROEJE, T, hashTekst, skygge } from './palette';

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
