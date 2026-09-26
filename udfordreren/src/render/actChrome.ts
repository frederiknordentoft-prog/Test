// Akt-chrome: kontorets stemning skifter med tiden (spec 6.19).
// Garage (2012-14): varm og rodet. Vækst (2015-25): ren startup. AI-akten (2026+): mørk og glødende — rummet dæmpes,
// neonlister tændes, serverskabe rulles ind, og agenterne står som cyan hologrammer mellem menneskene.
import { aarFor } from '../sim/time';
import { T } from './palette';

export type Akt = 'garage' | 'vaekst' | 'ai';

export function aktFor(uge: number): Akt {
  const aar = aarFor(uge);
  if (aar <= 2014) return 'garage';
  if (aar >= 2026) return 'ai';
  return 'vaekst';
}

export type AktChrome = {
  id: Akt;
  navn: string;
  /** Farvetone over hele rummet */
  lys: string;
  lysAlpha: number;
  /** Mørke hjørner 0..1 */
  vignette: number;
  /** Rod på gulv og borde 0..1 (pizzabakker, papirer, kabler) */
  rod: number;
  /** Mørklægning af rummet 0..1 (AI-akten) */
  moerk: number;
  /** Farven, rummet mørklægges med */
  moerkFarve: string;
  /** Neonlister langs loft og gulv, eller null */
  neon: string | null;
  /** Anden neonfarve (firmaskilt og lodrette lister) */
  neon2: string | null;
  /** Skærme gløder ud over kanten */
  gloed: boolean;
  /** Skærmenes lys på ansigter og borde (menneskernes skærme — agenterne er cyan) */
  skaermLys: string;
  /** Scanlines og et langsomt lysbånd hen over rummet */
  scanlines: boolean;
  /** Letterbox-farve omkring canvas */
  ramme: string;
  skaerm: {
    projektBg: string;
    kontraktBg: string;
    kontraktLinje: string;
    ledigBg: string;
    ledigPrik: string;
    slukket: string;
  };
  /** AI-akten: kontoret er forvandlet (serverskabe, hologrammer, neon) */
  forvandlet: boolean;
};

export const AKT_CHROME: Record<Akt, AktChrome> = {
  garage: {
    id: 'garage',
    navn: 'Garagen',
    lys: '#ff9a3c',
    lysAlpha: 0.1,
    vignette: 0.35,
    rod: 1,
    moerk: 0,
    moerkFarve: '#05081a',
    neon: null,
    neon2: null,
    gloed: false,
    skaermLys: '#fff1c8',
    scanlines: false,
    ramme: '#120d0a',
    skaerm: { projektBg: '#142033', kontraktBg: '#3a2810', kontraktLinje: T.warn, ledigBg: '#18262a', ledigPrik: T.cyan, slukket: '#15171f' },
    forvandlet: false,
  },
  vaekst: {
    id: 'vaekst',
    navn: 'Vækst',
    lys: '#dff2ff',
    lysAlpha: 0.04,
    vignette: 0.18,
    rod: 0.25,
    moerk: 0,
    moerkFarve: '#05081a',
    neon: null,
    neon2: null,
    gloed: false,
    skaermLys: '#e4f0ff',
    scanlines: false,
    ramme: '#0d0f1c',
    skaerm: { projektBg: '#13233a', kontraktBg: '#3a2a10', kontraktLinje: T.gold, ledigBg: '#172a2e', ledigPrik: T.cyan, slukket: '#151823' },
    forvandlet: false,
  },
  ai: {
    id: 'ai',
    navn: 'AI-akten',
    lys: '#3a2cff',
    lysAlpha: 0.1,
    vignette: 0.55,
    rod: 0,
    moerk: 0.58,
    moerkFarve: '#04061a',
    neon: T.cyan,
    neon2: T.pink,
    gloed: true,
    // Menneskernes skærme lyser varmt hvidt; agenterne gløder cyan — så de to kan altid skelnes
    skaermLys: '#dfe8ff',
    scanlines: true,
    ramme: '#04050b',
    skaerm: { projektBg: '#0c2240', kontraktBg: '#2e1f0a', kontraktLinje: T.gold, ledigBg: '#0e1c2a', ledigPrik: '#dfe8ff', slukket: '#080a12' },
    forvandlet: true,
  },
};

// ---------- Forvandlingen (akt-skiftet til AI-akten) ----------
// Tidslinje i ms efter start. Starter først, når "Verdensbilledet 2026" (og andre dialoger) er lukket, så man ser den.

export const FORVANDLING = {
  /** Lyset dæmpes (gammel kulisse toner ud, mørket kommer) */
  daempFra: 150,
  daempTil: 1500,
  /** Neon blinker og tænder */
  neonFra: 1250,
  neonTil: 2150,
  /** Serverskabe rulles ind fra højre, et ad gangen */
  skabFra: 1800,
  skabVarighed: 650,
  skabForskyd: 110,
  /** Hologrammerne materialiserer sig nedefra */
  holoFra: 2500,
  holoVarighed: 520,
  holoForskyd: 80,
  /** Hele forvandlingen er slut efter (loft) */
  slut: 4600,
} as const;

function klem(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function easeOutCubic(t: number): number {
  const u = 1 - klem(t);
  return 1 - u * u * u;
}

export function easeOutBack(t: number): number {
  const c1 = 1.6;
  const c3 = c1 + 1;
  const u = klem(t) - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

/** Hvor langt er lyset dæmpet (0 = gammel akt, 1 = mørkt)? Loftslyset blafrer to gange, før det går ud. */
export function daempning(e: number): number {
  const t = klem((e - FORVANDLING.daempFra) / (FORVANDLING.daempTil - FORVANDLING.daempFra));
  // blaf: kort mørkt glimt tidligt i forløbet
  if (e > 260 && e < 340) return 0.7;
  if (e > 470 && e < 520) return 0.55;
  return t * t * (3 - 2 * t);
}

/** Neonens styrke 0..1 (blinker et par gange, som lysstofrør, der tændes) */
export function neonTaend(e: number): number {
  if (e < FORVANDLING.neonFra) return 0;
  if (e >= FORVANDLING.neonTil) return 1;
  const k = (e - FORVANDLING.neonFra) / (FORVANDLING.neonTil - FORVANDLING.neonFra);
  // tænd-sluk-mønster: on/off i trin
  const trin = [1, 0, 0, 1, 1, 0, 1, 1, 1, 0.6, 1, 1];
  return trin[Math.min(trin.length - 1, Math.floor(k * trin.length))] * (0.5 + 0.5 * k);
}

/** Skab j's indrulning 0..1 */
export function skabInd(e: number, j: number): number {
  return klem((e - FORVANDLING.skabFra - j * FORVANDLING.skabForskyd) / FORVANDLING.skabVarighed);
}

/** Hologram i's materialisering 0..1 */
export function holoInd(e: number, i: number): number {
  return klem((e - FORVANDLING.holoFra - i * FORVANDLING.holoForskyd) / FORVANDLING.holoVarighed);
}

/** Varigheden af en forvandling med n skabe og m hologrammer (ms) */
export function forvandlingsVarighed(skabe: number, holo: number): number {
  const s = FORVANDLING.skabFra + Math.max(0, skabe - 1) * FORVANDLING.skabForskyd + FORVANDLING.skabVarighed;
  const h = FORVANDLING.holoFra + Math.max(0, holo - 1) * FORVANDLING.holoForskyd + FORVANDLING.holoVarighed;
  return Math.min(FORVANDLING.slut + 1200, Math.max(FORVANDLING.slut, s, h) + 200);
}
