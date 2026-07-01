import type { FailReason } from '../physics/simulate'

/** Danish description of how a run ended. */
export function reasonText(result: 'won' | 'failed', reason: FailReason | null): string {
  if (result === 'won') return 'Kuglen ramte målet!'
  switch (reason) {
    case 'failzone':
      return 'Kuglen røg i en faldgrube.'
    case 'settled':
      return 'Kuglen stoppede uden at nå målet.'
    case 'timeout':
      return 'Kuglen nåede aldrig i mål.'
    default:
      return 'Kuglen ramte ikke målet.'
  }
}

export const UI = {
  drop: 'Slip kuglen',
  dropping: 'Kuglen ruller …',
  retry: 'Prøv igen',
  clear: 'Ryd brikker',
  next: 'Næste bane',
  back: 'Baner',
  selectTitle: 'Vælg bane',
  won: 'Vundet!',
  failed: 'Ikke i mål',
  piecesLeft: (n: number) => `${n} brik${n === 1 ? '' : 'ker'} tilbage`,
  hintPlace: 'Vælg en brik og tryk på et felt for at placere den. Tryk igen for at rotere.',
  completed: 'Klaret',
}
