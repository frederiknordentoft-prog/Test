// Akt-chrome: kontorets stemning skifter med tiden (spec 6.19).
// Garage (2012-14): varm og rodet. Vækst (2015-25): ren startup. AI-akten (2026+): mørk og glødende (stub — fuld forvandling kommer senere).
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
  /** Neonlister langs loft og gulv, eller null */
  neon: string | null;
  /** Skærme gløder ud over kanten */
  gloed: boolean;
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
  /** AI-akt-flag: kontoret skal forvandles (fase 5) */
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
    neon: null,
    gloed: false,
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
    neon: null,
    gloed: false,
    ramme: '#0d0f1c',
    skaerm: { projektBg: '#13233a', kontraktBg: '#3a2a10', kontraktLinje: T.gold, ledigBg: '#172a2e', ledigPrik: T.cyan, slukket: '#151823' },
    forvandlet: false,
  },
  ai: {
    id: 'ai',
    navn: 'AI-akten',
    lys: '#2a3cff',
    lysAlpha: 0.12,
    vignette: 0.5,
    rod: 0,
    moerk: 0.42,
    neon: T.cyan,
    gloed: true,
    ramme: '#05060d',
    skaerm: { projektBg: '#0a1a2e', kontraktBg: '#2e1f0a', kontraktLinje: T.gold, ledigBg: '#0c1c24', ledigPrik: T.cyan, slukket: '#0a0c14' },
    forvandlet: true,
  },
};
