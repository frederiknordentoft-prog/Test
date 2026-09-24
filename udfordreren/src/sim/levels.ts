// Type- og temaniveauer 1-10, der stiger med brug (Game Dev Storys genreniveauer).
import type { GameState, ProductTypeId, ThemeId } from './types';
import { signal } from './util';

/** Kumulativt antal "brug" for at nå niveau n (indeks = niveau − 1) [D] */
export const NIVEAU_TAERSKLER = [0, 2, 4, 7, 10, 14, 18, 23, 28, 34] as const;

export function niveauForXp(xp: number): number {
  let n = 1;
  for (let i = 0; i < NIVEAU_TAERSKLER.length; i++) if (xp >= NIVEAU_TAERSKLER[i]) n = i + 1;
  return n;
}

/** xp til næste niveau (null på niveau 10) */
export function xpTilNaesteNiveau(xp: number): number | null {
  const n = niveauForXp(xp);
  if (n >= NIVEAU_TAERSKLER.length) return null;
  return NIVEAU_TAERSKLER[n] - xp;
}

function tilfoejType(s: GameState, id: ProductTypeId, xp: number): void {
  const foer = s.niveauer.type[id];
  s.niveauXp.type[id] += xp;
  const efter = niveauForXp(s.niveauXp.type[id]);
  s.niveauer.type[id] = efter;
  if (efter > foer) signal(s, { k: 'typeNiveau', typeId: id, niveau: efter });
}

function tilfoejTema(s: GameState, id: ThemeId, xp: number): void {
  const foer = s.niveauer.tema[id];
  s.niveauXp.tema[id] += xp;
  const efter = niveauForXp(s.niveauXp.tema[id]);
  s.niveauer.tema[id] = efter;
  if (efter > foer) signal(s, { k: 'temaNiveau', themeId: id, niveau: efter });
}

/** Kaldes ved lancering: +1 brug, +1 ekstra ved en god anmeldelse (≥ 28) */
export function registrerBrug(s: GameState, typeId: ProductTypeId, themeId: ThemeId, total40: number): void {
  const xp = total40 >= 28 ? 2 : 1;
  tilfoejType(s, typeId, xp);
  tilfoejTema(s, themeId, xp);
}

/** Hall of Fame: permanent +1 niveau i type og tema */
export function hallOfFameBonus(s: GameState, typeId: ProductTypeId, themeId: ThemeId): void {
  const bump = (xp: number): number => {
    const n = niveauForXp(xp);
    if (n >= NIVEAU_TAERSKLER.length) return 0;
    return NIVEAU_TAERSKLER[n] - xp;
  };
  tilfoejType(s, typeId, bump(s.niveauXp.type[typeId]));
  tilfoejTema(s, themeId, bump(s.niveauXp.tema[themeId]));
}

/** Pointbonus fra niveauer */
export function niveauFaktor(s: GameState, typeId: ProductTypeId, themeId: ThemeId, bonusPrNiveau: number): number {
  return 1 + bonusPrNiveau * (s.niveauer.type[typeId] - 1) + bonusPrNiveau * (s.niveauer.tema[themeId] - 1);
}
