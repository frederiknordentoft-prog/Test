// Eksport og import af filer, der også virker på iOS/iPad (Safari og installeret app). Ingen React.
import { erInstalleret, erTouch } from './enhed';

/** Over denne størrelse bruges en Blob-URL (data-URL'er har en længdegrænse på ca. 2 MB i Chromium) */
const MAX_DATA_URL = 1_500_000;

/**
 * Hent en fil via a[download]. Et helt spil fylder under 0,5 MB (2035, målt), så en data-URL rækker og skal ikke
 * frigives bagefter. Større filer går via en Blob-URL, som browseren rydder op i, når siden lukkes.
 */
function hentViaLink(filnavn: string, indhold: string, type: string): void {
  const data = `data:${type};charset=utf-8,${encodeURIComponent(indhold)}`;
  const a = document.createElement('a');
  a.href = data.length <= MAX_DATA_URL ? data : URL.createObjectURL(new Blob([indhold], { type }));
  a.download = filnavn;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type GemFilResultat = 'hentet' | 'delt' | 'annulleret';

/**
 * Gem en tekstfil hos spilleren. En installeret app på en touch-enhed (fx iPad) bruger delearket ("Gem i Filer"),
 * fordi en almindelig download der kan åbne en visning uden vej tilbage til spillet. Ellers en almindelig download.
 */
export async function gemFil(filnavn: string, indhold: string, type = 'application/json'): Promise<GemFilResultat> {
  if (erInstalleret() && erTouch() && typeof File !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const fil = new File([indhold], filnavn, { type });
      if (navigator.canShare?.({ files: [fil] })) {
        await navigator.share({ files: [fil], title: filnavn });
        return 'delt';
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'annulleret';
      // Andre fejl: prøv en almindelig download i stedet
    }
  }
  hentViaLink(filnavn, indhold, type);
  return 'hentet';
}

/** Læs en valgt fil som tekst (File.text mangler i ældre Safari — så bruges FileReader). Kaster aldrig. */
export function laesFil(fil: Blob): Promise<string | null> {
  if (typeof fil.text === 'function') return fil.text().catch(() => null);
  return new Promise((resolve) => {
    try {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsText(fil);
    } catch {
      resolve(null);
    }
  });
}
