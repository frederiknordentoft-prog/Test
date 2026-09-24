// Hvilke signaler auto-pauser spillet (spec 4: events, faseskift, lancering, anmeldelse,
// ledige medarbejdere, messe, gala, kvartalsmøde og markedsåbning).
import type { Signal } from './types';

export function pauserFor(sig: Signal): boolean {
  switch (sig.k) {
    case 'fase':
    case 'klar':
    case 'anmeldelse':
    case 'ledig':
    case 'messeVarsel':
    case 'galla':
    case 'kvartal':
    case 'event':
    case 'licens':
    case 'nr1':
    case 'top10':
    case 'slut':
    case 'advarsel':
      return true;
    case 'messe':
      return sig.stoerrelse > 0;
    default:
      return false;
  }
}

export function pauseTekst(sig: Signal): string | null {
  switch (sig.k) {
    case 'fase': return 'Ny fase';
    case 'klar': return 'Klar til lancering';
    case 'anmeldelse': return 'Anmeldelse';
    case 'ledig': return 'Ledige medarbejdere';
    case 'messeVarsel': return 'Messe på vej';
    case 'messe': return 'Messe';
    case 'galla': return 'Branchegallaen';
    case 'kvartal': return 'Kvartalsmøde';
    case 'event': return 'Hændelse';
    case 'licens': return 'Licens godkendt';
    case 'nr1': return 'Nr. 1!';
    case 'top10': return 'Top 10!';
    case 'slut': return 'Spillet er slut';
    case 'advarsel': return 'Advarsel';
    default: return null;
  }
}
