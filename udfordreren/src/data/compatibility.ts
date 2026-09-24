// Kombinationsbogen: type × tema → vurdering 1-5 [D].
// Spec-eksempler: Livebetting × Fodbold = Genialt, Egne slots × Nordisk = Fremragende,
// Esport × Esport = Godt, Prematch × Formel = OK, Livekasino × Retro = Ikke godt.
import type { ProductTypeId, ThemeId } from '../sim/types';

export type Fit = 1 | 2 | 3 | 4 | 5;
export const FIT_NAVN: Record<Fit, string> = { 1: 'Ikke godt', 2: 'OK', 3: 'Godt', 4: 'Fremragende', 5: 'Genialt' };
/** Multiplikator på Spillerforums vurdering og kundetiltræk [D] */
export const FIT_FAKTOR: Record<Fit, number> = { 1: 0.7, 2: 0.9, 3: 1.05, 4: 1.2, 5: 1.35 };

// Rækkefølge: fodbold haandbold tennis esport formel eventyr nordisk retro jul rigdom popkultur natur mytologi sci-fi
const TEMA_ORDEN: ThemeId[] = [
  'fodbold', 'haandbold', 'tennis', 'esport', 'formel', 'eventyr', 'nordisk',
  'retro', 'jul', 'rigdom', 'popkultur', 'natur', 'mytologi', 'sci-fi',
];

const MATRIX: Record<ProductTypeId, Fit[]> = {
  //                 fod hån ten esp for eve nor ret jul rig pop nat myt sci
  prematch:         [5,  4,  4,  2,  2,  1,  2,  1,  2,  1,  2,  1,  1,  1],
  livebetting:      [5,  4,  4,  3,  3,  1,  1,  1,  1,  1,  1,  1,  1,  1],
  betBuilder:       [5,  3,  2,  3,  2,  1,  1,  1,  2,  1,  2,  1,  1,  1],
  esport:           [2,  1,  1,  3,  2,  2,  1,  2,  1,  1,  3,  1,  2,  4],
  eventKontrakter:  [3,  2,  2,  3,  3,  1,  1,  1,  1,  2,  4,  2,  1,  2],
  slotsAggregator:  [2,  1,  1,  2,  2,  4,  3,  3,  3,  4,  3,  3,  4,  3],
  egneSlots:        [2,  1,  1,  2,  1,  4,  4,  3,  3,  4,  3,  3,  5,  3],
  livekasino:       [3,  1,  1,  1,  2,  2,  2,  1,  3,  5,  4,  1,  2,  2],
  jackpotNetvaerk:  [2,  1,  1,  1,  1,  4,  3,  3,  4,  5,  3,  2,  4,  3],
  aiSlots:          [2,  1,  1,  2,  1,  3,  3,  3,  3,  3,  4,  3,  3,  5],
};

export function fitFor(typeId: ProductTypeId, themeId: ThemeId): Fit {
  const i = TEMA_ORDEN.indexOf(themeId);
  return MATRIX[typeId][i] ?? 1;
}

export const komboNoegle = (typeId: ProductTypeId, themeId: ThemeId): string => `${typeId}:${themeId}`;
