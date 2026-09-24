// Tidsregning. 1 tick = 1 uge, 52 uger pr. år, uge 0 = første uge af 2012.
import type { Week } from './types';

export const START_AAR = 2012;
export const UGER_PR_AAR = 52;
export const SIDSTE_UGE: Week = 1247; // udgangen af 2035
export const AI_AKT_UGE: Week = (2026 - START_AAR) * UGER_PR_AAR; // 728

export const aarFor = (uge: Week): number => START_AAR + Math.floor(uge / UGER_PR_AAR);
export const ugeIAar = (uge: Week): number => ((uge % UGER_PR_AAR) + UGER_PR_AAR) % UGER_PR_AAR;
/** 0..11 */
export const maanedFor = (uge: Week): number => Math.min(11, Math.floor((ugeIAar(uge) * 12) / UGER_PR_AAR));
/** 0..3 */
export const kvartalFor = (uge: Week): number => Math.min(3, Math.floor(ugeIAar(uge) / 13));
export const ugeFor = (aar: number, maaned = 0): Week =>
  (aar - START_AAR) * UGER_PR_AAR + Math.round((maaned * UGER_PR_AAR) / 12);
/** Sidste uge i et kvartal (12, 25, 38, 51) */
export const erKvartalsSlut = (uge: Week): boolean => {
  const u = ugeIAar(uge);
  return u === 12 || u === 25 || u === 38 || u === 51;
};
/** Årstal som decimaltal, fx 2016.5 — bruges til interpolation af kurver */
export const aarDecimal = (uge: Week): number => START_AAR + uge / UGER_PR_AAR;

export const MAANEDER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'] as const;
export const datoTekst = (uge: Week): string => `${MAANEDER[maanedFor(uge)]}. ${aarFor(uge)}`;
export const ugeTekst = (uge: Week): string => `Uge ${ugeIAar(uge) + 1}, ${aarFor(uge)}`;

/** Lineær interpolation i en kurve af [år, værdi]-punkter (konstant uden for). */
export function kurve(punkter: readonly (readonly [number, number])[], aar: number): number {
  if (punkter.length === 0) return 0;
  if (aar <= punkter[0][0]) return punkter[0][1];
  for (let i = 1; i < punkter.length; i++) {
    const [a1, v1] = punkter[i];
    if (aar <= a1) {
      const [a0, v0] = punkter[i - 1];
      const t = (aar - a0) / (a1 - a0);
      return v0 + (v1 - v0) * t;
    }
  }
  return punkter[punkter.length - 1][1];
}

/** Trinfunktion: seneste værdi, hvis ikrafttrædelse (i uger) er nået. */
export function trin(punkter: readonly (readonly [Week, number])[], uge: Week): number {
  let v = punkter.length ? punkter[0][1] : 0;
  for (const [u, val] of punkter) if (uge >= u) v = val;
  return v;
}
