// Hvilke signaler auto-pauser spillet (spec 4: events, faseskift, lancering, anmeldelse,
// ledige medarbejdere, messe, gala, kvartalsmøde, markedsåbning, opkøbstilbud, sponsorauktion og reaktioner).
import type { Signal } from './types';

export function pauserFor(sig: Signal): boolean {
  switch (sig.k) {
    case 'fase':
      // Faseskift pauser kun, når den nye fase mangler folk (ellers ville spillet pause hvert par sekunder)
      return sig.tomtHold === true;
    case 'ledig':
      // Ledige pauser kun, når der ikke er et aktivt projekt at sætte dem på
      return sig.ingenOpgaver === true;
    case 'top10':
      // Første gang nogensinde og nye top 3-placeringer; ellers blot en toast
      return sig.foersteGang === true || sig.placering <= 3;
    case 'klar':
    case 'anmeldelse':
    case 'messeVarsel':
    case 'galla':
    case 'kvartal':
    case 'event':
    case 'licens':
    case 'nr1':
    case 'slut':
    case 'advarsel':
    case 'markedAabner':
    case 'regel':
    case 'sanktion':
      return true;
    case 'messe':
      return sig.stoerrelse > 0;
    case 'tilbud':
    case 'sponsorAuktion':
    case 'aktSkift':
    case 'verdensNyhed':
      return true;
    case 'reaktion':
      // Kun reaktioner, der rammer spilleren direkte (bonuskrig og påbud); resten er nyheder og toasts
      return reaktionSomDialog(sig.regel);
    default:
      return false;
  }
}

/** Signaler, der kan åbne en dialog (UI'ets DialogHost) */
export const DIALOG_SIGNALER: Signal['k'][] = ['anmeldelse', 'galla', 'kvartal', 'event', 'messeVarsel', 'messe', 'nr1', 'top10', 'slut', 'runde', 'kontor', 'markedAabner', 'regel', 'sanktion', 'tilbud', 'sponsorAuktion', 'reaktion', 'aktSkift', 'verdensNyhed'];

/** Åbner signalet en dialog? (messer uden stand, Top 10 uden for top 3 og de fleste reaktioner bliver toasts) */
export function aabnerDialog(sig: Signal): boolean {
  if (!DIALOG_SIGNALER.includes(sig.k)) return false;
  if (sig.k === 'messe' && sig.stoerrelse === 0) return false;
  if (sig.k === 'reaktion' && !reaktionSomDialog(sig.regel)) return false;
  if (sig.k === 'top10' && !sig.foersteGang && sig.placering > 3) return false;
  return true;
}

/** Beslutningspause i en uge: en dialog eller et auto-pause-signal (bruges af sim-harnessets pacing-mål) */
export function ugenPauser(signaler: readonly Signal[]): boolean {
  return signaler.some((x) => aabnerDialog(x) || pauserFor(x));
}

/** Reaktioner, der får en dialog (resten vises som toast og i nyhederne) */
export function reaktionSomDialog(regel: string): boolean {
  return regel === 'R1' || regel === 'R8';
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
    case 'markedAabner': return 'Markedsåbning';
    case 'regel': return sig.varsel ? 'Ny regel på vej' : 'Ny regel';
    case 'sanktion': return 'Sanktion';
    case 'tilbud': return 'Opkøbstilbud';
    case 'sponsorAuktion': return 'Sponsorauktion';
    case 'reaktion': return sig.regel === 'R1' ? 'Bonuskrig' : 'Påbud';
    case 'aktSkift': return 'Verdensbilledet 2026';
    case 'verdensNyhed': return sig.titel;
    default: return null;
  }
}
