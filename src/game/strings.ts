import type { FailReason } from '../physics/simulate'
import type { Stars } from '../types'

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

/** The retry hint: what the player is missing for the NEXT star. */
export function goalHint(goal: 'win' | 'coins' | 'par' | 'done', par: number, coins: number): string {
  switch (goal) {
    case 'win':
      return 'Byg banen, så kuglen når målet.'
    case 'coins':
      return coins === 1 ? 'Saml mønten i samme tur for ★2.' : `Saml alle ${coins} mønter i samme tur for ★2.`
    case 'par':
      return `Klar den med højst ${par} brik${par === 1 ? '' : 'ker'} for ★3.`
    case 'done':
      return 'Perfekt løst — alle tre stjerner!'
  }
}

export function starLabel(stars: Stars): string {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars)
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
  completed: 'Klaret',
  par: (n: number) => `Par: ${n} brik${n === 1 ? '' : 'ker'}`,
  locked: (stars: number) => `Lås op med ${stars}★`,
  world: (n: number, name: string) => `Verden ${n} — ${name}`,
  totalStars: (got: number, max: number) => `${got} af ${max} stjerner`,
  soundOn: '🔊 Lyd til',
  soundOff: '🔇 Lyd fra',
  remove: 'Fjern brikken',
  tutorialPlace: 'Tryk på det stiplede felt for at placere rampen',
  tutorialRotate: 'Vælg en vinkel på ringen — previewet viser kuglens vej',
  tutorialDrop: 'Slip kuglen, når maskinen er klar!',
}
